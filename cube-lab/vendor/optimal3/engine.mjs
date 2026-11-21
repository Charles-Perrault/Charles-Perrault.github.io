// MIT · Copyright (c) 2026 Denis · See LICENSE.
// upstream/packages/cube-core/src/util.ts
function at(items, index) {
  const item = items[index];
  if (item === void 0) {
    throw new RangeError(`Index ${String(index)} is outside 0..${String(items.length - 1)}`);
  }
  return item;
}
function symbols(text) {
  return [...text];
}
function ok(value) {
  return { ok: true, value };
}
function err(errors) {
  return { ok: false, errors };
}
function permutationParity(permutation) {
  const seen = new Array(permutation.length).fill(false);
  let parity = 0;
  for (let start = 0; start < permutation.length; start++) {
    if (seen[start] === true) continue;
    let cycleLength = 0;
    for (let i = start; seen[i] !== true; i = at(permutation, i)) {
      seen[i] = true;
      cycleLength++;
    }
    parity += cycleLength - 1;
  }
  return parity % 2 === 0 ? 0 : 1;
}

// upstream/packages/cube-core/src/geometry.ts
var FACES = ["U", "R", "F", "D", "L", "B"];
var FACE_FRAMES = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] }
};
function isFace(value) {
  return FACES.includes(value);
}
function facesOf(name) {
  return symbols(name).map((letter) => {
    if (!isFace(letter)) throw new RangeError(`"${letter}" in "${name}" is not a face`);
    return letter;
  });
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function add(...vectors) {
  return vectors.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
}
function scale(v, k) {
  return [v[0] * k, v[1] * k, v[2] * k];
}
function sameVector(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function faceNormal(face) {
  return FACE_FRAMES[face].normal;
}
function faceWithNormal(normal) {
  const face = FACES.find((f) => sameVector(FACE_FRAMES[f].normal, normal));
  if (face === void 0) throw new RangeError(`[${normal.join(", ")}] is not a face normal`);
  return face;
}
function rotateClockwise(axis, v) {
  return add(scale(axis, dot(axis, v)), scale(cross(axis, v), -1));
}
function rotateTurns(axis, v, turns) {
  let result = v;
  for (let i = 0; i < turns; i++) result = rotateClockwise(axis, result);
  return result;
}
function stickerCount(size) {
  return 6 * size * size;
}
function solvedFacelets(size) {
  return FACES.map((face) => face.repeat(size * size)).join("");
}
function stickerAt(size, facelet) {
  const perFace = size * size;
  const face = at(FACES, Math.floor(facelet / perFace));
  const row = Math.floor(facelet % perFace / size);
  const column = facelet % size;
  const { normal, right, down } = FACE_FRAMES[face];
  return {
    position: add(
      scale(normal, size - 1),
      scale(right, 2 * column - (size - 1)),
      scale(down, 2 * row - (size - 1))
    ),
    normal
  };
}
function faceletAt(size, sticker) {
  const face = faceWithNormal(sticker.normal);
  const { right, down } = FACE_FRAMES[face];
  const column = (dot(sticker.position, right) + size - 1) / 2;
  const row = (dot(sticker.position, down) + size - 1) / 2;
  return FACES.indexOf(face) * size * size + row * size + column;
}
function faceletOfCubie(size, face, faces) {
  const position = add(...faces.map((f) => scale(faceNormal(f), size - 1)));
  return faceletAt(size, { position, normal: faceNormal(face) });
}
function layerTurnPermutation(size, face, layer, turns) {
  const axis = faceNormal(face);
  const depth = size - 1 - 2 * (layer - 1);
  const permutation = Array.from({ length: stickerCount(size) }, (_, i) => i);
  for (let source = 0; source < permutation.length; source++) {
    const sticker = stickerAt(size, source);
    if (dot(sticker.position, axis) !== depth) continue;
    const target = faceletAt(size, {
      position: rotateTurns(axis, sticker.position, turns),
      normal: rotateTurns(axis, sticker.normal, turns)
    });
    permutation[target] = source;
  }
  return permutation;
}
function permute(items, permutation) {
  return permutation.map((source) => at(items, source));
}

// upstream/packages/cube-core/src/cubie.ts
var CORNERS = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
var EDGES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];
var CORNER_FACES = CORNERS.map(facesOf);
var EDGE_FACES = EDGES.map(facesOf);
var CORNER_FACELETS = CORNER_FACES.map(
  (faces) => faces.map((face) => faceletOfCubie(3, face, faces))
);
var EDGE_FACELETS = EDGE_FACES.map(
  (faces) => faces.map((face) => faceletOfCubie(3, face, faces))
);
var SOLVED = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
function multiply(a, b) {
  return {
    cp: b.cp.map((from) => at(a.cp, from)),
    co: b.cp.map((from, i) => (at(a.co, from) + at(b.co, i)) % 3),
    ep: b.ep.map((from) => at(a.ep, from)),
    eo: b.ep.map((from, i) => (at(a.eo, from) + at(b.eo, i)) % 2)
  };
}
function inverse(cube) {
  const cp = new Array(8);
  const co = new Array(8);
  cube.cp.forEach((corner, position) => {
    cp[corner] = position;
    co[corner] = (3 - at(cube.co, position)) % 3;
  });
  const ep = new Array(12);
  const eo = new Array(12);
  cube.ep.forEach((edge, position) => {
    ep[edge] = position;
    eo[edge] = at(cube.eo, position);
  });
  return { cp, co, ep, eo };
}
function equals(a, b) {
  const same = (x, y) => x.every((v, i) => v === y[i]);
  return same(a.cp, b.cp) && same(a.co, b.co) && same(a.ep, b.ep) && same(a.eo, b.eo);
}
function isSolved(cube) {
  return equals(cube, SOLVED);
}

// upstream/packages/cube-core/src/validation.ts
var sum = (values) => values.reduce((s, v) => s + v, 0);
function checkInvariants(cube) {
  const errors = [];
  const twist = sum(cube.co) % 3;
  if (twist === 1 || twist === 2) errors.push({ code: "twisted-corner", twist });
  if (sum(cube.eo) % 2 !== 0) errors.push({ code: "flipped-edge" });
  if (permutationParity(cube.cp) !== permutationParity(cube.ep)) errors.push({ code: "parity" });
  return errors;
}

// upstream/packages/cube-core/src/facelets.ts
var STICKERS_PER_FACE = 9;
var FACELET_COUNT = 6 * STICKERS_PER_FACE;
var CENTRE = 4;
var SOLVED_FACELETS = solvedFacelets(3);
function toFacelets(cube) {
  const facelets = FACES.flatMap((face) => new Array(STICKERS_PER_FACE).fill(face));
  cube.cp.forEach((corner, position) => {
    const twist = at(cube.co, position);
    const slots = at(CORNER_FACELETS, position);
    at(CORNER_FACES, corner).forEach((face, k) => {
      facelets[at(slots, (k + twist) % 3)] = face;
    });
  });
  cube.ep.forEach((edge, position) => {
    const flip = at(cube.eo, position);
    const slots = at(EDGE_FACELETS, position);
    at(EDGE_FACES, edge).forEach((face, k) => {
      facelets[at(slots, (k + flip) % 2)] = face;
    });
  });
  return facelets.join("");
}
var sameSet = (a, b) => a.length === b.length && a.every((face) => b.includes(face));
var rotations = (faces) => faces.map((_, start) => faces.map((__, k) => at(faces, (start + k) % faces.length)));
var sameOrder = (a, b) => a.every((face, i) => face === b[i]);
function parseFacelets(input) {
  const colours = typeof input === "string" ? symbols(input) : input;
  if (colours.length !== FACELET_COUNT) {
    return err([{ code: "invalid-length", expected: FACELET_COUNT, actual: colours.length }]);
  }
  const faceOf = /* @__PURE__ */ new Map();
  const centreColours = FACES.map((_, f) => at(colours, f * STICKERS_PER_FACE + CENTRE));
  const errors = [];
  for (const colour of new Set(centreColours)) {
    const centres = FACES.flatMap(
      (_, f) => centreColours[f] === colour ? [f * STICKERS_PER_FACE + CENTRE] : []
    );
    if (centres.length > 1) {
      errors.push({ code: "duplicate-centre-colour", colour, facelets: centres });
    }
  }
  if (errors.length > 0) return err(errors);
  FACES.forEach((face, f) => faceOf.set(at(centreColours, f), face));
  const unknown = /* @__PURE__ */ new Map();
  colours.forEach((colour, facelet) => {
    if (!faceOf.has(colour)) unknown.set(colour, [...unknown.get(colour) ?? [], facelet]);
  });
  for (const [colour, facelets] of unknown)
    errors.push({ code: "unknown-colour", colour, facelets });
  if (errors.length > 0) return err(errors);
  const faces = colours.map((colour) => faceOf.get(colour) ?? "U");
  for (const face of FACES) {
    const count = faces.filter((f) => f === face).length;
    if (count !== STICKERS_PER_FACE) {
      errors.push({ code: "colour-count", face, count, expected: STICKERS_PER_FACE });
    }
  }
  if (errors.length > 0) return err(errors);
  const cp = [];
  const co = [];
  CORNER_FACELETS.forEach((slots, position) => {
    const shown = slots.map((slot) => at(faces, slot));
    const corner = CORNER_FACES.findIndex((reference2) => sameSet(reference2, shown));
    const twist = shown.findIndex((face) => face === "U" || face === "D");
    const reference = corner === -1 ? void 0 : at(CORNER_FACES, corner);
    if (reference === void 0 || twist === -1) {
      errors.push({ code: "invalid-corner", position: at(CORNERS, position), facelets: slots });
    } else if (!sameOrder(at(rotations(shown), twist), reference)) {
      errors.push({
        code: "mirrored-corner",
        position: at(CORNERS, position),
        corner: at(CORNERS, corner),
        facelets: slots
      });
    } else {
      cp.push(corner);
      co.push(twist);
    }
  });
  const ep = [];
  const eo = [];
  EDGE_FACELETS.forEach((slots, position) => {
    const shown = slots.map((slot) => at(faces, slot));
    const edge = EDGE_FACES.findIndex((reference) => sameSet(reference, shown));
    if (edge === -1) {
      errors.push({ code: "invalid-edge", position: at(EDGES, position), facelets: slots });
    } else {
      ep.push(edge);
      eo.push(sameOrder(shown, at(EDGE_FACES, edge)) ? 0 : 1);
    }
  });
  if (errors.length > 0) return err(errors);
  CORNERS.forEach((name, corner) => {
    const positions = CORNERS.filter((_, position) => cp[position] === corner);
    if (positions.length > 1) errors.push({ code: "duplicate-corner", corner: name, positions });
  });
  EDGES.forEach((name, edge) => {
    const positions = EDGES.filter((_, position) => ep[position] === edge);
    if (positions.length > 1) errors.push({ code: "duplicate-edge", edge: name, positions });
  });
  if (errors.length > 0) return err(errors);
  const cube = { cp, co, ep, eo };
  const invariantErrors = checkInvariants(cube);
  return invariantErrors.length > 0 ? err(invariantErrors) : ok(cube);
}

// upstream/packages/cube-core/src/moves.ts
var TURN_COUNTS = [1, 2, 3];
var FACE_TURNS = FACES.flatMap(
  (face) => TURN_COUNTS.map((turns) => ({ face, turns }))
);
function faceTurnIndex(turn) {
  return FACES.indexOf(turn.face) * 3 + turn.turns - 1;
}
function quarterTurn(face) {
  const facelets = permute(symbols(SOLVED_FACELETS), layerTurnPermutation(3, face, 1, 1));
  const parsed = parseFacelets(facelets);
  if (!parsed.ok) throw new Error(`Quarter turn of ${face} is not a valid cube state`);
  return parsed.value;
}
function power(cube, exponent) {
  let result = SOLVED;
  for (let i = 0; i < exponent; i++) result = multiply(result, cube);
  return result;
}
var MOVE_CUBES = FACES.flatMap((face) => {
  const quarter = quarterTurn(face);
  return TURN_COUNTS.map((turns) => power(quarter, turns));
});
function applyFaceTurn(cube, turn) {
  return multiply(cube, at(MOVE_CUBES, faceTurnIndex(turn)));
}
function applyFaceTurns(cube, turns) {
  return turns.reduce(applyFaceTurn, cube);
}
function invertFaceTurns(turns) {
  return turns.toReversed().map(({ face, turns: t }) => ({ face, turns: inverseTurns(t) }));
}
function inverseTurns(turns) {
  return turns === 1 ? 3 : turns === 3 ? 1 : 2;
}
var SUFFIX = { 1: "", 2: "2", 3: "'" };
function formatFaceTurns(turns) {
  return turns.map(({ face, turns: t }) => face + SUFFIX[t]).join(" ");
}

// upstream/packages/cube-core/src/notation.ts
var PRIMES = "'\u2019\u2018`\xB4\u2032";
var TOKEN = new RegExp(`(\\d+)?([URFDLB]w|[URFDLBurfdlbMESxyz])(2)?([${PRIMES}])?`, "y");

// upstream/packages/cube-core/src/random.ts
var MASK64 = (1n << 64n) - 1n;

// upstream/packages/cube-core/src/cube4.ts
var SIZE = 4;
var PER_FACE = SIZE * SIZE;
var STICKERS_4 = 6 * PER_FACE;
var CORNER_FACELETS_4 = CORNER_FACES.map(
  (faces) => faces.map((face) => faceletOfCubie(SIZE, face, faces))
);
var add2 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
var scale2 = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
var cross2 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
var WING_FACELETS = EDGE_FACES.flatMap((faces) => {
  const [a, b] = faces;
  const along = cross2(faceNormal(a), faceNormal(b));
  const base = add2(scale2(faceNormal(a), SIZE - 1), scale2(faceNormal(b), SIZE - 1));
  const wings = [-1, 1].map((t) => {
    const position = add2(base, scale2(along, t));
    return [
      faceletAt(SIZE, { position, normal: faceNormal(a) }),
      faceletAt(SIZE, { position, normal: faceNormal(b) })
    ];
  });
  wings.sort((x, y) => x[0] - y[0]);
  return wings;
});
var CENTRE_FACELETS = FACES.flatMap(
  (_, f) => [5, 6, 9, 10].map((i) => f * PER_FACE + i)
);
var SOLVED_4 = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  wp: Array.from({ length: 24 }, (_, i) => i),
  centres: Array.from({ length: 24 }, (_, i) => i >> 2)
};
function facePermutation(turn) {
  const axis = faceNormal(turn.face);
  const source = Array.from({ length: STICKERS_4 }, (_, i) => i);
  for (let f = 0; f < STICKERS_4; f++) {
    const { position, normal } = stickerAt(SIZE, f);
    const depth = (SIZE - 1 - (position[0] * axis[0] + position[1] * axis[1] + position[2] * axis[2])) / 2 + 1;
    if (depth < turn.from || depth > turn.to) continue;
    const target = faceletAt(SIZE, {
      position: rotateTurns(axis, position, turn.turns),
      normal: rotateTurns(axis, normal, turn.turns)
    });
    source[target] = f;
  }
  return source;
}
var TURNS = [1, 2, 3];
var MOVES_4 = [
  ...FACES.flatMap((face) => TURNS.map((turns) => ({ face, from: 1, to: 1, turns }))),
  ...["U", "R", "F"].flatMap(
    (face) => TURNS.map((turns) => ({ face, from: 1, to: 2, turns }))
  )
];
var WING_ORDER = (() => {
  const order = Array.from({ length: 24 }, () => new Array(24).fill(-1));
  const generators = FACES.flatMap(
    (face) => [1, 2].map((layer) => {
      const source = facePermutation({ face, from: layer, to: layer, turns: 1 });
      const target = new Array(STICKERS_4);
      source.forEach((from, to) => target[from] = to);
      return target;
    })
  );
  let frontier = [WING_FACELETS.map(([f]) => f)];
  const seen = /* @__PURE__ */ new Set([frontier[0]?.join() ?? ""]);
  const record = (refs) => {
    refs.forEach((facelet, wing) => {
      const slot = WING_FACELETS.findIndex(([a, b]) => a === facelet || b === facelet);
      const row = at(order, wing);
      const value = WING_FACELETS[slot]?.[0] === facelet ? 0 : 1;
      if (row[slot] !== -1 && row[slot] !== value) throw new Error("A wing flipped in place");
      row[slot] = value;
    });
  };
  record(frontier[0] ?? []);
  while (frontier.length > 0 && order.some((row) => row.includes(-1))) {
    const next = [];
    for (const refs of frontier) {
      for (const target of generators) {
        const moved = refs.map((f) => at(target, f));
        const key = moved.join();
        if (seen.has(key)) continue;
        seen.add(key);
        record(moved);
        next.push(moved);
      }
    }
    frontier = next;
  }
  if (order.some((row) => row.includes(-1))) throw new Error("Some wing never reached a slot");
  return order;
})();

// upstream/packages/cube-core/src/rotation.ts
function rotateCube(cube, axis, turns) {
  let facelets = symbols(toFacelets(cube));
  for (let layer = 1; layer <= 3; layer++) {
    facelets = permute(facelets, layerTurnPermutation(3, axis, layer, turns));
  }
  const parsed = parseFacelets(facelets);
  if (!parsed.ok) throw new Error("A whole-cube rotation produced an invalid state");
  return parsed.value;
}
function rotateFace(face, axis, turns) {
  return faceWithNormal(rotateTurns(faceNormal(axis), faceNormal(face), turns));
}

// upstream/packages/solver-ts/src/math.ts
var MAX_N = 24;
var BINOMIAL = Array.from(
  { length: MAX_N + 1 },
  (_, n) => Array.from({ length: MAX_N + 1 }, (__, k) => {
    let value = 1;
    for (let i = 0; i < k; i++) value = value * (n - i) / (i + 1);
    return k > n ? 0 : value;
  })
);
function choose(n, k) {
  return k < 0 || k > n ? 0 : BINOMIAL[n][k];
}
function rankPermutation(p, n = p.length) {
  let rank = 0;
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++;
    rank = rank * (n - i) + smaller;
  }
  return rank;
}
function unrankPermutation(rank, n, out) {
  for (let i = n - 1; i >= 0; i--) {
    out[i] = rank % (n - i);
    rank = Math.floor(rank / (n - i));
  }
  for (let i = n - 2; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) if (out[j] >= out[i]) out[j]++;
  }
}
function rankCombination(positions, k = positions.length) {
  let rank = 0;
  for (let i = 0; i < k; i++) rank += choose(positions[i], i + 1);
  return rank;
}
function unrankCombination(rank, k, out) {
  for (let i = k - 1; i >= 0; i--) {
    let p = i;
    while (choose(p + 1, i + 1) <= rank) p++;
    out[i] = p;
    rank -= choose(p, i + 1);
  }
}

// upstream/packages/solver-ts/src/coordinates.ts
var N_TWIST = 2187;
var N_FLIP = 2048;
var N_SLICE = 495;
var N_SLICE_SORTED = 11880;
var N_UD_EDGE_GROUP = 11880;
var N_CORNER_PERM = 40320;
var N_UD_EDGE_PERM = 40320;
var N_SLICE_PERM = 24;
var N_U_EDGES_IN_G1 = 1680;
var SLICE_EDGE = 8;
var U_EDGE = 0;
var D_EDGE = 4;
function getTwist(co) {
  let twist = 0;
  for (let i = 0; i < 7; i++) twist = 3 * twist + co[i];
  return twist;
}
function setTwist(twist, co) {
  let total = 0;
  for (let i = 6; i >= 0; i--) {
    co[i] = twist % 3;
    total += co[i];
    twist = Math.floor(twist / 3);
  }
  co[7] = (3 - total % 3) % 3;
}
function getFlip(eo) {
  let flip = 0;
  for (let i = 0; i < 11; i++) flip = 2 * flip + eo[i];
  return flip;
}
function setFlip(flip, eo) {
  let total = 0;
  for (let i = 10; i >= 0; i--) {
    eo[i] = flip & 1;
    total += eo[i];
    flip >>= 1;
  }
  eo[11] = total & 1;
}
var groupPositions = new Uint8Array(4);
var groupOrder = new Uint8Array(4);
function getEdgeGroup(ep, first, mirrored) {
  let found = 0;
  for (let p = 0; p < 12; p++) {
    const edge = ep[p];
    if (edge >= first && edge < first + 4) {
      groupPositions[mirrored ? 3 - found : found] = mirrored ? 11 - p : p;
      groupOrder[found++] = edge - first;
    }
  }
  return rankCombination(groupPositions) * 24 + rankPermutation(groupOrder);
}
function setEdgeGroup(value, first, mirrored, ep) {
  const ranked = new Uint8Array(4);
  unrankCombination(Math.floor(value / 24), 4, ranked);
  const positions = Array.from(ranked, (p) => mirrored ? 11 - p : p).sort((a, b) => a - b);
  const order = new Uint8Array(4);
  unrankPermutation(value % 24, 4, order);
  ep.fill(255);
  positions.forEach((p, i) => ep[p] = first + order[i]);
  let other = 0;
  for (let p = 0; p < 12; p++) {
    if (ep[p] !== 255) continue;
    while (other >= first && other < first + 4) other++;
    ep[p] = other++;
  }
}
var getSliceSorted = (ep) => getEdgeGroup(ep, SLICE_EDGE, true);
var getUEdges = (ep) => getEdgeGroup(ep, U_EDGE, false);
var getDEdges = (ep) => getEdgeGroup(ep, D_EDGE, false);
function setSliceSorted(value, ep) {
  setEdgeGroup(value, SLICE_EDGE, true, ep);
}
function setUEdges(value, ep) {
  setEdgeGroup(value, U_EDGE, false, ep);
}
function setDEdges(value, ep) {
  setEdgeGroup(value, D_EDGE, false, ep);
}
var getSlice = (ep) => Math.floor(getSliceSorted(ep) / 24);
var getCornerPerm = (cp) => rankPermutation(cp, 8);
var setCornerPerm = (v, cp) => {
  unrankPermutation(v, 8, cp);
};
var getUDEdgePerm = (ep) => rankPermutation(ep, 8);
function setUDEdgePerm(v, ep) {
  unrankPermutation(v, 8, ep);
  for (let p = 8; p < 12; p++) ep[p] = p;
}

// upstream/packages/solver-ts/src/symmetry.ts
var IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
var GENERATORS = [
  [0, 0, -1, 0, 1, 0, 1, 0, 0],
  // (x, y, z) → (−z, y, x): front goes left, as with U
  [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  // (x, y, z) → (−x, −y, z)
  [-1, 0, 0, 0, 1, 0, 0, 0, 1]
  // (x, y, z) → (−x, y, z)
];
var apply = (m, [x, y, z]) => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z
];
function compose(a, b) {
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
    }
  }
  return out;
}
var sameMatrix = (a, b) => a.every((v, i) => v === b[i]);
function closure(generators) {
  const group = [IDENTITY];
  for (const element of group) {
    for (const g of generators) {
      const product = compose(g, element);
      if (!group.some((m) => sameMatrix(m, product))) group.push(product);
    }
  }
  return group;
}
var MATRICES = closure(GENERATORS);
var N_SYM = 16;
if (MATRICES.length !== N_SYM) throw new Error(`D4h has ${String(MATRICES.length)} elements`);
var STICKERS = 54;
var UNKNOWN_EDGE = 255;
function determinant(m) {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}
function symmetry(matrix) {
  const stickerTo = new Uint8Array(STICKERS);
  for (let p = 0; p < STICKERS; p++) {
    const { position, normal } = stickerAt(3, p);
    stickerTo[p] = faceletAt(3, {
      position: apply(matrix, position),
      normal: apply(matrix, normal)
    });
  }
  const faceTo = Uint8Array.from(
    FACES,
    (face) => FACES.indexOf(faceWithNormal(apply(matrix, faceNormal(face))))
  );
  const moved = new Uint8Array(STICKERS);
  for (let p = 0; p < STICKERS; p++) moved[stickerTo[p]] = Math.floor(p / 9);
  const edgeFaces = EDGE_FACES.map((faces) => faces.map((f) => FACES.indexOf(f)));
  const ep = new Uint8Array(12).fill(UNKNOWN_EDGE);
  const eo = new Uint8Array(12);
  EDGE_FACELETS.forEach(([a, b], position) => {
    const shown = [moved[a], moved[b]];
    const edge = edgeFaces.findIndex(([x, y]) => shown.includes(x) && shown.includes(y));
    ep[position] = edge;
    eo[position] = shown[0] === edgeFaces[edge][0] ? 0 : 1;
  });
  if (ep.includes(UNKNOWN_EDGE)) throw new Error("A symmetry did not map edges to edges");
  const inverseEp = new Uint8Array(12);
  const inverseEo = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    inverseEp[ep[i]] = i;
    inverseEo[ep[i]] = eo[i];
  }
  return {
    mirror: determinant(matrix) < 0,
    stickerTo,
    faceTo,
    ep,
    eo,
    inverseEp,
    inverseEo
  };
}
var D4H = MATRICES.map(symmetry);
var INVERSE_SYM = Uint8Array.from(MATRICES, (m) => {
  const transpose = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  return MATRICES.findIndex((other) => sameMatrix(other, transpose));
});
function conjugateFaces(faces, s, out) {
  const { stickerTo, faceTo } = D4H[s];
  for (let p = 0; p < STICKERS; p++) out[stickerTo[p]] = faceTo[faces[p]];
}
function conjugateEdges(s, ep, eo, outEp, outEo) {
  const sym = D4H[s];
  for (let i = 0; i < 12; i++) {
    const j = sym.ep[i];
    const edge = ep[j];
    outEp[i] = sym.inverseEp[edge];
    outEo[i] = sym.inverseEo[edge] ^ eo[j] ^ sym.eo[i];
  }
}
var cornerFaces = CORNER_FACES.map((faces) => faces.map((f) => FACES.indexOf(f)));
var U = 0;
var D = 3;
function buildTwistConjugation() {
  const table = new Uint16Array(N_TWIST * N_SYM);
  const co = new Uint8Array(8);
  const faces = new Uint8Array(STICKERS);
  const conjugated = new Uint8Array(STICKERS);
  const twisted = new Uint8Array(8);
  for (let twist = 0; twist < N_TWIST; twist++) {
    setTwist(twist, co);
    for (let i = 0; i < 8; i++) {
      for (let k = 0; k < 3; k++) faces[CORNER_FACELETS[i][(k + co[i]) % 3]] = cornerFaces[i][k];
    }
    for (let s = 0; s < N_SYM; s++) {
      conjugateFaces(faces, s, conjugated);
      for (let i = 0; i < 8; i++) {
        const slots = CORNER_FACELETS[i];
        let k = 0;
        while (conjugated[slots[k]] !== U && conjugated[slots[k]] !== D) k++;
        twisted[i] = k;
      }
      table[twist * N_SYM + s] = getTwist(twisted);
    }
  }
  return table;
}

// upstream/packages/solver-ts/src/sym-coordinates.ts
var UNASSIGNED = 4294967295;
var N_FLIPSLICE_CLASS = 64430;
var N_FLIPSLICESORTED_CLASS = 1523864;
function flipSliceSize(sorted) {
  return (sorted ? N_SLICE_SORTED : N_SLICE) * N_FLIP;
}
function buildFlipSliceClasses(sorted, shared = false) {
  const size = flipSliceSize(sorted);
  const expected = sorted ? N_FLIPSLICESORTED_CLASS : N_FLIPSLICE_CLASS;
  const classOf = (shared ? new Uint32Array(new SharedArrayBuffer(size * 4)) : new Uint32Array(size)).fill(UNASSIGNED);
  const representative = new Uint32Array(expected);
  const stabilizer = new Uint16Array(expected);
  const ep = new Uint8Array(12);
  const eo = new Uint8Array(12);
  const conjEp = new Uint8Array(12);
  const conjEo = new Uint8Array(12);
  let count = 0;
  for (let raw = 0; raw < size; raw++) {
    if (classOf[raw] !== UNASSIGNED) continue;
    if (count === expected) throw new Error(`More than ${String(expected)} flip-slice classes`);
    const slice = Math.floor(raw / N_FLIP);
    setSliceSorted(sorted ? slice : slice * 24, ep);
    setFlip(raw % N_FLIP, eo);
    let stable = 0;
    for (let s = 0; s < N_SYM; s++) {
      conjugateEdges(s, ep, eo, conjEp, conjEo);
      const sliceSorted = getSliceSorted(conjEp);
      const image = (sorted ? sliceSorted : Math.floor(sliceSorted / 24)) * N_FLIP + getFlip(conjEo);
      if (image === raw) stable |= 1 << s;
      if (classOf[image] === UNASSIGNED) classOf[image] = count << 4 | INVERSE_SYM[s];
    }
    representative[count] = raw;
    stabilizer[count] = stable;
    count++;
  }
  if (count !== expected)
    throw new Error(`Found ${String(count)} classes, not ${String(expected)}`);
  return { sorted, count, classOf, representative, stabilizer };
}

// upstream/packages/solver-ts/src/tables.ts
var N_MOVES = 18;
var PHASE2_MOVES = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];
var ALL_MOVES = Array.from({ length: N_MOVES }, (_, m) => m);
var UNVISITED = 255;
function moveCorners(cp, co, move, outCp, outCo) {
  const m = MOVE_CUBES[move];
  for (let i = 0; i < 8; i++) {
    outCp[i] = cp[m.cp[i]];
    outCo[i] = (co[m.cp[i]] + m.co[i]) % 3;
  }
}
function moveEdges(ep, eo, move, outEp, outEo) {
  const m = MOVE_CUBES[move];
  for (let i = 0; i < 12; i++) {
    outEp[i] = ep[m.ep[i]];
    outEo[i] = (eo[m.ep[i]] + m.eo[i]) % 2;
  }
}
function moveTable(size, moves, pieceCount, set, get) {
  const apply2 = pieceCount === 8 ? moveCorners : moveEdges;
  const identity = Array.from({ length: pieceCount }, (_, i) => i);
  const perm = new Uint8Array(pieceCount);
  const ori = new Uint8Array(pieceCount);
  const nextPerm = new Uint8Array(pieceCount);
  const nextOri = new Uint8Array(pieceCount);
  const table = new Uint16Array(size * N_MOVES);
  for (let c = 0; c < size; c++) {
    perm.set(identity);
    ori.fill(0);
    set(c, perm, ori);
    for (const m of moves) {
      apply2(perm, ori, m, nextPerm, nextOri);
      table[c * N_MOVES + m] = get(nextPerm, nextOri);
    }
  }
  return table;
}
var cornerMoveTable = (size, set, get) => moveTable(size, ALL_MOVES, 8, set, get);
var edgeMoveTable = (size, set, get, moves = ALL_MOVES) => moveTable(size, moves, 12, set, get);
function pruningTable(sizeA, moveA, sizeB, moveB, moves) {
  const total = sizeA * sizeB;
  const depth = new Uint8Array(total).fill(UNVISITED);
  const moveList = Int8Array.from(moves);
  const moveCount = moveList.length;
  depth[0] = 0;
  let visited = 1;
  for (let level = 0; visited < total; level++) {
    const backward = visited > total / 2;
    const next = level + 1;
    let found = 0;
    for (let a = 0; a < sizeA; a++) {
      const rowA = a * N_MOVES;
      for (let b = 0; b < sizeB; b++) {
        const index = a * sizeB + b;
        const rowB = b * N_MOVES;
        if (backward) {
          if (depth[index] !== UNVISITED) continue;
          for (let i = 0; i < moveCount; i++) {
            const m = moveList[i];
            if (depth[moveA[rowA + m] * sizeB + moveB[rowB + m]] === level) {
              depth[index] = next;
              found++;
              break;
            }
          }
        } else {
          if (depth[index] !== level) continue;
          for (let i = 0; i < moveCount; i++) {
            const m = moveList[i];
            const target = moveA[rowA + m] * sizeB + moveB[rowB + m];
            if (depth[target] === UNVISITED) {
              depth[target] = next;
              found++;
            }
          }
        }
      }
    }
    if (found === 0) {
      throw new Error(`Pruning table reached ${String(visited)} of ${String(total)} entries`);
    }
    visited += found;
  }
  return depth;
}
function buildTwoPhaseTables(onStep) {
  function step(name, build) {
    const start = performance.now();
    const table = build();
    onStep?.({ name, bytes: table.byteLength, ms: performance.now() - start });
    return table;
  }
  const twistMove = step(
    "twistMove",
    () => cornerMoveTable(
      N_TWIST,
      (v, _cp, co) => {
        setTwist(v, co);
      },
      (_cp, co) => getTwist(co)
    )
  );
  const flipMove = step(
    "flipMove",
    () => edgeMoveTable(
      N_FLIP,
      (v, _ep, eo) => {
        setFlip(v, eo);
      },
      (_ep, eo) => getFlip(eo)
    )
  );
  const sliceSortedMove = step(
    "sliceSortedMove",
    () => edgeMoveTable(N_SLICE_SORTED, setSliceSorted, getSliceSorted)
  );
  const sliceMove = step("sliceMove", () => {
    const table = new Uint16Array(N_SLICE * N_MOVES);
    for (let c = 0; c < N_SLICE; c++) {
      for (let m = 0; m < N_MOVES; m++) {
        table[c * N_MOVES + m] = Math.floor(sliceSortedMove[c * 24 * N_MOVES + m] / 24);
      }
    }
    return table;
  });
  const uEdgesMove = step("uEdgesMove", () => edgeMoveTable(N_UD_EDGE_GROUP, setUEdges, getUEdges));
  const dEdgesMove = step("dEdgesMove", () => edgeMoveTable(N_UD_EDGE_GROUP, setDEdges, getDEdges));
  const cornerPermMove = step(
    "cornerPermMove",
    () => cornerMoveTable(N_CORNER_PERM, setCornerPerm, getCornerPerm)
  );
  const udEdgePermMove = step(
    "udEdgePermMove",
    () => edgeMoveTable(N_UD_EDGE_PERM, setUDEdgePerm, getUDEdgePerm, PHASE2_MOVES)
  );
  const udEdgesFromGroups = step("udEdgesFromGroups", () => {
    const table = new Uint16Array(N_U_EDGES_IN_G1 * 24);
    const ep = new Uint8Array(12);
    const dOrder = new Uint8Array(4);
    for (let u = 0; u < N_U_EDGES_IN_G1; u++) {
      for (let d = 0; d < 24; d++) {
        setUEdges(u, ep);
        unrankPermutation(d, 4, dOrder);
        let k = 0;
        for (let p = 0; p < 8; p++) if (ep[p] >= 4) ep[p] = 4 + dOrder[k++];
        table[u * 24 + d] = getUDEdgePerm(ep);
      }
    }
    return table;
  });
  const sliceTwistPrune = step(
    "sliceTwistPrune",
    () => pruningTable(N_SLICE, sliceMove, N_TWIST, twistMove, ALL_MOVES)
  );
  const sliceFlipPrune = step(
    "sliceFlipPrune",
    () => pruningTable(N_SLICE, sliceMove, N_FLIP, flipMove, ALL_MOVES)
  );
  const twistFlipPrune = step(
    "twistFlipPrune",
    () => pruningTable(N_TWIST, twistMove, N_FLIP, flipMove, ALL_MOVES)
  );
  const cornerSlicePrune = step(
    "cornerSlicePrune",
    () => pruningTable(N_CORNER_PERM, cornerPermMove, N_SLICE_PERM, sliceSortedMove, PHASE2_MOVES)
  );
  const udEdgeSlicePrune = step(
    "udEdgeSlicePrune",
    () => pruningTable(N_UD_EDGE_PERM, udEdgePermMove, N_SLICE_PERM, sliceSortedMove, PHASE2_MOVES)
  );
  return {
    twistMove,
    flipMove,
    sliceMove,
    sliceSortedMove,
    uEdgesMove,
    dEdgesMove,
    cornerPermMove,
    udEdgePermMove,
    udEdgesFromGroups,
    sliceTwistPrune,
    sliceFlipPrune,
    twistFlipPrune,
    cornerSlicePrune,
    udEdgeSlicePrune
  };
}

// upstream/packages/solver-ts/src/optimal-tables.ts
var MAGIC = 827609167;
var FORMAT_VERSION = 1;
var HEADER_WORDS = 8;
var EMPTY = 4294967295;
var PROGRESS_EVERY = 4096;
function pruneEntries(classes) {
  return classes * N_TWIST;
}
function checksum(words) {
  let hash = 2166136261;
  for (const word of words) hash = Math.imul(hash ^ word, 16777619);
  return hash >>> 0;
}
function writeHeader(file, tier, classes) {
  file[0] = MAGIC;
  file[1] = FORMAT_VERSION;
  file[2] = tier === "huge" ? 1 : 0;
  file[3] = classes;
  file[4] = pruneEntries(classes) >>> 0;
  file[5] = checksum(file.subarray(HEADER_WORDS));
}
function readPruneFile(bytes, tier, classes) {
  const words = Math.ceil(pruneEntries(classes) / 16);
  if (bytes.byteOffset % 4 !== 0 || bytes.byteLength !== (HEADER_WORDS + words) * 4) return null;
  const file = new Uint32Array(bytes.buffer, bytes.byteOffset, HEADER_WORDS + words);
  const table = file.subarray(HEADER_WORDS);
  const valid = file[0] === MAGIC && file[1] === FORMAT_VERSION && file[2] === (tier === "huge" ? 1 : 0) && file[3] === classes && file[4] === pruneEntries(classes) >>> 0 && file[5] === checksum(table);
  return valid ? table : null;
}
function buildCornerDepth(cornerPermMove) {
  const depth = new Uint8Array(N_CORNER_PERM).fill(255);
  depth[0] = 0;
  let done = 1;
  for (let level = 0; done < N_CORNER_PERM; level++) {
    for (let c = 0; c < N_CORNER_PERM; c++) {
      if (depth[c] !== level) continue;
      for (let m = 0; m < N_MOVES; m++) {
        const next = cornerPermMove[c * N_MOVES + m];
        if (depth[next] === 255) {
          depth[next] = level + 1;
          done++;
        }
      }
    }
  }
  return depth;
}
function fillPruneTable(table, classes, twistConj, moves, hooks) {
  const { count, classOf, representative, stabilizer, sorted } = classes;
  const { twistMove, flipMove } = moves;
  const sliceMoves = sorted ? moves.sliceSortedMove : moves.sliceMove;
  const total = pruneEntries(count);
  table.fill(EMPTY);
  table[0] = (table[0] & ~3) >>> 0;
  let done = 1;
  for (let level = 0; done < total; level++) {
    const backward = done > total / 2;
    const current = level % 3;
    const next = (level + 1) % 3;
    let found = 0;
    for (let c = 0; c < count; c++) {
      if (c % PROGRESS_EVERY === 0) {
        if (hooks.shouldStop?.() === true) return false;
        hooks.onProgress?.(done + found, total);
      }
      const rep = representative[c];
      const flipRow = rep % N_FLIP * N_MOVES;
      const sliceRow = Math.floor(rep / N_FLIP) * N_MOVES;
      const base = c * N_TWIST;
      for (let twist = 0; twist < N_TWIST; twist++) {
        const index = base + twist;
        const word = table[index >>> 4];
        if (!backward && word === EMPTY && (index & 15) === 0 && twist + 16 <= N_TWIST) {
          twist += 15;
          continue;
        }
        const value = word >>> ((index & 15) << 1) & 3;
        if (backward ? value !== 3 : value !== current) continue;
        const twistRow = twist * N_MOVES;
        for (let m = 0; m < N_MOVES; m++) {
          const packed = classOf[sliceMoves[sliceRow + m] * N_FLIP + flipMove[flipRow + m]];
          const c1 = packed >>> 4;
          const t1 = twistConj[twistMove[twistRow + m] * N_SYM + (packed & 15)];
          const index1 = c1 * N_TWIST + t1;
          const value1 = table[index1 >>> 4] >>> ((index1 & 15) << 1) & 3;
          if (backward) {
            if (value1 === current) {
              const shift = (index & 15) << 1;
              table[index >>> 4] = table[index >>> 4] & ~(3 << shift) | next << shift;
              found++;
              break;
            }
            continue;
          }
          if (value1 !== 3) continue;
          const shift1 = (index1 & 15) << 1;
          table[index1 >>> 4] = table[index1 >>> 4] & ~(3 << shift1) | next << shift1;
          found++;
          const stable = stabilizer[c1];
          if (stable === 1) continue;
          for (let s = 1; s < N_SYM; s++) {
            if ((stable >>> s & 1) === 0) continue;
            const index2 = c1 * N_TWIST + twistConj[t1 * N_SYM + s];
            const shift2 = (index2 & 15) << 1;
            if ((table[index2 >>> 4] >>> shift2 & 3) !== 3) continue;
            table[index2 >>> 4] = table[index2 >>> 4] & ~(3 << shift2) | next << shift2;
            found++;
          }
        }
      }
    }
    if (found === 0) throw new Error(`Prune table stuck at ${String(done)} of ${String(total)}`);
    done += found;
  }
  hooks.onProgress?.(done, total);
  return true;
}
function buildOptimalTables(tier, moves, saved = null, hooks = {}, shared = false) {
  const classes = buildFlipSliceClasses(tier === "huge", shared);
  const twistConj = buildTwistConjugation();
  const usable = saved === null || !shared || saved.buffer instanceof SharedArrayBuffer ? saved : copyToShared(saved);
  const restored = usable === null ? null : readPruneFile(usable, tier, classes.count);
  let prune;
  let file;
  if (restored !== null && usable !== null) {
    prune = restored;
    file = usable;
  } else {
    const length = HEADER_WORDS + Math.ceil(pruneEntries(classes.count) / 16);
    const words = shared ? new Uint32Array(new SharedArrayBuffer(length * 4)) : new Uint32Array(length);
    prune = words.subarray(HEADER_WORDS);
    if (!fillPruneTable(prune, classes, twistConj, moves, hooks)) return null;
    writeHeader(words, tier, classes.count);
    file = new Uint8Array(words.buffer);
  }
  return {
    tier,
    classes,
    twistConj,
    prune,
    file,
    restored: restored !== null,
    cornerDepth: buildCornerDepth(moves.cornerPermMove),
    twistMove: moves.twistMove,
    flipMove: moves.flipMove,
    sliceMove: moves.sliceMove,
    sliceSortedMove: moves.sliceSortedMove,
    cornerPermMove: moves.cornerPermMove
  };
}
function copyToShared(bytes) {
  const copy = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}
var SLICE_OF_SORTED = Uint16Array.from(
  { length: N_SLICE_SORTED },
  (_, i) => Math.floor(i / 24)
);

// upstream/packages/solver-ts/src/optimal.ts
var AXES = [0, 1, 2].map(
  (times) => Array.from({ length: times }, () => [
    { axis: "R", turns: 1 },
    { axis: "U", turns: 1 }
  ]).flat()
);
var moveOnAxis = Uint8Array.from({ length: AXES.length * N_MOVES }, (_, i) => {
  const axis = AXES[Math.floor(i / N_MOVES)];
  const { face, turns } = FACE_TURNS[i % N_MOVES];
  const seen = axis.reduce((f, r) => rotateFace(f, r.axis, r.turns), face);
  return faceTurnIndex({ face: seen, turns });
});
var MAX_DEPTH = 24;
var FOUND = 1;
var NONE = 0;
var STOPPED = -1;
var CHECK_INTERVAL = 1 << 20;
var TWIST = 0;
var FLIP = 3;
var SLICE = 6;
var DIST = 9;
var CORNERS2 = 12;
var FRAME = 13;
var NEXT_DISTANCE = Int8Array.from({ length: (MAX_DEPTH + 2) * 3 }, (_, i) => {
  const before = Math.floor(i / 3);
  const step = i % 3 - before % 3;
  return before + (step === 2 ? -1 : step === -2 ? 1 : step);
});
function lookups(tables) {
  const { classes, twistConj, prune, twistMove, flipMove, sliceSortedMove } = tables;
  const { classOf, sorted } = classes;
  const entry = (twist, flip, sliceSorted) => {
    const slice = sorted ? sliceSorted : SLICE_OF_SORTED[sliceSorted];
    const packed = classOf[slice * N_FLIP + flip];
    return (packed >>> 4) * N_TWIST + twistConj[twist * N_SYM + (packed & 15)];
  };
  const stored = (index) => prune[index >>> 4] >>> ((index & 15) << 1) & 3;
  const inTarget = (twist, flip, sliceSorted) => twist === 0 && flip === 0 && (sorted ? sliceSorted : SLICE_OF_SORTED[sliceSorted]) === 0;
  function exactDistance(twist, flip, sliceSorted) {
    let distance = 0;
    while (!inTarget(twist, flip, sliceSorted)) {
      const closer = (stored(entry(twist, flip, sliceSorted)) + 2) % 3;
      let m = 0;
      for (; m < N_MOVES; m++) {
        const t = twistMove[twist * N_MOVES + m];
        const f = flipMove[flip * N_MOVES + m];
        const s = sliceSortedMove[sliceSorted * N_MOVES + m];
        if (stored(entry(t, f, s)) === closer) {
          twist = t;
          flip = f;
          sliceSorted = s;
          break;
        }
      }
      if (m === N_MOVES) throw new Error("The optimal prune table is inconsistent");
      distance++;
    }
    return distance;
  }
  return { exactDistance };
}
function axisStarts(cube, exactDistance) {
  return AXES.map((rotations2) => {
    let c = cube;
    for (const r of rotations2) c = rotateCube(c, r.axis, r.turns);
    const twist = getTwist(c.co);
    const flip = getFlip(c.eo);
    const sliceSorted = getSliceSorted(c.ep);
    return { twist, flip, sliceSorted, distance: exactDistance(twist, flip, sliceSorted) };
  });
}
function firstBound(distances, cornerDistance) {
  const [ud = 0, rl = 0, fb = 0] = distances;
  const allEqual = ud !== 0 && ud === rl && ud === fb;
  return Math.max(ud + (allEqual ? 1 : 0), rl, fb, cornerDistance);
}
function createSearcher(tables, check) {
  const { classes, twistConj, prune, cornerDepth, twistMove, flipMove, sliceSortedMove } = tables;
  const { classOf, sorted } = classes;
  const { cornerPermMove } = tables;
  const { exactDistance } = lookups(tables);
  const state = new Int32Array((MAX_DEPTH + 1) * FRAME);
  const path = new Uint8Array(MAX_DEPTH);
  let nodes = 0;
  function descend(depth, togo, m) {
    const at2 = depth * FRAME;
    const to = at2 + FRAME;
    const corners = cornerPermMove[state[at2 + CORNERS2] * N_MOVES + m];
    if (cornerDepth[corners] >= togo) return false;
    for (let axis = 0; axis < 3; axis++) {
      const ma = moveOnAxis[axis * N_MOVES + m];
      const t = twistMove[state[at2 + TWIST + axis] * N_MOVES + ma];
      const f = flipMove[state[at2 + FLIP + axis] * N_MOVES + ma];
      const s = sliceSortedMove[state[at2 + SLICE + axis] * N_MOVES + ma];
      const packed = classOf[(sorted ? s : SLICE_OF_SORTED[s]) * N_FLIP + f];
      const index = (packed >>> 4) * N_TWIST + twistConj[t * N_SYM + (packed & 15)];
      const mod3 = prune[index >>> 4] >>> ((index & 15) << 1) & 3;
      const distance = NEXT_DISTANCE[state[at2 + DIST + axis] * 3 + mod3];
      if (distance >= togo) return false;
      state[to + TWIST + axis] = t;
      state[to + FLIP + axis] = f;
      state[to + SLICE + axis] = s;
      state[to + DIST + axis] = distance;
    }
    const d = state[to + DIST];
    if (d !== 0 && d === state[to + DIST + 1] && d === state[to + DIST + 2] && d + 1 >= togo) {
      return false;
    }
    state[to + CORNERS2] = corners;
    return true;
  }
  function search(depth, togo, lastFace) {
    if (togo === 0) {
      const at3 = depth * FRAME;
      const solved = state[at3 + CORNERS2] === 0 && state[at3 + SLICE] === 0 && state[at3 + SLICE + 1] === 0 && state[at3 + SLICE + 2] === 0;
      return solved ? FOUND : NONE;
    }
    const at2 = depth * FRAME;
    const to = at2 + FRAME;
    moves: for (let m = 0; m < N_MOVES; m++) {
      const face = m / 3 | 0;
      const diff = lastFace - face;
      if (diff === 0 || diff === 3) continue;
      if (++nodes % CHECK_INTERVAL === 0 && check()) return STOPPED;
      const corners = cornerPermMove[state[at2 + CORNERS2] * N_MOVES + m];
      if (cornerDepth[corners] >= togo) continue;
      for (let axis = 0; axis < 3; axis++) {
        const ma = moveOnAxis[axis * N_MOVES + m];
        const t = twistMove[state[at2 + TWIST + axis] * N_MOVES + ma];
        const f = flipMove[state[at2 + FLIP + axis] * N_MOVES + ma];
        const s = sliceSortedMove[state[at2 + SLICE + axis] * N_MOVES + ma];
        const packed = classOf[(sorted ? s : SLICE_OF_SORTED[s]) * N_FLIP + f];
        const index = (packed >>> 4) * N_TWIST + twistConj[t * N_SYM + (packed & 15)];
        const mod3 = prune[index >>> 4] >>> ((index & 15) << 1) & 3;
        const distance = NEXT_DISTANCE[state[at2 + DIST + axis] * 3 + mod3];
        if (distance >= togo) continue moves;
        state[to + TWIST + axis] = t;
        state[to + FLIP + axis] = f;
        state[to + SLICE + axis] = s;
        state[to + DIST + axis] = distance;
      }
      const d = state[to + DIST];
      if (d !== 0 && d === state[to + DIST + 1] && d === state[to + DIST + 2] && d + 1 >= togo) {
        continue;
      }
      state[to + CORNERS2] = corners;
      path[depth] = m;
      const outcome = search(depth + 1, togo - 1, face);
      if (outcome !== NONE) return outcome;
    }
    return NONE;
  }
  return {
    state,
    path,
    get nodes() {
      return nodes;
    },
    setRoot(cube) {
      axisStarts(cube, exactDistance).forEach((start, axis) => {
        state[TWIST + axis] = start.twist;
        state[FLIP + axis] = start.flip;
        state[SLICE + axis] = start.sliceSorted;
        state[DIST + axis] = start.distance;
      });
      state[CORNERS2] = getCornerPerm(cube.cp);
      return firstBound(
        [state[DIST], state[DIST + 1], state[DIST + 2]],
        cornerDepth[state[CORNERS2]]
      );
    },
    copyRoot(frame) {
      state.set(frame.subarray(0, FRAME));
    },
    descend,
    search
  };
}
function createOptimalSolver(tables) {
  return function solve(cube, options = {}) {
    const { shouldStop, onProgress, upperBound } = options;
    const begin = performance.now();
    const depths = [];
    let cancelled = false;
    let bound = 0;
    const check = () => {
      onProgress?.({ depth: bound, nodes: searcher.nodes, elapsedMs: performance.now() - begin });
      if (shouldStop?.() === true) cancelled = true;
      return cancelled;
    };
    const searcher = createSearcher(tables, check);
    bound = searcher.setRoot(cube);
    const result = (moves, provedBound = false) => ({
      moves,
      cancelled,
      provedBound,
      nodes: searcher.nodes,
      elapsedMs: performance.now() - begin,
      depths
    });
    for (; bound <= MAX_DEPTH; bound++) {
      if (upperBound !== void 0 && bound >= upperBound.length) return result(upperBound, true);
      if (check()) return result(void 0);
      const nodesBefore = searcher.nodes;
      const start = performance.now();
      const outcome = searcher.search(0, bound, -1);
      if (outcome === STOPPED) return result(void 0);
      depths.push({
        depth: bound,
        nodes: searcher.nodes - nodesBefore,
        ms: performance.now() - start
      });
      if (outcome === FOUND) {
        return result(Array.from(searcher.path.subarray(0, bound), (m) => FACE_TURNS[m]));
      }
    }
    throw new Error(`No solution within ${String(MAX_DEPTH)} moves`);
  };
}

// upstream/packages/solver-ts/src/two-phase.ts
var PHASE1_DEPTH_LIMIT = 20;
var PHASE2_MOVE_LIMIT = 10;
var CHECK_INTERVAL2 = 1024;
var IS_PHASE2_MOVE = new Uint8Array(N_MOVES);
for (const m of PHASE2_MOVES) IS_PHASE2_MOVE[m] = 1;
var DIAGONAL = [
  { axis: "R", turns: 1 },
  { axis: "U", turns: 1 }
];
var DIRECTIONS = [0, 1, 2].flatMap((times) => {
  const rotations2 = Array.from({ length: times }, () => DIAGONAL).flat();
  return [
    { rotations: rotations2, inverted: false },
    { rotations: rotations2, inverted: true }
  ];
});
function toOriginal(path, direction) {
  let moves = path.map((m) => FACE_TURNS[m]);
  if (direction.inverted) moves = invertFaceTurns(moves);
  return moves.map(({ face, turns }) => ({
    face: direction.rotations.reduceRight(
      (f, r) => rotateFace(f, r.axis, inverseTurns(r.turns)),
      face
    ),
    turns
  }));
}
function createTwoPhaseSolver(tables) {
  const {
    twistMove,
    flipMove,
    sliceMove,
    sliceSortedMove,
    uEdgesMove,
    dEdgesMove,
    cornerPermMove,
    udEdgePermMove,
    udEdgesFromGroups,
    sliceTwistPrune,
    sliceFlipPrune,
    twistFlipPrune,
    cornerSlicePrune,
    udEdgeSlicePrune
  } = tables;
  const phase1Heuristic = (twist, flip, slice) => {
    const ht = sliceTwistPrune[slice * N_TWIST + twist];
    const hf = sliceFlipPrune[slice * N_FLIP + flip];
    const hx = twistFlipPrune[twist * N_FLIP + flip];
    const h2 = ht > hf ? ht : hf;
    return h2 > hx ? h2 : hx;
  };
  function startOf(cube, direction) {
    let c = cube;
    for (const r of direction.rotations) c = rotateCube(c, r.axis, r.turns);
    if (direction.inverted) c = inverse(c);
    const twist = getTwist(c.co);
    const flip = getFlip(c.eo);
    const slice = getSlice(c.ep);
    return {
      direction,
      twist,
      flip,
      slice,
      h: phase1Heuristic(twist, flip, slice),
      sliceSorted: getSliceSorted(c.ep),
      corners: getCornerPerm(c.cp),
      uEdges: getUEdges(c.ep),
      dEdges: getDEdges(c.ep)
    };
  }
  return function solve(cube, options = {}) {
    const maxLength = options.maxLength ?? 20;
    const timeLimitMs = options.timeLimitMs ?? Number.POSITIVE_INFINITY;
    const { shouldStop, onProgress, onImprovement } = options;
    const begin = performance.now();
    const starts = DIRECTIONS.slice(0, options.directions ?? 6).map((d) => startOf(cube, d));
    let current = starts[0];
    let currentDepth = 0;
    const path = new Int8Array(PHASE1_DEPTH_LIMIT + PHASE2_MOVE_LIMIT);
    let best;
    let bestLength = Number.POSITIVE_INFINITY;
    let stoppedBy;
    let phase1Nodes = 0;
    let phase2Nodes = 0;
    let phase1Solutions = 0;
    function checkStop() {
      const elapsedMs = performance.now() - begin;
      onProgress?.({
        depth: currentDepth,
        bestLength: best === void 0 ? void 0 : bestLength,
        nodes: phase1Nodes + phase2Nodes,
        elapsedMs
      });
      if (shouldStop?.() === true) stoppedBy = "cancelled";
      else if (best !== void 0 && elapsedMs > timeLimitMs) stoppedBy = "time";
    }
    function phase2(corners, udEdges, slice, togo, lastFace, depth) {
      if (togo === 0) return true;
      for (const m of PHASE2_MOVES) {
        const face = m / 3 | 0;
        const diff = lastFace - face;
        if (diff === 0 || diff === 3) continue;
        phase2Nodes++;
        const c = cornerPermMove[corners * N_MOVES + m];
        const u = udEdgePermMove[udEdges * N_MOVES + m];
        const s = sliceSortedMove[slice * N_MOVES + m];
        const hc = cornerSlicePrune[c * N_SLICE_PERM + s];
        const hu = udEdgeSlicePrune[u * N_SLICE_PERM + s];
        if ((hc > hu ? hc : hu) >= togo) continue;
        path[depth] = m;
        if (phase2(c, u, s, togo - 1, face, depth + 1)) return true;
      }
      return false;
    }
    function phase1Solved(length, lastFace) {
      phase1Solutions++;
      let corners = current.corners;
      let slice = current.sliceSorted;
      let uEdges = current.uEdges;
      let dEdges = current.dEdges;
      for (let i = 0; i < length; i++) {
        const m = path[i];
        corners = cornerPermMove[corners * N_MOVES + m];
        slice = sliceSortedMove[slice * N_MOVES + m];
        uEdges = uEdgesMove[uEdges * N_MOVES + m];
        dEdges = dEdgesMove[dEdges * N_MOVES + m];
      }
      const limit = Math.min(bestLength - length, PHASE2_MOVE_LIMIT + 1);
      const hc = cornerSlicePrune[corners * N_SLICE_PERM + slice];
      if (hc >= limit) return;
      const udEdges = udEdgesFromGroups[uEdges * 24 + dEdges % 24];
      const hu = udEdgeSlicePrune[udEdges * N_SLICE_PERM + slice];
      for (let togo = hc > hu ? hc : hu; togo < limit; togo++) {
        if (phase2(corners, udEdges, slice, togo, lastFace, length)) {
          bestLength = length + togo;
          best = { path: Array.from(path.subarray(0, bestLength)), direction: current.direction };
          onImprovement?.(toOriginal(best.path, best.direction));
          if (bestLength <= maxLength) stoppedBy = "target";
          return;
        }
      }
    }
    function phase1(twist, flip, slice, h, togo, lastFace, depth) {
      if (togo === 0) {
        phase1Solved(depth, lastFace);
        if (stoppedBy === void 0) checkStop();
        return;
      }
      if (++phase1Nodes % CHECK_INTERVAL2 === 0) checkStop();
      for (let m = 0; m < N_MOVES; m++) {
        const face = m / 3 | 0;
        const diff = lastFace - face;
        if (diff === 0 || diff === 3) continue;
        if (h === 0 && togo < 5 && IS_PHASE2_MOVE[m] === 1) continue;
        const t = twistMove[twist * N_MOVES + m];
        const f = flipMove[flip * N_MOVES + m];
        const s = sliceMove[slice * N_MOVES + m];
        const next = phase1Heuristic(t, f, s);
        if (next >= togo) continue;
        path[depth] = m;
        phase1(t, f, s, next, togo - 1, face, depth + 1);
        if (stoppedBy !== void 0) return;
      }
    }
    const minDepth = Math.min(...starts.map((s) => s.h));
    search: for (let depth = minDepth; depth < PHASE1_DEPTH_LIMIT; depth++) {
      for (const start of starts) {
        if (depth >= bestLength) break search;
        if (start.h > depth) continue;
        current = start;
        currentDepth = depth;
        phase1(start.twist, start.flip, start.slice, start.h, depth, -1, 0);
        if (stoppedBy !== void 0) break search;
      }
    }
    return {
      moves: best === void 0 ? void 0 : toOriginal(best.path, best.direction),
      stoppedBy: stoppedBy ?? "exhausted",
      stats: { phase1Nodes, phase2Nodes, phase1Solutions, elapsedMs: performance.now() - begin }
    };
  };
}
export {
  FACE_TURNS,
  FOUND,
  MAX_DEPTH,
  SOLVED,
  applyFaceTurn,
  applyFaceTurns,
  buildOptimalTables,
  buildTwoPhaseTables,
  createOptimalSolver,
  createSearcher,
  createTwoPhaseSolver,
  formatFaceTurns,
  invertFaceTurns,
  isSolved,
  parseFacelets,
  readPruneFile
};
