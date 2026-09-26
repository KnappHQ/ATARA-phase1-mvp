import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { usePrivy, useLinkSMS, useMfaEnrollment, useEmbeddedEthereumWallet } from "@privy-io/expo";
import { useLinkWithPasskey } from "@privy-io/expo/passkey";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, LogOut, ShieldCheck, Smartphone, WalletCards } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useExternalWallet } from "@/providers/ExternalWalletProvider";
import { AuthService } from "@/services/auth.service";
import { useAuth } from "@/providers/AuthProvider";
import { withTimeout } from "@/utils/asyncOperation";
import { runExclusiveOperation } from "@/utils/exclusiveOperation";
import { describeAuthFailure, formatAuthFailure, probeDomainAssociation } from "@/utils/authDiagnostics";

const PASSKEY_RP = process.env.EXPO_PUBLIC_PASSKEY_RP_ID || "";
const SMS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SMS_BACKUP === "true";
const Card = ({ children }: { children: React.ReactNode }) => <View className="rounded-3xl border border-white/10 bg-white/5 p-5 mb-4">{children}</View>;
const Button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => <Pressable disabled={disabled} onPress={onPress} className="mt-4 p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent, opacity: disabled ? .4 : 1 }}><Text className="text-black text-center font-semibold">{label}</Text></Pressable>;

export default function SecurityScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const { logout } = useAuth();
  const profile = useAuthStore((state) => state.user);
  const externalWallet = useExternalWallet();
  const { linkWithPasskey } = useLinkWithPasskey();
  const { initMfaEnrollment, submitMfaEnrollment } = useMfaEnrollment();
  const { sendCode, linkWithCode } = useLinkSMS();
  const [busy, setBusy] = useState(false);
  const operationRef = useRef(0);
  const busyRef = useRef(false);
  const [operationLabel, setOperationLabel] = useState("");
  const [totp, setTotp] = useState<{ authUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpConfirmed, setTotpConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [code, setCode] = useState("");
  const passkeys = user?.linked_accounts.filter(a => a.type === "passkey") ?? [];
  const linkedPhone = user?.linked_accounts.find(a => a.type === "phone");
  const hasTotp = totpConfirmed || (user?.mfa_methods?.some(m => m.type === "totp") ?? false);
  const hasOtherMfa = user?.mfa_methods?.some(m => m.type !== "totp") ?? false;
  const canManagePrivy = isReady && !!user && profile?.authProvider !== "external_wallet";
  const cancel = () => {
    operationRef.current += 1;
    busyRef.current = false;
    setBusy(false); setTotp(null); setTotpCode(""); setMessage("");
  };
  useEffect(() => {
    operationRef.current += 1;
    busyRef.current = false;
    setBusy(false); setTotp(null); setTotpCode(""); setTotpConfirmed(false);
    return () => { operationRef.current += 1; };
  }, [user?.id]);
  const run = async <T,>(task: () => Promise<T>, success: string, label = "Verification in progress…", onSuccess?: (result: T) => void) => {
    if (busyRef.current) return;
    const operation = ++operationRef.current;
    busyRef.current = true;
    setBusy(true); setMessage(""); setOperationLabel(label);
    try {
      const result = await withTimeout(runExclusiveOperation(`security:${user?.id ?? "external"}`, task));
      if (operationRef.current !== operation) return;
      onSuccess?.(result); setMessage(success);
    } catch (error: unknown) {
      if (operationRef.current === operation) setMessage(error instanceof Error ? error.message : "Operation incomplete. Try again.");
    } finally {
      if (operationRef.current === operation) { busyRef.current = false; setBusy(false); }
    }
  };
  return <SafeAreaView className="flex-1 bg-black">
    <View className="flex-row items-center px-6 py-4 gap-4"><Pressable onPress={() => { cancel(); router.back(); }} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}><ArrowLeft color="white" /></Pressable><Text className="text-white text-xl font-semibold">Security</Text></View>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {!!message && <Text accessibilityRole="alert" className="text-white/70 leading-5 mb-4">{message}</Text>}
      {busy && <View className="rounded-2xl border border-white/10 p-4 mb-4">
        <View className="flex-row items-center gap-3"><ActivityIndicator size="small" color={COLORS.accent} /><Text accessibilityLiveRegion="polite" className="text-white flex-1">{operationLabel}</Text></View>
        <Pressable onPress={cancel} accessibilityRole="button" className="min-h-12 items-center justify-center mt-2"><Text className="text-white">Cancel</Text></Pressable>
        <Text className="text-white/45 text-xs">Leaving this screen does not cancel a confirmation already sent to your provider.</Text>
      </View>}
      <Card>
        <WalletCards color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Signing method</Text>
        <Text className="text-white/60 leading-5 mt-2">
          {profile?.authProvider === "external_wallet"
            ? `External wallet${externalWallet.address ? ` · ${externalWallet.address.slice(0, 6)}…${externalWallet.address.slice(-4)}` : " · reconnect required"}`
            : "Embedded signer protected by your Privy authentication methods."}
        </Text>
        <Text className="text-white/40 text-xs leading-5 mt-3">
          The ATARA API verifies signatures but does not store a private key capable of signing a payment for you.
        </Text>
      </Card>
      <Card>
        <KeyRound color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Passkeys · {passkeys.length} linked</Text>
        <Text className="text-white/60 leading-5 mt-2">Link a passkey to your existing account. The authentication provider verifies it so you can sign in again.</Text>
        <Button label="Add a passkey" disabled={busy || !PASSKEY_RP || !canManagePrivy} onPress={() => run(async () => {
          try {
            const result = await linkWithPasskey({ relyingParty: `https://${PASSKEY_RP}` });
            if (!result?.linked_accounts.some(a => a.type === "passkey")) throw new Error("Passkey linking was not confirmed. Try again.");
          } catch (error) {
            const failure = describeAuthFailure(error, { method: "passkey" });
            const association = failure.layer === "api" ? await probeDomainAssociation(PASSKEY_RP) : undefined;
            throw new Error(formatAuthFailure(association ?? failure));
          }
        }, "Passkey linked to your account.", "Confirm the passkey in the iOS prompt…")} />
        {!PASSKEY_RP && <Text className="text-white/40 text-xs mt-3">Passkeys require the secure domain to be configured.</Text>}
        {!!PASSKEY_RP && !user && <Text className="text-white/40 text-xs mt-3">Your external wallet already signs for you. You can create a passkey in a separate account, but ATARA cannot silently add one to this wallet.</Text>}
      </Card>
      <Card>
        <ShieldCheck color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Authenticator · {hasTotp ? "enabled" : "not set up"}</Text>
        <Text className="text-white/60 leading-5 mt-2">Add an authenticator code to protect wallet signing. Your wallet provider will request verification when needed.</Text>
        {!totp && <Button label={hasTotp ? "Second factor enabled" : "Set up a second factor"} disabled={busy || hasTotp || hasOtherMfa || !canManagePrivy || !wallets.length} onPress={() => run(async () => {
          const result = await initMfaEnrollment({ method: "totp" });
          if (!result.authUrl || !result.authUrl.startsWith("otpauth://totp/")) throw new Error("The provider did not return the setup details. Try again.");
          const secret = result.secret || new URL(result.authUrl).searchParams.get("secret");
          if (!secret) throw new Error("The setup key is missing. Try again.");
          return { authUrl: result.authUrl, secret };
        }, "", "Preparing your authenticator…", setTotp)} />}
        {!canManagePrivy && <Text className="text-white/50 text-xs mt-3">Set up your external wallet’s second factor in its own app.</Text>}
        {canManagePrivy && !wallets.length && <Text className="text-white/50 text-xs mt-3">Your wallet must be ready before you set up a second factor. Sign in again and retry.</Text>}
        {hasOtherMfa && <Text className="text-white/50 text-xs mt-3">Another second factor already protects this account. It will not be replaced automatically.</Text>}
        {!!totp && <View className="mt-4">
          <Text className="text-white/70 leading-5">1. Add this key to your authenticator app. Never share it.</Text>
          <Text selectable className="text-white font-mono p-4 bg-white/5 rounded-2xl mt-3">{totp.secret}</Text>
          <Button label="Open authenticator app" disabled={busy} onPress={() => run(() => Linking.openURL(totp.authUrl), "Return here with the 6-digit code.", "Opening authenticator…")} />
          <Text className="text-white/70 mt-4">2. Enter the 6-digit code to confirm setup.</Text>
          <TextInput accessibilityLabel="Authenticator code" value={totpCode} onChangeText={value => setTotpCode(value.replace(/\D/g, "").slice(0, 6))} editable={!busy} keyboardType="number-pad" autoComplete="off" secureTextEntry maxLength={6} placeholder="000000" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-3" />
          <Button label="Enable second factor" disabled={busy || totpCode.length !== 6} onPress={() => run(() => submitMfaEnrollment({ method: "totp", code: totpCode }), "Second factor enabled. Keep a secure backup of your authenticator.", "Verifying code…", () => { setTotp(null); setTotpCode(""); setTotpConfirmed(true); })} />
          <Pressable onPress={cancel} className="min-h-12 items-center justify-center mt-2"><Text className="text-white/70">Cancel setup</Text></Pressable>
        </View>}
        <Text className="text-white/40 text-xs leading-5 mt-3">Keep an encrypted backup of your authenticator. A backup phone number cannot replace a lost second factor.</Text>
      </Card>
      <Card>
        <Smartphone color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Optional backup phone number</Text>
        <Text className="text-white/60 leading-5 mt-2">{linkedPhone ? "A verified phone number is linked to your account." : "Verify your phone number by SMS to add a sign-in method. It is shared with the authentication provider only when you request a code."}</Text>
        {SMS_ENABLED && canManagePrivy ? <>
          <TextInput accessibilityLabel="International phone number" value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" placeholder="+33612345678" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-4" />
          <Button label="Get a code" disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone)} onPress={() => run(async () => { await sendCode({ phone }); setSentPhone(phone); setCode(""); }, "Code sent. Check your messages to link this number.")} />
          {!!sentPhone && <><TextInput accessibilityLabel="SMS code" value={code} onChangeText={v => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="SMS code" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-3" /><Button label="Verify and link" disabled={busy || code.length !== 6} onPress={() => run(async () => { await linkWithCode({ phone: sentPhone, code }); setCode(""); setSentPhone(""); }, "Phone number verified and linked.")} /></>}
        </> : <Text className="text-white/40 text-xs leading-5 mt-3">SMS will be enabled after provider availability and costs are confirmed. No phone number is collected yet.</Text>}
      </Card>
      <Card>
        <LogOut color={COLORS.accent} />
        <Text className="text-white text-lg font-semibold mt-3">Session control</Text>
        <Text className="text-white/60 leading-5 mt-2">
          Revoke ATARA sessions on all your devices. This closes access to ATARA’s social features. Your external wallet remains yours, and ATARA cannot control its keys.
        </Text>
        <Button
          label="Revoke all ATARA sessions"
          disabled={busy}
          onPress={() =>
            run(
              async () => { try { await AuthService.logoutAll(); } finally { await logout(); } },
              "All ATARA sessions were revoked.",
            )
          }
        />
      </Card>
      <Text className="text-white/45 text-xs leading-5">Keep at least two sign-in methods and test recovery before using real funds. Legacy ATARA demo codes cannot recover wallet keys.</Text>
    </ScrollView>
  </SafeAreaView>;
}
