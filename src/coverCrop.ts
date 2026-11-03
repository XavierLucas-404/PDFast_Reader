export function cropRectangle(
  width: number,
  height: number,
  zoom: number,
  x: number,
  y: number,
) {
  const scale = Math.max(240 / width, 360 / height) * zoom;
  const dx = Math.max(
    -(width * scale - 240) / 2,
    Math.min((width * scale - 240) / 2, x),
  );
  const dy = Math.max(
    -(height * scale - 360) / 2,
    Math.min((height * scale - 360) / 2, y),
  );
  return {
    originX: Math.max(0, ((width * scale) / 2 - 120 - dx) / scale),
    originY: Math.max(0, ((height * scale) / 2 - 180 - dy) / scale),
    width: Math.min(width, 240 / scale),
    height: Math.min(height, 360 / scale),
  };
}
