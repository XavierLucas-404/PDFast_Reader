import { colors } from "./theme";
import React from "react";
import { View } from "react-native";
export function LibraryIcon({
  kind,
  color,
}: {
  kind: "book" | "shelf";
  color: string;
}) {
  const line = { position: "absolute" as const, backgroundColor: color };
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: 26, height: 26 }}
    >
      {kind === "book" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 2,
              width: 18,
              height: 23,
              borderWidth: 2,
              borderColor: color,
              borderRadius: 2,
            }}
          />
          <View style={{ ...line, top: 3, left: 14, width: 5, height: 9 }} />
          <View
            style={{
              position: "absolute",
              left: 14,
              top: 9,
              borderLeftWidth: 2.5,
              borderRightWidth: 2.5,
              borderBottomWidth: 3,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: colors.wine,
            }}
          />
          <View style={{ ...line, left: 5, top: 20, width: 16, height: 2 }} />
        </>
      ) : (
        <>
          <View
            style={{
              position: "absolute",
              left: 2,
              top: 2,
              width: 23,
              height: 23,
              borderWidth: 1.7,
              borderRadius: 4,
              borderColor: color,
            }}
          />
          <View style={{ ...line, left: 3, top: 13, width: 21, height: 1.7 }} />
          {[7, 11].map((left) => (
            <View
              key={left}
              style={{ ...line, left, top: 6, width: 1.7, height: 5 }}
            />
          ))}
          <View
            style={{
              ...line,
              left: 16,
              top: 6,
              width: 1.7,
              height: 6,
              transform: [{ rotate: "30deg" }],
            }}
          />
          {[15, 19].map((left) => (
            <View
              key={left}
              style={{ ...line, left, top: 17, width: 1.7, height: 5 }}
            />
          ))}
        </>
      )}
    </View>
  );
}
