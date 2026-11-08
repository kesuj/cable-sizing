import test from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS } from "../src/adapters/index.js";
import { sizeConductor } from "../src/size.js";

const A = ADAPTERS["LV-IS"];
const long = { system: "3ph", voltage: 400, load: { power: 30, unit: "A", pf: 0.9 }, material: "al", insulation: "XLPE", cores: "4",
  method: "air", lengthM: 200, vdLimitPct: 5, env: { airTemp: 35 } };

test("minimum fault: a 200 m aluminium run needs more copper to make the breaker trip at the far end", () => {
  const without = sizeConductor(A, long);
  assert.equal(without.chosen.size, 25);
  const withTrip = sizeConductor(A, { ...long, trip: { curve: "C", iscKA: 6, earthing: "TT" } });
  assert.equal(withTrip.chosen.size, 35);
  assert.equal(withTrip.iaTrip, 320);                       // C curve, 32 A breaker: 10 × In
  assert.ok(withTrip.chosen.lmax >= 200);
  assert.ok(withTrip.decidedBy.includes("far-end fault must trip the breaker"));
});

test("minimum fault in TN: the smaller PE above 16 mm² shortens the protected length", () => {
  const tn = sizeConductor(A, { ...long, trip: { curve: "C", iscKA: 6, earthing: "TN" } });
  assert.equal(tn.chosen.size, 50);
});

test("a high fault level turns the breaker into an MCCB with a 12 × In trip allowance", () => {
  const r = sizeConductor(A, { ...long, trip: { curve: "C", iscKA: 16, earthing: "TT" } });
  assert.equal(r.iaTrip, 384);                               // 12 × 32 A
});

test("harmonics: neutral current governs above 33 % (EIG example 37 A: 44.4 A at 40 %, 55.5 A at 50 %)", () => {
  const h = { system: "3ph", voltage: 400, load: { power: 37, unit: "A", pf: 0.9 }, material: "cu", insulation: "PVC", cores: "4",
    method: "air", lengthM: 20, env: { airTemp: 30 } };
  const size = (h3) => sizeConductor(A, { ...h, h3 });
  assert.equal(size(10).harmonic.basis, "phase");
  assert.equal(size(20).harmonic.basis, "phase");
  assert.ok(size(20).chosen.size >= size(10).chosen.size);
  const r40 = size(40), r50 = size(50);
  assert.equal(r40.harmonic.basis, "neutral");
  assert.ok(Math.abs(r40.current.basis - 44.4) < 0.05);
  assert.ok(Math.abs(r50.current.basis - 55.5) < 0.05);
  assert.ok(r40.chosen.factors.some((f) => f.key === "kHarm"));
});

test("harmonics: a 3½-core cable is refused above 15 % third harmonic", () => {
  const r = sizeConductor(A, { system: "3ph", voltage: 400, load: { power: 37, unit: "A", pf: 0.9 }, material: "cu", insulation: "PVC",
    cores: "3.5", method: "air", lengthM: 20, env: { airTemp: 30 }, h3: 20 });
  assert.ok(r.warnings.some((w) => /4-core/.test(w)));
});
