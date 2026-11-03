import translations from "./translations.json";
export type Language = "pt" | "en";
export type LanguagePreference = Language | "system";
type Keys<T> = {
  [K in keyof T & string]: T[K] extends { pt: unknown; en: unknown }
    ? K
    : `${K}.${Keys<T[K]>}`;
}[keyof T & string];
export type TranslationKey = Keys<typeof translations>;
export type Message = { key: TranslationKey; params?: Params };
export type Params = Record<string, string | number | Message>;
export type MessageValue = Message | string;
let language: Language = "pt",
  preference: LanguagePreference = "system",
  systemLanguage: Language = "pt";
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getPreference = () => preference;
export const getLanguageSnapshot = () => `${preference}:${language}`;
export const subscribeLanguage = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const languageFromTag = (tag: string): Language =>
  /^pt(?:-|$)/i.test(tag) ? "pt" : "en";
export const validPreference = (v: unknown): v is LanguagePreference =>
  v === "system" || v === "pt" || v === "en";
function publish() {
  language = preference === "system" ? systemLanguage : preference;
  listeners.forEach((fn) => fn());
}
export function setSystemLanguage(tag: string) {
  systemLanguage = languageFromTag(tag);
  publish();
}
export function setLanguagePreference(value: LanguagePreference) {
  preference = value;
  publish();
}
export const localeFor = (lang: Language = language) =>
  lang === "pt" ? "pt-BR" : "en-US";
function entry(key: string): any {
  return key.split(".").reduce((node: any, k) => node?.[k], translations);
}
export function hasTranslation(key: string): key is TranslationKey {
  return typeof key === "string" && !!entry(key)?.pt && !!entry(key)?.en;
}
const numbers = {
  pt: new Intl.NumberFormat("pt-BR"),
  en: new Intl.NumberFormat("en-US"),
};
const percents = {
  pt: new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0,
  }),
  en: new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }),
};
export function formatNumber(value: number, lang: Language = language) {
  return numbers[lang].format(value);
}
export function formatPercent(value: number, lang: Language = language) {
  return percents[lang].format(value / 100);
}
export function formatDate(
  value: Date | string,
  withTime = false,
  lang: Language = language,
) {
  const date = new Date(value);
  return withTime
    ? date.toLocaleString(localeFor(lang))
    : date.toLocaleDateString(localeFor(lang));
}
export function ordinal(value: number, lang: Language = language) {
  if (lang === "pt") return `${formatNumber(value, lang)}º`;
  const n = value % 100;
  return `${formatNumber(value, lang)}${n >= 11 && n <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] || "th"}`;
}
export const m = (key: TranslationKey, params?: Params): Message => ({
  key,
  params,
});
export function isMessage(value: unknown): value is Message {
  return (
    !!value &&
    typeof value === "object" &&
    hasTranslation((value as Message).key)
  );
}
export function t(
  key: TranslationKey,
  params: Params = {},
  lang: Language = language,
): string {
  const row = entry(key);
  let value =
    row?.[lang] ?? row?.en ?? row?.pt ?? entry("errors.generic")[lang];
  if (typeof value !== "string")
    value = value[Number(params.count) === 1 ? "one" : "other"];
  return value.replace(/\{([a-zA-Z]\w*)\}/g, (_match: string, name: string) => {
    const p = params[name];
    return isMessage(p)
      ? renderMessage(p, lang)
      : typeof p === "number"
        ? formatNumber(p, lang)
        : p === undefined
          ? ""
          : String(p);
  });
}
export function renderMessage(
  value: MessageValue | undefined | null,
  lang: Language = language,
): string {
  return isMessage(value) ? t(value.key, value.params, lang) : value || "";
}
export class AppError extends Error {
  readonly key: TranslationKey;
  readonly params?: Params;
  constructor(key: TranslationKey, params?: Params) {
    super(t(key, params));
    this.name = "AppError";
    this.key = key;
    this.params = params;
    Object.defineProperty(this, "message", {
      get: () => t(this.key, this.params),
    });
  }
}
/** Compatibility for a persisted/third-party error matching a known application message. Never display arbitrary server text. */
export function messageForText(value: string): Message | undefined {
  function visit(node: any, prefix: string): Message | undefined {
    for (const [key, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${key}` : key;
      const row = v as any;
      if (row.pt && row.en) {
        if (row.pt === value || row.en === value) return m(p as TranslationKey);
      } else {
        const found = visit(row, p);
        if (found) return found;
      }
    }
  }
  return visit(translations, "");
}
