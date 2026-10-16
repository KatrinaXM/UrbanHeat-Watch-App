import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatInZone, getPixelValue, type PixelValue } from "../../lib/cityEnvironment/api";
import type { CityEnvironment } from "../../lib/cityEnvironment/api";

export type LstMapProps = {
  env: CityEnvironment;
};

/** Rings of the area geometry as [{latitude, longitude}] arrays (GeoJSON is [lon, lat]). */
export function areaRings(env: CityEnvironment): { latitude: number; longitude: number }[][] {
  const g = env.area.geometry;
  const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polygons.map((poly) => (poly[0] ?? []).map(([lon, lat]) => ({ latitude: lat!, longitude: lon! })));
}

const QUALITY_TEXT: Record<string, string> = {
  valid: "Valid observation",
  cloud: "Cloud — no surface temperature retrieved",
  water: "Water — excluded from land statistics",
  invalid_retrieval: "Invalid retrieval",
  no_observation: "No satellite observation",
  excluded_mixed_day_night: "Excluded (different day/night pass)",
  outside_area: "Outside the city-centre area",
};

/** Tap-to-inspect: queries the stored numeric pixel value, never the display colour. */
export function usePixelInspector(env: CityEnvironment) {
  const [value, setValue] = useState<(PixelValue & { lat: number; lng: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const inspect = (lat: number, lng: number) => {
    const url = env.satellite.valueUrl;
    if (!url) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    getPixelValue(url, lat, lng, controller.signal)
      .then((v) => !controller.signal.aborted && setValue({ ...v, lat, lng }))
      .catch(() => !controller.signal.aborted && setError("Could not read the pixel value."));
  };
  return { value, error, inspect };
}

export function PixelReadout({ env, value, error }: { env: CityEnvironment; value: ReturnType<typeof usePixelInspector>["value"]; error: string | null }) {
  if (error) return <Text style={styles.readout}>{error}</Text>;
  if (!value) return <Text style={styles.hint}>Tap the map to read the satellite value at a point.</Text>;
  return (
    <View style={styles.readoutBox} accessibilityLiveRegion="polite">
      <Text style={styles.readoutTitle}>
        {value.valueC !== null ? `${value.valueC.toFixed(1)} °C land-surface temperature` : "No value at this point"}
      </Text>
      <Text style={styles.readout}>
        {QUALITY_TEXT[value.quality] ?? value.quality} · {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
      </Text>
      {value.insideLayer && (
        <Text style={styles.readout}>
          Acquired {formatInZone(value.acquisitionStart, env.place.timezone)} · {value.nativeResolutionMeters ?? 1000} m pixel
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: "#706053", marginTop: 6 },
  readoutBox: { marginTop: 8, padding: 10, backgroundColor: "#FBF1E4", borderRadius: 8 },
  readoutTitle: { fontSize: 14, fontWeight: "700", color: "#2B2320" },
  readout: { fontSize: 12, color: "#5C4F46", marginTop: 2 },
});
