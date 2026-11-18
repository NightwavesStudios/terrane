import type { Map as MlMap } from "maplibre-gl";

/**
 * The camping-kit pictograms, drawn once into canvases.
 *
 * The basemap has no sprite sheet, and fetching an image atlas to get five 20 px
 * icons is not worth a request. Each icon is a few paths on a 20-unit grid,
 * rasterised at 2× and handed to MapLibre with `pixelRatio: 2` — no bytes on the
 * wire, and the same drawing code renders the key in the layers panel, so the
 * legend can never drift from the map.
 *
 * Shape carries the meaning, colour only reinforces it: a tent, a roof, a
 * lean-to, a drop and a parking sign survive being 12 px tall in a way that five
 * coloured circles never did.
 */
export type KitIcon =
  | "camp-tent"
  | "camp-hut"
  | "camp-shelter"
  | "water-drop"
  | "parking"
  | "picnic-table"
  | "viewpoint"
  | "caravan"
  | "toilets"
  | "shower"
  | "info"
  | "trailhead";

export const KIT_ICONS: KitIcon[] = [
  "camp-tent",
  "camp-hut",
  "camp-shelter",
  "water-drop",
  "parking",
  "picnic-table",
  "viewpoint",
  "caravan",
  "toilets",
  "shower",
  "info",
  "trailhead",
];

const GRID = 20;
const STROKE = "#05090f";

const PEN = {
  sand: "#f0d49a",
  roof: "#e08a3c",
  amber: "#ffb066",
  shelter: "#9ec7e0",
  water: "#5fb4d8",
  sign: "#78808c",
  eye: "#c9dced",
  glyph: "#eef4f8",
};

function paint(g: CanvasRenderingContext2D, name: KitIcon) {
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = STROKE;
  g.lineWidth = 1.2;

  switch (name) {
    case "camp-tent": {
      g.fillStyle = PEN.sand;
      g.beginPath();
      g.moveTo(10, 3);
      g.lineTo(18.7, 16.8);
      g.lineTo(1.3, 16.8);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = STROKE;
      g.beginPath();
      g.moveTo(10, 12.2);
      g.lineTo(11.5, 16.8);
      g.lineTo(8.5, 16.8);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(0.6, 16.8);
      g.lineTo(19.4, 16.8);
      g.stroke();
      break;
    }

    case "camp-hut": {
      g.fillStyle = PEN.amber;
      g.beginPath();
      g.rect(4.4, 9.4, 11.2, 7.2);
      g.fill();
      g.stroke();
      g.fillStyle = PEN.roof;
      g.beginPath();
      g.moveTo(10, 2.8);
      g.lineTo(17.6, 9.6);
      g.lineTo(2.4, 9.6);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = STROKE;
      g.beginPath();
      g.rect(8.6, 13, 2.8, 3.6);
      g.fill();
      break;
    }

    case "camp-shelter": {
      g.fillStyle = PEN.shelter;
      g.beginPath();
      g.moveTo(2.8, 16.8);
      g.lineTo(13.4, 4.2);
      g.lineTo(17.2, 16.8);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(2.8, 16.8);
      g.lineTo(17.2, 16.8);
      g.stroke();
      break;
    }

    case "water-drop": {
      g.fillStyle = PEN.water;
      g.beginPath();
      g.moveTo(10, 2.8);
      g.quadraticCurveTo(15.6, 10.2, 15.6, 13);
      g.arc(10, 13, 5.6, 0, Math.PI);
      g.quadraticCurveTo(4.4, 10.2, 10, 2.8);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }

    case "picnic-table": {
      const table = (width: number, colour: string) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(3.6, 8.4);
        g.lineTo(16.4, 8.4);
        g.stroke();
        g.beginPath();
        g.moveTo(6.2, 8.6);
        g.lineTo(5.2, 15.4);
        g.moveTo(13.8, 8.6);
        g.lineTo(14.8, 15.4);
        g.stroke();
        g.beginPath();
        g.moveTo(4.6, 11.6);
        g.lineTo(15.4, 11.6);
        g.stroke();
      };
      table(3.6, STROKE);
      table(1.9, PEN.sand);
      break;
    }

    case "viewpoint": {
      g.fillStyle = PEN.eye;
      g.beginPath();
      g.moveTo(2.2, 10);
      g.quadraticCurveTo(10, 3.2, 17.8, 10);
      g.quadraticCurveTo(10, 16.8, 2.2, 10);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = STROKE;
      g.beginPath();
      g.arc(10, 10, 2.5, 0, Math.PI * 2);
      g.fill();
      break;
    }

    case "caravan": {
      g.fillStyle = PEN.sand;
      g.beginPath();
      g.roundRect(2.8, 6.2, 14.4, 8.4, 2);
      g.fill();
      g.stroke();
      g.fillStyle = PEN.water;
      g.beginPath();
      g.rect(5, 8.4, 4.4, 3.6);
      g.fill();
      g.stroke();
      g.strokeStyle = STROKE;
      g.beginPath();
      g.moveTo(2.8, 14.6);
      g.lineTo(0.8, 16.6);
      g.stroke();
      g.fillStyle = STROKE;
      g.beginPath();
      g.arc(13.8, 16.4, 1.9, 0, Math.PI * 2);
      g.fill();
      break;
    }

    case "toilets": {
      g.fillStyle = PEN.glyph;
      g.strokeStyle = STROKE;
      g.beginPath();
      g.arc(6, 5.4, 2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(4.2, 16.4);
      g.lineTo(4.9, 9);
      g.lineTo(7.1, 9);
      g.lineTo(7.8, 16.4);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(13.9, 5.4, 2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(11.4, 16.4);
      g.lineTo(12.4, 9);
      g.lineTo(15.4, 9);
      g.lineTo(16.4, 16.4);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }

    case "shower": {
      g.strokeStyle = STROKE;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(4.4, 3.2);
      g.lineTo(4.4, 7);
      g.lineTo(10, 7);
      g.stroke();
      g.lineWidth = 1.2;
      g.fillStyle = PEN.water;
      g.beginPath();
      g.moveTo(8.4, 7);
      g.lineTo(15.8, 7);
      g.lineTo(12.4, 11.2);
      g.closePath();
      g.fill();
      g.stroke();
      for (const [x, y] of [
        [9.6, 13.8],
        [12.4, 14.2],
        [15.2, 13.6],
      ]) {
        g.beginPath();
        g.arc(x, y, 1.1, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }

    case "info": {
      g.fillStyle = PEN.sign;
      g.beginPath();
      g.roundRect(3.2, 3, 13.6, 10.4, 2);
      g.fill();
      g.stroke();
      g.strokeStyle = PEN.glyph;
      g.lineWidth = 2.1;
      g.beginPath();
      g.moveTo(10, 5.8);
      g.lineTo(10, 6);
      g.stroke();
      g.beginPath();
      g.moveTo(10, 8.2);
      g.lineTo(10, 11.4);
      g.stroke();
      g.strokeStyle = STROKE;
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(10, 13.4);
      g.lineTo(10, 17.4);
      g.stroke();
      break;
    }

    case "trailhead": {
      g.strokeStyle = STROKE;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(9.2, 2.8);
      g.lineTo(9.2, 17.2);
      g.stroke();
      g.lineWidth = 1.2;
      g.fillStyle = PEN.roof;
      g.beginPath();
      g.moveTo(9.2, 4.2);
      g.lineTo(16.2, 4.2);
      g.lineTo(17.8, 6.6);
      g.lineTo(16.2, 9);
      g.lineTo(9.2, 9);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = PEN.sand;
      g.beginPath();
      g.moveTo(9.2, 10.8);
      g.lineTo(3.4, 10.8);
      g.lineTo(1.8, 13.2);
      g.lineTo(3.4, 15.6);
      g.lineTo(9.2, 15.6);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }

    case "parking": {
      g.fillStyle = PEN.sign;
      g.beginPath();
      g.roundRect(2.8, 2.8, 14.4, 14.4, 3);
      g.fill();
      g.stroke();
      g.strokeStyle = PEN.glyph;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(8.2, 15);
      g.lineTo(8.2, 5.6);
      g.stroke();
      g.beginPath();
      g.arc(10.4, 8.3, 2.7, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      break;
    }
  }
}

/** One icon as a square canvas, at `px` device pixels. */
function render(name: KitIcon, px: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.scale(px / GRID, px / GRID);
  paint(g, name);
  return canvas;
}

/** A data URL for DOM use — the layers-panel key. */
export function iconDataUrl(name: KitIcon, px = 40): string {
  return render(name, px).toDataURL("image/png");
}

/** Registers every pictogram on the map. Safe to call again after a style rebuild. */
export function addCampIcons(map: MlMap) {
  for (const name of KIT_ICONS) {
    if (map.hasImage(name)) continue;
    const px = 40;
    const canvas = render(name, px);
    const g = canvas.getContext("2d");
    if (!g) continue;
    const { data } = g.getImageData(0, 0, px, px);
    map.addImage(
      name,
      { width: px, height: px, data: new Uint8Array(data) },
      { pixelRatio: 2 },
    );
  }
}
