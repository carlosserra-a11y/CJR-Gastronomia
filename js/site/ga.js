/* ============================================================
   Google Analytics 4 — só carrega quando há um ID (G-…) no painel
   E a pessoa aceitou as estatísticas. Recusar depois desliga o
   envio e apaga os cookies do GA deste site.
   Nenhum dado pessoal é enviado: só os mesmos eventos anônimos
   das estatísticas do painel (pedido, prato escolhido, WhatsApp…).
   ============================================================ */
let loadedId = "";

const off = () => !loadedId || window[`ga-disable-${loadedId}`] || typeof window.gtag !== "function";

export function enableGA(id) {
  if (!/^G-[A-Z0-9]{4,15}$/.test(id || "")) return;
  if (loadedId) { window[`ga-disable-${loadedId}`] = false; return; }
  loadedId = id;
  window.dataLayer = window.dataLayer || [];
  // o gtag oficial guarda os argumentos como vieram (por isso "arguments", e não um array)
  window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false }); // cada tela do site manda o seu page_view
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function disableGA() {
  if (!loadedId) return;
  window[`ga-disable-${loadedId}`] = true;
  const host = location.hostname;
  const base = host.split(".").slice(-2).join(".");
  for (const name of document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter((n) => /^_ga/.test(n))) {
    for (const domain of ["", `; domain=${host}`, `; domain=.${base}`]) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
  }
}

const event = (name, params = {}) => { if (!off()) window.gtag("event", name, params); };

export const gaPage = () => event("page_view", { page_title: document.title, page_location: location.href });

/** Traduz as estatísticas do site para eventos do Google Analytics. */
export function gaFromTrack(type, d = {}) {
  if (off()) return;
  if (type === "page") gaPage();
  else if (type === "lead") event("generate_lead", { lead_source: d.src, event_type: d.et || "", guests: d.g || 0, items_count: (d.items || []).length });
  else if (type === "dish") event("select_item", { item_list_id: d.c, items: [{ item_id: `${d.c}:${d.i}`, item_name: d.name || d.i, item_category: d.c }] });
  else if (type === "preset") event("select_preset", { category: d.c, preset: d.p });
  else if (type === "whatsapp") event("contact_whatsapp", { location: d.at });
  else if (type === "calc") event("calculator_estimate", { guests: d.g, options: (d.o || []).join(",") });
  else if (type === "photo") event("select_content", { content_type: "photo", content_id: d.id });
}
