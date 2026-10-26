/* ============================================================
   Estatísticas anônimas para o painel da equipe: visitas, de onde
   vieram, pratos escolhidos, pedidos de orçamento, cliques no WhatsApp.
   - Sem cookies e sem dados pessoais (nome, telefone e e-mail nunca saem daqui).
   - A visita é um código aleatório que some ao fechar a aba.
   - Só liga depois que a pessoa aceita as estatísticas no aviso de cookies,
     e respeita "não rastrear" / GPC do navegador.
   - Grava no servidor da CJR (no GitHub Pages não há onde gravar) e, se o
     Google Analytics estiver ativado, manda os mesmos eventos para ele.
   ============================================================ */
import { gaFromTrack } from "./ga.js";

const ENDPOINT = "api/track";
const FLUSH_MS = 4000;
const BATCH = 20;
const SID_KEY = "cjr:sid";

let enabled = false; // estatísticas aceitas
let serverOn = false; // há servidor para gravar
let listening = false;
let session = "";
let queue = [];
let timer = 0;

function sessionId() {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");
  try {
    const saved = sessionStorage.getItem(SID_KEY);
    if (saved) return { id: saved, isNew: false };
    const id = fresh();
    sessionStorage.setItem(SID_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: fresh(), isNew: true }; // sem armazenamento: cada carregamento conta como visita
  }
}

/** "l.instagram.com" → "instagram"; "www.google.com.br" → "google". */
function siteName(host) {
  const name = host.replace(/^(www|l|lm|m|mobile|web)\./, "").split(".")[0];
  return { t: "twitter", wa: "whatsapp", fb: "facebook" }[name] || name;
}

function visitInfo() {
  const q = new URLSearchParams(location.search);
  let src = q.get("utm_source") || (q.has("gclid") ? "google ads" : q.has("fbclid") ? "facebook/instagram" : "");
  if (!src && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      if (host !== location.hostname) src = siteName(host);
    } catch { /* referência inválida */ }
  }
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 768;
  return {
    src: src || "direto",
    med: q.get("utm_medium") || "",
    camp: q.get("utm_campaign") || "",
    dev: coarse ? (small ? "mobile" : "tablet") : "desktop",
    lp: location.hash.replace(/^#\/?/, "").split("/")[0] || "inicio",
  };
}

function flush() {
  clearTimeout(timer);
  timer = 0;
  while (queue.length) {
    const body = JSON.stringify({ s: session, e: queue.splice(0, BATCH) });
    // sendBeacon continua mesmo se a pessoa sair da página (ex.: indo para o WhatsApp)
    if (!navigator.sendBeacon?.(ENDPOINT, body)) {
      fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => {});
    }
  }
}

/** Registra uma ação. Pedidos e cliques no WhatsApp saem na hora; o resto vai em lote. */
export function track(type, data = {}) {
  if (!enabled) return;
  gaFromTrack(type, data);
  if (!serverOn) return;
  queue.push({ type, data });
  if (type === "lead" || type === "whatsapp" || queue.length >= BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** Onde fica o link do WhatsApp que foi tocado (para saber qual botão mais converte). */
function placeOf(a) {
  if (a.dataset.track) return a.dataset.track;
  if (a.closest(".wa-float")) return "flutuante";
  if (a.closest(".lightbox")) return "portfolio";
  if (a.closest("#footer")) return "rodape";
  if (a.closest(".site-header, .drawer")) return "menu";
  if (a.closest(".hero")) return "inicio";
  return a.closest("section[id]")?.id || a.closest("[id]")?.id || "outro";
}

function onClick(e) {
  const a = e.target.closest?.('a[href*="wa.me/"]');
  if (!a) return;
  track("whatsapp", { at: placeOf(a) });
  if (!a.dataset.lead) return;
  let info = {};
  try { info = JSON.parse(a.dataset.leadInfo || "{}"); } catch { /* sem detalhes */ }
  track("lead", { ...info, src: a.dataset.lead });
}

export const trackingOn = () => enabled;

/** Liga as estatísticas (só chamar com consentimento). `server`: o cardápio veio do servidor (há onde gravar). */
export function initTracking({ server }) {
  if (enabled || navigator.globalPrivacyControl || navigator.doNotTrack === "1") return;
  enabled = true;
  serverOn = Boolean(server);
  const sid = sessionId();
  session = sid.id;
  if (serverOn && sid.isNew) track("visit", visitInfo());
  if (listening) return;
  listening = true;
  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
}

/** Desliga na hora (consentimento retirado): nada mais é enviado e o código da visita é apagado. */
export function stopTracking() {
  if (!enabled) return;
  flush();
  enabled = false;
  serverOn = false;
  try { sessionStorage.removeItem(SID_KEY); } catch { /* sem armazenamento */ }
}

/** Seções da página inicial que a pessoa realmente viu (uma vez por seção). */
export function watchSections(root) {
  if (!enabled || !("IntersectionObserver" in window)) return () => {};
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      track("section", { id: en.target.id });
      io.unobserve(en.target);
    }
  }, { rootMargin: "-45% 0px -45% 0px" }); // a seção passou pelo meio da tela (vale também para seções mais altas que a tela)
  root.querySelectorAll("section[id]").forEach((s) => io.observe(s));
  return () => io.disconnect();
}
