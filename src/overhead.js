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
// Line sizing: smallest conductor (and bundle) passing thermal rating, voltage regulation and,
// for transmission, practical loadability.

/** Per voltage: typical GMD (mm), max conductor temperature, regulation limit, minimum conductor
 *  diameter (corona / strength), allowed bundles, NEA usual choices. 66/132 kV GMDs back-calculated from
 *  CEA 2023 reactances; 220/400 kV give X ≈ 0.41 (single Zebra) / 0.32 (twin Moose) / 0.26 (quad Moose) Ω/km,
 *  the textbook values. Spacing and spans are typical — check the NEA tower drawings. */
export const LINE_DEFAULTS = {
  "11": { gmdMm: 1000, tc: 75, vd: 5, minDiaMm: 0, bundles: [1], usual: ["Weasel", "Rabbit", "Dog"] },
  "33": { gmdMm: 1500, tc: 75, vd: 5, minDiaMm: 0, bundles: [1], usual: ["Dog", "Panther", "Zebra"] },
  "66": { gmdMm: 3000, tc: 75, vd: 10, minDiaMm: 14, bundles: [1], usual: ["Dog", "Wolf", "Panther"] },
  "132": { gmdMm: 5400, tc: 85, vd: 10, minDiaMm: 21, bundles: [1], usual: ["Bear", "Panther"] },
  "220": { gmdMm: 8000, tc: 85, vd: 10, minDiaMm: 28, bundles: [1, 2], usual: ["Zebra", "twin Moose", "twin HTLS"] },
  "400": { gmdMm: 12000, tc: 85, vd: 10, minDiaMm: 31, bundles: [2, 4], usual: ["twin Moose", "quad Moose (Dhalkebar–Muzaffarpur)"] },
};
export const BUNDLE_SPACING_MM = 450; // Indian EHV practice

export function gmrMm(c, G) {
  const r = c.dia_mm / 2;
  const n = c.al_strands;
  const k = c.st_strands == null ? (n <= 7 ? G.aaac_7 : n <= 19 ? G.aaac_19 : n <= 37 ? G.aaac_37 : G.aaac_61)
    : n <= 6 ? G.acsr_6 : n <= 26 ? G.acsr_26 : n <= 30 ? G.acsr_30 : G.acsr_54;
  return k * r;
}

/** Equivalent radius of an n-conductor bundle with spacing s: n=2 √(r·s), n=3 ∛(r·s²), n=4 1.0905·⁴√(r·s³). */
export function bundleRadius(r, n, s = BUNDLE_SPACING_MM) {
  if (n === 1) return r;
  if (n === 2) return Math.sqrt(r * s);
  if (n === 3) return Math.cbrt(r * s * s);
  return 1.0905 * (r * s ** 3) ** 0.25;
}

// minimal complex arithmetic for the long-line equations
const Cx = (re, im = 0) => ({ re, im });
const cadd = (a, b) => Cx(a.re + b.re, a.im + b.im);
const cmul = (a, b) => Cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return Cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = (a) => Math.hypot(a.re, a.im);
const csqrt = (a) => { const m = Math.sqrt(cabs(a)), t = Math.atan2(a.im, a.re) / 2; return Cx(m * Math.cos(t), m * Math.sin(t)); };
const cexp = (a) => Cx(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));
const ccosh = (a) => { const e = cexp(a), f = cexp(Cx(-a.re, -a.im)); return Cx((e.re + f.re) / 2, (e.im + f.im) / 2); };
const csinh = (a) => { const e = cexp(a), f = cexp(Cx(-a.re, -a.im)); return Cx((e.re - f.re) / 2, (e.im - f.im) / 2); };

/** Long-line (distributed) model. r, x in Ω/km; capacitance in F/km. Returns regulation %, Zc (Ω), SIL (MW), sending kV. */
export function longLine({ kV, I, pf, lengthKm, r, x, cFkm, f = 50 }) {
  const z = Cx(r, x), y = Cx(0, 2 * Math.PI * f * cFkm);
  const Zc = csqrt(cdiv(z, y));
  const gl = cmul(csqrt(cmul(z, y)), Cx(lengthKm));
  const A = ccosh(gl), B = cmul(Zc, csinh(gl));
  const Vr = Cx((kV * 1000) / Math.sqrt(3));
  const Ir = Cx(I * pf, -I * Math.sqrt(1 - pf * pf));
  const Vs = cadd(cmul(A, Vr), cmul(B, Ir));
  const VrNoLoad = cabs(Vs) / cabs(A);
  return { regPct: ((VrNoLoad - cabs(Vr)) / cabs(Vr)) * 100, Zc: cabs(Zc), silMW: (kV * kV) / cabs(Zc), VsKV: (cabs(Vs) * Math.sqrt(3)) / 1000 };
}

/** St. Clair practical loadability (× SIL) vs length, as used in transmission planning (Dunlop et al. 1979). */
export function stClair(lengthKm) {
  const pts = [[0, 3.0], [80, 3.0], [160, 2.0], [320, 1.3], [480, 1.0], [640, 0.75]];
  if (lengthKm >= 640) return 0.75;
  const i = pts.findIndex(([l]) => l >= lengthKm);
  if (i <= 0) return 3.0;
  const [l0, m0] = pts[i - 1], [l1, m1] = pts[i];
  return m0 + ((m1 - m0) * (lengthKm - l0)) / (l1 - l0);
}

/** spec: { kV, loadKVA, pf, lengthKm, type, Ta, wind, elevation, solar, absorptivity, emissivity, Tc, gmdMm, vdLimitPct, circuits } */
export function sizeLine(OH, spec) {
  const D = LINE_DEFAULTS[String(spec.kV)] || LINE_DEFAULTS["11"];
  const all = spec.type === "aaac" ? OH.aaac : OH.acsr;
  const minDia = spec.minDiaMm ?? D.minDiaMm ?? 0;
  const circuits = Math.max(1, spec.circuits || 1);
  const I = spec.loadKVA / (Math.sqrt(3) * spec.kV) / circuits; // per circuit
  const ehv = spec.kV >= 66 || spec.lengthKm > 80;
  const env = { Tc: spec.Tc, Ta: spec.Ta, wind: spec.wind, elevation: spec.elevation, solar: spec.solar,
    absorptivity: spec.absorptivity, emissivity: spec.emissivity, phiDeg: 90 };
  const combos = [];
  for (const n of D.bundles) for (const c of all) {
    if (c.dia_mm < minDia - 0.05) continue; // corona / strength minimum, also for each subconductor of a bundle
    combos.push({ c, n });
  }
  // Prefer fewer subconductors (less hardware), then the smaller conductor.
  combos.sort((p, q) => p.n - q.n || p.c.al_area_mm2 - q.c.al_area_mm2);
  const cands = combos.map(({ c, n }) => {
    const a = ampacity(c, env);
    const rAc = (resistanceAt(c.r20_ohm_km, (spec.Ta + spec.Tc) / 2, acRatio(c)) * 1000) / n;
    const x = reactance({ gmdMm: spec.gmdMm, gmrMm: bundleRadius(gmrMm(c, OH.gmr_ratio), n) });
    const cFkm = (2 * Math.PI * 8.854e-12 * 1000) / Math.log(spec.gmdMm / bundleRadius(c.dia_mm / 2, n));
    const d = lineDrop({ kV: spec.kV, I, lengthKm: spec.lengthKm, rOhmKm: rAc, xOhmKm: x, pf: spec.pf });
    let reg = d.pct, sil = null, loadability = null;
    if (ehv) {
      const L = longLine({ kV: spec.kV, I, pf: spec.pf, lengthKm: spec.lengthKm, r: rAc, x, cFkm });
      reg = L.regPct; sil = L.silMW; loadability = stClair(spec.lengthKm) * L.silMW;
    }
    const PMW = (Math.sqrt(3) * spec.kV * I * spec.pf) / 1000;
    // ≤ 132 kV: regulation limit applies. 220/400 kV: voltage is held by reactive compensation; the St. Clair
    // loadability (which already embeds a ~5 % drop and a stability margin) is the planning limit.
    const regApplies = spec.kV <= 132;
    const pass = { ampacity: a.I * n >= I, voltageDrop: !regApplies || reg <= spec.vdLimitPct, loadability: loadability == null || PMW <= loadability };
    const name = n === 1 ? c.name : `${n === 2 ? "twin" : n === 4 ? "quad" : n + "×"} ${c.name}`;
    return { ...c, name, conductor: c.name, n, amp: a.I * n, heat: a, rAc, x, cFkm, ...d, pct: reg, sil, loadability, PMW, pass,
      ok: pass.ampacity && pass.voltageDrop && pass.loadability };
  });
  const chosen = cands.find((c) => c.ok) || null;
  const labels = { ampacity: "current-carrying capacity", voltageDrop: "voltage drop", loadability: "line loadability (St. Clair)" };
  const first = cands[0];
  const thinnerExist = chosen && all.findIndex((c) => c.name === chosen.conductor) > 0 && chosen.n === D.bundles[0];
  const decidedBy = !chosen ? [] : chosen === first
    ? [minDia > 0 && thinnerExist ? "minimum conductor for this voltage" : "smallest size in the table"]
    : Object.keys(labels).filter((k) => cands.find((c) => c.pass[k]) === chosen).map((k) => labels[k]);
  const warnings = [];
  if (!chosen) warnings.push(spec.kV >= 220 ? "No conductor or bundle passes on one circuit: use two circuits (double-circuit towers) or a higher voltage." : "No conductor in the list passes: use a higher voltage, more circuits or bigger bundles.");
  if (spec.kV >= 220) warnings.push("At 220/400 kV, voltage is held by reactive compensation at the substations; the St. Clair loadability limit is applied instead of a regulation limit. Regulation is shown for information.");
  if (chosen && chosen === first && minDia > 0 && thinnerExist)
    warnings.push(`Smaller conductors pass thermally but are not used at ${spec.kV} kV: below about ${minDia} mm diameter, corona losses and mechanical strength rule them out (CEA practice).`);
  if (chosen && chosen.lossPct > 3) {
    const better = cands.slice(cands.indexOf(chosen) + 1).find((c) => c.ok && c.lossPct <= chosen.lossPct * 0.7);
    if (better) warnings.push(`Losses are ${chosen.lossPct.toFixed(1)} % of the load. ${better.name} would cut them to ${better.lossPct.toFixed(1)} % — over the line's life the saved energy often pays for the bigger conductor.`);
  }
  if (ehv && chosen && chosen.PMW < 0.5 * chosen.sil && spec.lengthKm > 100)
    warnings.push(`Light load on a long line (${chosen.PMW.toFixed(0)} MW vs SIL ${chosen.sil.toFixed(0)} MW): line charging raises the far-end voltage; shunt reactors may be needed.`);
  return { I, circuits, cands, chosen, decidedBy, warnings, spec, ehv };
}
