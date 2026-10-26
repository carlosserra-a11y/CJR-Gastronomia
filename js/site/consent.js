/* ============================================================
   Consentimento de cookies e estatísticas (LGPD).
   - Necessários: sempre ativos (seleção de pratos, calculadora,
     preferências e a própria escolha) — ficam só no navegador.
   - Estatísticas: medição anônima do site e Google Analytics.
     Só ligam depois do "Aceitar"; "Recusar" tem o mesmo destaque.
   - A escolha vale 6 meses e pode ser mudada no rodapé.
   ============================================================ */
import { $, html, setHTML, storage } from "./util.js";
import { openLayer, closeLayer } from "./dialog.js";
import { ui } from "./icons.js";

const KEY = "cjr:consent:v1";
const MAX_AGE_MS = 180 * 864e5;
const listeners = new Set();
let current = null;
let banner = null;
let bound = false;

function load() {
  const c = storage.get(KEY, null);
  if (!c || typeof c.stats !== "boolean" || !c.at || !(Date.now() - Date.parse(c.at) < MAX_AGE_MS)) return null;
  return c;
}

export const statsAllowed = () => Boolean(current?.stats);
export const onConsent = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function save(stats) {
  current = { stats, at: new Date().toISOString() };
  storage.set(KEY, current);
  hideBanner();
  closeLayer($("#layer"));
  listeners.forEach((fn) => fn(current));
}

function hideBanner() {
  if (!banner) return;
  const b = banner;
  banner = null;
  b.classList.remove("is-on");
  setTimeout(() => b.remove(), 450);
}

function showBanner() {
  banner = document.createElement("section");
  banner.className = "consent";
  banner.setAttribute("aria-label", "Aviso de cookies");
  setHTML(banner, html`
    <p class="consent-text"><strong>Cookies e privacidade.</strong> Guardamos no seu navegador a seleção de pratos (necessário para o site funcionar). Com a sua permissão, também medimos o uso do site de forma anônima para melhorar o atendimento. <a href="#/privacidade">Saiba mais</a>.</p>
    <div class="consent-actions">
      <button type="button" class="btn btn-gold" data-consent="no"><span>Recusar</span></button>
      <button type="button" class="btn btn-gold" data-consent="yes"><span>Aceitar</span></button>
      <button type="button" class="link-btn" data-consent-open>Personalizar</button>
    </div>`);
  document.body.appendChild(banner);
  const show = () => banner?.classList.add("is-on");
  requestAnimationFrame(show);
  setTimeout(show, 120); // aba em segundo plano não roda requestAnimationFrame
}

/** Janela "Preferências de cookies" (rodapé, página de privacidade e botão Personalizar). */
export function openConsentSettings() {
  const layer = $("#layer");
  const dialog = $("#dialog");
  setHTML(dialog, html`
    <button type="button" class="dialog-x" data-close aria-label="Fechar">${ui.close}</button>
    <div class="dialog-body">
    <p class="kicker">Privacidade</p>
    <h2 id="dialogTitle">Preferências de cookies</h2>
    <p>Escolha o que pode ser usado neste aparelho. Você pode mudar quando quiser, no rodapé do site.</p>
    <div class="consent-opt">
      <div><strong>Necessários</strong><p>Guardam a sua seleção de pratos, a simulação da calculadora e esta escolha. Ficam só no seu navegador.</p></div>
      <span class="consent-always">Sempre ativos</span>
    </div>
    <label class="consent-opt" for="consentStats">
      <div><strong>Estatísticas</strong><p>Medição anônima do uso do site (sem nome, telefone, e-mail ou IP) e, se estiver ativado, o Google Analytics, que usa cookies.</p></div>
      <input type="checkbox" class="consent-switch" id="consentStats" ${statsAllowed() ? "checked" : ""}>
    </label>
    <div class="consent-actions">
      <button type="button" class="btn btn-gold" data-consent-save><span>Salvar escolhas</span></button>
      <a class="link-btn" href="#/privacidade">Ler a Política de Privacidade</a>
    </div>
    </div>`);
  openLayer(layer, { initialFocus: "#consentStats" });
}

/** Lê a escolha salva e mostra o aviso se ainda não houver uma válida. */
export function initConsent() {
  current = load();
  if (!current) showBanner();
  if (bound) return current;
  bound = true;
  document.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-consent]");
    if (pick) { save(pick.dataset.consent === "yes"); return; }
    if (e.target.closest("[data-consent-save]")) { save(Boolean($("#consentStats")?.checked)); return; }
    if (e.target.closest("[data-consent-open]")) { e.preventDefault(); openConsentSettings(); }
  });
  return current;
}
