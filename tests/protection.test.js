import test from "node:test";
import assert from "node:assert/strict";
import { ttCheck, disconnectTime, lmaxM, tripCurrent, harmonicNeutral, spdSpec } from "../src/protection.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test("TT: maximum earth resistance per RCD sensitivity (EIG p178: 30 mA gives 1666 ohm)", () => {
  const t = ttCheck(100);
  assert.equal(t.rows[0].maxRa, 1666);          // 30 mA
  assert.equal(t.rows[1].maxRa, 500);           // 100 mA
  assert.equal(t.rows[2].maxRa, 166);           // 300 mA
  assert.equal(t.main, 300);                    // 100 ohm: 300 mA still allowed? 166 >= 100 so yes
  near(t.maxIdnMA, 500, 1e-9);
});

test("TT: high electrode resistance leaves only a 30 mA main RCD; very high is a failure", () => {
  const t = ttCheck(1000);
  assert.deepEqual(t.rows.filter((r) => r.ok).map((r) => r.ma), [30]);
  assert.equal(t.only30, true);
  assert.equal(ttCheck(2000).ok, false);
  assert.equal(ttCheck(2000).main, null);
});

test("disconnection times at 230 V (EIG Fig. F7)", () => {
  assert.equal(disconnectTime({ system: "TN", uo: 230 }), 0.4);
  assert.equal(disconnectTime({ system: "TT", uo: 230 }), 0.2);
  assert.equal(disconnectTime({ system: "TN", uo: 230, distribution: true }), 5);
  assert.equal(disconnectTime({ system: "TT", uo: 230, distribution: true }), 1);
});

test("Lmax reproduces the book's worked example: 10 mm² Cu, 3-wire 400 V, MCCB 700 A ±20 %", () => {
  // EIG p258: Fig F25 gives 48 m, times 1.73 for a 3-phase 3-wire circuit = 83 m
  const l = lmaxM({ sph: 10, material: "cu", ia: 700 * 1.2, uo: 230, kind: "ll" });
  near(l, 83, 1);
});

test("Lmax aluminium is 0.62 of copper (EIG p258)", () => {
  const cu = lmaxM({ sph: 120, material: "cu", ia: 3200, kind: "ln" });
  const al = lmaxM({ sph: 120, material: "al", ia: 3200, kind: "ln" });
  near(al / cu, 0.62, 0.005);
});

test("Lmax falls when the return conductor is smaller", () => {
  const eq = lmaxM({ sph: 50, material: "cu", ia: 400, m: 1 });
  const half = lmaxM({ sph: 50, material: "cu", ia: 400, m: 2 });
  assert.ok(half < eq);
  near(half / eq, 2 / 3, 1e-9);
});

test("magnetic trip: MCB curve limits and MCCB with tolerance", () => {
  assert.equal(tripCurrent({ curve: "B", inA: 16 }), 80);
  assert.equal(tripCurrent({ curve: "C", inA: 32 }), 320);
  assert.equal(tripCurrent({ curve: "D", inA: 10 }), 200);
  assert.equal(tripCurrent({ inA: 100, mccb: true }), 1200);
});

test("third harmonic bands (EIG Fig. G19) and the 37 A example", () => {
  assert.deepEqual([harmonicNeutral(10).basis, harmonicNeutral(10).k5], ["phase", 1]);
  assert.deepEqual([harmonicNeutral(20).basis, harmonicNeutral(20).k5], ["phase", 0.86]);
  assert.deepEqual([harmonicNeutral(40).basis, harmonicNeutral(40).k5], ["neutral", 0.86]);
  assert.deepEqual([harmonicNeutral(50).basis, harmonicNeutral(50).k5], ["neutral", 1]);
  near(harmonicNeutral(40, 37).neutralA, 44.4, 1e-9);       // 37 × 0.4 × 3
  near(harmonicNeutral(50, 37).neutralA, 55.5, 1e-9);       // 37 × 0.5 × 3
  assert.equal(harmonicNeutral(20).neutralFull, true);
  assert.equal(harmonicNeutral(10).neutralFull, false);
});

test("SPD: Type 2 without a lightning rod, Uc at least 1.1 × 230 V, Imax by exposure", () => {
  const s = spdSpec({ exposure: "high" });
  assert.equal(s.type, "Type 2");
  assert.equal(s.ucMinV, 253);
  assert.equal(s.imaxKA, 65);
  assert.equal(spdSpec({ lightningRod: true }).type, "Type 1+2");
  assert.equal(spdSpec({ lightningRod: true }).leadMinMm2, 16);
});
