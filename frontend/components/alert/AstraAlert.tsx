import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X, AlertTriangle, Info } from "lucide-react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

export type AlertType = "success" | "error" | "warning" | "info";

interface AstraAlertProps {
  type: AlertType;
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

const alertIcons: Record<AlertType, React.ReactNode> = {
  success: <Check size={16} color="#34D399" />,
  error: <X size={16} color="#F87171" />,
  warning: <AlertTriangle size={16} color="#FBBF24" />,
  info: <Info size={16} color="#60A5FA" />,
};

export function AstraAlert({
  type,
  message,
  visible,
  onDismiss,
  duration = 3000,
}: AstraAlertProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      <SafeAreaView pointerEvents="box-none" edges={["top"]}>
        <View
          style={{ alignItems: "flex-end", paddingRight: 12, paddingTop: 12 }}
        >
          <Animated.View
            entering={FadeInDown.duration(350)}
            exiting={FadeOutUp.duration(350)}
          >
            <Pressable
              onPress={onDismiss}
              className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/80 border border-champagne/30 shadow-lg active:opacity-90"
              accessibilityRole="alert"
              accessibilityLabel={message}
            >
              <View className="w-7 h-7 rounded-full bg-champagne/10 border border-champagne/20 items-center justify-center">
                {alertIcons[type]}
              </View>
              <Text
                className="font-rajdhani text-base text-foreground/90 tracking-wide max-w-[220px]"
                numberOfLines={2}
              >
                {message}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
