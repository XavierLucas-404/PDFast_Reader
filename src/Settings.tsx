import { Support } from "./Support";
import { DisclosureArrow } from "./DisclosureArrow";
import { Text, TextInput } from "./Typography";
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, Keyboard } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LanguagePicker, useI18n } from "./i18n/react";
import { t } from "./i18n";
import { IconButton } from "./IconButton";
import { colors as c } from "./theme";
import { ReaderPaletteContext } from "./readerAppearance";
import {
  hsvColor,
  colorHsv,
  readerPalette,
  readerDefaults,
  readerPresets,
  validColor,
  type ReaderColors,
} from "./readerPalette";
function ColorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value),
    [h, setH] = useState(0),
    [s, setS] = useState(1),
    [v, setV] = useState(1),
    [width, setWidth] = useState(240);
  useEffect(() => {
    setDraft(value);
    const next = colorHsv(value);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, [value]);
  const hue = (x: number) => {
    const next = Math.max(0, Math.min(359, (x / width) * 360));
    setH(next);
    onChange(hsvColor(next, s, v));
  };
  const shade = (x: number, y: number) => {
    const a = Math.max(0, Math.min(1, x / width)),
      b = 1 - Math.max(0, Math.min(1, y / 120));
    setS(a);
    setV(b);
    onChange(hsvColor(h, a, b));
  };
  const hueGesture = Gesture.Simultaneous(
    Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => hue(e.x))
      .onUpdate((e) => hue(e.x)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => hue(e.x)),
  );
  const shadeGesture = Gesture.Simultaneous(
    Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => shade(e.x, e.y))
      .onUpdate((e) => shade(e.x, e.y)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => shade(e.x, e.y)),
  );
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            backgroundColor: value,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 8,
          }}
        />
        <TextInput
          accessibilityLabel={label + " HEX"}
          value={draft}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          style={styles.input}
          onChangeText={(text) => {
            setDraft(text);
            if (validColor(text)) onChange(text.toUpperCase());
          }}
        />
      </View>
      {!validColor(draft) && (
        <Text style={styles.warning}>{t("settings.invalidColor")}</Text>
      )}
      <GestureDetector gesture={hueGesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("settings.hue", { label })}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const next =
              (h + (e.nativeEvent.actionName === "increment" ? 15 : 345)) % 360;
            setH(next);
            onChange(hsvColor(next, s, v));
          }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{
            height: 44,
            flexDirection: "row",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <View
              key={i}
              style={{ flex: 1, backgroundColor: hsvColor(i * 15, 1, 1) }}
            />
          ))}
        </View>
      </GestureDetector>
      <GestureDetector gesture={shadeGesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("settings.shade", { label })}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const next = Math.max(
              0,
              Math.min(
                1,
                v + (e.nativeEvent.actionName === "increment" ? 0.1 : -0.1),
              ),
            );
            setV(next);
            onChange(hsvColor(h, s, next));
          }}
          style={{ height: 120, overflow: "hidden", borderRadius: 8 }}
        >
          {Array.from({ length: 8 }, (_, row) => (
            <View key={row} style={{ flex: 1, flexDirection: "row" }}>
              {Array.from({ length: 16 }, (_, col) => (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    backgroundColor: hsvColor(h, col / 15, 1 - row / 7),
                  }}
                />
              ))}
            </View>
          ))}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: Math.min(width - 12, s * width - 6),
              top: Math.min(108, (1 - v) * 120 - 6),
              width: 12,
              height: 12,
              borderWidth: 2,
              borderColor: "#fff",
              borderRadius: 6,
              backgroundColor: "#0005",
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
export function Settings({
  value,
  onChange,
  onBack,
}: {
  value: ReaderColors;
  onChange: (value: ReaderColors) => void;
  onBack: () => void;
}) {
  useI18n();
  const palette = readerPalette(value);
  const [expanded, setExpanded] = useState<keyof ReaderColors | null>(null);
  const apply = (colors: ReaderColors) => {
    Keyboard.dismiss();
    setExpanded(null);
    onChange(colors);
  };
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton icon="back" label={t("common.back")} onPress={onBack} />
        <Text style={styles.title}>{t("settings.title")}</Text>
      </View>
      <LanguagePicker />
      <Text style={styles.title}>{t("reader.wordMode")}</Text>
      <View
        style={[
          styles.card,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "600",
            textAlign: "center",
            color: palette.word,
          }}
        >
          {t("settings.preview")}
        </Text>
        <ReaderPaletteContext.Provider value={palette}>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <IconButton
              primary
              icon="play"
              label={t("settings.preview")}
              onPress={() => {}}
            />
            <IconButton
              icon="forward"
              label={t("settings.preview")}
              onPress={() => {}}
            />
          </View>
        </ReaderPaletteContext.Provider>
      </View>
      {palette.lowContrast && (
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {t("settings.lowContrast")}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(readerPresets).map(([key, p]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="button"
            onPress={() => apply(p)}
            accessibilityState={{
              selected:
                value.background.toUpperCase() === p.background.toUpperCase() &&
                value.word.toUpperCase() === p.word.toUpperCase(),
            }}
            style={styles.button}
          >
            <Text style={styles.label}>
              {t(("settings." + key) as "settings.original")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {(["background", "word"] as const).map((key) => {
        const label = t(
          key === "background" ? "settings.background" : "settings.word",
        );
        return (
          <View key={key} style={{ gap: 8 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityValue={{ text: value[key] }}
              accessibilityState={{ expanded: expanded === key }}
              onPress={() => {
                Keyboard.dismiss();
                setExpanded(expanded === key ? null : key);
              }}
              style={[
                styles.button,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                },
              ]}
            >
              <View
                accessible={false}
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: value[key],
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 6,
                }}
              />
              <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
              <Text style={{ color: c.muted, fontSize: 14 }}>{value[key]}</Text>
              <DisclosureArrow expanded={expanded === key} />
            </TouchableOpacity>
            {expanded === key && (
              <ColorEditor
                label={label}
                value={value[key]}
                onChange={(color) => onChange({ ...value, [key]: color })}
              />
            )}
          </View>
        );
      })}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.button}
        onPress={() => apply(readerDefaults)}
      >
        <Text style={styles.label}>{t("settings.reset")}</Text>
      </TouchableOpacity>
      <Support />
    </View>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: c.ink },
  label: { fontSize: 16, fontWeight: "600", color: c.ink },
  card: {
    padding: 16,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: 18,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    color: c.ink,
  },
  warning: { color: c.wine, fontSize: 14 },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.soft,
    justifyContent: "center",
  },
});
