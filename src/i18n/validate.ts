export function validateTranslations(value: unknown): string[] {
  const errors: string[] = [];
  const placeholders = (s: string) =>
    [...new Set(s.match(/\{[a-zA-Z]\w*\}/g) || [])].sort().join(",");
  function visit(node: any, path: string) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push(`${path}: expected translation group`);
      return;
    }
    if ("pt" in node || "en" in node) {
      if (Object.keys(node).sort().join(",") !== "en,pt") {
        errors.push(`${path}: requires exactly pt and en`);
        return;
      }
      const forms = (v: any) =>
        typeof v === "string"
          ? [v]
          : v &&
              typeof v === "object" &&
              Object.keys(v).sort().join(",") === "one,other"
            ? [v.one, v.other]
            : [];
      const pt = forms(node.pt),
        en = forms(node.en);
      if (
        !pt.length ||
        pt.length !== en.length ||
        [...pt, ...en].some((s) => typeof s !== "string" || !s.trim())
      ) {
        errors.push(
          `${path}: languages must have matching nonempty strings or one/other forms`,
        );
        return;
      }
      const expected = placeholders(pt[0]);
      if ([...pt, ...en].some((s) => placeholders(s) !== expected))
        errors.push(`${path}: placeholder mismatch`);
      return;
    }
    if (!Object.keys(node).length) errors.push(`${path}: empty group`);
    for (const [key, child] of Object.entries(node))
      visit(child, path ? `${path}.${key}` : key);
  }
  visit(value, "");
  return errors;
}
