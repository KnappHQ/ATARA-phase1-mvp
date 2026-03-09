import { api } from "./api";

export const FeedbackService = {
  submit: async (message: string): Promise<void> => {
    await api.post("/feedback", { message });
  },
};
