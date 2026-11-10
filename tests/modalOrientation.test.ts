import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("native modal allows rotation and keeps a bounded non-scrolling content host", async () => {
  const output = await build({
    entryPoints: ["src/AppModal.tsx"],
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
                /^(react-native|react-native-safe-area-context|react-native-gesture-handler)$|^\.\/i18n\/react$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "react-native"
                ? `export const Modal='Modal',View='View',Pressable='Pressable',ScrollView='ScrollView',Text='Text',TextInput='TextInput',TouchableOpacity='TouchableOpacity',KeyboardAvoidingView='KeyboardAvoidingView';export const Platform={OS:'ios',select:o=>o.ios};export const StyleSheet={create:o=>o,flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s,absoluteFill:{}};export const useWindowDimensions=()=>({width:844,height:390});`
                : a.path === "react-native-safe-area-context"
                  ? `export const SafeAreaProvider='Provider',SafeAreaView='SafeAreaView';`
                  : a.path === "react-native-gesture-handler"
                    ? `export const GestureHandlerRootView='GestureRoot';`
                    : `export const useI18n=()=>{};`,
          }));
        },
      },
    ],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", output.outputFiles[0].text)(
    require,
    mod,
    mod.exports,
  );
  let tree: any,
    closed = 0;
  try {
    await act(async () => {
      tree = create(
        React.createElement(
          mod.exports.AppModal,
          { onClose: () => closed++, scroll: false },
          React.createElement("Content"),
        ),
      );
    });
    const modal = tree.root.findByType("Modal");
    assert.equal(modal.props.visible, true);
    assert.ok(modal.props.supportedOrientations.includes("landscape-left"));
    assert.ok(modal.props.supportedOrientations.includes("landscape-right"));
    assert.equal(tree.root.findAllByType("ScrollView").length, 0);
    assert.ok(
      tree.root
        .findAllByType("View")
        .some(
          (v: any) =>
            Array.isArray(v.props.style) &&
            v.props.style.some((s: any) => s?.maxHeight <= 390),
        ),
    );
    await act(async () => modal.props.onRequestClose());
    assert.equal(closed, 1);
  } finally {
    await act(async () => tree?.unmount());
  }
});
