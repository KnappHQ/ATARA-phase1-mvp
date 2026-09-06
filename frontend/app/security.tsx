import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, Check, Copy, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Smartphone } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import { useAuthStore } from "@/stores/useAuthStore";
import { SecurityService, type SecurityStatus } from "@/services/security.service";

const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 mb-4">{children}</View>
);

const ActionButton = ({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    className="mt-4 h-12 rounded-2xl items-center justify-center px-4"
    style={{ backgroundColor: secondary ? "rgba(255,255,255,0.08)" : COLORS.white, opacity: disabled ? 0.4 : 1 }}
  >
    <Text className="font-semibold" style={{ color: secondary ? COLORS.white : COLORS.black }}>{label}</Text>
  </Pressable>
);

export default function SecurityScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [phone, setPhone] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStatus, nextPasskey] = await Promise.all([
        SecurityService.getStatus(),
        SecurityService.isPasskeyRegistered(),
      ]);
      setStatus(nextStatus);
      setPhone(nextStatus.recoveryPhone || "");
      setPasskeyRegistered(nextPasskey);
      setMessage(null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || "Impossible de charger la sécurité.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const registerPasskey = async () => {
    if (!user) return;
    setPasskeyLoading(true);
    setMessage(null);
    try {
      await SecurityService.registerPasskey({ userId: user.id, handle: user.handle });
      setPasskeyRegistered(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setMessage(error?.message || "La passkey n’a pas pu être activée.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const startTotp = async () => {
    try {
      setTotpSetup(await SecurityService.setupTotp(user?.handle));
      setTotpCode("");
      setMessage(null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || "Impossible de préparer l’authentificateur.");
    }
  };

  const enableTotp = async () => {
    try {
      await SecurityService.enableTotp(totpCode);
      setTotpSetup(null);
      setTotpCode("");
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || "Code invalide.");
    }
  };

  const disableTotp = async () => {
    try {
      await SecurityService.disableTotp(totpCode);
      setTotpCode("");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || "Code invalide.");
    }
  };

  const regenerateCodes = async () => {
    Alert.alert("Regénérer les codes ?", "Les anciens codes seront immédiatement invalidés.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Regénérer",
        style: "destructive",
        onPress: async () => {
          try {
            setRecoveryCodes(await SecurityService.regenerateRecoveryCodes());
            await load();
          } catch (error: any) {
            setMessage(error?.response?.data?.message || error?.message || "Impossible de créer les codes.");
          }
        },
      },
    ]);
  };

  const savePhone = async () => {
    try {
      await SecurityService.saveRecoveryPhone(phone);
      setMessage("Numéro enregistré. La vérification SMS sera activée avec le fournisseur choisi.");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || "Numéro invalide.");
    }
  };

  if (loading && !status) {
    return <SafeAreaView className="flex-1 bg-black items-center justify-center"><ActivityIndicator color={COLORS.white} /></SafeAreaView>;
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-6 py-4 border-b border-white/10">
        <Pressable onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white/10"><ArrowLeft size={20} color={COLORS.white} /></Pressable>
        <View className="ml-4"><Text className="text-xl font-semibold text-white">Sécurité</Text><Text className="text-white/45 text-xs mt-1">Protège l’accès à ton portefeuille</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {message ? <View className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 mb-4"><Text className="text-amber-100 text-sm leading-5">{message}</Text></View> : null}

        <Card>
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-blue-300/15 items-center justify-center"><KeyRound size={21} color={COLORS.accent} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Passkey</Text><Text className="text-white/50 text-sm mt-1">Face ID, Touch ID ou verrouillage écran</Text></View>{passkeyRegistered ? <Check size={20} color="#4ade80" /> : null}</View>
          <Text className="text-white/60 text-sm leading-5 mt-4">Une passkey évite de mémoriser un mot de passe. Le domaine sécurisé doit être configuré avant l’activation production.</Text>
          <ActionButton label={passkeyLoading ? "Activation…" : passkeyRegistered ? "Passkey activée" : "Ajouter une passkey"} onPress={registerPasskey} disabled={passkeyLoading || passkeyRegistered} />
        </Card>

        <Card>
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-green-300/15 items-center justify-center"><ShieldCheck size={21} color="#4ade80" /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Authentificateur (2FA)</Text><Text className="text-white/50 text-sm mt-1">Code à 6 chiffres, renouvelé toutes les 30 secondes</Text></View>{status?.totpEnabled ? <Check size={20} color="#4ade80" /> : null}</View>
          {!status?.totpEnabled && !totpSetup ? <ActionButton label="Configurer avec Google Authenticator" onPress={startTotp} /> : null}
          {totpSetup ? <View className="mt-4"><Text className="text-white/65 text-sm leading-5">Ajoute ce compte dans ton application d’authentification, puis saisis le code affiché.</Text><Text selectable className="text-white font-mono text-xs leading-5 mt-3">Clé : {totpSetup.secret}</Text><Pressable onPress={() => Clipboard.setStringAsync(totpSetup.otpauthUri)} className="flex-row items-center mt-3"><Copy size={15} color={COLORS.accent} /><Text className="ml-2 text-blue-300 text-xs">Copier le lien otpauth</Text></Pressable><TextInput value={totpCode} onChangeText={(value) => setTotpCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="Code à 6 chiffres" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white text-lg tracking-[4px]"/><ActionButton label="Activer le 2FA" onPress={enableTotp} disabled={totpCode.length !== 6} /><ActionButton label="Annuler" onPress={() => setTotpSetup(null)} secondary /></View> : null}
          {status?.totpEnabled ? <View className="mt-4"><TextInput value={totpCode} onChangeText={(value) => setTotpCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="Code actuel pour désactiver" placeholderTextColor="rgba(255,255,255,0.25)" className="rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white"/><ActionButton label="Désactiver le 2FA" onPress={disableTotp} disabled={totpCode.length !== 6} secondary /></View> : null}
        </Card>

        <Card>
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><LockKeyhole size={21} color={COLORS.white} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Codes de récupération</Text><Text className="text-white/50 text-sm mt-1">{status?.recoveryCodesRemaining || 0} code(s) restant(s)</Text></View></View>
          <Text className="text-white/60 text-sm leading-5 mt-4">Télécharge ou copie ces codes hors ligne. Chaque code ne peut être utilisé qu’une seule fois.</Text>
          {recoveryCodes.length ? <View className="rounded-2xl bg-black/40 border border-white/10 p-4 mt-4">{recoveryCodes.map((code) => <Text key={code} className="text-white font-mono text-sm py-1">{code}</Text>)}<Pressable onPress={() => Clipboard.setStringAsync(recoveryCodes.join("\n"))} className="flex-row items-center mt-3"><Copy size={15} color={COLORS.accent} /><Text className="ml-2 text-blue-300 text-xs">Copier les codes</Text></Pressable></View> : null}
          <ActionButton label="Créer de nouveaux codes" onPress={regenerateCodes} secondary />
        </Card>

        <Card>
          <View className="flex-row items-center"><View className="w-11 h-11 rounded-2xl bg-white/10 items-center justify-center"><Smartphone size={21} color={COLORS.white} /></View><View className="flex-1 ml-3"><Text className="text-white text-lg font-semibold">Numéro de secours</Text><Text className="text-white/50 text-sm mt-1">Récupération du compte uniquement</Text></View></View>
          <Text className="text-white/60 text-sm leading-5 mt-4">Le numéro ne servira pas à payer. Une vérification SMS sera nécessaire avant de l’utiliser pour récupérer l’accès.</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" placeholderTextColor="rgba(255,255,255,0.25)" className="mt-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 text-white"/><ActionButton label="Enregistrer le numéro" onPress={savePhone} disabled={!phone.trim()} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
