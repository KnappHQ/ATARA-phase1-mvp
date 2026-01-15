import { useAuthStore } from "@/stores/useAuthStore";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  Share2,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const WALLET_ADDRESS = user?.publicAddress || "";
  const USER_HANDLE = user?.handle || "User";
  const VANITY_URL = `astra.money/${USER_HANDLE}`;

  const handleCopyAddress = async () => {
    if (!WALLET_ADDRESS) return;
    await Clipboard.setStringAsync(WALLET_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`https://${VANITY_URL}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: "Pay me on Astrâ",
        message: `Send me crypto instantly! Claim your Astrâ Handle to get paid. https://${VANITY_URL}`,
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const initials = USER_HANDLE.substring(0, 2).toUpperCase();

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View className="flex-1 bg-black/80">
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
              <Animated.View
                entering={FadeInDown.springify().damping(25).stiffness(300)}
              >
                <View
                  style={{
                    borderRadius: 24,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(229, 210, 166, 0.2)",
                    backgroundColor: "rgba(10,10,10,0.98)",
                  }}
                >
                  <View className="p-4 flex-row justify-end">
                    <Pressable
                      onPress={onClose}
                      className="w-8 h-8 rounded-full items-center justify-center active:scale-90"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(229, 210, 166, 0.15)",
                      }}
                    >
                      <X size={16} color="#8B8B8B" />
                    </Pressable>
                  </View>

                  <View className="px-8 pb-8 items-center">
                    <Animated.View
                      entering={ZoomIn.delay(100)
                        .springify()
                        .damping(30)
                        .stiffness(200)}
                    >
                      <LinearGradient
                        colors={[
                          "#FFE666",
                          "rgba(255, 230, 102, 0.8)",
                          "rgba(255, 230, 102, 0.6)",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 16,
                          shadowColor: "#FFE666",
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.3,
                          shadowRadius: 16,
                        }}
                      >
                        <Text className="text-3xl font-rajdhani-bold text-background">
                          {initials}
                        </Text>
                      </LinearGradient>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(150)}>
                      <Text className="text-2xl font-rajdhani-semibold text-foreground mb-1">
                        @{USER_HANDLE}
                      </Text>
                    </Animated.View>
                    <Animated.View entering={FadeIn.delay(200)}>
                      <Text className="text-base font-rajdhani-medium text-muted-foreground mb-6">
                        Send me crypto instantly
                      </Text>
                    </Animated.View>

                    <Animated.View
                      entering={ZoomIn.delay(250).springify()}
                      className="mb-6"
                      style={{
                        width: 160,
                        height: 160,
                        padding: 12,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "rgba(229, 210, 166, 0.3)",
                        backgroundColor: "rgba(7, 6, 9, 0.5)",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <LinearGradient
                        colors={["#E5D2A6", "#C4A86B"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 136,
                          height: 136,
                          borderRadius: 12,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <QrCode size={80} color="#14111C" strokeWidth={2} />
                      </LinearGradient>
                    </Animated.View>

                    <Animated.View
                      entering={FadeInDown.delay(300)}
                      className="mb-6"
                    >
                      <Pressable
                        onPress={handleCopyLink}
                        className="flex-row items-center gap-2 px-4 py-2 rounded-full active:scale-95"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.04)",
                          borderWidth: 1,
                          borderColor: "rgba(229, 210, 166, 0.2)",
                        }}
                      >
                        <ExternalLink size={14} color="#FFE666" />
                        <Text className="text-sm font-rajdhani-medium text-champagne">
                          {VANITY_URL}
                        </Text>
                        {linkCopied && <Check size={14} color="#34D399" />}
                      </Pressable>
                    </Animated.View>

                    <Animated.View
                      entering={FadeInDown.delay(350)}
                      className="flex-row gap-3 w-full"
                    >
                      <Pressable
                        onPress={handleCopyAddress}
                        className="flex-1 py-3.5 rounded-xl items-center justify-center active:scale-95"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.04)",
                          borderWidth: 1,
                          borderColor: "rgba(229, 210, 166, 0.15)",
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          {copied ? (
                            <Check size={16} color="#34D399" />
                          ) : (
                            <Copy size={16} color="#FFE666" />
                          )}
                          <Text className="text-sm font-rajdhani-medium text-foreground">
                            {copied ? "Copied!" : "Copy Address"}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={handleShare}
                        className="flex-1 py-3.5 rounded-xl bg-champagne items-center justify-center active:scale-95"
                        style={{
                          shadowColor: "#FFE666",
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.3,
                          shadowRadius: 24,
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Share2 size={16} color="#070609" />
                          <Text className="text-sm font-rajdhani-semibold text-background">
                            Share
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>

                    <Animated.View entering={FadeIn.delay(400)}>
                      <Text className="text-sm font-rajdhani-medium text-muted-foreground mt-6 text-center">
                        Claim your Astrâ Handle to get paid
                      </Text>
                    </Animated.View>
                  </View>
                </View>
              </Animated.View>
            </Pressable>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
  );
}
