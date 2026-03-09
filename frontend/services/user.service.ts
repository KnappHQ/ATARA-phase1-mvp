import { api } from "./api";

export const UserService = {
  updateProfile: async (data: { displayName?: string }) => {
    const response = await api.patch("/user/me", data);
    return response.data.user;
  },
};
