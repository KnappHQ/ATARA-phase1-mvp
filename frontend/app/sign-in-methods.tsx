import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, Plus } from "lucide-react-native";

import { AccountNameSheet } from "@/components/accounts/AccountNameSheet";
import { ConfirmSheet } from "@/components/accounts/ConfirmSheet";
import { usePasskeyManagement } from "@/hooks/usePasskeyManagement";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { COLORS } from "@/utils/constants";
import { suggestPasskeyName } from "@/utils/accountLabels";
import { REGISTRY_VERSION, labelsInUse, passkeyNamesInUse, verifiedCredentialIds } from "@/utils/accountRegistry";
import { REMOVAL_REFUSAL_TEXT, assessPasskeyRemoval, type PasskeySummary } from "@/utils/loginMethods";

const formatDay = (millis?: number | null): string | null =>
  millis
    ? new Date(millis).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

/** Privy reports seconds. */
const fromPrivy = (seconds?: number | null): number | null => (seconds ? seconds * 1000 : null);

const Body = ({ children }: { children: React.ReactNode }) => (
  <Text className="mb-2 text-sm leading-5 text-white/65">{children}</Text>
);

const SmallButton = ({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    className="min-h-11 items-center justify-center rounded-2xl border border-white/10 px-4"
    style={{ backgroundColor: `${COLORS.white}05`, opacity: disabled ? 0.4 : 1 }}
  >
    <Text className="text-[13px] font-medium" style={{ color: danger ? "#f87171" : COLORS.white }}>
      {label}
    </Text>
  </Pressable>
);

export default function SignInMethodsScreen() {
  const router = useRouter();
  const { isAvailable, account, passkeys, methods, privyUser, add, test, remove, hasDomain } = usePasskeyManagement();
  const accounts = useAccountRegistryStore((state) => state.accounts);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [naming, setNaming] = useState(false);
  const [removing, setRemoving] = useState<PasskeySummary | null>(null);

  const registry = useMemo(() => ({ version: REGISTRY_VERSION, accounts }), [accounts]);
  const takenNames = useMemo(() => [...labelsInUse(registry), ...passkeyNamesInUse(registry)], [registry]);
  const otherMethods = methods.filter((method) => method.kind !== "passkey");
  const hasLegacy = passkeys.some(
    (passkey) => !account?.passkeys.find((record) => record.credentialId === passkey.credentialId)?.name,
  );

  const nameOf = (passkey: PasskeySummary) =>
    account?.passkeys.find((record) => record.credentialId === passkey.credentialId)?.name ?? null;

  const runTest = async (passkey: PasskeySummary) => {
    if (busy) return;
    setBusy(passkey.credentialId);
    setMessage(null);
    const result = await test(passkey.credentialId);
    setBusy(null);
    setMessage(
      result.ok
        ? { tone: "ok", text: "This passkey works on this iPhone." }
        : { tone: "warn", text: result.message },
    );
  };

  const askRemove = (passkey: PasskeySummary) => {
    if (busy || !account) return;
    setMessage(null);
    const assessment = assessPasskeyRemoval({
      user: privyUser,
      credentialId: passkey.credentialId,
      verifiedCredentialIds: verifiedCredentialIds(account),
    });
    if (!assessment.allowed) {
      setMessage({ tone: "warn", text: REMOVAL_REFUSAL_TEXT[assessment.reason] });
      return;
    }
    setRemoving(passkey);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const name = nameOf(removing);
    const outcome = await remove(removing.credentialId);
    if (!outcome.ok) {
      if (outcome.reason === "refused") throw new Error(REMOVAL_REFUSAL_TEXT[outcome.assessment.reason]);
      if (outcome.reason === "not-confirmed") {
        throw new Error("ATARA could not confirm that the passkey was removed. Check this screen again in a moment.");
      }
      throw new Error(outcome.message || "The passkey could not be removed. Nothing was changed.");
    }
    setRemoving(null);
    setMessage({
      tone: "ok",
      text: `Passkey removed from this account's sign-in methods. iOS still keeps its own copy${
        name ? ` (“${name}”)` : ""
      }: to delete it, open Settings › Passwords, find it and delete it.`,
    });
  };

  const addNamed = async (label: string) => {
    const result = await add(label);
    if (!result.ok) {
      if (result.cancelled) {
        setNaming(false);
        setMessage({ tone: "warn", text: result.message });
        return;
      }
      throw new Error(result.message);
    }
    setNaming(false);
    setMessage({ tone: "ok", text: `Passkey “${result.label}” added and working on this iPhone.` });
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center gap-4 px-6 py-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <ArrowLeft color="white" />
        </Pressable>
        <Text className="text-xl font-semibold text-white">Passkeys & sign-in</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        {!isAvailable ? (
          <Text className="text-sm leading-5 text-white/55">
            Sign-in methods are managed for accounts created with a passkey, Google or Apple. This account has no
            active sign-in session on this iPhone, so there is nothing to manage here.
          </Text>
        ) : (
          <>
            <Text className="mb-5 text-sm leading-5 text-white/55">
              How you sign in to “{account?.label}”. Passkeys are kept by iOS, not by ATARA: ATARA can list, test and
              unlink them, and cannot rename or delete what iOS stores.
            </Text>

            {message ? (
              <Text
                accessibilityRole="alert"
                className="mb-4 text-sm leading-5"
                style={{ color: message.tone === "ok" ? "#6ee7b7" : "#fbbf24" }}
              >
                {message.text}
              </Text>
            ) : null}

            <Text className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-white/40">Passkeys</Text>
            {passkeys.length === 0 ? (
              <Text className="mb-4 text-sm text-white/50">No passkey is linked to this account.</Text>
            ) : null}
            {passkeys.map((passkey) => {
              const record = account?.passkeys.find((item) => item.credentialId === passkey.credentialId);
              const name = record?.name ?? null;
              const created = formatDay(record?.createdAt) ?? formatDay(fromPrivy(passkey.firstVerifiedAt));
              const lastUsed = formatDay(fromPrivy(passkey.latestVerifiedAt));
              const checked = formatDay(record?.verifiedAt);
              const where = [passkey.authenticatorName, passkey.device, passkey.os].filter(Boolean).join(" · ");
              const isBusy = busy === passkey.credentialId;
              return (
                <View key={passkey.credentialId} className="mb-3 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <View className="flex-row items-center gap-3">
                    <KeyRound size={18} color={COLORS.accent} />
                    <Text className="flex-1 text-base font-semibold text-white">
                      {name ?? "Passkey created before names existed"}
                    </Text>
                  </View>
                  {!name ? (
                    <Text className="mt-2 text-xs leading-4 text-white/45">
                      iOS probably lists it as “ATARA”. ATARA cannot read or change the name iOS gave it.
                    </Text>
                  ) : null}
                  <Text className="mt-2 text-xs leading-4 text-white/45">
                    {[created ? `Created ${created}` : null, lastUsed ? `Last used ${lastUsed}` : null, where || null]
                      .filter(Boolean)
                      .join(" · ") || "No details from the provider"}
                  </Text>
                  <Text className="mt-1 text-xs leading-4" style={{ color: checked ? "#6ee7b7" : "#fbbf24" }}>
                    {checked ? `Checked on this iPhone ${checked}` : "Not checked on this iPhone yet"}
                  </Text>
                  <View className="mt-4 flex-row gap-2">
                    <SmallButton label={isBusy ? "Waiting for iOS…" : "Test"} onPress={() => runTest(passkey)} disabled={!!busy} />
                    <SmallButton label="Remove" onPress={() => askRemove(passkey)} disabled={!!busy} danger />
                  </View>
                  {isBusy ? <ActivityIndicator className="mt-3" size="small" color={COLORS.accent} /> : null}
                </View>
              );
            })}

            {otherMethods.length > 0 ? (
              <>
                <Text className="mb-3 mt-4 text-xs font-semibold uppercase tracking-[1.5px] text-white/40">
                  Other ways to sign in
                </Text>
                {otherMethods.map((method) => (
                  <View key={method.id} className="mb-3 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <Text className="text-base font-semibold text-white">{method.label}</Text>
                    <Text className="mt-1 text-xs text-white/45">Linked to this account.</Text>
                  </View>
                ))}
              </>
            ) : null}

            <Pressable
              onPress={() => setNaming(true)}
              disabled={!!busy || !hasDomain}
              accessibilityRole="button"
              className="mt-2 min-h-12 flex-row items-center justify-center gap-2 rounded-2xl"
              style={{ backgroundColor: COLORS.accent, opacity: busy || !hasDomain ? 0.4 : 1 }}
            >
              <Plus size={18} color={COLORS.black} />
              <Text className="text-sm font-semibold text-black">Add a named passkey</Text>
            </Pressable>
            <Text className="mt-3 text-xs leading-5 text-white/40">
              iOS decides whether a second passkey can exist for this account on this iPhone. It may refuse, to keep the
              first one from being replaced; nothing changes if it does.
            </Text>

            {hasLegacy ? (
              <View className="mt-6 rounded-3xl border border-white/10 p-5">
                <Text className="text-base font-semibold text-white">Passkeys created before names existed</Text>
                <Text className="mt-2 text-sm leading-5 text-white/55">
                  Earlier versions of ATARA gave every passkey the same name, which is why iOS lists several entries
                  as “ATARA”. ATARA now knows which account each of these belongs to, because Privy lists them under
                  it, and it offers only that passkey when you switch to the account.
                </Text>
                <Text className="mt-2 text-sm leading-5 text-white/55">
                  ATARA cannot rename them inside iOS. Nothing is deleted or recreated, and your wallet is unchanged.
                </Text>
              </View>
            ) : null}

            <Text className="mt-6 text-xs leading-5 text-white/40">
              Removing a passkey here stops it from signing in to this account. It needs another way in that is known to
              work: a Google or Apple account, or a passkey you have tested on this iPhone. If you set up a second factor,
              you may be asked for it.
            </Text>
          </>
        )}
      </ScrollView>

      <AccountNameSheet
        isOpen={naming}
        title="Name this passkey"
        description="iOS will list the new passkey under this name. It stays on this iPhone and in iOS: ATARA never receives it."
        initialValue={account ? suggestPasskeyName(account.label, takenNames) : ""}
        confirmLabel="Continue"
        taken={takenNames}
        footnote="iOS will then ask you to confirm with Face ID, Touch ID or your passcode."
        onCancel={() => setNaming(false)}
        onConfirm={addNamed}
      />

      <ConfirmSheet
        isOpen={!!removing}
        title="Remove this passkey?"
        destructive
        confirmLabel="Remove passkey"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      >
        <Body>
          {removing && nameOf(removing) ? `“${nameOf(removing)}”` : "This passkey"} will no longer be able to sign in to
          this account.
        </Body>
        <Body>
          Your account, your wallet and your funds are not touched. iOS keeps its copy of the passkey until you delete
          it yourself in Settings › Passwords, and ATARA cannot do that for you.
        </Body>
      </ConfirmSheet>
    </SafeAreaView>
  );
}
