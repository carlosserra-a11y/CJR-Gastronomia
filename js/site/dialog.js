/* Camadas (diálogo e menu do celular) acessíveis: foco preso, Esc fecha, foco volta ao botão de origem. */
import { pauseScroll, resumeScroll } from "./motion.js";

const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openLayer(layer, { onClose, initialFocus } = {}) {
  if (stack.some((s) => s.layer === layer)) return;
  stack.push({ layer, onClose, returnTo: document.activeElement });
  layer.hidden = false;
  requestAnimationFrame(() => layer.classList.add("is-open"));
  document.documentElement.classList.add("layer-open");
  pauseScroll();
  requestAnimationFrame(() => {
    const target = (initialFocus && layer.querySelector(initialFocus)) || layer.querySelector(FOCUSABLE);
    target?.focus({ preventScroll: true });
  });
}

export function closeLayer(layer) {
  const i = stack.findIndex((s) => s.layer === layer);
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  layer.classList.remove("is-open");
  setTimeout(() => { if (!layer.classList.contains("is-open")) layer.hidden = true; }, 380);
  if (!stack.length) { document.documentElement.classList.remove("layer-open"); resumeScroll(); }
  entry.onClose?.();
  if (entry.returnTo && document.contains(entry.returnTo)) entry.returnTo.focus?.({ preventScroll: true });
}

export const closeAll = () => [...stack].reverse().forEach((s) => closeLayer(s.layer));

document.addEventListener("keydown", (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") { e.preventDefault(); closeLayer(top.layer); return; }
  if (e.key !== "Tab") return;
  const items = [...top.layer.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

document.addEventListener("click", (e) => {
  const closer = e.target.closest("[data-close]");
  const layer = closer?.closest(".layer");
  if (layer) closeLayer(layer);
});
