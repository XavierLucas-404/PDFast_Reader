import { t } from "./i18n";
export const libraryCounts = (pdfs: number, shelves: number) =>
  t("library.summary", {
    pdfs: t("library.pdfCount", { count: pdfs }),
    shelves: t("library.shelfCount", { count: shelves }),
  });
