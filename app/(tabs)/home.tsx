import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SkyBackground from "../../components/SkyBackground";
import Dropdown from "../../components/cityEnvironment/Dropdown";
import {
  AdvisoryCard,
  AiCard,
  PlaceCard,
  SatelliteCard,
  SourcesCard,
  WeatherCard,
} from "../../components/cityEnvironment/Cards";
import { ASEAN_CITIES } from "../../components/aseanCities";
import {
  getAdvice,
  getEnvironment,
  requestEnvironment,
  type AiExplanation,
  type CityEnvironment,
} from "../../lib/cityEnvironment/api";
import { emergency } from "../../components/emergencyNumbers";
import { CityHeat, HeatBand, fetchCityHeat } from "../../lib/heat";
import { useCity } from "../../components/CityContext";
import HeatmapSection from "../../components/heatGrid/HeatmapSection";

const BAND_COLOURS: Record<HeatBand, string> = {
  Low: "#2E9E7E",
  Moderate: "#F0A52E",
  High: "#E0533D",
};

type CardProps = { band: HeatBand; country: string };

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function WarningSigns({ number }: { number: string }) {
  return (
    <View style={styles.warningBox}>
      <View style={styles.iconTitleRow}>
        <Ionicons name="warning-outline" size={17} color="#FFFFFF" />
        <Text style={[styles.cardSub, styles.iconTitleText]}>Warning signs</Text>
      </View>
      <Text style={styles.text}>
        Get help if someone has dizziness, headache, nausea, cramps, heavy sweating or weakness.
        Move them somewhere cool, give water and cool their skin.
      </Text>
      <Text style={styles.text}>
        If someone is confused, faints, or has hot skin and stops sweating, call{" "}
        <Text style={styles.bold}>{number}</Text> right away.
      </Text>
    </View>
  );
}

function WhatToDoCard({ band, country }: CardProps) {
  const found = emergency.find((e) => e.country === country);
  const number = found ? String(found.no) : "your local emergency number";

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeading}>WHAT TO DO NOW</Text>

      {band === "Low" && (
        <View style={styles.lowcard}>
          <View style={styles.iconTitleRow}>
            <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
            <Text style={[styles.cardTitle, styles.iconTitleText]}>Low heat stress</Text>
          </View>
          <Text style={styles.text}>Normal outdoor activities are OK.</Text>
          <Bullet>Drink water regularly, even if you’re not thirsty.</Bullet>
          <Bullet>Wear light, loose clothing.</Bullet>
          <Bullet>Rest in the shade if you feel tired.</Bullet>

          <Text style={styles.cardSub}>For older adults</Text>
          <Text style={styles.text}>Keep a water bottle with you when you go out.</Text>
        </View>
      )}

      {band === "Moderate" && (
        <View style={styles.medcard}>
          <View style={styles.iconTitleRow}>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
            <Text style={[styles.cardTitle, styles.iconTitleText]}>Moderate heat stress</Text>
          </View>
          <Text style={styles.text}>
            Heat can start to affect your body. Cut down on long or hard outdoor activity.
          </Text>
          <Bullet>Take breaks in the shade or indoors.</Bullet>
          <Bullet>Drink water at least every hour.</Bullet>
          <Bullet>Do outdoor chores and exercise in the early morning or evening.</Bullet>

          <Text style={styles.cardSub}>For older adults</Text>
          <Text style={styles.text}>
            Avoid going outdoors in the hottest part of the day. Stay somewhere cool if you can.
          </Text>

          <Text style={styles.cardSub}>For family</Text>
          <Text style={styles.text}>
            Call or message an elderly relative to check they’re drinking water and staying cool.
          </Text>

          <WarningSigns number={number} />
        </View>
      )}

      {band === "High" && (
        <View style={styles.highcard}>
          <View style={styles.iconTitleRow}>
            <Ionicons name="flame" size={20} color="#FFFFFF" />
            <Text style={[styles.cardTitle, styles.iconTitleText]}>High heat stress</Text>
          </View>
          <Text style={styles.text}>
            Heat illness is likely. Stay out of the heat as much as possible.
          </Text>
          <Bullet>Stay indoors or in the shade during the hottest hours.</Bullet>
          <Bullet>Postpone exercise and heavy outdoor activities.</Bullet>
          <Bullet>Drink water regularly, and use a fan or air-conditioning to cool down.</Bullet>

          <Text style={styles.cardSub}>For older adults</Text>
          <Text style={styles.text}>
            Stay indoors in a cool place. Don’t wait until you feel thirsty to drink.
          </Text>

          <Text style={styles.cardSub}>For family</Text>
          <Text style={styles.text}>
            Check on elderly relatives today, ideally in person or by video call.
          </Text>

          <WarningSigns number={number} />
        </View>
      )}
    </View>
  );
}

const ASEAN_COUNTRIES = [...new Set(ASEAN_CITIES.map((c) => c.country))].sort();
const POLL_MS = 5000;
const MAX_POLL_MS = 10 * 60_000;

/** Search City: weather + advisory first, then poll until satellite processing finishes. */
function useCityEnvironment() {
  const [env, setEnv] = useState<CityEnvironment | null>(null);
  const [advice, setAdvice] = useState<AiExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<AbortController | null>(null);

  useEffect(() => () => runRef.current?.abort(), []);

  function reset() {
    runRef.current?.abort();
    setEnv(null);
    setAdvice(null);
    setError(null);
    setLoading(false);
    setAdviceLoading(false);
  }

  async function run(placeId: string) {
    reset();
    const run = new AbortController();
    runRef.current = run;
    setLoading(true);
    try {
      let current = await requestEnvironment(placeId, 15, run.signal);
      if (run.signal.aborted) return;
      setEnv(current);
      setLoading(false);
      const started = Date.now();
      while (current.satellite.status === "processing" && Date.now() - started < MAX_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (run.signal.aborted) return;
        current = await getEnvironment(current.requestId, run.signal);
        if (run.signal.aborted) return;
        setEnv(current);
      }
      setAdviceLoading(true);
      const a = await getAdvice(current.requestId, run.signal);
      if (!run.signal.aborted) setAdvice(a);
    } catch (e) {
      if (!run.signal.aborted) {
        setError(e instanceof Error ? e.message : "Couldn't load city data. Is the UrbanHeat Watch server running?");
      }
    } finally {
      if (!run.signal.aborted) {
        setLoading(false);
        setAdviceLoading(false);
      }
    }
  }

  return { env, advice, loading, adviceLoading, error, run, reset };
}

const HEAT_REFRESH_MS = 5 * 60_000;

function describeReading(h: CityHeat): string {
  const at = new Date(h.observedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!h.live) return `Model estimate (no station nearby), ${at}`;
  const where = h.stationName ? `${h.stationName}${h.distanceKm != null ? `, ${Math.round(h.distanceKm)} km away` : ""}` : h.source;
  return `Live reading from ${where}, ${at}`;
}

export default function HomeScreen() {
  const { city, setCity } = useCity();
  const [heat, setHeat] = useState<CityHeat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cityEnv = useCityEnvironment();
  const countryCities = ASEAN_CITIES.filter((c) => c.country === city.country);

  useEffect(() => {
    let cancelled = false;
    setHeat(null);
    setLoading(true);
    setError(null);

    // Background refreshes keep the last good reading on screen if a request fails.
    const load = (initial: boolean) =>
      fetchCityHeat(city.lat, city.lon)
        .then((h) => {
          if (!cancelled) {
            setHeat(h);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled && initial) setError("Couldn't load live temperature. Check your connection.");
        })
        .finally(() => {
          if (!cancelled && initial) setLoading(false);
        });

    load(true);
    const timer = setInterval(() => load(false), HEAT_REFRESH_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load(false);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [city]);

  return (
    <SkyBackground>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
        >
          <View style={styles.pickerRow}>
            <Dropdown
              label="Country"
              placeholder="Select country"
              options={ASEAN_COUNTRIES.map((c) => ({ value: c, label: c }))}
              value={city.country}
              onChange={(country) => {
                const first = ASEAN_CITIES.find((c) => c.country === country);
                if (first && country !== city.country) {
                  setCity(first);
                  cityEnv.reset();
                }
              }}
            />
            <Dropdown
              label="City"
              placeholder="Select city"
              options={countryCities.map((c) => ({ value: c.id, label: c.name }))}
              value={city.id}
              onChange={(id) => {
                const next = ASEAN_CITIES.find((c) => c.id === id);
                if (next && next.id !== city.id) {
                  setCity(next);
                  cityEnv.reset();
                }
              }}
            />
          </View>
          <Pressable
            style={[styles.searchButton, cityEnv.loading && { opacity: 0.6 }]}
            onPress={() => cityEnv.run(city.placeId)}
            disabled={cityEnv.loading}
            accessibilityRole="button"
          >
            {cityEnv.loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search City</Text>
            )}
          </Pressable>

          <View style={styles.box}>
            <Text style={styles.place}>{city.name}</Text>
            <Text style={styles.country}>{city.country}</Text>

            {loading && <ActivityIndicator color="#FFFFFF" style={{ marginTop: 40 }} />}

            {!loading && error && <Text style={styles.error}>{error}</Text>}

            {!loading && !error && heat && (
              <>
                <Text style={styles.temp}>{Math.round(heat.temperature)}°</Text>
                <Text style={styles.detail}>Humidity {heat.humidity}%</Text>

                <View style={[styles.bandPill, { backgroundColor: BAND_COLOURS[heat.band] }]}>
                  <Text style={styles.bandText}>
                    WBGT {heat.wbgt}° · {heat.band} heat stress
                  </Text>
                </View>
                <Text style={styles.note}>{describeReading(heat)}</Text>
                <Text style={styles.note}>WBGT estimated from temperature and humidity</Text>
              </>
            )}
          </View>

          {/* Heat Forecast Map on Home Page */}
          <View style={styles.heatmapCardWrap}>
            <HeatmapSection showHeader={true} />
          </View>

          {/* AI Research Quick Access Card */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/ai",
                params: {
                  query: `Analyze heat stress and microclimate in ${city.name}, ${city.country}`,
                },
              })
            }
            style={styles.aiCard}
          >
            <View style={styles.aiHeaderRow}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.aiBadgeText}>URBANHEAT WATCH AI</Text>
              </View>
              <View style={styles.iconTitleRow}>
                <Text style={styles.aiArrow}>Ask Assistant</Text>
                <Ionicons name="arrow-forward" size={15} color="#F07B2E" />
              </View>
            </View>
            <Text style={styles.aiTitle}>Research Heat for {city.name}</Text>
            <Text style={styles.aiDesc}>
              Ask UrbanHeat Watch AI about WBGT thresholds, urban island effects, and hydration advice.
            </Text>
          </Pressable>

          {!loading && !error && heat && (
            <WhatToDoCard band={heat.band} country={city.country} />
          )}

          {cityEnv.error && <Text style={styles.error}>{cityEnv.error}</Text>}
          {cityEnv.env && (
            <View style={styles.envResults}>
              <PlaceCard env={cityEnv.env} />
              <WeatherCard env={cityEnv.env} />
              <AdvisoryCard env={cityEnv.env} />
              <SatelliteCard env={cityEnv.env} />
              <AiCard advice={cityEnv.advice} loading={cityEnv.adviceLoading} />
              <SourcesCard env={cityEnv.env} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingTop: 16, paddingBottom: 120 },
  heatmapCardWrap: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "rgba(251, 241, 228, 0.96)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pickerRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginHorizontal: 20 },
  searchButton: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 24,
    backgroundColor: "#F07B2E",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  searchButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  envResults: { alignSelf: "stretch", marginHorizontal: 20, marginTop: 4 },
  card: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
  },
  aiCard: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: "rgba(251, 241, 228, 0.92)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F07B2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  aiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F07B2E",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  aiArrow: {
    color: "#F07B2E",
    fontSize: 14,
    fontWeight: "700",
  },
  aiTitle: {
    color: "#2B2320",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 4,
  },
  aiDesc: {
    color: "#5C4F46",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  text: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, marginTop: 6 },
  lowcard: { alignSelf: "stretch" },
  medcard: { alignSelf: "stretch" },
  highcard: { alignSelf: "stretch" },
  cardHeading: { color: "#FFFFFF", fontSize: 12, letterSpacing: 1, opacity: 0.8 },
  cardTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "600", marginTop: 6 },
  cardSub: { color: "#FFFFFF", fontSize: 15, fontWeight: "600", marginTop: 14 },
  iconTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  iconTitleText: { marginTop: 0 },
  bulletRow: { flexDirection: "row", marginTop: 6 },
  bulletDot: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, width: 16 },
  bulletText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, flex: 1 },
  warningBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(224, 83, 61, 0.25)",
  },
  bold: { fontWeight: "700" },
  box: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
  },
  place: { color: "#FFFFFF", fontSize: 30, fontWeight: "600", textAlign: "center" },
  country: { color: "#FFFFFF", fontSize: 16, opacity: 0.85, marginTop: 2 },
  temp: { color: "#FFFFFF", fontSize: 96, fontWeight: "200", marginTop: 8 },
  detail: { color: "#FFFFFF", fontSize: 16, opacity: 0.9 },
  bandPill: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  bandText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  note: { color: "#FFFFFF", fontSize: 12, opacity: 0.75, marginTop: 8 },
  error: { color: "#FFFFFF", marginTop: 40, textAlign: "center", paddingHorizontal: 32 },
});