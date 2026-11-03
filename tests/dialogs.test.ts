import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { createRequire } from "node:module";
import {
  appAlert,
  closeDialog,
  discardDialogs,
  registerModal,
  useDialogs,
  modalPresentationDelay,
} from "../src/dialogState";
const require = createRequire(import.meta.url),
  { create, act } = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test("dialog cancellation never confirms, repeated taps run an action once, and modal transitions track the active host", async () => {
  let tree: any,
    snapshot: any,
    confirmed = 0,
    cancelled = 0;
  function Observer() {
    snapshot = useDialogs();
    return null;
  }
  try {
    await act(async () => {
      discardDialogs();
      tree = create(React.createElement(Observer));
    });
    await act(async () =>
      appAlert.alert("Choose position", "PDF", [
        { text: "Cancel", style: "cancel", onPress: () => cancelled++ },
        { text: "Remote", onPress: () => confirmed++ },
      ]),
    );
    await act(async () => closeDialog(snapshot.dialogs[0].actions[0]));
    assert.equal(cancelled, 1);
    assert.equal(confirmed, 0);
    await act(async () =>
      appAlert.alert("Delete", "Account", [
        { text: "Delete", style: "destructive", onPress: () => confirmed++ },
      ]),
    );
    await act(async () => closeDialog());
    assert.equal(confirmed, 0);
    await act(async () => {
      appAlert.alert("One", "", [{ text: "Go", onPress: () => confirmed++ }]);
      appAlert.alert("Two");
    });
    const action = snapshot.dialogs[0].actions[0];
    await act(async () => {
      closeDialog(action);
      closeDialog(action);
    });
    assert.equal(confirmed, 1);
    assert.equal(snapshot.dialogs[0].title, "Two");
    let remove: () => void = () => {};
    await act(async () => {
      remove = registerModal("shelf");
    });
    assert.equal(snapshot.modals.at(-1), "shelf");
    await act(async () => remove());
    assert.equal(snapshot.modals.length, 0);
    assert.ok(modalPresentationDelay() > 0);
    await act(async () => discardDialogs());
    assert.equal(snapshot.dialogs.length, 0);
  } finally {
    await act(async () => {
      discardDialogs();
      tree?.unmount();
    });
  }
});
