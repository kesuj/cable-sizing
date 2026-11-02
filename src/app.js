// UI for the conductor sizing workbench. All engineering lives in core.js / size.js / adapters.
import { ADAPTERS } from "./adapters/index.js";
import { sizeConductor, cableDescription } from "./size.js";
import { round, kValue } from "./core.js";
import { drawCable } from "./xsec.js";
import { JOBS, ROUTES, REGIONS as NP_REGIONS, NEA_METERS, STARTERS, PUMPS, EV, routeFor, coresFor, protectionFor, voltageAtLoad, smallerSize } from "./jobs.js";
import { explainHtml, routePic, houseMap } from "./explain.js";

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
  vdLimitPct: 5, vdStartLimitPct: 15, faultOn: false, faultBasis: "kat", faultKa: 10, faultT: 0.1, i2t: 40000, sizeOn: "device",
  hvKv: 11, hvEarth: "E", hvSource: "polycab", minSize: "",
  lang: "en", job: "house", route: "buried",
  ...Object.values(JOBS).reduce((o, j) => ({ ...o, ...j.defaults }), {}), ...JOBS.house.defaults, hvKv: "11", faultKa: 10, faultT: 0.1,
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
function choices(name, label, opts, struct = true) {
  const items = opts.map(([v, t, d]) => `<label class="choice"><input type="radio" name="${name}" value="${esc(v)}"${String(S[name]) === String(v) ? " checked" : ""}${struct ? " data-struct" : ""}><div><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ""}</div></label>`).join("");
  return `<fieldset class="field" style="border:0;padding:0;margin:0 0 16px"><legend class="lbl" style="padding:0;margin-bottom:4px">${label}</legend><div class="choices">${items}</div></fieldset>`;
}
const check = (name, label, struct = true) =>
  `<label class="check"><input type="checkbox" name="${name}"${S[name] ? " checked" : ""}${struct ? " data-struct" : ""}> ${label}</label>`;
const row = (...f) => `<div class="row">${f.join("")}</div>`;

// ---------- render form ----------
function renderForm() {
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
        num("margin", "Future growth allowance", { suffix: "%" }), num("motorFactor", "Motor branch factor", { step: 0.05, hint: "1.25 for a single motor (IS 732 / NEC practice), else 1." }));
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
  return { inp, notes };
}

// ---------- results ----------
let last = null;
function compute() {
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
  return `<div class="meter${good ? "" : " bad"}"><div class="top-line"><span>${label}</span><b>${fmt(value)} / ${fmt(limit)} ${unit}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function renderResult() {
  const { res, err, notes, A } = last;
  const ans = $("#answer"), work = $("#working"), sticky = $("#sticky");
  if (err) {
    ans.innerHTML = `<p class="err">${esc(err)}</p>`; work.innerHTML = ""; sticky.textContent = ""; drawCable($("#xsec"), null); $("#xsec-cap").textContent = "";
    return;
  }
  const c = res.chosen, s = res.spec, hv = S.level === "HV";
  const grade = A.voltageGrade instanceof Function ? A.voltageGrade(s) : A.voltageGrade;
  drawCable($("#xsec"), c ? { cores: s.cores, size: c.size, material: s.material, armoured: s.armoured, hv, kv: s.voltage / 1000, single: s.cores === "1" } : null);
  $("#xsec-cap").textContent = c ? `Cross-section of one ${s.cores === "1" ? "core" : "cable"}, drawn to scale (approx.)` : "";
  let h = "";
  if (!c) {
    h = `<div class="fail-box"><p class="buy">No standard cable works for this.</p>${res.warnings.map((w) => `<p>${esc(w)}</p>`).join("")}</div>`;
    sticky.textContent = "No standard cable works — see the working";
  } else {
    const buy = cableDescription(res, grade);
    const extra = Math.ceil(s.lengthM * 1.1);
    h += `<p class="buy">${esc(buy)}</p><p class="buy-sub">Order about ${extra} m per run (10 % extra for bends and terminations).</p>`;
    h += `<dl class="kv">`;
    h += `<dt>Load current</dt><dd>${fmt(res.current.I)} A</dd>`;
    if (Math.abs(res.current.Ib - res.current.I) > 0.01) h += `<dt>Design current</dt><dd>${fmt(res.current.Ib)} A</dd>`;
    if (res.current.In) h += `<dt>${S.loadType === "motor" ? "Breaker (minimum)" : "Breaker / fuse"}</dt><dd>${res.current.In} A${s.system === "1ph" ? " DP" : s.system === "3ph" ? (s.cores === "3" ? " TP" : " TPN") : ""}</dd>`;
    if (hv) h += `<dt>Relay setting must not exceed</dt><dd>${fmt(c.iz * res.runs, 0)} A</dd>`;
    if (hv) h += `<dt>Metallic screen</dt><dd>check earth-fault rating</dd>`;
    else h += `<dt>Earth conductor</dt><dd>${res.earthSize} mm² ${s.material === "cu" ? "Cu" : "Al"}</dd>`;
    h += `</dl>`;
    h += meter("Current vs cable capacity", res.current.basis / res.runs, c.iz, "A", c.pass.ampacity);
    h += meter("Voltage drop", c.vdPct, s.vdLimitPct, "%", c.pass.voltageDrop);
    if (c.vdStartPct != null) h += meter("Dip at motor start", c.vdStartPct, s.vdStartLimitPct, "%", c.pass.motorStart);
    if (c.scMin != null) h += meter("Size needed for the fault", c.scMin, c.size, "mm²", c.pass.shortCircuit);
    const DEC_NE = { "current-carrying capacity": "करेन्ट बोक्ने क्षमता", "voltage drop": "भोल्टेज ड्रप", "motor starting voltage dip": "मोटर सुरु हुँदा भोल्टेज झर्ने", "short-circuit withstand": "सर्ट सर्किट सहने क्षमता", "smallest size in the table": "तालिकाको सबैभन्दा सानो साइज" };
    const dec = res.decidedBy.map((d) => (!eng() && S.lang === "ne" ? (DEC_NE[d] || (d.startsWith("the minimum size rule") ? "न्यूनतम साइजको नियम (NBC 207 / IEC)" : d)) : d));
    h += `<p class="decided">${tr("decided")} <b>${esc(dec.join(S.lang === "ne" && !eng() ? " र " : " and "))}</b>.</p>`;
    if (last.simple) h += renderSimpleResult(res, last.simple);
    const allNotes = [...(last.simple ? [] : notes.filter((n) => !n.startsWith("Climate") || !eng())), ...res.warnings];
    if (allNotes.length) h += `<ul class="notes">${allNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
    sticky.textContent = `${res.runs > 1 ? res.runs + " × " : ""}${c.size} mm² ${s.material === "cu" ? "Cu" : "Al"}${res.current.In ? ` · ${res.current.In} A breaker` : ""}`;
  }
  ans.innerHTML = h;
  work.innerHTML = renderWorking(res, A);
}

function renderWorking(res, A) {
  const s = res.spec, c = res.chosen;
  const sys = s.system === "3ph" ? "I = P / (√3 × U × pf × η)" : s.system === "dc" ? "I = P / (U × η)" : "I = P / (U × pf × η)";
  let h = `<h3>Step by step</h3><ol class="trail">`;
  h += `<li><b>Load current.</b> ${sys} = <b>${fmt(res.current.I, 2)} A</b> (${fmt(s.load.power)} ${s.load.unit}, ${fmt(s.voltage, 0)} V${s.load.unit !== "kVA" && s.load.unit !== "A" ? `, pf ${s.load.pf}` : ""}).</li>`;
  if (Math.abs(res.current.Ib - res.current.I) > 0.01) h += `<li><b>Design current</b> Ib = I × (1 + margin ${fmt(s.designMargin * 100, 0)} %) × motor factor ${s.motorFactor} = <b>${fmt(res.current.Ib, 2)} A</b>.</li>`;
  if (res.current.In) h += `<li><b>Protective device.</b> Next standard rating at or above Ib: <b>In = ${res.current.In} A</b>. The cable must carry at least In after derating (Ib ≤ In ≤ Iz, IEC 60364-4-43 / IS 732).</li>`;
  else h += `<li><b>Sizing basis.</b> The cable must carry the design current Ib after derating; protection relays are then set at or below the cable's derated rating.</li>`;
  if (c) {
    h += `<li><b>Rating factors</b> for the chosen size (they depend on the installation):<div class="tablewrap"><table><thead><tr><th>Factor</th><th class="l">Basis</th><th>Value</th></tr></thead><tbody>${c.factors.map((f) => `<tr><td>${esc(f.label)}</td><td class="l">${esc(f.basis)}</td><td>${f.value.toFixed(3)}</td></tr>`).join("")}<tr><td><b>Total k</b></td><td class="l">product of all factors</td><td><b>${c.k.toFixed(3)}</b></td></tr></tbody></table></div></li>`;
    h += `<li><b>Required table rating</b> = ${fmt(res.current.basis / res.runs, 1)} A ÷ ${c.k.toFixed(3)} = <b>${fmt(res.current.basis / res.runs / c.k, 1)} A</b>${res.runs > 1 ? ` per run (${res.runs} runs in parallel)` : ""}.</li>`;
    h += `<li><b>Voltage drop</b> ΔU = ${s.system === "3ph" ? "√3" : "2"} × I × L × (R cos φ + X sin φ) with R at maximum conductor temperature = <b>${fmt(c.vd, 2)} V (${fmt(c.vdPct, 2)} %)</b>.</li>`;
    if (c.scMin != null && s.fault.i2t) h += `<li><b>Short circuit</b> (current-limiting device) S ≥ √(I²t) / k = √${s.fault.i2t} ÷ ${kValue(s.insulation, s.material, c.size)} = <b>${fmt(c.scMin, 1)} mm²</b>.</li>`;
    else if (c.scMin != null) h += `<li><b>Short circuit</b> S ≥ I·√t / k = ${s.fault.ka * 1000} A × √${s.fault.timeS} s ÷ ${kValue(s.insulation, s.material, c.size)} = <b>${fmt(c.scMin, 1)} mm²</b>.</li>`;
    else if (S.level !== "HV") h += `<li><b>Short circuit</b> not checked. For final circuits protected by an MCB/MCCB with instantaneous trip, the breaker's low let-through energy normally protects any cable it can overload-protect. Check it for transformer feeders, fuse-protected or time-delayed circuits.</li>`;
    h += `<li><b>Smallest size passing every check: ${c.size} mm²</b>, estimated conductor temperature at full load ${fmt(c.theta, 0)} °C.</li>`;
  }
  h += `</ol><h3>Every size tried</h3><div class="tablewrap"><table><thead><tr><th>Size mm²</th><th>Table A</th><th>× k</th><th>Derated A</th><th>Needs A</th><th>VD %</th>${res.candidates.some((x) => x.vdStartPct != null) ? "<th>Start dip %</th>" : ""}${res.candidates.some((x) => x.scMin != null) ? "<th>Fault needs mm²</th>" : ""}<th class="l">Result</th></tr></thead><tbody>`;
  const need = res.current.basis / res.runs;
  for (const x of res.candidates) {
    const why = Object.entries(x.pass).filter(([, v]) => !v).map(([k]) => ({ ampacity: "too hot", voltageDrop: "voltage drop", motorStart: "start dip", shortCircuit: "fault" }[k]));
    h += `<tr class="${x === c ? "chosen" : ""}"><td>${x.size}</td><td>${fmt(x.amp, 0)}</td><td>${x.k.toFixed(3)}</td><td class="${x.pass.ampacity ? "" : "no"}">${fmt(x.iz, 1)}</td><td>${fmt(need, 1)}</td><td class="${x.pass.voltageDrop ? "" : "no"}">${fmt(x.vdPct, 2)}</td>${x.vdStartPct != null ? `<td class="${x.pass.motorStart ? "" : "no"}">${fmt(x.vdStartPct, 1)}</td>` : ""}${x.scMin != null ? `<td class="${x.pass.shortCircuit ? "" : "no"}">${fmt(x.scMin, 1)}</td>` : ""}<td class="l ${x.ok ? "yes" : "no"}">${x.ok ? (x === c ? "chosen" : "passes") : "fails: " + why.join(", ")}</td></tr>`;
  }
  h += `</tbody></table></div><p><small>Data: ${esc(A.title)}. Method and sources: <a href="guide.html">How it works</a>.</small></p>`;
  return h;
}


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
const tr = (k) => (eng() ? UI.en : UI[S.lang] || UI.en)[k] ?? UI.en[k] ?? k;
const L2 = (o) => (S.lang === "ne" && o.ne ? o.ne : o.en);
const STEP_EN = ["What the cable will power", "Where the cable runs", "The cable", "Checks"];
function setStepTitles(t) {
  ["#s1", "#s2", "#s3", "#s4"].forEach((id, i) => { const n = document.querySelector(id); if (n) n.innerHTML = `<span class="n">${i + 1}</span> ${esc(t[i])}`; });
  const s4 = document.querySelector("#s4")?.closest("section");
  if (s4) s4.hidden = t[3] === "";
}

const ICONS = {
  house: '<path d="M4 14 L16 4 L28 14 V28 H4 Z"/><path d="M13 28 V20 H19 V28"/>',
  heater: '<rect x="8" y="4" width="16" height="24" rx="4"/><path d="M12 22 q2 -3 0 -6 q-2 -3 0 -6 M20 22 q2 -3 0 -6 q-2 -3 0 -6"/>',
  ac: '<rect x="3" y="8" width="26" height="10" rx="2"/><path d="M8 22 v4 M16 22 v6 M24 22 v4"/>',
  pump: '<circle cx="12" cy="18" r="8"/><path d="M20 18 H29 M12 10 V4 H20"/><path d="M9 18 h6 M12 15 v6"/>',
  ev: '<path d="M5 20 L8 12 H22 L26 20 V25 H5 Z"/><circle cx="10" cy="25" r="2.5"/><circle cx="21" cy="25" r="2.5"/><path d="M16 4 l-3 5 h4 l-3 5"/>',
  shop: '<path d="M4 12 H28 L26 6 H6 Z"/><path d="M6 12 V28 H26 V12"/><path d="M13 28 V20 H19 V28"/>',
  hv: '<path d="M16 3 L10 29 M16 3 L22 29 M11 22 H21 M13 14 H19"/><path d="M6 8 H26"/>',
};
const icon = (k) => `<svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ""}</svg>`;
const ROUTE_HL = { house: "main", heater: "heater", ac: "heater", pump: "pump", ev: "ev", shop: "main", hvfeed: "service" };

function renderSimple() {
  const job = JOBS[S.job] || JOBS.house;
  const lang = S.lang;
  setStepTitles([tr("s1"), tr("s3"), tr("s4"), ""]);
  let h = `<fieldset class="field jobs"><legend class="lbl">${tr("job")}</legend><div class="jobgrid">` +
    Object.entries(JOBS).map(([k, j]) => `<label class="jobcard"><input type="radio" name="job" value="${k}"${S.job === k ? " checked" : ""} data-struct>${icon(j.icon)}<span>${esc(L2(j))}</span></label>`).join("") +
    `</div></fieldset>`;
  if (job.level === "LV") h += `<div class="figwrap map">${houseMap(ROUTE_HL[S.job])}</div>${explainHtml("run", lang)}`;
  else h += explainHtml("hv", lang);
  const F = {
    phase: () => sel("phase", tr("phase"), [["1ph", tr("ph1")], ["3ph", tr("ph3")]], { struct: true }),
    houseBasis: () => sel("houseBasis", tr("houseBasis"), [["meter", tr("hbMeter")], ["load", tr("hbLoad")]], { struct: true }),
    meterA: () => sel("meterA", tr("meterA"), NEA_METERS.map((a) => [a, `${a} A`])),
    kwNow: () => num("kwNow", tr("kwNow"), { suffix: "kW" }),
    kwFuture: () => num("kwFuture", tr("kwFuture"), { suffix: "kW" }),
    kw: () => num("kw", tr("kw"), { suffix: "kW" }),
    acBasis: () => sel("acBasis", tr("acBasis"), [["ton", tr("acTon")], ["amps", tr("amps")]], { struct: true }),
    acTon: () => sel("acTon", tr("acTon"), [["1", "1 ton (12 000 BTU)"], ["1.5", "1.5 ton (18 000 BTU)"], ["2", "2 ton (24 000 BTU)"]]),
    amps: () => num("amps", tr("amps"), { suffix: "A" }),
    acInverter: () => sel("acInverter", tr("acInverter"), [["yes", tr("yes")], ["no", tr("no")]]),
    pumpType: () => sel("pumpType", tr("pumpType"), Object.entries(PUMPS).map(([k, p]) => [k, L2(p)])),
    motorBasis: () => sel("motorBasis", tr("motorBasis"), [["hp", tr("mbHp")], ["amps", tr("mbAmps")]], { struct: true }),
    hp: () => num("hp", tr("hp"), { suffix: "HP" }),
    starter: () => sel("starter", tr("starter"), Object.entries(STARTERS).map(([k, p]) => [k, L2(p)])),
    evKw: () => sel("evKw", tr("evKw"), Object.entries(EV).map(([k, e]) => [k, e.en])),
    hvKv: () => sel("hvKv", tr("hvKv"), [["11", "11 kV"], ["33", "33 kV"]], { struct: true }),
    kva: () => num("kva", tr("kva"), { suffix: "kVA" }),
    faultKa: () => num("faultKa", tr("faultKa"), { suffix: "kA" }),
    faultT: () => num("faultT", tr("faultT"), { suffix: "s" }),
  };
  const fields = job.fields(S).map((f) => F[f]?.() || "");
  for (let i = 0; i < fields.length; i += 2) h += row(fields[i], fields[i + 1] || "");
  $("#load-fields").innerHTML = h;

  const routes = Object.entries(ROUTES).filter(([k]) => job.level === "LV" || ["buried", "duct", "tray", "clipped"].includes(k));
  if (!routes.some(([k]) => k === S.route)) S.route = routes[0][0];
  h = `<fieldset class="field"><legend class="lbl">${tr("route")}</legend><div class="routes">` +
    routes.map(([k, r]) => `<label class="routecard"><input type="radio" name="route" value="${k}"${S.route === k ? " checked" : ""} data-struct>${routePic(k)}<span>${esc(L2(r))}</span></label>`).join("") +
    `</div>${explainHtml("route", lang)}</fieldset>`;
  if (!NP_REGIONS[S.region] && S.region !== "custom") S.region = "hills";
  h += row(sel("region", tr("region"), [...Object.entries(NP_REGIONS).map(([k, r]) => [k, L2(r)]), ["custom", tr("custom")]], { struct: true }));
  if (S.region === "custom") h += row(num("airTemp", tr("airTemp"), { suffix: "°C" }), num("groundTemp", tr("groundTemp"), { suffix: "°C" }));
  h += row(num("lengthM", tr("lengthM"), { suffix: "m" }), num("groupCount", tr("groupCount"), { step: 1, min: 1 }));
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
  }
  const notes = t.assumptions.map(L2);
  if (reg) notes.push(L2({ en: `Climate: ${reg.en.split(" (")[0]}: air ${reg.air} °C, ground ${reg.ground} °C.`, ne: `मौसम: ${reg.ne.split(" (")[0]}: हावा ${reg.air} °C, जमिन ${reg.ground} °C।` }));
  if (iec && S.std === "IS") notes.push(L2({ en: "Cable in a pipe in the wall: IS catalogue tables only cover air, duct and ground, so IEC 60364-5-52 method B1 (single-core wires in conduit) is used.",
    ne: "भित्ताको पाइपभित्रको तार: IS तालिकामा यो अवस्था नभएकाले IEC 60364-5-52 को B1 विधि प्रयोग गरिएको।" }));
  return { inp, notes, A, simple: { t, job } };
}

function renderSimpleResult(res, sm) {
  let h = "";
  const v = voltageAtLoad(res);
  const bad = v.lowAtLoad < v.minOk;
  h += `<div class="volt${bad ? " bad" : ""}"><h3 class="rh">${sm.job.level === "HV" ? (S.lang === "ne" ? "ट्रान्सफर्मरमा पुग्ने भोल्टेज" : "Voltage at the transformer") : tr("vTitle")}</h3><dl class="kv">
    <dt>${tr("vNom")} ${fmt(v.nominal, 0)} V</dt><dd>${fmt(v.atLoad, 0)} V</dd>
    <dt>${tr("vLow")} (${fmt(v.low, 0)} V)</dt><dd>${fmt(v.lowAtLoad, 0)} V</dd></dl>
    ${v.unit !== "V" ? `<p class="hint">${tr("ph3note")}</p>` : ""}${bad ? `<p class="err">${tr("vBad")}</p>` : ""}</div>`;
  const prot = protectionFor(sm.t.kind, res, sm.t.starter);
  h += `<h3 class="rh">${tr("prot")}</h3><ul class="plain">${prot.map((p) => `<li>${esc(L2(p))}</li>`).join("")}${sm.job.level === "LV" ? `<li>${tr("earth")}: ${res.earthSize} mm² ${res.spec.material === "cu" ? "Cu" : "Al"}</li>` : ""}</ul>`;
  const sm1 = smallerSize(res);
  if (sm1 && sm1.why.length) h += `<p class="smaller"><b>${tr("whyNot")} ${sm1.size} mm²?</b> ${tr("wouldIt")} ${esc(sm1.why.map(L2).join(S.lang === "ne" ? ", र " : ", and "))}.</p>`;
  h += `<details class="why"><summary>${tr("assum")}</summary><ul class="plain">${last.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`;
  if (sm.job.level === "LV") h += `<details class="why"><summary>${tr("shop")}</summary><ul class="plain">${tr("shopList").map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
  return h;
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
  S[e.target.name] = readField(e.target);
  if (e.target.hasAttribute("data-struct")) onStruct(e.target.name);
  save(); compute();
});
function onStruct(name) {
  if (name === "job") { const j = JOBS[S.job]; Object.assign(S, j.defaults); S.level = j.level;
    if (j.level === "HV") { S.material = "al"; S.lengthM = 1500; S.faultOn = true; S.cores = "3"; S.method = "ground"; S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900; if (S.route === "conduit") S.route = "buried"; }
    else if (S.lengthM > 500) S.lengthM = 40; }
  if (name === "loadType") {
    if (S.loadType === "motor") { S.unit = "HP"; S.system = "3ph"; S.motorStartOn = true; }
    else if (S.loadType === "amps") S.unit = "A";
    else { S.unit = "kW"; S.motorStartOn = false; }
  }
  if (name === "system" && !eng()) S.voltage = S.system === "1ph" ? 230 : 400;
  if (name === "system" && eng()) S.voltage = S.system === "1ph" ? 230 : S.system === "dc" ? 48 : 400;
  if (name === "hvKv") S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900;
  if (name === "region" && REGIONS[S.region]?.air) { S.airTemp = REGIONS[S.region].air; S.groundTemp = REGIONS[S.region].ground; }
  const active = document.activeElement?.name;
  renderForm();
  if (active) document.querySelector(`[name="${active}"]`)?.focus();
}
document.querySelector(".switches").addEventListener("click", (e) => {
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
  save(); renderForm(); compute();
});
$("#copy").addEventListener("click", async () => {
  const t = [$("#answer").innerText, "", $("#working").innerText].join("\n");
  try { await navigator.clipboard.writeText(t); $("#copy").textContent = "Copied"; } catch { $("#copy").textContent = "Copy failed — use Print"; }
  setTimeout(() => ($("#copy").textContent = "Copy result"), 1800);
});
$("#print").addEventListener("click", () => window.print());

renderForm();
compute();
