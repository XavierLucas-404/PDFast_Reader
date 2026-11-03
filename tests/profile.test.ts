import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProfilePassword, profileState } from "../src/profileLogic";
import { authError } from "../src/authLogic";
test("Profile password changes validate length and confirmation before submitting", () => {
  assert.throws(() => validateProfilePassword("short", "short"), /8/);
  assert.throws(
    () => validateProfilePassword("abcdefgh", "abcdefgi"),
    /coincidem/,
  );
  assert.doesNotThrow(() => validateProfilePassword("abcdefgh", "abcdefgh"));
  assert.match(
    authError({ code: "reauthentication_needed" }),
    /Redefinir senha/,
  );
});

test("Profile onboarding waits for a loaded profile, including failures and returning users", () => {
  assert.equal(profileState(null), "loading");
  assert.equal(profileState(null, "offline"), "error");
  assert.equal(profileState({ username: null }), "needsUsername");
  assert.equal(profileState({ username: "lucas" }), "ready");
  assert.equal(profileState({ username: "lucas" }, "offline"), "ready");
});
