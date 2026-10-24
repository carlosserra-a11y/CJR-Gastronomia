/* ============================================================
   Formulário de orçamento: máscaras, validação ao sair do campo,
   resumo ao vivo e envio organizado pelo WhatsApp.
   Os dados pessoais ficam só na memória da página (não são salvos).
   ============================================================ */
import { $, $$, maskPhone, setHTML, toast } from "./util.js";
import { validateQuote, buildQuoteMessage, whatsappUrl } from "../shared/quote.js";
import { summaryView, confirmView } from "./views.js";
import { openLayer } from "./dialog.js";
import * as store from "./store.js";

let draft = {};
export const getDraft = () => draft;

function readForm(form) {
  const el = form.elements;
  return {
    name: el.name.value, phone: el.phone.value, email: el.email.value,
    eventType: el.eventType.value, eventTypeOther: el.eventTypeOther.value,
    date: el.date.value, dateUndefined: el.dateUndefined.checked,
    place: el.place.value, guests: el.guests.value,
    interests: $$('input[name="interests"]:checked', form).map((i) => i.value),
    notes: el.notes.value, consent: el.consent.checked,
  };
}

function showErrors(form, errors) {
  for (const box of $$("[data-field]", form)) {
    const name = box.dataset.field;
    const msg = errors[name] || "";
    const err = box.querySelector(".err");
    if (err) { err.textContent = msg; err.hidden = !msg; }
    box.classList.toggle("has-error", Boolean(msg));
    if (name === "interests") continue;
    const ctl = box.querySelector("input:not([type=checkbox]), select, textarea") || box.querySelector("input");
    if (!ctl) continue;
    ctl.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg && err) ctl.setAttribute("aria-describedby", err.id); else ctl.removeAttribute("aria-describedby");
  }
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const label = btn.querySelector("span");
  if (label) { label.textContent = "Mensagem copiada"; setTimeout(() => { label.textContent = "Copiar mensagem"; }, 2200); }
}

function openConfirm(data) {
  const layer = $("#layer");
  const dialog = $("#dialog");
  setHTML(dialog, confirmView(data));
  dialog.querySelector("[data-copy]")?.addEventListener("click", (e) => copy(data.text, e.currentTarget));
  openLayer(layer, { initialFocus: ".btn" });
}

/** Liga o formulário recém-desenhado. Devolve a função de limpeza (troca de página). */
export function bindQuote(root, menu) {
  const form = $("#quoteForm", root);
  if (!form) return () => {};
  const touched = new Set();
  const validate = () => validateQuote(readForm(form), { hasSelections: store.count() > 0 });
  const refresh = () => {
    if (!touched.size) return;
    const { errors } = validate();
    showErrors(form, Object.fromEntries(Object.entries(errors).filter(([k]) => touched.has(k))));
  };

  form.addEventListener("input", (e) => {
    if (e.target.name === "phone") e.target.value = maskPhone(e.target.value);
    draft = readForm(form);
    if (form.querySelector(".has-error")) refresh();
  });

  form.addEventListener("change", (e) => {
    const { name } = e.target;
    if (name === "eventType") {
      const other = form.querySelector('[data-field="eventTypeOther"]');
      const show = e.target.value === "Outro";
      other.classList.toggle("is-hidden", !show);
      if (show) form.elements.eventTypeOther.focus();
    }
    if (name === "dateUndefined") {
      form.elements.date.disabled = e.target.checked;
      touched.add("date");
    }
    if (name) touched.add(name === "dateUndefined" ? "date" : name);
    draft = readForm(form);
    refresh();
  });

  form.addEventListener("focusout", (e) => {
    const { name } = e.target;
    if (!name || name === "interests") return;
    touched.add(name);
    refresh();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = validate();
    if (!r.ok) {
      Object.keys(r.errors).forEach((k) => touched.add(k));
      showErrors(form, r.errors);
      const first = form.querySelector(".has-error input:not([type=checkbox]), .has-error select, .has-error textarea, .has-error input");
      first?.focus({ preventScroll: false });
      toast("Confira os campos destacados.", "err");
      return;
    }
    const names = Object.fromEntries(menu.categories.map((c) => [c.id, c.name]));
    const text = buildQuoteMessage({ quote: r.value, lines: store.lines(), categoryNames: names, brandName: menu.settings.brandName });
    const url = whatsappUrl(menu.settings.whatsapp, text);
    if (url) window.open(url, "_blank", "noopener");
    openConfirm({ text, url, settings: menu.settings });
  });

  const stop = store.onChange(() => {
    setHTML($("#summary", root), summaryView());
    const selected = new Set(store.lines().map((l) => l.category.id));
    $$('input[name="interests"]', form).forEach((i) => { if (selected.has(i.value)) i.checked = true; });
    draft = readForm(form);
  });
  return stop;
}
