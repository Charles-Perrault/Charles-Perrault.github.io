const vertexSource = `#version 300 es
layout(location=0) in vec4 position;
layout(location=1) in vec3 color;
layout(location=2) in vec2 texcoord;
out vec3 rgb;
out vec2 uv;
void main() { gl_Position = position; rgb = color; uv = texcoord; }`;
const fragmentSource = `#version 300 es
precision mediump float;
in vec3 rgb;
in vec2 uv;
uniform sampler2D atlas;
out vec4 pixel;
void main() {
  if (uv.x < 0.0) pixel = vec4(rgb, 1.0);
  else pixel = vec4(mix(vec3(16.0, 23.0, 32.0) / 255.0, rgb, texture(atlas, uv).r), 1.0);
}`;

export function depthRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 16);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 28);
  gl.enable(gl.DEPTH_TEST);

  // One reusable mask per face shape: the black border and white sticker move
  // together with the actual 3D polygon, including during a slash.
  const cell = 128, columns = 8, atlasSize = cell * columns;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlasSize, atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const masks = new Map(), tile = document.createElement('canvas');
  tile.width = tile.height = cell;
  const brush = tile.getContext('2d');
  const draw = vertices => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(vertices), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 9);
  };
  draw.mask = coords => {
    const key = coords.map(point => point.map(n => n.toFixed(3)).join(',')).join(';');
    let slot = masks.get(key);
    if (slot === undefined) {
      if (masks.size === columns * columns) return null;
      slot = masks.size;
      masks.set(key, slot);
      brush.fillStyle = '#000';
      brush.fillRect(0, 0, cell, cell);
      const center = coords.reduce((a, p) => [a[0] + p[0] / coords.length, a[1] + p[1] / coords.length], [0, 0]);
      brush.beginPath();
      coords.forEach((point, i) => {
        const x = 2 + (point[0] * 0.92 + center[0] * 0.08) * (cell - 4);
        const y = 2 + (point[1] * 0.92 + center[1] * 0.08) * (cell - 4);
        if (i) brush.lineTo(x, y); else brush.moveTo(x, y);
      });
      brush.closePath();
      brush.fillStyle = '#fff';
      brush.fill();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, (slot % columns) * cell, Math.floor(slot / columns) * cell, gl.RGBA, gl.UNSIGNED_BYTE, tile);
    }
    const x = (slot % columns) * cell, y = Math.floor(slot / columns) * cell;
    return coords.map(p => [(x + 2 + p[0] * (cell - 4)) / atlasSize, (y + 2 + p[1] * (cell - 4)) / atlasSize]);
  };
  return draw;
}
