import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import translations from "../src/i18n/translations.json";
import {
  t,
  m,
  renderMessage,
  AppError,
  setLanguagePreference,
  setSystemLanguage,
  languageFromTag,
  getLanguage,
  formatDate,
  formatNumber,
  formatPercent,
  ordinal,
  hasTranslation,
} from "../src/i18n";
import { validateTranslations } from "../src/i18n/validate";
import { authError, errorMessage } from "../src/authLogic";
import { shelfNameError, restoreShelves } from "../src/shelves";
test("every catalog entry has matching Portuguese/English forms and interpolation parameters", () => {
  assert.deepEqual(validateTranslations(translations), []);
  assert.ok(
    validateTranslations({ a: { pt: "Oi {name}", en: "Hello" } }).length,
  );
  assert.ok(validateTranslations({ a: { pt: "Oi" } }).length);
  assert.ok(
    validateTranslations({
      a: { pt: { one: "Um", other: "Vários" }, en: "Several" },
    }).length,
  );
  assert.equal(hasTranslation(undefined as any), false);
});
test("language detection, explicit preferences, formatting and singular counts are deterministic", () => {
  try {
    setLanguagePreference("system");
    setSystemLanguage("pt-PT");
    assert.equal(getLanguage(), "pt");
    setSystemLanguage("es-MX");
    assert.equal(getLanguage(), "en");
    assert.equal(languageFromTag("pt-BR"), "pt");
    assert.equal(languageFromTag("en-CA"), "en");
    setLanguagePreference("pt");
    setSystemLanguage("en-US");
    assert.equal(getLanguage(), "pt");
    assert.equal(t("library.shelfCount", { count: 0 }), "0 estantes");
    assert.equal(t("library.shelfCount", { count: 1 }), "1 estante");
    assert.equal(t("library.shelfCount", { count: 2 }), "2 estantes");
    assert.equal(t("reader.pageOf", { page: 2, total: 10 }), "Página 2 de 10");
    setLanguagePreference("en");
    assert.equal(t("library.shelfCount", { count: 0 }), "0 shelves");
    assert.equal(t("library.shelfCount", { count: 1 }), "1 shelf");
    assert.equal(t("reader.pageOf", { page: 2, total: 10 }), "Page 2 of 10");
    assert.equal(formatNumber(1234, "pt"), "1.234");
    assert.equal(formatNumber(1234, "en"), "1,234");
    assert.equal(formatPercent(75, "en"), "75%");
    assert.equal(ordinal(1, "en"), "1st");
    assert.equal(ordinal(2, "en"), "2nd");
    assert.equal(ordinal(3, "en"), "3rd");
    assert.equal(ordinal(11, "en"), "11th");
    assert.equal(ordinal(21, "en"), "21st");
    assert.equal(ordinal(1, "pt"), "1º");
    const date = new Date(2026, 9, 29, 12);
    assert.equal(formatDate(date, false, "en"), "10/29/2026");
    assert.equal(formatDate(date, false, "pt"), "29/10/2026");
  } finally {
    setLanguagePreference("pt");
  }
});
test("stored messages, nested errors and coded validation errors change language without replacing user text", () => {
  try {
    setLanguagePreference("pt");
    const err = new AppError("errors.passwordMismatch");
    const notice = m("errors.save", { reason: errorMessage(err) });
    assert.match(renderMessage(notice), /senhas/);
    setLanguagePreference("en");
    assert.match(renderMessage(notice), /passwords/);
    assert.match(err.message, /passwords/);
    assert.equal(
      authError({ code: "invalid_credentials" }),
      "Incorrect email or password.",
    );
    assert.equal(
      authError({ message: "private SQL internals" }),
      t("errors.generic"),
    );
    const title = "A Canção de Aquiles.pdf";
    assert.equal(
      t("library.documentOptions", { filename: title }),
      "Options for " + title,
    );
    assert.ok(shelfNameError("Unassigned", []));
    assert.ok(shelfNameError("Sem estante", []));
    const restored = restoreShelves({
      documents: [],
      shelves: [{ id: "existing", name: "Unassigned" }],
    });
    assert.equal(restored.shelves[0].name, "Unassigned");
  } finally {
    setLanguagePreference("pt");
  }
});
test("native screen text and accessible labels use the catalog, apart from branding and symbols", async () => {
  const names = [
    "App.tsx",
    ...(await readdir("src"))
      .filter((n) => n.endsWith(".tsx"))
      .map((n) => "src/" + n),
  ];
  const allowed = new Set(["PDFast", "Reader", "P D F A S T"]);
  const missed: string[] = [];
  for (const name of names) {
    const source = await readFile(name, "utf8");
    const file = ts.createSourceFile(name, source, 99, true);
    const walk = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (/[a-zA-ZÀ-ÿ]/.test(text) && !allowed.has(text))
          missed.push(name + ": " + text);
      }
      if (
        ts.isJsxAttribute(node) &&
        ["label", "accessibilityLabel", "placeholder"].includes(
          node.name.getText(file),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /[a-zA-ZÀ-ÿ]/.test(node.initializer.text) &&
        !["A−", "A+"].includes(node.initializer.text)
      )
        missed.push(name + ": " + node.initializer.text);
      ts.forEachChild(node, walk);
    };
    walk(file);
  }
  assert.deepEqual(missed, []);
});
