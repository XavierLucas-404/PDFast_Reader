import { Text, TextInput } from "./Typography";
import { m, renderMessage, type MessageValue } from "./i18n";
import { useI18n } from "./i18n/react";
import { t, AppError } from "./i18n";
import { colors, serif } from "./theme";
import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { backend, rpc } from "./backend";
import {
  AUTH_REDIRECT,
  RECOVERY_REDIRECT,
  authError,
  errorMessage,
  credentials,
} from "./authLogic";
export function AuthPanel({
  recovery,
  onRecovered,
  needsUsername,
  onProfile,
}: {
  recovery: boolean;
  onRecovered: () => void;
  needsUsername: boolean;
  onProfile: () => Promise<void>;
}) {
  useI18n();

  const [screen, setScreen] = useState<
    "login" | "signup" | "confirm" | "forgot"
  >("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<MessageValue>(""),
    [error, setError] = useState<MessageValue>("");
  const change = (next: typeof screen) => {
    setScreen(next);
    setPassword("");
    setRepeat("");
    setNotice("");
    setError("");
  };
  async function execute(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!backend) throw new AppError("errors.authUnavailable");
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, fn: () => void, secondary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy}
      onPress={fn}
      style={[s.button, secondary && s.secondary, busy && { opacity: 0.5 }]}
    >
      <Text style={secondary ? s.link : s.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  const field = (
    label: string,
    value: string,
    set: (s: string) => void,
    kind: "email" | "password" | "username",
  ) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={set}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={kind === "password"}
        keyboardType={kind === "email" ? "email-address" : "default"}
        textContentType={
          kind === "email"
            ? "emailAddress"
            : kind === "username"
              ? "username"
              : screen === "signup" || recovery
                ? "newPassword"
                : "password"
        }
        autoComplete={
          kind === "email"
            ? "email"
            : kind === "username"
              ? "username"
              : screen === "signup" || recovery
                ? "new-password"
                : "current-password"
        }
        editable={!busy}
      />
    </View>
  );
  return (
    <View style={s.card}>
      <Text style={s.title}>
        {recovery
          ? t("auth.newPasswordTitle")
          : needsUsername
            ? t("auth.usernameTitle")
            : screen === "login"
              ? t("auth.login")
              : screen === "signup"
                ? t("auth.signup")
                : screen === "confirm"
                  ? t("auth.confirmEmail")
                  : t("auth.forgotTitle")}
      </Text>
      {!backend && <Text style={s.body}>{t("auth.unavailable")}</Text>}
      {recovery ? (
        <>
          {field(t("auth.newPasswordMin"), password, setPassword, "password")}
          {field(t("auth.confirmNewPassword"), repeat, setRepeat, "password")}
          {button(
            t("auth.savePassword"),
            () =>
              void execute(async () => {
                if (password.length < 8)
                  throw new AppError("errors.weakPassword");
                if (password !== repeat)
                  throw new AppError("errors.passwordMismatch");
                const { error } = await backend!.auth.updateUser({ password });
                if (error) throw error;
                setPassword("");
                setRepeat("");
                onRecovered();
              }),
          )}
          {button(
            t("auth.cancelSignOut"),
            () =>
              void execute(async () => {
                const { error } = await backend!.auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
                onRecovered();
              }),
            true,
          )}
        </>
      ) : needsUsername ? (
        <>
          <Text style={s.body}>{t("auth.usernameHint")}</Text>
          {field(t("auth.username"), username, setUsername, "username")}
          {button(
            t("auth.saveUsername"),
            () =>
              void execute(async () => {
                const value = username.trim().toLowerCase();
                if (!/^[a-z0-9_]{3,24}$/.test(value))
                  throw new AppError("auth.usernameRule");
                await rpc("set_username", { p_username: value });
                await onProfile();
              }),
          )}
        </>
      ) : (
        <>
          {screen === "confirm" ? (
            <Text style={s.body}>{t("auth.confirmSent", { email })}</Text>
          ) : (
            <>
              {field(t("common.email"), email, setEmail, "email")}
              {(screen === "login" || screen === "signup") &&
                field(t("common.password"), password, setPassword, "password")}
              {screen === "signup" &&
                field(t("auth.confirmPassword"), repeat, setRepeat, "password")}
            </>
          )}
          {screen === "login" && (
            <>
              {button(
                t("auth.login"),
                () =>
                  void execute(async () => {
                    const { error } = await backend!.auth.signInWithPassword({
                      email: credentials(email),
                      password,
                    });
                    if (error) throw error;
                    setPassword("");
                  }),
              )}
              {button(t("auth.signup"), () => change("signup"), true)}
              {button(t("auth.forgot"), () => change("forgot"), true)}
              {button(
                t("auth.resendEmail"),
                () =>
                  void execute(async () => {
                    const { error } = await backend!.auth.resend({
                      type: "signup",
                      email: credentials(email),
                      options: { emailRedirectTo: AUTH_REDIRECT },
                    });
                    if (error) throw error;
                    setNotice(m("auth.resent"));
                  }),
                true,
              )}
            </>
          )}
          {screen === "signup" &&
            button(
              t("auth.signup"),
              () =>
                void execute(async () => {
                  const normalized = credentials(email, password);
                  if (password !== repeat)
                    throw new AppError("errors.passwordMismatch");
                  const { error } = await backend!.auth.signUp({
                    email: normalized,
                    password,
                    options: { emailRedirectTo: AUTH_REDIRECT },
                  });
                  if (error) throw error;
                  setEmail(normalized);
                  setPassword("");
                  setRepeat("");
                  setScreen("confirm");
                }),
            )}
          {screen === "confirm" &&
            button(
              t("auth.resend"),
              () =>
                void execute(async () => {
                  const { error } = await backend!.auth.resend({
                    type: "signup",
                    email: credentials(email),
                    options: { emailRedirectTo: AUTH_REDIRECT },
                  });
                  if (error) throw error;
                  setNotice(m("auth.resent"));
                }),
            )}
          {screen === "forgot" && (
            <>
              <Text style={s.body}>{t("auth.recoveryHint")}</Text>
              {button(
                t("auth.sendRecovery"),
                () =>
                  void execute(async () => {
                    const { error } = await backend!.auth.resetPasswordForEmail(
                      credentials(email),
                      { redirectTo: RECOVERY_REDIRECT },
                    );
                    if (error) throw error;
                    setNotice(m("auth.recoverySent"));
                  }),
              )}
            </>
          )}
          {screen !== "login" &&
            button(t("auth.backLogin"), () => change("login"), true)}
          <Text style={s.body}>{t("auth.privacy")}</Text>
        </>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {renderMessage(notice)}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {renderMessage(error)}
        </Text>
      )}
      {busy && <Text style={s.body}>{t("common.wait")}</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: serif,
    fontSize: 23,
    fontWeight: "700",
    color: colors.ink,
  },
  label: { fontSize: 15, color: colors.ink, marginBottom: 6 },
  body: { fontSize: 16, color: colors.muted, lineHeight: 23 },
  input: {
    minHeight: 48,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    color: colors.ink,
  },
  button: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.wine,
    borderRadius: 12,
    padding: 12,
  },
  secondary: { backgroundColor: colors.soft },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "600" },
  link: { color: colors.ink, fontSize: 16 },
  error: { color: colors.wine, fontSize: 16, lineHeight: 23 },
});
