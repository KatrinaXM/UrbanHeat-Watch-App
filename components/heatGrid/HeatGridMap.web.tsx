import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createElement, useEffect, useRef } from "react";
import { MAX_ZOOM, MIN_ZOOM, cellCorners, colorFor, type HeatGridMapProps } from "./shared";

/** Web: Leaflet with OpenStreetMap basemap and the forecast grid as rectangles. */
export default function HeatGridMap({ grid, hourIndex, zoom, onZoomChange, onCellPress, selectedCell }: HeatGridMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const rects = useRef<L.Rectangle[]>([]);
  const prevZoom = useRef<number | null>(null);
  // Keep fitting the country to the map until the user zooms or pans themselves.
  const autoFit = useRef(true);
  const bounds = useRef<L.LatLngBoundsExpression | null>(null);
  const handlers = useRef({ onZoomChange, onCellPress });
  handlers.current = { onZoomChange, onCellPress };

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomSnap: 0.5, zoomControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.on("zoomend", () => handlers.current.onZoomChange(m.getZoom()));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // React Native Web lays out after mount; keep Leaflet's size in sync.
    const el = container.current;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (autoFit.current && bounds.current && el.clientWidth > 0) {
        m.fitBounds(bounds.current);
        handlers.current.onZoomChange(m.getZoom());
      }
    });
    ro.observe(el);
    const userMoved = () => (autoFit.current = false);
    el.addEventListener("wheel", userMoved, { passive: true });
    el.addEventListener("pointerdown", userMoved);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Build cells when the grid changes.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    rects.current = grid.cells.map((_, i) => {
      const corners = cellCorners(grid, i);
      const r = L.rectangle(
        [
          [corners[2]!.latitude, corners[0]!.longitude],
          [corners[0]!.latitude, corners[1]!.longitude],
        ],
        { weight: 0.5, color: "#ffffff", opacity: 0.4, fillOpacity: 1 },
      );
      r.on("click", () => handlers.current.onCellPress(i));
      r.addTo(g);
      return r;
    });
    const [w, s, e, n] = grid.bbox;
    bounds.current = [
      [s, w],
      [n, e],
    ];
    autoFit.current = true;
    m.invalidateSize();
    m.fitBounds(bounds.current);
    handlers.current.onZoomChange(m.getZoom());
  }, [grid]);

  // Recolour on hour / selection change (no rebuild).
  useEffect(() => {
    rects.current.forEach((r, i) => {
      r.setStyle({
        fillColor: colorFor(grid.cells[i]?.values[hourIndex] ?? null, grid.legend.stops, 1),
        fillOpacity: grid.cells[i]?.values[hourIndex] == null ? 0 : 0.65,
        color: i === selectedCell ? "#22201E" : "#ffffff",
        weight: i === selectedCell ? 2.5 : 0.5,
        opacity: i === selectedCell ? 1 : 0.4,
      });
      if (i === selectedCell) r.bringToFront();
    });
  }, [grid, hourIndex, selectedCell]);

  // Apply the zoom slider.
  useEffect(() => {
    const m = map.current;
    // Only react to changes of the slider value, not to its initial value.
    const first = prevZoom.current === null;
    prevZoom.current = zoom;
    if (first) return;
    if (m && Math.abs(m.getZoom() - zoom) >= 0.25) {
      autoFit.current = false;
      m.setZoom(zoom);
    }
  }, [zoom]);

  return createElement("div", {
    ref: container,
    style: { width: "100%", height: 420, borderRadius: 12, overflow: "hidden", zIndex: 0 },
  });
}
