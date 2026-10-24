/* Utilitários do site — HTML seguro (escapado por padrão), DOM, armazenamento e preferências. */

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const part = (v) => {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
};

/** Template HTML: tudo que é interpolado é escapado, exceto o que vier de html`` ou raw(). */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new Raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const setHTML = (el, tpl) => { el.innerHTML = part(tpl); return el; };

/** Parágrafos a partir de texto com linhas em branco. */
export const paragraphs = (text) => String(text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => html`<p>${p}</p>`);

export const pad2 = (n) => String(n).padStart(2, "0");

export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* sem armazenamento */ } },
};

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Endereço de imagem: arquivo do site/upload (relativo) ou link https. */
export const imgSrc = (p) => (!p ? "" : /^https:\/\//.test(p) ? p : new URL(p, document.baseURI).href);

export function maskPhone(v) {
  const d = String(v || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function toast(message, type = "") {
  const box = $("#toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 3600);
}

/** Divide o texto em palavras com máscara, para a entrada palavra por palavra. */
export function splitWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean)
    .map((w, i) => html`<span class="w"><span style="--i:${i}">${w}</span></span> `);
}
