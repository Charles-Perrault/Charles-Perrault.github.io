import { add, cross, dot, scale } from '../pyraminx/renderer.mjs';

function pointsOnFace(tile, points, a, b) {
  const fixed = tile.normal.findIndex(value => Math.abs(value) > 0.9);
  const plane = tile.center[fixed];
  const polygon = points.map(([x, y]) => {
    const point = [0, 0, 0];
    point[fixed] = plane;
    point[a] = x;
    point[b] = y;
    return point;
  });
  const area = polygon.reduce((sum, point, i) => sum + dot(cross(point, polygon[(i + 1) % polygon.length]), tile.normal), 0);
  if (area < 0) polygon.reverse();
  return polygon;
}

const det = ([x, y], [u, v]) => x * v - y * u;
const subtract = ([x, y], [u, v]) => [x - u, y - v];
const epsilon = 1e-8;

function nestedOutline(size) {
  const shallow = 0.5 / (size - 2);
  const diagonal = (1 - shallow) / 2;
  // Map each octant to the same square-corner layout while retaining its inner cuts.
  const source = [[0,0], [1,0], [1,1], [diagonal,diagonal], [.5,.5-shallow], [1,1-shallow]];
  const target = [[0,0], [1,0], [1,1], [1/3,1/3], [.55,1/3], [1,1/3]];
  const triangles = [[0,1,4], [1,5,4], [0,4,3], [3,4,2], [4,5,2]].map(ids => {
    const [a,b,c] = ids.map(i => source[i]), [d,e,f] = ids.map(i => target[i]);
    const ab = subtract(b,a), ac = subtract(c,a);
    return { a, ab, ac, area: det(ab,ac), d, de: subtract(e,d), df: subtract(f,d) };
  });
  const boundaries = [[0,1], [0,3], [1,5], [2,3], [2,5], [0,4], [1,4], [2,4], [3,4], [4,5]]
    .flatMap(pair => [1,-1].flatMap(sx => [1,-1].flatMap(sy => [false,true].map(swapped =>
      pair.map(i => {
        const [x,y] = source[i];
        return swapped ? [sx*y, sy*x] : [sx*x, sy*y];
      })))));
  function warp([x,y]) {
    const swapped = Math.abs(y) > Math.abs(x);
    const point = swapped ? [Math.abs(y), Math.abs(x)] : [Math.abs(x), Math.abs(y)];
    for (const { a, ab, ac, area, d, de, df } of triangles) {
      const delta = subtract(point, a), u = det(delta, ac) / area, v = det(ab, delta) / area;
      if (u < -epsilon || v < -epsilon || u + v > 1 + epsilon) continue;
      const [s,t] = d.map((value, i) => value + u * de[i] + v * df[i]);
      return swapped ? [Math.sign(x)*t, Math.sign(y)*s] : [Math.sign(x)*s, Math.sign(y)*t];
    }
    return [x,y];
  }
  return polygon => {
    const points = polygon.flatMap((a, i) => {
      const b = polygon[(i + 1) % polygon.length], edge = subtract(b,a);
      const cuts = [0];
      for (const [p,q] of boundaries) {
        const line = subtract(q,p), area = det(edge,line);
        if (Math.abs(area) < epsilon) continue;
        const delta = subtract(p,a), t = det(delta,line) / area, along = det(delta,edge) / area;
        if (t > epsilon && t < 1-epsilon && along >= -epsilon && along <= 1+epsilon) cuts.push(t);
      }
      return cuts.sort((x,y) => x-y).filter((t,j) => !j || t-cuts[j-1] > epsilon)
        .map(t => warp(a.map((value,j) => value + t * edge[j])));
    });
    return points.filter((p,i) => Math.abs(det(subtract(p,points.at(i-1)),
      subtract(points[(i+1) % points.length],p))) > epsilon);
  };
}

// Redi's fixed core is visible between four corner squares and four kite edges.
export function styleRedi(stickers, size) {
  if (size === 3) for (const tile of stickers) {
    const fixed = tile.normal.findIndex(value => Math.abs(value) > 0.9);
    const [a, b] = [0, 1, 2].filter(axis => axis !== fixed);
    const r = Math.abs(tile.center[fixed]), inner = r / 3, gap = 0;
    const x = tile.center[a], y = tile.center[b];
    let points;
    if (tile.polygon.length === 5) {
      const sx = Math.sign(x), sy = Math.sign(y);
      points = [[inner, inner], [r, inner], [r, r], [inner, r]].map(([u,v]) =>
        [sx * (u + (u === inner ? gap : -gap)), sy * (v + (v === inner ? gap : -gap))]);
    } else if (tile.polygon.length === 3) {
      const horizontal = Math.abs(x) > Math.abs(y), sign = Math.sign(horizontal ? x : y);
      points = [[inner + gap, -inner + gap], [r - gap, -inner + gap],
        [r - gap, inner - gap], [inner + gap, inner - gap], [gap, 0]]
        .map(([u, v]) => horizontal ? [sign * u, v] : [v, sign * u]);
    } else {
      tile.hiddenSticker = true;
      continue;
    }
    tile.renderPolygon = pointsOnFace(tile, points, a, b);
    const visualCenter = tile.renderPolygon.reduce((sum, point) => add(sum, point), [0, 0, 0]);
    tile.renderCenter = scale(visualCenter, 1 / tile.renderPolygon.length);
    tile.stickerPolygon = tile.renderPolygon.map(point =>
      add(scale(point, 0.965), scale(tile.renderCenter, 0.035)));
  }
  else {
    const outline = nestedOutline(size);
    for (const tile of stickers) {
      const fixed = tile.normal.findIndex(value => Math.abs(value) > .9);
      const [a,b] = [0,1,2].filter(i => i !== fixed), r = Math.abs(tile.center[fixed]);
      const points = outline(tile.polygon.map(p => [p[a]/r,p[b]/r]));
      if (points.length < 3) continue;
      tile.renderPolygon = pointsOnFace(tile, points.map(p => p.map(v => v*r)), a, b);
      tile.renderCenter = scale(tile.renderPolygon.reduce(add), 1 / points.length);
      tile.stickerPolygon = tile.renderPolygon.map(p => add(scale(p,.965),scale(tile.renderCenter,.035)));
    }
  }
  return ['#f4f3ed', '#f4d640', '#da4148', '#ee8935', '#36a760', '#3679d2'];
}
