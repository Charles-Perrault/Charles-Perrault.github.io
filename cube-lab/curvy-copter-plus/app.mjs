import { add, cross, dot, scale, edges, sides, tiles, solved, turn, replay, isSolved } from './puzzle.mjs';
import { scramble } from './solver.mjs';
import { applyPose, cubePoses, cubeSlots, jumbleMoves, jumbleScramble, optionsAt, partOf, remapColors, transform } from './jumbling.mjs';
import { colorJumble } from './mixed-petals.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle'), ctx = canvas.getContext('2d');
const status = get('status'), list = get('moves'), edgeInput = get('edge');
const palette = get('palette'), angleInput = get('angle');
const names = ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Orange'];
let state = solved.slice(), yaw = 0.64, pitch = 0.47, zoom = 1, ratio = 1;
let playback, worker, planning = false, frame, gesture, painted = [], painting = false, color = 0;
let poses = null, options = [];
const flat = cubePoses();
const flips = edges.map((_, edge) => optionsAt(flat, edge).find(move => move.target === Math.PI));
const livePoses = () => poses ?? flat;
const busy = () => Boolean(playback || planning);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

edges.forEach(({ name }, index) => edgeInput.add(new Option(name, index)));
sides.forEach((side, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.style.background = side.color;
  button.title = names[i];
  button.setAttribute('aria-label', names[i]);
  button.setAttribute('aria-pressed', i === 0);
  button.onclick = () => {
    color = i;
    [...palette.children].forEach((item, index) => item.setAttribute('aria-pressed', i === index));
  };
  palette.append(button);
});
const geometry = tiles.map(tile => {
  const center = scale(tile.polygon.reduce(add), 1 / tile.polygon.length);
  return { center, inset: tile.polygon.map(v => add(scale(v, 0.85), scale(center, 0.15))) };
});

function path(points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function draw(move, fraction = 0) {
  const width = canvas.clientWidth, height = canvas.clientHeight, mobile = width <= 700;
  ratio = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const eye = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = cross(eye, right);
  const size = Math.min(mobile ? width : width - 270, height * (mobile ? 0.55 : 0.93)) * 0.95 * zoom;
  const project = point => {
    const factor = size / (5 - dot(point, eye));
    return [width * (mobile ? 0.5 : 0.42) + dot(point, right) * factor,
      height * (mobile ? 0.31 : 0.50) - dot(point, up) * factor];
  };
  const visiblePoses = move ? applyPose(livePoses(), { ...move, angle: move.angle * fraction }) : livePoses();
  if (poses || move) {
    const [x, y] = project([0, 0, 0]);
    const radius = size * 0.22;
    const core = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.27, radius * 0.07, x, y, radius);
    core.addColorStop(0, '#2d3039');
    core.addColorStop(1, '#090b10');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
  }
  painted = [];
  const walls = [];
  for (const [id, tile] of tiles.entries()) {
    const { center, inset } = geometry[id];
    const pose = visiblePoses[partOf[id]];
    const position = point => transform(point, pose);
    const normal = position(sides[tile.face].axis), at = position(center);
    const outside = tile.polygon.map(position);
    if (poses || move) for (let i = 0; i < outside.length; i += 3) {
      const a = outside[i], b = outside[(Math.min(i + 3, outside.length)) % outside.length];
      const side = [a, b, scale(b, 0.76), scale(a, 0.76)];
      walls.push({ polygon: side.map(project), depth: dot(add(a, b), eye) * 0.44 });
    }
    if (dot(normal, add(scale(eye, 5), scale(at, -1))) <= 0) continue;
    painted.push({ id, depth: dot(at, eye), polygon: outside.map(project),
      sticker: inset.map(p => project(position(p))), mark: tile.kind === 'petal' ? project(at) : null,
      shade: 0.06 + 0.22 * (1 - Math.max(0, dot(normal, [0.35, 0.7, 0.6]))) });
  }
  painted.sort((a, b) => a.depth - b.depth);
  for (const { polygon, sticker, id, shade, mark } of [...walls, ...painted].sort((a, b) => a.depth - b.depth)) {
    path(polygon);
    ctx.fillStyle = sticker ? '#101116' : '#171922';
    ctx.strokeStyle = '#080c12';
    ctx.lineWidth = 0.8;
    ctx.fill();
    if (!sticker) continue;
    ctx.stroke();
    path(sticker);
    ctx.fillStyle = sides[state[id]].color;
    ctx.fill();
    ctx.fillStyle = `rgba(4, 12, 23, ${shade})`;
    ctx.fill();
    if (mark) {
      ctx.beginPath();
      ctx.ellipse(mark[0], mark[1], size * 0.006, size * 0.004, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#202127';
      ctx.fill();
    }
  }
}

const angleLabel = angle => {
  const degrees = Math.round(angle * 1800 / Math.PI) / 10;
  return `${degrees > 180 ? Math.round((degrees - 360) * 10) / 10 : degrees}°`;
};
const moveName = ({ edge, angle }) => `${edges[edge].name}${Math.abs(angle) > Math.PI - 1e-6 ? '' : ' ' + angleLabel(angle)}`;

function turnOptions() {
  const selected = Number(angleInput.value);
  options = optionsAt(livePoses(), Number(edgeInput.value));
  const preferred = options.findIndex(move => Math.abs(move.target - selected) < 1e-6);
  angleInput.replaceChildren(...options.map(move => new Option(angleLabel(move.target), move.target)));
  if (options.length) angleInput.selectedIndex = preferred >= 0 ? preferred :
    Math.max(0, options.findIndex(move => move.target === Math.PI));
  else angleInput.add(new Option('Blocked', ''));
}

function controls() {
  for (const id of ['solve', 'jumble']) get(id).disabled = busy();
  for (const id of ['scramble', 'animate', 'jumble-scramble', 'paint']) get(id).disabled = busy() || Boolean(poses);
  edgeInput.disabled = busy();
  angleInput.disabled = busy() || !options.length;
  get('flip').disabled = busy() || !options.length;
  get('pause').disabled = !playback;
  get('pause').textContent = playback?.paused ? 'Resume' : 'Pause';
  get('stop').disabled = !busy();
  get('shape').textContent = poses ? 'Jumbled shape · blocked cuts are disabled' : 'Cube shape';
}

function stop(message = poses ? 'Jumbled' : isSolved(state) ? 'Solved' : 'Ready') {
  cancelAnimationFrame(frame);
  playback?.active?.classList.remove('current');
  playback = undefined;
  if (planning) {
    worker.terminate();
    worker = undefined;
    planning = false;
  }
  turnOptions();
  controls();
  status.textContent = message;
  draw();
}

function perform(move) {
  if (move.regular && !poses) {
    state = turn(state, move.edge);
    return;
  }
  poses = applyPose(livePoses(), move);
}

function settle() {
  if (!poses) return;
  const slots = cubeSlots(poses);
  if (!slots) return;
  state = remapColors(state, slots);
  poses = null;
}

function tick(now) {
  const p = playback;
  if (!p || p.paused) return;
  while (p.index < p.moves.length && now >= p.start + (p.index + 1) * p.duration) {
    const move = p.moves[p.index++];
    if (move.regular || move.startAligned) settle();
    perform(move);
  }
  if (p.index === p.moves.length) { settle(); stop(p.message); return; }
  const move = p.moves[p.index];
  if (move.regular || move.startAligned) settle();
  const active = p.nodes[p.index];
  if (active !== p.active) {
    p.active?.classList.remove('current');
    active.classList.add('current');
    list.scrollTop = Math.max(0, active.offsetTop - 28);
    p.active = active;
    status.textContent = `${move.name} · ${p.index + 1} of ${p.moves.length} · ${moveName(move)}`;
  }
  draw(move, clamp((now - p.start) / p.duration - p.index, 0, 1));
  frame = requestAnimationFrame(tick);
}

function play(stages, message) {
  const moves = stages.flatMap(({ name, moves }) => moves.map(move => Number.isInteger(move)
    ? { ...flips[move], name, regular: true } : { ...move, name }));
  if (!moves.length) { stop(); return; }
  const speed = get('speed').valueAsNumber;
  const nodes = moves.map(move => {
    const span = document.createElement('span');
    span.textContent = moveName(move);
    return span;
  });
  list.replaceChildren(...nodes);
  playback = { moves, nodes, message, index: 0, start: performance.now(), duration: 1000 / (speed > 0 ? speed : 10) };
  controls();
  frame = requestAnimationFrame(tick);
}

function setPaint(active) {
  painting = active;
  get('paint').setAttribute('aria-pressed', active);
  get('paint').textContent = active ? 'Done entering' : 'Enter stickers';
  palette.hidden = !active;
  get('hint').textContent = active ? 'Choose a color, then click a sticker · Drag to orbit' : 'Click an edge to select it · Drag to orbit · Scroll to zoom';
}

get('solve').onclick = () => {
  if (busy()) return;
  setPaint(false);
  if (!poses && isSolved(state)) { stop(); return; }
  worker ??= new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.stage) { status.textContent = data.stage; return; }
    planning = false;
    if (data.error) stop(data.error);
    else play(data.plan, data.message);
  };
  worker.onerror = () => stop('Could not load the solver');
  planning = true;
  controls();
  list.replaceChildren();
  status.textContent = 'Planning…';
  worker.postMessage({ state, poses });
};

function shuffle(animated) {
  const input = get('count');
  if (busy() || poses || !input.reportValidity()) return;
  setPaint(false);
  const moves = scramble(input.valueAsNumber);
  if (animated) play([{ name: 'Scrambling', moves }]);
  else {
    state = replay(state, moves);
    list.replaceChildren();
    stop('Scrambled');
  }
}
get('scramble').onclick = () => shuffle(false);
get('animate').onclick = () => shuffle(true);
get('flip').onclick = () => {
  const move = options[angleInput.selectedIndex];
  if (busy() || !move) return;
  setPaint(false);
  play([{ name: 'Edge turn', moves: [move] }]);
};
get('jumble').onclick = () => {
  if (busy()) return;
  setPaint(false);
  const moves = jumbleMoves(livePoses());
  if (moves.length) play([{ name: 'Jumbling', moves }]);
  else stop('No legal jumbling turn available');
};
get('jumble-scramble').onclick = () => {
  const input = get('count');
  if (busy() || poses || !input.reportValidity()) return;
  setPaint(false);
  let remaining = input.valueAsNumber;
  if (remaining >= 10) {
    const ordinary = scramble(Math.floor(remaining * 0.4));
    state = replay(state, ordinary);
    remaining -= ordinary.length;
    while (remaining > 7) {
      const mixed = colorJumble();
      for (const move of mixed) perform(move);
      settle();
      remaining -= mixed.length;
    }
  }
  const moves = jumbleScramble(livePoses(), remaining);
  if (!moves.length) { stop('No legal jumbling turn available'); return; }
  for (const move of moves) perform(move);
  settle();
  list.replaceChildren();
  stop(poses ? 'Jumbled' : 'Scrambled');
};
get('stop').onclick = () => { settle(); stop('Stopped'); };
get('reset').onclick = () => {
  state = solved.slice();
  poses = null;
  setPaint(false);
  list.replaceChildren();
  stop();
};
get('paint').onclick = () => setPaint(!painting);
edgeInput.onchange = () => { turnOptions(); controls(); };
get('view').onclick = () => { yaw = 0.64; pitch = 0.47; zoom = 1; if (!playback) draw(); };
get('pause').onclick = () => {
  if (!playback) return;
  if (playback.paused) {
    playback.start += performance.now() - playback.paused;
    playback.paused = undefined;
    frame = requestAnimationFrame(tick);
  } else {
    playback.paused = performance.now();
    cancelAnimationFrame(frame);
  }
  controls();
};

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
});
canvas.addEventListener('pointermove', event => {
  if (gesture?.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  gesture.x = event.clientX;
  gesture.y = event.clientY;
  gesture.distance += Math.hypot(dx, dy);
  if (gesture.distance < 5) return;
  yaw -= dx * 0.008;
  pitch = clamp(pitch + dy * 0.008, -1.55, 1.55);
  if (!playback) draw();
});
canvas.addEventListener('pointerup', event => {
  const g = gesture;
  gesture = undefined;
  if (g?.id !== event.pointerId || g.distance >= 5 || event.button !== 0 || busy()) return;
  const rect = canvas.getBoundingClientRect();
  const hit = painted.slice().reverse().find(({ polygon }) => {
    path(polygon);
    return ctx.isPointInPath((event.clientX - rect.left) * ratio, (event.clientY - rect.top) * ratio);
  });
  if (!hit) return;
  if (painting) {
    state[hit.id] = color;
    list.replaceChildren();
    stop('Sticker updated');
  } else if (tiles[hit.id].kind === 'edge') {
    const [edge] = tiles[hit.id].moving;
    edgeInput.value = edge;
    turnOptions();
    controls();
  }
});
canvas.addEventListener('pointercancel', () => { gesture = undefined; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = clamp(zoom * Math.exp(-event.deltaY * 0.0017), 0.5, 3);
  if (!playback) draw();
}, { passive: false });
canvas.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') yaw += 0.14;
  else if (event.key === 'ArrowRight') yaw -= 0.14;
  else if (event.key === 'ArrowUp') pitch = clamp(pitch + 0.14, -1.55, 1.55);
  else if (event.key === 'ArrowDown') pitch = clamp(pitch - 0.14, -1.55, 1.55);
  else return;
  event.preventDefault();
  if (!playback) draw();
});
new ResizeObserver(() => { if (!playback) draw(); }).observe(canvas);
turnOptions();
controls();
draw();
