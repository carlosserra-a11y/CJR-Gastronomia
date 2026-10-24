/* ============================================================
   Banco de dados SQLite (módulo nativo node:sqlite — sem dependências).
   Guarda: versões do cardápio (cada "Salvar" do painel cria uma),
   contas da equipe, sessões e o histórico de segurança.
   Dados de clientes NÃO são gravados: o orçamento vai direto ao WhatsApp.
   ============================================================ */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const now = () => new Date().toISOString();
const parse = (s, fallback = null) => { try { return JSON.parse(s); } catch { return fallback; } };
const KEEP_VERSIONS = 300;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 do token (o token em si nunca é salvo)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT, user_agent TEXT
);

CREATE TABLE IF NOT EXISTS menu_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '[]',
  user_id INTEGER,
  username TEXT,
  restored_from INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`;

/** Abre (ou cria) o banco. `seed` é o cardápio inicial, usado só quando ainda não há versões. */
export function openDatabase(dataDir, { seed } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "cjr.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const api = createApi(db);
  if (!api.currentMenu() && seed) api.saveMenu(seed, { summary: ["Cardápio inicial (briefing)"] });
  return api;
}

function createApi(db) {
  /* ---------- Cardápio (versões) ---------- */
  function currentMenu() {
    const row = db.prepare("SELECT id, data FROM menu_versions ORDER BY id DESC LIMIT 1").get();
    return row ? { version: row.id, menu: parse(row.data) } : null;
  }

  function saveMenu(menu, { user = null, summary = [], restoredFrom = null } = {}) {
    const r = db.prepare("INSERT INTO menu_versions (data, summary, user_id, username, restored_from, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(JSON.stringify(menu), JSON.stringify(summary), user?.id ?? null, user?.username ?? null, restoredFrom, now());
    const id = Number(r.lastInsertRowid);
    db.prepare("DELETE FROM menu_versions WHERE id <= ?").run(id - KEEP_VERSIONS);
    return id;
  }

  function listVersions({ limit = 30, offset = 0 } = {}) {
    const total = db.prepare("SELECT COUNT(*) AS n FROM menu_versions").get().n;
    const rows = db.prepare("SELECT id, summary, username, restored_from, created_at FROM menu_versions ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, offset)
      .map((r) => ({ id: r.id, summary: parse(r.summary, []), username: r.username, restoredFrom: r.restored_from, createdAt: r.created_at }));
    return { total, rows };
  }

  function getVersion(id) {
    const r = db.prepare("SELECT * FROM menu_versions WHERE id = ?").get(id);
    return r ? { id: r.id, menu: parse(r.data), summary: parse(r.summary, []), username: r.username, createdAt: r.created_at } : null;
  }

  /* ---------- Usuários e sessões ---------- */
  const countUsers = () => db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const findUserByName = (username) => db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const findUser = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const listUsers = () => db.prepare("SELECT id, username, name, active, created_at, last_login_at FROM users ORDER BY id").all();
  const createUser = ({ username, name, passwordHash }) =>
    Number(db.prepare("INSERT INTO users (username, name, password_hash, created_at) VALUES (?, ?, ?, ?)").run(username, name || "", passwordHash, now()).lastInsertRowid);
  const setPassword = (id, hash) => db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  const setUserActive = (id, active) => db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  const touchLogin = (id) => db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), id);

  const createSession = ({ id, userId, expiresAt, ip, userAgent }) =>
    db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)").run(id, userId, now(), expiresAt, ip || "", (userAgent || "").slice(0, 200));
  const getSession = (id) => db.prepare(`SELECT s.id, s.expires_at, u.id AS user_id, u.username, u.name, u.active
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(id);
  const extendSession = (id, expiresAt) => db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(expiresAt, id);
  const deleteSession = (id) => db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  const deleteUserSessions = (userId, exceptId = "") => db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, exceptId);
  const purgeSessions = () => db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());

  /* ---------- Histórico de segurança ---------- */
  function audit({ user, action, detail = null, ip = "" }) {
    db.prepare("INSERT INTO audit_log (user_id, username, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(user?.id ?? null, user?.username ?? null, action, detail === null ? null : String(detail).slice(0, 300), ip, now());
  }
  const listAudit = (limit = 50) => db.prepare("SELECT username, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT ?").all(limit);

  return {
    db,
    currentMenu, saveMenu, listVersions, getVersion,
    countUsers, findUserByName, findUser, listUsers, createUser, setPassword, setUserActive, touchLogin,
    createSession, getSession, extendSession, deleteSession, deleteUserSessions, purgeSessions,
    audit, listAudit,
    close: () => db.close(),
  };
}
