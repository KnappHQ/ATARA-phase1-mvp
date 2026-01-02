import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeScreen } from "../../components/HomeScreen";
import { LivingBackground } from "../../components/LivingBackground";

export default function HomeTab() {
  const router = useRouter();

  const handleReceive = () => {
    console.log("Receive pressed");
  };

  const handleSend = () => {
    router.push("/send");
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 max-w-md mx-auto w-full" edges={["top"]}>
        <View className="flex-1">
          <HomeScreen onSend={handleSend} onReceive={handleReceive} />
        </View>
      </SafeAreaView>
    </View>
  );
}
