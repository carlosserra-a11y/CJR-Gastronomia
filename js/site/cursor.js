/* ============================================================
   Detalhes de interação (só com mouse): cursor dourado que segue
   com atraso, botões "magnéticos" e cartões que inclinam em 3D
   com uma luz no ponto do cursor.
   ============================================================ */
import { onFrame, motion } from "./motion.js";
import { finePointer } from "./util.js";

export function initCursor() {
  if (!finePointer() || motion.reduced) return;
  const root = document.documentElement;
  root.classList.add("has-cursor");
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  const label = document.querySelector(".cursor-label");
  if (!dot || !ring) return;

  let x = -100, y = -100, rx = -100, ry = -100;
  window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => root.classList.add("cursor-out"));
  document.addEventListener("pointerenter", () => root.classList.remove("cursor-out"));
  document.addEventListener("pointerdown", () => root.classList.add("cursor-down"));
  document.addEventListener("pointerup", () => root.classList.remove("cursor-down"));

  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-cursor], a, button, label, select, input, textarea");
    root.classList.toggle("cursor-hover", Boolean(t));
    const text = t?.closest("[data-cursor]")?.dataset.cursor || "";
    root.classList.toggle("cursor-label-on", Boolean(text));
    if (label) label.textContent = text;
  });

  onFrame((m) => {
    const k = 1 - Math.pow(0.8, m.dt / 16);
    rx += (x - rx) * k; ry += (y - ry) * k;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
  });

  // Botões magnéticos
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest(".magnetic");
    document.querySelectorAll(".magnetic.is-pulled").forEach((m) => { if (m !== el) { m.style.transform = ""; m.classList.remove("is-pulled"); } });
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    el.classList.add("is-pulled");
    el.style.transform = `translate(${(dx * 10).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`;
  }, { passive: true });

  // Cartões com inclinação 3D + luz
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".tilt");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--rx", `${((0.5 - py) * 7).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
  }, { passive: true });
  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".tilt");
    if (card && !card.contains(e.relatedTarget)) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
  });
}
