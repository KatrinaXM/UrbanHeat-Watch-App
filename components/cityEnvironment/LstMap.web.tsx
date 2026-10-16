import { createElement, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { absoluteUrl } from "../../lib/cityEnvironment/api";
import { areaRings, PixelReadout, usePixelInspector, type LstMapProps } from "./mapShared";

// react-native-maps does not support web. This is a fixed-view Web Mercator tile
// mosaic: OpenStreetMap basemap + the same server-rendered LST tiles used on native.
const TILE = 256;
const HEIGHT = 320;

function project(lat: number, lon: number, z: number) {
  const n = TILE * 2 ** z;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

function unproject(x: number, y: number, z: number) {
  const n = TILE * 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
}

export default function LstMap({ env }: LstMapProps) {
  const [width, setWidth] = useState(0);
  const { value, error, inspect } = usePixelInspector(env);
  const { latitude: lat, longitude: lon } = env.place;

  const metresAcross = env.area.radiusKm * 2600;
  const z = width
    ? Math.max(3, Math.min(16, Math.floor(Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180) * width) / metresAcross))))
    : 10;
  const c = project(lat, lon, z);
  const left = c.x - width / 2;
  const top = c.y - HEIGHT / 2;
  const count = 2 ** z;

  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];
  if (width) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + HEIGHT) / TILE); ty++) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        tiles.push({ key: `${tx}/${ty}`, x: wrapped, y: ty, left: tx * TILE - left, top: ty * TILE - top });
      }
    }
  }
  const heat = env.satellite.tileUrlTemplate ? absoluteUrl(env.satellite.tileUrlTemplate) : null;

  const outline = areaRings(env).map((ring) =>
    ring
      .map((p) => {
        const unwrappedLon = ((((p.longitude - lon + 540) % 360) + 360) % 360) - 180 + lon;
        const q = project(p.latitude, unwrappedLon, z);
        return `${(q.x - left).toFixed(1)},${(q.y - top).toFixed(1)}`;
      })
      .join(" "),
  );

  return (
    <View>
      <Pressable
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        onPress={(e) => {
          const p = unproject(left + e.nativeEvent.locationX, top + e.nativeEvent.locationY, z);
          inspect(p.lat, p.lon);
        }}
        style={styles.map}
        accessibilityLabel="Satellite land-surface temperature map. Tap to read a value."
      >
        {tiles.map((t) => (
          <Image
            key={`b${t.key}`}
            source={{ uri: `https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png` }}
            style={[styles.tile, { left: t.left, top: t.top }]}
          />
        ))}
        {heat &&
          tiles.map((t) => (
            <Image
              key={`h${t.key}`}
              source={{ uri: heat.replace("{z}", String(z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)) }}
              style={[styles.tile, { left: t.left, top: t.top }]}
            />
          ))}
        {width > 0 &&
          createElement(
            "svg",
            { width, height: HEIGHT, style: { position: "absolute", left: 0, top: 0, pointerEvents: "none" } },
            outline.map((pts, i) =>
              createElement("polygon", { key: i, points: pts, fill: "none", stroke: "#2B2320", strokeWidth: 2 }),
            ),
          )}
        <Text style={styles.osm}>© OpenStreetMap contributors</Text>
      </Pressable>
      <PixelReadout env={env} value={value} error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", height: HEIGHT, overflow: "hidden", borderRadius: 10, backgroundColor: "#E8E2DA" },
  tile: { position: "absolute", width: TILE, height: TILE },
  osm: {
    position: "absolute",
    right: 0,
    bottom: 0,
    fontSize: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 4,
    color: "#333",
  },
});
