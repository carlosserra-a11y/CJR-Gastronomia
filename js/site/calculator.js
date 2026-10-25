/* ============================================================
   Calculadora de convidados (página inicial): quantos convidados,
   perfil do evento e o que servir → quantidade por pessoa e total,
   faixa de valor aproximada e envio da simulação pelo WhatsApp.
   As contas ficam em ../shared/calculator.js.
   ============================================================ */
import { $, $$, html, setHTML, splitWords, storage as local } from "./util.js";
import { ui } from "./icons.js";
import { motion } from "./motion.js";
import { whatsappUrl } from "../shared/quote.js";
import { CALC_PROFILES, estimate, estimateMessage, brl, weightLabel, clampGuests } from "../shared/calculator.js";

const QUICK_GUESTS = [30, 50, 100, 200];
const RANGE_MAX = 400;
const DEFAULT_GUESTS = 50;
const STORE_KEY = "cjr:calc";
const COUNT_MS = 450;

const perGuestLabel = (o) => `${weightLabel(o.grams)} por pessoa${o.pieces ? ` · ${o.pieces} ${o.piecesLabel || "unidades"}` : ""}`;

export function calculatorSection(c) {
  const opts = c.calcOptions || [];
  if (c.calcEnabled === false || !opts.length) return "";
  return html`
  <section class="section calc" id="calculadora" aria-labelledby="calcTitle">
    <header class="section-head">
      <p class="kicker" data-reveal>Calculadora</p>
      <h2 class="section-title" id="calcTitle" data-reveal>${splitWords(c.calcTitle || "Calculadora de convidados")}</h2>
      <p class="section-lead" data-reveal>${c.calcIntro}</p>
    </header>
    <div class="calc-grid">
      <form class="calc-panel" id="calcForm" novalidate data-reveal>
        <div class="calc-block">
          <label class="calc-label" for="calcGuests"><span class="calc-step">1</span>Quantos convidados?</label>
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-10" aria-label="Menos 10 convidados">−</button>
            <input class="stepper-input" id="calcGuests" name="guests" type="number" inputmode="numeric" min="1" max="2000" value="${DEFAULT_GUESTS}">
            <button type="button" class="step-btn" data-step="10" aria-label="Mais 10 convidados">+</button>
          </div>
          <input class="calc-range" name="range" type="range" min="10" max="${RANGE_MAX}" step="5" value="${DEFAULT_GUESTS}" aria-label="Ajustar o número de convidados">
          <div class="calc-quick" role="group" aria-label="Números prontos">
            ${QUICK_GUESTS.map((q) => html`<button type="button" class="chip" data-guests="${q}" aria-pressed="false">${q}</button>`)}
          </div>
        </div>
        <fieldset class="calc-block">
          <legend class="calc-label"><span class="calc-step">2</span>Perfil do evento</legend>
          <div class="seg-opts calc-profile">
            ${Object.entries(CALC_PROFILES).map(([k, p]) => html`<label class="seg-opt"><input type="radio" name="profile" value="${k}" ${k === "normal" ? "checked" : ""}><span>${p.label}</span></label>`)}
          </div>
          <p class="hint" id="calcProfileHint">${CALC_PROFILES.normal.hint}</p>
        </fieldset>
        <fieldset class="calc-block">
          <legend class="calc-label"><span class="calc-step">3</span>O que servir? <small>escolha uma ou mais</small></legend>
          <div class="calc-options">
            ${opts.map((o) => html`
              <label class="calc-opt">
                <input type="checkbox" name="opt" value="${o.id}">
                <span class="calc-opt-box" aria-hidden="true">${ui.check}</span>
                <span class="calc-opt-text"><strong>${o.name}</strong><small>${perGuestLabel(o)}</small></span>
                <span class="calc-opt-price">${brl(o.priceMin)}–${brl(o.priceMax)}<small>por pessoa</small></span>
              </label>`)}
          </div>
        </fieldset>
        <a class="calc-live" href="#calcResult" data-scroll-to="calcResult" aria-hidden="true" tabindex="-1"></a>
      </form>
      <aside class="calc-result" id="calcResult" aria-label="Resultado da calculadora"></aside>
      <p class="sr-only" role="status" id="calcStatus"></p>
    </div>
  </section>`;
}

function resultView(est, { wa, note }) {
  if (!est.lines.length) {
    return html`
      <p class="calc-total-label">Sua estimativa</p>
      <p class="calc-empty">Escolha pelo menos uma opção para ver as quantidades e a faixa de valor.</p>
      <p class="fine">${note}</p>`;
  }
  return html`
    <p class="calc-total-label">Estimativa para <b>${est.guests}</b> ${est.guests === 1 ? "convidado" : "convidados"}</p>
    <p class="calc-total"><span data-calc="min">${brl(est.min)}</span><small>a</small><span data-calc="max">${brl(est.max)}</span></p>
    <p class="calc-per">≈ ${brl(est.perGuestMin)} a ${brl(est.perGuestMax)} por convidado · ${weightLabel(est.totalGrams)} de comida no total</p>
    <ul class="calc-lines">
      ${est.lines.map((l) => html`
        <li>
          <div class="calc-line-name"><strong>${l.name}</strong><small>${weightLabel(l.perGuestGrams)} por pessoa${l.perGuestPieces ? ` · ${l.perGuestPieces} ${l.piecesLabel}` : ""}</small>
            ${l.categoryId ? html`<a href="#/servicos/${l.categoryId}">Ver opções ${ui.arrow}</a>` : ""}</div>
          <div class="calc-line-qty"><b>${l.totalPieces ? `${l.totalPieces.toLocaleString("pt-BR")} ${l.piecesLabel}` : weightLabel(l.totalGrams)}</b>
            <small>${l.totalPieces ? `${weightLabel(l.totalGrams)} · ` : ""}${brl(l.min)}–${brl(l.max)}</small></div>
        </li>`)}
    </ul>
    ${est.combo ? html`<p class="calc-combo">Com mais de um salgado, cada porção fica 20% menor: ninguém come tudo de tudo.</p>` : ""}
    <div class="calc-actions">
      ${wa ? html`<a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">${ui.whats}<span>Enviar simulação</span></a>` : ""}
      <a class="btn btn-ghost" href="#/orcamento"><span>Pedir orçamento</span></a>
    </div>
    <p class="fine">${note}</p>`;
}

/** Liga a calculadora já desenhada por calculatorSection. Devolve a limpeza. */
export function mountCalculator(root, menu) {
  const form = root && $("#calcForm", root);
  const out = root && $("#calcResult", root);
  if (!form || !out) return () => {};
  const options = menu.content.calcOptions || [];
  const live = $(".calc-live", form);
  const status = $("#calcStatus", root);
  let shown = { min: 0, max: 0 }; // valores na tela agora (a contagem parte deles)
  let raf = 0, statusTimer = 0;

  // última simulação do visitante (só neste aparelho)
  const saved = local.get(STORE_KEY, null);
  const ids = new Set(options.map((o) => o.id));
  const initial = saved && Array.isArray(saved.selected)
    ? saved
    : { guests: DEFAULT_GUESTS, profile: "normal", selected: [ids.has("finger-food") ? "finger-food" : options[0]?.id] };
  form.elements.guests.value = clampGuests(initial.guests || DEFAULT_GUESTS);
  const profileInput = $(`input[name="profile"][value="${CALC_PROFILES[initial.profile] ? initial.profile : "normal"}"]`, form);
  if (profileInput) profileInput.checked = true;
  $$('input[name="opt"]', form).forEach((i) => { i.checked = initial.selected.includes(i.value); });

  const read = () => ({
    guests: clampGuests(form.elements.guests.value),
    profile: $('input[name="profile"]:checked', form)?.value || "normal",
    selected: $$('input[name="opt"]:checked', form).map((i) => i.value),
  });

  // os valores "contam" do anterior até o novo
  const countTo = (est) => {
    cancelAnimationFrame(raf);
    const minEl = $('[data-calc="min"]', out), maxEl = $('[data-calc="max"]', out);
    const from = { ...shown };
    if (!minEl || motion.reduced) { shown = { min: est.min, max: est.max }; return; }
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / COUNT_MS);
      const e = 1 - Math.pow(1 - p, 3);
      shown = { min: Math.round(from.min + (est.min - from.min) * e), max: Math.round(from.max + (est.max - from.max) * e) };
      minEl.textContent = brl(shown.min);
      maxEl.textContent = brl(shown.max);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const update = (source = "") => {
    const state = read();
    if (source !== "typing") form.elements.guests.value = state.guests;
    if (source !== "range") form.elements.range.value = Math.min(RANGE_MAX, Math.max(10, state.guests));
    $$("[data-guests]", form).forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.guests) === state.guests)));
    $("#calcProfileHint", form).textContent = CALC_PROFILES[state.profile].hint;
    $$(".calc-opt", form).forEach((l) => l.classList.toggle("is-on", $("input", l).checked));
    const est = estimate(state, options);
    const wa = whatsappUrl(menu.settings.whatsapp, estimateMessage(est));
    setHTML(out, resultView(est, { wa, note: menu.content.calcNote }));
    countTo(est);
    // resumo fixo no celular enquanto se escolhe (leva até o resultado)
    live.textContent = est.lines.length ? `${brl(est.min)} – ${brl(est.max)}  ↓` : "Escolha o que servir ↓";
    live.classList.toggle("is-empty", !est.lines.length);
    local.set(STORE_KEY, state);
    // leitores de tela: um resumo curto quando a pessoa para de mexer (e não a cada movimento do controle)
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = est.lines.length ? `Estimativa para ${est.guests} convidados: ${brl(est.min)} a ${brl(est.max)}.` : "Escolha pelo menos uma opção.";
    }, 700);
  };

  const onInput = (e) => {
    const name = e.target.name;
    if (name === "range") { form.elements.guests.value = e.target.value; update("range"); return; }
    if (name === "guests") { if (e.target.value !== "") update("typing"); return; }
    update(name);
  };
  const onChange = (e) => { if (e.target.name === "guests") update(); };
  const onClick = (e) => {
    const stepBtn = e.target.closest("[data-step]");
    const quick = e.target.closest("[data-guests]");
    if (!stepBtn && !quick) return;
    form.elements.guests.value = quick ? quick.dataset.guests : clampGuests(Number(form.elements.guests.value) + Number(stepBtn.dataset.step));
    update();
  };
  const onSubmit = (e) => e.preventDefault();
  form.addEventListener("input", onInput);
  form.addEventListener("change", onChange);
  form.addEventListener("click", onClick);
  form.addEventListener("submit", onSubmit);
  update("init");
  return () => { cancelAnimationFrame(raf); clearTimeout(statusTimer); };
}
