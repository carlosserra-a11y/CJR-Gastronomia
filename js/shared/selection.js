/* ============================================================
   "Minha experiência": o que o cliente selecionou no cardápio.
   Funções puras (sem DOM) — o estado nunca é alterado no lugar.
   Estado: { [categoriaId]: { ids: [itemId...], choice: "" } }
   ============================================================ */

const entry = (state, categoryId) => state[categoryId] || { ids: [], choice: "" };

function withEntry(state, categoryId, next) {
  const rest = { ...state };
  delete rest[categoryId];
  return next.ids.length || next.choice ? { ...rest, [categoryId]: next } : rest;
}

/**
 * Marca/desmarca um item. Em categorias "one", escolher outro item troca a escolha.
 * Devolve { state, error } — error quando o limite de escolhas foi atingido.
 */
export function toggleItem(state, category, itemId) {
  const current = entry(state, category.id);
  if (current.ids.includes(itemId)) {
    return { state: withEntry(state, category.id, { ...current, ids: current.ids.filter((id) => id !== itemId) }), error: null };
  }
  if (category.select === "one") {
    return { state: withEntry(state, category.id, { ...current, ids: [itemId] }), error: null };
  }
  const max = Number(category.maxPicks) || 0;
  if (max && current.ids.length >= max) {
    return { state, error: `Você pode escolher até ${max} ${max === 1 ? "opção" : "opções"} em ${category.name}.` };
  }
  return { state: withEntry(state, category.id, { ...current, ids: [...current.ids, itemId] }), error: null };
}

export const removeItem = (state, categoryId, itemId) => {
  const current = entry(state, categoryId);
  return withEntry(state, categoryId, { ...current, ids: current.ids.filter((id) => id !== itemId) });
};

export const clearCategory = (state, categoryId) => withEntry(state, categoryId, { ids: [], choice: "" });

export const setChoice = (state, categoryId, choice) => withEntry(state, categoryId, { ...entry(state, categoryId), choice: String(choice || "") });

/** Aplica uma seleção pronta (ex.: "Seleção Clássica"), respeitando o limite da categoria. */
export function applyPreset(state, category, preset) {
  const max = Number(category.maxPicks) || 0;
  const ids = max ? preset.itemIds.slice(0, max) : [...preset.itemIds];
  return withEntry(state, category.id, { ...entry(state, category.id), ids });
}

export const isSelected = (state, categoryId, itemId) => entry(state, categoryId).ids.includes(itemId);
export const countSelected = (state) => Object.values(state).reduce((n, e) => n + e.ids.length, 0);
export const categoryCount = (state, categoryId) => entry(state, categoryId).ids.length;
export const choiceOf = (state, categoryId) => entry(state, categoryId).choice;

/** Remove itens/categorias que não existem mais no cardápio (ex.: desativados pelo painel). */
export function sanitize(state, idx) {
  const out = {};
  for (const [categoryId, value] of Object.entries(state || {})) {
    const cat = idx.categories.get(categoryId);
    if (!cat || !value || !Array.isArray(value.ids)) continue;
    let ids = [...new Set(value.ids.filter((id) => cat.items.has(id)))];
    if (cat.category.select === "one") ids = ids.slice(0, 1);
    const options = cat.category.choice?.options || [];
    const choice = options.includes(value.choice) ? value.choice : "";
    if (ids.length || choice) out[categoryId] = { ids, choice };
  }
  return out;
}

/** Linhas para resumo e mensagem, na ordem do cardápio: [{ category, items, choice }]. */
export function selectionLines(state, idx) {
  const lines = [];
  for (const categoryId of idx.order) {
    const value = state[categoryId];
    const cat = idx.categories.get(categoryId);
    if (!value || !cat || !value.ids.length) continue;
    const items = value.ids.map((id) => cat.items.get(id)).filter(Boolean);
    if (items.length) lines.push({ category: cat.category, items, choice: value.choice || "" });
  }
  return lines;
}
