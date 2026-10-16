import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HeatmapSection from "../../components/heatGrid/HeatmapSection";

export default function HeatmapScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <HeatmapSection showHeader={true} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF1E4" },
  container: { padding: 20, paddingBottom: 120 },
});
