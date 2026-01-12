import React from "react";
import { View, Text, Pressable } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { MotiView } from "moti";
import { NewsItem as NewsItemType } from "./mockData";

interface NewsItemProps {
  news: NewsItemType;
  index: number;
}

export const NewsItem = ({ news, index }: NewsItemProps) => {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "timing", duration: 300, delay: index * 100 }}
    >
      <Pressable className="relative overflow-hidden rounded-xl border border-champagne/20 bg-[rgba(255,255,255,0.03)] p-4 active:bg-white/5">
        <View className="flex-row items-start gap-3">
          <View className="px-2 py-1 rounded bg-primary/20 border border-champagne/30">
            <Text className="text-xs font-rajdhani-bold text-champagne-neon tracking-wider">
              {news.tag}
            </Text>
          </View>

          <View className="flex-1">
            <Text className="text-base font-rajdhani-medium text-white leading-tight mb-1">
              {news.title}
            </Text>
            <Text className="text-xs text-muted-foreground font-rajdhani-medium">
              {news.time}
            </Text>
          </View>

          <ExternalLink size={16} color="#808080" />
        </View>
      </Pressable>
    </MotiView>
  );
};
