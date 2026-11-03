// Generic, standard-independent parts of conductor sizing.
// Every function is pure and documented with the formula it implements (see docs/METHOD.md).

export const SQRT3 = Math.sqrt(3);

/** Standard protective-device ratings, A (IEC 60898 MCB / IEC 60947-2 MCCB / ACB frames). */
export const DEVICE_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250,
  315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000];

/** Load / unit conversion. Returns line current in A.
 *  kW, W  : I = P / (√3·U·pf·η)  (3-ph)   or   P / (U·pf·η)  (1-ph)  — η only for motor shaft output
 *  HP     : P = HP × 745.7 W (shaft output, so η always applies)
 *  kVA    : I = S / (√3·U)   or   S / U
 *  A      : given directly
 *  DC     : I = P / (U·η)
 */
export function loadCurrent({ system, voltage, power, unit, pf = 1, eff = 1, shaftOutput = false }) {
  if (!(voltage > 0)) throw new Error("Voltage must be greater than 0.");
  if (!(power > 0)) throw new Error("Load must be greater than 0.");
  if (unit === "A") return power;
  const div = system === "3ph" ? SQRT3 * voltage : voltage;
  if (unit === "kVA") return (power * 1000) / div;
  let watts = unit === "kW" ? power * 1000 : unit === "HP" ? power * 745.7 : power;
  const etaUsed = unit === "HP" || shaftOutput ? eff : 1;
  if (system === "dc") return watts / (voltage * etaUsed);
  if (!(pf > 0 && pf <= 1)) throw new Error("Power factor must be between 0 and 1.");
  return watts / (div * pf * etaUsed);
}

export function nextDevice(amps, ratings = DEVICE_RATINGS) {
  return ratings.find((r) => r >= amps - 1e-9) ?? null;
}

/** Linear interpolation in a {x: y} table with numeric keys.
 *  Outside the table it extrapolates from the last two points and flags it. */
export function interp(table, x) {
  const pts = Object.entries(table)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => [Number(k), v])
    .sort((a, b) => a[0] - b[0]);
  if (!pts.length) throw new Error("empty table");
  for (const [k, v] of pts) if (Math.abs(k - x) < 1e-9) return { value: v, exact: true };
  let i = pts.findIndex(([k]) => k > x);
  let outside = false;
  if (i === -1) { i = pts.length - 1; outside = true; }
  if (i === 0) { i = 1; outside = true; }
  if (pts.length === 1) return { value: pts[0][1], exact: false, outside: true };
  const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
  return { value: y0 + ((y1 - y0) * (x - x0)) / (x1 - x0), exact: false, outside };
}

/** Temperature rating factor from the conductor heat balance (IEC 60287 / IS 3961 basis):
 *  k = √((θmax − θ) / (θmax − θbase)). Reproduces the published IS tables to ±0.01. */
export function tempFactorFormula(thetaMax, theta, thetaBase) {
  if (theta >= thetaMax) return 0;
  return Math.sqrt((thetaMax - theta) / (thetaMax - thetaBase));
}

/** Voltage drop, V.  R, X in Ω/km, length in m, current in A per conductor.
 *  3-ph: ΔU = √3·I·L·(R cosφ + X sinφ)     1-ph & DC loop: ΔU = 2·I·L·(R cosφ + X sinφ) */
export function voltageDrop({ system, current, lengthM, r, x = 0, pf = 1 }) {
  const L = lengthM / 1000;
  if (system === "dc") return 2 * current * L * r;
  const sin = Math.sqrt(Math.max(0, 1 - pf * pf));
  const z = r * pf + x * sin;
  return (system === "3ph" ? SQRT3 : 2) * current * L * z;
}

/** Adiabatic short-circuit check (IEC 60364-4-43 §434.5.2, IEC 60949, IS 732):
 *  S_min = I·√t / k   (I in A, t in s, S in mm²). */
export function minSizeShortCircuit(faultKA, timeS, k) {
  return (faultKA * 1000 * Math.sqrt(timeS)) / k;
}

/** Prospective fault (kA) at the start of a cable fed by a transformer through a supply conductor.
 *  Transformer: per-phase impedance zPct·U²/S, treated as reactive (slightly conservative). Supply conductor: R at 20 °C
 *  (maximum fault, IEC 60909) and X in Ω/km over lengthM. Single-phase circuits fault through phase and neutral (2 × line). */
export function faultAtDistance({ kva, zPct = 0.045, lengthM = 0, rOhmKm = 0, xOhmKm = 0, singlePhase = false }) {
  const zt = (zPct * 400 * 400) / (kva * 1000);
  const L = lengthM / 1000, n = singlePhase ? 2 : 1;
  return 400 / SQRT3 / Math.hypot(n * rOhmKm * L, zt + n * xOhmKm * L) / 1000;
}

/** What the chosen conductor can take in a fault (IEC 60364-4-43 §434.5.2): allowable energy (k·S)² in A²s,
 *  and the longest time (ms) a fault of iscKA may last before the conductor passes its limit temperature. */
export function faultWithstand(insulation, material, size, iscKA) {
  const k = kValue(insulation, material, size);
  const allow = (k * size) ** 2;
  return { k, allow, tMs: (allow / (iscKA * 1000) ** 2) * 1000 };
}

/** Adiabatic k (A·√s/mm²) — IEC 60364-5-54 Table A.54.2/A.54.3, IEC 60364-4-43 Table 43A. */
export function kValue(insulation, material, size) {
  const cu = material === "cu";
  switch (insulation) {
    case "PVC": // 70 → 160 °C (≤300 mm²), 70 → 140 °C (>300 mm²)
      return size > 300 ? (cu ? 103 : 68) : cu ? 115 : 76;
    case "HRPVC": // 85 → 160 °C (≤300 mm²) = 104/69 (Torrent catalogue; IEC 60949 formula gives 103.8/68);
      // 85 → 140 °C (>300 mm²) from the same formula = 90/59
      return size > 300 ? (cu ? 90 : 59) : cu ? 104 : 69;
    case "XLPE": // 90 → 250 °C
    case "EPR":
      return cu ? 143 : 94;
    default:
      throw new Error("Unknown insulation " + insulation);
  }
}

/** Protective (earth) conductor size, same material as phase (IEC 60364-5-54 Table 54.2, IS 732). */
export function earthConductorSize(phaseSize, sizes) {
  const need = phaseSize <= 16 ? phaseSize : phaseSize <= 35 ? 16 : phaseSize / 2;
  return sizes.find((s) => s >= need - 1e-9) ?? need;
}

/** Estimated conductor operating temperature (IEC 60364-5-52 Annex G):
 *  θ = θa + (θmax − θa)·(Ib/Iz)²  */
export function operatingTemp(thetaAmb, thetaMax, ib, iz) {
  return thetaAmb + (thetaMax - thetaAmb) * Math.min(1, (ib / iz) ** 2);
}

export const round = (v, d = 2) => (v == null || !isFinite(v) ? v : Math.round(v * 10 ** d) / 10 ** d);
