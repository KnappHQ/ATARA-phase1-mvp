import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { COLORS } from "@/utils/constants";

/** The line a screen shows above its fixed content while live data loads or could not be had. */
export const LoadNotice = ({
  notice,
  onRetry,
}: {
  notice: { kind: "loading" | "unavailable"; text: string; canRetry: boolean } | null;
  onRetry?: () => void;
}) => {
  if (!notice) return null;
  return (
    <View
      accessibilityRole="alert"
      className="mb-5 flex-row items-center rounded-2xl border border-white/15 bg-white/[0.04] p-4"
    >
      {notice.kind === "loading" ? <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 12 }} /> : null}
      <Text className="flex-1 text-sm leading-5 text-white/70">{notice.text}</Text>
      {notice.canRetry && onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8} className="ml-3 min-h-11 justify-center">
          <Text className="text-sm font-semibold" style={{ color: COLORS.accent }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
