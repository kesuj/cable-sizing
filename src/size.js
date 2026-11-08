// Conductor sizing orchestrator — the "complete process" (docs/METHOD.md):
//  1 load current  2 design current  3 protective device  4 rating factors
//  5 required tabulated rating  6 voltage drop (running + motor start)
//  7 short-circuit withstand  8 parallel runs if needed  9 earth conductor  10 bill of materials
import {
  loadCurrent, nextDevice, voltageDrop, minSizeShortCircuit, kValue,
  earthConductorSize, operatingTemp, round,
} from "./core.js";
import { lmaxM, tripCurrent, harmonicNeutral } from "./protection.js";

export const DEFAULTS = {
  system: "3ph", voltage: 400,
  load: { power: 10, unit: "kW", pf: 0.8, eff: 0.9, shaftOutput: false },
  designMargin: 0, motorFactor: 1,
  material: "cu", insulation: "XLPE", cores: "3.5", armoured: true,
  method: "ground",
  env: { airTemp: 40, groundTemp: 30, soilRes: 150, depthMm: 750 },
  group: { count: 1, spacing: "touching", formation: "flat", racks: 1 },
  lengthM: 50, vdLimitPct: 5, vdStartLimitPct: 15,
  motorStart: null, // {multiple: 6, pf: 0.3}
  fault: null, // {ka: 10, timeS: 0.1}  or  {i2t: 40000} for a current-limiting breaker/fuse
  sizeOn: "device", // "device" (LV: In ≤ Iz) or "current" (HV relays / no overload device: Ib ≤ Iz)
  // Minimum short circuit: the breaker's instantaneous trip must operate for a fault at the far end of the cable.
  // {curve: "B"|"C"|"D", iscKA, earthing: "TT"|"TN"}: iscKA > 10 or In > 63 A means a moulded-case breaker (EIG G5.1, p255-258).
  trip: null,
  h3: 0, // third-harmonic share of the phase current, %: neutral sizing for 4- and 5-core cables (EIG Fig. G19)
  maxParallel: 6,
};

function merge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    o[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? { ...a[k], ...v } : v;
  }
  return o;
}

export function sizeConductor(adapter, input) {
  const spec = merge(DEFAULTS, input);
  const warnings = [];
  const steps = [];

  // 1–2. Currents
  const I = loadCurrent({ system: spec.system, voltage: spec.voltage, ...spec.load });
  const Ib = I * (1 + (spec.designMargin || 0)) * (spec.motorFactor || 1);
  steps.push({ step: "Load current", value: round(I, 2), unit: "A" });
  if (Ib !== I) steps.push({ step: "Design current Ib (margin/motor factor)", value: round(Ib, 2), unit: "A" });

  const allRows = adapter.rows(spec);
  const rows = allRows.filter((r) => r.size >= (spec.minSize || 0) - 1e-9);
  if (!rows.length) throw new Error("No cable sizes available for this combination.");
  if (rows.length < allRows.length) steps.push({ step: `Minimum size ${spec.minSize} mm² (${spec.minSizeRule || "user setting"})` });
  const sizes = rows.map((r) => r.size);
  const thetaMax = adapter.thetaMax(spec);
  const ambient = spec.method === "air" ? spec.env.airTemp : spec.env.groundTemp;

  const result = (runs) => {
    const perRunIb = Ib / runs;
    // 3. Protective device: one device protects the parallel set; each run must carry In/runs.
    const In = spec.sizeOn === "device" ? nextDevice(Ib) : null;
    if (spec.sizeOn === "device" && In == null) return null;
    const basisCurrent = (spec.sizeOn === "device" ? In : Ib) / runs;
    const groupCount = Math.max(1, spec.group.count || 1) + runs - 1;

    // Third-harmonic neutral current (4- and 5-core cables only): factor k5, and the neutral current may govern (EIG Fig. G19, p268).
    const hn = spec.system === "3ph" && spec.cores !== "3" && spec.h3 > 0 ? harmonicNeutral(spec.h3, perRunIb) : null;
    const harmonicBasis = hn && hn.basis === "neutral" ? Math.max(basisCurrent, hn.neutralA) : basisCurrent;
    const iaTrip = spec.trip && In ? tripCurrent({ curve: spec.trip.curve, inA: In, mccb: In > 63 || spec.trip.iscKA > 10 }) : null;
    const uo = spec.system === "3ph" ? spec.voltage / Math.sqrt(3) : spec.voltage;

    const cands = rows.map((r) => {
      const { factors, notes } = adapter.factors(spec, r.size, groupCount);
      if (hn && hn.k5 !== 1) factors.push({ key: "kHarm", label: "Third-harmonic neutral current", value: hn.k5,
        basis: `${spec.h3} % third harmonic: ${hn.basis === "neutral" ? "size on neutral current, " : ""}factor ${hn.k5} (EIG Fig. G19)` });
      const k = factors.reduce((p, f) => p * f.value, 1);
      const iz = r.amp * k;
      // Longest circuit the instantaneous trip protects: phase-phase on 3-wire circuits, phase-neutral otherwise,
      // and phase-PE as well in TN systems (the PE is smaller than the phase above 16 mm²).
      let lmax = null;
      if (iaTrip) {
        const kind = spec.system === "3ph" && spec.cores === "3" ? "ll" : "ln";
        lmax = lmaxM({ sph: r.size, material: spec.material, ia: iaTrip, uo, kind, m: 1, runs });
        if (spec.trip.earthing === "TN") {
          const spe = earthConductorSize(r.size, sizes);
          lmax = Math.min(lmax, lmaxM({ sph: r.size, material: spec.material, ia: iaTrip, uo, kind: "ln", m: r.size / spe, runs }));
        }
      }
      const theta = operatingTemp(ambient, thetaMax, perRunIb, iz);
      const vd = voltageDrop({ system: spec.system, current: perRunIb, lengthM: spec.lengthM,
        r: spec.system === "dc" ? r.rdc20 * (1 + 0.004 * (thetaMax - 20)) : r.r, x: r.x, pf: spec.load.pf ?? 1 });
      const vdPct = (vd / spec.voltage) * 100;
      let vdStartPct = null;
      if (spec.motorStart && spec.system !== "dc") {
        const vs = voltageDrop({ system: spec.system, current: (I * spec.motorStart.multiple) / runs,
          lengthM: spec.lengthM, r: r.r, x: r.x, pf: spec.motorStart.pf });
        vdStartPct = (vs / spec.voltage) * 100;
      }
      let scMin = null;
      const kv = kValue(spec.insulation, spec.material, r.size);
      if (spec.fault?.i2t > 0) {
        // Current-limiting device (t < 0.1 s): k²S² ≥ I²t let-through (IEC 60364-4-43 §434.5.2)
        scMin = Math.sqrt(spec.fault.i2t) / kv;
      } else if (spec.fault?.ka > 0) {
        scMin = minSizeShortCircuit(spec.fault.ka, spec.fault.timeS, kv);
      }
      const pass = {
        ampacity: iz >= harmonicBasis - 1e-9,
        voltageDrop: vdPct <= spec.vdLimitPct + 1e-9,
        motorStart: vdStartPct == null || vdStartPct <= spec.vdStartLimitPct + 1e-9,
        // Short-circuit: each parallel run sees the full fault only if the fault is on that run; be conservative.
        shortCircuit: scMin == null || r.size >= scMin - 1e-9,
        ...(lmax != null ? { minFault: spec.lengthM <= lmax + 1e-9 } : {}),
      };
      return { ...r, factors, notes, k, iz, theta, vd, vdPct, vdStartPct, scMin, lmax, iaTrip, pass,
        ok: Object.values(pass).every(Boolean) };
    });
    const chosen = cands.find((c) => c.ok);
    return { runs, In, basisCurrent: harmonicBasis, groupCount, cands, chosen, hn, iaTrip };
  };

  let pick = null;
  let first = null;
  for (let runs = 1; runs <= spec.maxParallel; runs++) {
    const res = result(runs);
    if (!res) continue;
    if (!first) first = res;
    if (res.chosen) { pick = res; break; }
  }
  const view = pick || first;
  if (!pick) {
    warnings.push(`No size up to ${sizes[sizes.length - 1]} mm² passes even with ${spec.maxParallel} parallel runs. ` +
      "Use a higher voltage, a shorter route, a better installation method, or copper.");
  }

  // Which criterion governed: the smallest size passing each criterion alone.
  const governing = {};
  for (const key of ["ampacity", "voltageDrop", "motorStart", "shortCircuit", "minFault"]) {
    const c = view.cands.find((x) => x.pass[key]);
    governing[key] = c ? c.size : null;
  }
  const ch = view.chosen;
  let decidedBy = null;
  if (ch) {
    const labels = { ampacity: "current-carrying capacity", voltageDrop: "voltage drop",
      motorStart: "motor starting voltage dip", shortCircuit: "short-circuit withstand",
      minFault: "far-end fault must trip the breaker" };
    // Criteria that first pass at exactly the chosen size decided it; if the chosen size is the
    // smallest in the table, every criterion passes there and the table minimum decided it.
    decidedBy = view.cands.indexOf(ch) === 0
      ? [rows.length < allRows.length ? `the minimum size rule (${spec.minSizeRule || "your setting"})` : "smallest size in the table"]
      : Object.entries(governing).filter(([, s]) => s === ch.size).map(([k]) => labels[k]);
  }
  if (ch) {
    for (const n of ch.notes) warnings.push(n);
    if (ch.theta > thetaMax - 1) warnings.push("Cable runs close to its maximum temperature at full load.");
    if (spec.system !== "dc" && spec.cores === "1" && spec.armoured)
      warnings.push("Single-core AC cables must have non-magnetic (aluminium) armour, never steel wire/strip — steel heats up from induced currents.");
    if (spec.sizeOn === "device" && spec.load.unit !== "A" && spec.motorStart)
      warnings.push("Motor circuits: choose a motor-rated MCCB/MPCB or fuse + overload relay; the device rating shown is the minimum for the cable.");
    if (view.hn?.neutralFull && spec.cores === "3.5")
      warnings.push(`With ${spec.h3} % third harmonic the neutral must be full size: use a 4-core cable, not 3½-core (EIG p266).`);
    else if (view.hn?.neutralFull)
      warnings.push(`Third harmonics (${spec.h3} %) load the neutral up to ${(view.hn.neutralRatio * 100).toFixed(0)} % of the phase current: the neutral is full size and the cable is derated by ${view.hn.k5}.`);
  }

  const earth = ch ? earthConductorSize(ch.size, sizes) : null;
  return {
    spec, adapter: adapter.title,
    current: { I, Ib, In: view.In, basis: view.basisCurrent * view.runs, sizeOn: spec.sizeOn },
    runs: view.runs, groupCount: view.groupCount,
    chosen: ch, candidates: view.cands, governing, decidedBy, harmonic: view.hn, iaTrip: view.iaTrip,
    earthSize: earth, warnings, steps, ok: !!pick,
  };
}

/** Human description of the cable to buy. */
export function cableDescription(res, voltageGrade) {
  const s = res.spec, c = res.chosen;
  if (!c) return null;
  if (s.cores === "1" && ["A1", "B1"].includes(s.method)) {
    const wires = s.system === "3ph" ? "3 phase + 1 neutral" : "1 phase + 1 neutral";
    return `${res.runs > 1 ? res.runs + " sets of " : ""}${c.size} mm² ${s.material === "cu" ? "copper" : "aluminium"} single-core ${s.insulation} insulated wire, 450/750 V (${wires}) in conduit, plus a ${res.earthSize} mm² green-yellow earth wire`;
  }
  const cores = s.cores === "1" ? "Single-core" : `${s.cores}-core`;
  const mat = s.material === "cu" ? "copper" : "aluminium";
  const ins = s.insulation === "HRPVC" ? "HR-PVC" : s.insulation;
  const runs = res.runs > 1 ? `${res.runs} runs in parallel of ` : "";
  const hv = s.voltage > 1100;
  const sets = s.cores === "1" ? (hv ? " — 3 cables per circuit, laid in trefoil" : s.system === "3ph" ? " (3 cables per run, plus a neutral if needed)" : " (2 cables per run)") : "";
  const armTxt = s.armoured ? (s.cores === "1" ? "aluminium-wire armoured" : "armoured") : "unarmoured";
  return `${runs}${cores} ${c.size} mm² ${mat}, ${ins} insulated, ${armTxt}, ${voltageGrade}${sets}`;
}
