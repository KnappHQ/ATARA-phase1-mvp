import { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import {
  errorIndicatesMaxMfaRetries,
  errorIndicatesMfaTimeout,
  errorIndicatesMfaVerificationFailed,
  useMfa,
  useRegisterMfaListener,
} from "@privy-io/expo";
import type { MfaMethod } from "@privy-io/expo";

import { COLORS } from "@/utils/constants";

/** The methods this screen can carry through: both are a code someone types. */
type CodeMethod = Extract<MfaMethod, "sms" | "totp">;
const isCodeMethod = (method: MfaMethod): method is CodeMethod =>
  method === "sms" || method === "totp";

const LABELS: Record<CodeMethod, string> = {
  totp: "Application d'authentification",
  sms: "Code par SMS",
};

/**
 * Privy suspends a signature it considers sensitive and emits an MFA request.
 * The operation stays suspended until something answers, so an app that
 * registers no listener does not quietly skip the second factor - it hangs.
 * This component is that answer, mounted once for the whole app.
 */
export const MfaGate = () => {
  const { init, submit, cancel } = useMfa();
  const [methods, setMethods] = useState<MfaMethod[]>([]);
  const [selected, setSelected] = useState<CodeMethod | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setMethods([]);
    setSelected(null);
    setCode("");
    setError(null);
    setBusy(false);
  }, []);

  useRegisterMfaListener({
    onMfaRequired: async (offered) => {
      setError(null);
      setCode("");
      setSelected(null);
      setMethods(offered);
    },
  });

  const choose = async (method: CodeMethod) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // init() is overloaded per literal method, so the union has to be split.
      if (method === "sms") await init({ method: "sms" });
      else await init({ method: "totp" });
      setSelected(method);
    } catch {
      setError("Impossible de démarrer la vérification. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ method: selected, mfaCode: code.trim() });
      close();
    } catch (failure) {
      // Each of these needs a different move from the person holding the phone,
      // so they must not collapse into one "try again".
      if (errorIndicatesMfaVerificationFailed(failure)) {
        setError("Code incorrect. Saisis le code affiché en ce moment.");
      } else if (errorIndicatesMaxMfaRetries(failure)) {
        setError("Trop de tentatives. Recommence la vérification.");
        setSelected(null);
      } else if (errorIndicatesMfaTimeout(failure)) {
        setError("Délai dépassé. Recommence la vérification.");
        setSelected(null);
      } else {
        setError("Vérification non aboutie. Réessaie.");
      }
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    cancel();
    close();
  };

  const usable = methods.filter(isCodeMethod);

  return (
    <Modal visible={methods.length > 0} transparent animationType="fade" onRequestClose={dismiss}>
      <View className="flex-1 items-center justify-center bg-black/80 px-6">
        <View className="w-full max-w-[340px] rounded-3xl border border-white/10 bg-[#0B0B0B] p-6">
          <Text className="text-white text-lg font-semibold">Confirme que c&apos;est bien toi</Text>
          <Text className="text-white/55 text-sm leading-5 mt-2">
            Cette opération demande ton second facteur.
          </Text>

          {usable.length === 0 ? (
            <Text className="text-amber-300/80 text-xs leading-5 mt-4">
              Le second facteur demandé ne peut pas être validé depuis cet écran. Ouvre
              Sécurité pour configurer une application d&apos;authentification.
            </Text>
          ) : !selected ? (
            usable.map((method) => (
              <Pressable
                key={method}
                disabled={busy}
                onPress={() => choose(method)}
                accessibilityRole="button"
                className="mt-4 rounded-2xl border border-white/15 p-4"
                style={{ opacity: busy ? 0.4 : 1 }}
              >
                <Text className="text-white text-center">{LABELS[method]}</Text>
              </Pressable>
            ))
          ) : (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="Code à 6 chiffres"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="number-pad"
                autoFocus
                maxLength={8}
                className="mt-4 rounded-2xl border border-white/20 px-4 py-4 text-lg text-white"
              />
              <Pressable
                disabled={busy || code.trim().length < 6}
                onPress={verify}
                accessibilityRole="button"
                className="mt-4 rounded-2xl p-4"
                style={{ backgroundColor: COLORS.accent, opacity: busy || code.trim().length < 6 ? 0.4 : 1 }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={COLORS.black} />
                ) : (
                  <Text className="text-black text-center font-semibold">Valider</Text>
                )}
              </Pressable>
            </>
          )}

          {!!error && <Text accessibilityRole="alert" className="text-red-400 text-xs mt-3">{error}</Text>}

          <Pressable onPress={dismiss} accessibilityRole="button" className="mt-4">
            <Text className="text-white/50 text-center text-sm">Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
