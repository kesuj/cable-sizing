// UI for the conductor sizing workbench. All engineering lives in core.js / size.js / adapters.
import { ADAPTERS } from "./adapters/index.js";
import { sizeConductor, cableDescription } from "./size.js";
import { round, kValue, faultWithstand, faultAtDistance, interp } from "./core.js";
import { drawCable, drawStrands } from "./xsec.js";
import { sizeLine, LINE_DEFAULTS, stClair } from "./overhead.js";
import { bomFor, bomHv, bomLine } from "./bom.js";
import { ttCheck, disconnectTime, mcbCurve, PRE_ENERGISE } from "./protection.js";
import { LOAD_TYPES, pfCorrection, pvStrings } from "./planning.js";
import { DATA } from "./data.js";
import { JOBS, ROUTES, REGIONS as NP_REGIONS, NEA_METERS, STARTERS, PUMPS, EV, routeFor, coresFor, protectionFor, voltageAtLoad, smallerSize } from "./jobs.js";
import { explainHtml, routePic, houseMap } from "./explain.js";
import { ic } from "./icons.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v, d = 1) => (v == null || !isFinite(v) ? "–" : Number(round(v, d)).toLocaleString("en-IN"));

// Climate presets for Nepal (simple mode). Air = shade temperature of the hottest month; ground at ~0.8 m.
const REGIONS = {
  terai: { label: "Terai / Madhesh plains (Biratnagar, Birgunj, Nepalgunj, Dhangadhi)", air: 45, ground: 35 },
  hills: { label: "Hills and valleys (Kathmandu, Pokhara, Dhankuta, Tansen)", air: 35, ground: 25 },
  mountain: { label: "High hills and mountains (above 2000 m)", air: 25, ground: 20 },
  custom: { label: "Somewhere else — I'll enter the temperatures" },
};

const LOADS = {
  house: { label: "A house, flat, shop or office (main supply cable)", pf: 0.9, margin: 0.25,
    hint: "Add up the connected load or use the NEA sanctioned load. 25 % spare is added for future growth." },
  motor: { label: "A motor or water pump", pf: 0.85, eff: 0.9, motor: true,
    hint: "Use the power on the motor nameplate (HP or kW)." },
  heater: { label: "Heater, geyser, lights or other plain load", pf: 1, margin: 0 },
  ac: { label: "Air conditioner, inverter, UPS or EV charger", pf: 0.9, margin: 0.25 },
  amps: { label: "I already know the current in amps", pf: 0.85 },
};

const DEFAULT_STATE = {
  level: "LV", std: "IS", mode: "simple",
  loadType: "house", system: "3ph", voltage: 400, power: 15, unit: "kW", pf: 0.9, eff: 0.9,
  margin: 25, motorFactor: 1, startMult: 6, startPf: 0.3, motorStartOn: false,
  region: "hills", airTemp: 35, groundTemp: 25, soilRes: 150, depthMm: 750,
  method: "ground", groupCount: 1, spacing: "touching", formation: "flat", racks: 1, lengthM: 40,
  material: "cu", insulation: "XLPE", cores: "4", armoured: true,
  vdLimitPct: 5, vdStartLimitPct: 15, faultOn: false, faultBasis: "kat", faultKa: 10, faultT: 0.1, i2t: 40000, sizeOn: "device", trafoKva: 200, supplyM: 0, supplyMm2: 70,
  earthing: "TT", earthRa: 30, h3: 0, curve: "C", tripOn: true,
  hvKv: 11, hvEarth: "E", hvSource: "polycab", minSize: "",
  lang: "en", job: "house", route: "buried",
  ...Object.values(JOBS).reduce((o, j) => ({ ...o, ...j.defaults }), {}), ...JOBS.house.defaults, hvKv: "11", faultKa: 10, faultT: 0.1, earthing: "TT", earthRa: 30, h3: 0, curve: "C", tripOn: true,
};

let S = { ...DEFAULT_STATE };
try { Object.assign(S, JSON.parse(localStorage.getItem("cs-state") || "{}")); } catch { /* storage blocked */ }
const save = () => { try { localStorage.setItem("cs-state", JSON.stringify(S)); } catch { /* ignore */ } };

const adapterKey = () => `${S.level}-${S.level === "HV" ? "IS" : S.std}`;
const adapter = () => ADAPTERS[adapterKey()] || ADAPTERS["LV-IS"];
const eng = () => S.mode === "engineer";

// ---------- field helpers ----------
// Concept explainers attached to fields (both modes).
const WHY = { pf: "pf", eff: "efficiency", margin: "growth", motorFactor: "branch", lengthM: "distance", groupCount: "group",
  cores: "cores", material: "conductor", vdLimitPct: "vdrop", faultKa: "fault", startMult: "starter", meterA: "meter", houseBasis: "meter",
  kwFuture: "growth", hp: "efficiency", motorBasis: "efficiency", starter: "starter", acTon: "ton", evKw: "ev", kva: "kva", region: "region" };
const why = (name, lang = "en") => (WHY[name] ? explainHtml(WHY[name], eng() ? "en" : lang) : "");
function num(name, label, { suffix, hint, step = "any", min = 0 } = {}) {
  const input = `<input type="number" id="${name}" name="${name}" value="${esc(S[name])}" step="${step}" min="${min}" inputmode="decimal">`;
  return `<div class="field"><label for="${name}">${label}</label>${suffix ? `<div class="unit">${input}<span class="suffix">${suffix}</span></div>` : input}${hint ? `<span class="hint">${hint}</span>` : ""}${why(name, S.lang)}</div>`;
}
function sel(name, label, opts, { hint, struct } = {}) {
  const o = opts.map(([v, t]) => `<option value="${esc(v)}"${String(S[name]) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("");
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}"${struct ? " data-struct" : ""}>${o}</select>${hint ? `<span class="hint">${hint}</span>` : ""}${why(name, S.lang)}</div>`;
}
const METHOD_PIC = { ground: "buried", duct: "duct", air: "tray", D2: "buried", D1: "duct", A1: "conduit", A2: "conduit", B1: "conduit", B2: "conduit",
  C: "clipped", E: "tray", F: "tray", F_flat_touching: "tray", G_horizontal_spaced: "tray", G_vertical_spaced: "tray" };
function choices(name, label, opts, struct = true) {
  const pic = (v) => (name === "method" && METHOD_PIC[v] ? `<span class="mpic">${routePic(METHOD_PIC[v])}</span>` : "");
  const items = opts.map(([v, t, d]) => `<label class="choice${name === "method" ? " withpic" : ""}"><input type="radio" name="${name}" value="${esc(v)}"${String(S[name]) === String(v) ? " checked" : ""}${struct ? " data-struct" : ""}>${pic(v)}<div><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ""}</div></label>`).join("");
  return `<fieldset class="field" style="border:0;padding:0;margin:0 0 16px"><legend class="lbl" style="padding:0;margin-bottom:4px">${label}</legend><div class="choices">${items}</div></fieldset>`;
}
const check = (name, label, struct = true) =>
  `<label class="check"><input type="checkbox" name="${name}"${S[name] ? " checked" : ""}${struct ? " data-struct" : ""}> ${label}</label>`;
const row = (...f) => `<div class="row">${f.join("")}</div>`;

// ---------- render form ----------
function showSteps() { document.querySelectorAll("#s2, #s3").forEach((n) => { const sec = n.closest("section"); if (sec) sec.hidden = false; }); }
function renderForm() {
  showSteps();
  const A = adapter();
  const hv = S.level === "HV";
  for (const b of document.querySelectorAll(".seg button")) {
    b.setAttribute("aria-checked", String(S[b.dataset.set] === b.dataset.val));
    if (b.dataset.set === "std") b.disabled = hv;
    if (b.dataset.set === "std" && b.dataset.val === "IEC") b.disabled = hv || !ADAPTERS["LV-IEC"];
  }
  document.documentElement.lang = !eng() && S.lang === "ne" ? "ne" : "en";
  const langSeg = document.querySelector("[data-only=simple]");
  if (langSeg) langSeg.hidden = eng();
  if (!eng()) return renderSimple();
  setStepTitles(STEP_EN);

  // 1 load
  let h = "";
  if (hv) {
    h += row(sel("hvKv", "System voltage", A.options.voltages, { struct: true, hint: "Line-to-line. NEA uses 11 kV and 33 kV for distribution." }),
      num("power", "Load", { suffix: unitSel(["kVA", "kW", "MVA", "A"]) }));
    h += row(num("pf", "Power factor", { step: 0.01, hint: "0.85–0.9 is typical for a feeder or transformer." }),
      num("margin", "Future growth allowance", { suffix: "%" }));
  } else {
    if (!eng()) h += choices("loadType", "Choose the closest", Object.entries(LOADS).map(([k, v]) => [k, v.label]));
    const L = LOADS[S.loadType] || LOADS.house;
    const units = S.loadType === "amps" && !eng() ? ["A"] : S.loadType === "motor" ? ["HP", "kW", "A"] : ["kW", "W", "kVA", "HP", "A"];
    h += row(
      sel("system", "Supply", [["1ph", "Single phase (230 V)"], ["3ph", "Three phase (400 V)"], ...(eng() ? [["dc", "DC (battery / solar)"]] : [])], { struct: true }),
      eng() ? num("voltage", "Voltage", { suffix: "V" }) : "",
      num("power", S.loadType === "amps" && !eng() ? "Current" : "Load", { suffix: unitSel(units), hint: eng() ? "" : S.std === "IEC" ? L.hint?.replace("the NEA sanctioned load", "your sanctioned (contracted) load") : L.hint }));
    if (eng()) {
      h += row(num("pf", "Power factor", { step: 0.01 }), num("eff", "Motor efficiency", { step: 0.01, hint: "Used for HP, and for kW when it is a motor's output." }),
        num("margin", "Future growth allowance", { suffix: "%" }), num("motorFactor", "Motor branch factor", { step: 0.05, hint: "1.25 for a single motor (NEC 430.22 practice), else 1." }));
    }
  }
  $("#load-fields").innerHTML = h;

  // 2 route
  const methods = !eng() && A.options.simpleMethods ? A.options.methods.filter(([m]) => A.options.simpleMethods.includes(m)) : A.options.methods;
  h = choices("method", "How the cable is installed", methods);
  if (!eng() && !hv && S.std === "IS") {
    h += row(sel("region", "Where in Nepal", Object.entries(REGIONS).map(([k, v]) => [k, v.label]), { struct: true }));
  }
  const showT = eng() || hv || S.std !== "IS" || S.region === "custom";
  const air = A.isAir ? A.isAir(S.method) : S.method === "air";
  if (showT) h += row(air ? num("airTemp", "Hottest air temperature", { suffix: "°C", hint: "Shade temperature in the hottest month." })
    : num("groundTemp", "Ground temperature at cable depth", { suffix: "°C", hint: "About 5 °C below the summer air temperature." }));
  h += row(num("lengthM", "Cable length, one way", { suffix: "m", hint: "Measure along the actual route, add the vertical rises." }),
    num("groupCount", `Number of ${A.options.group?.[S.method] || A.options.group?.default || "cables run together"}`, { step: 1, min: 1, hint: "Include this one. Cables close together heat each other." }));
  if (eng()) {
    if (!air) h += row(num("soilRes", "Soil thermal resistivity", { suffix: "K·cm/W", hint: "150 is standard. Dry sandy or rocky soil: 200–250. Wet clay: 100–120." }),
      num("depthMm", "Depth of laying", { suffix: "mm" }));
    const sp = A.options.spacings?.[S.method] || [["touching", "Touching"], ["150", "150 mm"], ["300", "300 mm"], ["450", "450 mm"], ["600", "600 mm"]];
    if (A.id === "IEC-LV") { if (!air) h += row(sel("spacing", "Clearance between circuits", sp)); }
    else h += row(sel("spacing", "Spacing between cables/circuits", sp),
      !air ? sel("formation", "Formation", [["flat", "Side by side (flat)"], ["trefoil", "Trefoil"]]) : num("racks", "Number of trays/racks stacked", { step: 1, min: 1 }));
    if (!hv) h += row(num("minSize", "Minimum conductor size", { suffix: "mm²", hint: "Leave empty for the code minimum (NBC 207 Nepal: 4 mm² Cu power; IEC: 1.5 mm² Cu; aluminium 16 mm²)." }));
    if (A.options.extraRoute) h += A.options.extraRoute(S, { num, sel, row });
  }
  $("#route-fields").innerHTML = h;

  // 3 cable
  h = row(sel("material", "Conductor", [["cu", "Copper — smaller, easier to terminate"], ["al", "Aluminium — cheaper, lighter, bigger"]], { struct: true }));
  if (eng() || hv) {
    h += row(sel("insulation", "Insulation", A.options.insulations, { struct: true }),
      sel("cores", "Cores", A.options.cores, { struct: true }),
      A.options.noArmour ? "" : sel("armoured", "Armour", [["true", "Armoured"], ["false", "Unarmoured"]]));
  }
  $("#cable-fields").innerHTML = h;

  // 4 checks
  h = row(num("vdLimitPct", "Allowed voltage drop", { suffix: "%", hint: hv ? "NEA planning uses 5 % at the far end of an 11 kV or 33 kV feeder." : "5 % from the meter to the farthest point; 3 % if lights are sensitive." }));
  if (!hv) h += row(sel("trafoKva", UI.en.trafo, TRAFO_KVA.map((k) => [k, `${k} kVA`]), { hint: UI.en.trafoHint }),
    num("supplyM", UI.en.supplyM, { suffix: "m", hint: UI.en.supplyHint }), sel("supplyMm2", UI.en.supplyMm2, SUPPLY_MM2.map((k) => [k, `${k} mm²`])));
  if (!hv) h += row(sel("earthing", UI.en.earthing, [["TT", UI.en.earthTT], ["TN", UI.en.earthTN]], { hint: UI.en.earthingHint }), num("earthRa", UI.en.earthRa, { suffix: "Ω", hint: UI.en.earthRaHint }));
  if (!hv) h += row(num("h3", "Third harmonic share of the phase current", { suffix: "%", hint: "0 for no electronics. Above 15 % the neutral is full size and the cable is derated (EIG Fig. G19)." }),
    sel("curve", "Breaker curve", [["B", "B (trips at 3 to 5 × In)"], ["C", "C (5 to 10 × In)"], ["D", "D (10 to 20 × In)"]]),
    check("tripOn", "Check that the breaker trips for a fault at the far end", false));
  h += check("faultOn", hv || eng() ? "Check short-circuit withstand" : "Check short-circuit withstand (needed for a feeder straight from a transformer, or one protected by fuses)");
  if (!hv && S.faultOn) h += row(sel("faultBasis", "Fault data", [["kat", "Fault current and clearing time"], ["i2t", "Breaker/fuse let-through energy I²t (fast devices)"]], { struct: true,
    hint: "Below 0.1 s a current-limiting MCB, MCCB or HRC fuse lets through much less energy than I²·t. Take I²t from the device catalogue." }));
  if (!hv && S.faultOn && S.faultBasis === "i2t") h += row(num("i2t", "Let-through energy", { suffix: "A²s", hint: "Example: a 32 A class-3 MCB at 6 kA lets through about 30 000–45 000 A²s." }));
  else if (S.faultOn) h += row(num("faultKa", "Fault current", { suffix: "kA", hint: hv ? "From the NEA substation data. 11 kV: often 10–20 kA." : "If unknown, use the breaker's breaking capacity (6 kA for a home MCB, 10–50 kA near a transformer)." }),
    num("faultT", "Time to clear the fault", { suffix: "s", hint: hv ? "Relay plus breaker time; 1 s is the common design value." : "0.1 s for an MCB/MCCB instantaneous trip; longer for fuses with time delay." }));
  if (!hv && (S.loadType === "motor" || eng())) {
    h += check("motorStartOn", "Check the voltage dip when the motor starts");
    if (S.motorStartOn) h += row(num("startMult", "Starting current", { suffix: "× FLC", hint: "Direct-on-line 6–7, star-delta 2–3, soft starter 3–4, VFD 1.2." }),
      num("startPf", "Starting power factor", { step: 0.05 }), num("vdStartLimitPct", "Allowed dip while starting", { suffix: "%" }));
  }
  if (eng() && !hv) h += row(sel("sizeOn", "Size the cable on", [["device", "The breaker rating (In ≤ Iz) — normal"], ["current", "The load current (Ib ≤ Iz) — no overload device"]]));
  $("#check-fields").innerHTML = h;
}

function unitSel(units) {
  if (!units.includes(S.unit)) S.unit = units[0];
  return `<select name="unit" aria-label="Unit" data-struct style="border-left:0">${units.map((u) => `<option${u === S.unit ? " selected" : ""}>${u}</option>`).join("")}</select>`;
}

// ---------- simple-mode mapping ----------
function buildInput() {
  const hv = S.level === "HV";
  const A = adapter();
  const notes = [];
  const L = LOADS[S.loadType] || LOADS.house;
  const inp = {
    system: S.system, voltage: Number(S.voltage), material: S.material, insulation: S.insulation,
    cores: S.cores, armoured: S.armoured === true || S.armoured === "true", method: S.method,
    env: { airTemp: +S.airTemp, groundTemp: +S.groundTemp, soilRes: +S.soilRes, depthMm: +S.depthMm },
    group: { count: Math.max(1, Math.round(+S.groupCount || 1)), spacing: S.spacing, formation: S.formation, racks: +S.racks || 1 },
    lengthM: +S.lengthM, vdLimitPct: +S.vdLimitPct, vdStartLimitPct: +S.vdStartLimitPct,
    load: { power: +S.power, unit: S.unit, pf: +S.pf, eff: +S.eff },
    designMargin: (+S.margin || 0) / 100, motorFactor: +S.motorFactor || 1,
    fault: !S.faultOn ? null : S.faultBasis === "i2t" && S.level !== "HV" ? { i2t: +S.i2t } : { ka: +S.faultKa, timeS: +S.faultT },
    motorStart: S.motorStartOn ? { multiple: +S.startMult, pf: +S.startPf } : null,
    sizeOn: S.sizeOn,
  };
  if (hv) {
    inp.system = "3ph"; inp.voltage = S.hvKv * 1000; inp.sizeOn = "current"; inp.motorStart = null; inp.motorFactor = 1;
    inp.grade = String(S.hvKv) === "11" && S.hvEarth === "UE" ? "11UE" : String(S.hvKv);
    inp.hvSource = S.hvSource || "polycab";
    if (inp.grade === "3.3") inp.cores = "3";
    if (S.unit === "MVA") inp.load = { power: +S.power * 1000, unit: "kVA" };
    if (A.options.depthDefault && !eng()) inp.env.depthMm = A.options.depthDefault(S.hvKv);
    if (!A.options.cores.some(([c]) => c === inp.cores)) inp.cores = A.options.cores[0][0];
    if (!A.options.insulations.some(([c]) => c === inp.insulation)) inp.insulation = A.options.insulations[0][0];
    return { inp, notes };
  }
  if (inp.system === "1ph" && !eng()) inp.voltage = 230;
  if (inp.system === "3ph" && !eng()) inp.voltage = 400;
  if (!eng()) {
    inp.load.pf = L.pf; inp.load.eff = L.eff ?? 1; inp.designMargin = L.margin ?? 0;
    inp.motorFactor = L.motor ? 1.25 : 1;
    if (L.motor) { inp.motorStart = S.motorStartOn ? inp.motorStart : { multiple: 6, pf: 0.3 }; inp.load.shaftOutput = true; }
    if (S.std === "IS" && S.region !== "custom") {
      const R = REGIONS[S.region]; inp.env.airTemp = R.air; inp.env.groundTemp = R.ground;
      notes.push(`Climate: ${R.label.split(" (")[0]} — air ${R.air} °C, ground ${R.ground} °C.`);
    }
    inp.insulation = A.options.insulations[0][0];
    inp.cores = A.simpleCores ? A.simpleCores(inp, L) : inp.system === "1ph" || inp.system === "dc" ? "2" : L.motor ? "3" : "4";
    inp.armoured = !(A.isAir ? A.isAir(S.method) : S.method === "air");
    notes.push(`Assumed power factor ${inp.load.pf}${L.eff ? `, efficiency ${L.eff}` : ""}${inp.designMargin ? `, ${inp.designMargin * 100} % spare capacity` : ""}${L.motor ? ", motor branch factor 1.25 and direct-on-line start at 6× current" : ""}.`);
  }
  if (inp.system === "dc") inp.cores = inp.cores === "1" ? "1" : "2";
  if (A.id === "IEC-LV" && !eng()) inp.armoured = S.method === "D2";
  if (A.id === "IEC-LV" && ["A1", "B1"].includes(S.method)) { inp.armoured = false; if (!eng()) inp.insulation = "PVC"; }
  // Code minimum sizes
  if (S.minSize !== "" && S.minSize != null && eng()) { inp.minSize = +S.minSize; inp.minSizeRule = "your setting"; }
  else if (inp.material === "al") { inp.minSize = 16; inp.minSizeRule = "aluminium in fixed installations, IEC 60364-5-52 Table 52.2"; }
  else if (A.id === "IS-LV") { inp.minSize = 4; inp.minSizeRule = "power circuits, Nepal NBC 207 (2.5 mm² for lighting only)"; }
  else { inp.minSize = 1.5; inp.minSizeRule = "copper power and lighting circuits, IEC 60364-5-52 Table 52.2"; }
  protectionInputs(inp, "main", 0, "dol");
  return { inp, notes };
}

// ---------- results ----------
let last = null;
function compute() {
  const plannerKind = !eng() ? JOBS[S.job]?.kind : null;
  const fig = document.querySelector(".xsec");
  if (fig) fig.hidden = plannerKind === "pfc" || plannerKind === "pv";
  if (plannerKind === "pfc" || plannerKind === "pv") {
    last = {};
    try { plannerKind === "pfc" ? renderPfc() : renderPv(); } catch (e) { $("#answer").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    return;
  }
  if (!eng() && JOBS[S.job]?.kind === "line") {
    try { const r = sizeLine(DATA.overhead, lineSpec()); last = { line: r }; renderLineResult(r); }
    catch (e) { $("#answer").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    return;
  }
  let A = adapter();
  let res, err = null, notes = [], simple = null;
  try {
    const b = eng() ? buildInput() : buildSimple();
    notes = b.notes; simple = b.simple || null; A = b.A || A;
    res = sizeConductor(A, b.inp);
  } catch (e) { err = e.message; }
  last = { res, err, notes, A, simple };
  renderResult();
}

function meter(label, value, limit, unit, good) {
  const pct = Math.max(2, Math.min(100, (value / limit) * 100));
  return `<div class="meter${good ? "" : " bad"}"><div class="top-line"><span>${good ? ic("check", 15) : ic("x", 15)} ${label}</span><b>${fmt(value)} / ${fmt(limit)} ${unit}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}
const kvRow = (icon, label, value) => `<div class="kvr">${ic(icon, 17)}<span>${label}</span><b>${value}</b></div>`;

// Engine warnings are English; translate the common ones for Nepali Simple mode.
const WARN_NE = [
  ["Motor circuits:", "मोटर सर्किट: मोटरका लागि बनेको MCCB/MPCB वा फ्यूज + ओभरलोड रिले छान्नुहोस्; देखाइएको रेटिङ तारका लागि न्यूनतम हो।"],
  ["Single-core AC cables", "सिङ्गल-कोर AC केबलमा स्टिल आर्मर हुनु हुँदैन; एल्युमिनियम आर्मर प्रयोग गर्नुहोस्।"],
  ["Cable runs close to", "पूरा भारमा तार आफ्नो अधिकतम तापक्रम नजिक चल्छ।"],
  ["No size up to", "कुनै पनि मानक साइज पुगेन: उच्च भोल्टेज, छोटो बाटो वा तामा प्रयोग गर्नुहोस्।"],
  ["Third harmonics", "तेस्रो हार्मोनिकले न्युट्रलमा लोड बढाउँछ: न्युट्रल पूरै साइजको छ र तार घटाइएको छ।"],
  ["With ", "तेस्रो हार्मोनिक १५ % भन्दा बढी हुँदा न्युट्रल पूरै साइजको हुनुपर्छ: ३½-कोर होइन, ४-कोर तार प्रयोग गर्नुहोस्।"],
];
const warnText = (w) => (S.lang === "ne" && !eng() ? (WARN_NE.find(([k]) => w.startsWith(k))?.[1] ?? w) : w);

/** Printed marking, like the text along a real cable sheath. */
function sheathPrint(parts) {
  const line = ["CABLECALC NEPAL", ...parts].join("  ◆  ");
  return `<div class="sheath-print" title="${esc(line)}"><span>${esc(line)}</span></div>`;
}

function renderResult() {
  const { res, err, notes, A } = last;
  const ans = $("#answer"), work = $("#working"), sticky = $("#sticky");
  $("#w-h").innerHTML = `${ic("calc", 22)} ${tr("calcTitle")}`;
  $("#copy").innerHTML = `${ic("copy", 16)} ${tr("copy")}`;
  $("#print").innerHTML = `${ic("print", 16)} ${tr("print")}`;
  if (err) {
    ans.innerHTML = `<p class="err">${ic("alert", 16)} ${esc(err)}</p>`; work.innerHTML = ""; sticky.textContent = ""; drawCable($("#xsec"), null); $("#xsec-cap").textContent = "";
    return;
  }
  const c = res.chosen, s = res.spec, hv = s.voltage > 1100;
  const grade = A.voltageGrade instanceof Function ? A.voltageGrade(s) : A.voltageGrade;
  drawCable($("#xsec"), c ? { cores: s.cores, size: c.size, material: s.material, armoured: s.armoured, hv, kv: s.voltage / 1000, single: s.cores === "1" } : null);
  $("#xsec-cap").textContent = c ? (s.cores === "1" ? tr("xsecCore") : tr("xsecCable")) : "";
  let h = "";
  if (!c) {
    h = `<div class="fail-box"><p class="buy">${ic("alert", 20)} ${tr("noCable")}</p>${res.warnings.map((w) => `<p>${esc(warnText(w))}</p>`).join("")}</div>`;
    sticky.textContent = tr("noCable");
  } else {
    h += sheathPrint([`${s.cores === "1" ? "1C" : s.cores + "C"} × ${c.size} mm² ${s.material === "cu" ? "CU" : "AL"}`, s.insulation === "HRPVC" ? "HR-PVC" : s.insulation,
      s.armoured ? "ARMOURED" : "UNARMOURED", grade.replace(" grade", ""), `${Math.ceil(s.lengthM * 1.1)} M`]);
    h += `<p class="ask">${ic("cart", 16)} ${tr("askFor")}</p><p class="buy">${esc(cableDescription(res, grade))}</p>`;
    h += `<div class="kvs">`;
    h += kvRow("ruler", tr("order"), `${Math.ceil(s.lengthM * 1.1)} m${res.runs > 1 ? ` × ${res.runs}` : ""}`);
    h += kvRow("zap", tr("loadI"), `${fmt(res.current.I)} A`);
    if (Math.abs(res.current.Ib - res.current.I) > 0.01) h += kvRow("zap", tr("designI"), `${fmt(res.current.Ib)} A`);
    if (res.current.In) h += kvRow("shield", tr("breaker"), `${res.current.In} A${s.system === "1ph" ? " DP" : s.system === "3ph" ? (s.cores === "3" ? " TP" : " TPN") : ""}`);
    if (hv) h += kvRow("shield", tr("relayMax"), `${fmt(c.iz * res.runs, 0)} A`);
    if (hv) h += kvRow("earth", tr("screen"), tr("screenChk"));
    else h += kvRow("earth", tr("earth"), `${res.earthSize} mm² ${s.material === "cu" ? "Cu" : "Al"}`);
    h += `</div>`;
    h += meter(tr("mI"), res.current.basis / res.runs, c.iz, "A", c.pass.ampacity);
    h += meter(tr("mVd"), c.vdPct, s.vdLimitPct, "%", c.pass.voltageDrop);
    if (c.vdStartPct != null) h += meter(tr("mStart"), c.vdStartPct, s.vdStartLimitPct, "%", c.pass.motorStart);
    if (c.scMin != null) h += meter(tr("mFault"), c.scMin, c.size, "mm²", c.pass.shortCircuit);
    const DEC_NE = { "current-carrying capacity": "करेन्ट बोक्ने क्षमता", "voltage drop": "भोल्टेज ड्रप", "motor starting voltage dip": "मोटर सुरु हुँदा भोल्टेज झर्ने", "short-circuit withstand": "सर्ट सर्किट सहने क्षमता", "smallest size in the table": "तालिकाको सबैभन्दा सानो साइज" };
    const ne = S.lang === "ne" && !eng();
    const dec = res.decidedBy.map((d) => (ne ? (DEC_NE[d] || DEC_BOOK_NE[d] || (d.startsWith("the minimum size rule") ? "न्यूनतम साइजको नियम (NBC 207 / IEC)" : d)) : d));
    h += `<p class="decided">${ic("info", 16)}<span>${tr("decided")} <b>${esc(dec.join(ne ? " र " : " and "))}</b>.</span></p>`;
    if (last.simple) h += renderSimpleResult(res, last.simple);
    const allNotes = [...(last.simple ? [] : notes.filter((n) => !n.startsWith("Climate") || !eng())), ...res.warnings.map(warnText)];
    if (allNotes.length) h += `<ul class="notes">${allNotes.map((n) => `<li>${ic("alert", 15)}<span>${esc(n)}</span></li>`).join("")}</ul>`;
    sticky.textContent = `${res.runs > 1 ? res.runs + " × " : ""}${c.size} mm² ${s.material === "cu" ? "Cu" : "Al"}${res.current.In ? ` · ${res.current.In} A` : ""}`;
  }
  ans.innerHTML = h;
  work.innerHTML = renderWorking(res, A);
}

function renderWorking(res, A) {
  const s = res.spec, c = res.chosen;
  const sys = s.system === "3ph" ? "I = P / (√3 × U × pf × η)" : s.system === "dc" ? "I = P / (U × η)" : "I = P / (U × pf × η)";
  let h = `<p class="lead-s">${tr("calcLead")}</p><h3>${tr("steps")}</h3><ol class="trail">`;
  h += `<li><b>${tr("w1")}</b> ${sys} = <b>${fmt(res.current.I, 2)} A</b> (${fmt(s.load.power)} ${s.load.unit}, ${fmt(s.voltage, 0)} V${s.load.unit !== "kVA" && s.load.unit !== "A" ? `, pf ${s.load.pf}` : ""}).</li>`;
  if (Math.abs(res.current.Ib - res.current.I) > 0.01) h += `<li><b>${tr("w2")}</b> Ib = I × (1 + ${fmt(s.designMargin * 100, 0)} %) × ${s.motorFactor} = <b>${fmt(res.current.Ib, 2)} A</b>.</li>`;
  if (res.current.In) h += `<li><b>${tr("w3")}</b> In = <b>${res.current.In} A</b>. ${tr("w3b")}</li>`;
  else h += `<li><b>${tr("w3hv")}</b> ${tr("w3hvb")}</li>`;
  if (c) {
    h += `<li><b>${tr("w4")}</b><div class="tablewrap"><table><thead><tr><th>${tr("tFactor")}</th><th class="l">${tr("tBasis")}</th><th>${tr("tValue")}</th></tr></thead><tbody>${c.factors.map((f) => `<tr><td>${esc(f.label)}</td><td class="l">${esc(f.basis)}</td><td>${f.value.toFixed(3)}</td></tr>`).join("")}<tr><td><b>k</b></td><td class="l">${tr("tProduct")}</td><td><b>${c.k.toFixed(3)}</b></td></tr></tbody></table></div></li>`;
    h += `<li><b>${tr("w5")}</b> = ${fmt(res.current.basis / res.runs, 1)} A ÷ ${c.k.toFixed(3)} = <b>${fmt(res.current.basis / res.runs / c.k, 1)} A</b>${res.runs > 1 ? ` (${res.runs} × ${tr("parallel")})` : ""}.</li>`;
    h += `<li><b>${tr("w6")}</b> ΔU = ${s.system === "3ph" ? "√3" : "2"} × I × L × (R cos φ + X sin φ) = <b>${fmt(c.vd, 2)} V (${fmt(c.vdPct, 2)} %)</b>.</li>`;
    if (c.lmax != null) h += `<li><b>${tr("w7min")}</b> Lmax = 0.8·U·S / (ρ·(1 + m)·Ia) = <b>${fmt(c.lmax, 0)} m</b> ≥ ${fmt(s.lengthM, 0)} m (Ia = ${fmt(res.iaTrip, 0)} A, ${S.earthing === "TN" ? "TN" : "TT"}).</li>`;
    if (c.scMin != null && s.fault.i2t) h += `<li><b>${tr("w7")}</b> S ≥ √(I²t) / k = √${s.fault.i2t} ÷ ${kValue(s.insulation, s.material, c.size)} = <b>${fmt(c.scMin, 1)} mm²</b>.</li>`;
    else if (c.scMin != null) h += `<li><b>${tr("w7")}</b> S ≥ I·√t / k = ${s.fault.ka * 1000} A × √${s.fault.timeS} s ÷ ${kValue(s.insulation, s.material, c.size)} = <b>${fmt(c.scMin, 1)} mm²</b>.</li>`;
    else if (s.voltage <= 1100) {
      const w = scWithstand(res), ne = S.lang === "ne" && !eng();
      h += `<li><b>${tr("w7")}</b> ${ne
        ? `${S.trafoKva} kVA ट्रान्सफर्मर${+S.supplyM > 0 ? ` र ${S.supplyM} m सप्लाई कन्डक्टर` : ""}ले तारको सुरुमा ${fmt(w.isc, 1)} kA सम्म दिन्छ। यो तारले (k·S)² = (${w.k} × ${c.size})² = ${fmt(w.allow / 1000, 0)} kA²s सहन्छ, त्यसैले फल्ट ${fmtMs(w.tMs)} ms भित्र कट्नुपर्छ। ब्रेकरको डाटाशिटको I²t यसभन्दा कम छ कि जाँच्नुहोस्।`
        : `A ${S.trafoKva} kVA transformer${+S.supplyM > 0 ? ` and ${S.supplyM} m of ${S.supplyMm2} mm² supply conductor give` : " gives up to"} ${fmt(w.isc, 1)} kA at the cable start. This cable withstands (k·S)² = (${w.k} × ${c.size})² = <b>${fmt(w.allow / 1000, 0)} kA²s</b>, so the fault must clear within <b>${fmtMs(w.tMs)} ms</b>. Check the breaker's datasheet let-through I²t is below that. To size the cable on a chosen fault level and time instead, turn on "Check short-circuit withstand" in Engineer mode.`}</li>`;
    }
    h += `<li><b>${tr("w8")} ${c.size} mm²</b> (${tr("w8b")} ${fmt(c.theta, 0)} °C).</li>`;
  }
  const hasStart = res.candidates.some((x) => x.vdStartPct != null), hasSc = res.candidates.some((x) => x.scMin != null), hasLmax = res.candidates.some((x) => x.lmax != null);
  h += `</ol><h3>${ic("table", 20)} ${tr("tried")}</h3><p>${tr("triedLead")}</p>`;
  const cols = [["tSize", "lSize"], ["tTable", "lTable"], ["tK", "lK"], ["tDerated", "lDerated"], ["tNeeds", "lNeeds"], ["tVd", "lVd"],
    ...(hasStart ? [["tStart", "lStart"]] : []), ...(hasSc ? [["tFault", "lFault"]] : []), ...(hasLmax ? [["tLmax", "lLmax"]] : []), ["tResult", "lResult"]];
  h += `<dl class="legend">${cols.map(([t, l]) => `<dt>${tr(t)}</dt><dd>${tr(l)}</dd>`).join("")}</dl>`;
  h += `<div class="tablewrap"><table><thead><tr>${cols.map(([t], i) => `<th${i === cols.length - 1 ? ' class="l"' : ""}>${tr(t)}</th>`).join("")}</tr></thead><tbody>`;
  const need = res.current.basis / res.runs;
  const WHYK = { ampacity: "fHot", voltageDrop: "fVd", motorStart: "fStart", shortCircuit: "fFault", minFault: "fLmax" };
  for (const x of res.candidates) {
    const why = Object.entries(x.pass).filter(([, v]) => !v).map(([k]) => tr(WHYK[k]));
    h += `<tr class="${x === c ? "chosen" : ""}"><td>${x.size}</td><td>${fmt(x.amp, 0)}</td><td>${x.k.toFixed(3)}</td><td class="${x.pass.ampacity ? "" : "no"}">${fmt(x.iz, 1)}</td><td>${fmt(need, 1)}</td><td class="${x.pass.voltageDrop ? "" : "no"}">${fmt(x.vdPct, 2)}</td>${hasStart ? `<td class="${x.pass.motorStart ? "" : "no"}">${fmt(x.vdStartPct, 1)}</td>` : ""}${hasSc ? `<td class="${x.pass.shortCircuit ? "" : "no"}">${fmt(x.scMin, 1)}</td>` : ""}${hasLmax ? `<td class="${x.pass.minFault ? "" : "no"}">${fmt(x.lmax, 0)}</td>` : ""}<td class="l ${x.ok ? "yes" : "no"}">${x.ok ? (x === c ? "✓ " + tr("rChosen") : tr("rPass")) : "✗ " + why.join(", ")}</td></tr>`;
  }
  h += `</tbody></table></div><p><small>${tr("dataSrc")} ${esc(A.title)}. <a href="guide.html">${tr("guideLink")}</a></small></p>`;
  return h;
}

// Result and calculation strings (merged into UI below).
const RT = {
  en: { calcTitle: "How this answer was calculated", copy: "Copy result", print: "Print or save PDF",
    xsecCore: "One core, drawn to scale (approx.)", xsecCable: "Cable cross-section, drawn to scale (approx.)",
    noCable: "No standard cable works for this.", askFor: "Ask the shop for", order: "Length to order (10 % spare)",
    loadI: "Load current", designI: "Design current", breaker: "Breaker / fuse", relayMax: "Relay setting, at most",
    screen: "Metallic screen", screenChk: "check earth-fault rating", earth: "Earth wire",
    mI: "Current vs cable capacity", mVd: "Voltage drop", mStart: "Dip when the motor starts", mFault: "Size needed for a fault",
    calcLead: "Every number above comes from these steps. Engineers can check each one against the standard named.",
    steps: "Step by step", w1: "Load current.", w2: "Design current (spare and motor factor).", w3: "Breaker rating:",
    w3b: "the next standard size. The cable must carry at least this after derating (Ib ≤ In ≤ Iz, IEC 60364-4-43).",
    w3hv: "Sizing basis.", w3hvb: "HV cables are sized on the load current; the relay is then set at or below the cable's rating.",
    w4: "Rating factors for the chosen size:", tFactor: "Factor", tBasis: "Basis", tValue: "Value", tProduct: "all factors multiplied",
    w5: "Required table rating", parallel: "cables in parallel", w6: "Voltage drop:", w7: "Short circuit:",
    w8: "Smallest size passing every check:", w8b: "estimated conductor temperature at full load",
    tried: "Every cable size tested",
    triedLead: "The calculator tries every standard size from the smallest up and keeps the first one that passes all checks. Red numbers show which check a size fails.",
    tSize: "Size mm²", lSize: "cross-section of each conductor",
    tTable: "Table A", lTable: "current it carries in standard conditions (catalogue/standard table)",
    tK: "× k", lK: "total derating factor for your temperature, soil, depth and neighbouring cables",
    tDerated: "Derated A", lDerated: "Table A × k: what it can safely carry where you install it",
    tNeeds: "Needs A", lNeeds: "what it must carry: the breaker rating (LV) or the load current (HV)",
    tVd: "VD %", lVd: "voltage lost along the cable at full load",
    tStart: "Start dip %", lStart: "voltage lost for a moment while the motor starts",
    tFault: "Fault needs mm²", lFault: "smallest size that survives a short circuit until it is cleared",
    tResult: "Result", lResult: "the chosen size is the smallest one that passes everything",
    fHot: "overheats", fVd: "too much voltage drop", fStart: "motor start dip", fFault: "fails short circuit",
    rChosen: "chosen", rPass: "passes", dataSrc: "Data:", guideLink: "How cable sizing works" },
  ne: { calcTitle: "यो उत्तर कसरी निकालियो", copy: "नतिजा कपी गर्नुहोस्", print: "प्रिन्ट वा PDF",
    xsecCore: "एउटा कोर, नापअनुसार (अनुमानित)", xsecCable: "केबलको काटिएको भाग, नापअनुसार (अनुमानित)",
    noCable: "यसका लागि कुनै मानक तार पुग्दैन।", askFor: "पसलमा यसरी माग्नुहोस्", order: "किन्ने लम्बाइ (१० % थप)",
    loadI: "भारको करेन्ट", designI: "डिजाइन करेन्ट", breaker: "ब्रेकर / फ्यूज", relayMax: "रिले सेटिङ, बढीमा",
    screen: "मेटालिक स्क्रिन", screenChk: "अर्थ-फल्ट रेटिङ जाँच्नुहोस्", earth: "अर्थ तार",
    mI: "करेन्ट र तारको क्षमता", mVd: "भोल्टेज ड्रप", mStart: "मोटर सुरु हुँदा भोल्टेज झर्ने", mFault: "फल्टका लागि चाहिने साइज",
    calcLead: "माथिका सबै अंक यी चरणबाट निकालिएका हुन्। इन्जिनियरले हरेक चरण उल्लेखित मापदण्डसँग जाँच्न सक्छन्।",
    steps: "चरणबद्ध", w1: "भारको करेन्ट।", w2: "डिजाइन करेन्ट (थप र मोटर फ्याक्टर)।", w3: "ब्रेकर रेटिङ:",
    w3b: "अर्को मानक साइज। घटाएपछि पनि तारले कम्तीमा यति बोक्नुपर्छ (Ib ≤ In ≤ Iz)।",
    w3hv: "नाप्ने आधार।", w3hvb: "HV तार भारको करेन्टमा नापिन्छ; रिले तारको क्षमताभन्दा कममा सेट गरिन्छ।",
    w4: "छानिएको साइजका रेटिङ फ्याक्टर:", tFactor: "फ्याक्टर", tBasis: "आधार", tValue: "मान", tProduct: "सबै फ्याक्टरको गुणनफल",
    w5: "चाहिने तालिका रेटिङ", parallel: "समानान्तर तार", w6: "भोल्टेज ड्रप:", w7: "सर्ट सर्किट:",
    w8: "सबै जाँच पास गर्ने सबैभन्दा सानो साइज:", w8b: "पूरा भारमा तारको अनुमानित तापक्रम",
    tried: "जाँचिएका सबै साइज",
    triedLead: "सबैभन्दा सानो साइजदेखि माथि हरेक मानक साइज जाँचिन्छ र सबै जाँच पास गर्ने पहिलो साइज छानिन्छ। रातो अंकले कुन जाँचमा फेल भयो देखाउँछ।",
    tSize: "साइज mm²", lSize: "हरेक कन्डक्टरको क्षेत्रफल",
    tTable: "तालिका A", lTable: "मानक अवस्थामा बोक्ने करेन्ट (क्याटलग/मापदण्डको तालिका)",
    tK: "× k", lK: "तापक्रम, माटो, गहिराइ र छेउका तारअनुसार घटाउने कुल फ्याक्टर",
    tDerated: "घटाएपछि A", lDerated: "तालिका A × k: तपाईंको ठाउँमा सुरक्षित बोक्ने करेन्ट",
    tNeeds: "चाहिने A", lNeeds: "बोक्नुपर्ने करेन्ट: ब्रेकर रेटिङ (LV) वा भारको करेन्ट (HV)",
    tVd: "VD %", lVd: "पूरा भारमा तारमा गुम्ने भोल्टेज",
    tStart: "सुरुको झराइ %", lStart: "मोटर सुरु हुँदा क्षणभर गुम्ने भोल्टेज",
    tFault: "फल्टका लागि mm²", lFault: "सर्ट सर्किट नकाटिउन्जेल नबिग्रिने सबैभन्दा सानो साइज",
    tResult: "नतिजा", lResult: "सबै जाँच पास गर्ने सबैभन्दा सानो साइज छानिन्छ",
    fHot: "धेरै तातिन्छ", fVd: "भोल्टेज ड्रप बढी", fStart: "मोटर सुरुमा झराइ बढी", fFault: "सर्ट सर्किटमा फेल",
    rChosen: "छानिएको", rPass: "पास", dataSrc: "डाटा:", guideLink: "तार नाप्ने तरिका" },
};


// ======================================================================
// Simple mode: start from the job (Nepal), ask what people can see, explain every term.
// ======================================================================
const UI = {
  en: { s1: "What is the cable for?", s2: "About the load", s3: "Where the cable runs", s4: "The cable",
    job: "Choose the job", phase: "Supply", ph1: "Single phase, 230 V (most houses)", ph3: "Three phase, 400 V",
    houseBasis: "Size it from", hbMeter: "My NEA meter category (on the bill)", hbLoad: "The appliances I use and will add",
    meterA: "NEA meter capacity", kwNow: "Power used at the same time now", kwFuture: "Power you plan to add later",
    kw: "Rated power (on the nameplate)", acBasis: "I know", acTon: "Capacity (ton)", amps: "Nameplate current",
    acInverter: "Inverter AC?", yes: "Yes, inverter", no: "No, fixed speed", pumpType: "Type",
    motorBasis: "From the nameplate I know", mbHp: "Power in HP", mbAmps: "Current in amps (best)", hp: "Motor power",
    starter: "How it is started", evKw: "Charger", hvKv: "Supply voltage", kva: "Transformer size",
    faultKa: "Fault level at your point of supply", faultT: "Time for the relay and breaker to clear a fault",
    route: "How the cable is laid", region: "Where in Nepal", custom: "Somewhere else — I'll enter temperatures",
    lengthM: "Cable length, one way", groupCount: "Circuits run together in the same pipe, tray or trench",
    material: "Conductor", cu: "Copper — needed inside buildings", al: "Aluminium — cheaper for big, long runs",
    airTemp: "Hottest air temperature", groundTemp: "Ground temperature at the cable",
    decided: "Size decided by", vTitle: "Voltage your appliance gets", vNom: "When NEA supplies", vLow: "When NEA is at its −5 % limit",
    vBad: "Below 90 % of nominal: motors overheat and may not start. Use a bigger cable or move the board closer.",
    prot: "Protection to fit", whyNot: "Why not", wouldIt: "It would", assum: "What this answer assumes", shop: "At the shop: check before you pay",
    earth: "Earth conductor", ph3note: "Three phase: phase-to-neutral voltage shown.",
    shopList: ["The sheath is printed with the maker, the standard (IS 694, IS 1554, IS 7098), the size in mm², the cores and the voltage grade.",
      "ISI or NS mark. Scrape a strand: copper must be copper all through, not copper-coated aluminium.",
      "Weigh or measure: thin '2.5 mm²' wire is common. Compare the coil weight with the maker's catalogue.",
      "Buy the length shown (10 % extra). Use crimped lugs of the right size; bimetallic lugs between aluminium and copper.",
      "Before switching on: insulation test with a 500 V tester (at least 1 MΩ; new cable is usually hundreds of MΩ) and press the RCD test button."] },
  ne: { s1: "तार केका लागि हो?", s2: "भारबारे", s3: "तार कहाँबाट जान्छ", s4: "तार",
    job: "काम छान्नुहोस्", phase: "सप्लाई", ph1: "सिङ्गल फेज, २३० V (धेरैजसो घर)", ph3: "थ्री फेज, ४०० V",
    houseBasis: "कसरी नाप्ने", hbMeter: "मेरो NEA मिटरको क्षमता (बिलमा)", hbLoad: "अहिले र पछि चलाउने उपकरण",
    meterA: "NEA मिटरको क्षमता", kwNow: "अहिले सँगै चल्ने पावर", kwFuture: "पछि थप्ने पावर",
    kw: "रेटेड पावर (नेमप्लेटमा)", acBasis: "मलाई थाहा छ", acTon: "क्षमता (टन)", amps: "नेमप्लेटको करेन्ट",
    acInverter: "इन्भर्टर AC हो?", yes: "हो, इन्भर्टर", no: "होइन, फिक्स्ड स्पिड", pumpType: "प्रकार",
    motorBasis: "नेमप्लेटमा थाहा भएको", mbHp: "HP मा पावर", mbAmps: "एम्पियरमा करेन्ट (सबैभन्दा राम्रो)", hp: "मोटरको पावर",
    starter: "कसरी सुरु गरिन्छ", evKw: "चार्जर", hvKv: "सप्लाई भोल्टेज", kva: "ट्रान्सफर्मरको साइज",
    faultKa: "सप्लाई बिन्दुमा फल्ट लेभल", faultT: "रिले र ब्रेकरले फल्ट काट्ने समय",
    route: "तार कसरी राखिन्छ", region: "नेपालको कुन भागमा", custom: "अन्यत्र — तापक्रम म आफैं राख्छु",
    lengthM: "तारको लम्बाइ (एकतर्फी)", groupCount: "एउटै पाइप, ट्रे वा खाल्डोमा भएका सर्किट",
    material: "कन्डक्टर", cu: "तामा — भवनभित्र अनिवार्य", al: "एल्युमिनियम — ठूलो र लामो तारमा सस्तो",
    airTemp: "हावाको सबैभन्दा बढी तापक्रम", groundTemp: "तार रहेको जमिनको तापक्रम",
    decided: "साइज तय गर्ने कारण:", vTitle: "उपकरणमा पुग्ने भोल्टेज", vNom: "NEA ले दिँदा", vLow: "NEA −५ % सीमामा हुँदा",
    vBad: "नामिनलको ९० % भन्दा कम: मोटर तातिन्छ र सुरु नहुन सक्छ। ठूलो तार प्रयोग गर्नुहोस्।",
    prot: "राख्नुपर्ने सुरक्षा उपकरण", whyNot: "किन होइन", wouldIt: "यसले", assum: "यो उत्तरका मान्यताहरू", shop: "पसलमा: पैसा तिर्नुअघि जाँच्नुहोस्",
    earth: "अर्थ तार", ph3note: "थ्री फेज: फेज-न्युट्रल भोल्टेज देखाइएको।",
    shopList: ["खोलमा निर्माता, मापदण्ड (IS 694, IS 1554, IS 7098), साइज mm², कोर र भोल्टेज ग्रेड छापिएको हुनुपर्छ।",
      "ISI वा NS चिन्ह। तार खुर्केर हेर्नुहोस्: तामा भित्रसम्मै तामा हुनुपर्छ।",
      "तौल वा मोटाइ जाँच्नुहोस्: पातलो '२.५ mm²' तार धेरै पाइन्छ।",
      "देखाइएको लम्बाइ (१० % थप) किन्नुहोस्। सही साइजको लग क्रिम्प गर्नुहोस्; एल्युमिनियम-तामा बीच बाइमेटालिक लग।",
      "चलाउनुअघि ५०० V टेस्टरले इन्सुलेसन जाँच (कम्तीमा १ MΩ) र RCD को टेस्ट बटन थिच्नुहोस्।"] },
};
Object.assign(UI.en, RT.en); Object.assign(UI.ne, RT.ne);

// Short-circuit strings. Fault level comes from the transformer size (IS 1180: 4.5 % impedance up to 630 kVA).
const TRAFO_KVA = [50, 100, 200, 315, 500];
const SUPPLY_MM2 = [35, 50, 70, 95, 120];
Object.assign(UI.en, {
  supplyM: "Distance from the transformer to this cable's start",
  supplyHint: "Along the NEA line or cable, in metres. Enter 0 if unknown: the highest possible fault is then used, the safe choice.",
  supplyMm2: "NEA supply conductor, aluminium",
  scNoteDist: "Includes {m} m of {s} mm² aluminium supply conductor (cold resistance, IEC 60909) after a {t} kVA transformer with 4.5 % impedance.",
  trafo: "Transformer feeding your supply",
  trafoHint: "Read it on the transformer nameplate; NEA mostly uses 50, 100 and 200 kVA. If unsure, keep 200 kVA (the safe choice).",
  scTitle: "Short circuit", scFault: "Fault at the cable start", scAllow: "Energy this cable can take, (k·S)²",
  scTime: "Longest time the fault may last",
  scRule: "Fit a breaker or fuse that breaks at least {kA} kA and whose datasheet let-through energy (I²t) at that fault is below {E} kA²s. Fast, current-limiting MCBs and HRC fuses usually clear well within this; a time-delayed device may not.",
  scNote: "Taken at the transformer terminals (infinite source, 4.5 % impedance). Cable length lowers it, so this is an upper bound.",
});
Object.assign(UI.ne, {
  supplyM: "ट्रान्सफर्मरदेखि यो तारको सुरुसम्मको दूरी",
  supplyHint: "NEA को लाइन वा केबलको बाटो, मिटरमा। थाहा नभए ० राख्नुहोस्: त्यसबेला सबैभन्दा ठूलो सम्भावित फल्ट लिइन्छ, जुन सुरक्षित हो।",
  supplyMm2: "NEA को सप्लाई कन्डक्टर, एल्युमिनियम",
  scNoteDist: "{t} kVA ट्रान्सफर्मर (४.५ % इम्पिडेन्स) पछि {m} m, {s} mm² एल्युमिनियम सप्लाई कन्डक्टर समावेश (चिसो अवस्थाको रेजिस्टेन्स, IEC 60909)।",
  trafo: "तपाईंलाई सप्लाई दिने ट्रान्सफर्मर",
  trafoHint: "ट्रान्सफर्मरको नेमप्लेटमा हेर्नुहोस्; NEA ले प्रायः ५०, १०० र २०० kVA प्रयोग गर्छ। थाहा नभए २०० kVA नै राख्नुहोस् (सुरक्षित)।",
  scTitle: "सर्ट सर्किट", scFault: "तारको सुरुमा फल्ट करेन्ट", scAllow: "यो तारले सहने ऊर्जा, (k·S)²",
  scTime: "फल्ट रहन सक्ने अधिकतम समय",
  scRule: "कम्तीमा {kA} kA काट्न सक्ने ब्रेकर वा फ्यूज राख्नुहोस्, र यो फल्टमा डाटाशिटको let-through ऊर्जा (I²t) {E} kA²s भन्दा कम हुनुपर्छ। छिटो काट्ने, करेन्ट सीमित गर्ने MCB र HRC फ्यूजले प्रायः यसभित्रै काट्छ; ढिलो काट्ने उपकरणले नसक्न सक्छ।",
  scNote: "ट्रान्सफर्मरको टर्मिनलमा (अनन्त स्रोत, ४.५ % इम्पिडेन्स) लिइएको। तार लामो भए यो घट्छ, त्यसैले यो माथिल्लो सीमा हो।",
});

/** Prospective fault at the cable start and what the chosen cable can take (LV, from the transformer size). */
function lvFault(res) { return lvFaultSys(res.spec.system); }
function scWithstand(res) {
  const isc = lvFault(res);
  return { isc, ...faultWithstand(res.spec.insulation, res.spec.material, res.chosen.size, isc) };
}
const fmtMs = (ms) => fmt(ms, ms < 10 ? 1 : 0);
const tr = (k) => (eng() ? UI.en : UI[S.lang] || UI.en)[k] ?? UI.en[k] ?? k;
const L2 = (o) => (S.lang === "ne" && o.ne ? o.ne : o.en);
const STEP_EN = ["What the cable will power", "Where the cable runs", "The cable", "Checks"];
function setStepTitles(t) {
  const icons = ["plug", "route", "cable", "gauge"];
  ["#s1", "#s2", "#s3", "#s4"].forEach((id, i) => { const n = document.querySelector(id); if (n) n.innerHTML = `<span class="n">${ic(icons[i], 20)}</span> ${esc(t[i])}`; });
  const ne = !eng() && S.lang === "ne";
  document.querySelectorAll("[data-en]").forEach((el) => { el.innerHTML = ne && el.dataset.ne ? el.dataset.ne : el.dataset.en; });
  const s4 = document.querySelector("#s4")?.closest("section");
  if (s4) s4.hidden = t[3] === "";
}

const ICONS = {
  house: '<path d="M6 22 L24 8 L42 22" class="fa" stroke-linejoin="round"/><path d="M10 20 V40 H38 V20"/><rect x="20" y="28" width="8" height="12" class="fa"/><rect x="13" y="25" width="5" height="5"/><path d="M2 14 H8 M5 11 V40" stroke-width="1.5"/><path d="M8 14 C 14 16, 18 20, 20 22" stroke-dasharray="2 2" stroke-width="1.5"/>',
  heater: '<rect x="14" y="6" width="20" height="34" rx="6" class="fa"/><path d="M20 30 q2 -4 0 -8 q-2 -4 0 -8 M28 30 q2 -4 0 -8 q-2 -4 0 -8"/><circle cx="24" cy="35" r="1.8" fill="currentColor"/>',
  ac: '<rect x="5" y="10" width="38" height="14" rx="3" class="fa"/><path d="M9 19 H39"/><path d="M14 29 q-2 4 0 8 M24 29 q-2 4 0 8 M34 29 q-2 4 0 8"/>',
  pump: '<circle cx="18" cy="26" r="11" class="fa"/><circle cx="18" cy="26" r="4"/><path d="M29 26 H44 M18 15 V6 H30"/><path d="M36 30 q3 4 0 7 q-3 -3 0 -7" class="fw"/>',
  ev: '<path d="M6 30 L10 19 H32 L37 30 V36 H6 Z" class="fa"/><circle cx="13" cy="36" r="3.5" fill="var(--sheet)"/><circle cx="30" cy="36" r="3.5" fill="var(--sheet)"/><path d="M40 8 V20 M40 20 q0 6 -5 6" /><rect x="37" y="4" width="6" height="6" rx="1"/>',
  shop: '<path d="M6 16 H42 L39 7 H9 Z" class="fa"/><path d="M8 16 V40 H40 V16"/><rect x="20" y="27" width="8" height="13"/><path d="M12 22 H17 V28 H12 Z M31 22 H36 V28 H31 Z"/>',
  line: '<path d="M10 44 L16 8 L22 44 M12 32 H20 M14 20 H18"/><path d="M28 44 L34 8 L40 44 M30 32 H38 M32 20 H36"/><path d="M4 10 Q 25 18 46 10" class="acc-s"/><path d="M4 14 Q 25 22 46 14" class="acc-s"/>',
  hv: '<path d="M24 4 L15 44 M24 4 L33 44 M16 36 H32 M19 24 H29"/><path d="M8 11 H40" stroke-width="2.4"/><circle cx="10" cy="15" r="1.6" class="fa"/><circle cx="24" cy="15" r="1.6" class="fa"/><circle cx="38" cy="15" r="1.6" class="fa"/>',
};
const icon = (k) => `<svg class="jobart" viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ""}</svg>`;
ICONS.building = '<rect x="10" y="8" width="28" height="34" class="fa"/><path d="M16 14h4M28 14h4M16 22h4M28 22h4M16 30h4M28 30h4"/><rect x="21" y="34" width="6" height="8"/>';
ICONS.pfc = '<path d="M4 24H20M28 24H44"/><path d="M20 12V36M28 12V36" stroke-width="2.6"/><path d="M34 12l4-4M38 8h-4M38 8v4" stroke-width="1.6"/>';
ICONS.pv = '<path d="M8 38 L15 15 H41 L34 38 Z" class="fa"/><path d="M11 27 H37 M23 15 L19 38 M32 15 L28 38"/><circle cx="12" cy="9" r="3.5"/><path d="M12 2v2M5 9h2M19 9h-2" stroke-width="1.4"/>';
const ROUTE_HL = { building: "main", house: "main", heater: "heater", ac: "heater", pump: "pump", ev: "ev", shop: "main", hvfeed: "service" };

function renderSimple() {
  const job = JOBS[S.job] || JOBS.house;
  const lang = S.lang;
  setStepTitles([tr("s1"), tr("s3"), tr("s4"), ""]);
  let h = `<fieldset class="field jobs"><legend class="lbl">${tr("job")}</legend><div class="jobgrid">` +
    Object.entries(JOBS).map(([k, j]) => `<label class="jobcard"><input type="radio" name="job" value="${k}"${S.job === k ? " checked" : ""} data-struct>${icon(j.icon)}<span>${esc(L2(j))}</span></label>`).join("") +
    `</div></fieldset>`;
  if (job.level === "LV") h += `<div class="figwrap map">${houseMap(ROUTE_HL[S.job], lang)}</div>${explainHtml("run", lang)}`;
  else if (job.kind !== "line") h += explainHtml("hv", lang);
  const F = {
    phase: () => sel("phase", tr("phase"), [["1ph", tr("ph1")], ["3ph", tr("ph3")]], { struct: true }),
    houseBasis: () => sel("houseBasis", tr("houseBasis"), [["meter", tr("hbMeter")], ["load", tr("hbLoad")]], { struct: true }),
    meterA: () => sel("meterA", tr("meterA"), NEA_METERS.map((a) => [a, `${a} A`])),
    kwNow: () => num("kwNow", tr("kwNow"), { suffix: "kW" }),
    kwFuture: () => num("kwFuture", tr("kwFuture"), { suffix: "kW" }),
    kw: () => num("kw", tr("kw"), { suffix: "kW" }),
    acBasis: () => sel("acBasis", tr("acBasis"), [["ton", tr("acTon")], ["amps", tr("amps")]], { struct: true }),
    acTon: () => sel("acTon", tr("acTon"), S.lang === "ne" ? [["1", "१ टन (१२ ००० BTU)"], ["1.5", "१.५ टन (१८ ००० BTU)"], ["2", "२ टन (२४ ००० BTU)"]] : [["1", "1 ton (12 000 BTU)"], ["1.5", "1.5 ton (18 000 BTU)"], ["2", "2 ton (24 000 BTU)"]]),
    amps: () => num("amps", tr("amps"), { suffix: "A" }),
    acInverter: () => sel("acInverter", tr("acInverter"), [["yes", tr("yes")], ["no", tr("no")]]),
    pumpType: () => sel("pumpType", tr("pumpType"), Object.entries(PUMPS).map(([k, p]) => [k, L2(p)])),
    motorBasis: () => sel("motorBasis", tr("motorBasis"), [["hp", tr("mbHp")], ["amps", tr("mbAmps")]], { struct: true }),
    hp: () => num("hp", tr("hp"), { suffix: "HP" }),
    starter: () => sel("starter", tr("starter"), Object.entries(STARTERS).map(([k, p]) => [k, L2(p)])),
    evKw: () => sel("evKw", tr("evKw"), Object.entries(EV).map(([k, e]) => [k, S.lang === "ne" ? `${e.kw} kW ${e.system === "1ph" ? "सिङ्गल फेज" : "थ्री फेज"} (${e.amps} A)` : e.en])),
    hvKv: () => sel("hvKv", tr("hvKv"), [["11", "11 kV"], ["33", "33 kV"]], { struct: true }),
    kva: () => num("kva", tr("kva"), { suffix: "kVA" }),
    faultKa: () => num("faultKa", tr("faultKa"), { suffix: "kA" }),
    faultT: () => num("faultT", tr("faultT"), { suffix: "s" }),
    lineKv: () => sel("lineKv", tr("lineKv"), [["11", "11 kV (distribution)"], ["33", "33 kV (sub-transmission)"], ["66", "66 kV"], ["132", "132 kV (transmission)"], ["220", "220 kV (transmission)"], ["400", "400 kV (cross-border / national grid)"]], { struct: true }),
    lineKva: () => num("lineKva", tr("lineKva"), { suffix: Number(S.lineKv) >= 132 ? "MW" : "kVA" }),
    lineCct: () => sel("lineCct", S.lang === "ne" ? "सर्किट संख्या" : "Number of circuits", [["1", S.lang === "ne" ? "एक सर्किट" : "Single circuit"], ["2", S.lang === "ne" ? "डबल सर्किट (भार बाँडिन्छ)" : "Double circuit (load shared)"]]),
    linePf: () => num("linePf", tr("linePf"), { step: 0.01 }),
    lineType: () => sel("lineType", tr("lineType"), [["acsr", tr("acsr")], ["aaac", tr("aaac")]]),
    loadList: () => loadTable(),
    growthPct: () => num("growthPct", tr("growthPct"), { suffix: "%" }),
    ksOverride: () => num("ksOverride", tr("ksOverride"), { step: 0.05 }),
    pfcKw: () => num("pfcKw", tr("pfcKw"), { suffix: "kW" }),
    pfcPf1: () => num("pfcPf1", tr("pfcPf1"), { step: 0.01 }),
    pfcPf2: () => num("pfcPf2", tr("pfcPf2"), { step: 0.01 }),
    pfcMode: () => sel("pfcMode", tr("pfcMode"), [["global", tr("pfcGlobal")], ["motor", tr("pfcMotor")]], { struct: true }),
    pfcIo: () => num("pfcIo", tr("pfcIo"), { suffix: "A" }),
    pfcNll: () => sel("pfcNll", tr("pfcNll"), [[0, tr("pfcN0")], [15, tr("pfcN1")], [30, tr("pfcN2")]]),
    pvVoc: () => num("pvVoc", tr("pvVoc"), { suffix: "V" }), pvVmpp: () => num("pvVmpp", tr("pvVmpp"), { suffix: "V" }),
    pvIsc: () => num("pvIsc", tr("pvIsc"), { suffix: "A" }), pvCoef: () => num("pvCoef", tr("pvCoef"), { step: 0.01 }),
    pvVinv: () => num("pvVinv", tr("pvVinv"), { suffix: "V" }), pvVmin: () => num("pvVmin", tr("pvVmin"), { suffix: "V" }),
    pvIinv: () => num("pvIinv", tr("pvIinv"), { suffix: "A" }), pvStrings: () => num("pvStrings", tr("pvStrings"), { step: 1, min: 1 }),
    pvModules: () => num("pvModules", tr("pvModules"), { step: 1 }), pvModuleW: () => num("pvModuleW", tr("pvModuleW"), { suffix: "W" }),
    pvInvKW: () => num("pvInvKW", tr("pvInvKW"), { suffix: "kW" }), pvIrm: () => num("pvIrm", tr("pvIrm"), { suffix: "A" }),
    pvLen: () => num("pvLen", tr("pvLen"), { suffix: "m" }),
  };
  // the load list needs the full width; every other field goes two to a row
  let pending = [];
  const flush = () => { for (let i = 0; i < pending.length; i += 2) h += row(pending[i], pending[i + 1] || ""); pending = []; };
  for (const f of job.fields(S)) {
    if (f === "loadList") { flush(); h += row(F[f]()); } else pending.push(F[f]?.() || "");
  }
  flush();
  $("#load-fields").innerHTML = h;
  showSteps();
  const regionRow = () => {
    if (!NP_REGIONS[S.region] && S.region !== "custom") S.region = "hills";
    return row(sel("region", tr("region"), [...Object.entries(NP_REGIONS).map(([k, r]) => [k, L2(r)]), ["custom", tr("custom")]], { struct: true }));
  };
  if (job.kind === "pfc") {
    $("#route-fields").innerHTML = ""; $("#cable-fields").innerHTML = ""; $("#check-fields").innerHTML = "";
    document.querySelectorAll("#s2, #s3").forEach((n) => { n.closest("section").hidden = true; });
    return;
  }
  if (job.kind === "pv") {
    $("#route-fields").innerHTML = regionRow(); $("#cable-fields").innerHTML = ""; $("#check-fields").innerHTML = "";
    document.querySelector("#s3").closest("section").hidden = true;
    return;
  }

  if (job.kind === "line") {
    if (!NP_REGIONS[S.region] && S.region !== "custom") S.region = "hills";
    h = row(sel("region", tr("region"), [...Object.entries(NP_REGIONS).map(([k, r]) => [k, L2(r)]), ["custom", tr("custom")]], { struct: true }));
    if (S.region === "custom") h += row(num("airTemp", tr("airTemp"), { suffix: "°C" }));
    h += row(num("lineKm", tr("lineKm"), { suffix: "km" }));
    $("#route-fields").innerHTML = h;
    $("#cable-fields").innerHTML = `<p class="hint">${S.lang === "ne" ? "कन्डक्टरको प्रकार माथि छानिएको छ। NEA मा ACSR मानक हो।" : "Conductor type is chosen above. ACSR is the NEA standard."}</p>`;
    $("#check-fields").innerHTML = "";
    return;
  }
  const routes = Object.entries(ROUTES).filter(([k]) => job.level === "LV" || ["buried", "duct", "tray", "clipped"].includes(k));
  if (!routes.some(([k]) => k === S.route)) S.route = routes[0][0];
  h = `<fieldset class="field"><legend class="lbl">${tr("route")}</legend><div class="routes">` +
    routes.map(([k, r]) => `<label class="routecard"><input type="radio" name="route" value="${k}"${S.route === k ? " checked" : ""} data-struct>${routePic(k)}<span>${esc(L2(r))}</span></label>`).join("") +
    `</div>${explainHtml("route", lang)}</fieldset>`;
  if (!NP_REGIONS[S.region] && S.region !== "custom") S.region = "hills";
  h += row(sel("region", tr("region"), [...Object.entries(NP_REGIONS).map(([k, r]) => [k, L2(r)]), ["custom", tr("custom")]], { struct: true }));
  if (S.region === "custom") h += row(num("airTemp", tr("airTemp"), { suffix: "°C" }), num("groundTemp", tr("groundTemp"), { suffix: "°C" }));
  h += row(num("lengthM", tr("lengthM"), { suffix: "m" }), num("groupCount", tr("groupCount"), { step: 1, min: 1 }));
  if (job.level === "LV") {
    h += row(sel("trafoKva", tr("trafo"), TRAFO_KVA.map((k) => [k, `${k} kVA`]), { hint: tr("trafoHint") }),
      num("supplyM", tr("supplyM"), { suffix: "m", hint: tr("supplyHint") }), sel("supplyMm2", tr("supplyMm2"), SUPPLY_MM2.map((k) => [k, `${k} mm²`])));
    h += row(sel("earthing", tr("earthing"), [["TT", tr("earthTT")], ["TN", tr("earthTN")]], { hint: tr("earthingHint") }),
      num("earthRa", tr("earthRa"), { suffix: "Ω", hint: tr("earthRaHint") }));
    if (["shop", "building"].includes(S.job) || (S.job === "house" && S.phase === "3ph")) h += row(sel("h3", tr("elec"), [[0, tr("elec0")], [25, tr("elec25")], [40, tr("elec40")]]));
  }
  $("#route-fields").innerHTML = h;

  $("#cable-fields").innerHTML = row(sel("material", tr("material"), [["cu", tr("cu")], ["al", tr("al")]], { struct: true })) + explainHtml("cores", lang);
  $("#check-fields").innerHTML = "";
}

function buildSimple() {
  const job = JOBS[S.job] || JOBS.house;
  const t = job.toInput(S);
  const r = routeFor(S.route, S.std, job.level);
  const A = ADAPTERS[r.adapterKey];
  const reg = NP_REGIONS[S.region];
  const iec = r.adapterKey === "LV-IEC";
  const env = { airTemp: reg ? reg.air : +S.airTemp, groundTemp: reg ? reg.ground : +S.groundTemp,
    soilRes: iec ? 250 : 150, depthMm: job.level === "HV" ? (Number(S.hvKv) >= 22 ? 1050 : 900) : iec ? 700 : 750 };
  const inp = {
    ...t.input, method: r.method, lengthM: +S.lengthM, material: S.material, env,
    group: { count: Math.max(1, Math.round(+S.groupCount || 1)), spacing: "touching", formation: "flat", racks: 1 },
    vdLimitPct: 5, vdStartLimitPct: t.input.vdStartLimitPct || 15, fault: t.input.fault || null, sizeOn: t.input.sizeOn || "device",
    armoured: job.level === "HV" || ["buried", "duct"].includes(S.route),
  };
  inp.insulation = t.input.insulation || (["A1", "B1"].includes(r.method) ? "PVC" : A.options.insulations[0][0]);
  inp.cores = t.input.cores || coresFor(t, inp.system, r.method, r.adapterKey);
  if (job.level === "LV") {
    if (inp.material === "al") { inp.minSize = 16; inp.minSizeRule = "aluminium in fixed installations, IEC 60364-5-52 Table 52.2"; }
    else if (S.std === "IS") { inp.minSize = 4; inp.minSizeRule = "power circuits, Nepal NBC 207"; }
    else { inp.minSize = 1.5; inp.minSizeRule = "IEC 60364-5-52 Table 52.2"; }
    protectionInputs(inp, t.kind, S.job === "pump" && S.motorBasis === "hp" ? +S.hp * 0.7457 : null, S.starter);
  }
  const notes = t.assumptions.map(L2);
  if (reg) notes.push(L2({ en: `Climate: ${reg.en.split(" (")[0]}: air ${reg.air} °C, ground ${reg.ground} °C.`, ne: `मौसम: ${reg.ne.split(" (")[0]}: हावा ${reg.air} °C, जमिन ${reg.ground} °C।` }));
  if (iec && S.std === "IS") notes.push(L2({ en: "Cable in a pipe in the wall: IS catalogue tables only cover air, duct and ground, so IEC 60364-5-52 method B1 (single-core wires in conduit) is used.",
    ne: "भित्ताको पाइपभित्रको तार: IS तालिकामा यो अवस्था नभएकाले IEC 60364-5-52 को B1 विधि प्रयोग गरिएको।" }));
  return { inp, notes, A, simple: { t, job } };
}

/** Cable outer diameter from the IS catalogue rows (used for glands and buried pipe). */
function cableOd(res) {
  const s = res.spec, ins = s.insulation === "HRPVC" ? "PVC" : s.insulation;
  const row = DATA.lvIs.tables[ins]?.[s.cores]?.rows.find((r) => r.size === res.chosen.size);
  return row?.od ? (s.armoured ? row.od.arm : row.od.unarm) : null;
}
function bomCtx(res, sm) {
  const kW = S.job === "pump" && S.motorBasis === "hp" ? +S.hp * 0.7457 : null;
  return { res, kind: sm.t.kind, S, route: S.route, od: cableOd(res), kW, starter: S.starter, pumpType: S.pumpType, isc: lvFault(res), exposure: NP_REGIONS[S.region]?.exposure || "medium" };
}
const COMP_MAP = [[/MCCB/, "mccb"], [/MCB/, "mcb"], [/RCD|RCCB/, "rccb"], [/isolating/i, "isolator"], [/Changeover/, "changeover"], [/SPD/, "spd"],
  [/Distribution board/, "db"], [/HRC/, "hrc-fuse"], [/starter/i, "dol-starter"], [/capacitor/i, "capacitor"], [/lugs/i, "lug"], [/glands/i, "gland"],
  [/conduit/i, "conduit-pipe"], [/HDPE/, "hdpe"], [/Earth electrode|earthing/i, "earth-electrode"], [/termination/i, "termination-kit"],
  [/Ring main/, "rmu"], [/Vacuum/, "vcb"], [/Lightning/, "lightning-arrester"], [/Current transformers/, "ct"], [/Insulators/, "insulator"],
  [/^Poles/, "pole"], [/^Towers/, "tower"], [/Spacer/, "spacer-damper"], [/^Conductor$/, "acsr"]];
const compLink = (en, label) => { const m = COMP_MAP.find(([re]) => re.test(en)); return m ? `<a href="components.html#${m[1]}">${label}</a>` : label; };
function renderBom(items) {
  if (!items.length) return "";
  const ne = S.lang === "ne";
  return `<h3 class="rh">${ic("cart", 18)} ${ne ? "किन्नुपर्ने सामान" : "What to buy"}</h3><ul class="bom">${items.map((x) =>
    `<li><div class="bom-top"><b>${compLink(x.item.en, esc(ne ? x.item.ne : x.item.en))}</b><span class="qty">${esc(String(x.qty))}</span></div><div class="bom-spec">${esc(x.spec)}</div><div class="bom-why">${esc(ne ? x.why.ne : x.why.en)}</div></li>`).join("")}</ul>`;
}

function renderSimpleResult(res, sm) {
  let h = "";
  const v = voltageAtLoad(res);
  const bad = v.lowAtLoad < v.minOk;
  h += `<div class="volt${bad ? " bad" : ""}"><h3 class="rh">${ic("gauge", 18)} ${sm.job.level === "HV" ? (S.lang === "ne" ? "ट्रान्सफर्मरमा पुग्ने भोल्टेज" : "Voltage at the transformer") : tr("vTitle")}</h3><dl class="kv">
    <dt>${tr("vNom")} ${fmt(v.nominal, 0)} V</dt><dd>${fmt(v.atLoad, 0)} V</dd>
    <dt>${tr("vLow")} (${fmt(v.low, 0)} V)</dt><dd>${fmt(v.lowAtLoad, 0)} V</dd></dl>
    ${v.unit !== "V" ? `<p class="hint">${tr("ph3note")}</p>` : ""}${bad ? `<p class="err">${tr("vBad")}</p>` : ""}</div>`;
  if (sm.job.level === "LV") {
    const w = scWithstand(res);
    h += `<div class="volt"><h3 class="rh">${ic("shield", 18)} ${tr("scTitle")}</h3><dl class="kv">
      <dt>${tr("scFault")} (${S.trafoKva} kVA${+S.supplyM > 0 ? `, ${S.supplyM} m` : ""})</dt><dd>${fmt(w.isc, 1)} kA</dd>
      <dt>${tr("scAllow")}</dt><dd>${fmt(w.allow / 1000, 0)} kA²s</dd>
      <dt>${tr("scTime")}</dt><dd>${fmtMs(w.tMs)} ms</dd></dl>
      <p class="hint">${tr("scRule").replace("{kA}", Math.ceil(w.isc)).replace("{E}", fmt(w.allow / 1000, 0))}</p>
      <p class="hint">${+S.supplyM > 0 ? tr("scNoteDist").replace("{m}", S.supplyM).replace("{s}", S.supplyMm2).replace("{t}", S.trafoKva) : tr("scNote")}</p>
      ${res.chosen.lmax != null ? meter(tr("mLmax"), +S.lengthM, res.chosen.lmax, "m", res.chosen.pass.minFault) : ""}</div>`;
    h += earthBlock(res);
    if (sm.t.demand) h = demandBlock(sm.t.demand) + h;
  }
  h += renderBom(sm.job.level === "HV" ? bomHv({ res, kva: +S.kva, kv: Number(S.hvKv) }) : bomFor(bomCtx(res, sm)));
  const sm1 = smallerSize(res);
  if (sm1 && sm1.why.length) h += `<p class="smaller">${ic("alert", 16)} <b>${tr("whyNot")} ${sm1.size} mm²?</b> ${tr("wouldIt")} ${esc(sm1.why.map(L2).join(S.lang === "ne" ? ", र " : ", and "))}.</p>`;
  h += `<details class="box"><summary>${ic("info", 17)} ${tr("assum")}</summary><ul class="plain">${last.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`;
  if (sm.job.level === "LV") h += testsBlock(res);
  if (sm.job.level === "LV") h += `<details class="box"><summary>${ic("cart", 17)} ${tr("shop")}</summary><ul class="plain">${tr("shopList").map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
  return h;
}


// ======================================================================
// Overhead / transmission line job (ACSR / AAAC, IEEE 738 thermal rating)
// ======================================================================
const LT = {
  en: { lineKv: "Line voltage", lineKva: "Power to carry", linePf: "Power factor", lineType: "Conductor type",
    acsr: "ACSR — aluminium with steel core (NEA standard)", aaac: "AAAC — all aluminium alloy (lighter, no rust)",
    lineKm: "Line length", useCond: "Use conductor", lineI: "Line current", ratingSite: "Rating at your site", lossTxt: "Losses at full load",
    xTxt: "Reactance (from phase spacing)", neaUses: "NEA commonly uses at this voltage", siteTxt: "Site conditions used",
    lineTried: "Every conductor tested", lineLead: "Ratings are calculated for your site with the IEEE 738 heat balance (sun, wind, air temperature and altitude), the same method behind Indian CEA tables. The smallest conductor that passes both checks is chosen.",
    cName: "Conductor", cArea: "Al mm²", cAmp: "Rating A", cVd: "VD %", cLoss: "Loss %", cRes: "Result",
    lName: "code name (IS 398)", lArea: "aluminium cross-section", lAmp: "current it can carry continuously at your site", lVd: "voltage lost along the line", lLoss: "power lost as heat in the conductor, % of load", lRes: "smallest passing conductor is chosen",
    hot: "too hot", vd: "too much drop", loadF: "beyond loadability", cLoad: "Limit MW", lLoad: "practical loadability: SIL × St. Clair factor for this length (220/400 kV planning limit)", none: "No single conductor passes. Use a higher voltage, a double circuit or bundled conductors." },
  ne: { lineKv: "लाइनको भोल्टेज", lineKva: "बोक्नुपर्ने पावर", linePf: "पावर फ्याक्टर", lineType: "कन्डक्टरको प्रकार",
    acsr: "ACSR — स्टिल कोर भएको एल्युमिनियम (NEA मानक)", aaac: "AAAC — एल्युमिनियम मिश्रधातु (हलुका, खिया नलाग्ने)",
    lineKm: "लाइनको लम्बाइ", useCond: "प्रयोग गर्ने कन्डक्टर", lineI: "लाइन करेन्ट", ratingSite: "तपाईंको ठाउँमा क्षमता", lossTxt: "पूरा भारमा हानि",
    xTxt: "रियाक्टेन्स (फेज दूरीबाट)", neaUses: "यो भोल्टेजमा NEA ले प्रायः प्रयोग गर्ने", siteTxt: "प्रयोग गरिएको ठाउँको अवस्था",
    lineTried: "जाँचिएका सबै कन्डक्टर", lineLead: "क्षमता तपाईंको ठाउँका लागि IEEE 738 ताप सन्तुलन (घाम, हावा, तापक्रम र उचाइ) बाट निकालिएको हो — भारतको CEA तालिकाको आधार पनि यही हो। दुवै जाँच पास गर्ने सबैभन्दा सानो कन्डक्टर छानिन्छ।",
    cName: "कन्डक्टर", cArea: "Al mm²", cAmp: "क्षमता A", cVd: "VD %", cLoss: "हानि %", cRes: "नतिजा",
    lName: "कोड नाम (IS 398)", lArea: "एल्युमिनियमको क्षेत्रफल", lAmp: "तपाईंको ठाउँमा लगातार बोक्न सक्ने करेन्ट", lVd: "लाइनमा गुम्ने भोल्टेज", lLoss: "तातिएर गुम्ने पावर, भारको %", lRes: "पास हुने सबैभन्दा सानो छानिन्छ",
    hot: "धेरै तातिन्छ", vd: "ड्रप बढी", loadF: "क्षमताभन्दा बढी", cLoad: "सीमा MW", lLoad: "व्यावहारिक क्षमता: SIL × लम्बाइअनुसार St. Clair फ्याक्टर", none: "कुनै एउटा कन्डक्टर पुग्दैन। उच्च भोल्टेज, डबल सर्किट वा बन्डल कन्डक्टर प्रयोग गर्नुहोस्।" },
};
Object.assign(UI.en, LT.en); Object.assign(UI.ne, LT.ne);

const stClairTxt = (L) => (stClair(L)).toFixed(2);
function lineSpec() {
  const reg = NP_REGIONS[S.region] || NP_REGIONS.hills;
  const kv = String(S.lineKv);
  const D = LINE_DEFAULTS[kv];
  const mw = Number(kv) >= 132;
  return { kV: Number(kv), loadKVA: mw ? (+S.lineKva * 1000) / (+S.linePf || 0.95) : +S.lineKva, pf: +S.linePf || 0.9, lengthKm: +S.lineKm, type: S.lineType,
    circuits: +S.lineCct || 1,
    Ta: S.region === "custom" ? +S.airTemp : reg.air, elevation: S.region === "custom" ? 1000 : reg.elev,
    wind: 0.56, solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: D.tc, gmdMm: D.gmdMm, vdLimitPct: D.vd };
}

function renderLineResult(r) {
  const ans = $("#answer"), work = $("#working"), sticky = $("#sticky");
  $("#w-h").innerHTML = `${ic("calc", 22)} ${tr("calcTitle")}`;
  $("#copy").innerHTML = `${ic("copy", 16)} ${tr("copy")}`;
  $("#print").innerHTML = `${ic("print", 16)} ${tr("print")}`;
  const c = r.chosen, s = r.spec, ne = S.lang === "ne";
  drawStrands($("#xsec"), c);
  $("#xsec-cap").textContent = c ? (ne ? "कन्डक्टरको काटिएको भाग (तार मिलाएर देखाइएको)" : "Conductor cross-section, strands to scale") : "";
  let h = "";
  if (!c) { h = `<div class="fail-box"><p class="buy">${ic("alert", 20)} ${tr("none")}</p></div>`; sticky.textContent = tr("none"); }
  else {
    const strand = c.st_strands ? `${c.al_strands}/${c.al_dia_mm} + ${c.st_strands}/${c.st_dia_mm} mm` : `${c.al_strands} strands`;
    h += sheathPrint([`${c.st_strands ? "ACSR" : "AAAC"} ${c.name}`, c.standard, `${s.kV} KV`, `${fmt(c.amp, 0)} A AT SITE`]);
    h += `<p class="ask">${ic("cart", 16)} ${tr("useCond")}</p><p class="buy">${c.st_strands ? "ACSR" : ""} ${esc(c.name)} — ${esc(strand)}, ${esc(c.standard)}</p>`;
    h += `<div class="kvs">`;
    h += kvRow("ruler", ne ? "किन्ने कन्डक्टर (३ फेज + २ % झोल)" : "Conductor to order (3 phases + 2 % sag)", `${Math.ceil(s.lengthKm * 3 * 1.02 * 1000).toLocaleString("en-IN")} m`);
    h += kvRow("zap", tr("lineI"), `${fmt(r.I)} A`);
    h += kvRow("thermo", tr("ratingSite"), `${fmt(c.amp, 0)} A`);
    h += kvRow("gauge", tr("xTxt"), `${c.x.toFixed(3)} Ω/km`);
    h += kvRow("zap", tr("lossTxt"), `${fmt(c.lossKW / (c.lossKW > 5000 ? 1000 : 1), 1)} ${c.lossKW > 5000 ? "MW" : "kW"} (${fmt(c.lossPct, 1)} %)`);
    if (c.sil != null) {
      h += kvRow("gauge", ne ? "सर्ज इम्पिडेन्स लोडिङ (SIL)" : "Surge impedance loading (SIL)", `${fmt(c.sil, 0)} MW`);
      h += kvRow("shield", ne ? "व्यावहारिक क्षमता (St. Clair)" : "Practical loadability (St. Clair)", `${fmt(c.loadability, 0)} MW`);
    }
    if (r.circuits > 1) h += kvRow("layers", ne ? "सर्किट" : "Circuits", `${r.circuits} × ${fmt(r.I, 0)} A`);
    h += `</div>`;
    h += meter(tr("mI"), r.I, c.amp, "A", c.pass.ampacity);
    if (s.kV <= 132) h += meter(tr("mVd"), c.pct, s.vdLimitPct, "%", c.pass.voltageDrop);
    else h += meter(ne ? "भार र व्यावहारिक क्षमता" : "Power vs practical loadability", c.PMW, c.loadability, "MW", c.pass.loadability);
    const DEC = { "current-carrying capacity": ne ? "करेन्ट बोक्ने क्षमता" : "current-carrying capacity", "voltage drop": ne ? "भोल्टेज ड्रप" : "voltage drop", "smallest size in the table": ne ? "तालिकाको सबैभन्दा सानो" : "smallest size in the table", "minimum conductor for this voltage": ne ? "यो भोल्टेजको न्यूनतम कन्डक्टर (कोरोना)" : "minimum conductor for this voltage (corona)", "line loadability (St. Clair)": ne ? "लाइनको व्यावहारिक क्षमता (St. Clair)" : "line loadability (St. Clair)" };
    h += `<p class="decided">${ic("info", 16)}<span>${tr("decided")} <b>${r.decidedBy.map((d) => DEC[d] || d).join(ne ? " र " : " and ")}</b>.</span></p>`;
    const D = LINE_DEFAULTS[String(s.kV)];
    h += `<h3 class="rh">${ic("tower", 18)} ${tr("neaUses")}</h3><p class="hint">ACSR ${D.usual.join(", ")}</p>`;
    h += `<details class="box"><summary>${ic("info", 17)} ${tr("siteTxt")}</summary><ul class="plain">
      <li>${ne ? "हावाको तापक्रम" : "Air temperature"} ${s.Ta} °C, ${ne ? "उचाइ" : "altitude"} ${s.elevation} m, ${ne ? "हावाको गति" : "wind"} ${s.wind} m/s, ${ne ? "घाम" : "sun"} ${s.solar} W/m²</li>
      <li>${ne ? "कन्डक्टरको अधिकतम तापक्रम" : "Maximum conductor temperature"} ${s.Tc} °C (${s.kV >= 132 ? "CEA transmission" : "ACSR distribution practice"})</li>
      <li>${ne ? "फेजबीचको औसत दूरी (GMD)" : "Phase spacing (GMD)"} ${(s.gmdMm / 1000).toFixed(1)} m — ${ne ? "सामान्य मान; NEA को नक्सा हेर्नुहोस्" : "typical; check the NEA pole/tower drawing"}</li>
      <li>${ne ? "भोल्टेज ड्रप सीमा" : "Voltage-drop limit"} ${s.vdLimitPct} % (${s.kV <= 33 ? "NEA distribution design" : "Electricity Regulation 2050: ±10 % transmission"})</li></ul></details>`;
    h += renderBom(bomLine({ line: r }));
    h += r.warnings.length ? `<ul class="notes">${r.warnings.map((w) => `<li>${ic("alert", 15)}<span>${esc(w)}</span></li>`).join("")}</ul>` : "";
    sticky.textContent = `${c.name} · ${fmt(c.amp, 0)} A · VD ${fmt(c.pct, 1)} %`;
  }
  ans.innerHTML = h;
  // calculation section
  let w = `<p class="lead-s">${tr("lineLead")}</p>`;
  w += `<ol class="trail"><li><b>${tr("lineI")}</b> I = S / (√3 × U) = ${fmt(s.loadKVA, 0)} kVA / (√3 × ${s.kV} kV) = <b>${fmt(r.I, 1)} A</b></li>`;
  if (c) {
    w += `<li><b>IEEE 738</b> q<sub>c</sub> + q<sub>r</sub> = q<sub>s</sub> + I²R → I = √((q<sub>c</sub> + q<sub>r</sub> − q<sub>s</sub>) / R) = √((${c.heat.qc.toFixed(1)} + ${c.heat.qr.toFixed(1)} − ${c.heat.qs.toFixed(1)}) / ${(c.heat.R * 1000).toFixed(4)}e-3) = <b>${fmt(c.amp, 0)} A</b></li>`;
    if (!r.ehv) w += `<li><b>${tr("w6")}</b> ΔU = √3 × I × L × (R cos φ + X sin φ) = √3 × ${fmt(r.I, 1)} × ${s.lengthKm} × (${c.rAc.toFixed(3)} × ${s.pf} + ${c.x.toFixed(3)} × ${Math.sqrt(1 - s.pf ** 2).toFixed(3)}) = <b>${fmt(c.dV, 0)} V (${fmt(c.pct, 2)} %)</b></li>`;
    else w += `<li><b>${S.lang === "ne" ? "लामो लाइन मोडेल" : "Long-line model"}</b> Z<sub>c</sub> = √(z/y), V<sub>s</sub> = cosh(γl)·V<sub>r</sub> + Z<sub>c</sub>·sinh(γl)·I<sub>r</sub>; ${S.lang === "ne" ? "रेगुलेसन" : "regulation"} <b>${fmt(c.pct, 1)} %</b>, SIL = V²/Z<sub>c</sub> = <b>${fmt(c.sil, 0)} MW</b>, ${S.lang === "ne" ? "क्षमता" : "loadability"} = ${stClairTxt(s.lengthKm)} × SIL = <b>${fmt(c.loadability, 0)} MW</b> (X ${c.x.toFixed(3)} Ω/km, C ${(c.cFkm * 1e9).toFixed(1)} nF/km)</li>`;
    w += `<li><b>${tr("lossTxt")}</b> 3 × I² × R × L = <b>${fmt(c.lossKW, 1)} kW</b></li>`;
  }
  w += `</ol><h3>${ic("table", 20)} ${tr("lineTried")}</h3>`;
  const cols = [["cName", "lName"], ["cArea", "lArea"], ["cAmp", "lAmp"], ["cVd", "lVd"], ["cLoss", "lLoss"], ...(r.ehv ? [["cLoad", "lLoad"]] : []), ["cRes", "lRes"]];
  w += `<dl class="legend">${cols.map(([t, l]) => `<dt>${tr(t)}</dt><dd>${tr(l)}</dd>`).join("")}</dl>`;
  w += `<div class="tablewrap"><table><thead><tr>${cols.map(([t], i) => `<th${i === 0 || i === cols.length - 1 ? ' class="l"' : ""}>${tr(t)}</th>`).join("")}</tr></thead><tbody>`;
  for (const x of r.cands) {
    const why = [!x.pass.ampacity && tr("hot"), !x.pass.voltageDrop && tr("vd"), !x.pass.loadability && tr("loadF")].filter(Boolean);
    w += `<tr class="${x === c ? "chosen" : ""}"><td class="l">${esc(x.name)}</td><td>${fmt(x.al_area_mm2 * x.n, 0)}</td><td class="${x.pass.ampacity ? "" : "no"}">${fmt(x.amp, 0)}</td><td class="${x.pass.voltageDrop ? "" : "no"}">${fmt(x.pct, 2)}</td><td>${fmt(x.lossPct, 1)}</td>${r.ehv ? `<td class="${x.pass.loadability ? "" : "no"}">${fmt(x.loadability, 0)}</td>` : ""}<td class="l ${x.ok ? "yes" : "no"}">${x.ok ? (x === c ? "✓ " + tr("rChosen") : tr("rPass")) : "✗ " + why.join(", ")}</td></tr>`;
  }
  w += `</tbody></table></div><p><small>${tr("dataSrc")} IS 398-2 / IS 398-4 (Satcon, Lumino, Apar), BS 215 (Bear). IEEE 738-2012 heat balance, validated against 156 CEA 2023 / manufacturer ratings within 0.6 %.</small></p>`;
  work.innerHTML = w;
}


// ======================================================================
// Landing page: card icons, hero shortcuts, live worked examples
// ======================================================================
const EXAMPLES = [
  { id: "pump", en: "Borewell pump, Terai", ne: "बोरिङ पम्प, तराई",
    story: { en: "A 1 HP single-phase submersible pump in a field near Nepalgunj, 200 m from the meter, cable buried.", ne: "नेपालगञ्ज नजिकको खेतमा १ HP सिङ्गल फेज सबमर्सिबल पम्प, मिटरबाट २०० m, तार गाडिएको।" },
    state: { mode: "simple", level: "LV", std: "IS", job: "pump", phase: "1ph", pumpType: "sub", motorBasis: "hp", hp: 1, starter: "dol", route: "buried", region: "terai", lengthM: 200, groupCount: 1, material: "cu" } },
  { id: "house", en: "House main, Kathmandu", ne: "घरको मुख्य तार, काठमाडौं",
    story: { en: "A 30 A NEA single-phase meter on the gate, the board inside the house 25 m away, cable buried.", ne: "गेटमा ३० A NEA सिङ्गल फेज मिटर, घरभित्रको बोर्ड २५ m टाढा, तार गाडिएको।" },
    state: { mode: "simple", level: "LV", std: "IS", job: "house", phase: "1ph", houseBasis: "meter", meterA: 30, route: "buried", region: "hills", lengthM: 25, groupCount: 1, material: "cu" } },
  { id: "ev", en: "EV charger, Lalitpur", ne: "EV चार्जर, ललितपुर",
    story: { en: "A 7.4 kW wallbox in the garage, wired in PVC conduit 20 m from the board.", ne: "ग्यारेजमा ७.४ kW चार्जर, बोर्डबाट २० m, PVC पाइपभित्र।" },
    state: { mode: "simple", level: "LV", std: "IS", job: "ev", evKw: "7.4", route: "conduit", region: "hills", lengthM: 20, groupCount: 1, material: "cu" } },
  { id: "feeder", en: "11 kV line to a factory", ne: "उद्योगसम्म ११ kV लाइन",
    story: { en: "A 1 MVA rice mill 8 km from the substation near Birgunj, overhead ACSR.", ne: "वीरगञ्ज नजिक सबस्टेसनबाट ८ km टाढा १ MVA चामल मिल, ओभरहेड ACSR।" },
    state: { mode: "simple", level: "HV", std: "IS", job: "line", lineKv: "11", lineKva: 1000, linePf: 0.9, lineKm: 8, lineCct: "1", lineType: "acsr", region: "terai" } },
  { id: "grid", en: "400 kV cross-border line", ne: "४०० kV सीमापार लाइन",
    story: { en: "1000 MW over 150 km on one circuit, Terai route — the scale of the Dhalkebar–Muzaffarpur corridor.", ne: "एक सर्किटमा १५० km, १००० MW — ढल्केबर–मुजफ्फरपुर करिडोरको आकार।" },
    state: { mode: "simple", level: "HV", std: "IS", job: "line", lineKv: "400", lineKva: 1000, linePf: 0.95, lineKm: 150, lineCct: "1", lineType: "acsr", region: "terai" } },
];
let exSel = "pump";

function exampleResult(ex) {
  const saved = { ...S };
  Object.assign(S, JOBS[ex.state.job].defaults, ex.state);
  try {
    if (JOBS[S.job].kind === "line") {
      const r = sizeLine(DATA.overhead, lineSpec());
      return { line: r };
    }
    const b = buildSimple();
    return { res: sizeConductor(b.A, b.inp), b };
  } catch (e) { return { err: e.message }; }
  finally { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, saved); }
}

function renderExamples() {
  const tabs = $("#ex-tabs"), panel = $("#ex-panel");
  if (!tabs || !panel) return;
  const ne = S.lang === "ne" && !eng();
  tabs.innerHTML = EXAMPLES.map((x) => `<button type="button" role="tab" aria-selected="${x.id === exSel}" data-ex="${x.id}">${esc(ne ? x.ne : x.en)}</button>`).join("");
  const ex = EXAMPLES.find((x) => x.id === exSel);
  const out = exampleResult(ex);
  const k = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  let kp = "", buy = "", why = "";
  if (out.line && out.line.chosen) {
    const c = out.line.chosen;
    buy = `${c.st_strands ? "ACSR " : ""}${c.name}`;
    kp = k(buy, ne ? "कन्डक्टर" : "Conductor") + k(`${fmt(c.amp, 0)} A`, ne ? "ठाउँमा क्षमता" : "Rating at the site") +
      (c.sil != null ? k(`${fmt(c.loadability, 0)} MW`, ne ? "व्यावहारिक क्षमता" : "Practical loadability") : k(`${fmt(c.pct, 1)} %`, ne ? "भोल्टेज ड्रप" : "Voltage drop")) +
      k(`${fmt(c.lossPct, 1)} %`, ne ? "हानि" : "Losses");
    why = out.line.decidedBy.join(" and ");
  } else if (out.res && out.res.chosen) {
    const r = out.res, c = r.chosen, v = voltageAtLoad(r);
    buy = `${c.size} mm² ${r.spec.material === "cu" ? "Cu" : "Al"}`;
    kp = k(buy, ne ? "तार" : "Cable") + k(`${r.current.In} A`, ne ? "ब्रेकर" : "Breaker") +
      k(`${fmt(v.lowAtLoad, 0)} V`, ne ? "NEA −५ % मा उपकरणको भोल्टेज" : "At the load, NEA at −5 %") + k(`${fmt(c.vdPct, 1)} %`, ne ? "भोल्टेज ड्रप" : "Voltage drop");
    why = r.decidedBy.join(" and ");
  }
  panel.innerHTML = `<div class="ex-story"><h3>${esc(ne ? ex.ne : ex.en)}</h3><p>${esc(ne ? ex.story.ne : ex.story.en)}</p>
      <button type="button" class="btn" data-open-ex="${ex.id}">${ic("calc", 16)} ${ne ? "क्याल्कुलेटरमा खोल्नुहोस्" : "Open in the calculator"}</button></div>
    <div class="ex-kpis">${kp || `<p class="err">${esc(out.err || "")}</p>`}</div>
    ${why ? `<p class="ex-why">${ic("info", 16)} ${ne ? "साइज तय गर्ने:" : "Size decided by"} <b>${esc(why)}</b>.</p>` : ""}`;
}

function openState(state) {
  Object.assign(S, JOBS[state.job].defaults, state);
  save(); renderForm(); compute();
  document.getElementById("calculator").scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-add-load]")) { (S.loads ||= []).push({ type: "sockets", qty: 1, kw: 1 }); save(); renderSimple(); compute(); return; }
  const del = e.target.closest("[data-del-load]");
  if (del) { S.loads.splice(+del.dataset.delLoad, 1); save(); renderSimple(); compute(); return; }
  const t = e.target.closest("[data-ex]");
  if (t) { exSel = t.dataset.ex; renderExamples(); return; }
  const o = e.target.closest("[data-open-ex]");
  if (o) { openState(EXAMPLES.find((x) => x.id === o.dataset.openEx).state); return; }
  const g = e.target.closest("[data-go]");
  if (g) {
    e.preventDefault();
    if (g.dataset.go === "line") openState({ mode: "simple", level: "HV", job: "line", lineKv: "11", lineKva: 1000, lineKm: 8, lineCct: "1", region: S.region || "hills" });
    else openState({ mode: "simple", level: "LV", job: "house", material: "cu", lengthM: 25 });
  }
});

document.getElementById("theme")?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("cs-theme", document.documentElement.dataset.theme); } catch { /* ignore */ }
});

function paintCardIcons() {
  document.querySelectorAll("[data-ic]").forEach((el) => { if (!el.firstChild) el.innerHTML = ic(el.dataset.ic, 22); });
}


// ======================================================================
// Checks from the Electrical Installation Guide 2018: earth fault, far-end fault, harmonics,
// load list, power factor correction, solar strings, tests before switching on.
// ======================================================================
Object.assign(UI.en, {
  earthing: "Earthing system of your supply",
  earthTT: "TT: your own earth electrode (the usual case on a public LV network)", earthTN: "TN-S or TN-C-S: the supply brings an earth wire",
  earthingHint: "If unsure, keep TT: it is the safe choice. Ask NEA what your connection is.",
  earthRa: "Earth electrode resistance", earthRaHint: "Measure it with an earth tester. Unknown: 30 ohm is a normal target. The result shows which RCD it allows.",
  elec: "Computers, LED lights, UPS or inverters on this supply", elec0: "Few", elec25: "Some (about 25 % of the current)", elec40: "Many (about 40 % of the current)",
  efTitle: "Earth fault", efTime: "Fault must disconnect within", efLmax: "Longest circuit the breaker protects",
  efTT: "In a TT system an RCD does the disconnecting, and the earth electrode must satisfy resistance × RCD sensitivity ≤ 50 V.",
  efTNrule: "In a TN system the breaker's instantaneous trip must operate for an earth fault at the far end, so the circuit length is limited. The result already uses a cable that is long enough.",
  efTable: "RCD sensitivity", efMaxRa: "Highest earth resistance", efOk: "allowed", efNo: "not allowed",
  efMain: "Main RCD to fit", efSockets: "30 mA on sockets, bathrooms and outdoor circuits",
  efOnly30: "Only a 30 mA RCD works with this earth resistance: improve the electrode (more rods, wetter soil, deeper) so a less nuisance-prone RCD can be used.",
  efBad: "This earth resistance is too high for any RCD: improve the earth electrode before connecting.",
  efTimes: "Final circuits up to 32 A: 0.2 s (TT) or 0.4 s (TN) at 230 V; distribution circuits 1 s (TT) or 5 s (TN).",
  mLmax: "Cable length vs longest the breaker protects",
  tLmax: "Longest m", lLmax: "longest circuit whose far-end fault still trips the breaker instantly", fLmax: "breaker may not trip at the far end",
  w7min: "Far-end fault:", elecNote: "Third harmonics from electronics load the neutral up to 3 times; the neutral is full size and the cable is derated.",
  testsTitle: "Before you switch on",
  // building
  loadList: "Loads in the building", ldType: "Type", ldQty: "How many", ldKw: "kW each", ldAdd: "Add a load", ldDel: "Remove this load",
  growthPct: "Growth allowance", ksOverride: "Diversity ks (leave empty for automatic)",
  dmTitle: "Demand of the building", dmInstalled: "Installed load", dmAfterKu: "After utilisation (ku)", dmKs: "Diversity (ks)", dmReq: "Needed, with growth",
  dmCur: "Main cable current", dmTr: "Transformer to ask for", dmTrFlc: "Transformer full-load current",
  dmLarge: "About 100 kVA or more counts as a large consumer: confirm the supply with NEA.", dmMv: "Above about 250 kVA a medium-voltage connection and your own transformer is usually needed.",
  dmEmpty: "Add at least one load with a quantity and kW.",
  // pfc
  pfcKw: "Load, active power", pfcPf1: "Power factor now", pfcPf2: "Power factor wanted", pfcMode: "Where the capacitor goes",
  pfcGlobal: "At the main board (whole load)", pfcMotor: "At one motor's terminals", pfcIo: "Motor no-load current (optional)",
  pfcNll: "Electronics share of the load", pfcN0: "Little (up to 10 %)", pfcN1: "Some (10 to 20 %)", pfcN2: "Lots (over 20 %)",
  pfcBuy: "Capacitor bank to buy", pfcQ: "Capacitor size", pfcIn: "Capacitor current", pfcLong: "Breaker, long-time setting", pfcShort: "Breaker, short-time setting",
  pfcI1: "Load current now", pfcI2: "Load current after", pfcCut: "Current and cable loss cut", pfcType: "Capacitor type",
  pfcStd: "Standard", pfcHeavy: "Heavy-duty (current-rated)", pfcDet: "Detuned reactor bank (5.7 % or 7 %; 14 % if third harmonic is strong)",
  pfcMotorK: "Suggested at the motor", pfcMotorMax: "Never more than (self-excitation)", pfcOverload: "Set the overload relay lower by",
  pfcRound: "Round up to the maker's next step. Fit discharge resistors, and use inrush-limiting contactors: switching can give 2 to 3 times the peak voltage.",
  pfcRule: "Nepal Electricity Rules 2050, Rule 44: customer power factor not below 0.8 lagging. Check NEA's current tariff before choosing a target.",
  pfcHigh: "Going above about 0.98 is rarely worth it and risks over-voltage when load is light.", pfcNone: "Target is not above the present power factor: no capacitor needed.",
  pfcDetWarn: "Many electronic loads: a plain capacitor can resonate with the network and overheat. Use a detuned reactor bank.",
  // pv
  pvVoc: "Module Voc (open circuit)", pvVmpp: "Module Vmpp", pvIsc: "Module Isc", pvCoef: "Voc temperature coefficient, %/°C (negative)",
  pvVinv: "Inverter maximum DC voltage", pvVmin: "Inverter MPPT minimum voltage", pvIinv: "Inverter maximum DC input current",
  pvStrings: "Strings in parallel", pvModules: "Modules per string (0 = the most allowed)", pvModuleW: "Module power", pvInvKW: "Inverter AC power",
  pvIrm: "Module maximum reverse current IRM (optional)", pvLen: "DC cable length, one way",
  pvTitle: "Solar strings", pvRange: "Modules per string", pvVocCold: "String Voc on the coldest morning", pvVmppHot: "String Vmpp on the hottest day",
  pvStr: "Strings the inverter can take", pvProt: "String fuses", pvFuse: "Fuse rating", pvCable: "DC cable", pvDrop: "DC voltage drop",
  pvDouble: "Over 120 V DC: use double-insulated PV cable and DC equipment.", pvNoFit: "No number of modules fits both the cold-day voltage limit and the hot-day minimum: this module and inverter do not match.",
  pvProtYes: "needed, one per string", pvProtNo: "not needed", pvRatio: "Inverter to array power",
  pvRatioNote: "0.8 to 1.0 is the usual choice (European practice).", pvStrNo: "More strings than the inverter's current limit allows.",
  pvSpd: "Fit an SPD at the inverter. If the DC cable is longer than 10 m, add a second one in a box near the panels.",
  pvCool: "Tmin and Tmax come from your region; module temperature is air temperature plus 30 °C (assumption).",
  pvLead: "Voltage rules: modules × Voc at the lowest temperature must stay below the inverter maximum, and modules × Vmpp at the highest cell temperature must stay above its MPPT minimum.",
});
Object.assign(UI.ne, {
  earthing: "तपाईंको सप्लाईको अर्थिङ प्रणाली",
  earthTT: "TT: आफ्नै अर्थ इलेक्ट्रोड (सार्वजनिक LV नेटवर्कमा सामान्य)", earthTN: "TN-S वा TN-C-S: सप्लाईले अर्थ तार ल्याउँछ",
  earthingHint: "थाहा नभए TT नै राख्नुहोस्: सुरक्षित हुन्छ। NEA लाई सोध्नुहोस्।",
  earthRa: "अर्थ इलेक्ट्रोडको रेजिस्टेन्स", earthRaHint: "अर्थ टेस्टरले नाप्नुहोस्। थाहा नभए ३० ओम सामान्य लक्ष्य हो। नतिजामा कुन RCD चल्छ देखिन्छ।",
  elec: "यो सप्लाईमा कम्प्युटर, LED बत्ती, UPS वा इन्भर्टर", elec0: "थोरै", elec25: "केही (करेन्टको करिब २५ %)", elec40: "धेरै (करेन्टको करिब ४० %)",
  efTitle: "अर्थ फल्ट", efTime: "फल्ट यति समयभित्र कट्नुपर्छ", efLmax: "ब्रेकरले जोगाउने सबैभन्दा लामो सर्किट",
  efTT: "TT प्रणालीमा RCD ले काट्छ, र अर्थ रेजिस्टेन्स × RCD संवेदनशीलता ≤ ५० V हुनुपर्छ।",
  efTNrule: "TN प्रणालीमा टाढाको छेउको अर्थ फल्टमा पनि ब्रेकरको इन्स्टेन्टेनियस ट्रिप चल्नुपर्छ, त्यसैले सर्किटको लम्बाइ सीमित हुन्छ। नतिजामा पुग्ने साइजको तार नै छानिएको छ।",
  efTable: "RCD संवेदनशीलता", efMaxRa: "अधिकतम अर्थ रेजिस्टेन्स", efOk: "मिल्छ", efNo: "मिल्दैन",
  efMain: "मुख्यमा राख्ने RCD", efSockets: "सकेट, बाथरुम र बाहिरका सर्किटमा ३० mA",
  efOnly30: "यो अर्थ रेजिस्टेन्समा ३० mA RCD मात्र चल्छ: इलेक्ट्रोड सुधार्नुहोस् (धेरै रड, ओसिलो माटो, गहिरो) ताकि कम बारम्बार ट्रिप हुने RCD राख्न सकियोस्।",
  efBad: "यो अर्थ रेजिस्टेन्स कुनै पनि RCD का लागि धेरै बढी छ: जोड्नुअघि इलेक्ट्रोड सुधार्नुहोस्।",
  efTimes: "३२ A सम्मका अन्तिम सर्किट: २३० V मा ०.२ s (TT) वा ०.४ s (TN); वितरण सर्किट १ s (TT) वा ५ s (TN)।",
  mLmax: "तारको लम्बाइ र ब्रेकरले जोगाउने सबैभन्दा लामो दूरी",
  tLmax: "सबैभन्दा लामो m", lLmax: "टाढाको फल्टमा पनि ब्रेकर तुरुन्त ट्रिप हुने सबैभन्दा लामो सर्किट", fLmax: "टाढाको छेउमा ब्रेकर ट्रिप नहुन सक्छ",
  w7min: "टाढाको फल्ट:", elecNote: "इलेक्ट्रोनिक भारका तेस्रो हार्मोनिक न्युट्रलमा ३ गुणासम्म पुग्छन्; न्युट्रल पूरै साइजको र तार घटाइएको।",
  testsTitle: "चालु गर्नुअघि",
  loadList: "भवनका भार", ldType: "प्रकार", ldQty: "कति वटा", ldKw: "हरेकको kW", ldAdd: "भार थप्नुहोस्", ldDel: "यो भार हटाउनुहोस्",
  growthPct: "भविष्यका लागि थप", ksOverride: "डाइभर्सिटी ks (खाली राखे स्वचालित)",
  dmTitle: "भवनको माग", dmInstalled: "जडान गरिएको भार", dmAfterKu: "प्रयोग अनुपात (ku) पछि", dmKs: "डाइभर्सिटी (ks)", dmReq: "आवश्यक, थपसहित",
  dmCur: "मुख्य तारको करेन्ट", dmTr: "माग्नुपर्ने ट्रान्सफर्मर", dmTrFlc: "ट्रान्सफर्मरको पूरा-भार करेन्ट",
  dmLarge: "करिब १०० kVA वा बढी ठूलो उपभोक्ता मानिन्छ: NEA सँग सप्लाई पक्का गर्नुहोस्।", dmMv: "करिब २५० kVA भन्दा माथि प्रायः मध्यम भोल्टेज जडान र आफ्नै ट्रान्सफर्मर चाहिन्छ।",
  dmEmpty: "कम्तीमा एउटा भार, संख्या र kW सहित थप्नुहोस्।",
  pfcKw: "भार, एक्टिभ पावर", pfcPf1: "अहिलेको पावर फ्याक्टर", pfcPf2: "चाहिने पावर फ्याक्टर", pfcMode: "क्यापासिटर कहाँ राख्ने",
  pfcGlobal: "मुख्य बोर्डमा (पूरै भार)", pfcMotor: "एउटा मोटरको टर्मिनलमा", pfcIo: "मोटरको नो-लोड करेन्ट (ऐच्छिक)",
  pfcNll: "भारमा इलेक्ट्रोनिक्सको अंश", pfcN0: "थोरै (१० % सम्म)", pfcN1: "केही (१० देखि २० %)", pfcN2: "धेरै (२० % भन्दा बढी)",
  pfcBuy: "किन्ने क्यापासिटर बैंक", pfcQ: "क्यापासिटरको साइज", pfcIn: "क्यापासिटरको करेन्ट", pfcLong: "ब्रेकर, लामो-समय सेटिङ", pfcShort: "ब्रेकर, छोटो-समय सेटिङ",
  pfcI1: "अहिलेको लोड करेन्ट", pfcI2: "सुधारपछिको लोड करेन्ट", pfcCut: "करेन्ट र तारको हानि घट्ने", pfcType: "क्यापासिटरको प्रकार",
  pfcStd: "सामान्य", pfcHeavy: "हेभी-ड्युटी (करेन्ट-रेटेड)", pfcDet: "डिट्युन्ड रियाक्टर बैंक (५.७ % वा ७ %; तेस्रो हार्मोनिक बलियो भए १४ %)",
  pfcMotorK: "मोटरमा सुझाव", pfcMotorMax: "यसभन्दा बढी कहिल्यै होइन (सेल्फ-एक्साइटेसन)", pfcOverload: "ओभरलोड रिले यति अनुपातले घटाउनुहोस्",
  pfcRound: "निर्माताको अर्को स्टेपमा माथि पुर्‍याउनुहोस्। डिस्चार्ज रेजिस्टर राख्नुहोस्, र इनरश घटाउने कन्ट्याक्टर प्रयोग गर्नुहोस्: स्विचिङमा पिक भोल्टेज २ देखि ३ गुणा हुन सक्छ।",
  pfcRule: "विद्युत नियमावली २०५०, नियम ४४: उपभोक्ताको पावर फ्याक्टर ०.८ ल्यागिङ भन्दा कम हुनु हुँदैन। लक्ष्य छान्नुअघि NEA को हालको दर हेर्नुहोस्।",
  pfcHigh: "०.९८ भन्दा माथि जानु विरलै फाइदाजनक हुन्छ र हल्का भारमा ओभर-भोल्टेजको जोखिम हुन्छ।", pfcNone: "लक्ष्य अहिलेको पावर फ्याक्टरभन्दा बढी छैन: क्यापासिटर चाहिँदैन।",
  pfcDetWarn: "धेरै इलेक्ट्रोनिक भार: सामान्य क्यापासिटर नेटवर्कसँग रेजोनेन्समा गई तात्न सक्छ। डिट्युन्ड रियाक्टर बैंक प्रयोग गर्नुहोस्।",
  pvVoc: "मोड्युलको Voc (ओपन सर्किट)", pvVmpp: "मोड्युलको Vmpp", pvIsc: "मोड्युलको Isc", pvCoef: "Voc को तापक्रम गुणांक, %/°C (ऋणात्मक)",
  pvVinv: "इन्भर्टरको अधिकतम DC भोल्टेज", pvVmin: "इन्भर्टरको MPPT न्यूनतम भोल्टेज", pvIinv: "इन्भर्टरको अधिकतम DC इनपुट करेन्ट",
  pvStrings: "समानान्तर स्ट्रिङ", pvModules: "प्रति स्ट्रिङ मोड्युल (० = अधिकतम)", pvModuleW: "मोड्युलको पावर", pvInvKW: "इन्भर्टरको AC पावर",
  pvIrm: "मोड्युलको अधिकतम रिभर्स करेन्ट IRM (ऐच्छिक)", pvLen: "DC तारको लम्बाइ (एकतर्फी)",
  pvTitle: "सोलार स्ट्रिङ", pvRange: "प्रति स्ट्रिङ मोड्युल", pvVocCold: "सबैभन्दा चिसो बिहानको स्ट्रिङ Voc", pvVmppHot: "सबैभन्दा तातो दिनको स्ट्रिङ Vmpp",
  pvStr: "इन्भर्टरले लिन सक्ने स्ट्रिङ", pvProt: "स्ट्रिङ फ्यूज", pvFuse: "फ्यूजको रेटिङ", pvCable: "DC तार", pvDrop: "DC भोल्टेज ड्रप",
  pvDouble: "१२० V DC भन्दा माथि: डबल-इन्सुलेटेड PV तार र DC उपकरण प्रयोग गर्नुहोस्।", pvNoFit: "चिसो दिनको भोल्टेज सीमा र तातो दिनको न्यूनतम दुवैमा मिल्ने मोड्युल संख्या छैन: यो मोड्युल र इन्भर्टर मिल्दैनन्।",
  pvProtYes: "चाहिन्छ, हरेक स्ट्रिङमा एउटा", pvProtNo: "चाहिँदैन", pvRatio: "इन्भर्टर र एरेको पावर अनुपात",
  pvRatioNote: "०.८ देखि १.० सामान्य छनोट हो (युरोपेली अभ्यास)।", pvStrNo: "इन्भर्टरको करेन्ट सीमाले दिनेभन्दा बढी स्ट्रिङ।",
  pvSpd: "इन्भर्टरमा SPD राख्नुहोस्। DC तार १० m भन्दा लामो भए प्यानल नजिकको बक्समा दोस्रो SPD पनि।",
  pvCool: "Tmin र Tmax तपाईंको क्षेत्रबाट; मोड्युलको तापक्रम हावाको तापक्रम + ३० °C (अनुमान)।",
  pvLead: "भोल्टेजका नियम: सबैभन्दा कम तापक्रममा मोड्युल × Voc इन्भर्टरको अधिकतमभन्दा कम, र सबैभन्दा बढी सेल तापक्रममा मोड्युल × Vmpp यसको MPPT न्यूनतमभन्दा माथि हुनुपर्छ।",
});

const DEC_BOOK_NE = { "far-end fault must trip the breaker": "टाढाको फल्टमा ब्रेकर ट्रिप हुनुपर्ने" };

function lvFaultSys(system) {
  const mm2 = +S.supplyMm2 || 70;
  const row = DATA.lvIs.tables.XLPE["4"].rows.find((r) => r.size === mm2);
  return faultAtDistance({ kva: +S.trafoKva || 200, lengthM: Math.max(0, +S.supplyM || 0), rOhmKm: row?.rdc20.al ?? 0.64,
    xOhmKm: interp(DATA.lvReactance.XLPE.multi, mm2).value, singlePhase: system === "1ph" });
}

/** Breaker curve, far-end fault and harmonic inputs for the sizing engine (LV). */
function protectionInputs(inp, kind, kW, starter) {
  if (JOBS[S.job]?.kind === "pfc" || JOBS[S.job]?.kind === "pv") return;
  const curve = eng() ? S.curve || "C" : mcbCurve({ kind, kW: kW || 0, starter });
  if (!eng() || S.tripOn) inp.trip = { curve, iscKA: lvFaultSys(inp.system), earthing: S.earthing === "TN" ? "TN" : "TT" };
  const threePhase4w = inp.system === "3ph" && inp.cores !== "3";
  if (threePhase4w && (eng() || ["shop", "building"].includes(S.job) || (S.job === "house" && S.phase === "3ph"))) inp.h3 = Math.max(0, +S.h3 || 0);
}

function earthBlock(res) {
  const c = res.chosen;
  let h = `<div class="volt"><h3 class="rh">${ic("earth", 18)} ${tr("efTitle")}</h3>`;
  if (S.earthing === "TN") {
    const t = disconnectTime({ system: "TN", uo: 230 });
    h += `<dl class="kv"><dt>${tr("efTime")}</dt><dd>${t} s</dd>${c.lmax != null ? `<dt>${tr("efLmax")}</dt><dd>${fmt(c.lmax, 0)} m</dd>` : ""}</dl><p class="hint">${tr("efTNrule")}</p>`;
  } else {
    const tt = ttCheck(+S.earthRa || 30);
    h += `<dl class="kv"><dt>${tr("efTime")}</dt><dd>${disconnectTime({ system: "TT", uo: 230 })} s</dd>
      <dt>${tr("efMain")}</dt><dd>${tt.main ? tt.main + " mA" : "–"}</dd></dl>
      <div class="tablewrap"><table><thead><tr><th class="l">${tr("efTable")}</th><th>${tr("efMaxRa")}</th><th class="l"></th></tr></thead><tbody>${tt.rows.map((r) =>
        `<tr><td class="l">${r.ma} mA</td><td>${fmt(r.maxRa, 0)} Ω</td><td class="l ${r.ok ? "yes" : "no"}">${r.ok ? "✓ " + tr("efOk") : "✗ " + tr("efNo")}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">${tr("efTT")} ${tr("efSockets")}.</p>${tt.only30 ? `<p class="err">${tr("efOnly30")}</p>` : ""}${!tt.ok ? `<p class="err">${tr("efBad")}</p>` : ""}`;
  }
  return h + `<p class="hint">${tr("efTimes")}</p></div>`;
}

function demandBlock(d) {
  const ne = S.lang === "ne" && !eng();
  if (!d.rows.length) return `<p class="err">${tr("dmEmpty")}</p>`;
  let h = `<div class="volt"><h3 class="rh">${ic("layers", 18)} ${tr("dmTitle")}</h3><dl class="kv">
    <dt>${tr("dmInstalled")}</dt><dd>${fmt(d.installedKW, 1)} kW · ${fmt(d.installedKVA, 1)} kVA</dd>
    <dt>${tr("dmAfterKu")}</dt><dd>${fmt(d.afterKu, 1)} kVA</dd>
    <dt>${tr("dmKs")}</dt><dd>${d.ks}</dd>
    <dt>${tr("dmReq")}</dt><dd>${fmt(d.requiredKVA, 1)} kVA</dd>
    <dt>${tr("dmCur")}</dt><dd>${fmt(d.currentA, 0)} A</dd>
    <dt>${tr("dmTr")}</dt><dd>${d.transformer ? d.transformer + " kVA" : "–"}</dd>
    ${d.transformerFlc ? "" : ""}${d.transformerFlcA ? `<dt>${tr("dmTrFlc")}</dt><dd>${fmt(d.transformerFlcA, 0)} A</dd>` : ""}</dl>
    <div class="tablewrap"><table><thead><tr><th class="l">${tr("ldType")}</th><th>kW</th><th>kVA</th><th>ku</th><th>kVA × ku</th></tr></thead><tbody>${d.rows.map((r) =>
      `<tr><td class="l">${esc(ne ? LOAD_TYPES[r.type].ne : LOAD_TYPES[r.type].en)} × ${r.qty}</td><td>${fmt(r.installedKW, 1)}</td><td>${fmt(r.installedKVA, 1)}</td><td>${r.ku}</td><td>${fmt(r.afterKuKVA, 1)}</td></tr>`).join("")}</tbody></table></div>`;
  if (d.mvLikely) h += `<p class="hint">${tr("dmMv")}</p>`;
  else if (d.largeConsumer) h += `<p class="hint">${tr("dmLarge")}</p>`;
  return h + `</div>`;
}

function testsBlock(res) {
  const tt = S.earthing !== "TN";
  const items = PRE_ENERGISE.filter((t, i) => (i === 5 ? !tt : true));
  return `<details class="box"><summary>${ic("check", 17)} ${tr("testsTitle")}</summary><ul class="plain">${items.map((x) => `<li>${esc(L2(x))}</li>`).join("")}</ul></details>`;
}

// ---- Power factor correction job
function renderPfc() {
  const ne = S.lang === "ne" && !eng();
  const ans = $("#answer"), work = $("#working"), sticky = $("#sticky");
  $("#w-h").innerHTML = `${ic("calc", 22)} ${tr("calcTitle")}`;
  $("#copy").innerHTML = `${ic("copy", 16)} ${tr("copy")}`; $("#print").innerHTML = `${ic("print", 16)} ${tr("print")}`;
  drawCable($("#xsec"), null); $("#xsec-cap").textContent = "";
  const kw = +S.pfcKw, pf1 = +S.pfcPf1, pf2 = +S.pfcPf2;
  if (!(kw > 0 && pf1 > 0 && pf1 <= 1 && pf2 > 0 && pf2 <= 1)) { ans.innerHTML = `<p class="err">${ic("alert", 16)} ${tr("dmEmpty")}</p>`; work.innerHTML = ""; sticky.textContent = ""; return; }
  const motor = S.pfcMode === "motor";
  const p = pfCorrection({ kw, pf1, pf2, nllPct: +S.pfcNll, individualMotor: motor, ioA: +S.pfcIo || null });
  let h = "";
  if (pf2 <= pf1) h = `<div class="fail-box"><p class="buy">${ic("alert", 20)} ${tr("pfcNone")}</p></div>`;
  else {
    const typeTxt = p.bank === "standard" ? tr("pfcStd") : p.bank === "heavy-duty" ? tr("pfcHeavy") : tr("pfcDet");
    h += `<p class="ask">${ic("cart", 16)} ${tr("pfcBuy")}</p><p class="buy">${fmt(Math.ceil(p.qc * 10) / 10, 1)} kvar, 415 V, ${S.lang === "ne" ? "३ फेज" : "3-phase"}</p>
      <p class="buy-sub">${esc(typeTxt)}</p><div class="kvs">`;
    h += kvRow("zap", tr("pfcIn"), `${fmt(p.inA, 1)} A`);
    h += kvRow("shield", tr("pfcLong"), `${fmt(p.longA, 0)} A (${p.bank === "detuned" ? "1.31" : "1.5"} × IN)`);
    h += kvRow("shield", tr("pfcShort"), `${fmt(p.shortA, 0)} A (10 × IN)`);
    h += kvRow("gauge", tr("pfcI1"), `${fmt(p.i1, 1)} A`);
    h += kvRow("gauge", tr("pfcI2"), `${fmt(p.i2, 1)} A`);
    h += kvRow("check", tr("pfcCut"), `${fmt(p.currentCutPct, 0)} % · ${fmt(p.lossCutPct, 0)} %`);
    if (motor) {
      h += kvRow("plug", tr("pfcMotorK"), `${fmt(p.motorSuggestKvar, 1)} kvar`);
      if (p.motorMaxKvar) h += kvRow("alert", tr("pfcMotorMax"), `${fmt(p.motorMaxKvar, 1)} kvar`);
      h += kvRow("alert", tr("pfcOverload"), `× ${fmt(1 / p.overloadReduce, 2)}`);
    }
    h += `</div><ul class="notes"><li>${ic("info", 15)}<span>${tr("pfcRound")}</span></li><li>${ic("info", 15)}<span>${tr("pfcRule")}</span></li>
      ${p.bank === "detuned" ? `<li>${ic("alert", 15)}<span>${tr("pfcDetWarn")}</span></li>` : ""}${pf2 > 0.98 ? `<li>${ic("alert", 15)}<span>${tr("pfcHigh")}</span></li>` : ""}</ul>`;
  }
  ans.innerHTML = h;
  sticky.textContent = pf2 > pf1 ? `${fmt(Math.ceil(p.qc * 10) / 10, 1)} kvar` : "";
  work.innerHTML = `<p class="lead-s">${ne ? "क्यापासिटरको साइज Qc = P (tan φ१ − tan φ२) बाट निकालिएको; सुरक्षा Electrical Installation Guide 2018 को अध्याय L अनुसार।" : "Capacitor size from Qc = P (tan φ1 − tan φ2); protection settings follow the Electrical Installation Guide 2018, chapter L."}</p>
    <ol class="trail"><li><b>Qc</b> = ${fmt(kw, 1)} kW × (tan ${fmt(Math.acos(pf1) * 180 / Math.PI, 1)}° − tan ${fmt(Math.acos(pf2) * 180 / Math.PI, 1)}°) = ${fmt(Math.tan(Math.acos(pf1)), 3)} − ${fmt(Math.tan(Math.acos(pf2)), 3)} → <b>${fmt(p.qc, 1)} kvar</b></li>
    <li><b>IN</b> = Q / (√3 × U) = ${fmt(p.qc, 1)} / (√3 × 0.4) = <b>${fmt(p.inA, 1)} A</b></li>
    <li><b>${ne ? "ब्रेकर" : "Breaker"}</b>: ${p.bank === "detuned" ? "1.31" : "1.5"} × IN, ${ne ? "छोटो-समय" : "short-time"} 10 × IN (${ne ? "इनरश सहन" : "rides out the inrush"})</li>
    <li><b>${ne ? "करेन्ट" : "Current"}</b>: I = P / (√3 × U × cos φ): ${fmt(p.i1, 1)} A → ${fmt(p.i2, 1)} A; ${ne ? "I²R हानि" : "I²R loss"} ${fmt(p.lossCutPct, 0)} % ${ne ? "कम" : "less"}</li></ol>`;
}

// ---- Solar string job
function renderPv() {
  const ne = S.lang === "ne" && !eng();
  const ans = $("#answer"), work = $("#working"), sticky = $("#sticky");
  $("#w-h").innerHTML = `${ic("calc", 22)} ${tr("calcTitle")}`;
  $("#copy").innerHTML = `${ic("copy", 16)} ${tr("copy")}`; $("#print").innerHTML = `${ic("print", 16)} ${tr("print")}`;
  drawCable($("#xsec"), null); $("#xsec-cap").textContent = "";
  const reg = NP_REGIONS[S.region] || NP_REGIONS.hills;
  const tMin = reg.tMin, tCellMax = reg.air + 30;
  const need = ["pvVoc", "pvVmpp", "pvIsc", "pvVinv", "pvVmin", "pvIinv"].every((k) => +S[k] > 0);
  if (!need) { ans.innerHTML = `<p class="err">${ic("alert", 16)} ${tr("dmEmpty")}</p>`; work.innerHTML = ""; sticky.textContent = ""; return; }
  const p = pvStrings({ voc: +S.pvVoc, vmpp: +S.pvVmpp, isc: +S.pvIsc, coefPct: +S.pvCoef || -0.28, tMin, tCellMax, vInvMax: +S.pvVinv, vMpptMin: +S.pvVmin,
    iInvMax: +S.pvIinv, strings: Math.max(1, +S.pvStrings || 1), irm: +S.pvIrm || null, moduleW: +S.pvModuleW || null, inverterKW: +S.pvInvKW || null,
    nModules: +S.pvModules > 0 ? +S.pvModules : null });
  let h = "", cable = null, cableErr = null;
  if (!p.feasible) h = `<div class="fail-box"><p class="buy">${ic("alert", 20)} ${tr("pvNoFit")}</p></div>`;
  else {
    try {
      cable = sizeConductor(ADAPTERS["LV-IEC"], { system: "dc", voltage: p.stringVmppV, load: { power: 1.25 * (+S.pvIsc), unit: "A" }, material: "cu", insulation: "XLPE",
        cores: "1", method: "C", armoured: false, sizeOn: "current", lengthM: +S.pvLen || 30, vdLimitPct: 3, minSize: 4, minSizeRule: "PV cable, typical minimum",
        env: { airTemp: reg.air + 20, groundTemp: 20, soilRes: 250, depthMm: 700 }, group: { count: Math.max(1, +S.pvStrings || 1), spacing: "touching", formation: "flat", racks: 1 } });
    } catch (e) { cableErr = e.message; }
    h += `<p class="ask">${ic("cart", 16)} ${tr("pvTitle")}</p><p class="buy">${p.nMin} ${S.lang === "ne" ? "देखि" : "to"} ${p.nMax} ${S.lang === "ne" ? "मोड्युल प्रति स्ट्रिङ" : "modules per string"}</p><div class="kvs">`;
    h += kvRow("layers", tr("pvRange"), `${p.nMin} – ${p.nMax}  (${S.lang === "ne" ? "प्रयोग" : "using"} ${p.n})`);
    h += kvRow("zap", tr("pvVocCold"), `${fmt(p.stringVocColdV, 0)} V  (≤ ${fmt(+S.pvVinv, 0)} V)`);
    h += kvRow("thermo", tr("pvVmppHot"), `${fmt(p.stringVmppHotV, 0)} V  (≥ ${fmt(+S.pvVmin, 0)} V)`);
    h += kvRow("plug", tr("pvStr"), `${p.maxStrings}  (${S.lang === "ne" ? "योजना" : "planned"} ${+S.pvStrings || 1})`);
    h += kvRow("shield", tr("pvProt"), p.protect ? tr("pvProtYes") : tr("pvProtNo"));
    if (p.protect) h += kvRow("shield", tr("pvFuse"), `${fmt(p.fuseMinA, 1)} – ${fmt(p.fuseMaxA, 1)} A (1.5 – 2.4 × Isc)`);
    if (cable?.chosen) h += kvRow("cable", tr("pvCable"), `${cable.chosen.size} mm² Cu, 1.1 kV`) + kvRow("gauge", tr("pvDrop"), `${fmt(cable.chosen.vdPct, 1)} % (≤ 3 %)`);
    if (p.inverterRatio) h += kvRow("calc", tr("pvRatio"), `${fmt(p.inverterRatio, 2)}`);
    h += `</div>`;
    if (!p.stringsOk) h += meter(tr("pvStr"), +S.pvStrings || 1, p.maxStrings, "", false);
    h += `<ul class="notes">${!p.stringsOk ? `<li>${ic("alert", 15)}<span>${tr("pvStrNo")}</span></li>` : ""}${p.doubleInsulation ? `<li>${ic("alert", 15)}<span>${tr("pvDouble")}</span></li>` : ""}
      <li>${ic("info", 15)}<span>${tr("pvSpd")}</span></li>${p.inverterRatio ? `<li>${ic("info", 15)}<span>${tr("pvRatioNote")}</span></li>` : ""}<li>${ic("info", 15)}<span>${tr("pvCool")}</span></li></ul>`;
  }
  ans.innerHTML = h;
  sticky.textContent = p.feasible ? `${p.nMin}–${p.nMax} / ${S.lang === "ne" ? "स्ट्रिङ" : "string"}` : "";
  work.innerHTML = `<p class="lead-s">${tr("pvLead")}</p><ol class="trail">
    <li><b>Voc ${ne ? "चिसोमा" : "cold"}</b> = ${fmt(+S.pvVoc, 1)} × (1 + ${fmt((+S.pvCoef || -0.28) / 100, 4)} × (${tMin} − 25)) = <b>${fmt(p.vocCold, 1)} V</b> → ${ne ? "अधिकतम" : "max"} ${fmt(+S.pvVinv, 0)} / ${fmt(p.vocCold, 1)} = <b>${p.nMax}</b></li>
    <li><b>Vmpp ${ne ? "तातोमा" : "hot"}</b> = ${fmt(+S.pvVmpp, 1)} × (1 + ${fmt((+S.pvCoef || -0.28) / 100, 4)} × (${tCellMax} − 25)) = <b>${fmt(p.vmppHot, 1)} V</b> → ${ne ? "न्यूनतम" : "min"} ${fmt(+S.pvVmin, 0)} / ${fmt(p.vmppHot, 1)} = <b>${p.nMin}</b></li>
    <li><b>${ne ? "स्ट्रिङ" : "Strings"}</b>: ${fmt(+S.pvIinv, 0)} A / ${fmt(+S.pvIsc, 1)} A Isc = <b>${p.maxStrings}</b>; ${ne ? "सुरक्षा चाहिने नियम" : "protection needed when"} 1.35 × IRM &lt; (Ns − 1) × Isc${+S.pvIrm ? "" : (ne ? " (IRM थाहा नभए दुईभन्दा बढी स्ट्रिङमा चाहिन्छ)" : " (without IRM: more than two strings)")}</li>
    <li><b>${ne ? "DC तार" : "DC cable"}</b>: I = 1.25 × Isc = ${fmt(1.25 * (+S.pvIsc), 1)} A; ${ne ? "ड्रप ≤ ३ %" : "drop at most 3 %"}${cableErr ? `; ${esc(cableErr)}` : ""}</li></ol>`;
}

// ---- Load list table (building job)
function loadTable() {
  const rows = (S.loads || []).map((l, i) => `<tr><td><select name="ld_${i}_type" aria-label="${tr("ldType")}">${Object.entries(LOAD_TYPES).map(([k, t]) =>
    `<option value="${k}"${l.type === k ? " selected" : ""}>${esc(S.lang === "ne" ? t.ne : t.en)}</option>`).join("")}</select></td>
    <td><input type="number" name="ld_${i}_qty" value="${esc(l.qty)}" min="0" step="1" inputmode="numeric" aria-label="${tr("ldQty")}"></td>
    <td><input type="number" name="ld_${i}_kw" value="${esc(l.kw)}" min="0" step="any" inputmode="decimal" aria-label="${tr("ldKw")}"></td>
    <td><button type="button" class="icon-btn" data-del-load="${i}" aria-label="${tr("ldDel")}">${ic("x", 16)}</button></td></tr>`).join("");
  return `<div class="field"><span class="lbl">${tr("loadList")}</span><div class="tablewrap"><table class="loads"><thead><tr><th class="l">${tr("ldType")}</th><th>${tr("ldQty")}</th><th>${tr("ldKw")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <button type="button" class="btn ghost" data-add-load>${ic("plug", 16)} ${tr("ldAdd")}</button></div>`;
}

// ---------- events ----------
function readField(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? "" : Number(el.value);
  return el.value;
}
const form = $("#f");
form.addEventListener("input", (e) => {
  if (!e.target.name) return;
  const ld = /^ld_(\d+)_(type|qty|kw)$/.exec(e.target.name);
  if (ld) { if (S.loads?.[+ld[1]]) S.loads[+ld[1]][ld[2]] = readField(e.target); save(); compute(); return; }
  S[e.target.name] = readField(e.target);
  if (e.target.hasAttribute("data-struct")) onStruct(e.target.name);
  save(); compute();
});
function onStruct(name) {
  if (name === "job") { const j = JOBS[S.job]; Object.assign(S, j.defaults); S.level = j.level;
    if (j.level === "HV") { S.material = "al"; S.lengthM = 1500; S.faultOn = true; S.cores = "3"; S.method = "ground"; S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900; if (S.route === "conduit") S.route = "buried"; }
    else { if (S.lengthM > 500) S.lengthM = 40; if (S.level !== "HV") S.material = "cu"; } }
  if (name === "loadType") {
    if (S.loadType === "motor") { S.unit = "HP"; S.system = "3ph"; S.motorStartOn = true; }
    else if (S.loadType === "amps") S.unit = "A";
    else { S.unit = "kW"; S.motorStartOn = false; }
  }
  if (name === "system" && !eng()) S.voltage = S.system === "1ph" ? 230 : 400;
  if (name === "system" && eng()) S.voltage = S.system === "1ph" ? 230 : S.system === "dc" ? 48 : 400;
  if (name === "hvKv") S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900;
  if (name === "lineKv") {
    const LD = { "11": [1000, 8, 0.9], "33": [8000, 20, 0.9], "66": [20000, 30, 0.9], "132": [60, 60, 0.95], "220": [250, 120, 0.95], "400": [1000, 150, 0.95] };
    const [load, km, pf] = LD[String(S.lineKv)] || LD["11"];
    S.lineKva = load; S.lineKm = km; S.linePf = pf; S.lineCct = "1";
  }
  if (name === "region" && REGIONS[S.region]?.air) { S.airTemp = REGIONS[S.region].air; S.groundTemp = REGIONS[S.region].ground; }
  const active = document.activeElement?.name;
  renderForm();
  if (active) document.querySelector(`[name="${active}"]`)?.focus();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-set]");
  if (!b || b.disabled) return;
  S[b.dataset.set] = b.dataset.val;
  if (b.dataset.set === "level" && !eng()) {
    if (S.level === "HV" && JOBS[S.job].level !== "HV") { S.job = "hvfeed"; onStruct("job"); }
    if (S.level === "LV" && JOBS[S.job].level === "HV") { S.job = "house"; onStruct("job"); S.material = "cu"; }
  }
  if (b.dataset.set === "level") {
    if (S.level === "HV") { S.unit = "kVA"; S.power = 2000; S.lengthM = 2000; S.faultKa = 13.1; S.faultT = 1; S.faultOn = true; S.cores = "3"; S.insulation = "XLPE"; S.method = "ground"; S.material = "al"; S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900; S.margin = 25; }
    else { S.unit = "kW"; S.power = 15; S.lengthM = 40; S.faultKa = 10; S.faultT = 0.1; S.faultOn = false; S.cores = "4"; S.depthMm = 750; S.material = "cu"; }
  }
  if (b.dataset.set === "std") {
    if (S.std === "IEC") { S.airTemp = 30; S.groundTemp = 20; S.soilRes = 250; S.depthMm = 700; S.cores = "5"; }
    else { const R = REGIONS[S.region]; S.airTemp = R?.air ?? 40; S.groundTemp = R?.ground ?? 30; S.soilRes = 150; S.depthMm = 750; S.cores = "4"; }
  }
  const A = adapter();
  const allowed = A.options.methods.map(([m]) => m);
  if (!allowed.includes(S.method)) S.method = allowed[0];
  save(); renderForm(); compute(); renderExamples();
});
$("#copy").addEventListener("click", async () => {
  const t = $("#answer").innerText;
  try { await navigator.clipboard.writeText(t); $("#copy").textContent = "Copied"; } catch { $("#copy").textContent = "Copy failed — use Print"; }
  setTimeout(() => ($("#copy").textContent = "Copy result"), 1800);
});
$("#print").addEventListener("click", () => window.print());

renderForm();
compute();
paintCardIcons();
renderExamples();
