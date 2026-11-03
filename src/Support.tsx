import React, { useState } from "react";
import { View, TouchableOpacity, Linking, ScrollView } from "react-native";
import { Text } from "./Typography";
import { AppModal } from "./AppModal";
import { diagnosticReport } from "./diagnostics";
import { t } from "./i18n";
import { colors as c } from "./theme";
import app from "../app.json";
export function Support() {
  const [report, setReport] = useState<string | null>(null);
  const send = async (diagnostics?: string) => {
    const body = `PDFast Reader ${app.expo.version} (${app.expo.ios.buildNumber})\n\n${t("support.describe")}\n\n${diagnostics || ""}`;
    await Linking.openURL(
      "mailto:pdfastreader@box.mediaserve.ca?subject=" +
        encodeURIComponent("PDFast Reader beta feedback") +
        "&body=" +
        encodeURIComponent(body),
    );
  };
  const button = (label: string, fn: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={fn}
      style={{
        padding: 14,
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: c.soft,
      }}
    >
      <Text style={{ color: c.ink }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ gap: 12 }}>
      {button(
        t("support.help"),
        () => void send().catch(() => setReport(t("support.mailUnavailable"))),
      )}
      {button(t("support.diagnostics"), () => setReport(diagnosticReport()))}
      {report !== null && (
        <AppModal visible onClose={() => setReport(null)}>
          <Text style={{ color: c.ink, fontSize: 24 }}>
            {t("support.diagnostics")}
          </Text>
          <ScrollView>
            <Text selectable style={{ color: c.ink, fontSize: 14 }}>
              {report}
            </Text>
          </ScrollView>
          {button(
            t("support.send"),
            () =>
              void send(report).catch(() =>
                setReport(t("support.mailUnavailable")),
              ),
          )}
          {button(t("common.cancel"), () => setReport(null))}
        </AppModal>
      )}
    </View>
  );
}
