import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = "http://10.204.34.119:4000/api/v1";

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
  (error) => {
    if (error.response) {
      console.error(
        "API Error:",
        error.response.data.message || error.response.status
      );
    } else if (error.request) {
      console.error("Network Error: No response received");
    } else {
      console.error("Request Error:", error.message);
    }
    return Promise.reject(error);
  }
);
