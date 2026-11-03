import {recordDiagnostic} from "./diagnostics";
import { AppError } from "./i18n";
import "react-native-url-polyfill/auto";
import "./authCrypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { offlineSession } from "./offlineSession";
import { createSecureStorage } from "./secureStorage";
import { createClient } from "@supabase/supabase-js";
export const recoveryState = {
  get: () => SecureStore.getItemAsync("pdfast.recovery"),
  set: () =>
    SecureStore.setItemAsync("pdfast.recovery", "1", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync("pdfast.recovery"),
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const sessionStorage = createSecureStorage(
  {
    getItemAsync: SecureStore.getItemAsync,
    setItemAsync: (key, value) =>
      SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    deleteItemAsync: SecureStore.deleteItemAsync,
  },
  AsyncStorage,
);
const sessionKey = `sb-${url ? new URL(url).hostname.split(".")[0] : "unconfigured"}-auth-token`;
export const readOfflineSession = (error: unknown) =>
  offlineSession(sessionStorage, sessionKey, error);
export const backend =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: sessionStorage,
          storageKey: sessionKey,
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export async function rpc(
  name: string,
  args: Record<string, unknown> = {},
  owner?: string,
) {
  if (!backend) throw new AppError("errors.configureBackend");
  const request = backend.rpc(name, args);
  if (owner) {
    const { data, error } = await backend.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== owner)
      throw new AppError("errors.accountChanged");
    // Pin each queued request to its owner even if a different account signs in mid-request.
    request.setHeader("Authorization", "Bearer " + data.session.access_token);
  }
  const { data, error } = await request;
  if (error) { recordDiagnostic(name,error); throw error; }
  return data;
}
