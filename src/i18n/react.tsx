import { DisclosureArrow } from "../DisclosureArrow";
import { Text } from "../Typography";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, View, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { colors } from "../theme";
import {
  t,
  renderMessage,
  m,
  getLanguage,
  getPreference,
  getLanguageSnapshot,
  subscribeLanguage,
  setSystemLanguage,
  setLanguagePreference,
  validPreference,
  type LanguagePreference,
  type MessageValue,
} from "./index";
export const LANGUAGE_STORAGE_KEY = "pdfast.language.preference";
export function useI18n() {
  useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );
  return {
    t,
    renderMessage,
    language: getLanguage(),
    preference: getPreference(),
  };
}
export function useLanguagePreference() {
  useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      setSystemLanguage(getLocales()[0]?.languageTag || "en");
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        refresh();
        setLanguagePreference(validPreference(saved) ? saved : "system");
      })
      .catch(() => {
        if (mounted) refresh();
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return ready;
}
export function LanguagePicker() {
  const { preference } = useI18n();
  const [error, setError] = useState<MessageValue>("");
  const [open, setOpen] = useState(false);
  const code = (value: LanguagePreference) =>
    value === "system"
      ? t("common.system")
      : value === "pt"
        ? "PT-BR"
        : "EN-US";
  const languageName = (value: LanguagePreference) =>
    value === "system"
      ? t("common.system")
      : value === "pt"
        ? t("common.portugueseBrazil")
        : t("common.englishUS");
  async function choose(value: LanguagePreference) {
    setLanguagePreference(value);
    setOpen(false);
    setError("");
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch {
      setError(m("common.languageSavedError"));
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.ink, fontSize: 17 }}>
        {t("common.language")}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.language")}
        accessibilityValue={{ text: languageName(preference) }}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 48,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.soft,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>
          {code(preference)}
        </Text>
        <DisclosureArrow expanded={open} />
      </TouchableOpacity>
      {open && (
        <View
          accessibilityRole="radiogroup"
          style={{
            gap: 4,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
          }}
        >
          {(["system", "pt", "en"] as const).map((value) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={languageName(value)}
              accessibilityState={{ checked: preference === value }}
              onPress={() => void choose(value)}
              style={{
                minHeight: 44,
                padding: 12,
                borderRadius: 8,
                backgroundColor:
                  preference === value ? colors.wine : colors.surface,
              }}
            >
              <Text
                style={{
                  color: preference === value ? colors.white : colors.ink,
                  fontSize: 16,
                }}
              >
                {code(value)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.wine }}>
          {renderMessage(error)}
        </Text>
      )}
    </View>
  );
}
