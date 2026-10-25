/* ============================================================
   Painel → Cardápio: lista de categorias e editor de cada uma
   (dados, grupos, itens, seleções prontas). Tudo vai para o
   rascunho; "Salvar e publicar" envia ao servidor.
   ============================================================ */
import {
  html, setHTML, S, mutate, field, area, choice, toggle, imageField, bindFields, bindImageFields, refocus,
  openModal, confirmDialog, formValues, uniqueId,
} from "./core.js";
import { categoryIcon } from "../site/icons.js";
import { TIERS, SELECT_MODES, formatBRL } from "../shared/menu.js";

const ICONS = [["coffee", "Xícara de café"], ["board", "Tábua de frios"], ["finger", "Petisco no palito"], ["cloche", "Cloche (buffet)"], ["dessert", "Sobremesa"], ["bowl", "Bowl (risoto)"], ["flame", "Chama (ao vivo)"], ["sparkle", "Brilho (extras)"], ["leaf", "Folha"], ["glass", "Taça"]];
const itemsOf = (c) => c.groups.flatMap((g) => g.items);
const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); };

function parsePrice(v) {
  const s = String(v ?? "").trim().replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

const rowButtons = (act, i, len, label) => html`
  <button type="button" class="icon-btn" data-act="${act}-up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir ${label}">↑</button>
  <button type="button" class="icon-btn" data-act="${act}-down" data-i="${i}" ${i === len - 1 ? "disabled" : ""} aria-label="Descer ${label}">↓</button>`;

/** Seletores do botão ↑/↓ na nova posição (o do mesmo sentido; se estiver desabilitado, o outro). */
const moved = (act, to, extra = "") => {
  const other = act.endsWith("-up") ? act.replace(/-up$/, "-down") : act.replace(/-down$/, "-up");
  return [`[data-act="${act}"][data-i="${to}"]${extra}`, `[data-act="${other}"][data-i="${to}"]${extra}`];
};

/* ================= Lista de categorias ================= */

export function categoriesView(view) {
  const cats = S.draft.categories;
  const pane = document.createElement("div");
  setHTML(pane, html`
    <div class="toolbar">
      <p class="sub">A ordem aqui é a ordem do site. Desative para esconder sem apagar.</p>
      <button type="button" class="btn btn-primary" data-act="new-cat">+ Nova categoria</button>
    </div>
    <div class="list">
      ${cats.map((c, i) => html`
      <article class="row ${c.active === false ? "is-off" : ""}">
        <span class="row-icon">${categoryIcon(c.icon)}</span>
        <div class="row-main">
          <a href="#cardapio/${c.id}" class="row-title">${c.name}</a>
          <span class="muted">${itemsOf(c).length} itens · ${c.select === "one" ? "escolha única" : "várias escolhas"}${c.image ? " · com foto" : ""}</span>
        </div>
        ${toggle(`categories.${i}.active`)}
        <div class="row-actions">
          ${rowButtons("cat", i, cats.length, c.name)}
          <a class="btn btn-line" href="#cardapio/${c.id}">Editar</a>
        </div>
      </article>`)}
    </div>`);
  view.replaceChildren(pane);
  bindFields(pane, { onChange: (el) => refocus(categoriesView(view), `[data-bind="${el.dataset.bind}"]`) });

  pane.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = Number(b.dataset.i);
    const act = b.dataset.act;
    if (act === "new-cat") return newCategory();
    if (act !== "cat-up" && act !== "cat-down") return;
    const to = act === "cat-up" ? i - 1 : i + 1;
    mutate((d) => move(d.categories, i, to));
    refocus(categoriesView(view), ...moved(act, to));
  });
  return pane;
}

function newCategory() {
  openModal({
    title: "Nova categoria",
    submitLabel: "Criar",
    body: html`
      <div class="field"><label for="nc_name">Nome</label><input class="input" id="nc_name" name="name" maxlength="60" required></div>
      <div class="field"><label for="nc_sel">Como o cliente escolhe</label>
        <select class="input select" id="nc_sel" name="select">${Object.entries(SELECT_MODES).map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select></div>`,
    onSubmit: async (form) => {
      const v = formValues(form);
      if (!v.name.trim()) throw new Error("Informe o nome da categoria.");
      const id = uniqueId(v.name, new Set(S.draft.categories.map((c) => c.id)));
      mutate((d) => d.categories.push({
        id, name: v.name.trim(), icon: "leaf", image: "", short: "", intro: "", note: "", select: v.select, maxPicks: 0,
        choice: { label: "", options: [] }, active: true, presets: [],
        groups: [{ id: "opcoes", name: "Opções", note: "", active: true, items: [] }],
      }));
      location.hash = `#cardapio/${id}`;
    },
  });
}

/* ================= Editor de uma categoria ================= */

export function categoryEditor(view, id) {
  const ci = S.draft.categories.findIndex((c) => c.id === id);
  if (ci < 0) { location.hash = "#cardapio"; return; }
  const c = S.draft.categories[ci];
  const p = `categories.${ci}`;
  const rerender = (...prefer) => refocus(categoryEditor(view, id), ...prefer);
  const scroll = window.scrollY;

  const pane = document.createElement("div");
  setHTML(pane, html`
    <a class="back" href="#cardapio">← Todas as categorias</a>
    <div class="editor-head">
      <span class="row-icon big">${categoryIcon(c.icon)}</span>
      <h2>${c.name}</h2>
      ${toggle(`${p}.active`)}
      <a class="btn btn-line" href="../#/servicos/${c.id}" target="_blank" rel="noopener">Ver no site ↗</a>
    </div>

    <section class="panel">
      <h3>Dados da categoria</h3>
      <div class="grid-2">${field("Nome", `${p}.name`, { max: 60 })}${choice("Ícone", `${p}.icon`, ICONS)}</div>
      ${field("Resumo no cartão", `${p}.short`, { max: 160, help: "Aparece no cartão da página inicial (até 160 caracteres)." })}
      ${area("Apresentação", `${p}.intro`, { rows: 3, max: 800, help: "Texto do topo da página da categoria." })}
      ${area("Observação (opcional)", `${p}.note`, { rows: 2, max: 300 })}
      <div class="grid-2">
        ${choice("Como o cliente escolhe", `${p}.select`, Object.entries(SELECT_MODES))}
        ${c.select === "many" ? field("Limite de escolhas (0 = sem limite)", `${p}.maxPicks`, { type: "int", attrs: 'min="0" max="50"' }) : html`<div></div>`}
      </div>
      <div class="grid-2">
        ${field("Pergunta de formato (opcional)", `${p}.choice.label`, { placeholder: "Ex.: Formato", max: 40 })}
        ${area("Opções da pergunta (uma por linha)", `${p}.choice.options`, { lines: true, rows: 3, help: "Ex.: Buffet / Preparado ao vivo. Deixe vazio para não perguntar." })}
      </div>
      ${imageField("Foto do cartão (opcional)", `${p}.image`)}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Grupos e itens</h3><button type="button" class="btn btn-line" data-act="add-group">+ Novo grupo</button></div>
      <p class="sub">Clique em um item para editar nome, descrição, itens inclusos, preço, disponibilidade e foto.</p>
      ${c.groups.map((g, gi) => html`
      <div class="group-block ${g.active === false ? "is-off" : ""}">
        <div class="group-head">
          <input class="input input-title" data-bind="${p}.groups.${gi}.name" data-type="text" value="${g.name}" aria-label="Nome do grupo" maxlength="60">
          ${toggle(`${p}.groups.${gi}.active`)}
          <div class="row-actions">
            ${rowButtons("group", gi, c.groups.length, g.name)}
            <button type="button" class="icon-btn danger" data-act="del-group" data-i="${gi}" aria-label="Excluir grupo ${g.name}">✕</button>
          </div>
        </div>
        ${field("Observação do grupo (opcional)", `${p}.groups.${gi}.note`, { max: 200 })}
        <ul class="items">
          ${g.items.map((it, ii) => html`
          <li class="item ${it.active === false ? "is-off" : ""}">
            ${toggle(`${p}.groups.${gi}.items.${ii}.active`)}
            <button type="button" class="item-main" data-act="edit-item" data-g="${gi}" data-i="${ii}">
              <strong>${it.name}</strong>
              <span class="muted">${[it.tier, it.price !== null && it.price !== undefined && it.price !== "" ? formatBRL(it.price) + (it.priceUnit ? ` ${it.priceUnit}` : "") : "", it.availability, it.includes?.length ? `${it.includes.length} inclusos` : "", it.image ? "foto" : ""].filter(Boolean).join(" · ") || "Clique para editar"}</span>
            </button>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-act="item-up" data-g="${gi}" data-i="${ii}" ${ii === 0 ? "disabled" : ""} aria-label="Subir ${it.name}">↑</button>
              <button type="button" class="icon-btn" data-act="item-down" data-g="${gi}" data-i="${ii}" ${ii === g.items.length - 1 ? "disabled" : ""} aria-label="Descer ${it.name}">↓</button>
              <button type="button" class="icon-btn danger" data-act="del-item" data-g="${gi}" data-i="${ii}" aria-label="Excluir ${it.name}">✕</button>
            </div>
          </li>`)}
        </ul>
        <button type="button" class="btn btn-line" data-act="add-item" data-g="${gi}">+ Adicionar item</button>
      </div>`)}
    </section>

    ${c.select === "many" ? html`
    <section class="panel">
      <div class="panel-head"><h3>Seleções prontas</h3><button type="button" class="btn btn-line" data-act="add-preset">+ Nova seleção</button></div>
      <p class="sub">Atalhos que marcam vários itens de uma vez (ex.: "Seleção Clássica"). O cliente ainda pode ajustar item por item.</p>
      ${c.presets.length ? html`<ul class="items">${c.presets.map((pr, pi) => html`
        <li class="item">
          <button type="button" class="item-main" data-act="edit-preset" data-i="${pi}"><strong>${pr.name}</strong>
            <span class="muted">${pr.itemIds.map((iid) => itemsOf(c).find((x) => x.id === iid)?.name).filter(Boolean).join(", ") || "Nenhum item"}</span></button>
          <div class="row-actions"><button type="button" class="icon-btn danger" data-act="del-preset" data-i="${pi}" aria-label="Excluir ${pr.name}">✕</button></div>
        </li>`)}</ul>` : html`<p class="muted">Nenhuma seleção pronta.</p>`}
    </section>` : ""}

    <section class="panel danger-zone">
      <h3>Excluir categoria</h3>
      <p class="sub">Some do site e do painel. Prefere só esconder? Use o botão Ativo/Oculto no topo. Você também pode desfazer pelo Histórico.</p>
      <button type="button" class="btn btn-danger" data-act="del-cat">Excluir "${c.name}"</button>
    </section>`);
  view.replaceChildren(pane);
  window.scrollTo(0, scroll);

  // Mudanças que alteram a estrutura da tela pedem novo desenho; texto digitado não (para não perder o foco).
  bindFields(pane, {
    onChange: (el) => {
      const b = el.dataset.bind;
      if (el.dataset.type === "bool" || b.endsWith(".select") || b.endsWith(".icon")) rerender(`[data-bind="${b}"]`);
    },
  });

  pane.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const gi = Number(b.dataset.g), i = Number(b.dataset.i);
    const act = b.dataset.act;
    const group = (d) => d.categories[ci].groups[gi];
    const inGroup = `[data-g="${gi}"]`;
    // depois de redesenhar, o foco volta ao controle equivalente (ver refocus)
    let prefer = [];
    if (act === "group-up" || act === "group-down") {
      const to = act === "group-up" ? i - 1 : i + 1;
      mutate((d) => move(d.categories[ci].groups, i, to));
      prefer = moved(act, to);
    } else if (act === "item-up" || act === "item-down") {
      const to = act === "item-up" ? i - 1 : i + 1;
      mutate((d) => move(group(d).items, i, to));
      prefer = moved(act, to, inGroup);
    } else if (act === "add-group") {
      const gid = uniqueId("Novo grupo", new Set(c.groups.map((g) => g.id)));
      mutate((d) => d.categories[ci].groups.push({ id: gid, name: "Novo grupo", note: "", active: true, items: [] }));
      prefer = [`[data-bind="${p}.groups.${c.groups.length}.name"]`];
    } else if (act === "del-group") {
      const g = c.groups[i];
      if (!(await confirmDialog(`Excluir o grupo "${g.name}" e seus ${g.items.length} itens?`, { confirmLabel: "Excluir grupo" }))) return;
      mutate((d) => d.categories[ci].groups.splice(i, 1));
      prefer = [`[data-act="del-group"][data-i="${i}"]`, `[data-act="del-group"][data-i="${i - 1}"]`, '[data-act="add-group"]'];
    } else if (act === "del-item") {
      const it = c.groups[gi].items[i];
      if (!(await confirmDialog(`Excluir "${it.name}"? Se quiser só esconder, use o botão Ativo/Oculto.`, { confirmLabel: "Excluir item" }))) return;
      mutate((d) => group(d).items.splice(i, 1));
      prefer = [`[data-act="del-item"]${inGroup}[data-i="${i}"]`, `[data-act="del-item"]${inGroup}[data-i="${i - 1}"]`, `[data-act="add-item"]${inGroup}`];
    } else if (act === "add-item") return itemModal(ci, gi, undefined, () => rerender(`[data-act="add-item"]${inGroup}`));
    else if (act === "edit-item") return itemModal(ci, gi, i, () => rerender(`[data-act="edit-item"]${inGroup}[data-i="${i}"]`));
    else if (act === "add-preset") return presetModal(ci, undefined, () => rerender('[data-act="add-preset"]'));
    else if (act === "edit-preset") return presetModal(ci, i, () => rerender(`[data-act="edit-preset"][data-i="${i}"]`));
    else if (act === "del-preset") {
      mutate((d) => d.categories[ci].presets.splice(i, 1));
      prefer = [`[data-act="del-preset"][data-i="${i}"]`, `[data-act="del-preset"][data-i="${i - 1}"]`, '[data-act="add-preset"]'];
    } else if (act === "del-cat") {
      if (!(await confirmDialog(`Excluir a categoria "${c.name}" com todos os itens? A exclusão só vale depois de salvar.`, { confirmLabel: "Excluir categoria" }))) return;
      mutate((d) => d.categories.splice(ci, 1));
      location.hash = "#cardapio";
      return;
    } else return;
    rerender(...prefer);
  });
  return pane;
}

/* ---------- Modal de item ---------- */

function itemModal(ci, gi, ii, done) {
  const isNew = ii === undefined;
  const cat = S.draft.categories[ci];
  const it = isNew
    ? { name: "", tier: "", desc: "", includes: [], price: null, priceUnit: "por pessoa", availability: "", image: "", active: true }
    : cat.groups[gi].items[ii];
  const form = openModal({
    title: isNew ? `Novo item em "${cat.groups[gi].name}"` : "Editar item",
    wide: true,
    submitLabel: isNew ? "Adicionar" : "Aplicar",
    body: html`
      <div class="grid-2">
        <div class="field"><label for="it_name">Nome</label><input class="input" id="it_name" name="name" value="${it.name}" maxlength="120" required></div>
        <div class="field"><label for="it_tier">Selo</label><select class="input select" id="it_tier" name="tier">${TIERS.map((t) => html`<option value="${t}" ${t === (it.tier || "") ? "selected" : ""}>${t || "Nenhum"}</option>`)}</select></div>
      </div>
      <div class="field"><label for="it_desc">Descrição curta (opcional)</label><textarea class="input textarea" id="it_desc" name="desc" rows="2" maxlength="300">${it.desc || ""}</textarea></div>
      <div class="field"><label for="it_inc">O que inclui (um por linha, opcional)</label><textarea class="input textarea" id="it_inc" name="includes" rows="5">${(it.includes || []).join("\n")}</textarea>
        <p class="help">Com descrição ou itens inclusos, o item aparece como um cartão completo no site; sem eles, como uma opção simples.</p></div>
      <div class="grid-3">
        <div class="field"><label for="it_price">Preço de referência (R$)</label><input class="input" id="it_price" name="price" inputmode="decimal" value="${it.price === null || it.price === undefined ? "" : String(it.price).replace(".", ",")}" placeholder="Ex.: 45,90">
          <p class="help">Só aparece se "Mostrar preços" estiver ligado.</p></div>
        <div class="field"><label for="it_unit">Unidade do preço</label><input class="input" id="it_unit" name="priceUnit" value="${it.priceUnit || ""}" maxlength="30" placeholder="por pessoa"></div>
        <div class="field"><label for="it_av">Disponibilidade</label><input class="input" id="it_av" name="availability" value="${it.availability || ""}" maxlength="60" placeholder="Ex.: Sob consulta"></div>
      </div>
      ${imageField("Foto (opcional)", "", { name: "image", value: it.image || "" })}
      <label class="inline-check"><input type="checkbox" name="active" ${it.active !== false ? "checked" : ""}> Aparece no site</label>`,
    onSubmit: async (f) => {
      const v = formValues(f);
      if (!v.name.trim()) throw new Error("Informe o nome do item.");
      const price = parsePrice(v.price);
      if (price === undefined) throw new Error("Preço inválido. Use só números, por exemplo 45,90.");
      const next = {
        ...it, name: v.name.trim(), tier: v.tier, desc: v.desc.trim(), includes: lines(v.includes), price,
        priceUnit: v.priceUnit.trim(), availability: v.availability.trim(), image: v.image.trim(), active: v.active,
      };
      mutate((d) => {
        const c = d.categories[ci];
        if (isNew) {
          next.id = uniqueId(next.name, new Set(itemsOf(c).map((x) => x.id)));
          c.groups[gi].items.push(next);
        } else c.groups[gi].items[ii] = next;
      });
      done();
    },
  });
  bindImageFields(form);
}

/* ---------- Modal de seleção pronta ---------- */

function presetModal(ci, pi, done) {
  const cat = S.draft.categories[ci];
  const pr = pi === undefined ? { name: "", itemIds: [] } : cat.presets[pi];
  const chosen = new Set(pr.itemIds);
  openModal({
    title: pi === undefined ? "Nova seleção pronta" : "Editar seleção pronta",
    wide: true,
    body: html`
      <div class="field"><label for="pr_name">Nome</label><input class="input" id="pr_name" name="name" value="${pr.name}" maxlength="60" placeholder="Ex.: Seleção Clássica" required></div>
      ${cat.groups.map((g) => html`<fieldset class="check-group"><legend>${g.name}</legend>
        ${g.items.map((it) => html`<label class="inline-check"><input type="checkbox" name="pick:${it.id}" ${chosen.has(it.id) ? "checked" : ""}> ${it.name}</label>`)}
      </fieldset>`)}`,
    onSubmit: async (f) => {
      const v = formValues(f);
      if (!v.name.trim()) throw new Error("Informe o nome da seleção.");
      const itemIds = Object.keys(v).filter((k) => k.startsWith("pick:") && v[k]).map((k) => k.slice(5));
      if (!itemIds.length) throw new Error("Marque pelo menos um item.");
      mutate((d) => {
        const c = d.categories[ci];
        if (pi === undefined) c.presets.push({ id: uniqueId(v.name, new Set(c.presets.map((x) => x.id))), name: v.name.trim(), itemIds });
        else c.presets[pi] = { ...c.presets[pi], name: v.name.trim(), itemIds };
      });
      done();
    },
  });
}
