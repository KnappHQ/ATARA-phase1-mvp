import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { RefreshCw } from "lucide-react-native";
import { MotiView } from "moti";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { PortfolioSection } from "../../components/market/PortfolioSection";
import { MarketPulseSection } from "../../components/market/MarketPulseSection";
import { RelevantIntelSection } from "../../components/market/RelevantIntelSection";
import { AddHoldingModal } from "../../components/market/AddHoldingModal";
import { useMarketStore } from "@/stores/useMarketStore";

export default function MarketTab() {
  const [showAddModal, setShowAddModal] = useState(false);

  const {
    refreshAll,
    isMarketLoading,
    isNewsLoading,
    lastUpdated,
    addHolding,
  } = useMarketStore();

  const isLoading = isMarketLoading || isNewsLoading;

  return (
    <ScreenWrapper>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-6 pb-32"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshAll}
            tintColor="#E5D2A6"
            titleColor="#E5D2A6"
            colors={["#E5D2A6"]}
            progressBackgroundColor="#0A0A0A"
          />
        }
      >
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-rajdhani-semibold text-white tracking-wide">
            Market
          </Text>
          <View className="flex-row items-center gap-3">
            <MotiView
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
              from={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{
                type: "timing",
                duration: 1500,
                loop: true,
                repeatReverse: true,
              }}
            >
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <Text className="text-xs font-rajdhani-medium text-emerald-400 uppercase tracking-wider">
                Live
              </Text>
            </MotiView>

            <Pressable
              onPress={refreshAll}
              disabled={isLoading}
              className="w-8 h-8 rounded-xl bg-[#0A0A0A]/40 border border-champagne/10 items-center justify-center active:bg-champagne/5"
            >
              <MotiView
                from={{ rotate: "0deg" }}
                animate={{ rotate: isLoading ? "360deg" : "0deg" }}
                transition={{ loop: isLoading, duration: 800 }}
              >
                <RefreshCw size={16} color="#E5D2A6" />
              </MotiView>
            </Pressable>
          </View>
        </View>

        <Text className="text-xs font-rajdhani-medium text-muted-foreground font-rajdhani-regular mb-6">
          Updated {lastUpdated.toLocaleTimeString()}
        </Text>

        <PortfolioSection onAddPress={() => setShowAddModal(true)} />

        <MarketPulseSection />

        <RelevantIntelSection />
      </ScrollView>

      <AddHoldingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addHolding}
      />
    </ScreenWrapper>
  );
}
