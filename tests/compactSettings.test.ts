import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("settings keep language and colors compact, update the preview, and preserve device preferences", async () => {
  const storage = new Map<string, string>([
    ["pdfast.language.preference", "pt"],
  ]);
  const runtime = { storage, fail: false };
  const result = await build({
    stdin: {
      contents: `export {Settings} from './src/Settings';export {useReaderColors} from './src/readerAppearance';export {useLanguagePreference} from './src/i18n/react';export {t,getPreference,setSystemLanguage} from './src/i18n';`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react"],
    plugins: [
      {
        name: "native",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^react-native(?:-gesture-handler)?$|^@react-native-async-storage\/async-storage$|^expo-localization$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "react-native"
                ? `export const View='View',Text='Text',TextInput='TextInput',TouchableOpacity='TouchableOpacity';export const StyleSheet={create:o=>o,flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s};export const Keyboard={dismiss(){}};export const Platform={select:o=>o.ios};export const AppState={addEventListener:()=>({remove(){}})};`
                : a.path === "react-native-gesture-handler"
                  ? `const g=()=>new Proxy({}, {get:()=>()=>g()});export const Gesture={Pan:g,Tap:g,Simultaneous:g};export function GestureDetector({children}){return children;}`
                  : a.path === "expo-localization"
                    ? `export const getLocales=()=>[{languageTag:'pt-BR'}];`
                    : `export default {getItem:async k=>runtime.storage.get(k)||null,setItem:async(k,v)=>{if(runtime.fail)throw Error('disk');runtime.storage.set(k,v)}};`,
          }));
        },
      },
    ],
  });
  const mod = { exports: {} as any };
  new Function(
    "require",
    "module",
    "exports",
    "runtime",
    result.outputFiles[0].text,
  )(require, mod, mod.exports, runtime);
  const {
    Settings,
    useReaderColors,
    useLanguagePreference,
    t,
    getPreference,
    setSystemLanguage,
  } = mod.exports;
  let tree: any, latest: any;
  function Harness() {
    const ready = useLanguagePreference(),
      appearance = useReaderColors();
    latest = appearance.colors;
    return ready
      ? React.createElement(Settings, {
          value: appearance.colors,
          onChange: appearance.save,
          onBack: () => {},
        })
      : null;
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const render = async () => {
    await act(async () => {
      tree = create(React.createElement(Harness));
      await flush();
    });
  };
  const texts = () =>
    tree.root.findAllByType("Text").map((n: any) => n.children.join(""));
  const trigger = (key: string) =>
    tree.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" && n.props.accessibilityLabel === t(key),
    )[0];
  const button = (key: string) =>
    tree.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" &&
        n.findAll(
          (v: any) => v.type === "Text" && v.children.join("") === t(key),
        ).length,
    )[0];
  const press = async (node: any) => {
    await act(async () => {
      node.props.onPress();
      await flush();
    });
  };
  const inputs = () => tree.root.findAllByType("TextInput");
  const choose = async (code: string) => {
    const option = tree.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" &&
        n.props.accessibilityRole === "radio" &&
        n.findAll((v: any) => v.type === "Text" && v.children.join("") === code)
          .length,
    )[0];
    assert.ok(option);
    await press(option);
  };
  try {
    await render();
    assert.equal(inputs().length, 0);
    assert.equal(
      trigger("common.language").props.accessibilityState.expanded,
      false,
    );
    assert.ok(
      texts().indexOf(t("settings.preview")) <
        texts().indexOf(t("settings.original")),
    );
    assert.ok(
      texts().indexOf(t("settings.original")) <
        texts().indexOf(t("settings.background")),
    );
    await press(trigger("common.language"));
    assert.equal(
      tree.root.findAll(
        (n: any) =>
          n.type === "TouchableOpacity" &&
          n.props.accessibilityRole === "radio",
      ).length,
      3,
    );
    assert.equal(
      tree.root.findAll(
        (n: any) =>
          n.type === "TouchableOpacity" &&
          n.props.accessibilityState?.checked === true,
      )[0].props.accessibilityLabel,
      t("common.portugueseBrazil"),
    );
    await choose("EN-US");
    assert.equal(getPreference(), "en");
    assert.equal(storage.get("pdfast.language.preference"), "en");
    assert.equal(
      trigger("common.language").props.accessibilityState.expanded,
      false,
    );
    assert.ok(texts().includes("EN-US"));
    assert.equal(
      trigger("common.language").props.accessibilityValue.text,
      t("common.englishUS"),
    );
    await press(trigger("common.language"));
    await choose(t("common.system"));
    assert.equal(getPreference(), "system");
    await act(async () => setSystemLanguage("en-US"));
    assert.ok(texts().includes("Settings"));
    await act(async () => setSystemLanguage("pt-BR"));
    assert.ok(texts().includes("Configurações"));
    await press(trigger("common.language"));
    await press(trigger("common.language"));
    assert.equal(
      trigger("common.language").props.accessibilityState.expanded,
      false,
    );
    await press(trigger("settings.background"));
    assert.equal(inputs().length, 1);
    assert.equal(
      trigger("settings.background").props.accessibilityState.expanded,
      true,
    );
    await act(async () => inputs()[0].props.onChangeText("#12"));
    assert.ok(texts().includes(t("settings.invalidColor")));
    const old = latest.background;
    await press(trigger("settings.word"));
    assert.equal(inputs().length, 1);
    assert.equal(
      trigger("settings.background").props.accessibilityState.expanded,
      false,
    );
    assert.equal(latest.background, old);
    await press(trigger("settings.background"));
    assert.equal(inputs()[0].props.value, old);
    await act(async () => {
      inputs()[0].props.onChangeText("#123456");
      await flush();
    });
    assert.equal(latest.background, "#123456");
    const preview = tree.root.findAll(
      (n: any) =>
        n.type === "View" &&
        Array.isArray(n.props.style) &&
        n.props.style.some((s: any) => s?.backgroundColor === "#123456"),
    );
    assert.ok(preview.length);
    assert.equal(
      JSON.parse(storage.get("pdfast.reader.colors")!).background,
      "#123456",
    );
    // Accessible hue adjustment still changes the color when the full editor is open.
    const hue = tree.root.findAll(
      (n: any) =>
        n.type === "View" && n.props.accessibilityRole === "adjustable",
    )[0];
    await act(async () => {
      hue.props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
      await flush();
    });
    assert.notEqual(latest.background, "#123456");
    await press(button("settings.dark"));
    assert.equal(inputs().length, 0);
    assert.equal(latest.background, "#15181D");
    assert.equal(
      button("settings.dark").props.accessibilityState.selected,
      true,
    );
    await press(trigger("settings.word"));
    await act(async () => {
      inputs()[0].props.onChangeText("#15181D");
      await flush();
    });
    assert.ok(texts().includes(t("settings.lowContrast")));
    await press(button("settings.reset"));
    assert.equal(inputs().length, 0);
    assert.equal(latest.background, "#F5F0E7");
    assert.equal(latest.word, "#33252B");
    await press(trigger("common.language"));
    await choose("EN-US");
    await press(button("settings.dark"));
    await act(async () => tree.unmount());
    await render();
    assert.equal(getPreference(), "en");
    assert.equal(latest.background, "#15181D");
    assert.equal(inputs().length, 0);
    assert.equal(
      trigger("common.language").props.accessibilityState.expanded,
      false,
    );
    runtime.fail = true;
    await press(trigger("common.language"));
    await choose("PT-BR");
    assert.ok(texts().includes(t("common.languageSavedError")));
    assert.equal(getPreference(), "pt");
  } finally {
    await act(async () => tree?.unmount());
  }
});
