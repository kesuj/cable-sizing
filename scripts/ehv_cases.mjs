// Print EHV sizing for typical Nepal corridors (diagnostic).
import { DATA } from "../src/data.js";
import { sizeLine, LINE_DEFAULTS } from "../src/overhead.js";
for (const [kv, mw, km, c] of [[132, 60, 60, 1], [220, 250, 120, 1], [220, 400, 80, 2], [400, 1000, 150, 1], [400, 1500, 250, 1]]) {
  const D = LINE_DEFAULTS[kv];
  const r = sizeLine(DATA.overhead, { kV: kv, loadKVA: (mw * 1000) / 0.95, pf: 0.95, lengthKm: km, type: "acsr", Ta: 45, wind: 0.56, elevation: 150,
    solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: D.tc, gmdMm: D.gmdMm, vdLimitPct: D.vd, circuits: c });
  const x = r.chosen;
  console.log(`${kv} kV ${mw} MW ${km} km ${c} cct -> ${x?.name} | amp ${x?.amp.toFixed(0)} vs I ${r.I.toFixed(0)} | reg ${x?.pct.toFixed(1)} % | SIL ${x?.sil?.toFixed(0)} limit ${x?.loadability?.toFixed(0)} MW | loss ${x?.lossPct.toFixed(1)} % | ${r.decidedBy.join(", ")}`);
  if (!x) console.log("   first cands:", r.cands.slice(-4).map((c) => `${c.name} amp ${c.amp.toFixed(0)} reg ${c.pct.toFixed(1)} PMW ${c.PMW.toFixed(0)} lim ${c.loadability?.toFixed(0)}`).join(" | "));
}
