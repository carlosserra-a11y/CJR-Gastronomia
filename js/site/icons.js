/* Ícones em traço fino (dourado via currentColor). Os das categorias podem ser escolhidos no painel. */
import { raw } from "./util.js";

const svg = (body, vb = "0 0 48 48") => raw(`<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`);

export const CATEGORY_ICONS = {
  coffee: svg('<path d="M10 20h22v9a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z"/><path d="M32 23h3a4 4 0 0 1 0 8h-3.6"/><path d="M8 43h28"/><path d="M17 8c-2 2.5 2 4.5 0 7M23 7c-2 2.5 2 4.5 0 7M29 8c-2 2.5 2 4.5 0 7"/>'),
  board: svg('<rect x="6" y="15" width="31" height="22" rx="4"/><path d="M37 26h5"/><path d="M12 30l5-8 5 8z"/><circle cx="28" cy="24" r="3"/><circle cx="30.5" cy="31" r="2"/><path d="M15 21v-1M24 32h1"/>'),
  finger: svg('<path d="M8 40 38 10"/><circle cx="31" cy="17" r="4.5"/><rect x="19.5" y="24.5" width="8" height="8" rx="2" transform="rotate(-45 23.5 28.5)"/><circle cx="15.5" cy="32.5" r="3.5"/><path d="M38 10l3-3"/>'),
  cloche: svg('<path d="M7 34h34"/><path d="M10 34a14 14 0 0 1 28 0"/><circle cx="24" cy="17.5" r="2"/><path d="M5 39h38"/><path d="M17 26a8 8 0 0 1 5-4"/>'),
  dessert: svg('<path d="M9 36 24 12l15 24z"/><path d="M9 36h30v4H9z"/><path d="M13.5 29h21"/><circle cx="24" cy="9" r="2.5"/><path d="M18 22.5c2 1.5 4-1.5 6 0s4-1.5 6 0"/>'),
  bowl: svg('<path d="M6 24h36a18 18 0 0 1-36 0z"/><path d="M17 40h14"/><path d="M30 8 21 22M36 11 25 22"/><path d="M14 28c3 2 6-2 9 0s6-2 9 0"/>'),
  flame: svg('<path d="M24 42c-8 0-13-5-13-12 0-8 7-11 8-19 4 3 6 7 6 10 2-1 3-3 3-6 5 4 9 9 9 15 0 7-5 12-13 12z"/><path d="M24 42c-3 0-5-2-5-5 0-4 5-6 5-10 3 2 5 5 5 9 0 3-2 6-5 6z"/>'),
  sparkle: svg('<path d="M24 5c1.5 9 4.5 12 13.5 13.5C28.5 20 25.5 23 24 32c-1.5-9-4.5-12-13.5-13.5C19.5 17 22.5 14 24 5z"/><path d="M37 30c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6z"/><path d="M10 33c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4z"/>'),
  leaf: svg('<path d="M10 38C10 20 22 9 40 8c0 18-11 30-29 30z"/><path d="M10 38 30 18"/><path d="M18 30h8M22 26v-7"/>'),
  glass: svg('<path d="M15 6h18l-2 14a7 7 0 0 1-14 0z"/><path d="M24 27v13M16 42h16"/><path d="M16.5 13h15"/>'),
};

export const categoryIcon = (name) => CATEGORY_ICONS[name] || CATEGORY_ICONS.leaf;

export const ui = {
  arrow: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'),
  back: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>'),
  check: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'),
  plus: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'),
  close: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'),
  copy: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>'),
  whats: raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>'),
  insta: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8" fill="currentColor"/></svg>'),
  mail: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>'),
  pin: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'),
};
