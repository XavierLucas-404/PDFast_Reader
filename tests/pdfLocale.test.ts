import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
const require = createRequire(import.meta.url);
const { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("PDF locale changes send only a language message and keep the file/page mounted; errors remain translatable", async () => {
  const sent: string[] = [];
  const errors: any[] = [];
  let reads = 0;
  const built = await build({
    stdin: {
      contents:
        'export {PdfView} from "./src/PdfView";export {setLanguagePreference,renderMessage} from "./src/i18n";',
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    external: ["react", "react/jsx-runtime"],
    plugins: [
      {
        name: "native",
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({
            path: "rn",
            namespace: "mock",
          }));
          b.onResolve({ filter: /^react-native-webview$/ }, () => ({
            path: "web",
            namespace: "mock",
          }));
          b.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
            path: "fs",
            namespace: "mock",
          }));
          b.onResolve({ filter: /^expo-localization$/ }, () => ({
            path: "locale",
            namespace: "mock",
          }));
          b.onResolve(
            { filter: /^@react-native-async-storage\/async-storage$/ },
            () => ({ path: "prefs", namespace: "mock" }),
          );
          b.onResolve({ filter: /\/pdfHtml$/ }, () => ({
            path: "html",
            namespace: "mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
            contents: (
              {
                rn: 'export const Platform={select:()=>null};export const AppState={};export const View="View",Text="Text",TextInput="TextInput",TouchableOpacity="TouchableOpacity";export const StyleSheet={create:o=>o,flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s};',
                web: 'const React=require("react");export const WebView=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({postMessage:value=>sent.push(value)}));return React.createElement("WebView",props);});',
                fs: 'export const EncodingType={Base64:"base64"};export const readAsStringAsync=async()=>{read();return "file bytes";};',
                locale: 'export const getLocales=()=>[{languageTag:"pt-BR"}];',
                prefs: "export default {};",
                html: 'export const pdfHtml="<html>fixture</html>";',
              } as Record<string, string>
            )[args.path],
          }));
        },
      },
    ],
  });
  const api = new Function(
    "require",
    "sent",
    "read",
    `const module={exports:{}};${built.outputFiles[0].text};return module.exports;`,
  )(require, sent, () => reads++);
  let renderer: any;
  try {
    await act(async () => {
      renderer = create(
        React.createElement(api.PdfView, {
          uri: "local/file.pdf",
          page: 7,
          onError: (v: any) => errors.push(v),
        }),
      );
    });
    await act(async () => {
      renderer.root.findByType("WebView").props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "ready" }) },
      });
      await Promise.resolve();
    });
    assert.equal(reads, 1);
    const opens = () =>
      sent.map((v) => JSON.parse(v)).filter((v) => v.type === "open");
    assert.equal(opens().length, 1);
    assert.equal(opens()[0].page, 7);
    const before = renderer.root.findByType("WebView");
    await act(async () => api.setLanguagePreference("en"));
    assert.strictEqual(renderer.root.findByType("WebView"), before);
    assert.equal(reads, 1);
    assert.equal(opens().length, 1);
    assert.equal(JSON.parse(sent.at(-1)!).language, "en");
    await act(async () => {
      renderer.root.findByType("WebView").props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "error",
            message: { key: "errors.pdfProtected" },
          }),
        },
      });
    });
    assert.match(api.renderMessage(errors[0]), /password protected/);
    await act(async () => api.setLanguagePreference("pt"));
    assert.match(api.renderMessage(errors[0]), /senha/);
    assert.equal(reads, 1);
  } finally {
    await act(async () => renderer?.unmount());
  }
});
