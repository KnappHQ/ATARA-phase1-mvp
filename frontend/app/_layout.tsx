import { useAuthStore } from "@/stores/useAuthStore";
import {
  Orbitron_400Regular,
  Orbitron_500Medium,
  Orbitron_600SemiBold,
  Orbitron_700Bold,
} from "@expo-google-fonts/orbitron";
import {
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from "@expo-google-fonts/rajdhani";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AstraAlert } from "../components/alert/AstraAlert";
import { useAlertStore } from "../stores/useAlertStore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../shim";
import "./global.css";
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { visible, type, message, duration, hide } = useAlertStore();
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });

  const {
    isAuthenticated,
    loadSession,
    isLoading: isAuthLoading,
  } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        await loadSession();
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };
    prepare();
  }, []);

  useEffect(() => {
    if (!isReady || !fontsLoaded || isAuthLoading || hasNavigated) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const onOnboarding = segments[0] === "onboarding";

    if (isAuthenticated) {
      if (!inTabsGroup && !onOnboarding) {
        router.replace("/(tabs)");
        setHasNavigated(true);
      }
    } else {
      if (!onOnboarding) {
        router.replace("/onboarding");
        setHasNavigated(true);
      }
    }
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
  }, [
    isReady,
    fontsLoaded,
    isAuthenticated,
    isAuthLoading,
    segments,
    hasNavigated,
  ]);

  if (!isReady || !fontsLoaded || isAuthLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#070609" }}>
        <View className="flex-1 bg-[#070609] items-center justify-center">
          <ActivityIndicator size="large" color="#FFE666" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#070609" }}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <AstraAlert
        visible={visible}
        type={type}
        message={message}
        duration={duration}
        onDismiss={hide}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#070609" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: "#070609" },
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="send"
          options={{
            presentation: "transparentModal",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#070609" },
          }}
        />
        <Stack.Screen
          name="transaction-success"
          options={{
            presentation: "card",
            animation: "fade",
            contentStyle: { backgroundColor: "#070609" },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
