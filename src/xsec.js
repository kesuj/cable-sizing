// To-scale (approximate) cable cross-section. Dimensions follow typical IS 1554 / IS 7098 constructions:
// conductor Ø ≈ 1.13·√S (compacted strands), insulation by voltage grade, bedding, armour, outer sheath.
const NS = "http://www.w3.org/2000/svg";
// IS 1554 core colours: red, yellow, blue phases; black neutral.
const CORE_COLOURS = ["#C62828", "#E2B007", "#1F5FAF", "#222222"];

function insulationMm(size, kv) {
  if (kv > 22) return 8.8;
  if (kv > 11) return 5.5;
  if (kv > 6.6) return 3.6;
  if (kv > 3.3) return 2.8;
  if (kv > 1.1) return 2.2;
  return size <= 16 ? 0.7 : size <= 50 ? 0.9 : size <= 150 ? 1.2 : size <= 300 ? 1.6 : 2.0;
}

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function drawCable(svg, c) {
  while (svg.lastChild && svg.lastChild.nodeName !== "title") svg.removeChild(svg.lastChild);
  if (!c) return;
  const n = c.single ? 1 : c.cores === "3.5" ? 4 : Number(c.cores);
  const dC = 1.13 * Math.sqrt(c.size);
  const ti = insulationMm(c.size, c.kv);
  const screen = c.hv ? 1.0 : 0; // semicon + copper tape screen
  const coreD = dC + 2 * ti + 2 * screen;
  const sizes = Array.from({ length: n }, (_, i) => (c.cores === "3.5" && i === 3 ? coreD * 0.72 : coreD));
  // layout: core centres
  let pos;
  if (n === 1) pos = [[0, 0]];
  else if (n === 2) pos = [[-coreD / 2, 0], [coreD / 2, 0]];
  else if (n === 3) { const r = coreD / Math.sqrt(3); pos = [0, 1, 2].map((i) => [r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 3), r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 3)]); }
  else { const r = coreD / Math.SQRT2; pos = [0, 1, 2, 3].map((i) => [r * Math.cos(Math.PI / 4 + (i * Math.PI) / 2), r * Math.sin(Math.PI / 4 + (i * Math.PI) / 2)]); }
  if (c.cores === "3.5") { const r = coreD / Math.sqrt(3); pos[3] = [0, r + coreD * 0.2]; pos = pos.map(([x, y], i) => (i < 3 ? [x, y - coreD * 0.12] : [x, y])); }
  const layR = Math.max(...pos.map(([x, y], i) => Math.hypot(x, y) + sizes[i] / 2));
  const bed = 0.4 + 0.01 * layR * 2;
  const arm = c.armoured ? (layR > 15 ? 2.5 : 1.6) : 0;
  const sheath = 1.4 + 0.035 * (layR * 2 + bed * 2 + arm * 2);
  const R = layR + bed + arm + sheath;
  const scale = 98 / R; // fit in 240 viewbox, leaving room for the scale bar
  const g = el("g", { transform: "translate(120 114)" });
  const ring = (r, fill, extra = {}) => g.appendChild(el("circle", { cx: 0, cy: 0, r: r * scale, fill, class: "ring", ...extra }));
  ring(R, c.hv ? "#8E1B17" : "#202428");
  if (c.armoured) {
    ring(layR + bed + arm, "#6E777D");
    const wires = Math.max(12, Math.round((2 * Math.PI * (layR + bed + arm / 2)) / arm));
    for (let i = 0; i < wires; i++) {
      const a = (i / wires) * 2 * Math.PI, rr = (layR + bed + arm / 2) * scale;
      g.appendChild(el("circle", { cx: rr * Math.cos(a), cy: rr * Math.sin(a), r: (arm / 2) * scale * 0.9, fill: "#9AA3A8", stroke: "#4B5359", "stroke-width": 0.4 }));
    }
  }
  ring(layR + bed, "#CFCBC2");
  pos.forEach(([x, y], i) => {
    const d = sizes[i], cd = i === 3 && c.cores === "3.5" ? dC * 0.72 : dC;
    const col = n === 1 ? (c.hv ? "#2B2B2B" : "#C62828") : c.hv ? "#2B2B2B" : CORE_COLOURS[n === 2 ? (i === 0 ? 0 : 3) : i];
    g.appendChild(el("circle", { cx: x * scale, cy: y * scale, r: (d / 2) * scale, fill: col }));
    if (c.hv) g.appendChild(el("circle", { cx: x * scale, cy: y * scale, r: (d / 2 - screen * 0.5) * scale, fill: "none", stroke: "#C98A4B", "stroke-width": Math.max(1, screen * scale * 0.6) }));
    if (c.hv) g.appendChild(el("circle", { cx: x * scale, cy: y * scale, r: (cd / 2 + ti) * scale, fill: "#E9E6DC" }));
    g.appendChild(el("circle", { cx: x * scale, cy: y * scale, r: (cd / 2) * scale, fill: c.material === "cu" ? "#B87333" : "#A9B2B8" }));
  });
  svg.appendChild(g);
  // scale bar: 10 mm (or 5 mm for small cables)
  const bar = R * 2 > 40 ? 20 : R * 2 > 15 ? 10 : 5;
  const bx = 120 - (bar * scale) / 2;
  svg.appendChild(el("line", { x1: bx, x2: bx + bar * scale, y1: 221, y2: 221, stroke: "currentColor", "stroke-width": 2 }));
  const t = el("text", { x: 120, y: 236, "text-anchor": "middle", "font-size": 12, fill: "currentColor" });
  t.textContent = `${bar} mm · overall ≈ ${Math.round(R * 2)} mm`;
  svg.appendChild(t);
}

/** Stranded overhead conductor (ACSR / AAAC) drawn layer by layer. */
function layersFor(c) {
  const al = c.al_strands, st = c.st_strands;
  if (st == null) { // homogeneous AAAC: 1, 6, 12, 18, 24 …
    const L = [1]; let n = 1; while (n < al) { const k = 6 * L.length; L.push(k); n += k; } return L.map((k) => ({ n: k, steel: false }));
  }
  const steel = st === 1 ? [1] : st === 7 ? [1, 6] : [1, 6, 12];
  const alLayers = al === 6 ? [6] : al === 26 ? [10, 16] : al === 30 ? [12, 18] : al === 54 ? [12, 18, 24] : al === 45 ? [9, 15, 21] : [al];
  return [...steel.map((n) => ({ n, steel: true })), ...alLayers.map((n) => ({ n, steel: false }))];
}
export function drawStrands(svg, c) {
  while (svg.lastChild && svg.lastChild.nodeName !== "title") svg.removeChild(svg.lastChild);
  if (!c) return;
  const L = layersFor(c);
  const scale = 100 / (c.dia_mm / 2);
  const dSteel = c.st_dia_mm || c.al_dia_mm || c.dia_mm / (2 * L.length - 1);
  const dAl = c.al_dia_mm || dSteel;
  const g = el("g", { transform: "translate(120 112)" });
  let r = 0;
  L.forEach((layer, i) => {
    const d = layer.steel ? dSteel : dAl;
    const rr = i === 0 ? 0 : r + d / 2;
    for (let k = 0; k < layer.n; k++) {
      const a = (k / layer.n) * 2 * Math.PI + (i % 2) * 0.2;
      g.appendChild(el("circle", { cx: rr * Math.cos(a) * scale, cy: rr * Math.sin(a) * scale, r: (d / 2) * scale * 0.97,
        fill: layer.steel ? "#6E777D" : "#C9CFD3", stroke: "#4B5359", "stroke-width": 0.6 }));
    }
    r = i === 0 ? d / 2 : rr + d / 2;
  });
  svg.appendChild(g);
  const t = el("text", { x: 120, y: 234, "text-anchor": "middle", "font-size": 12, fill: "currentColor" });
  t.textContent = `Ø ${c.dia_mm} mm · ${c.al_strands} Al${c.st_strands ? ` + ${c.st_strands} steel` : ""} strands`;
  svg.appendChild(t);
}
