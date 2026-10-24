/* Roda antes de a página pintar (arquivo separado porque o servidor bloqueia script inline):
   marca JS ativo, "reduzir movimento" e se a abertura deve aparecer (só na 1ª visita da sessão). */
(function () {
  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("reduced");
  var skip = /[?&]nointro\b/.test(location.search) || root.classList.contains("reduced");
  try {
    if (!skip && !sessionStorage.getItem("cjr:intro")) {
      root.classList.add("intro");
      sessionStorage.setItem("cjr:intro", "1");
    }
  } catch (e) { /* sem armazenamento: sem abertura */ }
})();
