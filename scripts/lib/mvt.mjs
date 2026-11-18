/**
 * A minimal Mapbox Vector Tile reader.
 *
 * MapLibre brings `@mapbox/vector-tile` and `pbf` along, but they are transitive
 * dependencies of the map library and both have moved their export shape between
 * majors (pbf v4 exposes `PbfReader`/`PbfWriter`, not a default). A build script
 * that silently breaks when someone reinstalls is worse than 120 lines of wire
 * format, so the format is decoded here: prototype buffers, varints, packed
 * uint32s and zigzag deltas. Only what a harvest needs is implemented — no
 * projection maths beyond tile coordinates, no geometry simplification.
 */

class Buf {
  constructor(u8, start = 0, end = u8.length) {
    this.u8 = u8;
    this.pos = start;
    this.end = end;
  }

  varint() {
    let out = 0;
    let shift = 0;
    for (;;) {
      const b = this.u8[this.pos++];
      if (b === undefined) throw new Error("mvt: truncated varint");
      out += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) return out;
      shift += 7;
      if (shift > 63) throw new Error("mvt: varint too long");
    }
  }

  string() {
    const len = this.varint();
    const s = new TextDecoder().decode(this.u8.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }

  bytes() {
    const len = this.varint();
    const out = this.u8.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`mvt: bad wire type ${wire}`);
  }
}

const zigzag = (n) => (n >> 1) ^ -(n & 1);

/** One packed uint32 array (tags or geometry). */
function packed(buf) {
  const len = buf.varint();
  const stop = buf.pos + len;
  const out = [];
  while (buf.pos < stop) out.push(buf.varint());
  return out;
}

function decodeGeometry(cmds) {
  const rings = [];
  let ring = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < cmds.length) {
    const cmd = cmds[i++];
    const id = cmd & 0x7;
    const count = cmd >> 3;
    if (id === 1 || id === 2) {
      for (let k = 0; k < count; k++) {
        x += zigzag(cmds[i++]);
        y += zigzag(cmds[i++]);
        ring.push([x, y]);
        if (id === 1 && ring.length > 1) {
          rings.push(ring);
          ring = [];
        }
      }
    } else if (id === 7) {
      if (ring.length) rings.push(ring);
      ring = [];
    } else {
      throw new Error(`mvt: bad geometry command ${id}`);
    }
  }
  if (ring.length) rings.push(ring);
  return rings;
}

function readValue(buf) {
  let value = null;
  while (buf.pos < buf.end) {
    const tag = buf.varint();
    const field = tag >> 3;
    const wire = tag & 0x7;
    if (field === 1) value = buf.string();
    else if (field === 2) {
      const d = new DataView(buf.u8.buffer, buf.u8.byteOffset + buf.pos, 4);
      value = d.getFloat32(0, true);
      buf.pos += 4;
    } else if (field === 3) {
      const d = new DataView(buf.u8.buffer, buf.u8.byteOffset + buf.pos, 8);
      value = d.getFloat64(0, true);
      buf.pos += 8;
    } else if (field === 4 || field === 5) value = buf.varint();
    else if (field === 6) value = zigzag(buf.varint());
    else if (field === 7) value = buf.varint() !== 0;
    else buf.skip(wire);
  }
  return value;
}

function readLayer(buf) {
  let name = "";
  let extent = 4096;
  const keys = [];
  const values = [];
  const features = [];

  while (buf.pos < buf.end) {
    const tag = buf.varint();
    const field = tag >> 3;
    const wire = tag & 0x7;
    if (field === 1) name = buf.string();
    else if (field === 2) {
      const raw = buf.bytes();
      const fb = new Buf(raw);
      const f = { tags: [], type: 0, geometry: [] };
      while (fb.pos < fb.end) {
        const ft = fb.varint();
        const ff = ft >> 3;
        const fw = ft & 0x7;
        if (ff === 1) f.id = fb.varint();
        else if (ff === 2) f.tags = packed(fb);
        else if (ff === 3) f.type = fb.varint();
        else if (ff === 4) f.geometry = packed(fb);
        else fb.skip(fw);
      }
      features.push(f);
    } else if (field === 3) keys.push(buf.string());
    else if (field === 4) {
      const raw = buf.bytes();
      values.push(readValue(new Buf(raw)));
    } else if (field === 5) extent = buf.varint();
    else buf.skip(wire);
  }

  return { name, extent, features, keys, values };
}

/** All layers of a tile, as `{ name, extent, features: [{ props, type, rings }] }`. */
export function readTile(u8) {
  const buf = new Buf(u8);
  const layers = [];
  while (buf.pos < buf.end) {
    const tag = buf.varint();
    const field = tag >> 3;
    const wire = tag & 0x7;
    if (field === 3) {
      const raw = buf.bytes();
      const lb = new Buf(raw);
      const layer = readLayer(lb);
      layer.features = layer.features.map((f) => {
        const props = {};
        for (let i = 0; i < f.tags.length; i += 2) {
          props[layer.keys[f.tags[i]]] = layer.values[f.tags[i + 1]];
        }
        return { props, type: f.type, rings: decodeGeometry(f.geometry) };
      });
      layers.push(layer);
    } else buf.skip(wire);
  }
  return layers;
}

/** Web-Mercator tile coordinates. */
export function tileXY(lon, lat, z) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

/** A point inside a tile, in degrees. */
export function pointLonLat(x, y, z, px, py, extent) {
  const n = 2 ** z;
  const lon = ((x + px / extent) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI;
  return [lon, lat];
}
