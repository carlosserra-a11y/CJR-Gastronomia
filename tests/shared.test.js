import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicView, indexMenu, priceLabel, diffMenus } from "../js/shared/menu.js";
import { toggleItem, removeItem, applyPreset, setChoice, sanitize, selectionLines, countSelected } from "../js/shared/selection.js";
import { validateQuote, buildQuoteMessage, whatsappUrl, normalizePhone, formatEventDate } from "../js/shared/quote.js";

const seed = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
const clone = (x) => structuredClone(x);

/* ---------- Cardápio ---------- */

test("versão pública remove itens, grupos e categorias inativos", () => {
  const doc = clone(seed);
  doc.categories[0].groups[0].items[0].active = false;           // um item do coffee
  doc.categories[1].active = false;                              // mesa de frios inteira
  doc.categories[6].groups[0].items[0].active = false;           // único item do cook show
  const pub = publicView(doc);
  const ids = pub.categories.map((c) => c.id);
  assert.ok(!ids.includes("mesa-de-frios"));
  assert.ok(!ids.includes("cook-show"), "categoria sem itens ativos some");
  assert.equal(pub.categories.find((c) => c.id === "coffee-corporativo").groups[0].items.length, 2);
  assert.equal(seed.categories[0].groups[0].items[0].active, true, "não altera o documento original");
});

test("seleções prontas perdem itens desativados", () => {
  const doc = clone(seed);
  const desserts = doc.categories.find((c) => c.id === "sobremesas");
  desserts.groups[0].items.find((i) => i.id === "pavlova").active = false;
  const pub = publicView(doc).categories.find((c) => c.id === "sobremesas");
  assert.ok(!pub.presets.find((p) => p.id === "selecao-contemporanea").itemIds.includes("pavlova"));
});

test("versão pública não envia preços quando a exibição está desligada", () => {
  const doc = clone(seed);
  doc.categories[0].groups[0].items[0].price = 45;
  doc.settings.showPrices = false;
  assert.equal(publicView(doc).categories[0].groups[0].items[0].price, null);
  doc.settings.showPrices = true;
  assert.equal(publicView(doc).categories[0].groups[0].items[0].price, 45);
});

test("preço só aparece quando a exibição está ligada e há valor", () => {
  const item = { price: 45, priceUnit: "por pessoa" };
  assert.equal(priceLabel(item, { showPrices: false }), "");
  assert.equal(priceLabel({ price: null }, { showPrices: true }), "");
  assert.match(priceLabel(item, { showPrices: true }), /^a partir de R\$\s?45,00 por pessoa$/);
});

test("resumo de alterações descreve o que mudou", () => {
  const after = clone(seed);
  after.settings.whatsapp = "5551999990000";
  const buffets = after.categories.find((c) => c.id === "buffets");
  buffets.groups[0].items[0].name = "Feijoada da Casa";
  buffets.groups[0].items.push({ id: "novo", name: "Novo buffet", active: true });
  const out = diffMenus(seed, after);
  assert.ok(out.includes("Contato e configurações alterados"));
  assert.ok(out.some((l) => l.startsWith("Buffets:") && l.includes("1 item adicionado") && l.includes("1 item editado")), out.join(" | "));
  assert.deepEqual(diffMenus(seed, clone(seed)), []);
});

test("resumo detecta categoria desativada e reordenação", () => {
  const after = clone(seed);
  after.categories[0].active = false;
  assert.ok(diffMenus(seed, after).some((l) => l.includes("desativada")));
  const reordered = clone(seed);
  reordered.categories.reverse();
  assert.ok(diffMenus(seed, reordered).includes("Ordem das categorias alterada"));
});

/* ---------- Seleção ---------- */

const idx = indexMenu(publicView(seed));
const cat = (id) => idx.categories.get(id).category;

test("categoria de escolha única troca a opção", () => {
  let s = {};
  s = toggleItem(s, cat("buffets"), "feijoada-especial").state;
  s = toggleItem(s, cat("buffets"), "estacao-italiana").state;
  assert.deepEqual(s.buffets.ids, ["estacao-italiana"]);
  s = toggleItem(s, cat("buffets"), "estacao-italiana").state;
  assert.equal(s.buffets, undefined, "desmarcar remove a categoria");
});

test("categoria de várias escolhas respeita o limite", () => {
  const limited = { ...cat("sobremesas"), maxPicks: 2 };
  let s = {};
  s = toggleItem(s, limited, "pavlova").state;
  s = toggleItem(s, limited, "tiramisu").state;
  const r = toggleItem(s, limited, "panna-cotta");
  assert.match(r.error, /até 2 opções/);
  assert.equal(r.state, s, "estado fica igual quando passa do limite");
  assert.equal(countSelected(s), 2);
});

test("seleção pronta, formato e remoção", () => {
  const desserts = cat("sobremesas");
  let s = applyPreset({}, desserts, desserts.presets[0]);
  assert.equal(s.sobremesas.ids.length, 4);
  s = removeItem(s, "sobremesas", "pudim-de-leite-condensado");
  assert.equal(s.sobremesas.ids.length, 3);
  s = setChoice(s, "buffet-de-risotos", "Preparado ao vivo");
  assert.equal(s["buffet-de-risotos"].choice, "Preparado ao vivo");
});

test("seleção pronta em categoria de escolha única marca só um item", () => {
  const buffets = cat("buffets");
  const s = applyPreset({}, buffets, { id: "teste", name: "Teste", itemIds: ["feijoada-especial", "estacao-italiana"] });
  assert.deepEqual(s.buffets.ids, ["feijoada-especial"]);
});

test("seleção salva é limpa de itens que não existem mais", () => {
  const dirty = {
    buffets: { ids: ["feijoada-especial", "sabores-do-dia"], choice: "" },
    "finger-foods": { ids: ["mini-paella", "nao-existe", "mini-paella"], choice: "" },
    "buffet-de-risotos": { ids: [], choice: "Inventado" },
    fantasma: { ids: ["x"], choice: "" },
  };
  const clean = sanitize(dirty, idx);
  assert.deepEqual(clean.buffets.ids, ["feijoada-especial"], "escolha única guarda só uma");
  assert.deepEqual(clean["finger-foods"].ids, ["mini-paella"]);
  assert.equal(clean["buffet-de-risotos"], undefined);
  assert.equal(clean.fantasma, undefined);
});

test("linhas da seleção seguem a ordem do cardápio", () => {
  const s = { sobremesas: { ids: ["pavlova"], choice: "" }, "coffee-corporativo": { ids: ["coffee-break-premium"], choice: "" } };
  const lines = selectionLines(s, idx);
  assert.deepEqual(lines.map((l) => l.category.id), ["coffee-corporativo", "sobremesas"]);
  assert.equal(lines[0].items[0].tier, "Premium");
});

/* ---------- Orçamento ---------- */

const VALID = {
  name: "Ana Souza", phone: "(51) 99999-0000", email: "ana@exemplo.com.br", eventType: "Casamento",
  date: "2027-03-12", place: "Porto Alegre", guests: "120", interests: ["buffets"], notes: "Dois convidados veganos.", consent: true,
};

test("formulário válido passa e é normalizado", () => {
  const r = validateQuote(VALID, { today: "2026-10-23" });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.phone, "51999990000");
  assert.equal(r.value.guests, 120);
});

test("campos essenciais são exigidos com mensagens claras", () => {
  const r = validateQuote({}, { today: "2026-10-23" });
  assert.equal(r.ok, false);
  for (const f of ["name", "phone", "eventType", "date", "place", "guests", "interests", "consent"]) assert.ok(r.errors[f], `falta erro em ${f}`);
  assert.equal(r.errors.email, undefined, "e-mail é opcional");
});

test("regras específicas: sobrenome, telefone, data passada, outro tipo, e-mail", () => {
  const today = "2026-10-23";
  assert.ok(validateQuote({ ...VALID, name: "Ana" }, { today }).errors.name);
  assert.ok(validateQuote({ ...VALID, phone: "9999-0000" }, { today }).errors.phone);
  assert.ok(validateQuote({ ...VALID, date: "2026-10-22" }, { today }).errors.date);
  assert.ok(validateQuote({ ...VALID, date: "2027-02-30" }, { today }).errors.date, "data inexistente");
  assert.equal(validateQuote({ ...VALID, date: "", dateUndefined: true }, { today }).ok, true);
  assert.ok(validateQuote({ ...VALID, eventType: "Outro" }, { today }).errors.eventTypeOther);
  assert.ok(validateQuote({ ...VALID, email: "ana@" }, { today }).errors.email);
  assert.ok(validateQuote({ ...VALID, guests: "0" }, { today }).errors.guests);
  assert.equal(validateQuote({ ...VALID, interests: [] }, { today, hasSelections: true }).ok, true, "seleção no cardápio basta");
});

test("telefone aceita +55 e rejeita DDD inválido", () => {
  assert.equal(normalizePhone("+55 51 99999-0000"), "51999990000");
  assert.equal(normalizePhone("(51) 3333-4444"), "5133334444");
  assert.equal(normalizePhone("(01) 99999-0000"), "");
});

test("mensagem do WhatsApp é organizada e não traz preço", () => {
  const { value } = validateQuote({ ...VALID, notes: "Sem *glúten* para 3 pessoas" }, { today: "2026-10-23" });
  const s = { buffets: { ids: ["experiencia-chef-carlos-junior"], choice: "" }, "buffet-de-risotos": { ids: ["risoto-de-funghi"], choice: "Preparado ao vivo" } };
  const names = Object.fromEntries(idx.order.map((id) => [id, idx.categories.get(id).category.name]));
  const text = buildQuoteMessage({ quote: value, lines: selectionLines(s, idx), categoryNames: names });
  assert.match(text, /^\*Solicitação de orçamento — CJR Gastronomia\*/);
  assert.match(text, /Nome: Ana Souza/);
  assert.match(text, /WhatsApp: \(51\) 99999-0000/);
  assert.match(text, /Data: sexta-feira, 12\/03\/2027/);
  assert.match(text, /Convidados \(estimativa\): 120/);
  assert.match(text, /• Experiência Chef Carlos Junior — Premium/);
  assert.match(text, /_Buffet de Risotos \(Formato: Preparado ao vivo\)_/);
  assert.match(text, /Sem glúten para 3 pessoas/, "remove símbolos de formatação do texto do cliente");
  assert.doesNotMatch(text, /R\$/);
  assert.equal((text.match(/• Buffets/g) || []).length, 1, "serviço de interesse não se repete");
});

test("link do WhatsApp só existe com número configurado", () => {
  assert.equal(whatsappUrl("", "oi"), null);
  assert.equal(whatsappUrl("51999990000", "oi"), null, "precisa do código do país");
  assert.equal(whatsappUrl("+55 (51) 99999-0000", "olá & tchau"), "https://wa.me/5551999990000?text=ol%C3%A1%20%26%20tchau");
});

test("data do evento por extenso", () => {
  assert.equal(formatEventDate("2027-03-12"), "sexta-feira, 12/03/2027");
  assert.equal(formatEventDate("errado"), "");
});
