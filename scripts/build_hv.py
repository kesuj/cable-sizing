"""Build data/hv_is.json from research/hv_xlpe_raw.json (IS 7098-2 XLPE, Polycab primary + KEI cross-check)."""
import json, math, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
raw = json.loads((root / "research" / "hv_xlpe_raw.json").read_text(encoding="utf-8"))

GRADES = {  # key: (label, polycab grade prefix, kei grade prefix, depth mm)
    "3.3": ("1.9/3.3 kV (E) / 3.3/3.3 kV (UE)", "1.9/3.3", "3.3/3.3", 900),
    "6.6": ("6.6/6.6 kV (UE) - same construction as 6.35/11 kV (E)", "6.35/11", "6.35/11", 900),
    "11": ("6.35/11 kV (E)", "6.35/11", "6.35/11", 900),
    "11UE": ("11/11 kV (UE)", "11/11", "11/11", 900),
    "22": ("12.7/22 kV (E)", "12.7/22", None, 1050),
    "33": ("19/33 kV (E)", "19/33", "19/33", 1050),
}

def norm(r, fill=None):
    out = {"size": r["size"]}
    for m in ("al", "cu"):
        g = lambda k: r.get(k) if r.get(k) is not None else (fill or {}).get(k)
        out[m] = {"rdc20": g(f"r_dc20_{m}"), "rac": g(f"r_ac90_{m}"), "isc1s": g(f"isc1s_{m}_ka"),
                  "amp": {"ground": r.get(f"amp_ground_{m}"), "duct": r.get(f"amp_duct_{m}"), "air": r.get(f"amp_air_{m}")},
                  "ampFlat": {k: r.get(f"amp_{k}_{m}_flat") for k in ("ground", "duct", "air")} if f"amp_ground_{m}_flat" in r else None}
    out["x"] = r.get("x_ohm_km") if r.get("x_ohm_km") is not None else (fill or {}).get("x_ohm_km")
    out["cap"] = r.get("cap_uf_km")
    return out

def find(src, prefix, cores):
    for t in raw["tables"]:
        if t["source"] == src and t["cores"] == cores and t["voltage_grade"].startswith(prefix):
            return t
    return None

grades, checks = {}, []
for key, (label, pp, kp, depth) in GRADES.items():
    g = {"label": label, "depthMm": depth, "cores": {}}
    for cores in (3, 1):
        pt = find("polycab_ht_xlpe", pp, cores)
        kt = find("kei_tech_handbook", kp, cores) if kp else None
        if key == "11UE" and kt is not None and cores == 1:
            kt = None
        if not pt and not kt:
            continue
        pfill = {r["size"]: r for r in (pt["rows"] if pt else [])}
        # Fill R / SC for KEI from any Polycab table (per-size conductor data is shared by all grades).
        anyp = {}
        for t in raw["tables"]:
            if t["source"] == "polycab_ht_xlpe":
                for r in t["rows"]:
                    anyp.setdefault(r["size"], r)
        g["cores"][str(cores)] = {
            "polycab": [norm(r, anyp.get(r["size"])) for r in pt["rows"]] if pt else None,
            "kei": [norm(r, pfill.get(r["size"]) or anyp.get(r["size"])) for r in kt["rows"]] if kt else None,
        }
        for r in (pt["rows"] if pt else []):
            for m, k in (("cu", 143), ("al", 94)):
                v = r.get(f"isc1s_{m}_ka")
                if v and abs(v - k * r["size"] / 1000) / v > 0.03:
                    checks.append(f"{key} {cores}C {r['size']} {m}: 1 s rating {v} kA vs k*S {k*r['size']/1000:.1f}")
    grades[key] = g

P = raw["derating"]["polycab_ht_xlpe"]
out = {
    "sources": raw["sources"], "notes": raw["notes"],
    "standard_conditions": {"ground_temp_c": 30, "air_temp_c": 40, "soil_resistivity_kcmw": 150, "depth_mm": "900 (<=11 kV) / 1050 (22-33 kV)", "conductor_c": 90},
    "grades": grades,
    "derating": {
        "air_temp": P["air_temp"], "ground_temp": P["ground_temp"], "soil": P["soil_resistivity_Ccm_per_W"],
        "depth": {"le11": {str(int(k) * 10): v for k, v in P["depth_cm"]["3.3-11kV"].items() if k.isdigit()} | {"1800": P["depth_cm"]["3.3-11kV"]["180+"]},
                  "ge22": {str(int(k) * 10): v for k, v in P["depth_cm"]["22-33kV"].items() if k.isdigit() and v is not None} | {"1800": P["depth_cm"]["22-33kV"]["180+"]}},
        "group_3c_ground": {n: {("touching" if s == "touching" else str(int(s) * 10)): v for s, v in row.items()} for n, row in P["group_3c_ground_horizontal"]["data"].items()},
        "group_1c_ground_le22": {n: {("touching" if s == "touching" else str(int(s[:-2]) * 10)): v for s, v in row.items()} for n, row in P["group_1c_trefoils_ground_horizontal"]["3.3-22kV"].items()},
        "group_1c_ground_33": {n: {("touching" if s == "touching" else str(int(s[:-2]) * 10)): v for s, v in row.items()} for n, row in P["group_1c_trefoils_ground_horizontal"]["33kV"].items()},
        "group_3c_air_touching": P["group_3c_trays_air_touching"]["data"],
        "group_1c_air": P["group_1c_trefoils_trays_open_air"]["data"],
    },
    "k_values": raw["k_values"], "voltage_drop_limits": raw["voltage_drop_limits"], "self_checks": checks,
}
(root / "data" / "hv_is.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
print("grades:", {k: list(v["cores"]) for k, v in grades.items()}, "| SC check deviations:", checks or "none")
