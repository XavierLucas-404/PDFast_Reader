import React from "react";
import { View } from "react-native";
import { colors } from "./theme";

export function EditProfileIcon() {
  const color = colors.wine;
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: 26, height: 26 }}
    >
      <View
        style={{
          position: "absolute",
          left: 2,
          top: 5,
          width: 20,
          height: 19,
          borderLeftWidth: 1.6,
          borderBottomWidth: 1.6,
          borderColor: color,
          borderBottomLeftRadius: 5,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 5,
          top: 5,
          width: 8,
          borderTopWidth: 1.6,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 4,
          top: 13,
          height: 9,
          borderRightWidth: 1.6,
          borderColor: color,
          borderBottomRightRadius: 4,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 10,
          top: 5,
          width: 16,
          height: 5,
          borderWidth: 1.6,
          borderRadius: 1,
          borderColor: color,
          transform: [{ rotate: "-45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 9,
          top: 13,
          width: 4,
          height: 4,
          borderLeftWidth: 1.6,
          borderBottomWidth: 1.6,
          borderColor: color,
          transform: [{ skewX: "-12deg" }],
        }}
      />
    </View>
  );
}
