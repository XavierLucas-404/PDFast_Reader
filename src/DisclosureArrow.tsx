import React from "react";
import { View } from "react-native";
import { colors } from "./theme";

export function DisclosureArrow({ expanded }: { expanded: boolean }) {
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 9,
          height: 9,
          borderRightWidth: 1.7,
          borderBottomWidth: 1.7,
          borderColor: colors.wine,
          transform: [{ rotate: expanded ? "225deg" : "45deg" }],
        }}
      />
    </View>
  );
}
