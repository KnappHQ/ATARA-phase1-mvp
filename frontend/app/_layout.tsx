import "node-libs-react-native/globals.js";
import "react-native-get-random-values";
import "@account-kit/react-native";

import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSignerStatus } from "@account-kit/react-native";
import { AlchemySignerStatus } from "@account-kit/signer";

import { AlchemyProvider } from "../providers/AlchemyProvider";
import { useAuthStore } from "@/stores/useAuthStore";

import "./global.css";

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <AlchemyProvider>
        <RootLayoutInner />
      </AlchemyProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    loadSession,
  } = useAuthStore();
  const { status: signerStatus, isAuthenticating } = useSignerStatus();

  const isSignerConnected = signerStatus === AlchemySignerStatus.CONNECTED;
  const isFullyAuthenticated = isSignerConnected && isAuthenticated;
  const isReady = !isAuthLoading;

  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

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
  }, [isReady, isFullyAuthenticated, segments]);

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
    </>
  );
}
