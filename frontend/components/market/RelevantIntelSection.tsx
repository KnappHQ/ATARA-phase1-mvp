import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { NewsItem } from "./NewsItem";
import { useMarketStore } from "@/stores/useMarketStore";

export const RelevantIntelSection = () => {
  const { news, isNewsLoading, fetchNews } = useMarketStore();

  useEffect(() => {
    if (news.length === 0) fetchNews();
  }, []);

  return (
    <View>
      <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider mb-4">
        Relevant Intel
      </Text>

      {isNewsLoading && news.length === 0 ? (
        <View className="py-20 items-center justify-center">
          <ActivityIndicator color="#E5D2A6" size="large" />
        </View>
      ) : (
        <View className="gap-2">
          {news.map((newsItem, index) => (
            <NewsItem key={index} news={newsItem} index={index} />
          ))}
        </View>
      )}
    </View>
  );
};
