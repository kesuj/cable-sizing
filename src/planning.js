// Planning helpers beyond a single cable: building demand (ku, ks), power factor correction, solar strings.
// Rules follow the Schneider Electric Electrical Installation Guide 2018 (chapters A, L, P). Pure functions, tested in tests/planning.test.js.

const SQRT3 = Math.sqrt(3);

// ---------------------------------------------------------------- demand (EIG chapter A, section 4)
/** ku (utilisation) and default power factor per load type. Lighting, heating, air conditioning and EV: ku 1 (EIG p26, p28);
 *  industrial motors 0.75 on average (p26); socket outlets 0.1 to 0.2, the upper value is used (p28). Power factors:
 *  motors 0.8 in service and LED or electronic lighting 0.9 (EIG p246); the others are typical and editable by overriding the load. */
export const LOAD_TYPES = {
  lighting: { ku: 1, pf: 0.9, en: "Lighting", ne: "बत्ती" },
  sockets: { ku: 0.2, pf: 0.9, en: "Sockets and small appliances", ne: "सकेट र साना उपकरण" },
  heating: { ku: 1, pf: 1, en: "Heater, geyser, induction cooker", ne: "हिटर, गिजर, इन्डक्सन" },
  ac: { ku: 1, pf: 0.85, en: "Air conditioner", ne: "एयर कन्डिसनर" },
  motor: { ku: 0.75, pf: 0.8, en: "Motor or pump", ne: "मोटर वा पम्प" },
  ev: { ku: 1, pf: 1, en: "EV charger", ne: "EV चार्जर" },
};

/** Diversity ks for the circuits fed from one board (IEC 61439-2 assumed loading, EIG p28):
 *  1 circuit 1.0, 2-3: 0.9, 4-5: 0.8, 6-9: 0.7, 10 or more: 0.6. Mainly lighting: values near 1. */
export function diversityKs(circuits, lightingShare = 0) {
  if (lightingShare >= 0.8) return 1;
  if (circuits <= 1) return 1;
  if (circuits <= 3) return 0.9;
  if (circuits <= 5) return 0.8;
  if (circuits <= 9) return 0.7;
  return 0.6;
}

/** Standard transformer ratings: 50, 100, 200 kVA are the sizes NEA mostly uses; the rest follow EIG Fig. A16. */
export const TRANSFORMERS_KVA = [50, 100, 200, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];

/** rows: [{ type, qty, kw }] with kw per unit. Returns the demand, the main-cable current and a transformer suggestion. */
export function demandCalc({ rows, ksOverride = null, growthPct = 25, voltage = 400 }) {
  const detail = rows
    .filter((r) => r.qty > 0 && r.kw > 0)
    .map((r) => {
      const t = LOAD_TYPES[r.type] || LOAD_TYPES.sockets;
      const kva = (r.qty * r.kw) / t.pf;
      return { ...r, ku: t.ku, pf: t.pf, installedKW: r.qty * r.kw, installedKVA: kva, afterKuKVA: kva * t.ku };
    });
  const installedKW = detail.reduce((s, r) => s + r.installedKW, 0);
  const installedKVA = detail.reduce((s, r) => s + r.installedKVA, 0);
  const afterKu = detail.reduce((s, r) => s + r.afterKuKVA, 0);
  const lightingShare = afterKu > 0 ? detail.filter((r) => r.type === "lighting").reduce((s, r) => s + r.afterKuKVA, 0) / afterKu : 0;
  const ksAuto = diversityKs(detail.length, lightingShare);
  const ks = ksOverride != null && ksOverride > 0 ? ksOverride : ksAuto;
  const afterKs = afterKu * ks;
  const requiredKVA = afterKs * (1 + growthPct / 100);
  const currentA = (requiredKVA * 1000) / (SQRT3 * voltage);
  const transformer = TRANSFORMERS_KVA.find((k) => k >= requiredKVA) ?? null;
  return { rows: detail, installedKW, installedKVA, afterKu, ks, ksAuto, afterKs, requiredKVA, currentA, transformer,
    transformerFlcA: transformer ? (transformer * 1000) / (SQRT3 * voltage) : null,
    // EIG p42 and p30: about 100 kVA is a large consumer; MV connection is usually considered above roughly 250 kVA.
    largeConsumer: requiredKVA >= 100, mvLikely: requiredKVA > 250 };
}

// ---------------------------------------------------------------- power factor correction (EIG chapter L)
/** Qc = P (tan φ1 − tan φ2) (EIG p388). Capacitor current IN = Q / (√3 U); breaker long-time 1.5 × IN for plain capacitors,
 *  1.31 × IN with a 5.7 % detuned reactor, short-time 10 × IN (EIG p406-407). nll = share of non-linear load in the transformer kVA, %. */
export function pfCorrection({ kw, pf1, pf2, kv = 0.4, nllPct = 0, individualMotor = false, ioA = null }) {
  const tan = (pf) => Math.tan(Math.acos(pf));
  const qc = Math.max(0, kw * (tan(pf1) - tan(pf2)));
  const inA = qc / (SQRT3 * kv);
  const bank = nllPct <= 10 ? "standard" : nllPct <= 20 ? "heavy-duty" : "detuned";
  const i1 = kw / (SQRT3 * kv * pf1), i2 = kw / (SQRT3 * kv * pf2);
  return {
    qc, inA, bank, i1, i2, currentCutPct: (1 - i2 / i1) * 100, lossCutPct: (1 - (i2 / i1) ** 2) * 100,
    longA: (bank === "detuned" ? 1.31 : 1.5) * inA, shortA: 10 * inA,
    // Motor at its terminals: about 25 % of kW (EIG p392-394); never above 0.9 × Io × U × √3 (self-excitation, EIG p399-400).
    motorSuggestKvar: individualMotor ? 0.25 * kw : null,
    motorMaxKvar: individualMotor && ioA ? 0.9 * ioA * kv * SQRT3 : null,
    overloadReduce: pf1 / pf2,   // set the motor overload relay lower by cos φ before / cos φ after (EIG p399)
  };
}

// ---------------------------------------------------------------- solar strings (EIG chapter P, p516-518)
/** Voltage rules: modules × Voc at the lowest temperature must stay below the inverter maximum; modules × Vmpp at the highest cell
 *  temperature must stay above the inverter MPPT minimum; the parallel strings' Isc must stay below the inverter maximum input current.
 *  coefPct: temperature coefficient of Voc in %/°C (negative). The same coefficient is applied to Vmpp, which is slightly optimistic. */
export function pvStrings({ voc, vmpp, isc, coefPct = -0.28, tMin, tCellMax, vInvMax, vMpptMin, iInvMax, strings = 1, irm = null,
  moduleW = null, inverterKW = null, nModules = null }) {
  const c = coefPct / 100;
  const vocCold = voc * (1 + c * (tMin - 25));
  const vmppHot = vmpp * (1 + c * (tCellMax - 25));
  const nMax = Math.floor(vInvMax / vocCold);
  const nMin = Math.ceil(vMpptMin / vmppHot);
  const n = nModules ?? nMax;
  const maxStrings = Math.floor(iInvMax / isc);
  // String protection (EIG p510): needed when 1.35 × IRM < (Ns − 1) × Isc. Without IRM, more than two strings in parallel need it.
  const protect = irm ? 1.35 * irm < (strings - 1) * isc : strings > 2;
  const arrayKW = moduleW ? (n * strings * moduleW) / 1000 : null;
  return {
    vocCold, vmppHot, nMin, nMax, feasible: nMin <= nMax, n, maxStrings, stringsOk: strings <= maxStrings,
    stringVocColdV: n * vocCold, stringVmppHotV: n * vmppHot, stringVmppV: n * vmpp,
    protect, fuseMinA: 1.5 * isc, fuseMaxA: 2.4 * isc,
    doubleInsulation: n * vocCold > 120,          // above 120 V DC (EIG p506)
    arrayKW, inverterRatio: arrayKW && inverterKW ? inverterKW / arrayKW : null,   // 0.8 to 1.0 in European practice (EIG p518)
  };
}
