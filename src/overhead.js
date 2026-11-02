// Overhead line conductors (ACSR / AAAC): steady-state ampacity by the IEEE 738-2012 heat balance,
// plus voltage regulation and losses. Pure functions, SI units. Tested in tests/overhead.test.js.
//
// Heat balance:  qc + qr = qs + I²·R(Tc)   →   I = √((qc + qr − qs) / R(Tc))
//   qc  convective cooling (W/m): max of forced (qc1, qc2) and natural (qcn), IEEE 738 eq. 3a, 3b, 5a
//   qr  radiated cooling (W/m):   17.8·D·ε·[((Tc+273)/100)⁴ − ((Ta+273)/100)⁴],  D in m      eq. 7a
//   qs  solar gain (W/m):         α·Qse·sin(θ)·A'   (A' = D projected area per m)              eq. 8
// Air properties at film temperature Tfilm = (Tc + Ta)/2 and elevation He (m):                  eq. 13a–15a
//   μf = 1.458e-6·(Tfilm+273)^1.5 / (Tfilm+383.4)            dynamic viscosity, kg/(m·s)
//   ρf = (1.293 − 1.525e-4·He + 6.379e-9·He²) / (1 + 0.00367·Tfilm)   air density, kg/m³
//   kf = 2.424e-2 + 7.477e-5·Tfilm − 4.407e-9·Tfilm²          thermal conductivity, W/(m·°C)
// Nepal matters here: at 1400 m (Kathmandu) the air is ~15 % thinner than at sea level, so
// convective cooling and therefore ampacity are lower — an altitude effect that cables in ground do not have.

export function airProps(Tfilm, elevation) {
  const muf = (1.458e-6 * (Tfilm + 273) ** 1.5) / (Tfilm + 383.4);
  const rhof = (1.293 - 1.525e-4 * elevation + 6.379e-9 * elevation ** 2) / (1 + 0.00367 * Tfilm);
  const kf = 2.424e-2 + 7.477e-5 * Tfilm - 4.407e-9 * Tfilm ** 2;
  return { muf, rhof, kf };
}

/** Convective cooling, W/m. D in m, wind in m/s, phi = angle between wind and conductor axis (deg). */
export function convection({ D, Tc, Ta, wind, phiDeg = 90, elevation = 0 }) {
  const Tfilm = (Tc + Ta) / 2;
  const { muf, rhof, kf } = airProps(Tfilm, elevation);
  const phi = (phiDeg * Math.PI) / 180;
  const Kangle = 1.194 - Math.cos(phi) + 0.194 * Math.cos(2 * phi) + 0.368 * Math.sin(2 * phi);
  const NRe = (D * rhof * wind) / muf;
  const dT = Tc - Ta;
  const qc1 = Kangle * (1.01 + 1.35 * NRe ** 0.52) * kf * dT;
  const qc2 = Kangle * 0.754 * NRe ** 0.6 * kf * dT;
  const qcn = 3.645 * rhof ** 0.5 * D ** 0.75 * dT ** 1.25;
  return Math.max(qc1, qc2, qcn);
}

export function radiation({ D, Tc, Ta, emissivity = 0.5 }) {
  return 17.8 * D * emissivity * (((Tc + 273) / 100) ** 4 - ((Ta + 273) / 100) ** 4);
}

/** Solar gain, W/m. solar = incident flux on the conductor (W/m²) already including angle; elevation factor applied. */
export function solarGain({ D, absorptivity = 0.5, solar = 1000, elevation = 0 }) {
  const Ksolar = 1 + 1.148e-4 * elevation - 1.108e-8 * elevation ** 2; // IEEE 738 eq. 20
  return absorptivity * solar * Ksolar * D;
}

/** AC resistance at Tc from R20 (Ω/km, DC) with α20 = 0.00403 /°C for aluminium; skin effect ×acFactor. Ω/m. */
export function resistanceAt(r20OhmKm, Tc, acFactor = 1.02) {
  return (r20OhmKm * (1 + 0.00403 * (Tc - 20)) * acFactor) / 1000;
}

/** AC/DC resistance ratio at ~75 °C implied by Indian reference tables (CEA 2023, Satcon IS 398-2):
 *  single aluminium layer (6/1, 6/7) ≈ 1.15 (steel-core magnetic effect), two layers (26/7, 30/7) ≈ 1.005,
 *  three layers (54/7) ≈ 1.04. AAAC (all-aluminium, no steel) ≈ 1.01. */
export function acRatio(cond) {
  if (cond.st_strands == null) return 1.01;
  if (cond.al_strands <= 6) return 1.15;
  if (cond.al_strands <= 30) return 1.005;
  return 1.04;
}

/** Steady-state ampacity, A. */
export function ampacity(cond, env) {
  const D = cond.dia_mm / 1000;
  const Tc = env.Tc, Ta = env.Ta;
  const qc = convection({ D, Tc, Ta, wind: env.wind, phiDeg: env.phiDeg ?? 90, elevation: env.elevation ?? 0 });
  const qr = radiation({ D, Tc, Ta, emissivity: env.emissivity ?? 0.5 });
  const qs = solarGain({ D, absorptivity: env.absorptivity ?? 0.5, solar: env.solar ?? 1000, elevation: env.elevation ?? 0 });
  // Prefer a tabulated AC resistance at Tc; otherwise R20 corrected to Tc × AC/DC ratio of the stranding.
  const R = cond.rAcAtTc_ohm_km != null ? cond.rAcAtTc_ohm_km / 1000 : resistanceAt(cond.r20_ohm_km, Tc, env.acFactor ?? acRatio(cond));
  const net = qc + qr - qs;
  return { I: net > 0 ? Math.sqrt(net / R) : 0, qc, qr, qs, R };
}

/** Inductive reactance per phase, Ω/km at f Hz: X = 2πf·2e-4·ln(GMD/GMR). Distances in mm. */
export function reactance({ gmdMm, gmrMm, f = 50 }) {
  return 2 * Math.PI * f * 2e-4 * Math.log(gmdMm / gmrMm);
}

/** Geometric mean distance of three phases from their spacings (mm). */
export function gmd(dab, dbc, dca) {
  return Math.cbrt(dab * dbc * dca);
}

/** Three-phase line: voltage drop (%), losses (kW and %), using the short-line model. */
export function lineDrop({ kV, I, lengthKm, rOhmKm, xOhmKm, pf }) {
  const sin = Math.sqrt(1 - pf * pf);
  const dV = Math.sqrt(3) * I * lengthKm * (rOhmKm * pf + xOhmKm * sin); // V
  const lossKW = (3 * I * I * rOhmKm * lengthKm) / 1000;
  const PkW = Math.sqrt(3) * kV * I * pf;
  return { dV, pct: (dV / (kV * 1000)) * 100, lossKW, lossPct: (lossKW / PkW) * 100 };
}

// ---------------------------------------------------------------------------------------------
// Line sizing: smallest conductor whose thermal rating and voltage regulation both pass.

/** Typical phase spacing → GMD (mm). Editable; NEA drawings not published.
 *  132 kV and 66 kV values back-calculated from CEA 2023 line reactances (Panther 0.405, Dog 0.446 Ω/km). */
export const LINE_DEFAULTS = {
  // minDiaMm: smallest conductor used in practice at this voltage (corona and mechanical strength):
  // 66 kV ≈ Dog (14.2 mm), 132 kV ≈ Panther (21 mm) — Indian CEA / NEA practice.
  "11": { gmdMm: 1000, tc: 75, vd: 5, minDiaMm: 0, usual: ["Weasel", "Rabbit", "Dog"] },
  "33": { gmdMm: 1500, tc: 75, vd: 5, minDiaMm: 0, usual: ["Dog", "Panther", "Zebra"] },
  "66": { gmdMm: 3000, tc: 75, vd: 10, minDiaMm: 14, usual: ["Dog", "Wolf", "Panther"] },
  "132": { gmdMm: 5400, tc: 85, vd: 10, minDiaMm: 21, usual: ["Bear", "Panther"] },
};

export function gmrMm(c, G) {
  const r = c.dia_mm / 2;
  const n = c.al_strands;
  const k = c.st_strands == null ? (n <= 7 ? G.aaac_7 : n <= 19 ? G.aaac_19 : n <= 37 ? G.aaac_37 : G.aaac_61)
    : n <= 6 ? G.acsr_6 : n <= 26 ? G.acsr_26 : n <= 30 ? G.acsr_30 : G.acsr_54;
  return k * r;
}

/** spec: { kV, loadKVA, pf, lengthKm, type: "acsr"|"aaac", Ta, wind, elevation, solar, absorptivity, emissivity, Tc, gmdMm, vdLimitPct } */
export function sizeLine(OH, spec) {
  const all = spec.type === "aaac" ? OH.aaac : OH.acsr;
  const minDia = spec.minDiaMm ?? LINE_DEFAULTS[String(spec.kV)]?.minDiaMm ?? 0;
  const list = all.filter((c) => c.dia_mm >= minDia - 0.05);
  const I = spec.loadKVA / (Math.sqrt(3) * spec.kV);
  const env = { Tc: spec.Tc, Ta: spec.Ta, wind: spec.wind, elevation: spec.elevation, solar: spec.solar,
    absorptivity: spec.absorptivity, emissivity: spec.emissivity, phiDeg: 90 };
  const cands = list.map((c) => {
    const a = ampacity(c, env);
    const rAc = resistanceAt(c.r20_ohm_km, (spec.Ta + spec.Tc) / 2, acRatio(c)) * 1000; // Ω/km at a mid temperature for VD/losses
    const x = reactance({ gmdMm: spec.gmdMm, gmrMm: gmrMm(c, OH.gmr_ratio) });
    const d = lineDrop({ kV: spec.kV, I, lengthKm: spec.lengthKm, rOhmKm: rAc, xOhmKm: x, pf: spec.pf });
    const pass = { ampacity: a.I >= I, voltageDrop: d.pct <= spec.vdLimitPct };
    return { ...c, amp: a.I, heat: a, rAc, x, ...d, pass, ok: pass.ampacity && pass.voltageDrop };
  });
  const chosen = cands.find((c) => c.ok) || null;
  const decidedBy = !chosen ? [] : cands.indexOf(chosen) === 0 ? [minDia > 0 && all.findIndex((c) => c.name === chosen.name) > 0 ? "minimum conductor for this voltage" : "smallest size in the table"]
    : ["ampacity", "voltageDrop"].filter((k) => cands.find((c) => c.pass[k]) === chosen)
        .map((k) => (k === "ampacity" ? "current-carrying capacity" : "voltage drop"));
  const warnings = [];
  if (spec.lengthKm > 80) warnings.push("Line longer than 80 km: the short-line model understates the drop; use a medium-line (π) model.");
  if (!chosen) warnings.push("No conductor in the list passes: use a higher voltage, a double circuit or bundled conductors.");
  if (minDia > 0 && chosen && cands.indexOf(chosen) === 0 && all.findIndex((c) => c.name === chosen.name) > 0)
    warnings.push(`Smaller conductors pass thermally but are not used at ${spec.kV} kV: below about ${minDia} mm diameter, corona losses and mechanical strength rule them out (CEA practice).`);
  if (chosen && chosen.lossPct > 3) {
    const better = cands.slice(cands.indexOf(chosen) + 1).find((c) => c.lossPct <= chosen.lossPct * 0.7);
    if (better) warnings.push(`Losses are ${chosen.lossPct.toFixed(1)} % of the load. ${better.name} would cut them to ${better.lossPct.toFixed(1)} % — over the line's life the saved energy often pays for the bigger conductor.`);
  }
  return { I, cands, chosen, decidedBy, warnings, spec };
}
