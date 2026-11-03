import { useI18n } from "./i18n/react";
import { t, m, isMessage, getLanguage, type MessageValue } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";
import * as FS from "expo-file-system/legacy";
import { pdfHtml } from "./pdfHtml";
import type { PdfExtraction } from "./extraction";
type Props = {
  uri: string;
  page: number;
  extract?: boolean;
  thumbnail?: boolean;
  onThumbnail?: (page: number, base64: string) => void;
  onExtract?: (result: PdfExtraction) => void;
  onPageCount?: (pages: number) => void;
  onProgress?: (page: number, total: number) => void;
  onError: (message: MessageValue) => void;
};
export function PdfView({
  uri,
  page,
  extract = false,
  thumbnail = false,
  onThumbnail,
  onExtract,
  onPageCount,
  onProgress,
  onError,
}: Props) {
  const { language } = useI18n();

  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 })
      .then((base64) => {
        if (!cancelled)
          ref.current?.postMessage(
            JSON.stringify({
              type: "open",
              base64,
              page,
              extract,
              thumbnail,
              language: getLanguage(),
            }),
          );
      })
      .catch(() => onError(m("errors.pdfOpen")));
    return () => {
      cancelled = true;
    };
  }, [uri, ready, extract]);
  useEffect(() => {
    if (ready)
      ref.current?.postMessage(JSON.stringify({ type: "language", language }));
  }, [ready, language]);
  useEffect(() => {
    if (ready) ref.current?.postMessage(JSON.stringify({ type: "page", page }));
  }, [page, ready]);
  return (
    <WebView
      ref={ref}
      source={{ html: pdfHtml }}
      originWhitelist={["about:blank"]}
      javaScriptEnabled
      onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
      style={{ flex: 1 }}
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "ready") setReady(true);
          if (message.type === "thumbnail")
            onThumbnail?.(message.page, message.base64);
          if (message.type === "opened") onPageCount?.(message.pages);
          if (message.type === "progress")
            onProgress?.(message.page, message.total);
          if (message.type === "extraction") onExtract?.(message.result);
          if (message.type === "error")
            onError(
              isMessage(message.message)
                ? message.message
                : m("errors.pdfOpen"),
            );
        } catch {
          onError(m("errors.pdfOpen"));
        }
      }}
    />
  );
}
