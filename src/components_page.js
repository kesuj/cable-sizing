// Renders components.html from src/components.js. Photos fall back to an icon if missing.
import { GROUPS, COMPONENTS } from "./components.js";
import { CREDITS } from "./credits.js";
import { ic } from "./icons.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FALLBACK = { cable: "cable", protect: "shield", motor: "zap", install: "wrench", hv: "zap", line: "tower" };

function card(c) {
  const cr = CREDITS[c.id];
  const img = cr
    ? `<figure class="comp-ph"><img src="assets/photos/${cr.file}" alt="${esc(cr.alt || c.en)}" loading="lazy" width="800" height="533"><figcaption>Photo: ${esc(cr.author)}, <a href="${esc(cr.source)}">${esc(cr.license)}</a></figcaption></figure>`
    : `<div class="comp-ph none">${ic(FALLBACK[c.group], 40)}</div>`;
  return `<article class="comp" id="${c.id}">${img}<div class="comp-body"><h3>${esc(c.en)} <span lang="ne">${esc(c.ne)}</span></h3>
    <p>${esc(c.what)}</p>
    <dl><dt>${ic("layers", 15)} Ratings you can buy</dt><dd>${esc(c.ratings)}</dd>
    <dt>${ic("calc", 15)} How the calculator picks it</dt><dd>${esc(c.choose)}</dd>
    <dt>${ic("check", 15)} Check at the shop</dt><dd>${esc(c.check)}</dd></dl></div></article>`;
}

const root = document.getElementById("catalogue");
const nav = document.getElementById("groups");
if (root && nav) {
  nav.innerHTML = GROUPS.map((g) => `<a href="#g-${g.id}">${esc(g.en)}</a>`).join("");
  root.innerHTML = GROUPS.map((g) => `<section class="comp-group" id="g-${g.id}"><h2>${esc(g.en)} <span lang="ne">${esc(g.ne)}</span></h2>
    <div class="comp-grid">${COMPONENTS.filter((c) => c.group === g.id).map(card).join("")}</div></section>`).join("");
}
document.getElementById("theme")?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("cs-theme", document.documentElement.dataset.theme); } catch { /* ignore */ }
});
