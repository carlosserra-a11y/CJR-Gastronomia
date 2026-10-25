/* ============================================================
   Painel → Estatísticas: visitas, pedidos de orçamento, pratos mais
   escolhidos, de onde vêm os clientes, horários e mais.
   Os dados são anônimos (ver js/shared/analytics.js).
   ============================================================ */
import { html, setHTML, api, dt } from "./core.js";
import { STAT_PERIODS, SECTION_NAMES, DEVICES, LEAD_SOURCES } from "../shared/analytics.js";

const PERIOD_LABELS = { 7: "7 dias", 30: "30 dias", 90: "90 dias", 365: "12 meses" };
const PLACES = {
  ...SECTION_NAMES, flutuante: "Botão flutuante", inicio: "Topo do site", menu: "Menu", rodape: "Rodapé",
  portfolio: "Foto do portfólio", dialog: "Confirmação do orçamento", outro: "Outros lugares",
  orcamento: "Página de orçamento", calcResult: "Calculadora",
};
const SOURCES = { direto: "Direto (link ou endereço digitado)", google: "Google", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", "google ads": "Google Ads", "facebook/instagram": "Anúncio Facebook/Instagram" };
const sourceName = (id) => SOURCES[id] || id.charAt(0).toUpperCase() + id.slice(1);
let period = 30;

const nf = (n) => Number(n || 0).toLocaleString("pt-BR");
const dayLabel = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const monthLabel = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
const plural = (n, one, many) => `${nf(n)} ${n === 1 ? one : many}`;

/** Ranking em barras horizontais (uma cor só: tamanho = quantidade). */
function hbars(list, { value = (x) => x.n, extra = () => "", empty = "Ainda sem dados neste período." } = {}) {
  const max = Math.max(0, ...list.map(value));
  if (!max) return html`<p class="muted">${empty}</p>`;
  return html`<ol class="hbars">${list.filter((x) => value(x) > 0).map((x) => html`
    <li title="${x.name}: ${nf(value(x))}">
      <span class="hb-label">${x.name}</span>
      <span class="hb-track" aria-hidden="true"><i style="width:${((value(x) / max) * 100).toFixed(1)}%"></i></span>
      <span class="hb-val"><b>${nf(value(x))}</b>${extra(x)}</span>
    </li>`)}</ol>`;
}

/** Colunas por dia/hora. Passe o mouse (ou toque) para ver o valor exato. */
function columns(points, { label, every = 1, one, many }) {
  const max = Math.max(0, ...points.map((p) => p.n));
  if (!max) return html`<p class="muted">Ainda sem dados neste período.</p>`;
  return html`
    <div class="vchart">
      <span class="vc-max">${nf(max)}</span>
      <div class="vbars" role="img" aria-label="${label}: no máximo ${plural(max, one, many)}">
        ${points.map((p) => html`<span class="vb" title="${p.label}: ${plural(p.n, one, many)}"><i style="height:${p.n ? Math.max(3, (p.n / max) * 100).toFixed(1) : 0}%"></i></span>`)}
      </div>
      <div class="vc-axis" aria-hidden="true">${points.map((p, i) => html`<span>${i % every === 0 ? p.label : ""}</span>`)}</div>
    </div>`;
}

const panel = (title, sub, body) => html`<section class="panel"><div><h3>${title}</h3>${sub ? html`<p class="sub">${sub}</p>` : ""}</div>${body}</section>`;
const leadsNote = (x) => (x.leads ? html`<small> · ${plural(x.leads, "pedido", "pedidos")}</small>` : "");

function dishesTable(dishes) {
  if (!dishes.length) return html`<p class="muted">Quando os clientes começarem a escolher pratos no cardápio, eles aparecem aqui.</p>`;
  return html`
    <div class="table-wrap"><table class="stat-table">
      <thead><tr><th>Prato / pacote</th><th>Serviço</th><th class="num">Escolhido</th><th class="num">Em orçamentos</th></tr></thead>
      <tbody>${dishes.map((d) => html`<tr><td><strong>${d.name}</strong></td><td class="muted">${d.category}</td><td class="num">${nf(d.adds)}</td><td class="num"><b>${nf(d.leads)}</b></td></tr>`)}</tbody>
    </table></div>`;
}

function leadsTable(leads) {
  if (!leads.length) return html`<p class="muted">Nenhum pedido neste período ainda.</p>`;
  return html`
    <div class="table-wrap"><table class="stat-table">
      <thead><tr><th>Quando</th><th>Por onde</th><th>Evento</th><th class="num">Convidados</th><th>O que pediu</th><th>Veio de</th></tr></thead>
      <tbody>${leads.map((l) => html`<tr>
        <td>${dt(l.at)}</td>
        <td>${LEAD_SOURCES[l.src] || l.src}</td>
        <td>${l.et || "—"}${l.m ? html`<small class="muted"> · ${monthLabel(l.m)}</small>` : ""}</td>
        <td class="num">${l.g ? nf(l.g) : "—"}</td>
        <td class="wrap">${[...l.items, ...l.options, l.photo].filter(Boolean).join(", ") || "—"}</td>
        <td>${sourceName(l.from)}${l.dev ? html`<small class="muted"> · ${DEVICES[l.dev] || l.dev}</small>` : ""}</td>
      </tr>`)}</tbody>
    </table></div>`;
}

function render(view, s) {
  const t = s.totals;
  const every = Math.max(1, Math.ceil(s.daily.length / 6)); // poucas datas no eixo: cabem até no celular
  const perDay = (key, label, one, many) => columns(s.daily.map((d) => ({ label: dayLabel(d.day), n: d[key] })), { label, every, one, many });
  setHTML(view, html`
    <div class="stat-toolbar">
      <div class="seg" role="group" aria-label="Período">${STAT_PERIODS.map((p) => html`<button type="button" data-period="${p}" aria-pressed="${p === period}">${PERIOD_LABELS[p]}</button>`)}</div>
      <span class="muted">${dayLabel(s.from)} a ${dayLabel(s.to)} · horário de Brasília</span>
      <button type="button" class="btn btn-line" data-refresh>Atualizar</button>
    </div>
    ${!t.visits && !t.leads ? html`<section class="panel notice"><h3>As estatísticas começam a contar agora</h3>
      <p class="sub">Assim que alguém visitar o site (com o servidor da CJR no ar), as visitas, os pratos escolhidos e os pedidos de orçamento aparecem aqui.</p></section>` : ""}
    <div class="kpis">
      <div class="kpi"><small>Visitas</small><strong>${nf(t.visits)}</strong><em>pessoas diferentes no site</em></div>
      <div class="kpi"><small>Pedidos de orçamento</small><strong>${nf(t.leads)}</strong><em>enviados pelo WhatsApp</em></div>
      <div class="kpi"><small>Conversão</small><strong>${t.leadRate.toLocaleString("pt-BR")}<span>%</span></strong><em>das visitas viraram pedido</em></div>
      <div class="kpi"><small>Cliques no WhatsApp</small><strong>${nf(t.whatsapp)}</strong><em>em qualquer botão</em></div>
    </div>
    ${panel("Visitas por dia", "", perDay("visits", "Visitas por dia", "visita", "visitas"))}
    ${panel("Pedidos de orçamento por dia", "", perDay("leads", "Pedidos por dia", "pedido", "pedidos"))}
    <div class="stat-grid">
      ${panel("Do clique ao pedido", "Quantas pessoas chegaram a cada etapa.", hbars(s.funnel, { extra: (x) => (t.visits ? html`<small> · ${Math.round((x.n / t.visits) * 100)}%</small>` : "") }))}
      ${panel("De onde vêm os clientes", "Google, Instagram, link direto…", hbars(s.sources.map((x) => ({ ...x, name: sourceName(x.id) })), { extra: leadsNote }))}
    </div>
    ${panel("Pratos e pacotes mais procurados", "\"Escolhido\": quantas pessoas marcaram no cardápio. \"Em orçamentos\": quantos pedidos enviados incluíam o item.", dishesTable(s.dishes))}
    <div class="stat-grid">
      ${panel("Serviços mais procurados", "Pedidos de orçamento que incluíam o serviço.", hbars(s.categories.map((c) => ({ ...c, n: c.leads })), { extra: (x) => html`<small> · ${plural(x.adds, "escolha", "escolhas")}</small>`, empty: "Nenhum pedido com serviços ainda." }))}
      ${panel("Seleções prontas usadas", "", hbars(s.presets))}
      ${panel("Tipos de evento", "Nos pedidos de orçamento.", hbars(s.eventTypes))}
      ${panel("Convidados por evento", s.guests.avg ? `Média de ${nf(s.guests.avg)} convidados por pedido.` : "", hbars(s.guests.buckets))}
      ${panel("Para quando são os eventos", "Mês informado no pedido.", hbars(s.eventMonths.map((m) => ({ ...m, name: monthLabel(m.id) }))))}
      ${panel("Calculadora de convidados", s.calc.uses ? `${plural(s.calc.uses, "pessoa simulou", "pessoas simularam")} · média de ${nf(s.calc.avgGuests)} convidados.` : "", hbars(s.calc.options))}
      ${panel("Onde clicam no WhatsApp", "", hbars(s.whatsapp.map((w) => ({ ...w, name: PLACES[w.id] || w.id }))))}
      ${panel("Por onde chegam os pedidos", "", hbars(s.leadSources))}
      ${panel("Aparelhos", "", hbars(s.devices, { extra: leadsNote }))}
      ${panel("Partes do site mais vistas", "Porcentagem das visitas que chegaram até a seção.", hbars(s.sections, { extra: (x) => html`<small> · ${x.pct.toLocaleString("pt-BR")}%</small>` }))}
      ${panel("Dias da semana com mais visitas", "", hbars(s.weekdays))}
      ${panel("Fotos do portfólio mais vistas", "", hbars(s.photos))}
    </div>
    ${panel("Horários de mais visitas", "Hora em que as visitas começam (horário de Brasília).", columns(s.hours.map((n, h) => ({ label: `${h}h`, n })), { label: "Visitas por hora", every: 4, one: "visita", many: "visitas" }))}
    ${panel("Últimos pedidos de orçamento", "Sem nome, telefone ou e-mail: esses dados vão só para o WhatsApp da equipe.", leadsTable(s.recentLeads))}
    <p class="help stat-foot">Estatísticas anônimas, sem cookies. Quem ativa "não rastrear" no navegador não é contado. Os dados ficam guardados por cerca de 13 meses.</p>`);
}

export async function statsView(view) {
  setHTML(view, html`<p class="muted">Carregando estatísticas…</p>`);
  const load = async () => render(view, await api(`stats?days=${period}`));
  await load();
  view.onclick = async (e) => {
    const p = e.target.closest("[data-period]");
    if (p) { period = Number(p.dataset.period); await load(); return; }
    if (e.target.closest("[data-refresh]")) await load();
  };
}
