// IEC 60364-5-52:2009 LV adapter (Europe, UK base, most of Asia/Africa/Middle East, many donor-funded
// projects in Nepal). Ratings: Tables B.52.2–B.52.13; factors: B.52.14–B.52.19.
// Reference conditions differ from IS: air 30 °C, ground 20 °C, soil 2.5 K·m/W, depth 0.7 m.
import { interp, tempFactorFormula } from "../core.js";
import { reactance } from "./is_lv.js";

const ALPHA = { cu: 0.00393, al: 0.00403 };
const AIR = ["A1", "A2", "B1", "B2", "C", "E", "F", "F_flat_touching", "G_horizontal_spaced", "G_vertical_spaced"];
const SINGLE_ONLY = ["A1", "B1", "F", "F_flat_touching", "G_horizontal_spaced", "G_vertical_spaced"];
const MULTI_ONLY = ["A2", "B2", "E"];

function nextKey(keys, n) {
  const ks = keys.map(Number).sort((a, b) => a - b);
  return ks.find((k) => k >= n) ?? ks[ks.length - 1];
}

export function makeIecLv(DATA) {
  const T = DATA.iec;
  const C = T.correction;
  const loaded = (spec) => (spec.system === "3ph" ? "3" : "2");
  return {
    id: "IEC-LV",
    title: "IEC 60364-5-52:2009 Tables B.52.2–B.52.19 (international practice)",
    voltageGrade: "0.6/1 kV grade (IEC 60502-1)",
    isAir: (m) => AIR.includes(m),
    options: {
      insulations: [["XLPE", "XLPE / EPR (90 °C)"], ["PVC", "PVC (70 °C)"]],
      cores: [["1", "Single-core cables / wires"], ["2", "2 core"], ["3", "3 core"], ["4", "4 core"], ["5", "5 core"]],
      methods: [
        ["B1", "Single wires in a pipe or trunking on or in a masonry wall", "Normal house wiring: PVC conduit with single-core wires (IEC method B1)."],
        ["A1", "Single wires in a pipe inside a thermally insulated wall", "Wall filled with insulation or a timber frame (method A1). Lowest rating."],
        ["C", "Cable clipped directly to a wall or ceiling", "Sheathed cable fixed on the surface (method C)."],
        ["E", "Multicore cable on a perforated tray or in free air", "Factories, plant rooms (method E)."],
        ["D1", "Cable in a duct or pipe under the ground", "Method D1."],
        ["D2", "Cable buried directly in the ground", "Armoured or sheathed cable laid in the soil (method D2)."],
        ["A2", "Multicore cable in a pipe in an insulated wall", "Method A2."],
        ["B2", "Multicore cable in a pipe or trunking on a wall", "Method B2."],
        ["F", "Single-core cables touching in free air, trefoil", "Method F."],
        ["F_flat_touching", "Single-core cables in free air, flat and touching", "Method F (flat)."],
        ["G_horizontal_spaced", "Single-core cables in free air, spaced one diameter", "Method G."],
      ],
      simpleMethods: ["B1", "A1", "C", "E", "D1", "D2"],
      group: { D2: "circuits in the same trench", D1: "ducts side by side", default: "circuits run together" },
      spacings: {
        D2: [["touching", "Touching"], ["dia", "One cable diameter"], ["125", "125 mm"], ["250", "250 mm"], ["500", "500 mm"]],
        D1: [["touching", "Touching"], ["250", "250 mm"], ["500", "500 mm"], ["1000", "1 m"]],
      },
    },
    simpleCores(inp) {
      if (SINGLE_ONLY.includes(inp.method)) return "1";
      if (inp.system === "1ph" || inp.system === "dc") return "3"; // L + N + PE
      return "5"; // L1 L2 L3 N PE
    },
    thetaMax: (spec) => (spec.insulation === "PVC" ? 70 : 90),

    rows(spec) {
      const ins = spec.insulation === "PVC" ? "PVC" : "XLPE";
      const mat = spec.material === "cu" ? "Cu" : "Al";
      const single = spec.cores === "1";
      if (single && MULTI_ONLY.includes(spec.method)) throw new Error(`Method ${spec.method} is for multicore cables. Choose a multicore cable or another method.`);
      if (!single && SINGLE_ONLY.includes(spec.method)) throw new Error(`Method ${spec.method} is for single-core cables or wires. Choose "Single-core" or another method.`);
      const m = T.ampacity[ins][mat][spec.method];
      const t = m?.[loaded(spec)] || m?.["3"];
      if (!t) throw new Error(`IEC table has no ${loaded(spec)}-loaded-conductor values for method ${spec.method}.`);
      if (!m[loaded(spec)]) throw new Error(`Method ${spec.method} is tabulated for three-phase circuits only.`);
      const isT = DATA.lvIs.tables[ins]?.[single ? "1" : "3"]?.rows || [];
      const tmax = ins === "PVC" ? 70 : 90;
      return Object.entries(t).filter(([, a]) => a != null).map(([s, amp]) => {
        const size = Number(s);
        const isRow = isT.find((r) => r.size === size);
        const anyRow = DATA.lvIs.tables.XLPE["1"].rows.find((r) => r.size === size) || DATA.lvIs.tables.PVC["1"].rows.find((r) => r.size === size);
        const rdc20 = isRow?.rdc20[spec.material] ?? anyRow?.rdc20[spec.material] ?? null;
        const r = isRow?.rac[spec.material] ?? (rdc20 != null ? rdc20 * (1 + ALPHA[spec.material] * (tmax - 20)) : null);
        return { size, amp, r, rdc20, x: reactance(DATA, { ...spec, insulation: ins }, size), isc1s: null };
      }).filter((r) => r.r != null).sort((a, b) => a.size - b.size);
    },

    factors(spec, size, groupCount) {
      const f = [], notes = [];
      const ins = spec.insulation === "PVC" ? "PVC" : "XLPE";
      const tmax = ins === "PVC" ? 70 : 90;
      const env = spec.env;
      const n = Math.max(1, groupCount);
      if (AIR.includes(spec.method)) {
        const r = interp(C.ambient_air[ins], env.airTemp);
        f.push({ key: "kTemp", label: "Ambient air temperature", value: r.outside ? tempFactorFormula(tmax, env.airTemp, 30) : r.value,
          basis: `IEC B.52.14, ${env.airTemp} °C (base 30 °C)` + (r.exact ? "" : ", interpolated") });
        const G = C.grouping["B.52.17_unburied"];
        const rowKey = ["A1", "A2", "B1", "B2"].includes(spec.method) ? "bunched_in_air_on_surface_embedded_or_enclosed (methods A-F)"
          : spec.method === "C" ? "single_layer_on_wall_floor_or_unperforated_tray (method C)"
          : spec.method.startsWith("G") ? null
          : "single_layer_on_perforated_horizontal_or_vertical_tray (methods E, F)";
        let kg = 1, basis = `${n} circuit(s)`;
        if (rowKey && n > 1) {
          const row = G.rows[rowKey];
          let i = G.n_circuits.findIndex((c) => c >= n);
          if (i === -1) { i = G.n_circuits.length - 1; notes.push("More than 20 circuits grouped: used the 20-circuit factor."); }
          while (row[i] == null && i > 0) i--; // single-layer rows: no further reduction beyond 9 circuits
          kg = row[i];
          basis = `${n} circuits, ${rowKey.split(" (")[0].replaceAll("_", " ")} (B.52.17)`;
        } else if (spec.method.startsWith("G")) basis = "spaced one diameter or more: no grouping reduction (B.52.17 note)";
        f.push({ key: "kGroup", label: "Grouping", value: kg, basis });
      } else {
        const r = interp(C.ground_temp[ins], env.groundTemp);
        f.push({ key: "kTemp", label: "Ground temperature", value: r.outside ? tempFactorFormula(tmax, env.groundTemp, 20) : r.value,
          basis: `IEC B.52.15, ${env.groundTemp} °C (base 20 °C)` });
        const rho = env.soilRes / 100; // K·cm/W → K·m/W
        const s = interp(spec.method === "D1" ? C.soil_resistivity.in_ducts : C.soil_resistivity.direct_buried, rho);
        if (s.outside) notes.push("Soil resistivity outside IEC table B.52.16 (0.5–3 K·m/W): extrapolated.");
        f.push({ key: "kSoil", label: "Soil thermal resistivity", value: s.value, basis: `${rho} K·m/W (base 2.5), B.52.16` });
        if (env.depthMm && env.depthMm !== 700) notes.push("IEC ratings are for 0.7 m depth; the standard gives no depth factor (deeper laying lowers the rating slightly).");
        let kg = 1, basis = `${n} circuit(s)`;
        if (n > 1) {
          const sp = spec.group.spacing;
          if (spec.method === "D2") {
            const G = C.grouping["B.52.18_direct_in_ground_D2"];
            const col = sp === "touching" ? 0 : sp === "dia" ? 1 : Number(sp) >= 500 ? 4 : Number(sp) >= 250 ? 3 : Number(sp) >= 125 ? 2 : 0;
            kg = G.rows[String(nextKey(Object.keys(G.rows), n))][col];
            basis = `${n} circuits direct in ground, ${G.clearance[col].replace("_", " ")} (B.52.18)`;
          } else {
            const G = C.grouping["B.52.19_in_ducts_in_ground_D1"];
            const tbl = spec.cores === "1" ? G.single_core_circuits_in_nonmagnetic_single_way_ducts : G.multicore_one_cable_per_duct;
            const col = sp === "touching" ? 0 : Number(sp) >= 1000 ? 3 : Number(sp) >= 500 ? 2 : Number(sp) >= 250 ? 1 : 0;
            kg = tbl[String(nextKey(Object.keys(tbl), n))][col];
            basis = `${n} ducts, ${G.clearance[col]} apart (B.52.19)`;
          }
          if (n > 20) notes.push("More than 20 circuits: factor for 20 used.");
        }
        f.push({ key: "kGroup", label: "Grouping", value: kg, basis });
      }
      return { factors: f, notes };
    },
  };
}
