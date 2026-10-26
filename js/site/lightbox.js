/* ============================================================
   Visualizador de fotos em tela cheia (portfólio).
   - A foto aparece sempre INTEIRA: fica centralizada numa área de
     altura definida (topo e legenda à parte) e nunca passa da tela.
   - Abre na hora com a miniatura e troca pela versão em alta assim
     que ela chega.
   - Ampliar: toque/clique duplo, pinça com dois dedos ou botão de lupa;
     ampliada, arrasta para passear pela foto.
   - "Parado" ou "Automático" (lembrado neste aparelho), setas, teclado,
     deslizar para trocar, arrastar para baixo para fechar.
   ============================================================ */
import { $, $$, html, raw, setHTML, imgSrc, storage } from "./util.js";
import { openLayer, closeLayer } from "./dialog.js";
import { ui } from "./icons.js";
import { PORTFOLIO_CATEGORIES } from "../shared/menu.js";
import { whatsappUrl } from "../shared/quote.js";
import { photoId } from "../shared/analytics.js";
import { track } from "./track.js";

const AUTOPLAY_MS = 4500;
const AUTO_KEY = "cjr:lb-auto";
const SWIPE_THRESHOLD = 50;
const CLOSE_DRAG = 110; // px arrastando a foto para baixo para fechar
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 320;
const ZOOM_STEP = 2.5;
const ZOOM_MAX = 5;

const zoomIcon = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.5 11h5M11 8.5v5"/></svg>');

function lightbox() {
  let layer = $("#lightbox");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "layer lightbox";
  layer.id = "lightbox";
  layer.hidden = true;
  setHTML(layer, html`
    <div class="layer-backdrop" data-close></div>
    <div class="lb" role="dialog" aria-modal="true" aria-label="Foto do portfólio">
      <div class="lb-bar" aria-hidden="true"><i></i></div>
      <div class="lb-top">
        <span class="lb-count"></span>
        <div class="lb-mode" role="group" aria-label="Como passar as fotos">
          <button type="button" data-lb-mode="still" aria-pressed="true">Parado</button>
          <button type="button" data-lb-mode="auto" aria-pressed="false">Automático</button>
        </div>
        <button type="button" class="lb-btn lb-zoom" data-lb-zoom aria-pressed="false" aria-label="Ampliar a foto">${zoomIcon}</button>
        <button type="button" class="lb-btn lb-close" data-close aria-label="Fechar">${ui.close}</button>
      </div>
      <div class="lb-stage">
        <img class="lb-img" alt="" draggable="false">
        <span class="lb-loading" aria-hidden="true"></span>
        <button type="button" class="lb-btn lb-prev" data-lb="-1" aria-label="Foto anterior">${ui.back}</button>
        <button type="button" class="lb-btn lb-next" data-lb="1" aria-label="Próxima foto">${ui.arrow}</button>
      </div>
      <div class="lb-cap">
        <span class="lb-text"></span>
        <a class="lb-cta" target="_blank" rel="noopener" hidden>${ui.whats}<span>Quero algo assim</span></a>
        <span class="lb-hint lb-hint-touch">Deslize para trocar · toque duas vezes ou pince para ampliar · arraste para baixo para fechar</span>
        <span class="lb-hint lb-hint-mouse">Clique duas vezes para ampliar · setas do teclado para trocar · Esc para fechar</span>
      </div>
    </div>`);
  document.body.appendChild(layer);
  return layer;
}

export function openLightbox(items, list, startIndex, { whatsapp } = {}) {
  const layer = lightbox();
  const stage = $(".lb-stage", layer);
  const img = $(".lb-img", layer);
  const text = $(".lb-text", layer);
  const cta = $(".lb-cta", layer);
  const bar = $(".lb-bar i", layer);
  const zoomBtn = $("[data-lb-zoom]", layer);
  let pos = Math.max(0, list.indexOf(startIndex));
  let auto = false, elapsed = 0, lastT = 0, raf = 0, token = 0, holding = false;
  let zoom = 1, tx = 0, ty = 0, dragY = 0;

  /* ----- ampliar e passear ----- */
  const paint = (animate = true) => {
    img.classList.toggle("is-panning", !animate);
    img.style.transform = zoom === 1 && !dragY ? "" : `translate(${tx}px, ${ty + dragY}px) scale(${zoom})`;
  };
  const clampPan = () => {
    const maxX = Math.max(0, (img.offsetWidth * zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * zoom - stage.clientHeight) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };
  // amplia mantendo embaixo do dedo/cursor o ponto tocado
  const setZoom = (z, cx, cy) => {
    const next = Math.min(ZOOM_MAX, Math.max(1, z));
    if (next === 1) { zoom = 1; tx = 0; ty = 0; }
    else {
      const r = stage.getBoundingClientRect();
      const ox = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2);
      const oy = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
      tx = ox - ((ox - tx) * next) / zoom;
      ty = oy - ((oy - ty) * next) / zoom;
      zoom = next;
      clampPan();
    }
    layer.classList.toggle("is-zoomed", zoom > 1);
    zoomBtn.setAttribute("aria-pressed", String(zoom > 1));
    zoomBtn.setAttribute("aria-label", zoom > 1 ? "Ver a foto inteira" : "Ampliar a foto");
    paint();
  };

  /* ----- foto: miniatura na hora, versão em alta logo depois ----- */
  const show = (dir = 0) => {
    const mine = ++token;
    const p = items[list[pos]];
    setZoom(1);
    img.classList.remove("is-in");
    img.style.setProperty("--from", `${dir * 40}px`);
    const low = imgSrc(p.thumb || p.image), high = imgSrc(p.image);
    img.onload = () => requestAnimationFrame(() => img.classList.add("is-in"));
    img.onerror = () => { img.classList.add("is-in"); text.textContent = "Não foi possível carregar esta foto."; };
    img.classList.toggle("is-low", low !== high);
    layer.classList.toggle("is-loading", low !== high);
    img.src = low;
    img.alt = p.caption || "Foto do portfólio";
    if (low !== high) {
      const hi = new Image();
      hi.decoding = "async";
      hi.onload = () => { if (mine !== token) return; img.src = high; img.classList.remove("is-low"); layer.classList.remove("is-loading"); };
      hi.onerror = () => { if (mine === token) layer.classList.remove("is-loading"); };
      hi.src = high;
    }
    $(".lb-count", layer).textContent = `${pos + 1} / ${list.length}`;
    text.textContent = p.caption || "";
    const category = PORTFOLIO_CATEGORIES[p.category] || "portfólio";
    const wa = whatsappUrl(whatsapp, `Olá, Chef Carlos! Vi no portfólio do site a foto "${p.caption || category}" (${category}) e quero algo assim no meu evento.`);
    cta.hidden = !wa;
    if (wa) cta.href = wa;
    cta.dataset.lead = "portfolio";
    cta.dataset.leadInfo = JSON.stringify({ photo: photoId(p) });
    track("photo", { id: photoId(p) });
    elapsed = 0;
    [list[pos + 1], list[pos - 1]].forEach((n) => { if (n !== undefined) new Image().src = imgSrc(items[n].image); });
  };
  const go = (d) => { pos = (pos + d + list.length) % list.length; show(d); };

  /* ----- Parado / Automático ----- */
  const tick = (t) => {
    if (!auto) return;
    const dt = Math.min(100, t - lastT);
    lastT = t;
    if (zoom === 1 && !holding) elapsed += dt; // ampliada ou com o dedo na foto: espera
    bar.style.transform = `scaleX(${Math.min(1, elapsed / AUTOPLAY_MS).toFixed(3)})`;
    if (elapsed >= AUTOPLAY_MS) go(1);
    raf = requestAnimationFrame(tick);
  };
  const setAuto = (on, { remember = true } = {}) => {
    auto = on && list.length > 1;
    if (remember) storage.set(AUTO_KEY, auto);
    $$("[data-lb-mode]", layer).forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.lbMode === "auto") === auto)));
    layer.classList.toggle("is-auto", auto);
    cancelAnimationFrame(raf);
    elapsed = 0;
    bar.style.transform = "scaleX(0)";
    if (auto) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  };

  /* ----- gestos ----- */
  const pointers = new Map();
  let start = null, moved = false, panFrom = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 };
  const resetDrag = () => { dragY = 0; img.style.opacity = ""; paint(); };
  const down = (e) => {
    if (!stage.contains(e.target) || e.target.closest("button") || e.button > 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.setPointerCapture?.(e.pointerId);
    holding = true;
    if (pointers.size === 2) { // pinça com dois dedos
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      start = null; resetDrag();
      return;
    }
    start = { x: e.clientX, y: e.clientY };
    moved = false;
    panFrom = { tx, ty };
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist, pinch.cx, pinch.cy);
      paint(false);
      return;
    }
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
    if (zoom > 1) { tx = panFrom.tx + dx; ty = panFrom.ty + dy; clampPan(); paint(false); return; }
    if (Math.abs(dy) > Math.abs(dx)) { // arrastando para baixo: a foto acompanha (e volta se o dedo subir)
      dragY = Math.max(0, dy);
      img.style.opacity = String(Math.max(0.35, 1 - dragY / 420));
      paint(false);
    }
  };
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch) { if (!pointers.size) { pinch = null; holding = false; } return; }
    holding = pointers.size > 0;
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (zoom === 1 && dragY > CLOSE_DRAG) { resetDrag(); closeLayer(layer); return; }
    resetDrag();
    if (zoom === 1 && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return; }
    if (moved) return;
    if (e.target === img) { // dois toques rápidos: amplia no ponto tocado (ou volta à foto inteira)
      const now = performance.now();
      if (now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        setZoom(zoom > 1 ? 1 : ZOOM_STEP, e.clientX, e.clientY);
        lastTap.t = 0;
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    } else if (e.target === stage && zoom === 1) closeLayer(layer); // toque na área escura em volta: fecha
  };
  const cancel = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) { pinch = null; start = null; holding = false; resetDrag(); }
  };
  const onWheel = (e) => { // computador: Ctrl + rodinha amplia
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX, e.clientY);
  };
  const onClick = (e) => {
    const mode = e.target.closest("[data-lb-mode]");
    if (mode) { setAuto(mode.dataset.lbMode === "auto"); return; }
    if (e.target.closest("[data-lb-zoom]")) { setZoom(zoom > 1 ? 1 : ZOOM_STEP); return; }
    const nav = e.target.closest("[data-lb]");
    if (nav) go(Number(nav.dataset.lb));
  };
  const onKey = (e) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "+" || e.key === "=") setZoom(zoom * 1.5);
    if (e.key === "-") setZoom(zoom / 1.5);
  };
  const onResize = () => { clampPan(); paint(); };

  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  layer.addEventListener("click", onClick);
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", cancel);
  stage.addEventListener("wheel", onWheel, { passive: false });
  show();
  setAuto(storage.get(AUTO_KEY, false) === true, { remember: false });
  openLayer(layer, {
    initialFocus: ".lb-next",
    onClose: () => {
      setAuto(false, { remember: false });
      setZoom(1);
      pointers.clear();
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      layer.removeEventListener("click", onClick);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", cancel);
      stage.removeEventListener("wheel", onWheel);
    },
  });
}
