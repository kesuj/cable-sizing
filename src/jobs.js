// Job-based Simple mode. Each job turns plain answers (what people can read off a nameplate,
// a bill or a tape measure) into an engineering input for sizeConductor(), and lists every
// assumption it made, in English and Nepali. Pure functions — tested in tests/jobs.test.js.

/** Starting current multiples (× full-load current) and power factor at start. */
export const STARTERS = {
  dol: { mult: 6, pf: 0.3, en: "Direct-on-line (DOL) starter", ne: "डाइरेक्ट अन लाइन (DOL) स्टार्टर" },
  sd: { mult: 2.5, pf: 0.35, en: "Star-delta starter", ne: "स्टार-डेल्टा स्टार्टर" },
  soft: { mult: 3.5, pf: 0.35, en: "Soft starter", ne: "सफ्ट स्टार्टर" },
  vfd: { mult: 1.2, pf: 0.85, en: "VFD / inverter drive", ne: "VFD / इन्भर्टर ड्राइभ" },
};

/** Pump defaults when only HP is known (typical, not guaranteed — the nameplate wins). */
export const PUMPS = {
  sub: { eff: 0.78, pf: 0.8, en: "Submersible (borewell) pump", ne: "सबमर्सिबल (बोरिङ) पम्प" },
  surface: { eff: 0.85, pf: 0.85, en: "Surface / monoblock pump or other motor", ne: "जमिन माथिको / मोनोब्लक पम्प वा अन्य मोटर" },
};

/** Air conditioner maximum electrical input by capacity (typical split units, kW). */
export const AC_TON_KW = { "1": 1.1, "1.5": 1.6, "2": 2.2 };

/** EV chargers (IEC 61851 mode 3 wallboxes). */
export const EV = {
  "3.3": { kw: 3.3, system: "1ph", en: "3.3 kW single-phase (16 A)" },
  "7.4": { kw: 7.4, system: "1ph", en: "7.4 kW single-phase (32 A)" },
  "11": { kw: 11, system: "3ph", en: "11 kW three-phase (16 A)" },
  "22": { kw: 22, system: "3ph", en: "22 kW three-phase (32 A)" },
};

/** NEA domestic meter categories (single phase), A. */
export const NEA_METERS = [5, 15, 30, 60];

const A = (en, ne) => ({ en, ne });

export const JOBS = {
  house: {
    level: "LV", icon: "house",
    en: "Main cable of a house or flat (meter to board)", ne: "घर वा फ्ल्याटको मुख्य तार (मिटरदेखि बोर्डसम्म)",
    fields: (a) => ["phase", "houseBasis", ...(a.houseBasis === "meter" ? ["meterA"] : ["kwNow", "kwFuture"])],
    defaults: { phase: "1ph", houseBasis: "meter", meterA: 30, kwNow: 4, kwFuture: 3 },
    toInput(a) {
      const sys = a.phase;
      const assumptions = [];
      let load;
      if (a.houseBasis === "meter") {
        load = { power: +a.meterA, unit: "A", pf: 0.9 };
        assumptions.push(A(`Sized for the full NEA meter capacity, ${a.meterA} A${sys === "3ph" ? " per phase" : ""}: the cable can never be the weak link up to the meter limit.`,
          `NEA मिटरको पूरा क्षमता ${a.meterA} A${sys === "3ph" ? " (प्रति फेज)" : ""} अनुसार नापिएको: मिटरको सीमासम्म तार कमजोर हुँदैन।`));
      } else {
        const kw = (+a.kwNow || 0) + (+a.kwFuture || 0);
        load = { power: kw, unit: "kW", pf: 0.9 };
        assumptions.push(A(`Load = ${a.kwNow} kW used together now + ${a.kwFuture} kW you plan to add = ${kw} kW, power factor 0.9.`,
          `भार = अहिले सँगै चल्ने ${a.kwNow} kW + पछि थप्ने ${a.kwFuture} kW = ${kw} kW, पावर फ्याक्टर ०.९।`));
      }
      return { input: { system: sys, voltage: sys === "1ph" ? 230 : 400, load, designMargin: 0, motorFactor: 1 },
        assumptions, kind: "main" };
    },
  },

  heater: {
    level: "LV", icon: "heater",
    en: "Geyser, heater or induction cooker", ne: "गिजर, हिटर वा इन्डक्सन चुलो",
    fields: () => ["phase", "kw"],
    defaults: { phase: "1ph", kw: 2 },
    toInput(a) {
      return { input: { system: a.phase, voltage: a.phase === "1ph" ? 230 : 400, load: { power: +a.kw, unit: "kW", pf: 1 }, designMargin: 0, motorFactor: 1 },
        assumptions: [A(`Resistive load ${a.kw} kW, power factor 1.0 (all current does useful work).`, `${a.kw} kW को रेजिस्टिभ भार, पावर फ्याक्टर १.०।`)],
        kind: "resistive" };
    },
  },

  ac: {
    level: "LV", icon: "ac",
    en: "Air conditioner", ne: "एयर कन्डिसनर (AC)",
    fields: (a) => ["acBasis", ...(a.acBasis === "amps" ? ["amps"] : ["acTon"]), "acInverter"],
    defaults: { acBasis: "ton", acTon: "1.5", amps: 8, acInverter: "yes" },
    toInput(a) {
      const assumptions = [];
      const load = a.acBasis === "amps" ? { power: +a.amps, unit: "A", pf: 0.9 } : { power: AC_TON_KW[a.acTon], unit: "kW", pf: 0.9 };
      if (a.acBasis !== "amps") assumptions.push(A(`${a.acTon} ton split AC draws up to about ${AC_TON_KW[a.acTon]} kW. The nameplate current is better if you can read it.`,
        `${a.acTon} टनको AC ले करिब ${AC_TON_KW[a.acTon]} kW सम्म लिन्छ। नेमप्लेटको करेन्ट थाहा भए त्यो राम्रो।`));
      assumptions.push(A("Compressor circuit sized at 125 % of its current (NEC 440.32 practice for motor-compressors).",
        "कम्प्रेसरको सर्किट करेन्टको १२५ % मा नापिएको (मोटर-कम्प्रेसरको चलन)।"));
      const fixed = a.acInverter === "no";
      if (fixed) assumptions.push(A("Fixed-speed compressor: starting current about 5 × running current is checked.", "फिक्स्ड-स्पिड कम्प्रेसर: सुरुको करेन्ट करिब ५ गुणा जाँचिएको।"));
      return { input: { system: "1ph", voltage: 230, load, motorFactor: 1.25, designMargin: 0,
        motorStart: fixed ? { multiple: 5, pf: 0.4 } : null }, assumptions, kind: "ac" };
    },
  },

  pump: {
    level: "LV", icon: "pump",
    en: "Water pump or motor (borewell, tank, mill)", ne: "पानी पम्प वा मोटर (बोरिङ, ट्याङ्की, मिल)",
    fields: (a) => ["phase", "pumpType", "motorBasis", ...(a.motorBasis === "amps" ? ["amps"] : ["hp"]), "starter"],
    defaults: { phase: "1ph", pumpType: "sub", motorBasis: "hp", hp: 1, amps: 7, starter: "dol" },
    toInput(a) {
      const P = PUMPS[a.pumpType] || PUMPS.surface;
      const st = STARTERS[a.starter] || STARTERS.dol;
      const assumptions = [];
      let load;
      if (a.motorBasis === "amps") {
        load = { power: +a.amps, unit: "A", pf: P.pf };
        assumptions.push(A(`Nameplate full-load current ${a.amps} A used directly (most accurate).`, `नेमप्लेटको ${a.amps} A करेन्ट सिधै प्रयोग गरिएको (सबैभन्दा सही)।`));
      } else {
        load = { power: +a.hp, unit: "HP", pf: P.pf, eff: P.eff };
        assumptions.push(A(`${a.hp} HP is shaft output = ${(a.hp * 0.7457).toFixed(2)} kW. ${P.en}: efficiency ${P.eff}, power factor ${P.pf} (typical; nameplate values are better).`,
          `${a.hp} HP भनेको सफ्टको आउटपुट = ${(a.hp * 0.7457).toFixed(2)} kW। ${P.ne}: दक्षता ${P.eff}, पावर फ्याक्टर ${P.pf} (सामान्य मान)।`));
      }
      assumptions.push(A("Motor branch: cable sized for 125 % of full-load current (NEC 430.22; common practice in Nepal/India).", "मोटर सर्किट: तार पूरा-भार करेन्टको १२५ % का लागि नापिएको।"));
      assumptions.push(A(`${st.en}: starting current ≈ ${st.mult} × running current; dip at the motor kept within 15 %.`, `${st.ne}: सुरुको करेन्ट ≈ ${st.mult} गुणा; सुरु हुँदा भोल्टेज १५ % भन्दा बढी झर्न हुँदैन।`));
      if (a.starter === "sd") assumptions.push(A("Star-delta needs two 3-core cables from the starter to the motor, each carrying 58 % of the current; this tool sizes the supply cable to the starter.",
        "स्टार-डेल्टामा स्टार्टरदेखि मोटरसम्म दुईवटा ३-कोर तार चाहिन्छ; यहाँ स्टार्टरसम्मको तार नापिएको छ।"));
      return { input: { system: a.phase, voltage: a.phase === "1ph" ? 230 : 400, load: { ...load, shaftOutput: true },
        motorFactor: 1.25, designMargin: 0, motorStart: { multiple: st.mult, pf: st.pf }, vdStartLimitPct: 15 },
        assumptions, kind: "motor", starter: a.starter };
    },
  },

  ev: {
    level: "LV", icon: "ev",
    en: "Electric vehicle (EV) charger", ne: "विद्युतीय सवारी (EV) चार्जर",
    fields: () => ["evKw"],
    defaults: { evKw: "7.4" },
    toInput(a) {
      const e = EV[a.evKw] || EV["7.4"];
      return { input: { system: e.system, voltage: e.system === "1ph" ? 230 : 400, load: { power: e.kw, unit: "kW", pf: 1 },
        motorFactor: 1.25, designMargin: 0 },
        assumptions: [
          A(`${e.en} charger runs at full current for hours.`, `${e.en} चार्जर घण्टौंसम्म पूरा करेन्टमा चल्छ।`),
          A("Continuous load: sized at 125 % (NEC 625.41); dedicated circuit, no diversity (IEC 60364-7-722).", "लगातारको भार: १२५ % मा नापिएको; छुट्टै सर्किट चाहिन्छ।"),
        ], kind: "ev" };
    },
  },

  shop: {
    level: "LV", icon: "shop",
    en: "Shop, office, school or small industry supply", ne: "पसल, अफिस, विद्यालय वा सानो उद्योगको सप्लाई",
    fields: () => ["phase", "kw"],
    defaults: { phase: "3ph", kw: 20 },
    toInput(a) {
      return { input: { system: a.phase, voltage: a.phase === "1ph" ? 230 : 400, load: { power: +a.kw, unit: "kW", pf: 0.85 }, designMargin: 0.25, motorFactor: 1 },
        assumptions: [A(`${a.kw} kW that can run at the same time, power factor 0.85, plus 25 % for growth (cables in walls and trenches are hard to replace).`,
          `सँगै चल्न सक्ने ${a.kw} kW, पावर फ्याक्टर ०.८५, र भविष्यका लागि २५ % थप।`)], kind: "main" };
    },
  },

  hvfeed: {
    level: "HV", icon: "hv",
    en: "11 kV or 33 kV cable to a transformer (industry, hospital, hydropower)", ne: "ट्रान्सफर्मरसम्मको ११ वा ३३ kV केबल (उद्योग, अस्पताल, जलविद्युत)",
    fields: () => ["hvKv", "kva", "faultKa", "faultT"],
    defaults: { hvKv: "11", kva: 500, faultKa: 13.1, faultT: 1 },
    toInput(a) {
      const kv = Number(a.hvKv);
      return { input: { system: "3ph", voltage: kv * 1000, grade: String(a.hvKv), load: { power: +a.kva, unit: "kVA", pf: 0.9 },
        sizeOn: "current", designMargin: 0, motorFactor: 1, fault: { ka: +a.faultKa, timeS: +a.faultT }, hvSource: "polycab", cores: "3", insulation: "XLPE" },
        assumptions: [
          A(`Sized for the transformer's full-load current: ${a.kva} kVA ÷ (√3 × ${kv} kV) = ${(a.kva / (Math.sqrt(3) * kv)).toFixed(1)} A.`,
            `ट्रान्सफर्मरको पूरा-भार करेन्ट: ${a.kva} kVA ÷ (√3 × ${kv} kV) = ${(a.kva / (Math.sqrt(3) * kv)).toFixed(1)} A।`),
          A(`Fault ${a.faultKa} kA for ${a.faultT} s — get the real value from the NEA substation; it usually decides the HV cable size.`,
            `फल्ट ${a.faultKa} kA, ${a.faultT} सेकेन्ड — वास्तविक मान NEA सबस्टेसनबाट लिनुहोस्; HV मा तारको साइज प्रायः यसैले तय गर्छ।`),
          A("3-core aluminium XLPE, armoured, IS 7098-2 (Polycab ratings); relay set at or below the cable's derated rating.",
            "३-कोर एल्युमिनियम XLPE, आर्मर्ड, IS 7098-2; रिले तारको क्षमताभन्दा कममा सेट गर्नुपर्छ।"),
        ], kind: "hv" };
    },
  },
};

/** Route choices in plain words → installation method per standard.
 *  IS catalogue tables cover only air, duct and ground; conduit runs use IEC 60364-5-52 method B. */
export const ROUTES = {
  clipped: { en: "Clipped on a wall or ceiling, in shade", ne: "भित्ता वा सिलिङमा क्लिप गरेर, छायाँमा", is: ["LV-IS", "air"], iec: "C", hv: "air" },
  conduit: { en: "In a PVC pipe in or on the wall (normal house wiring)", ne: "भित्तामा PVC पाइपभित्र (सामान्य घरको वायरिङ)", is: ["LV-IEC", "B1"], iec: "B1", hv: null },
  tray: { en: "On a cable tray or ladder in open air", ne: "खुला हावामा केबल ट्रे वा भर्याङमा", is: ["LV-IS", "air"], iec: "E", hv: "air" },
  buried: { en: "Buried directly in the ground", ne: "जमिनमा सिधै गाडेर", is: ["LV-IS", "ground"], iec: "D2", hv: "ground" },
  duct: { en: "In a pipe buried in the ground", ne: "जमिनमा गाडिएको पाइपभित्र", is: ["LV-IS", "duct"], iec: "D1", hv: "duct" },
};

export const REGIONS = {
  terai: { air: 45, ground: 35, en: "Terai / Madhesh (Biratnagar, Birgunj, Nepalgunj, Dhangadhi)", ne: "तराई / मधेस (विराटनगर, वीरगञ्ज, नेपालगञ्ज, धनगढी)" },
  hills: { air: 35, ground: 25, en: "Hills and valleys (Kathmandu, Pokhara, Dhankuta, Tansen)", ne: "पहाड र उपत्यका (काठमाडौं, पोखरा, धनकुटा, तानसेन)" },
  mountain: { air: 25, ground: 20, en: "High hills and mountains (above 2000 m)", ne: "उच्च पहाड र हिमाल (२००० मिटरभन्दा माथि)" },
};

/** Which adapter + method a route uses for a job under the chosen standard. */
export function routeFor(route, std, level) {
  const R = ROUTES[route] || ROUTES.buried;
  if (level === "HV") return { adapterKey: "HV-IS", method: R.hv || "ground" };
  if (std === "IEC") return { adapterKey: "LV-IEC", method: R.iec };
  const [adapterKey, method] = R.is;
  return { adapterKey, method };
}

/** Cores for a job: wires in conduit are single-core; otherwise by system and load kind. */
export function coresFor(job, system, method, adapterKey) {
  if (adapterKey === "HV-IS") return "3";
  if (["A1", "B1"].includes(method)) return "1";
  if (adapterKey === "LV-IEC") return system === "3ph" ? (job.kind === "motor" ? "4" : "5") : "3"; // with PE core
  if (system === "3ph") return job.kind === "motor" ? "3" : "4";
  return "2";
}

/** Protective device advice (IEC 60898 trip curves, IEC 61008/61009 RCDs, IEC 60364-7-722). */
export function protectionFor(kind, res, starter) {
  const In = res.current.In;
  const sys = res.spec.system;
  const poles = sys === "1ph" ? "2-pole (DP)" : kind === "motor" ? "3-pole (TP)" : "4-pole (TPN)";
  const polesNe = sys === "1ph" ? "२-पोल (DP)" : kind === "motor" ? "३-पोल (TP)" : "४-पोल (TPN)";
  if (kind === "hv") return [A(`Relay (IDMT overcurrent + earth fault) on the 11/33 kV breaker or RMU, set at or below ${Math.floor(res.chosen.iz * res.runs)} A.`,
    `११/३३ kV ब्रेकर वा RMU मा रिले, ${Math.floor(res.chosen.iz * res.runs)} A वा त्योभन्दा कममा सेट।`)];
  const out = [];
  if (kind === "motor") {
    out.push(A(`${In} A ${poles} MCB/MCCB, C-curve (D-curve for direct-on-line motors above about 5 HP), to protect the cable.`,
      `तारको सुरक्षाका लागि ${In} A ${polesNe} MCB/MCCB, C-कर्भ (५ HP भन्दा ठूला DOL मोटरमा D-कर्भ)।`));
    out.push(A(`Motor overload relay or MPCB set at the nameplate current (${res.current.I.toFixed(1)} A) — this is what protects the motor.`,
      `मोटरको सुरक्षाका लागि ओभरलोड रिले वा MPCB नेमप्लेट करेन्ट (${res.current.I.toFixed(1)} A) मा सेट।`));
    if (starter !== "vfd") out.push(A("Add a single-phasing / dry-run protector for submersible pumps.", "सबमर्सिबल पम्पमा सिङ्गल-फेजिङ / ड्राइ-रन प्रोटेक्टर राख्नुहोस्।"));
  } else {
    const curve = kind === "resistive" ? "B" : "C";
    out.push(A(`${In} A ${poles} MCB, ${curve}-curve${curve === "B" ? " (heating loads, no starting surge)" : " (general and compressor loads)"}.`,
      `${In} A ${polesNe} MCB, ${curve}-कर्भ।`));
  }
  if (kind === "ev") out.push(A("RCD 30 mA Type A plus 6 mA DC fault detection in the charger, or a Type B RCD (IEC 60364-7-722).",
    "३० mA Type A RCD र चार्जरमा ६ mA DC पत्ता लगाउने सुविधा, नभए Type B RCD।"));
  else if (kind === "main") out.push(A("RCCB at the board: 30 mA for socket and bathroom circuits; 100–300 mA for the whole installation where the earth electrode is the only fault path (TT).",
    "बोर्डमा RCCB: सकेट र बाथरुम सर्किटमा ३० mA; पूरै घरका लागि १००–३०० mA।"));
  else out.push(A("30 mA RCD (RCCB/RCBO) — water and metal bodies make shock likely.", "३० mA RCD (RCCB/RCBO) — पानी र धातुले करेन्ट लाग्ने सम्भावना बढाउँछ।"));
  return out;
}

/** Voltage at the load: nominal supply and at NEA's −5 % limit (Electricity Regulation 2050, Rule 40). */
export function voltageAtLoad(res) {
  const U = res.spec.voltage;
  const vd = res.chosen ? res.chosen.vd : 0;
  const phaseV = res.spec.system === "3ph" ? 1 / Math.sqrt(3) : 1; // show phase-to-neutral for 3-ph LV
  const lv = U <= 1100;
  const scale = lv && res.spec.system === "3ph" ? phaseV : 1;
  return {
    unit: lv && res.spec.system === "3ph" ? "V (phase to neutral)" : "V",
    nominal: U * scale, atLoad: (U - vd) * scale,
    low: U * 0.95 * scale, lowAtLoad: (U * 0.95 - vd) * scale,
    minOk: U * 0.9 * scale, // equipment generally tolerates −10 %
  };
}

/** What one size smaller would do — the single most persuasive line for an electrician. */
export function smallerSize(res) {
  const c = res.chosen;
  if (!c) return null;
  const i = res.candidates.indexOf(c);
  if (i <= 0) return null;
  const s = res.candidates[i - 1];
  const why = [];
  if (!s.pass.ampacity) why.push({ en: `carry only ${s.iz.toFixed(0)} A after derating, less than the ${res.current.basis.toFixed(0)} A it must carry — it would overheat`, ne: `घटाएपछि ${s.iz.toFixed(0)} A मात्र बोक्छ, चाहिने ${res.current.basis.toFixed(0)} A भन्दा कम — तातिन्छ` });
  if (!s.pass.voltageDrop) why.push({ en: `lose ${s.vdPct.toFixed(1)} % of the voltage on the way (limit ${res.spec.vdLimitPct} %)`, ne: `बाटोमै ${s.vdPct.toFixed(1)} % भोल्टेज गुमाउँछ (सीमा ${res.spec.vdLimitPct} %)` });
  if (!s.pass.motorStart) why.push({ en: `let the voltage fall ${s.vdStartPct.toFixed(0)} % when the motor starts — it may stall`, ne: `मोटर सुरु हुँदा भोल्टेज ${s.vdStartPct.toFixed(0)} % झर्छ — मोटर अड्किन सक्छ` });
  if (!s.pass.shortCircuit) why.push({ en: `be damaged by a short circuit before the protection clears it (needs ${s.scMin.toFixed(0)} mm²)`, ne: `सर्ट सर्किटमा सुरक्षा उपकरणले काट्नुअघि नै बिग्रिन्छ` });
  return { size: s.size, why };
}
