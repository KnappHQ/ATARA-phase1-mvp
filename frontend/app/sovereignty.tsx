import { useRouter } from "expo-router";
import { Linking, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  CheckCircle2,
  Eye,
  ExternalLink,
  Server,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";

import { useAuthStore } from "@/stores/useAuthStore";
import { useAddressVerificationStore } from "@/stores/useAddressVerificationStore";
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

const Limit = ({ children }: { children: React.ReactNode }) => (
  <View className="flex-row gap-3 mt-3">
    <AlertTriangle size={17} color="#fbbf24" />
    <Text className="text-white/65 leading-5 flex-1">{children}</Text>
  </View>
);

const Row = ({ who, sees }: { who: string; sees: string }) => (
  <View className="mt-3">
    <Text className="text-white/85 font-semibold">{who}</Text>
    <Text className="text-white/60 leading-5 mt-1">{sees}</Text>
  </View>
);

const VERIFICATION_TEXT = {
  verified: "Checked on this phone: this address is derived from your own key.",
  mismatch:
    "This address does not match the key on this phone. Do not share it until support has checked your account.",
  unverified: "Not checked yet on this phone.",
} as const;

/**
 * Every sentence on this screen describes what the code does today. The audit
 * behind it, with sources, is docs/CONTROL_PRIVACY_AUDIT.md. Never add
 * "anonymous", "untraceable" or "fully private" here: none of them is true.
 */
export default function SovereigntyScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const verification = useAddressVerificationStore((state) =>
    state.statusFor(user?.smartAccountAddress ?? null),
  );
  const { wallets } = useEmbeddedEthereumWallet();
  const signerAddress = wallets[0]?.address;
  const explorer = user?.smartAccountAddress
    ? `${APP_NETWORK === "base-mainnet" ? "https://basescan.org/address" : "https://sepolia.basescan.org/address"}/${user.smartAccountAddress}`
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 gap-4">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft color="white" />
        </Pressable>
        <Text className="text-white text-xl font-semibold">Your control</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 56 }}>
        <Text className="text-white text-3xl font-semibold leading-9">
          Your money. Your control. Your privacy.
        </Text>
        <Text className="text-white/55 leading-6 mt-3 mb-6">
          What each of these means in this beta, and where it stops.
        </Text>

        <Card>
          <ShieldCheck color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">Who can move your money</Text>
          <Fact>Only a payment you approve on this phone. Your key signs it here.</Fact>
          <Fact>
            ATARA&apos;s servers hold no key and never send a transaction. They cannot move,
            block or reverse your money.
          </Fact>
          <Fact>
            Nobody can give themselves a right to take or freeze your money: the app has no
            automatic debits, spending allowances or added owners.
          </Fact>
          <Fact>
            A group share counts as owed only after you accept it, and only you can pay it.
          </Fact>
          <Fact>
            No AI agent or third party can pay on your behalf. If that ever exists, it will need
            your explicit, limited, dated and revocable permission.
          </Fact>
        </Card>

        <Card>
          <WalletCards color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">Your account on {NETWORK_NAME}</Text>
          {!!user?.smartAccountAddress && (
            <>
              <Text className="text-white/60 mt-3">Receiving address</Text>
              <Text selectable className="text-white/80 font-mono text-xs leading-5 mt-1">
                {user.smartAccountAddress}
              </Text>
              <Text
                className={`text-xs leading-5 mt-2 ${verification === "mismatch" ? "text-red-300" : "text-white/45"}`}
              >
                {VERIFICATION_TEXT[verification]}
              </Text>
            </>
          )}
          {!!signerAddress && (
            <>
              <Text className="text-white/60 mt-4">Your key (owner of the account)</Text>
              <Text selectable className="text-white/80 font-mono text-xs leading-5 mt-1">
                {signerAddress}
              </Text>
            </>
          )}
          {!!explorer && (
            <Pressable onPress={() => Linking.openURL(explorer)} className="flex-row gap-2 mt-4">
              <ExternalLink size={16} color={COLORS.accent} />
              <Text style={{ color: COLORS.accent }}>Check it on BaseScan</Text>
            </Pressable>
          )}
        </Card>

        <Card>
          <Eye color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">Who sees what</Text>
          <Row
            who="Anyone, on the Base network"
            sees="Every payment's amount, date and the two addresses. Not names. This record is permanent."
          />
          <Row
            who="Anyone signed in to ATARA"
            sees="Your @handle, account name, profile picture and receiving address. Knowing your @handle is enough to follow your address on the chain."
          />
          <Row
            who="The person you pay"
            sees="The message and category you attach, if they use ATARA."
          />
          <Row
            who="Whoever has one of your payment links"
            sees="Its amount, note and your receiving address until it is paid or canceled, or a day after it expires."
          />
          <Row
            who="ATARA"
            sees="Your email if you gave one, your contacts, payment history, messages and groups. Not your key."
          />
          <Row
            who="Providers"
            sees="Privy: your sign-in method. Alchemy: your addresses and payments it relays. MoonPay: the delivery address, only if you buy crypto. Sentry: crash reports with an opaque account number, stripped of addresses, handles and emails."
          />
          <Row
            who="Only this phone"
            sees="The nicknames you give to addresses. They are deleted with your account."
          />
          <Text className="text-amber-300/80 text-xs leading-5 mt-4">
            ATARA is not anonymous. It keeps your name off the chain and shares as little as it
            can, but payments on Base are public.
          </Text>
        </Card>

        <Card>
          <Server color="#fbbf24" />
          <Text className="text-white text-lg font-semibold mt-3">If ATARA or a provider stops</Text>
          <Fact>Your money stays on {NETWORK_NAME}, under your key.</Fact>
          <Fact>
            If ATARA&apos;s service is down, the app reads your balance directly from the network
            and can still pay an address. Finding someone by @handle needs the service.
          </Fact>
          <Limit>
            Privy: without it, this app cannot use your key. Signing in again with the same
            passkey or account restores access.
          </Limit>
          <Limit>
            Alchemy: it runs your account and quotes the network fee. You pay a small network fee
            in USDC for each payment, and ATARA shows it before you confirm. If Alchemy stops,
            payments fail until another provider is added.
          </Limit>
          <Limit>
            Your key cannot be exported from this version of the app, so the account cannot yet be
            used from another wallet.
          </Limit>
          <Limit>
            Handles, contacts, history and groups live on ATARA&apos;s servers and stop with them.
          </Limit>
        </Card>

        <Card>
          <Blocks color={COLORS.accent} />
          <Text className="text-white text-lg font-semibold mt-3">What comes next</Text>
          <Fact>A way to use your account from another wallet: a second key you hold, or signing in with your own wallet.</Fact>
          <Fact>Private notes that only you can read.</Fact>
          <Fact>Several network providers, so no single one can stop payments.</Fact>
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
