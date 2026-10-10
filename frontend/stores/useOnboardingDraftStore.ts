import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearDraft,
  pruneDrafts,
  readDraft,
  saveDraft,
  type OnboardingDraft,
  type OnboardingDrafts,
} from "../utils/onboardingDraft";

/**
 * The @handle and account name typed on the identity step, per Privy user.
 * See utils/onboardingDraft.ts. Local only, like the account registry: it is
 * not registered with `onAccountReset`, because signing out from the identity
 * step must keep the draft.
 */
interface OnboardingDraftState {
  drafts: OnboardingDrafts;
  save: (userId: string, values: { handle: string; accountName: string }) => void;
  read: (userId: string | null | undefined) => OnboardingDraft | null;
  clear: (userId: string) => void;
}

export const useOnboardingDraftStore = create<OnboardingDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      save: (userId, values) =>
        set((state) => ({ drafts: saveDraft(state.drafts, userId, values, Date.now()) })),
      read: (userId) => readDraft(get().drafts, userId, Date.now()),
      clear: (userId) => set((state) => ({ drafts: clearDraft(state.drafts, userId) })),
    }),
    {
      name: "atara.onboardingDraft.v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ drafts: state.drafts }),
      // Old drafts are dropped as soon as the stored list is loaded.
      merge: (persisted, current) => ({
        ...current,
        drafts: pruneDrafts((persisted as { drafts?: unknown } | undefined)?.drafts, Date.now()),
      }),
    },
  ),
);
