/* ============================================================
   Segurança: senhas (scrypt), sessões por cookie, limites de
   tentativas e cabeçalhos HTTP.
   ============================================================ */
import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const SESSION_COOKIE = "cjr_session";
/** Em HTTPS o cookie usa o prefixo __Host-: só vale neste domínio exato (subdomínios não conseguem sobrescrevê-lo). */
export const sessionCookieName = (secure) => (secure ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE);
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias sem uso, renovada com o uso
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000; // e no máximo 30 dias desde o login, mesmo com uso
export const CSRF_HEADER_VALUE = "cjr-admin";

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(String(password).normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, hashB64] = String(stored || "").split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(String(password).normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Hash usado para comparar senhas de usuários inexistentes (não revela quais usuários existem pelo tempo de resposta). */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "senha123", "senha1234", "senha12345", "password1", "password123", "qwerty123",
  "abc123456", "admin123", "admin1234", "mudar123", "cjr12345", "cjr123456", "gastronomia1", "gastronomia123", "chef123456",
  "chefcarlos1", "chefcarlos123", "carlos1234", "carlos12345", "cozinha123", "buffet1234", "brasil2026", "florianopolis1",
]);

export function passwordProblems(password, username = "") {
  const p = String(password || "");
  const problems = [];
  if (p.length < 10) problems.push("ter pelo menos 10 caracteres");
  if (p.length > 200) problems.push("ter no máximo 200 caracteres");
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) problems.push("misturar letras e números");
  if (username && p.toLowerCase().includes(String(username).toLowerCase())) problems.push("não conter o nome de usuário");
  if (COMMON_PASSWORDS.has(p.toLowerCase())) problems.push("não ser uma senha comum");
  return problems;
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Código de configuração inicial (mostrado no terminal do servidor). */
export function newSetupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const s = [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie malformado: ignora */ }
  }
  return out;
}

export function sessionCookie(token, { secure, maxAgeMs }) {
  const parts = [`${sessionCookieName(secure)}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Limitador simples em memória (janela fixa). */
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.reset < t) hits.delete(k);
  }, Math.max(windowMs, 60_000)).unref();
  return {
    take(key) {
      const t = Date.now();
      let e = hits.get(key);
      if (!e || e.reset < t) { e = { count: 0, reset: t + windowMs }; hits.set(key, e); }
      e.count++;
      return { ok: e.count <= max, retryAfter: Math.ceil((e.reset - t) / 1000) };
    },
    reset(key) { hits.delete(key); },
  };
}

/** Política de conteúdo do site: só scripts próprios, nada embutido em outros sites, sem plugins. */
export function contentSecurityPolicy({ https = false } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' https://www.googletagmanager.com", // Google Analytics: só carrega com ID no painel e consentimento
    // folhas de estilo só do site; atributos style="" (variáveis CSS das animações) liberados
    "style-src 'self' 'unsafe-inline'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'", // fontes hospedadas no próprio site
    "img-src 'self' data: blob: https:",
    "media-src 'self'",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Cabeçalhos de segurança. Com `hsts`, o navegador passa a usar só HTTPS neste domínio por 2 anos. */
export function securityHeaders({ hsts = false } = {}) {
  return (req, res, next) => {
    const https = hsts || req.secure;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Origin-Agent-Cluster", "?1");
    res.setHeader("Content-Security-Policy", contentSecurityPolicy({ https }));
    if (https) res.setHeader("Strict-Transport-Security", "max-age=63072000");
    next();
  };
}
