/* ============================================================
   Inicia o servidor da CJR Gastronomia.
   Variáveis de ambiente (todas opcionais):
     PORT            porta HTTP (padrão 3000)
     DATA_DIR        pasta do banco e das fotos enviadas (padrão ./server/data)
     ADMIN_USERNAME  cria a 1ª conta do painel automaticamente…
     ADMIN_PASSWORD  …com esta senha (só se ainda não existir nenhuma conta)
     TRUST_PROXY     "1" quando estiver atrás de um proxy/HTTPS (Render, Railway…)
     SECURE_COOKIES  "1" para exigir HTTPS no cookie de sessão (padrão: igual a TRUST_PROXY)
   ============================================================ */
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { hashPassword, passwordProblems, newSetupCode } from "./security.js";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = resolve(process.env.DATA_DIR || join(here, "data"));
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
if (process.env.NODE_ENV === "production" && !TRUST_PROXY) {
  console.warn("⚠ NODE_ENV=production sem TRUST_PROXY=1: atrás do HTTPS da plataforma, o cookie fica sem 'Secure' e o limite de login vira um só para todos. Defina TRUST_PROXY=1.");
}

const { app, db, state } = createApp({
  dataDir: DATA_DIR,
  trustProxy: TRUST_PROXY,
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === "1" : TRUST_PROXY,
});

if (db.countUsers() === 0) {
  const { ADMIN_USERNAME: u, ADMIN_PASSWORD: p } = process.env;
  if (u && p) {
    const problems = passwordProblems(p, u);
    if (problems.length) {
      console.error(`ADMIN_PASSWORD fraca: a senha precisa ${problems.join(", ")}.`);
      process.exit(1);
    }
    db.createUser({ username: u, name: u, passwordHash: await hashPassword(p) });
    db.audit({ action: "criou_conta", detail: `${u} (variáveis de ambiente)` });
    console.log(`✔ Conta "${u}" criada a partir das variáveis de ambiente.`);
  } else {
    state.setupCode = newSetupCode();
    const line = (s) => `  │  ${s.padEnd(58)}│`;
    console.log("\n  ┌" + "─".repeat(60) + "┐");
    console.log(line("PRIMEIRO ACESSO — crie a conta do painel"));
    console.log(line(`Abra http://localhost:${PORT}/admin/`));
    console.log(line(`e use o código de configuração:  ${state.setupCode}`));
    console.log("  └" + "─".repeat(60) + "┘\n");
  }
}

setInterval(() => db.purgeSessions(), 60 * 60 * 1000).unref();

const server = app.listen(PORT, () => {
  console.log(`CJR Gastronomia rodando em http://localhost:${PORT}`);
  console.log(`   Painel: http://localhost:${PORT}/admin/`);
  console.log(`   Banco de dados: ${join(DATA_DIR, "cjr.db")}`);
});

const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
