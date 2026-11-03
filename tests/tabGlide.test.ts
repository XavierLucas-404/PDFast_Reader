import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("tab release glides once, preserves its visual position, and supports interruption and reduced motion", async () => {
  const gestures: any[] = [],
    shared: any[] = [],
    animations: any[] = [],
    preference = { reduced: false };
  const result = await build({
    entryPoints: ["src/SwipeTabs.tsx"],
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
                ? `export const View='View',TextInput={State:{currentlyFocusedInput:()=>null}};export const useWindowDimensions=()=>({width:400,height:800});`
                : a.path === "react-native-gesture-handler"
                  ? `export const Gesture={Pan:()=>{const h={};const g=new Proxy({}, {get:(_,k)=>(v)=>{h[k]=v;return g}});gestures.push(h);return g}};export function GestureDetector({children}){return children;}`
                  : `import React from 'react';export function useSharedValue(value){const ref=React.useRef(null);if(!ref.current){ref.current={value};shared.push(ref.current)}return ref.current};export const useAnimatedStyle=fn=>fn();export const useReducedMotion=()=>preference.reduced;export const ReduceMotion={Never:'never'};export const withSpring=(v,c)=>{animations.push({kind:'spring',from:shared[0].value,to:v,config:c});return v};export const withTiming=(v,c)=>{animations.push({kind:'timing',from:shared[0].value,to:v,config:c});return v};export const cancelAnimation=()=>{};export const runOnUI=fn=>fn;export const runOnJS=fn=>fn;export default {View:'Track'};`,
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
    "shared",
    "animations",
    "preference",
    result.outputFiles[0].text,
  )(require, mod, mod.exports, gestures, shared, animations, preference);
  let tree: any,
    select: (n: number) => void = () => {};
  function Harness() {
    const [index, setIndex] = React.useState(0);
    const [request, setRequest] = React.useState({ id: 0, index: 0 });
    select = (next) => {
      setRequest((r) => ({ id: r.id + 1, index: next }));
      setIndex(next);
    };
    return React.createElement(
      mod.exports.SwipeTabs,
      { index, request, enabled: true, onChange: setIndex },
      [0, 1, 2, 3].map((key) => React.createElement("Page", { key })),
    );
  }
  const gesture = () => gestures.at(-1);
  const release = async (dx: number, velocity = 0) => {
    await act(async () => {
      gesture().onStart({ translationX: 0 });
      gesture().onUpdate({ translationX: dx });
      gesture().onEnd({ translationX: dx, velocityX: velocity }, true);
    });
  };
  try {
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    assert.equal(animations.length, 0);
    await release(-160);
    assert.equal(animations.length, 1); // acknowledging index must not launch a second spring
    assert.equal(animations[0].from, -160);
    assert.equal(animations[0].to, -400);
    assert.equal(animations[0].config.duration, 400);
    assert.equal(animations[0].config.dampingRatio, 1);
    assert.equal(animations[0].config.overshootClamping, true);
    await release(-20, 100000);
    assert.equal(animations.at(-1).to, -400); // bounded velocity cannot reverse a long drag arbitrarily
    await release(-20, -100000);
    assert.equal(animations.at(-1).to, -800);
    assert.equal(animations.at(-1).config.velocity, 0);
    await release(30);
    assert.equal(animations.at(-1).to, -800); // insufficient drag glides back
    shared[0].value = -650; // an in-flight transition is interrupted here
    await act(async () => {
      gesture().onStart({ translationX: 20 });
      gesture().onUpdate({ translationX: 20 });
    });
    assert.equal(shared[0].value, -650); // activation threshold must not cause a jump
    await release(180);
    assert.equal(animations.at(-1).from, -470);
    assert.equal(animations.at(-1).to, -400);
    const count = animations.length;
    await act(async () => select(3));
    assert.equal(animations.length, count + 1);
    assert.equal(animations.at(-1).to, -1200);
    preference.reduced = true;
    await act(async () => select(2));
    assert.equal(animations.at(-1).kind, "timing");
    assert.equal(animations.at(-1).config.duration, 100);
    const a = animations.length;
    await act(async () => {
      gesture().onStart({ translationX: 0 });
      gesture().onEnd({}, false);
      gesture().onFinalize({}, false);
    });
    assert.equal(animations.length, a + 1); // cancelled gesture settles only once
  } finally {
    await act(async () => tree?.unmount());
  }
});
