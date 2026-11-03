import { Text } from "./Typography";
import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import type { Document } from "./core";
import { artworkFile, coverPath } from "./coverFiles";
import { colors as c, serif } from "./theme";
import { coverIndex } from "./shelves";
export function BookArtwork({
  document: d,
  owner,
  spine = false,
  epoch = 0,
  width,
  onImageError,
}: {
  document: Document;
  owner: string | null;
  spine?: boolean;
  epoch?: number;
  width: number;
  onImageError?: () => void;
}) {
  const file = artworkFile(d, owner),
    [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [file, epoch]);
  const color = [c.wine, c.blue, c.ink][coverIndex(d.hash)],
    height = spine ? 240 : width * 1.5;
  return (
    <View
      pointerEvents="none"
      style={{
        height,
        width,
        backgroundColor: color,
        borderRadius: spine ? 4 : 10,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {!spine && file && !failed ? (
        <Image
          key={file + ":" + epoch}
          source={{ uri: coverPath(file) }}
          resizeMode="contain"
          onError={() => {
            setFailed(true);
            onImageError?.();
          }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : spine ? (
        <View
          style={{
            width: 220,
            height: width - 8,
            transform: [{ rotate: "90deg" }],
            justifyContent: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17,
              color: c.white,
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            {d.title.replace(/\.pdf$/i, "")}
          </Text>
        </View>
      ) : (
        <View style={{ padding: 18, gap: 24 }}>
          <Text
            numberOfLines={6}
            style={{
              fontFamily: serif,
              fontSize: 22,
              fontWeight: "700",
              color: c.white,
              textAlign: "center",
            }}
          >
            {d.title.replace(/\.pdf$/i, "")}
          </Text>
          <Text
            systemFont
            style={{ color: c.gold, fontSize: 20, textAlign: "center" }}
          >
            — ✦ —
          </Text>
        </View>
      )}
      <View
        style={{
          position: "absolute",
          left: 5,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: "#ffffff25",
        }}
      />
    </View>
  );
}
