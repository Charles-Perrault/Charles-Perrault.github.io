import { add, cross, dot, scale, edges, sides, tiles, solved, turn, replay, isSolved } from './puzzle.mjs';
import { scramble } from './solver.mjs';
import { applyPose, cubePoses, cubeSlots, jumbleMoves, jumbleScramble, optionsAt, partOf, remapColors, transform } from './jumbling.mjs';
import { colorJumble } from './mixed-petals.mjs';
import { depthRenderer, triangulate } from './depth-renderer.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle'), drawDepth = depthRenderer(canvas);
const ctx = drawDepth ? null : canvas.getContext('2d');
const status = get('status'), list = get('moves'), edgeInput = get('edge');
const palette = get('palette'), angleInput = get('angle');
const names = ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Orange'];
let state = solved.slice(), yaw = 0.64, pitch = 0.47, zoom = 1, ratio = 1;
let playback, worker, planning = false, frame, gesture, painted = [], painting = false, color = 0;
let poses = null, options = [];
let findSticker = () => null;
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
  const normal = sides[tile.face].axis, plane = normal.findIndex(Boolean);
  const inset = tile.polygon.map(v => add(add(scale(v, 0.85), scale(center, 0.15)), scale(normal, 0.0005)));
  const tangent = [0, 0, 0];
  tangent[(plane + 1) % 3] = 1;
  const bitangent = cross(normal, tangent), markCenter = add(center, scale(normal, 0.001));
  const mark = Array.from({ length: 12 }, (_, i) => {
    const angle = Math.PI * i / 6;
    return add(markCenter, add(scale(tangent, Math.cos(angle) * 0.025), scale(bitangent, Math.sin(angle) * 0.017)));
  });
  return { center, inset, mark, triangles: drawDepth ? triangulate(tile.polygon, plane) : [] };
});
const wallTriangles = [0, 1, 2, 0, 2, 3];
const markTriangles = Array.from({ length: 10 }, (_, i) => [0, i + 1, i + 2]).flat();
const baseColors = sides.map(({ color }) => color.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255));
const plasticColor = [16 / 255, 17 / 255, 22 / 255];
const markColor = [32 / 255, 33 / 255, 39 / 255];
const coreRadius = 0.96;
const coreMesh = [];
function corePoint(row, column) {
  const latitude = Math.PI * row / 12, longitude = Math.PI * column / 12;
  return [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
}
for (let row = 0; row < 12; row++) for (let column = 0; column < 24; column++) {
  const quad = [corePoint(row, column), corePoint(row + 1, column),
    corePoint(row + 1, column + 1), corePoint(row, column + 1)];
  const light = 0.035 + 0.13 * Math.max(0, dot(quad[0], [0.35, 0.7, 0.6]));
  coreMesh.push({ vertices: quad.map(point => scale(point, coreRadius)), color: [light, light + 0.008, light + 0.035] });
}

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
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx?.clearRect(0, 0, width, height);
  const eye = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = cross(eye, right);
  const size = Math.min(mobile ? width : width - 270, height * (mobile ? 0.55 : 0.93)) * 0.95 * zoom;
  const centerX = width * (mobile ? 0.5 : 0.42), centerY = height * (mobile ? 0.31 : 0.50);
  const camera = scale(eye, 5);
  const vertices = [], hitSurfaces = [];
  function surface(points, indices, rgb) {
    const clip = points.map(point => {
      const w = 5 - dot(point, eye);
      return [(centerX * 2 / width - 1) * w + dot(point, right) * size * 2 / width,
        (1 - centerY * 2 / height) * w + dot(point, up) * size * 2 / height,
        (11 * w - 20) / 9, w, ...rgb];
    });
    for (const i of indices) vertices.push(...clip[i]);
  }
  const project = point => {
    const factor = size / (5 - dot(point, eye));
    return [centerX + dot(point, right) * factor, centerY - dot(point, up) * factor];
  };
  const visiblePoses = move ? applyPose(livePoses(), { ...move, angle: move.angle * fraction }) : livePoses();
  const showInterior = Boolean(poses || move);
  if (showInterior && drawDepth) {
    for (const { vertices: quad, color } of coreMesh) surface(quad, wallTriangles, color);
  } else if (showInterior) {
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
    const { center, inset, mark, triangles } = geometry[id];
    const pose = visiblePoses[partOf[id]];
    const position = point => transform(point, pose);
    const normal = position(sides[tile.face].axis), at = position(center);
    const outside = tile.polygon.map(position);
    if (showInterior) for (let i = 0; i < outside.length; i += drawDepth ? 1 : 3) {
      const bIndex = Math.min(i + (drawDepth ? 1 : 3), outside.length) % outside.length;
      const a = outside[i], b = outside[bIndex];
      const side = [a, b, scale(b, 0.76), scale(a, 0.76)];
      const wallNormal = cross(add(b, scale(a, -1)), add(side[3], scale(a, -1)));
      const length = Math.hypot(...wallNormal);
      const light = length ? Math.abs(dot(wallNormal, [0.35, 0.7, 0.6])) / length : 0;
      const brightness = Math.round(30 + 30 * light);
      const polygon = side.map(project);
      if (drawDepth) {
        surface(side, wallTriangles, [brightness / 255, (brightness + 3) / 255, (brightness + 8) / 255]);
        hitSurfaces.push({ polygon, normal: wallNormal, point: a });
      } else {
        walls.push({ polygon, depth: dot(add(a, b), eye) * 0.44,
          plastic: `rgb(${brightness}, ${brightness + 3}, ${brightness + 8})` });
      }
    }
    if (dot(normal, add(camera, scale(at, -1))) <= 0) continue;
    const shade = 0.06 + 0.22 * (1 - Math.max(0, dot(normal, [0.35, 0.7, 0.6])));
    if (drawDepth) {
      surface(outside, triangles, plasticColor);
      surface(inset.map(position), triangles, baseColors[state[id]].map((channel, i) =>
        channel * (1 - shade) + [4, 12, 23][i] / 255 * shade));
      if (tile.kind === 'petal') surface(mark.map(position), markTriangles, markColor);
      hitSurfaces.push({ id, polygon: outside.map(project), normal, point: at });
      continue;
    }
    painted.push({ id, depth: dot(at, eye), polygon: outside.map(project),
      sticker: inset.map(p => project(position(p))), mark: tile.kind === 'petal' ? project(at) : null,
      shade });
  }
  if (drawDepth) {
    drawDepth(vertices);
    findSticker = (x, y) => {
      const ray = add(scale(eye, -1), add(scale(right, (x - centerX) / size), scale(up, (centerY - y) / size)));
      const a = dot(ray, ray), b = dot(camera, ray), c = 25 - coreRadius ** 2;
      const discriminant = b ** 2 - a * c;
      let nearest = showInterior && discriminant >= 0 ? (-b - Math.sqrt(discriminant)) / a : Infinity;
      let hit = null;
      for (const item of hitSurfaces) {
        const denominator = dot(item.normal, ray);
        if (Math.abs(denominator) < 1e-10) continue;
        const distance = dot(item.normal, add(item.point, scale(camera, -1))) / denominator;
        if (distance <= 0 || distance >= nearest || !inside(item.polygon, x, y)) continue;
        nearest = distance;
        hit = item.id === undefined ? null : item;
      }
      return hit;
    };
    return;
  }
  painted.sort((a, b) => a.depth - b.depth);
  findSticker = (x, y) => painted.slice().reverse().find(({ polygon }) => inside(polygon, x, y));
  for (const { polygon, sticker, id, shade, mark, plastic } of [...walls, ...painted].sort((a, b) => a.depth - b.depth)) {
    path(polygon);
    ctx.fillStyle = sticker ? '#101116' : plastic;
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

function inside(polygon, x, y) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  }
  return hit;
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
  for (const id of ['solve', 'jumble', 'paint']) get(id).disabled = busy();
  for (const id of ['scramble', 'animate', 'jumble-scramble']) get(id).disabled = busy() || Boolean(poses);
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
  if (p.index === p.moves.length) {
    settle();
    if (planning) {
      p.waiting = true;
      status.textContent = 'Waiting for more solution moves…';
      draw();
    } else stop(p.message);
    return;
  }
  const move = p.moves[p.index];
  if (move.regular || move.startAligned) settle();
  const active = p.nodes[p.index];
  if (active !== p.active) {
    p.active?.classList.remove('current');
    active.classList.add('current');
    list.scrollTop = Math.max(0, active.offsetTop - 28);
    p.active = active;
    status.textContent = `${move.name} · Move ${p.index + 1}/${p.moves.length}${planning ? '+' : ''} · ${moveName(move)}`;
  }
  draw(move, clamp((now - p.start) / p.duration - p.index, 0, 1));
  frame = requestAnimationFrame(tick);
}

function play(stages, message, append = false) {
  const moves = stages.flatMap(({ name, moves }) => moves.map(move => Number.isInteger(move)
    ? { ...flips[move], name, regular: true } : { ...move, name }));
  if (!moves.length) { if (!append) stop(); return; }
  const speed = get('speed').valueAsNumber;
  const nodes = moves.map(move => {
    const span = document.createElement('span');
    span.textContent = moveName(move);
    return span;
  });
  if (append && playback) {
    const p = playback;
    p.moves.push(...moves);
    p.nodes.push(...nodes);
    list.append(...nodes);
    if (p.waiting) {
      p.waiting = false;
      const now = performance.now();
      p.start = now - p.index * p.duration;
      if (p.paused) p.paused = now;
      else frame = requestAnimationFrame(tick);
    }
    return;
  }
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
  worker ??= new Worker(new URL('./worker.mjs?v=2', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.stage) { if (!playback || playback.waiting) status.textContent = data.stage; return; }
    if (data.batch) { play([data.batch], undefined, true); return; }
    if (data.error) { stop(data.error); return; }
    planning = false;
    if (!playback || playback.waiting) stop();
    else controls();
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
  const hit = findSticker(event.clientX - rect.left, event.clientY - rect.top);
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
