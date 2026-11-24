import { add, cross, dot, scale } from '../pyraminx/renderer.mjs';

function pointsOnFace(tile, points, a, b) {
  const fixed = tile.normal.findIndex(value => Math.abs(value) > 0.9);
  const plane = tile.center[fixed];
  const polygon = points.map(([x, y]) => {
    const point = [0, 0, 0];
    point[fixed] = plane;
    point[a] = x;
    point[b] = y;
    return point;
  });
  const first = polygon[0], second = polygon[1], third = polygon[2];
  const minus = (p, q) => p.map((value, i) => value - q[i]);
  if (dot(cross(minus(second, first), minus(third, first)), tile.normal) < 0) polygon.reverse();
  return polygon;
}

// Redi's fixed core is visible between four corner squares and four kite edges.
export function styleRedi(stickers, size) {
  if (size === 3) for (const tile of stickers) {
    const fixed = tile.normal.findIndex(value => Math.abs(value) > 0.9);
    const [a, b] = [0, 1, 2].filter(axis => axis !== fixed);
    const r = Math.abs(tile.center[fixed]), inner = r / 3, gap = 0;
    const x = tile.center[a], y = tile.center[b];
    let points;
    if (tile.polygon.length === 5) {
      const sx = Math.sign(x), sy = Math.sign(y);
      points = [[inner, inner], [r, inner], [r, r], [inner, r]].map(([u,v]) =>
        [sx * (u + (u === inner ? gap : -gap)), sy * (v + (v === inner ? gap : -gap))]);
    } else if (tile.polygon.length === 3) {
      const horizontal = Math.abs(x) > Math.abs(y), sign = Math.sign(horizontal ? x : y);
      points = [[inner + gap, -inner + gap], [r - gap, -inner + gap],
        [r - gap, inner - gap], [inner + gap, inner - gap], [gap, 0]]
        .map(([u, v]) => horizontal ? [sign * u, v] : [v, sign * u]);
    } else {
      tile.hiddenSticker = true;
      continue;
    }
    tile.renderPolygon = pointsOnFace(tile, points, a, b);
    const visualCenter = tile.renderPolygon.reduce((sum, point) => add(sum, point), [0, 0, 0]);
    tile.renderCenter = scale(visualCenter, 1 / tile.renderPolygon.length);
    tile.stickerPolygon = tile.renderPolygon.map(point =>
      add(scale(point, 0.965), scale(tile.renderCenter, 0.035)));
  }
  else for (const tile of stickers) {
    tile.stickerPolygon = tile.polygon.map(point => add(scale(point, 0.94), scale(tile.center, 0.06)));
  }
  return ['#f4f3ed', '#f4d640', '#da4148', '#ee8935', '#36a760', '#3679d2'];
}
