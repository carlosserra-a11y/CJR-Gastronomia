/* ============================================================
   Folhas de palmeira desenhadas em código (SVG): o toque
   "exótico" do topo. Cada folha fica numa camada de profundidade
   — as mais próximas se movem mais com a rolagem e com o mouse.
   ============================================================ */
import { onFrame, motion } from "./motion.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n) => n.toFixed(1);

/** Caminhos SVG de uma folha: nervura central + folíolos em forma de lança, caindo com a "gravidade". */
export function frondPaths({ length = 520, bend = 0.26, leaflets = 30, seed = 1 } = {}) {
  const rand = rng(seed);
  const P0 = [0, 0], P1 = [length * 0.5, -length * bend], P2 = [length, -length * bend * 0.25];
  const at = (t) => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const tangent = (t) => {
    const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
    const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  let leaves = "";
  for (let i = 1; i <= leaflets; i++) {
    const t = 0.05 + 0.93 * (i / leaflets);
    const P = at(t);
    const T = tangent(t);
    const len = length * 0.4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.75) * (1 - t * 0.3) * (0.86 + rand() * 0.28);
    if (len < 6) continue;
    for (const side of [-1, 1]) {
      const angle = side * (1.0 - t * 0.5 + (rand() - 0.5) * 0.12);
      let [dx, dy] = rot(T, angle);
      dy += 0.38; // os folíolos pendem
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const E = [P[0] + dx * len, P[1] + dy * len];
      const w = len * 0.075 + 1.2;
      const nx = -dy, ny = dx;
      const sag = len * 0.12;
      const c1 = [P[0] + dx * len * 0.5 + nx * w, P[1] + dy * len * 0.5 + ny * w + sag];
      const c2 = [P[0] + dx * len * 0.5 - nx * w, P[1] + dy * len * 0.5 - ny * w + sag];
      leaves += `M${f1(P[0])} ${f1(P[1])}Q${f1(c1[0])} ${f1(c1[1])} ${f1(E[0])} ${f1(E[1])}Q${f1(c2[0])} ${f1(c2[1])} ${f1(P[0])} ${f1(P[1])}Z`;
    }
  }
  const rachis = `M0 0Q${f1(P1[0])} ${f1(P1[1])} ${f1(P2[0])} ${f1(P2[1])}`;
  return { leaves, rachis, box: [-20, -length * 0.75, length + 60, length * 1.2] };
}

function frondSvg(opts, gradId) {
  const { leaves, rachis, box } = frondPaths(opts);
  return `<svg viewBox="${box.map(f1).join(" ")}" aria-hidden="true" focusable="false">
    <path d="${leaves}" fill="url(#${gradId})" stroke="var(--gold)" stroke-opacity=".38" stroke-width=".7"/>
    <path d="${rachis}" fill="none" stroke="var(--gold)" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

/* Disposição: posição, giro, tamanho e profundidade (0 = fundo, 1 = perto). */
const LAYOUT = [
  { cls: "fr-a", seed: 7, length: 560, leaflets: 32, depth: 0.95 },
  { cls: "fr-b", seed: 21, length: 480, leaflets: 28, depth: 0.55 },
  { cls: "fr-c", seed: 3, length: 600, leaflets: 34, depth: 0.85 },
  { cls: "fr-d", seed: 42, length: 420, leaflets: 26, depth: 0.4 },
  { cls: "fr-e", seed: 13, length: 680, leaflets: 36, depth: 0.2 },
];

export function mountFronds(host) {
  if (!host) return () => {};
  host.innerHTML = `<svg class="fr-defs" width="0" height="0" aria-hidden="true"><defs>
      <linearGradient id="frGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1c4a37"/><stop offset=".55" stop-color="#0d2a1f"/><stop offset="1" stop-color="#06120d"/>
      </linearGradient></defs></svg>` +
    LAYOUT.map((f) => `<div class="frond ${f.cls}" data-depth="${f.depth}"><div class="frond-sway">${frondSvg(f, "frGrad")}</div></div>`).join("");

  const items = [...host.querySelectorAll(".frond")].map((el, i) => ({
    el: el.firstElementChild, depth: Number(el.dataset.depth), phase: i * 1.7,
  }));
  if (motion.reduced) return () => {};

  return onFrame((m) => {
    if (m.y > m.vh * 1.3) return; // fora da tela: não gasta
    const mx = m.mouse.sx - 0.5, my = m.mouse.sy - 0.5;
    const out = Math.min(1, m.y / m.vh);
    for (const it of items) {
      const sway = Math.sin(m.time * 0.45 + it.phase) * 1.4;
      const tx = -mx * 46 * it.depth;
      const ty = -my * 30 * it.depth + m.y * (0.12 + it.depth * 0.38);
      const rot = sway + mx * 4 * it.depth;
      const spread = 1 + out * 0.12 * it.depth;
      it.el.style.transform = `translate3d(${f1(tx)}px, ${f1(ty)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${spread.toFixed(3)})`;
    }
  });
}
