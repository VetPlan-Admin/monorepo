import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ApiProvider, NavigationProvider } from "@vet-plan/app";
import { colors } from "@vet-plan/tokens";
import { MobileLink, mobileNavigate } from "../navigation";

// On a physical device, set EXPO_PUBLIC_API_URL (apps/mobile/.env.local) to your machine's LAN IP
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export default function RootLayout() {
  return (
    <ApiProvider baseUrl={API_URL}>
      <NavigationProvider link={MobileLink} navigate={mobileNavigate}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.brand.purple },
          }}
        />
      </NavigationProvider>
    </ApiProvider>
  );
}
