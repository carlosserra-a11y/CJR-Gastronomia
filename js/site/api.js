/* Carrega o cardápio: do servidor (/api/menu) ou, sem servidor (GitHub Pages), do arquivo data/menu.json. */
import { publicView } from "../shared/menu.js";

let fromServer = false;
/** O cardápio veio do servidor da CJR (e não do arquivo estático)? */
export const hasServer = () => fromServer;

export async function loadMenu() {
  try {
    const res = await fetch("api/menu", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const menu = await res.json();
      fromServer = true;
      return menu;
    }
  } catch { /* sem servidor: usa o arquivo estático */ }
  const res = await fetch("data/menu.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Não foi possível carregar o cardápio.");
  return publicView(await res.json());
}
