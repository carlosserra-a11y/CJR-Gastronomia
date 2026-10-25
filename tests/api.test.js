import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, addNewContentFields } from "../server/app.js";
import { openDatabase } from "../server/db.js";
import { menuDoc } from "../server/validate.js";

let server, base, ctx, dataDir;
const H = { "Content-Type": "application/json", "X-Requested-With": "cjr-admin" };
let cookie = "";

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, { method, headers: { ...H, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  return { status: res.status, data, res };
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "cjr-test-"));
  ctx = createApp({ dataDir, setupCode: "ABCD-EFGH", logger: { error() {} } });
  server = ctx.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); ctx.db.close(); rmSync(dataDir, { recursive: true, force: true }); });

test("o cardápio do briefing passa na validação sem perder nada", () => {
  const raw = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
  const clean = menuDoc(raw);
  assert.equal(clean.categories.length, raw.categories.length);
  const count = (doc) => doc.categories.flatMap((c) => c.groups.flatMap((g) => g.items)).length;
  assert.equal(count(clean), count(raw));
});

test("portfólio: categoria desconhecida vira 'eventos', miniatura cai na foto e linha sem foto sai", () => {
  const raw = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
  raw.content.portfolio = [
    { image: "assets/img/portfolio/mesa-01.webp", thumb: "", w: 1600, h: 1200, category: "inexistente", caption: "Mesa posta" },
    { image: "", caption: "Sem foto" },
  ];
  const clean = menuDoc(raw).content.portfolio;
  assert.equal(clean.length, 1);
  assert.equal(clean[0].category, "eventos");
  assert.equal(clean[0].thumb, "assets/img/portfolio/mesa-01.webp");
  assert.equal(clean[0].w, 1600);

  raw.content.portfolio = [{ image: "assets/img/portfolio/mesa-01.webp", category: ["mesa"], caption: "" }];
  assert.equal(menuDoc(raw).content.portfolio[0].category, "eventos", "categoria precisa ser texto");

  raw.content.portfolio = [{ image: 'assets/img/a.webp"onerror="x', caption: "" }];
  assert.throws(() => menuDoc(raw), /Portfólio — foto 1/);
  raw.content.portfolio = [{ image: "assets/img/portfolio/mesa-01.webp", caption: "x".repeat(121) }];
  assert.throws(() => menuDoc(raw), /Portfólio — legenda 1/);
});

test("calculadora: valores inválidos são recusados, faixa invertida é corrigida e categoria inexistente perde o vínculo", () => {
  const raw = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
  raw.content.calcOptions = [{ name: "Teste", categoryId: "nao-existe", kind: ["doce"], grams: 300, priceMin: 90, priceMax: 40 }];
  const [o] = menuDoc(raw).content.calcOptions;
  assert.equal(o.categoryId, "");
  assert.equal(o.kind, "salgado");
  assert.equal(o.priceMin, 40);
  assert.equal(o.priceMax, 90);
  raw.content.calcOptions = [{ name: "Teste", grams: 5000 }];
  assert.throws(() => menuDoc(raw), /Calculadora — opção 1 \(gramas por pessoa\)/);
  raw.content.calcOptions = [{ name: "Igual" }, { name: "Igual" }];
  assert.throws(() => menuDoc(raw), /mesmo nome/);
});

test("banco antigo ganha os campos novos do site sem perder o que a equipe editou", () => {
  const dir = mkdtempSync(join(tmpdir(), "cjr-mig-"));
  const seedDoc = menuDoc(JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8")));
  const old = structuredClone(seedDoc);
  delete old.content.calcOptions;
  delete old.content.reviews;
  old.content.heroTitle = "Título editado pela equipe";
  const store = openDatabase(dir, { seed: old });
  try {
    const added = addNewContentFields(store, seedDoc);
    assert.ok(added.includes("calcOptions") && added.includes("reviews"));
    const cur = store.currentMenu().menu;
    assert.equal(cur.content.heroTitle, "Título editado pela equipe");
    assert.equal(cur.content.calcOptions.length, seedDoc.content.calcOptions.length);
    assert.deepEqual(addNewContentFields(store, seedDoc), [], "não repete a atualização");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seleções prontas são descartadas em categoria de escolha única", () => {
  const raw = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
  const single = raw.categories.find((c) => c.select === "one");
  single.presets = [{ id: "teste", name: "Teste", itemIds: single.groups[0].items.slice(0, 2).map((i) => i.id) }];
  assert.deepEqual(menuDoc(raw).categories.find((c) => c.id === single.id).presets, []);
});

test("cardápio público: só itens ativos, com versão e ETag", async () => {
  const r = await call("GET", "/api/menu");
  assert.equal(r.status, 200);
  assert.equal(r.data.categories.length, 8);
  assert.equal(typeof r.data.version, "number");
  // o ETag leva um resumo do conteúdo: um banco recriado (de novo na versão 1) não reaproveita o cardápio antigo do navegador
  assert.match(r.res.headers.get("etag"), /^W\/"v\d+-[0-9a-f]{16}"$/);
  const again = await fetch(base + "/api/menu", { headers: { "If-None-Match": r.res.headers.get("etag") } });
  assert.equal(again.status, 304);
});

test("cabeçalhos de segurança no site", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  const hidden = await fetch(base + "/server/db.js");
  assert.equal(hidden.status, 404, "arquivos do servidor não são servidos");
  const db = await fetch(base + "/data/../server/data/cjr.db");
  assert.notEqual(db.status, 200);
});

test("painel exige login e o cabeçalho anti-CSRF", async () => {
  assert.equal((await call("GET", "/api/admin/menu")).status, 401);
  const noHeader = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noHeader.status, 403);
});

test("primeiro acesso: código errado é recusado, senha fraca também", async () => {
  const wrong = await call("POST", "/api/admin/setup", { setupCode: "XXXX-XXXX", username: "chef", password: "Cozinha2026" });
  assert.equal(wrong.status, 403);
  const accented = await call("POST", "/api/admin/setup", { setupCode: "ÀBCD-EFGH", username: "chef", password: "Cozinha2026" });
  assert.equal(accented.status, 403, "código com acento não derruba o servidor");
  const weak = await call("POST", "/api/admin/setup", { setupCode: "ABCD-EFGH", username: "chef", password: "abc" });
  assert.equal(weak.status, 400);
  assert.equal(weak.data.field, "password");
});

test("primeiro acesso cria a conta e entra", async () => {
  const r = await call("POST", "/api/admin/setup", { setupCode: "abcd-efgh", username: "chef", name: "Carlos", password: "Cozinha2026" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.res.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const s = await call("GET", "/api/admin/session");
  assert.equal(s.data.user.username, "chef");
  const again = await call("POST", "/api/admin/setup", { setupCode: "ABCD-EFGH", username: "outro", password: "Cozinha2026" });
  assert.equal(again.status, 409, "o código só vale para a primeira conta");
});

test("salvar cardápio cria versão, registra resumo e aparece no site", async () => {
  const { data: cur } = await call("GET", "/api/admin/menu");
  const menu = structuredClone(cur.menu);
  menu.settings.whatsapp = "+55 (51) 99999-0000";
  menu.categories.find((c) => c.id === "buffets").groups[0].items[0].active = false;
  const r = await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.version, cur.version + 1);
  assert.ok(r.data.summary.includes("Contato e configurações alterados"));
  assert.equal(r.data.menu.settings.whatsapp, "5551999990000", "WhatsApp guardado só com números");

  const pub = await call("GET", "/api/menu");
  const buffets = pub.data.categories.find((c) => c.id === "buffets");
  assert.ok(!buffets.groups[0].items.some((i) => i.id === "feijoada-especial"), "item desativado some do site");

  const v = await call("GET", "/api/admin/versions");
  assert.equal(v.data.rows[0].username, "chef");
});

test("salvar sem mudanças não cria versão; versão antiga dá conflito", async () => {
  const { data: cur } = await call("GET", "/api/admin/menu");
  const same = await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu: cur.menu });
  assert.equal(same.data.unchanged, true);
  const stale = await call("PUT", "/api/admin/menu", { baseVersion: cur.version - 1, menu: cur.menu });
  assert.equal(stale.status, 409);
});

test("cardápio inválido é recusado com mensagem que aponta o lugar", async () => {
  const { data: cur } = await call("GET", "/api/admin/menu");
  const menu = structuredClone(cur.menu);
  menu.categories[3].groups[0].items[1].name = "";
  const r = await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Buffets.*item 2.*Nome/);
  const dup = structuredClone(cur.menu);
  dup.categories[1].id = dup.categories[0].id;
  assert.equal((await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu: dup })).status, 400);
  const badImg = structuredClone(cur.menu);
  badImg.categories[0].image = "javascript:alert(1)";
  assert.equal((await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu: badImg })).status, 400);
  const quotedImg = structuredClone(cur.menu);
  quotedImg.categories[0].image = 'https://x.com/a.png"onerror="alert(1)';
  assert.equal((await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu: quotedImg })).status, 400);
  const mailInjection = structuredClone(cur.menu);
  mailInjection.settings.email = "a@b.co?bcc=x%40y.com";
  assert.equal((await call("PUT", "/api/admin/menu", { baseVersion: cur.version, menu: mailInjection })).status, 400);
});

test("restaurar versão volta o conteúdo e entra no histórico", async () => {
  const { data: cur } = await call("GET", "/api/admin/menu");
  const r = await call("POST", "/api/admin/versions/1/restore", { baseVersion: cur.version });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const seedWhatsapp = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8")).settings.whatsapp;
  assert.equal(r.data.menu.settings.whatsapp, seedWhatsapp, "volta ao número do cardápio inicial");
  assert.equal(r.data.summary[0], "Versão #1 restaurada");
});

test("upload aceita só imagens de verdade", async () => {
  const fake = await call("POST", "/api/admin/upload", { dataUrl: "data:image/png;base64," + Buffer.from("<script>").toString("base64") });
  assert.equal(fake.status, 400);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const ok = await call("POST", "/api/admin/upload", { dataUrl: "data:image/png;base64," + png.toString("base64") });
  assert.equal(ok.status, 201);
  assert.match(ok.data.path, /^uploads\/[\w-]+\.png$/);
  const served = await fetch(`${base}/${ok.data.path}`);
  assert.equal(served.status, 200);
});

test("login errado é recusado e sair encerra a sessão", async () => {
  const saved = cookie;
  cookie = "";
  const bad = await call("POST", "/api/admin/login", { username: "chef", password: "errada123" });
  assert.equal(bad.status, 401);
  cookie = saved;
  await call("POST", "/api/admin/logout", {});
  assert.equal((await call("GET", "/api/admin/menu")).status, 401);
});

/* ---------- Segurança extra ---------- */

test("cabeçalhos reforçados: sem embutir o site, sem vazar recursos e painel fora dos buscadores", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.match(res.headers.get("content-security-policy"), /frame-ancestors .none./);
  assert.match(res.headers.get("content-security-policy"), /object-src .none./);
  assert.equal(res.headers.get("x-powered-by"), null);
  const api = await fetch(base + "/api/menu");
  assert.match(api.headers.get("x-robots-tag"), /noindex/);
  const txt = await fetch(base + "/.well-known/security.txt");
  assert.equal(txt.status, 200);
  assert.match(await txt.text(), /Contact:/);
});

test("pedido ao painel vindo de outro site é bloqueado, mesmo com o cabeçalho anti-CSRF", async () => {
  const evil = await call("POST", "/api/admin/login", { username: "chef", password: "Cozinha2026" }, { Origin: "https://site-malicioso.example" });
  assert.equal(evil.status, 403);
  const cross = await call("POST", "/api/admin/login", { username: "chef", password: "Cozinha2026" }, { "Sec-Fetch-Site": "cross-site" });
  assert.equal(cross.status, 403);
});

test("senhas novas precisam de 10 caracteres e não podem ser comuns", async () => {
  const { passwordProblems } = await import("../server/security.js");
  assert.ok(passwordProblems("Cozinha26").some((p) => p.includes("10 caracteres")));
  assert.ok(passwordProblems("chefcarlos123").some((p) => p.includes("comum")));
  assert.deepEqual(passwordProblems("Cozinha-do-Chef-2026"), []);
});

test("estatísticas: o site registra ações anônimas e o painel mostra o relatório", async () => {
  const s = "visitateste123";
  const send = (e, headers = {}) => fetch(base + "/api/track", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", ...headers }, body: JSON.stringify({ s, e }) });
  const ok = await send([
    { type: "visit", data: { src: "instagram", dev: "mobile", lp: "inicio" } },
    { type: "dish", data: { c: "coffee-corporativo", i: "coffee-break-basic" } },
    { type: "lead", data: { src: "orcamento", et: "Corporativo", g: 80, m: "2026-12", items: [["coffee-corporativo", "coffee-break-basic"]], name: "Fulano", phone: "48999999999" } },
    { type: "inventado", data: { x: 1 } },
  ]);
  assert.equal(ok.status, 204);
  // de outro site ou de robô: aceita sem gravar
  assert.equal((await send([{ type: "visit", data: {} }], { "Sec-Fetch-Site": "cross-site" })).status, 204);
  assert.equal((await send([{ type: "visit", data: {} }], { "User-Agent": "Googlebot/2.1" })).status, 204);
  const bad = await fetch(base + "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ s: "x", e: [] }) });
  assert.equal(bad.status, 400);

  const rows = ctx.db.eventsSince("2000-01-01");
  assert.deepEqual(rows.map((r) => r.type), ["visit", "dish", "lead"], "evento desconhecido, de outro site ou de robô não entra");
  assert.ok(!JSON.stringify(rows).includes("Fulano") && !JSON.stringify(rows).includes("4899"), "nome e telefone nunca são gravados");

  cookie = "";
  assert.equal((await call("GET", "/api/admin/stats")).status, 401, "relatório só com login");
  await call("POST", "/api/admin/login", { username: "chef", password: "Cozinha2026" });
  const r = await call("GET", "/api/admin/stats?days=7");
  assert.equal(r.status, 200);
  assert.equal(r.data.days, 7);
  assert.equal(r.data.totals.visits, 1);
  assert.equal(r.data.totals.leads, 1);
  assert.equal(r.data.dishes[0].name, "Coffee Break Basic");
  assert.equal(r.data.dishes[0].leads, 1);
  assert.equal(r.data.sources[0].id, "instagram");
  assert.equal(r.data.recentLeads[0].et, "Corporativo");
});
