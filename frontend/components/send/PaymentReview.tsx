import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";

import { COLORS, NETWORK_NAME } from "@/utils/constants";
import { groupAddress } from "@/utils/paymentReview";

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
 * is sponsored in this build: when sponsorship is unavailable the payment is
 * refused rather than charged.
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
  onCancel,
  onConfirm,
}: PaymentReviewProps) => (
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
            <Line label="Network fee" value="0, paid by ATARA while sponsorship is available" />
            <Line label="Leaves your account" value={`${amount} ${tokenSymbol}`} strong />
            <Line label="Network" value={NETWORK_NAME} />
          </View>

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
              disabled={busy}
              className="flex-1 items-center justify-center rounded-2xl bg-white py-3"
              style={{ opacity: busy ? 0.7 : 1 }}
            >
              <Text className="text-sm font-semibold text-black">Confirm and pay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>
);
