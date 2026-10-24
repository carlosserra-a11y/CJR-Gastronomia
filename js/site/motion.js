/* ============================================================
   Movimento: rolagem suave (Lenis), UM laço de animação para o
   site inteiro, paralaxe por atributo e revelações na rolagem.

   Atributos aceitos no HTML:
     data-speed="0.2"     desloca no eixo Y conforme a rolagem
     data-speed-x="-0.3"  desloca no eixo X conforme a rolagem
     data-reveal          ganha .is-in quando entra na tela
   Com "reduzir movimento" nada se mexe e tudo aparece direto.
   ============================================================ */
import Lenis from "../vendor/lenis.mjs";
import { reducedMotion } from "./util.js";

const NARROW = 720; // abaixo disso, paralaxe mais contida (celular)

export const motion = {
  y: 0, vh: window.innerHeight, vw: window.innerWidth, velocity: 0, time: 0, dt: 16,
  mouse: { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, moved: false },
  reduced: reducedMotion(),
};

const subscribers = new Set();
let lenis = null;
let parallax = [];
let revealObserver = null;
let lastT = 0;

export const onFrame = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };

export function initMotion() {
  if (!motion.reduced) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on("scroll", (e) => { motion.velocity = e.velocity; });
  }
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("pointermove", (e) => {
    motion.mouse.x = e.clientX / window.innerWidth;
    motion.mouse.y = e.clientY / window.innerHeight;
    motion.mouse.moved = true;
  }, { passive: true });
  revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); revealObserver.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 })
    : null;
  requestAnimationFrame(loop);
}

function loop(t) {
  motion.dt = Math.min(64, t - lastT || 16);
  lastT = t;
  motion.time = t / 1000;
  lenis?.raf(t);
  motion.y = window.scrollY;
  if (!lenis) motion.velocity *= 0.9;
  const k = 1 - Math.pow(0.93, motion.dt / 16);
  motion.mouse.sx += (motion.mouse.x - motion.mouse.sx) * k;
  motion.mouse.sy += (motion.mouse.y - motion.mouse.sy) * k;
  if (!motion.reduced) applyParallax();
  for (const fn of subscribers) fn(motion);
  requestAnimationFrame(loop);
}

/* ---------- Paralaxe ---------- */

function applyParallax() {
  const center = motion.y + motion.vh / 2;
  const damp = motion.vw < NARROW ? 0.45 : 1;
  for (const p of parallax) {
    const d = p.center - center;
    if (Math.abs(d) > motion.vh * 1.6) continue;
    const ty = -d * p.speed * damp;
    const tx = -d * p.speedX * damp;
    if (Math.abs(ty - p.ty) < 0.1 && Math.abs(tx - p.tx) < 0.1) continue;
    p.ty = ty; p.tx = tx;
    p.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
  }
}

/** Mede as posições (no documento, sem o deslocamento aplicado). */
export function measure() {
  motion.vh = window.innerHeight;
  motion.vw = window.innerWidth;
  const y = window.scrollY;
  for (const p of parallax) {
    const r = p.el.getBoundingClientRect();
    p.center = r.top + y - p.ty + r.height / 2;
  }
}

/** Reconhece os elementos animados de uma área recém-desenhada (troca de página). */
export function scan(root = document) {
  parallax = parallax.filter((p) => document.contains(p.el));
  for (const el of root.querySelectorAll("[data-speed], [data-speed-x]")) {
    if (parallax.some((p) => p.el === el)) continue;
    parallax.push({ el, speed: Number(el.dataset.speed) || 0, speedX: Number(el.dataset.speedX) || 0, center: 0, ty: 0, tx: 0 });
  }
  for (const el of root.querySelectorAll("[data-reveal]:not(.is-in)")) {
    if (motion.reduced || !revealObserver) el.classList.add("is-in");
    else revealObserver.observe(el);
  }
  measure();
  // imagens e fontes mudam a altura da página depois de carregar
  setTimeout(measure, 400);
  setTimeout(measure, 1500);
}

/* ---------- Rolagem ---------- */

export function scrollTo(target, { immediate = false, offset = -90 } = {}) {
  if (lenis) lenis.scrollTo(target, { immediate, offset: typeof target === "number" ? 0 : offset, duration: 1.4 });
  else if (typeof target === "number") window.scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" });
  else target?.scrollIntoView({ behavior: immediate || motion.reduced ? "instant" : "smooth", block: "start" });
}

export const pauseScroll = () => lenis?.stop();
export const resumeScroll = () => lenis?.start();

/** Progresso (0 → 1) de um elemento atravessando a tela: 0 quando o topo entra por baixo, 1 quando o fim sai por cima. */
export function progressOf(el) {
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, (motion.vh - r.top) / (r.height + motion.vh)));
}
