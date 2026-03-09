import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Pencil, BadgeCheck, Copy, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { COLORS } from "@/utils/constants";

interface IdentityCardProps {
  displayName?: string;
  handle?: string;
  smartAccountAddress?: string;
  isVerified?: boolean;
  onEditDisplayName?: () => void;
}

export const IdentityCard = ({
  displayName,
  handle,
  smartAccountAddress,
  isVerified = false,
  onEditDisplayName,
}: IdentityCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!smartAccountAddress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(smartAccountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 16)}...${addr.slice(-14)}`;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay: 200 }}
      className="rounded-2xl p-4 border border-white/10 mb-6"
      style={{ backgroundColor: `${COLORS.white}05` }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text
            className="text-xs font-mono uppercase mb-1"
            style={{ color: `${COLORS.white}40`, letterSpacing: 1 }}
          >
            Display Name
          </Text>
          <Text className="text-white text-base font-semibold">
            {displayName || "—"}
          </Text>
        </View>
        {onEditDisplayName && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEditDisplayName();
            }}
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: `${COLORS.white}08` }}
          >
            <Pencil size={14} color={`${COLORS.white}50`} />
          </Pressable>
        )}
      </View>

      <View
        className="h-px mb-3"
        style={{ backgroundColor: `${COLORS.white}08` }}
      />

      <View className="mb-3">
        <Text
          className="text-xs font-mono uppercase mb-1"
          style={{ color: `${COLORS.white}40`, letterSpacing: 1 }}
        >
          Handle
        </Text>
        <Text
          className="text-base font-semibold"
          style={{ color: COLORS.accent }}
        >
          @{handle}
        </Text>
      </View>

      {smartAccountAddress && (
        <>
          <View
            className="h-px mb-3"
            style={{ backgroundColor: `${COLORS.white}08` }}
          />

          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text
                className="text-xs font-mono uppercase mb-1"
                style={{ color: `${COLORS.white}40`, letterSpacing: 1 }}
              >
                Smart Account
              </Text>
              <Text
                className="text-sm font-mono"
                style={{ color: `${COLORS.white}70` }}
              >
                {truncateAddress(smartAccountAddress)}
              </Text>
            </View>
            <Pressable
              onPress={handleCopyAddress}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{
                backgroundColor: copied
                  ? `${COLORS.accent}20`
                  : `${COLORS.white}08`,
              }}
            >
              {copied ? (
                <Check size={14} color={COLORS.accent} />
              ) : (
                <Copy size={14} color={`${COLORS.white}50`} />
              )}
            </Pressable>
          </View>
        </>
      )}

      {isVerified && (
        <>
          <View
            className="h-px mb-3 mt-3"
            style={{ backgroundColor: `${COLORS.white}08` }}
          />
          <View className="flex-row items-center gap-2">
            <BadgeCheck size={16} color={COLORS.emarald} />
            <Text
              className="text-sm font-medium"
              style={{ color: COLORS.emarald }}
            >
              Verified
            </Text>
          </View>
        </>
      )}
    </MotiView>
  );
};
