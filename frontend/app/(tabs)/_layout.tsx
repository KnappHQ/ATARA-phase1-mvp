import { Tabs } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../../components/BottomNav";
import { Header } from "../../components/Header";
import { ShareModal } from "../../components/homeScreen/ShareModal";

export default function TabsLayout() {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView
        className="flex-1 mx-auto w-full"
        edges={["top"]}
        style={{ backgroundColor: "transparent" }}
      >
        <Header onReceive={() => setShareModalOpen(true)} />

        <View className="flex-1" style={{ backgroundColor: "transparent" }}>
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
              name="activity"
              options={{
                href: "/activity",
                title: "Activity",
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
        </View>
      </SafeAreaView>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </View>
  );
}
