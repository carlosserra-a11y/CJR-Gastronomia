/* ============================================================
   Portfólio interativo:
   1) anel 3D de fotos (CSS 3D) — gira sozinho, com a rolagem e ao arrastar;
   2) grade com filtros, "carregar mais", colunas em paralaxe e cartões que
      inclinam com o mouse;
   3) visualizador em tela cheia: setas, teclado, deslizar, tocar nas
      laterais da foto, arrastar para baixo para fechar, troca automática
      e "quero algo assim" pelo WhatsApp.
   ============================================================ */
import { $, $$, html, setHTML, imgSrc, finePointer } from "./util.js";
import { onFrame, motion, scan } from "./motion.js";
import { openLayer, closeLayer } from "./dialog.js";
import { ui } from "./icons.js";
import { PORTFOLIO_CATEGORIES } from "../shared/menu.js";
import { whatsappUrl } from "../shared/quote.js";

const RING_SIZE = 12;
const DRAG_THRESHOLD = 6; // px: abaixo disso o gesto conta como toque, não como arrasto
const SWIPE_THRESHOLD = 50;
const CLOSE_DRAG = 110; // px arrastando a foto para baixo para fechar o visualizador
const COLUMN_SHIFT = [0, 70, 32]; // deslocamento máximo (px) de cada coluna da grade
const AUTOPLAY_MS = 4500;
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
        <div class="lb-bar" aria-hidden="true"><i></i></div>
        <button type="button" class="lb-btn lb-play" data-lb-play aria-label="Passar as fotos sozinho" aria-pressed="false">▶</button>
        <button type="button" class="lb-btn lb-close" data-close aria-label="Fechar">${ui.close}</button>
        <button type="button" class="lb-btn lb-prev" data-lb="-1" aria-label="Foto anterior">${ui.back}</button>
        <figure class="lb-figure"><img class="lb-img" alt="" draggable="false">
          <figcaption class="lb-cap"><span class="lb-count"></span><span class="lb-text"></span>
            <a class="lb-cta" target="_blank" rel="noopener" hidden>${ui.whats}<span>Quero algo assim</span></a>
            <span class="lb-hint">Toque nas laterais da foto para trocar · arraste para baixo para fechar</span>
          </figcaption></figure>
        <button type="button" class="lb-btn lb-next" data-lb="1" aria-label="Próxima foto">${ui.arrow}</button>
      </div>`);
    document.body.appendChild(layer);
  }
  return layer;
}

function openLightbox(items, list, start, { whatsapp } = {}) {
  const layer = lightbox();
  const box = $(".lb", layer);
  const img = $(".lb-img", layer);
  const text = $(".lb-text", layer);
  const cta = $(".lb-cta", layer);
  const bar = $(".lb-bar i", layer);
  const play = $("[data-lb-play]", layer);
  let pos = Math.max(0, list.indexOf(start));
  let playing = false, elapsed = 0, lastT = 0, raf = 0;

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
    const category = PORTFOLIO_CATEGORIES[p.category] || "portfólio";
    const wa = whatsappUrl(whatsapp, `Olá, Chef Carlos! Vi no portfólio do site a foto "${p.caption || category}" (${category}) e quero algo assim no meu evento.`);
    cta.hidden = !wa;
    if (wa) cta.href = wa;
    elapsed = 0;
    [list[pos + 1], list[pos - 1]].forEach((n) => { if (n !== undefined) new Image().src = imgSrc(items[n].image); });
  };
  const go = (d) => { pos = (pos + d + list.length) % list.length; show(d); };

  // troca automática com barra de tempo
  const tick = (t) => {
    if (!playing) return;
    elapsed += Math.min(100, t - lastT); lastT = t;
    bar.style.transform = `scaleX(${Math.min(1, elapsed / AUTOPLAY_MS).toFixed(3)})`;
    if (elapsed >= AUTOPLAY_MS) go(1);
    raf = requestAnimationFrame(tick);
  };
  const setPlaying = (on) => {
    playing = on && list.length > 1;
    play.setAttribute("aria-pressed", String(playing));
    play.setAttribute("aria-label", playing ? "Pausar a troca automática" : "Passar as fotos sozinho");
    play.textContent = playing ? "❚❚" : "▶";
    cancelAnimationFrame(raf);
    if (playing) { lastT = performance.now(); raf = requestAnimationFrame(tick); } else bar.style.transform = "scaleX(0)";
  };

  const onKey = (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
  let sx = null, sy = 0, dy = 0, swiped = false;
  const onClick = (e) => {
    if (swiped) { swiped = false; return; } // o gesto já trocou a foto ou fechou
    if (e.target.closest("[data-lb-play]")) { setPlaying(!playing); return; }
    const b = e.target.closest("[data-lb]");
    if (b) { go(Number(b.dataset.lb)); return; }
    if (e.target === img) { // tocar nas laterais da foto troca; no meio, não faz nada
      const r = img.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.35) go(-1); else if (x > 0.65) go(1);
      return;
    }
    // a área escura em volta da foto cobre o fundo: clicar nela também fecha
    if (e.target === box || e.target.classList.contains("lb-figure")) closeLayer(layer);
  };
  const down = (e) => {
    if (!e.isPrimary) return;
    swiped = false; // um gesto novo começa sem a marca do anterior
    sx = e.clientX; sy = e.clientY; dy = 0;
    // mexeu na foto: para a troca automática (o próprio botão de pausa decide no clique)
    if (playing && !e.target.closest("[data-lb-play]")) setPlaying(false);
  };
  const move = (e) => {
    if (sx === null || !e.isPrimary || e.target !== img) return;
    const ddx = e.clientX - sx, ddy = e.clientY - sy;
    if (Math.abs(ddy) > Math.abs(ddx)) { // arrastando para baixo: a foto acompanha o dedo (e volta se o dedo subir)
      dy = Math.max(0, ddy);
      img.classList.add("is-dragging");
      img.style.translate = `0 ${dy}px`;
      img.style.opacity = String(Math.max(0.35, 1 - dy / 400));
    }
  };
  const up = (e) => {
    if (sx === null || !e.isPrimary) return;
    const dx = e.clientX - sx;
    img.classList.remove("is-dragging");
    img.style.translate = ""; img.style.opacity = "";
    if (dy > CLOSE_DRAG) { swiped = true; closeLayer(layer); }
    else if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > dy) { go(dx < 0 ? 1 : -1); swiped = true; }
    sx = null; dy = 0;
  };
  const cancel = (e) => { if (!e.isPrimary) return; sx = null; dy = 0; img.classList.remove("is-dragging"); img.style.translate = ""; img.style.opacity = ""; };
  document.addEventListener("keydown", onKey);
  layer.addEventListener("click", onClick);
  layer.addEventListener("pointerdown", down);
  layer.addEventListener("pointermove", move);
  layer.addEventListener("pointerup", up);
  layer.addEventListener("pointercancel", cancel);
  show();
  setPlaying(false);
  openLayer(layer, {
    initialFocus: ".lb-next",
    onClose: () => {
      setPlaying(false);
      document.removeEventListener("keydown", onKey);
      layer.removeEventListener("click", onClick);
      layer.removeEventListener("pointerdown", down);
      layer.removeEventListener("pointermove", move);
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
