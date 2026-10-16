import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCity } from "../../components/CityContext";
import { CityHeat, fetchCityHeat } from "../../lib/heat";

export default function AlertsScreen() {
  const { city } = useCity();
  const [heat, setHeat] = useState<CityHeat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchCityHeat(city.lat, city.lon)
      .then((h) => {
        if (!cancelled) setHeat(h);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [city]);

  const isAlert = heat && heat.band !== "Low";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Environmental Alerts</Text>
        <Text style={styles.subtitle}>Active advisories for {city.name}, {city.country}</Text>

        {loading ? (
          <ActivityIndicator color="#F07B2E" style={{ marginTop: 40 }} />
        ) : (
          <>
            {isAlert ? (
              <View style={[styles.alertCard, heat?.band === "High" ? styles.highAlert : styles.modAlert]}>
                <View style={styles.badgeRow}>
                  <View style={styles.alertTypeRow}>
                    <Ionicons
                      name={heat?.band === "High" ? "flame" : "warning"}
                      size={15}
                      color={heat?.band === "High" ? "#E0533D" : "#D98A12"}
                    />
                    <Text style={styles.alertType}>
                      {heat?.band === "High" ? "EXTREME HEAT ADVISORY" : "MODERATE HEAT WATCH"}
                    </Text>
                  </View>
                  <Text style={styles.alertTime}>Live</Text>
                </View>
                <Text style={styles.alertTitle}>
                  Elevated Wet Bulb Globe Temp: {heat?.wbgt}°C
                </Text>
                <Text style={styles.alertDesc}>
                  Relative humidity is at {heat?.humidity}% with ambient air at {Math.round(heat?.temperature ?? 0)}°C. Students and athletes should adhere to mandatory shaded rest intervals.
                </Text>
              </View>
            ) : (
              <View style={styles.clearCard}>
                <Ionicons name="checkmark-circle" size={44} color="#2E9E7E" style={styles.clearIcon} />
                <Text style={styles.clearTitle}>Normal Heat Index</Text>
                <Text style={styles.clearDesc}>
                  Current conditions in {city.name} are within the safe Green Band (WBGT {heat?.wbgt ?? '28'}°C). Regular outdoor student activities are approved.
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>School Advisory Protocol</Text>
              <Text style={styles.infoText}>
                • <Text style={styles.bold}>Orange Band (31.0°C – 32.9°C):</Text> Minimum 15 minutes shaded recovery per 45 minutes activity.
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.bold}>Red Band (≥ 33.0°C):</Text> Postpone or suspend all strenuous outdoor student training.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FBF1E4",
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2B2320",
  },
  subtitle: {
    fontSize: 14,
    color: "#706053",
    marginTop: 4,
    marginBottom: 20,
  },
  alertCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  highAlert: {
    backgroundColor: "#FDEDEC",
    borderColor: "#E0533D",
  },
  modAlert: {
    backgroundColor: "#FEF5E7",
    borderColor: "#F0A52E",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertType: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#2B2320",
  },
  alertTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    backgroundColor: "#E0533D",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2B2320",
    marginBottom: 6,
  },
  alertDesc: {
    fontSize: 14,
    color: "#4B3F35",
    lineHeight: 20,
  },
  clearCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginBottom: 16,
  },
  clearIcon: {
    marginBottom: 8,
  },
  alertTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clearTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E9E7E",
    marginBottom: 4,
  },
  clearDesc: {
    fontSize: 13,
    color: "#706053",
    textAlign: "center",
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B2320",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: "#4B3F35",
    lineHeight: 20,
    marginBottom: 6,
  },
  bold: {
    fontWeight: "700",
  },
});