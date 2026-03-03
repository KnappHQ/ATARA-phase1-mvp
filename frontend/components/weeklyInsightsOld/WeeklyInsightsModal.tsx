import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { MotiView, AnimatePresence } from "moti";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { ChevronLeft, X } from "lucide-react-native";
import { CategoryListItem } from "./CategoryListItem";
import { TransactionListItem } from "./TransactionListItem";
import { formatCurrency } from "@/utils/format";

interface WeeklyInsightsModalProps {
  visible: boolean;
  onClose: () => void;
  totalSpent: number;
  categories: any[];
  transactionsByCategory: Record<string, any[]>;
}

export const WeeklyInsightsModal = ({
  visible,
  onClose,
  totalSpent,
  categories,
  transactionsByCategory,
}: WeeklyInsightsModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      backdropOpacity.value = 1;
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setSelectedCategory(null);
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY * 0.7;
        backdropOpacity.value = interpolate(
          event.translationY,
          [0, 300],
          [1, 0.3],
          Extrapolate.CLAMP,
        );
      }
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 800) {
        translateY.value = withTiming(600, { duration: 300 });
        backdropOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            runOnJS(handleClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  }, []);

  const selectedCategoryData = selectedCategory
    ? categories.find((c) => c.name === selectedCategory)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <Animated.View
            className="absolute inset-0 bg-[#0A0A0A]/95"
            style={backdropAnimatedStyle}
          >
            <Pressable className="flex-1" onPress={handleClose} />
          </Animated.View>

          <GestureDetector gesture={panGesture}>
            <Animated.View
              className="w-full max-w-md bg-[#0A0A0A]/90 backdrop-blur-3xl rounded-3xl border border-[#E5D2A6]/10 overflow-hidden"
              style={modalAnimatedStyle}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View className="flex justify-center pt-3 pb-1">
                  <View className="w-10 h-1 rounded-full bg-[#E5D2A6]/30 self-center" />
                </View>

                <View className="flex-row items-start justify-between px-6 pt-2 pb-4">
                  <View className="flex-row items-center gap-3 flex-1">
                    {selectedCategory && (
                      <Pressable
                        onPress={() => setSelectedCategory(null)}
                        className="w-8 h-8 rounded-full bg-white/5 items-center justify-center border border-[#E5D2A6]/10 active:bg-[#E5D2A6]/10"
                      >
                        <ChevronLeft size={16} color="#ffffff" />
                      </Pressable>
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-rajdhani-semibold text-champagne uppercase tracking-[0.2em] mb-2">
                        {selectedCategory || "Portfolio Performance"}
                      </Text>
                      {!selectedCategory && (
                        <View className="flex-row items-baseline gap-2 mb-1">
                          <Text className="text-sm font-rajdhani-medium text-emerald-400/80">
                            Market Growth:
                          </Text>
                          <Text className="text-lg font-rajdhani-bold text-emerald-400">
                            +12.4%
                          </Text>
                        </View>
                      )}
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-sm font-rajdhani-medium text-white/50">
                          {selectedCategory
                            ? "Category Total:"
                            : "Total Spent This Week:"}
                        </Text>
                        <Text className="text-2xl font-bold text-[#E5D2A6]">
                          {formatCurrency(
                            selectedCategory
                              ? selectedCategoryData?.amount || 0
                              : totalSpent,
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleClose}
                    className="w-8 h-8 rounded-full bg-white/5 items-center justify-center border border-[#E5D2A6]/10 active:bg-[#E5D2A6]/10"
                  >
                    <X size={16} color="#ffffff" />
                  </Pressable>
                </View>

                <ScrollView
                  className="px-6 pb-6 max-h-[50vh]"
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    selectedCategory ? (
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#E5D2A6"
                        colors={["#E5D2A6"]}
                      />
                    ) : undefined
                  }
                >
                  {!selectedCategory ? (
                    <View className="gap-3">
                      {categories.length === 0 ? (
                        <Text className="text-center text-white/40 font-rajdhani-medium py-4">
                          No spending this week
                        </Text>
                      ) : (
                        categories.map((category, idx) => (
                          <CategoryListItem
                            key={category.name}
                            category={category}
                            index={idx}
                            onPress={() => setSelectedCategory(category.name)}
                          />
                        ))
                      )}
                    </View>
                  ) : (
                    <View className="gap-2">
                      {(transactionsByCategory[selectedCategory] || []).map(
                        (tx: any, idx: number) => (
                          <TransactionListItem
                            key={tx.id}
                            transaction={tx}
                            index={idx}
                          />
                        ),
                      )}
                      <Text className="text-center text-xs text-white/30 pt-2">
                        {transactionsByCategory[selectedCategory]?.length || 0}{" "}
                        transactions
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <Text className="text-center text-xs text-white/40 pb-4">
                  Swipe down to close
                </Text>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};
