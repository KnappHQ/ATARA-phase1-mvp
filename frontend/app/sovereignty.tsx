import { useRouter } from "expo-router";
import { Linking, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import {
  ArrowLeft,
  Blocks,
  CheckCircle2,
  ExternalLink,
  Server,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";

import { useAuthStore } from "@/stores/useAuthStore";
import { APP_NETWORK, COLORS, NETWORK_NAME } from "@/utils/constants";

const SOURCE_URL = process.env.EXPO_PUBLIC_SOURCE_URL?.trim();

const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="rounded-3xl border border-white/10 bg-white/5 p-5 mb-4">
    {children}
  </View>
);

const Fact = ({ children }: { children: React.ReactNode }) => (
  <View className="flex-row gap-3 mt-3">
    <CheckCircle2 size={17} color={COLORS.accent} />
    <Text className="text-white/65 leading-5 flex-1">{children}</Text>
  </View>
);

export default function SovereigntyScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const explorer = user?.smartAccountAddress
    ? `${APP_NETWORK === "base-mainnet" ? "https://basescan.org/address" : "https://sepolia.basescan.org/address"}/${user.smartAccountAddress}`
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 gap-4">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft color="white" />
        </Pressable>
        <Text className="text-white text-xl font-semibold">Your sovereignty</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 56 }}>
        <Text className="text-white text-3xl font-semibold leading-9">
          Control is a property, not a slogan.
        </Text>
        <Text className="text-white/55 leading-6 mt-3 mb-6">
          ATARA separates the wallet you authorize from the social features the app operates.
          This page shows the current beta architecture without calling every part decentralized.
        </Text>

        <Card>
          <WalletCards color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">Your on-chain account</Text>
          <Text className="text-white/60 leading-5 mt-2">
            Payments use a smart account on {NETWORK_NAME}. The ATARA API does not hold a
            signing key that can independently authorize a payment.
          </Text>
          {!!user?.smartAccountAddress && (
            <Text selectable className="text-white/45 font-mono text-xs leading-5 mt-4">
              {user.smartAccountAddress}
            </Text>
          )}
          {!!explorer && (
            <Pressable onPress={() => Linking.openURL(explorer)} className="flex-row gap-2 mt-4">
              <ExternalLink size={16} color={COLORS.accent} />
              <Text style={{ color: COLORS.accent }}>Verify on BaseScan</Text>
            </Pressable>
          )}
        </Card>

        <Card>
          <ShieldCheck color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">What ATARA cannot do alone</Text>
          <Fact>Sign a payment without approval from your configured signer.</Fact>
          <Fact>Rewrite or delete a confirmed public blockchain transaction.</Fact>
          <Fact>Recover a wallet from an old ATARA demo code or ask support for a seed phrase.</Fact>
        </Card>

        <Card>
          <Server color="#fbbf24" />
          <Text className="text-white text-lg font-semibold mt-3">What is still centralized</Text>
          <Text className="text-white/60 leading-5 mt-2">
            Handles, contacts, notifications, group metadata and sessions use the ATARA API and
            database. Embedded keys/passkeys use Privy. Smart-account creation, RPC and sponsored
            gas currently use Alchemy. External wallet discovery uses Reown when enabled.
          </Text>
          <Text className="text-amber-300/80 text-xs leading-5 mt-4">
            If these services are unavailable, the social interface may stop working even though
            confirmed assets and transactions remain on the blockchain.
          </Text>
        </Card>

        <Card>
          <Blocks color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">Path to credible decentralization</Text>
          <Fact>Passkey-first access and wallet-only sign-in, with social login kept optional.</Fact>
          <Fact>User-paid gas fallback when sponsored gas is unavailable, so a paymaster is not the only transaction route.</Fact>
          <Fact>Portable recovery and signer migration before real-value launch.</Fact>
          <Fact>Multiple RPC/bundler providers and an exportable, self-hostable social layer.</Fact>
          <Fact>Public source code, reproducible builds and independent security review.</Fact>
          {SOURCE_URL ? (
            <Pressable onPress={() => Linking.openURL(SOURCE_URL)} className="flex-row gap-2 mt-5">
              <ExternalLink size={16} color={COLORS.accent} />
              <Text style={{ color: COLORS.accent }}>View the source code</Text>
            </Pressable>
          ) : (
            <Text className="text-white/40 text-xs leading-5 mt-4">
              Source publication is being prepared. ATARA will not claim “open source” until a
              license, public repository and contribution/security policies are published.
            </Text>
          )}
        </Card>

        {APP_NETWORK !== "base-mainnet" && (
          <View className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
            <Text className="text-amber-200 font-semibold">Test network</Text>
            <Text className="text-amber-100/70 text-sm leading-5 mt-1">
              This beta uses Base Sepolia and test assets. Do not treat displayed balances as real money.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

