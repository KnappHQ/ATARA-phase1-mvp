import { BlurView } from "expo-blur";
import { usePathname, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";

  const handleReceive = () => {
    console.log("Receive pressed");
  };

  const handleSend = () => {
    router.push("/send");
  };

  return (
    <View className="pt-6 pb-2 px-6 flex-row items-center justify-between bg-transparent">
      <Text className="text-xl font-semibold tracking-wide text-foreground">
        Astr<Text className="text-primary">â</Text>
      </Text>

      {!isHomePage && (
        <View className="flex-1 items-center">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={handleReceive} className="active:scale-95">
              <View className="overflow-hidden rounded-xl border border-champagne/30">
                <BlurView
                  intensity={40}
                  tint="dark"
                  className="px-3 py-1.5 flex-row items-center gap-1.5"
                >
                  <ArrowDownLeft size={14} color="#F5D580" />
                  <Text className="font-hud text-[10px] font-semibold tracking-hud text-foreground uppercase">
                    RCV
                  </Text>
                </BlurView>
              </View>
            </Pressable>

            <Pressable onPress={handleSend} className="active:scale-95">
              <View className="overflow-hidden rounded-xl border border-champagne/30">
                <BlurView
                  intensity={40}
                  tint="dark"
                  className="px-3 py-1.5 flex-row items-center gap-1.5"
                >
                  <ArrowUpRight size={14} color="#F5D580" />
                  <Text className="font-hud text-[10px] font-semibold tracking-hud text-foreground uppercase">
                    SEND
                  </Text>
                </BlurView>
              </View>
            </Pressable>
          </View>
        </View>
      )}

      <View className="w-8 h-8 rounded-full bg-muted items-center justify-center">
        <Text className="text-xs font-bold text-foreground">TV</Text>
      </View>
    </View>
  );
};
