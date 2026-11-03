import { Text } from "./Typography";
import type { MessageValue } from "./i18n";
import { formatPercent } from "./i18n";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import type { Document } from "./core";
import { progress } from "./readingStart";
import { colors } from "./theme";
import { PdfView } from "./PdfView";
import { IconButton } from "./IconButton";
import { PageNavigator } from "./PageNavigator";

export function PdfPageReader({
  document,
  page,
  onChangePage,
  onBack,
  onChooseStart,
  onPageCount,
  onError,
}: {
  document: Document;
  page: number;
  onChangePage: (page: number) => void;
  onBack: () => void;
  onChooseStart: () => void;
  onPageCount: (pages: number) => void;
  onError: (message: MessageValue) => void;
}) {
  useI18n();

  const viewport = useWindowDimensions();
  const landscape = viewport.width > viewport.height;
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setEditing(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setEditing(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  function choose() {
    Keyboard.dismiss();
    onChooseStart();
  }
  const wordButton = (
    <TouchableOpacity
      accessibilityRole="button"
      style={s.wordButton}
      onPress={choose}
    >
      <Text style={s.wordLabel}>{t("reader.wordMode")}</Text>
    </TouchableOpacity>
  );
  return (
    <KeyboardAvoidingView
      style={s.avoid}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[s.content, landscape && s.landscape, editing && s.editing]}>
        {!(editing && landscape) && (
          <View style={s.header}>
            <IconButton
              icon="back"
              label={t("reader.backLibrary")}
              onPress={() => {
                Keyboard.dismiss();
                onBack();
              }}
            />
            <Text style={s.title} numberOfLines={1} ellipsizeMode="middle">
              {document.title}
            </Text>
            {landscape ? wordButton : <View style={{ width: 48 }} />}
          </View>
        )}
        {!landscape && !editing && (
          <>
            <Text style={s.muted}>
              {t("reader.pageProgress", {
                page,
                percent: formatPercent(progress(document).percent),
              })}
            </Text>
            {wordButton}
          </>
        )}
        {/* Keep this keyed slot mounted while the keyboard changes the surrounding layout. */}
        <View key="pdf-canvas" style={s.canvas}>
          <PdfView
            uri={document.uri}
            page={page}
            onPageCount={onPageCount}
            onError={onError}
          />
        </View>
        <PageNavigator
          page={page}
          total={
            document.pageCount ||
            document.words[document.words.length - 1]?.page ||
            1
          }
          onChange={onChangePage}
          onEditing={() => setEditing(true)}
          onEditingEnd={() => setEditing(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  avoid: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0, padding: 22, gap: 14 },
  landscape: { padding: 12, gap: 8 },
  editing: { paddingVertical: 4, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    color: colors.ink,
  },
  muted: { fontSize: 14, color: colors.muted },
  wordButton: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.soft,
  },
  wordLabel: { fontSize: 16, fontWeight: "600", color: colors.ink },
  canvas: { flex: 1, minHeight: 0, overflow: "hidden" },
});
