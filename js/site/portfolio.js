/* ============================================================
   Portfólio interativo:
   1) anel 3D de fotos (CSS 3D) — gira sozinho, com a rolagem e ao arrastar;
   2) grade com filtros, "carregar mais", colunas em paralaxe e cartões que
      inclinam com o mouse;
   3) visualizador em tela cheia (lightbox.js).
   ============================================================ */
import { $, $$, html, setHTML, imgSrc, finePointer } from "./util.js";
import { onFrame, motion, scan } from "./motion.js";
import { openLightbox } from "./lightbox.js";
import { PORTFOLIO_CATEGORIES } from "../shared/menu.js";

const RING_SIZE = 12;
const DRAG_THRESHOLD = 6; // px: abaixo disso o gesto conta como toque, não como arrasto
const COLUMN_SHIFT = [0, 70, 32]; // deslocamento máximo (px) de cada coluna da grade
const TILE_GAP = 16;
const pageSize = () => (window.innerWidth < 760 ? 8 : 12);

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

const tile = (p, index, order) => html`
  <figure class="pf-tile" data-reveal style="--i:${order % 6}">
    <button type="button" class="pf-open" data-open="${index}" aria-label="Ampliar: ${p.caption || "foto do portfólio"}">
      <span class="pf-img"><img src="${imgSrc(p.thumb || p.image)}" alt="${p.caption}" loading="lazy" decoding="async" ${p.w ? html`width="${p.w}" height="${p.h}"` : ""}></span>
      <figcaption><span class="pf-cat">${PORTFOLIO_CATEGORIES[p.category] || ""}</span><span class="pf-cap">${p.caption}</span></figcaption>
    </button>
  </figure>`;

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

/** Cartões da grade inclinam e ganham um brilho no ponto do mouse (só com mouse). */
function mountTilt(grid) {
  if (!finePointer() || motion.reduced) return () => {};
  let active = null;
  const reset = () => { if (active) { active.classList.remove("is-tilting"); active.style.setProperty("--rx", "0deg"); active.style.setProperty("--ry", "0deg"); active = null; } };
  const onMove = (e) => {
    const card = e.target.closest(".pf-open");
    if (card !== active) reset();
    if (!card) return;
    active = card;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.classList.add("is-tilting");
    card.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${((0.5 - y) * 9).toFixed(2)}deg`);
    card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  };
  grid.addEventListener("pointermove", onMove);
  grid.addEventListener("pointerleave", reset);
  return () => { grid.removeEventListener("pointermove", onMove); grid.removeEventListener("pointerleave", reset); };
}

export function mountPortfolio(root, items, { whatsapp } = {}) {
  if (!root || !items?.length) return () => {};
  const grid = $(".pf-grid", root);
  const filters = $(".pf-filters", root);
  const moreBox = $(".pf-more", root);
  let current = "todos";
  let visible = items.map((_, i) => i);
  let columnEls = [], colHeights = [];
  let shownCount = 0;
  let switchTimer = 0;
  const open = (list, idx) => openLightbox(items, list, idx, { whatsapp });

  const columns = () => (window.innerWidth >= 1000 ? 3 : 2);
  // cada foto vai para a coluna mais curta (pela proporção da foto), para as colunas ficarem equilibradas
  function append(indices) {
    const colW = columnEls[0]?.clientWidth || 300;
    indices.forEach((idx, order) => {
      const p = items[idx];
      const k = colHeights.indexOf(Math.min(...colHeights));
      const holder = document.createElement("div");
      setHTML(holder, tile(p, idx, order));
      columnEls[k].appendChild(holder.firstElementChild);
      colHeights[k] += (p.w && p.h ? (colW * p.h) / p.w : colW * 1.25) + TILE_GAP;
    });
    scan(grid);
  }
  function updateMore() {
    if (!moreBox) return;
    const total = visible.length;
    moreBox.hidden = shownCount >= total;
    $(".pf-count", moreBox).textContent = `Mostrando ${shownCount} de ${total} fotos`;
    $(".pf-progress i", moreBox).style.transform = `scaleX(${total ? (shownCount / total).toFixed(3) : 1})`;
    const next = Math.min(pageSize(), total - shownCount);
    $("[data-more] span", moreBox).textContent = next > 0 ? `Ver mais ${next} fotos` : "Ver mais fotos";
  }
  function build() {
    const n = columns();
    setHTML(grid, Array.from({ length: n }, () => html`<div class="pf-col"></div>`));
    columnEls = $$(".pf-col", grid);
    colHeights = new Array(n).fill(0);
    shownCount = Math.min(Math.max(shownCount, pageSize()), visible.length);
    append(visible.slice(0, shownCount));
    updateMore();
  }
  shownCount = pageSize();
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
    switchTimer = setTimeout(() => { shownCount = pageSize(); build(); grid.classList.remove("is-switching"); }, motion.reduced ? 0 : 220);
  };
  const onMore = (e) => {
    if (!e.target.closest("[data-more]")) return;
    const next = visible.slice(shownCount, shownCount + pageSize());
    shownCount += next.length;
    append(next);
    updateMore();
    // acabou a lista: o botão some, então o foco vai para a primeira foto nova
    if (moreBox.hidden && next.length) $(`[data-open="${next[0]}"]`, grid)?.focus({ preventScroll: true });
  };
  const onSurprise = (e) => {
    if (!e.target.closest("[data-surprise]")) return;
    open(visible, visible[Math.floor(Math.random() * visible.length)]);
  };
  const onOpen = (e) => { const b = e.target.closest("[data-open]"); if (b) open(visible, Number(b.dataset.open)); };
  let lastCols = columns();
  const onResize = () => { if (columns() !== lastCols) { lastCols = columns(); build(); } };

  filters?.addEventListener("click", onFilter);
  moreBox?.addEventListener("click", onMore);
  root.addEventListener("click", onSurprise);
  grid.addEventListener("click", onOpen);
  window.addEventListener("resize", onResize);
  const stopTilt = mountTilt(grid);
  const stopRing = mountRing($(".ring-stage", root), (idx) => open(items.map((_, i) => i), idx));

  return () => {
    stopRing();
    stopColumns();
    stopTilt();
    clearTimeout(switchTimer);
    root.removeEventListener("click", onSurprise);
    window.removeEventListener("resize", onResize);
  };
}
