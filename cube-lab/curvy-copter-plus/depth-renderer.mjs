const vertexSource = `#version 300 es
layout(location=0) in vec4 position;
layout(location=1) in vec3 color;
out vec3 rgb;
void main() { gl_Position = position; rgb = color; }`;
const fragmentSource = `#version 300 es
precision mediump float;
in vec3 rgb;
out vec4 pixel;
void main() { pixel = vec4(rgb, 1.0); }`;

export function depthRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 16);
  gl.enable(gl.DEPTH_TEST);
  return vertices => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 7);
  };
}

const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// The curved edge and petal outlines can be concave, so a triangle fan
// would fill portions of neighboring pieces.
export function triangulate(points, plane) {
  const coords = points.map(point => point.filter((_, axis) => axis !== plane));
  const remaining = coords.map((_, i) => i);
  const signedArea = coords.reduce((sum, point, i) => sum + area([0, 0], point, coords[(i + 1) % coords.length]), 0);
  const sign = Math.sign(signedArea);
  const triangles = [];
  while (remaining.length > 3) {
    const ear = remaining.findIndex((here, i) => {
      const before = remaining.at(i - 1), after = remaining[(i + 1) % remaining.length];
      const a = coords[before], b = coords[here], c = coords[after];
      if (area(a, b, c) * sign <= 1e-12) return false;
      return !remaining.some(id => id !== before && id !== here && id !== after &&
        area(a, b, coords[id]) * sign >= -1e-12 &&
        area(b, c, coords[id]) * sign >= -1e-12 &&
        area(c, a, coords[id]) * sign >= -1e-12);
    });
    if (ear < 0) {
      const collinear = remaining.findIndex((here, i) =>
        Math.abs(area(coords[remaining.at(i - 1)], coords[here], coords[remaining[(i + 1) % remaining.length]])) <= 1e-12);
      if (collinear < 0) throw new Error('Invalid Curvy Copter sticker outline');
      remaining.splice(collinear, 1);
      continue;
    }
    triangles.push(remaining.at(ear - 1), remaining[ear], remaining[(ear + 1) % remaining.length]);
    remaining.splice(ear, 1);
  }
  triangles.push(...remaining);
  return triangles;
}
