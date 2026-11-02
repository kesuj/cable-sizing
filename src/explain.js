import { ic } from "./icons.js";
// "Why?" explainers: one short, plain answer per concept (English + Nepali) and, where a picture
// says it faster, a small line figure. Figures use currentColor so they work in light and dark.

const svg = (w, h, body, label) =>
  `<svg class="fig" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" font-family="inherit" font-size="11">${body}</svg>`;
const T = (x, y, s, a = "start", extra = "") => `<text x="${x}" y="${y}" fill="currentColor" stroke="none" text-anchor="${a}" ${extra}>${s}</text>`;
const ACC = 'class="acc"'; // accent stroke (phase yellow), styled in CSS

/** House wiring map, Nepal style, with the run being sized highlighted. */
export function houseMap(highlight = "main", lang = "en") {
  const L = lang === "ne" ? { pole: "NEA पोल", meter: "मिटर", main: "मुख्य", board: "बोर्ड", lights: "बत्ती", sockets: "सकेट", heater: "गिजर / AC", ev: "EV चार्जर", pump: "पम्प", cap: "हरेक लाइन छुट्टै नापिने एउटा तार हो" }
    : { pole: "NEA pole", meter: "Meter", main: "main", board: "Board", lights: "lights", sockets: "sockets", heater: "geyser / AC", ev: "EV charger", pump: "pump", cap: "each line is one cable run, sized on its own" };
  const hl = (k) => (k === highlight ? ACC + ' stroke-width="3.5"' : "");
  return svg(380, 190, `
    <line x1="24" y1="20" x2="24" y2="130"/><line x1="14" y1="28" x2="34" y2="28"/>${T(6, 148, L.pole)}
    <path d="M24 30 C 50 40, 70 44, 92 62" ${hl("service")}/>
    <rect x="92" y="55" width="34" height="30"/>${T(109, 99, L.meter, "middle")}
    <path d="M126 70 H170" ${hl("main")}/>${T(148, 63, L.main, "middle")}
    <rect x="170" y="40" width="40" height="66"/>${T(150, 120, L.board, "middle")}${T(150, 132, "MCB, RCD", "middle", 'font-size="9"')}
    <path d="M210 48 H300" ${hl(L.lights)}/>${T(306, 52, "lights")}
    <path d="M210 64 H300" ${hl(L.sockets)}/>${T(306, 68, "sockets")}
    <path d="M210 80 H300" ${hl("heater")}/>${T(306, 84, L.heater)}
    <path d="M210 96 H300" ${hl("ev")}/>${T(306, 100, L.ev)}
    <path d="M200 106 V155 H300" ${hl(L.pump)} stroke-dasharray="${highlight === "pump" ? "0" : "4 3"}"/>${T(306, 159, "pump")}
    ${T(250, 182, L.cap, "middle", 'font-size="10"')}`, "House wiring map");
}

const WIRE = (cx, cy, r, col) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="none"/>`;
const SOIL = '<rect x="0" y="16" width="64" height="40" class="soil" stroke="none"/><path d="M0 16 H64" /><path d="M6 16 l-2 -4 M14 16 l1 -4 M40 16 l-2 -4 M52 16 l2 -4" />';
const routePics = {
  clipped: `<rect x="0" y="0" width="12" height="56" class="wall" stroke="none"/><path d="M12 0 V56"/>
    <circle cx="30" cy="28" r="9" class="sheath"/>${WIRE(27, 28, 3, "#C62828")}${WIRE(33, 28, 3, "#222")}
    <path d="M12 19 H21 M12 37 H21" /><path d="M21 19 a9 9 0 0 1 18 9 a9 9 0 0 1 -18 9" fill="none" stroke-width="1.2" opacity=".55"/>`,
  conduit: `<rect x="0" y="0" width="12" height="56" class="wall" stroke="none"/><path d="M12 0 V56"/>
    <circle cx="32" cy="28" r="15" fill="none"/>${WIRE(27, 25, 4, "#C62828")}${WIRE(37, 25, 4, "#222")}${WIRE(32, 34, 4, "#2E7D4F")}`,
  tray: `<path d="M4 40 H60 M4 40 V30 M60 40 V30" stroke-width="2"/><path d="M10 44 v4 M20 44 v4 M30 44 v4 M40 44 v4 M50 44 v4" opacity=".5"/>
    <circle cx="18" cy="32" r="7" class="sheath"/><circle cx="33" cy="32" r="7" class="sheath"/><circle cx="48" cy="32" r="7" class="sheath"/>`,
  buried: `${SOIL}<rect x="20" y="30" width="24" height="5" class="brick" stroke="none"/><rect x="18" y="37" width="28" height="14" class="sand" stroke="none"/>
    <circle cx="32" cy="44" r="5" class="sheath"/>`,
  duct: `${SOIL}<circle cx="32" cy="40" r="11" fill="none" stroke-width="2"/><circle cx="32" cy="43" r="5.5" class="sheath"/>`,
};
export function routePic(k) {
  return svg(64, 56, routePics[k] || "", "");
}

const FIG = {
  cores: () => svg(360, 92, `
    <circle cx="40" cy="38" r="26"/><circle cx="30" cy="38" r="8" class="c-r"/><circle cx="50" cy="38" r="8" class="c-n"/>${T(40, 82, "2-core: L N", "middle")}
    <circle cx="130" cy="38" r="26"/><circle cx="130" cy="27" r="8" class="c-r"/><circle cx="120" cy="45" r="8" class="c-y"/><circle cx="140" cy="45" r="8" class="c-b"/>${T(130, 82, "3-core: R Y B", "middle")}
    <circle cx="220" cy="38" r="26"/><circle cx="220" cy="25" r="8" class="c-r"/><circle cx="208" cy="42" r="8" class="c-y"/><circle cx="232" cy="42" r="8" class="c-b"/><circle cx="220" cy="55" r="4.5" class="c-n"/>${T(220, 82, "3½-core: R Y B + ½N", "middle")}
    <circle cx="310" cy="38" r="26"/><circle cx="301" cy="29" r="8" class="c-r"/><circle cx="319" cy="29" r="8" class="c-y"/><circle cx="301" cy="47" r="8" class="c-b"/><circle cx="319" cy="47" r="8" class="c-n"/>${T(310, 82, "4-core: R Y B N", "middle")}`, "Cable cores"),
  efficiency: () => svg(360, 80, `
    ${T(10, 34, "electricity in")}${T(10, 48, "4.39 kW", "start", 'font-weight="700"')}
    <path d="M80 40 H130" ${ACC}/><rect x="130" y="20" width="70" height="40" rx="4"/>${T(165, 44, "motor", "middle")}
    <path d="M200 40 H250" ${ACC}/>${T(258, 34, "shaft out (nameplate)")}${T(258, 48, "5 HP = 3.73 kW", "start", 'font-weight="700"')}
    <path d="M165 60 V72" stroke-dasharray="3 2"/>${T(175, 74, "0.66 kW lost as heat → η = 3.73 ÷ 4.39 = 0.85")}`, "Motor efficiency"),
  growth: () => svg(360, 92, `
    <rect x="40" y="40" width="50" height="34" fill="currentColor" opacity=".25" stroke="none"/>${T(65, 88, "today 3 kW", "middle")}
    <rect x="160" y="10" width="50" height="64" fill="currentColor" opacity=".25" stroke="none"/><rect x="160" y="10" width="50" height="30" ${ACC}/>${T(185, 88, "in 5 years 8 kW", "middle")}
    ${T(222, 22, "+ AC")}${T(222, 34, "+ induction cooker")}${T(222, 46, "+ EV charger")}${T(222, 62, "the cable must survive this", "start", 'font-weight="700"')}`, "Future growth"),
  vdrop: () => svg(360, 110, `
    <path d="M20 20 H120 L120 34 H230 L230 60 H340" ${ACC}/>
    ${T(20, 14, "NEA gives 230 V (or 218 V at −5 %)")}${T(125, 30, "meter")}${T(235, 54, "far end: what your appliance gets")}
    <path d="M20 80 H340" opacity=".5"/>${T(20, 98, "drop = 2 × I × L × R  (single phase)    √3 × I × L × R  (three phase)")}`, "Voltage drop"),
  run: () => houseMap("main"),
  branch: () => svg(360, 70, `
    <rect x="20" y="22" width="120" height="22" fill="currentColor" opacity=".25" stroke="none"/>${T(80, 37, "nameplate 7.45 A", "middle")}
    <rect x="160" y="22" width="150" height="22" ${ACC}/>${T(235, 37, "cable sized for 9.3 A", "middle")}${T(160, 62, "× 1.25 for long running, low voltage, slight overload")}`, "Motor branch factor"),
  fault: () => svg(360, 80, `
    <path d="M20 40 H150" stroke-width="3"/><path d="M150 40 l10 -12 l6 24 l6 -24 l6 12" ${ACC}/>${T(20, 30, "fault: thousands of amps")}
    ${T(190, 30, "the cable must stay below 250 °C (XLPE)")}${T(190, 46, "until the breaker or relay trips")}${T(20, 70, "size ≥ fault current × √(clearing time) ÷ k      k = 94 Al XLPE, 143 Cu XLPE")}`, "Short circuit"),
  hv: () => svg(360, 80, `
    <rect x="10" y="20" width="70" height="36"/>${T(45, 42, "NEA 33/11 kV", "middle", 'font-size="10"')}${T(45, 70, "fault kA, time s", "middle", 'font-size="10"')}
    <path d="M80 38 H230" ${ACC} stroke-width="3"/>${T(155, 30, "11 kV cable (km)", "middle")}
    <circle cx="245" cy="32" r="12"/><circle cx="245" cy="46" r="12"/>${T(245, 70, "transformer kVA", "middle", 'font-size="10"')}
    <path d="M257 38 H300"/><rect x="300" y="26" width="40" height="24"/>${T(320, 62, "LT panel", "middle", 'font-size="10"')}`, "HV feeder"),
};

/** Concept → { en: [title, body], ne: [title, body], fig } */
export const EXPLAIN = {
  run: { fig: "run",
    en: ["What is a cable run?", "The path one cable takes from where it starts to the load. In a house: pole → meter (service cable, NEA's), meter → board (main cable, yours), board → each appliance. Each run is sized separately."],
    ne: ["केबल रन भनेको के हो?", "एउटा तार सुरु भएदेखि उपकरणसम्म जाने बाटो। घरमा: पोल → मिटर (NEA को), मिटर → बोर्ड (मुख्य तार), बोर्ड → हरेक उपकरण। हरेक रन छुट्टै नापिन्छ।"] },
  route: {
    en: ["Why does the route matter?", "A cable's limit is heat. In open air it cools well; in a pipe inside a wall the heat is trapped; under ground the soil carries heat away slowly. The same cable can safely carry 40 % more in one place than another."],
    ne: ["बाटोले किन फरक पार्छ?", "तारको सीमा भनेको ताप हो। खुला हावामा छिटो चिसो हुन्छ, भित्ताको पाइपमा ताप थुनिन्छ, जमिनमा बिस्तारै जान्छ। एउटै तारले एक ठाउँमा अर्कोभन्दा ४० % बढी बोक्न सक्छ।"] },
  distance: {
    en: ["How to measure the length", "Walk the real path with a tape: along walls, up and down, around corners — not the straight-line distance. Enter one-way length; the calculator accounts for the return conductor."],
    ne: ["लम्बाइ कसरी नाप्ने", "तार जाने वास्तविक बाटो टेपले नाप्नुहोस्: भित्ताको छेउ, माथि-तल, कुना घुमेर। एकतर्फी लम्बाइ राख्नुहोस्।"] },
  region: {
    en: ["Why the region?", "Hot air or ground means the cable is already warm before current flows, so it carries less. The Terai at 45 °C cuts a PVC cable in air to 90 % of its rating; in the mountains it can carry more."],
    ne: ["क्षेत्र किन?", "हावा वा जमिन तातो भए तार पहिल्यै तातो हुन्छ, त्यसैले कम बोक्छ। तराईको ४५ °C मा PVC तारको क्षमता ९० % मा झर्छ; हिमालमा बढी बोक्छ।"] },
  group: {
    en: ["Cables run together", "Cables touching each other share their heat. Three circuits in one pipe can each carry only 70 % of what one alone could. Count every circuit in the same pipe, tray or trench, including this one."],
    ne: ["सँगै राखिएका तार", "छोएर राखिएका तारले एकअर्कालाई तताउँछन्। एउटै पाइपमा तीन सर्किट भए हरेकले ७० % मात्र बोक्छ। सोही पाइप, ट्रे वा खाल्डोका सबै सर्किट गन्नुहोस्।"] },
  cores: { fig: "cores",
    en: ["What are cores?", "Separate insulated conductors inside one cable. Colours in Nepal/India: red, yellow, blue = the three phases, black = neutral, green = earth. Single phase uses 2 cores (L, N); a three-phase motor 3 cores; a three-phase building 4 (or 3½: a half-size neutral)."],
    ne: ["कोर भनेको के हो?", "एउटै केबलभित्रका छुट्टाछुट्टै इन्सुलेटेड तार। रंग: रातो, पहेँलो, निलो = तीन फेज, कालो = न्युट्रल, हरियो = अर्थ। सिङ्गल फेजमा २ कोर, थ्री फेज मोटरमा ३, थ्री फेज भवनमा ४ (वा ३½)।"] },
  conductor: {
    en: ["Copper or aluminium?", "Copper is smaller for the same current, makes reliable joints and is required inside buildings in Nepal (NBC 207: at least 2.5 mm² for lights, 4 mm² for power). Aluminium is cheaper and lighter, needs about 1.6 × the size, and only from 16 mm² up, with bimetallic lugs where it meets copper."],
    ne: ["तामा कि एल्युमिनियम?", "तामा सानो साइजमै पुग्छ, जोड्न भरपर्दो र भवनभित्र अनिवार्य (NBC 207: बत्तीमा कम्तीमा २.५ mm², पावरमा ४ mm²)। एल्युमिनियम सस्तो र हलुका, करिब १.६ गुणा ठूलो चाहिन्छ, १६ mm² देखि मात्र, तामासँग जोड्दा बाइमेटालिक लग।"] },
  efficiency: { fig: "efficiency",
    en: ["Motor efficiency (η)", "The nameplate HP or kW is what the shaft delivers. The motor draws more from the supply; the rest becomes heat. Find η on the nameplate (\"Eff\", \"η\", or IE2/IE3) or in the pump catalogue. Typical: 1 HP 0.75–0.80, 5 HP 0.85, 10 HP 0.88, submersible 0.75–0.85. If the nameplate shows amps, use that instead — then you need neither η nor pf."],
    ne: ["मोटरको दक्षता (η)", "नेमप्लेटको HP वा kW भनेको सफ्टले दिने शक्ति हो। मोटरले सप्लाईबाट बढी लिन्छ; बाँकी ताप बन्छ। η नेमप्लेटमा (\"Eff\", \"η\", IE2/IE3) वा पम्प क्याटलगमा हुन्छ। नेमप्लेटमा एम्पियर लेखिएको भए त्यही प्रयोग गर्नुहोस्।"] },
  pf: {
    en: ["Power factor", "The share of the current that does useful work. Heater, geyser: 1.0. LED lights, inverter AC: about 0.9. Motors and pumps: 0.8–0.85. A lower power factor means more current for the same kW."],
    ne: ["पावर फ्याक्टर", "करेन्टको कति भागले काम गर्छ भन्ने। हिटर, गिजर: १.०। LED, इन्भर्टर AC: करिब ०.९। मोटर, पम्प: ०.८–०.८५।"] },
  growth: { fig: "growth",
    en: ["Future growth", "A cable in a wall or trench is costly to replace. Size it for what you will add: an AC (1.5–2.2 kW), an induction cooker (2 kW), a geyser (2–3 kW), an EV charger (3.3–7.4 kW)."],
    ne: ["भविष्यको थप भार", "भित्ता वा खाल्डोको तार फेर्न महँगो पर्छ। पछि थप्ने AC (१.५–२.२ kW), इन्डक्सन (२ kW), गिजर (२–३ kW), EV चार्जर (३.३–७.४ kW) का लागि पनि नाप्नुहोस्।"] },
  meter: {
    en: ["NEA meter category", "Your NEA bill and meter show the category: 5, 15, 30 or 60 A single phase, or three phase. Sizing the main cable for the meter's full capacity means the cable is never the weak link up to what NEA lets you draw."],
    ne: ["NEA मिटरको क्षमता", "NEA को बिल र मिटरमा ५, १५, ३० वा ६० A (सिङ्गल फेज) वा थ्री फेज लेखिएको हुन्छ। मिटरको पूरा क्षमतामा मुख्य तार नाप्दा तार कहिल्यै कमजोर हुँदैन।"] },
  branch: { fig: "branch",
    en: ["Why 125 % for motors?", "A motor runs for hours, often at low voltage, and may be loaded a little past its rating. Codes size its cable at 125 % of the nameplate current so the cable never becomes the weak point (NEC 430.22; common practice in Nepal/India)."],
    ne: ["मोटरमा १२५ % किन?", "मोटर घण्टौं चल्छ, प्रायः कम भोल्टेजमा, र अलि बढी भार पनि पर्छ। त्यसैले तारलाई नेमप्लेट करेन्टको १२५ % मा नापिन्छ।"] },
  starter: {
    en: ["Starter type", "Starting current: direct-on-line 6–7 × running current, star-delta about 2–3 ×, soft starter 3–4 ×, VFD about 1.2 ×. A long cable plus a big starting current can drop the voltage so far that the motor stalls."],
    ne: ["स्टार्टरको प्रकार", "सुरुको करेन्ट: DOL ६–७ गुणा, स्टार-डेल्टा २–३ गुणा, सफ्ट स्टार्टर ३–४ गुणा, VFD १.२ गुणा। लामो तार र ठूलो सुरुको करेन्टले मोटर अड्काउन सक्छ।"] },
  vdrop: { fig: "vdrop",
    en: ["Voltage drop", "Current flowing through the cable's resistance loses voltage on the way. NEA must supply 230 V ±5 % (Electricity Regulation 2050, Rule 40), so you may start at 218 V; the cable must not lose more than about 5 % more. Too much drop: dim lights, hot motors, pumps that fail to start."],
    ne: ["भोल्टेज ड्रप", "तारको रेजिस्टेन्सले बाटोमै भोल्टेज घटाउँछ। NEA ले २३० V ±५ % दिनुपर्छ (विद्युत नियमावली २०५०, नियम ४०), त्यसैले २१८ V मात्र आउन सक्छ; तारमा थप ५ % भन्दा बढी गुमाउनु हुँदैन।"] },
  fault: { fig: "fault",
    en: ["Short-circuit check", "In a fault, thousands of amps flow until the breaker or relay trips. The cable must be thick enough not to overheat in that time. For house circuits a fast MCB limits this; for big feeders and all HV cables it often decides the size."],
    ne: ["सर्ट सर्किट जाँच", "फल्टमा ब्रेकर वा रिलेले काट्नुअघि हजारौं एम्पियर बग्छ। त्यति बेला तार नबिग्रिने गरी मोटो हुनुपर्छ। HV मा प्रायः यसैले साइज तय गर्छ।"] },
  hv: { fig: "hv",
    en: ["How an HV feeder is sized", "Current = transformer kVA ÷ (√3 × kV) — usually small. The NEA fault level and clearing time usually decide the size; voltage drop decides on long rural feeders (NEA keeps it under 5 %). The relay, not a breaker rating, protects the cable."],
    ne: ["HV फिडर कसरी नाप्ने", "करेन्ट = ट्रान्सफर्मर kVA ÷ (√3 × kV) — प्रायः सानो। NEA को फल्ट लेभल र समयले साइज तय गर्छ; लामो फिडरमा भोल्टेज ड्रपले (NEA: ५ % भन्दा कम)।"] },
  ton: {
    en: ["AC capacity", "Written on the indoor unit or the box: 1, 1.5 or 2 ton (12 000, 18 000, 24 000 BTU). The nameplate current on the outdoor unit is more accurate."],
    ne: ["AC को क्षमता", "भित्री युनिट वा बाकसमा: १, १.५ वा २ टन। बाहिरी युनिटको नेमप्लेट करेन्ट बढी सही।"] },
  ev: {
    en: ["EV charger", "Most home wallboxes in Nepal are 7.4 kW single phase (32 A). An EV charges at full current for hours, so the cable and breaker are sized as a continuous load and the circuit is dedicated."],
    ne: ["EV चार्जर", "घरका धेरैजसो चार्जर ७.४ kW सिङ्गल फेज (३२ A) हुन्छन्। घण्टौं पूरा करेन्टमा चल्ने भएकाले छुट्टै सर्किट चाहिन्छ।"] },
  kva: {
    en: ["Transformer kVA", "Written on the transformer nameplate (e.g. 100, 200, 500, 1000 kVA). Add them up if one cable feeds several."],
    ne: ["ट्रान्सफर्मर kVA", "ट्रान्सफर्मरको नेमप्लेटमा लेखिएको (जस्तै १००, २००, ५००, १००० kVA)।"] },
};

export function explainHtml(key, lang = "en") {
  const e = EXPLAIN[key];
  if (!e) return "";
  const [t, b] = e[lang] || e.en;
  const fig = e.fig && FIG[e.fig] ? `<div class="figwrap">${FIG[e.fig]()}</div>` : "";
  const lbl = lang === "ne" ? `${t} — व्याख्या` : `Explain: ${t}`;
  return `<details class="why"><summary title="${lbl}" aria-label="${lbl}">${ic("help", 18)}</summary><div class="why-body"><p><b>${t}.</b> ${b}</p>${fig}</div></details>`;
}
