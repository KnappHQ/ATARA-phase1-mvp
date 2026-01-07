import { create } from "zustand";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertState {
  visible: boolean;
  type: AlertType;
  message: string;
  duration?: number;
  show: (type: AlertType, message: string, duration?: number) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  type: "info",
  message: "",
  duration: 3000,
  show: (type, message, duration = 3000) =>
    set({ visible: true, type, message, duration }),
  hide: () => set({ visible: false }),
}));
