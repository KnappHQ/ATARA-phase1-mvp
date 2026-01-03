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
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../shim";
import { StorageService } from "../utils/storage";
import "./global.css";
SplashScreen.preventAutoHideAsync();

function NavigationGuard() {
  const segments = useSegments();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isOnboardingComplete =
          await StorageService.isOnboardingComplete();
        const currentSegment = segments[0];

        if (!isOnboardingComplete && currentSegment !== "onboarding") {
          router.replace("/onboarding");
          return;
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error checking auth status:", error);
        router.replace("/onboarding");
        setIsInitialized(true);
      }
    };

    checkAuth();
  }, [segments, router]);

  if (!isInitialized) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-2xl font-bold text-foreground">
          Astr<Text className="text-primary">â</Text>
        </Text>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <NavigationGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="send" />
      </Stack>
    </GestureHandlerRootView>
  );
}
