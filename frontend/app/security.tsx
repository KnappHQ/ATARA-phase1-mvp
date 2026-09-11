import { useState } from "react";
import { useRouter } from "expo-router";
import { usePrivy, useLinkSMS } from "@privy-io/expo";
import { useLinkWithPasskey } from "@privy-io/expo/passkey";
import { useMfaEnrollmentUI } from "@privy-io/expo/ui";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, KeyRound, LogOut, ShieldCheck, Smartphone, WalletCards } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { useExternalWallet } from "@/providers/ExternalWalletProvider";
import { AuthService } from "@/services/auth.service";

const PASSKEY_RP = process.env.EXPO_PUBLIC_PASSKEY_RP_ID || "";
const SMS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SMS_BACKUP === "true";
const Card = ({ children }: { children: React.ReactNode }) => <View className="rounded-3xl border border-white/10 bg-white/5 p-5 mb-4">{children}</View>;
const Button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => <Pressable disabled={disabled} onPress={onPress} className="mt-4 p-4 rounded-2xl" style={{ backgroundColor: COLORS.accent, opacity: disabled ? .4 : 1 }}><Text className="text-black text-center font-semibold">{label}</Text></Pressable>;

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const profile = useAuthStore((state) => state.user);
  const externalWallet = useExternalWallet();
  const { linkWithPasskey } = useLinkWithPasskey();
  const { init: manageMfa } = useMfaEnrollmentUI();
  const { sendCode, linkWithCode } = useLinkSMS();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [code, setCode] = useState("");
  const passkeys = user?.linked_accounts.filter(a => a.type === "passkey") ?? [];
  const linkedPhone = user?.linked_accounts.find(a => a.type === "phone");
  const hasTotp = user?.mfa_methods?.some(m => m.type === "totp") ?? false;
  const run = async (task: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await task(); setMessage(success); }
    catch (error: any) { setMessage(error?.message ?? "Opération non terminée. Réessaie ou contacte le support."); }
    finally { setBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-black">
    <View className="flex-row items-center px-6 py-4 gap-4"><Pressable onPress={() => router.back()} accessibilityLabel="Retour"><ArrowLeft color="white" /></Pressable><Text className="text-white text-xl font-semibold">Sécurité</Text></View>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {!!message && <Text accessibilityRole="alert" className="text-white/70 leading-5 mb-4">{message}</Text>}
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
        <Button label="Ajouter une passkey" disabled={busy || !PASSKEY_RP || !user} onPress={() => run(async () => {
          const result = await linkWithPasskey({ relyingParty: `https://${PASSKEY_RP}` });
          if (!result?.linked_accounts.some(a => a.type === "passkey")) throw new Error("Association non confirmée. Réessaie.");
        }, "Passkey associée à ton compte.")} />
        {!PASSKEY_RP && <Text className="text-white/40 text-xs mt-3">Activation en attente de la configuration du domaine sécurisé.</Text>}
        {!!PASSKEY_RP && !user && <Text className="text-white/40 text-xs mt-3">Ton wallet externe est déjà ton moyen de signature. Une passkey intégrée peut être créée dans un compte séparé, pas ajoutée silencieusement à ce wallet.</Text>}
      </Card>
      <Card>
        <ShieldCheck color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Authentificateur · {hasTotp ? "activé" : "à configurer"}</Text>
        <Text className="text-white/60 leading-5 mt-2">Ajoute un code d’authentification pour protéger l’utilisation des clés du portefeuille. Une vérification sera demandée par le service du portefeuille lorsqu’elle est nécessaire.</Text>
        <Button label={hasTotp ? "Gérer le second facteur" : "Configurer le second facteur"} disabled={busy} onPress={() => run(() => manageMfa({ mfaMethods: ["totp"] }), "Paramètres du second facteur actualisés.")} />
        <Text className="text-white/40 text-xs leading-5 mt-3">Conserve une sauvegarde chiffrée de ton authentificateur. Un numéro de secours ne remplace pas un second facteur perdu.</Text>
      </Card>
      <Card>
        <Smartphone color={COLORS.accent} /><Text className="text-white text-lg font-semibold mt-3">Numéro de secours facultatif</Text>
        <Text className="text-white/60 leading-5 mt-2">{linkedPhone ? "Un numéro vérifié est associé à ton compte." : "Vérifie ton numéro par SMS pour ajouter une méthode de connexion. Il sera transmis au fournisseur d’authentification uniquement lorsque tu demandes le code."}</Text>
        {SMS_ENABLED ? <>
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
              () => AuthService.logoutAll(),
              "Toutes les sessions ATARA ont été révoquées.",
            )
          }
        />
      </Card>
      <Text className="text-white/45 text-xs leading-5">Garde au moins deux moyens de connexion accessibles et teste la récupération avant d’utiliser des fonds réels. Les anciens codes de démonstration ATARA ne récupèrent pas les clés du portefeuille.</Text>
    </ScrollView>
  </SafeAreaView>;
}
