import solids from './solids.mjs';
import { jumblingDodecacopter } from './dodeca-jumble.mjs';
import { add, dot, rotate, scale } from '../pyraminx/renderer.mjs';

const length = point => Math.hypot(...point);
const unit = point => scale(point, 1 / length(point));
const mix = (a, b, t) => add(scale(a, 1 - t), scale(b, t));
const mean = points => scale(points.reduce(add), 1 / points.length);
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const pointKey = p => p.map(value => Math.round(1e6 * value)).join(',');
const palette = ['#f5f1e7', '#e94549', '#55b6d9', '#f5a44a', '#744dc2', '#42ad68',
  '#e9d24c', '#4882d8', '#df70a8', '#805b49', '#a0ce56', '#a6aab2'];

const radius = length(solids.dodecahedron[0][2][0]);
const vertices = [], vertexIds = new Map(), edges = [], edgesByKey = new Map();
const faces = solids.dodecahedron.map(([normal, , corners]) => {
  const ids = corners.map(point => {
    const key = pointKey(point);
    if (!vertexIds.has(key)) {
      vertexIds.set(key, vertices.length);
      vertices.push(scale(point, 1 / radius));
    }
    return vertexIds.get(key);
  });
  const edgeIds = ids.map((a, i) => {
    const b = ids[(i + 1) % ids.length], key = edgeKey(a, b);
    if (!edgesByKey.has(key)) {
      edgesByKey.set(key, edges.length);
      const subscript = String(edges.length + 1).replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
      edges.push({ a, b, normal: unit(add(vertices[a], vertices[b])), order: 2, edge: edges.length,
        name: `E${subscript}` });
    }
    return edgesByKey.get(key);
  });
  return { normal, ids, edgeIds };
});
const vertexEdges = vertices.map((_, i) => edges.filter(({ a, b }) => a === i || b === i).map(({ edge }) => edge));

function arc(center, vertex, other) {
  const end = mix(vertex, other, .27);
  const control = mix(center, vertex, .56);
  return t => mix(mix(center, control, t), mix(control, end, t), t);
}
const sample = (curve, from, to) => Array.from({ length: 9 }, (_, i) => curve(from + (to - from) * i / 8));
const stickerKey = (face, vertex, band) => `${face}:${vertex}:${band}`;

export function dodecacopter(n) {
  if (n === 3) return jumblingDodecacopter(faces, vertices, edges, palette);
  const stickers = [], ids = new Map();
  const fullArc = curve => Array.from({ length: 8 * n + 1 }, (_, i) => curve(i / (8 * n)));
  function addTile(face, vertex, band, polygon, turns) {
    ids.set(stickerKey(face, vertex, band), stickers.length);
    stickers.push({ face, vertex, band, polygon, center: mean(polygon), normal: faces[face].normal, turns });
  }
  for (const [face, { ids: corners, edgeIds }] of faces.entries()) {
    const center = mean(corners.map(id => vertices[id]));
    for (const [i, a] of corners.entries()) {
      const previous = (i + 4) % 5, following = (i + 1) % 5;
      const A = vertices[a], B = vertices[corners[following]], P = vertices[corners[previous]];
      const right = arc(center, A, B), left = arc(center, A, P);
      const rightEdge = edgeIds[i], leftEdge = edgeIds[previous];
      const wedge = [...fullArc(right), ...fullArc(arc(center, B, A)).reverse().slice(0, -1)];
      addTile(face, rightEdge, -1, wedge, [rightEdge]);
      for (let band = 0; band < n; band++) {
        const low = band / n, high = (band + 1) / n;
        const top = mix(center, A, high);
        const bottom = low ? [mix(center, A, low)] : [];
        const polygon = [...sample(left, low, high), top, ...sample(right, high, low).slice(0, low ? 9 : 8), ...bottom];
        addTile(face, a, band, polygon, band === n - 1 ? vertexEdges[a] : [leftEdge, rightEdge]);
      }
    }
  }
  const home = Uint8Array.from(stickers, ({ face }) => face), state = home.slice();
  const permutations = edges.map(move => {
    const { edge, normal } = move;
    const rotatedIndex = (point, points) => {
      const target = rotate(point, normal, Math.PI);
      return points.findIndex(p => length(add(p, scale(target, -1))) < 1e-7);
    };
    const vertexMap = vertices.map(v => rotatedIndex(v, vertices));
    const faceNormals = faces.map(({ normal }) => normal);
    const faceMap = faceNormals.map(v => rotatedIndex(v, faceNormals));
    return Uint32Array.from(stickers, ({ face, vertex, band, turns }, id) => {
      if (!turns.includes(edge)) return id;
      const target = ids.get(stickerKey(faceMap[face], band < 0 ? edge : vertexMap[vertex], band));
      if (target === undefined || !stickers[target].turns.includes(edge)) throw new Error('Invalid Dodecacopter edge turn');
      return target;
    });
  });
  for (const permutation of permutations) {
    if (permutation.some((to, from) => permutation[to] !== from)) throw new Error('Invalid Dodecacopter half turn');
  }
  return { stickers, palette, moves: edges, home, state, turn({ edge }) {
    const permutation = permutations[edge];
    for (const [from, to] of permutation.entries()) {
      if (to > from) [state[from], state[to]] = [state[to], state[from]];
    }
  } };
}
