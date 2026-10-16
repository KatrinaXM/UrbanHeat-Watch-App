import { Tabs } from "expo-router";
import { Image, StyleSheet, View } from "react-native";

const TAB_ICONS = {
  home: require("../../assets/Icons/house.png"),
  heatmap: require("../../assets/Icons/location.png"),
  alerts: require("../../assets/Icons/bell.png"),
  family: require("../../assets/Icons/family.png"),
  profile: require("../../assets/Icons/user.png"),
};

function TabBarIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof TAB_ICONS;
  color: any;
  size?: number;
  focused: boolean;
}) {
  const iconSize = size ?? 22;
  return (
    <View style={styles.iconWrap}>
      <Image
        source={TAB_ICONS[name]}
        tintColor={color}
        style={[
          styles.tabIcon,
          {
            width: iconSize,
            height: iconSize,
            tintColor: color,
            opacity: focused ? 1 : 0.65,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

// Web only: puts the tab bar at the bottom.
// iPhone/Android still use _layout.tsx (Liquid Glass NativeTabs).
export default function WebTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F07B2E",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "rgba(0,0,0,0.08)",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{
          title: "Heat map",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="heatmap" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: 1,
          tabBarBadgeStyle: {
            backgroundColor: "#FF3B30",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "700",
          },
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="alerts" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="family" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="profile" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  tabIcon: {
    width: 22,
    height: 22,
  },
});
