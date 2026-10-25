/* ============================================================
   Portfólio interativo:
   1) anel 3D de fotos (CSS 3D) — gira sozinho, com a rolagem e ao arrastar;
   2) grade com filtros e colunas em paralaxe;
   3) visualizador em tela cheia (setas, teclado, deslizar no celular).
   ============================================================ */
import { $, $$, html, setHTML, imgSrc } from "./util.js";
import { onFrame, motion, scan } from "./motion.js";
import { openLayer, closeLayer } from "./dialog.js";
import { ui } from "./icons.js";
import { PORTFOLIO_CATEGORIES } from "../shared/menu.js";

const RING_SIZE = 12;
const DRAG_THRESHOLD = 6; // px: abaixo disso o gesto conta como toque, não como arrasto
const SWIPE_THRESHOLD = 50;
const COLUMN_SHIFT = [0, 70, 32]; // deslocamento máximo (px) de cada coluna da grade

/** Fotos em destaque no anel: alterna as categorias para variar. */
export function ringPicks(items) {
  const byCat = new Map();
  items.forEach((p, i) => { if (!byCat.has(p.category)) byCat.set(p.category, []); byCat.get(p.category).push(i); });
  const out = [];
  for (let round = 0; out.length < Math.min(RING_SIZE, items.length); round++) {
    let added = false;
    for (const list of byCat.values()) if (list[round] !== undefined && out.length < RING_SIZE) { out.push(list[round]); added = true; }
    if (!added) break;
  }
  return out;
}

const tile = (p, index) => html`
  <figure class="pf-tile" data-reveal>
    <button type="button" class="pf-open" data-open="${index}" aria-label="Ampliar: ${p.caption || "foto do portfólio"}">
      <span class="pf-img"><img src="${imgSrc(p.thumb || p.image)}" alt="${p.caption}" loading="lazy" decoding="async" ${p.w ? html`width="${p.w}" height="${p.h}"` : ""}></span>
      <figcaption><span class="pf-cat">${PORTFOLIO_CATEGORIES[p.category] || ""}</span><span class="pf-cap">${p.caption}</span></figcaption>
    </button>
  </figure>`;

/* ---------------- Visualizador ---------------- */

function lightbox() {
  let layer = $("#lightbox");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "layer lightbox";
    layer.id = "lightbox";
    layer.hidden = true;
    setHTML(layer, html`
      <div class="layer-backdrop" data-close></div>
      <div class="lb" role="dialog" aria-modal="true" aria-label="Foto do portfólio">
        <button type="button" class="lb-btn lb-close" data-close aria-label="Fechar">${ui.close}</button>
        <button type="button" class="lb-btn lb-prev" data-lb="-1" aria-label="Foto anterior">${ui.back}</button>
        <figure class="lb-figure"><img class="lb-img" alt=""><figcaption class="lb-cap"><span class="lb-count"></span><span class="lb-text"></span></figcaption></figure>
        <button type="button" class="lb-btn lb-next" data-lb="1" aria-label="Próxima foto">${ui.arrow}</button>
      </div>`);
    document.body.appendChild(layer);
  }
  return layer;
}

function openLightbox(items, list, start) {
  const layer = lightbox();
  const box = $(".lb", layer);
  const img = $(".lb-img", layer);
  const text = $(".lb-text", layer);
  let pos = Math.max(0, list.indexOf(start));
  const show = (dir = 0) => {
    const p = items[list[pos]];
    img.classList.remove("is-in");
    img.style.setProperty("--from", `${dir * 40}px`);
    img.onload = () => requestAnimationFrame(() => img.classList.add("is-in"));
    img.onerror = () => { img.classList.add("is-in"); text.textContent = "Não foi possível carregar esta foto."; };
    img.src = imgSrc(p.image);
    img.alt = p.caption || "Foto do portfólio";
    $(".lb-count", layer).textContent = `${pos + 1} / ${list.length}`;
    text.textContent = p.caption || "";
    [list[pos + 1], list[pos - 1]].forEach((n) => { if (n !== undefined) new Image().src = imgSrc(items[n].image); });
  };
  const go = (d) => { pos = (pos + d + list.length) % list.length; show(d); };
  const onKey = (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
  let sx = null, swiped = false;
  const onClick = (e) => {
    if (swiped) { swiped = false; return; } // o deslizar já trocou a foto
    const b = e.target.closest("[data-lb]");
    if (b) { go(Number(b.dataset.lb)); return; }
    // a área escura em volta da foto cobre o fundo: clicar nela também fecha
    if (e.target === box || e.target.classList.contains("lb-figure")) closeLayer(layer);
  };
  const down = (e) => { sx = e.isPrimary ? e.clientX : null; };
  const up = (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > SWIPE_THRESHOLD) { go(e.clientX < sx ? 1 : -1); swiped = true; }
    sx = null;
  };
  const cancel = () => { sx = null; };
  document.addEventListener("keydown", onKey);
  layer.addEventListener("click", onClick);
  layer.addEventListener("pointerdown", down);
  layer.addEventListener("pointerup", up);
  layer.addEventListener("pointercancel", cancel);
  show();
  openLayer(layer, {
    initialFocus: ".lb-next",
    onClose: () => {
      document.removeEventListener("keydown", onKey);
      layer.removeEventListener("click", onClick);
      layer.removeEventListener("pointerdown", down);
      layer.removeEventListener("pointerup", up);
      layer.removeEventListener("pointercancel", cancel);
    },
  });
}

/* ---------------- Anel 3D ---------------- */

function mountRing(stage, onOpen) {
  const ring = stage && $(".ring", stage);
  const cards = stage ? $$(".ring-card", stage) : [];
  if (!ring || !cards.length) return () => {};
  const step = 360 / cards.length;
  let angle = 0, vel = 0, dragging = false, lastX = 0, moved = 0, lastY = motion.y;
  let hover = false, focused = false, suppressClick = false, front = -1;

  const down = (e) => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest("[data-ring]")) return;
    dragging = true; moved = 0; lastX = e.clientX; stage.classList.add("is-dragging");
  };
  const move = (e) => {
    if (!dragging || !e.isPrimary) return;
    const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    angle -= dx * 0.25; vel = -dx * 0.25;
  };
  // fim do gesto; no celular, rolar a página por cima do anel termina em pointercancel (sem pointerup)
  const end = () => {
    if (!dragging) return;
    dragging = false; stage.classList.remove("is-dragging");
    if (moved >= DRAG_THRESHOLD) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  };
  // abrir pelo clique do próprio botão: vale para toque, Enter, Espaço e leitores de tela
  const click = (e) => {
    const nudge = e.target.closest("[data-ring]");
    if (nudge) { vel += Number(nudge.dataset.ring) * step * 0.12; return; }
    const card = e.target.closest(".ring-card");
    if (card && !suppressClick) onOpen(Number(card.dataset.index));
  };
  const key = (e) => {
    if (e.key === "ArrowLeft") { vel -= step * 0.12; e.preventDefault(); }
    if (e.key === "ArrowRight") { vel += step * 0.12; e.preventDefault(); }
  };
  const enter = () => { hover = true; };
  const leave = () => { hover = false; };
  const focusIn = () => { focused = true; };
  const focusOut = (e) => { focused = stage.contains(e.relatedTarget); };
  stage.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  stage.addEventListener("click", click);
  stage.addEventListener("keydown", key);
  stage.addEventListener("pointerenter", enter);
  stage.addEventListener("pointerleave", leave);
  stage.addEventListener("focusin", focusIn);
  stage.addEventListener("focusout", focusOut);

  const stop = onFrame((m) => {
    const r = stage.getBoundingClientRect();
    if (r.bottom < -100 || r.top > m.vh + 100) { lastY = m.y; return; }
    if (!dragging) {
      angle += vel; vel *= 0.94;
      // rolagem + giro lento; o giro para com o mouse em cima ou com o foco do teclado no anel
      if (!m.reduced) angle += (m.y - lastY) * 0.06 + (hover || focused ? 0 : 0.04) * (m.dt / 16);
    }
    lastY = m.y;
    ring.style.transform = `translateZ(calc(var(--r) * -1)) rotateY(${(-angle).toFixed(2)}deg)`;
    let nowFront = front;
    for (let i = 0; i < cards.length; i++) { // cartões de costas ficam mais apagados
      const rel = ((i * step - angle) % 360 + 540) % 360 - 180;
      const facing = Math.cos((rel * Math.PI) / 180);
      const isFront = Math.abs(rel) < step / 2;
      cards[i].style.opacity = (0.2 + 0.8 * Math.max(0, facing)).toFixed(2);
      cards[i].classList.toggle("is-front", isFront);
      cards[i].tabIndex = isFront ? 0 : -1;
      if (isFront) nowFront = i;
    }
    // girou com as setas: o foco acompanha o cartão que ficou na frente
    if (nowFront !== front) {
      if (front >= 0 && document.activeElement === cards[front]) cards[nowFront].focus({ preventScroll: true });
      front = nowFront;
    }
  });
  return () => {
    stop();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
  };
}

/* ---------------- Grade com filtros ---------------- */

export function mountPortfolio(root, items) {
  if (!root || !items?.length) return () => {};
  const grid = $(".pf-grid", root);
  const filters = $(".pf-filters", root);
  let current = "todos";
  let visible = items.map((_, i) => i);
  let columnEls = [];
  let switchTimer = 0;

  const columns = () => (window.innerWidth >= 1000 ? 3 : 2);
  function build() {
    const n = columns();
    const cols = Array.from({ length: n }, () => []);
    visible.forEach((idx, k) => cols[k % n].push(tile(items[idx], idx)));
    setHTML(grid, cols.map((c) => html`<div class="pf-col">${c}</div>`));
    columnEls = $$(".pf-col", grid);
    scan(grid);
  }
  build();

  // Paralaxe das colunas pelo progresso da grade na tela (0 → 1): começam desencontradas e se alinham no meio.
  // Limitado em px porque as colunas são muito mais altas que a tela.
  const stopColumns = onFrame((m) => {
    if (m.reduced) return;
    const r = grid.getBoundingClientRect();
    if (r.bottom < 0 || r.top > m.vh) return;
    const progress = Math.min(1, Math.max(0, (m.vh - r.top) / (m.vh + r.height)));
    const damp = m.vw < 720 ? 0.6 : 1;
    columnEls.forEach((col, i) => {
      const y = (COLUMN_SHIFT[i] || 0) * (1 - 2 * progress) * damp;
      col.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  });

  const onFilter = (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b || b.dataset.filter === current) return;
    current = b.dataset.filter;
    $$("[data-filter]", filters).forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    visible = items.map((p, i) => (current === "todos" || p.category === current ? i : -1)).filter((i) => i >= 0);
    grid.classList.add("is-switching");
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => { build(); grid.classList.remove("is-switching"); }, motion.reduced ? 0 : 220);
  };
  const onOpen = (e) => { const b = e.target.closest("[data-open]"); if (b) openLightbox(items, visible, Number(b.dataset.open)); };
  let lastCols = columns();
  const onResize = () => { if (columns() !== lastCols) { lastCols = columns(); build(); } };

  filters?.addEventListener("click", onFilter);
  grid.addEventListener("click", onOpen);
  window.addEventListener("resize", onResize);
  const stopRing = mountRing($(".ring-stage", root), (idx) => openLightbox(items, items.map((_, i) => i), idx));

  return () => {
    stopRing();
    stopColumns();
    clearTimeout(switchTimer);
    window.removeEventListener("resize", onResize);
  };
}
