import React from "react";
import { View, Text } from "react-native";
import { NewsItem } from "./NewsItem";
import { NEWS_DATA } from "./mockData";

export const RelevantIntelSection = () => {
  return (
    <View>
      <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-wider mb-4">
        Relevant Intel
      </Text>

      <View className="gap-2">
        {NEWS_DATA.map((news, index) => (
          <NewsItem key={index} news={news} index={index} />
        ))}
      </View>
    </View>
  );
};
