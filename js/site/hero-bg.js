/* ============================================================
   Fundo interativo (WebGL, sem bibliotecas): "seda" verde-escura
   em movimento, linhas douradas finas, pó dourado subindo e luz
   que segue o mouse. Um toque cria uma onda. Fica fixo atrás da
   página inteira e escurece conforme a rolagem desce.
   Sem WebGL ou com "reduzir movimento": fundo em CSS (html.no-webgl).
   ============================================================ */
import { onFrame, motion } from "./motion.js";

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uFade;
uniform vec3 uClick;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float dust(vec2 p, float scale, float speed, float seed){
  p *= scale;
  p.y -= uTime * speed;
  p.x += sin(p.y * 0.35 + uTime * 0.25 + seed) * 0.35;
  vec2 id = floor(p);
  vec2 g = fract(p) - 0.5;
  float h = hash(id + seed);
  vec2 o = vec2(hash(id + 3.1 + seed), hash(id + 7.7 + seed)) - 0.5;
  float d = length(g - o * 0.7);
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + h * 2.5) + h * 40.0);
  return step(0.9, h) * smoothstep(0.075, 0.0, d) * tw;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  float t = uTime * 0.045;

  p.y -= uScroll * 0.32;               // paralaxe: o fundo anda mais devagar que o conteúdo
  vec2 pm = p + vec2(0.0, uScroll * 0.32);

  // o mouse "puxa" o tecido
  vec2 dm = pm - m;
  float md = exp(-dot(dm, dm) * 4.0);
  p += dm * md * 0.22;

  // onda do clique
  vec2 cm = (uClick.xy - 0.5) * vec2(aspect, 1.0);
  float age = uTime - uClick.z;
  float ring = 0.0;
  if (age >= 0.0 && age < 3.0) {
    float rd = length(pm - cm);
    ring = exp(-pow((rd - age * 0.55) * 10.0, 2.0)) * exp(-age * 1.4);
    p += normalize(pm - cm + 1e-4) * ring * 0.05;
  }

  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm(p * 1.5 + 3.2 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(p * 1.5 + 3.2 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p * 1.15 + 3.0 * r);

  vec3 c0 = vec3(0.010, 0.018, 0.014);
  vec3 c1 = vec3(0.030, 0.095, 0.068);
  vec3 c2 = vec3(0.070, 0.205, 0.148);
  vec3 gold = vec3(0.79, 0.67, 0.44);

  vec3 col = mix(c0, c1, smoothstep(0.18, 0.78, f));
  col = mix(col, c2, smoothstep(0.62, 1.05, f * length(q) * 1.35));

  // linhas douradas (como curvas de nível na seda)
  float band = fract(f * 4.2 + r.x * 0.5);
  float ridge = pow(1.0 - abs(band * 2.0 - 1.0), 22.0);
  col += gold * ridge * (0.045 + 0.32 * md + 0.6 * ring) * smoothstep(0.2, 0.7, f);

  // brilho suave em volta do mouse
  col += vec3(0.05, 0.13, 0.09) * md * 0.55;

  // pó dourado em duas profundidades (a mais próxima reage mais à rolagem)
  vec2 dp = (uv - 0.5) * vec2(aspect, 1.0);
  col += gold * dust(dp + vec2(0.0, -uScroll * 0.25), 8.0, 0.05, 1.0) * 0.55;
  col += gold * dust(dp + vec2(3.0, -uScroll * 0.55), 14.0, 0.03, 9.0) * 0.35;

  // vinheta e escurecimento ao descer a página
  float vig = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(aspect * 0.8, 1.0)));
  col *= mix(0.45, 1.0, vig);
  col = mix(c0 * 0.8, col, uFade);

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

export function initHeroBackground(canvas, { onClickTarget } = {}) {
  const fail = () => document.documentElement.classList.add("no-webgl");
  const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return fail();

  let prog, u;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch { return fail(); }

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  u = Object.fromEntries(["uRes", "uTime", "uMouse", "uScroll", "uFade", "uClick"].map((n) => [n, gl.getUniformLocation(prog, n)]));

  // Resolução reduzida (o desenho é suave; o CSS estica). Cai sozinha se o aparelho sofrer.
  let scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 720 ? 0.45 : 0.6);
  const resize = () => {
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const click = [0.5, 0.5, -10];
  const clickZone = onClickTarget || document.body;
  clickZone.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button, input, select, textarea, label, [data-no-ripple]")) return;
    click[0] = e.clientX / window.innerWidth;
    click[1] = 1 - e.clientY / window.innerHeight;
    click[2] = performance.now() / 1000;
  });

  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; fail(); });

  const draw = (time) => {
    if (lost) return;
    const vh = motion.vh || window.innerHeight;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uMouse, motion.mouse.sx, 1 - motion.mouse.sy);
    gl.uniform1f(u.uScroll, motion.y / vh);
    gl.uniform1f(u.uFade, Math.max(0.42, 1 - motion.y / (vh * 2.4)));
    gl.uniform3f(u.uClick, click[0], click[1], click[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  document.documentElement.classList.add("has-webgl");
  if (motion.reduced) { draw(12); window.addEventListener("resize", () => draw(12)); return; }

  // Qualidade adaptativa: mede os quadros e reduz a resolução quando estão lentos.
  let acc = 0, frames = 0;
  onFrame((m) => {
    acc += m.dt; frames++;
    if (frames === 90) {
      const avg = acc / frames;
      if (avg > 24 && scale > 0.28) { scale *= 0.8; resize(); }
      acc = 0; frames = 0;
    }
    draw(performance.now() / 1000);
  });
}
