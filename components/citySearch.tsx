import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ASEAN_CITIES, City } from "../components/aseanCities";

type Props = { onSelect: (city: City) => void };

export default function CitySearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results =
    q.length === 0
      ? []
      : ASEAN_CITIES.filter(
          (c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
        ).slice(0, 8);

  const pick = (city: City) => {
    onSelect(city);
    setQuery("");
    Keyboard.dismiss();
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search a city in ASEAN"
        placeholderTextColor="rgba(255,255,255,0.75)"
        autoCorrect={false}
        style={styles.input}
      />

      {results.length > 0 && (
        <View style={styles.list}>
          {results.map((c) => (
            <Pressable key={c.id} onPress={() => pick(c)} style={styles.item}>
              <Text style={styles.city}>{c.name}</Text>
              <Text style={styles.country}>{c.country}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {q.length > 0 && results.length === 0 && (
        <Text style={styles.empty}>No ASEAN city matches "{query}"</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", paddingHorizontal: 20, marginBottom: 24 },
  input: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  list: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  city: { fontSize: 16, color: "#22201E", fontWeight: "500" },
  country: { fontSize: 14, color: "#6E625A" },
  empty: { marginTop: 8, color: "#FFFFFF", opacity: 0.85 },
});