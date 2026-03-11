import { create } from "zustand";
import * as Haptics from "expo-haptics";

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertPayload {
  type: AlertType;
  title: string;
  message?: string;
}

interface AlertState {
  alert: AlertPayload | null;
  visible: boolean;

  show: (payload: AlertPayload, duration?: number) => void;
  dismiss: () => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// Module-level timer — avoids storing non-serializable values in Zustand state
let _timer: ReturnType<typeof setTimeout> | null = null;

export const useAlertStore = create<AlertState>((set) => ({
  alert: null,
  visible: false,

  show: (payload, duration = 3500) => {
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }

    if (payload.type === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (payload.type === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (payload.type === "warning") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    set({ alert: payload, visible: true });

    _timer = setTimeout(() => {
      set({ visible: false });
      _timer = null;
    }, duration);
  },

  dismiss: () => {
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
    set({ visible: false });
  },

  success: (title, message) =>
    useAlertStore.getState().show({ type: "success", title, message }),

  error: (title, message) =>
    useAlertStore.getState().show({ type: "error", title, message }),

  warning: (title, message) =>
    useAlertStore.getState().show({ type: "warning", title, message }),

  info: (title, message) =>
    useAlertStore.getState().show({ type: "info", title, message }),
}));
