// Protection and earthing rules: TT earth check, minimum short-circuit (maximum protected length),
// third-harmonic neutral sizing, disconnection times, SPD selection, pre-energising tests.
// Method and numbers follow the Schneider Electric Electrical Installation Guide 2018 (chapters F, G, J),
// which follows IEC 60364-4-41, -5-52, -5-53 and IEC 60898 / 60947-2. Pure functions, tested in tests/protection.test.js.

/** Resistivity at short-circuit temperature, ohm·mm²/m (EIG p257 for copper; aluminium from R = 37.6 vs 23.7, p246). */
export const RHO = { cu: 0.023, al: 0.037 };

export const RCD_SENSITIVITIES_MA = [30, 100, 300, 500];

/** TT system: the earth electrode must satisfy RA × IΔn ≤ 50 V (EIG F4, p178). 25 V in worksites and agricultural premises. */
export function ttCheck(raOhm, limitV = 50) {
  const rows = RCD_SENSITIVITIES_MA.map((ma) => ({ ma, maxRa: Math.floor(limitV / (ma / 1000)), ok: raOhm <= limitV / (ma / 1000) }));
  const allowed = rows.filter((r) => r.ok).map((r) => r.ma);
  // Main RCD: the least sensitive type that is still allowed (fewest nuisance trips); 30 mA is always kept for sockets and wet areas.
  const main = [300, 100, 30].find((ma) => allowed.includes(ma)) ?? null;
  return { raOhm, limitV, maxIdnMA: (limitV / raOhm) * 1000, rows, main, ok: allowed.length > 0, only30: allowed.length === 1 && allowed[0] === 30 };
}

/** Maximum disconnection time (s) for final circuits (≤ 63 A with sockets, ≤ 32 A fixed) and distribution circuits (EIG Fig. F7, p175). */
export function disconnectTime({ system, uo = 230, distribution = false }) {
  const tt = system === "TT";
  if (distribution) return tt ? 1 : 5;
  if (uo <= 120) return tt ? 0.3 : 0.8;
  if (uo <= 230) return tt ? 0.2 : 0.4;
  if (uo <= 400) return tt ? 0.07 : 0.2;
  return tt ? 0.04 : 0.1;
}

/** Longest circuit (m) whose far-end fault still reaches the magnetic trip current Ia (EIG G5.1, p257):
 *  Lmax = 0.8·U·S / (ρ·(1+m)·Ia), with 80 % of the voltage available during the fault ("conventional method").
 *  kind "ln": phase to neutral or phase to PE, U = Uo, m = S_phase / S_return.
 *  kind "ll": phase to phase (3-wire circuits), U = √3·Uo. runs = identical cables in parallel per phase. */
export function lmaxM({ sph, material, ia, uo = 230, kind = "ln", m = 1, runs = 1 }) {
  const volts = kind === "ll" ? Math.sqrt(3) * uo : uo;
  return (0.8 * volts * sph * runs) / (RHO[material] * (1 + m) * ia);
}

/** Current at which the breaker is certain to trip instantly. MCB (IEC 60898) upper limits: B 5, C 10, D 20 × In.
 *  MCCB (IEC 60947-2): magnetic setting up to 10 × In with ±20 % tolerance, so 12 × In (EIG p257). */
export function tripCurrent({ curve = "C", inA, mccb = false }) {
  return mccb ? 12 * inA : { B: 5, C: 10, D: 20 }[curve] * inA;
}

/** Third-harmonic neutral rule for 4- and 5-core cables (EIG Fig. G19, p239): which current sizes the cable and the factor k5.
 *  Neutral current = 3 × h3 × phase current (EIG p268). Above 15 % the neutral must be full size (4-core, not 3½-core). */
export function harmonicNeutral(h3Pct, phaseA = 0) {
  const h3 = Math.max(0, h3Pct || 0);
  const ratio = Math.min(3, (3 * h3) / 100);
  if (h3 <= 15) return { basis: "phase", k5: 1, neutralRatio: ratio, neutralFull: false, neutralA: ratio * phaseA };
  if (h3 <= 33) return { basis: "phase", k5: 0.86, neutralRatio: ratio, neutralFull: true, neutralA: ratio * phaseA };
  if (h3 <= 45) return { basis: "neutral", k5: 0.86, neutralRatio: ratio, neutralFull: true, neutralA: ratio * phaseA };
  return { basis: "neutral", k5: 1, neutralRatio: ratio, neutralFull: true, neutralA: ratio * phaseA };
}

/** MCB curve by load: B for heating and lighting (no inrush), D for large direct-on-line motors, C otherwise (CPWD Table 4, EIG chapter H). */
export function mcbCurve({ kind, kW = 0, starter = "dol" }) {
  if (kind === "resistive") return "B";
  if (kind === "motor" && kW > 3.7 && starter === "dol") return "D";
  return "C";
}

/** Surge protective device selection at the main board (EIG chapter J, pp 322-335). */
export const SPD_IMAX_KA = { low: 20, medium: 40, high: 65 };
export function spdSpec({ exposure = "medium", lightningRod = false, uo = 230 }) {
  const imax = SPD_IMAX_KA[exposure] ?? 40;
  return {
    type: lightningRod ? "Type 1+2" : "Type 2",
    ucMinV: Math.ceil((uo * 11) / 10),      // Uc ≥ 1.1·Uo in TN and TT; catalogue values 260, 320, 340, 350 V
    upKV: 2.5, inKA: 5, imaxKA: imax, iimpKA: lightningRod ? 12.5 : null,
    leadMaxCm: 50, leadMinMm2: lightningRod ? 16 : 4,
    secondSpdBeyondM: 10,                   // reflection: a second SPD near the load if the cable is longer than 10 m
  };
}

/** Tests before switching on (IEC 60364-6 initial verification, EIG chapter A p15-16 and F). */
export const PRE_ENERGISE = [
  { en: "Continuity of every earth and bonding wire: low reading with a continuity tester.", ne: "हरेक अर्थ र बन्डिङ तारको निरन्तरता: कन्टिन्युइटी टेस्टरमा कम रिडिङ आउनुपर्छ।" },
  { en: "Insulation resistance with a 500 V tester, between live wires and earth: at least 1 MΩ (new cable is usually hundreds of MΩ).", ne: "५०० V टेस्टरले लाइभ तार र अर्थबीच इन्सुलेसन रेजिस्टेन्स: कम्तीमा १ MΩ (नयाँ तारमा प्रायः सयौं MΩ)।" },
  { en: "Polarity: phase wire goes through the breaker and switch, neutral is where it should be. Phase order correct on three-phase motors.", ne: "पोलारिटी: फेज तार ब्रेकर र स्विचबाट जानुपर्छ, न्युट्रल ठीक ठाउँमा। थ्री फेज मोटरमा फेजको क्रम ठीक।" },
  { en: "Earth electrode resistance with an earth tester (not a multimeter), with the link open; compare with the maximum allowed above.", ne: "अर्थ टेस्टरले (मल्टिमिटरले होइन) लिंक खोलेर अर्थ इलेक्ट्रोडको रेजिस्टेन्स नाप्नुहोस्; माथिको अधिकतम मानसँग तुलना गर्नुहोस्।" },
  { en: "RCD: press the test button; with an RCD tester check it trips within 0.3 s at its rated current.", ne: "RCD: टेस्ट बटन थिच्नुहोस्; RCD टेस्टरले रेटेड करेन्टमा ०.३ s भित्र ट्रिप हुन्छ कि जाँच्नुहोस्।" },
  { en: "TN systems: measure the fault loop impedance and check it against the longest-circuit figure above.", ne: "TN प्रणाली: फल्ट लुप इम्पिडेन्स नापेर माथिको अधिकतम लम्बाइसँग जाँच्नुहोस्।" },
  { en: "Switch on and measure the voltage at the far end under load; compare with the calculated voltage above.", ne: "चालु गरेर भारमा टाढाको छेउको भोल्टेज नाप्नुहोस्; माथिको हिसाबसँग तुलना गर्नुहोस्।" },
  { en: "Write down every reading (date, who, instrument): this is the initial report and the baseline for later checks.", ne: "सबै रिडिङ लेख्नुहोस् (मिति, कसले, कुन उपकरण): यही प्रारम्भिक रिपोर्ट हो र पछिको जाँचको आधार हुन्छ।" },
];
