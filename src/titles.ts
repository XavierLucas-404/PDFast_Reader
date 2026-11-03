const entities: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};
/** Repair only reversible encoding damage; never guess missing characters. */
export function normalizeTitle(raw: string): string {
  let text = raw.normalize("NFC");
  for (let pass = 0; pass < 2; pass++)
    text = text
      .replace(
        /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
        (original, entity: string) => {
          if (entity[0] !== "#")
            return entities[entity.toLowerCase()] ?? original;
          const code =
            entity[1]?.toLowerCase() === "x"
              ? parseInt(entity.slice(2), 16)
              : parseInt(entity.slice(1), 10);
          return code > 0 &&
            code <= 0x10ffff &&
            !(code >= 0xd800 && code <= 0xdfff)
            ? String.fromCodePoint(code)
            : original;
        },
      )
      .normalize("NFC");
  if (/%[\da-f]{2}/i.test(text)) {
    try {
      text = decodeURIComponent(text).normalize("NFC");
    } catch {
      /* Preserve invalid percent escapes. */
    }
  }
  for (let pass = 0; pass < 2 && /[ÃÂ]/u.test(text); pass++) {
    if ([...text].some((c) => c.codePointAt(0)! > 255)) break;
    try {
      const repaired = decodeURIComponent(
        [...text]
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      ).normalize("NFC");
      const damage = (s: string) => (s.match(/[ÃÂ�]/gu) || []).length;
      if (damage(repaired) >= damage(text)) break;
      text = repaired;
    } catch {
      break;
    }
  }
  return text;
}
