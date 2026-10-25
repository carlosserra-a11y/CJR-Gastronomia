/* ============================================================
   Pedido de orçamento: validação do formulário e mensagem
   organizada para o WhatsApp. Funções puras — usadas pelo site
   e pelos testes. Nenhum preço final é calculado aqui.
   ============================================================ */

export const EVENT_TYPES = ["Corporativo", "Casamento", "Formatura", "Aniversário", "Batizado", "Confraternização", "Outro"];
export const LIMITS = { name: 80, email: 120, place: 120, other: 60, notes: 1000, guestsMax: 5000 };

export const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");

/** Telefone brasileiro com DDD (10 ou 11 dígitos), aceitando +55 na frente. */
export function normalizePhone(v) {
  const d = onlyDigits(v);
  const local = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  return /^[1-9]{2}9?\d{8}$/.test(local) ? local : "";
}

export function formatPhone(digits) {
  const d = onlyDigits(digits);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Data local de hoje no formato AAAA-MM-DD (o mesmo do <input type="date">). */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** "sexta-feira, 12/03/2027" */
export function formatEventDate(iso) {
  const d = parseISODate(iso);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, " ");

/**
 * Valida os campos essenciais do formulário.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateQuote(input, { today = todayISO(), hasSelections = false } = {}) {
  const errors = {};
  const value = {
    name: oneLine(input.name, LIMITS.name),
    phone: normalizePhone(input.phone),
    email: oneLine(input.email, LIMITS.email).toLowerCase(),
    eventType: EVENT_TYPES.includes(input.eventType) ? input.eventType : "",
    eventTypeOther: oneLine(input.eventTypeOther, LIMITS.other),
    dateUndefined: Boolean(input.dateUndefined),
    date: input.dateUndefined ? "" : String(input.date || ""),
    place: oneLine(input.place, LIMITS.place),
    guests: Math.floor(Number(input.guests)),
    interests: Array.isArray(input.interests) ? [...new Set(input.interests.map(String))] : [],
    notes: clean(input.notes, LIMITS.notes).replace(/\r\n/g, "\n"),
    consent: Boolean(input.consent),
  };

  if (value.name.split(" ").filter((w) => w.length >= 2).length < 2) errors.name = "Informe nome e sobrenome.";
  if (!value.phone) errors.phone = "Informe um WhatsApp com DDD, ex.: (51) 99999-0000.";
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email)) errors.email = "Confira o e-mail digitado.";
  if (!value.eventType) errors.eventType = "Escolha o tipo de evento.";
  else if (value.eventType === "Outro" && !value.eventTypeOther) errors.eventTypeOther = "Conte qual é o tipo de evento.";
  if (!value.dateUndefined) {
    if (!parseISODate(value.date)) errors.date = "Informe a data do evento (ou marque que ainda não está definida).";
    else if (value.date < today) errors.date = "A data do evento já passou.";
  }
  if (value.place.length < 2) errors.place = "Informe o local ou a cidade do evento.";
  if (!Number.isFinite(value.guests) || value.guests < 1) errors.guests = "Informe quantos convidados você espera.";
  else if (value.guests > LIMITS.guestsMax) errors.guests = `Para mais de ${LIMITS.guestsMax} convidados, conte nos detalhes em observações.`;
  if (!hasSelections && !value.interests.length) errors.interests = "Escolha pelo menos um serviço de interesse.";
  if (!value.consent) errors.consent = "Para enviar, confirme que leu o aviso de privacidade.";

  return { ok: Object.keys(errors).length === 0, errors, value };
}

/* ---------- Mensagem do WhatsApp ---------- */

// O WhatsApp usa *negrito* e _itálico_: tiramos esses símbolos do texto do cliente para não quebrar a formatação.
const plain = (s) => String(s ?? "").replace(/[*_~`]/g, "");

function selectionBlock(lines) {
  return lines.map(({ category, items, choice }) => {
    const title = `${plain(category.name)}${choice ? ` (${plain(category.choice?.label || "Formato")}: ${plain(choice)})` : ""}`;
    const names = items.map((i) => `• ${plain(i.name)}${i.tier ? ` — ${plain(i.tier)}` : ""}`);
    return [`_${title}_`, ...names].join("\n");
  }).join("\n\n");
}

/**
 * Monta a mensagem de orçamento.
 * @param {{ quote: object, lines: Array, categoryNames: Record<string,string>, brandName?: string }} args
 */
export function buildQuoteMessage({ quote, lines = [], categoryNames = {}, brandName = "CJR Gastronomia" }) {
  const eventType = quote.eventType === "Outro" ? `Outro — ${plain(quote.eventTypeOther)}` : quote.eventType;
  const date = quote.dateUndefined ? "A definir" : formatEventDate(quote.date);
  const interests = [...new Set([...quote.interests, ...lines.map((l) => l.category.id)])]
    .map((id) => categoryNames[id]).filter(Boolean).map((n) => `• ${plain(n)}`);

  const parts = [
    `*Solicitação de orçamento — ${plain(brandName)}*`,
    // O e-mail vai sem filtro: "_" dentro de um endereço não ativa itálico no WhatsApp e precisa ficar intacto
    ["*Contato*", `Nome: ${plain(quote.name)}`, `WhatsApp: ${formatPhone(quote.phone)}`, quote.email ? `E-mail: ${quote.email}` : ""].filter(Boolean).join("\n"),
    ["*Evento*", `Tipo: ${eventType}`, `Data: ${date}`, `Local: ${plain(quote.place)}`, `Convidados (estimativa): ${quote.guests}`].join("\n"),
  ];
  if (interests.length) parts.push(["*Serviços de interesse*", ...interests].join("\n"));
  if (lines.length) parts.push(["*Seleções do cardápio*", selectionBlock(lines)].join("\n"));
  if (quote.notes) parts.push(["*Observações, restrições e necessidades especiais*", plain(quote.notes)].join("\n"));
  parts.push("Enviado pelo cardápio virtual. Aguardo a proposta personalizada.");
  return parts.join("\n\n");
}

/** Link wa.me (null quando o número não está configurado). */
export function whatsappUrl(number, text = "") {
  const n = onlyDigits(number);
  if (n.length < 12) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
