import { Text } from "./Typography";
import { ReaderPaletteContext, useReaderPalette } from "./readerAppearance";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { readerLayout } from "./readerLayout";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import { colors } from "./theme";
import React, { useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { IconButton } from "./IconButton";
type Props = {
  title: string;
  word: string;
  playing: boolean;
  chapterTransition: boolean;
  context: string;
  font: number;
  background: string;
  onPause: () => void;
  onPlay: () => void;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  children: React.ReactNode;
  essentialControls?: React.ReactNode;
};
export function WordReader(props: Props) {
  useI18n();

  const palette = useReaderPalette();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const [rootHeight, setRootHeight] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [wordBounds, setWordBounds] = useState<{
    key: string;
    bottom: number;
  } | null>(null);
  const viewportHeight =
    rootHeight?.width === width ? rootHeight.height : height;
  const layoutKey = `${width}:${viewportHeight}:${props.font}:${fontScale}`;
  const wordBottom =
    wordBounds?.key === layoutKey
      ? wordBounds.bottom
      : viewportHeight / 2 + props.font * fontScale * 0.7;
  const footerTop = Math.ceil(wordBottom + 10);
  const { contextHeight } = readerLayout(
    width,
    viewportHeight,
    footerTop,
    insets,
  );
  const landscape = width > height;
  return (
    <View
      style={[styles.root, { backgroundColor: props.background }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setRootHeight((previous) =>
          previous?.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      }}
    >
      <StatusBar
        style={palette?.statusStyle || "dark"}
        hidden={props.playing}
        animated={false}
      />
      <View
        style={[
          styles.wordStage,
          { paddingHorizontal: 24 + Math.max(insets.left, insets.right) },
        ]}
        pointerEvents="none"
      >
        <Text
          readability={false}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            const bottom = y + height;
            setWordBounds((previous) =>
              previous?.key === layoutKey && previous.bottom === bottom
                ? previous
                : { key: layoutKey, bottom },
            );
          }}
          accessibilityLiveRegion="none"
          style={[
            styles.word,
            { fontSize: props.font, color: palette?.word || colors.ink },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {props.word}
        </Text>
      </View>
      {props.playing && props.chapterTransition && (
        <SafeAreaView
          edges={["top", "left", "right"]}
          pointerEvents="none"
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, palette && { color: palette.ink }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {props.title}
            </Text>
          </View>
          <Text
            style={{
              color: palette?.muted || colors.muted,
              fontSize: 16,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {t("reader.newChapter")}
          </Text>
        </SafeAreaView>
      )}
      {props.playing ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={props.onPause}
          onPress={props.onPause}
          accessibilityRole="button"
          accessibilityLabel={t("reader.tapPause")}
        />
      ) : (
        <>
          <SafeAreaView edges={["top", "left", "right"]} style={styles.header}>
            <View style={styles.headerRow}>
              <IconButton
                icon="back"
                label={t("reader.backPages")}
                onPress={props.onBack}
              />
              <Text
                style={[styles.title, palette && { color: palette.ink }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {props.title}
              </Text>
              <View style={{ width: 48 }} />
            </View>
          </SafeAreaView>
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={[styles.footer, { top: footerTop }]}
          >
            {!!props.context && (
              <ScrollView
                key={props.context}
                style={[styles.context, { maxHeight: contextHeight }]}
                contentContainerStyle={styles.contextContent}
                accessibilityLabel={t("reader.context")}
                showsVerticalScrollIndicator
              >
                <Text
                  style={[
                    styles.contextText,
                    palette && { color: palette.muted },
                  ]}
                >
                  {props.context}
                </Text>
              </ScrollView>
            )}
            <View
              style={[styles.controls, landscape && styles.landscapeControls]}
            >
              <View style={styles.transport}>
                <IconButton
                  icon="back"
                  label={t("reader.previousWord")}
                  disabled={props.previousDisabled}
                  onPress={props.onPrevious}
                />
                <IconButton
                  primary
                  icon={props.playing ? "pause" : "play"}
                  label={props.playing ? t("reader.pause") : t("reader.play")}
                  onPress={props.onPlay}
                />
                <IconButton
                  icon="forward"
                  label={t("reader.nextWord")}
                  disabled={props.nextDisabled}
                  onPress={props.onNext}
                />
              </View>
              <View style={styles.essentialControls}>
                {props.essentialControls}
              </View>
            </View>
            <ScrollView
              style={styles.settings}
              contentContainerStyle={styles.settingsContent}
              showsVerticalScrollIndicator
            >
              {props.children}
            </ScrollView>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  wordStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  word: { color: colors.ink, fontWeight: "600", maxWidth: "100%" },
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  headerRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
  context: {
    flexGrow: 0,
    flexShrink: 1,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  contextContent: { paddingHorizontal: 4, paddingBottom: 2 },
  contextText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
  },
  controls: { flexShrink: 0, minHeight: 0 },
  essentialControls: { flexShrink: 1, paddingHorizontal: 12 },
  landscapeControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  transport: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  settings: { flex: 1, minHeight: 0 },
  settingsContent: { paddingHorizontal: 22, paddingBottom: 16, gap: 10 },
});
