import { usePrivy } from "@privy-io/expo";

/**
 * Custom hook to safely logout from Privy
 * Use this from components inside PrivyProvider
 */
export const usePrivyLogout = () => {
  const { logout } = usePrivy();

  return async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Privy logout failed:", err);
      throw err;
    }
  };
};
