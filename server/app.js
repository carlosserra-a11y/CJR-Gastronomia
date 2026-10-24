/* ============================================================
   Aplicação Express: site estático + API pública + API do painel.
   ============================================================ */
import express from "express";
import compression from "compression";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";

import { openDatabase } from "./db.js";
import * as V from "./validate.js";
import {
  hashPassword, verifyPassword, DUMMY_HASH, passwordProblems, newToken, sha256,
  parseCookies, sessionCookie, SESSION_COOKIE, SESSION_TTL_MS, CSRF_HEADER_VALUE, rateLimiter, securityHeaders,
} from "./security.js";
import { publicView, diffMenus } from "../js/shared/menu.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SEED_MENU_PATH = join(ROOT, "data", "menu.json");

export function createApp({ dataDir, setupCode = null, trustProxy = false, secureCookies = false, logger = console } = {}) {
  const seed = V.menuDoc(JSON.parse(readFileSync(SEED_MENU_PATH, "utf8")));
  const store = openDatabase(dataDir, { seed });
  const uploadsDir = join(dataDir, "uploads");
  mkdirSync(uploadsDir, { recursive: true });
  const state = { setupCode };

  const app = express();
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", trustProxy === true ? 1 : trustProxy);
  app.use(securityHeaders);
  app.use(compression());

  /* ---------------- Arquivos estáticos (lista branca) ---------------- */
  const staticOpts = (maxAge) => ({ maxAge, fallthrough: true, index: false, dotfiles: "deny" });
  app.use("/assets", express.static(join(ROOT, "assets"), staticOpts("7d")));
  for (const dir of ["css", "js", "data"]) app.use(`/${dir}`, express.static(join(ROOT, dir), staticOpts(0)));
  app.use("/uploads", express.static(uploadsDir, { ...staticOpts("30d"), immutable: true }));
  app.get("/admin", (req, res, next) => (req.originalUrl.split("?")[0].endsWith("/") ? next() : res.redirect(302, "/admin/")));
  app.use("/admin", express.static(join(ROOT, "admin"), { ...staticOpts(0), index: "index.html" }));
  app.get("/robots.txt", (req, res) => res.sendFile(join(ROOT, "robots.txt")));
  app.get("/favicon.ico", (req, res) => res.sendFile(join(ROOT, "assets", "img", "favicon.svg")));
  app.get(["/", "/index.html"], (req, res) => res.sendFile(join(ROOT, "index.html")));

  /* ---------------- Utilitários ---------------- */
  const ip = (req) => req.ip || req.socket.remoteAddress || "";
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const tooMany = (res, retryAfter) => res.status(429).set("Retry-After", String(retryAfter)).json({ error: "Muitas tentativas. Aguarde um pouco e tente de novo." });
  const limits = {
    login: rateLimiter({ windowMs: 15 * 60_000, max: 20 }),
    loginUser: rateLimiter({ windowMs: 15 * 60_000, max: 8 }),
  };

  /* ================================================================
     API PÚBLICA
     ================================================================ */
  const pub = express.Router();
  pub.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  pub.get("/menu", (req, res) => {
    const { version, menu } = store.currentMenu();
    const etag = `W/"v${version}"`;
    res.set("Cache-Control", "no-cache");
    res.set("ETag", etag);
    if (req.get("if-none-match") === etag) return res.status(304).end();
    res.json({ version, ...publicView(menu) });
  });
  app.use("/api", pub);

  /* ================================================================
     API DO PAINEL (/api/admin)
     ================================================================ */
  const adm = express.Router();
  adm.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  // CSRF: toda alteração exige o cabeçalho customizado (outros sites não conseguem enviá-lo sem CORS, que não liberamos).
  adm.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (req.get("x-requested-with") !== CSRF_HEADER_VALUE) return res.status(403).json({ error: "Requisição bloqueada." });
    next();
  });

  // O cardápio completo é salvo de uma vez (até 1 MB); o upload de foto tem limite próprio, lido só depois do login.
  const json = express.json({ limit: "1mb" });
  adm.use((req, res, next) => (req.path === "/upload" ? next() : json(req, res, next)));

  // Sessão
  adm.use((req, res, next) => {
    const token = parseCookies(req.get("cookie"))[SESSION_COOKIE];
    if (!token) return next();
    const sid = sha256(token);
    const s = store.getSession(sid);
    if (!s || !s.active || new Date(s.expires_at) < new Date()) {
      if (s) store.deleteSession(sid);
      return next();
    }
    req.sessionId = sid;
    req.user = { id: s.user_id, username: s.username, name: s.name };
    const newExp = new Date(Date.now() + SESSION_TTL_MS);
    if (newExp - new Date(s.expires_at) > 3600_000) {
      store.extendSession(sid, newExp.toISOString());
      res.append("Set-Cookie", sessionCookie(token, { secure: secureCookies, maxAgeMs: SESSION_TTL_MS }));
    }
    next();
  });

  const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Faça login para continuar." }));
  const audit = (req, action, detail = null) => store.audit({ user: req.user, ip: ip(req), action, detail });

  async function startSession(req, res, user) {
    const token = newToken();
    store.createSession({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(), ip: ip(req), userAgent: req.get("user-agent") });
    store.touchLogin(user.id);
    res.append("Set-Cookie", sessionCookie(token, { secure: secureCookies, maxAgeMs: SESSION_TTL_MS }));
  }

  function checkUsername(username) {
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw new V.ValidationError("Usuário: use só letras, números, ponto, hífen ou _.", "username");
  }

  adm.get("/session", (req, res) => res.json({ user: req.user || null, needsSetup: store.countUsers() === 0 }));

  adm.post("/setup", wrap(async (req, res) => {
    const lim = limits.login.take(ip(req));
    if (!lim.ok) return tooMany(res, lim.retryAfter);
    if (store.countUsers() > 0) return res.status(409).json({ error: "A primeira conta já foi criada. Faça login." });
    const code = String(req.body?.setupCode || "").trim().toUpperCase();
    const expected = state.setupCode || "";
    // Compara os hashes (mesmo tamanho sempre), em tempo constante
    const ok = Boolean(expected) && timingSafeEqual(Buffer.from(sha256(code), "hex"), Buffer.from(sha256(expected), "hex"));
    if (!ok) return res.status(403).json({ error: "Código de configuração incorreto. Ele aparece no terminal onde o servidor foi iniciado.", field: "setupCode" });
    const username = V.str(req.body.username, { field: "Usuário", required: true, min: 3, max: 40 });
    checkUsername(username);
    const problems = passwordProblems(req.body.password, username);
    if (problems.length) throw new V.ValidationError(`A senha precisa ${problems.join(", ")}.`, "password");
    const userId = store.createUser({ username, name: V.str(req.body.name, { field: "Nome", max: 60 }), passwordHash: await hashPassword(req.body.password) });
    state.setupCode = null;
    const user = store.findUser(userId);
    req.user = { id: user.id, username: user.username };
    audit(req, "criou_conta", username);
    await startSession(req, res, user);
    res.status(201).json({ user: { id: user.id, username: user.username, name: user.name } });
  }));

  adm.post("/login", wrap(async (req, res) => {
    const username = String(req.body?.username || "").trim().slice(0, 40);
    const password = String(req.body?.password || "");
    const a = limits.login.take(ip(req));
    const b = limits.loginUser.take(username.toLowerCase());
    if (!a.ok || !b.ok) return tooMany(res, Math.max(a.retryAfter, b.retryAfter));
    const user = username ? store.findUserByName(username) : null;
    const valid = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !valid || !user.active) {
      store.audit({ user: null, ip: ip(req), action: "login_falhou", detail: username || null });
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }
    limits.loginUser.reset(username.toLowerCase());
    req.user = { id: user.id, username: user.username };
    audit(req, "login");
    await startSession(req, res, user);
    res.json({ user: { id: user.id, username: user.username, name: user.name } });
  }));

  adm.post("/logout", (req, res) => {
    if (req.sessionId) { store.deleteSession(req.sessionId); audit(req, "logout"); }
    res.append("Set-Cookie", sessionCookie("", { secure: secureCookies, maxAgeMs: 0 }));
    res.json({ ok: true });
  });

  adm.use(requireAuth);

  /* ---------- Conta / usuários ---------- */
  adm.post("/password", wrap(async (req, res) => {
    const user = store.findUser(req.user.id);
    if (!(await verifyPassword(req.body?.current || "", user.password_hash))) return res.status(400).json({ error: "Senha atual incorreta.", field: "current" });
    const problems = passwordProblems(req.body?.next, user.username);
    if (problems.length) throw new V.ValidationError(`A nova senha precisa ${problems.join(", ")}.`, "next");
    store.setPassword(user.id, await hashPassword(req.body.next));
    store.deleteUserSessions(user.id, req.sessionId);
    audit(req, "alterou_senha");
    res.json({ ok: true });
  }));

  adm.get("/users", (req, res) => res.json(store.listUsers()));

  adm.post("/users", wrap(async (req, res) => {
    const username = V.str(req.body?.username, { field: "Usuário", required: true, min: 3, max: 40 });
    checkUsername(username);
    if (store.findUserByName(username)) return res.status(409).json({ error: "Esse usuário já existe.", field: "username" });
    const problems = passwordProblems(req.body?.password, username);
    if (problems.length) throw new V.ValidationError(`A senha precisa ${problems.join(", ")}.`, "password");
    const id = store.createUser({ username, name: V.str(req.body.name, { field: "Nome", max: 60 }), passwordHash: await hashPassword(req.body.password) });
    audit(req, "criou_conta", username);
    res.status(201).json({ id });
  }));

  adm.patch("/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = store.findUser(id);
    if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
    if (id === req.user.id) return res.status(400).json({ error: "Você não pode desativar a própria conta." });
    const active = Boolean(req.body?.active);
    store.setUserActive(id, active);
    if (!active) store.deleteUserSessions(id);
    audit(req, active ? "ativou_conta" : "desativou_conta", target.username);
    res.json({ ok: true });
  });

  adm.get("/activity", (req, res) => res.json(store.listAudit(60)));

  /* ---------- Cardápio ---------- */
  adm.get("/menu", (req, res) => res.json(store.currentMenu()));

  function save(req, res, input, { restoredFrom = null, extra = [] } = {}) {
    const current = store.currentMenu();
    const base = Number(req.body?.baseVersion);
    if (base !== current.version) {
      return res.status(409).json({ error: "O cardápio foi alterado por outra pessoa enquanto você editava. Recarregue para ver a versão mais nova.", version: current.version });
    }
    const menu = V.menuDoc(input);
    const summary = [...extra, ...diffMenus(current.menu, menu)];
    if (!summary.length) return res.json({ version: current.version, unchanged: true, summary });
    const version = store.saveMenu(menu, { user: req.user, summary, restoredFrom });
    audit(req, restoredFrom ? "restaurou_versao" : "salvou_cardapio", `v${version}: ${summary.join("; ")}`);
    res.json({ version, summary, menu });
  }

  adm.put("/menu", (req, res) => save(req, res, req.body?.menu));

  adm.get("/versions", (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    res.json({ ...store.listVersions({ limit, offset: (page - 1) * limit }), page, limit });
  });

  adm.get("/versions/:id", (req, res) => {
    const v = store.getVersion(Number(req.params.id));
    if (!v) return res.status(404).json({ error: "Versão não encontrada." });
    res.json(v);
  });

  adm.post("/versions/:id/restore", (req, res) => {
    const v = store.getVersion(Number(req.params.id));
    if (!v) return res.status(404).json({ error: "Versão não encontrada." });
    save(req, res, v.menu, { restoredFrom: v.id, extra: [`Versão #${v.id} restaurada`] });
  });

  /* ---------- Upload de fotos ---------- */
  adm.post("/upload", express.json({ limit: "8mb" }), (req, res) => {
    const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ""));
    if (!m) return res.status(400).json({ error: "Envie uma imagem JPG, PNG ou WEBP." });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: "Imagem muito grande (máx. 5 MB)." });
    const sig = buf.subarray(0, 12);
    const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
    const isPng = sig.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = sig.subarray(0, 4).toString("ascii") === "RIFF" && sig.subarray(8, 12).toString("ascii") === "WEBP";
    const ext = isWebp ? "webp" : isPng ? "png" : isJpeg ? "jpg" : null;
    if (!ext) return res.status(400).json({ error: "O arquivo não é uma imagem válida." });
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
    writeFileSync(join(uploadsDir, name), buf);
    audit(req, "enviou_foto", name);
    res.status(201).json({ path: `uploads/${name}` });
  });

  /* ---------- Exportar / backup ---------- */
  // Exporta a versão PÚBLICA (para o data/menu.json do GitHub Pages): sem itens ocultos nem preços escondidos.
  adm.get("/export", (req, res) => {
    const menu = publicView(store.currentMenu().menu);
    audit(req, "exportou_cardapio");
    res.set("Content-Disposition", 'attachment; filename="menu.json"').type("application/json").send(JSON.stringify(menu, null, 2) + "\n");
  });

  adm.get("/backup", (req, res) => {
    const file = join(dataDir, `backup-${Date.now()}.db`);
    store.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    audit(req, "baixou_backup");
    res.download(file, `cjr-backup-${new Date().toISOString().slice(0, 10)}.db`, () => { try { rmSync(file); } catch { /* já removido */ } });
  });

  app.use("/api/admin", adm);
  app.use("/api", (req, res) => res.status(404).json({ error: "Rota não encontrada." }));

  /* ---------------- Erros ---------------- */
  app.use((req, res) => res.status(404).type("html").send(notFoundPage()));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof V.ValidationError) return res.status(400).json({ error: err.message, field: err.field });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Conteúdo grande demais." });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
    if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: "Requisição inválida." });
    logger.error?.(err);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  });

  return { app, db: store, state };
}

function notFoundPage() {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Página não encontrada · CJR Gastronomia</title><link rel="stylesheet" href="/css/site.css">
<body class="page-404"><main class="nf"><p class="kicker">Erro 404</p><h1>Esta página não está no cardápio.</h1>
<a class="btn btn-gold" href="/">Voltar ao início</a></main></body></html>`;
}
