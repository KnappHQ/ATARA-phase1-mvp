import { useState, useEffect } from "react";
import {
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
import { PaymentReview } from "./PaymentReview";
import { Contact } from "@/stores/useContactStore";
import { useWalletStore, Token } from "@/stores/useWalletStore";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSmartAccountService } from "@/services/smartAccount.service";
import {
  useTransactionService,
  SendTransactionRequest,
} from "@/services/transaction.service";
import { useAlertStore } from "@/stores/useAlertStore";
import { useNetworkFee } from "@/hooks/useNetworkFee";
import {
  FEE_TOKEN_SYMBOL,
  assessSend,
  assetBaseUnits,
  formatNetworkFee,
  formatUnits,
  formatUsdc,
  maxSendable,
  parseUnits,
} from "@/utils/networkFee";
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

export const AmountStep = ({
  recipient,
  onTransactionStateChange,
}: AmountStepProps) => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Settlement metadata — set when navigated from the Settle button
  const settlementGroupId = (params.settlementGroupId as string) || null;
  const settlementMemberId = (params.settlementMemberId as string) || null;
  const settlementIntentId = (params.settlementIntentId as string) || "";
  const fixedAssetAmount = params.prefilledAsset === "USDC";
  // Group quotes are denominated in USDC, never silently converted from dollars.
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
      ? fixedAssetAmount ? settlementUsdAmount.toFixed(2) : usdToTokenAmount(settlementUsdAmount, defaultToken)
      : "",
  );
  const [note, setNote] = useState(prefilledNote);
  const [selectedToken, setSelectedToken] = useState<Token>(defaultToken);
  const [isSending, setIsSending] = useState(false);
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const [isAddressReviewOpen, setIsAddressReviewOpen] = useState(false);
  // Set when a payment was submitted but its outcome could not be confirmed.
  // It stays until the person leaves: sending again could pay twice.
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  // Set when the real fee moved after the review: the review reopens with it.
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const isTransactionInProgress = isSending || isTransactionLoading;

  useEffect(() => {
    if (!isTransactionInProgress) {
      setIsTakingLonger(false);
      return;
    }
    const timer = setTimeout(() => setIsTakingLonger(true), 30_000);
    return () => clearTimeout(timer);
  }, [isTransactionInProgress]);

  const truncateAddress = (address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const handleAmountChange = (text: string) => {
    if (isTransactionInProgress || settlementGroupId) return;

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
  }, [refreshBalances, user]);

  useEffect(() => {
    const updatedToken = getAssetBySymbol(selectedToken.symbol);
    if (updatedToken) {
      setSelectedToken(updatedToken);
      // Recompute crypto amount when fresh prices arrive for a settlement prefill
      if (settlementUsdAmount !== null && !fixedAssetAmount) {
        setAmount(usdToTokenAmount(settlementUsdAmount, updatedToken));
      }
    }
  }, [assets, getAssetBySymbol, selectedToken.symbol, settlementUsdAmount, fixedAssetAmount]);

  const currentBalance = parseAmount(selectedToken.balance);
  const amountValue = parseAmount(amount);
  const balanceValidation = validateBalance(amountValue, currentBalance);

  // The network fee is paid in USDC, so what can be sent depends on it.
  const { quote: feeQuote, refresh: refreshFee } = useNetworkFee({
    service: smartAccountService,
    recipientAddress: recipient.smartAccountAddress,
    tokenSymbol: selectedToken?.symbol,
    tokenAddress: selectedToken?.contractAddress,
  });
  const maxFee = feeQuote.status === "ready" ? feeQuote.maxFee : null;
  const sendingFeeToken = selectedToken.symbol === FEE_TOKEN_SYMBOL;
  const tokenBalanceUnits = assetBaseUnits(selectedToken);
  const feeTokenBalanceUnits = assetBaseUnits(getAssetBySymbol(FEE_TOKEN_SYMBOL));
  const amountUnits = amount.trim() ? parseUnits(amount, selectedToken.decimals) : null;
  const { fundsMessage, maxSend } = assessSend({
    amountUnits,
    tokenSymbol: selectedToken.symbol,
    tokenBalance: tokenBalanceUnits,
    feeTokenBalance: feeTokenBalanceUnits,
    maxFee,
  });
  // Only offered for a free amount: a group settlement is a fixed amount.
  const maxSendAmount =
    maxSend !== null && !settlementGroupId
      ? formatUnits(maxSend, selectedToken.decimals, 0)
      : null;

  useEffect(() => {
    onTransactionStateChange?.(isTransactionInProgress);
  }, [isTransactionInProgress, onTransactionStateChange]);

  useEffect(() => {
    return () => {
      onTransactionStateChange?.(false);
    };
  }, [onTransactionStateChange]);

  const handleQuickAmount = (percentage: string) => {
    if (isTransactionInProgress || isLoadingBalances || settlementGroupId) return;

    if (percentage === "MAX" && sendingFeeToken) {
      // The fee comes out of this same balance: keep the largest fee back. With
      // no real quote there is nothing honest to subtract, so MAX waits.
      const room =
        tokenBalanceUnits === null ? null : maxSendable(tokenBalanceUnits, maxFee);
      if (room === null) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAmount(formatUnits(room, selectedToken.decimals, 0));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const calculatedAmount = calculatePercentageAmount(
      percentage,
      currentBalance,
    );
    setAmount(calculatedAmount.toString());
  };

  /** When user manually switches token in a settlement flow, convert to new token units */
  const handleTokenSelect = (token: Token) => {
    if (isTransactionInProgress || isLoadingBalances || settlementGroupId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const asset = getAssetBySymbol(token.symbol);
    if (!asset) return;
    setSelectedToken(asset);
    if (settlementUsdAmount !== null && !fixedAssetAmount) {
      setAmount(usdToTokenAmount(settlementUsdAmount, asset));
    }
  };

  const isValidAmount = amountValue > 0 && balanceValidation.isValid;
  const feeReady = feeQuote.status === "ready";
  const canSend =
    isValidAmount &&
    feeReady &&
    !fundsMessage &&
    !isTransactionInProgress &&
    !statusUnknown &&
    smartAccountService &&
    transactionService;

  const recipientLabel = recipient.isLocalContact
    ? recipient.name
      ? `${recipient.name} (your nickname)`
      : "External address"
    : `@${recipient.handle}`;
  const approxUsd =
    selectedToken.usdPrice > 0
      ? `$${(amountValue * selectedToken.usdPrice).toFixed(2)}`
      : null;

  // A group quote is valid for a limited time. Checked when the review opens
  // and again when it is confirmed: the review can stay open past expiry.
  const settlementNeedsUpdate = () =>
    !!settlementGroupId &&
    (!settlementIntentId ||
      selectedToken.symbol !== "USDC" ||
      !(Date.now() < Date.parse(String(params.settlementExpiresAt))));
  const warnSettlementNeedsUpdate = () =>
    useAlertStore
      .getState()
      .error("Amount needs updating", "Return to the group and review the updated proposal before paying.");

  const buildTransactionRequest = (): SendTransactionRequest => ({
    recipientAddress: recipient.smartAccountAddress,
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
    // What the person was shown and could afford; checked again against the real
    // fee before anything is signed.
    feeGuard:
      maxFee !== null && amountUnits !== null
        ? {
            shownMaxFee: maxFee,
            amount: amountUnits,
            sendingFeeToken,
            tokenBalance: tokenBalanceUnits ?? 0n,
            feeTokenBalance: (sendingFeeToken ? tokenBalanceUnits : feeTokenBalanceUnits) ?? 0n,
          }
        : undefined,
    settlement: settlementGroupId && settlementMemberId && settlementIntentId
      ? { groupId: settlementGroupId, memberId: settlementMemberId, intentId: settlementIntentId }
      : undefined,
  });

  const handleSendComplete = () => {
    if (settlementNeedsUpdate()) {
      warnSettlementNeedsUpdate(); setSwipeResetKey((key) => key + 1); return;
    }
    if (!canSend || isTransactionInProgress) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Ask for a fresh quote: the one on screen may be old. The review waits for it.
    setReviewNotice(null);
    refreshFee();
    setIsAddressReviewOpen(true);
  };

  const closeAddressReview = () => {
    if (isTransactionInProgress) return;

    setIsAddressReviewOpen(false);
    setSwipeResetKey((key) => key + 1);
  };

  const handleConfirmAddressAndSend = async () => {
    if (!canSend || isTransactionInProgress) return;
    if (settlementNeedsUpdate()) {
      closeAddressReview();
      warnSettlementNeedsUpdate();
      return;
    }

    setIsAddressReviewOpen(false);
    clearError();
    setIsSending(true);

    let movedOn = false;
    const leaveSendFlow = () => {
      if (movedOn) return;
      movedOn = true;
      // Back to the home screen with a short toast: no receipt to dismiss. The
      // payment keeps confirming in the background; a failure raises an alert
      // and Activity always shows where it stands.
      useAlertStore.getState().success("Payment sent", `${amountValue} ${selectedToken.symbol} to ${recipient.handle}`);
      router.replace("/(tabs)");
    };

    try {
      // As soon as the payment is accepted and on record it cannot be sent
      // twice, so the person goes straight home instead of watching a swipe
      // wait for the network.
      const transactionRequest = { ...buildTransactionRequest(), onAccepted: () => leaveSendFlow() };
      const result =
        await transactionService.sendTransaction(transactionRequest);

      if (result.success) {
        // Already home, except when the payment was answered from an earlier one.
        leaveSendFlow();
      } else {
        if (movedOn) return;
        if (result.isPendingVerification) setStatusUnknown(true);
        if (
          result.errorCode === "FEE_CHANGED" ||
          result.errorCode === "FEE_INSUFFICIENT" ||
          result.errorCode === "FEE_UNAVAILABLE"
        ) {
          // Nothing was sent. Get the new fee and ask again, with the reason.
          clearError();
          setReviewNotice(result.error ?? null);
          refreshFee();
          setIsAddressReviewOpen(true);
          return;
        }
        throw new Error(result.error || "Transaction failed");
      }
    } catch {
      setSwipeResetKey((key) => key + 1);
      // Error is stored in transaction store
    } finally {
      setIsSending(false);
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
          Crypto to send
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
            {assets.filter(token => !settlementGroupId || token.symbol === "USDC").map((token) => (
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
                <Text
                  className="text-[10px] mt-1"
                  style={{
                    color:
                      selectedToken.symbol === token.symbol
                        ? "rgba(0,0,0,0.55)"
                        : "rgba(255,255,255,0.5)",
                  }}
                >
                  {token.balance}
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
            disabled={isLoadingBalances || isTransactionInProgress || (pct === "MAX" && sendingFeeToken && !feeReady)}
            className="px-4 py-2 rounded-2xl active:opacity-70 border border-muted/40"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              opacity:
                isLoadingBalances || isTransactionInProgress || (pct === "MAX" && sendingFeeToken && !feeReady)
                  ? 0.5
                  : 1,
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
          placeholder="Message to the recipient (optional)"
          placeholderTextColor={COLORS.muted}
          editable={!isTransactionInProgress}
          className="w-full px-4 py-4 rounded-2xl text-base text-primary border border-muted/40"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            opacity: isTransactionInProgress ? 0.55 : 1,
          }}
        />
        {/* Say who reads it: the note is not a private memo. */}
        <Text className="text-xs text-muted mt-2 px-1">
          Stored by ATARA and shown to the recipient if they use ATARA. Not
          written on the blockchain.
        </Text>
      </MotiView>

      {transactionError && (
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
        </MotiView>
      )}

      <PaymentReview
        visible={isAddressReviewOpen}
        recipientLabel={recipientLabel}
        recipientAddress={recipient.smartAccountAddress}
        amount={amountValue.toString()}
        tokenSymbol={selectedToken.symbol}
        approxUsd={approxUsd}
        note={note || undefined}
        busy={isTransactionInProgress}
        fee={feeQuote}
        fundsMessage={fundsMessage}
        notice={reviewNotice}
        onRetryFee={refreshFee}
        onCancel={closeAddressReview}
        onConfirm={handleConfirmAddressAndSend}
      />

      {!!fundsMessage && balanceValidation.isValid && (
        <MotiView
          from={{ opacity: 0, translateY: -5 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mb-4 p-3 rounded-2xl bg-bitcoin/10 border border-bitcoin/30"
        >
          <View className="flex-row items-start gap-2">
            <AlertCircle size={16} color={COLORS.bitcoinOrange} />
            <Text className="text-sm text-bitcoin flex-1">{fundsMessage}</Text>
          </View>
          {maxSendAmount !== null && maxSend !== null && (
            <Pressable
              onPress={() => setAmount(maxSendAmount)}
              disabled={isTransactionInProgress}
              className="mt-3 self-start rounded-xl border border-white/20 px-4 py-2"
            >
              <Text className="text-sm font-semibold text-white">{`Send max (${formatUsdc(maxSend)})`}</Text>
            </Pressable>
          )}
        </MotiView>
      )}

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

        <Text className="text-sm text-muted">Network fee:</Text>
        <View className="px-2.5 py-1 rounded-full bg-emarald/10 border border-emarald/20">
          <Text className="text-xs font-medium text-emarald">
            {feeQuote.status === "loading"
              ? "Estimating…"
              : feeQuote.status === "ready"
                ? formatNetworkFee(feeQuote.maxFee)
                : feeQuote.status === "unavailable"
                  ? "Unavailable"
                  : "—"}
          </Text>
        </View>
        {feeQuote.status === "unavailable" && (
          <Pressable onPress={refreshFee} disabled={isTransactionInProgress}>
            <Text className="text-xs font-semibold text-white underline">Try again</Text>
          </Pressable>
        )}
      </MotiView>

      {statusUnknown && (
        <View
          accessibilityRole="alert"
          className="mb-4 rounded-2xl border border-bitcoin/40 bg-bitcoin/10 p-4"
        >
          <Text className="text-sm font-semibold text-white">
            Status unknown. Do not send again.
          </Text>
          <Text className="mt-2 text-sm leading-5 text-white/70">
            This payment may still go through. Check Activity: it can take a
            few minutes to appear. ATARA will not send a new payment from this
            phone until this one is settled.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/activity")}
            className="mt-3 self-start rounded-xl border border-white/20 px-4 py-2"
          >
            <Text className="text-sm font-semibold text-white">Open Activity</Text>
          </Pressable>
        </View>
      )}

      {isTakingLonger && !statusUnknown && (
        <View className="mb-4 rounded-2xl border border-white/20 bg-white/5 p-4">
          <Text className="text-sm font-semibold text-white">
            Still verifying your transfer
          </Text>
          <Text className="mt-2 text-sm leading-5 text-white/70">
            It may already have been sent. Use the close button to leave and
            check Activity. It may take time to appear there. Do not send again until this attempt is resolved. Leaving will not cancel it.
          </Text>
        </View>
      )}

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
            isSending
              ? "Sending Transaction..."
              : statusUnknown
                ? "Check Activity first"
                : !smartAccountService
                ? "Wallet Not Connected"
                : isLoadingBalances
                  ? "Loading Balances..."
                  : !balanceValidation.isValid && amountValue > 0
                    ? balanceValidation.message
                    : fundsMessage
                      ? "Not enough USDC for the fee"
                      : feeQuote.status === "loading"
                        ? "Calculating network fee..."
                        : feeQuote.status === "unavailable"
                          ? "Network fee unavailable"
                          : "Slide right to send"
          }
        />
      </MotiView>
    </ScrollView>
  );
};
