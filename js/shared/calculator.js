/* ============================================================
   Calculadora de convidados — quanto servir (gramas por pessoa) e
   faixa de preço APROXIMADA por opção. Usada pelo site, pelo painel,
   pelo servidor (validação) e pelos testes.
   Os valores de referência ficam em content.calcOptions e são
   editados no painel; o orçamento final continua sendo da equipe.
   ============================================================ */

export const CALC_KINDS = { salgado: "Salgado", doce: "Doce" };

export const CALC_PROFILES = {
  leve: { label: "Leve", hint: "Evento curto ou com outras opções servidas", factor: 0.85 },
  normal: { label: "Normal", hint: "Quantidade de referência", factor: 1 },
  farto: { label: "Farto", hint: "Evento longo ou convidados com mais apetite", factor: 1.2 },
};

/** Com dois ou mais salgados, cada um entra em porção menor (as pessoas dividem o apetite). */
export const COMBO_FACTOR = 0.8;
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 2000;

const round10 = (n) => Math.round(n / 10) * 10;
const round1 = (n) => Math.round(n * 10) / 10;

/** Reais sem centavos (ex.: "R$ 7.000"), para faixas de estimativa. */
export const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** Peso legível: gramas abaixo de 1 kg, quilos com uma casa acima. */
export const weightLabel = (grams) => (grams < 1000 ? `${Math.round(grams)} g` : `${round1(grams / 1000).toLocaleString("pt-BR")} kg`);

export function clampGuests(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, v)) : MIN_GUESTS;
}

/**
 * Estimativa para um evento.
 * @param {{ guests: number, profile?: string, selected?: string[] }} input
 * @param {Array<{ id: string, name: string, kind: string, grams: number, pieces?: number, piecesLabel?: string, priceMin: number, priceMax: number, active?: boolean }>} options
 */
export function estimate({ guests, profile = "normal", selected = [] }, options = []) {
  const n = clampGuests(guests);
  const profileFactor = CALC_PROFILES[profile]?.factor ?? 1;
  const chosen = options.filter((o) => o.active !== false && selected.includes(o.id));
  const savoryCount = chosen.filter((o) => o.kind !== "doce").length;
  const combo = savoryCount >= 2;

  const lines = chosen.map((o) => {
    const k = profileFactor * (combo && o.kind !== "doce" ? COMBO_FACTOR : 1);
    const perGuestGrams = Math.round(o.grams * k);
    const perGuestPieces = o.pieces ? Math.max(1, Math.round(o.pieces * k)) : 0;
    return {
      id: o.id,
      name: o.name,
      categoryId: o.categoryId || "",
      perGuestGrams,
      totalGrams: perGuestGrams * n,
      perGuestPieces,
      totalPieces: perGuestPieces * n,
      piecesLabel: o.piecesLabel || "unidades",
      min: round10(o.priceMin * k * n),
      max: round10(o.priceMax * k * n),
    };
  });

  const totalGrams = lines.reduce((s, l) => s + l.totalGrams, 0);
  const min = lines.reduce((s, l) => s + l.min, 0);
  const max = lines.reduce((s, l) => s + l.max, 0);
  return { guests: n, profile: CALC_PROFILES[profile] ? profile : "normal", combo, lines, totalGrams, min, max, perGuestMin: min / n, perGuestMax: max / n };
}

/** Mensagem do WhatsApp com a simulação (deixa claro que é aproximada). */
export function estimateMessage(est) {
  const profile = CALC_PROFILES[est.profile]?.label || "Normal";
  const rows = est.lines.map((l) => {
    const qty = l.totalPieces ? `${l.totalPieces} ${l.piecesLabel} · ${weightLabel(l.totalGrams)}` : weightLabel(l.totalGrams);
    return `• ${l.name}: ${qty} — ${brl(l.min)} a ${brl(l.max)}`;
  });
  return [
    "Olá, Chef Carlos! Fiz uma simulação na calculadora do site:",
    "",
    `• Convidados: ${est.guests}`,
    `• Perfil do evento: ${profile}`,
    ...rows,
    "",
    `Estimativa: ${brl(est.min)} a ${brl(est.max)} (≈ ${brl(est.perGuestMin)} a ${brl(est.perGuestMax)} por convidado)`,
    "Sei que é um valor aproximado. Podemos conversar sobre o orçamento?",
  ].join("\n");
}
