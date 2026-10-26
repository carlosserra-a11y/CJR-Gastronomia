/* ============================================================
   Fundo vivo de todas as páginas: manchas de cor que respiram e
   ingredientes desenhados a traço (folhas, grãos, ramos…) que
   flutuam em profundidades diferentes, acompanham a rolagem e
   fogem do cursor. Mais uma barra fina de progresso no topo.
   Só transform/opacity; com "reduzir movimento" fica parado.
   ============================================================ */
import { onFrame, motion } from "./motion.js";
import { finePointer } from "./util.js";

const svg = (d) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const ICONS = [
  "M10 38C10 20 22 10 40 8c0 18-10 30-28 30Zm0 0 16-16", // folha
  "M24 44V6M24 14l-7-5M24 14l7-5M24 22l-8-5M24 22l8-5M24 30l-8-5M24 30l8-5", // alecrim
  "M24 8c8 0 12 7 12 16s-4 16-12 16-12-7-12-16S16 8 24 8Zm0 0c-4 6 4 12 0 32", // grão de café
  "M16 30c0-8 6-14 13-14s9 5 9 10-6 12-13 12-9-3-9-8ZM29 16c0-5 3-8 7-9", // azeitona
  "M24 44V12M24 16c-6-2-8-6-8-10 5 0 8 3 8 8 0-5 3-8 8-8 0 4-2 8-8 10Zm0 10c-6-2-8-6-8-10 5 0 8 3 8 8 0-5 3-8 8-8 0 4-2 8-8 10Z", // trigo
  "M24 8l3 10 10-3-7 8 7 8-10-3-3 10-3-10-10 3 7-8-7-8 10 3Z", // anis-estrelado
  "M14 34c8 4 20-2 22-16 1-5 0-8-2-9-3 0-4 4-5 8-2 7-7 12-15 17ZM34 9c0-3 2-5 4-5", // pimenta
  "M24 44V26M24 26c-8-6-8-18 0-22 8 4 8 16 0 22Zm0 0c-3-6-3-16 0-22m0 22c3-6 3-16 0-22", // fouet
  "M18 6v12a6 6 0 0 0 12 0V6M24 6v14M24 24v18", // garfo
  "M24 14a10 10 0 1 1-.01 0M20 20a4 4 0 0 1 5-2", // grão de pimenta
];
const TONES = ["tone-copper", "tone-green", "tone-steel"];
const REPEL_RADIUS = 150;
const SPAN_PAD = 240; // px acima/abaixo da tela onde as peças "dão a volta"

let mounted = false;

export function initAmbient() {
  if (mounted) return;
  mounted = true;
  const layer = document.createElement("div");
  layer.className = "ambient";
  layer.setAttribute("aria-hidden", "true");
  const blobs = [1, 2, 3].map((n) => {
    const b = document.createElement("i");
    b.className = `amb-blob amb-blob-${n}`;
    layer.appendChild(b);
    return b;
  });
  const fine = finePointer();
  const count = fine ? 14 : 8;
  // posições espalhadas de modo uniforme (com um pouco de acaso) para não amontoar
  const items = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("span");
    el.className = `amb-item ${TONES[i % TONES.length]}`;
    el.innerHTML = svg(ICONS[i % ICONS.length]);
    const depth = 0.25 + ((i * 37) % 75) / 100; // 0.25 … 1
    el.style.setProperty("--s", `${Math.round(26 + depth * 40)}px`);
    el.style.setProperty("--o", (0.16 + depth * 0.18).toFixed(2));
    layer.appendChild(el);
    return {
      el, depth,
      x: ((i * 0.618 + 0.11) % 1) * 0.92 + 0.04,
      y: (i / count) * (window.innerHeight + SPAN_PAD) + Math.random() * 80,
      phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.8,
      rot: Math.random() * 360, base: (Math.random() - 0.5) * 0.25,
      ox: 0, oy: 0, spin: 0,
    };
  });
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.prepend(layer, progress);

  let docH = document.documentElement.scrollHeight;
  if ("ResizeObserver" in window) new ResizeObserver(() => { docH = document.documentElement.scrollHeight; }).observe(document.body);
  let px = -9999, py = -9999;
  if (fine) {
    window.addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", () => { px = -9999; py = -9999; });
  }

  const place = (it, x, y) => { it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${it.rot.toFixed(1)}deg)`; };
  if (motion.reduced) { items.forEach((it) => place(it, it.x * motion.vw, it.y - SPAN_PAD / 2)); }

  onFrame((m) => {
    progress.style.transform = `scaleX(${Math.min(1, m.y / Math.max(1, docH - m.vh)).toFixed(4)})`;
    if (m.reduced) return;
    const span = m.vh + SPAN_PAD;
    const k = m.dt / 16;
    for (const it of items) {
      const drift = m.time * 0.35 * it.speed + it.phase;
      const x = it.x * m.vw + Math.sin(drift) * 22;
      const y = (((it.y - m.y * it.depth * 0.4) % span) + span) % span - SPAN_PAD / 2 + Math.cos(drift * 0.8) * 16;
      // o cursor empurra as peças, que voltam devagar ao caminho
      const dx = x + it.ox - px, dy = y + it.oy - py;
      const d = Math.hypot(dx, dy);
      if (d < REPEL_RADIUS && d > 0) {
        const f = ((REPEL_RADIUS - d) / REPEL_RADIUS) * 2.4 * k;
        it.ox += (dx / d) * f * 6;
        it.oy += (dy / d) * f * 6;
        it.spin += (dx > 0 ? 1 : -1) * 0.02 * k;
      }
      it.ox *= Math.pow(0.94, k);
      it.oy *= Math.pow(0.94, k);
      it.spin += (it.base - it.spin) * 0.01 * k; // depois do empurrão, volta ao giro lento de sempre
      it.rot += (it.spin + m.velocity * 0.015 * it.depth) * k;
      place(it, x + it.ox, y + it.oy);
    }
    const t = m.y * 0.04;
    blobs[0].style.transform = `translate3d(${(m.mouse.sx - 0.5) * 40}px, ${-t}px, 0)`;
    blobs[1].style.transform = `translate3d(${(0.5 - m.mouse.sx) * 50}px, ${t * 0.6}px, 0)`;
    blobs[2].style.transform = `translate3d(0, ${-t * 1.4}px, 0)`;
  });
}
