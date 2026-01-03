import { useRouter } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AmountStep } from "../components/send/AmountStep";
import { ConfirmStep } from "../components/send/ConfirmStep";
import { RecipientStep } from "../components/send/RecipientStep";

type Step = "recipient" | "amount" | "confirm";

interface Contact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

interface QuickContact {
  id: string;
  name: string;
  avatar: string;
  gradientColors: [string, string];
}

interface Coin {
  symbol: string;
  name: string;
  balance: string;
  value: string;
}

const quickContacts: QuickContact[] = [
  {
    id: "1",
    name: "Alex",
    avatar: "AC",
    gradientColors: ["#8B5CF6", "#7C3AED"],
  },
  {
    id: "2",
    name: "Maria",
    avatar: "MS",
    gradientColors: ["#F43F5E", "#EC4899"],
  },
  {
    id: "3",
    name: "John",
    avatar: "JD",
    gradientColors: ["#F59E0B", "#F97316"],
  },
  {
    id: "4",
    name: "Sarah",
    avatar: "SK",
    gradientColors: ["#10B981", "#059669"],
  },
  {
    id: "5",
    name: "Marcus",
    avatar: "MJ",
    gradientColors: ["#3B82F6", "#6366F1"],
  },
];

const contacts: Contact[] = [
  { id: "1", name: "Alex Chen", handle: "@alexc", avatar: "AC" },
  { id: "2", name: "Maria Silva", handle: "@msilva", avatar: "MS" },
  { id: "3", name: "John Doe", handle: "@johnd", avatar: "JD" },
  { id: "4", name: "Sarah Kim", handle: "@sarahk", avatar: "SK" },
  { id: "5", name: "Marcus Johnson", handle: "@marcusj", avatar: "MJ" },
];

const coins: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", balance: "0.5421", value: "$23,450" },
  { symbol: "ETH", name: "Ethereum", balance: "4.2", value: "$9,870" },
  { symbol: "SOL", name: "Solana", balance: "125.5", value: "$2,510" },
];

export default function Send() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("recipient");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(
    null
  );
  const [selectedCoin, setSelectedCoin] = useState(coins[0]);
  const [amount, setAmount] = useState("");

  const getHeaderTitle = () => {
    switch (step) {
      case "recipient":
        return "Send To";
      case "amount":
        return "Enter Amount";
      case "confirm":
        return "Confirm";
    }
  };

  const handleBack = () => {
    if (step === "recipient") {
      router.back();
    } else if (step === "amount") {
      setStep("recipient");
    } else if (step === "confirm") {
      setStep("amount");
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedRecipient(contact);
    setStep("amount");
  };

  const handleQuickContact = (quick: QuickContact) => {
    const fullContact = contacts.find((c) => c.id === quick.id);
    if (fullContact) {
      handleSelectContact(fullContact);
    }
  };

  const handleAstraDrop = () => {
    console.log("Astrâ Drop activated - Finding nearby users...");
  };

  const handleAmountContinue = () => {
    if (amount && parseFloat(amount) > 0) {
      setStep("confirm");
    }
  };

  const handleConfirm = () => {
    console.log("Transaction confirmed:", {
      recipient: selectedRecipient,
      amount,
      coin: selectedCoin.symbol,
    });

    // Navigate to success screen with transaction data
    router.replace({
      pathname: "/transaction-success",
      params: {
        amount,
        coin: selectedCoin.symbol,
        recipientName: selectedRecipient?.name || "",
        recipientHandle: selectedRecipient?.handle || "",
        recipientAvatar: selectedRecipient?.avatar || "",
        usdValue: `$${(parseFloat(amount) * parseFloat(selectedCoin.value.replace(/,/g, ""))).toLocaleString()}`,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 py-6 border-b border-champagne/10">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="w-12 h-12 rounded-full bg-ceramic items-center justify-center active:opacity-80 border border-champagne/10"
          >
            <ArrowLeft size={20} color="#FFE666" />
          </Pressable>
          <Text className="text-xl font-rajdhani-semibold text-foreground tracking-wide">
            {getHeaderTitle()}
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          className="w-12 h-12 rounded-full bg-ceramic items-center justify-center active:opacity-80 border border-champagne/10"
        >
          <X size={20} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>
      </View>

      {step === "recipient" && (
        <RecipientStep
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          quickContacts={quickContacts}
          contacts={contacts}
          onSelectContact={handleSelectContact}
          onQuickContactPress={handleQuickContact}
          onAstraDropPress={handleAstraDrop}
        />
      )}

      {step === "amount" && selectedRecipient && (
        <AmountStep
          recipient={selectedRecipient}
          coins={coins}
          selectedCoin={selectedCoin}
          amount={amount}
          onSelectCoin={setSelectedCoin}
          onAmountChange={setAmount}
          onContinue={handleAmountContinue}
        />
      )}

      {step === "confirm" && selectedRecipient && (
        <ConfirmStep
          recipient={selectedRecipient}
          selectedCoin={selectedCoin}
          amount={amount}
          onConfirm={handleConfirm}
        />
      )}
    </SafeAreaView>
  );
}
