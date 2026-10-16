import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/auth";

export default function ProfileScreen() {
  const { user, isGuest, signOut } = useAuth();
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const [loggingOut, setLoggingOut] = useState(false);

  async function performLogout() {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
      router.replace("/login");
    }
  }

  function handleLogout() {
    // Alert.alert buttons are not supported on web, so use the browser's confirm dialog there.
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) performLogout();
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: performLogout },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>Student Profile</Text>

        {/* User Card */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(fullName || user?.email || "G").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {fullName || (user?.email ? user.email.split("@")[0] : "Guest")}
            </Text>
            <Text style={styles.userEmail}>
              {user?.email || "Guest session, not signed in"}
            </Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {user ? "Signed in" : isGuest ? "Guest" : "Not signed in"}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <Pressable
          style={styles.actionButton}
          onPress={() => router.push("/ai")}
        >
          <View style={styles.actionLeft}>
            <Ionicons name="sparkles" size={18} color="#F07B2E" />
            <Text style={styles.actionText}>Open UrbanHeat Watch AI</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F07B2E" />
        </Pressable>

        {/* Logout Button */}
        <Pressable
          style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.actionLeft}>
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>{user ? "Log Out" : "Back to Sign In"}</Text>
            </View>
          )}
        </Pressable>
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
    marginBottom: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    marginBottom: 24,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F07B2E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2B2320",
  },
  userEmail: {
    fontSize: 13,
    color: "#706053",
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE2D4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B3F35",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#706053",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#F07B2E",
    marginBottom: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2B2320",
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoutButton: {
    backgroundColor: "#E0533D",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});