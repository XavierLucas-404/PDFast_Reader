import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("local Garamond loading, weights, nested text, editable fields and system-font exceptions", async () => {
  const state = { fontResult: [false, null] as any[] };
  const result = await build({
    stdin: {
      contents: `export * from './src/Typography';export * from './src/AppFonts';`,
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
          b.onResolve({ filter: /^react-native$|^expo-font$|\.ttf$/ }, (a) => ({
            path: a.path,
            namespace: "mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents: a.path.endsWith(".ttf")
              ? "export default 1;"
              : a.path === "expo-font"
                ? `export const useFonts=()=>state.fontResult;`
                : `export const View='View',Text='Text',TextInput='TextInput',ActivityIndicator='Spinner';export const StyleSheet={flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s};export const Platform={select:o=>o.ios};`,
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
    "state",
    result.outputFiles[0].text,
  )(require, mod, mod.exports, state);
  const { AppFonts, Text, TextInput, fontFamilies, fontWeight, readableStyle } =
    mod.exports;
  for (const weight of [400, 500, 600, 700, 800]) {
    const bytes = await readFile(`assets/fonts/${fontFamilies[weight]}.ttf`);
    const count = bytes.readUInt16BE(4),
      tags = Array.from({ length: count }, (_, i) =>
        bytes.toString("ascii", 12 + i * 16, 16 + i * 16),
      );
    assert.ok(tags.includes("cmap"));
    assert.ok(!tags.includes("fvar"));
    assert.equal(fontWeight(String(weight)), weight);
  }
  assert.equal(fontWeight("bold"), 700);
  assert.equal(fontWeight("normal"), 400);
  let tree: any;
  let changed = "";
  const render = () =>
    React.createElement(
      AppFonts,
      null,
      React.createElement(
        Text,
        {
          style: { fontSize: 22, fontWeight: "700", fontFamily: "Georgia" },
          testID: "heading",
        },
        "Configurações — English",
        React.createElement(Text, { testID: "nested" }, "Olá"),
      ),
      React.createElement(
        Text,
        {
          testID: "zero",
          systemFont: true,
          style: { fontWeight: "700", fontVariant: ["tabular-nums"] },
        },
        "0",
      ),
      React.createElement(TextInput, {
        testID: "email",
        value: "leitura@example.test",
        style: { fontWeight: "500" },
        onChangeText: (v: string) => {
          changed = v;
        },
      }),
    );
  const flatten = (s: any) =>
    Object.assign({}, ...[s].flat(Infinity).filter(Boolean));
  try {
    await act(async () => {
      tree = create(render());
    });
    assert.equal(tree.root.findAllByType("Spinner").length, 1);
    assert.equal(tree.root.findAllByType("Text").length, 0);
    state.fontResult = [true, null];
    await act(async () => tree.update(render()));
    const host = (name: string, type = "Text") =>
      tree.root.findAll(
        (n: any) => n.type === type && n.props.testID === name,
      )[0];
    assert.equal(
      flatten(host("heading").props.style).fontFamily,
      fontFamilies[700],
    );
    assert.equal(
      flatten(host("nested").props.style).fontFamily,
      fontFamilies[700],
    );
    assert.equal(flatten(host("heading").props.style).fontWeight, "normal");
    assert.deepEqual(readableStyle({ fontSize: 16, lineHeight: 25 }), {
      fontSize: 18,
      lineHeight: 28,
    });
    assert.deepEqual(readableStyle({ fontSize: 12, lineHeight: 20 }), {
      fontSize: 14,
      lineHeight: 23,
    });
    assert.deepEqual(readableStyle({ fontSize: 14 }), { fontSize: 16 });
    assert.deepEqual(readableStyle({ fontSize: 17 }), { fontSize: 19 });
    assert.deepEqual(readableStyle({ fontSize: 28, lineHeight: 35 }), {});
    assert.deepEqual(readableStyle({ fontSize: 16 }, false, false), {});
    assert.deepEqual(readableStyle({ fontSize: 16 }, true), {});
    assert.deepEqual(readableStyle({}, false, true, true), {}); // inherit the already-adjusted parent
    assert.equal(flatten(host("heading").props.style).fontSize, 22);
    assert.equal(flatten(host("nested").props.style).fontSize, undefined);
    assert.equal(flatten(host("email", "TextInput").props.style).fontSize, 19);

    assert.equal(flatten(host("zero").props.style).fontFamily, undefined);
    assert.equal(flatten(host("zero").props.style).fontWeight, "700");
    assert.deepEqual(flatten(host("zero").props.style).fontVariant, [
      "tabular-nums",
    ]);
    assert.equal(
      flatten(host("email", "TextInput").props.style).fontFamily,
      fontFamilies[500],
    );
    host("email", "TextInput").props.onChangeText("novo@example.test");
    assert.equal(changed, "novo@example.test");
    state.fontResult = [false, new Error("font unavailable")];
    await act(async () => tree.update(render()));
    assert.equal(tree.root.findAllByType("Spinner").length, 0);
    assert.equal(flatten(host("heading").props.style).fontFamily, undefined);
    assert.equal(flatten(host("heading").props.style).fontWeight, "700");
  } finally {
    await act(async () => tree?.unmount());
  }
});
