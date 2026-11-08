import test from "node:test";
import assert from "node:assert/strict";
import { demandCalc, diversityKs, pfCorrection, pvStrings } from "../src/planning.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test("power factor: book examples (EIG p388, p393)", () => {
  // 100 kW, 0.75 -> 0.93: the book rounds to 48 kvar; exact tan values give 48.7; kvar per kW = 0.487
  near(pfCorrection({ kw: 100, pf1: 0.75, pf2: 0.93 }).qc, 48.7, 0.1);
  near(pfCorrection({ kw: 500, pf1: 0.75, pf2: 0.93 }).qc, 244, 1);
  near(pfCorrection({ kw: 85.4, pf1: 0.7, pf2: 0.95 }).qc, 59, 1);
});

test("capacitor protection: 50 kvar at 400 V (EIG p407: IN 72 A, long 108 A or 94 A, short 720 A)", () => {
  const p = pfCorrection({ kw: 50 / (Math.tan(Math.acos(0.7)) - Math.tan(Math.acos(0.95))), pf1: 0.7, pf2: 0.95 });
  near(p.qc, 50, 0.01);
  near(p.inA, 72.2, 0.1);
  near(p.longA, 108.3, 0.2);          // plain capacitors, NLL <= 10 %
  near(p.shortA, 722, 1);
  const d = pfCorrection({ kw: 100, pf1: 0.7, pf2: 0.95, nllPct: 30 });
  assert.equal(d.bank, "detuned");
  near(d.longA / d.inA, 1.31, 1e-9);
});

test("harmonic share picks the capacitor type (EIG p402)", () => {
  assert.equal(pfCorrection({ kw: 100, pf1: 0.8, pf2: 0.95, nllPct: 8 }).bank, "standard");
  assert.equal(pfCorrection({ kw: 100, pf1: 0.8, pf2: 0.95, nllPct: 15 }).bank, "heavy-duty");
  assert.equal(pfCorrection({ kw: 100, pf1: 0.8, pf2: 0.95, nllPct: 25 }).bank, "detuned");
});

test("motor at its terminals: 25 % of kW, limited by the no-load current", () => {
  const m = pfCorrection({ kw: 75, pf1: 0.8, pf2: 0.95, individualMotor: true, ioA: 35 });
  near(m.motorSuggestKvar, 18.75, 1e-9);
  near(m.motorMaxKvar, 0.9 * 35 * 0.4 * Math.sqrt(3), 1e-9);
  near(m.overloadReduce, 0.8 / 0.95, 1e-9);
});

test("diversity ks by circuit count (IEC 61439-2) and lighting", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9, 10, 20].map((n) => diversityKs(n)), [1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6]);
  assert.equal(diversityKs(12, 0.9), 1);
});

test("demand: lighting and motors with ku, ks and growth", () => {
  const d = demandCalc({ rows: [{ type: "lighting", qty: 1, kw: 5 }, { type: "motor", qty: 2, kw: 7.5 }], growthPct: 25 });
  near(d.rows[0].installedKVA, 5 / 0.9, 1e-9);
  near(d.afterKu, 5 / 0.9 + (15 / 0.8) * 0.75, 1e-9);     // 5.556 + 14.0625 = 19.62
  assert.equal(d.ks, 0.9);                                  // two circuit groups, not mainly lighting
  near(d.requiredKVA, d.afterKu * 0.9 * 1.25, 1e-9);
  near(d.currentA, (d.requiredKVA * 1000) / (Math.sqrt(3) * 400), 1e-9);
  assert.equal(d.transformer, 50);
  assert.equal(d.largeConsumer, false);
});

test("demand: a 500 kVA-scale building flags MV and picks a standard transformer", () => {
  const d = demandCalc({ rows: [{ type: "motor", qty: 10, kw: 30 }, { type: "ac", qty: 20, kw: 3 }], growthPct: 20, ksOverride: 0.8 });
  assert.equal(d.ks, 0.8);
  assert.ok(d.mvLikely === (d.requiredKVA > 250));
  assert.ok(d.transformer >= d.requiredKVA);
});

test("solar strings: voltage limits from cold Voc and hot Vmpp (EIG p516)", () => {
  const p = pvStrings({ voc: 49.5, vmpp: 41.5, isc: 11.5, coefPct: -0.27, tMin: -5, tCellMax: 65, vInvMax: 600, vMpptMin: 120, iInvMax: 25, strings: 2 });
  near(p.vocCold, 49.5 * (1 + 0.0027 * 30), 1e-9);
  assert.equal(p.nMax, 11);          // 600 / 53.51
  assert.equal(p.nMin, 4);           // 120 / 37.02
  assert.equal(p.feasible, true);
  assert.equal(p.maxStrings, 2);
  assert.equal(p.stringsOk, true);
  assert.equal(p.protect, false);    // two strings: no string protection
});

test("solar string protection rule: 1.35 × IRM < (Ns − 1) × Isc", () => {
  const base = { voc: 49.5, vmpp: 41.5, isc: 11.5, tMin: 0, tCellMax: 60, vInvMax: 1000, vMpptMin: 200, iInvMax: 100 };
  assert.equal(pvStrings({ ...base, strings: 3 }).protect, true);                // IRM unknown, more than two strings
  assert.equal(pvStrings({ ...base, strings: 3, irm: 25 }).protect, false);      // 33.75 < 23 is false
  assert.equal(pvStrings({ ...base, strings: 5, irm: 25 }).protect, true);       // 33.75 < 46
  const f = pvStrings({ ...base, strings: 1 });
  near(f.fuseMinA, 17.25, 1e-9);
  near(f.fuseMaxA, 27.6, 1e-9);
});

test("solar: infeasible when the voltage window is empty", () => {
  const p = pvStrings({ voc: 49.5, vmpp: 41.5, isc: 11.5, tMin: -5, tCellMax: 65, vInvMax: 150, vMpptMin: 120, iInvMax: 25 });
  assert.equal(p.feasible, false);
});
