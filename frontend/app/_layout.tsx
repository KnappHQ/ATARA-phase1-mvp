import "@walletconnect/react-native-compat";
import "node-libs-react-native/globals.js";
import "react-native-get-random-values";
import * as Sentry from "@sentry/react-native";

import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { PrivyProvider } from "../providers/PrivyProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { useAlertStore } from "@/stores/useAlertStore";
import { AppAlert } from "@/components/alert/AppAlert";
import { VaultOpeningAnimation } from "@/components/onboarding/VaultOpeningAnimation";
import { analyticsScreen } from "@/services/analytics.service";
import { ExternalWalletProvider } from "@/providers/ExternalWalletProvider";

import "./global.css";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
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
  "add-crypto",
  "pay-merchant",
  "security",
  "sovereignty",
  "vault-create",
  "vault-detail",
];

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <BottomSheetModalProvider>
        <ExternalWalletProvider>
          <PrivyProvider>
            <AuthProvider>
              <RootLayoutInner />
            </AuthProvider>
          </PrivyProvider>
        </ExternalWalletProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { alert, visible, dismiss } = useAlertStore();
  const { isReady, isFullyAuthenticated, isAuthTransitioning } = useAuth();

  const [navigationReady, setNavigationReady] = useState(false);
  const route = segments[0] as string;
  const isOnAuthFlow = AUTH_ROUTES.includes(route);
  const isRedirectingToOnboarding =
    isReady && !isFullyAuthenticated && !isOnAuthFlow;
  const isRedirectingToTabs =
    isReady &&
    isFullyAuthenticated &&
    (isOnAuthFlow || !PROTECTED_ROUTES.includes(route));

  // Manual screen tracking — expo-router + React Navigation v7 blocks autocapture
  useEffect(() => {
    analyticsScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isReady) return;

    if (isRedirectingToOnboarding) {
      router.replace("/onboarding");
    } else if (isRedirectingToTabs) {
      router.replace("/(tabs)");
    }

    setNavigationReady(true);
    setTimeout(() => SplashScreen.hideAsync(), 50);
  }, [isReady, isRedirectingToOnboarding, isRedirectingToTabs, router]);

  if (
    !isReady ||
    !navigationReady ||
    (!isAuthTransitioning && (isRedirectingToOnboarding || isRedirectingToTabs))
  ) {
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
        <Stack.Screen
          name="add-crypto"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen
          name="pay-merchant"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen name="security" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        <Stack.Screen name="sovereignty" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        <Stack.Screen name="vault-create" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        <Stack.Screen name="vault-detail" options={{ presentation: "card", animation: "slide_from_bottom" }} />
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
      {isAuthTransitioning && <VaultOpeningAnimation />}
    </>
  );
}

export default Sentry.wrap(RootLayout);
