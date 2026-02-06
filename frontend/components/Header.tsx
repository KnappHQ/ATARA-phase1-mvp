import { usePathname, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Pressable, Text, View, TouchableOpacity } from "react-native";
import { CrownIcon } from "./onboarding/CrownIcon";

interface HeaderProps {
  onReceive?: () => void;
}

export const Header = ({ onReceive }: HeaderProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";

  const handleReceive = () => {
    onReceive?.();
  };

  const handleSend = () => {
    router.push("/send");
  };

  return (
    <View className="pt-12 pb-2 px-6 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <CrownIcon size={24} color="#FFFFFF" />
        <Text
          className="text-base font-bold text-white"
          style={{ letterSpacing: 3 }}
        >
          ATARA
        </Text>
      </View>

      {!isHomePage && (
        <View className="flex-1 items-center">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleReceive}
              activeOpacity={0.7}
              className="px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 border border-white/10"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            >
              <ArrowDownLeft size={14} color="#84CCFF" />
              <Text
                className="text-[10px] font-semibold uppercase text-white"
                style={{ letterSpacing: 1.5 }}
              >
                RCV
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              activeOpacity={0.7}
              className="px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 border border-white/10"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            >
              <ArrowUpRight size={14} color="#F5F5F0" />
              <Text
                className="text-[10px] font-semibold uppercase text-white"
                style={{ letterSpacing: 1.5 }}
              >
                SEND
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.3)",
        }}
      >
        <Text className="text-xs font-medium text-white">TV</Text>
      </View>
    </View>
  );
};
