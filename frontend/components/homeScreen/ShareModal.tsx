import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, ExternalLink, Share2, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import { MotiView } from "moti";
import { COLORS } from "@/utils/constants";
import * as Haptics from "expo-haptics";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VANITY_URL_BASE = "atara.money";

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { user } = useAuthStore();
  const { smartAccountAddress } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const WALLET_ADDRESS = smartAccountAddress || "No wallet connected";
  const USER_HANDLE = user?.handle || "thomas";
  const VANITY_URL = `${VANITY_URL_BASE}/${USER_HANDLE}`;

  const handleCopyAddress = async () => {
    if (!WALLET_ADDRESS) return;
    await Clipboard.setStringAsync(WALLET_ADDRESS);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`https://${VANITY_URL}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: "Pay me on ATARA",
        message: `Send me instantly via ATARA. https://${VANITY_URL}`,
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const initials = USER_HANDLE.substring(0, 1).toUpperCase();

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View className="flex-1 bg-black/90">
        <BlurView intensity={20} style={{ flex: 1 }} tint="dark">
          <Pressable
            onPress={onClose}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 400 }}
            >
              <MotiView
                from={{ opacity: 0, scale: 0.95, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                exit={{ opacity: 0, scale: 0.95, translateY: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                <View
                  style={{
                    borderRadius: 24,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor: COLORS.black,
                  }}
                >
                  <View className="p-4 flex-row justify-end">
                    <Pressable
                      onPress={onClose}
                      className="w-8 h-8 rounded-full items-center justify-center active:scale-90"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <X size={16} color="rgba(255, 255, 255, 0.6)" />
                    </Pressable>
                  </View>

                  <View className="px-8 pb-8 items-center">
                    <MotiView
                      from={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        delay: 100,
                        damping: 30,
                        stiffness: 200,
                      }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 16,
                        backgroundColor: COLORS.platinum,
                      }}
                    >
                      <Text
                        className="text-3xl font-bold"
                        style={{ color: COLORS.black }}
                      >
                        {initials}
                      </Text>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 10 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: "timing", delay: 150, duration: 200 }}
                    >
                      <Text
                        className="text-2xl font-semibold mb-1"
                        style={{ color: COLORS.white }}
                      >
                        @{USER_HANDLE}
                      </Text>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: "timing", delay: 200, duration: 200 }}
                    >
                      <Text className="text-base mb-8 text-muted">
                        Send me instantly
                      </Text>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 10 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: "timing", delay: 250, duration: 200 }}
                      className="mb-6"
                    >
                      <Pressable
                        onPress={handleCopyLink}
                        className="flex-row items-center gap-2 px-6 py-3 rounded-2xl active:scale-95"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <ExternalLink size={16} color={COLORS.white} />
                        <Text
                          className="text-base font-medium"
                          style={{ color: COLORS.white }}
                        >
                          {VANITY_URL}
                        </Text>
                        {linkCopied && (
                          <Check size={16} color={COLORS.sapphire} />
                        )}
                      </Pressable>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: "timing", delay: 300, duration: 200 }}
                      className="mb-6 w-full"
                    >
                      <Text
                        className="text-xs mb-2 text-center uppercase text-muted"
                        style={{
                          letterSpacing: 1.5,
                        }}
                      >
                        Wallet Address
                      </Text>
                      <Text
                        className="text-sm text-center px-4"
                        style={{
                          color: "rgba(255, 255, 255, 0.8)",
                          fontVariant: ["tabular-nums"],
                          lineHeight: 20,
                        }}
                        numberOfLines={2}
                      >
                        {WALLET_ADDRESS || "No wallet connected"}
                      </Text>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 10 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: "timing", delay: 350, duration: 200 }}
                      className="flex-row gap-3 w-full"
                    >
                      <Pressable
                        onPress={handleCopyAddress}
                        className="flex-1 py-3.5 rounded-2xl items-center justify-center active:scale-95"
                        style={{
                          backgroundColor: copied
                            ? "rgba(132, 204, 255, 0.1)"
                            : "rgba(255, 255, 255, 0.05)",
                          borderWidth: 1,
                          borderColor: copied
                            ? "rgba(132, 204, 255, 0.3)"
                            : "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          {copied ? (
                            <Check size={16} color={COLORS.sapphire} />
                          ) : (
                            <Copy size={16} color="rgba(255, 255, 255, 0.6)" />
                          )}
                          <Text
                            className="text-sm font-medium"
                            style={{
                              color: copied ? COLORS.sapphire : COLORS.white,
                            }}
                          >
                            {copied ? "Copied!" : "Copy Address"}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={handleShare}
                        className="flex-1 py-3.5 rounded-2xl items-center justify-center active:scale-95"
                        style={{
                          backgroundColor: COLORS.platinum,
                          shadowColor: COLORS.platinum,
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.2,
                          shadowRadius: 20,
                          elevation: 10,
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Share2 size={16} color={COLORS.black} />
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: COLORS.black }}
                          >
                            Share
                          </Text>
                        </View>
                      </Pressable>
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: "timing", delay: 400, duration: 200 }}
                    >
                      <Text className="text-xs mt-6 text-center text-muted">
                        Universal Sovereignty
                      </Text>
                    </MotiView>
                  </View>
                </View>
              </MotiView>
            </Pressable>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
  );
}
