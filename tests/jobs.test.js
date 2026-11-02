import test from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS } from "../src/adapters/index.js";
import { sizeConductor } from "../src/size.js";
import { JOBS, routeFor, coresFor, voltageAtLoad, smallerSize, protectionFor } from "../src/jobs.js";

function run(jobId, answers, route, lengthM, std = "IS") {
  const job = JOBS[jobId];
  const t = job.toInput({ ...job.defaults, ...answers });
  const r = routeFor(route, std, job.level);
  const input = { ...t.input, method: r.method, lengthM, material: job.level === "HV" ? "al" : "cu",
    insulation: t.input.insulation || "XLPE", armoured: true, env: { airTemp: 35, groundTemp: 25, soilRes: 150, depthMm: 750 } };
  input.cores = t.input.cores || coresFor(t, input.system, r.method, r.adapterKey);
  return { res: sizeConductor(ADAPTERS[r.adapterKey], input), t };
}

test("1 HP borewell pump 200 m away: long run decided by voltage, voltage at pump reported", () => {
  const { res } = run("pump", { phase: "1ph", motorBasis: "amps", amps: 7 }, "buried", 200);
  assert.ok(res.decidedBy.some((d) => /voltage|motor/.test(d)));
  const v = voltageAtLoad(res);
  assert.ok(v.atLoad >= 230 * 0.95 - 0.01 && v.lowAtLoad < v.atLoad);
  const s = smallerSize(res);
  assert.ok(s && s.why.length >= 1);
});

test("house main from a 30 A NEA meter: sized for 30 A, DP breaker", () => {
  const { res, t } = run("house", { houseBasis: "meter", meterA: 30, phase: "1ph" }, "buried", 15);
  assert.equal(res.current.I, 30);
  assert.equal(res.current.In, 32);
  assert.match(protectionFor(t.kind, res)[0].en, /32 A 2-pole/);
});

test("geyser in conduit uses IEC method B1 single-core wires even in Nepal mode", () => {
  const r = routeFor("conduit", "IS", "LV");
  assert.deepEqual(r, { adapterKey: "LV-IEC", method: "B1" });
  const { res } = run("heater", { kw: 2 }, "conduit", 20);
  assert.equal(res.spec.cores, "1");
});

test("HV 500 kVA transformer feed at 11 kV: fault decides (13.1 kA, 1 s → 150 mm² Al)", () => {
  const { res } = run("hvfeed", { hvKv: "11", kva: 500 }, "buried", 1500);
  assert.equal(res.chosen.size, 150);
  assert.deepEqual(res.decidedBy, ["short-circuit withstand"]);
});
