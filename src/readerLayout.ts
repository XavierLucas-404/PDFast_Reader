/** Space below the fixed central word, excluding the system navigation area. */
export function readerLayout(
  width: number,
  height: number,
  footerTop: number,
  insets: { bottom: number },
) {
  const available = Math.max(0, height - footerTop - insets.bottom);
  return {
    contextHeight: Math.max(
      0,
      Math.min(width > height ? 44 : 88, available - 86),
    ),
  };
}
