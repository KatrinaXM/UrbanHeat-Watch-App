import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Polygon, type Region } from "react-native-maps";
import { cellCorners, colorFor, type HeatGridMapProps } from "./shared";

const zoomToDelta = (z: number) => 360 / 2 ** z;
const deltaToZoom = (d: number) => Math.log2(360 / d);

/** Native: real Apple/Google basemap with the forecast grid drawn as coloured cells. */
export default function HeatGridMap({ grid, hourIndex, zoom, onZoomChange, onCellPress, selectedCell }: HeatGridMapProps) {
  const ref = useRef<MapView>(null);
  const region = useRef<Region | null>(null);
  const [w, s, e, n] = grid.bbox;

  // Re-centre when the country changes.
  useEffect(() => {
    const r = {
      latitude: (s + n) / 2,
      longitude: (w + e) / 2,
      latitudeDelta: zoomToDelta(zoom),
      longitudeDelta: zoomToDelta(zoom),
    };
    region.current = r;
    ref.current?.animateToRegion(r, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.countryCode]);

  // Apply the zoom slider.
  useEffect(() => {
    const cur = region.current;
    if (!cur || Math.abs(deltaToZoom(cur.longitudeDelta) - zoom) < 0.05) return;
    const next = { ...cur, latitudeDelta: zoomToDelta(zoom), longitudeDelta: zoomToDelta(zoom) };
    region.current = next;
    ref.current?.animateToRegion(next, 250);
  }, [zoom]);

  return (
    <MapView
      ref={ref}
      style={styles.map}
      initialRegion={{
        latitude: (s + n) / 2,
        longitude: (w + e) / 2,
        latitudeDelta: zoomToDelta(zoom),
        longitudeDelta: zoomToDelta(zoom),
      }}
      onRegionChangeComplete={(r) => {
        region.current = r;
        onZoomChange(Math.round(deltaToZoom(r.longitudeDelta) * 2) / 2);
      }}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {grid.cells.map((cell, i) => (
        <Polygon
          key={i}
          coordinates={cellCorners(grid, i)}
          fillColor={colorFor(cell.values[hourIndex] ?? null, grid.legend.stops)}
          strokeColor={i === selectedCell ? "#22201E" : "rgba(255,255,255,0.35)"}
          strokeWidth={i === selectedCell ? 2 : 0.5}
          tappable
          onPress={() => onCellPress(i)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", height: 420, borderRadius: 12 },
});
