import * as Sentry from "@sentry/react-native";
import { scrubEvent } from "./diagnostics";
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: !!dsn,
  sendDefaultPii: false,
  enableAutoSessionTracking: false,
  enableCaptureFailedRequests: false,
  // Native beforeSend must be configured and verified separately from the JS hook.
  // Keep it off even with a DSN until native payload filtering is validated.
  enableNative: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  enableLogs: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeSend: (event, hint) => {
    hint.attachments = [];
    return scrubEvent(event);
  },
});
export { Sentry };
