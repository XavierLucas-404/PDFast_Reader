import test from "node:test";
import assert from "node:assert/strict";
import { readerLayout } from "../src/readerLayout";

test("reader context leaves room for navigation insets and transport controls", () => {
  assert.equal(readerLayout(390, 844, 450, { bottom: 34 }).contextHeight, 88);
  assert.equal(readerLayout(844, 390, 230, { bottom: 24 }).contextHeight, 44);
  assert.equal(readerLayout(844, 390, 260, { bottom: 48 }).contextHeight, 0);
  assert.equal(readerLayout(844, 390, 260, { bottom: 0 }).contextHeight, 44);
  assert.equal(readerLayout(844, 300, 320, { bottom: 48 }).contextHeight, 0);
});
