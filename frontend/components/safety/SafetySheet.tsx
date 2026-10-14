import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { COLORS } from "@/utils/constants";
import { SafetyService } from "@/services/safety.service";
import {
  MAX_REPORT_DETAILS,
  REPORT_REASONS,
  blockConfirmText,
  emptyReport,
  reportPayload,
  reportProblem,
  reportThanks,
  safetyFailureText,
  type ReportDraft,
  type SafetyContext,
} from "@/utils/safetyFlow";

interface SafetySheetProps {
  visible: boolean;
  /** The other person's handle, with or without "@". */
  handle: string;
  context: SafetyContext;
  onClose: () => void;
  /** The person was blocked: the screen showing them should refresh. */
  onBlocked?: (handle: string) => void;
}

type Step = "menu" | "report" | "block" | "done";

/**
 * Report or block another person, from wherever they showed up: their profile, a
 * group or a note they sent. One sheet, four steps, nothing sent until a button is
 * pressed. Apple's guideline 1.2 asks for exactly this in an app where people can
 * reach each other.
 */
export const SafetySheet = ({ visible, handle, context, onClose, onBlocked }: SafetySheetProps) => {
  const [step, setStep] = useState<Step>("menu");
  const [draft, setDraft] = useState<ReportDraft>(emptyReport());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = handle.replace(/^@/, "");

  useEffect(() => {
    if (visible) {
      setStep("menu");
      setDraft(emptyReport());
      setBusy(false);
      setMessage(null);
      setError(null);
    }
  }, [visible, handle]);

  const close = () => {
    if (!busy) onClose();
  };

  const submitReport = async () => {
    const problem = reportProblem(draft);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await SafetyService.report(reportPayload(shown, draft, context));
      setMessage(reportThanks(draft.alsoBlock));
      setStep("done");
      if (draft.alsoBlock) onBlocked?.(shown);
    } catch (failure) {
      setError(safetyFailureText(failure));
    } finally {
      setBusy(false);
    }
  };

  const confirmBlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await SafetyService.block(shown);
      setMessage(`@${shown} is blocked. You can undo this in Profile > Blocked users.`);
      setStep("done");
      onBlocked?.(shown);
    } catch (failure) {
      setError(safetyFailureText(failure));
    } finally {
      setBusy(false);
    }
  };

  const Button = ({ label, onPress, tone = "plain", disabled }: { label: string; onPress: () => void; tone?: "plain" | "primary" | "danger"; disabled?: boolean }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      className="items-center justify-center rounded-2xl py-3 mt-3"
      style={{
        opacity: disabled || busy ? 0.5 : 1,
        backgroundColor: tone === "primary" ? COLORS.white : tone === "danger" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: tone === "danger" ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.12)",
      }}
    >
      <Text className="text-sm font-semibold" style={{ color: tone === "primary" ? COLORS.black : tone === "danger" ? "#fca5a5" : COLORS.white }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 bg-black/75 items-center justify-center px-6">
        <ScrollView style={{ width: "100%", maxWidth: 380, maxHeight: "90%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View className="w-full rounded-3xl border border-white/10 bg-[#111111] p-5">
            {step === "menu" && (
              <>
                <Text className="text-xl font-semibold text-white">@{shown}</Text>
                <Text className="text-sm leading-5 text-white/60 mt-2">Report a problem, or stop all contact. They are not told.</Text>
                <Button label={`Report @${shown}`} onPress={() => setStep("report")} />
                <Button label={`Block @${shown}`} tone="danger" onPress={() => setStep("block")} />
                <Button label="Cancel" onPress={close} />
              </>
            )}

            {step === "report" && (
              <>
                <Text className="text-xl font-semibold text-white">Report @{shown}</Text>
                <Text className="text-sm text-white/60 mt-2">What is the problem?</Text>
                <View className="mt-2">
                  {REPORT_REASONS.map((reason) => {
                    const selected = draft.reason === reason.value;
                    return (
                      <Pressable
                        key={reason.value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => setDraft({ ...draft, reason: reason.value })}
                        className="flex-row items-center rounded-xl px-3 py-3 mt-2"
                        style={{ backgroundColor: selected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: selected ? COLORS.white : "rgba(255,255,255,0.1)" }}
                      >
                        <Text className="text-sm text-white flex-1">{reason.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={draft.details}
                  onChangeText={(text) => setDraft({ ...draft, details: text })}
                  placeholder="Add details (optional)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  maxLength={MAX_REPORT_DETAILS}
                  className="mt-3 rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm text-white"
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: draft.alsoBlock }}
                  onPress={() => setDraft({ ...draft, alsoBlock: !draft.alsoBlock })}
                  className="flex-row items-center mt-4"
                >
                  <View className="w-5 h-5 rounded border items-center justify-center" style={{ borderColor: COLORS.white, backgroundColor: draft.alsoBlock ? COLORS.white : "transparent" }}>
                    {draft.alsoBlock ? <Text style={{ color: COLORS.black, fontSize: 12 }}>✓</Text> : null}
                  </View>
                  <Text className="text-sm text-white/80 ml-3 flex-1">Also block @{shown}</Text>
                </Pressable>
                {error ? <Text className="text-sm text-red-300 mt-3">{error}</Text> : null}
                <Button label={busy ? "Sending…" : "Send report"} tone="primary" onPress={submitReport} disabled={!draft.reason} />
                {busy ? <ActivityIndicator className="mt-3" color={COLORS.white} /> : null}
                <Button label="Back" onPress={() => setStep("menu")} />
              </>
            )}

            {step === "block" && (
              <>
                <Text className="text-xl font-semibold text-white">Block @{shown}?</Text>
                <Text className="text-sm leading-5 text-white/65 mt-2">{blockConfirmText(shown)}</Text>
                {error ? <Text className="text-sm text-red-300 mt-3">{error}</Text> : null}
                <Button label={busy ? "Blocking…" : "Block"} tone="danger" onPress={confirmBlock} />
                <Button label="Back" onPress={() => setStep("menu")} />
              </>
            )}

            {step === "done" && (
              <>
                <Text className="text-xl font-semibold text-white">Done</Text>
                <Text className="text-sm leading-5 text-white/70 mt-2">{message}</Text>
                <Button label="Close" tone="primary" onPress={onClose} />
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
