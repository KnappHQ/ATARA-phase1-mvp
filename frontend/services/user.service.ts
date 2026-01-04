import { api } from "./api";

export const UserService = {
  checkHandle: async (handle: string): Promise<boolean> => {
    try {
      const response = await api.get<{ available: boolean }>(
        `/user/check-handle?handle=${handle}`
      );
      return response.data.available;
    } catch (error) {
      console.error("Check handle error", error);
      return false;
    }
  },
};
