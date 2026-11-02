// Compare src/overhead.js against every published reference rating in research/overhead_conductors.json.
import fs from "node:fs";
import { ampacity } from "../src/overhead.js";
const d = JSON.parse(fs.readFileSync(new URL("../research/overhead_conductors.json", import.meta.url), "utf8"));
const byName = Object.fromEntries([...d.acsr, ...d.aaac].map((c) => [c.name.toLowerCase(), c]));
const find = (label) => {
  const l = label.toLowerCase();
  const m = l.match(/aaac (\d+)/); if (m) return byName[`aaac ${m[1]}`];
  return Object.values(byName).find((c) => l.includes(c.name.toLowerCase().replace(/ \(.*\)/, "")) && (!/bs/.test(c.name.toLowerCase()) || /bs/.test(l)));
};
let n = 0, worst = 0, rows = [];
for (const r of d.reference_ampacities) {
  const c = r.conditions || {};
  const cd = r.conductor_data || {};
  const base = find(r.conductor);
  const dia = cd.dia_mm ?? base?.dia_mm;
  const rac = r.r_ac_ohm_km_at_temp ?? cd[`r${r.conductor_temp_c}`];
  if (!dia || !rac || c.ambient_c == null || c.wind_m_s == null) continue;
  const a = ampacity({ dia_mm: dia, rAcAtTc_ohm_km: rac }, { Tc: r.conductor_temp_c, Ta: c.ambient_c, wind: c.wind_m_s,
    phiDeg: c.wind_angle_deg ?? 90, elevation: c.elevation_m ?? 0, solar: c.solar_w_m2 ?? 1000,
    absorptivity: c.absorptivity ?? 0.5, emissivity: c.emissivity ?? 0.5 }).I;
  const err = (a - r.amps) / r.amps * 100; n++; worst = Math.max(worst, Math.abs(err));
  rows.push([r.source, r.conductor.slice(0, 26), r.conductor_temp_c, c.ambient_c, r.amps, a.toFixed(0), err.toFixed(1) + "%"]);
}
rows.sort((x, y) => Math.abs(parseFloat(y[6])) - Math.abs(parseFloat(x[6])));
console.log(`checked ${n} published ratings; worst deviation ${worst.toFixed(2)} %`);
for (const r of rows.slice(0, 6)) console.log("  ", r.join(" | "));

// Second pass: the website path (R20 from the conductor table × AC/DC ratio), Satcon/CEA rows.
let n2 = 0, worst2 = 0, bad = [];
for (const r of d.reference_ampacities) {
  const c = r.conditions || {};
  const base = find(r.conductor);
  if (!base || /-eq/i.test(r.conductor) || c.ambient_c == null || c.wind_m_s == null || ![75, 85].includes(r.conductor_temp_c)) continue;
  const a = ampacity(base, { Tc: r.conductor_temp_c, Ta: c.ambient_c, wind: c.wind_m_s, phiDeg: c.wind_angle_deg ?? 90,
    elevation: c.elevation_m ?? 0, solar: c.solar_w_m2 ?? 1000, absorptivity: c.absorptivity ?? 0.5, emissivity: c.emissivity ?? 0.5 }).I;
  const err = (a - r.amps) / r.amps * 100; n2++; worst2 = Math.max(worst2, Math.abs(err));
  if (Math.abs(err) > 3) bad.push(`${r.conductor} ${r.conductor_temp_c}°C/${c.ambient_c}°C: table ${r.amps}, ours ${a.toFixed(0)} (${err.toFixed(1)} %)`);
}
console.log(`R20 × AC/DC path: checked ${n2}; worst ${worst2.toFixed(1)} %; over 3 %: ${bad.length}`);
bad.slice(0, 8).forEach((b) => console.log("   ", b));
