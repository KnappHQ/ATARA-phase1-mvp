import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AmountStep } from "../components/send/AmountStep";
import { RecipientStep } from "../components/send/RecipientStep";
import { Contact } from "../stores/useContactStore";
import { COLORS } from "@/utils/constants";

type Step = "recipient" | "amount";

export default function Send() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const prefilledContact: Contact | null = params.contactId
    ? {
        id: params.contactId as string,
        handle: params.contactHandle as string,
        name: params.contactName as string | undefined,
        smartAccountAddress: params.contactSmartAddress as string,
        profilePicUrl: params.contactProfilePic as string | undefined,
      }
    : null;

  const [step, setStep] = useState<Step>(
    prefilledContact ? "amount" : "recipient",
  );
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(
    prefilledContact,
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
