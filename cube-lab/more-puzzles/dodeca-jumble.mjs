import { buildShell } from './dodeca-shell.mjs';
import { add, cross, dot, rotate, scale } from '../pyraminx/renderer.mjs';

const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const tau = 2 * Math.PI;
const epsilon = 1e-7;
const angleA = Math.acos(Math.sqrt(5) / 3);
const angleB = Math.acos(1 / Math.sqrt(5));
const alignments = [0, angleA, angleB, Math.PI / 2, Math.PI - angleB, Math.PI - angleA, Math.PI];
const targets = [...alignments, ...alignments.slice(1, -1).map(angle => -angle)];
const normalize = angle => ((angle + 3 * Math.PI) % tau) - Math.PI;
const transform = (point, pose) => add(add(scale(pose[0], point[0]), scale(pose[1], point[1])), scale(pose[2], point[2]));
const mean = points => scale(points.reduce(add), 1 / points.length);
const minus = (a, b) => add(a, scale(b, -1));
const pointKey = point => point.map(value => Math.round(value * 1e6)).join(',');
const tileKey = (face, mask) => `${face}:${mask}`;

function boundary(fragments) {
  const segments = new Map();
  for (const polygon of fragments) for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const from = pointKey(a), to = pointKey(b);
    if (from === to) continue;
    if (!segments.delete(`${to}/${from}`)) segments.set(`${from}/${to}`, { a, from, to });
  }
  const polygons = [], next = new Map();
  for (const segment of segments.values()) {
    if (next.has(segment.from)) return fragments;
    next.set(segment.from, segment);
  }
  while (next.size) {
    const first = next.values().next().value, polygon = [];
    let at = first;
    do {
      polygon.push(at.a);
      next.delete(at.from);
      if (at.to === first.from) break;
      at = next.get(at.to);
    } while (at);
    if (!at || polygon.length < 3) return fragments;
    polygons.push(polygon);
  }
  return polygons;
}

export function jumblingDodecacopter(faces, vertices, moves, palette) {
  const axes = moves.map(({ normal }) => normal);
  const normals = faces.map(({ normal }) => normal);
  const center = mean(faces[0].ids.map(id => vertices[id]));
  const radiusSquared = 1 + dot(center, center) - 2 * Math.max(...axes.map(axis => dot(axis, center)));
  const distance = (point, axis) => dot(point, point) + 1 - 2 * dot(point, axis) - radiusSquared;
  const maxFace = dot(normals[0], center);
  const parts = [], partFromMask = new Map();
  function partFor(mask) {
    if (!partFromMask.has(mask)) {
      partFromMask.set(mask, parts.length);
      parts.push({ mask, probes: [] });
    }
    return partFromMask.get(mask);
  }
  const groups = new Map();
  for (const { face, mask, polygon } of buildShell(faces, vertices, axes, 1, radiusSquared, 10)) {
    const key = tileKey(face, mask);
    if (!groups.has(key)) groups.set(key, { face, mask, fragments: [] });
    groups.get(key).fragments.push(polygon);
  }
  const stickers = [], slots = new Map();
  for (const { face, mask, fragments } of groups.values()) {
    const part = partFor(mask), normal = normals[face], polygons = boundary(fragments);
    const surface = fragments.map(mean);
    const center = mean(surface);
    parts[part].probes.push(...surface);
    for (const polygon of polygons) parts[part].probes.push(...polygon);
    slots.set(tileKey(face, mask), stickers.length);
    stickers.push({ face, mask, part, normal, center, polygon: polygons[0], polygons });
  }
  for (let x = -12; x <= 12; x++) for (let y = -12; y <= 12; y++) for (let z = -12; z <= 12; z++) {
    const point = [x / 12, y / 12, z / 12];
    if (normals.some(normal => dot(normal, point) > maxFace + epsilon)) continue;
    const mask = axes.reduce((m, a, i) => distance(point, a) < -epsilon ? m | (1 << i) : m, 0);
    if (mask) parts[partFor(mask)].probes.push(point);
  }
  const home = Uint8Array.from(stickers, tile => tile.face), state = home.slice();
  const rotors = axes.map((_, i) => partFromMask.get(1 << i));
  const rotorNormals = rotors.map(part => stickers.find(tile => tile.part === part).normal);
  const alignCache = new WeakMap(), captureCache = new Map();
  const sideCache = new WeakMap();
  let poses = parts.map(() => identity);

  function isJumbled() {
    return poses.some(pose => pose !== identity);
  }
  function cut(edge) {
    if (captureCache.has(edge)) return captureCache.get(edge);
    const axis = axes[edge], captured = new Set();
    for (const [i, { mask, probes }] of parts.entries()) {
      if (!mask) continue;
      const pose = poses[i];
      let sides = sideCache.get(pose);
      if (!sides) sideCache.set(pose, sides = new Map());
      const key = i * axes.length + edge;
      let side = sides.get(key);
      if (side === undefined) {
        const local = pose.map(v => dot(axis, v));
        const match = axes.findIndex(other => dot(local, other) > 1 - epsilon);
        if (match >= 0) side = Number(Boolean(mask & (1 << match)));
        else {
          let inside = false, outside = false;
          for (const point of probes) {
            const d = distance(point, local);
            if (d < -0.0008) inside = true;
            if (d > 0.0008) outside = true;
            if (inside && outside) break;
          }
          side = inside && outside ? -1 : Number(inside);
        }
        sides.set(key, side);
      }
      if (side < 0 || (side && i !== rotors[edge] && rotors.includes(i))) {
        captureCache.set(edge, null);
        return null;
      }
      if (side) captured.add(i);
    }
    const result = captured.has(rotors[edge]) ? captured : null;
    captureCache.set(edge, result);
    return result;
  }
  function currentAngle(edge) {
    const axis = axes[edge], n = rotorNormals[edge];
    const before = minus(n, scale(axis, dot(n, axis)));
    const after = transform(before, poses[rotors[edge]]);
    return Math.atan2(dot(axis, cross(before, after)), dot(before, after));
  }
  function options(edge) {
    const capture = cut(edge);
    if (!capture) return [];
    const from = currentAngle(edge);
    return targets.flatMap(target => {
      const angle = normalize(target - from);
      return Math.abs(angle) > epsilon ? [{ ...moves[edge], angle, target, capture }] : [];
    });
  }
  function prepare(move, direction = 1) {
    const capture = cut(move.edge);
    if (!capture) return null;
    const angle = move.angle ?? direction * Math.PI;
    return { ...move, angle, capture };
  }
  function poseMap(pose) {
    if (alignCache.has(pose)) return alignCache.get(pose);
    const axisMap = axes.map(axis => {
      const target = transform(axis, pose);
      return axes.findIndex(a => dot(a, target) > 1 - epsilon);
    });
    const result = axisMap.includes(-1) ? null : {
      axisMap,
      faceMap: normals.map(normal => {
        const target = transform(normal, pose);
        return normals.findIndex(n => dot(n, target) > 1 - epsilon);
      }),
    };
    alignCache.set(pose, result);
    return result;
  }
  function restoreSlots() {
    const maps = poses.map(poseMap);
    if (maps.some(map => map === null)) return;
    const next = state.slice(), filled = new Set();
    for (const [from, { face, mask, part }] of stickers.entries()) {
      const { axisMap, faceMap } = maps[part];
      const targetMask = axisMap.reduce((m, dst, src) => mask & (1 << src) ? m | (1 << dst) : m, 0);
      const to = slots.get(tileKey(faceMap[face], targetMask));
      if (to === undefined || filled.has(to)) return;
      filled.add(to);
      next[to] = state[from];
    }
    state.set(next);
    poses = parts.map(() => identity);
    captureCache.clear();
  }
  return {
    stickers, moves, palette, home, state, options, prepare, isJumbled,
    poseFor: tile => poses[tile.part],
    transformFor(tile, animated, fraction) {
      const pose = poses[tile.part];
      if (animated?.capture.has(tile.part)) {
        const angle = animated.angle * fraction;
        return point => rotate(transform(point, pose), animated.normal, angle);
      }
      return pose === identity ? point => point : point => transform(point, pose);
    },
    reset() {
      poses = parts.map(() => identity);
      state.set(home);
      captureCache.clear();
    },
    turn(move, direction) {
      const prepared = prepare(move, direction);
      if (!prepared) throw new Error('This edge is blocked in the current shape.');
      const { angle, normal, capture } = prepared;
      poses = poses.map((pose, i) => capture.has(i) ? pose.map(v => rotate(v, normal, angle)) : pose);
      captureCache.clear();
      restoreSlots();
    },
  };
}
