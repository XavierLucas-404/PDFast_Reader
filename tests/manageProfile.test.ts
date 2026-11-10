import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("profile details are read-only; modal editing, password validation, pending email and cancelled drafts stay isolated", async () => {
  const runtime = {
    owner: "a",
    calls: [] as any[],
    failName: false,
    hold: null as null | Promise<void>,
  };
  const bundle = await build({
    stdin: {
      contents: `export {ManageProfile} from './src/ManageProfile';export {t} from './src/i18n';`,
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
        name: "mock",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^\.\/AppModal$|^react-native$|^\.\/backend$|i18n\/react$/,
            },
            (a) => ({ path: a.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents:
              a.path === "./AppModal"
                ? `import React from 'react';export const modalStyles={};export function AppModal({children,onClose}){return React.createElement('Modal',{onClose},children)}`
                : a.path === "react-native"
                  ? `export const View='View',Text='Text',TextInput='TextInput',TouchableOpacity='TouchableOpacity';export const Keyboard={dismiss(){}};export const StyleSheet={create:o=>o,flatten:s=>Array.isArray(s)?Object.assign({},...s.flat(Infinity).filter(Boolean)):s};export const Platform={select:o=>o.ios};`
                  : a.path === "./backend"
                    ? `export const backend={auth:{getSession:async()=>{if(runtime.hold)await runtime.hold;return {data:{session:{user:{id:runtime.owner}}}}},updateUser:async(...args)=>{runtime.calls.push({type:'update',args});return {error:null}},resetPasswordForEmail:async(...args)=>{runtime.calls.push({type:'reset',args});return {error:null}}}};export const rpc=async(name,args,owner)=>{runtime.calls.push({type:'rpc',name,args,owner});if(runtime.failName)throw {code:'23505'};};`
                    : `export const useI18n=()=>{};`,
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
    bundle.outputFiles[0].text,
  )(require, mod, mod.exports, runtime);
  const { ManageProfile, t } = mod.exports;
  let tree: any,
    refreshes = 0,
    signouts = 0,
    deletions = 0,
    backs = 0,
    pageChanges = 0;
  let props = {
    user: {
      id: "a",
      email: "old@example.test",
      new_email: "pending@example.test",
    },
    username: "lucas",
    externalBusy: false,
    onBack: () => {
      backs++;
    },
    onProfile: async () => {
      refreshes++;
    },
    onSignOut: () => {
      signouts++;
    },
    onDelete: () => {
      deletions++;
    },
    onPageChange: () => {
      pageChanges++;
    },
  };
  const render = () => React.createElement(ManageProfile, props);
  const texts = () =>
    tree.root
      .findAll((n: any) => n.type === "Text")
      .map((n: any) => n.children.join(""));
  const inputs = () => tree.root.findAllByType("TextInput");
  const field = (key: string) =>
    inputs().find((n: any) => n.props.accessibilityLabel === t(key));
  const button = (key: string) =>
    tree.root.findAll(
      (n: any) =>
        n.type === "TouchableOpacity" &&
        (n.props.accessibilityLabel === t(key) ||
          (key === "profile.back" &&
            n.props.accessibilityLabel === t("profile.backManage")) ||
          n.findAll(
            (v: any) => v.type === "Text" && v.children.join("") === t(key),
          ).length),
    )[0];
  const press = async (key: string) => {
    await act(async () => {
      button(key).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const enter = async (key: string, value: string) => {
    await act(async () => field(key).props.onChangeText(value));
  };
  try {
    await act(async () => {
      tree = create(render());
    });
    assert.equal(inputs().length, 0);
    assert.equal(tree.root.findAllByType("TouchableOpacity").length, 2);
    assert.ok(texts().includes("@lucas"));
    assert.ok(texts().includes("old@example.test"));
    assert.ok(texts().some((v: string) => v.includes("pending@example.test")));
    await press("profile.edit");
    assert.equal(inputs().length, 0);
    await press("auth.username");
    assert.equal(field("auth.username").props.value, "lucas");
    assert.equal(
      field("auth.username").props.placeholder,
      t("profile.usernameRule"),
    );
    await enter("auth.username", "draft");
    await press("common.cancel");
    assert.equal(inputs().length, 0);
    await press("auth.username");
    assert.equal(field("auth.username").props.value, "lucas");
    await act(async () => tree.root.findByType("Modal").props.onClose());
    await press("profile.changePassword");
    assert.equal(inputs().length, 2);
    assert.equal(field("profile.newPassword").props.secureTextEntry, true);
    assert.equal(
      field("profile.newPassword").props.placeholder,
      t("profile.passwordRule"),
    );
    await enter("profile.newPassword", "short");
    await enter("profile.confirmPassword", "short");
    await press("common.save");
    assert.equal(runtime.calls.length, 0);
    assert.ok(texts().some((v: string) => v.includes("8")));
    await press("common.cancel");
    await press("profile.changePassword");
    assert.equal(field("profile.newPassword").props.value, "");
    await enter("profile.newPassword", "valid-password");
    await enter("profile.confirmPassword", "different-password");
    await press("common.save");
    assert.equal(runtime.calls.length, 0);
    await enter("profile.confirmPassword", "valid-password");
    await press("common.save");
    assert.equal(runtime.calls.at(-1).args[0].password, "valid-password");
    assert.equal(inputs().length, 0);
    assert.ok(texts().includes(t("profile.passwordSaved")));
    await press("profile.changePassword");
    assert.equal(
      button("profile.resetPasswordEmail").props.accessibilityRole,
      "link",
    );
    await press("profile.resetPasswordEmail");
    assert.equal(runtime.calls.at(-1).type, "reset");
    await press("profile.changeEmail");
    assert.equal(field("profile.newEmail").props.value, "");
    assert.equal(field("profile.newEmail").props.keyboardType, "email-address");
    await enter("profile.newEmail", "old@example.test");
    const emailCalls = runtime.calls.length;
    await press("common.save");
    assert.equal(runtime.calls.length, emailCalls);
    await enter("profile.newEmail", "new@example.test");
    await press("common.save");
    assert.deepEqual(runtime.calls.at(-1).args[0], {
      email: "new@example.test",
    });
    assert.ok(texts().includes("old@example.test"));
    assert.ok(texts().includes(t("profile.emailRequested")));
    await press("auth.username");
    runtime.failName = true;
    await press("common.save");
    assert.equal(refreshes, 0);
    assert.equal(inputs().length, 1);
    assert.ok(
      tree.root.findAll(
        (n: any) =>
          n.type === "Text" && n.props.accessibilityLiveRegion === "polite",
      ).length,
    );
    runtime.failName = false;
    await enter("auth.username", " NOVO_NOME ");
    let release: () => void = () => {};
    runtime.hold = new Promise((resolve) => {
      release = resolve;
    });
    await press("common.save");
    await press("common.save");
    await press("common.cancel");
    await act(async () => tree.root.findByType("Modal").props.onClose());
    assert.equal(inputs().length, 1);
    assert.equal(button("common.cancel").props.disabled, true);
    const before = runtime.calls.length;
    await act(async () => {
      release();
      runtime.hold = null;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(runtime.calls.length, before + 1);
    assert.equal(refreshes, 1);
    assert.equal(runtime.calls.at(-1).args.p_username, "novo_nome");
    assert.equal(inputs().length, 0);
    const labels = tree.root.findAllByType("TouchableOpacity").map((n: any) =>
      n
        .findAllByType("Text")
        .map((v: any) => v.children.join(""))
        .join(""),
    );
    assert.deepEqual(labels.slice(-2), [
      t("common.signOut"),
      t("profile.deleteAccount"),
    ]);
    await press("common.signOut");
    await press("profile.deleteAccount");
    assert.equal(signouts, 1);
    assert.equal(deletions, 1);
    await press("profile.back");
    await press("profile.edit");
    await press("auth.username");
    assert.equal(field("auth.username").props.value, "lucas");
    runtime.owner = "b";
    const count = runtime.calls.length;
    await press("common.save");
    assert.equal(runtime.calls.length, count);
    props = {
      ...props,
      user: { id: "b", email: "b@example.test", new_email: "" },
      username: "outra",
    };
    await act(async () => tree.update(render()));
    assert.equal(inputs().length, 0);
    await press("profile.edit");
    await press("auth.username");
    assert.equal(field("auth.username").props.value, "outra");
    await press("common.cancel");
    await press("profile.changeEmail");
    assert.equal(field("profile.newEmail").props.value, "");
    await press("common.cancel");
    await press("profile.back");
    await press("profile.back");
    assert.equal(backs, 1);
    assert.ok(pageChanges >= 5);
  } finally {
    await act(async () => tree?.unmount());
  }
});
