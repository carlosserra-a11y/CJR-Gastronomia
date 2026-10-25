/* ============================================================
   Validação/normalização do cardápio inteiro (o painel salva o
   documento completo). Devolve um objeto limpo ou lança
   ValidationError com uma mensagem que diz ONDE está o problema.
   ============================================================ */
import { TIERS, PORTFOLIO_CATEGORIES } from "../js/shared/menu.js";

export class ValidationError extends Error {
  constructor(message, field) { super(message); this.status = 400; this.field = field; }
}

const fail = (msg, field) => { throw new ValidationError(msg, field); };

export const ICONS = ["coffee", "board", "finger", "cloche", "dessert", "bowl", "flame", "sparkle", "leaf", "glass"];

export const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

export function str(v, { field, max = 200, min = 0, required = false, multiline = false } = {}) {
  let s = v === undefined || v === null ? "" : String(v);
  s = multiline ? s.replace(/\r\n/g, "\n") : s.replace(/[\r\n\t]+/g, " ");
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !s) fail(`Preencha o campo "${field}".`, field);
  if (s.length < min) fail(`"${field}" precisa ter pelo menos ${min} caracteres.`, field);
  if (s.length > max) fail(`"${field}" pode ter no máximo ${max} caracteres.`, field);
  return s;
}

const bool = (v, fallback = true) => (v === undefined ? fallback : v === true || v === "true" || v === 1 || v === "1" || v === "on");

function int(v, { field, min = 0, max = 1000 } = {}) {
  if (v === "" || v === null || v === undefined) return min;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) fail(`"${field}" deve ser um número entre ${min} e ${max}.`, field);
  return n;
}

/** Preço opcional em reais (aceita "45,50"). null = sem preço. */
function price(v, field) {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) fail(`Valor inválido em "${field}".`, field);
  return Math.round(n * 100) / 100;
}

function list(v, { field, max = 20, itemMax = 160 } = {}) {
  const arr = Array.isArray(v) ? v : String(v || "").split("\n");
  const out = arr.map((x, i) => str(x, { field: `${field} (linha ${i + 1})`, max: itemMax })).filter(Boolean);
  if (out.length > max) fail(`"${field}" pode ter no máximo ${max} linhas.`, field);
  return out;
}

function id(v, field) {
  const s = slugify(v);
  if (!s) fail(`Identificador inválido em "${field}".`, field);
  return s;
}

/** Caminho de imagem aceito: arquivo do próprio site, upload ou URL https. */
export function imagePath(v, field = "Imagem") {
  const s = str(v, { field, max: 500 });
  if (!s) return "";
  if (/^(assets\/img\/|uploads\/)[\w\-./]+\.(webp|jpe?g|png|avif|svg)$/i.test(s) && !s.includes("..")) return s;
  if (/^https:\/\/[^\s"'<>()]+$/i.test(s)) return s;
  fail(`Imagem inválida em "${field}": use um upload, um arquivo em assets/img/ ou um link https.`, field);
}

function email(v, field) {
  const s = str(v, { field, max: 120 }).toLowerCase();
  // Sem ? & / # % : o e-mail vira link mailto: no rodapé e não pode carregar parâmetros (cc, bcc…)
  if (s && !/^[^\s@?&/#%]+@[^\s@?&/#%]+\.[^\s@?&/#%]{2,}$/.test(s)) fail(`E-mail inválido em "${field}".`, field);
  return s;
}

/* ---------- Partes do documento ---------- */

function settings(input) {
  const whatsapp = String(input.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 15)) {
    fail('WhatsApp: use o número completo com código do país e DDD, só números (ex.: 5551999990000).', "whatsapp");
  }
  const instagram = str(input.instagram, { field: "Instagram", max: 80 })
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) fail("Instagram: informe só o nome de usuário (ex.: cjrgastronomia).", "instagram");
  return {
    brandName: str(input.brandName, { field: "Nome da marca", required: true, max: 60 }),
    whatsapp,
    whatsappGreeting: str(input.whatsappGreeting, { field: "Mensagem do botão do WhatsApp", max: 300 }),
    email: email(input.email, "E-mail"),
    instagram,
    serviceArea: str(input.serviceArea, { field: "Região atendida", max: 120 }),
    showPrices: bool(input.showPrices, false),
    priceNote: str(input.priceNote, { field: "Observação sobre valores", max: 300 }),
  };
}

function content(input) {
  const s = (key, field, max, multiline = false) => str(input[key], { field, max, multiline });
  const steps = (Array.isArray(input.howSteps) ? input.howSteps : []).slice(0, 8).map((st, i) => ({
    title: str(st?.title, { field: `Como funciona — passo ${i + 1} (título)`, required: true, max: 60 }),
    text: str(st?.text, { field: `Como funciona — passo ${i + 1} (texto)`, max: 300 }),
  }));
  const stats = (Array.isArray(input.chefStats) ? input.chefStats : []).slice(0, 4).map((st, i) => ({
    value: str(st?.value, { field: `Destaque ${i + 1} (número)`, required: true, max: 12 }),
    label: str(st?.label, { field: `Destaque ${i + 1} (texto)`, max: 80 }),
  }));
  const portfolio = (Array.isArray(input.portfolio) ? input.portfolio : []).slice(0, 80).map((p, i) => {
    const image = imagePath(p?.image, `Portfólio — foto ${i + 1}`);
    return {
      image,
      thumb: imagePath(p?.thumb, `Portfólio — miniatura ${i + 1}`) || image,
      w: int(p?.w, { field: `Portfólio — largura ${i + 1}`, min: 0, max: 10000 }),
      h: int(p?.h, { field: `Portfólio — altura ${i + 1}`, min: 0, max: 10000 }),
      // hasOwn converte a chave para texto: sem o typeof, ["mesa"] passaria e a foto sumiria dos filtros
      category: typeof p?.category === "string" && Object.hasOwn(PORTFOLIO_CATEGORIES, p.category) ? p.category : "eventos",
      caption: str(p?.caption, { field: `Portfólio — legenda ${i + 1}`, max: 120 }),
    };
  }).filter((p) => p.image);
  return {
    heroKicker: s("heroKicker", "Topo — chamada pequena", 80),
    heroTitle: str(input.heroTitle, { field: "Topo — título", required: true, max: 120 }),
    heroText: s("heroText", "Topo — texto", 300, true),
    heroImage: imagePath(input.heroImage, "Topo — foto"),
    eventTypes: list(input.eventTypes, { field: "Tipos de evento", max: 12, itemMax: 40 }),
    servicesIntro: s("servicesIntro", "Serviços — texto", 300, true),
    howTitle: s("howTitle", "Como funciona — título", 60) || "Como funciona",
    howIntro: s("howIntro", "Como funciona — texto", 600, true),
    howSteps: steps,
    howIncludes: list(input.howIncludes, { field: "O que levamos", max: 10, itemMax: 200 }),
    chefTitle: s("chefTitle", "Chef — título", 80),
    chefText: s("chefText", "Chef — texto", 2000, true),
    chefImage: imagePath(input.chefImage, "Chef — foto"),
    chefStats: stats,
    aboutTitle: s("aboutTitle", "Sobre — título", 80),
    aboutText: s("aboutText", "Sobre — texto", 2000, true),
    portfolioTitle: s("portfolioTitle", "Portfólio — título", 80) || "Portfólio",
    portfolioIntro: s("portfolioIntro", "Portfólio — texto", 400, true),
    portfolio,
    ctaTitle: s("ctaTitle", "Chamada final — título", 100),
    ctaText: s("ctaText", "Chamada final — texto", 300, true),
    privacyText: str(input.privacyText, { field: "Aviso de privacidade", required: true, max: 5000, multiline: true }),
  };
}

function item(input, ctx) {
  const name = str(input?.name, { field: `${ctx} — Nome`, required: true, max: 120 });
  const tier = TIERS.includes(input?.tier) ? input.tier : "";
  return {
    id: id(input?.id || name, `${ctx} — identificador`),
    name,
    tier,
    desc: str(input?.desc, { field: `${ctx} — Descrição`, max: 300, multiline: true }),
    includes: list(input?.includes, { field: `${ctx} — O que inclui`, max: 20, itemMax: 160 }),
    price: price(input?.price, `${ctx} — Preço`),
    priceUnit: str(input?.priceUnit, { field: `${ctx} — Unidade do preço`, max: 30 }),
    availability: str(input?.availability, { field: `${ctx} — Disponibilidade`, max: 60 }),
    image: imagePath(input?.image, `${ctx} — Foto`),
    active: bool(input?.active, true),
  };
}

function category(input, n) {
  const name = str(input?.name, { field: `Categoria ${n} — Nome`, required: true, max: 60 });
  const ctx = `Categoria "${name}"`;
  const itemIds = new Set();
  const groupIds = new Set();
  const rawGroups = Array.isArray(input?.groups) ? input.groups : [];
  if (rawGroups.length > 20) fail(`${ctx}: no máximo 20 grupos.`, "groups");
  const groups = rawGroups.map((g, gi) => {
    const gname = str(g?.name, { field: `${ctx} › grupo ${gi + 1} — Nome`, required: true, max: 60 });
    const gctx = `${ctx} › ${gname}`;
    const gid = id(g?.id || gname, `${gctx} — identificador`);
    if (groupIds.has(gid)) fail(`${ctx}: há dois grupos com o identificador "${gid}". Renomeie um deles.`, "groups");
    groupIds.add(gid);
    const rawItems = Array.isArray(g?.items) ? g.items : [];
    if (rawItems.length > 150) fail(`${gctx}: no máximo 150 itens.`, "items");
    const items = rawItems.map((it, ii) => {
      const clean = item(it, `${gctx} › item ${ii + 1}`);
      if (itemIds.has(clean.id)) fail(`${ctx}: o item "${clean.name}" aparece duas vezes (identificador "${clean.id}").`, "items");
      itemIds.add(clean.id);
      return clean;
    });
    return { id: gid, name: gname, note: str(g?.note, { field: `${gctx} — Observação`, max: 200 }), active: bool(g?.active, true), items };
  });
  const presetIds = new Set();
  const presets = (Array.isArray(input?.presets) ? input.presets : []).slice(0, 10).map((p, pi) => {
    const pname = str(p?.name, { field: `${ctx} › seleção pronta ${pi + 1} — Nome`, required: true, max: 60 });
    const pid = id(p?.id || pname, `${ctx} › seleção pronta — identificador`);
    if (presetIds.has(pid)) fail(`${ctx}: duas seleções prontas com o mesmo nome.`, "presets");
    presetIds.add(pid);
    const ids = [...new Set((Array.isArray(p?.itemIds) ? p.itemIds : []).map(String).filter((x) => itemIds.has(x)))];
    return { id: pid, name: pname, itemIds: ids };
  }).filter((p) => p.itemIds.length);
  const choiceOptions = list(input?.choice?.options, { field: `${ctx} — Opções de formato`, max: 6, itemMax: 40 });
  return {
    id: id(input?.id || name, `${ctx} — identificador`),
    name,
    icon: ICONS.includes(input?.icon) ? input.icon : "leaf",
    image: imagePath(input?.image, `${ctx} — Foto`),
    short: str(input?.short, { field: `${ctx} — Resumo do cartão`, max: 160 }),
    intro: str(input?.intro, { field: `${ctx} — Apresentação`, max: 800, multiline: true }),
    note: str(input?.note, { field: `${ctx} — Observação`, max: 300, multiline: true }),
    select: input?.select === "one" ? "one" : "many",
    maxPicks: int(input?.maxPicks, { field: `${ctx} — Limite de escolhas`, min: 0, max: 50 }),
    choice: {
      label: choiceOptions.length ? str(input?.choice?.label, { field: `${ctx} — Nome da pergunta de formato`, max: 40 }) || "Formato" : "",
      options: choiceOptions,
    },
    active: bool(input?.active, true),
    presets: input?.select === "one" ? [] : presets, // seleção pronta só faz sentido com várias escolhas
    groups,
  };
}

/** Valida o documento completo do cardápio. */
export function menuDoc(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Cardápio inválido.");
  const raw = Array.isArray(input.categories) ? input.categories : [];
  if (raw.length > 30) fail("No máximo 30 categorias.", "categories");
  const seen = new Set();
  const categories = raw.map((c, i) => {
    const clean = category(c, i + 1);
    if (seen.has(clean.id)) fail(`Há duas categorias com o identificador "${clean.id}". Renomeie uma delas.`, "categories");
    seen.add(clean.id);
    return clean;
  });
  return { schema: 1, settings: settings(input.settings || {}), content: content(input.content || {}), categories };
}
