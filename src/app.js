// UI for the conductor sizing workbench. All engineering lives in core.js / size.js / adapters.
import { ADAPTERS } from "./adapters/index.js";
import { sizeConductor, cableDescription } from "./size.js";
import { round, kValue } from "./core.js";
import { drawCable } from "./xsec.js";

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
};

let S = { ...DEFAULT_STATE };
try { Object.assign(S, JSON.parse(localStorage.getItem("cs-state") || "{}")); } catch { /* storage blocked */ }
const save = () => { try { localStorage.setItem("cs-state", JSON.stringify(S)); } catch { /* ignore */ } };

const adapterKey = () => `${S.level}-${S.level === "HV" ? "IS" : S.std}`;
const adapter = () => ADAPTERS[adapterKey()] || ADAPTERS["LV-IS"];
const eng = () => S.mode === "engineer";

// ---------- field helpers ----------
function num(name, label, { suffix, hint, step = "any", min = 0 } = {}) {
  const input = `<input type="number" id="${name}" name="${name}" value="${esc(S[name])}" step="${step}" min="${min}" inputmode="decimal">`;
  return `<div class="field"><label for="${name}">${label}</label>${suffix ? `<div class="unit">${input}<span class="suffix">${suffix}</span></div>` : input}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
}
function sel(name, label, opts, { hint, struct } = {}) {
  const o = opts.map(([v, t]) => `<option value="${esc(v)}"${String(S[name]) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("");
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}"${struct ? " data-struct" : ""}>${o}</select>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
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
  const A = adapter();
  let res, err = null, notes = [];
  try {
    const b = buildInput(); notes = b.notes;
    res = sizeConductor(A, b.inp);
  } catch (e) { err = e.message; }
  last = { res, err, notes, A };
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
    h += `<p class="decided">Size decided by <b>${esc(res.decidedBy.join(" and "))}</b>.</p>`;
    const allNotes = [...notes.filter((n) => !n.startsWith("Climate") || !eng()), ...res.warnings];
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
  if (b.dataset.set === "level") {
    if (S.level === "HV") { S.unit = "kVA"; S.power = 2000; S.lengthM = 2000; S.faultKa = 13.1; S.faultT = 1; S.faultOn = true; S.cores = "3"; S.insulation = "XLPE"; S.method = "ground"; S.material = "al"; S.depthMm = Number(S.hvKv) >= 22 ? 1050 : 900; S.margin = 25; }
    else { S.unit = "kW"; S.power = 15; S.lengthM = 40; S.faultKa = 10; S.faultT = 0.1; S.faultOn = false; S.cores = "4"; S.depthMm = 750; S.material = "cu"; }
  }
  if (b.dataset.set === "std") {
    if (S.std === "IEC") { S.airTemp = 30; S.groundTemp = 20; S.soilRes = 250; S.depthMm = 700; S.cores = "5"; }
    else { const R = REGIONS[S.region]; S.airTemp = R?.air ?? 40; S.groundTemp = R?.ground ?? 30; S.soilRes = 150; S.depthMm = 750; S.cores = "4"; }
  }
  const A = adapter();
  const allowed = !eng() && A.options.simpleMethods ? A.options.simpleMethods : A.options.methods.map(([m]) => m);
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
