import { Stack } from "expo-router";
import { AuthProvider } from "../context/auth";
import { CityProvider } from "../components/CityContext";

export default function LayoutOrder() {
  return (
    <AuthProvider>
      <CityProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ai"
            options={{
              headerShown: false,
              presentation: "card",
            }}
          />
        </Stack>
      </CityProvider>
    </AuthProvider>
  );
}
