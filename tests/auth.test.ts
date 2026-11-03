import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_REDIRECT,
  RECOVERY_REDIRECT,
  parseAuthLink,
  credentials,
  authError,
} from "../src/authLogic";
import { createSecureStorage } from "../src/secureStorage";
test("Auth accepts only the callback and PKCE codes; expired and token links are rejected", () => {
  assert.equal(parseAuthLink("https://example.com/callback?code=x"), null);
  assert.equal(parseAuthLink("com.pdfast.reader://evil/callback?code=x"), null);
  assert.deepEqual(parseAuthLink(AUTH_REDIRECT + "?code=abc"), {
    code: "abc",
    recovery: false,
  });
  assert.deepEqual(parseAuthLink(RECOVERY_REDIRECT + "&code=xyz"), {
    code: "xyz",
    recovery: true,
  });
  assert.throws(() => parseAuthLink(AUTH_REDIRECT + "#error_code=otp_expired"));
  assert.throws(() =>
    parseAuthLink(
      AUTH_REDIRECT + "#access_token=unexpected&refresh_token=unexpected",
    ),
  );
});
test("Credentials and localized server errors", () => {
  assert.equal(
    credentials("  TEST@example.com  ", "abcdefgh"),
    "test@example.com",
  );
  assert.throws(() => credentials("bad", "abcdefgh"));
  assert.throws(() => credentials("x@y.com", "123"));
  assert.match(authError({ code: "invalid_credentials" }), /incorretos/);
  assert.match(authError({ code: "email_not_confirmed" }), /Confirme/);
  assert.match(authError({ code: "23505" }), /já está em uso/);
  assert.match(authError({ message: "Network request failed" }), /conexão/);
  assert.match(authError({ code: "otp_expired" }), /expirou/);
});
test("Secure session survives large Unicode, migration, concurrent writes and failed replacement", async () => {
  const data = new Map<string, string>();
  let fail = false;
  const store = {
    getItemAsync: async (k: string) => data.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      assert.ok(new TextEncoder().encode(v).length <= 1500);
      if (fail && k.includes(".1.1")) throw Error("locked");
      data.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      data.delete(k);
    },
  };
  let legacy: string | null = "old-session";
  const storage = createSecureStorage(store, {
    getItem: async () => legacy,
    removeItem: async () => {
      legacy = null;
    },
  });
  assert.equal(await storage.getItem("session"), "old-session");
  assert.equal(legacy, null);
  const large = "á😎".repeat(4000);
  fail = true;
  await assert.rejects(storage.setItem("session", large));
  assert.equal(await storage.getItem("session"), "old-session");
  fail = false;
  await storage.setItem("session", large);
  assert.equal(await storage.getItem("session"), large);
  await Promise.all([
    storage.setItem("session", "first"),
    storage.setItem("session", "last"),
  ]);
  assert.equal(await storage.getItem("session"), "last");
  await storage.removeItem("session");
  assert.equal(await storage.getItem("session"), null);
});

test("expired cached sessions support offline reading only on connectivity failures, never after logout or an invalid refresh", async () => {
  const { offlineSession } = await import("../src/offlineSession");
  const cached = {
    user: { id: "00000000-0000-0000-0000-000000000001" },
    access_token: "local-test-token",
    refresh_token: "local-test-refresh",
    expires_at: 1,
  };
  let raw: string | null = JSON.stringify(cached);
  const storage = { getItem: async () => raw };
  assert.deepEqual(
    await offlineSession(storage, "key", { name: "AuthRetryableFetchError" }),
    cached,
  );
  assert.equal(
    await offlineSession(storage, "key", { code: "refresh_token_not_found" }),
    null,
  );
  raw = null;
  assert.equal(
    await offlineSession(storage, "key", { name: "AuthRetryableFetchError" }),
    null,
  );
  raw = "invalid";
  assert.equal(
    await offlineSession(storage, "key", { name: "AuthRetryableFetchError" }),
    null,
  );
});
