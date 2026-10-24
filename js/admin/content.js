/* ============================================================
   Painel → Textos do site e Contato/configurações.
   Listas repetidas (passos, destaques, galeria) têm botões para
   adicionar, reordenar e remover.
   ============================================================ */
import { html, setHTML, S, mutate, field, area, imageField, toggle, bindFields } from "./core.js";
import { whatsappUrl } from "../shared/quote.js";

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
  gallery: () => ({ image: "", caption: "" }),
};
const MAX = { howSteps: 8, chefStats: 4, gallery: 24 };

export function textsView(view) {
  const c = S.draft.content;
  const scroll = window.scrollY;
  const pane = document.createElement("div");
  setHTML(pane, html`
    <p class="sub intro-sub">Os textos aparecem no site depois de "Salvar e publicar". Use uma linha em branco para separar parágrafos.</p>

    <section class="panel">
      <h3>Topo da página (hero)</h3>
      ${field("Chamada pequena", "content.heroKicker", { max: 80 })}
      ${field("Título principal", "content.heroTitle", { max: 120, help: "As duas últimas palavras aparecem em itálico dourado." })}
      ${area("Texto de apoio", "content.heroText", { rows: 2, max: 300 })}
      ${imageField("Foto de fundo do topo (opcional)", "content.heroImage")}
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
      <h3>Galeria de eventos</h3>
      <p class="sub">Com fotos aqui, o site ganha uma galeria que desliza na horizontal enquanto a página rola.</p>
      ${repeater("gallery", "Fotos", c.gallery || [], (g, i) => html`
        ${imageField(`Foto ${i + 1}`, `content.gallery.${i}.image`)}
        ${field("Legenda (opcional)", `content.gallery.${i}.caption`, { max: 120 })}`, { addLabel: "+ Foto", max: MAX.gallery })}
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
  bindFields(pane);

  pane.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const mv = e.target.closest("[data-move]");
    const rm = e.target.closest("[data-remove]");
    if (add) mutate((d) => { d.content[add.dataset.add] = [...(d.content[add.dataset.add] || []), BLANK[add.dataset.add]()]; });
    else if (mv) mutate((d) => move(d.content[mv.dataset.move], Number(mv.dataset.i), Number(mv.dataset.i) + Number(mv.dataset.dir)));
    else if (rm) mutate((d) => d.content[rm.dataset.remove].splice(Number(rm.dataset.i), 1));
    else return;
    textsView(view);
  });
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
