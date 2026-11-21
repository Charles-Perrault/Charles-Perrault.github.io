// MrDenzzz/cube-solver 950fa93285640b2e64431a74186513f31d43b613, MIT. See LICENSE and README for adaptation.

// packages/cube-core/src/util.ts
function at(items, index2) {
  const item = items[index2];
  if (item === void 0) {
    throw new RangeError(`Index ${String(index2)} is outside 0..${String(items.length - 1)}`);
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
  let parity2 = 0;
  for (let start = 0; start < permutation.length; start++) {
    if (seen[start] === true) continue;
    let cycleLength = 0;
    for (let i = start; seen[i] !== true; i = at(permutation, i)) {
      seen[i] = true;
      cycleLength++;
    }
    parity2 += cycleLength - 1;
  }
  return parity2 % 2 === 0 ? 0 : 1;
}

// packages/cube-core/src/geometry.ts
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
var OPPOSITE = {
  U: "D",
  R: "L",
  F: "B",
  D: "U",
  L: "R",
  B: "F"
};
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

// packages/cube-core/src/cubie.ts
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

// packages/cube-core/src/validation.ts
var sum = (values) => values.reduce((s, v) => s + v, 0);
function checkInvariants(cube) {
  const errors = [];
  const twist = sum(cube.co) % 3;
  if (twist === 1 || twist === 2) errors.push({ code: "twisted-corner", twist });
  if (sum(cube.eo) % 2 !== 0) errors.push({ code: "flipped-edge" });
  if (permutationParity(cube.cp) !== permutationParity(cube.ep)) errors.push({ code: "parity" });
  return errors;
}

// packages/cube-core/src/facelets.ts
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

// packages/cube-core/src/moves.ts
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
function invertFaceTurns(turns) {
  return turns.toReversed().map(({ face, turns: t }) => ({ face, turns: inverseTurns(t) }));
}
function inverseTurns(turns) {
  return turns === 1 ? 3 : turns === 3 ? 1 : 2;
}

// packages/cube-core/src/notation.ts
var PRIMES = "'\u2019\u2018`\xB4\u2032";
var TOKEN = new RegExp(`(\\d+)?([URFDLB]w|[URFDLBurfdlbMESxyz])(2)?([${PRIMES}])?`, "y");

// packages/cube-core/src/algorithm.ts
var AXIS_FACES = ["U", "R", "F"];
function fromAxisFace(turn, size) {
  if (AXIS_FACES.includes(turn.face)) return turn;
  return {
    face: OPPOSITE[turn.face],
    from: size + 1 - turn.to,
    to: size + 1 - turn.from,
    turns: inverseTurns(turn.turns)
  };
}
function simplifyLayerTurns(turns, size) {
  const out = [];
  for (const turn of turns) {
    const next = fromAxisFace(turn, size);
    let merged = false;
    for (let i = out.length - 1; i >= 0; i--) {
      const previous = fromAxisFace(at(out, i), size);
      if (previous.face !== next.face) break;
      if (previous.from !== next.from || previous.to !== next.to) continue;
      const sum2 = (previous.turns + next.turns) % 4;
      if (sum2 === 0) out.splice(i, 1);
      else out[i] = { ...at(out, i), turns: named(at(out, i).face, sum2) };
      merged = true;
      break;
    }
    if (!merged) out.push(turn);
  }
  return out;
}
var named = (face, turns) => AXIS_FACES.includes(face) ? turns : inverseTurns(turns);

// packages/cube-core/src/random.ts
var MASK64 = (1n << 64n) - 1n;

// packages/cube-core/src/cube4.ts
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
var wingColours = (wing) => at(EDGE_FACES, wing >> 1);
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
var slotMoves = /* @__PURE__ */ new Map();
function slotMove(turn) {
  const key = `${turn.face}${String(turn.from)}${String(turn.to)}${String(turn.turns)}`;
  const cached = slotMoves.get(key);
  if (cached !== void 0) return cached;
  const source = facePermutation(turn);
  const wingAt = new Map(WING_FACELETS.map(([f], slot) => [f, slot]));
  const wingAt2 = new Map(WING_FACELETS.map(([, f], slot) => [f, slot]));
  const centreAt = new Map(CENTRE_FACELETS.map((f, slot) => [f, slot]));
  const wings = WING_FACELETS.map(([f]) => {
    const from = at(source, f);
    const slot = wingAt.get(from) ?? wingAt2.get(from);
    if (slot === void 0) throw new Error("A wing sticker moved off the wings");
    return slot;
  });
  const centres = CENTRE_FACELETS.map((f) => {
    const slot = centreAt.get(at(source, f));
    if (slot === void 0) throw new Error("A centre sticker moved off the centres");
    return slot;
  });
  let corners = null;
  const outer = (face, turns) => at(MOVE_CUBES, faceTurnIndex({ face, turns }));
  if (turn.from === 1) corners = outer(turn.face, turn.turns);
  if (turn.to === SIZE) {
    const far = outer(OPPOSITE[turn.face], inverseTurns(turn.turns));
    corners = corners === null ? far : multiply(corners, far);
  }
  const move = { wings, centres, corners };
  slotMoves.set(key, move);
  return move;
}
function slotPermutations(turn) {
  return slotMove(turn);
}
function applyLayerTurn4(cube, turn) {
  const move = slotMove(turn);
  const m = move.corners;
  return {
    cp: m === null ? cube.cp : m.cp.map((from) => at(cube.cp, from)),
    co: m === null ? cube.co : m.cp.map((from, i) => (at(cube.co, from) + at(m.co, i)) % 3),
    wp: move.wings.map((from) => at(cube.wp, from)),
    centres: move.centres.map((from) => at(cube.centres, from))
  };
}
function applyLayerTurns4(cube, turns) {
  return turns.reduce(applyLayerTurn4, cube);
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
function wingFlipped(wing, slot) {
  return at(at(WING_ORDER, wing), slot) === 1;
}
function cube4ToFacelets(cube) {
  const faces = FACES.flatMap((face) => new Array(PER_FACE).fill(face));
  cube.cp.forEach((corner, slot) => {
    const twist = at(cube.co, slot);
    const facelets = at(CORNER_FACELETS_4, slot);
    at(CORNER_FACES, corner).forEach((face, k) => {
      faces[at(facelets, (k + twist) % 3)] = face;
    });
  });
  cube.wp.forEach((wing, slot) => {
    const [ref, other] = at(WING_FACELETS, slot);
    const [a, b] = wingColours(wing);
    const flipped = at(at(WING_ORDER, wing), slot) === 1;
    faces[ref] = flipped ? b : a;
    faces[other] = flipped ? a : b;
  });
  cube.centres.forEach((colour, slot) => {
    faces[at(CENTRE_FACELETS, slot)] = at(FACES, colour);
  });
  return faces.join("");
}
var sameSet2 = (a, b) => a.every((f) => b.includes(f));
function parseFacelets4(input) {
  const stickers = symbols(input);
  if (stickers.length !== STICKERS_4) {
    return err([{ code: "invalid-length", expected: STICKERS_4, actual: stickers.length }]);
  }
  const errors = [];
  const unknown = /* @__PURE__ */ new Map();
  stickers.forEach((s, i) => {
    if (!isFace(s)) unknown.set(s, [...unknown.get(s) ?? [], i]);
  });
  for (const [colour, facelets] of unknown)
    errors.push({ code: "unknown-colour", colour, facelets });
  if (errors.length > 0) return err(errors);
  const faces = stickers;
  for (const face of FACES) {
    const count = faces.filter((f) => f === face).length;
    if (count !== PER_FACE) errors.push({ code: "colour-count", face, count, expected: PER_FACE });
    const centres2 = CENTRE_FACELETS.filter((f) => faces[f] === face).length;
    if (centres2 !== 4) errors.push({ code: "centre-count", face, count: centres2 });
  }
  if (errors.length > 0) return err(errors);
  const cp = [];
  const co = [];
  CORNER_FACELETS_4.forEach((facelets) => {
    const shown = facelets.map((f) => at(faces, f));
    const corner = CORNER_FACES.findIndex((reference2) => sameSet2(reference2, shown));
    const twist = shown.findIndex((face) => face === "U" || face === "D");
    const reference = corner === -1 ? void 0 : at(CORNER_FACES, corner);
    if (reference === void 0 || twist === -1) {
      errors.push({ code: "invalid-corner", facelets });
      return;
    }
    const rotated = shown.map((_, k) => at(shown, (k + twist) % 3));
    if (!rotated.every((face, k) => face === reference[k])) {
      errors.push({ code: "mirrored-corner", facelets });
      return;
    }
    cp.push(corner);
    co.push(twist);
  });
  const wp = [];
  WING_FACELETS.forEach(([ref, other], slot) => {
    const shown = [at(faces, ref), at(faces, other)];
    const wing = Array.from({ length: 24 }, (_, w) => w).find((w) => {
      const [a, b] = wingColours(w);
      const flipped = at(at(WING_ORDER, w), slot) === 1;
      return flipped ? shown[0] === b && shown[1] === a : shown[0] === a && shown[1] === b;
    });
    if (wing === void 0) errors.push({ code: "invalid-wing", facelets: [ref, other] });
    else wp.push(wing);
  });
  if (errors.length > 0) return err(errors);
  cp.forEach((corner, slot) => {
    if (cp.indexOf(corner) !== slot) {
      errors.push({ code: "duplicate-corner", facelets: at(CORNER_FACELETS_4, slot) });
    }
  });
  wp.forEach((wing, slot) => {
    if (wp.indexOf(wing) !== slot)
      errors.push({ code: "duplicate-wing", facelets: at(WING_FACELETS, slot) });
  });
  if (co.reduce((s, t) => s + t, 0) % 3 !== 0) errors.push({ code: "twisted-corner" });
  if (errors.length > 0) return err(errors);
  const centres = CENTRE_FACELETS.map((f) => FACES.indexOf(at(faces, f)));
  return ok({ cp, co, wp, centres });
}
function isSolved4(cube) {
  const facelets = cube4ToFacelets(cube);
  return FACES.every((_, f) => {
    const face = facelets.slice(f * PER_FACE, (f + 1) * PER_FACE);
    return face === face.charAt(0).repeat(PER_FACE);
  });
}

// packages/cube-core/src/rotation.ts
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

// packages/solver-ts/src/four/moves.ts
var MOVES = MOVES_4;
var N_MOVES_4 = MOVES.length;
var TURNS2 = [1, 2, 3];
var WIDE_FACES = ["U", "R", "F"];
var index = (face, wide, turns) => wide ? 18 + WIDE_FACES.indexOf(face) * 3 + turns - 1 : FACES.indexOf(face) * 3 + turns - 1;
var PHASE1_MOVES = MOVES.map((_, m) => m);
var PHASE2_MOVES = [
  ...Array.from({ length: 18 }, (_, m) => m),
  index("R", true, 1),
  index("R", true, 2),
  index("R", true, 3),
  index("U", true, 2),
  index("F", true, 2)
];
var PHASE3_MOVES = [
  ...["U", "F", "D", "B"].flatMap((face) => TURNS2.map((t) => index(face, false, t))),
  index("R", false, 2),
  index("L", false, 2),
  index("U", true, 2),
  index("R", true, 2),
  index("F", true, 2)
].sort((a, b) => a - b);
var group = (m) => m < 18 ? Math.floor(m / 3) : 6 + Math.floor((m - 18) / 3);
var axisOfGroup = [0, 1, 2, 0, 1, 2, 0, 1, 2];
function canFollow(last, m) {
  if (last < 0) return true;
  const a = group(last);
  const b = group(m);
  if (a === b) return false;
  return axisOfGroup[a] !== axisOfGroup[b] || a < b;
}
var WING_MOVES = MOVES.map(
  (m) => slotPermutations(m).wings
);
var CENTRE_MOVES = MOVES.map(
  (m) => slotPermutations(m).centres
);
var WING_PARITY_FLIP = WING_MOVES.map((source) => {
  const seen = new Array(24).fill(false);
  let parity2 = 0;
  for (let i = 0; i < 24; i++) {
    if (seen[i]) continue;
    let length = 0;
    for (let j = i; !seen[j]; j = source[j]) {
      seen[j] = true;
      length++;
    }
    parity2 ^= length - 1 & 1;
  }
  return parity2;
});
var WING_CLASS = (() => {
  const cls = new Array(24).fill(-1);
  cls[0] = 0;
  const queue = [0];
  for (const slot of queue) {
    for (const m of PHASE3_MOVES) {
      const source = WING_MOVES[m];
      const target = source.indexOf(slot);
      if (cls[target] === -1) {
        cls[target] = 0;
        queue.push(target);
      }
    }
  }
  for (let s = 0; s < 24; s++) if (cls[s] === -1) cls[s] = 1;
  for (let e = 0; e < 12; e++) {
    if (cls[2 * e] === cls[2 * e + 1]) throw new Error("Wing classes do not split the edges");
  }
  return cls;
})();
var LOW_SLOT = Array.from(
  { length: 12 },
  (_, e) => WING_CLASS[2 * e] === 0 ? 2 * e : 2 * e + 1
);
var HIGH_SLOT = LOW_SLOT.map((s) => s % 2 === 0 ? s + 1 : s - 1);
var PHASE3_LOW = MOVES.map(
  (_, m) => LOW_SLOT.map((slot) => LOW_SLOT.indexOf(WING_MOVES[m][slot]))
);
var PHASE3_HIGH = MOVES.map(
  (_, m) => HIGH_SLOT.map((slot) => HIGH_SLOT.indexOf(WING_MOVES[m][slot]))
);

// packages/solver-ts/src/four/edge-pairing.ts
var ORDER = (() => {
  const all = EDGE_FACES.map((_, e) => e);
  const inSlice = (e) => !EDGE_FACES[e].some((f) => f === "R" || f === "L");
  return [...all.filter(inSlice), ...all.filter((e) => !inSlice(e))];
})();
var COORD = invert(ORDER);
function invert(p) {
  const out = new Array(p.length);
  p.forEach((x, i) => out[x] = i);
  return out;
}
var N_PREFIX = 12 * 11 * 10 * 9;
var N_SUFFIX = 8 * 7 * 6 * 5 * 4 * 3;
var MAX_EDGE_DISTANCE = 10;
var N_SYMS = 8;
var POP = Uint8Array.from({ length: 4096 }, (_, v) => {
  let n = 0;
  for (let x = v; x !== 0; x &= x - 1) n++;
  return n;
});
var SYMS = (() => {
  const syms = [];
  const axes = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
  ];
  for (const axis of axes) {
    for (let signs = 0; signs < 8; signs++) {
      const map = (v) => {
        const out = [0, 0, 0];
        for (let i = 0; i < 3; i++) out[axis[i]] = v[i] * (signs >> i & 1 ? -1 : 1);
        return out;
      };
      const target = WING_FACELETS.map(([facelet]) => {
        const { position, normal } = stickerAt(4, facelet);
        const image = faceletAt(4, { position: map(position), normal: map(normal) });
        return WING_FACELETS.findIndex(([a, b]) => a === image || b === image);
      });
      if (target.some((t, slot) => WING_CLASS[t] !== WING_CLASS[slot])) continue;
      syms.push(ORDER.map((p) => COORD[target[LOW_SLOT[p]] >> 1]));
    }
  }
  if (syms.length !== N_SYMS || syms.some((a) => a.slice(0, 4).some((q) => q >= 4))) {
    throw new Error("Unexpected symmetries of the edge pairing");
  }
  return syms;
})();
var SRC = new Uint8Array((N_MOVES_4 + 1) * N_SYMS * 12);
var VAL = new Uint8Array((N_MOVES_4 + 1) * N_SYMS * 12);
{
  const identity = Array.from({ length: 12 }, (_, i) => i);
  const fill = (m, lowSource, highTarget) => {
    SYMS.forEach((a, s) => {
      const ainv = invert(a);
      const at2 = (m * N_SYMS + s) * 12;
      for (let q = 0; q < 12; q++) {
        SRC[at2 + q] = lowSource[ainv[q]];
        VAL[at2 + q] = a[highTarget[q]];
      }
    });
  };
  for (const m of PHASE3_MOVES) {
    const low = ORDER.map((p) => COORD[PHASE3_LOW[m]?.[p]]);
    const highSource = ORDER.map((p) => COORD[PHASE3_HIGH[m]?.[p]]);
    fill(m, low, invert(highSource));
  }
  fill(N_MOVES_4, identity, identity);
}
function rankPrefix(state, from, ms) {
  let used = 0;
  let rank = 0;
  for (let i = 0; i < 4; i++) {
    const v = VAL[ms + state[from + SRC[ms + i]]];
    rank = rank * (12 - i) + v - POP[used & (1 << v) - 1];
    used |= 1 << v;
  }
  return rank;
}
function rankSuffix(state, from, ms) {
  let used = 0;
  let rank = 0;
  for (let i = 0; i < 10; i++) {
    const v = VAL[ms + state[from + SRC[ms + i]]];
    if (i >= 4) rank = rank * (12 - i) + v - POP[used & (1 << v) - 1];
    used |= 1 << v;
  }
  return rank;
}
function buildSymmetryClasses() {
  const rawToSym = new Uint16Array(N_PREFIX).fill(65535);
  const representatives = [];
  const stabilisers = [];
  const state = new Uint8Array(12);
  for (let raw = 0; raw < N_PREFIX; raw++) {
    if (rawToSym[raw] !== 65535) continue;
    unrankPrefix(raw, state);
    const cls = representatives.length;
    let stabiliser = 0;
    for (let s = 0; s < N_SYMS; s++) {
      const image = rankPrefix(state, 0, (N_MOVES_4 * N_SYMS + s) * 12);
      if (image === raw) stabiliser |= 1 << s;
      rawToSym[image] = cls << 3 | inverseSym(s);
    }
    representatives.push(raw);
    stabilisers.push(stabiliser);
  }
  return {
    rawToSym,
    symToRaw: Uint16Array.from(representatives),
    stabiliser: Uint8Array.from(stabilisers)
  };
}
var INVERSE_SYM = SYMS.map((a) => {
  const ainv = invert(a).join();
  return SYMS.findIndex((b) => b.join() === ainv);
});
var inverseSym = (s) => INVERSE_SYM[s];
function unrankPrefix(raw, out) {
  const digits = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    digits[i] = raw % (12 - i);
    raw = Math.floor(raw / (12 - i));
  }
  let free = 4095;
  digits.forEach((d, i) => {
    out[i] = nthFree(free, d);
    free &= ~(1 << out[i]);
  });
  for (let i = 4; i < 12; i++) {
    out[i] = nthFree(free, 0);
    free &= ~(1 << out[i]);
  }
}
function nthFree(free, n) {
  let v = 0;
  for (let left = n; ; v++) {
    if ((free >>> v & 1) === 0) continue;
    if (left === 0) return v;
    left--;
  }
}
function unrankState(table, index2, out) {
  let rest = index2 % N_SUFFIX;
  const prefix = table.symToRaw[Math.floor(index2 / N_SUFFIX)];
  unrankPrefix(prefix, out);
  const digits = [0, 0, 0, 0, 0, 0];
  for (let i = 9; i >= 4; i--) {
    digits[i - 4] = rest % (12 - i);
    rest = Math.floor(rest / (12 - i));
  }
  let free = 4095;
  for (let i = 0; i < 4; i++) free &= ~(1 << out[i]);
  digits.forEach((d, k) => {
    out[4 + k] = nthFree(free, d);
    free &= ~(1 << out[4 + k]);
  });
  out[10] = nthFree(free, 0);
  out[11] = nthFree(free, 1);
  if (oddPermutation(out)) [out[10], out[11]] = [out[11], out[10]];
}
function oddPermutation(p) {
  let odd = false;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (p[i] > p[j]) odd = !odd;
  return odd;
}
var stored = (prune, i) => prune[i >>> 4] >>> ((i & 15) << 1) & 3;
function edgeIndex(table, state, from, m) {
  const raw = table.rawToSym[rankPrefix(state, from, m * N_SYMS * 12)];
  return (raw >>> 3) * N_SUFFIX + rankSuffix(state, from, (m * N_SYMS + (raw & 7)) * 12);
}
function moveEdges(state, from, to, m) {
  const ms = m * N_SYMS * 12;
  for (let q = 0; q < 12; q++) state[to + q] = VAL[ms + state[from + SRC[ms + q]]];
}
function nextEdgeDistance(table, index2, parent) {
  const value = stored(table.prune, index2);
  return value === 3 ? MAX_EDGE_DISTANCE : (value - parent + 16) % 3 + parent - 1;
}
function edgeDistance(table, sigma) {
  const state = new Uint8Array(24);
  state.set(sigma.subarray(0, 12));
  let index2 = edgeIndex(table, state, 0, N_MOVES_4);
  if (stored(table.prune, index2) === 3) return MAX_EDGE_DISTANCE;
  let distance = 0;
  while (index2 !== 0) {
    const closer = (stored(table.prune, index2) + 2) % 3;
    const m = PHASE3_MOVES.find(
      (move) => stored(table.prune, edgeIndex(table, state, 0, move)) === closer
    );
    if (m === void 0) throw new Error("The edge pairing table is inconsistent");
    moveEdges(state, 0, 12, m);
    state.copyWithin(0, 12, 24);
    index2 = edgeIndex(table, state, 0, N_MOVES_4);
    distance++;
  }
  return distance;
}
function edgeState(low, high) {
  const sigma = new Uint8Array(12);
  low.forEach((p, e) => sigma[COORD[p]] = COORD[high[e]]);
  return sigma;
}
function buildEdgePairing() {
  const classes = buildSymmetryClasses();
  const size = classes.symToRaw.length * N_SUFFIX;
  const prune = new Uint32Array(Math.ceil(size / 16)).fill(4294967295);
  const table = { ...classes, prune };
  const set = (i, v) => {
    prune[i >>> 4] = prune[i >>> 4] & ~(3 << ((i & 15) << 1)) | v << ((i & 15) << 1);
  };
  set(0, 0);
  const state = new Uint8Array(24);
  for (let depth = 0; depth < MAX_EDGE_DISTANCE - 1; depth++) {
    const current = depth % 3;
    const next = (depth + 1) % 3;
    for (let word = 0; word < prune.length; word++) {
      if (prune[word] === 4294967295) continue;
      for (let i = word << 4, end = i + 16; i < end; i++) {
        if (stored(prune, i) !== current) continue;
        unrankState(table, i, state);
        for (const m of PHASE3_MOVES) {
          const raw = classes.rawToSym[rankPrefix(state, 0, m * N_SYMS * 12)];
          const cls = raw >>> 3;
          const ms = (m * N_SYMS + (raw & 7)) * 12;
          const j = cls * N_SUFFIX + rankSuffix(state, 0, ms);
          if (stored(prune, j) !== 3) continue;
          set(j, next);
          const stabiliser = classes.stabiliser[cls];
          if (stabiliser === 1) continue;
          for (let q = 0; q < 12; q++) state[12 + q] = VAL[ms + state[SRC[ms + q]]];
          for (let s = 1; s < N_SYMS; s++) {
            if ((stabiliser >> s & 1) === 0) continue;
            const k = cls * N_SUFFIX + rankSuffix(state, 12, (N_MOVES_4 * N_SYMS + s) * 12);
            if (stored(prune, k) === 3) set(k, next);
          }
        }
      }
    }
  }
  return table;
}

// packages/solver-ts/src/math.ts
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

// packages/solver-ts/src/four/tables.ts
var UNVISITED = 255;
var R_COLOUR = 1;
var L_COLOUR = 4;
var SIDE_SLOTS = [
  0,
  1,
  2,
  3,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  20,
  21,
  22,
  23
];
var RL_SLOTS = [4, 5, 6, 7, 16, 17, 18, 19];
var UD_SLOTS = [0, 1, 2, 3, 12, 13, 14, 15];
var FB_SLOTS = [8, 9, 10, 11, 20, 21, 22, 23];
function rankMask(mask, bits) {
  let rank = 0;
  let found = 0;
  for (let p = 0; p < bits; p++) if (mask >>> p & 1) rank += choose(p, ++found);
  return rank;
}
var BYTE_RANK = [0, 1, 2].map(
  (byte) => Uint32Array.from({ length: 25 * 256 }, (_, i) => {
    const below = Math.floor(i / 256);
    let rank = 0;
    let found = below;
    for (let j = 0; j < 8; j++) if (i % 256 >>> j & 1) rank += choose(8 * byte + j, ++found);
    return rank;
  })
);
var POPCOUNT = Uint8Array.from({ length: 256 }, (_, v) => {
  let n = 0;
  for (let x = v; x !== 0; x &= x - 1) n++;
  return n;
});
function rankMask24(mask) {
  const b0 = mask & 255;
  const b1 = mask >>> 8 & 255;
  const below2 = POPCOUNT[b0] + POPCOUNT[b1];
  return BYTE_RANK[0][b0] + BYTE_RANK[1][POPCOUNT[b0] * 256 + b1] + BYTE_RANK[2][below2 * 256 + (mask >>> 16)];
}
function unrankMask(rank, k) {
  const positions = new Uint8Array(k);
  unrankCombination(rank, k, positions);
  let mask = 0;
  for (const p of positions) mask |= 1 << p;
  return mask;
}
var CENTRE_TARGET = CENTRE_MOVES.map((source) => {
  const target = new Array(24);
  source.forEach((from, to) => target[from] = to);
  return target;
});
function moveMask(mask, slots, m) {
  const target = CENTRE_TARGET[m];
  let out = 0;
  slots.forEach((slot, bit) => {
    if (mask >>> bit & 1) out |= 1 << slots.indexOf(target[slot]);
  });
  return out;
}
function maskMoveTable(slots, k, moves) {
  const size = choose(slots.length, k);
  const table = new Uint16Array(size * N_MOVES_4);
  for (let c = 0; c < size; c++) {
    const mask = unrankMask(c, k);
    for (const m of moves)
      table[c * N_MOVES_4 + m] = rankMask(moveMask(mask, slots, m), slots.length);
  }
  return table;
}
function bfs(size, targets, moves, next) {
  const depth = new Uint8Array(size).fill(UNVISITED);
  for (const t of targets) depth[t] = 0;
  let frontier = targets.length;
  for (let level = 0; frontier > 0; level++) {
    frontier = 0;
    for (let i = 0; i < size; i++) {
      if (depth[i] !== level) continue;
      for (const m of moves) {
        const j = next(i, m);
        if (depth[j] === UNVISITED) {
          depth[j] = level + 1;
          frontier++;
        }
      }
    }
  }
  return depth;
}
var ALL_SLOTS = Array.from({ length: 24 }, (_, i) => i);
var maskOf = (slots, of) => of.reduce((mask, slot) => mask | 1 << slots.indexOf(slot), 0);
var N_PHASE1 = choose(24, 8);
var PHASE1_TARGET = rankMask(maskOf(ALL_SLOTS, RL_SLOTS), 24);
var N_CT = choose(16, 8);
var N_RL = choose(8, 4);
var CT_TARGET = rankMask(maskOf(SIDE_SLOTS, UD_SLOTS), 16);
var RL_SOLVED = rankMask(maskOf(RL_SLOTS, [4, 5, 6, 7]), 8);
var UD_SOLVED = rankMask(maskOf(UD_SLOTS, [0, 1, 2, 3]), 8);
var FB_SOLVED = rankMask(maskOf(FB_SLOTS, [8, 9, 10, 11]), 8);
function parityOf(permutation) {
  const seen = new Array(permutation.length).fill(false);
  let parity2 = 0;
  for (let i = 0; i < permutation.length; i++) {
    if (seen[i]) continue;
    let length = 0;
    for (let j = i; !seen[j]; j = permutation[j]) {
      seen[j] = true;
      length++;
    }
    parity2 ^= length - 1 & 1;
  }
  return parity2;
}
function buildReductionTables(onStep) {
  let start = performance.now();
  const step = (name) => {
    const now = performance.now();
    onStep?.(name, now - start);
    start = now;
  };
  const byteTargets = MOVES.map(
    (_, m) => [0, 1, 2].map(
      (b) => Uint32Array.from({ length: 256 }, (_2, v) => {
        let out = 0;
        for (let j = 0; j < 8; j++) if (v >>> j & 1) out |= 1 << CENTRE_TARGET[m][8 * b + j];
        return out;
      })
    )
  );
  const masks = Int32Array.from({ length: N_PHASE1 }, (_, i) => unrankMask(i, 8));
  const phase1 = bfs(N_PHASE1, [PHASE1_TARGET], PHASE1_MOVES, (i, m) => {
    const mask = masks[i];
    const [b0, b1, b2] = byteTargets[m];
    return rankMask24(b0[mask & 255] | b1[mask >>> 8 & 255] | b2[mask >>> 16]);
  });
  step("phase 1");
  const ctMove = maskMoveTable(SIDE_SLOTS, 8, PHASE2_MOVES);
  const rlMove = maskMoveTable(RL_SLOTS, 4, [.../* @__PURE__ */ new Set([...PHASE2_MOVES, ...PHASE3_MOVES])]);
  const rlTargets = /* @__PURE__ */ new Set([RL_SOLVED]);
  for (const rl of rlTargets)
    for (const m of PHASE3_MOVES) rlTargets.add(rlMove[rl * N_MOVES_4 + m]);
  const phase2Targets = [...rlTargets].map((rl) => (CT_TARGET * N_RL + rl) * 2);
  const phase2 = bfs(N_CT * N_RL * 2, phase2Targets, PHASE2_MOVES, (i, m) => {
    const parity2 = i & 1;
    const rest = i >>> 1;
    const ct = ctMove[Math.floor(rest / N_RL) * N_MOVES_4 + m];
    const rl = rlMove[rest % N_RL * N_MOVES_4 + m];
    return (ct * N_RL + rl) * 2 + (parity2 ^ WING_PARITY_FLIP[m]);
  });
  step("phase 2");
  const udMove = maskMoveTable(UD_SLOTS, 4, PHASE3_MOVES);
  const fbMove = maskMoveTable(FB_SLOTS, 4, PHASE3_MOVES);
  const pllFlip = Uint8Array.from(MOVES, (move, m) => {
    const corners = slotPermutations(move).corners;
    const cornerParity = corners === null ? 0 : parityOf(corners.cp);
    const low = PHASE3_LOW[m];
    return low.includes(-1) ? 0 : parityOf(low) ^ cornerParity;
  });
  const centres3 = bfs(
    N_RL * N_RL * N_RL * 2,
    [((UD_SOLVED * N_RL + FB_SOLVED) * N_RL + RL_SOLVED) * 2],
    PHASE3_MOVES,
    (i, m) => {
      const pll = i & 1;
      let rest = i >>> 1;
      const rl = rest % N_RL;
      rest = Math.floor(rest / N_RL);
      const fb = rest % N_RL;
      const ud = Math.floor(rest / N_RL);
      const ud1 = udMove[ud * N_MOVES_4 + m];
      const fb1 = fbMove[fb * N_MOVES_4 + m];
      const rl1 = rlMove[rl * N_MOVES_4 + m];
      return ((ud1 * N_RL + fb1) * N_RL + rl1) * 2 + (pll ^ pllFlip[m]);
    }
  );
  step("phase 3 centres");
  const tables = [phase1, ctMove, rlMove, phase2, udMove, fbMove, pllFlip, centres3];
  return {
    phase1,
    ctMove,
    rlMove,
    phase2,
    rlTargets,
    udMove,
    fbMove,
    pllFlip,
    centres3,
    bytes: tables.reduce((s, t) => s + t.byteLength, 0)
  };
}

// packages/solver-ts/src/four/reduction.ts
var RECOLOURINGS = [
  (face) => face,
  (face) => rotateFace(face, "F", 1),
  (face) => rotateFace(face, "U", 1)
];
function recolour(cube, map) {
  const stickers = cube4ToFacelets(cube).split("").map((c) => map(c)).join("");
  const parsed = parseFacelets4(stickers);
  if (!parsed.ok) throw new Error("Recolouring by a rotation produced an invalid cube");
  return parsed.value;
}
function maskOf2(slots, centres, match) {
  let mask = 0;
  slots.forEach((slot, bit) => {
    if (match(centres[slot])) mask |= 1 << bit;
  });
  return mask;
}
function parity(values) {
  const seen = new Array(values.length).fill(false);
  let p = 0;
  for (let i = 0; i < values.length; i++) {
    if (seen[i]) continue;
    let length = 0;
    for (let j = i; !seen[j]; j = values[j]) {
      seen[j] = true;
      length++;
    }
    p ^= length - 1 & 1;
  }
  return p;
}
var ALL_SLOTS2 = Array.from({ length: 24 }, (_, i) => i);
function edgePositions(wp) {
  const low = new Array(12).fill(-1);
  const high = new Array(12).fill(-1);
  for (let p = 0; p < 12; p++) {
    const a = wp[LOW_SLOT[p]] >> 1;
    const b = wp[HIGH_SLOT[p]] >> 1;
    if (low[a] !== -1 || high[b] !== -1) return null;
    low[a] = p;
    high[b] = p;
  }
  return { low, high };
}
function wingsReady(wp) {
  const positions = edgePositions(wp);
  if (positions === null) return false;
  const matching = new Array(12);
  positions.low.forEach((p, e) => matching[p] = positions.high[e]);
  if (parity(matching) !== 0) return false;
  let flips = 0;
  for (const slot of LOW_SLOT) if (wingFlipped(wp[slot], slot)) flips++;
  return flips % 2 === 0;
}
function replaySlots(start, perms, moves, length, buffers) {
  let [from, to] = buffers;
  from.set(start);
  for (let k = 0; k < length; k++) {
    const perm = perms[moves[k]];
    for (let i = 0; i < 24; i++) to[i] = from[perm[i]];
    [from, to] = [to, from];
  }
  return from;
}
function as3x3(reduced) {
  const stickers = cube4ToFacelets(reduced);
  const lines = [0, 1, 3];
  const facelets = Array.from({ length: 54 }, (_, i) => {
    const face = Math.floor(i / 9);
    return stickers.charAt(face * 16 + lines[Math.floor(i % 9 / 3)] * 4 + lines[i % 3]);
  }).join("");
  const parsed = parseFacelets(facelets);
  if (!parsed.ok) throw new Error(`The reduced cube is no 3\xD73\xD73: ${parsed.errors[0]?.code ?? ""}`);
  return parsed.value;
}
function createReductionSolver(tables, edgeTable, solve3) {
  const { phase1, ctMove, rlMove, phase2, udMove, fbMove, pllFlip, centres3 } = tables;
  const byteTarget = MOVES.map((move) => {
    const target = new Array(24);
    slotPermutations(move).centres.forEach((from, to) => target[from] = to);
    return [0, 1, 2].map(
      (b) => Uint32Array.from({ length: 256 }, (_, v) => {
        let out = 0;
        for (let j = 0; j < 8; j++) if (v >>> j & 1) out |= 1 << target[8 * b + j];
        return out;
      })
    );
  });
  const movePhase1 = (mask, m) => {
    const [b0, b1, b2] = byteTarget[m];
    return b0[mask & 255] | b1[mask >>> 8 & 255] | b2[mask >>> 16];
  };
  const phase2Index = (centres, wingParity) => {
    const ct = rankMask(
      maskOf2(SIDE_SLOTS, centres, (c) => c === 0 || c === 3),
      16
    );
    const rl = rankMask(
      maskOf2(RL_SLOTS, centres, (c) => c === R_COLOUR),
      8
    );
    return (ct * N_RL + rl) * 2 + wingParity;
  };
  const movePhase2 = (index2, m) => {
    const rest = index2 >>> 1;
    const ct = ctMove[Math.floor(rest / N_RL) * N_MOVES_4 + m];
    const rl = rlMove[rest % N_RL * N_MOVES_4 + m];
    return (ct * N_RL + rl) * 2 + (index2 & 1 ^ WING_PARITY_FLIP[m]);
  };
  const moveCentres = (index2, m) => {
    let rest = index2 >>> 1;
    const rl = rest % N_RL;
    rest = Math.floor(rest / N_RL);
    const fb = rest % N_RL;
    const ud = Math.floor(rest / N_RL);
    const moved = (udMove[ud * N_MOVES_4 + m] * N_RL + fbMove[fb * N_MOVES_4 + m]) * N_RL + rlMove[rl * N_MOVES_4 + m];
    return moved * 2 + (index2 & 1 ^ pllFlip[m]);
  };
  return function solve(input, options = {}) {
    const keep1 = options.phase1Candidates ?? 200;
    const keep2 = options.phase2Candidates ?? 100;
    const keep3 = options.phase3Candidates ?? 4;
    const finishTimeMs = options.finishTimeMs ?? 50;
    let cancelled = false;
    const stopped = () => {
      if (!cancelled && options.shouldStop?.() === true) cancelled = true;
      return cancelled;
    };
    let visited = 0;
    const pollStop = () => cancelled || options.shouldStop !== void 0 && (++visited & 4095) === 0 && stopped();
    const path = new Uint8Array(32);
    const buffers = [new Uint8Array(24), new Uint8Array(24)];
    const replay = (cube, moves) => applyLayerTurns4(
      cube,
      Array.from(moves, (m) => MOVES[m])
    );
    const firsts = [];
    for (const map of RECOLOURINGS) {
      const cube = recolour(input, map);
      const start = maskOf2(ALL_SLOTS2, cube.centres, (c) => c === R_COLOUR || c === L_COLOUR);
      const shortest = phase1[rankMask24(start)];
      const wingParity = parity(cube.wp);
      const search = (mask, togo, depth, last) => {
        if (pollStop()) return;
        if (togo === 0) {
          const centres = replaySlots(cube.centres, CENTRE_MOVES, path, depth, buffers);
          let p = wingParity;
          for (let k = 0; k < depth; k++) p ^= WING_PARITY_FLIP[path[k]];
          const bound = depth + phase2[phase2Index(centres, p)];
          firsts.push({ start: cube, moves: Array.from(path.subarray(0, depth)), bound });
          return;
        }
        for (const m of PHASE1_MOVES) {
          if (!canFollow(last, m)) continue;
          const next = movePhase1(mask, m);
          if (phase1[rankMask24(next)] >= togo) continue;
          path[depth] = m;
          search(next, togo - 1, depth + 1, m);
        }
      };
      for (let length = shortest; length <= shortest + 1; length++) search(start, length, 0, -1);
    }
    firsts.sort((a, b) => a.bound - b.bound);
    const phase1Kept = firsts.slice(0, keep1).map(({ start, moves, bound }) => ({
      cube: replay(start, moves),
      moves,
      lengths: [moves.length],
      bound
    }));
    const seconds = [];
    const lowest2 = phase1Kept[0]?.bound ?? 0;
    for (let total = lowest2; seconds.length < keep2 && total <= lowest2 + 8; total++) {
      for (const first of phase1Kept) {
        if (first.bound > total || seconds.length >= keep2 || stopped()) break;
        const length = total - first.moves.length;
        const search = (index3, togo, depth, last) => {
          if (pollStop()) return;
          if (seconds.length >= keep2) return;
          if (togo === 0) {
            if (!wingsReady(replaySlots(first.cube.wp, WING_MOVES, path, depth, buffers))) return;
            const after = replay(first.cube, path.subarray(0, depth));
            const moves = Array.from(path.subarray(0, depth));
            seconds.push({
              cube: after,
              moves: [...first.moves, ...moves],
              lengths: [...first.lengths, depth],
              bound: 0
            });
            return;
          }
          for (const m of PHASE2_MOVES) {
            if (!canFollow(last, m)) continue;
            const next = movePhase2(index3, m);
            if (phase2[next] >= togo) continue;
            path[depth] = m;
            search(next, togo - 1, depth + 1, m);
          }
        };
        const index2 = phase2Index(first.cube.centres, parity(first.cube.wp));
        if (phase2[index2] <= length) search(index2, length, 0, first.moves.at(-1) ?? -1);
      }
    }
    if (stopped() || seconds.length === 0) return { moves: void 0, phases: [] };
    const starts = seconds.map((candidate) => {
      const { cube } = candidate;
      const ud = rankMask(
        maskOf2(UD_SLOTS, cube.centres, (c) => c === 0),
        8
      );
      const fb = rankMask(
        maskOf2(FB_SLOTS, cube.centres, (c) => c === 2),
        8
      );
      const rl = rankMask(
        maskOf2(RL_SLOTS, cube.centres, (c) => c === R_COLOUR),
        8
      );
      const positions = edgePositions(cube.wp);
      if (positions === null) throw new Error("Phase 3 needs one wing of each edge in a low slot");
      const lowEdges = LOW_SLOT.map((slot) => cube.wp[slot] >> 1);
      const pll = parity(lowEdges) ^ parity(cube.cp);
      const edges = edgeState(positions.low, positions.high);
      const distance = edgeDistance(edgeTable, edges);
      const centres = ((ud * N_RL + fb) * N_RL + rl) * 2 + pll;
      const bound = Math.max(centres3[centres], distance);
      return { candidate, centres, edges, distance, bound };
    });
    const total3 = (s) => s.candidate.moves.length + s.bound;
    starts.sort((a, b) => total3(a) - total3(b));
    const centreStack = new Int32Array(32);
    const edgeStack = new Uint8Array(33 * 12);
    const distances = new Uint8Array(32);
    const search3 = (depth, togo, last) => {
      if (togo === 0) return true;
      if (stopped()) return false;
      const at2 = depth * 12;
      for (const m of PHASE3_MOVES) {
        if (!canFollow(last, m)) continue;
        const centres = moveCentres(centreStack[depth], m);
        if (centres3[centres] >= togo) continue;
        const index2 = edgeIndex(edgeTable, edgeStack, at2, m);
        const distance = nextEdgeDistance(edgeTable, index2, distances[depth]);
        if (distance >= togo) continue;
        moveEdges(edgeStack, at2, at2 + 12, m);
        centreStack[depth + 1] = centres;
        distances[depth + 1] = distance;
        path[depth] = m;
        if (search3(depth + 1, togo - 1, m)) return true;
      }
      return false;
    };
    const reductions = [];
    const lowest3 = starts.length === 0 ? 0 : total3(starts[0]);
    for (let total = lowest3; reductions.length < keep3 && total < lowest3 + 16; total++) {
      for (const start of starts) {
        const length = total - start.candidate.moves.length;
        if (start.bound > length) continue;
        centreStack[0] = start.centres;
        edgeStack.set(start.edges);
        distances[0] = start.distance;
        if (search3(0, length, start.candidate.moves.at(-1) ?? -1)) {
          const moves = Array.from(path.subarray(0, length));
          reductions.push({ candidate: start.candidate, moves });
          if (reductions.length >= keep3) break;
        }
        if (stopped()) return { moves: void 0, phases: [] };
      }
    }
    let best;
    for (const { candidate, moves } of reductions) {
      const reduced = replay(candidate.cube, moves);
      const finish = solve3(as3x3(reduced), {
        maxLength: 18,
        timeLimitMs: finishTimeMs,
        directions: 6,
        shouldStop: stopped
      }).moves;
      if (finish === void 0) return { moves: void 0, phases: [] };
      const solution = simplifyLayerTurns(
        [
          ...[...candidate.moves, ...moves].map((m) => MOVES[m]),
          ...finish.map(({ face, turns }) => ({ face, from: 1, to: 1, turns }))
        ],
        4
      );
      if (!isSolved4(applyLayerTurns4(input, solution))) {
        throw new Error("The 4\xD74\xD74 solution does not solve the cube");
      }
      if (best?.moves === void 0 || solution.length < best.moves.length) {
        best = { moves: solution, phases: [...candidate.lengths, moves.length, finish.length] };
      }
    }
    return best ?? { moves: void 0, phases: [] };
  };
}

// packages/solver-ts/src/coordinates.ts
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

// packages/solver-ts/src/tables.ts
var N_MOVES = 18;
var PHASE2_MOVES2 = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];
var ALL_MOVES = Array.from({ length: N_MOVES }, (_, m) => m);
var UNVISITED2 = 255;
function moveCorners(cp, co, move, outCp, outCo) {
  const m = MOVE_CUBES[move];
  for (let i = 0; i < 8; i++) {
    outCp[i] = cp[m.cp[i]];
    outCo[i] = (co[m.cp[i]] + m.co[i]) % 3;
  }
}
function moveEdges2(ep, eo, move, outEp, outEo) {
  const m = MOVE_CUBES[move];
  for (let i = 0; i < 12; i++) {
    outEp[i] = ep[m.ep[i]];
    outEo[i] = (eo[m.ep[i]] + m.eo[i]) % 2;
  }
}
function moveTable(size, moves, pieceCount, set, get) {
  const apply = pieceCount === 8 ? moveCorners : moveEdges2;
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
      apply(perm, ori, m, nextPerm, nextOri);
      table[c * N_MOVES + m] = get(nextPerm, nextOri);
    }
  }
  return table;
}
var cornerMoveTable = (size, set, get) => moveTable(size, ALL_MOVES, 8, set, get);
var edgeMoveTable = (size, set, get, moves = ALL_MOVES) => moveTable(size, moves, 12, set, get);
function pruningTable(sizeA, moveA, sizeB, moveB, moves) {
  const total = sizeA * sizeB;
  const depth = new Uint8Array(total).fill(UNVISITED2);
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
        const index2 = a * sizeB + b;
        const rowB = b * N_MOVES;
        if (backward) {
          if (depth[index2] !== UNVISITED2) continue;
          for (let i = 0; i < moveCount; i++) {
            const m = moveList[i];
            if (depth[moveA[rowA + m] * sizeB + moveB[rowB + m]] === level) {
              depth[index2] = next;
              found++;
              break;
            }
          }
        } else {
          if (depth[index2] !== level) continue;
          for (let i = 0; i < moveCount; i++) {
            const m = moveList[i];
            const target = moveA[rowA + m] * sizeB + moveB[rowB + m];
            if (depth[target] === UNVISITED2) {
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
var TWO_PHASE_TABLE_COUNT = 14;
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
    () => edgeMoveTable(N_UD_EDGE_PERM, setUDEdgePerm, getUDEdgePerm, PHASE2_MOVES2)
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
    () => pruningTable(N_CORNER_PERM, cornerPermMove, N_SLICE_PERM, sliceSortedMove, PHASE2_MOVES2)
  );
  const udEdgeSlicePrune = step(
    "udEdgeSlicePrune",
    () => pruningTable(N_UD_EDGE_PERM, udEdgePermMove, N_SLICE_PERM, sliceSortedMove, PHASE2_MOVES2)
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

// packages/solver-ts/src/two-phase.ts
var PHASE1_DEPTH_LIMIT = 20;
var PHASE2_MOVE_LIMIT = 10;
var CHECK_INTERVAL = 1024;
var IS_PHASE2_MOVE = new Uint8Array(N_MOVES);
for (const m of PHASE2_MOVES2) IS_PHASE2_MOVE[m] = 1;
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
      for (const m of PHASE2_MOVES2) {
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
      if (++phase1Nodes % CHECK_INTERVAL === 0) checkStop();
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
  TWO_PHASE_TABLE_COUNT,
  buildEdgePairing,
  buildReductionTables,
  buildTwoPhaseTables,
  createReductionSolver,
  createTwoPhaseSolver,
  parseFacelets4
};
