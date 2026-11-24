import { add, scale } from '../pyraminx/renderer.mjs';

// Inset each edge and round the corners of the individual plastic pieces.
export function styleRedi(stickers) {
  for (const sticker of stickers) {
    const corners = sticker.polygon.map(point => add(scale(point, 0.90), scale(sticker.center, 0.10)));
    sticker.stickerPolygon = corners.flatMap((point, i) => {
      const previous = corners[(i + corners.length - 1) % corners.length];
      const next = corners[(i + 1) % corners.length];
      const start = add(scale(point, 0.78), scale(previous, 0.22));
      const end = add(scale(point, 0.78), scale(next, 0.22));
      return Array.from({ length: 5 }, (_, j) => {
        const t = j / 4;
        return add(add(scale(start, (1 - t) ** 2), scale(point, 2 * t * (1 - t))), scale(end, t ** 2));
      });
    });
  }
  return ['#f4f3ed', '#f4d640', '#da4148', '#ee8935', '#36a760', '#3679d2'];
}
