import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, Pencil, Plus, Repeat, Trash2, UserMinus } from "lucide-react-native";

import { AccountNameSheet } from "@/components/accounts/AccountNameSheet";
import { ConfirmSheet } from "@/components/accounts/ConfirmSheet";
import { DeleteAccountModal } from "@/components/profile/DeleteAccountModal";
import { useAuth } from "@/providers/AuthProvider";
import {
  buildSwitchTarget,
  removeAccountFromDevice,
  startAddingAccount,
  switchToAccount,
} from "@/services/accountActions";
import { useAccountRegistryStore } from "@/stores/useAccountRegistryStore";
import { useAccountSwitchStore } from "@/stores/useAccountSwitchStore";
import { useAddressBookStore } from "@/stores/useAddressBookStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { useUnsettledPayments } from "@/hooks/useUnsettledPayments";
import { badgeFor, summarize, warningFor, type UnsettledAction } from "@/utils/unsettledPayments";
import { COLORS } from "@/utils/constants";
import { LABEL_ERROR_TEXT, shortAddress } from "@/utils/accountLabels";
import { accountAccessLines, accountHeadline, describeSwitchMethod } from "@/utils/accountDisplay";
import {
  REGISTRY_VERSION,
  displayLabel,
  findAccount,
  labelsInUse,
  type LocalAccount,
} from "@/utils/accountRegistry";

const Action = ({
  icon: Icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    className="min-h-11 flex-row items-center gap-2 rounded-2xl border border-white/10 px-3 py-2"
    style={{ backgroundColor: `${COLORS.white}05` }}
  >
    <Icon size={15} color={tone === "danger" ? "#f87171" : COLORS.accent} />
    <Text className="text-[13px] font-medium" style={{ color: tone === "danger" ? "#f87171" : COLORS.white }}>
      {label}
    </Text>
  </Pressable>
);

const Body = ({ children }: { children: React.ReactNode }) => (
  <Text className="mb-2 text-sm leading-5 text-white/65">{children}</Text>
);

export default function ManageAccountsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { user: privyUser } = usePrivy();
  const profile = useAuthStore((state) => state.user);
  const accounts = useAccountRegistryStore((state) => state.accounts);
  const assets = useWalletStore((state) => state.assets);
  const { byAccount: unsettled } = useUnsettledPayments();
  // A payment belongs to the wallet, so it is found by the account's wallet address.
  const summaryOf = (account: LocalAccount | null | undefined) =>
    account?.smartAccountAddress ? summarize(unsettled[account.smartAccountAddress.toLowerCase()], assets) : null;
  const warningsFor = (account: LocalAccount | null | undefined, action: UnsettledAction) => {
    const summary = summaryOf(account);
    return summary ? warningFor(action, summary) : [];
  };

  const [renaming, setRenaming] = useState<LocalAccount | null>(null);
  const [switching, setSwitching] = useState<LocalAccount | null>(null);
  const [removing, setRemoving] = useState<LocalAccount | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const registry = useMemo(() => ({ version: REGISTRY_VERSION, accounts }), [accounts]);
  const active = useMemo(
    () => findAccount(registry, { privyUserId: privyUser?.id, userId: profile?.id }),
    [registry, privyUser?.id, profile?.id],
  );
  const ordered = useMemo(
    () =>
      [...accounts].sort((a, b) => {
        if (a.key === active?.key) return -1;
        if (b.key === active?.key) return 1;
        return b.lastUsedAt - a.lastUsedAt;
      }),
    [accounts, active?.key],
  );
  const nameOf = (account: LocalAccount) => displayLabel(account, accounts);

  const rename = async (label: string) => {
    if (!renaming) return;
    const result = await useAccountRegistryStore.getState().rename(renaming.key, label);
    if (!result.ok) {
      throw new Error(result.reason === "unknown-account" ? "This account is no longer in the list." : LABEL_ERROR_TEXT[result.reason]);
    }
    setRenaming(null);
  };

  const renameFootnote = (account: LocalAccount) => {
    const named = account.passkeys.find((passkey) => passkey.name);
    return named
      ? `Renaming here does not rename the passkey in iOS: iOS keeps showing “${named.name}” for it.`
      : "Renaming here does not rename the passkey in iOS. ATARA cannot change a passkey's name once iOS has stored it.";
  };

  const confirmSwitch = async () => {
    if (!switching) return;
    await switchToAccount({
      target: buildSwitchTarget(switching, accounts),
      begin: useAccountSwitchStore.getState().begin,
      clear: useAccountSwitchStore.getState().clear,
      logout,
    });
    setSwitching(null);
  };

  const confirmAdd = async () => {
    await startAddingAccount({
      begin: useAccountSwitchStore.getState().begin,
      clear: useAccountSwitchStore.getState().clear,
      logout,
    });
    setAdding(false);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    await removeAccountFromDevice({
      account: removing,
      isActive: removing.key === active?.key,
      logout,
      forgetRegistryEntry: useAccountRegistryStore.getState().remove,
      forgetNicknames: useAddressBookStore.getState().forget,
    });
    setRemoving(null);
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
        <Text className="text-xl font-semibold text-white">Manage accounts</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="mb-5 text-sm leading-5 text-white/55">
          The accounts you have used on this iPhone. The name you give an account is private: it stays on this iPhone
          and ATARA never receives it. Your @handle and account name are what other people see.
        </Text>

        {!active && profile ? (
          <Text className="mb-4 text-sm text-white/50">Preparing your accounts…</Text>
        ) : null}

        {ordered.map((account) => {
          const isActive = account.key === active?.key;
          const lines = accountAccessLines(account);
          const meta = [accountHeadline(account), shortAddress(account.smartAccountAddress)].filter(Boolean).join(" · ");
          return (
            <View
              key={account.key}
              className="mb-4 rounded-3xl border p-5"
              style={{
                borderColor: isActive ? `${COLORS.accent}66` : `${COLORS.white}18`,
                backgroundColor: `${COLORS.white}05`,
              }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-lg font-semibold text-white">{nameOf(account)}</Text>
                {isActive ? (
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${COLORS.accent}22` }}>
                    <Text className="text-[11px] font-semibold" style={{ color: COLORS.accent }}>
                      Active
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-sm text-white/60">{meta}</Text>
              {lines.map((line) => (
                <Text key={line} className="mt-1 text-xs leading-4 text-white/40">
                  {line}
                </Text>
              ))}
              {summaryOf(account) ? (
                <Text className="mt-2 text-xs font-semibold leading-4" style={{ color: "#fbbf24" }}>
                  {badgeFor(summaryOf(account) as NonNullable<ReturnType<typeof summaryOf>>)}
                </Text>
              ) : null}
              {account.profileDeletedAt ? (
                <Text className="mt-2 text-xs leading-4 text-white/50">
                  The wallet and the passkey still exist. Sign in to set up a new profile for the same wallet.
                </Text>
              ) : null}

              <View className="mt-4 flex-row flex-wrap gap-2">
                <Action icon={Pencil} label="Rename" onPress={() => setRenaming(account)} />
                {!isActive ? <Action icon={Repeat} label="Switch" onPress={() => setSwitching(account)} /> : null}
                {isActive ? (
                  <Action icon={KeyRound} label="Passkeys & sign-in" onPress={() => router.push("/sign-in-methods" as never)} />
                ) : null}
                <Action icon={UserMinus} label="Remove from this iPhone" tone="danger" onPress={() => setRemoving(account)} />
                {isActive ? (
                  <Action icon={Trash2} label="Delete ATARA account" tone="danger" onPress={() => setDeleting(true)} />
                ) : null}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl"
          style={{ backgroundColor: COLORS.accent }}
        >
          <Plus size={18} color={COLORS.black} />
          <Text className="text-sm font-semibold text-black">Add another account</Text>
        </Pressable>

        <Text className="mt-6 text-xs leading-5 text-white/40">
          Removing an account from this iPhone does not delete it: its wallet, its funds and its passkey stay. Deleting
          an ATARA account needs that account to be signed in, so switch to it first.
        </Text>
      </ScrollView>

      <AccountNameSheet
        isOpen={!!renaming}
        title="Rename this account"
        description="This name helps you recognize the account on this iPhone. It stays on this iPhone: ATARA never receives it."
        initialValue={renaming?.label ?? ""}
        confirmLabel="Save name"
        taken={renaming ? labelsInUse(registry, renaming.key) : []}
        footnote={renaming ? renameFootnote(renaming) : undefined}
        onCancel={() => setRenaming(null)}
        onConfirm={rename}
      />

      <ConfirmSheet
        isOpen={!!switching}
        title={switching ? `Switch to “${nameOf(switching)}”?` : "Switch account"}
        confirmLabel="Sign out and switch"
        onCancel={() => setSwitching(null)}
        onConfirm={confirmSwitch}
      >
        <Body>
          You will be signed out of {active ? `“${nameOf(active)}”` : "this account"} on this iPhone. Its funds and data
          are not touched, and unfinished payments stay with it until you sign back in.
        </Body>
        {warningsFor(active, "switch").map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        <Body>
          Then you will sign in to {switching ? `“${nameOf(switching)}”` : "the other account"} with{" "}
          {switching ? describeSwitchMethod(buildSwitchTarget(switching, accounts).plan) : "its sign-in method"}.
        </Body>
      </ConfirmSheet>

      <ConfirmSheet
        isOpen={adding}
        title="Add another account?"
        confirmLabel="Sign out and add"
        onCancel={() => setAdding(false)}
        onConfirm={confirmAdd}
      >
        <Body>
          You will be signed out of {active ? `“${nameOf(active)}”` : "this account"} on this iPhone. It stays in this
          list, and you can switch back to it.
        </Body>
        <Body>
          Then create a new account with a passkey you name yourself, or sign in to another existing account.
        </Body>
      </ConfirmSheet>

      <ConfirmSheet
        isOpen={!!removing}
        title={removing ? `Remove “${nameOf(removing)}” from this iPhone?` : "Remove account"}
        destructive
        confirmLabel={warningsFor(removing, "remove").length ? "Remove anyway" : "Remove from this iPhone"}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      >
        <Body>
          {removing && removing.key === active?.key ? "You will be signed out. " : ""}The account is forgotten on this
          iPhone, and the contact nicknames you saved for it here are deleted. Unfinished payments are kept until they
          complete.
        </Body>
        {warningsFor(removing, "remove").map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        <Body>
          Nothing is deleted from ATARA or from the blockchain: the account, its wallet and its funds are untouched. Its
          passkey stays in iOS (Settings › Passwords) and can still sign you in.
        </Body>
      </ConfirmSheet>

      <DeleteAccountModal isOpen={deleting} onClose={() => setDeleting(false)} />
    </SafeAreaView>
  );
}
