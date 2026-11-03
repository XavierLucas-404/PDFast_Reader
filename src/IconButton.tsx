import { useReaderPalette } from "./readerAppearance";
import { colors } from "./theme";
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
export type ReaderIcon = "back" | "forward" | "play" | "pause";
export function IconButton({
  icon,
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  icon: ReaderIcon;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const palette = useReaderPalette();
  const color = primary
    ? palette?.onAccent || colors.surface
    : palette?.ink || colors.ink;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary && styles.primary,
        primary && palette && { backgroundColor: palette.accent },
        disabled && { opacity: 0.35 },
      ]}
    >
      <View accessible={false} pointerEvents="none" style={styles.glyph}>
        {icon === "play" ? (
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 10,
              borderBottomWidth: 10,
              borderLeftWidth: 16,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              borderLeftColor: color,
              marginLeft: 3,
            }}
          />
        ) : icon === "pause" ? (
          <View style={{ flexDirection: "row", gap: 5 }}>
            <View style={{ width: 5, height: 20, backgroundColor: color }} />
            <View style={{ width: 5, height: 20, backgroundColor: color }} />
          </View>
        ) : (
          <View
            style={[
              styles.arrow,
              { transform: [{ rotate: icon === "back" ? "0deg" : "180deg" }] },
            ]}
          >
            <View style={[styles.shaft, { backgroundColor: color }]} />
            <View style={[styles.chevron, { borderColor: color }]} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.wine },
  glyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { width: 24, height: 24, justifyContent: "center" },
  shaft: { height: 2, width: 21, left: 1 },
  chevron: {
    position: "absolute",
    left: 2,
    width: 12,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
});
