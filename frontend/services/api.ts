import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../utils/constants";

const apiOrigin = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!apiOrigin) {
  throw new Error("Missing EXPO_PUBLIC_API_URL");
}

try {
  const parsed = new URL(apiOrigin);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("not http(s)");
  }
} catch {
  throw new Error(`Invalid EXPO_PUBLIC_API_URL: ${apiOrigin}`);
}

type LogoutFn = () => Promise<void>;
let _unauthorizedHandler: LogoutFn | null = null;
let pendingLogout: Promise<void> | null = null;

export const registerUnauthorizedHandler = (fn: LogoutFn) => {
  _unauthorizedHandler = fn;
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && _unauthorizedHandler) {
      // An anonymous sign-in failure must not log out Privy. Likewise, an old
      // account's late 401 must not invalidate a newer account's token.
      const sentAuthorization = error.config?.headers?.Authorization;
      const currentToken = await SecureStore.getItemAsync("auth_token");
      if (currentToken && sentAuthorization === `Bearer ${currentToken}`) {
        if (!pendingLogout) {
          pendingLogout = Promise.resolve().then(() => _unauthorizedHandler?.()).finally(() => { pendingLogout = null; });
        }
        await pendingLogout;
      }
    }
    return Promise.reject(error);
  },
);
