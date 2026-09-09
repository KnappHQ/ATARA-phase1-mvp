import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../utils/constants";

// utils/constants.ts builds API_URL by interpolating EXPO_PUBLIC_API_URL, so a
// missing variable yields the literal string "undefined/api/v1" and every
// request fails with an unreadable network error. On a store build there is no
// console to find that in, so the misconfiguration is refused here instead -
// the same shape of guard PrivyProvider already uses for its own credentials.
//
// This lives in api.ts rather than constants.ts because that module also
// exports COLORS and CATEGORIES, imported across the whole interface: throwing
// there would take down screens that never touch the network.
const apiOrigin = process.env.EXPO_PUBLIC_API_URL;

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
      await _unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);
