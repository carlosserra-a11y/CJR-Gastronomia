/* ============================================================
   Avaliações de clientes: nota e total no Google (com link para ler
   todas) e, quando a equipe cadastrar no painel, depoimentos em um
   carrossel que desliza no dedo, com setas, pontos e troca automática.
   ============================================================ */
import { $, $$, html, splitWords } from "./util.js";
import { ui } from "./icons.js";
import { onFrame } from "./motion.js";

const AUTO_MS = 6500;

const stars = (n) => html`<span class="stars" role="img" aria-label="${Number(n).toLocaleString("pt-BR")} de 5 estrelas">${[1, 2, 3, 4, 5].map((i) => html`<i class="${i <= Math.round(n) ? "is-on" : ""}" aria-hidden="true">★</i>`)}</span>`;

const reviewCard = (r, i) => html`
  <figure class="review-card" data-review="${i}">
    ${stars(r.rating || 5)}
    <blockquote class="review-text">${r.text}</blockquote>
    <figcaption class="review-who">
      <span class="review-avatar" aria-hidden="true">${(r.name || "?").trim().charAt(0).toUpperCase()}</span>
      <span><strong>${r.name}</strong>${r.event ? html`<small>${r.event}</small>` : ""}</span>
    </figcaption>
  </figure>`;

export function reviewsSection(c) {
  const reviews = c.reviews || [];
  if (!c.reviewsCount && !reviews.length) return "";
  const rating = Number(c.reviewsRating) || 5;
  const highlights = c.reviewsHighlights || [];
  return html`
  <section class="section reviews ${reviews.length ? "has-cards" : ""}" id="avaliacoes" aria-labelledby="reviewsTitle">
    <header class="section-head">
      <p class="kicker" data-reveal>Avaliações</p>
      <h2 class="section-title" id="reviewsTitle" data-reveal>${splitWords(c.reviewsTitle || "Quem provou, recomenda")}</h2>
      ${c.reviewsIntro ? html`<p class="section-lead" data-reveal>${c.reviewsIntro}</p>` : ""}
    </header>
    <div class="reviews-grid">
      <div class="rating-card" data-reveal>
        <p class="rating-source"><span class="g-mark" aria-hidden="true">G</span>Avaliações no Google</p>
        <p class="rating-score"><b>${rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>${stars(rating)}</p>
        ${c.reviewsCount ? html`<p class="rating-count"><b data-count="${c.reviewsCount}">${c.reviewsCount}</b> avaliações de clientes</p>` : ""}
        ${highlights.length ? html`<ul class="rating-tags" aria-label="O que os clientes mais destacam">${highlights.map((h) => html`<li>${h}</li>`)}</ul>` : ""}
        ${c.reviewsUrl ? html`<a class="btn btn-gold" href="${c.reviewsUrl}" target="_blank" rel="noopener"><span>Ler as avaliações</span>${ui.arrow}</a>` : ""}
      </div>
      ${reviews.length ? html`
      <div class="review-carousel" data-reveal>
        <div class="review-track" id="reviewTrack" tabindex="0" aria-label="Depoimentos de clientes (deslize para ver mais)">${reviews.map(reviewCard)}</div>
        <div class="review-ui">
          <button type="button" class="ring-btn" data-review-go="-1" aria-label="Depoimento anterior">${ui.back}</button>
          <div class="review-dots" aria-hidden="true">${reviews.map((_, i) => html`<i data-dot="${i}"></i>`)}</div>
          <button type="button" class="ring-btn" data-review-go="1" aria-label="Próximo depoimento">${ui.arrow}</button>
        </div>
      </div>` : ""}
    </div>
  </section>`;
}

/** Carrossel de depoimentos: setas, pontos, troca automática (para com o dedo, o mouse ou o foco). */
export function mountReviews(root) {
  const track = root && $("#reviewTrack", root);
  if (!track) return () => {};
  const cards = $$(".review-card", track);
  const dots = $$("[data-dot]", root);
  let current = 0, paused = false, last = performance.now();

  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  const goTo = (i) => {
    // no computador cabem dois cartões: no fim da faixa, "próximo" volta ao começo
    current = i > current && atEnd() ? 0 : (i + cards.length) % cards.length;
    track.scrollTo({ left: cards[current].offsetLeft - track.offsetLeft, behavior: "smooth" });
  };
  const onScroll = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    cards.forEach((c, i) => { if (Math.abs(c.offsetLeft - track.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best].offsetLeft - track.offsetLeft + cards[best].offsetWidth / 2 - mid)) best = i; });
    current = atEnd() ? cards.length - 1 : best;
    dots.forEach((d, i) => d.classList.toggle("is-on", i === current));
  };
  const onClick = (e) => { const b = e.target.closest("[data-review-go]"); if (b) { goTo(current + Number(b.dataset.reviewGo)); last = performance.now(); } };
  const pause = () => { paused = true; };
  const resume = () => { paused = false; last = performance.now(); };
  track.addEventListener("scroll", onScroll, { passive: true });
  root.addEventListener("click", onClick);
  track.addEventListener("pointerenter", pause);
  track.addEventListener("pointerleave", resume);
  track.addEventListener("touchstart", pause, { passive: true });
  track.addEventListener("touchend", resume, { passive: true });
  track.addEventListener("focusin", pause);
  track.addEventListener("focusout", resume);
  onScroll();

  const stop = onFrame((m) => {
    if (paused || m.reduced || cards.length < 2) return;
    const r = track.getBoundingClientRect();
    if (r.bottom < 0 || r.top > m.vh) { last = performance.now(); return; }
    if (performance.now() - last > AUTO_MS) { last = performance.now(); goTo(current + 1); }
  });
  return () => { stop(); root.removeEventListener("click", onClick); };
}
