import { CHAPTER_DETECTION_VERSION } from "../src/chapters";
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
const require = createRequire(import.meta.url);
const { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002",
  hash = "a".repeat(64);
const words = [
  { text: "Uma", page: 1, paragraphEnd: false },
  { text: "frase.", page: 2, paragraphEnd: true },
];
const flush = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};
test("two app installations isolate accounts, retain old data for an explicit claim, and restore metadata before the file", async () => {
  const catalogs = new Map<string, any>();
  const calls: { name: string; owner: string; args: any }[] = [];
  const alerts: any[] = [];
  let holdOwner: string | undefined;
  let releaseRead: (() => void) | undefined;
  const built = await build({
    entryPoints: ["App.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react", "react/jsx-runtime"],
    plugins: [
      {
        name: "native-test",
        setup(build) {
          build.onResolve({ filter: /^react-native-gesture-handler$/ }, () => ({
            path: "gestures",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^react-native-reanimated$/ }, () => ({
            path: "animated",
            namespace: "stub",
          }));
          build.onResolve(
            { filter: /^expo-image-picker$|^expo-image-manipulator$/ },
            () => ({ path: "images", namespace: "stub" }),
          );
          build.onResolve({ filter: /\/AppFonts$/ }, () => ({
            path: "fonts",
            namespace: "stub",
          }));
          build.onResolve({ filter: /\/AppModal$/ }, () => ({
            path: "dialogs",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^expo-localization$/ }, () => ({
            path: "localization",
            namespace: "stub",
          }));
          build.onResolve(
            { filter: /^@react-native-async-storage\/async-storage$/ },
            () => ({ path: "preferences", namespace: "stub" }),
          );
          build.onResolve(
            { filter: /^react-native-safe-area-context$/ },
            () => ({ path: "safe", namespace: "stub" }),
          );
          build.onResolve({ filter: /^react-native$/ }, () => ({
            path: "rn",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
            path: "fs",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^expo-crypto$/ }, () => ({
            path: "crypto",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^expo-document-picker$/ }, () => ({
            path: "picker",
            namespace: "stub",
          }));
          build.onResolve({ filter: /^expo-status-bar$/ }, () => ({
            path: "status",
            namespace: "stub",
          }));
          build.onResolve({ filter: /\/backend$|^\.\/backend$/ }, () => ({
            path: "backend",
            namespace: "stub",
          }));
          build.onResolve(
            { filter: /\/PdfView$|\/PdfPageReader$/ },
            (args) => ({
              path: args.path.includes("PageReader") ? "pages" : "pdf",
              namespace: "stub",
            }),
          );
          build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => {
            const contents: Record<string, string> = {
              fonts: `export function AppFonts({children}){return children;}`,
              gestures: `const gesture=()=>new Proxy({}, {get:(_,key)=>()=>gesture()});export const Gesture={Pan:gesture,Native:gesture,Tap:gesture,Simultaneous:gesture};export function GestureDetector({children}){return children};export function GestureHandlerRootView({children}){return children};`,
              animated: `export const useSharedValue=value=>({value});export const useAnimatedStyle=fn=>fn();export const ReduceMotion={Never:'never'};export const withTiming=v=>v;export const withSpring=v=>v;export const useReducedMotion=()=>true;export const runOnUI=fn=>fn;export const runOnJS=fn=>fn;export const cancelAnimation=()=>{};export default {View:'View'};`,
              images: `export const launchImageLibraryAsync=async()=>({canceled:true});export const manipulateAsync=async()=>({uri:'image'});export const SaveFormat={JPEG:'jpeg'};`,
              dialogs: `export const appAlert={alert:(...args)=>alerts.push(args)};export function DialogHost(){return null};export function AppModal({children,visible=true,onClose}){return visible?require('react').createElement('Modal',{onRequestClose:onClose},children):null};export const modalStyles={};`,
              localization:
                'export const getLocales=()=>[{languageTag:"pt-BR"}];',
              preferences:
                'export default {getItem:async key=>{try{return await fs.readAsStringAsync("preferences/"+key);}catch{return null;}},setItem:async(key,value)=>fs.writeAsStringAsync("preferences/"+key,value)};',

              safe: `export const SafeAreaView="SafeAreaView";export function SafeAreaProvider({children}){return children;}export const initialWindowMetrics=null;export const useSafeAreaInsets=()=>({top:44,bottom:34,left:0,right:0});`,
              rn:
                `export const Platform={OS:'ios',select:o=>o.ios||o.default};export const StyleSheet={flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s,create:o=>o,absoluteFillObject:{}};export const AppState={currentState:'active',addEventListener:()=>({remove(){}})};export const Linking={getInitialURL:async()=>null,addEventListener:()=>({remove(){}})};export const Alert={alert:(...args)=>alerts.push(args)};export const Keyboard={dismiss(){},addListener:()=>({remove(){}})};export const StatusBar={currentHeight:0};export const useWindowDimensions=()=>({width:390,height:844,fontScale:1});` +
                [
                  "SafeAreaView",
                  "ScrollView",
                  "View",
                  "Text",
                  "TextInput",
                  "TouchableOpacity",
                  "Pressable",
                  "Modal",
                  "KeyboardAvoidingView",
                  "ActivityIndicator",
                  "FlatList",
                  "Image",
                  "InputAccessoryView",
                ]
                  .map((n) => `export const ${n}='${n}';`)
                  .join(""),
              fs: 'export const documentDirectory=fs.documentDirectory;export const getInfoAsync=fs.getInfoAsync;export const readAsStringAsync=fs.readAsStringAsync;export const writeAsStringAsync=fs.writeAsStringAsync;export const copyAsync=fs.copyAsync;export const deleteAsync=fs.deleteAsync;export const makeDirectoryAsync=async()=>{};export const moveAsync=async({from,to})=>{await fs.copyAsync({from,to});await fs.deleteAsync(from)};export const EncodingType={Base64:"base64"};',
              crypto: `export const CryptoDigestAlgorithm={SHA256:'sha'};export const randomUUID=()=>String(++uuid);export const digestStringAsync=async()=>"${hash}";`,
              picker:
                'export const getDocumentAsync=async()=>({canceled:false,assets:[{uri:"picked",name:"Original.pdf",size:10}]});',
              status: 'export const StatusBar="StatusBar";',
              backend:
                "export const backend=auth;export const readOfflineSession=async()=>auth.offline||null;export const rpc=invoke;export const recoveryState={get:async()=>null,set:async()=>{},clear:async()=>{}};",
              pages:
                'export function PdfPageReader(props){return require("react").createElement("Pages",props);}',
              pdf: 'export function PdfView(props){return require("react").createElement("PDF",props);}',
            };
            return { contents: contents[args.path] };
          });
        },
      },
    ],
  });
  function install(files = new Map<string, string>(), offlineOwner?: string) {
    let session: any = null,
      listener: ((event: string, session: any) => void) | undefined;
    const fs = {
      documentDirectory: "local/",
      getInfoAsync: async (p: string) => ({ exists: files.has(p) }),
      readAsStringAsync: async (p: string) => {
        if (!files.has(p)) throw Error("missing");
        return files.get(p)!;
      },
      writeAsStringAsync: async (p: string, v: string) => {
        files.set(p, v);
      },
      copyAsync: async ({ from, to }: any) => {
        files.set(to, files.get(from) || "pdf");
      },
      deleteAsync: async (p: string) => {
        files.delete(p);
      },
    };
    const auth = {
      offline: offlineOwner
        ? { user: { id: offlineOwner, email: "offline@example.test" } }
        : null,
      auth: {
        getSession: async () => ({
          data: { session },
          error: offlineOwner
            ? {
                name: "AuthRetryableFetchError",
                message: "Network request failed",
              }
            : null,
        }),
        onAuthStateChange: (fn: any) => {
          listener = fn;
          return { data: { subscription: { unsubscribe() {} } } };
        },
        startAutoRefresh() {},
        stopAutoRefresh() {},
      },
    };
    const invoke = async (
      name: string,
      args: any = {},
      owner = session?.user.id,
    ) => {
      if (owner !== session?.user.id) throw Error("owner changed");
      calls.push({ name, owner, args });
      if (name === "library_get") {
        if (owner === holdOwner) {
          holdOwner = undefined;
          await new Promise<void>((resolve) => {
            releaseRead = resolve;
          });
        }
        return structuredClone(
          catalogs.get(owner) || {
            revision: 0,
            data: { documents: [], shelves: [] },
            presented: {},
          },
        );
      }
      if (name === "library_put") {
        const old = catalogs.get(owner) || {
          revision: 0,
          data: { documents: [], shelves: [] },
        };
        if (old.revision !== args.p_revision)
          return { ...structuredClone(old), accepted: false };
        const next = {
          revision: old.revision + 1,
          data: structuredClone(args.p_data),
          presented: {},
        };
        catalogs.set(owner, next);
        return { ...next, accepted: true };
      }
      if (name === "my_profile")
        return [
          {
            username: owner === a ? "conta_a" : "conta_b",
            total_words: 0,
            completed_pdfs: 0,
          },
        ];
      if (name === "document_sync_state") return true;
      return [];
    };
    const App = new Function(
      "require",
      "fs",
      "auth",
      "invoke",
      "alerts",
      `let uuid=0;const module={exports:{}};${built.outputFiles[0].text};return module.exports.default;`,
    )(require, fs, auth, invoke, alerts);
    return {
      App,
      files,
      login(id: string | null) {
        session = id
          ? {
              user: {
                id,
                email: id === a ? "a@example.test" : "b@example.test",
              },
            }
          : null;
        listener?.(id ? "SIGNED_IN" : "SIGNED_OUT", session);
      },
    };
  }
  const first = install();
  first.files.set("local/" + hash + ".pdf", "PDF bytes");
  first.files.set(
    "local/pdfast-" + hash + ".v2.words.json",
    JSON.stringify(words),
  );
  first.files.set(
    "local/pdfast-state-1.json",
    JSON.stringify({
      revision: 1,
      documents: [
        {
          hash,
          title: "Original.pdf",
          uri: "old",
          position: 1,
          readingStart: 1,
          seen: [0],
          extractionVersion: 2,
          chapterDetectionVersion: CHAPTER_DETECTION_VERSION,
          chapterStarts: [],
          synced: true,
        },
      ],
      shelves: [{ id: "s", name: "Favoritos" }],
      queue: [],
    }),
  );
  let r1: any, r2: any, r3: any, r4: any;
  try {
    await act(async () => {
      r1 = create(React.createElement(first.App));
      await flush();
    });
    const library = (r: any) =>
      r.root.findAll((n: any) => n.type?.name === "Library")[0];
    assert.equal(library(r1).props.local.documents.length, 0); // guest never receives old shared data
    const tabScrolls = r1.root.findAll(
      (n: any) =>
        n.type === "ScrollView" &&
        n.props.contentContainerStyle?.paddingHorizontal === 16,
    );
    assert.equal(tabScrolls.length, 4);
    assert.ok(
      tabScrolls.every(
        (n: any) => n.props.contentContainerStyle.paddingVertical === 22,
      ),
    );
    assert.ok(
      r1.root.findAll(
        (n: any) =>
          n.type === "View" &&
          n.props.style?.paddingHorizontal === 16 &&
          n.props.style?.paddingBottom === 12,
      ).length,
    );

    const textValues = (r: any) =>
      r.root
        .findAll((n: any) => n.type === "Text")
        .map((n: any) => n.children.join(""));
    const guestTexts = textValues(r1);
    const guestHint = guestTexts.findIndex((v: string) =>
      v.startsWith("Ao trocar de dispositivo"),
    );
    assert.equal(guestTexts[guestHint - 1], "Configurações");
    assert.ok(!guestTexts.includes("Gerenciar perfil"));
    assert.ok(!guestTexts.some((v: string) => v.endsWith("na conta")));

    await act(async () => {
      first.login(a);
      await flush();
    });
    assert.equal(library(r1).props.local.documents.length, 0);
    const claimButton = r1.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" &&
        n.findAll(
          (c: any) =>
            c.type === "Text" &&
            c.children.join("") === "Vincular biblioteca antiga",
        ).length,
    )[0];
    await act(async () => {
      claimButton.props.onPress();
      await flush();
    });
    const confirm = alerts
      .at(-1)[2]
      .find((v: any) => v.text === "Vincular a esta conta");
    assert.ok(confirm);
    await act(async () => {
      confirm.onPress();
      await flush();
    });
    assert.equal(library(r1).props.local.documents[0].position, 1);
    assert.equal(catalogs.get(a).data.documents.length, 1);
    await act(async () => {
      library(r1).props.onOpen(library(r1).props.local.documents[0]);
      await flush();
    });
    assert.equal(r1.root.findByType("Pages").props.page, 2);
    await act(async () => {
      r1.root.findByType("Pages").props.onBack();
      await flush();
    });
    holdOwner = a;
    await act(async () => {
      library(r1).props.onUpdate((v: any) => v);
      await flush();
    });
    assert.ok(releaseRead);
    await act(async () => {
      first.login(b);
      await flush();
      releaseRead?.();
      await flush();
    });
    assert.equal(r1.root.findAllByType("Pages").length, 0);
    assert.equal(library(r1).props.local.documents.length, 0);
    await act(async () => {
      first.login(a);
      await flush();
    });
    assert.equal(library(r1).props.local.documents[0].position, 1);
    const offline = install(new Map(first.files), a);
    await act(async () => {
      r3 = create(React.createElement(offline.App));
      await flush();
    });
    assert.equal(library(r3).props.local.documents[0].position, 1);
    assert.equal(library(r3).props.local.documents[0].available, true);
    const second = install();
    await act(async () => {
      r2 = create(React.createElement(second.App));
      await flush();
      second.login(a);
      await flush();
    });
    let missing = library(r2).props.local.documents[0];
    assert.equal(missing.available, false);
    assert.equal(missing.position, 0);
    assert.equal(missing.localResumeValid, false);
    assert.equal(missing.wordCount, 2);
    assert.ok(
      r2.root.findAll(
        (n: any) =>
          n.type === "Text" &&
          n.children.join("") === "PDF não encontrado neste dispositivo",
      ).length,
    );
    second.files.set("picked", "PDF bytes");
    await act(async () => {
      library(r2).props.onLocate(missing);
      await flush();
    });
    let extraction = r2.root.findByType("PDF");
    const staleExtraction = extraction.props.onExtract;
    await act(async () => {
      second.login(b);
      await flush();
    });
    await act(async () => {
      staleExtraction({
        words,
        extractionVersion: 3,
        pageCount: 2,
        sources: [[0], [1]],
      });
      await flush();
    });
    assert.equal(library(r2).props.local.documents.length, 0);
    await act(async () => {
      second.login(a);
      await flush();
    });
    missing = library(r2).props.local.documents[0];
    await act(async () => {
      library(r2).props.onLocate(missing);
      await flush();
    });
    extraction = r2.root.findByType("PDF");
    await act(async () => {
      extraction.props.onExtract({
        words: [{ text: "Merged", page: 1, paragraphEnd: false }],
        sources: [[0, 1]],
        pageCount: 2,
        extractionVersion: 3,
        legacy: { words, sources: [[0], [1]], chapterStarts: [] },
      });
      await flush();
    });
    const restored = r2.root.findByType("Pages").props.document;
    assert.equal(restored.available, true);
    assert.equal(restored.extractionVersion, 2);
    assert.equal(restored.position, 0);
    assert.equal(restored.localResumeValid, false);
    assert.equal(restored.resumePage, 2);
    assert.deepEqual(restored.seen, [0]);
    await act(async () => {
      r2.root.findByType("Pages").props.onChooseStart();
      await flush();
    });
    await act(async () => {
      r2.root
        .findAll((n: any) => n.type?.name === "SentencePicker")[0]
        .props.onConfirm(1);
      await flush();
    });
    const reader = r2.root.findAll(
      (n: any) => n.type?.name === "WordReader",
    )[0];
    await act(async () => {
      reader.props.onBack();
      await flush();
    });
    assert.equal(r2.root.findByType("Pages").props.page, 2);
    assert.deepEqual(r2.root.findByType("Pages").props.document.seen, [0]);
    const configuredStart =
      r2.root.findByType("Pages").props.document.readingStart;
    const noticesBeforeReopening = alerts.length;
    await act(async () => {
      r2.root.findByType("Pages").props.onBack();
      await flush();
    });
    await act(async () => {
      library(r2).props.onOpen(library(r2).props.local.documents[0]);
      await flush();
    });
    assert.equal(alerts.length, noticesBeforeReopening);
    assert.equal(r2.root.findByType("Pages").props.page, 2);
    await act(async () => {
      r2.root.findByType("Pages").props.onChangePage(1);
      await flush();
    });
    assert.equal(r2.root.findByType("Pages").props.document.position, 1); // page navigation never changes the word
    await act(async () => {
      r2.root.findByType("Pages").props.onChooseStart();
      await flush();
    });
    const picker = () =>
      r2.root.findAll((n: any) => n.type?.name === "SentencePicker")[0];
    assert.equal(picker().props.resumePosition, undefined);
    await act(async () => {
      picker().props.onConfirm(0, false);
      await flush();
    });
    const dynamic = () =>
      r2.root.findAll((n: any) => n.type?.name === "WordReader")[0];
    await act(async () => {
      dynamic().props.onBack();
      await flush();
    });
    assert.equal(
      r2.root.findByType("Pages").props.document.readingStart,
      configuredStart,
    );
    assert.deepEqual(r2.root.findByType("Pages").props.document.seen, [0]);
    await act(async () => {
      r2.root.findByType("Pages").props.onChooseStart();
      await flush();
    });
    assert.equal(picker().props.resumePosition, 0);
    await act(async () => {
      picker().props.onConfirm(0, true);
      await flush();
    });
    await act(async () => {
      dynamic().props.onBack();
      await flush();
    });
    assert.equal(r2.root.findByType("Pages").props.document.readingStart, 0);
    assert.deepEqual(r2.root.findByType("Pages").props.document.seen, [0]);

    const tab = (r: any, label: string) =>
      r.root.findAll(
        (n: any) =>
          n.type === "TouchableOpacity" &&
          n.props.accessibilityRole === "tab" &&
          n.findAll(
            (v: any) => v.type === "Text" && v.children.join("") === label,
          ).length,
      )[0];
    const language = (r: any, label: string) =>
      r.root.findAll(
        (n: any) =>
          n.type === "TouchableOpacity" &&
          n.props.accessibilityRole === "radio" &&
          n.findAll(
            (v: any) => v.type === "Text" && v.children.join("") === label,
          ).length,
      )[0];
    const pager = () =>
      r1.root.findAll((n: any) => n.type?.name === "SwipeTabs")[0];
    const staleSwipe = pager().props;
    await act(async () => {
      tab(r1, "Perfil").props.onPress();
      await flush();
    });
    const requestId = pager().props.request.id;
    await act(async () => {
      staleSwipe.onChange(1, staleSwipe.request.id);
      await flush();
    });
    assert.equal(pager().props.index, 3); // old gesture cannot undo the button tap
    await act(async () => {
      tab(r1, "Perfil").props.onPress();
      await flush();
    });
    assert.ok(pager().props.request.id > requestId); // reselect is a navigation command
    const profileTexts = textValues(r1);
    const usernameAt = profileTexts.indexOf("@conta_a");
    assert.ok(usernameAt >= 0);
    assert.equal(profileTexts[usernameAt + 1], "a@example.test");
    const deviceHintAt = profileTexts.findIndex((v: string) =>
      v.startsWith("Ao trocar de dispositivo"),
    );
    assert.deepEqual(profileTexts.slice(deviceHintAt - 2, deviceHintAt), [
      "Configurações",
      "Gerenciar perfil",
    ]);
    assert.ok(!profileTexts.some((v: string) => v.endsWith("na conta")));
    const email = r1.root.findAll(
      (n: any) => n.type === "Text" && n.children.join("") === "a@example.test",
    )[0];
    const username = r1.root.findAll(
      (n: any) => n.type === "Text" && n.children.join("") === "@conta_a",
    )[0];
    const flatten = (styles: any) =>
      Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
    assert.ok(
      flatten(email.props.style).fontSize <
        flatten(username.props.style).fontSize,
    );

    await act(async () => {
      r1.root
        .findAll(
          (n: any) =>
            n.type === "TouchableOpacity" &&
            n.findAll(
              (v: any) =>
                v.type === "Text" && v.children.join("") === "Configurações",
            ).length,
        )[0]
        .props.onPress();
      await flush();
    });
    await act(async () => {
      r1.root
        .findAll(
          (n: any) =>
            n.type === "TouchableOpacity" &&
            n.props.accessibilityLabel === "Idioma",
        )[0]
        .props.onPress();
      await flush();
    });
    await act(async () => {
      language(r1, "EN-US").props.onPress();
      await flush();
    });
    const customColors = { background: "#112233", word: "#FFEEDD" };
    await act(async () => {
      r1.root
        .findAll((n: any) => n.type?.name === "Settings")[0]
        .props.onChange(customColors);
      await flush();
    });
    assert.deepEqual(
      JSON.parse(first.files.get("preferences/pdfast.reader.colors")!),
      customColors,
    );
    assert.ok(tab(r1, "Profile"));
    await act(async () => {
      first.login(b);
      await flush();
    });
    assert.ok(tab(r1, "Profile"));
    await act(async () => {
      first.login(a);
      await flush();
      tab(r1, "Library").props.onPress();
      await flush();
    });
    assert.equal(library(r1).props.local.documents[0].title, "Original.pdf");
    assert.equal(library(r1).props.local.documents[0].position, 1);
    const restart = install(new Map(first.files));
    await act(async () => {
      r4 = create(React.createElement(restart.App));
      await flush();
    });
    assert.ok(tab(r4, "Profile"));
    await act(async () => {
      tab(r4, "Profile").props.onPress();
      await flush();
    });
    await act(async () => {
      r4.root
        .findAll(
          (n: any) =>
            n.type === "TouchableOpacity" &&
            n.findAll(
              (v: any) =>
                v.type === "Text" && v.children.join("") === "Settings",
            ).length,
        )[0]
        .props.onPress();
      await flush();
    });
    assert.deepEqual(
      r4.root.findAll((n: any) => n.type?.name === "Settings")[0].props.value,
      customColors,
    );
    assert.equal(calls.filter((c) => c.name === "submit_session").length, 0); // restored metadata never awards competitive credit
  } finally {
    await act(async () => {
      r1?.unmount();
      r2?.unmount();
      r3?.unmount();
      r4?.unmount();
      await flush();
    });
  }
});
