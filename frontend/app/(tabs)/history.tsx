import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { Search } from "lucide-react-native";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { FilterTabs, FilterType } from "../../components/history/FilterTabs";
import { TransactionGroup } from "../../components/history/TransactionGroup";
import { useHistoryData } from "@/hooks/useHistoryData";

export default function HistoryTab() {
  const { filter, setFilter, groupedEntries, isLoading, refetch } = useHistoryData();

  return (
    <ScreenWrapper>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-6 pb-28"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={refetch} 
            tintColor="#E5D2A6"
            titleColor="#E5D2A6"
            colors={["#E5D2A6"]}
            progressBackgroundColor="#0A0A0A"
          />
        }
      >
        <View className="flex-row items-center justify-between mb-8">
          <Text className="text-2xl font-rajdhani-semibold text-white tracking-wide">
            History
          </Text>
          <Pressable className="w-12 h-12 rounded-full bg-[#0A0A0A]/40 border border-champagne/10 items-center justify-center active:bg-champagne/5">
            <Search size={16} color="#E5D2A6" />
          </Pressable>
        </View>

        <FilterTabs activeFilter={filter} onFilterChange={setFilter} />

        {groupedEntries.length > 0 ? (
          <View>
            {groupedEntries.map(([date, transactions], index) => (
              <TransactionGroup
                key={date}
                date={date}
                transactions={transactions}
                index={index}
              />
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-20">
            <Text className="text-sm font-rajdhani-medium text-white/30">
              No transactions found
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
