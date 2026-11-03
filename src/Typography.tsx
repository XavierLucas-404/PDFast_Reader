import React, { createContext, forwardRef, useContext } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from "react-native";

export const TypographyContext = createContext(false);
const NestedTextContext = createContext(false);
const WeightContext = createContext<TextStyle["fontWeight"]>("400");
export const fontFamilies = {
  400: "EBGaramond_400Regular",
  500: "EBGaramond_500Medium",
  600: "EBGaramond_600SemiBold",
  700: "EBGaramond_700Bold",
  800: "EBGaramond_800ExtraBold",
} as const;
export function fontWeight(weight: TextStyle["fontWeight"] = "400") {
  const number =
    weight === "bold" ? 700 : weight === "normal" ? 400 : Number(weight);
  return Math.max(
    400,
    Math.min(800, Math.round(number / 100) * 100),
  ) as keyof typeof fontFamilies;
}
function textStyle(style: StyleProp<TextStyle>) {
  return StyleSheet.flatten(style) || {};
}
export function fontStyle(
  loaded: boolean,
  systemFont: boolean,
  weight: TextStyle["fontWeight"],
) {
  return loaded && !systemFont
    ? {
        fontFamily: fontFamilies[fontWeight(weight)],
        fontWeight: "normal" as const,
      }
    : { fontFamily: undefined };
}
/** Source sizes are adjusted once, only where explicitly specified or at a root. */
export function readableStyle(
  style: TextStyle,
  systemFont = false,
  enhance = true,
  nested = false,
  input = false,
): TextStyle {
  if (systemFont || !enhance || (nested && style.fontSize === undefined))
    return {};
  const original = style.fontSize ?? (input ? 17 : 14);
  if (original >= 20) return {};
  const fontSize = original + 2;
  return {
    fontSize,
    ...(style.lineHeight === undefined
      ? {}
      : { lineHeight: Math.round((style.lineHeight * fontSize) / original) }),
  };
}
type FontOptions = { systemFont?: boolean; readability?: boolean };
export const Text = forwardRef<NativeText, TextProps & FontOptions>(
  function Text(
    { style, systemFont = false, readability = true, children, ...props },
    ref,
  ) {
    const loaded = useContext(TypographyContext);
    const inheritedWeight = useContext(WeightContext);
    const nested = useContext(NestedTextContext);
    const originalStyle = textStyle(style);
    const weight = originalStyle.fontWeight || inheritedWeight;
    return (
      <NativeText
        {...props}
        ref={ref}
        style={[
          style,
          fontStyle(loaded, systemFont, weight),
          readableStyle(originalStyle, systemFont, readability, nested),
        ]}
      >
        <WeightContext.Provider value={weight}>
          <NestedTextContext.Provider value={true}>
            {children}
          </NestedTextContext.Provider>
        </WeightContext.Provider>
      </NativeText>
    );
  },
);
export type TextInput = NativeTextInput;
export const TextInput = forwardRef<
  NativeTextInput,
  TextInputProps & FontOptions
>(function TextInput(
  { style, systemFont = false, readability = true, ...props },
  ref,
) {
  const loaded = useContext(TypographyContext);
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={[
        style,
        fontStyle(loaded, systemFont, textStyle(style).fontWeight),
        readableStyle(textStyle(style), systemFont, readability, false, true),
      ]}
    />
  );
});
