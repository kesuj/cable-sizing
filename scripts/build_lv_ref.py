"""Overlay verified LV reference values (research/lv_reference.json) onto the workbook data.

* data/lv_reactance.json : catalogue reactances (Polycab XLPE, Gemscab PVC/HR-PVC), ohm/km at 50 Hz
* data/derating_is.json  : adds per-insulation ground-temperature tables and corrects two air factors
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
ref = json.loads((root / "research" / "lv_reference.json").read_text(encoding="utf-8"))
R = ref["reactance"]

def table(rows):
    return {str(r["size_mm2"]): r["x_ohm_per_km"] for r in rows if r.get("x_ohm_per_km") is not None}

x = R["xlpe_1100V_IS7098_1"]; p = R["pvc_hrpvc_1100V_IS1554_1"]
react = {
    "source": "research/lv_reference.json (Polycab 1.1 kV XLPE catalogue; Gemscab IS 1554 PVC catalogue). Single-core values = trefoil.",
    "XLPE": {"single": table(x["single_core_unarmoured"]), "single_armoured": table(x["single_core_armoured"]), "multi": table(x["multicore"])},
    "PVC": {"single": table(p["single_core_unarmoured"]), "single_armoured": table(p["single_core_armoured_wire"]), "multi": table(p["multicore"])},
    "flat_extra_ohm_km": 0.0145,
}
(root / "data" / "lv_reactance.json").write_text(json.dumps(react, indent=1), encoding="utf-8")

d_path = root / "data" / "derating_is.json"
d = json.loads(d_path.read_text(encoding="utf-8"))
G = ref["ground_temperature_factors"]; A = ref["ambient_air_factors"]
d["ground_temp"] = {
    "PVC": d["ground_temp_pvc"]["data"],
    "HRPVC": G["HR_PVC_85C"]["gemscab_Table2"]["values"],
    "XLPE": G["XLPE_90C"]["polycab_p87_direct_and_duct"]["values"],
    "source": "PVC: workbook (= IS 3961-2 Table 7, Gemscab); HR-PVC: Gemscab Table 2; XLPE: Polycab p.87 = Finolex Table 4.2",
}
before = (d["air_temp"]["XLPE"].get("50"), d["air_temp"]["HRPVC"].get("50"))
d["air_temp"]["XLPE"] = {**A["XLPE_90C"]["polycab_p87"]["values"]}
hr = dict(A["HR_PVC_85C"]["gemscab_Table4"]["values"]); hr["55"] = d["air_temp"]["HRPVC"]["55"]
d["air_temp"]["HRPVC"] = hr
d["air_temp"]["corrections"] = [
    f"XLPE 50 C: workbook {before[0]} -> 0.89 (Polycab and Finolex agree); table extended 25-60 C",
    f"HR-PVC 50 C: workbook {before[1]} -> 0.88 (Gemscab); 20-35 C added; 55 C kept from workbook (0.82 = formula 0.816)",
]
d_path.write_text(json.dumps(d, indent=1), encoding="utf-8")
print("reactance sizes:", {k: len(v["multi"]) for k, v in react.items() if isinstance(v, dict)}, "|", d["air_temp"]["corrections"])
