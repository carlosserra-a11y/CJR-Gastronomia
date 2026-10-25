/* ============================================================
   Painel → Visão geral (pendências antes de publicar), Histórico
   (versões com restauração) e Conta/equipe (senha, contas,
   exportar e backup).
   ============================================================ */
import { html, setHTML, S, api, toast, dt, openModal, confirmDialog, formValues, adoptVersion, ROOT } from "./core.js";

/* ---------- Visão geral ---------- */

export async function overviewView(view) {
  const m = S.draft;
  const cats = m.categories;
  const items = cats.flatMap((c) => c.groups.flatMap((g) => g.items));
  const activeItems = items.filter((i) => i.active !== false);
  const withPrice = items.filter((i) => i.price !== null && i.price !== undefined && i.price !== "");
  const photos = cats.filter((c) => c.image).length + items.filter((i) => i.image).length + (m.content.portfolio?.length || 0);
  const checks = [
    { ok: Boolean(m.settings.whatsapp), text: "Número do WhatsApp configurado", href: "#contato", hint: "Sem ele, os pedidos não abrem no WhatsApp da equipe." },
    { ok: Boolean(m.content.chefImage), text: "Foto do Chef Carlos Junior", href: "#textos" },
    { ok: photos > 0, text: "Fotos dos serviços ou do portfólio", href: "#cardapio", hint: "Opcional, mas valoriza muito o cardápio." },
    { ok: Boolean(m.settings.instagram || m.settings.email), text: "Instagram ou e-mail no rodapé", href: "#contato" },
    { ok: Boolean(m.settings.serviceArea), text: "Região atendida", href: "#contato" },
    { ok: !m.settings.showPrices || withPrice.length > 0, text: m.settings.showPrices ? "Preços preenchidos" : "Preços ocultos (valores sob consulta)", href: "#contato" },
  ];
  const done = checks.filter((c) => c.ok).length;
  let last = null;
  try { last = (await api("versions?limit=1")).rows[0]; } catch { /* sem histórico */ }

  setHTML(view, html`
    <div class="kpis">
      <div class="kpi"><small>Categorias no site</small><strong>${cats.filter((c) => c.active !== false).length}<span>/${cats.length}</span></strong></div>
      <div class="kpi"><small>Itens no site</small><strong>${activeItems.length}<span>/${items.length}</span></strong></div>
      <div class="kpi"><small>Fotos</small><strong>${photos}</strong></div>
      <div class="kpi"><small>Última publicação</small><strong class="small">${last ? dt(last.createdAt) : "—"}</strong><em>${last?.username ? `por ${last.username}` : "cardápio inicial"}</em></div>
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Antes de divulgar o site</h3><span class="progress-pill">${done}/${checks.length}</span></div>
      <ul class="checklist">
        ${checks.map((c) => html`<li class="${c.ok ? "ok" : ""}"><span class="check-dot" aria-hidden="true">${c.ok ? "✓" : ""}</span>
          <div><a href="${c.href}">${c.text}</a>${!c.ok && c.hint ? html`<p class="muted">${c.hint}</p>` : ""}</div>
          <span class="sr-only">${c.ok ? "concluído" : "pendente"}</span></li>`)}
      </ul>
      <p class="help">O briefing pede que valores, quantidades por pessoa, disponibilidade e condições comerciais sejam confirmados pela equipe antes da publicação.</p>
    </section>
    <section class="panel">
      <h3>Atalhos</h3>
      <div class="shortcuts">
        <a class="shortcut" href="#estatisticas"><strong>Estatísticas</strong><span>Visitas, pedidos e pratos mais procurados</span></a>
        <a class="shortcut" href="#cardapio"><strong>Editar cardápio</strong><span>Categorias, pacotes, itens, preços e fotos</span></a>
        <a class="shortcut" href="#textos"><strong>Textos do site</strong><span>Topo, chef, como funciona, galeria</span></a>
        <a class="shortcut" href="#historico"><strong>Histórico</strong><span>Quem mudou o quê — e desfazer</span></a>
        <a class="shortcut" href="../" target="_blank" rel="noopener"><strong>Ver o site ↗</strong><span>Abre em outra aba</span></a>
      </div>
    </section>`);
}

/* ---------- Histórico ---------- */

export async function historyView(view, { page = 1 } = {}) {
  setHTML(view, html`<p class="muted">Carregando histórico…</p>`);
  const [versions, activity] = await Promise.all([api(`versions?page=${page}&limit=20`), api("activity")]);
  const pages = Math.max(1, Math.ceil(versions.total / versions.limit));
  setHTML(view, html`
    <section class="panel">
      <h3>Versões publicadas</h3>
      <p class="sub">Cada "Salvar e publicar" cria uma versão. Restaurar cria uma nova versão igual à escolhida — nada é apagado.</p>
      <ol class="versions">
        ${versions.rows.map((v) => html`
        <li class="${v.id === S.version ? "current" : ""}">
          <div class="v-head"><strong>#${v.id}</strong><span>${dt(v.createdAt)}</span><span class="muted">${v.username || "sistema"}</span>
            ${v.id === S.version ? html`<span class="pill">No ar</span>` : html`<button type="button" class="btn btn-line" data-restore="${v.id}">Restaurar</button>`}</div>
          <ul class="v-summary">${(v.summary || []).map((s) => html`<li>${s}</li>`)}</ul>
        </li>`)}
      </ol>
      ${pages > 1 ? html`<div class="pager">
        <button type="button" class="btn btn-line" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Mais novas</button>
        <span class="muted">Página ${page} de ${pages}</span>
        <button type="button" class="btn btn-line" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Mais antigas →</button></div>` : ""}
    </section>
    <section class="panel">
      <h3>Acessos e segurança</h3>
      <ul class="activity">${activity.map((a) => html`<li><span>${dt(a.created_at)}</span><strong>${a.username || "—"}</strong><span>${a.action.replace(/_/g, " ")}</span><span class="muted">${a.detail || ""}</span></li>`)}</ul>
    </section>`);

  view.onclick = async (e) => {
    const pg = e.target.closest("[data-page]");
    if (pg) return historyView(view, { page: Number(pg.dataset.page) });
    const b = e.target.closest("[data-restore]");
    if (!b) return;
    if (S.dirty && !(await confirmDialog("Você tem alterações não salvas. Restaurar descarta essas alterações. Continuar?", { confirmLabel: "Descartar e restaurar" }))) return;
    if (!(await confirmDialog(`Restaurar a versão #${b.dataset.restore}? O site volta a ficar como estava nela.`, { confirmLabel: "Restaurar", danger: false }))) return;
    try {
      const r = await api(`versions/${b.dataset.restore}/restore`, { method: "POST", body: { baseVersion: S.version } });
      adoptVersion(r);
      toast(`Versão #${b.dataset.restore} restaurada e publicada.`, "ok");
      historyView(view);
    } catch (ex) { toast(ex.message, "err"); }
  };
}

/* ---------- Conta e equipe ---------- */

export async function accountView(view, me) {
  const users = await api("users");
  setHTML(view, html`
    <section class="panel">
      <h3>Minha senha</h3>
      <form class="form-grid" id="pwForm" novalidate>
        <div class="field"><label for="pw_cur">Senha atual</label><input class="input" id="pw_cur" type="password" name="current" autocomplete="current-password" required></div>
        <div class="field"><label for="pw_new">Nova senha</label><input class="input" id="pw_new" type="password" name="next" autocomplete="new-password" required><p class="help">8+ caracteres, com letras e números.</p></div>
        <button class="btn btn-primary" type="submit">Trocar senha</button>
      </form>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Contas da equipe</h3><button type="button" class="btn btn-line" id="newUser">+ Nova conta</button></div>
      <ul class="users">${users.map((u) => html`
        <li class="${u.active ? "" : "is-off"}"><div><strong>${u.name || u.username}</strong><span class="muted">@${u.username} · último acesso ${dt(u.last_login_at)}</span></div>
          ${u.id === me.id ? html`<span class="pill">Você</span>` : html`<button type="button" class="btn btn-line" data-user="${u.id}" data-active="${u.active ? "0" : "1"}">${u.active ? "Desativar" : "Reativar"}</button>`}</li>`)}</ul>
    </section>
    <section class="panel">
      <h3>Cópias de segurança</h3>
      <p class="sub">"Baixar cardápio (menu.json)" serve para atualizar a versão do site no GitHub Pages: substitua o arquivo data/menu.json do repositório por ele.</p>
      <div class="actions-row">
        <a class="btn btn-line" href="${new URL("api/admin/export", ROOT).href}">Baixar cardápio (menu.json)</a>
        <a class="btn btn-line" href="${new URL("api/admin/backup", ROOT).href}">Baixar backup do banco</a>
      </div>
    </section>`);

  view.querySelector("#pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("password", { method: "POST", body: formValues(e.target) });
      e.target.reset();
      toast("Senha alterada. Outras sessões foram encerradas.", "ok");
    } catch (ex) { toast(ex.message, "err"); }
  });
  view.querySelector("#newUser").addEventListener("click", () => openModal({
    title: "Nova conta da equipe",
    submitLabel: "Criar conta",
    body: html`
      <div class="field"><label for="nu_name">Nome</label><input class="input" id="nu_name" name="name" maxlength="60"></div>
      <div class="field"><label for="nu_user">Usuário</label><input class="input" id="nu_user" name="username" autocomplete="off" maxlength="40" required><p class="help">Letras, números, ponto, hífen ou _.</p></div>
      <div class="field"><label for="nu_pw">Senha inicial</label><input class="input" id="nu_pw" type="password" name="password" autocomplete="new-password" required><p class="help">Combine a senha pessoalmente; a pessoa pode trocá-la depois.</p></div>`,
    onSubmit: async (f) => { await api("users", { method: "POST", body: formValues(f) }); toast("Conta criada.", "ok"); accountView(view, me); },
  }));
  view.querySelectorAll("[data-user]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await api(`users/${b.dataset.user}`, { method: "PATCH", body: { active: b.dataset.active === "1" } });
      accountView(view, me);
    } catch (ex) { toast(ex.message, "err"); }
  }));
}
