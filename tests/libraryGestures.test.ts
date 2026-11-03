import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("cancelled drags never commit and tab gestures ignore cancelled, vertical and text-editing interactions", async () => {
  const gestures: any[] = [],
    focus = { value: false };
  const output = await build({
    stdin: {
      contents: `export {DragBook} from './src/DragBook';export {SwipeTabs} from './src/SwipeTabs';`,
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
            { filter: /^react-native(?:-gesture-handler|-reanimated)?$/ },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "react-native"
                ? `export const TextInput={State:{currentlyFocusedInput:()=>focus.value}};export const View="View";export const useWindowDimensions=()=>({width:360,height:780});`
                : a.path === "react-native-gesture-handler"
                  ? `export const Gesture={Pan:()=>{const handlers={};const proxy=new Proxy({}, {get:(_,key)=>(...args)=>{handlers[key]=args[0];return proxy}});gestures.push(handlers);return proxy}};export function GestureDetector({children}){return children;}`
                  : `export const useSharedValue=value=>({value});export const useAnimatedStyle=fn=>fn();export const ReduceMotion={Never:'never'};export const withTiming=v=>v;export const withSpring=v=>v;export const useReducedMotion=()=>true;export const cancelAnimation=()=>{};export const runOnUI=fn=>fn;export const runOnJS=fn=>fn;export default {View:'View'};`,
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
    "gestures",
    "focus",
    output.outputFiles[0].text,
  )(require, mod, mod.exports, gestures, focus);
  let tree: any,
    commits = 0,
    cancels = 0;
  const changes: number[] = [];
  try {
    await act(async () => {
      tree = create(
        React.createElement(mod.exports.DragBook, {
          onStart() {},
          onMove() {},
          onEnd() {
            commits++;
          },
          onCancel() {
            cancels++;
          },
        }),
      );
    });
    gestures.at(-1).onEnd({}, false);
    assert.equal(commits, 0);
    assert.equal(cancels, 1);
    gestures.at(-1).onEnd({}, true);
    assert.equal(commits, 1);
    await act(async () =>
      tree.update(
        React.createElement(mod.exports.SwipeTabs, {
          enabled: true,
          index: 1,
          request: { id: 0, index: 1 },
          onChange: (n: number) => changes.push(n),
          children: [
            React.createElement("Text", { key: 1 }),
            React.createElement("Text", { key: 2 }),
            React.createElement("Text", { key: 3 }),
          ],
        }),
      ),
    );
    const swipe = gestures.at(-1);
    swipe.onStart({ translationX: 0 });
    swipe.onEnd({ translationX: -150, translationY: 0, velocityX: 0 }, false);
    assert.deepEqual(changes, [1]);
    swipe.onStart({ translationX: 0 });
    swipe.onEnd({ translationX: -150, translationY: 0, velocityX: 0 }, true);
    assert.deepEqual(changes, [1, 2]);
    focus.value = true;
    tree.root.findByType("View").props.onStartShouldSetResponderCapture();
    swipe.onStart({ translationX: 0 });
    swipe.onEnd({ translationX: 150, translationY: 0, velocityX: 0 }, true);
    assert.deepEqual(changes, [1, 2]);
    focus.value = false;
    tree.root.findByType("View").props.onStartShouldSetResponderCapture();
    swipe.onStart({ translationX: 0 });
    swipe.onEnd({ translationX: 20, translationY: 100, velocityX: 0 }, true);
    assert.equal(changes.at(-1), 2);
  } finally {
    await act(async () => tree?.unmount());
  }
});

test("drag uses the latest pointer after delayed measurement and aligns Android screen coordinates with window bounds", async () => {
  const output = await build({
    entryPoints: ["src/useBookDrag.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react"],
    plugins: [
      {
        name: "native",
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({
            path: "native",
            namespace: "mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: `export const AppState={addEventListener:()=>({remove(){}})};`,
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
  let controller: any,
    tree: any,
    release: () => void = () => {},
    pending: Promise<void>;
  const committed: any[] = [];
  const doc = {
    hash: "book",
    title: "Book.pdf",
    uri: "file",
    words: [],
    position: 0,
    seen: [],
  };
  function Harness() {
    controller = mod.exports.useBookDrag(
      [doc],
      undefined,
      { current: 0 },
      "portrait",
      (d: any, target: any) => committed.push({ hash: d.hash, ...target }),
    );
    return null;
  }
  try {
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    controller.root.current = {
      measureInWindow: (cb: any) => cb(0, 50, 300, 700),
    };
    controller.groups.current.set("s", {
      measureInWindow: (cb: any) => cb(10, 100, 250, 200),
    });
    controller.books.current.set("book", {
      measureInWindow: (cb: any) => {
        release = () => cb(20, 400, 100, 100);
      },
    });
    await act(async () => {
      pending = controller.start(doc, 50, 600, 30, 64);
      await new Promise((r) => setImmediate(r));
    });
    await act(async () => {
      controller.move(50, 300);
      release();
      await pending!;
    });
    assert.equal(controller.drop.shelf, "s");
    assert.equal(controller.ghost.y, 69); // screen y300 minus status offset136, library origin50 and ghost offset45
    await act(async () => controller.end());
    assert.deepEqual(committed, [
      { hash: "book", shelf: "s", before: undefined },
    ]);
  } finally {
    await act(async () => tree?.unmount());
  }
});
