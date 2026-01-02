import { Tabs } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../../components/BottomNav";
import { Header } from "../../components/Header";
import { LivingBackground } from "../../components/LivingBackground";

export default function TabsLayout() {
  return (
    <View className="flex-1">
      <LivingBackground />

      <SafeAreaView className="flex-1 max-w-md mx-auto w-full" edges={["top"]}>
        <Header />

        <Tabs
          tabBar={(props) => <BottomNav {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              href: "/",
              title: "Home",
            }}
          />
          <Tabs.Screen
            name="market"
            options={{
              href: "/market",
              title: "Market",
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              href: "/history",
              title: "History",
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              href: "/profile",
              title: "Profile",
            }}
          />
        </Tabs>
      </SafeAreaView>
    </View>
  );
}
