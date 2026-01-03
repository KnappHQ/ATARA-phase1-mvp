import { useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import ActionButton from "../../components/homeScreen/ActionButton";
import { BalanceReveal } from "../../components/homeScreen/BalanceReveal";
import { EmptyVaultCard } from "../../components/homeScreen/EmptyVaultCard";
import { RecentActivity } from "../../components/homeScreen/RecentActivity";
import { ScreenWrapper } from "../../components/ScreenWrapper";

export default function HomeTab() {
  const router = useRouter();
  const [isBalanceRevealed, setIsBalanceRevealed] = React.useState(false);
  const isVaultEmpty = true;

  const handleSend = () => {
    router.push("/send");
  };

  const handleReceive = () => {
    console.log("Receive pressed");
  };

  return (
    <ScreenWrapper>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isBalanceRevealed ? 180 : 100 }}
      >
        <BalanceReveal
          balance={24500}
          changeAmount="+$1,240.50"
          changePercentage="5.3%"
          onRevealChange={setIsBalanceRevealed}
        >
          <View className="flex-row gap-4 mb-10">
            <ActionButton
              icon={<ArrowDownLeft size={20} color="#ffe066" />}
              label="RECEIVE"
              onPress={handleReceive}
            />
            <ActionButton
              icon={<ArrowUpRight size={20} color="#ffe066" />}
              label="SEND"
              onPress={handleSend}
            />
          </View>

          {isVaultEmpty ? (
            <View className="mb-6">
              <EmptyVaultCard onDeposit={handleReceive} />
            </View>
          ) : (
            <View className="mb-6">
              <View className="bg-ceramic border border-champagne/20 rounded-xl p-4">
                <Text className="font-orbitron text-sm font-semibold text-champagne mb-2">
                  Weekly Insights
                </Text>
                <Text className="font-rajdhani text-xs text-muted-foreground">
                  Your portfolio is up 12.5% this week
                </Text>
              </View>
            </View>
          )}

          <RecentActivity />
        </BalanceReveal>
      </ScrollView>
    </ScreenWrapper>
  );
}
