import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";

import { COLORS, NETWORK_NAME } from "@/utils/constants";
import { groupAddress } from "@/utils/paymentReview";
import type { FeeQuote } from "@/utils/feeEstimator";
import { formatLeavesAccount, formatNetworkFee } from "@/utils/networkFee";

interface PaymentReviewProps {
  visible: boolean;
  /** "@handle", a nickname, or a plain description such as "Merchant". */
  recipientLabel: string;
  recipientAddress: string;
  amount: string;
  tokenSymbol: string;
  approxUsd?: string | null;
  note?: string;
  busy: boolean;
  /** The network fee the person pays, in USDC. A payment is never confirmed without a real one. */
  fee: FeeQuote;
  /** Set when the balance cannot cover the amount and the fee: confirming is blocked. */
  fundsMessage?: string | null;
  /** Shown above the buttons, e.g. "The network fee changed. Please check and confirm again." */
  notice?: string | null;
  onRetryFee: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View className="flex-row justify-between gap-4 mt-2">
    <Text className="text-sm text-muted">{label}</Text>
    <Text className={`text-sm text-right flex-1 ${strong ? "font-semibold text-white" : "text-white/80"}`}>
      {value}
    </Text>
  </View>
);

/**
 * The last screen before a payment is signed, for every way of paying.
 *
 * It shows the whole address, what the recipient receives, the network fee
 * and what leaves the account, and what is shared with the recipient. The fee
 * is paid in USDC from the same account and shown before anything is signed.
 * Without a real fee the payment cannot be confirmed: there is no default.
 */
export const PaymentReview = ({
  visible,
  recipientLabel,
  recipientAddress,
  amount,
  tokenSymbol,
  approxUsd,
  note,
  busy,
  fee,
  fundsMessage,
  notice,
  onRetryFee,
  onCancel,
  onConfirm,
}: PaymentReviewProps) => {
  const maxFee = fee.status === "ready" ? fee.maxFee : null;
  const feeText = fee.status === "loading" ? "Estimating…" : formatNetworkFee(maxFee);
  const canConfirm = fee.status === "ready" && !fundsMessage && !busy;
  return (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={() => {
      if (!busy) onCancel();
    }}
  >
    <View className="flex-1 bg-black/75 items-center justify-center px-6">
      <ScrollView
        style={{ width: "100%", maxWidth: 380, maxHeight: "90%" }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      >
        <View className="w-full rounded-3xl border border-white/10 bg-[#111111] p-5">
          <View className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
            <AlertCircle size={18} color={COLORS.white} />
          </View>

          <Text className="text-xl font-semibold text-white mb-2">Review payment</Text>
          <Text className="text-sm leading-6 text-white/65 mb-4">
            Compare the whole address with the one the recipient gave you. A payment cannot be
            reversed once it is signed.
          </Text>

          <View className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 mb-4">
            <Text className="text-xs uppercase tracking-widest text-muted mb-2">Recipient</Text>
            <Text className="text-base font-semibold text-white mb-2">{recipientLabel}</Text>
            <Text
              className="font-mono text-sm leading-6 text-white/80"
              selectable
              accessibilityLabel={`Recipient address ${recipientAddress}`}
            >
              {groupAddress(recipientAddress)}
            </Text>
          </View>

          <View className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
            <Line label="Recipient receives" value={`${amount} ${tokenSymbol}`} strong />
            {!!approxUsd && <Line label="Approx. value" value={approxUsd} />}
            <Line label="Network fee" value={feeText} />
            <Line
              label="Leaves your account"
              value={formatLeavesAccount({ amount, tokenSymbol, maxFee })}
              strong
            />
            <Line label="Network" value={NETWORK_NAME} />
            <Text className="mt-3 text-xs leading-5 text-white/50">Paid in USDC from your balance.</Text>
          </View>

          {(fundsMessage || notice || fee.status === "unavailable") && (
            <View className="rounded-2xl border border-bitcoin/30 bg-bitcoin/10 p-4 mb-4">
              <Text className="text-sm leading-5 text-white/80">
                {fundsMessage ??
                  notice ??
                  "The network fee could not be calculated, so this payment is on hold. Nothing was sent."}
              </Text>
              {fee.status === "unavailable" && (
                <Pressable
                  onPress={onRetryFee}
                  disabled={busy}
                  className="mt-3 self-start rounded-xl border border-white/20 px-4 py-2"
                >
                  <Text className="text-sm font-semibold text-white">Try again</Text>
                </Pressable>
              )}
            </View>
          )}

          <View className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
            <Text className="text-xs uppercase tracking-widest text-muted mb-2">Shared</Text>
            <Text className="text-sm leading-5 text-white/70">
              {note
                ? `Your message “${note}” is stored by ATARA and shown to the recipient if they use ATARA.`
                : "No message. The amount and both addresses are public on the network, as for every payment."}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className="flex-1 items-center justify-center rounded-2xl border border-white/15 py-3"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              <Text className="text-sm font-semibold text-white">Back</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!canConfirm}
              className="flex-1 items-center justify-center rounded-2xl bg-white py-3"
              style={{ opacity: canConfirm ? 1 : 0.4 }}
            >
              <Text className="text-sm font-semibold text-black">Confirm and pay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>
  );
};
