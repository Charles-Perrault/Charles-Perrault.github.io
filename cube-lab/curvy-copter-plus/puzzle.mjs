export const sides = [
  { name: 'U', color: '#f3f2e8', axis: [0, 1, 0] },
  { name: 'D', color: '#fbd249', axis: [0, -1, 0] },
  { name: 'F', color: '#37ac68', axis: [0, 0, 1] },
  { name: 'B', color: '#4382de', axis: [0, 0, -1] },
  { name: 'R', color: '#e54d48', axis: [1, 0, 0] },
  { name: 'L', color: '#f48b39', axis: [-1, 0, 0] },
];

export const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const scale = (a, n) => a.map(x => x * n);
export function rotate(point, axis, angle) {
  const center = scale(axis, dot(axis, point));
  return add(center, add(scale(add(point, scale(center, -1)), Math.cos(angle)), scale(cross(axis, point), Math.sin(angle))));
}

export const edges = sides.flatMap((side, a) => sides.flatMap((other, b) =>
  a < b && dot(side.axis, other.axis) === 0
    ? [{ name: side.name + other.name, faces: [a, b], axis: scale(add(side.axis, other.axis), Math.SQRT1_2) }]
    : []));

export const tiles = [];
export const cutRadius = 1.4;
const cutOffset = (1 + Math.sqrt(2 * cutRadius ** 2 - 1)) / 2;
export const cutCenters = edges.map(({ axis }) => scale(axis, cutOffset * Math.SQRT2));
const splitOffset = cutOffset / 3;
const curve = x => cutOffset - Math.sqrt(cutOffset ** 2 - x ** 2);
const cornerRadius = Math.sqrt(cutRadius ** 2 - 1);
const splitRadius = Math.sqrt(cutRadius ** 2 - (4 * splitOffset - 1) ** 2);
export const splitCenter = (face, a, b) => add(scale(sides[face].axis, 4 * splitOffset),
  scale(add(sides[a].axis, sides[b].axis), -splitOffset));

function samples(fn, from, to, steps = 20) {
  return Array.from({ length: steps + 1 }, (_, i) => fn(from + (to - from) * i / steps));
}

function arc(center, radius, from, to) {
  const angle = p => Math.atan2(p[1] - center, p[0] - center);
  let start = angle(from), end = angle(to);
  if (end - start > Math.PI) end -= 2 * Math.PI;
  if (start - end > Math.PI) start -= 2 * Math.PI;
  return samples(t => [center + radius * Math.cos(t), center + radius * Math.sin(t)], start, end);
}

let low = 0, high = 1;
for (let i = 0; i < 40; i++) {
  const x = (low + high) / 2;
  if (Math.hypot(x + splitOffset, curve(x) + splitOffset) < splitRadius) low = x;
  else high = x;
}
const border = curve(1), split = (low + high) / 2;
const mate = ([x, y]) => [y, x];
const outer = [1, border], divider = [split, curve(split)];
const topCut = arc(cutOffset, cornerRadius, outer, mate(outer));
const petalCut = arc(-splitOffset, splitRadius, divider, mate(divider));
const along = (from, to) => samples(x => [x, curve(x)], from, to);
const wedge = [...along(0, 1), ...samples(x => [x, -curve(x)], 1, 0).slice(0, -1)];
const skins = {
  corner: [[1, 1], ...topCut],
  tip: [...along(split, 1), ...topCut.slice(1), ...along(1, split).map(mate).slice(1), ...[...petalCut].reverse().slice(1, -1)],
  petal: [...along(0, split), ...petalCut.slice(1), ...along(split, 0).map(mate).slice(1, -1)],
};
const keyOf = (kind, face, neighbors) => [kind, face, ...neighbors.slice().sort((a, b) => a - b)].join(':');

function tile(kind, face, neighbors, polygon, moving) {
  const key = keyOf(kind, face, neighbors);
  tiles.push({ key, kind, face, neighbors, polygon, moving });
}

for (const [face, side] of sides.entries()) {
  const neighbors = sides.flatMap((other, i) => dot(side.axis, other.axis) === 0 ? [i] : []);
  for (const a of neighbors) {
    const edge = edges.findIndex(item => item.faces.includes(face) && item.faces.includes(a));
    const edgePoint = ([x, y]) => add(side.axis, add(scale(sides[a].axis, x), scale(cross(side.axis, sides[a].axis), y)));
    tile('edge', face, [a], wedge.map(edgePoint), [edge]);
    for (const b of neighbors) {
      if (b <= a || dot(sides[a].axis, sides[b].axis) !== 0) continue;
      const axes = edges.flatMap((item, i) => item.faces.every(f => [a, b, face].includes(f)) ? [i] : []);
      const petalAxes = axes.filter(i => edges[i].faces.includes(face));
      const point = ([x, y]) => add(side.axis, add(scale(sides[a].axis, x), scale(sides[b].axis, y)));
      tile('corner', face, [a, b], skins.corner.map(point), axes);
      tile('petal', face, [a, b], skins.petal.map(point), petalAxes);
      tile('tip', face, [a, b], skins.tip.map(point), petalAxes);
    }
  }
}

const byKey = new Map(tiles.map(({ key }, i) => [key, i]));
export const solved = Uint8Array.from(tiles, tile => tile.face);
export const identity = Uint8Array.from(tiles, (_, i) => i);
export const action = edges.map(({ axis }, edge) => {
  const toFace = sides.map(({ axis: normal }) => {
    const rotated = rotate(normal, axis, Math.PI);
    return sides.findIndex(side => dot(rotated, side.axis) > 0.99);
  });
  return Uint8Array.from(tiles, ({ kind, moving, face, neighbors }, id) => {
    if (!moving.includes(edge)) return id;
    const target = byKey.get(keyOf(kind, toFace[face], neighbors.map(i => toFace[i])));
    if (target === undefined) throw new Error('Edge flip does not match a sticker slot');
    return target;
  });
});

export const turn = (state, move) => action[move].map(id => state[id]);
export const replay = (state, word) => word.reduce(turn, state);
export const isSolved = state => solved.every((color, i) => state[i] === color);
