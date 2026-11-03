import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("sentence picker distinguishes resume from redefining the start, without marking words presented", async () => {
  const result = await build({
    stdin: {
      contents: `export {SentencePicker} from './src/SentencePicker';export {t} from './src/i18n';`,
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
                /^react-native$|^\.\/AppModal$|^\.\/i18n\/react$|^react-native-safe-area-context$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "react-native"
                ? `import React from 'react';export const Modal='Modal',View='View',Text='Text',TextInput='TextInput',TouchableOpacity='TouchableOpacity';export const Platform={select:o=>o.ios};export const StyleSheet={create:o=>o,flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s};export function FlatList({data,renderItem,ListHeaderComponent,ListFooterComponent,ListEmptyComponent}){return React.createElement('List',null,ListHeaderComponent,...data.map((item,i)=>React.createElement(React.Fragment,{key:i},renderItem({item}))),data.length?null:ListEmptyComponent,ListFooterComponent)}`
                : a.path === "./AppModal"
                  ? `import React from 'react';export const modalStyles={};export function AppModal({children,onClose}){return React.createElement('Modal',{onClose},children)}`
                  : a.path === "./i18n/react"
                    ? `export const useI18n=()=>{};`
                    : `export const SafeAreaProvider='View',SafeAreaView='View';`,
          }));
        },
      },
    ],
  });
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    require,
    mod,
    mod.exports,
  );
  const { SentencePicker, t } = mod.exports;
  let tree: any,
    cancelled = 0;
  const choices: any[] = [];
  const document = {
    hash: "same",
    words: [
      { text: "Uma", page: 1 },
      { text: "frase.", page: 1 },
      { text: "Outra", page: 2 },
      { text: "frase.", page: 2 },
    ],
    position: 2,
    readingStart: 1,
    seen: [0, 1],
  };
  const props = {
    document,
    page: 2,
    resumePosition: 2,
    onCancel: () => {
      cancelled++;
    },
    onConfirm: (...args: any[]) => choices.push(args),
  };
  const button = (key: string) =>
    tree.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" &&
        n.findAll(
          (v: any) => v.type === "Text" && v.children.join("") === t(key),
        ).length,
    )[0];
  try {
    await act(async () => {
      tree = create(React.createElement(SentencePicker, props));
    });
    assert.equal(button("reader.resumeHere").props.disabled, true);
    await act(async () => button("reader.resumeSavedWord").props.onPress());
    assert.deepEqual(choices.pop(), [2, false]);
    await act(async () =>
      tree.root
        .findAll(
          (n: any) =>
            n.type === "TouchableOpacity" &&
            n.props.accessibilityRole === "radio",
        )[0]
        .props.onPress(),
    );
    await act(async () => button("reader.resumeHere").props.onPress());
    assert.deepEqual(choices.pop(), [2, false]);
    await act(async () => button("reader.defineStartHere").props.onPress());
    assert.deepEqual(choices.pop(), [2, true]);
    await act(async () => tree.root.findByType("Modal").props.onClose());
    assert.equal(cancelled, 1);
    assert.deepEqual(document.seen, [0, 1]);
    assert.equal(document.readingStart, 1);
    await act(async () =>
      tree.update(
        React.createElement(SentencePicker, {
          ...props,
          key: "empty",
          page: 3,
          resumePosition: undefined,
        }),
      ),
    );
    assert.equal(button("reader.resumeHere").props.disabled, true);
    assert.equal(button("reader.defineStartHere").props.disabled, true);
    assert.equal(button("reader.resumeSavedWord"), undefined);
    assert.ok(
      tree.root
        .findAllByType("Text")
        .some((n: any) => n.children.join("") === t("reader.emptySentences")),
    );
  } finally {
    await act(async () => tree?.unmount());
  }
});
