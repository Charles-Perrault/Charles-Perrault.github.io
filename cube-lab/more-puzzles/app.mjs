import { variants, hypercube, inTurn, spatialPuzzle } from './model.mjs';
import { add, cross, dot, rotate, scale } from '../pyraminx/renderer.mjs';

const get = id => document.getElementById(id);
const canvas = get('puzzle'), ctx = canvas.getContext('2d');
const controls = document.querySelector('.controls'), nav = document.querySelector('nav');
const size = get('size'), move = get('move'), section = get('section'), stop = get('stop');
const colors = ['#f3f1ea', '#e9c73e', '#d54b49', '#f08e39', '#3da363', '#4486ce', '#9058ce', '#ed85b7'];
const color = index => colors[index] ?? `hsl(${index * 137.508}, 58%, ${index % 2 ? 68 : 47}%)`;
const cellLabels = ['+X', '−X', '+Y', '−Y', '+Z', '−Z', '+W', '−W'];
let puzzle, kind, yaw = 0.69, pitch = 0.49, zoom = 1, drag, project, playback;
let visible = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const affected = (tile, turn) => turn.edge === undefined ? inTurn(tile.center, turn) : tile.turns.includes(turn.edge);

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
    const position = id => {
      const cell = Math.floor(id / n ** 3), row = Math.floor(id / n) % n, col = id % n;
      return [x0 + (cell % cols) * (side + 12) + col * step,
        y0 + Math.floor(cell / cols) * (side + 20) + 16 + row * step];
    };
    const active = playback?.current;
    const t = playback?.fraction ?? 0;
    for (let cell = 0; cell < 8; cell++) {
      const x = x0 + (cell % cols) * (side + 12), y = y0 + Math.floor(cell / cols) * (side + 20);
      ctx.fillStyle = '#edf2f3';
      ctx.fillText(cellLabels[cell], x, y + 12);
    }
    const drawCell = (id, x, y, opacity = 1) => {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color(puzzle.state[id]);
      ctx.fillRect(x, y, step * 0.95, step * 0.95);
    };
    const moving = [];
    for (let cell = 0; cell < 8; cell++) for (let i = 0; i < n ** 2; i++) {
      const id = (cell * n + plane) * n ** 2 + i;
      const [x, y] = position(id);
      if (!active) { drawCell(id, x, y); continue; }
      const next = puzzle.destination(id, active.turn, active.direction);
      if (next === id) { drawCell(id, x, y); continue; }
      if (Math.floor(next / n ** 2) % n === plane) {
        const [u, v] = position(next);
        moving.push([id, x + t * (u - x), y + t * (v - y), 1]);
      } else {
        moving.push([id, x, y, 1 - t]);
      }
      const previous = puzzle.destination(id, active.turn, -active.direction);
      if (Math.floor(previous / n ** 2) % n !== plane) moving.push([previous, x, y, t]);
    }
    for (const cell of moving) drawCell(...cell);
    ctx.globalAlpha = 1;
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
  const active = playback?.current;
  const tiles = [];
  for (const [id, tile] of puzzle.stickers.entries()) {
    const angle = active && affected(tile, active.turn)
      ? playback.fraction * active.direction * 2 * Math.PI / active.turn.order : 0;
    const transform = point => angle ? rotate(point, active.turn.normal, angle) : point;
    const { polygon, stickerPolygon } = tile;
    const normal = transform(tile.normal), center = transform(tile.center);
    if (4 * dot(normal, forward) <= dot(center, normal)) continue;
    const screen = polygon.map(point => project(transform(point)));
    const sticker = stickerPolygon ?? polygon.map(point => add(scale(point, .96), scale(tile.center, .04)));
    tiles.push({ id, tile, screen, sticker: sticker.map(point => project(transform(point))),
      depth: dot(center, forward), shade: .22 * (1 - Math.max(0, dot(normal, [.28, .74, .59]))) });
  }
  if (active) tiles.sort((a, b) => a.depth - b.depth);
  for (const { id, tile, screen, sticker, shade } of tiles) {
    visible.push({ tile, screen });
    path(screen);
    ctx.fillStyle = '#14191f';
    ctx.fill();
    path(sticker);
    ctx.fillStyle = puzzle.palette?.[puzzle.state[id]] ?? color(puzzle.state[id]);
    ctx.fill();
    ctx.fillStyle = `rgba(4, 10, 20, ${shade})`;
    ctx.fill();
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
    const current = nav.querySelector(`[data-variant="${id}"]`);
    nav.querySelector('[aria-current]')?.removeAttribute('aria-current');
    current.setAttribute('aria-current', 'page');
    if (current.offsetLeft + current.offsetWidth > nav.clientWidth) nav.scrollLeft = current.offsetLeft;
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

const inputs = [...controls.querySelectorAll('button, input, select')].filter(element => element !== stop);
function finish(message) {
  playback = null;
  for (const input of inputs) input.disabled = false;
  stop.disabled = true;
  renderState();
  if (message) get('status').textContent = message;
}

function play(sequence) {
  if (playback) return;
  const run = { current: sequence[0], fraction: 0, index: 0, start: performance.now() };
  playback = run;
  for (const input of inputs) input.disabled = true;
  stop.disabled = false;
  function frame(now) {
    if (playback !== run) return;
    const duration = reducedMotion.matches ? 1 : sequence.length === 1 ? 220 : 100;
    const t = Math.min(1, (now - run.start) / duration);
    run.fraction = t * t * (3 - 2 * t);
    get('status').textContent = `Move ${run.index + 1}/${sequence.length}`;
    if (t === 1) {
      try {
        puzzle.turn(run.current.turn, run.current.direction);
      } catch (error) {
        finish(error.message);
        return;
      }
      run.current = sequence[++run.index];
      if (!run.current) { finish(); return; }
      run.start = now;
      run.fraction = 0;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function apply(direction) {
  play([{ turn: puzzle.moves[Number(move.value)], direction }]);
}

get('resize').onsubmit = event => { event.preventDefault(); resize(kind, size.valueAsNumber); };
section.oninput = draw;
get('turn').onclick = () => apply(1);
get('reverse').onclick = () => apply(-1);
get('reset').onclick = () => { puzzle.state.set(puzzle.home); renderState(); };
const scramble = () => Array.from({ length: 20 * size.valueAsNumber }, () => ({
  turn: puzzle.moves[Math.floor(Math.random() * puzzle.moves.length)], direction: Math.random() < 0.5 ? 1 : -1,
}));
get('scramble').onclick = () => play(scramble());
stop.onclick = () => finish();
get('instant').onclick = () => {
  try {
    const previousState = puzzle.state.slice();
    try {
      for (const { turn, direction } of scramble()) puzzle.turn(turn, direction);
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
  return visible.findLast(({ screen }) => {
    let inside = false;
    screen.forEach(([a, b], i) => {
      const [c, d] = screen[(i + 1) % screen.length];
      if ((b > y) !== (d > y) && x < a + (c - a) * (y - b) / (d - b)) inside = !inside;
    });
    return inside;
  });
}

canvas.onpointerdown = event => {
  if (kind === 'hypercube') return;
  canvas.setPointerCapture(event.pointerId);
  const point = eventPoint(event);
  drag = { point, tile: !playback && event.button === 0 ? stickerAt(point)?.tile : null };
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
    if (!affected(drag.tile, turn)) continue;
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
