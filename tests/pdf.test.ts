import { Script } from "node:vm";
import { pdfHtml } from "../src/pdfHtml";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { tokenize } from "../src/extraction";
function fixture(text: boolean) {
  const stream = text
    ? "BT /F1 12 Tf 72 720 Td (Uma palavra por vez.) Tj ET"
    : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}
test("PDF.js extracts actual PDF content locally with page mapping", async () => {
  const pdf = await getDocument({
    data: fixture(true),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  assert.deepEqual(
    tokenize(content.items, 1).map((w) => w.text),
    ["Uma", "palavra", "por", "vez."],
  );
  await pdf.destroy();
});
test("PDF without extractable text produces an empty stream", async () => {
  const pdf = await getDocument({
    data: fixture(false),
    isEvalSupported: false,
  }).promise;
  const content = await (await pdf.getPage(1)).getTextContent();
  assert.equal(tokenize(content.items, 1).length, 0);
  await pdf.destroy();
});
test("invalid PDFs fail rather than producing fake text", async () => {
  await assert.rejects(
    getDocument({ data: new Uint8Array([1, 2, 3]), isEvalSupported: false })
      .promise,
  );
});
test("tokens preserve order, unicode and end-of-line pauses", () => {
  assert.deepEqual(
    tokenize(
      [
        { str: "Olá   mundo", hasEOL: true },
        { str: "ação" },
        { str: "   " },
        {},
      ],
      2,
    ),
    [
      { text: "Olá", page: 2, paragraphEnd: false },
      { text: "mundo", page: 2, paragraphEnd: true },
      { text: "ação", page: 2, paragraphEnd: false },
    ],
  );
});

test("offline PDF viewer bundle is valid JavaScript and has a restrictive CSP", () => {
  const script = pdfHtml.split("<script>")[1].split("</script>")[0];
  assert.doesNotThrow(() => new Script(script));
  assert.ok(pdfHtml.includes("default-src \'none\'"));
  assert.ok(!pdfHtml.includes("https://cdnjs.cloudflare.com"));
});
