import { Text } from "./Typography";
import { AppModal, modalStyles } from "./AppModal";
import { cropRectangle } from "./coverCrop";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Picker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { PdfView } from "./PdfView";
import { PageNavigator } from "./PageNavigator";
import { colors as c } from "./theme";
import { t, renderMessage } from "./i18n";
import { useI18n } from "./i18n/react";
import { coverFolder, coverPath, writeThumbnail } from "./coverFiles";
import type { Document } from "./core";
type Choice = { page: number; image?: string };
export function CoverChooser({
  document: d,
  owner,
  initial,
  onCancel,
  onSave,
}: {
  document: Document;
  owner: string | null;
  initial: boolean;
  onCancel: () => void;
  onSave: (choice: { coverPage: number; customCover?: string }) => void;
}) {
  useI18n();
  const [choice, setChoice] = useState<Choice>({
    page: initial ? 1 : d.coverPage || 0,
    image: d.customCover ? coverPath(d.customCover) : undefined,
  });
  const [page, setPage] = useState(initial ? 1 : d.coverPage || 1),
    [readyPage, setReadyPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [crop, setCrop] = useState<{
      uri: string;
      width: number;
      height: number;
    } | null>(null),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const button = (label: string, fn: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={fn}
      style={[modalStyles.button, (busy || disabled) && { opacity: 0.4 }]}
    >
      <Text style={modalStyles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  async function gallery() {
    setError("");
    try {
      const r = await Picker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (!mounted.current || r.canceled) return;
      const a = r.assets[0];
      if (!a.width || !a.height) throw Error("Invalid image dimensions");
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCrop({ uri: a.uri, width: a.width, height: a.height });
    } catch {
      if (mounted.current) setError(t("library.photoDenied"));
    }
  }
  async function confirmCrop() {
    if (!crop) return;
    setBusy(true);
    try {
      const r = await Manipulator.manipulateAsync(
        crop.uri,
        [
          {
            crop: cropRectangle(
              crop.width,
              crop.height,
              zoom,
              offset.x,
              offset.y,
            ),
          },
          { resize: { width: 480, height: 720 } },
        ],
        { compress: 0.85, format: Manipulator.SaveFormat.JPEG },
      );
      if (mounted.current) {
        setChoice({ page: d.coverPage || 0, image: r.uri });
        setCrop(null);
      }
    } catch {
      if (mounted.current) setError(t("library.coverFailed"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      let customCover: string | undefined;
      if (choice.image) {
        if (choice.image === coverPath(d.customCover || ""))
          customCover = d.customCover;
        else {
          customCover =
            coverFolder(owner) + d.hash + "-" + Crypto.randomUUID() + ".jpg";
          await FS.makeDirectoryAsync(coverPath(coverFolder(owner)), {
            intermediates: true,
          });
          await FS.copyAsync({
            from: choice.image,
            to: coverPath(customCover),
          });
        }
      }
      if (mounted.current) onSave({ coverPage: choice.page, customCover });
    } catch {
      if (mounted.current) setError(t("library.coverFailed"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      origin.current = offset;
    })
    .onUpdate((e) =>
      setOffset({
        x: origin.current.x + e.translationX,
        y: origin.current.y + e.translationY,
      }),
    );
  return (
    <AppModal onClose={onCancel}>
      <Text style={modalStyles.title}>
        {t(crop ? "library.cropCover" : "library.chooseCover")}
      </Text>
      <Text numberOfLines={2}>{d.title}</Text>
      {crop ? (
        <>
          <Text>{t("library.cropHint")}</Text>
          <GestureDetector gesture={pan}>
            <View style={s.crop}>
              <Image
                source={{ uri: crop.uri }}
                style={{
                  position: "absolute",
                  width:
                    crop.width *
                    Math.max(240 / crop.width, 360 / crop.height) *
                    zoom,
                  height:
                    crop.height *
                    Math.max(240 / crop.width, 360 / crop.height) *
                    zoom,
                  transform: [
                    {
                      translateX: Math.max(
                        -(
                          crop.width *
                            Math.max(240 / crop.width, 360 / crop.height) *
                            zoom -
                          240
                        ) / 2,
                        Math.min(
                          (crop.width *
                            Math.max(240 / crop.width, 360 / crop.height) *
                            zoom -
                            240) /
                            2,
                          offset.x,
                        ),
                      ),
                    },
                    {
                      translateY: Math.max(
                        -(
                          crop.height *
                            Math.max(240 / crop.width, 360 / crop.height) *
                            zoom -
                          360
                        ) / 2,
                        Math.min(
                          (crop.height *
                            Math.max(240 / crop.width, 360 / crop.height) *
                            zoom -
                            360) /
                            2,
                          offset.y,
                        ),
                      ),
                    },
                  ],
                }}
              />
            </View>
          </GestureDetector>
          <View style={s.row}>
            {button("−", () => setZoom(Math.max(1, zoom - 0.25)))}
            {button("+", () => setZoom(Math.min(3, zoom + 0.25)))}
          </View>
          {button(t("common.confirm"), () => void confirmCrop())}
          {button(t("common.cancel"), () => setCrop(null))}
        </>
      ) : (
        <>
          <View style={s.row}>
            {button(
              t("library.pdfCover"),
              () => {
                setChoice({ page });
                setReadyPage(0);
              },
              d.available === false,
            )}
            {button(t("library.defaultCover"), () => setChoice({ page: 0 }))}
            {button(t("library.galleryCover"), () => void gallery())}
          </View>
          <View style={s.preview}>
            {choice.image ? (
              <Image
                source={{ uri: choice.image }}
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
              />
            ) : choice.page > 0 && d.available !== false ? (
              <PdfView
                key={retry}
                uri={d.uri}
                page={page}
                thumbnail
                onThumbnail={(n, b64) => {
                  if (n === page)
                    void writeThumbnail(owner, d.hash, n, b64)
                      .then(() => {
                        if (mounted.current) setReadyPage(n);
                      })
                      .catch(() => {
                        if (mounted.current) setError(t("library.coverFailed"));
                      });
                }}
                onError={(m) => setError(renderMessage(m))}
              />
            ) : (
              <View style={s.default}>
                <Text style={s.defaultTitle}>
                  {d.title.replace(/\.pdf$/i, "")}
                </Text>
                <Text style={s.defaultTitle}>— ✦ —</Text>
              </View>
            )}
          </View>
          {choice.page > 0 && !choice.image && d.available !== false && (
            <PageNavigator
              page={page}
              total={d.pageCount || 1}
              onChange={(n) => {
                setPage(n);
                setReadyPage(0);
                setChoice({ page: n });
                setError("");
              }}
            />
          )}
          <Text style={s.hint}>{t("library.coverLocal")}</Text>
          {button(
            t("library.useCover"),
            () => void save(),
            !choice.image &&
              choice.page > 0 &&
              d.available !== false &&
              readyPage !== page,
          )}
          {button(
            t(initial ? "library.skipCover" : "common.cancel"),
            initial ? () => onSave({ coverPage: 0 }) : onCancel,
          )}
        </>
      )}
      {busy && <ActivityIndicator color={c.wine} />}{" "}
      {!!error &&
        button(t("common.retry"), () => {
          setError("");
          setReadyPage(0);
          setRetry((n) => n + 1);
        })}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.wine }}>
          {error}
        </Text>
      )}
    </AppModal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper },
  content: { padding: 22, gap: 16 },
  title: { fontSize: 26, fontWeight: "700", color: c.ink },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.soft,
    justifyContent: "center",
  },
  label: { fontSize: 16, color: c.wine, fontWeight: "600" },
  preview: {
    height: 280,
    width: 190,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: c.surface,
  },
  default: {
    flex: 1,
    backgroundColor: c.wine,
    padding: 20,
    justifyContent: "center",
    gap: 30,
  },
  defaultTitle: { color: c.white, textAlign: "center", fontSize: 22 },
  hint: { color: c.muted, fontSize: 13 },
  crop: {
    borderWidth: 1,
    borderColor: c.gold,
    width: 240,
    height: 360,
    overflow: "hidden",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.ink,
  },
});
