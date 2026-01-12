import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { X } from "lucide-react-native";
import { MotiView } from "moti";
import { CRYPTO_DATA, formatPrice } from "./mockData";

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (holding: {
    symbol: string;
    name: string;
    quantity: number;
    purchasePrice: number;
  }) => void;
}

export const AddHoldingModal = ({
  isOpen,
  onClose,
  onAdd,
}: AddHoldingModalProps) => {
  const [selectedCoin, setSelectedCoin] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");

  const selectedCoinData = CRYPTO_DATA.find((p) => p.symbol === selectedCoin);

  const handleSubmit = () => {
    if (!selectedCoin || !quantity || !purchasePrice) return;

    const coin = CRYPTO_DATA.find((p) => p.symbol === selectedCoin);
    if (!coin) return;

    onAdd({
      symbol: coin.symbol,
      name: coin.name,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
    });

    // Reset form
    setSelectedCoin("");
    setQuantity("");
    setPurchasePrice("");
    onClose();
  };

  const handleUseCurrent = () => {
    if (selectedCoinData?.price) {
      setPurchasePrice(selectedCoinData.price.toString());
    }
  };

  const totalInvested =
    quantity && purchasePrice
      ? (parseFloat(quantity) * parseFloat(purchasePrice)).toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )
      : null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-6">
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 200 }}
          className="w-full max-w-md"
        >
          <View className="relative overflow-hidden rounded-2xl border border-champagne/20 bg-[rgba(10,10,10,0.98)] p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-rajdhani-semibold text-white tracking-wide">
                Add Holding
              </Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-white/5 items-center justify-center active:bg-white/10"
              >
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-hud mb-3">
                  Select Coin
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {CRYPTO_DATA.map((coin) => (
                    <Pressable
                      key={coin.symbol}
                      onPress={() => setSelectedCoin(coin.symbol)}
                      className={`px-3 py-2 rounded-lg border ${
                        selectedCoin === coin.symbol
                          ? "border-champagne bg-champagne/10"
                          : "border-champagne/20 bg-white/5"
                      }`}
                    >
                      <Text
                        className={`text-xs font-rajdhani-semibold ${
                          selectedCoin === coin.symbol
                            ? "text-champagne"
                            : "text-white/70"
                        }`}
                      >
                        {coin.symbol}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {selectedCoinData && (
                  <Text className="text-xs text-muted-foreground font-rajdhani-medium mt-3">
                    Current price: {formatPrice(selectedCoinData.price)}
                  </Text>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-hud mb-3">
                  Quantity
                </Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="0.00"
                  placeholderTextColor="#ffffff30"
                  keyboardType="decimal-pad"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-champagne/20 text-white font-rajdhani-semibold text-base"
                />
              </View>

              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-rajdhani-medium text-muted-foreground uppercase tracking-hud">
                    Purchase Price (USD)
                  </Text>
                  {selectedCoinData && (
                    <Pressable onPress={handleUseCurrent}>
                      <Text className="text-xs text-champagne font-rajdhani-semibold">
                        Use current
                      </Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder="0.00"
                  placeholderTextColor="#ffffff30"
                  keyboardType="decimal-pad"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-champagne/20 text-white font-rajdhani-semibold text-base"
                />
              </View>

              {totalInvested && (
                <View className="p-3 rounded-xl bg-champagne/5 border border-champagne/20 mb-4">
                  <Text className="text-xs text-muted-foreground font-rajdhani-medium">
                    Total invested
                  </Text>
                  <Text className="text-lg font-rajdhani-semibold text-champagne">
                    ${totalInvested}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={!selectedCoin || !quantity || !purchasePrice}
                className={`w-full py-4 rounded-xl bg-champagne items-center ${
                  !selectedCoin || !quantity || !purchasePrice
                    ? "opacity-50"
                    : "active:opacity-80"
                }`}
              >
                <Text className="font-rajdhani-bold text-base text-[#0A0A0A] tracking uppercase">
                  Add to Portfolio
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};
