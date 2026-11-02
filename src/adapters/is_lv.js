// IS / Indian-catalogue LV adapter (1.1 kV PVC to IS 1554-1, XLPE to IS 7098-1).
// Ratings and rating factors come from the user's workbook (data/lv_is.json, data/derating_is.json).
// This is the practice used across Nepal (NEA specifications and consultants use IS catalogues).

import { interp, tempFactorFormula } from "../core.js";

export const THETA_MAX = { PVC: 70, HRPVC: 85, XLPE: 90 };
export const BASE = { air: 40, ground: 30, soil: 150, depth: 750 }; // IS 3961 base conditions

/** Group-table lookup that is always on the safe side:
 *  count → next tabulated count at or above; spacing → next tabulated spacing at or below. */
export function groupLookup(table, count, spacing, notes) {
  if (count <= 1) return 1;
  const counts = Object.keys(table).map(Number).sort((a, b) => a - b);
  let c = counts.find((n) => n >= count);
  if (c === undefined) {
    c = counts[counts.length - 1];
    notes.push(`More than ${c} circuits grouped: used the ${c}-circuit factor (real value is lower — space the cables or split the route).`);
  }
  const row = table[String(c)];
  const spacings = Object.keys(row).filter((k) => typeof row[k] === "number");
  const want = spacing === "touching" ? 0 : Number(spacing);
  const ordered = spacings.map((k) => [k, k === "touching" ? 0 : Number(k)]).sort((a, b) => a[1] - b[1]);
  let pick = ordered[0];
  for (const o of ordered) if (o[1] <= want) pick = o;
  if (c !== count) notes.push(`Group of ${count} read as ${c} (next tabulated count, safe side).`);
  // Duct trefoil table has blanks ("-") for some counts: fall back to next count with data.
  if (typeof row[pick[0]] !== "number") {
    const nxt = counts.find((n) => n > c && typeof table[String(n)][pick[0]] === "number");
    return nxt ? table[String(nxt)][pick[0]] : 0.5;
  }
  return row[pick[0]];
}

function bandForDepth(size) {
  return size <= 25 ? "le25" : size <= 300 ? "le300" : "gt300";
}

function soilRow(table, size) {
  const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
  const s = sizes.find((x) => x >= size) ?? sizes[sizes.length - 1];
  return table[String(s)];
}

/** 50 Hz reactance, Ω/km, from manufacturer catalogues (data/lv_reactance.json):
 *  XLPE = Polycab 1.1 kV, PVC/HR-PVC = Gemscab IS 1554. Single-core = trefoil; flat adds ≈0.0145 Ω/km. */
export function reactance(DATA, spec, size) {
  const t = DATA.lvReactance?.[spec.insulation === "XLPE" ? "XLPE" : "PVC"];
  if (t) {
    const key = spec.cores === "1" ? (spec.armoured ? "single_armoured" : "single") : "multi";
    let x = interp(t[key], size).value;
    if (spec.cores === "1" && spec.group?.formation === "flat") x += DATA.lvReactance.flat_extra_ohm_km;
    return x;
  }
  if (spec.cores === "1") return size <= 50 ? 0.11 : size <= 240 ? 0.1 : 0.095;
  return size <= 4 ? 0.1 : size <= 16 ? 0.09 : size <= 50 ? 0.08 : 0.075;
}

export function makeIsLv(DATA) {
  const D = DATA.deratingIs;
  return {
    id: "IS-LV",
    title: "IS 1554-1 / IS 7098-1 catalogue ratings + IS 3961 rating factors (Nepal / India practice)",
    voltageGrade: "1.1 kV grade",
    options: {
      insulations: [["XLPE", "XLPE (90 °C) — modern standard"], ["PVC", "PVC (70 °C)"], ["HRPVC", "HR-PVC (85 °C)"]],
      cores: [["1", "Single core"], ["2", "2 core"], ["3", "3 core"], ["3.5", "3½ core (reduced neutral)"], ["4", "4 core"]],
      methods: [
        ["ground", "Buried directly in the ground", "Laid in a trench at 0.75 m or deeper, covered with sand and bricks."],
        ["duct", "In a pipe or duct under the ground", "HDPE/PVC pipe buried in the ground."],
        ["air", "In open air on a tray, rack or clipped to a wall", "Shaded from direct sun, air can move around the cable."],
      ],
      group: { ground: "circuits in the same trench", duct: "pipes side by side", air: "cables on the same tray" },
    },
    thetaMax: (spec) => THETA_MAX[spec.insulation],

    rows(spec) {
      const ins = spec.insulation === "HRPVC" ? "PVC" : spec.insulation; // HR-PVC uses PVC base ratings
      const t = DATA.lvIs.tables[ins]?.[spec.cores];
      if (!t) throw new Error(`No ${ins} ${spec.cores}-core table in the data.`);
      const m = spec.material;
      return t.rows
        .map((r) => ({
          size: r.size,
          amp: r.amp[spec.method][m],
          r: r.rac[m],
          rdc20: r.rdc20[m],
          x: reactance(DATA, spec, r.size),
          isc1s: r.isc1s[m],
        }))
        .filter((r) => r.amp != null && r.r != null);
    },

    /** Rating factors for one size. Returns [{key,label,value,basis}] */
    factors(spec, size, groupCount) {
      const f = [];
      const notes = [];
      const ins = spec.insulation;
      const tmax = THETA_MAX[ins];
      const env = spec.env;

      if (spec.method === "air") {
        const tbl = D.air_temp[ins];
        let k, basis;
        const known = tbl && interp(tbl, env.airTemp);
        if (known && !known.outside) {
          k = known.value;
          basis = `IS table, ambient ${env.airTemp} °C (base 40 °C)` + (known.exact ? "" : ", interpolated");
        } else {
          k = tempFactorFormula(tmax, env.airTemp, BASE.air);
          basis = `√((${tmax}−${env.airTemp})/(${tmax}−40)) — formula, outside published table`;
        }
        f.push({ key: "kTemp", label: "Ambient air temperature", value: k, basis });
        const racks = Math.max(1, spec.group.racks || 1);
        const per = Math.max(1, groupCount);
        let kg = 1;
        if (racks > 1 || per > 1) {
          const t = D.group_multicore_racks_air.data;
          const rk = Object.keys(t).map(Number).sort((a, b) => a - b).find((n) => n >= racks) ?? 6;
          const row = t[String(rk)];
          const pk = Object.keys(row).map(Number).sort((a, b) => a - b).find((n) => n >= per) ?? 9;
          kg = row[String(pk)];
          if (per > 9 || racks > 6) notes.push("Grouping beyond the IS rack table — factor used is optimistic.");
        }
        f.push({ key: "kGroup", label: "Grouping (cables touching on racks/trays)",
          value: kg, basis: `${racks} rack(s) × ${per} cable(s) per rack` });
      } else {
        // Ground temperature: IS table is for PVC 70 °C; other insulations use the same formula basis.
        let k, basis;
        const gt = D.ground_temp?.[ins] || (ins === "PVC" ? D.ground_temp_pvc.data : null);
        const r = gt && interp(gt, env.groundTemp);
        if (r && !r.outside) {
          k = r.value; basis = `${ins === "HRPVC" ? "HR-PVC" : ins} table, ground ${env.groundTemp} °C (base 30 °C)` + (r.exact ? "" : ", interpolated");
        } else {
          k = tempFactorFormula(tmax, env.groundTemp, BASE.ground);
          basis = `√((${tmax}−${env.groundTemp})/(${tmax}−30)) — formula, outside published table`;
        }
        f.push({ key: "kTemp", label: "Ground temperature", value: k, basis });

        const soilTbl = spec.method === "duct" ? D.soil_resistivity_duct.data : D.soil_resistivity_direct.data;
        const sr = interp(soilRow(soilTbl, size), env.soilRes);
        if (sr.outside) notes.push(`Soil resistivity ${env.soilRes} K·cm/W is outside the IS table (100–200): value extrapolated — get a soil test.`);
        f.push({ key: "kSoil", label: "Soil thermal resistivity", value: sr.value,
          basis: `${env.soilRes} K·cm/W (base 150), ${spec.method === "duct" ? "in duct" : "laid direct"}` });

        const dr = env.depthMm <= 750 ? { value: 1 } : interp(D.depth_ground.data[bandForDepth(size)], env.depthMm);
        f.push({ key: "kDepth", label: "Depth of laying", value: dr.value, basis: `${env.depthMm} mm (base 750 mm)` });

        let tbl, desc;
        if (spec.method === "duct") {
          tbl = spec.group.formation === "trefoil" ? D.group_ducts_trefoil.data : D.group_ducts_flat.data;
          desc = `ducts, ${spec.group.formation}`;
        } else if (spec.cores === "1") {
          tbl = D.group_1c_trefoil_ground.data;
          desc = "single-core circuits in trefoil";
        } else {
          tbl = spec.group.formation === "trefoil" ? D.group_multicore_ground_trefoil.data : D.group_multicore_ground_flat.data;
          desc = `multicore, ${spec.group.formation}`;
        }
        const kg = groupLookup(tbl, groupCount, spec.group.spacing, notes);
        f.push({ key: "kGroup", label: "Grouping", value: kg,
          basis: `${groupCount} circuit(s), ${desc}, spacing ${spec.group.spacing === "touching" ? "touching" : spec.group.spacing + " mm"}` });
      }
      return { factors: f, notes };
    },
  };
}
