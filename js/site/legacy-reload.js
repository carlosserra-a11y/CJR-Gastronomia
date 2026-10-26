/* Página antiga (WordPress) ainda guardada no cache do navegador pede os scripts dela;
 * o .htaccess manda esses pedidos para cá e a página é recarregada uma vez, mostrando o site novo. */
try {
  if (!sessionStorage.getItem("cjr:legacy-reload")) { sessionStorage.setItem("cjr:legacy-reload", "1"); location.reload(); }
} catch { /* sem armazenamento: não arrisca recarregar em laço */ }
