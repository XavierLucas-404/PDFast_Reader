import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
const require = createRequire(import.meta.url);
const { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("reader protects each overlay edge once and leaves playback touch surface full screen", async () => {
  const output = await build({
    entryPoints: ["src/WordReader.tsx"],
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
                /^(react-native|react-native-safe-area-context|expo-status-bar)$|^\.\/i18n(?:\/react)?$|^\.\/readerAppearance$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "./readerAppearance"
                ? `export const useReaderPalette=()=>null;export const ReaderPaletteContext={};`
                : a.path === "react-native"
                  ? `export const View='View',Text='Text',TextInput='TextInput',Pressable='Pressable',ScrollView='ScrollView',TouchableOpacity='TouchableOpacity';export const Platform={select:o=>o.ios};export const StyleSheet={flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s,create:o=>o,absoluteFillObject:{position:'absolute',top:0,bottom:0,left:0,right:0},absoluteFill:{position:'absolute',top:0,bottom:0,left:0,right:0}};export const useWindowDimensions=()=>({width:844,height:390,fontScale:1});`
                  : a.path === "react-native-safe-area-context"
                    ? `export const SafeAreaView='SafeAreaView';export const useSafeAreaInsets=()=>({top:24,bottom:24,left:44,right:0});`
                    : a.path === "expo-status-bar"
                      ? `export const StatusBar='StatusBar';`
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
  const Reader = mod.exports.WordReader;
  const props = {
    title: "Test.pdf",
    word: "Word",
    playing: false,
    chapterTransition: false,
    context: "Context.",
    font: 64,
    background: "#fff",
    essentialControls: React.createElement("Controls"),
    children: React.createElement("Auxiliary"),
    onPause() {},
    onPlay() {},
    onBack() {},
    onPrevious() {},
    onNext() {},
    previousDisabled: false,
    nextDisabled: false,
  };
  let tree: any;
  try {
    await act(async () => {
      tree = create(React.createElement(Reader, props));
    });
    assert.deepEqual(
      tree.root.findAllByType("SafeAreaView").map((v: any) => v.props.edges),
      [
        ["top", "left", "right"],
        ["bottom", "left", "right"],
      ],
    );
    const controls = tree.root.findByType("Controls");
    for (let ancestor = controls.parent; ancestor; ancestor = ancestor.parent) {
      assert.notEqual(ancestor.type, "ScrollView");
    }
    assert.ok(
      tree.root
        .findAllByType("ScrollView")
        .some((n: any) => n.findAllByType("Auxiliary").length),
    );
    const word = () =>
      tree.root
        .findAllByType("Text")
        .find((n: any) => n.children[0] === "Word");
    const wordStyle = word().props.style;
    await act(async () =>
      tree.update(React.createElement(Reader, { ...props, playing: true })),
    );
    assert.equal(tree.root.findAllByType("SafeAreaView").length, 0);
    assert.deepEqual(word().props.style, wordStyle);
    assert.equal(
      tree.root.findByType("Pressable").props.onPressIn,
      props.onPause,
    );
    assert.equal(tree.root.findByType("StatusBar").props.hidden, true);
    await act(async () =>
      tree.update(
        React.createElement(Reader, {
          ...props,
          playing: true,
          chapterTransition: true,
        }),
      ),
    );
    assert.deepEqual(tree.root.findByType("SafeAreaView").props.edges, [
      "top",
      "left",
      "right",
    ]);
    assert.ok(
      tree.root
        .findAllByType("Text")
        .some((n: any) => n.children[0] === "reader.newChapter"),
    );
  } finally {
    await act(async () => tree?.unmount());
  }
});
