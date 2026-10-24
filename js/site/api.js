/* Carrega o cardápio: do servidor (/api/menu) ou, sem servidor (GitHub Pages), do arquivo data/menu.json. */
import { publicView } from "../shared/menu.js";

export async function loadMenu() {
  try {
    const res = await fetch("api/menu", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) return await res.json();
  } catch { /* sem servidor: usa o arquivo estático */ }
  const res = await fetch("data/menu.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Não foi possível carregar o cardápio.");
  return publicView(await res.json());
}
