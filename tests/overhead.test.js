import test from "node:test";
import assert from "node:assert/strict";
import { ampacity, radiation, airProps, reactance, gmd, lineDrop } from "../src/overhead.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test("air density falls with altitude (Kathmandu ~1400 m vs sea level)", () => {
  const sea = airProps(50, 0).rhof, ktm = airProps(50, 1400).rhof;
  near(ktm / sea, 0.84, 0.01);
});

test("radiation formula, IEEE 738 eq. 7a sanity", () => {
  // D = 28.14 mm, ε 0.8, Tc 100, Ta 40: 17.8·0.02814·0.8·((3.73)^4 − (3.13)^4) ≈ 39.1 W/m
  near(radiation({ D: 0.02814, Tc: 100, Ta: 40, emissivity: 0.8 }), 39.1, 0.5);
});

test("ampacity rises with wind and falls with altitude and ambient", () => {
  const dog = { dia_mm: 14.15, r20_ohm_km: 0.2733 };
  const base = { Tc: 75, Ta: 40, wind: 0.6, elevation: 0, solar: 1000 };
  const a0 = ampacity(dog, base).I;
  assert.ok(ampacity(dog, { ...base, wind: 1.5 }).I > a0);
  assert.ok(ampacity(dog, { ...base, elevation: 1400 }).I < a0);
  assert.ok(ampacity(dog, { ...base, Ta: 45 }).I < a0);
  assert.ok(a0 > 250 && a0 < 380, `Dog at 40 °C/75 °C: ${a0.toFixed(0)} A`);
});

test("reactance of an 11 kV line ~0.35 Ω/km", () => {
  const D = gmd(760, 760, 1520); // flat cross-arm, 760 mm phase spacing
  near(reactance({ gmdMm: D, gmrMm: 0.81 * 14.15 / 2 }), 0.35, 0.05);
});

test("line drop and losses", () => {
  const r = lineDrop({ kV: 11, I: 100, lengthKm: 10, rOhmKm: 0.30, xOhmKm: 0.35, pf: 0.85 });
  near(r.pct, (Math.sqrt(3) * 100 * 10 * (0.30 * 0.85 + 0.35 * Math.sqrt(1 - 0.85 ** 2)) / 11000) * 100, 1e-9);
  near(r.lossKW, 90, 1e-9);
});

import { sizeLine } from "../src/overhead.js";
import { DATA } from "../src/data.js";

test("11 kV, 1 MVA over 8 km in the Terai: voltage drop decides (Rabbit ~5.5 % fails, Raccoon ~4 % passes)", () => {
  const r = sizeLine(DATA.overhead, { kV: 11, loadKVA: 1000, pf: 0.9, lengthKm: 8, type: "acsr", Ta: 45, wind: 0.56,
    elevation: 150, solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: 75, gmdMm: 1000, vdLimitPct: 5 });
  assert.ok(Math.abs(r.I - 52.49) < 0.1);
  assert.equal(r.chosen.name, "Raccoon");
  assert.ok(r.chosen && r.chosen.amp >= r.I && r.chosen.pct <= 5);
  assert.ok(r.decidedBy.includes("voltage drop"), "long 11 kV lines are limited by voltage drop");
});

test("altitude lowers ampacity of the same conductor (Kathmandu vs Terai at same temperature)", () => {
  const base = { kV: 11, loadKVA: 100, pf: 0.9, lengthKm: 1, type: "acsr", Ta: 40, wind: 0.56, solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: 75, gmdMm: 1000, vdLimitPct: 5 };
  const dog = (el) => sizeLine(DATA.overhead, { ...base, elevation: el }).cands.find((c) => c.name === "Dog").amp;
  assert.ok(dog(1400) < dog(150));
});

test("3 MVA over 15 km at 11 kV is not feasible on one circuit: reactance dominates (honest failure)", () => {
  const r = sizeLine(DATA.overhead, { kV: 11, loadKVA: 3000, pf: 0.9, lengthKm: 15, type: "acsr", Ta: 45, wind: 0.56,
    elevation: 150, solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: 75, gmdMm: 1000, vdLimitPct: 5 });
  assert.equal(r.chosen, null);
  assert.match(r.warnings.join(" "), /higher voltage/);
});

test("132 kV never picks a conductor thinner than Panther (corona/mechanical minimum)", () => {
  const r = sizeLine(DATA.overhead, { kV: 132, loadKVA: 60000, pf: 0.9, lengthKm: 60, type: "acsr", Ta: 45, wind: 0.56,
    elevation: 150, solar: 1045, absorptivity: 0.8, emissivity: 0.45, Tc: 85, gmdMm: 5400, vdLimitPct: 10 });
  assert.ok(r.chosen.dia_mm >= 20.95, r.chosen.name);
});
