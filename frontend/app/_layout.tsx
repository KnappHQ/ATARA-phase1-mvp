import "node-libs-react-native/globals.js";
import "react-native-get-random-values";
import * as Sentry from "@sentry/react-native";

import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { usePrivy } from "@privy-io/expo";

import { PrivyProvider } from "../providers/PrivyProvider";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAlertStore } from "@/stores/useAlertStore";
import { AppAlert } from "@/components/alert/AppAlert";
import { analyticsScreen } from "@/services/analytics.service";
import { registerUnauthorizedHandler } from "@/services/api";

import "./global.css";

// Initialize Sentry as early as possible to capture startup errors.
Sentry.init({
  dsn:
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    "https://examplePublicKey@o0.ingest.sentry.io/0",
  sendDefaultPii: false,
});

SplashScreen.preventAutoHideAsync();

// Routes that are part of the onboarding flow
const AUTH_ROUTES = ["onboarding", "oauth-callback"];
// Routes that require authentication
const PROTECTED_ROUTES = [
  "(tabs)",
  "send",
  "transaction-success",
  "transaction-detail",
  "contact-detail",
  "group-create",
  "group-details",
];

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <PrivyProvider>
        <RootLayoutInner />
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { alert, visible, dismiss } = useAlertStore();
  const { user, isReady: isPrivyReady, logout } = usePrivy();

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    loadSession,
  } = useAuthStore();

  const isFullyAuthenticated = isPrivyReady && !!user && isAuthenticated;
  const isReady = isPrivyReady && !isAuthLoading;

  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    registerUnauthorizedHandler(() =>
      (async () => {
        await logout();
        await useAuthStore.getState().logout();
      })(),
    );
    loadSession();
  }, [loadSession, logout]);

  // Manual screen tracking — expo-router + React Navigation v7 blocks autocapture
  useEffect(() => {
    analyticsScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isReady) return;

    const route = segments[0] as string;
    const isOnAuthFlow = AUTH_ROUTES.includes(route);

    if (!isFullyAuthenticated && !isOnAuthFlow) {
      router.replace("/onboarding");
    } else if (
      isFullyAuthenticated &&
      !PROTECTED_ROUTES.includes(route) &&
      !isOnAuthFlow
    ) {
      router.replace("/(tabs)");
    }

    setNavigationReady(true);
    setTimeout(() => SplashScreen.hideAsync(), 50);
  }, [isReady, isFullyAuthenticated, segments, router]);

  if (!isReady || !navigationReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#000000" },
        }}
      >
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen name="oauth-callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="send"
          options={{
            presentation: "transparentModal",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="transaction-success"
          options={{
            presentation: "card",
            animation: "fade",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="transaction-detail"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="contact-detail"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="group-create"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="group-details"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
      </Stack>
      {alert && (
        <AppAlert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          visible={visible}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}

export default Sentry.wrap(RootLayout);
