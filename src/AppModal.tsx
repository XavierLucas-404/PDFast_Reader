import { Text } from "./Typography";
import React, { useEffect, useId, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors as c, serif } from "./theme";
import { t } from "./i18n";
import { useI18n } from "./i18n/react";
import {
  closeDialog,
  registerModal,
  useDialogs,
  modalPresentationDelay,
} from "./dialogState";
export { appAlert } from "./dialogState";
export const modalStyles = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 24, fontWeight: "700", color: c.ink },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.soft,
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: c.wine },
  body: { fontSize: 16, lineHeight: 24, color: c.ink },
});
function DialogCard() {
  useI18n();
  const state = useDialogs(),
    dialog = state.dialogs[0];
  if (!dialog) return null;
  const cancel = () =>
    closeDialog(dialog.actions.find((a) => a.style === "cancel"));
  return (
    <SafeAreaView
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 1000, justifyContent: "center", padding: 22 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        onPress={cancel}
        style={[StyleSheet.absoluteFill, { backgroundColor: "#0008" }]}
      />
      <View accessibilityViewIsModal style={styles.card}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={modalStyles.title}>{dialog.title}</Text>
          {!!dialog.message && (
            <Text style={modalStyles.body}>{dialog.message}</Text>
          )}
          {dialog.actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              accessibilityRole="button"
              style={modalStyles.button}
              onPress={() => closeDialog(a)}
            >
              <Text
                style={[
                  modalStyles.buttonText,
                  a.style === "destructive" && { color: "#A62435" },
                ]}
              >
                {a.text || "OK"}
              </Text>
            </TouchableOpacity>
          ))}
          {!dialog.actions.some((a) => a.style === "cancel") && (
            <TouchableOpacity
              accessibilityRole="button"
              style={modalStyles.button}
              onPress={cancel}
            >
              <Text style={modalStyles.buttonText}>{t("common.close")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
export function AppModal({
  visible = true,
  onClose,
  children,
  scroll = true,
  isDialog = false,
}: {
  visible?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  scroll?: boolean;
  isDialog?: boolean;
}) {
  useI18n();
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    if (!visible) {
      setPresented(false);
      return;
    }
    const delay = modalPresentationDelay();
    if (!delay) {
      setPresented(true);
      return;
    }
    const timer = setTimeout(() => setPresented(true), delay);
    return () => clearTimeout(timer);
  }, [visible]);
  const id = useId(),
    state = useDialogs(),
    { height } = useWindowDimensions();
  useEffect(() => {
    if (visible && presented && !isDialog) return registerModal(id);
  }, [visible, presented, id, isDialog]);
  const top = state.modals.at(-1) === id;
  return (
    <Modal
      visible={visible && presented}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (state.dialogs.length && top)
          closeDialog(
            state.dialogs[0].actions.find((a) => a.style === "cancel"),
          );
        else onClose();
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.root}>
            {!isDialog && (
              <>
                <Pressable
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: "#0008" },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
                  onPress={onClose}
                />
                <KeyboardAvoidingView
                  style={styles.host}
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  pointerEvents="box-none"
                >
                  <View
                    accessibilityViewIsModal
                    style={[
                      styles.card,
                      { maxHeight: height * 0.88 },
                      !scroll && { height: height * 0.85 },
                    ]}
                  >
                    {scroll ? (
                      <ScrollView
                        automaticallyAdjustKeyboardInsets
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.content}
                      >
                        {children}
                      </ScrollView>
                    ) : (
                      <View style={[styles.content, { flex: 1, minHeight: 0 }]}>
                        {children}
                      </View>
                    )}
                  </View>
                </KeyboardAvoidingView>
              </>
            )}
            {top && !!state.dialogs.length && <DialogCard />}
            {isDialog && <DialogCard />}
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
export function DialogHost() {
  const state = useDialogs(),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (state.dialogs.length && !state.modals.length) {
      const timer = setTimeout(() => setReady(true), 250);
      return () => clearTimeout(timer);
    }
  }, [state.dialogs.length, state.modals.length]);
  return ready && state.dialogs.length && !state.modals.length ? (
    <AppModal
      isDialog
      onClose={() =>
        closeDialog(state.dialogs[0].actions.find((a) => a.style === "cancel"))
      }
    />
  ) : null;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center" },
  host: { flex: 1, justifyContent: "center", padding: 22 },
  card: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    backgroundColor: c.paper,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
    maxHeight: "100%",
  },
  content: { padding: 22, gap: 16 },
});
