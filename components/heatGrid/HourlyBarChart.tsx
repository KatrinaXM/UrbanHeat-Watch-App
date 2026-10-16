import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HeatGrid } from "../../lib/cityEnvironment/api";
import { colorFor } from "./shared";

// One bar per forecast hour. Hover (web) or tap shows that hour's value; tapping also
// moves the map to that hour through onSelectHour.

const BAR_SLOT = 30;
const CHART_HEIGHT = 140;

function hourTick(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true, timeZone: tz })
      .format(new Date(iso))
      .replace(" ", "")
      .toLowerCase();
  } catch {
    return iso.slice(11, 13);
  }
}

function hourLong(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(11, 16) + " UTC";
  }
}

export type HourlyBarChartProps = {
  title: string;
  times: string[];
  values: (number | null)[];
  stops: HeatGrid["legend"]["stops"];
  tz: string;
  currentHour: number;
  onSelectHour: (hour: number) => void;
};

export default function HourlyBarChart({ title, times, values, stops, tz, currentHour, onSelectHour }: HourlyBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;

  // Start bars a little below the lowest value so differences between hours are visible.
  const lo = Math.floor(Math.min(...nums)) - 1;
  const hi = Math.ceil(Math.max(...nums));
  const range = Math.max(1, hi - lo);
  const active = hovered ?? currentHour;
  const activeValue = values[active];

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>{typeof activeValue === "number" ? `${activeValue.toFixed(1)} °C` : "No value"}</Text>
        <Text style={styles.readoutTime}>{times[active] ? hourLong(times[active]!, tz) : ""}</Text>
      </View>

      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>{hi}°</Text>
          <Text style={styles.axisText}>{Math.round((hi + lo) / 2)}°</Text>
          <Text style={styles.axisText}>{lo}°</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollContent}>
          {times.map((t, i) => {
            const v = values[i];
            const h = typeof v === "number" ? Math.max(4, ((v - lo) / range) * CHART_HEIGHT) : 0;
            const isActive = i === active;
            return (
              <Pressable
                key={t}
                onPress={() => onSelectHour(i)}
                onHoverIn={Platform.OS === "web" ? () => setHovered(i) : undefined}
                onHoverOut={Platform.OS === "web" ? () => setHovered((cur) => (cur === i ? null : cur)) : undefined}
                style={styles.slot}
                accessibilityRole="button"
                accessibilityLabel={`${hourLong(t, tz)}: ${typeof v === "number" ? `${v.toFixed(1)} degrees` : "no value"}`}
              >
                <View style={styles.plot}>
                  <View
                    style={[
                      styles.bar,
                      { height: h, backgroundColor: typeof v === "number" ? colorFor(v, stops, isActive ? 1 : 0.75) : "transparent" },
                      isActive && styles.barActive,
                    ]}
                  />
                </View>
                <Text style={[styles.tick, isActive && styles.tickActive]}>{hourTick(t, tz)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Text style={styles.hint}>{Platform.OS === "web" ? "Hover over" : "Tap"} a bar to see that hour's temperature.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "700", color: "#2B2320", marginBottom: 6 },
  readout: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  readoutValue: { fontSize: 18, fontWeight: "800", color: "#2B2320" },
  readoutTime: { fontSize: 12, color: "#706053" },
  chartRow: { flexDirection: "row" },
  yAxis: { height: CHART_HEIGHT, justifyContent: "space-between", paddingRight: 6 },
  axisText: { fontSize: 10, color: "#9C8E80" },
  scrollContent: { alignItems: "flex-end" },
  slot: { width: BAR_SLOT, alignItems: "center" },
  plot: {
    height: CHART_HEIGHT,
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E2D4C3",
    alignSelf: "stretch",
    alignItems: "center",
  },
  bar: { width: BAR_SLOT - 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barActive: { borderWidth: 1.5, borderColor: "#2B2320" },
  tick: { fontSize: 9, color: "#9C8E80", marginTop: 4 },
  tickActive: { color: "#2B2320", fontWeight: "700" },
  hint: { fontSize: 11, color: "#9C8E80", marginTop: 6 },
});
