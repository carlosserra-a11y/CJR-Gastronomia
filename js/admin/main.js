/* ============================================================
   Painel da equipe CJR: login / primeiro acesso, rotas e a barra
   "Salvar e publicar" (aparece quando há alterações).
   ============================================================ */
import { html, $, $$, setHTML, api, toast, S, onState, loadMenu, saveMenu, discard, confirmDialog, formValues } from "./core.js";
import { categoriesView, categoryEditor } from "./menu-editor.js";
import { textsView, settingsView } from "./content.js";
import { overviewView, historyView, accountView } from "./pages.js";
import { statsView } from "./stats.js";

const TITLES = { inicio: "Visão geral", estatisticas: "Estatísticas do site", cardapio: "Cardápio", textos: "Textos do site", contato: "Contato e configurações", historico: "Histórico", conta: "Conta e equipe" };
let me = null;
let lastHash = "";

/* ---------- Login ---------- */

function showAuth(needsSetup) {
  $("#app").hidden = true;
  $("#savebar").hidden = true;
  $("#auth").hidden = false;
  $("#authTitle").textContent = needsSetup ? "Primeiro acesso" : "Painel da equipe";
  $("#authSub").textContent = needsSetup
    ? "Crie a conta principal. O código de configuração aparece no terminal onde o servidor foi iniciado."
    : "Entre com sua conta para editar o cardápio.";
  const form = $("#authForm");
  setHTML(form, html`
    ${needsSetup ? html`<div class="field"><label for="a_code">Código de configuração</label><input class="input" id="a_code" name="setupCode" autocomplete="one-time-code" placeholder="ABCD-1234" required></div>
      <div class="field"><label for="a_name">Seu nome</label><input class="input" id="a_name" name="name" autocomplete="name"></div>` : ""}
    <div class="field"><label for="a_user">Usuário</label><input class="input" id="a_user" name="username" autocomplete="username" required></div>
    <div class="field"><label for="a_pw">Senha</label><input class="input" id="a_pw" type="password" name="password" autocomplete="${needsSetup ? "new-password" : "current-password"}" required>
      ${needsSetup ? html`<p class="help">8+ caracteres, com letras e números.</p>` : ""}</div>
    <p class="err-box" id="authErr" role="alert" hidden></p>
    <button class="btn btn-primary btn-block" type="submit">${needsSetup ? "Criar conta e entrar" : "Entrar"}</button>`);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $("#authErr");
    err.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await api(needsSetup ? "setup" : "login", { method: "POST", body: formValues(form) });
      await start(r.user);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally { btn.disabled = false; }
  };
  form.querySelector("input")?.focus();
}

async function start(user) {
  me = user;
  // Depois de uma sessão expirada, o rascunho não salvo continua valendo (não é substituído pelo servidor).
  // Se outra pessoa publicou nesse meio-tempo, o "Salvar" avisa com o conflito (409).
  if (S.draft && S.dirty) toast("Suas alterações não salvas foram mantidas.", "ok");
  else await loadMenu();
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#whoName").textContent = user.name || user.username;
  route();
}

/* ---------- Rotas ---------- */

async function route() {
  if (!me) return;
  const [name, arg] = location.hash.replace(/^#/, "").split("/");
  const key = TITLES[name] ? name : "inicio";
  const view = $("#view");
  view.onclick = null;
  if (location.hash !== lastHash) { window.scrollTo(0, 0); lastHash = location.hash; }
  $$(".side-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === key));
  $("#side").classList.remove("open");
  $("#sideToggle").setAttribute("aria-expanded", "false");
  $("#viewTitle").textContent = key === "cardapio" && arg ? "Editar categoria" : TITLES[key];
  // Cada tela é montada num contêiner novo e só entra na página se ainda for a rota atual
  // (telas que buscam dados no servidor não podem "pintar por cima" de outra aberta depois).
  const token = ++routeToken;
  const target = document.createElement("div");
  try {
    if (key === "inicio") await overviewView(target);
    if (key === "estatisticas") await statsView(target);
    if (key === "cardapio") (arg ? categoryEditor(target, decodeURIComponent(arg)) : categoriesView(target));
    if (key === "textos") textsView(target);
    if (key === "contato") settingsView(target);
    if (key === "historico") await historyView(target);
    if (key === "conta") await accountView(target, me);
  } catch (ex) {
    setHTML(target, html`<p class="err-box">${ex.message}</p>`);
  }
  if (token === routeToken) view.replaceChildren(target);
}
let routeToken = 0;

/* ---------- Salvar / descartar ---------- */

function syncSavebar() {
  $("#savebar").hidden = !S.dirty || !me;
  $("#versionPill").textContent = S.version ? `Versão no ar: #${S.version}` : "";
  document.body.classList.toggle("has-savebar", S.dirty);
}

async function save() {
  const btn = $("#saveBtn");
  btn.disabled = true;
  $("#savebarText").textContent = "Publicando…";
  try {
    const r = await saveMenu();
    toast(r.unchanged ? "Nada mudou desde a última publicação." : `Publicado! Versão #${r.version}: ${r.summary.join("; ")}`, "ok");
    route();
  } catch (ex) {
    toast(ex.message, "err");
    if (ex.status === 409) $("#savebarText").textContent = "Outra pessoa publicou antes. Copie suas mudanças, recarregue e refaça.";
  } finally {
    btn.disabled = false;
    if ($("#savebarText").textContent === "Publicando…") $("#savebarText").textContent = "Você tem alterações não salvas.";
  }
}

/* ---------- Início ---------- */

async function boot() {
  onState(syncSavebar);
  $("#saveBtn").addEventListener("click", save);
  $("#discardBtn").addEventListener("click", async () => {
    if (await confirmDialog("Descartar todas as alterações não salvas?", { confirmLabel: "Descartar" })) { discard(); route(); }
  });
  $("#logoutBtn").addEventListener("click", async () => {
    if (S.dirty && !(await confirmDialog("Sair sem salvar as alterações?", { confirmLabel: "Sair sem salvar" }))) return;
    await api("logout", { method: "POST", body: {} }).catch(() => {});
    me = null;
    showAuth(false);
  });
  $("#sideToggle").addEventListener("click", () => {
    const open = $("#side").classList.toggle("open");
    $("#sideToggle").setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("auth:expired", () => { toast("Sua sessão expirou. Entre de novo — suas alterações continuam aqui até você recarregar.", "err"); showAuth(false); });

  try {
    const s = await api("session");
    if (s.user) await start(s.user);
    else showAuth(s.needsSetup);
  } catch {
    $("#auth").hidden = false;
    setHTML($("#authForm"), html`<p class="err-box">O painel precisa do servidor da CJR (npm start). No GitHub Pages ele não funciona — veja o README.</p>`);
  }
}

boot();
