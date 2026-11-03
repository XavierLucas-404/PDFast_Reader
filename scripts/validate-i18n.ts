import translations from "../src/i18n/translations.json";
import { validateTranslations } from "../src/i18n/validate";
const errors = validateTranslations(translations);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Translation catalog: Portuguese, English, plurals and placeholders validated.",
  );
