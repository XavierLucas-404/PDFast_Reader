import { Text, TextInput } from "./Typography";
import { AppModal, modalStyles } from "./AppModal";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import { colors, serif } from "./theme";
import React, { useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
export function RenameDocument({
  title,
  onCancel,
  onSave,
}: {
  title: string;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  useI18n();

  const [text, setText] = useState(title);
  const valid = text.trim().length > 0 && text.trim().length <= 200;
  return (
    <AppModal onClose={onCancel}>
      <Text style={modalStyles.title}>{t("library.renameDocument")}</Text>
      <Text>{t("library.renameHint")}</Text>
      <TextInput
        accessibilityLabel={t("library.documentTitle")}
        value={text}
        onChangeText={setText}
        maxLength={200}
        autoFocus
        style={styles.input}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
        disabled={!valid}
        onPress={() => onSave(text.trim())}
        style={[
          styles.button,
          { backgroundColor: colors.wine, opacity: valid ? 1 : 0.4 },
        ]}
      >
        <Text style={{ color: colors.white }}>{t("library.saveTitle")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.button}
        onPress={onCancel}
      >
        <Text>{t("common.cancel")}</Text>
      </TouchableOpacity>
    </AppModal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  title: {
    fontFamily: serif,
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  input: {
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 18,
  },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
