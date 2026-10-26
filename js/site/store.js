/* "Minha experiência": estado da seleção, salvo só no aparelho do cliente. */
import { storage } from "./util.js";
import * as S from "../shared/selection.js";
import { track } from "./track.js";

const KEY = "cjr:selection:v1";
const listeners = new Set();
let state = {};
let idx = null;

export function initStore(index) {
  idx = index;
  state = S.sanitize(storage.get(KEY, {}), idx);
  storage.set(KEY, state);
}

function commit(next) {
  if (next === state) return;
  state = next;
  storage.set(KEY, state);
  for (const fn of listeners) fn(state);
}

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const categoryOf = (id) => idx?.categories.get(id)?.category || null;

/** Marca/desmarca. Devolve uma mensagem de erro quando o limite da categoria foi atingido. */
export function toggle(categoryId, itemId) {
  const category = categoryOf(categoryId);
  if (!category) return null;
  const r = S.toggleItem(state, category, itemId);
  commit(r.state);
  if (!r.error && S.isSelected(r.state, categoryId, itemId)) {
    track("dish", { c: categoryId, i: itemId, name: idx?.categories.get(categoryId)?.items.get(itemId)?.name || "" });
  }
  return r.error;
}

export const remove = (categoryId, itemId) => commit(S.removeItem(state, categoryId, itemId));
export const choose = (categoryId, value) => commit(S.setChoice(state, categoryId, value));
export const clearAll = () => commit({});

export function applyPreset(categoryId, presetId) {
  const category = categoryOf(categoryId);
  const preset = category?.presets?.find((p) => p.id === presetId);
  if (!preset) return;
  commit(S.applyPreset(state, category, preset));
  track("preset", { c: categoryId, p: presetId });
}

export const isSelected = (categoryId, itemId) => S.isSelected(state, categoryId, itemId);
export const choiceOf = (categoryId) => S.choiceOf(state, categoryId);
export const count = () => S.countSelected(state);
export const categoryCount = (categoryId) => S.categoryCount(state, categoryId);
export const lines = () => (idx ? S.selectionLines(state, idx) : []);
