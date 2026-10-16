import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCity } from "../../components/CityContext";

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  location: string;
  status: "Safe" | "Hydration Alert" | "Needs Check";
}

const DEFAULT_MEMBERS: FamilyMember[] = [
  { id: "1", name: "Grandmother Mei", relation: "Elderly", location: "Jurong West", status: "Needs Check" },
  { id: "2", name: "Uncle David", relation: "Outdoor Worker", location: "Tuas", status: "Hydration Alert" },
  { id: "3", name: "Sister Chloe", relation: "Student", location: "Boon Lay", status: "Safe" },
];

export default function FamilyScreen() {
  const { city } = useCity();
  const [members, setMembers] = useState<FamilyMember[]>(DEFAULT_MEMBERS);

  function handleCheckIn(member: FamilyMember) {
    Alert.alert(
      `Check-in with ${member.name}`,
      `Send a heat reminder message: "Hi ${member.name}, UrbanHeat Watch heat index is high in ${city.name} today. Please drink water and rest in the shade!"`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Reminder",
          onPress: () => {
            setMembers((prev) =>
              prev.map((m) => (m.id === member.id ? { ...m, status: "Safe" } : m))
            );
            Alert.alert("Sent", `Hydration reminder delivered to ${member.name}.`);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Family Heat Safety</Text>
        <Text style={styles.subtitle}>
          Monitor vulnerable relatives during peak heat hours in {city.name}.
        </Text>

        {members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.charAt(0)}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.details}>
                {member.relation} · {member.location}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  member.status === "Safe"
                    ? styles.tagSafe
                    : member.status === "Hydration Alert"
                    ? styles.tagWarn
                    : styles.tagAlert,
                ]}
              >
                <Text style={styles.statusText}>{member.status}</Text>
              </View>
            </View>
            <Pressable
              style={styles.checkButton}
              onPress={() => handleCheckIn(member)}
            >
              <Text style={styles.checkText}>Remind</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.tipBox}>
          <View style={styles.tipTitleRow}>
            <Ionicons name="bulb-outline" size={17} color="#F07B2E" />
            <Text style={[styles.tipTitle, styles.tipTitleInRow]}>Vulnerable Group Note</Text>
          </View>
          <Text style={styles.tipText}>
            Elderly individuals and young children have lower thermal regulation capacity and dehydrate faster. Check on them between 11:00 AM and 3:30 PM.
          </Text>
        </View>
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
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F0A52E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B2320",
  },
  details: {
    fontSize: 12,
    color: "#706053",
    marginTop: 2,
  },
  statusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  tagSafe: {
    backgroundColor: "#E8F8F2",
  },
  tagWarn: {
    backgroundColor: "#FEF5E7",
  },
  tagAlert: {
    backgroundColor: "#FDEDEC",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2B2320",
  },
  checkButton: {
    backgroundColor: "#F07B2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  tipBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginTop: 12,
  },
  tipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  tipTitleInRow: {
    marginBottom: 0,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2B2320",
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: "#706053",
    lineHeight: 18,
  },
});