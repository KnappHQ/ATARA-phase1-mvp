import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Clock, Home, TrendingUp, User } from "lucide-react-native";
import { TouchableOpacity, Text, View } from "react-native";
import { COLORS } from "@/utils/constants";
import Svg, { Polyline } from "react-native-svg";

// Custom Activity pulse/zig-zag icon
const ActivityIcon = ({
  size = 22,
  color = COLORS.white,
  strokeWidth = 2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polyline points="4 13 8 9 12 15 16 7 20 11" />
  </Svg>
);

const tabs = [
  { id: "home", route: "index", icon: Home, label: "Home" },
  { id: "activity", route: "activity", icon: ActivityIcon, label: "Activity" },
  { id: "profile", route: "profile", icon: User, label: "Profile" },
];

export const BottomNav = ({ state, navigation }: BottomTabBarProps) => {
  const currentRoute = state.routes[state.index]?.name;

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50">
      <View className="px-4 pb-8">
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <View className="flex-row items-center justify-around py-3">
              {tabs.map((tab) => {
                const isActive = currentRoute === tab.route;
                const Icon = tab.icon;

                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => {
                      if (!isActive) {
                        navigation.navigate(tab.route as never);
                      }
                    }}
                    activeOpacity={0.7}
                    className="flex-col items-center gap-1 px-4 py-2"
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 2}
                      color={
                        isActive ? COLORS.white : "rgba(255, 255, 255, 0.4)"
                      }
                    />

                    <Text
                      className="text-xs font-medium"
                      style={{
                        color: isActive
                          ? COLORS.white
                          : "rgba(255, 255, 255, 0.4)",
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
};
