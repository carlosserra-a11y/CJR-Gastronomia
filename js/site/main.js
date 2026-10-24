/* ============================================================
   Site da CJR Gastronomia: carrega o cardápio, cuida das rotas
   (#/servicos/…, #/orcamento…), das transições e dos efeitos
   ligados à rolagem da página inicial.
   ============================================================ */
import { $, $$, setHTML, toast } from "./util.js";
import { initMotion, onFrame, motion, scan, scrollTo, measure } from "./motion.js";
import { initHeroBackground } from "./hero-bg.js";
import { mountFronds } from "./fronds.js";
import { initCursor } from "./cursor.js";
import { loadMenu } from "./api.js";
import { indexMenu } from "../shared/menu.js";
import * as store from "./store.js";
import * as V from "./views.js";
import { bindQuote, getDraft } from "./quote-view.js";
import { openLayer, closeLayer, closeAll } from "./dialog.js";

const root = document.documentElement;
const view = $("#view");
const HOME_SECTIONS = new Set(["servicos", "como-funciona", "chef", "sobre", "contato", "galeria"]);
const LEAVE_MS = 320;
const app = { menu: null, idx: null, route: null, key: "", cleanups: [] };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

boot();

async function boot() {
  initMotion();
  initHeroBackground($("#bg"));
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
  await route({ first: true });
  finishIntro();
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

async function route({ first = false } = {}) {
  const r = parse();
  const key = `${r.name}:${r.id || ""}`;
  closeAll();
  if (key === app.key) { // mesma tela: só rola até a seção
    scrollTo(r.section ? $(`#${r.section}`) : 0);
    return;
  }
  if (!first && !motion.reduced) { view.classList.add("is-leaving"); await wait(LEAVE_MS); }
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
    app.cleanups.push(mountFronds($("#heroFronds")), homeEffects());
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
  const heroParts = [$("#heroInner"), $(".hero-stats")].filter(Boolean);
  const marquee = $("#marquee");
  const steps = $("#howSteps");
  const stepItems = $$(".how-step");
  const bar = $("#howBar");
  const gallery = $(".gallery");
  const track = $("#galleryTrack");
  let mx = 0;
  let half = marquee ? marquee.scrollWidth / 2 : 0;
  let extra = 0;

  const size = () => {
    half = marquee ? marquee.scrollWidth / 2 : 0;
    if (gallery && track) {
      extra = Math.max(0, track.scrollWidth - window.innerWidth + 64);
      gallery.style.height = `${window.innerHeight + extra}px`;
    }
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
      const transform = `translate3d(0, ${(m.y * 0.38).toFixed(1)}px, 0)`;
      const opacity = Math.max(0, 1 - m.y / (m.vh * 0.72)).toFixed(3);
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
    if (gallery && extra) {
      const r = gallery.getBoundingClientRect();
      if (r.top < m.vh && r.bottom > 0) {
        const p = clamp(-r.top / (r.height - m.vh), 0, 1);
        track.style.transform = `translate3d(${(-p * extra).toFixed(1)}px, 0, 0)`;
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
    if (rm) { store.remove(rm.dataset.remove, rm.dataset.item); return; }
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
