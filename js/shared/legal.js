/* ============================================================
   Dados legais da empresa e textos jurídicos — usados pelo site,
   pelo painel e pelo servidor. Funções puras.
   Os textos (privacidade, termos, reembolso) ficam no painel e podem
   citar os dados da empresa com marcadores como {{empresa}} e {{cnpj}},
   que são trocados na hora de mostrar (mudou no painel, muda em tudo).
   ============================================================ */

export const LEGAL_PAGES = {
  privacidade: { key: "privacyText", title: "Política de Privacidade e Cookies", kicker: "Transparência" },
  termos: { key: "termsText", title: "Termos de Uso", kicker: "Regras do site" },
  reembolso: { key: "refundText", title: "Cancelamento e Reembolso", kicker: "Seus direitos" },
};

const digits = (v) => String(v ?? "").replace(/\D/g, "");

/** CNPJ com dígitos verificadores corretos (aceita com ou sem pontuação). */
export function isValidCnpj(v) {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

export const formatCnpj = (v) => digits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

/** "5548996835439" → "(48) 99683-5439". */
export function formatPhoneBR(v) {
  const d = digits(v).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Canal para assuntos de privacidade e atendimento: WhatsApp e, se houver, e-mail. */
export function contactLine(s = {}) {
  const parts = [];
  if (s.whatsapp) parts.push(`WhatsApp ${formatPhoneBR(s.whatsapp)}`);
  if (s.email) parts.push(`e-mail ${s.email}`);
  return parts.join(" ou ") || "canais de contato do site";
}

/** Troca os marcadores dos textos jurídicos pelos dados da empresa. Marcador sem dado vira "(a informar)". */
export function fillLegal(text, settings = {}, content = {}) {
  const vars = {
    empresa: settings.legalName || settings.brandName || "",
    marca: settings.brandName || "",
    cnpj: settings.cnpj ? formatCnpj(settings.cnpj) : "",
    endereco: settings.legalAddress || "",
    contato: contactLine(settings),
    whatsapp: settings.whatsapp ? formatPhoneBR(settings.whatsapp) : "",
    email: settings.email || "",
    atualizado: content.legalUpdated || "",
  };
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.hasOwn(vars, k) ? vars[k] || "(a informar)" : m));
}

/**
 * Texto do painel → blocos para a página: "## Título" vira seção, linhas com "- " viram lista,
 * o resto vira parágrafo. Devolve [{ type: "h"|"p"|"ul", text|items, id }]. Quem desenha escapa o texto.
 */
export function legalBlocks(text) {
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const body = (lines) => {
    if (!lines.length) return [];
    if (lines.every((l) => l.startsWith("- "))) return [{ type: "ul", items: lines.map((l) => l.slice(2).trim()) }];
    return [{ type: "p", text: lines.join(" ") }];
  };
  return String(text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).flatMap((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    // o título pode vir colado ao texto da seção, na linha de baixo
    if (lines[0].startsWith("## ")) {
      const t = lines[0].slice(3).trim();
      return [{ type: "h", text: t, id: `sec-${slug(t)}` }, ...body(lines.slice(1))];
    }
    return body(lines);
  });
}
