import {
  t,
  AppError,
  m,
  isMessage,
  messageForText,
  renderMessage,
  type Message,
} from "./i18n";
export const AUTH_REDIRECT = "com.pdfast.reader://auth/callback";
export const RECOVERY_REDIRECT = AUTH_REDIRECT + "?intent=recovery";
export function errorMessage(error: unknown): Message {
  if (isMessage(error)) return m(error.key, error.params);
  const e = error as { code?: string; message?: string; status?: number };
  const code = e?.code || "";
  if (code === "user_already_exists" || code === "email_exists")
    return m("errors.signup");
  if (code === "email_address_invalid") return m("errors.emailInvalid");
  if (code === "email_address_not_authorized")
    return m("errors.emailUnauthorized");
  if (/reauthentication|reauthenticate/.test(code))
    return m("errors.reauthenticate");
  if (code === "same_password") return m("errors.samePassword");
  if (code === "invalid_credentials") return m("errors.credentials");
  if (code === "email_not_confirmed") return m("errors.emailUnconfirmed");
  if (code === "23505") return m("errors.usernameTaken");
  if (code === "23514") return m("errors.usernameRule");
  if (
    /expired|otp_expired|flow_state|code_verifier/i.test(
      code + " " + e?.message,
    )
  )
    return m("errors.linkExpired");
  if (/rate_limit|too many/i.test(code + " " + e?.message) || e?.status === 429)
    return m("errors.rateLimit");
  if (/fetch|network|internet/i.test(e?.message || ""))
    return m("errors.network");
  if (/weak_password|password.*short/i.test(code + " " + e?.message))
    return m("errors.weakPassword");
  return messageForText(e?.message || "") || m("errors.generic");
}
export function authError(error: unknown): string {
  return renderMessage(errorMessage(error));
}

export function credentials(email: string, password?: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new AppError("errors.emailInvalid");
  if (password !== undefined && password.length < 8)
    throw new AppError("errors.weakPassword");
  return normalized;
}
export function parseAuthLink(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "com.pdfast.reader:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback"
  )
    return null;
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [k, v] of url.searchParams) params.set(k, v);
  if (params.has("error") || params.has("error_code"))
    throw Object.assign(new AppError("errors.linkInvalidExpired"), {
      code: params.get("error_code"),
    });
  const code = params.get("code");
  // PKCE binds links to the installation that requested them. Never accept arbitrary session tokens.
  if (!code) throw new AppError("errors.linkInvalid");
  return { code, recovery: params.get("intent") === "recovery" };
}
