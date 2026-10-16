import { NativeTabs } from "expo-router/unstable-native-tabs";

const TAB_ICONS = {
  home: require("../../assets/Icons/house.png"),
  heatmap: require("../../assets/Icons/location.png"),
  alerts: require("../../assets/Icons/bell.png"),
  family: require("../../assets/Icons/family.png"),
  profile: require("../../assets/Icons/user.png"),
};

export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor="#F07B2E"              
      minimizeBehavior="onScrollDown"  
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          src={TAB_ICONS.home}
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="heatmap">
        <NativeTabs.Trigger.Icon
          src={TAB_ICONS.heatmap}
          sf={{ default: "map", selected: "map.fill" }}
          md="map"
        />
        <NativeTabs.Trigger.Label>Heat map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="alerts">
        <NativeTabs.Trigger.Icon
          src={TAB_ICONS.alerts}
          sf={{ default: "bell", selected: "bell.fill" }}
          md="notifications"
        />
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge>1</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="family">
        <NativeTabs.Trigger.Icon
          src={TAB_ICONS.family}
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md="group"
        />
        <NativeTabs.Trigger.Label>Family</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          src={TAB_ICONS.profile}
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}