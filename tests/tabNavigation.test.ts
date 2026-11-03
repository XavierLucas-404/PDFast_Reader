import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("tap and swipe share UI navigation; in-flight motion and stale callbacks cannot overwrite the latest request", async () => {
  const runtime = {
    thread: "js",
    gestures: [] as any[],
    shared: [] as any[],
    animations: [] as any[],
    uiQueue: [] as (() => void)[],
    jsQueue: [] as (() => void)[],
    ui(fn: () => void) {
      const previous = this.thread;
      this.thread = "ui";
      try {
        fn();
      } finally {
        this.thread = previous;
      }
    },
  };
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
                  ? `export const Gesture={Pan:()=>{const h={};const g=new Proxy({}, {get:(_,k)=>(v)=>{h[k]=v;return g}});runtime.gestures.push(h);return g}};export function GestureDetector({children}){return children;}`
                  : `import React from 'react';
        export function useSharedValue(initial){const ref=React.useRef(null);if(!ref.current){const s={current:initial,pending:null};Object.defineProperty(s,'value',{get:()=>s.current,set:v=>{const apply=()=>{if(v&&v.animation)s.pending=v;else{s.current=v;s.pending=null}};if(runtime.thread==='ui')apply();else runtime.uiQueue.push(apply)}});ref.current=s;runtime.shared.push(s)}return ref.current};
        export const useAnimatedStyle=fn=>fn();export const useReducedMotion=()=>false;export const ReduceMotion={Never:'never'};
        const animate=(to,config)=>{if(runtime.thread!=='ui')throw Error('navigation animation executed on JS');const a={animation:true,to,from:runtime.shared[0].value,config};runtime.animations.push(a);return a};
        export const withSpring=animate,withTiming=animate;export const cancelAnimation=s=>{s.pending=null};
        export const runOnUI=fn=>(...args)=>runtime.uiQueue.push(()=>fn(...args));
        export const runOnJS=fn=>(...args)=>runtime.jsQueue.push(()=>fn(...args));export default {View:'Track'};`,
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
  let tree: any,
    tap: (n: number) => void = () => {},
    selected = 0,
    requestId = 0;
  function Harness() {
    const [index, setIndex] = React.useState(0),
      [request, setRequest] = React.useState({ id: 0, index: 0 });
    selected = index;
    tap = (n) => {
      const id = ++requestId;
      setIndex(n);
      setRequest({ id, index: n });
    };
    return React.createElement(
      mod.exports.SwipeTabs,
      {
        enabled: true,
        index,
        request,
        onChange: (n: number, id: number) => {
          if (id === requestId) setIndex(n);
        },
      },
      [0, 1, 2, 3].map((key) => React.createElement("Page", { key })),
    );
  }
  const ui = async () => {
    await act(async () => {
      while (runtime.uiQueue.length) runtime.ui(runtime.uiQueue.shift()!);
    });
  };
  const js = async () => {
    await act(async () => {
      while (runtime.jsQueue.length) runtime.jsQueue.shift()!();
    });
  };
  const click = async (n: number) => {
    await act(async () => tap(n));
  };
  const swipe = async (dx: number) => {
    await act(async () =>
      runtime.ui(() => {
        const g = runtime.gestures.at(-1);
        g.onStart({ translationX: 0 });
        g.onUpdate({ translationX: dx });
        g.onEnd({ translationX: dx, velocityX: 0 }, true);
      }),
    );
  };
  const position = (x: number) =>
    runtime.ui(() => {
      runtime.shared[0].value = x;
    });
  const latest = () => runtime.animations.at(-1);
  const finish = () => position(latest().to);
  const expectConsistent = (n: number) => {
    assert.equal(selected, n);
    assert.equal(runtime.shared[2].value, n);
    assert.equal(runtime.shared[0].value, -400 * n);
    const pages = tree.root.findAll(
      (n: any) => n.type === "View" && n.props.importantForAccessibility,
    );
    assert.deepEqual(
      pages.map((p: any) => p.props.pointerEvents),
      [0, 1, 2, 3].map((i) => (i === n ? "auto" : "none")),
    );
  };
  try {
    await act(async () => {
      tree = create(React.createElement(Harness));
    });
    await ui();
    await click(3);
    assert.equal(runtime.animations.length, 0);
    await ui();
    assert.equal(latest().from, -0);
    assert.equal(latest().to, -1200); // direct nonadjacent tap
    position(-650);
    await swipe(180); // interrupt the tap transition with a swipe
    assert.equal(latest().from, -470);
    assert.equal(latest().to, -400);
    const count = runtime.animations.length;
    await js();
    await ui();
    assert.equal(runtime.animations.length, count);
    finish();
    expectConsistent(1);

    await swipe(-170); // callback is queued; the page is still between tabs
    assert.equal(selected, 1);
    assert.equal(runtime.shared[0].value, -570);
    await click(0);
    await js(); // click wins even BEFORE its UI command has executed
    assert.equal(selected, 0);
    await ui();
    assert.equal(latest().from, -570);
    finish();
    expectConsistent(0);

    await click(3);
    await ui();
    position(-200);
    await click(1);
    await click(2);
    await click(0);
    await ui();
    finish();
    expectConsistent(0);

    await swipe(-180);
    const old = runtime.jsQueue.shift()!;
    position(-400);
    await swipe(-180); // second swipe supersedes the delayed first callback
    await js();
    assert.equal(selected, 2);
    await act(async () => old());
    assert.equal(selected, 2);
    finish();
    expectConsistent(2);

    // Reselect the same active tab while a gesture is moving away from it.
    await act(async () =>
      runtime.ui(() => {
        const g = runtime.gestures.at(-1);
        g.onStart({ translationX: 0 });
        g.onUpdate({ translationX: 150 });
      }),
    );
    const obsoleteGesture = runtime.gestures.at(-1);
    await click(2);
    await ui();
    assert.equal(latest().from, -650);
    assert.equal(latest().to, -800);
    await act(async () =>
      runtime.ui(() => {
        obsoleteGesture.onUpdate({ translationX: 300 });
        obsoleteGesture.onEnd({ translationX: 300, velocityX: 0 }, true);
        obsoleteGesture.onFinalize({}, false);
      }),
    );
    await js();
    finish();
    expectConsistent(2);

    // Cancelling a second gesture must still acknowledge the first target:
    // its earlier JS callback was invalidated by the new gesture's start.
    await swipe(180);
    position(-400);
    await act(async () =>
      runtime.ui(() => {
        const g = runtime.gestures.at(-1);
        g.onStart({ translationX: 0 });
        g.onUpdate({ translationX: 15 });
        g.onEnd({}, false);
        g.onFinalize({}, false);
      }),
    );
    await js();
    finish();
    expectConsistent(1);
  } finally {
    await act(async () => tree?.unmount());
  }
});
