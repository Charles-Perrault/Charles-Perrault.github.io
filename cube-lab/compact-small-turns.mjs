function compactRun(axis, angles) {
  const endpoints = [];
  for (let layer = 0; layer <= angles.length; layer++) {
    const delta = ((angles[layer] ?? 0) - (angles[layer - 1] ?? 0)) & 3;
    if (delta) endpoints.push({ layer, delta });
  }
  // Any disjoint group of endpoints whose angles sum to zero can be built
  // with one interval from each endpoint to that group's last endpoint.
  const count = endpoints.length;
  const limit = 1 << count;
  const sums = new Uint8Array(limit);
  const groups = new Uint8Array(limit);
  const widths = new Uint16Array(limit);
  const choice = new Uint16Array(limit);
  for (let mask = 1; mask < limit; mask++) {
    const first = mask & -mask;
    sums[mask] = (sums[mask ^ first] + endpoints[31 - Math.clz32(first)].delta) & 3;
    if (sums[mask]) continue;
    for (let part = mask; part; part = (part - 1) & mask) {
      if (!(part & first) || sums[part]) continue;
      const value = 1 + groups[mask ^ part];
      const width = widths[mask ^ part] + endpoints[31 - Math.clz32(part)].layer - endpoints[31 - Math.clz32(first)].layer;
      if (value < groups[mask] || (value === groups[mask] && width >= widths[mask])) continue;
      groups[mask] = value;
      widths[mask] = width;
      choice[mask] = part;
    }
  }
  const moves = [];
  for (let mask = limit - 1; mask; mask ^= choice[mask]) {
    const group = choice[mask];
    const last = 31 - Math.clz32(group);
    let start = -1;
    let angle = 0;
    for (let i = 0; i <= last; i++) {
      if (!(group & (1 << i))) continue;
      const { layer, delta } = endpoints[i];
      if (angle) {
        const turns = angle === 3 ? -1 : angle;
        const endLayer = layer - 1;
        moves.push(start === endLayer ? { axis, layer: start, turns } : { axis, layer: start, endLayer, turns });
      }
      angle = (angle + delta) & 3;
      start = layer;
    }
  }
  return moves;
}

export function compactSmallTurns(moves, size) {
  if (size < 4 || size > 7) return moves;
  const runs = [];
  for (const { axis, layer, endLayer = layer, turns } of moves) {
    let run = runs.at(-1);
    if (run?.axis !== axis) {
      run = { axis, angles: new Uint8Array(size) };
      runs.push(run);
    }
    for (let slice = layer; slice <= endLayer; slice++) run.angles[slice] = (run.angles[slice] + turns) & 3;
    if (!run.angles.some(Boolean)) runs.pop();
  }
  return runs.flatMap(({ axis, angles }) => compactRun(axis, angles));
}
