import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Home, LockKeyhole, Send, User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Platform, TouchableOpacity, Text, View } from "react-native";
import { tabBarItems } from "@/utils/tabBarConfig";
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

const VAULTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_VAULTS === "true";

const TABS = {
  home: { route: "index", icon: Home, label: "Home" },
  activity: { route: "activity", icon: ActivityIcon, label: "Activity" },
  groups: { route: "groups", icon: Users, label: "Groups" },
  vaults: { route: "vaults", icon: LockKeyhole, label: "Vault" },
  profile: { route: "profile", icon: User, label: "Profile" },
} as const;

const items = tabBarItems(VAULTS_ENABLED);
const HAS_PAY = items.includes("pay");

export const BottomNav = ({ state, navigation }: BottomTabBarProps) => {
  const router = useRouter();
  const currentRoute = state.routes[state.index]?.name;

  const handlePay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/send");
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50">
      <View className="px-4 pb-8">
        <View>
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
            <View className="flex-row items-center py-3">
              {items.map((id) => {
                if (id === "pay") {
                  // Room for the raised Pay control, which is drawn above the bar.
                  return <View key="pay" className="flex-1" style={{ minHeight: 48 }} />;
                }
                const tab = TABS[id];
                const isActive = currentRoute === tab.route;
                const Icon = tab.icon;

                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => {
                      if (!isActive) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate(tab.route as never);
                      }
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    className="flex-1 flex-col items-center gap-1 px-1 py-2"
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
                      numberOfLines={1}
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

        {HAS_PAY && (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", left: 0, right: 0, top: -20, alignItems: "center" }}
          >
            {/* One control: the circle and its label both press Pay. */}
            <TouchableOpacity
              onPress={handlePay}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Pay"
              style={{ minWidth: 72, minHeight: 44, alignItems: "center" }}
            >
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={[
                  { backgroundColor: COLORS.white },
                  Platform.OS === "ios" && {
                    shadowColor: "#000",
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  },
                ]}
              >
                <Send size={22} color={COLORS.black} strokeWidth={2.2} />
              </View>
              <Text className="text-xs font-medium text-white" style={{ marginTop: 10 }}>
                Pay
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
    </View>
  );
};
