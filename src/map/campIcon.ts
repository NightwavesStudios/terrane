import type { Map as MlMap } from "maplibre-gl";

/**
 * The campsite pictogram, drawn once into a canvas at style-load time.
 *
 * The basemap has no sprite sheet, and adding one would mean a new request for a
 * whole image atlas to get a single 20 px tent. So the icon is painted here with
 * a few paths and handed to MapLibre as a 2× image — one canvas, ~40×40 device
 * pixels, no bytes on the wire, and it survives the pixel-ratio cap because the
 * image itself carries its own resolution.
 */
const SIZE = 40;

export function addCampIcon(map: MlMap) {
  if (map.hasImage("camp-tent")) return;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (!g) return;

  const s = SIZE / 20;
  g.scale(s, s);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = "#05090f";
  g.lineWidth = 1.2;

  // The tent, filled sand with a dark edge so it holds up over bright snow and
  // dark forest alike.
  g.fillStyle = "#f0d49a";
  g.beginPath();
  g.moveTo(10, 3);
  g.lineTo(18.7, 16.8);
  g.lineTo(1.3, 16.8);
  g.closePath();
  g.fill();
  g.stroke();

  // Doorway: the one shape that makes a triangle read as a tent and not as a
  // peak. Kept small and low — a door that reaches the apex turns the tent into
  // an outline of itself at 12 px.
  g.fillStyle = "#05090f";
  g.beginPath();
  g.moveTo(10, 12.2);
  g.lineTo(11.5, 16.8);
  g.lineTo(8.5, 16.8);
  g.closePath();
  g.fill();

  // Ground line.
  g.beginPath();
  g.moveTo(0.6, 16.9);
  g.lineTo(19.4, 16.9);
  g.stroke();

  const { data } = g.getImageData(0, 0, SIZE, SIZE);
  map.addImage(
    "camp-tent",
    { width: SIZE, height: SIZE, data: new Uint8Array(data) },
    { pixelRatio: 2 },
  );
}
