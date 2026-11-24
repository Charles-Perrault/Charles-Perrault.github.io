import { faces, layerAt, Octahedron, scrambleMoves, sizeIsValid } from './puzzle.mjs?v=2';
import { add, cross, dot, FaceRenderer, rotate, scale } from './renderer.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle'), controls = document.querySelector('.controls');
const selectors = [...controls.querySelectorAll('button, input, select')]
  .filter(element => element.id !== 'reset-view' && element.id !== 'stop-solve');
const presets = [...document.querySelectorAll('[data-size]')];
const sizeInput = get('size'), faceInput = get('face'), sliceInput = get('slice');
const status = get('status'), moveCount = get('moves');
const solveButton = get('solve'), stopButton = get('stop-solve'), outerScramble = get('outer-scramble');
const scrambleButton = get('scramble');
const speedInput = get('turn-speed');
let renderer, puzzle, moves = 0, working = false;
let solverWorker, solving = false, scrambling = false, planningSolve = false, solveFrame = 0;
let yaw = 0.62, pitch = 0.48, zoom = 1;
let drag;
const pointers = new Map();
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
const distance = ([x, y], [u, v]) => Math.hypot(x - u, y - v);

for (const [id, { name }] of faces.entries()) faceInput.add(new Option(name, id));

function camera() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const mobile = width <= 700;
  const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = cross(forward, right);
  const bottomOfNav = document.querySelector('.puzzle-switcher').getBoundingClientRect().bottom;
  const room = mobile ? Math.max(64, controls.offsetTop - bottomOfNav) : height;
  const center = mobile ? [width * 0.5, bottomOfNav + room * 0.5] : [width * 0.42, height * 0.5];
  const lens = Math.min(width * (mobile ? 1.02 : 0.52), room * (mobile ? 1.5 : 0.88)) * zoom * 1.58;
  const eye = scale(forward, 4);
  const project = point => {
    const magnification = lens / (4 - dot(point, forward));
    return [center[0] + dot(point, right) * magnification, center[1] - dot(point, up) * magnification];
  };
  return { width, height, forward, right, up, center, lens, eye, project };
}

function draw(move, fraction) {
  renderer?.draw(camera(), move, fraction);
}

function lock(active) {
  working = active;
  for (const element of selectors) element.disabled = active;
  solveButton.disabled = active || !puzzle || puzzle.size < 3;
  sliceInput.disabled = active || puzzle?.depth === 1;
  stopButton.disabled = !solving && !scrambling;
}

function updateStatus() {
  status.textContent = puzzle.solved ? 'Solved' : 'Scrambled';
  moveCount.textContent = `${moves.toLocaleString()} ${moves === 1 ? 'move' : 'moves'}`;
}

function resize(size, share = true) {
  if (!renderer || working) return;
  if (!sizeIsValid(size)) {
    status.textContent = 'Enter a whole size of at least 2.';
    return;
  }
  if (size > renderer.maxSize) {
    status.textContent = `This device supports textures up to ${renderer.maxSize.toLocaleString()} pixels wide.`;
    return;
  }
  if (puzzle?.size !== size) {
    try {
      const next = new Octahedron(size);
      renderer.setPuzzle(next);
      puzzle = next;
      moves = 0;
    } catch (error) {
      status.textContent = error.message;
      return;
    }
  }
  sizeInput.value = size;
  sliceInput.max = puzzle.depth;
  sliceInput.value = clamp(Number(sliceInput.value) || 1, 1, puzzle.depth);
  sliceInput.disabled = puzzle.depth === 1;
  solveButton.disabled = size < 3;
  outerScramble.hidden = size < 4;
  scrambleButton.textContent = size > 3 ? 'Scramble all slices' : 'Scramble';
  get('solver-credit').firstChild.textContent = size > 3 ? 'Limited inner-slice support · ' : '3-layer solver · ';
  get('name').textContent = size === 2 ? 'Skewb Diamond' : size === 3 ? 'Face-Turning Octahedron' : `${size} × ${size} FTO`;
  for (const preset of presets) preset.setAttribute('aria-pressed', String(Number(preset.dataset.size) === size));
  if (share) history.replaceState(null, '', `#layers=${size}`);
  updateStatus();
  draw();
}

function playTurns(sequence, solution = false, scramble = false) {
  if (!puzzle || (working && !solution)) return;
  let index = 0;
  scrambling = scramble;
  lock(true);
  let start = performance.now();
  const describe = () => {
    const { axis, layer } = sequence[index];
    const name = faces[axis].name;
    status.textContent = solution || scramble ? `Move ${index + 1}/${sequence.length}` :
      layer === 1 ? `Turning ${name}` : `Turning ${name} · Slice ${layer}`;
  };
  const speed = speedInput.valueAsNumber;
  const duration = Number.isFinite(speed) && speed > 0 ? 1000 / speed : 100;
  describe();
  function animate(now) {
    const move = sequence[index];
    const fraction = speed > 100_000 ? 1 : clamp((now - start) / duration, 0, 1);
    if (fraction < 1) {
      draw(move, fraction ** 2 * (3 - 2 * fraction));
      solveFrame = requestAnimationFrame(animate);
      return;
    }
    puzzle.turn(move.axis, move.layer, move.direction);
    moves++;
    renderer.sync(puzzle);
    index++;
    if (index < sequence.length) {
      start = now;
      describe();
      solveFrame = requestAnimationFrame(animate);
      return;
    }
    solving = false;
    scrambling = false;
    lock(false);
    updateStatus();
    draw();
  }
  solveFrame = requestAnimationFrame(animate);
}

const play = move => playTurns([move]);

function solve() {
  if (!puzzle || puzzle.size < 3 || working || puzzle.solved) return;
  const worker = solverWorker ??= new Worker(new URL('./solve-worker.mjs?v=2', import.meta.url), { type: 'module' });
  solving = true;
  planningSolve = true;
  lock(true);
  status.textContent = 'Preparing solve…';
  const fail = message => {
    if (solverWorker !== worker) return;
    planningSolve = false;
    solving = false;
    lock(false);
    status.textContent = message;
  };
  worker.onmessage = ({ data }) => {
    if (solverWorker !== worker || !solving) return;
    if (data.status) status.textContent = data.status;
    else if (data.error) fail(data.error);
    else if (data.moves?.length) {
      planningSolve = false;
      playTurns(data.moves, true);
    }
    else {
      planningSolve = false;
      solving = false;
      lock(false);
      updateStatus();
    }
  };
  worker.onerror = () => {
    fail('Could not start the FTO solver. Check your connection and try again.');
    worker.terminate();
    if (solverWorker === worker) solverWorker = null;
  };
  const state = puzzle.state.slice();
  worker.postMessage({ size: puzzle.size, state }, [state.buffer]);
}

function stopSolve() {
  if (!solving && !scrambling) return;
  cancelAnimationFrame(solveFrame);
  if (planningSolve) {
    solverWorker?.terminate();
    solverWorker = null;
  }
  planningSolve = false;
  const message = scrambling ? 'Scramble stopped' : 'Solve stopped';
  solving = false;
  scrambling = false;
  lock(false);
  updateStatus();
  status.textContent = message;
  draw();
}

function scramble(outerOnly = false, instant = false) {
  if (!puzzle || working) return;
  if (!instant) {
    playTurns([...scrambleMoves(puzzle.size, Math.random, outerOnly)], false, true);
    return;
  }
  lock(true);
  status.textContent = 'Scrambling…';
  for (const move of scrambleMoves(puzzle.size, Math.random, outerOnly)) {
    puzzle.turn(move.axis, move.layer, move.direction);
    moves++;
  }
  renderer.sync(puzzle);
  lock(false);
  sliceInput.disabled = puzzle.depth === 1;
  updateStatus();
  draw();
}

function hit([x, y], view) {
  const { eye, forward, right, up, center, lens } = view;
  const ray = add(scale(forward, -1), add(scale(right, (x - center[0]) / lens), scale(up, (center[1] - y) / lens)));
  for (const [axis, { signs }] of faces.entries()) {
    const distance = dot(eye, signs);
    const heading = dot(ray, signs);
    if (distance <= 1 || heading >= 0) continue;
    const point = add(eye, scale(ray, (1 - distance) / heading));
    if (point.every((coordinate, i) => coordinate * signs[i] >= -1e-8)) return { axis, point };
  }
  return null;
}

function interpretDrag(tile, from, to, view) {
  const motion = [to[0] - from[0], to[1] - from[1]];
  let alignment = 0, best = { axis: tile.axis, layer: 1, direction: 1 };
  for (let axis = 0; axis < faces.length; axis++) {
    const layer = layerAt(puzzle.size, axis, tile.point);
    if (layer < 1 || layer > puzzle.depth) continue;
    const normal = faces[axis].normal;
    const a = view.project(rotate(tile.point, normal, -0.015));
    const b = view.project(rotate(tile.point, normal, 0.015));
    const x = a[0] - b[0], y = a[1] - b[1];
    const length = Math.hypot(x, y);
    if (length < 0.02) continue;
    const score = (motion[0] * x + motion[1] * y) / length;
    if (Math.abs(score) <= alignment) continue;
    alignment = Math.abs(score);
    best = { axis, layer, direction: score < 0 ? -1 : 1 };
  }
  return best;
}

function manual(direction) {
  if (puzzle && sliceInput.reportValidity()) play({ axis: Number(faceInput.value), layer: Number(sliceInput.value), direction });
}

function zoomBy(factor) {
  zoom = clamp(zoom * factor, 0.45, 64);
  if (!working) draw();
}

function position(event) {
  const { left, top } = canvas.getBoundingClientRect();
  return [event.clientX - left, event.clientY - top];
}

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (!puzzle || (event.button !== 0 && event.button !== 2)) return;
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
  const point = position(event), view = camera();
  pointers.set(event.pointerId, point);
  drag = pointers.size === 1
    ? { point, id: event.pointerId, view, tile: !working && event.button === 0 ? hit(point, view) : null }
    : null;
});
canvas.addEventListener('pointermove', event => {
  const old = pointers.get(event.pointerId);
  if (!old) return;
  const point = position(event);
  const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
  pointers.set(event.pointerId, point);
  if (other) zoomBy(distance(point, other) / Math.max(1, distance(old, other)));
  else if (!drag?.tile) {
    yaw -= (point[0] - old[0]) * 0.008;
    pitch = clamp(pitch + (point[1] - old[1]) * 0.008, -1.55, 1.55);
    if (!working) draw();
  }
});
for (const eventType of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventType, event => {
    pointers.delete(event.pointerId);
    if (drag?.id !== event.pointerId) return;
    const { point, tile, view } = drag;
    drag = null;
    if (!tile || working || event.type !== 'pointerup') return;
    const to = position(event);
    if (distance(point, to) < 8) {
      faceInput.value = tile.axis;
      return;
    }
    const move = interpretDrag(tile, point, to, view);
    faceInput.value = move.axis;
    sliceInput.value = move.layer;
    play(move);
  });
}
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoomBy(Math.exp(-event.deltaY * 0.0017));
}, { passive: false });
canvas.addEventListener('keydown', event => {
  const { key } = event;
  if (key === '[' || key === ']') manual(key === ']' ? 1 : -1);
  else if (key === '+' || key === '=') zoomBy(1.25);
  else if (key === '-') zoomBy(0.8);
  else if (key === 'ArrowLeft') yaw += 0.14;
  else if (key === 'ArrowRight') yaw -= 0.14;
  else if (key === 'ArrowUp') pitch = clamp(pitch + 0.14, -1.55, 1.55);
  else if (key === 'ArrowDown') pitch = clamp(pitch - 0.14, -1.55, 1.55);
  else return;
  event.preventDefault();
  if (!working) draw();
});

get('resize').onsubmit = event => {
  event.preventDefault();
  resize(sizeInput.valueAsNumber);
};
for (const preset of presets) preset.onclick = () => resize(Number(preset.dataset.size));
get('left').onclick = () => manual(-1);
get('right').onclick = () => manual(1);
scrambleButton.onclick = () => scramble();
get('instant-scramble').onclick = () => scramble(false, true);
outerScramble.onclick = () => scramble(true);
solveButton.onclick = solve;
stopButton.onclick = stopSolve;
get('reset').onclick = () => {
  if (!puzzle || working) return;
  puzzle.reset();
  moves = 0;
  renderer.sync(puzzle);
  updateStatus();
  draw();
};
get('reset-view').onclick = () => {
  yaw = 0.62;
  pitch = 0.48;
  zoom = 1;
  if (!working) draw();
};

try {
  renderer = new FaceRenderer(canvas);
  const fromHash = () => {
    const value = new URLSearchParams(location.hash.slice(1)).get('layers');
    if (!puzzle) resize(3, false);
    if (value !== null && /^\d+$/.test(value)) resize(Number(value), false);
  };
  fromHash();
  addEventListener('hashchange', fromHash);
  const observer = new ResizeObserver(() => { if (!working) draw(); });
  observer.observe(canvas);
  observer.observe(controls);
} catch (error) {
  lock(true);
  status.textContent = error.message;
}
