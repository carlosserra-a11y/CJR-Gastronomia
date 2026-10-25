/* ============================================================
   Estatísticas do site — usadas pelo site (envio), pelo servidor
   (gravação) e pelo painel (relatórios). Funções puras.
   Tudo é anônimo: nenhum nome, telefone, e-mail ou IP é registrado,
   só o que a pessoa fez no site (ex.: "escolheu Risoto de camarão").
   ============================================================ */
import { EVENT_TYPES } from "./quote.js";

export const STAT_PERIODS = [7, 30, 90, 365];
export const TIME_ZONE = "America/Sao_Paulo";
export const MAX_BATCH = 20;
export const KEEP_DAYS = 400;

export const SECTION_NAMES = {
  servicos: "Serviços", calculadora: "Calculadora", portfolio: "Portfólio", avaliacoes: "Avaliações",
  "como-funciona": "Como funciona", chef: "O Chef", sobre: "Sobre", contato: "Contato",
};
export const DEVICES = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };
export const LEAD_SOURCES = { orcamento: "Formulário de orçamento", calculadora: "Calculadora", portfolio: "Foto do portfólio" };
const GUEST_BUCKETS = [[1, 30, "até 30"], [31, 60, "31 a 60"], [61, 100, "61 a 100"], [101, 200, "101 a 200"], [201, Infinity, "mais de 200"]];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ---------------- Limpeza (o que o servidor aceita gravar) ---------------- */

const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const id = (v) => (typeof v === "string" && ID.test(v) ? v : "");
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
const int = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };
const ids = (v, max) => [...new Set((Array.isArray(v) ? v : []).map(id).filter(Boolean))].slice(0, max);
const oneOf = (v, allowed, fallback = "") => (Object.hasOwn(allowed, v) ? v : fallback);

const CLEAN = {
  visit: (d) => ({ src: text(d.src, 40).toLowerCase() || "direto", med: text(d.med, 40).toLowerCase(), camp: text(d.camp, 60), dev: oneOf(d.dev, DEVICES, "desktop"), lp: id(d.lp) }),
  page: (d) => ({ r: id(d.r), id: id(d.id) }),
  section: (d) => (Object.hasOwn(SECTION_NAMES, d.id) ? { id: d.id } : null),
  dish: (d) => (id(d.c) && id(d.i) ? { c: d.c, i: d.i } : null),
  preset: (d) => (id(d.c) && id(d.p) ? { c: d.c, p: d.p } : null),
  calc: (d) => ({ g: int(d.g, 1, 2000), p: id(d.p), o: ids(d.o, 10) }),
  lead: (d) => ({
    src: oneOf(d.src, LEAD_SOURCES, "orcamento"),
    et: EVENT_TYPES.includes(d.et) ? d.et : "",
    g: int(d.g, 0, 5000),
    m: /^\d{4}-(0[1-9]|1[0-2])$/.test(d.m) ? d.m : "",
    items: (Array.isArray(d.items) ? d.items : []).filter((p) => Array.isArray(p) && id(p[0]) && id(p[1])).map(([c, i]) => [c, i]).slice(0, 60),
    o: ids(d.o, 10),
    photo: id(d.photo),
  }),
  whatsapp: (d) => ({ at: id(d.at) || "outro" }),
  photo: (d) => (id(d.id) ? { id: d.id } : null),
};
export const EVENT_KINDS = Object.keys(CLEAN);

/** Evento vindo do navegador → { type, data } seguro para gravar, ou null se não serve. */
export function cleanEvent(e) {
  if (!e || typeof e !== "object" || !Object.hasOwn(CLEAN, e.type)) return null;
  const data = CLEAN[e.type](e.data && typeof e.data === "object" ? e.data : {});
  return data ? { type: e.type, data } : null;
}
export const validSession = (s) => typeof s === "string" && /^[a-z0-9]{10,32}$/.test(s);

/** Identificador de uma foto do portfólio (nome do arquivo sem extensão). */
export const photoId = (p) => id(String(p?.image || "").split("/").pop().replace(/\.[a-z0-9]+$/i, ""));

/* ---------------- Relatório ---------------- */

const fmtCache = new Map();
function local(iso, tz) {
  if (!fmtCache.has(tz)) fmtCache.set(tz, new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }));
  const p = Object.fromEntries(fmtCache.get(tz).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

class Counter extends Map {
  add(key, n = 1) { if (key) this.set(key, (this.get(key) || 0) + n); return this; }
  total() { let s = 0; for (const n of this.values()) s += n; return s; }
  top(limit, label = (k) => k) { return [...this].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, n]) => ({ id: k, name: label(k), n })); }
}
const once = (seen, key) => { if (seen.has(key)) return false; seen.add(key); return true; };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const avg = (a) => (a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : 0);

function names(menu = {}) {
  const cats = new Map(), items = new Map(), presets = new Map();
  for (const c of menu.categories || []) {
    cats.set(c.id, c.name);
    for (const g of c.groups || []) for (const i of g.items || []) items.set(`${c.id}:${i.id}`, i.name);
    for (const p of c.presets || []) presets.set(`${c.id}:${p.id}`, `${p.name} (${c.name})`);
  }
  const calc = new Map((menu.content?.calcOptions || []).map((o) => [o.id, o.name]));
  const photos = new Map((menu.content?.portfolio || []).map((p) => [photoId(p), p.caption || photoId(p)]));
  return { cats, items, presets, calc, photos };
}

/**
 * Junta os eventos de um período num relatório para o painel.
 * rows: [{ at: ISO, session, type, data }] em ordem cronológica.
 */
export function summarize(rows, { menu, days = 30, now = new Date(), tz = TIME_ZONE } = {}) {
  const N = names(menu);
  const sessions = new Set(), sessionSource = new Map(), sessionDevice = new Map();
  const daily = new Map();
  for (let i = days - 1; i >= 0; i--) daily.set(local(new Date(now.getTime() - i * 864e5).toISOString(), tz).day, { visits: new Set(), leads: 0 });
  const sources = new Counter(), devices = new Counter(), leadsBySource = new Counter(), leadsByDevice = new Counter();
  const dishAdds = new Counter(), dishInLeads = new Counter(), catAdds = new Counter(), catInLeads = new Counter();
  const eventTypes = new Counter(), months = new Counter(), leadSources = new Counter(), whatsapp = new Counter();
  const sections = new Counter(), photos = new Counter(), calcOptions = new Counter(), presets = new Counter();
  const hours = Array(24).fill(0), weekdays = Array(7).fill(0), leadHours = Array(24).fill(0);
  const funnel = { menu: new Set(), picked: new Set(), lead: new Set() };
  const calcLast = new Map(), guests = [], recent = [];
  const seen = new Set();
  let leads = 0;

  for (const r of rows) {
    const d = r.data || {};
    const when = local(r.at, tz);
    if (!sessions.has(r.session)) { hours[when.hour]++; weekdays[when.weekday]++; }
    sessions.add(r.session);
    daily.get(when.day)?.visits.add(r.session);
    switch (r.type) {
      case "visit":
        if (!sessionSource.has(r.session)) { sessionSource.set(r.session, d.src); sessionDevice.set(r.session, d.dev); sources.add(d.src); devices.add(d.dev); }
        break;
      case "page":
        if (d.r === "category") funnel.menu.add(r.session);
        break;
      case "section":
        if (once(seen, `sec:${r.session}:${d.id}`)) sections.add(d.id);
        if (d.id === "servicos") funnel.menu.add(r.session);
        break;
      case "dish":
        funnel.picked.add(r.session);
        if (once(seen, `d:${r.session}:${d.c}:${d.i}`)) { dishAdds.add(`${d.c}:${d.i}`); catAdds.add(d.c); }
        break;
      case "preset":
        funnel.picked.add(r.session);
        if (once(seen, `p:${r.session}:${d.c}:${d.p}`)) presets.add(`${d.c}:${d.p}`);
        break;
      case "calc":
        calcLast.set(r.session, d);
        break;
      case "whatsapp":
        whatsapp.add(d.at);
        break;
      case "photo":
        if (once(seen, `ph:${r.session}:${d.id}`)) photos.add(d.id);
        break;
      case "lead": {
        // o mesmo pedido enviado duas vezes na mesma visita conta uma vez só
        const sig = [d.src, d.et, d.g, (d.items || []).map((p) => p.join(":")).join(","), (d.o || []).join(","), d.photo].join("|");
        if (!once(seen, `l:${r.session}:${sig}`)) break;
        leads++;
        funnel.lead.add(r.session);
        const day = daily.get(when.day);
        if (day) day.leads++;
        leadHours[when.hour]++;
        leadSources.add(d.src);
        leadsBySource.add(sessionSource.get(r.session) || "direto");
        leadsByDevice.add(sessionDevice.get(r.session) || "desktop");
        eventTypes.add(d.et);
        months.add(d.m);
        if (d.g) guests.push(d.g);
        const cats = new Set();
        for (const [c, i] of d.items || []) { dishInLeads.add(`${c}:${i}`); cats.add(c); }
        cats.forEach((c) => catInLeads.add(c));
        recent.push({
          at: r.at, src: d.src, et: d.et, g: d.g, m: d.m,
          dev: sessionDevice.get(r.session) || "", from: sessionSource.get(r.session) || "direto",
          items: (d.items || []).map(([c, i]) => N.items.get(`${c}:${i}`) || i),
          options: (d.o || []).map((o) => N.calc.get(o) || o),
          photo: d.photo ? N.photos.get(d.photo) || d.photo : "",
        });
        break;
      }
      default:
    }
  }

  for (const c of calcLast.values()) (c.o || []).forEach((o) => calcOptions.add(o));
  const visits = sessions.size;
  const byLeadsThenAdds = (a, b) => b.leads - a.leads || b.adds - a.adds;
  const dishKeys = new Set([...dishAdds.keys(), ...dishInLeads.keys()]);
  const catKeys = new Set([...catAdds.keys(), ...catInLeads.keys()]);
  const keys = [...daily.keys()];

  return {
    days, from: keys[0], to: keys[keys.length - 1],
    totals: {
      visits, leads, leadRate: pct(funnel.lead.size, visits),
      whatsapp: whatsapp.total(), dishPicks: dishAdds.total(), calcUses: calcLast.size, photos: photos.total(),
    },
    daily: [...daily].map(([day, v]) => ({ day, visits: v.visits.size, leads: v.leads })),
    funnel: [
      { name: "Visitaram o site", n: visits },
      { name: "Viram os serviços", n: funnel.menu.size },
      { name: "Escolheram pratos", n: funnel.picked.size },
      { name: "Pediram orçamento", n: funnel.lead.size },
    ],
    dishes: [...dishKeys].map((k) => {
      const [c, i] = k.split(":");
      return { id: k, name: N.items.get(k) || i, category: N.cats.get(c) || c, adds: dishAdds.get(k) || 0, leads: dishInLeads.get(k) || 0 };
    }).sort(byLeadsThenAdds).slice(0, 15),
    categories: [...catKeys].map((c) => ({ id: c, name: N.cats.get(c) || c, adds: catAdds.get(c) || 0, leads: catInLeads.get(c) || 0 })).sort(byLeadsThenAdds),
    presets: presets.top(8, (k) => N.presets.get(k) || k.split(":")[1]),
    sources: sources.top(10).map((s) => ({ ...s, leads: leadsBySource.get(s.id) || 0 })),
    devices: devices.top(3, (k) => DEVICES[k] || k).map((s) => ({ ...s, leads: leadsByDevice.get(s.id) || 0 })),
    leadSources: leadSources.top(5, (k) => LEAD_SOURCES[k] || k),
    eventTypes: eventTypes.top(10),
    eventMonths: [...months].sort((a, b) => a[0].localeCompare(b[0])).map(([m, n]) => ({ id: m, n })),
    guests: { avg: avg(guests), buckets: GUEST_BUCKETS.map(([a, b, name]) => ({ name, n: guests.filter((g) => g >= a && g <= b).length })) },
    calc: { uses: calcLast.size, avgGuests: avg([...calcLast.values()].map((c) => c.g).filter(Boolean)), options: calcOptions.top(10, (k) => N.calc.get(k) || k) },
    whatsapp: whatsapp.top(10),
    sections: Object.entries(SECTION_NAMES).map(([k, name]) => ({ id: k, name, n: sections.get(k) || 0, pct: pct(sections.get(k) || 0, visits) })),
    photos: photos.top(8, (k) => N.photos.get(k) || k),
    hours, leadHours,
    weekdays: WEEKDAYS.map((name, i) => ({ name, n: weekdays[i] })),
    recentLeads: recent.slice(-25).reverse(),
  };
}
