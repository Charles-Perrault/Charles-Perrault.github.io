import { variants, hypercube, inTurn, spatialPuzzle } from './model.mjs';
import { cross, dot, rotate } from '../pyraminx/renderer.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle'), ctx = canvas.getContext('2d');
const controls = document.querySelector('.controls'), nav = document.querySelector('nav');
const variant = get('variant'), size = get('size'), move = get('move'), section = get('section');
const colors = ['#f3f1ea', '#e9c73e', '#d54b49', '#f08e39', '#3da363', '#4486ce', '#9058ce', '#ed85b7'];
const color = index => colors[index] ?? `hsl(${index * 137.508}, 58%, ${index % 2 ? 68 : 47}%)`;
const cellLabels = ['+X', '−X', '+Y', '−Y', '+Z', '−Z', '+W', '−W'];
let puzzle, kind, yaw = 0.69, pitch = 0.49, zoom = 1, drag, project;
let visible = [];

for (const [id, [label]] of Object.entries(variants)) variant.add(new Option(label, id));

function path(points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function draw() {
  if (!puzzle) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const mobile = w <= 700;
  const top = nav.getBoundingClientRect().bottom + 14;
  const roomWidth = mobile ? w : controls.offsetLeft - 12;
  const roomHeight = Math.max(50, (mobile ? controls.offsetTop : h - 28) - top);
  if (kind === 'hypercube') {
    const cols = roomWidth >= 500 ? 4 : 2, rows = 8 / cols;
    const side = Math.min(roomWidth / cols - 12, roomHeight / rows - 20);
    if (side <= 0) return;
    const n = puzzle.n, step = side / n, plane = Math.min(n - 1, Math.max(0, (section.valueAsNumber || 1) - 1));
    const x0 = (roomWidth - cols * (side + 12)) / 2 + 6;
    const y0 = top + (roomHeight - rows * (side + 20)) / 2;
    ctx.font = '12px Segoe UI';
    for (let cell = 0; cell < 8; cell++) {
      const x = x0 + (cell % cols) * (side + 12), y = y0 + Math.floor(cell / cols) * (side + 20);
      ctx.fillStyle = '#edf2f3';
      ctx.fillText(cellLabels[cell], x, y + 12);
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
        ctx.fillStyle = color(puzzle.state[((cell * n + plane) * n + row) * n + col]);
        ctx.fillRect(x + col * step, y + 16 + row * step, step * 0.95, step * 0.95);
      }
    }
    return;
  }
  const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = cross(forward, right);
  const lens = Math.min(roomWidth, roomHeight) * 1.5 * zoom;
  project = point => {
    const s = lens / (4 - dot(point, forward));
    return [roomWidth / 2 + dot(point, right) * s, top + roomHeight / 2 - dot(point, up) * s];
  };
  visible = [];
  for (const [id, { normal, polygon, center }] of puzzle.stickers.entries()) {
    if (4 * dot(normal, forward) <= dot(center, normal)) continue;
    const screen = polygon.map(project);
    visible.push({ center, screen });
    path(screen);
    ctx.fillStyle = color(puzzle.state[id]);
    ctx.fill();
    ctx.strokeStyle = '#101720';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function renderState() {
  get('status').textContent = puzzle.state.every((value, i) => value === puzzle.home[i]) ? 'Solved' : 'Scrambled';
  draw();
}

function resize(id, layers) {
  if (!Object.hasOwn(variants, id) || !Number.isSafeInteger(layers) || layers < (id === 'redi' ? 3 : 2)) return;
  try {
    const next = id === 'hypercube' ? hypercube(layers) : spatialPuzzle(id, layers);
    puzzle = next;
    kind = id;
    variant.value = id;
    size.min = id === 'redi' ? 3 : 2;
    size.value = layers;
    section.max = layers;
    section.value = Math.ceil(layers / 2);
    get('section-control').hidden = id !== 'hypercube';
    canvas.setAttribute('aria-label', id === 'hypercube' ? 'Slices of the eight cells of the 4D cube' :
      'Twisty puzzle. Drag a sticker to turn or drag the background to orbit. Scroll to zoom.');
    move.replaceChildren(...puzzle.moves.map(({ name }, i) => new Option(name, i)));
    get('name').textContent = variants[id][0];
    document.title = `${variants[id][0]} · Cube Lab`;
    history.replaceState(null, '', `?puzzle=${id}&layers=${layers}`);
    renderState();
  } catch (error) {
    get('status').textContent = error.message;
  }
}

function apply(direction) {
  try {
    puzzle.turn(puzzle.moves[Number(move.value)], direction);
    renderState();
  } catch (error) {
    get('status').textContent = error.message;
  }
}

variant.onchange = () => resize(variant.value, variants[variant.value][1]);
get('resize').onsubmit = event => { event.preventDefault(); resize(kind, size.valueAsNumber); };
section.oninput = draw;
get('turn').onclick = () => apply(1);
get('reverse').onclick = () => apply(-1);
get('reset').onclick = () => { puzzle.state.set(puzzle.home); renderState(); };
get('scramble').onclick = () => {
  try {
    const previousState = puzzle.state.slice();
    try {
      for (let i = 0; i < 20 * size.valueAsNumber; i++) {
        puzzle.turn(puzzle.moves[Math.floor(Math.random() * puzzle.moves.length)], Math.random() < 0.5 ? 1 : -1);
      }
    } catch (error) {
      puzzle.state.set(previousState);
      throw error;
    }
    renderState();
  } catch (error) {
    get('status').textContent = error.message;
  }
};

const eventPoint = event => {
  const bounds = canvas.getBoundingClientRect();
  return [event.clientX - bounds.left, event.clientY - bounds.top];
};
function stickerAt([x, y]) {
  return visible.find(({ screen }) => {
    const sides = screen.map(([a, b], i) => {
      const [c, d] = screen[(i + 1) % screen.length];
      return (c - a) * (y - b) - (d - b) * (x - a);
    });
    return sides.every(n => n >= 0) || sides.every(n => n <= 0);
  });
}

canvas.onpointerdown = event => {
  if (kind === 'hypercube') return;
  canvas.setPointerCapture(event.pointerId);
  const point = eventPoint(event);
  drag = { point, tile: event.button === 0 ? stickerAt(point) : null };
};
canvas.onpointermove = event => {
  if (!drag || drag.tile) return;
  const point = eventPoint(event);
  yaw += (point[0] - drag.point[0]) * 0.01;
  pitch = Math.max(-1.55, Math.min(1.55, pitch + (point[1] - drag.point[1]) * 0.01));
  drag.point = point;
  draw();
};
canvas.onpointerup = event => {
  if (!drag?.tile) return;
  const [x, y] = eventPoint(event), [a, b] = drag.point;
  const dx = x - a, dy = y - b, length = Math.hypot(dx, dy);
  if (length < 8) return;
  const { center } = drag.tile, [cx, cy] = project(center);
  let score = 0.35;
  let best;
  for (const [id, turn] of puzzle.moves.entries()) {
    if (!inTurn(center, turn)) continue;
    const [tx, ty] = project(rotate(center, turn.normal, 0.015));
    const vx = tx - cx, vy = ty - cy, distance = Math.hypot(vx, vy);
    if (distance < 0.01) continue;
    const alignment = (vx * dx + vy * dy) / (distance * length);
    if (Math.abs(alignment) <= score + 0.001) continue;
    score = Math.abs(alignment);
    best = { id, direction: Math.sign(alignment) };
  }
  if (best) {
    move.value = best.id;
    apply(best.direction);
  }
};
canvas.oncontextmenu = event => event.preventDefault();
canvas.onlostpointercapture = () => { drag = null; };
canvas.addEventListener('wheel', event => {
  if (kind === 'hypercube') return;
  event.preventDefault();
  zoom = Math.max(0.45, Math.min(24, zoom * Math.exp(-event.deltaY * 0.001)));
  draw();
}, { passive: false });
new ResizeObserver(draw).observe(canvas);

const params = new URLSearchParams(location.search);
const id = Object.hasOwn(variants, params.get('puzzle')) ? params.get('puzzle') : 'skewb';
const layers = Number(params.get('layers'));
resize(id, Number.isSafeInteger(layers) && layers >= (id === 'redi' ? 3 : 2) ? layers : variants[id][1]);
