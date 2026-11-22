import { Megaminx, stickers, faces, colors, add, cross, dot, scale, rotate, step, scramble } from './puzzle.mjs';
import { LayeredMinx, layeredScramble, maxLayers, tileInLayer } from './layered-minx.mjs?v=2';
import { FaceRenderer } from './face-renderer.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle');
const controls = document.querySelector('.controls');
const gl = canvas.getContext('webgl2');
const renderer = gl ? new FaceRenderer(gl) : null;
const context = renderer ? null : canvas.getContext('2d');
let puzzle = new Megaminx(), size = 3;
const faceSelect = get('face'), sliceSelect = get('slice'), sizeInput = get('layers');
const speedInput = get('speed'), progress = get('turn-progress');
const sizeButtons = [...document.querySelectorAll('.presets button')];
const speedFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
colors.forEach(([name], face) => faceSelect.add(new Option(name, face)));
const pointers = new Map();
let yaw = 0.59, pitch = 0.53, zoom = 1, selected = 0;
let painted = [], gesture, playback, solverWorker, planning = false, frame = 0, total = 0;
let stateDirty = false, rate = speedInput.valueAsNumber;
const busy = () => Boolean(playback || planning);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const names = ['Kilominx', 'Megaminx', 'Master Kilominx', 'Gigaminx', 'Elite Kilominx', 'Teraminx', 'Royal Kilominx', 'Petaminx'];
const selectedLayer = () => Number(sliceSelect.value) || 1;
const applyTurn = ({ face, direction, layer }) => {
  puzzle.turn(face, direction, layer);
  stateDirty = true;
};
const turnSelected = direction => play([{ face: selected, direction, layer: selectedLayer() }]);

function path(points) {
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath();
}

function camera() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const mobile = width <= 700;
  const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = cross(forward, right);
  const distance = 5;
  const top = 92;
  const room = mobile ? Math.max(44, controls.offsetTop - top) : height;
  const lens = Math.min(width * (mobile ? 0.94 : 0.54), room * (mobile ? 1.05 : 0.76)) * zoom * 1.68;
  const center = [width * (mobile ? 0.5 : 0.43), mobile ? top + room / 2 : height / 2];
  const project = v => {
    const magnification = lens / (distance - dot(v, forward));
    return [center[0] + dot(v, right) * magnification, center[1] - dot(v, up) * magnification];
  };
  const eye = scale(forward, distance);
  const onFace = ([x, y], normal) => {
    const ray = add(scale(forward, -1), add(scale(right, (x - center[0]) / lens), scale(up, (center[1] - y) / lens)));
    return add(eye, scale(ray, (1 - dot(eye, normal)) / dot(ray, normal)));
  };
  return { width, height, forward, right, up, center, lens, eye, project, onFace };
}

function dragTurn(tile, start, end) {
  const { project, onFace } = camera();
  const sticker = (puzzle.stickers ?? stickers)[tile.id];
  const point = onFace(start, sticker.normal);
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const distance = Math.hypot(dx, dy);
  let best = { face: tile.face, layer: 1, direction: dx || dy };
  let score = 0;
  const axes = [tile.face, ...faces.flatMap((_, axis) => axis === tile.face ? [] : [axis])];
  for (const axis of axes) {
    const layer = sticker.bands?.[axis] ?? Number(sticker.layerFaces.includes(axis));
    if (!layer) continue;
    const ahead = project(rotate(point, faces[axis], -0.025));
    const behind = project(rotate(point, faces[axis], 0.025));
    const x = ahead[0] - behind[0], y = ahead[1] - behind[1];
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.02) continue;
    const alignment = (x * dx + y * dy) / (magnitude * distance);
    if (Math.abs(alignment) <= score + 0.018) continue;
    score = Math.abs(alignment);
    best = { face: axis, layer, direction: alignment };
  }
  return { ...best, direction: best.direction < 0 ? -1 : 1 };
}

function draw(move, fraction = 0) {
  const view = camera();
  const { width, height, forward, eye, project } = view;
  const density = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
  }
  const angle = move ? -step * move.direction * fraction : 0;
  if (renderer) {
    if (!renderer.images) return;
    if (stateDirty) renderer.sync(puzzle.state);
    stateDirty = false;
    renderer.draw(view, move, angle);
    return;
  }
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  const tiles = puzzle.stickers ?? stickers;
  painted = [];
  for (let id = 0; id < tiles.length; id++) {
    const tile = tiles[id];
    const transform = angle && tileInLayer(tile, move.face, move.layer ?? 1)
      ? v => rotate(v, faces[move.face], angle) : v => v;
    const normal = transform(tile.normal), point = transform(tile.point);
    if (dot(normal, add(eye, scale(point, -1))) <= 0) continue;
    painted.push({
      face: tile.face, id, depth: dot(point, forward), polygon: tile.polygon.map(v => project(transform(v))),
      inset: tile.inset.map(v => project(transform(v))), light: 0.08 + 0.24 * (1 - Math.max(0, dot(normal, [-0.2, 0.59, 0.78]))),
    });
  }
  if (angle) painted.sort((a, b) => a.depth - b.depth);
  for (const tile of painted) {
    path(tile.polygon);
    context.fillStyle = '#080c12';
    context.strokeStyle = '#080c12';
    context.lineWidth = 0.7;
    context.fill();
    if (size <= 12) context.stroke();
    path(tile.inset);
    context.fillStyle = colors[puzzle.state[tile.id]][1];
    context.fill();
    context.fillStyle = `rgba(4,12,23,${tile.light})`;
    context.fill();
  }
}

function select(face) {
  selected = face;
  faceSelect.value = face;
  get('swatch').style.background = colors[face][1];
}

function updateStatus(message) {
  get('state').textContent = message ?? (puzzle.solved ? 'Solved' : 'Scrambled');
  get('applied').textContent = `${total.toLocaleString()} ${total === 1 ? 'move' : 'moves'}`;
}

function lock(active) {
  for (const id of ['instant', 'animate', 'left', 'right', 'apply-size', 'layers', 'slice']) get(id).disabled = active;
  for (const button of sizeButtons) button.disabled = active;
  get('solve').disabled = active;
  get('stop').disabled = !active;
}

function stop(message) {
  cancelAnimationFrame(frame);
  playback = null;
  if (planning) {
    solverWorker.terminate();
    solverWorker = undefined;
    planning = false;
  }
  lock(false);
  progress.hidden = true;
  updateStatus(message);
  draw();
}

function animate(now) {
  const work = playback;
  if (!work) return;
  const { moves } = work;
  work.credit = Math.min(moves.length - work.index, work.credit + clamp(now - work.last, 0, 100) * rate / 1000);
  work.last = now;
  const deadline = performance.now() + 7;
  while (work.credit >= 1 && work.index < moves.length) {
    const move = moves[work.index++];
    applyTurn(move);
    work.credit--;
    total++;
    if (performance.now() >= deadline) {
      work.credit = Math.min(work.credit, 1);
      break;
    }
  }
  if (work.index === moves.length) {
    stop();
    return;
  }
  const stage = moves[work.index].stage;
  if (stage && stage !== work.stage) {
    work.stage = stage;
    updateStatus(stage);
  }
  progress.value = work.index + work.credit;
  get('applied').textContent = `${total.toLocaleString()} ${total === 1 ? 'move' : 'moves'}`;
  if (rate > 100_000) draw();
  else draw(moves[work.index], work.credit);
  frame = requestAnimationFrame(animate);
}

function play(moves) {
  if (busy() || !moves.length) return;
  playback = { moves, index: 0, credit: 0, last: performance.now(), stage: moves[0].stage };
  progress.max = moves.length;
  progress.value = 0;
  progress.hidden = false;
  lock(true);
  const { face, layer, stage } = moves[0];
  const slice = layer > 1 ? ` · Layer ${layer}` : '';
  updateStatus(stage ?? (moves.length === 1 ? `Turning ${colors[face][0]}${slice}` : 'Scrambling'));
  frame = requestAnimationFrame(animate);
}

function scramblePuzzle(animated) {
  if (busy()) return;
  const count = 20 * size;
  const moves = size === 3 ? scramble(count) : layeredScramble(count, puzzle.depth);
  if (animated) play(moves);
  else {
    for (const move of moves) applyTurn(move);
    total += moves.length;
    updateStatus();
    draw();
  }
}

function solve() {
  if (busy() || puzzle.solved) return;
  const worker = solverWorker ??= new Worker(new URL('./solve-worker.mjs', import.meta.url), { type: 'module' });
  planning = true;
  lock(true);
  progress.removeAttribute('value');
  progress.hidden = false;
  updateStatus('Planning solution…');
  worker.onmessage = ({ data }) => {
    if (!planning || solverWorker !== worker) return;
    if (data.stage) {
      updateStatus(`Planning · ${data.stage}`);
      return;
    }
    if (data.error) {
      stop(data.error);
      return;
    }
    planning = false;
    const moves = data.stages.flatMap(({ name, moves }) => moves.map(move => ({ ...move, stage: name })));
    if (moves.length) play(moves);
    else stop();
  };
  worker.onerror = () => {
    if (solverWorker === worker) stop('Could not load the solver');
  };
  worker.postMessage({ size, state: puzzle.state });
}

function hit(point) {
  if (renderer) return renderer.hit(point, camera());
  // isPointInPath uses backing-store coordinates even though paths use CSS coordinates.
  const ratio = context.getTransform().a;
  for (let i = painted.length - 1; i >= 0; i--) {
    path(painted[i].polygon);
    if (context.isPointInPath(point[0] * ratio, point[1] * ratio)) return painted[i];
  }
  return null;
}
function position(event) {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const refresh = () => { if (!playback) draw(); };

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  const point = position(event);
  pointers.set(event.pointerId, point);
  gesture = pointers.size === 1
    ? { id: event.pointerId, point, tile: !busy() && event.button === 0 ? hit(point) : null }
    : null;
});
canvas.addEventListener('pointermove', event => {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  const point = position(event);
  const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
  pointers.set(event.pointerId, point);
  if (other) {
    zoom = clamp(zoom * distance(point, other) / Math.max(1, distance(previous, other)), 0.48, 3);
  } else if (gesture?.tile == null) {
    yaw -= (point[0] - previous[0]) * 0.008;
    pitch = clamp(pitch + (point[1] - previous[1]) * 0.008, -1.55, 1.55);
  }
  refresh();
});

function release(event) {
  pointers.delete(event.pointerId);
  if (gesture?.id !== event.pointerId) return;
  const { tile, point } = gesture;
  gesture = null;
  if (event.type !== 'pointerup' || !tile || busy()) return;
  const end = position(event);
  if (distance(point, end) < 8) { select(tile.face); return; }
  const move = dragTurn(tile, point, end);
  select(move.face);
  sliceSelect.value = move.layer;
  play([move]);
}
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = clamp(zoom * Math.exp(-event.deltaY * 0.0017), 0.48, 3);
  refresh();
}, { passive: false });
canvas.addEventListener('keydown', event => {
  if (event.key === '[' || event.key === ']') turnSelected(event.key === ']' ? 1 : -1);
  else if (event.key === 'ArrowLeft') yaw += 0.14;
  else if (event.key === 'ArrowRight') yaw -= 0.14;
  else if (event.key === 'ArrowUp') pitch = clamp(pitch + 0.14, -1.55, 1.55);
  else if (event.key === 'ArrowDown') pitch = clamp(pitch - 0.14, -1.55, 1.55);
  else return;
  event.preventDefault();
  refresh();
});
get('view').onclick = () => { yaw = 0.59; pitch = 0.53; zoom = 1; refresh(); };
get('instant').onclick = () => scramblePuzzle(false);
get('animate').onclick = () => scramblePuzzle(true);
get('solve').onclick = solve;
get('stop').onclick = () => stop('Stopped');
get('reset').onclick = () => { puzzle.reset(); stateDirty = true; total = 0; stop(); };
get('left').onclick = () => turnSelected(-1);
get('right').onclick = () => turnSelected(1);
faceSelect.onchange = () => select(Number(faceSelect.value));

function resize(value, updateHash = true) {
  if (busy() || !Number.isInteger(value) || value < 2 || value > maxLayers) return;
  if (value !== size) {
    puzzle = value === 3 ? new Megaminx() : new LayeredMinx(value);
    size = value;
    total = 0;
  }
  if (renderer && (size !== renderer.size || !renderer.images)) {
    renderer.setPuzzle(puzzle, size);
    renderer.size = size;
    stateDirty = false;
  }
  const name = names[size - 2] ?? `${size}-layer Minx`;
  get('puzzle-name').textContent = name;
  document.title = `${name} · Cube Lab`;
  canvas.setAttribute('aria-label', `Interactive ${name}. Drag a sticker to turn or drag the background to orbit. Use brackets to turn the selected face and layer.`);
  sizeInput.value = size;
  get('size-link').href = `#layers=${size}`;
  if (updateHash) history.replaceState(null, '', get('size-link').href);
  for (const button of sizeButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.size) === size));
  get('count').textContent = `${(20 * size).toLocaleString()} moves`;
  get('solve').textContent = size === 3 ? 'Solve Megaminx' : 'Solve puzzle';
  get('slice-picker').hidden = size < 4;
  sliceSelect.replaceChildren(...Array.from({ length: Math.floor(size / 2) }, (_, i) =>
    new Option(i === 0 ? '1 · Outer face' : `${i + 1} · Inner slice`, i + 1)));
  lock(false);
  updateStatus();
  draw();
}

get('resize').onsubmit = event => {
  event.preventDefault();
  if (!sizeInput.reportValidity()) return;
  resize(sizeInput.valueAsNumber);
};
for (const button of sizeButtons) button.onclick = () => resize(Number(button.dataset.size));
get('size-link').onclick = async event => {
  event.preventDefault();
  const link = event.currentTarget.href;
  try {
    await navigator.clipboard.writeText(link);
    updateStatus('Size link copied');
  } catch {
    history.replaceState(null, '', link);
    updateStatus('Size link is in the address bar');
  }
};
speedInput.oninput = () => {
  const next = speedInput.valueAsNumber;
  if (speedInput.validity.valid && Number.isFinite(next) && next > 0) {
    rate = next;
    const formatted = next < 0.01 || next >= 1e7 ? next.toExponential(2) : speedFormat.format(next);
    get('speed-rate').textContent = `${formatted} ${next === 1 ? 'turn' : 'turns'}/sec`;
  } else get('speed-rate').textContent = 'Enter a positive speed';
};
function useHash(initial = false) {
  const value = new URLSearchParams(location.hash.slice(1)).get('layers') ?? '3';
  const requested = /^\d+$/.test(value) ? Number(value) : NaN;
  if (requested >= 2 && requested <= maxLayers) {
    if (busy() && requested !== size) stop();
    resize(requested, false);
  } else if (initial) resize(3, false);
}
window.addEventListener('hashchange', () => useHash());
const observer = new ResizeObserver(refresh);
observer.observe(canvas);
observer.observe(controls);
select(0);
useHash(true);
