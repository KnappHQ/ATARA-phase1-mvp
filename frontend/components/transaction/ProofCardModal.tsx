import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Share2, X, CheckCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View, Dimensions, Share } from "react-native";
import { MotiView, AnimatePresence } from "moti";
import { COLORS } from "@/utils/constants";

interface ProofCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
  amount: string;
  coin: string;
  recipientHandle: string;
  transactionId: string;
}

const { width } = Dimensions.get("window");
const CARD_WIDTH = Math.min(width - 48, 300);

const formatTxHash = (hash: string) => {
  if (!hash) return "0x00...0000";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

export const ProofCardModal = ({
  isOpen,
  onClose,
  onShare,
  amount,
  coin,
  recipientHandle,
  transactionId,
}: ProofCardModalProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [cardReady, setCardReady] = useState(false);

  const handleModalOpen = () => {
    setIsGenerating(true);
    setCardReady(false);

    setTimeout(() => {
      setIsGenerating(false);
      setTimeout(() => {
        setCardReady(true);
      }, 300);
    }, 1500);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `Payment of ${amount} ${coin} to ${recipientHandle} confirmed on ATARA.\nRef: ${transactionId}`,
      });
      if (onShare) onShare();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onShow={handleModalOpen}
    >
      <View className="flex-1 bg-black">
        <BlurView intensity={20} className="flex-1" tint="dark">
          <View className="flex-1 px-6">
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", duration: 300, delay: 300 }}
              style={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}
            >
              <Pressable
                onPress={onClose}
                className="w-10 h-10 rounded-full items-center justify-center active:scale-90"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <X size={20} color="#8B8B8B" />
              </Pressable>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: -20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 500 }}
              style={{
                position: "absolute",
                top: 80,
                left: 0,
                right: 0,
                alignItems: "center",
              }}
            >
              <MotiView
                animate={{
                  opacity: isGenerating ? [0.5, 1, 0.5] : 1,
                }}
                transition={{
                  type: "timing",
                  duration: 1500,
                  loop: isGenerating,
                }}
              >
                <Text
                  className="font-medium text-base uppercase"
                  style={{ letterSpacing: 6, color: COLORS.primary }}
                >
                  {isGenerating ? "Generating Proof..." : "Proof Generated"}
                </Text>
              </MotiView>

              {isGenerating && (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: 16,
                    width: 128,
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: "rgba(247, 247, 243, 0.1)",
                    overflow: "hidden",
                  }}
                >
                  <MotiView
                    from={{ translateX: -100 }}
                    animate={{ translateX: 200 }}
                    transition={{
                      type: "timing",
                      duration: 1000,
                      loop: true,
                    }}
                    style={{ width: "30%", height: "100%" }}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.platinum]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: "100%", height: "100%", borderRadius: 2 }}
                    />
                  </MotiView>
                </MotiView>
              )}
            </MotiView>

            <View className="flex-1 justify-center items-center">
              <MotiView
                from={{
                  scale: 0.7,
                  opacity: 0.5,
                }}
                animate={{
                  scale: isGenerating ? 0.7 : 1,
                  opacity: isGenerating ? 0.5 : 1,
                }}
                transition={{
                  type: "timing",
                  duration: 600,
                  delay: isGenerating ? 0 : 100,
                }}
                style={{ width: CARD_WIDTH }}
              >
                <View
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: "rgba(15, 10, 25, 0.95)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 30 },
                    shadowOpacity: 0.9,
                    shadowRadius: 60,
                    elevation: 30,
                  }}
                >
                  <LinearGradient
                    colors={[
                      "transparent",
                      COLORS.primary,
                      COLORS.platinum,
                      COLORS.primary,
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      zIndex: 10,
                    }}
                  />
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.platinum, COLORS.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: 2,
                      zIndex: 10,
                    }}
                  />
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.platinum, COLORS.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 2,
                      zIndex: 10,
                    }}
                  />
                  <LinearGradient
                    colors={[
                      "transparent",
                      COLORS.primary,
                      COLORS.platinum,
                      COLORS.primary,
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      zIndex: 10,
                    }}
                  />

                  <View style={{ padding: 32 }}>
                    <View style={{ alignItems: "center", marginBottom: 32 }}>
                      <Text
                        className="font-medium text-base uppercase tracking-widest"
                        style={{ color: COLORS.primary }}
                      >
                        ATARA
                      </Text>
                    </View>

                    <View style={{ alignItems: "center", marginBottom: 24 }}>
                      <Text
                        className="font-bold text-4xl"
                        style={{ letterSpacing: 2, color: COLORS.primary }}
                      >
                        - {amount} {coin}
                      </Text>
                    </View>

                    <View style={{ alignItems: "center", marginBottom: 32 }}>
                      <Text
                        className="text-base"
                        style={{ color: "rgba(255, 255, 255, 0.7)" }}
                      >
                        Sent to{" "}
                        <Text
                          className="font-semibold"
                          style={{ color: COLORS.white }}
                        >
                          {recipientHandle}
                        </Text>
                      </Text>
                    </View>

                    <View
                      style={{
                        width: "100%",
                        height: 1,
                        marginBottom: 20,
                        overflow: "hidden",
                      }}
                    >
                      <LinearGradient
                        colors={[
                          "transparent",
                          `${COLORS.primary}4D`,
                          "transparent",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </View>

                    <View style={{ alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          opacity: 0.8,
                        }}
                      >
                        <CheckCircle2 size={12} color={COLORS.primary} />
                        <Text
                          className="font-medium text-[10px] uppercase"
                          style={{ letterSpacing: 2, color: COLORS.primary }}
                        >
                          Confirmed On-Chain
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          className="font-medium text-xs"
                          style={{
                            letterSpacing: 1,
                            color: "rgba(255, 255, 255, 0.5)",
                          }}
                        >
                          REF: {formatTxHash(transactionId)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      width: 12,
                      height: 12,
                      borderTopWidth: 1,
                      borderLeftWidth: 1,
                      borderColor: `${COLORS.primary}4D`,
                      borderTopLeftRadius: 2,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 12,
                      height: 12,
                      borderTopWidth: 1,
                      borderRightWidth: 1,
                      borderColor: `${COLORS.primary}4D`,
                      borderTopRightRadius: 2,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 16,
                      left: 16,
                      width: 12,
                      height: 12,
                      borderBottomWidth: 1,
                      borderLeftWidth: 1,
                      borderColor: `${COLORS.primary}4D`,
                      borderBottomLeftRadius: 2,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 16,
                      right: 16,
                      width: 12,
                      height: 12,
                      borderBottomWidth: 1,
                      borderRightWidth: 1,
                      borderColor: `${COLORS.primary}4D`,
                      borderBottomRightRadius: 2,
                    }}
                  />
                </View>
              </MotiView>
            </View>

            <MotiView
              from={{ opacity: 0.3 }}
              animate={{ opacity: cardReady ? 1 : 0.3 }}
              transition={{ type: "timing", duration: 500 }}
              style={{ position: "absolute", bottom: 40, left: 24, right: 24 }}
            >
              <Pressable
                onPress={handleNativeShare}
                disabled={!cardReady}
                className="py-4 rounded-xl items-center justify-center active:scale-95"
                style={{
                  backgroundColor: cardReady
                    ? COLORS.primary
                    : "rgba(247, 247, 243, 0.1)",
                  shadowColor: cardReady ? COLORS.platinum : "transparent",
                  shadowOffset: { width: 0, height: 15 },
                  shadowOpacity: 0.35,
                  shadowRadius: 40,
                  elevation: 15,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <Share2
                    size={20}
                    color={cardReady ? COLORS.black : "#8B8B8B"}
                  />
                  <Text
                    numberOfLines={1}
                    className="font-medium text-sm uppercase"
                    style={{
                      color: cardReady ? COLORS.black : "#8B8B8B",
                      letterSpacing: 2,
                    }}
                  >
                    Share Proof
                  </Text>
                </View>
              </Pressable>
            </MotiView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};
