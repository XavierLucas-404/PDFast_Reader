/** Deliberately excludes messages, document/user identifiers and request payloads. */
export type Diagnostic = {
  at: string;
  operation: string;
  code: string;
  pending: number;
};
const events: Diagnostic[] = [];
export function safeCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && /^(?:[0-9A-Z]{5}|[a-z_]{2,48})$/.test(code)
    ? code
    : "unexpected";
}
export function recordDiagnostic(
  operation: string,
  error: unknown,
  pending = 0,
) {
  const row = {
    at: new Date().toISOString(),
    operation: /^[a-z_]{2,48}$/.test(operation) ? operation : "operation",
    code: safeCode(error),
    pending: Math.max(0, Math.floor(pending)),
  };
  events.push(row);
  if (events.length > 50) events.shift();
  return row;
}
export function diagnosticReport() {
  return JSON.stringify({ events }, null, 2);
}
/** Allow-list the entire report. Arbitrary SDK breadcrumbs/contexts/attachments are discarded. */
export function scrubEvent(event: any) {
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    exception: {
      values: (event.exception?.values || []).map((v: any) => ({
        type: typeof v.type === "string" ? v.type.slice(0, 80) : "Error",
        value: "Application error (details withheld)",
        stacktrace: {
          frames: (v.stacktrace?.frames || []).map((f: any) => ({
            filename:
              typeof f.filename === "string"
                ? f.filename.split(/[/?]/).filter(Boolean).pop()
                : undefined,
            function:
              typeof f.function === "string"
                ? f.function.slice(0, 120)
                : undefined,
            lineno: f.lineno,
            colno: f.colno,
            in_app: f.in_app,
          })),
        },
      })),
    },
  };
}
