import { Pressable, Text, View, Dimensions, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { BlurView } from "expo-blur";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react-native";
import { AlertType } from "@/stores/useAlertStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TYPE_CONFIG: Record<
  AlertType,
  { color: string; Icon: typeof CheckCircle2 }
> = {
  success: { color: "#10b981", Icon: CheckCircle2 },
  error:   { color: "#ef4444", Icon: XCircle },
  warning: { color: "#f59e0b", Icon: AlertTriangle },
  info:    { color: "#3c83f6", Icon: Info },
};

interface AppAlertProps {
  type: AlertType;
  title: string;
  message?: string;
  visible: boolean;
  onDismiss: () => void;
}

export const AppAlert = ({
  type,
  title,
  message,
  visible,
  onDismiss,
}: AppAlertProps) => {
  const insets = useSafeAreaInsets();
  const { color, Icon } = TYPE_CONFIG[type];

  return (
    <MotiView
      from={{ opacity: 0, translateY: -12, scale: 0.97 }}
      animate={
        visible
          ? { opacity: 1, translateY: 0, scale: 1 }
          : { opacity: 0, translateY: -12, scale: 0.97 }
      }
      transition={{ type: "spring", damping: 20, stiffness: 260, mass: 0.8 }}
      pointerEvents={visible ? "box-none" : "none"}
      className="absolute z-[9999] flex-row rounded-2xl overflow-hidden border border-white/10"
      style={{
        top: insets.top + 10,
        width: SCREEN_WIDTH - 32,
        left: 16,
        backgroundColor: "rgba(14,14,14,0.82)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 12,
      }}
    >
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Left accent stripe */}
      <View className="w-[3px] self-stretch" style={{ backgroundColor: color }} />

      {/* Content */}
      <View className="flex-1 flex-row items-center gap-[10px] py-[13px] px-[14px]">
        <Icon size={20} color={color} strokeWidth={2} />
        <View className="flex-1 gap-[2px]">
          <Text className="text-white text-sm font-semibold tracking-[0.1px]" numberOfLines={1}>
            {title}
          </Text>
          {!!message && (
            <Text className="text-white/55 text-[12.5px] leading-[17px]" numberOfLines={2}>
              {message}
            </Text>
          )}
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} className="justify-center items-center pl-1">
          <X size={15} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
        </Pressable>
      </View>
    </MotiView>
  );
};
