import { api } from "./api";
import { Contact } from "../stores/useContactStore";

export const ContactService = {
  searchContacts: async (query: string): Promise<Contact[]> => {
    try {
      const response = await api.get("/user/search", {
        params: { q: query.trim() },
      });

      return response.data.users || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return []; // No users found is not an error
      }
      throw new Error(error.response?.data?.message || "Search failed");
    }
  },

  getRecentContacts: async (): Promise<Contact[]> => {
    try {
      const response = await api.get("/user/quick-contacts");
      return response.data.contacts || [];
    } catch (error: any) {
      if (error.response?.status === 401) {
        return [];
      }

      // For non-auth errors, surface to caller so UI can show an error state.
      console.error("Failed to get recent contacts:", error);
      throw new Error(
        error.response?.data?.message || "Failed to get recent contacts",
      );
    }
  },
};
