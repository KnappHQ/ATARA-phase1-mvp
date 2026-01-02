import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LivingBackground } from "../../components/LivingBackground";

export default function HistoryTab() {
  return (
    <View className="flex-1 bg-transparent">
      <LivingBackground />

      <SafeAreaView className="flex-1 max-w-md mx-auto w-full" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground text-lg">History Screen</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
