import Slider from "@react-native-community/slider";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ASEAN_CITIES } from "../aseanCities";
import Dropdown from "../cityEnvironment/Dropdown";
import { useCity } from "../CityContext";
import HeatGridMap from "./HeatGridMap";
import HourlyBarChart from "./HourlyBarChart";
import { MAX_ZOOM, MIN_ZOOM, colorFor, fitZoom } from "./shared";
import { getHeatGrid, type HeatGrid, type HeatVariable } from "../../lib/cityEnvironment/api";

const COUNTRIES = [...new Set(ASEAN_CITIES.map((c) => ({ name: c.country, code: c.countryCode })).map((c) => JSON.stringify(c)))]
  .map((s) => JSON.parse(s) as { name: string; code: string })
  .sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_TZ: Record<string, string> = {
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  ID: "Asia/Jakarta",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  PH: "Asia/Manila",
  MM: "Asia/Yangon",
  KH: "Asia/Phnom_Penh",
  LA: "Asia/Vientiane",
  BN: "Asia/Brunei",
  TL: "Asia/Dili",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  IN: "Asia/Kolkata",
};

function timeLabel(iso: string | undefined, tz: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16) + " UTC";
  }
}

export type HeatmapSectionProps = {
  showHeader?: boolean;
  initialCountryCode?: string;
};

export default function HeatmapSection({ showHeader = true, initialCountryCode }: HeatmapSectionProps) {
  const { city } = useCity();
  const [countryCode, setCountryCode] = useState(initialCountryCode ?? city.countryCode);
  const [variable, setVariable] = useState<HeatVariable>("temperature_2m");
  const [grid, setGrid] = useState<HeatGrid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hour, setHour] = useState(0);
  const [zoom, setZoom] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tz = COUNTRY_TZ[countryCode] ?? "UTC";

  // Sync when city from context changes (e.g. from Home city dropdown)
  useEffect(() => {
    if (city?.countryCode && city.countryCode !== countryCode) {
      setCountryCode(city.countryCode);
    }
  }, [city?.countryCode]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setSelected(null);
    getHeatGrid(countryCode, variable, ctrl.signal)
      .then((g) => {
        if (ctrl.signal.aborted) return;
        setGrid((prev) => {
          if (!prev || prev.countryCode !== g.countryCode) setZoom(fitZoom(g));
          return g;
        });
        setHour((h) => Math.min(h, Math.max(0, g.times.length - 1)));
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          setError("Couldn't load the forecast grid. Check your connection.");
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [countryCode, variable]);

  // Play button: advance one hour every 800 ms, looping.
  useEffect(() => {
    if (!playing || !grid) return;
    timer.current = setInterval(() => setHour((h) => (h + 1) % grid.times.length), 800);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, grid]);

  const maxHour = Math.max(0, (grid?.times.length ?? 1) - 1);
  const cell = grid && selected !== null ? grid.cells[selected] : null;
  const values = grid?.cells.map((c) => c.values[hour]).filter((v): v is number => typeof v === "number") ?? [];

  // The chart follows the tapped map cell, or else the grid point nearest the chosen city
  // (or the middle of the country when the city is in another country).
  const chartCellIndex = (() => {
    if (!grid || grid.cells.length === 0) return null;
    if (selected !== null) return selected;
    const sameCountry = city.countryCode === grid.countryCode;
    const lat = sameCountry ? city.lat : grid.cells.reduce((s, c) => s + c.lat, 0) / grid.cells.length;
    const lon = sameCountry ? city.lon : grid.cells.reduce((s, c) => s + c.lon, 0) / grid.cells.length;
    let best = 0;
    let bestD = Infinity;
    grid.cells.forEach((c, i) => {
      const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  })();
  const chartTitle =
    selected !== null
      ? "Hourly forecast at the selected point"
      : grid && city.countryCode === grid.countryCode
        ? `Hourly forecast near ${city.name}`
        : "Hourly forecast for the centre of the map";

  return (
    <View style={styles.sectionWrap}>
      {showHeader && (
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Heat Forecast Map</Text>
          <Text style={styles.subtitle}>Hourly modelled temperature for the next 24 hours</Text>
        </View>
      )}

      <View style={styles.controls}>
        <Dropdown
          tone="light"
          label="Country"
          placeholder="Select country"
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          value={countryCode}
          onChange={setCountryCode}
        />
        <View style={styles.toggle}>
          {(["temperature_2m", "apparent_temperature"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVariable(v)}
              style={[styles.toggleBtn, variable === v && styles.toggleOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: variable === v }}
            >
              <Text style={[styles.toggleText, variable === v && styles.toggleTextOn]}>
                {v === "temperature_2m" ? "Air temp" : "Feels like"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Time slider */}
      <View style={styles.card}>
        <View style={styles.timeHeader}>
          <Text style={styles.small}>{timeLabel(grid?.times[0], tz)}</Text>
          <Text style={styles.small}>{timeLabel(grid?.times[maxHour], tz)}</Text>
        </View>
        <View style={styles.timeRow}>
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            style={styles.play}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause forecast animation" : "Play forecast animation"}
          >
            <Ionicons name={playing ? "pause" : "play"} size={16} color="#FFFFFF" />
          </Pressable>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={maxHour}
            step={1}
            value={hour}
            onValueChange={(v) => {
              setPlaying(false);
              setHour(Math.round(v));
            }}
            minimumTrackTintColor="#4E8A2E"
            maximumTrackTintColor="#CFE3C2"
            thumbTintColor="#6B3FA0"
            disabled={!grid}
            accessibilityLabel="Forecast hour"
          />
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              +{hour + 1} h · {timeLabel(grid?.times[hour], tz)}
            </Text>
          </View>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {grid ? (
          <HeatGridMap
            grid={grid}
            hourIndex={hour}
            zoom={zoom}
            onZoomChange={setZoom}
            onCellPress={setSelected}
            selectedCell={selected}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? <ActivityIndicator color="#F07B2E" size="large" /> : <Text style={styles.small}>{error ?? "No data"}</Text>}
          </View>
        )}
        {loading && grid && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#F07B2E" />
          </View>
        )}
      </View>
      {error && grid && <Text style={styles.error}>{error}</Text>}

      {/* Hourly bar chart */}
      {grid && chartCellIndex !== null && (
        <View style={styles.card}>
          <HourlyBarChart
            title={`${chartTitle} (${grid.variableLabel.toLowerCase()})`}
            times={grid.times}
            values={grid.cells[chartCellIndex]!.values}
            stops={grid.legend.stops}
            tz={tz}
            currentHour={hour}
            onSelectHour={(h) => {
              setPlaying(false);
              setHour(h);
            }}
          />
        </View>
      )}

      {/* Zoom slider */}
      <View style={styles.zoomRow}>
        <Pressable onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} style={styles.zoomBtn} accessibilityLabel="Zoom out">
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
        <Slider
          style={styles.slider}
          minimumValue={MIN_ZOOM}
          maximumValue={MAX_ZOOM}
          step={0.5}
          value={zoom}
          onValueChange={setZoom}
          minimumTrackTintColor="#F07B2E"
          maximumTrackTintColor="#E2D4C3"
          thumbTintColor="#F07B2E"
          accessibilityLabel="Map zoom"
        />
        <Pressable onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} style={styles.zoomBtn} accessibilityLabel="Zoom in">
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
      </View>

      {/* Legend */}
      {grid && (
        <View style={styles.card}>
          <Text style={styles.legendTitle}>{grid.variableLabel} (°C)</Text>
          <View style={styles.legendRow}>
            {grid.legend.stops.map((s, i) => (
              <View key={s.valueC} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: colorFor(s.valueC, grid.legend.stops, 0.85) }]} />
                <Text style={styles.legendText}>
                  {i === 0 ? "≤" : i === grid.legend.stops.length - 1 ? "≥" : ""}
                  {s.valueC}
                </Text>
              </View>
            ))}
          </View>
          {values.length > 0 && (
            <Text style={styles.small}>
              At this hour: min {Math.min(...values).toFixed(1)}° · max {Math.max(...values).toFixed(1)}° across{" "}
              {grid.cells.length} grid points
            </Text>
          )}
          {cell && (
            <View style={styles.readout}>
              <Text style={styles.readoutTitle}>
                {cell.values[hour] !== null ? `${cell.values[hour]?.toFixed(1)} °C` : "No value"} ·{" "}
                {grid.variableLabel.toLowerCase()}
              </Text>
              <Text style={styles.small}>
                Cell centre {cell.lat.toFixed(3)}, {cell.lon.toFixed(3)} · {timeLabel(grid.times[hour], tz)}
              </Text>
            </View>
          )}
          {!cell && <Text style={styles.small}>Tap a cell on the map to read its value.</Text>}
        </View>
      )}

      {/* About this map */}
      {grid && (
        <View style={styles.card}>
          <Text style={styles.legendTitle}>About this map</Text>
          {grid.limitations.map((l) => (
            <Text key={l} style={styles.small}>
              • {l}
            </Text>
          ))}
          <Text style={styles.small}>• Forecast data by Open-Meteo.com (CC BY 4.0). Map © OpenStreetMap contributors / Apple / Google.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: { alignSelf: "stretch", width: "100%" },
  headerBlock: { marginBottom: 12 },
  header: { fontSize: 24, fontWeight: "800", color: "#2B2320" },
  subtitle: { fontSize: 13, color: "#706053", marginTop: 4, marginBottom: 4 },
  controls: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    padding: 4,
  },
  toggleBtn: { paddingHorizontal: 10, justifyContent: "center", borderRadius: 10 },
  toggleOn: { backgroundColor: "#F07B2E" },
  toggleText: { fontSize: 13, color: "#706053", fontWeight: "600" },
  toggleTextOn: { color: "#FFFFFF" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginTop: 12,
  },
  timeHeader: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 48 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4E8A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  slider: { flex: 1, height: 40 },
  badgeRow: { alignItems: "flex-end" },
  badge: { backgroundColor: "#4E8A2E", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  mapWrap: { marginTop: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#E8E2DA" },
  mapPlaceholder: { height: 420, alignItems: "center", justifyContent: "center" },
  loadingOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 6,
  },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D4C3",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: { fontSize: 20, color: "#2B2320", fontWeight: "700" },
  legendTitle: { fontSize: 13, fontWeight: "700", color: "#2B2320", marginBottom: 6 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  legendItem: { alignItems: "center" },
  swatch: { width: 34, height: 12, borderRadius: 2 },
  legendText: { fontSize: 11, color: "#2B2320", marginTop: 2 },
  small: { fontSize: 12, color: "#706053", marginTop: 3 },
  readout: { marginTop: 8, padding: 10, backgroundColor: "#FBF1E4", borderRadius: 8 },
  readoutTitle: { fontSize: 15, fontWeight: "700", color: "#2B2320" },
  error: { color: "#B3261E", marginTop: 8 },
});
