// IS 7098-2 XLPE HV adapter (3.3–33 kV). Ratings: Polycab HT catalogue (primary) or KEI handbook
// (cross-check). Rating factors: Polycab MV tables — NOT the LV IS 3961 tables (MV base depth is
// 0.9/1.05 m and the soil/ground factors differ; see research/hv_xlpe_raw.json).
import { interp, tempFactorFormula } from "../core.js";
import { groupLookup } from "./is_lv.js";

const KV = { "3.3": 3.3, "6.6": 6.6, "11": 11, "11UE": 11, "22": 22, "33": 33 };

export function makeIsHv(DATA) {
  const H = DATA.hvIs;
  const D = H.derating;
  const gradeOf = (spec) => H.grades[spec.grade] || H.grades["11"];
  return {
    id: "IS-HV",
    title: "IS 7098-2 XLPE catalogue ratings (Polycab / KEI) + manufacturer MV rating factors",
    voltageGrade: (spec) => `${gradeOf(spec).label} grade, IS 7098-2`,
    isAir: (m) => m === "air",
    options: {
      voltages: [["3.3", "3.3 kV"], ["6.6", "6.6 kV"], ["11", "11 kV (NEA distribution)"], ["22", "22 kV"], ["33", "33 kV (NEA sub-transmission)"]],
      insulations: [["XLPE", "XLPE (90 °C)"]],
      cores: [["3", "3 core (one cable per circuit)"], ["1", "Single core, laid in trefoil (3 cables per circuit)"]],
      noArmour: true,
      methods: [
        ["ground", "Buried directly in the ground", "Trench 0.9 m (11 kV) or 1.05 m (22–33 kV) deep, sand bed, protective cover."],
        ["duct", "In a pipe or duct under the ground", "Road crossings and built-up areas."],
        ["air", "In open air on trays, ladders or cleats", "Substations, cable trenches with air, bridges."],
      ],
      group: { ground: "circuits in the same trench", duct: "ducts side by side", air: "cables on each tray" },
      spacings: { ground: [["touching", "Touching"], ["150", "150 mm"], ["300", "300 mm"], ["450", "450 mm"]] },
      depthDefault: (kv) => (Number(kv) >= 22 ? 1050 : 900),
      extraRoute: (S, { sel, row }) => row(
        sel("hvSource", "Catalogue for ratings", [["polycab", "Polycab HT XLPE (full data)"], ["kei", "KEI handbook (cross-check)"]]),
        S.hvKv === 11 || S.hvKv === "11" ? sel("hvEarth", "11 kV system earthing", [["E", "Earthed (E grade 6.35/11 kV)"], ["UE", "Unearthed / high-resistance (UE grade 11/11 kV)"]]) : ""),
    },
    thetaMax: () => 90,

    rows(spec) {
      const g = gradeOf(spec);
      const t = g.cores[spec.cores] || g.cores["3"];
      const src = (spec.hvSource === "kei" && t.kei) ? t.kei : (t.polycab || t.kei);
      const m = spec.material;
      return src.map((r) => ({
        size: r.size, amp: r[m].amp[spec.method], r: r[m].rac, rdc20: r[m].rdc20, x: r.x ?? 0.1, isc1s: r[m].isc1s,
      })).filter((r) => r.amp != null && r.r != null);
    },

    factors(spec, size, groupCount) {
      const f = [], notes = [];
      const env = spec.env;
      const kv = KV[spec.grade] || 11;
      if (spec.method === "air") {
        const r = interp(D.air_temp, env.airTemp);
        f.push({ key: "kTemp", label: "Ambient air temperature", value: r.outside ? tempFactorFormula(90, env.airTemp, 40) : r.value,
          basis: `${env.airTemp} °C (base 40 °C), MV XLPE table${r.outside ? " — outside table, formula used" : ""}` });
        const tbl = spec.cores === "1" ? D.group_1c_air : D.group_3c_air_touching;
        const racks = Math.max(1, spec.group.racks || 1);
        const rk = Object.keys(tbl).map(Number).sort((a, b) => a - b).find((n) => n >= racks) ?? 6;
        const row = tbl[String(rk)];
        const pk = Object.keys(row).map(Number).sort((a, b) => a - b).find((n) => n >= groupCount);
        if (pk === undefined) notes.push("More cables per tray than the table covers: factor is optimistic.");
        f.push({ key: "kGroup", label: "Grouping on trays", value: groupCount <= 1 && racks <= 1 ? 1 : row[String(pk ?? Math.max(...Object.keys(row).map(Number)))],
          basis: `${racks} tray(s) × ${groupCount} ${spec.cores === "1" ? "trefoil group(s)" : "cable(s), touching"}` });
      } else {
        const r = interp(D.ground_temp, env.groundTemp);
        f.push({ key: "kTemp", label: "Ground temperature", value: r.outside ? tempFactorFormula(90, env.groundTemp, 30) : r.value,
          basis: `${env.groundTemp} °C (base 30 °C), MV XLPE table` });
        const s = interp(D.soil, env.soilRes);
        if (s.outside) notes.push("Soil resistivity outside the 100–300 K·cm/W table: extrapolated.");
        f.push({ key: "kSoil", label: "Soil thermal resistivity", value: s.value, basis: `${env.soilRes} K·cm/W (base 150)` });
        const base = kv >= 22 ? 1050 : 900;
        const dt = kv >= 22 ? D.depth.ge22 : D.depth.le11;
        const d = env.depthMm <= base ? { value: 1 } : interp(dt, env.depthMm);
        if (env.depthMm < base) notes.push(`Laid shallower than the ${base} mm reference: rating not increased (keep the standard depth for mechanical protection).`);
        f.push({ key: "kDepth", label: "Depth of laying", value: d.value, basis: `${env.depthMm} mm (base ${base} mm)` });
        let tbl, desc;
        if (spec.method === "duct") {
          tbl = spec.group.formation === "trefoil" ? DATA.deratingIs.group_ducts_trefoil.data : DATA.deratingIs.group_ducts_flat.data;
          desc = "ducts (IS 3961 duct table — MV catalogues give none)";
        } else if (spec.cores === "1") {
          tbl = kv >= 33 ? D.group_1c_ground_33 : D.group_1c_ground_le22; desc = "trefoil groups, flat row";
        } else { tbl = D.group_3c_ground; desc = "3-core cables, flat row"; }
        f.push({ key: "kGroup", label: "Grouping", value: groupLookup(tbl, groupCount, spec.group.spacing, notes),
          basis: `${groupCount} circuit(s), ${desc}, ${spec.group.spacing === "touching" ? "touching" : spec.group.spacing + " mm apart"}` });
      }
      return { factors: f, notes };
    },
  };
}
