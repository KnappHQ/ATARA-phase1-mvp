import { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { AlertCircle } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SwipeToSend } from "./SwipeToSend";
import { BalanceLoader } from "./BalanceLoader";
import { Contact } from "@/stores/useContactStore";
import { useWalletStore, Token } from "@/stores/useWalletStore";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import {
  useTransactionService,
  SendTransactionRequest,
} from "@/services/transaction.service";
import { GroupService } from "@/services/group.service";
import { analyticsEvents } from "@/services/analytics.service";
import { COLORS } from "@/utils/constants";
import {
  formatTokenAmount,
  formatCurrency,
  calculatePercentageAmount,
  validateBalance,
  parseAmount,
} from "@/utils/format";

interface AmountStepProps {
  recipient: Contact;
  onTransactionStateChange?: (inProgress: boolean) => void;
}

const QUICK_AMOUNTS = ["25%", "50%", "75%", "MAX"];
const STANDARD_GAS_DISPLAY = "0.0002";

export const AmountStep = ({
  recipient,
  onTransactionStateChange,
}: AmountStepProps) => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Settlement metadata — set when navigated from the Settle button
  const settlementGroupId = (params.settlementGroupId as string) || null;
  const settlementMemberId = (params.settlementMemberId as string) || null;
  // prefilledAmount is always a USD value when coming from the settle flow
  const settlementUsdAmount = params.prefilledAmount
    ? parseFloat(params.prefilledAmount as string)
    : null;
  const prefilledNote = (params.prefilledNote as string) || "";

  const { user } = useAuthStore();
  const { assets, isLoadingBalances, refreshBalances, getAssetBySymbol } =
    useWalletStore();
  const {
    isLoading: isTransactionLoading,
    error: transactionError,
    clearError,
  } = useTransactionStore();

  const smartAccountService = useSmartAccountService();
  const transactionService = useTransactionService(smartAccountService);

  const defaultToken =
    assets.find((asset) => asset.symbol === "USDC") ?? assets[0];

  const usdToTokenAmount = (usdAmt: number, token: Token): string => {
    if (!token.usdPrice || token.usdPrice <= 0) return usdAmt.toFixed(2);
    const tokenAmt = usdAmt / token.usdPrice;
    // High-value (ETH): 6dp. Stablecoins: 4dp to preserve sub-cent precision.
    const decimals = token.usdPrice > 10 ? 6 : 4;
    return tokenAmt.toFixed(decimals);
  };

  const [amount, setAmount] = useState(() =>
    settlementUsdAmount !== null && defaultToken
      ? usdToTokenAmount(settlementUsdAmount, defaultToken)
      : "",
  );
  const [note, setNote] = useState(prefilledNote);
  const [selectedToken, setSelectedToken] = useState<Token>(defaultToken);
  const [isSending, setIsSending] = useState(false);
  const [pendingRetryRequest, setPendingRetryRequest] =
    useState<SendTransactionRequest | null>(null);
  const [isRetryingWithGas, setIsRetryingWithGas] = useState(false);
  const [canRetryWithGas, setCanRetryWithGas] = useState(false);
  const [isGasDialogOpen, setIsGasDialogOpen] = useState(false);
  const [isAddressReviewOpen, setIsAddressReviewOpen] = useState(false);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const isTransactionInProgress =
    isSending || isRetryingWithGas || isTransactionLoading;

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const handleAmountChange = (text: string) => {
    if (isTransactionInProgress) return;

    const cleanText = text.replace(/[^0-9.]/g, "");

    const parts = cleanText.split(".");
    if (parts.length <= 2) {
      const formatted =
        parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
      setAmount(formatted);
    }
  };

  useEffect(() => {
    if (user?.smartAccountAddress) {
      refreshBalances();
    }
  }, [user]);

  useEffect(() => {
    const updatedToken = getAssetBySymbol(selectedToken.symbol);
    if (updatedToken) {
      setSelectedToken(updatedToken);
      // Recompute crypto amount when fresh prices arrive for a settlement prefill
      if (settlementUsdAmount !== null) {
        setAmount(usdToTokenAmount(settlementUsdAmount, updatedToken));
      }
    }
  }, [assets]);

  const currentBalance = parseAmount(selectedToken.balance);
  const amountValue = parseAmount(amount);
  const balanceValidation = validateBalance(amountValue, currentBalance);

  useEffect(() => {
    onTransactionStateChange?.(isTransactionInProgress);
  }, [isTransactionInProgress, onTransactionStateChange]);

  useEffect(() => {
    return () => {
      onTransactionStateChange?.(false);
    };
  }, [onTransactionStateChange]);

  const handleQuickAmount = (percentage: string) => {
    if (isTransactionInProgress || isLoadingBalances) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const calculatedAmount = calculatePercentageAmount(
      percentage,
      currentBalance,
    );
    setAmount(calculatedAmount.toString());
  };

  /** When user manually switches token in a settlement flow, convert to new token units */
  const handleTokenSelect = (token: Token) => {
    if (isTransactionInProgress || isLoadingBalances) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const asset = getAssetBySymbol(token.symbol);
    if (!asset) return;
    setSelectedToken(asset);
    if (settlementUsdAmount !== null) {
      setAmount(usdToTokenAmount(settlementUsdAmount, asset));
    }
  };

  const isValidAmount = amountValue > 0 && balanceValidation.isValid;
  const canSend =
    isValidAmount &&
    !isTransactionInProgress &&
    smartAccountService &&
    transactionService;

  const buildTransactionRequest = (
    forceGasPayment = false,
  ): SendTransactionRequest => ({
    recipientAddress: recipient.smartAccountAddress!!,
    recipientHandle: recipient.handle,
    recipientName: recipient.name,
    amount: amountValue.toString(),
    tokenSymbol: selectedToken.symbol,
    tokenAddress: selectedToken.contractAddress,
    decimals: selectedToken.decimals,
    usdValue:
      selectedToken.usdPrice > 0
        ? `$${(amountValue * selectedToken.usdPrice).toFixed(2)}`
        : selectedToken.usdValue,
    note: note || undefined,
    forceGasPayment,
    onSynced:
      settlementGroupId && settlementMemberId
        ? (txId) =>
            GroupService.settleByInternalTx(
              settlementGroupId,
              settlementMemberId,
              txId,
            ).catch((err) =>
              console.warn("Settlement sync failed (non-blocking):", err),
            )
        : undefined,
  });

  const handleSendComplete = () => {
    if (!canSend || isTransactionInProgress) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAddressReviewOpen(true);
  };

  const closeAddressReview = () => {
    if (isTransactionInProgress) return;

    setIsAddressReviewOpen(false);
    setSwipeResetKey((key) => key + 1);
  };

  const handleConfirmAddressAndSend = async () => {
    if (!canSend || isTransactionInProgress) return;

    setIsAddressReviewOpen(false);
    clearError();
    setIsSending(true);
    setCanRetryWithGas(false);
    setIsGasDialogOpen(false);

    try {
      const transactionRequest = buildTransactionRequest();
      setPendingRetryRequest(transactionRequest);

      const result =
        await transactionService.sendTransaction(transactionRequest);

      if (result.success) {
        setPendingRetryRequest(null);
        analyticsEvents.transactionSent({
          token: selectedToken.symbol,
          amountUsd:
            selectedToken.usdPrice > 0
              ? amountValue * selectedToken.usdPrice
              : amountValue,
          isInApp: true,
          hasNote: !!note,
          isSettlement: !!settlementGroupId,
        });
        router.push({
          pathname: "/transaction-success",
          params: {
            transactionId: result.transactionId,
            hash: result.hash || "",
            recipient: recipient.handle,
            amount: amountValue.toString(),
            token: selectedToken.symbol,
            gasPaidDisplay: "0.00",
          },
        });
      } else {
        setPendingRetryRequest({
          ...transactionRequest,
          transactionId: result.transactionId,
        });
        setCanRetryWithGas(!!result.isPaymasterFailure);
        setIsGasDialogOpen(!!result.isPaymasterFailure);
        throw new Error(result.error || "Transaction failed");
      }
    } catch (error: any) {
      analyticsEvents.transactionFailed({
        token: selectedToken.symbol,
        errorMessage: error?.message ?? "unknown error",
      });
      setSwipeResetKey((key) => key + 1);
      // Error is stored in transaction store
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryWithGas = async () => {
    if (
      isTransactionInProgress ||
      !transactionService ||
      !pendingRetryRequest
    ) {
      return;
    }

    clearError();
    setIsGasDialogOpen(false);
    setIsRetryingWithGas(true);

    try {
      const result = await transactionService.sendTransaction({
        ...pendingRetryRequest,
        forceGasPayment: true,
        transactionId: pendingRetryRequest.transactionId,
      });

      if (!result.success) {
        throw new Error(result.error || "Gas-funded retry failed");
      }

      setPendingRetryRequest(null);
      setCanRetryWithGas(false);

      analyticsEvents.transactionSent({
        token: selectedToken.symbol,
        amountUsd:
          selectedToken.usdPrice > 0
            ? amountValue * selectedToken.usdPrice
            : amountValue,
        isInApp: true,
        hasNote: !!note,
        isSettlement: !!settlementGroupId,
      });

      router.push({
        pathname: "/transaction-success",
        params: {
          transactionId: result.transactionId,
          hash: result.hash || "",
          recipient: recipient.handle,
          amount: amountValue.toString(),
          token: selectedToken.symbol,
          gasPaidDisplay: STANDARD_GAS_DISPLAY,
        },
      });
    } finally {
      setIsRetryingWithGas(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
    >
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400 }}
        className="mb-6"
      >
        <View
          className="flex-row items-center gap-3 p-3 rounded-2xl border border-white/20"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        >
          <View className="w-10 h-10 rounded-full items-center justify-center bg-white/10">
            <Text className="text-xs font-bold text-white">
              {recipient.name
                ? recipient.name.slice(0, 2).toUpperCase()
                : recipient.handle.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-base font-medium text-white">
              @{recipient.handle}
            </Text>
            <Text className="text-sm text-white/50">
              {truncateAddress(recipient.smartAccountAddress)}
            </Text>
          </View>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 100 }}
        className="mb-6"
      >
        <Text className="text-sm font-medium uppercase mb-3 text-muted tracking-widest">
          Select Asset
        </Text>
        {isLoadingBalances ? (
          <View className="flex-row gap-2">
            {[1, 2].map((i) => (
              <View
                key={i}
                className="px-5 py-3 rounded-2xl border border-white/10 flex-row items-center justify-center"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
              >
                <BalanceLoader width={40} height={16} />
              </View>
            ))}
          </View>
        ) : assets.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {assets.map((token) => (
              <Pressable
                key={token.symbol}
                onPress={() => handleTokenSelect(token)}
                disabled={isTransactionInProgress}
                className="px-5 py-3 rounded-2xl active:opacity-80"
                style={{
                  backgroundColor:
                    selectedToken.symbol === token.symbol
                      ? COLORS.white
                      : "rgba(255, 255, 255, 0.03)",
                  borderWidth: 1,
                  borderColor:
                    selectedToken.symbol === token.symbol
                      ? COLORS.white
                      : "rgba(255, 255, 255, 0.1)",
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color:
                      selectedToken.symbol === token.symbol
                        ? COLORS.black
                        : COLORS.white,
                  }}
                >
                  {token.symbol}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View className="flex-row items-center justify-center py-6 px-4 rounded-2xl border border-white/10 bg-white/5">
            <Text className="text-center text-muted">Loading assets...</Text>
          </View>
        )}
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 200 }}
        className="items-center mb-6"
      >
        <View className="relative inline-block">
          <TextInput
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            placeholderTextColor="rgba(255, 255, 255, 0.2)"
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={15}
            editable={!isTransactionInProgress}
            className="text-5xl font-light text-center w-full"
            style={{
              maxWidth: 200,
              color: COLORS.white,
            }}
          />
        </View>
        {isLoadingBalances ? (
          <View className="flex-row items-center justify-center gap-2 mt-2">
            <BalanceLoader width={80} height={16} />
            <Text className="text-base text-muted"> · Balance: </Text>
            <BalanceLoader width={60} height={16} />
          </View>
        ) : (
          <>
            <Text className="text-base mt-2 text-muted">
              {formatTokenAmount(
                parseAmount(selectedToken.balance),
                selectedToken.symbol,
              )}{" "}
              · Balance:{" "}
              {formatCurrency(
                parseAmount(selectedToken.usdValue.replace(/[$,]/g, "")),
              )}
            </Text>
            {amountValue > 0 && selectedToken.usdPrice > 0 && (
              <Text
                className="text-xs font-mono mt-1"
                style={{ color: `${COLORS.white}50` }}
              >
                ≈ $
                {(amountValue * selectedToken.usdPrice).toFixed(
                  selectedToken.usdPrice > 10 ? 2 : 4,
                )}{" "}
                USD
              </Text>
            )}
          </>
        )}
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 300 }}
        className="flex-row gap-2 justify-center mb-6"
      >
        {QUICK_AMOUNTS.map((pct) => (
          <Pressable
            key={pct}
            onPress={() => handleQuickAmount(pct)}
            disabled={isLoadingBalances || isTransactionInProgress}
            className="px-4 py-2 rounded-2xl active:opacity-70 border border-muted/40"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              opacity: isLoadingBalances || isTransactionInProgress ? 0.5 : 1,
            }}
          >
            <Text className="text-xs font-medium text-muted">{pct}</Text>
          </Pressable>
        ))}
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 400 }}
        className="mb-6"
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={COLORS.muted}
          editable={!isTransactionInProgress}
          className="w-full px-4 py-4 rounded-2xl text-base text-primary border border-muted/40"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            opacity: isTransactionInProgress ? 0.55 : 1,
          }}
        />
      </MotiView>

      {transactionError && !isGasDialogOpen && !canRetryWithGas && (
        <MotiView
          from={{ opacity: 0, translateY: -5 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mb-4 p-3 rounded-2xl bg-bitcoin/10 border border-bitcoin/30"
        >
          <View className="flex-row items-start gap-2">
            <AlertCircle size={16} color={COLORS.bitcoinOrange} />
            <Text className="text-sm text-bitcoin flex-1">
              {transactionError}
            </Text>
          </View>
          {canRetryWithGas && pendingRetryRequest && (
            <Pressable
              onPress={handleRetryWithGas}
              disabled={isTransactionInProgress}
              className="mt-3 self-start px-4 py-2 rounded-2xl bg-white"
              style={{ opacity: isTransactionInProgress ? 0.7 : 1 }}
            >
              <Text className="text-sm font-semibold text-black">
                {isRetryingWithGas ? "Retrying..." : "Send with gas"}
              </Text>
            </Pressable>
          )}
        </MotiView>
      )}

      <Modal
        visible={isAddressReviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isTransactionInProgress) {
            closeAddressReview();
          }
        }}
      >
        <View className="flex-1 bg-black/75 items-center justify-center px-6">
          <View className="w-full max-w-[360px] rounded-3xl border border-white/10 bg-[#111111] p-5">
            <View className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <AlertCircle size={18} color={COLORS.white} />
            </View>

            <Text className="text-xl font-semibold text-white mb-2">
              Review recipient
            </Text>
            <Text className="text-sm leading-6 text-white/65 mb-4">
              Check this address carefully before transferring any funds.
              Transfers cannot be reversed after signing.
            </Text>

            <View className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 mb-4">
              <Text className="text-xs uppercase tracking-widest text-muted mb-2">
                Recipient
              </Text>
              <Text className="text-base font-semibold text-white mb-2">
                @{recipient.handle}
              </Text>
              <Text
                className="font-mono text-sm text-white/70"
                selectable
                numberOfLines={1}
              >
                {recipient.smartAccountAddress}
              </Text>
            </View>

            <View className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
              <View className="flex-row justify-between gap-4">
                <Text className="text-sm text-muted">Amount</Text>
                <Text className="text-sm font-semibold text-white">
                  {amountValue.toString()} {selectedToken.symbol}
                </Text>
              </View>
              {selectedToken.usdPrice > 0 && (
                <View className="mt-2 flex-row justify-between gap-4">
                  <Text className="text-sm text-muted">Approx. value</Text>
                  <Text className="text-sm font-semibold text-white">
                    ${(amountValue * selectedToken.usdPrice).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={closeAddressReview}
                disabled={isTransactionInProgress}
                className="flex-1 items-center justify-center rounded-2xl border border-white/15 py-3"
                style={{ opacity: isTransactionInProgress ? 0.6 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">
                  Review again
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmAddressAndSend}
                disabled={isTransactionInProgress}
                className="flex-1 items-center justify-center rounded-2xl bg-white py-3"
                style={{ opacity: isTransactionInProgress ? 0.7 : 1 }}
              >
                <Text className="text-sm font-semibold text-black">
                  Confirm send
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isGasDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isTransactionInProgress) return;

          setIsGasDialogOpen(false);
          setCanRetryWithGas(false);
          setPendingRetryRequest(null);
          clearError();
        }}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-6">
          <View className="w-full max-w-[340px] rounded-3xl border border-white/10 bg-[#111111] p-5">
            <Text className="text-lg font-semibold text-white mb-2">
              Paymaster limit reached
            </Text>
            <Text className="text-sm leading-6 text-white/70 mb-4">
              {transactionError ||
                "The gas sponsor could not cover this transaction right now."}
            </Text>
            <View className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
              <Text className="text-xs uppercase tracking-widest text-muted mb-1">
                Continue with gas
              </Text>
              <Text className="text-base font-medium text-white">
                Estimated fee: ~{STANDARD_GAS_DISPLAY} ETH
              </Text>
              <Text className="text-xs text-white/50 mt-1">
                You will approve a self-funded transaction instead of a
                sponsored one.
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  if (isTransactionInProgress) return;

                  setIsGasDialogOpen(false);
                  setCanRetryWithGas(false);
                  setPendingRetryRequest(null);
                  clearError();
                }}
                disabled={isTransactionInProgress}
                className="flex-1 items-center justify-center rounded-2xl border border-white/15 py-3"
                style={{ opacity: isTransactionInProgress ? 0.6 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">
                  Not now
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRetryWithGas}
                disabled={isTransactionInProgress}
                className="flex-1 items-center justify-center rounded-2xl bg-white py-3"
                style={{ opacity: isTransactionInProgress ? 0.7 : 1 }}
              >
                <Text className="text-sm font-semibold text-black">
                  {isRetryingWithGas ? "Sending..." : "Continue with gas"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {!balanceValidation.isValid && amountValue > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: -5 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="flex-row items-center justify-center gap-2 mb-4 p-3 rounded-2xl bg-bitcoin/10 border border-bitcoin/30"
        >
          <AlertCircle size={16} color={COLORS.bitcoinOrange} />
          <Text className="text-sm text-bitcoin">
            {balanceValidation.message}
          </Text>
        </MotiView>
      )}

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 500 }}
        className="flex-row items-center justify-center gap-2 mb-6 py-2"
      >
        <View className="w-2 h-2 rounded-full bg-emarald" />
        <Text className="text-sm text-muted mr-4">Base Network</Text>

        <Text className="text-sm text-muted">Network Fee:</Text>
        <View className="px-2.5 py-1 rounded-full bg-emarald/10 border border-emarald/20">
          <Text className="text-xs font-medium text-emarald">$0.00</Text>
        </View>
      </MotiView>

      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "timing", duration: 400, delay: 600 }}
      >
        <SwipeToSend
          onComplete={handleSendComplete}
          disabled={!canSend || isLoadingBalances}
          resetKey={swipeResetKey}
          label={
            isSending || isRetryingWithGas
              ? "Sending Transaction..."
              : !smartAccountService
                ? "Wallet Not Connected"
                : isLoadingBalances
                  ? "Loading Balances..."
                  : !balanceValidation.isValid && amountValue > 0
                    ? balanceValidation.message
                    : "Swipe to Send"
          }
        />
      </MotiView>
    </ScrollView>
  );
};
