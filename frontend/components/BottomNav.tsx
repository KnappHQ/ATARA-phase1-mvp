import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Clock, Home, TrendingUp, User } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const tabs = [
  { id: "home", route: "index", icon: Home, label: "Home" },
  { id: "market", route: "market", icon: TrendingUp, label: "Market" },
  { id: "history", route: "history", icon: Clock, label: "History" },
  { id: "profile", route: "profile", icon: User, label: "Profile" },
];

export const BottomNav = ({ state, navigation }: BottomTabBarProps) => {
  const currentRoute = state.routes[state.index]?.name;

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50">
      {/* FULL WIDTH container */}
      <View className="px-4 pb-8">
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)", // glass tint
            borderWidth: 1,
            borderColor: "rgba(229,210,166,0.18)",
          }}
        >
          {/* Blur layer */}
          <BlurView
            intensity={90}
            tint="dark"
            className="flex-row items-center justify-around py-3"
          >
            {/* Glass highlight overlay */}
            <View
              pointerEvents="none"
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            />

            {tabs.map((tab) => {
              const isActive = currentRoute === tab.route;
              const Icon = tab.icon;

              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    if (!isActive) {
                      navigation.navigate(tab.route as never);
                    }
                  }}
                  className="flex-col items-center gap-1 px-4 py-2 rounded-xl active:scale-95"
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    color={
                      isActive
                        ? "#E5D2A6" // champagne gold
                        : "rgb(161,161,170)"
                    }
                    style={
                      isActive
                        ? {
                            shadowColor: "#E5D2A6",
                            shadowOpacity: 0.8,
                            shadowRadius: 10,
                          }
                        : undefined
                    }
                  />

                  <Text
                    className={`text-[10px] font-medium tracking-wide ${
                      isActive ? "text-primary" : "text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </BlurView>
        </View>
      </View>
    </View>
  );
};
