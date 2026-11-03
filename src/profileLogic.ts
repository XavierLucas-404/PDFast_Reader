import { AppError } from "./i18n";
export function validateProfilePassword(password: string, repeat: string) {
  if (password.length < 8) throw new AppError("errors.weakPassword");
  if (password !== repeat) throw new AppError("errors.passwordMismatch");
}

export function profileState(
  profile: { username?: string | null } | null,
  error = "",
) {
  if (!profile) return error ? "error" : "loading";
  return profile.username ? "ready" : "needsUsername";
}
