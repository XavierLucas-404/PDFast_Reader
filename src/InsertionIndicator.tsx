import React from "react";
import { View } from "react-native";

/** Occupies the existing gap without changing item measurements or hit targets. */
export function InsertionIndicator({
  axis,
  edge = "before",
  color,
}: {
  axis: "horizontal" | "vertical";
  edge?: "before" | "after";
  color: string;
}) {
  const horizontal = axis === "horizontal";
  return (
    <View
      testID="insertion-indicator"
      pointerEvents="none"
      accessible={false}
      style={{
        position: "absolute",
        backgroundColor: color,
        borderRadius: 2,
        ...(horizontal
          ? {
              top: 0,
              bottom: 0,
              width: 4,
              [edge === "before" ? "left" : "right"]: -10,
            }
          : {
              left: 0,
              right: 0,
              height: 2,
              [edge === "before" ? "top" : "bottom"]: -5,
            }),
      }}
    />
  );
}
