import type { HeatGrid } from "../../lib/cityEnvironment/api";

export type HeatGridMapProps = {
  grid: HeatGrid;
  hourIndex: number;
  /** Map zoom level (Web Mercator style, ~3–14). */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onCellPress: (cellIndex: number) => void;
  selectedCell: number | null;
};

export const MIN_ZOOM = 3;
export const MAX_ZOOM = 14;

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Fixed-scale colour for a °C value; null means no data (transparent). */
export function colorFor(value: number | null, stops: HeatGrid["legend"]["stops"], alpha = 0.55): string {
  if (value === null || !Number.isFinite(value) || stops.length === 0) return "rgba(0,0,0,0)";
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  let rgb = hexToRgb(value <= first.valueC ? first.color : last.color);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (value >= a.valueC && value <= b.valueC) {
      const t = (value - a.valueC) / (b.valueC - a.valueC);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      rgb = [0, 1, 2].map((k) => Math.round(ca[k]! + t * (cb[k]! - ca[k]!))) as [number, number, number];
      break;
    }
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Rectangle corners of a grid cell as {latitude, longitude}. */
export function cellCorners(grid: HeatGrid, index: number) {
  const c = grid.cells[index]!;
  const hLat = grid.cellLatDeg / 2;
  const hLon = grid.cellLonDeg / 2;
  return [
    { latitude: c.lat + hLat, longitude: c.lon - hLon },
    { latitude: c.lat + hLat, longitude: c.lon + hLon },
    { latitude: c.lat - hLat, longitude: c.lon + hLon },
    { latitude: c.lat - hLat, longitude: c.lon - hLon },
  ];
}

/** Zoom that fits the bbox in roughly 360 px. */
export function fitZoom(grid: HeatGrid): number {
  const [w, , e] = grid.bbox;
  const z = Math.log2((360 / 256) * (360 / (e - w)));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 2) / 2));
}
