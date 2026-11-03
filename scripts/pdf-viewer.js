import { t, AppError, m, setLanguagePreference } from "../src/i18n/index.ts";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import {
  chapterCandidates,
  detectChapterStarts,
  readChapterBookmarks,
} from "../src/chapters.ts";
import { extractPage, EXTRACTION_VERSION } from "../src/extraction.ts";
pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([window.pdfWorkerSource], { type: "text/javascript" }),
);
let pdf;
let rendering = Promise.resolve();
let requestedPage = 1;
const seenEvents = new WeakSet();
let thumbnail = false;
function send(value) {
  window.ReactNativeWebView.postMessage(JSON.stringify(value));
}
function failure(error) {
  send({
    type: "error",
    message:
      error instanceof AppError
        ? m(error.key, error.params)
        : m(
            error.name === "PasswordException"
              ? "errors.pdfProtected"
              : "errors.pdfUnsupported",
          ),
  });
}
async function render() {
  if (!pdf) return;
  const page = await pdf.getPage(
    Math.max(1, Math.min(pdf.numPages, requestedPage)),
  );
  const viewport = page.getViewport({
    scale: thumbnail
      ? Math.min(1, 480 / page.getViewport({ scale: 1 }).width)
      : 1.5,
  });
  const canvas = document.getElementById("page");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;
  if (thumbnail)
    send({
      type: "thumbnail",
      page: page.pageNumber,
      base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1],
    });
}
async function receive(event) {
  if (seenEvents.has(event)) return;
  seenEvents.add(event);
  try {
    const message = JSON.parse(event.data);
    if (message.language === "pt" || message.language === "en") {
      setLanguagePreference(message.language);
      const status = document.getElementById("status");
      if (status) status.textContent = t("reader.opening");
    }
    if (message.type === "language") return;
    if (message.type === "open") {
      thumbnail = !!message.thumbnail;
      requestedPage = message.page || 1;
      const bytes = Uint8Array.from(atob(message.base64), (c) =>
        c.charCodeAt(0),
      );
      pdf = await pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
      send({ type: "opened", pages: pdf.numPages });
      if (message.extract) {
        const words = [];
        const originalWords = [];
        const sources = [];
        const legacyWords = [],
          legacySources = [],
          candidates = [];
        const bookmarks = await readChapterBookmarks(pdf);
        let offset = 0;
        for (let number = 1; number <= pdf.numPages; number++) {
          const content = await (await pdf.getPage(number)).getTextContent();
          for (const item of content.items) {
            if (typeof item.str !== "string") continue;
            const fragments = item.str.trim().split(/\s+/u).filter(Boolean);
            fragments.forEach((text, index) =>
              originalWords.push({
                text,
                page: number,
                paragraphEnd: !!item.hasEOL && index === fragments.length - 1,
              }),
            );
          }
          const page = extractPage(content.items, number);
          candidates.push(
            ...chapterCandidates(content.items, page, number).map((c) => ({
              ...c,
              index: c.index + words.length,
            })),
          );
          const old = extractPage(content.items, number, 2);
          for (const word of old.words) legacyWords.push(word);
          for (const source of old.sources)
            legacySources.push(source.map((p) => p + offset));
          for (let i = 0; i < page.words.length; i++) {
            words.push(page.words[i]);
            sources.push(page.sources[i].map((p) => p + offset));
          }
          offset += page.rawCount;
          if (words.length > 1000000) throw new AppError("errors.wordLimit");
          if (number % 25 === 0)
            send({ type: "progress", page: number, total: pdf.numPages });
        }
        if (!words.length) throw new AppError("errors.pdfNoText");
        const chapterStarts = detectChapterStarts(words, candidates, bookmarks);
        const rawToLegacy = new Map();
        legacySources.forEach((s, i) =>
          s.forEach((p) => rawToLegacy.set(p, i)),
        );
        const legacyStarts = chapterStarts
          .map((i) => rawToLegacy.get(sources[i][0]))
          .filter((i) => i !== undefined);
        send({
          type: "extraction",
          result: {
            words,
            sources,
            pageCount: pdf.numPages,
            extractionVersion: EXTRACTION_VERSION,
            chapterStarts,
            original: {
              words: originalWords,
              chapterStarts: chapterStarts.map((i) => Math.min(...sources[i])),
            },
            legacy: {
              words: legacyWords,
              sources: legacySources,
              chapterStarts: legacyStarts,
            },
          },
        });
      }
      document.getElementById("status")?.remove();
      rendering = rendering.then(render).catch(failure);
    }
    if (message.type === "page") {
      requestedPage = message.page;
      rendering = rendering.then(render).catch(failure);
    }
  } catch (error) {
    failure(error);
  }
}
document.addEventListener("message", receive);
window.addEventListener("message", receive);
send({ type: "ready" });
