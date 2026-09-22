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
  const run = async <T,>(task: () => Promise<T>, success: string, label = "Vérification en cours…", onSuccess?: (result: T) => void) => {
    if (busyRef.current) return;
    const operation = ++operationRef.current;
    busyRef.current = true;
    setBusy(true); setMessage(""); setOperationLabel(label);
    try {
      const result = await withTimeout(runExclusiveOperation(`security:${user?.id ?? "external"}`, task));
      if (operationRef.current !== operation) return;
      onSuccess?.(result); setMessage(success);
    } catch (error: unknown) {
      if (operationRef.current === operation) setMessage(error instanceof Error ? error.message : "Opération non terminée. Réessaie.");
    } finally {
      if (operationRef.current === operation) { busyRef.current = false; setBusy(false); }
    }
  };
  return <SafeAreaView className="flex-1 bg-black">
    <View className="flex-row items-center px-6 py-4 gap-4"><Pressable onPress={() => { cancel(); router.back(); }} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}><ArrowLeft color="white" /></Pressable><Text className="text-white text-xl font-semibold">Sécurité</Text></View>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {!!message && <Text accessibilityRole="alert" className="text-white/70 leading-5 mb-4">{message}</Text>}
      {busy && <View className="rounded-2xl border border-white/10 p-4 mb-4">
        <View className="flex-row items-center gap-3"><ActivityIndicator size="small" color={COLORS.accent} /><Text accessibilityLiveRegion="polite" className="text-white flex-1">{operationLabel}</Text></View>
        <Pressable onPress={cancel} accessibilityRole="button" className="min-h-12 items-center justify-center mt-2"><Text className="text-white">Annuler</Text></Pressable>
        <Text className="text-white/45 text-xs">Quitter l’attente n’annule pas une validation déjà envoyée au fournisseur.</Text>
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
        <KeyRound color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Passkeys · {passkeys.length} associée(s)</Text>
        <Text className="text-white/60 leading-5 mt-2">Associe une passkey à ton compte existant. Elle est vérifiée par le service d’authentification et pourra servir à te reconnecter.</Text>
        <Button label="Ajouter une passkey" disabled={busy || !PASSKEY_RP || !canManagePrivy} onPress={() => run(async () => {
          try {
            const result = await linkWithPasskey({ relyingParty: `https://${PASSKEY_RP}` });
            if (!result?.linked_accounts.some(a => a.type === "passkey")) throw new Error("Association non confirmée. Réessaie.");
          } catch (error) {
            const failure = describeAuthFailure(error, { method: "passkey" });
            const association = failure.layer === "api" ? await probeDomainAssociation(PASSKEY_RP) : undefined;
            throw new Error(formatAuthFailure(association ?? failure));
          }
        }, "Passkey associée à ton compte.", "Confirme l’ajout dans la fenêtre iOS…")} />
        {!PASSKEY_RP && <Text className="text-white/40 text-xs mt-3">Activation en attente de la configuration du domaine sécurisé.</Text>}
        {!!PASSKEY_RP && !user && <Text className="text-white/40 text-xs mt-3">Ton wallet externe est déjà ton moyen de signature. Une passkey intégrée peut être créée dans un compte séparé, pas ajoutée silencieusement à ce wallet.</Text>}
      </Card>
      <Card>
        <ShieldCheck color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Authentificateur · {hasTotp ? "activé" : "à configurer"}</Text>
        <Text className="text-white/60 leading-5 mt-2">Ajoute un code d’authentification pour protéger l’utilisation des clés du portefeuille. Une vérification sera demandée par le service du portefeuille lorsqu’elle est nécessaire.</Text>
        {!totp && <Button label={hasTotp ? "Second facteur activé" : "Configurer le second facteur"} disabled={busy || hasTotp || hasOtherMfa || !canManagePrivy || !wallets.length} onPress={() => run(async () => {
          const result = await initMfaEnrollment({ method: "totp" });
          if (!result.authUrl || !result.authUrl.startsWith("otpauth://totp/")) throw new Error("Le fournisseur n’a pas renvoyé la configuration. Réessaie.");
          const secret = result.secret || new URL(result.authUrl).searchParams.get("secret");
          if (!secret) throw new Error("La clé de configuration est manquante. Réessaie.");
          return { authUrl: result.authUrl, secret };
        }, "", "Préparation de l’authentificateur…", setTotp)} />}
        {!canManagePrivy && <Text className="text-white/50 text-xs mt-3">Le second facteur d’un wallet externe se configure dans son application.</Text>}
        {canManagePrivy && !wallets.length && <Text className="text-white/50 text-xs mt-3">Ton portefeuille doit être prêt avant de configurer son second facteur. Réessaie après reconnexion.</Text>}
        {hasOtherMfa && <Text className="text-white/50 text-xs mt-3">Un autre second facteur protège déjà ce compte. Aucun remplacement automatique n’est effectué.</Text>}
        {!!totp && <View className="mt-4">
          <Text className="text-white/70 leading-5">1. Ajoute cette clé dans ton authentificateur (code temporel). Ne la partage jamais.</Text>
          <Text selectable className="text-white font-mono p-4 bg-white/5 rounded-2xl mt-3">{totp.secret}</Text>
          <Button label="Ouvrir mon authentificateur" disabled={busy} onPress={() => run(() => Linking.openURL(totp.authUrl), "Reviens ici avec le code à 6 chiffres.", "Ouverture de l’authentificateur…")} />
          <Text className="text-white/70 mt-4">2. Entre le code à 6 chiffres pour confirmer l’activation.</Text>
          <TextInput accessibilityLabel="Code de l’authentificateur" value={totpCode} onChangeText={value => setTotpCode(value.replace(/\D/g, "").slice(0, 6))} editable={!busy} keyboardType="number-pad" autoComplete="off" secureTextEntry maxLength={6} placeholder="000000" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-3" />
          <Button label="Activer le second facteur" disabled={busy || totpCode.length !== 6} onPress={() => run(() => submitMfaEnrollment({ method: "totp", code: totpCode }), "Second facteur activé. Garde une sauvegarde sécurisée de ton authentificateur.", "Validation du code…", () => { setTotp(null); setTotpCode(""); setTotpConfirmed(true); })} />
          <Pressable onPress={cancel} className="min-h-12 items-center justify-center mt-2"><Text className="text-white/70">Annuler la configuration</Text></Pressable>
        </View>}
        <Text className="text-white/40 text-xs leading-5 mt-3">Conserve une sauvegarde chiffrée de ton authentificateur. Un numéro de secours ne remplace pas un second facteur perdu.</Text>
      </Card>
      <Card>
        <Smartphone color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Numéro de secours facultatif</Text>
        <Text className="text-white/60 leading-5 mt-2">{linkedPhone ? "Un numéro vérifié est associé à ton compte." : "Vérifie ton numéro par SMS pour ajouter une méthode de connexion. Il sera transmis au fournisseur d’authentification uniquement lorsque tu demandes le code."}</Text>
        {SMS_ENABLED && canManagePrivy ? <>
          <TextInput accessibilityLabel="Numéro international" value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" placeholder="+33612345678" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-4" />
          <Button label="Recevoir un code" disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone)} onPress={() => run(async () => { await sendCode({ phone }); setSentPhone(phone); setCode(""); }, "Code envoyé. Vérifie le SMS pour associer ce numéro.")} />
          {!!sentPhone && <><TextInput accessibilityLabel="Code SMS" value={code} onChangeText={v => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="Code SMS" placeholderTextColor="#666" className="text-white rounded-2xl bg-white/5 p-4 mt-3" /><Button label="Vérifier et associer" disabled={busy || code.length !== 6} onPress={() => run(async () => { await linkWithCode({ phone: sentPhone, code }); setCode(""); setSentPhone(""); }, "Numéro vérifié et associé.")} /></>}
        </> : <Text className="text-white/40 text-xs leading-5 mt-3">Les SMS seront ouverts après validation du fournisseur et de leur coût. Aucune collecte de numéro pour le moment.</Text>}
      </Card>
      <Card>
        <LogOut color={COLORS.accent} />
        <Text className="text-white text-lg font-semibold mt-3">Contrôle des sessions</Text>
        <Text className="text-white/60 leading-5 mt-2">
          Révoque toutes les sessions ATARA sur tous tes appareils. Cette action ferme l’accès au service social ATARA mais ne supprime pas ton wallet externe et ne donne jamais à ATARA le contrôle de tes clés.
        </Text>
        <Button
          label="Révoquer toutes les sessions ATARA"
          disabled={busy}
          onPress={() =>
            run(
              async () => { try { await AuthService.logoutAll(); } finally { await logout(); } },
              "Toutes les sessions ATARA ont été révoquées.",
            )
          }
        />
      </Card>
      <Text className="text-white/45 text-xs leading-5">Garde au moins deux moyens de connexion accessibles et teste la récupération avant d’utiliser des fonds réels. Les anciens codes de démonstration ATARA ne récupèrent pas les clés du portefeuille.</Text>
    </ScrollView>
  </SafeAreaView>;
}
