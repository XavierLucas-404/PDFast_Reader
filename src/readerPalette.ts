export type ReaderColors = { background: string; word: string };
export const readerDefaults: ReaderColors = {
  background: "#F5F0E7",
  word: "#33252B",
};
export const readerPresets: Record<string, ReaderColors> = {
  original: readerDefaults,
  light: { background: "#FFFFFF", word: "#202124" },
  dark: { background: "#15181D", word: "#EDF0F5" },
  sepia: { background: "#F3E2BF", word: "#443323" },
};
export function validColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}
export function parseReaderColors(value: unknown): ReaderColors {
  const v = value as Partial<ReaderColors> | null;
  return v && validColor(v.background) && validColor(v.word)
    ? { background: v.background.toUpperCase(), word: v.word.toUpperCase() }
    : readerDefaults;
}
export function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const readable = (bg: string) =>
  contrast(bg, "#000000") >= contrast(bg, "#FFFFFF") ? "#000000" : "#FFFFFF";
function mix(a: string, b: string, f: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - f) +
            parseInt(b.slice(i, i + 2), 16) * f,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function readerPalette(input: ReaderColors) {
  const { background, word } = parseReaderColors(input),
    ink = contrast(background, word) >= 4.5 ? word : readable(background),
    soft = mix(background, ink, 0.12),
    accent = contrast(background, word) >= 4.5 ? word : ink;
  return {
    background,
    word,
    ink,
    muted: ink,
    soft,
    border:
      contrast(background, mix(background, ink, 0.45)) >= 3
        ? mix(background, ink, 0.45)
        : ink,
    accent,
    onAccent: readable(accent),
    secondaryInk: contrast(soft, ink) >= 4.5 ? ink : readable(soft),
    statusStyle:
      readable(background) === "#FFFFFF"
        ? ("light" as const)
        : ("dark" as const),
    lowContrast: contrast(background, word) < 4.5,
  };
}
export function hsvColor(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

export function colorHsv(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    ),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h = 0;
  if (delta) {
    h =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}
