/* ============================================================
   Modelos das telas. Só montam HTML (tudo escapado); os
   comportamentos ficam em main.js e quote-view.js.
   ============================================================ */
import { html, raw, paragraphs, pad2, splitWords, imgSrc } from "./util.js";
import { categoryIcon, ui } from "./icons.js";
import { priceLabel, PORTFOLIO_CATEGORIES } from "../shared/menu.js";
import { ringPicks } from "./portfolio.js";
import { calculatorSection } from "./calculator.js";
import { reviewsSection } from "./reviews.js";
import { whatsappUrl, EVENT_TYPES, LIMITS, todayISO } from "../shared/quote.js";
import * as store from "./store.js";

const itemCount = (cat) => cat.groups.reduce((n, g) => n + g.items.length, 0);
const isRich = (item) => Boolean(item.desc || item.includes?.length || item.image);
const modeHint = (cat) => (cat.select === "one" ? "Escolha uma opção" : cat.maxPicks ? `Escolha até ${cat.maxPicks} opções` : "Escolha quantas quiser");

export const greetingUrl = (s) => whatsappUrl(s.whatsapp, s.whatsappGreeting || "Olá! Vim pelo cardápio virtual.");

/* ---------------- Início ---------------- */

function heroStats(stats) {
  if (!stats?.length) return "";
  return html`<ul class="hero-stats">${stats.map((s, i) => html`
    <li style="--i:${i}"><strong>${s.value}</strong><span>${s.label}</span></li>`)}</ul>`;
}

function categoryCard(cat, i) {
  const selected = store.categoryCount(cat.id);
  return html`
  <div class="cat-cell" data-speed="${i % 2 ? 0.05 : -0.02}">
  <a class="cat-card tilt" href="#/servicos/${cat.id}" data-reveal data-cursor="Explorar" style="--i:${i % 4}" data-cat-card="${cat.id}">
    <span class="cat-glow" aria-hidden="true"></span>
    ${cat.image ? html`<span class="cat-img" aria-hidden="true"><img src="${imgSrc(cat.image)}" alt="" loading="lazy" decoding="async"></span>` : ""}
    <span class="cat-top"><span class="cat-num">${pad2(i + 1)}</span><span class="cat-icon">${categoryIcon(cat.icon)}</span></span>
    <span class="cat-name">${cat.name}</span>
    <span class="cat-short">${cat.short}</span>
    <span class="cat-foot">
      <span class="cat-meta">${itemCount(cat)} ${itemCount(cat) === 1 ? "opção" : "opções"}</span>
      <b class="cat-sel" ${selected ? "" : "hidden"}>${selected} ${selected === 1 ? "selecionado" : "selecionados"}</b>
      <span class="cat-go">${ui.arrow}</span>
    </span>
  </a>
  </div>`;
}

function portfolioSection(c) {
  const items = c.portfolio || [];
  if (!items.length) return "";
  const ring = ringPicks(items);
  const counts = {};
  items.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  return html`
  <section class="section portfolio" id="portfolio">
    <header class="section-head">
      <p class="kicker" data-reveal>Portfólio</p>
      <h2 class="section-title" data-reveal>${splitWords(c.portfolioTitle || "Portfólio")}</h2>
      <p class="section-lead" data-reveal>${c.portfolioIntro}</p>
    </header>
    ${ring.length >= 4 ? html`<div class="ring-stage" data-cursor="Arraste" data-no-ripple data-reveal>
      <div class="ring" style="--n:${ring.length}">
        ${ring.map((idx, i) => html`<button type="button" class="ring-card" data-index="${idx}" style="--i:${i}" aria-label="Ampliar: ${items[idx].caption || "foto do portfólio"}">
          <img src="${imgSrc(items[idx].thumb || items[idx].image)}" alt="" loading="lazy" decoding="async" draggable="false"></button>`)}
      </div>
      <div class="ring-ui">
        <button type="button" class="ring-btn" data-ring="-1" aria-label="Girar para a esquerda">${ui.back}</button>
        <span>Arraste para girar · toque para ampliar</span>
        <button type="button" class="ring-btn" data-ring="1" aria-label="Girar para a direita">${ui.arrow}</button>
      </div>
    </div>` : ""}
    <div class="pf-tools">
    <div class="pf-filters" role="group" aria-label="Filtrar o portfólio">
      <button type="button" class="chip" data-filter="todos" aria-pressed="true">Todos <small>${items.length}</small></button>
      ${Object.entries(PORTFOLIO_CATEGORIES).filter(([k]) => counts[k]).map(([k, label]) => html`
        <button type="button" class="chip" data-filter="${k}" aria-pressed="false">${label} <small>${counts[k]}</small></button>`)}
    </div>
    <button type="button" class="pf-surprise" data-surprise><i aria-hidden="true">✦</i>Surpreenda-me</button>
    </div>
    <div class="pf-grid"></div>
    <div class="pf-more" hidden>
      <p class="pf-count" aria-live="polite"></p>
      <div class="pf-progress" aria-hidden="true"><i></i></div>
      <button type="button" class="btn btn-ghost" data-more><span>Ver mais fotos</span></button>
    </div>
  </section>`;
}

export function homeView(menu) {
  const c = menu.content, s = menu.settings;
  const wa = greetingUrl(s);
  const events = c.eventTypes?.length ? c.eventTypes : ["Eventos sociais", "Eventos corporativos"];
  const marquee = [...events, ...events].map((e) => html`<span>${e}</span><i aria-hidden="true">✦</i>`);
  return html`
  <section class="hero" id="inicio">
    <canvas class="hero-3d" id="hero3d" aria-hidden="true"></canvas>
    <div class="hero-grid">
      <div class="hero-inner" id="heroInner">
        <p class="kicker hero-kicker"><span class="kline" aria-hidden="true"></span>${c.heroKicker}</p>
        <h1 class="hero-title">${splitWords(c.heroTitle)}</h1>
        <p class="hero-text">${c.heroText}</p>
        <div class="hero-ctas">
          <a class="btn btn-gold magnetic" href="#/servicos"><span>Montar minha experiência</span>${ui.arrow}</a>
          ${wa ? html`<a class="btn btn-ghost magnetic" href="${wa}" target="_blank" rel="noopener">${ui.whats}<span>Falar no WhatsApp</span></a>` : ""}
        </div>
        ${heroStats(c.chefStats)}
      </div>
      ${c.heroImage ? html`
      <figure class="hero-frame" id="heroFrame">
        <div class="hero-frame-img"><img src="${imgSrc(c.heroImage)}" alt="Mesa de frios montada pelo Chef Carlos Jr" fetchpriority="high" decoding="async" data-speed="0.07"></div>
        ${s.serviceArea ? html`<figcaption class="hero-badge">${ui.pin}<span>${s.serviceArea}</span></figcaption>` : ""}
      </figure>` : ""}
    </div>
    <a class="scroll-cue" href="#/servicos" aria-label="Ver os serviços"><span>Role para descobrir</span><i aria-hidden="true"></i></a>
  </section>

  <section class="marquee" aria-label="Eventos que atendemos">
    <div class="marquee-track" id="marquee">${marquee}</div>
  </section>

  <section class="section services" id="servicos">
    <div class="bigword" data-speed-x="-0.18" aria-hidden="true">Experiências</div>
    <header class="section-head">
      <p class="kicker" data-reveal>Serviços</p>
      <h2 class="section-title" data-reveal>O cardápio de <em>experiências</em></h2>
      <p class="section-lead" data-reveal>${c.servicesIntro}</p>
    </header>
    <div class="cat-grid">${menu.categories.map(categoryCard)}</div>
  </section>

  ${calculatorSection(c)}

  ${portfolioSection(c)}

  <section class="section how" id="como-funciona">
    <div class="how-grid">
      <div class="how-sticky">
        <p class="kicker" data-reveal>Do primeiro contato ao último prato</p>
        <h2 class="section-title" data-reveal>${c.howTitle}</h2>
        <p class="section-lead" data-reveal>${c.howIntro}</p>
        <div class="how-progress" aria-hidden="true"><i id="howBar"></i></div>
      </div>
      <ol class="how-steps" id="howSteps">
        ${(c.howSteps || []).map((st, i) => html`
          <li class="how-step" data-reveal>
            <span class="how-num">${pad2(i + 1)}</span>
            <div><h3>${st.title}</h3><p>${st.text}</p></div>
          </li>`)}
      </ol>
    </div>
    ${c.howIncludes?.length ? html`
    <div class="how-includes" data-reveal>
      <h3>O que levamos para o seu evento</h3>
      <ul>${c.howIncludes.map((x) => html`<li>${x}</li>`)}</ul>
      <p class="fine">Cada evento é planejado sob medida: equipe e estrutura variam de acordo com o serviço contratado.</p>
    </div>` : ""}
  </section>

  <section class="section chef" id="chef">
    <div class="bigword bigword-chef" data-speed-x="0.22" aria-hidden="true">${c.chefTitle || "Chef"}</div>
    <div class="chef-grid">
      <div class="chef-media" data-reveal>
        <div class="chef-frame">
          ${c.chefImage
            ? html`<img src="${imgSrc(c.chefImage)}" alt="${c.chefTitle}" loading="lazy" data-speed="0.06">`
            : html`<div class="chef-mono" data-speed="0.06" aria-hidden="true"><span>CJR</span><small>Gastronomia</small></div>`}
        </div>
        <span class="chef-tag">Chef &amp; fundador</span>
      </div>
      <div class="chef-copy">
        <p class="kicker" data-reveal>O chef</p>
        <h2 class="section-title" data-reveal>${c.chefTitle}</h2>
        <div class="prose" data-reveal>${paragraphs(c.chefText)}</div>
        ${c.chefStats?.length ? html`<ul class="stats" data-reveal>${c.chefStats.map((st) => html`
          <li><strong data-count="${/^\d+$/.test(st.value) ? st.value : ""}">${st.value}</strong><span>${st.label}</span></li>`)}</ul>` : ""}
      </div>
    </div>
  </section>

  <section class="section about" id="sobre">
    <div class="about-grid">
      <h2 class="section-title" data-reveal>${c.aboutTitle}</h2>
      <div class="prose" data-reveal>${paragraphs(c.aboutText)}</div>
    </div>
    <blockquote class="quote-big" data-reveal data-speed="-0.04">
      <p>Técnica, criatividade e <em>hospitalidade</em> — para transformar cada evento em uma experiência memorável.</p>
    </blockquote>
  </section>

  ${reviewsSection(c)}

  <section class="section cta" id="contato">
    <div class="cta-inner" data-reveal>
      <p class="kicker">Orçamento sem compromisso</p>
      <h2 class="section-title">${c.ctaTitle}</h2>
      <p class="section-lead">${c.ctaText}</p>
      <div class="hero-ctas">
        <a class="btn btn-gold magnetic" href="#/orcamento"><span>Solicitar orçamento</span>${ui.arrow}</a>
        ${wa ? html`<a class="btn btn-ghost magnetic" href="${wa}" target="_blank" rel="noopener">${ui.whats}<span>WhatsApp</span></a>` : ""}
      </div>
    </div>
  </section>`;
}

/* ---------------- Categoria ---------------- */

function pickButton(cat, item, selected, { compact = false } = {}) {
  const label = selected ? "Selecionado" : cat.select === "one" ? "Escolher" : "Selecionar";
  return html`<button class="pick ${compact ? "pick-compact" : ""}" type="button" data-pick="${cat.id}" data-item="${item.id}" aria-pressed="${selected ? "true" : "false"}">
    <span class="pick-box" aria-hidden="true">${ui.check}</span><span class="pick-label">${label}</span><span class="sr-only"> ${item.name}</span></button>`;
}

function packageCard(cat, item, settings, i) {
  const selected = store.isSelected(cat.id, item.id);
  const price = priceLabel(item, settings);
  return html`
  <article class="pkg tilt ${selected ? "is-selected" : ""}" data-reveal style="--i:${i % 3}" data-item-card="${item.id}">
    <span class="cat-glow" aria-hidden="true"></span>
    ${item.image ? html`<div class="pkg-img"><img src="${imgSrc(item.image)}" alt="" loading="lazy" decoding="async"></div>` : ""}
    <header class="pkg-head">
      ${item.tier ? html`<span class="tier tier-${item.tier.toLowerCase()}">${item.tier}</span>` : ""}
      <h3>${item.name}</h3>
      ${item.desc ? html`<p>${item.desc}</p>` : ""}
    </header>
    ${item.includes?.length ? html`<ul class="pkg-list">${item.includes.map((x) => html`<li>${x}</li>`)}</ul>` : ""}
    <footer class="pkg-foot">
      <span class="pkg-info">
        ${price ? html`<span class="price">${price}</span>` : ""}
        ${item.availability ? html`<span class="avail">${item.availability}</span>` : ""}
      </span>
      ${pickButton(cat, item, selected)}
    </footer>
  </article>`;
}

function optionRow(cat, item, settings) {
  const selected = store.isSelected(cat.id, item.id);
  const price = priceLabel(item, settings);
  return html`
  <button class="opt ${selected ? "is-selected" : ""}" type="button" data-pick="${cat.id}" data-item="${item.id}" aria-pressed="${selected ? "true" : "false"}" data-reveal>
    <span class="opt-box" aria-hidden="true">${ui.check}</span>
    <span class="opt-name">${item.name}</span>
    ${price || item.availability ? html`<span class="opt-meta">${price || item.availability}</span>` : ""}
  </button>`;
}

export function categoryView(menu, cat) {
  const list = menu.categories;
  const i = list.findIndex((c) => c.id === cat.id);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const s = menu.settings;
  const choice = store.choiceOf(cat.id);
  const multiGroup = cat.groups.length > 1;
  const anyPrice = s.showPrices && cat.groups.some((g) => g.items.some((it) => it.price !== null && it.price !== undefined));
  return html`
  <section class="page-hero cat-hero">
    <a class="back-link" href="#/servicos">${ui.back}<span>Todos os serviços</span></a>
    <div class="cat-hero-grid">
      <div>
        <p class="kicker">${pad2(i + 1)} / ${pad2(list.length)} · Serviços</p>
        <h1 class="page-title">${splitWords(cat.name)}</h1>
        <p class="lead">${cat.intro || cat.short}</p>
        ${cat.note ? html`<p class="note">${cat.note}</p>` : ""}
      </div>
      <div class="cat-hero-icon" data-speed="0.12" aria-hidden="true">${categoryIcon(cat.icon)}</div>
    </div>
    <div class="cat-tools">
      <p class="mode-hint"><span class="dotmark" aria-hidden="true"></span>${modeHint(cat)}</p>
      ${cat.choice?.options?.length ? html`
        <fieldset class="seg">
          <legend>${cat.choice.label || "Formato"}</legend>
          <div class="seg-opts">${cat.choice.options.map((o) => html`
            <label class="seg-opt"><input type="radio" name="choice-${cat.id}" value="${o}" data-choice="${cat.id}" ${choice === o ? "checked" : ""}><span>${o}</span></label>`)}</div>
        </fieldset>` : ""}
      ${cat.select === "many" && cat.presets?.length ? html`
        <div class="presets"><span class="presets-label">Seleções prontas</span>
          ${cat.presets.map((p) => html`<button type="button" class="chip" data-preset="${cat.id}" data-preset-id="${p.id}">${ui.plus}<span>${p.name}</span></button>`)}
        </div>` : ""}
    </div>
  </section>

  ${multiGroup ? html`<nav class="group-nav" aria-label="Grupos de ${cat.name}"><div class="group-nav-inner">
    ${cat.groups.map((g) => html`<a href="#g-${g.id}" data-scroll-to="g-${g.id}" class="chip chip-ghost">${g.name}</a>`)}</div></nav>` : ""}

  ${cat.groups.map((g) => {
    const rich = g.items.some(isRich);
    return html`
    <section class="group" id="g-${g.id}">
      ${multiGroup ? html`<h2 class="group-title" data-reveal><span>${g.name}</span><small>${g.items.length}</small></h2>` : ""}
      ${g.note ? html`<p class="note">${g.note}</p>` : ""}
      <div class="${rich ? "pkg-grid" : "opt-grid"}">
        ${g.items.map((it, n) => (rich ? packageCard(cat, it, s, n) : optionRow(cat, it, s)))}
      </div>
    </section>`;
  })}

  ${anyPrice && s.priceNote ? html`<p class="note price-note">${s.priceNote}</p>` : ""}

  <section class="cat-cta" data-reveal>
    <div>
      <h2>Pronto para planejar?</h2>
      <p>Siga para o orçamento ou continue explorando. Sua seleção fica salva neste aparelho.</p>
    </div>
    <a class="btn btn-gold magnetic" href="#/orcamento"><span>Solicitar orçamento</span>${ui.arrow}</a>
  </section>

  <nav class="cat-pager" aria-label="Outras categorias">
    <a href="#/servicos/${prev.id}" class="pager-link" data-cursor="Anterior"><small>${ui.back} Anterior</small><span>${prev.name}</span></a>
    <a href="#/servicos/${next.id}" class="pager-link pager-next" data-cursor="Próxima"><small>Próxima ${ui.arrow}</small><span>${next.name}</span></a>
  </nav>`;
}

/* ---------------- Orçamento ---------------- */

export function summaryView() {
  const lines = store.lines();
  if (!lines.length) {
    return html`<div class="summary-empty">
      <h2>Sua experiência</h2>
      <p>Você ainda não selecionou opções no cardápio — tudo bem! Marque abaixo os serviços de interesse e conte sobre o evento: nós sugerimos o melhor formato.</p>
      <a class="link-arrow" href="#/servicos">Explorar o cardápio ${ui.arrow}</a>
    </div>`;
  }
  const total = store.count();
  return html`
    <div class="summary-head"><h2>Sua experiência</h2><span class="count-pill">${total} ${total === 1 ? "item" : "itens"}</span></div>
    <div class="summary-list">
      ${lines.map((l) => html`
      <div class="summary-cat">
        <div class="summary-cat-head"><h3>${l.category.name}</h3><a href="#/servicos/${l.category.id}" class="summary-edit">Editar</a></div>
        ${l.choice ? html`<p class="summary-choice">${l.category.choice?.label || "Formato"}: ${l.choice}</p>` : ""}
        <ul>${l.items.map((it) => html`<li><span>${it.name}${it.tier ? html` <em>${it.tier}</em>` : ""}</span>
          <button type="button" class="x-btn" data-remove="${l.category.id}" data-item="${it.id}" aria-label="Remover ${it.name}">${ui.close}</button></li>`)}</ul>
      </div>`)}
    </div>
    <div class="summary-foot">
      <a class="link-arrow" href="#/servicos">Adicionar serviços ${ui.arrow}</a>
      <button type="button" class="link-btn" data-clear>Limpar seleção</button>
    </div>`;
}

const field = (name, label, control, { hint = "", cls = "" } = {}) => html`
  <div class="field ${cls}" data-field="${name}">
    <label for="q_${name}">${label}</label>
    ${control}
    ${hint ? html`<p class="hint" id="q_${name}_hint">${hint}</p>` : ""}
    <p class="err" id="q_${name}_err" hidden></p>
  </div>`;

export function quoteView(menu, draft) {
  const d = draft || {};
  const selectedCats = new Set(store.lines().map((l) => l.category.id));
  const interests = new Set([...(d.interests || []), ...selectedCats]);
  return html`
  <section class="page-hero quote-hero">
    <a class="back-link" href="#/servicos">${ui.back}<span>Voltar ao cardápio</span></a>
    <p class="kicker">Orçamento personalizado</p>
    <h1 class="page-title">${splitWords("Monte a sua experiência")}</h1>
    <p class="lead">Conte sobre o seu evento. Ao enviar, abrimos o WhatsApp com tudo organizado para a nossa equipe preparar uma proposta sob medida.</p>
  </section>

  <div class="quote-grid">
    <form class="quote-form" id="quoteForm" novalidate>
      <fieldset class="fs" data-reveal>
        <legend><span>01</span> Sobre você</legend>
        ${field("name", "Nome e sobrenome", html`<input class="input" id="q_name" name="name" autocomplete="name" maxlength="${LIMITS.name}" value="${d.name || ""}" required>`)}
        <div class="row-2">
          ${field("phone", "WhatsApp", html`<input class="input" id="q_phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000" value="${d.phone || ""}" required>`)}
          ${field("email", raw("E-mail <small>(opcional)</small>"), html`<input class="input" id="q_email" name="email" type="email" autocomplete="email" maxlength="${LIMITS.email}" value="${d.email || ""}">`)}
        </div>
      </fieldset>

      <fieldset class="fs" data-reveal>
        <legend><span>02</span> Sobre o evento</legend>
        <div class="row-2">
          ${field("eventType", "Tipo de evento", html`<select class="input select" id="q_eventType" name="eventType" required>
            <option value="">Selecione…</option>
            ${EVENT_TYPES.map((t) => html`<option ${d.eventType === t ? "selected" : ""}>${t}</option>`)}
          </select>`)}
          ${field("eventTypeOther", "Qual?", html`<input class="input" id="q_eventTypeOther" name="eventTypeOther" maxlength="${LIMITS.other}" value="${d.eventTypeOther || ""}">`, { cls: d.eventType === "Outro" ? "" : "is-hidden" })}
        </div>
        <div class="row-2">
          ${field("date", "Data do evento", html`<input class="input" id="q_date" name="date" type="date" min="${todayISO()}" value="${d.date || ""}" ${d.dateUndefined ? "disabled" : ""}>
            <label class="check-inline"><input type="checkbox" name="dateUndefined" ${d.dateUndefined ? "checked" : ""}><span>Ainda não tenho data definida</span></label>`)}
          ${field("guests", "Número estimado de convidados", html`<input class="input" id="q_guests" name="guests" type="number" inputmode="numeric" min="1" max="${LIMITS.guestsMax}" step="1" value="${d.guests || ""}" required>`)}
        </div>
        ${field("place", "Local ou cidade do evento", html`<input class="input" id="q_place" name="place" autocomplete="address-level2" maxlength="${LIMITS.place}" placeholder="Ex.: salão de festas, empresa, cidade" value="${d.place || ""}" required>`)}
      </fieldset>

      <fieldset class="fs" data-reveal>
        <legend><span>03</span> Serviços de interesse</legend>
        <div class="field" data-field="interests">
          <div class="chips-check" role="group" aria-label="Serviços de interesse">
            ${menu.categories.map((c) => html`<label class="chip-check"><input type="checkbox" name="interests" value="${c.id}" ${interests.has(c.id) ? "checked" : ""}><span>${c.name}</span></label>`)}
          </div>
          <p class="err" id="q_interests_err" hidden></p>
        </div>
      </fieldset>

      <fieldset class="fs" data-reveal>
        <legend><span>04</span> Detalhes</legend>
        ${field("notes", raw("Observações, restrições alimentares e necessidades especiais <small>(opcional)</small>"), html`<textarea class="input textarea" id="q_notes" name="notes" rows="4" maxlength="${LIMITS.notes}" placeholder="Horário, formato do serviço, convidados com restrições, estrutura do local…">${d.notes || ""}</textarea>`)}
      </fieldset>

      <div class="field consent" data-field="consent" data-reveal>
        <label class="check-inline"><input type="checkbox" name="consent" ${d.consent ? "checked" : ""} required>
          <span>Li o <a href="#/privacidade" target="_blank" rel="noopener">aviso de privacidade</a> e concordo com o uso dos meus dados para receber a proposta.</span></label>
        <p class="err" id="q_consent_err" hidden></p>
      </div>

      <div class="form-foot" data-reveal>
        <button type="submit" class="btn btn-gold btn-lg magnetic">${ui.whats}<span>Enviar pelo WhatsApp</span></button>
        <p class="fine">Não exibimos preço final automático: cada proposta considera data, local, número de convidados e estrutura.</p>
      </div>
    </form>

    <aside class="summary" id="summary" aria-live="polite">${summaryView()}</aside>
  </div>`;
}

export function confirmView({ text, url, settings }) {
  return html`
    <button type="button" class="dialog-x" data-close aria-label="Fechar">${ui.close}</button>
    <div class="dialog-body">
      <p class="kicker">Quase lá</p>
      <h2 id="dialogTitle">Sua solicitação está pronta</h2>
      ${url
        ? html`<p>Abrimos o WhatsApp em uma nova aba com a mensagem organizada. É só conferir e tocar em <strong>enviar</strong>. Se a aba não abriu, use o botão abaixo.</p>`
        : html`<p>O WhatsApp da equipe ainda não foi configurado neste site. Copie a mensagem e envie pelo canal de sua preferência${settings.email ? html` ou para <a href="mailto:${settings.email}">${settings.email}</a>` : ""}.</p>`}
      <pre class="msg-preview" tabindex="0">${text}</pre>
      <div class="dialog-actions">
        ${url ? html`<a class="btn btn-gold" href="${url}" target="_blank" rel="noopener">${ui.whats}<span>Abrir WhatsApp</span></a>` : ""}
        <button type="button" class="btn btn-ghost" data-copy>${ui.copy}<span>Copiar mensagem</span></button>
      </div>
    </div>`;
}

/* ---------------- Privacidade ---------------- */

export function privacyView(menu) {
  return html`
  <section class="page-hero">
    <a class="back-link" href="#/">${ui.back}<span>Início</span></a>
    <p class="kicker">Transparência</p>
    <h1 class="page-title">${splitWords("Aviso de privacidade")}</h1>
  </section>
  <section class="section prose-page"><div class="prose">${paragraphs(menu.content.privacyText)}</div></section>`;
}

/* ---------------- Rodapé ---------------- */

export function footerView(menu) {
  const s = menu.settings;
  const wa = greetingUrl(s);
  const year = new Date().getFullYear();
  return html`
  <div class="footer-inner">
    <div class="footer-brand">
      <a class="brand brand-lg" href="#/" aria-label="${s.brandName} — início"><img class="brand-logo" src="assets/img/logo.webp" alt="Chef Carlos Jr Gastronomia" width="900" height="419" loading="lazy"></a>
      <p>${menu.content.heroKicker}.${s.serviceArea ? ` ${s.serviceArea}.` : ""}</p>
    </div>
    <nav class="footer-nav" aria-label="Rodapé">
      <a href="#/servicos">Serviços</a><a href="#/calculadora">Calculadora</a><a href="#/portfolio">Portfólio</a><a href="#/avaliacoes">Avaliações</a><a href="#/como-funciona">Como funciona</a><a href="#/chef">O Chef</a><a href="#/orcamento">Orçamento</a>
    </nav>
    <div class="footer-contact">
      ${wa ? html`<a href="${wa}" target="_blank" rel="noopener">${ui.whats}<span>WhatsApp</span></a>` : ""}
      ${s.instagram ? html`<a href="https://instagram.com/${s.instagram}" target="_blank" rel="noopener">${ui.insta}<span>@${s.instagram}</span></a>` : ""}
      ${s.email ? html`<a href="mailto:${s.email}">${ui.mail}<span>${s.email}</span></a>` : ""}
      ${s.serviceArea ? html`<span>${ui.pin}<span>${s.serviceArea}</span></span>` : ""}
    </div>
  </div>
  <div class="footer-base">
    <span>© ${year} ${s.brandName}. Todos os direitos reservados.</span>
    <span><a href="#/privacidade">Aviso de privacidade</a> · <a href="admin/" rel="nofollow">Área da equipe</a></span>
  </div>`;
}

export const loadingView = () => raw('<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Preparando o cardápio…</span></div>');
export const errorView = (msg) => html`<section class="page-hero"><p class="kicker">Ops</p><h1 class="page-title">Não foi possível abrir o cardápio</h1><p class="lead">${msg}</p><a class="btn btn-gold" href="#/" data-reload>Tentar de novo</a></section>`;
