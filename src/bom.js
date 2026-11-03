// Bill of materials: what to buy besides the cable, with ratings. Pure functions; tested in tests/bom.test.js.
// Every rule names its source (research/bom_rules.json): SP 30 = National Electrical Code of India 2011,
// CPWD = CPWD General Specifications for Electrical Works (Internal) 2023, IS 3043, IS 1255, Siemens / ABB / CMP catalogues.
// Ratings on the same line marked "typical" are common practice, not a code value.

const B = (en, ne) => ({ en, ne });

/** MCB / MCCB / RCCB rating series (catalogue steps; MCB range 0.5–63 A per Havells). */
const MCB = [6, 10, 16, 20, 25, 32, 40, 50, 63];
const MCCB_FRAMES = [100, 125, 160, 250, 400, 630, 800, 1000, 1250, 1600];
const RCCB = [25, 40, 63, 80, 100, 125];
const CT = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 400, 600];
const HDPE_OD = [32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200];
const next = (arr, v) => arr.find((x) => x >= v - 1e-9) ?? null;

/** Glands: CMP T3CDS (armoured) / A2F (unarmoured) — size whose seal range brackets the cable OD. */
const GLANDS = [["20S16", 6.1, 13.1, 3.2, 8.7], ["20S", 9.5, 15.9, 6.1, 11.7], ["20", 12.5, 20.9, 6.5, 14.0], ["25", 18.2, 26.2, 11.1, 20.0],
  ["32", 23.7, 33.9, 17.0, 26.3], ["40", 27.9, 40.4, 23.5, 32.2], ["50S", 35.2, 46.7, 31.0, 38.2], ["50", 40.4, 53.0, 35.6, 44.0],
  ["63S", 45.6, 59.4, 41.5, 49.9], ["63", 54.6, 65.8, 47.2, 55.9], ["75S", 59.0, 72.0, 54.0, 61.9], ["75", 66.7, 78.4, 61.1, 67.9], ["90", 76.2, 90.3, 66.6, 79.9]];
export function glandFor(od, armoured) {
  const fits = GLANDS.filter(([, a0, a1, u0, u1]) => (armoured ? od >= a0 && od <= a1 : od >= u0 && od <= u1));
  if (!fits.length) return null;
  // overlapping ranges: pick the one whose range centre is closest to the OD (CMP note)
  return fits.sort((x, y) => Math.abs(od - (armoured ? (x[1] + x[2]) / 2 : (x[3] + x[4]) / 2)) - Math.abs(od - (armoured ? (y[1] + y[2]) / 2 : (y[3] + y[4]) / 2)))[0][0];
}

/** PVC conduit: SP 30 Part 1/Sec 20 Table 4 — max single-core 1.1 kV cables per conduit (16, 20, 25, 32, 40, 50 mm). */
const CONDUIT_MM = [16, 20, 25, 32, 40, 50];
const CONDUIT = { 1: [5, 7, 13, 20, null, null], 1.5: [4, 6, 10, 14, null, null], 2.5: [3, 5, 10, 14, null, null], 4: [2, 3, 6, 10, 14, null],
  6: [null, 2, 5, 9, 11, null], 10: [null, null, 4, 7, 9, null], 16: [null, null, 2, 4, 5, 12], 25: [null, null, null, 2, 2, 6],
  35: [null, null, null, null, 2, 5], 50: [null, null, null, null, 2, 5] };
export function conduitFor(size, wires) {
  const row = CONDUIT[size];
  if (!row) return null;
  const i = row.findIndex((m) => m != null && m >= wires);
  return i === -1 ? null : CONDUIT_MM[i];
}

/** Siemens Raja DOL table (415 V): kW → overload range, back-up HRC fuse. */
const DOL = [[0.25, "0.63–1", 2], [0.55, "1–1.6", 6], [0.75, "1.6–2.5", 6], [1.1, "2–3.2", 10], [1.5, "3.2–5", 16], [2.2, "4–6.3", 16],
  [3.7, "6.3–10", 16], [5.5, "8–12.5", 25], [7.5, "12.5–20", 32]];
/** Overload ranges (A) used to pick a relay for a given set current. */
const OLR = [[0.63, 1], [1, 1.6], [1.6, 2.5], [2, 3.2], [3.2, 5], [4, 6.3], [6.3, 10], [8, 12.5], [10, 16], [12.5, 20], [16, 25], [20, 32], [32, 40], [36, 45], [40, 57], [57, 70], [70, 90], [90, 120]];
const olrFor = (I) => { const r = OLR.find(([a, b]) => I >= a && I <= b); return r ? `${r[0]}–${r[1]} A` : null; };

/** SP 30 Annex F Table 5: capacitor kVAR at motor terminals by kW (3000 / 1500 rpm). */
const CAP_KW = [2.25, 3.7, 5.7, 7.5, 11.2, 15, 18.7, 22.5, 37, 57, 75, 102, 150, 187];
const CAP = { 3000: [1, 2, 2.5, 3, 4, 5, 6, 7, 11, 16, 21, 31, 40, 46], 1500: [1, 2, 3, 4, 5, 6, 7, 8, 12.5, 17, 23, 33, 42, 50] };
export function capacitorFor(kW, rpm = 3000) {
  if (kW < 2.25) return null;
  let i = CAP_KW.findIndex((k) => k >= kW - 0.05); if (i === -1) i = CAP_KW.length - 1;
  return CAP[rpm][i];
}

/** ABB CEF-S HV fuse for distribution transformers (11 kV row; 30 kV row used for 33 kV). */
const HVF_KVA = [25, 50, 75, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];
const HVF_11 = [10, 10, 16, 20, 20, 25, 40, 40, 40, 50];
const HVF_33 = [6.3, 6.3, 6.3, 6.3, 6.3, 10, 16, 16, 20, 40, 40, 40, 40, 40, 40, 50, 63, 63];
export function hvFuseFor(kva, kv) {
  const i = HVF_KVA.findIndex((k) => k >= kva);
  if (i === -1) return null;
  return kv <= 11 ? HVF_11[i] ?? null : HVF_33[i] ?? null;
}

/** Transformer LV terminal fault (infinite source, z = 4.5 % up to 630 kVA per IS 1180): Isc = S / (√3 · 400 · z). */
export const lvFaultKA = (kva, z = 0.045) => kva / (Math.sqrt(3) * 0.4 * z) / 1000;

/**
 * Build the BOM. ctx: { kind, job answers (S), route, res (sizeConductor result), od, phases, std }
 * Returns [{ item:{en,ne}, spec, qty, why:{en,ne} }]
 */
export function bomFor(ctx) {
  const { res, kind, S, route } = ctx;
  const s = res.spec, c = res.chosen;
  if (!c) return [];
  const out = [];
  const add = (item, spec, qty, why) => out.push({ item, spec, qty, why });
  const In = res.current.In;
  const sys = s.system;
  const nCond = s.cores === "1" ? (sys === "3ph" ? (kind === "motor" ? 3 : 4) : 2) * res.runs : Number(s.cores === "3.5" ? 4 : s.cores) * res.runs;
  const ends = 2;
  const isMotor = kind === "motor";
  const wiresInConduit = ["A1", "B1"].includes(s.method);

  // --- protection -------------------------------------------------------------------------------
  const poles = sys === "1ph" ? "DP" : isMotor ? "TP" : "TPN";
  // Prospective fault at the board (transformer terminals, infinite source): MCBs reach 10 kA (catalogue), so above that an MCCB is needed.
  const isc = ctx.isc ?? 6;
  const icu = [18, 25, 36, 50, 70].find((k) => k >= isc) ?? 70; // ABB XT1 Icu ladder at 415 V
  if (In <= 63 && isc > 10) {
    add(B("Moulded case circuit breaker (MCCB)", "MCCB (मोल्डेड केस सर्किट ब्रेकर)"), `rated ${In} A, ${sys === "1ph" ? "2P" : poles === "TP" ? "3P" : "4P"}, IEC 60947-2, Icu ≥ ${icu} kA`, 1,
      B(`The fault here can reach ${isc.toFixed(1)} kA, above the 10 kA of a miniature breaker, so a moulded-case breaker is fitted (breaking capacity must exceed the fault level, SP 30).`,
        `यहाँ फल्ट ${isc.toFixed(1)} kA सम्म पुग्न सक्छ, जुन MCB को १० kA भन्दा बढी हो; त्यसैले MCCB राख्नुहोस्।`));
  } else if (In <= 63) {
    const curve = kind === "resistive" ? "B" : isMotor && (ctx.kW ?? 0) > 3.7 && ctx.starter === "dol" ? "D" : "C";
    add(B("Miniature circuit breaker (MCB)", "MCB (मिनिएचर सर्किट ब्रेकर)"), `${In} A ${poles}, ${curve}-curve, IS/IEC 60898-1, Icn ≥ ${isc <= 6 ? 6 : 10} kA`, 1,
      B(`Protects the cable: ${In} A ≤ cable rating. Curve ${curve}: ${curve === "B" ? "3–5 × In trip, heaters/lights" : curve === "C" ? "5–10 × In, motors/compressors/general" : "10–20 × In, heavy starting"} (CPWD Table 4). Breaking capacity must exceed the fault level where it is fitted (SP 30).`,
        `तार जोगाउँछ। ${curve}-कर्भ: ${curve === "B" ? "हिटर/बत्ती" : curve === "C" ? "मोटर/कम्प्रेसर/सामान्य" : "धेरै सुरु करेन्ट"}। फल्ट लेभलभन्दा बढी ब्रेकिङ क्षमता चाहिन्छ।`));
  } else {
    const frame = next(MCCB_FRAMES, In);
    add(B("Moulded case circuit breaker (MCCB)", "MCCB (मोल्डेड केस सर्किट ब्रेकर)"), `${frame} A frame, set ${In} A, ${sys === "1ph" ? "2P" : poles === "TP" ? "3P" : "4P"}, IEC 60947-2, Icu ≥ ${icu} kA`, 1,
      B("Above 63 A an MCB is not available; an MCCB with thermal setting at the cable's breaker rating protects it (IEC 60947-2: trips at 1.30 × In).", "६३ A भन्दा माथि MCB हुँदैन; MCCB लाई तारको रेटिङमा सेट गर्नुहोस्।"));
  }

  if (isMotor) {
    const flc = res.current.I;
    const kW = ctx.kW ?? null;
    const sd = ctx.starter === "sd";
    if (sys === "3ph") {
      if (sd) {
        add(B("Star-delta starter", "स्टार-डेल्टा स्टार्टर"), `for ${kW ? kW.toFixed(1) + " kW" : flc.toFixed(1) + " A"}: line & delta contactors AC-3 ≥ ${(0.58 * flc).toFixed(1)} A, star ≥ ${(0.33 * flc).toFixed(1)} A; overload ${olrFor(0.58 * flc) || "range incl. " + (0.58 * flc).toFixed(1) + " A"} set at ${(0.58 * flc).toFixed(1)} A`, 1,
          B("Overload relay sits in the delta loop, so it is set at 0.58 × full-load current (Siemens FASD). Needs two 3-core cables starter → motor.", "ओभरलोड रिले ०.५८ × पूरा-भार करेन्टमा सेट; स्टार्टरदेखि मोटरसम्म दुई ३-कोर तार।"));
      } else {
        add(B("DOL starter (contactor + overload relay)", "DOL स्टार्टर (कन्ट्याक्टर + ओभरलोड रिले)"), `contactor AC-3 ≥ ${flc.toFixed(1)} A; overload relay ${olrFor(flc) || "range incl. " + flc.toFixed(1) + " A"}, set at ${flc.toFixed(1)} A`, 1,
          B(`The overload relay protects the motor; set it at the nameplate current. Siemens recommends DOL for submersibles up to 5.5 kW / 7.5 HP${kW && kW > 5.5 ? " — this motor is larger: use star-delta, soft starter or VFD" : ""}.`,
            `ओभरलोड रिलेले मोटर जोगाउँछ; नेमप्लेट करेन्टमा सेट गर्नुहोस्।${kW && kW > 5.5 ? " यो मोटर ठूलो छ: स्टार-डेल्टा वा सफ्ट स्टार्टर प्रयोग गर्नुहोस्।" : ""}`));
      }
      const dolRow = kW ? DOL.find(([k]) => k >= kW - 0.05) : null;
      if (dolRow && !sd) add(B("Back-up HRC fuse (aM, motor)", "ब्याक-अप HRC फ्यूज (aM, मोटर)"), `${dolRow[2]} A aM × 3`, 3, B("Short-circuit back-up for the starter (Siemens DOL table, 415 V). aM fuses must be used with an overload relay (Mersen).", "स्टार्टरका लागि सर्ट-सर्किट ब्याक-अप।"));
      add(B("Phase-failure (single-phasing) relay", "फेज फेल्योर रिले"), "3-phase line monitoring relay", 1, B("A missing phase burns a running motor within minutes; Nepal supply loses phases often (practice).", "एउटा फेज गयो भने मोटर केही मिनेटमै जल्छ।"));
      const kvar = kW ? capacitorFor(kW, 3000) : null;
      if (kvar) add(B("Power-factor capacitor at the motor", "मोटरमा पावर फ्याक्टर क्यापासिटर"), `${kvar} kVAR, 415 V, 3-phase`, 1,
        B("SP 30 Annex F Table 5 (2-pole, 3000 rpm). Never larger than the motor's magnetising current — it can self-excite the motor.", "SP 30 तालिका अनुसार; मोटरको म्याग्नेटाइजिङ करेन्टभन्दा ठूलो नराख्नुहोस्।"));
    } else {
      add(B("Single-phase pump starter / control panel", "सिङ्गल फेज पम्प स्टार्टर / प्यानल"), `with overload set at ${flc.toFixed(1)} A and the motor's start/run capacitors`, 1, B("Protects the motor; the MCB protects the cable.", "मोटर जोगाउँछ; MCB ले तार जोगाउँछ।"));
    }
    if (ctx.pumpType === "sub") add(B("Dry-run protector", "ड्राइ-रन प्रोटेक्टर"), "underload / water-level relay", 1, B("A submersible pump running without water fails quickly (practice; separate from the overload relay).", "पानी बिना चलेको पम्प छिटो बिग्रिन्छ।"));
  }

  // --- residual current device --------------------------------------------------------------------
  const rccbA = next(RCCB, In) ?? In;
  if (kind === "ev") add(B("RCD for the charger", "चार्जरका लागि RCD"), `${rccbA} A ${poles === "DP" ? "2P" : "4P"}, 30 mA Type B (or Type A + 6 mA DC detection in the charger)`, 1,
    B("EV chargers can leak smooth DC current that blinds an ordinary Type AC/A RCD (IEC 60364-7-722).", "EV चार्जरले DC चुहावट गर्न सक्छ; Type B चाहिन्छ।"));
  else if (kind === "main") {
    add(B("RCCB at the main board", "मुख्य बोर्डमा RCCB"), `${rccbA} A ${poles === "DP" ? "2P" : "4P"}, 100 mA (S-type if an SPD is fitted after it), plus 30 mA RCBOs/RCCB for socket and bathroom circuits`, 1,
      B("30 mA for shock protection on sockets and bathrooms; 100–300 mA for the whole installation (CPWD / SP 30). Indian RCCBs go up to 125 A.", "सकेट र बाथरुममा ३० mA; पूरै घरका लागि १००–३०० mA।"));
    add(B("Main isolating switch", "मुख्य आइसोलेटिङ स्विच"), `${next([32, 40, 63, 80, 100, 125, 160, 200, 250, 315, 400, 630], In)} A ${poles}, AC-22 (IEC 60947-3)`, 1,
      B("Nepal Electricity Rules 2050, Rule 59: the consumer must have an isolating switch near the meter. AC-22 switches mixed loads.", "विद्युत नियमावली २०५०, नियम ५९: मिटर नजिक आइसोलेटिङ स्विच अनिवार्य।"));
    add(B("Surge protective device (SPD)", "सर्ज प्रोटेक्टर (SPD)"), "Type 2, Uc 275 V, In 20 kA / Imax 40 kA, Up ≤ 1.5 kV, back-up fuse ≤ 125 A gG", sys === "1ph" ? 2 : 4,
      B("SP 30 requires an SPD in main boards; Nepal has frequent lightning (Rule 56). One pole per live conductor plus N–PE.", "बिजुली चम्किने भएकाले मुख्य बोर्डमा SPD राख्नुहोस्।"));
    add(B("Changeover switch (only if you have a generator)", "चेन्जओभर स्विच (जेनेरेटर भए मात्र)"), `${next([32, 63, 100, 125, 200, 250, 400, 630], In)} A ${poles === "DP" ? "2P" : "4P"}`, 1,
      B("Nepal Electricity Rules 2050, Rule 57: a generator must connect through a changeover switch so it can never feed back into the NEA line.", "नियम ५७: जेनेरेटर चेन्जओभर स्विचबाट मात्र जोड्नुहोस्।"));
    add(B("Distribution board", "डिस्ट्रिब्युसन बोर्ड"), `${sys === "1ph" ? "single-phase" : "TPN"} DB with spare ways, IP42 indoor / IP54 outdoor`, 1, B("Only MCB/MCCB boards — no rewirable fuses (CPWD 3.3.2). Leave spare ways for growth.", "MCB बोर्ड मात्र; भविष्यका लागि खाली ठाउँ राख्नुहोस्।"));
  } else add(B("RCD (RCCB or RCBO)", "RCD (RCCB वा RCBO)"), `${rccbA} A ${poles === "DP" ? "2P" : "4P"}, 30 mA, Type A`, 1,
    B("Water, metal bodies and outdoor equipment make shock likely; 30 mA disconnects before a dangerous current (SP 30).", "पानी र धातुले करेन्ट लाग्ने सम्भावना बढाउँछ; ३० mA चाहिन्छ।"));

  // --- terminations ---------------------------------------------------------------------------------
  const mat = s.material === "cu" ? "copper" : "aluminium";
  add(B("Cable lugs (crimp)", "केबल लग (क्रिम्प)"), `${c.size} mm² ${mat}${s.material === "al" ? " — bimetallic Al-Cu where landing on copper terminals" : ""}; hole to match the terminal stud`, nCond * ends,
    B("Lug barrel = conductor size, same metal; bimetallic between aluminium and copper (IS 8309 / IS 8394). Choose the hole to fit the breaker/busbar stud.", "लग तारकै साइज र धातुको; एल्युमिनियम-तामा बीच बाइमेटालिक।"));
  if (!wiresInConduit && ctx.od) {
    const g = glandFor(ctx.od, s.armoured);
    if (g) add(B(s.armoured ? "Cable glands, double compression" : "Cable glands", "केबल ग्ल्यान्ड"), `size ${g} (cable OD ≈ ${ctx.od} mm), brass, ${s.armoured ? "armoured (BS 6121 type)" : "unarmoured"}`, ends * res.runs,
      B("One at each end. Size from the cable's outer diameter (CMP chart); measure your actual cable — ODs differ between makers.", "दुवै छेउमा एउटा। तारको बाहिरी व्यास नापेर साइज मिलाउनुहोस्।"));
  }

  // --- containment -------------------------------------------------------------------------------
  const runM = Math.ceil(s.lengthM * 1.1);
  if (wiresInConduit) {
    const wires = (sys === "3ph" ? 4 : 2) + 1; // phases + N + PE
    const d = conduitFor(c.size, wires);
    add(B("PVC conduit", "PVC कन्ड्युट पाइप"), d ? `${d} mm rigid PVC (holds ${wires} × ${c.size} mm² wires)` : `split into two conduits — ${wires} × ${c.size} mm² do not fit one`, `${Math.ceil(runM / 3)} × 3 m`,
      B("SP 30 Table 4 limits wires per conduit so the space factor stays ≤ 40 % (IS 732) and the wires stay cool.", "एउटा पाइपमा बढी तार राख्दा तातिन्छ; SP 30 तालिका अनुसार।"));
    add(B("Earth wire (green-yellow)", "अर्थ तार (हरियो-पहेँलो)"), `${res.earthSize} mm² ${mat}`, `${runM} m`, B("Runs with the circuit to every metal body (IEC 60364-5-54 Table 54.2).", "हरेक धातुको बडीसम्म अर्थ तार।"));
  }
  if (route === "duct" && ctx.od) {
    const d = next(HDPE_OD, 1.5 * ctx.od);
    add(B("HDPE / DWC pipe for the buried run", "जमिनमुनिको HDPE / DWC पाइप"), `${d} mm OD (≥ 1.5 × cable OD ${ctx.od} mm)`, `${runM} m`, B("IS 1255: duct inside diameter at least 1.5 × cable diameter so the cable can be pulled and cooled.", "IS 1255: पाइप तारको व्यासको कम्तीमा १.५ गुणा।"));
  }
  if (route === "buried" || route === "duct") add(B("Trench materials", "खाल्डोका सामान"), "sand bed 75–100 mm, protective bricks or cover slab, warning tape 300 mm above", `${runM} m`,
    B("Mechanical protection and a warning before anyone digs into the cable (IS 1255 practice).", "तारलाई चोटबाट जोगाउन र खन्दा चेतावनी दिन।"));

  // --- earthing -----------------------------------------------------------------------------------
  if (kind === "main" || isMotor || kind === "ev") add(B("Earth electrode", "अर्थिङ इलेक्ट्रोड"), "GI pipe 40 mm × 4.5 m, or GI plate 600 × 600 × 6 mm / Cu plate 600 × 600 × 3 mm, with test pit", kind === "main" ? 2 : 1,
    B("CPWD Table IX / IS 3043. Aim for ≤ 5 Ω per electrode (CPWD; 8 Ω in rock). Two electrodes for a building supply.", "CPWD / IS 3043; हरेक इलेक्ट्रोड ५ Ω भन्दा कम।"));
  return out;
}

/** HV transformer feed BOM. ctx: { res, kva, kv } */
export function bomHv(ctx) {
  const { res, kva, kv } = ctx;
  const c = res.chosen; if (!c) return [];
  const out = []; const add = (item, spec, qty, why) => out.push({ item, spec, qty, why });
  const flcHv = kva / (Math.sqrt(3) * kv);
  const fuse = hvFuseFor(kva, kv);
  add(B("Cable termination kits", "केबल टर्मिनेसन किट"), `${kv <= 11 ? "6.35/11 kV" : "19/33 kV"}, 3-core, ${c.size} mm² range, heat-shrink or cold-shrink; 1 indoor + 1 outdoor`, 2,
    B("Chosen by voltage grade, cores, conductor size range and indoor/outdoor (IS 13573-2 kits).", "भोल्टेज, कोर, साइज र भित्र/बाहिर अनुसार किट।"));
  if (kv <= 11 && kva <= 630) add(B("Ring main unit (RMU)", "रिङ मेन युनिट (RMU)"), "12 kV, 630 A busbar, 20 kA 3 s, 200 A transformer breaker, IP54", 1,
    B("Indian utility RMU specification (MSEDCL) for transformers up to 630 kVA.", "६३० kVA सम्मका ट्रान्सफर्मरका लागि।"));
  else add(B("Vacuum circuit breaker panel", "VCB प्यानल"), `${kv <= 11 ? "12" : "36"} kV, 630 A, 25 kA 3 s, with IDMT O/C + E/F relay`, 1, B("Above the RMU range or at 33 kV a VCB is used (practice; check the NEA specification).", "ठूलो ट्रान्सफर्मर वा ३३ kV मा VCB।"));
  if (fuse) add(B("HV fuses for the transformer", "ट्रान्सफर्मरका HV फ्यूज"), `${fuse} A current-limiting HRC (IEC 60282-1), ${kv <= 11 ? "12" : "36"} kV`, 3,
    B(`ABB CEF-S table: about ${(fuse / flcHv).toFixed(1)} × the ${flcHv.toFixed(1)} A full-load current, large enough to ride through magnetising inrush (12 × In for 0.1 s).`, "ट्रान्सफर्मर सुरु हुँदाको करेन्ट सहने गरी फ्यूज।"));
  add(B("Lightning arresters", "लाइटनिङ एरेस्टर"), kv <= 11 ? "9 kV rated, 8 kV MCOV, 5 kA, metal-oxide gapless" : "30 kV rated, 10 kA, metal-oxide (verify with NEA)", 3,
    B("One per phase at each cable-to-overhead transition and at the transformer (MSEDCL spec for 11 kV).", "ओभरहेड-केबल जोड र ट्रान्सफर्मरमा हरेक फेजमा।"));
  add(B("Current transformers", "करेन्ट ट्रान्सफर्मर (CT)"), `${next(CT, flcHv)}/1 A, class 5P10`, 3, B(`CT primary ≥ transformer HV full-load current (${flcHv.toFixed(1)} A) for the IDMT relay.`, "CT प्राइमरी पूरा-भार करेन्टभन्दा बढी।"));
  const flcLv = kva / (Math.sqrt(3) * 0.4);
  const isc = lvFaultKA(kva);
  const lvDev = flcLv <= 630 ? `MCCB ${next(MCCB_FRAMES, flcLv)} A frame` : `ACB ${next([800, 1000, 1250, 1600, 2000, 2500, 3200, 4000], flcLv)} A`;
  add(B("LV incomer breaker at the transformer", "ट्रान्सफर्मरको LV इन्कमर ब्रेकर"), `${lvDev}, 4P, set ${Math.ceil(flcLv)} A, breaking ≥ ${Math.ceil(isc)} kA`, 1,
    B(`Transformer LV full-load current ${flcLv.toFixed(0)} A; fault at its terminals up to ${isc.toFixed(1)} kA (4.5 % impedance, IS 1180).`, `LV पूरा-भार करेन्ट ${flcLv.toFixed(0)} A; फल्ट ${isc.toFixed(1)} kA सम्म।`));
  add(B("Substation earthing", "सबस्टेसन अर्थिङ"), "separate electrodes for transformer neutral and for equipment bodies, GI/Cu strip ring", 4,
    B("IS 3043 / CPWD Table IX electrodes; keep resistance as low as practicable — the protection must still trip on an earth fault.", "न्युट्रल र बडीका लागि छुट्टाछुट्टै अर्थ।"));
  return out;
}

/** Overhead line BOM. ctx: { line (sizeLine result) } — spans and insulators are typical practice. */
export function bomLine(ctx) {
  const r = ctx.line, c = r.chosen; if (!c) return [];
  const s = r.spec, kv = s.kV;
  const out = []; const add = (item, spec, qty, why) => out.push({ item, spec, qty, why });
  const span = kv <= 11 ? 70 : kv <= 33 ? 90 : kv <= 66 ? 200 : kv <= 132 ? 300 : kv <= 220 ? 330 : 400;
  const supports = Math.ceil((s.lengthKm * 1000) / span) + 1;
  const cct = r.circuits || 1, nb = c.n || 1;
  add(B("Conductor", "कन्डक्टर"), `${c.st_strands ? "ACSR " : ""}${c.conductor || c.name}${nb > 1 ? ` (${nb} per phase, 450 mm bundle spacing)` : ""}, ${c.standard}`,
    `${Math.ceil(s.lengthKm * 3 * nb * cct * 1.02 * 1000).toLocaleString("en-IN")} m`, B(`3 phases × ${nb} subconductor(s) × ${cct} circuit(s), plus 2 % for sag and jumpers.`, "फेज × बन्डल × सर्किट, र २ % झोल।"));
  if (kv >= 132) add(B("Earth wire (shield wire) on the tower peaks", "टावरको टुप्पोमा अर्थ वायर"), kv >= 220 ? "7/3.66 mm GS wire or OPGW (fibre)" : "7/3.15 mm GS wire or OPGW", `${Math.ceil(s.lengthKm * 1.02 * 1000).toLocaleString("en-IN")} m`,
    B("Shields the phases from lightning; OPGW also carries the grid's communication fibre (typical practice).", "बिजुलीबाट जोगाउन; OPGW ले फाइबर पनि बोक्छ।"));
  if (nb > 1) add(B("Spacer dampers", "स्पेसर ड्याम्पर"), `${nb}-conductor, 450 mm`, `${Math.ceil(s.lengthKm * 1000 / 70) * 3 * cct} (about one per 70 m per phase)`,
    B("Keep the bundle spacing and damp wind vibration (typical practice).", "बन्डलको दूरी कायम राख्न र कम्पन रोक्न।"));
  add(B(kv <= 33 ? "Poles" : "Towers", kv <= 33 ? "पोल" : "टावर"), kv <= 11 ? "PSC / steel tubular pole 9–11 m" : kv <= 33 ? "steel tubular / RSJ pole 11–13 m" : `lattice steel tower, ${cct === 2 ? "double" : "single"}-circuit`, supports,
    B(`Typical span ${span} m (practice; the line survey sets the real spans and angle points).`, `सामान्य स्प्यान ${span} m।`));
  add(B("Insulators", "इन्सुलेटर"), kv <= 11 ? "11 kV pin insulators (straight poles) + disc/polymer strain sets at angles and ends" : kv <= 33 ? "33 kV pin / post insulators + strain sets" : kv <= 66 ? "disc strings, about 5–6 × 70 kN discs or polymer long-rod" : kv <= 132 ? "disc strings, about 9–10 × 90 kN discs or polymer long-rod" : kv <= 220 ? "disc strings, about 14–15 × 120 kN discs (double strings at crossings)" : "disc strings, about 23–25 × 120–160 kN discs, double I or V strings",
    kv <= 33 ? `${supports * 3} + strain sets` : `${supports * 3 * cct} strings`, B("Number of discs per string is typical practice; pollution and altitude can raise it.", "डिस्क संख्या सामान्य अभ्यास; प्रदूषण र उचाइले बढ्न सक्छ।"));
  add(B("Clamps and joints", "क्ल्याम्प र जोइन्ट"), `suspension and tension clamps for Ø ${c.dia_mm} mm, compression mid-span joints, PG clamps for jumpers`, "per design", B("Hardware must match the conductor diameter and strength.", "कन्डक्टरको व्यासअनुसार हार्डवेयर।"));
  add(B("Lightning arresters", "लाइटनिङ एरेस्टर"), kv <= 11 ? "9 kV, 5 kA" : kv <= 33 ? "30 kV, 10 kA" : kv <= 66 ? "60 kV station class" : kv <= 132 ? "120 kV station class, 10 kA" : kv <= 220 ? "198 kV station class, 10 kA" : "336–390 kV station class, 10–20 kA", `3 per end${cct > 1 ? " per circuit" : ""}`, B("At both ends and at cable transitions.", "दुवै छेउ र केबल जोडमा।"));
  add(B("Pole/tower earthing", "पोल/टावर अर्थिङ"), "earth every metal support (pipe or coil electrode)", supports,
    B("Nepal Electricity Rules 2050, Rule 58: metal supports of HV lines must be earthed.", "नियम ५८: HV लाइनका धातुका पोल अर्थ गर्नुपर्छ।"));
  return out;
}
