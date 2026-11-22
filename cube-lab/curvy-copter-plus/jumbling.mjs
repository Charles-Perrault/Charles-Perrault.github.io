import { add, cross, dot, scale, rotate, edges, sides, tiles, cutCenters, cutRadius, splitCenter } from './puzzle.mjs';

export const jumbleAngle = Math.acos(1 / 3);
const angles = [0, jumbleAngle, Math.PI - jumbleAngle, Math.PI, Math.PI + jumbleAngle, 2 * Math.PI - jumbleAngle];
const tau = 2 * Math.PI;
const normalize = angle => ((angle + 3 * Math.PI) % tau) - Math.PI;
export const shapeTurnAngles = [...new Set(angles.flatMap(from => angles.map(to => Math.round(normalize(to - from) * 1e7))))]
  .filter(angle => angle !== 0).sort((a, b) => a - b).map(angle => angle / 1e7);
const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const epsilon = 1e-7;
const key = (kind, faces) => [kind, ...faces.slice().sort((a, b) => a - b)].join(':');
export const transform = (vector, pose) => add(add(scale(pose[0], vector[0]), scale(pose[1], vector[1])), scale(pose[2], vector[2]));
const inside = (point, center) => dot(point, point) + dot(center, center) - 2 * dot(point, center) - cutRadius ** 2;
const centerOf = tile => scale(tile.polygon.reduce(add), 1 / tile.polygon.length);
const anchors = tiles.map(centerOf);
const byPiece = new Map();
export const parts = [];
export const partOf = tiles.map((tile, id) => {
  const name = key(tile.kind, tile.kind === 'corner' || tile.kind === 'edge'
    ? [tile.face, ...tile.neighbors] : [tile.face, ...tile.moving.map(e => e + 6)]);
  if (!byPiece.has(name)) {
    byPiece.set(name, parts.length);
    parts.push({ kind: tile.kind, moving: tile.moving, ids: [], probes: [], cuts: new Map() });
  }
  const index = byPiece.get(name);
  const { probes } = parts[index];
  parts[index].ids.push(id);
  const center = anchors[id];
  probes.push(center);
  for (const point of tile.polygon) probes.push(point, add(scale(point, 0.75), scale(center, 0.25)));
  return index;
});

// Sample the solid regions as well as their exposed sticker outlines. The two
// halves of a Plus petal have independent volumes separated by a spherical cut.
const byMask = new Map();
for (const [index, part] of parts.entries()) {
  const mask = part.moving.reduce((m, edge) => m | 1 << edge, 0);
  if (!byMask.has(mask)) byMask.set(mask, []);
  byMask.get(mask).push(index);
}
for (let x = -12; x <= 12; x++) for (let y = -12; y <= 12; y++) for (let z = -12; z <= 12; z++) {
  const point = [x / 12, y / 12, z / 12];
  const mask = cutCenters.reduce((m, center, i) => inside(point, center) < -epsilon ? m | 1 << i : m, 0);
  const options = byMask.get(mask);
  if (!options) continue;
  const tile = tiles[parts[options[0]].ids[0]];
  const present = options.length === 1 ? options[0]
    : options.find(i => (parts[i].kind === 'petal') === (inside(point, splitCenter(tile.face, ...tile.neighbors)) < 0));
  if (present !== undefined) parts[present].probes.push(point);
}

const centerStickers = edges.map((_, edge) => tiles.findIndex(t => t.kind === 'edge' && t.moving[0] === edge));
const rotorParts = centerStickers.map(sticker => partOf[sticker]);
const poseCuts = new WeakMap();
const splitPartners = parts.flatMap((part, index) => {
  if (part.kind !== 'petal') return [];
  const tile = tiles[part.ids[0]];
  const partner = tiles.findIndex(other => other.kind === 'tip' && other.face === tile.face &&
    other.neighbors.every((face, i) => face === tile.neighbors[i]));
  return [[index, partOf[partner]]];
});

export function cubePoses() {
  return parts.map(() => basis);
}

export function rotationAngle(poses, edge) {
  const sticker = centerStickers[edge], normal = sides[tiles[sticker].face].axis;
  const axis = edges[edge].axis;
  const before = add(normal, scale(axis, -dot(normal, axis)));
  const after = transform(before, poses[partOf[sticker]]);
  return Math.atan2(dot(axis, cross(before, after)), dot(before, after));
}

export function edgeCut(poses, edge) {
  const center = cutCenters[edge];
  const captured = [];
  for (const [i, part] of parts.entries()) {
    const pose = poses[i];
    let partCache = poseCuts.get(pose);
    if (!partCache) poseCuts.set(pose, partCache = []);
    const cache = partCache[i] ??= new Int8Array(edges.length).fill(-2);
    let side = cache[edge];
    if (side === -2) {
      const local = pose.map(normal => dot(center, normal));
      const signature = local.map(x => Math.round(x * 1e8)).join(',');
      side = part.cuts.get(signature);
      if (side === undefined) {
        side = cutSide(part, local);
        part.cuts.set(signature, side);
      }
      cache[edge] = side;
    }
    if (side === -1) return null;
    if (side === 1) captured.push(i);
  }
  return captured.includes(rotorParts[edge]) && captured.every(i => parts[i].kind !== 'edge' || i === rotorParts[edge])
    ? captured : null;
}

function cutSide(part, local) {
  const exact = cutCenters.findIndex(v => Math.hypot(...add(v, scale(local, -1))) < epsilon);
  if (exact !== -1) return Number(part.moving.includes(exact));
  if (part.kind === 'tip' || part.kind === 'petal') {
    const tile = tiles[part.ids[0]];
    const split = splitCenter(tile.face, ...tile.neighbors);
    if (Math.hypot(...add(split, scale(local, -1))) < epsilon) return Number(part.kind === 'petal');
  }
  let negative = false, positive = false;
  for (const point of part.probes) {
    const gap = inside(point, local);
    if (gap < -epsilon) negative = true;
    if (gap > epsilon) positive = true;
    if (negative && positive) return -1;
  }
  return Number(negative);
}

export function optionsAt(poses, edge) {
  const capture = edgeCut(poses, edge);
  if (!capture) return [];
  const current = rotationAngle(poses, edge);
  return angles.flatMap(target => {
    const angle = normalize(target - current);
    return Math.abs(angle) > epsilon ? [{ edge, capture, angle, target }] : [];
  });
}

export function applyPose(poses, { edge, angle, capture }) {
  return poses.map((pose, i) => capture.includes(i) ? pose.map(v => rotate(v, edges[edge].axis, angle)) : pose);
}

const searchPoses = new Map();
const poseTransitions = new WeakMap();

function applySearchMove(poses, { edge, angle, capture }) {
  const command = edge * 100000 + Math.round(angle * 10000);
  return poses.map((pose, i) => {
    if (!capture.includes(i)) return pose;
    let turns = poseTransitions.get(pose);
    if (!turns) poseTransitions.set(pose, turns = new Map());
    const known = turns.get(command);
    if (known) return known;
    let next = pose.map(v => rotate(v, edges[edge].axis, angle));
    const key = next.flat().map(value => Math.round(value * 1e9)).join(',');
    if (searchPoses.has(key)) next = searchPoses.get(key);
    else if (searchPoses.size < 2048) searchPoses.set(key, next);
    if (searchPoses.size < 2048) turns.set(command, next);
    return next;
  });
}

export function remapColors(colors, slots) {
  const next = colors.slice();
  slots.forEach((destination, source) => { next[destination] = colors[source]; });
  return next;
}

export function jumbleMoves(poses, random = Math.random) {
  const choose = moves => moves[Math.floor(random() * moves.length)];
  const first = choose(edges.flatMap((_, edge) => optionsAt(poses, edge).filter(({ target }) =>
    target !== 0 && target !== Math.PI)));
  if (!first) return [];
  let current = applyPose(poses, first);
  const second = choose(edges.flatMap(({ axis }, edge) => {
    if (Math.abs(dot(axis, edges[first.edge].axis) - 0.5) > epsilon) return [];
    return optionsAt(current, edge).filter(({ capture }) => capture.some(i => first.capture.includes(i)));
  }));
  if (!second) return [first];
  current = applyPose(current, second);
  const third = choose(edges.flatMap((_, edge) => optionsAt(current, edge).filter(({ capture }) =>
    splitPartners.some(([petal, tip]) => capture.includes(petal) !== capture.includes(tip)))));
  return third ? [first, second, third] : [first, second];
}

export function jumbleScramble(poses, length, random = Math.random) {
  const moves = [];
  for (let i = 0; i < length; i++) {
    const available = edges.flatMap((_, edge) => edge === moves.at(-1)?.edge ? [] : optionsAt(poses, edge));
    if (!available.length) break;
    const move = available[Math.floor(random() * available.length)];
    moves.push(move);
    poses = applyPose(poses, move);
  }
  return moves;
}

const coordinate = value => Math.round(value * 100000);
const slotKey = (kind, face, point) => [kind, face, ...point.map(coordinate)].join(':');
const stickerSlots = new Map(tiles.map(({ kind, face }, id) => [slotKey(kind, face, anchors[id]), id]));

function slotAt(id, poses) {
  const tile = tiles[id];
  const pose = poses[partOf[id]];
  const normal = transform(sides[tile.face].axis, pose);
  const face = sides.findIndex(side => dot(normal, side.axis) > 1 - epsilon);
  if (face < 0) return -1;
  return stickerSlots.get(slotKey(tile.kind, face, transform(anchors[id], pose))) ?? -1;
}

export function cubeSlots(poses) {
  const used = new Set();
  const slots = [];
  for (const id of tiles.keys()) {
    const slot = slotAt(id, poses);
    if (slot < 0 || used.has(slot)) return null;
    slots.push(slot);
    used.add(slot);
  }
  return slots;
}

const shapeScore = poses => parts.reduce((sum, { ids }) => sum + Number(slotAt(ids[0], poses) < 0), 0);

function shapeKey(poses) {
  return tiles.map(({ face, kind }, id) => {
    const pose = poses[partOf[id]];
    const point = transform(anchors[id], pose);
    const normal = transform(sides[face].axis, pose);
    let code = ['edge', 'corner', 'petal', 'tip'].indexOf(kind);
    for (const value of [...point, ...normal]) code = code * 256 + Math.round(value * 64 + 128);
    return code;
  }).sort((a, b) => a - b).join(',');
}

const axisOrders = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2], [2, 1, 0]];
export const shapeFrames = axisOrders.flatMap((order, permutation) => [1, -1].flatMap(x =>
  [1, -1].flatMap(y => [1, -1].map(z => {
    const signs = [x, y, z], direction = x * y * z * (permutation < 3 ? 1 : -1);
    const map = p => order.map((j, i) => p[j] * signs[i]);
    const forward = edges.map(({ axis }) => {
      const dest = map(axis);
      return edges.findIndex(other => dot(other.axis, dest) > 0.999);
    });
    return { map, order, signs, direction, forward, back: forward.map((_, i) => forward.indexOf(i)) };
  }))));

const kinds = ['edge', 'corner', 'petal', 'tip'];
const tileKinds = tiles.map(tile => kinds.indexOf(tile.kind));
const packedStickers = new WeakMap();

function stickerWords(pose, id) {
  let stickers = packedStickers.get(pose);
  if (!stickers) packedStickers.set(pose, stickers = []);
  if (stickers[id]) return stickers[id];
  const point = transform(anchors[id], pose);
  const normal = transform(sides[tiles[id].face].axis, pose);
  return stickers[id] = Float64Array.from(shapeFrames, ({ order, signs }) => {
    let code = tileKinds[id];
    for (let i = 0; i < 3; i++) code = code * 256 + Math.round(point[order[i]] * signs[i] * 64 + 128);
    for (let i = 0; i < 3; i++) code = code * 256 + Math.round(normal[order[i]] * signs[i] * 64 + 128);
    return code;
  });
}

export function canonicalShape(poses) {
  const stops = edges.map((_, edge) => {
    const angle = rotationAngle(poses, edge);
    return Math.abs(Math.sin(angle)) < epsilon ? 0 : Math.sin(2 * angle) > 0 ? 1 : 2;
  });
  let minimum = Infinity, frames = [];
  for (const [index, frame] of shapeFrames.entries()) {
    let code = 0;
    for (const i of frame.back) code = code * 3 + (frame.direction < 0 && stops[i] ? 3 - stops[i] : stops[i]);
    if (code > minimum) continue;
    if (code < minimum) { minimum = code; frames = []; }
    frames.push(index);
  }
  const data = tiles.map((_, id) => stickerWords(poses[partOf[id]], id));
  let best, selected;
  for (const frame of frames) {
    const keys = Float64Array.from(data, words => words[frame]).sort();
    const id = keys.findIndex((code, i) => code !== best?.[i]);
    if (id !== -1 && (!best || keys[id] < best[id])) { best = keys; selected = shapeFrames[frame]; }
  }
  // Two independent 32-bit hashes retain the sorted geometry without long string keys.
  let a = 2166136261, b = 0x9e3779b9;
  for (const code of best) {
    a = Math.imul(a ^ (code | 0), 16777619);
    a = Math.imul(a ^ (code / 4294967296 | 0), 16777619);
    b = Math.imul(b ^ (code | 0), 0x85ebca6b);
    b = Math.imul(b ^ (code / 4294967296 | 0), 0xc2b2ae35);
  }
  return { hash: [a >>> 0, b >>> 0], frame: selected, rotorKey: minimum, tilted: stops.filter(Boolean).length };
}

const hashKey = (a, b) => a.toString(36) + '.' + b.toString(36);
let knownShapes;
export function installShapeTable(bytes) {
  if (bytes.byteLength % 9 !== 0) throw new Error('Invalid Curvy Copter Plus shape table');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const loaded = new Map();
  for (let i = 0; i < bytes.length; i += 9) {
    loaded.set(hashKey(view.getUint32(i, true), view.getUint32(i + 4, true)), view.getUint8(i + 8));
  }
  knownShapes = loaded;
}

function tablePath(origin, first) {
  if (!knownShapes) return null;
  const result = [];
  let poses = origin;
  const seen = new Set();
  for (;;) {
    const { hash, frame } = result.length || !first ? canonicalShape(poses) : first;
    const key = hashKey(...hash);
    const code = knownShapes.get(key);
    if (code === undefined || seen.has(key)) return null;
    if (code === 255) return cubeSlots(poses) ? result : null;
    seen.add(key);
    const edge = frame.back[Math.floor(code / shapeTurnAngles.length)];
    const angle = shapeTurnAngles[code % shapeTurnAngles.length] * frame.direction;
    const move = optionsAt(poses, edge).find(option => Math.abs(Math.sin((option.angle - angle) / 2)) < epsilon);
    if (!move) return null;
    result.push(move);
    poses = applyPose(poses, move);
  }
}

let nearCube;
function cubeShapeTable() {
  if (nearCube) return nearCube;
  const flat = cubePoses();
  const known = new Map([[shapeKey(flat), []]]);
  let queue = [{ poses: flat, word: [] }];
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const { poses, word } of queue) for (const edge of edges.keys()) {
      if (word.at(-1)?.edge === edge) continue;
      for (const move of optionsAt(poses, edge)) {
        const result = applyPose(poses, move), key = shapeKey(result);
        if (known.has(key)) continue;
        const path = [...word, move];
        known.set(key, path);
        next.push({ poses: result, word: path });
      }
    }
    queue = next;
  }
  return nearCube = known;
}

export function findCubeShape(origin, budget = 28000) {
  if (cubeSlots(origin)) return [];
  const first = canonicalShape(origin);
  const directTablePath = tablePath(origin, first);
  if (directTablePath) return directTablePath;
  const near = knownShapes ? null : cubeShapeTable();
  const deadline = performance.now() + budget, seen = new Set([hashKey(...first.hash)]);
  const meet = poses => {
    if (!near) return null;
    const fromCube = near.get(shapeKey(poses));
    if (!fromCube) return null;
    const suffix = [];
    for (const { edge, angle } of [...fromCube].reverse()) {
      const move = optionsAt(poses, edge).find(option => Math.abs(Math.sin((option.angle + angle) / 2)) < epsilon);
      if (!move) return null;
      poses = applySearchMove(poses, move);
      suffix.push(move);
    }
    return cubeSlots(poses) ? suffix : null;
  };
  const direct = meet(origin);
  if (direct) return direct;
  let beam = [{ poses: origin, word: [] }];
  for (let depth = 0; depth < 60 && beam.length; depth++) {
    const proposed = new Set();
    const next = [];
    for (const { poses, word } of beam) for (const edge of edges.keys()) {
      if (performance.now() > deadline) return null;
      if (word.at(-1)?.edge === edge) continue;
      for (const move of optionsAt(poses, edge)) {
        const result = applySearchMove(poses, move), canonical = canonicalShape(result);
        const key = hashKey(...canonical.hash);
        if (seen.has(key) || proposed.has(key)) continue;
        proposed.add(key);
        const path = [...word, move], score = shapeScore(result);
        if (score === 0 && cubeSlots(result)) return path;
        const suffix = tablePath(result, canonical) ?? meet(result);
        if (suffix) return [...path, ...suffix];
        next.push({ poses: result, word: path, score, tilted: canonical.tilted, rotorKey: canonical.rotorKey, key });
      }
    }
    beam = [];
    for (const weight of [1, 10, -3]) {
      const counts = new Map();
      const before = beam.length;
      next.sort((a, b) => a.score - b.score + weight * (a.tilted - b.tilted));
      for (const item of next) {
        if (seen.has(item.key)) continue;
        const count = counts.get(item.rotorKey) ?? 0;
        if (count >= 5) continue;
        counts.set(item.rotorKey, count + 1);
        seen.add(item.key);
        beam.push(item);
        if (beam.length - before === 32) break;
      }
    }
  }
  return null;
}

// Some shapes need several turns that move away from the solved silhouette
// before the blocked edges open up. Explore alternate routes to the table.
export function walkCubeShape(origin, visitLimit = 180000, report = () => {}) {
  if (!knownShapes) return null;
  const start = canonicalShape(origin);
  const direct = tablePath(origin, start);
  if (direct) return direct;
  let seed = start.hash[0] ^ start.hash[1];
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const seen = new Set();
  let visits = 0;
  for (let trial = 0; visits < visitLimit; trial++) {
    let poses = origin;
    const word = [];
    const tiltWeight = trial % 3 - 1;
    for (let step = 0; step < 12 + trial % 45 && visits < visitLimit; step++) {
      const options = edges.flatMap((_, edge) => edge === word.at(-1)?.edge ? [] : optionsAt(poses, edge));
      if (!options.length) {
        if (step === 0) return null;
        break;
      }
      let best, score = Infinity;
      for (let i = 0; options.length && i <= trial % 4 && visits < visitLimit; i++) {
        const [move] = options.splice(Math.floor(random() * options.length), 1);
        const next = applySearchMove(poses, move);
        const info = canonicalShape(next);
        const suffix = tablePath(next, info);
        if (suffix) return [...word, move, ...suffix];
        const key = hashKey(...info.hash);
        const rank = tiltWeight * info.tilted + random() * 3 + (seen.has(key) ? 3 : 0);
        seen.add(key);
        if (rank < score) { best = { move, next }; score = rank; }
        if (++visits % 10000 === 0) report(visits);
      }
      if (!best) break;
      poses = best.next;
      word.push(best.move);
    }
  }
  return null;
}

// Iterative deepening retains a finite frontier per pass. The worker can be
// stopped while this searches branches that the fast beam discarded.
export function searchCubeShape(origin, report = () => {}) {
  let seen;
  const path = [];
  const search = (poses, canonical, depth) => {
    const suffix = tablePath(poses, canonical);
    if (suffix) return [...path, ...suffix];
    if (!knownShapes && cubeSlots(poses)) return path.slice();
    if (depth === 0) return null;
    const key = hashKey(...canonical.hash);
    if ((seen.get(key) ?? -1) >= depth) return null;
    if (seen.size < 200000) seen.set(key, depth);
    const children = [];
    for (const edge of edges.keys()) {
      for (const move of optionsAt(poses, edge)) {
        const next = applySearchMove(poses, move), frame = canonicalShape(next);
        const known = tablePath(next, frame);
        if (known) return [...path, move, ...known];
        if (!knownShapes && cubeSlots(next)) return [...path, move];
        if (depth > 1) children.push({ move, next, frame, rank: shapeScore(next) + 2 * frame.tilted });
      }
    }
    for (const { move, next, frame } of children.sort((a, b) => a.rank - b.rank)) {
      path.push(move);
      const result = search(next, frame, depth - 1);
      if (result) return result;
      path.pop();
    }
    return null;
  };
  const canonical = canonicalShape(origin);
  for (let depth = 0; ; depth++) {
    seen = new Map();
    report(depth);
    const solution = search(origin, canonical, depth);
    if (solution) return solution;
  }
}
