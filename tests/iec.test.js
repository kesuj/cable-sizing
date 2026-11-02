import test from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS, DATA } from "../src/adapters/index.js";
import { sizeConductor } from "../src/size.js";

const iec = ADAPTERS["LV-IEC"];
const near = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) <= t, `${a} ≉ ${b}`);

test("IEC table spot values (B.52.4/B.52.5)", () => {
  const a = DATA.iec.ampacity;
  assert.equal(a.PVC.Cu.B1["2"]["2.5"], 24);
  assert.equal(a.XLPE.Cu.C["2"]["2.5"], 33);
  assert.equal(a.XLPE.Cu.C["3"]["1.5"], 22);
  assert.equal(a.XLPE.Cu.E["3"]["50"], 192); // corrected GOST transcription slip (102)
});

test("house circuit: 3.5 kW single phase, PVC wires in conduit (B1), 3 circuits bunched", () => {
  const r = sizeConductor(iec, { system: "1ph", voltage: 230, load: { power: 3.5, unit: "kW", pf: 1 }, cores: "1",
    method: "B1", insulation: "PVC", material: "cu", armoured: false, env: { airTemp: 30 }, group: { count: 3 }, lengthM: 25 });
  assert.equal(r.current.In, 16);
  assert.equal(r.chosen.size, 2.5); // 24 A × 0.70 = 16.8 A ≥ 16 A
  near(r.chosen.k, 0.7);
});

test("Terai heat under IEC: 45 °C air on XLPE gives 0.87", () => {
  const { factors } = iec.factors({ method: "E", insulation: "XLPE", cores: "4", env: { airTemp: 45 }, group: {} }, 16, 1);
  assert.equal(factors[0].value, 0.87);
});

test("method/core mismatch is explained, not silently wrong", () => {
  assert.throws(() => sizeConductor(iec, { cores: "4", method: "B1", material: "cu", insulation: "PVC" }), /single-core/);
});

test("buried D2, soil 1.0 K·m/W improves rating by 1.5", () => {
  const { factors } = iec.factors({ method: "D2", insulation: "XLPE", cores: "4", env: { groundTemp: 20, soilRes: 100, depthMm: 700 }, group: { spacing: "touching" } }, 16, 1);
  assert.equal(factors.find((f) => f.key === "kSoil").value, 1.5);
});
