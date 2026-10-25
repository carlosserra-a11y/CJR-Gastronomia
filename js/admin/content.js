/* ============================================================
   Painel → Textos do site e Contato/configurações.
   Listas repetidas (passos, destaques, portfólio) têm botões para
   adicionar, reordenar e remover.
   ============================================================ */
import { html, setHTML, S, mutate, field, area, choice, imageField, toggle, bindFields, refocus } from "./core.js";
import { whatsappUrl } from "../shared/quote.js";
import { PORTFOLIO_CATEGORIES } from "../shared/menu.js";
import { CALC_KINDS } from "../shared/calculator.js";

const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); };

function repeater(key, title, rows, render, { addLabel, max }) {
  return html`
    <div class="repeater">
      <div class="panel-head"><h4>${title}</h4>${rows.length < max ? html`<button type="button" class="btn btn-line" data-add="${key}">${addLabel}</button>` : ""}</div>
      ${rows.map((row, i) => html`
        <div class="rep-row">
          <div class="rep-fields">${render(row, i)}</div>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-move="${key}" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
            <button type="button" class="icon-btn" data-move="${key}" data-i="${i}" data-dir="1" ${i === rows.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
            <button type="button" class="icon-btn danger" data-remove="${key}" data-i="${i}" aria-label="Remover">✕</button>
          </div>
        </div>`)}
    </div>`;
}

const BLANK = {
  howSteps: () => ({ title: "Novo passo", text: "" }),
  chefStats: () => ({ value: "0", label: "" }),
  portfolio: () => ({ image: "", thumb: "", w: 0, h: 0, category: "eventos", caption: "" }),
  calcOptions: () => ({ id: "", name: "Nova opção", categoryId: "", kind: "salgado", grams: 250, pieces: 0, piecesLabel: "", priceMin: 0, priceMax: 0, active: true }),
  reviews: () => ({ name: "", text: "", rating: 5, event: "" }),
};
const MAX = { howSteps: 8, chefStats: 4, portfolio: 80, calcOptions: 10, reviews: 30 };
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((n) => [n, "★".repeat(n)]);
const CATEGORY_OPTIONS = Object.entries(PORTFOLIO_CATEGORIES);
const PORTFOLIO_IMAGE = /^content\.portfolio\.(\d+)\.image$/;

export function textsView(view) {
  const c = S.draft.content;
  const scroll = window.scrollY;
  const pane = document.createElement("div");
  setHTML(pane, html`
    <p class="sub intro-sub">Os textos aparecem no site depois de "Salvar e publicar". Use uma linha em branco para separar parágrafos.</p>

    <section class="panel">
      <h3>Topo da página (hero)</h3>
      ${field("Chamada pequena", "content.heroKicker", { max: 80 })}
      ${field("Título principal", "content.heroTitle", { max: 120, help: "As duas últimas palavras aparecem em itálico, na cor cobre." })}
      ${area("Texto de apoio", "content.heroText", { rows: 2, max: 300 })}
      ${imageField("Foto do topo (em arco, ao lado do título)", "content.heroImage")}
      ${area("Tipos de evento (um por linha — faixa animada)", "content.eventTypes", { lines: true, rows: 4 })}
    </section>

    <section class="panel">
      <h3>Serviços</h3>
      ${area("Texto de apresentação dos serviços", "content.servicesIntro", { rows: 2, max: 300 })}
    </section>

    <section class="panel">
      <h3>Como funciona</h3>
      ${field("Título", "content.howTitle", { max: 60 })}
      ${area("Texto", "content.howIntro", { rows: 3, max: 600 })}
      ${repeater("howSteps", "Passos", c.howSteps || [], (st, i) => html`
        ${field("Título do passo", `content.howSteps.${i}.title`, { max: 60 })}
        ${area("Texto do passo", `content.howSteps.${i}.text`, { rows: 2, max: 300 })}`, { addLabel: "+ Passo", max: MAX.howSteps })}
      ${area('"O que levamos" (um por linha)', "content.howIncludes", { lines: true, rows: 4 })}
    </section>

    <section class="panel">
      <h3>O Chef</h3>
      ${field("Título", "content.chefTitle", { max: 80 })}
      ${area("Texto", "content.chefText", { rows: 7, max: 2000 })}
      ${imageField("Foto do chef", "content.chefImage")}
      ${repeater("chefStats", "Destaques em números", c.chefStats || [], (st, i) => html`
        <div class="grid-2">${field("Número ou sigla", `content.chefStats.${i}.value`, { max: 12 })}${field("Texto", `content.chefStats.${i}.label`, { max: 80 })}</div>`, { addLabel: "+ Destaque", max: MAX.chefStats })}
    </section>

    <section class="panel">
      <h3>Sobre a CJR</h3>
      ${field("Título", "content.aboutTitle", { max: 80 })}
      ${area("Texto", "content.aboutText", { rows: 6, max: 2000 })}
    </section>

    <section class="panel">
      <h3>Portfólio</h3>
      <p class="sub">As fotos aparecem no anel 3D (até 12, alternando as categorias) e na grade com filtros. Fotos sem imagem são ignoradas ao salvar.</p>
      ${field("Título", "content.portfolioTitle", { max: 80 })}
      ${area("Texto", "content.portfolioIntro", { rows: 2, max: 400 })}
      ${repeater("portfolio", "Fotos", c.portfolio || [], (p, i) => html`
        ${imageField(`Foto ${i + 1}`, `content.portfolio.${i}.image`)}
        <div class="grid-2">${choice("Categoria (filtro)", `content.portfolio.${i}.category`, CATEGORY_OPTIONS)}${field("Legenda", `content.portfolio.${i}.caption`, { max: 120 })}</div>`, { addLabel: "+ Foto", max: MAX.portfolio })}
    </section>

    <section class="panel">
      <h3>Calculadora de convidados</h3>
      <p class="sub">Valores <b>aproximados por pessoa</b> e quantidade de comida por convidado. O site multiplica pelo número de convidados e mostra uma faixa (mínimo–máximo); com dois ou mais salgados, cada porção cai 20%.</p>
      <div class="switch-line">${toggle("content.calcEnabled", "Mostrar a calculadora no site")}</div>
      ${field("Título", "content.calcTitle", { max: 80 })}
      ${area("Texto", "content.calcIntro", { rows: 2, max: 400 })}
      ${area("Observação (o que o valor não inclui)", "content.calcNote", { rows: 2, max: 400 })}
      ${repeater("calcOptions", "Opções", c.calcOptions || [], (o, i) => html`
        <div class="grid-2">${field("Nome", `content.calcOptions.${i}.name`, { max: 60 })}${choice("Página do cardápio", `content.calcOptions.${i}.categoryId`, [["", "Sem link"], ...S.draft.categories.map((cat) => [cat.id, cat.name])])}</div>
        <div class="grid-2">${field("Gramas por pessoa", `content.calcOptions.${i}.grams`, { type: "int", attrs: 'min="0" max="2000"' })}${choice("Tipo", `content.calcOptions.${i}.kind`, Object.entries(CALC_KINDS))}</div>
        <div class="grid-2">${field("Unidades por pessoa (0 = não mostrar)", `content.calcOptions.${i}.pieces`, { type: "int", attrs: 'min="0" max="100"' })}${field("Nome das unidades", `content.calcOptions.${i}.piecesLabel`, { max: 30, placeholder: "Ex.: salgados e doces" })}</div>
        <div class="grid-2">${field("Valor mínimo por pessoa (R$)", `content.calcOptions.${i}.priceMin`, { type: "price" })}${field("Valor máximo por pessoa (R$)", `content.calcOptions.${i}.priceMax`, { type: "price" })}</div>
        <div class="switch-line">${toggle(`content.calcOptions.${i}.active`, "Aparece na calculadora")}</div>`, { addLabel: "+ Opção", max: MAX.calcOptions })}
    </section>

    <section class="panel">
      <h3>Avaliações de clientes</h3>
      <p class="sub">Atualize a nota e o total quando mudarem no Google. Depoimentos aparecem em um carrossel; cadastre só com a autorização do cliente.</p>
      ${field("Título", "content.reviewsTitle", { max: 80 })}
      ${area("Texto", "content.reviewsIntro", { rows: 2, max: 300 })}
      <div class="grid-2">${field("Nota no Google (ex.: 4,9)", "content.reviewsRating", { max: 3 })}${field("Total de avaliações", "content.reviewsCount", { type: "int", attrs: 'min="0"' })}</div>
      ${field("Link das avaliações (https://)", "content.reviewsUrl", { type: "url", max: 300 })}
      ${area("Destaques (um por linha)", "content.reviewsHighlights", { lines: true, rows: 3 })}
      ${repeater("reviews", "Depoimentos", c.reviews || [], (r, i) => html`
        <div class="grid-2">${field("Nome do cliente", `content.reviews.${i}.name`, { max: 60 })}${field("Evento (opcional)", `content.reviews.${i}.event`, { max: 60, placeholder: "Ex.: Aniversário de 60 anos" })}</div>
        ${choice("Estrelas", `content.reviews.${i}.rating`, RATING_OPTIONS, { type: "int" })}
        ${area("Depoimento", `content.reviews.${i}.text`, { rows: 3, max: 600 })}`, { addLabel: "+ Depoimento", max: MAX.reviews })}
    </section>

    <section class="panel">
      <h3>Chamada final</h3>
      ${field("Título", "content.ctaTitle", { max: 100 })}
      ${area("Texto", "content.ctaText", { rows: 2, max: 300 })}
    </section>

    <section class="panel">
      <h3>Aviso de privacidade</h3>
      ${area("Texto", "content.privacyText", { rows: 10, max: 5000, help: "Explique como os dados do formulário são usados (LGPD)." })}
    </section>`);
  view.replaceChildren(pane);
  window.scrollTo(0, scroll);
  bindFields(pane, {
    onChange: (el) => {
      // foto trocada: a miniatura e as medidas antigas eram da foto anterior (o servidor usa a foto nova como miniatura)
      const hit = PORTFOLIO_IMAGE.exec(el.dataset.bind || "");
      if (hit) mutate((d) => { Object.assign(d.content.portfolio[Number(hit[1])], { thumb: "", w: 0, h: 0 }); });
    },
  });

  pane.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const mv = e.target.closest("[data-move]");
    const rm = e.target.closest("[data-remove]");
    let prefer;
    if (add) {
      const key = add.dataset.add, n = (S.draft.content[key] || []).length;
      mutate((d) => { d.content[key] = [...(d.content[key] || []), BLANK[key]()]; });
      prefer = [`[data-bind^="content.${key}.${n}."]`];
    } else if (mv) {
      const key = mv.dataset.move, dir = mv.dataset.dir, to = Number(mv.dataset.i) + Number(dir);
      mutate((d) => move(d.content[key], Number(mv.dataset.i), to));
      prefer = [`[data-move="${key}"][data-i="${to}"][data-dir="${dir}"]`, `[data-move="${key}"][data-i="${to}"]:not([disabled])`];
    } else if (rm) {
      const key = rm.dataset.remove, i = Number(rm.dataset.i);
      mutate((d) => d.content[key].splice(i, 1));
      prefer = [`[data-remove="${key}"][data-i="${i}"]`, `[data-remove="${key}"][data-i="${i - 1}"]`, `[data-add="${key}"]`];
    } else return;
    // a lista é redesenhada: o foco volta para o controle equivalente em vez de cair no início da página
    refocus(textsView(view), ...prefer);
  });
  return pane;
}

export function settingsView(view) {
  const s = S.draft.settings;
  const pane = document.createElement("div");
  const testUrl = whatsappUrl(s.whatsapp, "Teste do cardápio virtual");
  setHTML(pane, html`
    <section class="panel">
      <h3>WhatsApp</h3>
      ${field("Número do WhatsApp", "settings.whatsapp", { placeholder: "5551999990000", help: "Código do país (55) + DDD + número, só números. É para este número que os pedidos de orçamento são enviados." })}
      <p class="help" id="waTest">${testUrl ? html`<a href="${testUrl}" target="_blank" rel="noopener">Testar este número no WhatsApp ↗</a>` : "Sem número configurado: o site oferece copiar a mensagem em vez de abrir o WhatsApp."}</p>
      ${area("Mensagem dos botões “Falar no WhatsApp”", "settings.whatsappGreeting", { rows: 2, max: 300 })}
    </section>
    <section class="panel">
      <h3>Contato e marca</h3>
      <div class="grid-2">${field("Nome da marca", "settings.brandName", { max: 60 })}${field("Região atendida (opcional)", "settings.serviceArea", { max: 120, placeholder: "Ex.: Porto Alegre e Região Metropolitana" })}</div>
      <div class="grid-2">${field("E-mail (opcional)", "settings.email", { type: "email", max: 120 })}${field("Instagram (opcional)", "settings.instagram", { max: 80, placeholder: "usuario, sem @" })}</div>
    </section>
    <section class="panel">
      <h3>Preços</h3>
      <div class="switch-line">${toggle("settings.showPrices", "Mostrar preços de referência no site")}</div>
      <p class="help">Desligado (recomendado enquanto os valores não forem confirmados): o site não mostra nenhum valor. Ligado: mostra "a partir de R$ …" nos itens com preço preenchido. O orçamento final nunca é calculado automaticamente.</p>
      ${area("Observação sobre valores", "settings.priceNote", { rows: 2, max: 300 })}
    </section>`);
  view.replaceChildren(pane);
  bindFields(pane, {
    onChange: (el) => {
      if (el.dataset.bind !== "settings.whatsapp") return;
      const url = whatsappUrl(el.value, "Teste do cardápio virtual");
      setHTML(pane.querySelector("#waTest"), url ? html`<a href="${url}" target="_blank" rel="noopener">Testar este número no WhatsApp ↗</a>` : "Número incompleto: use 55 + DDD + número.");
    },
  });
}
