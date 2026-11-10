import { Text } from "./Typography";
import { AppModal, modalStyles } from "./AppModal";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import { colors, serif } from "./theme";
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import type { Document } from "./core";
import { sentenceChoices } from "./readingStart";
export function SentencePicker({
  document,
  page,
  onCancel,
  onConfirm,
  resumePosition,
}: {
  document: Document;
  page: number;
  onCancel: () => void;
  onConfirm: (start: number, defineStart?: boolean) => void;
  resumePosition?: number;
}) {
  useI18n();

  const choices = useMemo(
    () => sentenceChoices(document.words, page),
    [document.words, page],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const heading = document.words
    .filter((w) => w.page === page && w.heading)
    .map((w) => w.text)
    .join(" ");
  return (
    <AppModal onClose={onCancel} scroll={false}>
      <Text style={modalStyles.title}>{t("reader.chooseSentence")}</Text>
      <FlatList
        style={{ flex: 1, minHeight: 0 }}
        data={choices}
        keyExtractor={(item) => String(item.start)}
        contentContainerStyle={{ gap: 12, paddingVertical: 16 }}
        ListHeaderComponent={
          <>
            {heading ? <Text style={styles.heading}>{heading}</Text> : null}
            {resumePosition !== undefined ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => onConfirm(resumePosition, false)}
                style={[styles.button, { backgroundColor: colors.soft }]}
              >
                <Text>{t("reader.resumeSavedWord")}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.muted}>{t("reader.emptySentences")}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === item.start }}
            onPress={() => setSelected(item.start)}
            style={[styles.choice, selected === item.start && styles.selected]}
          >
            <Text style={styles.body}>{item.text}</Text>
            {(item.page !== page || item.endPage !== page) && (
              <Text style={styles.muted}>
                {t("reader.sentenceContinued", {
                  first: item.page,
                  last: item.endPage,
                })}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.button}
        >
          <Text>{t("common.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={selected === null}
          accessibilityState={{ disabled: selected === null }}
          style={[
            styles.button,
            {
              backgroundColor: colors.wine,
              opacity: selected === null ? 0.4 : 1,
            },
          ]}
          onPress={() => selected !== null && onConfirm(selected, false)}
        >
          <Text style={{ color: colors.white, fontWeight: "700" }}>
            {t("reader.resumeHere")}
          </Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: 22 },
  title: {
    fontFamily: serif,
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: 16,
  },
  muted: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    paddingHorizontal: 16,
  },
  heading: { fontSize: 18, fontWeight: "600", padding: 16, color: colors.ink },
  choice: {
    padding: 18,
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.wine, backgroundColor: colors.soft },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  actions: {
    flexShrink: 0,
    backgroundColor: colors.paper,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
  },
  button: {
    minHeight: 48,
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
});
