/* ============================================================
   Núcleo do painel: API (com proteção CSRF), estado de edição,
   campos de formulário ligados ao rascunho, modal e avisos.
   ============================================================ */
import { html, raw, esc, $, $$, setHTML } from "../site/util.js";

export { html, raw, esc, $, $$, setHTML };
export const ROOT = new URL("../", location.href);

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(new URL(`api/admin/${path}`, ROOT), {
    method,
    credentials: "same-origin",
    headers: { "X-Requested-With": "cjr-admin", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  if (res.headers.get("content-type")?.includes("application/json")) data = await res.json();
  if (res.status === 401 && !path.startsWith("session") && !path.startsWith("login")) window.dispatchEvent(new CustomEvent("auth:expired"));
  if (!res.ok) throw new ApiError(data?.error || `Erro ${res.status}`, res.status, data);
  return data;
}

export function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  el.textContent = message;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, type === "err" ? 6000 : 3200);
}

export const dt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const imgSrc = (p) => (!p ? "" : /^https:\/\//.test(p) ? p : new URL(p, ROOT).href);

export const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

/** Identificador novo e único dentro de `taken`. */
export function uniqueId(name, taken) {
  const base = slugify(name) || "item";
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/* ---------- Estado de edição (rascunho x publicado) ---------- */

export const S = { version: 0, saved: null, draft: null, dirty: false };
const listeners = new Set();
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(S));

const parsePath = (path) => String(path).split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k));

export function getIn(obj, path) {
  return parsePath(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Cópia nova do objeto com `value` no caminho (só os níveis do caminho são copiados). */
export function setIn(obj, path, value) {
  const keys = Array.isArray(path) ? path : parsePath(path);
  if (!keys.length) return value;
  const [k, ...rest] = keys;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[k] = setIn(obj?.[k] ?? (typeof rest[0] === "number" ? [] : {}), rest, value);
  return copy;
}

function refreshDirty() {
  S.dirty = JSON.stringify(S.draft) !== JSON.stringify(S.saved);
  emit();
}

export function setDraft(path, value) { S.draft = setIn(S.draft, path, value); refreshDirty(); }

/** Alterações de estrutura (adicionar, excluir, reordenar): recebe uma cópia para modificar. */
export function mutate(fn) {
  const next = structuredClone(S.draft);
  fn(next);
  S.draft = next;
  refreshDirty();
}

export async function loadMenu() {
  const r = await api("menu");
  S.version = r.version; S.saved = r.menu; S.draft = structuredClone(r.menu);
  refreshDirty();
}

export async function saveMenu() {
  const r = await api("menu", { method: "PUT", body: { baseVersion: S.version, menu: S.draft } });
  if (!r.unchanged) { S.version = r.version; S.saved = r.menu; S.draft = structuredClone(r.menu); }
  refreshDirty();
  return r;
}

export function discard() { S.draft = structuredClone(S.saved); refreshDirty(); }

export function adoptVersion(r) {
  S.version = r.version; S.saved = r.menu; S.draft = structuredClone(r.menu);
  refreshDirty();
}

/* ---------- Campos ligados ao rascunho (data-bind="caminho") ---------- */

let uid = 0;
const fid = () => `f${++uid}`;

export function field(label, path, { type = "text", help = "", cls = "", placeholder = "", max = "", attrs = "" } = {}) {
  const id = fid();
  const value = getIn(S.draft, path) ?? "";
  const inputType = type === "price" ? "text" : type === "int" ? "number" : type;
  return html`<div class="field ${cls}"><label for="${id}">${label}</label>
    <input class="input" id="${id}" type="${inputType}" data-bind="${path}" data-type="${type}" value="${type === "price" && value !== "" ? String(value).replace(".", ",") : value}"
      ${placeholder ? raw(`placeholder="${esc(placeholder)}"`) : ""} ${max ? raw(`maxlength="${max}"`) : ""} ${type === "price" ? raw('inputmode="decimal"') : ""} ${raw(attrs)}>
    ${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}

export function area(label, path, { rows = 3, help = "", cls = "", lines = false, max = "" } = {}) {
  const id = fid();
  const value = getIn(S.draft, path);
  const text = lines ? (value || []).join("\n") : value ?? "";
  return html`<div class="field ${cls}"><label for="${id}">${label}</label>
    <textarea class="input textarea" id="${id}" rows="${rows}" data-bind="${path}" data-type="${lines ? "lines" : "text"}" ${max ? raw(`maxlength="${max}"`) : ""}>${text}</textarea>
    ${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}

export function choice(label, path, options, { help = "", cls = "", type = "text" } = {}) {
  const id = fid();
  const value = String(getIn(S.draft, path) ?? "");
  return html`<div class="field ${cls}"><label for="${id}">${label}</label>
    <select class="input select" id="${id}" data-bind="${path}" data-type="${type}">
      ${options.map(([v, t]) => html`<option value="${v}" ${String(v) === value ? "selected" : ""}>${t}</option>`)}
    </select>${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}

export function toggle(path, label = "", { on = "Ativo", off = "Oculto" } = {}) {
  const active = getIn(S.draft, path) !== false;
  return html`<label class="switch" title="${active ? "Aparece no site" : "Escondido do site"}">
    <input type="checkbox" data-bind="${path}" data-type="bool" ${active ? "checked" : ""}>
    <span class="switch-track" aria-hidden="true"></span><span class="switch-text" ${label ? raw("data-fixed") : ""}>${label || (active ? on : off)}</span></label>`;
}

/** Campo de foto. Com `path` grava no rascunho; com `{ name, value }` é um campo comum de formulário (modal). */
export function imageField(label, path, { name = "", value: initial = "" } = {}) {
  const value = (path ? getIn(S.draft, path) : initial) || "";
  const id = fid();
  const target = path ? raw(`data-bind="${esc(path)}" data-type="text"`) : raw(`name="${esc(name)}"`);
  return html`<div class="field"><label for="${id}">${label}</label>
    <div class="img-field" data-img-field>
      <div class="img-preview">${value ? html`<img src="${imgSrc(value)}" alt="">` : html`<span>Sem foto</span>`}</div>
      <div class="img-ctrls">
        <span class="btn btn-line file-btn">Enviar foto<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Enviar foto"></span>
        <input class="input" id="${id}" ${target} value="${value}" placeholder="ou cole um link https://">
        ${value ? html`<button type="button" class="link-btn" data-clear-img>Remover foto</button>` : ""}
        <p class="help">A foto é reduzida automaticamente (máx. 1600 px) antes do envio.</p>
      </div>
    </div></div>`;
}

function coerce(el) {
  const t = el.dataset.type;
  if (t === "bool") return el.checked;
  if (t === "int") return el.value === "" ? 0 : Math.max(0, Math.floor(Number(el.value) || 0));
  if (t === "lines") return el.value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (t === "price") {
    const v = el.value.trim().replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : el.value;
  }
  return el.value;
}

/** Liga todos os [data-bind] de uma área ao rascunho. */
export function bindFields(root, { onChange } = {}) {
  const handler = (e) => {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    if (e.type === "input" && (el.type === "checkbox" || el.tagName === "SELECT")) return;
    setDraft(el.dataset.bind, coerce(el));
    if (el.dataset.type === "bool") {
      const txt = el.closest(".switch")?.querySelector(".switch-text");
      if (txt && !txt.hasAttribute("data-fixed")) txt.textContent = el.checked ? "Ativo" : "Oculto";
    }
    onChange?.(el);
  };
  root.addEventListener("input", handler);
  root.addEventListener("change", handler);
  bindImageFields(root);
}

/**
 * Depois de redesenhar uma lista, devolve o foco ao primeiro controle habilitado entre os seletores
 * (em ordem de preferência). Com um modal aberto, espera ele fechar: até lá o resto da página fica inerte.
 */
export function refocus(root, ...selectors) {
  const open = document.querySelector("dialog[open]");
  if (open) { open.addEventListener("close", () => refocus(root, ...selectors), { once: true }); return null; }
  for (const sel of selectors) {
    const el = sel ? root?.querySelector(sel) : null;
    if (el && !el.disabled) { el.focus({ preventScroll: true }); return el; }
  }
  return null;
}

/* ---------- Fotos ---------- */

async function resizeImage(file, max) {
  if (file.size > 25 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 25 MB).");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
  const out = blob && blob.type === "image/webp" ? blob : await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(out); });
}

export function bindImageFields(root) {
  for (const box of root.querySelectorAll("[data-img-field]")) {
    if (box.dataset.bound) continue;
    box.dataset.bound = "1";
    const file = box.querySelector("input[type=file]");
    const input = box.querySelector("input[data-bind], input[name]");
    const preview = box.querySelector(".img-preview");
    const show = (v) => setHTML(preview, v ? html`<img src="${imgSrc(v)}" alt="">` : html`<span>Sem foto</span>`);
    const commit = (v) => {
      input.value = v;
      if (input.dataset.bind) setDraft(input.dataset.bind, v);
      input.dispatchEvent(new Event("change", { bubbles: true })); // avisa quem observa o campo (ex.: portfólio limpa a miniatura antiga)
      show(v);
    };
    input.addEventListener("change", () => show(input.value.trim()));
    box.querySelector("[data-clear-img]")?.addEventListener("click", () => commit(""));
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      box.classList.add("is-busy");
      try {
        const dataUrl = await resizeImage(f, 1600);
        const res = await api("upload", { method: "POST", body: { dataUrl } });
        commit(res.path);
        toast("Foto enviada. Salve para publicar.", "ok");
      } catch (e) { toast(e.message || "Não foi possível enviar a foto.", "err"); }
      finally { box.classList.remove("is-busy"); file.value = ""; }
    });
  }
}

/* ---------- Modal (elemento <dialog> nativo) ---------- */

export function openModal({ title, body, submitLabel = "Salvar", danger = false, onSubmit, wide = false }) {
  const m = $("#modal");
  m.classList.toggle("wide", wide);
  setHTML(m, html`
    <form method="dialog" class="modal-form" id="modalForm" novalidate>
      <header class="modal-head"><h2 id="modalTitle">${title}</h2>
        <button type="button" class="icon-btn" data-modal-close aria-label="Fechar">✕</button></header>
      <div class="modal-body">${body}</div>
      <p class="err-box" id="modalErr" role="alert" hidden></p>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
        ${onSubmit ? html`<button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modalSubmit">${submitLabel}</button>` : ""}
      </footer>
    </form>`);
  const form = $("#modalForm");
  form.querySelectorAll("[data-modal-close]").forEach((b) => b.addEventListener("click", () => m.close()));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#modalErr");
    err.hidden = true;
    try {
      await onSubmit(form);
      m.close();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  m.showModal();
  form.querySelector(".modal-body input, .modal-body select, .modal-body textarea")?.focus();
  return form;
}

export function confirmDialog(message, { title = "Tem certeza?", confirmLabel = "Confirmar", danger = true } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    openModal({ title, body: html`<p class="confirm-text">${message}</p>`, submitLabel: confirmLabel, danger, onSubmit: async () => { ok = true; } });
    $("#modal").addEventListener("close", () => resolve(ok), { once: true });
  });
}

/** Lê os campos de um formulário simples (checkbox → boolean). */
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type !== "file") out[el.name] = el.value;
  }
  return out;
}
