import { add, dot, scale } from '../pyraminx/renderer.mjs';

const subtract = (a, b) => add(a, scale(b, -1));
const interpolate = (a, b, t) => add(a, scale(subtract(b, a), t));

/**
 * Approximate the spherical cuts on each pentagonal face with clipped triangular
 * fragments. Fragments sharing a mask occupy the same solid cut region.
 */
export function buildShell(faces, vertices, axes, h, r2, resolution = 12) {
  const result = [];
  const centers = axes.map(axis => scale(axis, h));

  function divide(polygon, center) {
    const side = point => {
      const delta = subtract(point, center);
      return dot(delta, delta) - r2;
    };
    const values = polygon.map(side);
    if (values.every(value => value <= 1e-10)) return [polygon, null];
    if (values.every(value => value >= -1e-10)) return [null, polygon];
    const inside = [], outside = [];
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const point = polygon[i], next = polygon[j];
      const a = values[i], b = values[j];
      if (a <= 0) inside.push(point);
      if (a >= 0) outside.push(point);
      if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
        // Solve the sphere intersection along the edge to keep adjacent
        // fragments on the same curved boundary.
        const delta = subtract(next, point), relative = subtract(point, center);
        const A = dot(delta, delta), B = 2 * dot(relative, delta), C = dot(relative, relative) - r2;
        const root = Math.sqrt(Math.max(0, B * B - 4 * A * C));
        const first = (-B - root) / (2 * A), second = (-B + root) / (2 * A);
        const t = first >= 0 && first <= 1 ? first : second;
        const intersection = interpolate(point, next, Math.max(0, Math.min(1, t)));
        inside.push(intersection);
        outside.push(intersection);
      }
    }
    return [inside.length >= 3 ? inside : null, outside.length >= 3 ? outside : null];
  }

  function addTriangle(face, triangle) {
    let fragments = [{ polygon: triangle, mask: 0 }];
    for (const [axis, center] of centers.entries()) {
      const next = [];
      for (const fragment of fragments) {
        const [inside, outside] = divide(fragment.polygon, center);
        if (inside) next.push({ polygon: inside, mask: fragment.mask | (1 << axis) });
        if (outside) next.push({ polygon: outside, mask: fragment.mask });
      }
      fragments = next;
    }
    for (const fragment of fragments) result.push({ face, ...fragment });
  }

  for (const [face, { ids }] of faces.entries()) {
    const corners = ids.map(id => vertices[id]);
    const center = scale(corners.reduce(add), 1 / corners.length);
    for (const [i, corner] of corners.entries()) {
      const next = corners[(i + 1) % corners.length];
      const point = (row, column) => add(center,
        add(scale(subtract(corner, center), row / resolution),
          scale(subtract(next, corner), column / resolution)));
      for (let row = 0; row < resolution; row++) {
        for (let column = 0; column <= row; column++) {
          addTriangle(face, [point(row, column), point(row + 1, column), point(row + 1, column + 1)]);
          if (column < row) {
            addTriangle(face, [point(row, column), point(row + 1, column + 1), point(row, column + 1)]);
          }
        }
      }
    }
  }
  return result;
}
