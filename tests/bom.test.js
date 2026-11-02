import test from "node:test";
import assert from "node:assert/strict";
import { glandFor, conduitFor, capacitorFor, hvFuseFor, lvFaultKA, bomFor } from "../src/bom.js";

test("gland ranges are honoured", () => {
  assert.equal(glandFor(22, true), "25");
  assert.equal(glandFor(39.4, true), "50S"); // 39.4 mm is at the top of size 40 (27.9–40.4); 50S (35.2–46.7) centres on it (CMP)
  assert.equal(glandFor(10, false), "20");   // fits 20S (6.1–11.7) and 20 (6.5–14.0); 20 centres on 10 mm
});
test("conduit size from SP 30 Table 4", () => {
  assert.equal(conduitFor(2.5, 3), 16);
  assert.equal(conduitFor(4, 3), 20);
  assert.equal(conduitFor(10, 5), 32);
  assert.equal(conduitFor(50, 6), null);
});
test("capacitor kVAR from SP 30 Annex F", () => {
  assert.equal(capacitorFor(1.5), null);
  assert.equal(capacitorFor(3.7), 2);
  assert.equal(capacitorFor(7.5, 1500), 4);
});
test("HV fuse (ABB CEF-S) and transformer LV fault level", () => {
  assert.equal(hvFuseFor(200, 11), 40);
  assert.equal(hvFuseFor(1000, 33), 40);
  assert.ok(Math.abs(lvFaultKA(200) - 6.4) < 0.05);
  assert.ok(Math.abs(lvFaultKA(400) - 12.8) < 0.05);
});
test("house main BOM contains Nepal Rule 59 isolator, RCCB, SPD and earthing", () => {
  const res = { spec: { system: "1ph", cores: "2", material: "cu", armoured: true, method: "ground", lengthM: 40 }, current: { I: 30, In: 32 },
    chosen: { size: 6 }, runs: 1, earthSize: 6 };
  const items = bomFor({ res, kind: "main", S: {}, route: "buried", od: 16 }).map((x) => x.item.en);
  for (const w of ["Main isolating switch", "RCCB at the main board", "Surge protective device (SPD)", "Earth electrode", "Cable glands, double compression"]) assert.ok(items.includes(w), w);
});
