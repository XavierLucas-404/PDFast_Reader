import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordDiagnostic,
  diagnosticReport,
  scrubEvent,
} from "../src/diagnostics";
import { orphanedReadingFiles } from "../src/fileRetention";
test("reports exclude payloads, identity, messages, replay and attachments", () => {
  const secret = "PRIVATE-PDF-TITLE user@example.test bearer-secret";
  const output = scrubEvent({
    type: undefined,
    release: "0.2.0",
    user: { email: secret },
    request: { data: secret },
    breadcrumbs: [secret],
    extra: secret,
    contexts: secret,
    attachments: [secret],
    exception: {
      values: [
        {
          type: "Error",
          value: secret,
          stacktrace: {
            frames: [
              {
                filename: "app:///index.bundle",
                function: "read",
                lineno: 4,
                vars: secret,
                context_line: secret,
              },
            ],
          },
        },
      ],
    },
  });
  assert.ok(!JSON.stringify(output).includes(secret));
  assert.equal(output.exception.values[0].stacktrace.frames[0].lineno, 4);
  recordDiagnostic(
    "submit_reading_activity",
    { code: "23505", message: secret },
    3,
  );
  assert.ok(!diagnosticReport().includes(secret));
  assert.ok(diagnosticReport().includes("23505"));
});
test("orphan cleanup preserves PDFs and extractions referenced by another workspace or backup", () => {
  const a = "a".repeat(64),
    b = "b".repeat(64);
  assert.deepEqual(
    orphanedReadingFiles(
      [
        a + ".pdf",
        "pdfast-" + a + ".v3.words.json",
        b + ".pdf",
        "personal-photo.png",
      ],
      [{ documents: [{ hash: a }] }],
    ),
    [b + ".pdf"],
  );
});
