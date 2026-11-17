import { addProtocol, type AddProtocolAction, type GetResourceResponse } from "maplibre-gl";

/**
 * Terrane's elevation source.
 *
 * AWS/Mapzen Terrarium is the usual free DEM, but past z11 it is a bilinear
 * upsample of itself: measured on the Alps, a z12 tile is ~98% predictable from
 * its z11 parent (RMS 8 m against a 365 m spread), so the "12 m" at z15 is the
 * same ~150 m surface resampled more finely. Overzoomed that reads as blurred,
 * low-contrast relief — exactly what deep zoom was showing.
 *
 * Mapterhorn publishes the same Terrarium encoding at 512 px, built from
 * Copernicus GLO-30 (30 m) plus national LiDAR/ALS models (1–5 m) where they
 * exist. Its global pyramid ends at z12; z13+ tiles only exist over those
 * national datasets, which is where the protocol below comes in.
 *
 * The source advertises maxzoom 14 (the map's own max), and every request is
 * answered at 512 px:
 *
 *   - z ≤ 12, and z13+ over a national dataset: the real Mapterhorn tile.
 *   - z13+ elsewhere: the z12 parent, resampled up to the requested extent.
 *     Four children share one parent decode.
 *
 * Why the resample rather than letting MapLibre overzoom: hillshade slope is
 * computed per texel against the zoom of the tile ID, so an overzoomed tile has
 * its slopes multiplied by 2^(camera − tile) — steep faces saturate to solid
 * shadow and the paint exaggeration has to be dropped to compensate, which is
 * what flattened the relief. Supplying a real tile for every requested zoom
 * keeps the slope maths consistent, so the shading stays legible everywhere.
 *
 * The resample happens on decoded elevations, not on the encoded image: R, G and
 * B are three bytes of one number, and interpolating them separately puts a
 * 256 m notch wherever the carry lands. Rendered as hillshade, that artifact
 * drew a hard contour line every 256 m across the whole view.
 *
 * A tile that cannot be found at any level (open ocean is a 404 in places)
 * resolves to flat sea level instead of an error, so relief never has a gap.
 */

export const DEM_SCHEME = "terranedem";

/** Native tile grid: 512 px per tile, Terrarium encoding. */
export const DEM_TILE_SIZE = 512;

/** Deepest level the source advertises — the map's own maxZoom. */
export const DEM_MAX_ZOOM = 14;

/** Deepest level that exists worldwide. Deeper tiles are regional only. */
const GLOBAL_MAX_ZOOM = 12;

const TILE_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";

/** Plain HTTP template, for consumers that cannot use the MapLibre protocol
 *  (the contour worker fetches tiles itself). */
export const DEM_HTTP_TILE_URL = TILE_URL;

function tileURL(z: number, x: number, y: number) {
  return TILE_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

type Bitmap = ImageBitmap;

const PLAIN = DEM_TILE_SIZE * DEM_TILE_SIZE;

/* Decoded parents are shared by the four children that crop them, so the float
   grid — not the bitmap — is what gets cached. */
const elevationCache = new Map<string, Float32Array>();
const ELEV_CACHE_LIMIT = 12;
/* 404s are remembered so panning back over a range without coverage does not
   re-request the same missing tiles. */
const missing = new Set<string>();

async function fetchNative(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<Bitmap | null> {
  const key = `${z}/${x}/${y}`;
  if (missing.has(key)) return null;
  try {
    const res = await fetch(tileURL(z, x, y), { signal });
    if (!res.ok) {
      if (missing.size < 4096) missing.add(key);
      return null;
    }
    return await createImageBitmap(await res.blob());
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    return null;
  }
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function surface(): { ctx: Ctx; take: () => Promise<Bitmap> } {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(DEM_TILE_SIZE, DEM_TILE_SIZE);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      return {
        ctx: ctx as unknown as Ctx,
        take: async () => canvas.transferToImageBitmap(),
      };
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = DEM_TILE_SIZE;
  canvas.height = DEM_TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context for DEM tile");
  return { ctx, take: () => createImageBitmap(canvas) };
}

/** Terrarium: elevation in metres = R·256 + G + B/256 − 32768. */
function decodeElevations(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(PLAIN);
  for (let i = 0, p = 0; p < PLAIN; i += 4, p += 1) {
    out[p] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
  }
  return out;
}

function encodeElevations(elev: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(PLAIN * 4);
  for (let p = 0, i = 0; p < PLAIN; p += 1, i += 4) {
    const v = elev[p] + 32768;
    const whole = Math.floor(v);
    const r = whole >> 8;
    out[i] = r;
    out[i + 1] = whole - r * 256;
    out[i + 2] = Math.round((v - whole) * 256);
    out[i + 3] = 255;
  }
  return out;
}

async function parentElevation(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<Float32Array | null> {
  const key = `${z}/${x}/${y}`;
  const cached = elevationCache.get(key);
  if (cached) return cached;
  const bitmap = await fetchNative(z, x, y, signal);
  if (!bitmap) return null;
  const { ctx } = surface();
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, DEM_TILE_SIZE, DEM_TILE_SIZE);
  const elev = decodeElevations(image.data);
  elevationCache.set(key, elev);
  if (elevationCache.size > ELEV_CACHE_LIMIT) {
    const oldest = elevationCache.keys().next().value;
    if (oldest !== undefined) elevationCache.delete(oldest);
  }
  return elev;
}

/**
 * Resample a parent tile up to a child tile.
 *
 * Bilinear on elevations, then one gentle unsharp pass pulled back inside the
 * local elevation range. Bilinear alone is the softness people mean by
 * "blurry"; the clamp stops sharpening from inventing cliffs at the texel
 * scale.
 */
async function resample(
  parent: Float32Array,
  childX: number,
  childY: number,
  levels: number,
): Promise<Bitmap> {
  const children = 2 ** levels;
  const span = DEM_TILE_SIZE / children;
  const originX = childX * span;
  const originY = childY * span;
  const out = new Float32Array(PLAIN);

  for (let py = 0; py < DEM_TILE_SIZE; py += 1) {
    const sy = Math.min(DEM_TILE_SIZE - 1, Math.max(0, originY + (py + 0.5) / children - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(DEM_TILE_SIZE - 1, y0 + 1);
    const fy = sy - y0;
    const row0 = y0 * DEM_TILE_SIZE;
    const row1 = y1 * DEM_TILE_SIZE;
    const dest = py * DEM_TILE_SIZE;
    for (let px = 0; px < DEM_TILE_SIZE; px += 1) {
      const sx = Math.min(DEM_TILE_SIZE - 1, Math.max(0, originX + (px + 0.5) / children - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(DEM_TILE_SIZE - 1, x0 + 1);
      const fx = sx - x0;
      const top = parent[row0 + x0] + (parent[row0 + x1] - parent[row0 + x0]) * fx;
      const bottom = parent[row1 + x0] + (parent[row1 + x1] - parent[row1 + x0]) * fx;
      out[dest + px] = top + (bottom - top) * fy;
    }
  }

  /* Unsharp with a 3×3 box, clamped to the neighbourhood's own range. The
     outer ring is left as the plain bilinear result: sharpening it against a
     clamped neighbourhood gives each tile a slightly different edge, which
     shows up on screen as a hairline seam between tiles. */
  const sharpened = out.slice();
  const AMOUNT = 0.65;
  for (let y = 1; y < DEM_TILE_SIZE - 1; y += 1) {
    const ym = y - 1;
    const yp = y + 1;
    const row = y * DEM_TILE_SIZE;
    for (let x = 1; x < DEM_TILE_SIZE - 1; x += 1) {
      const xm = x - 1;
      const xp = x + 1;
      let sum = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (let ny = ym; ny <= yp; ny += 1) {
        const base = ny * DEM_TILE_SIZE;
        for (let nx = xm; nx <= xp; nx += 1) {
          const v = out[base + nx];
          sum += v;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      const mean = sum / 9;
      const value = out[row + x] + AMOUNT * (out[row + x] - mean);
      sharpened[row + x] = value < lo ? lo : value > hi ? hi : value;
    }
  }

  const { ctx, take } = surface();
  const image = ctx.createImageData(DEM_TILE_SIZE, DEM_TILE_SIZE);
  image.data.set(encodeElevations(sharpened));
  ctx.putImageData(image, 0, 0);
  return take();
}

/** Terrarium sea level: R=128, G=0, B=0 encodes exactly 0 m. */
let flat: Promise<Bitmap> | null = null;
function flatTile() {
  if (!flat) {
    const { ctx, take } = surface();
    ctx.fillStyle = "rgb(128, 0, 0)";
    ctx.fillRect(0, 0, DEM_TILE_SIZE, DEM_TILE_SIZE);
    flat = take();
  }
  return flat;
}

async function resolveTile(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<Bitmap> {
  const native = await fetchNative(z, x, y, signal);
  if (native) return native;

  /* Skip straight to the global level: national coverage is all or nothing per
     tile, so probing z13 first only buys a 404 over most of the planet. */
  for (let pz = Math.min(z - 1, GLOBAL_MAX_ZOOM); pz >= 0; pz -= 1) {
    const levels = z - pz;
    const px = x >> levels;
    const py = y >> levels;
    const parent = await parentElevation(pz, px, py, signal);
    if (parent) return resample(parent, x - (px << levels), y - (py << levels), levels);
  }
  return flatTile();
}

let installed = false;

/**
 * Register the DEM tile protocol. Idempotent, and global to the module so a
 * second globe (a remount, a route change) does not pay for it twice.
 */
export function installDemProtocol() {
  if (installed) return;
  installed = true;
  const load = (async ({ url }, abortController) => {
    const match = /^terranedem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(url);
    if (!match) throw new Error(`Unrecognised DEM tile URL: ${url}`);
    const z = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    const bitmap = await resolveTile(z, x, y, abortController.signal);
    // MapLibre hands an ImageBitmap straight to the GPU, skipping a decode.
    return { data: bitmap } as unknown as GetResourceResponse<ArrayBuffer>;
  }) as AddProtocolAction;
  addProtocol(DEM_SCHEME, load);
}
