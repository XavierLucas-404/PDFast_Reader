// Diagnostic only: supply a local PDF path. No book content is checked into the repository.
import fs from "node:fs";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPage } from "../src/extraction";
import { sentenceChoices } from "../src/readingStart";
async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error("Informe o caminho do PDF de referência.");
  const pdf = await getDocument({
    data: new Uint8Array(fs.readFileSync(filename)),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  for (const [page, expected] of [
    [8, "MEU"],
    [12, "FUI"],
    [24, "EU"],
  ] as const) {
    const extraction = extractPage(
      (await (await pdf.getPage(page)).getTextContent()).items,
      page,
    );
    assert.equal(extraction.words[0].text, "Capítulo");
    assert.equal(extraction.words[2].text, expected);
    assert.ok(extraction.words[0].heading);
    assert.ok(
      sentenceChoices(extraction.words, page)[0].text.startsWith(
        expected + " ",
      ),
    );
    console.log(
      `Página ${page}: capitular, ordem e seleção de frase corretas.`,
    );
  }
  await pdf.destroy();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
