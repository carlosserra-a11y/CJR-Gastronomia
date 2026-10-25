/* ============================================================
   Site da CJR Gastronomia: carrega o cardápio, cuida das rotas
   (#/servicos/…, #/orcamento…), das transições e dos efeitos
   ligados à rolagem da página inicial.
   ============================================================ */
import { $, $$, setHTML, toast } from "./util.js";
import { initMotion, onFrame, motion, scan, scrollTo, measure } from "./motion.js";
import { initCursor } from "./cursor.js";
import { mountPortfolio } from "./portfolio.js";
import { loadMenu } from "./api.js";
import { indexMenu } from "../shared/menu.js";
import * as store from "./store.js";
import * as V from "./views.js";
import { bindQuote, getDraft } from "./quote-view.js";
import { openLayer, closeLayer, closeAll } from "./dialog.js";

const root = document.documentElement;
const view = $("#view");
const HOME_SECTIONS = new Set(["servicos", "portfolio", "como-funciona", "chef", "sobre", "contato"]);
const LEAVE_MS = 320;
const app = { menu: null, idx: null, route: null, key: "", cleanups: [] };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

boot();

async function boot() {
  // Cada rota decide a própria rolagem; a restauração do navegador abriria a página no meio após recarregar.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  initMotion();
  initCursor();
  bindGlobal();
  setHTML(view, V.loadingView());
  const intro = wait(root.classList.contains("intro") ? 1500 : 0);
  try {
    app.menu = await loadMenu();
  } catch (e) {
    await intro;
    finishIntro();
    setHTML(view, V.errorView(e.message));
    return;
  }
  app.idx = indexMenu(app.menu);
  store.initStore(app.idx);
  setHTML($("#footer"), V.footerView(app.menu));
  const wa = V.greetingUrl(app.menu.settings);
  $$("[data-whats]").forEach((a) => { if (wa) { a.href = wa; a.hidden = false; } });
  $("#selbar").hidden = false;
  store.onChange(syncSelection);
  window.addEventListener("hashchange", () => route());
  await intro;
  try {
    await route({ first: true });
  } finally {
    finishIntro(); // mesmo se a primeira tela falhar, a abertura nunca fica presa
  }
}

function finishIntro() {
  root.classList.add("intro-done");
  const ready = () => root.classList.add("ready");
  requestAnimationFrame(ready);
  setTimeout(ready, 120); // aba aberta em segundo plano não roda requestAnimationFrame
  setTimeout(() => $("#preloader")?.remove(), 1800);
}

/* ---------------- Rotas ---------------- */

function parse() {
  // Âncoras comuns da página (ex.: "#main" do link de acessibilidade) não são rotas
  if (location.hash && !location.hash.startsWith("#/")) return null;
  let h = location.hash.replace(/^#\/?/, "");
  try { h = decodeURIComponent(h); } catch { h = ""; } // endereço malformado (ex.: "#/%") vai para o início
  const [a, b] = h.split("/");
  if (!a) return { name: "home" };
  if (a === "servicos" && b) return { name: "category", id: b };
  if (HOME_SECTIONS.has(a)) return { name: "home", section: a };
  if (a === "orcamento") return { name: "quote" };
  if (a === "privacidade") return { name: "privacy" };
  return { name: "home" };
}

let navToken = 0;

async function route({ first = false } = {}) {
  const r = parse();
  if (!r) return;
  const token = ++navToken; // a navegação mais recente sempre vence (ex.: clicar e voltar durante a transição)
  const key = `${r.name}:${r.id || ""}`;
  closeAll();
  if (key === app.key) { // mesma tela: só rola até a seção
    view.classList.remove("is-leaving");
    scrollTo(r.section ? $(`#${r.section}`) : 0);
    return;
  }
  if (!first && !motion.reduced) {
    view.classList.add("is-leaving");
    await wait(LEAVE_MS);
    if (token !== navToken) return;
  }
  render(r);
  app.key = key;
  if (r.section) requestAnimationFrame(() => scrollTo($(`#${r.section}`), { immediate: first }));
  else scrollTo(0, { immediate: true });
  view.classList.remove("is-leaving");
  view.classList.add("is-entering");
  setTimeout(() => view.classList.remove("is-entering"), 900);
  if (!first) $("#main").focus({ preventScroll: true });
}

function render(r) {
  app.cleanups.forEach((fn) => fn());
  app.cleanups = [];
  const brand = app.menu.settings.brandName;
  let name = r.name;
  if (r.name === "category") {
    const cat = app.idx.categories.get(r.id)?.category;
    if (cat) {
      setHTML(view, V.categoryView(app.menu, cat));
      document.title = `${cat.name} · ${brand}`;
    } else name = "home";
  }
  if (name === "home") {
    setHTML(view, V.homeView(app.menu));
    app.cleanups.push(mountHero3D(), mountPortfolio($("#portfolio"), app.menu.content.portfolio), homeEffects());
    document.title = `${brand} · ${app.menu.content.heroKicker}`;
  }
  if (name === "quote") {
    setHTML(view, V.quoteView(app.menu, getDraft()));
    app.cleanups.push(bindQuote(view, app.menu));
    document.title = `Orçamento · ${brand}`;
  }
  if (name === "privacy") {
    setHTML(view, V.privacyView(app.menu));
    document.title = `Aviso de privacidade · ${brand}`;
  }
  app.route = name;
  document.body.dataset.route = name;
  $$(".nav a, .drawer-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("is-current", (name === "quote" && href === "#/orcamento") || (name === "category" && href === "#/servicos"));
  });
  scan(view);
  syncSelection();
}

/* ---------------- Efeitos da página inicial ---------------- */

/** Objetos 3D do topo: o pacote three.js só é baixado quando a página inicial abre. */
function mountHero3D() {
  const canvas = $("#hero3d");
  const hero = $(".hero");
  if (!canvas || !hero || motion.reduced) return () => {};
  let stop = () => {};
  let dead = false;
  import("./kitchen3d.js").then(({ mountKitchen }) => {
    if (dead) return;
    // mesmo ponto de quebra do CSS em que o topo vira uma coluna só (texto em cima, foto embaixo)
    const scene = mountKitchen(canvas, { mobile: window.matchMedia("(max-width: 900px)").matches });
    if (!scene) return;
    const size = () => { const r = hero.getBoundingClientRect(); scene.resize(r.width, r.height); };
    size();
    const jump = (e) => { if (!e.target.closest("a, button")) scene.jump(); };
    window.addEventListener("resize", size);
    hero.addEventListener("pointerdown", jump);
    canvas.classList.add("is-on");
    const off = onFrame((m) => {
      if (m.y > m.vh * 1.1) return; // fora da tela: não desenha
      scene.render({ time: m.time, mx: m.mouse.sx, my: m.mouse.sy, scroll: m.y / m.vh, dt: m.dt });
    });
    stop = () => { off(); window.removeEventListener("resize", size); hero.removeEventListener("pointerdown", jump); scene.destroy(); };
  }).catch(() => { /* sem WebGL: o topo continua com a foto */ });
  return () => { dead = true; stop(); };
}

function animateCount(el) {
  const target = Number(el.dataset.count);
  if (!target || motion.reduced) return;
  const start = performance.now();
  const step = (t) => {
    const p = clamp((t - start) / 1600, 0, 1);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function homeEffects() {
  const heroParts = [$("#heroInner")].filter(Boolean);
  const stacked = window.matchMedia("(max-width: 900px)"); // topo em uma coluna: a foto vem logo abaixo do texto
  const marquee = $("#marquee");
  const steps = $("#howSteps");
  const stepItems = $$(".how-step");
  const bar = $("#howBar");
  let mx = 0;
  let half = marquee ? marquee.scrollWidth / 2 : 0;

  const size = () => {
    half = marquee ? marquee.scrollWidth / 2 : 0;
    measure();
  };
  size();
  window.addEventListener("resize", size);
  setTimeout(size, 600);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); }
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => { if (el.dataset.count) io.observe(el); });

  const stop = onFrame((m) => {
    if (m.y < m.vh * 1.2 && !m.reduced) {
      // empilhado, o texto descendo mais devagar ficaria por baixo da foto: lá ele rola normalmente
      const lag = stacked.matches ? 0 : m.y * 0.38;
      const transform = `translate3d(0, ${lag.toFixed(1)}px, 0)`;
      const opacity = stacked.matches ? "1" : Math.max(0, 1 - m.y / (m.vh * 0.72)).toFixed(3);
      for (const el of heroParts) { el.style.transform = transform; el.style.opacity = opacity; }
    }
    if (marquee && half && !m.reduced) {
      mx -= (0.55 + Math.min(Math.abs(m.velocity), 60) * 0.22) * (m.dt / 16);
      if (-mx >= half) mx += half;
      const skew = clamp(-m.velocity * 0.25, -7, 7);
      marquee.style.transform = `translate3d(${mx.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    }
    if (steps && bar) {
      const r = steps.getBoundingClientRect();
      if (r.top < m.vh && r.bottom > 0) {
        bar.style.transform = `scaleY(${clamp((m.vh * 0.6 - r.top) / r.height, 0, 1).toFixed(3)})`;
        for (const st of stepItems) {
          const b = st.getBoundingClientRect();
          st.classList.toggle("is-active", b.top < m.vh * 0.62 && b.bottom > m.vh * 0.2);
        }
      }
    }
  });
  return () => { stop(); io.disconnect(); window.removeEventListener("resize", size); };
}

/* ---------------- Seleção (contadores e botões) ---------------- */

function syncSelection() {
  const n = store.count();
  const label = `${n} ${n === 1 ? "item" : "itens"}`;
  const hc = $("#headerCount");
  hc.textContent = String(n);
  hc.hidden = !n;
  $("#selbarCount").textContent = label;
  $("#selbar").classList.toggle("is-on", n > 0 && app.route !== "quote");
  for (const card of $$("[data-cat-card]")) {
    const c = store.categoryCount(card.dataset.catCard);
    const b = card.querySelector(".cat-sel");
    b.hidden = !c;
    b.textContent = `${c} ${c === 1 ? "selecionado" : "selecionados"}`;
  }
  for (const btn of $$("[data-pick]")) {
    const sel = store.isSelected(btn.dataset.pick, btn.dataset.item);
    btn.setAttribute("aria-pressed", sel ? "true" : "false");
    btn.classList.toggle("is-selected", sel);
    btn.closest(".pkg")?.classList.toggle("is-selected", sel);
    const lbl = btn.querySelector(".pick-label");
    if (lbl) {
      const cat = app.idx.categories.get(btn.dataset.pick)?.category;
      lbl.textContent = sel ? "Selecionado" : cat?.select === "one" ? "Escolher" : "Selecionar";
    }
  }
}

/* ---------------- Eventos globais ---------------- */

function bindGlobal() {
  const header = $("#header");
  let lastY = 0;
  onFrame((m) => {
    header.classList.toggle("is-solid", m.y > 30);
    const dy = m.y - lastY;
    if (Math.abs(dy) > 4) {
      header.classList.toggle("is-hidden", dy > 0 && m.y > 200 && !root.classList.contains("layer-open"));
      lastY = m.y;
    }
  });

  const drawer = $("#drawer");
  const menuBtn = $("#menuBtn");
  menuBtn.addEventListener("click", () => {
    openLayer(drawer, { onClose: () => menuBtn.setAttribute("aria-expanded", "false") });
    menuBtn.setAttribute("aria-expanded", "true");
  });
  drawer.addEventListener("click", (e) => { if (e.target.closest("a")) closeLayer(drawer); });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".skip")) { // acessibilidade: pula para o conteúdo sem trocar de tela
      e.preventDefault();
      $("#main").focus({ preventScroll: true });
      scrollTo($("#main"), { offset: 0 });
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const err = store.toggle(pick.dataset.pick, pick.dataset.item);
      if (err) toast(err, "err");
      else if (store.isSelected(pick.dataset.pick, pick.dataset.item)) {
        pick.classList.remove("just-picked");
        void pick.offsetWidth;
        pick.classList.add("just-picked");
      }
      return;
    }
    const preset = e.target.closest("[data-preset]");
    if (preset) {
      store.applyPreset(preset.dataset.preset, preset.dataset.presetId);
      toast(`"${preset.textContent.trim()}" aplicada. Ajuste item por item se quiser.`);
      return;
    }
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      const box = rm.closest("#summary");
      const pos = box ? $$("[data-remove]", box).indexOf(rm) : -1;
      store.remove(rm.dataset.remove, rm.dataset.item);
      if (box) { // o resumo foi redesenhado: o foco segue para o item seguinte (ou para o link de adicionar)
        const left = $$("[data-remove]", box);
        (left[Math.min(pos, left.length - 1)] || $("a", box))?.focus({ preventScroll: true });
      }
      return;
    }
    if (e.target.closest("[data-clear]")) {
      if (window.confirm("Limpar toda a seleção?")) store.clearAll();
      return;
    }
    const to = e.target.closest("[data-scroll-to]");
    if (to) { e.preventDefault(); scrollTo($(`#${to.dataset.scrollTo}`), { offset: -150 }); return; }
    if (e.target.closest("[data-reload]")) { e.preventDefault(); location.reload(); return; }
    // link para a mesma rota (o navegador não dispara hashchange): rola até a seção
    const a = e.target.closest('a[href^="#/"]');
    if (a && (a.getAttribute("href") === location.hash || (a.getAttribute("href") === "#/" && !location.hash))) {
      e.preventDefault();
      route();
    }
  });

  document.addEventListener("change", (e) => {
    const ch = e.target.closest("[data-choice]");
    if (ch) store.choose(ch.dataset.choice, ch.value);
  });
}
