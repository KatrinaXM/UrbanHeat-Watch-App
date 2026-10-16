import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fmtNum, formatInZone, type AiExplanation, type CityEnvironment } from "../../lib/cityEnvironment/api";
import LstMap from "./LstMap";

const STATUS_TEXT: Record<string, string> = {
  available: "Available",
  processing: "Processing",
  stale: "Out of date",
  partial_coverage: "Partial coverage",
  unavailable: "Unavailable",
  configuration_required: "Server configuration required",
  error: "Error",
};

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Pill({ status }: { status: string }) {
  const bg = status === "available" ? "#2E9E7E" : status === "processing" ? "#8A7B6E" : "#C2703D";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillText}>{STATUS_TEXT[status] ?? status}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ place

export function PlaceCard({ env }: { env: CityEnvironment }) {
  const p = env.place;
  return (
    <Card title={[p.city, p.admin1].filter(Boolean).join(", ")} subtitle={`${p.country} (${p.countryCode})`}>
      <Row label="Coordinates" value={`${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`} />
      <Row label="Local timezone" value={p.timezone ?? "Unknown"} />
      <Row label="Area" value={`${env.area.label} · ${env.area.radiusKm} km radius`} />
      <Text style={styles.note}>{env.area.note}</Text>
    </Card>
  );
}

// ------------------------------------------------------------------ weather (air temperature)

export function WeatherCard({ env }: { env: CityEnvironment }) {
  const w = env.weather;
  const tz = env.place.timezone;
  const next = w.hourly.filter((h) => Date.parse(h.time) >= Date.now() - 3600_000).slice(0, 12);
  return (
    <Card title="Current weather (air temperature)" subtitle={`Modelled by ${w.provider} — not a local station reading`}>
      <Pill status={w.status} />
      {w.message ? <Text style={styles.note}>{w.message}</Text> : null}
      <Row label="Air temperature (2 m)" value={fmtNum(w.temperatureC, " °C")} />
      <Row label="Apparent temperature" value={fmtNum(w.apparentTemperatureC, " °C")} />
      <Row label="Relative humidity" value={fmtNum(w.relativeHumidityPercent, "%", 0)} />
      <Row label="Wind speed (10 m)" value={fmtNum(w.windSpeedKmh, " km/h")} />
      <Row label="Valid at" value={formatInZone(w.validAt, tz)} />
      {env.wbgt && (
        <View style={styles.subBlock}>
          <Text style={styles.subTitle}>Singapore NEA WBGT (station observation)</Text>
          <Row label="WBGT" value={fmtNum(env.wbgt.wbgtC, " °C")} />
          <Row label="NEA category" value={env.wbgt.heatStressCategory ?? "Unavailable"} />
          <Row
            label="Station"
            value={env.wbgt.stationName ? `${env.wbgt.stationName}, ${env.wbgt.stationDistanceKm} km away` : "—"}
          />
          <Row label="Observed" value={formatInZone(env.wbgt.observedAt, tz)} />
          {env.wbgt.message ? <Text style={styles.note}>{env.wbgt.message}</Text> : null}
        </View>
      )}
      {next.length > 0 && (
        <View style={styles.subBlock}>
          <Text style={styles.subTitle}>Next hours (modelled forecast)</Text>
          {next.map((h) => (
            <Text key={h.time} style={styles.hourly}>
              {formatInZone(h.time, tz)} · air {fmtNum(h.temperatureC, "°")} · feels {fmtNum(h.apparentTemperatureC, "°")} · RH{" "}
              {fmtNum(h.relativeHumidityPercent, "%", 0)}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ satellite (surface temperature)

function Legend({ legend }: { legend: Record<string, unknown> | null }) {
  const stops = (legend?.stops as { valueC: number; color: string }[] | undefined) ?? [];
  if (!stops.length) return null;
  return (
    <View style={styles.legend} accessibilityLabel="Legend: land-surface temperature in degrees Celsius, fixed scale">
      <Text style={styles.subTitle}>Land-surface temperature (°C, fixed scale)</Text>
      <View style={styles.legendRow}>
        {stops.map((s, i) => (
          <View key={s.valueC} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {i === 0 ? "≤" : i === stops.length - 1 ? "≥" : ""}
              {s.valueC}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.noData]} />
          <Text style={styles.legendText}>No data</Text>
        </View>
      </View>
    </View>
  );
}

export function SatelliteCard({ env }: { env: CityEnvironment }) {
  const s = env.satellite;
  const tz = env.place.timezone;
  const stats = s.summary ?? s.partialSummary;
  return (
    <Card title="Satellite land-surface temperature" subtitle="Copernicus Sentinel-3 SLSTR · ground/roof skin temperature, not air temperature">
      <Pill status={s.status} />
      {s.status === "processing" && (
        <View style={styles.processing}>
          <ActivityIndicator color="#F07B2E" />
          <Text style={styles.note}>Finding and processing the latest usable satellite pass…</Text>
        </View>
      )}
      {s.message ? <Text style={styles.note}>{s.message}</Text> : null}
      {s.layerId && (
        <>
          <Row label="Acquired" value={`${formatInZone(s.acquisitionStart, tz)}`} />
          <Row label="Pass" value={`${s.dayNight ?? "unknown"} · ${s.platform ?? "—"} · ${s.timeliness ?? "—"}`} />
          <Row label="Native resolution" value={`${s.nativeResolutionMeters ?? 1000} m`} />
          <Row label="Valid land coverage" value={fmtNum(s.validLandAreaPercent, "%", 0)} />
          <Row label="Valid pixels" value={s.validPixelCount !== null ? String(s.validPixelCount) : "—"} />
          {s.freshness === "older_than_72h" && <Text style={styles.warn}>This observation is more than 72 hours old.</Text>}
          {s.status === "partial_coverage" && (
            <Text style={styles.warn}>
              Coverage notice: only {fmtNum(s.validLandAreaPercent, "%", 0)} of the land area has a valid observation, so no
              area-wide summary is given. Values below describe observed pixels only.
            </Text>
          )}
          <LstMap env={env} />
          <Legend legend={s.legend} />
          {stats && (
            <View style={styles.subBlock} accessibilityLabel="Satellite statistics">
              <Text style={styles.subTitle}>{s.summary ? "Area statistics (valid pixels)" : "Observed pixels only"}</Text>
              <Row label="Minimum" value={fmtNum(stats.minC, " °C")} />
              <Row label="Median" value={fmtNum(stats.medianC, " °C")} />
              <Row label="Mean" value={fmtNum(stats.meanC, " °C")} />
              <Row label="90th percentile" value={fmtNum(stats.p90C, " °C")} />
              <Row label="Maximum" value={fmtNum(stats.maxC, " °C")} />
            </View>
          )}
          <Text style={styles.note}>Contains modified Copernicus Sentinel data, processed by UrbanHeat Watch.</Text>
        </>
      )}
      {s.limitations.map((l) => (
        <Text key={l} style={styles.note}>
          • {l}
        </Text>
      ))}
    </Card>
  );
}

// ------------------------------------------------------------------ warnings and advisory

export function AdvisoryCard({ env }: { env: CityEnvironment }) {
  const a = env.advisory;
  const ow = env.officialWarning;
  const bandColour =
    a.classification === "high" ? "#E0533D" : a.classification === "moderate" ? "#F0A52E" : a.classification === "low" ? "#2E9E7E" : "#8A7B6E";
  return (
    <>
      <Card title="Official heat warning">
        {ow.warning ? (
          <>
            <Text style={styles.body}>
              {ow.warning.severity} — {ow.warning.issuer}
            </Text>
            <Text style={styles.body}>{ow.warning.text}</Text>
            <Row label="Issued" value={formatInZone(ow.warning.issuedAt, env.place.timezone)} />
          </>
        ) : (
          <Text style={styles.body}>{ow.message}</Text>
        )}
      </Card>
      <Card title="UrbanHeat Watch advisory" subtitle={a.label}>
        <View style={[styles.band, { backgroundColor: bandColour }]}>
          <Text style={styles.bandText}>{a.headline}</Text>
        </View>
        <Text style={styles.note}>{a.thresholdBasis}</Text>
        {a.basis.map((b) => (
          <Row
            key={b.metric}
            label={b.metric}
            value={`${b.value ?? "—"}${b.units ? ` ${b.units}` : ""} · ${formatInZone(b.observedOrValidAt, env.place.timezone)}`}
          />
        ))}
        <Row label="Rule" value={`${a.ruleId} v${a.ruleVersion}`} />
        <Row label="Valid" value={`${formatInZone(a.validFrom, env.place.timezone)} → ${formatInZone(a.validUntil, env.place.timezone)}`} />
        <Row label="Data freshness" value={a.dataFreshness} />
        <Text style={styles.subTitle}>Precautions</Text>
        {a.precautions.map((p) => (
          <Text key={p} style={styles.body}>
            • {p}
          </Text>
        ))}
      </Card>
    </>
  );
}

export function AiCard({ advice, loading }: { advice: AiExplanation | null; loading: boolean }) {
  return (
    <Card
      title="Explanation"
      subtitle={
        advice?.source === "ai"
          ? `AI-generated from the validated data above (${advice.model}). It cannot change the advisory.`
          : "Standard explanation (AI unavailable)"
      }
    >
      {loading && <ActivityIndicator color="#F07B2E" />}
      {advice && (
        <>
          <Text style={styles.subTitle}>{advice.headline}</Text>
          <Text style={styles.body}>{advice.explanation}</Text>
          {advice.precautions.map((p) => (
            <Text key={p} style={styles.body}>
              • {p}
            </Text>
          ))}
          {advice.limitations.length > 0 && <Text style={styles.subTitle}>Limitations</Text>}
          {advice.limitations.map((l) => (
            <Text key={l} style={styles.note}>
              • {l}
            </Text>
          ))}
        </>
      )}
    </Card>
  );
}

export function SourcesCard({ env }: { env: CityEnvironment }) {
  return (
    <Card title="Sources and limitations">
      {env.sources.map((s) => (
        <Text key={s.id} style={styles.note}>
          • {s.attribution}
        </Text>
      ))}
      {env.limitations.map((l) => (
        <Text key={l} style={styles.note}>
          • {l}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginTop: 14,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#2B2320" },
  cardSub: { fontSize: 12, color: "#706053", marginTop: 2, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  rowLabel: { fontSize: 14, color: "#706053", flexShrink: 1 },
  rowValue: { fontSize: 14, color: "#2B2320", fontWeight: "600", flexShrink: 1, textAlign: "right" },
  note: { fontSize: 12, color: "#706053", marginTop: 6, lineHeight: 17 },
  warn: { fontSize: 13, color: "#9A4A1E", marginTop: 8, fontWeight: "600" },
  body: { fontSize: 14, color: "#2B2320", marginTop: 6, lineHeight: 20 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  pillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  subBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EDE2D4" },
  subTitle: { fontSize: 14, fontWeight: "700", color: "#2B2320", marginTop: 10 },
  hourly: { fontSize: 12, color: "#2B2320", marginTop: 3 },
  processing: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  legend: { marginTop: 10 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  legendItem: { alignItems: "center" },
  swatch: { width: 28, height: 12, borderRadius: 2 },
  noData: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#8A7B6E", borderStyle: "dashed" },
  legendText: { fontSize: 11, color: "#2B2320", marginTop: 2 },
  band: { borderRadius: 10, padding: 10, marginTop: 4 },
  bandText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
