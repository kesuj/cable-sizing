import test from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS, DATA } from "../src/adapters/index.js";
import { sizeConductor } from "../src/size.js";

const hv = ADAPTERS["HV-IS"];
const base = { system: "3ph", sizeOn: "current", material: "al", insulation: "XLPE", method: "ground",
  env: { airTemp: 40, groundTemp: 30, soilRes: 150, depthMm: 900 }, group: { count: 1, spacing: "touching", formation: "flat" },
  vdLimitPct: 5, hvSource: "polycab" };

test("HV data: every Polycab 1 s rating equals k·S within 3 %", () => {
  assert.deepEqual(DATA.hvIs.self_checks, []);
});

test("11 kV, 5 MVA, 2 circuits in a trench: ampacity decides 300 mm² Al", () => {
  const r = sizeConductor(hv, { ...base, voltage: 11000, grade: "11", cores: "3", load: { power: 5000, unit: "kVA" },
    group: { count: 2, spacing: "touching", formation: "flat" }, lengthM: 3000, fault: { ka: 13.1, timeS: 1 } });
  assert.ok(Math.abs(r.current.Ib - 262.43) < 0.05);
  assert.equal(r.chosen.size, 300); // 355 A × 0.79 = 280.5 A ≥ 262.4 A; 240 mm²: 315 × 0.79 = 248.9 A
  assert.deepEqual(r.decidedBy, ["current-carrying capacity"]);
});

test("33 kV small load: short circuit decides (13.1 kA·1 s → 139 mm² → 150 mm²)", () => {
  const r = sizeConductor(hv, { ...base, voltage: 33000, grade: "33", cores: "3", load: { power: 5000, unit: "kVA" },
    env: { ...base.env, depthMm: 1050 }, lengthM: 3000, fault: { ka: 13.1, timeS: 1 } });
  assert.equal(r.chosen.size, 150);
  assert.ok(Math.abs(r.chosen.scMin - 139.36) < 0.1);
});

test("HV factors use MV tables, not LV PVC ground table", () => {
  const { factors } = hv.factors({ ...base, grade: "11", cores: "3", env: { ...base.env, groundTemp: 40 } }, 240, 1);
  assert.equal(factors.find((f) => f.key === "kTemp").value, 0.91); // LV PVC table would give 0.87
});

test("long 11 kV feeder is decided by voltage drop", () => {
  const r = sizeConductor(hv, { ...base, voltage: 11000, grade: "11", cores: "3", load: { power: 3000, unit: "kVA", pf: 0.85 },
    lengthM: 25000, fault: null });
  assert.ok(r.decidedBy.includes("voltage drop"));
  assert.ok(r.chosen.vdPct <= 5);
});
