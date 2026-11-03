// Run: node --test tests/
// Every expected number here is worked by hand in docs/WORKED_EXAMPLES.md.
import test from "node:test";
import assert from "node:assert/strict";
import { DATA } from "../src/data.js";
import { loadCurrent, voltageDrop, minSizeShortCircuit, kValue, faultWithstand, nextDevice, interp,
  tempFactorFormula, earthConductorSize } from "../src/core.js";
import { makeIsLv } from "../src/adapters/is_lv.js";
import { sizeConductor } from "../src/size.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const lv = makeIsLv(DATA);

test("load current, all units", () => {
  near(loadCurrent({ system: "3ph", voltage: 400, power: 10, unit: "kW", pf: 0.8 }), 18.04);
  near(loadCurrent({ system: "1ph", voltage: 230, power: 2300, unit: "W", pf: 1 }), 10);
  near(loadCurrent({ system: "3ph", voltage: 400, power: 100, unit: "kVA" }), 144.34);
  // 30 HP = 22.371 kW shaft; /(√3·400·0.85·0.9) = 42.21 A
  near(loadCurrent({ system: "3ph", voltage: 400, power: 30, unit: "HP", pf: 0.85, eff: 0.9 }), 42.21);
  near(loadCurrent({ system: "dc", voltage: 48, power: 2.4, unit: "kW" }), 50);
});

test("standard device rating", () => {
  assert.equal(nextDevice(18.04), 20);
  assert.equal(nextDevice(63), 63);
  assert.equal(nextDevice(5000), null);
});

test("temperature formula reproduces IS tables", () => {
  near(tempFactorFormula(70, 45, 40), 0.913, 0.02); // IS table: 0.90
  near(tempFactorFormula(70, 40, 30), 0.866, 0.01); // IS ground table: 0.87
  near(tempFactorFormula(90, 50, 40), 0.894, 0.01); // IS XLPE table: 0.90
});

test("interpolation", () => {
  assert.equal(interp({ 40: 1, 45: 0.9 }, 45).value, 0.9);
  near(interp({ 40: 1, 45: 0.9 }, 42.5).value, 0.95);
  assert.ok(interp({ 100: 1.1, 150: 1, 200: 0.92 }, 250).outside);
});

test("voltage drop formulas", () => {
  // 3-ph, 18.04 A, 50 m, R 8.87, X 0.1, pf 0.8 → √3·18.04·0.05·(7.096+0.06)
  near(voltageDrop({ system: "3ph", current: 18.04, lengthM: 50, r: 8.87, x: 0.1, pf: 0.8 }), 11.18, 0.02);
  near(voltageDrop({ system: "1ph", current: 10, lengthM: 20, r: 7.41, pf: 1 }), 2.964);
  near(voltageDrop({ system: "dc", current: 50, lengthM: 10, r: 1.15 }), 1.15);
});

test("short-circuit minimum size and k values", () => {
  assert.equal(kValue("XLPE", "cu", 95), 143);
  assert.equal(kValue("PVC", "al", 400), 68);
  near(minSizeShortCircuit(15, 0.2, 94), 71.36);
});

test("fault withstand: 6 mm² Cu XLPE at 6.4 kA", () => {
  const w = faultWithstand("XLPE", "cu", 6, 6.4);
  assert.equal(w.k, 143);
  near(w.allow, 736164, 1);          // (143 × 6)² A²s
  near(w.tMs, 17.97, 0.05);          // 736164 / 6400² = 17.97 ms
});

test("earth conductor table 54.2", () => {
  const s = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
  assert.equal(earthConductorSize(10, s), 10);
  assert.equal(earthConductorSize(25, s), 16);
  assert.equal(earthConductorSize(95, s), 50);
});

test("data errata were applied", () => {
  const row = (ins, c, s) => DATA.lvIs.tables[ins][c].rows.find((r) => r.size === s);
  assert.equal(row("XLPE", "3", 25).amp.duct.al, 85);
  assert.equal(row("PVC", "1", 500).rdc20.al, 0.0605);
  assert.equal(row("XLPE", "4", 630).amp.ground.cu, null);
});

test("example 1: 10 kW house feeder, 4C PVC Cu in duct, 50 m", () => {
  const r = sizeConductor(lv, { load: { power: 10, unit: "kW", pf: 0.8 }, lengthM: 50,
    material: "cu", insulation: "PVC", cores: "4", method: "duct" });
  assert.equal(r.current.In, 20);
  assert.equal(r.chosen.size, 2.5);
  near(r.chosen.vdPct, 2.80, 0.02);
});

test("example 2: 30 HP pump, Al XLPE 3C buried, 3 circuits, 250 m, 15 kA/0.2 s", () => {
  const r = sizeConductor(lv, { load: { power: 30, unit: "HP", pf: 0.85, eff: 0.9 }, motorFactor: 1.25,
    motorStart: { multiple: 6, pf: 0.3 }, lengthM: 250, material: "al", insulation: "XLPE", cores: "3",
    method: "ground", group: { count: 3 }, fault: { ka: 15, timeS: 0.2 } });
  assert.equal(r.current.In, 63);
  assert.equal(r.governing.ampacity, 25); // 94 A × 0.69 = 64.9 A ≥ 63 A
  assert.equal(r.chosen.size, 95); // short circuit needs 71.4 mm²
  assert.deepEqual(r.decidedBy, ["short-circuit withstand"]);
});

test("example 3: long run is decided by voltage drop", () => {
  const r = sizeConductor(lv, { system: "1ph", voltage: 230, load: { power: 5, unit: "kW", pf: 0.9 },
    lengthM: 200, material: "cu", insulation: "PVC", cores: "2", method: "air", vdLimitPct: 5 });
  assert.ok(r.decidedBy.includes("voltage drop"));
  assert.ok(r.chosen.vdPct <= 5);
});

test("example 4: big load goes to parallel runs", () => {
  const r = sizeConductor(lv, { load: { power: 1500, unit: "kVA" }, lengthM: 60, material: "cu",
    insulation: "XLPE", cores: "1", method: "air", armoured: false });
  assert.ok(r.runs >= 2, "needs parallel runs");
  assert.ok(r.ok);
});

test("harsh Terai summer: 45 °C air derates PVC to 0.90", () => {
  const { factors } = lv.factors({ method: "air", insulation: "PVC", env: { airTemp: 45 }, group: { racks: 1 } }, 25, 1);
  assert.equal(factors.find((f) => f.key === "kTemp").value, 0.9);
});
