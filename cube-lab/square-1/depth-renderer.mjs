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
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
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
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(vertices), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 7);
  };
}
