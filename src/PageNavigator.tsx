import { Text, TextInput } from "./Typography";
import { appAlert as Alert } from "./AppModal";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import { colors } from "./theme";
import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
  Platform,
  InputAccessoryView,
} from "react-native";
import { IconButton } from "./IconButton";
export function PageNavigator({
  page,
  total,
  onChange,
  onEditing,
  onEditingEnd,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  onEditing?: () => void;
  onEditingEnd?: () => void;
}) {
  useI18n();

  const [text, setText] = useState(String(page));
  useEffect(() => setText(String(page)), [page]);
  function go() {
    const number = Number(text);
    if (
      !/^\d+$/.test(text.trim()) ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > total
    ) {
      Alert.alert(t("reader.pageInvalid"), t("reader.pageRange", { total }));
      return;
    }
    onEditingEnd?.();
    setText(String(number));
    Keyboard.dismiss();
    onChange(number);
  }
  return (
    <>
      <View style={styles.row}>
        <IconButton
          icon="back"
          label={t("reader.previousPage")}
          disabled={page <= 1}
          onPress={() => onChange(page - 1)}
        />
        <TextInput
          accessibilityLabel={t("reader.pageNumber")}
          value={text}
          onChangeText={setText}
          onFocus={onEditing}
          onBlur={onEditingEnd}
          keyboardType="number-pad"
          disableFullscreenUI
          onSubmitEditing={go}
          inputAccessoryViewID={
            Platform.OS === "ios" ? "pdfast-page-go" : undefined
          }
          selectTextOnFocus
          style={styles.input}
        />
        <Text style={{ color: colors.ink }}>
          {t("reader.ofTotal", { total })}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={go}
          style={styles.go}
        >
          <Text style={{ color: colors.ink, fontWeight: "600" }}>
            {t("reader.go")}
          </Text>
        </TouchableOpacity>
        <IconButton
          icon="forward"
          label={t("reader.nextPage")}
          disabled={page >= total}
          onPress={() => onChange(page + 1)}
        />
      </View>
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID="pdfast-page-go">
          <View
            style={{
              backgroundColor: colors.soft,
              padding: 8,
              alignItems: "flex-end",
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              onPress={go}
              style={styles.go}
            >
              <Text style={{ fontWeight: "700", color: colors.ink }}>
                {t("reader.goPage")}
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  input: {
    minWidth: 55,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    textAlign: "center",
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  go: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.soft,
  },
});
