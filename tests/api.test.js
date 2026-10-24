import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";
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

test("cardápio público: só itens ativos, com versão e ETag", async () => {
  const r = await call("GET", "/api/menu");
  assert.equal(r.status, 200);
  assert.equal(r.data.categories.length, 8);
  assert.equal(typeof r.data.version, "number");
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
  assert.equal(r.data.menu.settings.whatsapp, "");
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
