import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import React from "react";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("shelf reorder is a draft, outside closes without saving, and reopening discards the draft", async () => {
  const output = await build({
    entryPoints: ["src/ReorderShelf.tsx"],
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
                /^react-native(?:-gesture-handler|-reanimated|-safe-area-context)?$|^\.\/i18n(?:\/react)?$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "react-native"
                ? `export const Modal='Modal',View='View',Text='Text',TextInput='TextInput',Pressable='Pressable',ScrollView='ScrollView',KeyboardAvoidingView='KeyboardAvoidingView',TouchableOpacity='TouchableOpacity';export const Platform={OS:'android',select:o=>o.android};export const StyleSheet={flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s,create:o=>o,absoluteFill:{position:'absolute',top:0,left:0,bottom:0,right:0}};export const AppState={addEventListener:()=>({remove(){}})};export const useWindowDimensions=()=>({width:390,height:844});`
                : a.path === "react-native-gesture-handler"
                  ? `const g=()=>new Proxy({}, {get:()=>()=>g()});export const Gesture={Pan:g,Native:g};export function GestureDetector({children}){return children};export function GestureHandlerRootView({children}){return children};`
                  : a.path === "react-native-reanimated"
                    ? `export const useSharedValue=value=>({value});export const useAnimatedStyle=fn=>fn();export default {View:'View'};`
                    : a.path === "react-native-safe-area-context"
                      ? `export const SafeAreaView='SafeAreaView';export function SafeAreaProvider({children}){return children}`
                      : `export const useI18n=()=>{};export const t=k=>k;`,
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
    open: () => void = () => {},
    saved: string[][] = [];
  const docs = ["a", "b"].map((hash) => ({
    hash,
    title: hash + ".pdf",
    words: [],
    uri: "private",
    position: 0,
    seen: [],
  }));
  function Harness() {
    const [visible, setVisible] = React.useState(true);
    open = () => setVisible(true);
    return visible
      ? React.createElement(mod.exports.ReorderShelf, {
          title: "Shelf",
          documents: docs,
          onClose: () => setVisible(false),
          onSave: (ids: string[]) => {
            saved.push(ids);
            setVisible(false);
          },
        })
      : null;
  }
  const rows = () =>
    tree.root.findAll(
      (n: any) =>
        n.type === "View" && n.props.accessibilityRole === "adjustable",
    );
  try {
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    assert.deepEqual(
      rows().map((n: any) => n.props.accessibilityLabel),
      ["a.pdf", "b.pdf"],
    );
    await act(async () =>
      rows()[0].props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      }),
    );
    assert.deepEqual(
      rows().map((n: any) => n.props.accessibilityLabel),
      ["b.pdf", "a.pdf"],
    );
    assert.deepEqual(saved, []);
    // Indicators are gap overlays; dragging never adds a layout row or border.
    for (const [i, row] of rows().entries()) {
      row.props.onLayout({
        nativeEvent: { layout: { y: 6 + i * 80, height: 72 } },
      });
    }
    const handles = () =>
      tree.root.findAll(
        (n: any) => typeof n.type === "function" && n.type.name === "DragBook",
      );
    await act(async () => handles()[1].props.onStart(0, 122));
    await act(async () => handles()[1].props.onMove(0, 0));
    const marker = () =>
      tree.root.findAll(
        (n: any) =>
          n.type === "View" && n.props.testID === "insertion-indicator",
      );
    assert.equal(marker().length, 1);
    assert.equal(marker()[0].props.style.top, -5);
    assert.equal(marker()[0].props.pointerEvents, "none");
    assert.equal(rows().length, 2);
    assert.ok(rows().every((r: any) => !r.props.style.borderTopWidth));
    await act(async () => handles()[1].props.onMove(0, 300));
    assert.equal(marker().length, 1);
    assert.equal(marker()[0].props.style.bottom, -5);
    await act(async () => handles()[1].props.onCancel());
    assert.equal(marker().length, 0);
    await act(async () => handles()[0].props.onStart(0, 42));
    await act(async () => handles()[0].props.onMove(0, 42));
    assert.equal(marker().length, 1);
    assert.equal(marker()[0].props.style.top, -5);
    assert.equal(marker()[0].parent.parent.props.accessibilityLabel, "a.pdf");
    await act(async () => handles()[0].props.onCancel());
    await act(async () => tree.root.findByType("Pressable").props.onPress());
    assert.equal(tree.root.findAllByType("Modal").length, 0);
    assert.deepEqual(saved, []);
    await act(async () => open());
    assert.deepEqual(
      rows().map((n: any) => n.props.accessibilityLabel),
      ["a.pdf", "b.pdf"],
    );
    await act(async () =>
      rows()[0].props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      }),
    );
    await act(async () =>
      tree.root
        .findAll(
          (n: any) =>
            n.type === "TouchableOpacity" &&
            n.findAll(
              (t: any) =>
                t.type === "Text" && t.children.join("") === "common.save",
            ).length,
        )[0]
        .props.onPress(),
    );
    assert.deepEqual(saved, [["b", "a"]]);
    assert.equal(docs[0].position, 0);
    assert.deepEqual(docs[0].seen, []);
  } finally {
    await act(async () => tree?.unmount());
  }
});
