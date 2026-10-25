/* ============================================================
   Regras do cardápio — usadas pelo site, pelo painel e pelo servidor.
   Estrutura do documento: settings, content e categories
   (categoria → grupos → itens). Ver README.md.
   ============================================================ */

export const SELECT_MODES = { one: "Escolher uma opção", many: "Escolher várias opções" };
export const TIERS = ["", "Basic", "Medium", "Premium"];

/** Categorias do portfólio (filtros do site e opções do painel). */
export const PORTFOLIO_CATEGORIES = {
  mesa: "Mesas de frios",
  coffee: "Coffee & café",
  pratos: "Pratos",
  buffet: "Buffets & risotos",
  doces: "Doces",
  eventos: "Eventos & bastidores",
};

const isActive = (x) => Boolean(x) && x.active !== false;

/**
 * Versão pública: só o que está ativo (grupos e categorias vazios somem).
 * Com "mostrar preços" desligado, os valores nem saem do servidor.
 */
export function publicView(doc) {
  const showPrices = Boolean(doc.settings?.showPrices);
  const publicItem = (i) => (showPrices ? i : { ...i, price: null });
  const categories = (doc.categories || []).filter(isActive).map((c) => {
    const groups = (c.groups || []).filter(isActive)
      .map((g) => ({ ...g, items: (g.items || []).filter(isActive).map(publicItem) }))
      .filter((g) => g.items.length);
    const ids = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
    const presets = (c.presets || [])
      .map((p) => ({ ...p, itemIds: (p.itemIds || []).filter((id) => ids.has(id)) }))
      .filter((p) => p.itemIds.length);
    return { ...c, groups, presets };
  }).filter((c) => c.groups.length);
  return { ...doc, categories };
}

/** Índice para buscas rápidas: categoria por id e item por id (dentro da categoria). */
export function indexMenu(doc) {
  const categories = new Map();
  for (const category of doc.categories || []) {
    const items = new Map();
    for (const group of category.groups || []) for (const item of group.items || []) items.set(item.id, { ...item, groupName: group.name });
    categories.set(category.id, { category, items });
  }
  return { categories, order: (doc.categories || []).map((c) => c.id) };
}

export const formatBRL = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto de preço de referência ("a partir de R$ 45,00 por pessoa") ou "" quando não deve aparecer. */
export function priceLabel(item, settings = {}) {
  if (!settings.showPrices || item.price === null || item.price === undefined || item.price === "") return "";
  const unit = item.priceUnit ? ` ${item.priceUnit}` : "";
  return `a partir de ${formatBRL(item.price)}${unit}`;
}

/* ---------- Resumo das alterações (histórico do painel) ---------- */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const withoutGroups = ({ groups: _groups, ...rest }) => rest;

function itemsById(category) {
  const map = new Map();
  for (const g of category.groups || []) for (const i of g.items || []) map.set(i.id, i);
  return map;
}

function categoryChanges(prev, next) {
  const parts = [];
  if ((prev.active !== false) !== (next.active !== false)) parts.push(next.active === false ? "desativada" : "ativada");
  const a = itemsById(prev), b = itemsById(next);
  const added = [...b.keys()].filter((k) => !a.has(k)).length;
  const removed = [...a.keys()].filter((k) => !b.has(k)).length;
  const edited = [...b.keys()].filter((k) => a.has(k) && !same(a.get(k), b.get(k))).length;
  if (added) parts.push(plural(added, "item adicionado", "itens adicionados"));
  if (removed) parts.push(plural(removed, "item excluído", "itens excluídos"));
  if (edited) parts.push(plural(edited, "item editado", "itens editados"));
  const dataChanged = !same({ ...withoutGroups(prev), active: null }, { ...withoutGroups(next), active: null });
  if (dataChanged) parts.push("dados da categoria editados");
  if (!parts.length) parts.push("grupos ou ordem alterados");
  return parts;
}

/** Lista curta, em português, do que mudou entre duas versões do cardápio. */
export function diffMenus(before, after) {
  const out = [];
  if (!same(before.settings, after.settings)) out.push("Contato e configurações alterados");
  if (!same(before.content, after.content)) out.push("Textos do site alterados");

  const prevCats = new Map((before.categories || []).map((c) => [c.id, c]));
  const nextCats = new Map((after.categories || []).map((c) => [c.id, c]));
  for (const [id, c] of nextCats) if (!prevCats.has(id)) out.push(`Categoria "${c.name}" criada`);
  for (const [id, c] of prevCats) if (!nextCats.has(id)) out.push(`Categoria "${c.name}" excluída`);
  for (const [id, next] of nextCats) {
    const prev = prevCats.get(id);
    if (prev && !same(prev, next)) out.push(`${next.name}: ${categoryChanges(prev, next).join(", ")}`);
  }
  const kept = (from, other) => [...from.keys()].filter((k) => other.has(k));
  if (!same(kept(prevCats, nextCats), kept(nextCats, prevCats))) out.push("Ordem das categorias alterada");
  return out;
}
