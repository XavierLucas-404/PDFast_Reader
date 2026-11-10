import { AppModal, modalStyles } from "./AppModal";
import { EditProfileIcon } from "./EditProfileIcon";
import { Text, TextInput } from "./Typography";
import { m, renderMessage, type MessageValue } from "./i18n";
import { useI18n } from "./i18n/react";
import { t, AppError } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet, Keyboard } from "react-native";
import type { User } from "@supabase/supabase-js";
import { backend, rpc } from "./backend";
import {
  AUTH_REDIRECT,
  RECOVERY_REDIRECT,
  errorMessage,
  credentials,
} from "./authLogic";
import { validateProfilePassword } from "./profileLogic";
import { colors, serif } from "./theme";

type ManageProfileProps = {
  externalBusy: boolean;
  user: User;
  username: string | null;
  onBack: () => void;
  onProfile: () => Promise<void>;
  onSignOut: () => void;
  onDelete: () => void;
  onPageChange?: () => void;
};

export function ManageProfile(props: ManageProfileProps) {
  useI18n();
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(false);
  }, [props.user.id]);
  const navigate = (next: boolean) => {
    Keyboard.dismiss();
    setEditing(next);
    props.onPageChange?.();
  };
  if (editing)
    return (
      <EditProfileForm
        key={props.user.id}
        {...props}
        onBack={() => navigate(false)}
      />
    );
  return (
    <View style={s.container}>
      <ProfileHeader
        title={t("profile.manage")}
        onBack={props.onBack}
        disabled={props.externalBusy}
      />
      {!!props.username && (
        <>
          <Text style={s.label}>{t("auth.username")}</Text>
          <Text style={s.body}>@{props.username}</Text>
        </>
      )}
      <Text style={s.label}>{t("profile.currentEmail")}</Text>
      <Text style={s.body}>{props.user.email}</Text>
      {!!props.user.new_email && (
        <Text style={s.muted}>
          {t("profile.pendingEmail", { email: props.user.new_email })}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("profile.edit")}
        disabled={props.externalBusy}
        onPress={() => navigate(true)}
        style={[
          s.button,
          s.secondary,
          { flexDirection: "row", gap: 10, marginTop: 16 },
        ]}
      >
        <EditProfileIcon />
        <Text style={[s.buttonText, { color: colors.ink }]}>
          {t("profile.edit")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
function ProfileHeader({
  title,
  onBack,
  disabled,
  backLabel = t("profile.back"),
}: {
  title: string;
  onBack: () => void;
  disabled: boolean;
  backLabel?: string;
}) {
  return (
    <View style={s.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        disabled={disabled}
        onPress={onBack}
        style={s.back}
      >
        <Text systemFont style={s.arrow}>
          ←
        </Text>
      </TouchableOpacity>
      <Text style={s.title}>{title}</Text>
    </View>
  );
}
function EditProfileForm({
  user,
  username: initialName,
  onBack,
  onProfile,
  onSignOut,
  onDelete,
  externalBusy,
}: ManageProfileProps) {
  useI18n();

  const [username, setUsername] = useState(initialName || "");
  useEffect(() => {
    setUsername(initialName || "");
  }, [initialName]);
  const [email, setEmail] = useState(user.new_email || "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  type Field = "username" | "email" | "password";
  const [active, setActive] = useState<Field | null>(null);
  function clearDrafts() {
    setUsername(initialName || "");
    setEmail("");
    setPassword("");
    setRepeat("");
    setError("");
  }
  function closeEditor() {
    if (lock.current || externalBusy) return;
    Keyboard.dismiss();
    setActive(null);
    clearDrafts();
  }
  function openEditor(field: Field) {
    if (lock.current || externalBusy) return;
    clearDrafts();
    setNotice("");
    setActive(field);
  }
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState<MessageValue>("");
  const [error, setError] = useState<MessageValue>("");
  async function execute(fn: () => Promise<MessageValue>) {
    if (lock.current || externalBusy) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { data } = await backend!.auth.getSession();
      if (!alive.current) return;
      if (data.session?.user.id !== user.id)
        throw new AppError("errors.accountChangedManage");
      const result = await fn();
      if (alive.current) {
        Keyboard.dismiss();
        setActive(null);
        clearDrafts();
        setNotice(result);
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const button = (label: string, action: () => void, secondary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy || externalBusy}
      onPress={action}
      style={[s.button, secondary && s.secondary, busy && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.ink }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
  const row = (field: Field, label: string, value: string) => (
    <View style={s.editRow}>
      <View style={{ flex: 1, gap: 4 }}>
        {field !== "password" && <Text style={s.muted}>{label}</Text>}
        <Text style={s.body}>{value}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={busy || externalBusy}
        onPress={() => openEditor(field)}
        style={s.back}
      >
        <EditProfileIcon />
      </TouchableOpacity>
    </View>
  );
  const save = () =>
    void execute(async () => {
      if (active === "username") {
        await rpc(
          "set_username",
          { p_username: username.trim().toLowerCase() },
          user.id,
        );
        if (alive.current) await onProfile();
        return m("profile.usernameSaved");
      }
      if (active === "email") {
        const next = credentials(email);
        if (next === user.email?.toLowerCase())
          throw new AppError("errors.differentEmail");
        const { error } = await backend!.auth.updateUser(
          { email: next },
          { emailRedirectTo: AUTH_REDIRECT },
        );
        if (error) throw error;
        return m("profile.emailRequested");
      }
      validateProfilePassword(password, repeat);
      const { error } = await backend!.auth.updateUser({ password });
      if (error) throw error;
      return m("profile.passwordSaved");
    });
  return (
    <View style={s.container}>
      <ProfileHeader
        title={t("profile.edit")}
        backLabel={t("profile.backManage")}
        onBack={onBack}
        disabled={busy || externalBusy}
      />
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {renderMessage(notice)}
        </Text>
      )}
      {initialName !== null &&
        row("username", t("auth.username"), `@${initialName}`)}
      {row("email", t("profile.changeEmail"), user.email || "")}
      {!!user.new_email && (
        <Text style={s.muted}>
          {t("profile.pendingEmail", { email: user.new_email })}
        </Text>
      )}
      {row(
        "password",
        t("profile.changePassword"),
        t("profile.changePassword"),
      )}
      {button(t("common.signOut"), onSignOut, true)}
      {button(t("profile.deleteAccount"), onDelete, true)}
      {active && (
        <AppModal onClose={closeEditor}>
          <Text style={modalStyles.title}>
            {t(
              active === "username"
                ? "auth.username"
                : active === "email"
                  ? "profile.changeEmail"
                  : "profile.changePassword",
            )}
          </Text>
          {!!error && (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              {renderMessage(error)}
            </Text>
          )}
          {active === "username" && (
            <TextInput
              accessibilityLabel={t("auth.username")}
              placeholder={t("profile.usernameRule")}
              style={s.input}
              value={username}
              onChangeText={setUsername}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy && !externalBusy}
              maxLength={24}
            />
          )}
          {active === "email" && (
            <TextInput
              accessibilityLabel={t("profile.newEmail")}
              placeholder={t("profile.newEmail")}
              style={s.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy && !externalBusy}
            />
          )}
          {active === "password" && (
            <>
              <TextInput
                accessibilityLabel={t("profile.newPassword")}
                placeholder={t("profile.passwordRule")}
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy && !externalBusy}
              />
              <TextInput
                accessibilityLabel={t("profile.confirmPassword")}
                placeholder={t("profile.confirmPassword")}
                style={s.input}
                value={repeat}
                onChangeText={setRepeat}
                secureTextEntry
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy && !externalBusy}
              />
            </>
          )}
          <View style={s.actions}>
            <View style={{ flex: 1 }}>{button(t("common.save"), save)}</View>
            <View style={{ flex: 1 }}>
              {button(t("common.cancel"), closeEditor, true)}
            </View>
          </View>
          {active === "password" && (
            <TouchableOpacity
              accessibilityRole="link"
              disabled={busy || externalBusy}
              style={s.resetLink}
              onPress={() =>
                void execute(async () => {
                  const { error } = await backend!.auth.resetPasswordForEmail(
                    user.email!,
                    { redirectTo: RECOVERY_REDIRECT },
                  );
                  if (error) throw error;
                  return m("profile.resetSent");
                })
              }
            >
              <Text style={s.linkText}>{t("profile.resetPasswordEmail")}</Text>
            </TouchableOpacity>
          )}
        </AppModal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  editRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  actions: { flexDirection: "row", gap: 12 },
  resetLink: { minHeight: 44, justifyContent: "center" },
  linkText: {
    color: colors.wine,
    fontSize: 16,
    textDecorationLine: "underline",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  back: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  arrow: { fontSize: 30, color: colors.ink },
  title: { fontFamily: serif, fontSize: 26, color: colors.ink, flex: 1 },
  label: { fontSize: 16, color: colors.ink, marginTop: 12 },
  body: { fontSize: 16, color: colors.ink },
  muted: { fontSize: 14, color: colors.muted },
  error: { color: colors.wine, fontSize: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    fontSize: 17,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.wine,
    padding: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
  },
  secondary: { backgroundColor: colors.soft },
  buttonText: { color: colors.white, fontSize: 16 },
});
