import { useRouter } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AmountStep } from "../components/send/AmountStep";
import { RecipientStep } from "../components/send/RecipientStep";
import { COLORS } from "@/utils/constants";

type Step = "recipient" | "amount";

// Dummy contacts data
export const DUMMY_CONTACTS = [
  { id: "1", name: "Alex Chen", handle: "@alexc", avatar: "AC" },
  { id: "2", name: "Maria Silva", handle: "@msilva", avatar: "MS" },
  { id: "3", name: "John Doe", handle: "@johnd", avatar: "JD" },
  { id: "4", name: "Sarah Kim", handle: "@sarahk", avatar: "SK" },
  { id: "5", name: "Marcus Johnson", handle: "@marcusj", avatar: "MJ" },
];

// Dummy coins data
export const DUMMY_COINS = [
  { symbol: "ETH", name: "Ethereum", balance: "4.2", value: "$9,870" },
  { symbol: "USDT", name: "Tether USD", balance: "2,500.00", value: "$2,500" },
];

export interface Contact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export default function Send() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("recipient");
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(
    null,
  );

  const handleBack = () => {
    if (step === "recipient") {
      router.back();
    } else if (step === "amount") {
      setStep("recipient");
      setSelectedRecipient(null);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleSelectRecipient = (contact: Contact) => {
    setSelectedRecipient(contact);
    setStep("amount");
  };

  const getHeaderTitle = () => {
    switch (step) {
      case "recipient":
        return "Send To";
      case "amount":
        return "Enter Amount";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View
        className="flex-row items-center justify-between px-6 py-4"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="w-12 h-12 rounded-full items-center justify-center active:opacity-70"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <ArrowLeft size={20} color={COLORS.white} />
          </Pressable>
          <Text
            className="text-xl font-semibold"
            style={{ color: COLORS.white }}
          >
            {getHeaderTitle()}
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          className="w-12 h-12 rounded-full items-center justify-center active:opacity-70"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <X size={20} color={COLORS.white} />
        </Pressable>
      </View>

      <View className="flex-1">
        {step === "recipient" && (
          <RecipientStep onSelectRecipient={handleSelectRecipient} />
        )}
        {step === "amount" && selectedRecipient && (
          <AmountStep recipient={selectedRecipient} />
        )}
      </View>
    </SafeAreaView>
  );
}
