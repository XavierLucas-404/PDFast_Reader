import type { Word } from "./core";
// Sentence boundaries are punctuation based; PDF line breaks are not sentences.
const sentenceEnd = /[.!?]["'”’»\)\]\}]*$/u;
export function getReadingContext(
  words: readonly Word[],
  position: number,
): string {
  if (!Number.isInteger(position) || position < 0 || position >= words.length)
    return "";
  let start = position;
  while (
    start > 0 &&
    !words[start - 1].heading &&
    !sentenceEnd.test(words[start - 1].text)
  )
    start--;
  let end = position;
  if (!sentenceEnd.test(words[position].text)) {
    for (
      let distance = 1;
      distance < 10 && position + distance < words.length;
      distance++
    ) {
      if (words[position + distance].heading) break;
      if (sentenceEnd.test(words[position + distance].text)) {
        end = position + distance;
        break;
      }
    }
  }
  return words
    .slice(start, end + 1)
    .map((word) => word.text)
    .join(" ");
}
