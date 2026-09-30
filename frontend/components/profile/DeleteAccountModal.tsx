import { Text, View } from "react-native";

import { ConfirmSheet } from "@/components/accounts/ConfirmSheet";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { useAuthStore } from "@/stores/useAuthStore";
import { shortAddress } from "@/utils/accountLabels";
import { useUnsettledPayments } from "@/hooks/useUnsettledPayments";
import { useWalletStore } from "@/stores/useWalletStore";
import { summarize, warningFor } from "@/utils/unsettledPayments";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Point = ({ children }: { children: React.ReactNode }) => (
  <View className="mb-2 flex-row gap-2">
    <Text className="text-sm leading-5 text-white/40">•</Text>
    <Text className="flex-1 text-sm leading-5 text-white/65">{children}</Text>
  </View>
);

const Heading = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-3 text-xs font-semibold uppercase tracking-[1.5px] text-white/40">{children}</Text>
);

/**
 * Deleting the ATARA account. It says what is deleted, and what is not: the
 * money stays where it is, and so do the passkeys and the wallet behind them.
 */
export const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
  const { funds, deleteAccount } = useAccountDeletion();
  const address = useAuthStore((state) => state.user?.smartAccountAddress);
  const where = address ? shortAddress(address) : "your wallet address";
  const assets = useWalletStore((state) => state.assets);
  const { byAccount } = useUnsettledPayments();
  const unsettled = summarize(address ? byAccount[address.toLowerCase()] : undefined, assets);
  const unsettledLines = unsettled ? warningFor("delete", unsettled) : [];

  const fundsAcknowledgement =
    funds.status === "funds"
      ? `I hold ${funds.summary}. It stays at ${where}, and I need my passkey or my Google/Apple sign-in to reach it again.`
      : funds.status === "unknown"
        ? `ATARA cannot read my balance right now. Any funds stay at ${where}, and I need my passkey or my Google/Apple sign-in to reach them again.`
        : undefined;
  // A payment still unproven, or not yet recorded, is a reason to stop and check first.
  const acknowledgement = unsettled
    ? [fundsAcknowledgement, "I have a payment that is not settled, and I understand it stays on the network whatever happens to this profile."]
        .filter(Boolean)
        .join(" ")
    : fundsAcknowledgement;

  return (
    <ConfirmSheet
      isOpen={isOpen}
      title="Delete your ATARA account?"
      destructive
      confirmLabel="Delete my ATARA account"
      typedConfirmation="DELETE"
      acknowledgement={acknowledgement}
      onCancel={onClose}
      onConfirm={async () => {
        await deleteAccount();
        onClose();
      }}
    >
      {unsettledLines.length > 0 ? (
        <>
          <Heading>A payment is not settled</Heading>
          {unsettledLines.map((line) => (
            <Point key={line}>{line}</Point>
          ))}
        </>
      ) : null}

      <Heading>What is deleted</Heading>
      <Point>Your profile: your @handle is released and your name, email and picture are removed from ATARA.</Point>
      <Point>Payment requests you created that nobody paid, and settlements not yet completed, are cancelled.</Point>
      <Point>You are signed out here and on every other device.</Point>

      <Heading>What stays</Heading>
      <Point>
        Your money. It is on the Base network at {where}, and deleting a profile does not move or destroy it.
      </Point>
      <Point>
        Shared expenses, debts and payment receipts stay for the other members under “Deleted account”. Blockchain
        records cannot be erased.
      </Point>
      <Point>
        Your passkeys and your wallet. ATARA does not delete them, and iOS keeps its passkeys. Signing in again with
        the same passkey, Google or Apple lets you set up a new profile for the same wallet.
      </Point>

      <Heading>Before you go</Heading>
      <Point>
        Do not delete your passkeys in Settings › Passwords unless your funds have been moved. Without a way to sign
        in, nobody, including ATARA, can recover them.
      </Point>
    </ConfirmSheet>
  );
};
