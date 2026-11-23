import { Square1, pieces, readRing, sideColors, step } from './puzzle.mjs';

const find = id => document.getElementById(id);
const canvas = find('puzzle');
const controls = document.querySelector('.controls');
const ctx = canvas.getContext('2d');
const model = new Square1();
const pointers = new Map();
const getTop = find('top'), getBottom = find('bottom'), speed = find('speed');
const progress = find('progress');
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const plus = (a, b) => a.map((value, i) => value + b[i]);
const times = (a, value) => a.map(x => x * value);
const minus = (a, b) => a.map((value, i) => value - b[i]);
const mean = points => times(points.reduce(plus), 1 / points.length);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const polar = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius];
const edgeRadius = 1 / Math.cos(step / 2);
const edgeStart = -Math.PI / 2;
const black = '#101720';
const outer = { top: 1, bottom: -1 };
const gap = 0.025;
const fixedCorners = Array.from({ length: 4 }, (_, i) => polar(edgeStart + step + i * Math.PI / 2, Math.SQRT2));
let yaw = 0.62, pitch = 0.49, zoom = 1, projected = [], gesture, playback, frame = 0;
let rate = speed.valueAsNumber, applied = 0;

function rotateLayer([x, y, z], angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * x - s * z, y, s * x + c * z];
}

function rotateSlice([x, y, z], angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x, c * y - s * z, s * y + c * z];
}

function clipHalf(points, sign) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    if (p[0] * sign > 0) result.push(p);
    if (p[0] * q[0] < 0) result.push([0, (p[1] * q[0] - q[1] * p[0]) / (q[0] - p[0])]);
  }
  return result;
}

const middle = [-1, 1].map(sign => {
  const polygon = clipHalf(fixedCorners, sign);
  const walls = polygon.map((p, index) => {
    const q = polygon[(index + 1) % polygon.length];
    if (p[0] === 0 && q[0] === 0) return null;
    const centerAngle = Math.atan2(p[1] + q[1], p[0] + q[0]);
    const side = (Math.round((centerAngle - (edgeStart + step * 2.5)) / (Math.PI / 2)) + 4) % 4;
    return sideColors[side];
  });
  return { polygon, walls, rightHalf: sign > 0 };
});

function meshes(move, fraction) {
  const faces = [];
  const prism = (polygon, bottom, top, caps, walls, turn, layer) => {
    const a = polygon.map(([x, z]) => turn([x, bottom, z])), b = polygon.map(([x, z]) => turn([x, top, z]));
    faces.push({ points: a, color: caps[0], layer }, { points: b.slice().reverse(), color: caps[1], layer });
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      faces.push({ points: [a[i], b[i], b[j], a[j]], color: walls[i], layer });
    }
  };
  for (const [layer, name] of ['top', 'bottom'].entries()) {
    const top = layer === 0;
    for (const { id, start, width } of readRing(model[name])) {
      const piece = pieces[id], angle = edgeStart + start * step;
      const outline = [[0, 0], polar(angle, edgeRadius)];
      if (width === 2) outline.push(polar(angle + step, Math.SQRT2));
      outline.push(polar(angle + width * step, edgeRadius));
      const sides = piece.layer === layer ? piece.sides : piece.sides.slice().reverse();
      const turn = point => {
        if (move?.slash && start < 6) return rotateSlice(point, Math.PI * fraction);
        if (!move?.slash && move?.[name]) return rotateLayer(point, move[name] * outer[name] * step * fraction);
        return point;
      };
      const low = top ? 0.27 : -1, high = top ? 1 : -0.27;
      prism(outline, low, high, top ? [null, piece.color] : [piece.color, null],
        [null, ...sides, null], turn, layer);
    }
  }
  for (const { polygon, walls, rightHalf } of middle) {
    const turn = point => rightHalf ? rotateSlice(point, (Number(model.flipped) + (move?.slash ? fraction : 0)) * Math.PI) : point;
    prism(polygon, -0.27 + gap, 0.27 - gap, [null, null], walls, turn, null);
  }
  return faces;
}

function camera() {
  const width = canvas.clientWidth, height = canvas.clientHeight, mobile = width <= 740;
  const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = cross(forward, right);
  const roomTop = 100;
  const room = mobile ? Math.max(42, controls.offsetTop - roomTop) : height;
  const lens = Math.min(width * (mobile ? 0.9 : 0.55), room * (mobile ? 1.1 : 0.75)) * zoom * 1.36;
  const center = [width * (mobile ? 0.5 : 0.42), mobile ? roomTop + room / 2 : height / 2];
  return {
    width, height, forward, eye: times(forward, 5),
    project(point) {
      const scale = lens / (5 - dot(point, forward));
      return [center[0] + dot(point, right) * scale, center[1] - dot(point, up) * scale];
    },
  };
}

function path(points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
}

function draw(move, fraction = 0) {
  const { width, height, project, eye, forward } = camera();
  const density = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
  }
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.clearRect(0, 0, width, height);
  projected = [];
  for (const { points, color, layer } of meshes(move, fraction)) {
    const [a, b, c] = points;
    const normal = cross(minus(b, a), minus(c, a));
    if (dot(normal, minus(eye, a)) <= 0) continue;
    const center = mean(points), length = Math.hypot(...normal);
    projected.push({
      depth: dot(center, forward), polygon: points.map(project), center, layer, color,
      sticker: color ? points.map(point => project(plus(times(point, 0.92), times(center, 0.08)))) : null,
      shade: 0.07 + 0.25 * (1 - Math.max(0, dot(normal, [-0.2, 0.8, 0.56]) / length)),
    });
  }
  projected.sort((a, b) => a.depth - b.depth);
  for (const face of projected) {
    path(face.polygon);
    ctx.fillStyle = black;
    ctx.strokeStyle = black;
    ctx.lineWidth = 0.7;
    ctx.fill();
    ctx.stroke();
    if (!face.sticker) continue;
    path(face.sticker);
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.fillStyle = `rgba(8, 12, 22, ${face.shade})`;
    ctx.fill();
  }
}

function update(message) {
  find('state').textContent = message ?? (model.solved ? 'Solved' : 'Scrambled');
  find('moves').textContent = `${applied.toLocaleString()} ${applied === 1 ? 'move' : 'moves'}`;
  find('slice-status').textContent = model.canSlash ? 'Slice ready' : 'Turn the layers to line up the slice';
  for (const id of ['turn', 'instant', 'animate', 'top', 'bottom']) find(id).disabled = Boolean(playback);
  find('slash').disabled = Boolean(playback) || !model.canSlash;
  find('stop').disabled = !playback;
}

function apply(move) {
  if (move.slash ? model.slash() : model.turn(move.top, move.bottom)) {
    if (move.slash || move.top || move.bottom) applied++;
  }
}

function stop(message) {
  cancelAnimationFrame(frame);
  playback = null;
  progress.hidden = true;
  update(message);
  draw();
}

function animate(now) {
  const work = playback;
  if (!work) return;
  work.credit += clamp(now - work.last, 0, 100) * rate / 1000;
  work.last = now;
  while (work.credit >= 1 && work.index < work.moves.length) {
    apply(work.moves[work.index++]);
    work.credit--;
  }
  if (work.index === work.moves.length) return stop();
  progress.value = work.index + work.credit;
  draw(work.moves[work.index], work.credit);
  frame = requestAnimationFrame(animate);
}

function play(moves, message) {
  if (playback || !moves.length) return;
  playback = { moves, index: 0, credit: 0, last: performance.now() };
  progress.max = moves.length;
  progress.value = 0;
  progress.hidden = false;
  update(message);
  frame = requestAnimationFrame(animate);
}

function turn(top, bottom) {
  if (top || bottom) play([{ top, bottom }], `Turning (${top}, ${bottom})`);
}

function slash() {
  if (!playback && model.canSlash) play([{ slash: true }], 'Turning the right half');
}

function scramble(animated) {
  if (playback) return;
  const moves = model.planScramble();
  if (animated) play(moves, 'Scrambling');
  else {
    for (const move of moves) apply(move);
    update();
    draw();
  }
}

find('turn-form').onsubmit = event => {
  event.preventDefault();
  turn(getTop.valueAsNumber, getBottom.valueAsNumber);
};
find('slash').onclick = slash;
find('stop').onclick = () => stop('Stopped');
find('instant').onclick = () => scramble(false);
find('animate').onclick = () => scramble(true);
find('reset').onclick = () => { model.reset(); applied = 0; stop(); };
find('view').onclick = () => { yaw = 0.62; pitch = 0.49; zoom = 1; if (!playback) draw(); };
speed.oninput = () => {
  if (speed.validity.valid && speed.valueAsNumber > 0 && Number.isFinite(speed.valueAsNumber)) {
    rate = speed.valueAsNumber;
    find('speed-rate').textContent = `${rate.toLocaleString()} ${rate === 1 ? 'turn' : 'turns'}/sec`;
  } else find('speed-rate').textContent = 'Enter a positive speed';
};

function position(event) {
  const { left, top } = canvas.getBoundingClientRect();
  return [event.clientX - left, event.clientY - top];
}

function pick(point) {
  const density = ctx.getTransform().a;
  for (let i = projected.length - 1; i >= 0; i--) {
    path(projected[i].polygon);
    if (ctx.isPointInPath(point[0] * density, point[1] * density)) return projected[i];
  }
  return null;
}

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  const point = position(event);
  pointers.set(event.pointerId, point);
  gesture = pointers.size === 1
    ? { id: event.pointerId, start: point, part: !playback && event.button === 0 ? pick(point) : null } : null;
});
canvas.addEventListener('pointermove', event => {
  const prior = pointers.get(event.pointerId);
  if (!prior) return;
  const next = position(event), other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
  pointers.set(event.pointerId, next);
  if (other) {
    zoom = clamp(zoom * Math.hypot(...minus(next, other)) / Math.max(1, Math.hypot(...minus(prior, other))), 0.45, 16);
  } else if (gesture?.part?.layer == null) {
    yaw -= (next[0] - prior[0]) * 0.008;
    pitch = clamp(pitch + (next[1] - prior[1]) * 0.008, -1.56, 1.56);
  }
  if (!playback) draw();
});

function release(event) {
  pointers.delete(event.pointerId);
  if (gesture?.id !== event.pointerId) return;
  const { start, part } = gesture;
  gesture = null;
  if (event.type !== 'pointerup' || part?.layer == null || playback) return;
  const drag = minus(position(event), start), distance = Math.hypot(...drag);
  if (distance < 9) return;
  const { project } = camera();
  const tangent = minus(project(rotateLayer(part.center, 0.02)), project(rotateLayer(part.center, -0.02)));
  const aligned = dot(drag, tangent);
  const amount = clamp(Math.round(distance / 50), 1, 5) * (aligned < 0 ? -1 : 1);
  if (part.layer === 0) turn(amount, 0);
  else turn(0, -amount);
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = clamp(zoom * Math.exp(-event.deltaY * 0.0017), 0.45, 16);
  if (!playback) draw();
}, { passive: false });
canvas.addEventListener('keydown', event => {
  const amount = event.shiftKey ? -1 : 1;
  switch (event.key.toLowerCase()) {
    case 'u': turn(amount, 0); break;
    case 'd': turn(0, amount); break;
    case '/': slash(); break;
    case 'arrowleft': yaw += 0.14; break;
    case 'arrowright': yaw -= 0.14; break;
    case 'arrowup': pitch = clamp(pitch + 0.14, -1.56, 1.56); break;
    case 'arrowdown': pitch = clamp(pitch - 0.14, -1.56, 1.56); break;
    default: return;
  }
  event.preventDefault();
  if (!playback) draw();
});

const observer = new ResizeObserver(() => { if (!playback) draw(); });
observer.observe(canvas);
observer.observe(controls);
update();
draw();
