"""Build data/overhead.json from research/overhead_conductors.json (IS 398-2 ACSR, BS 215 Bear, IS 398-4 AAAC)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "research" / "overhead_conductors.json").read_text(encoding="utf-8"))
KEEP_IS = ["Squirrel", "Weasel", "Rabbit", "Raccoon", "Dog", "Leopard", "Coyote", "Wolf", "Lynx", "Panther", "Goat", "Kundah", "Zebra", "Deer", "Moose"]
acsr = []
for c in d["acsr"]:
    if c["name"] in KEEP_IS or c["name"] == "Bear":
        acsr.append({k: c.get(k) for k in ("name", "standard", "al_strands", "al_dia_mm", "st_strands", "st_dia_mm", "al_area_mm2", "total_area_mm2", "dia_mm", "r20_ohm_km", "mass_kg_km", "uts_kn")})
acsr.sort(key=lambda c: c["al_area_mm2"])
aaac = []
for c in d["aaac"]:
    if c.get("dia_mm") and c.get("r20_ohm_km"):
        aaac.append({"name": f"AAAC {c['nominal_mm2']} mm²", "standard": "IS 398 (Part 4)", "al_strands": c["strands"], "st_strands": None,
                     "al_area_mm2": c["area_mm2"], "dia_mm": c["dia_mm"], "r20_ohm_km": c["r20_ohm_km"], "mass_kg_km": c.get("mass_kg_km"),
                     "uts_kn": c.get("uts_kn"), "equivalent_acsr": c.get("equivalent_acsr")})
aaac.sort(key=lambda c: c["al_area_mm2"])
out = {
    "source": "research/overhead_conductors.json (Satcon/Lumino/Apar IS 398-2 and IS 398-4 tables; Sierra BS 215 for Bear). Engine validated against 156 CEA/Satcon published ratings within 0.6 %.",
    "acsr": acsr, "aaac": aaac,
    # GMR / r: ACSR 26/7 0.806, 30/7 0.818, 54/7 0.805 (Prysmian, via research); 6/1 0.30–0.43 → 0.35 used;
    # homogeneous all-aluminium 7 / 19 / 37 / 61 strands: 0.726 / 0.758 / 0.768 / 0.772 (standard values).
    "gmr_ratio": {"acsr_6": 0.35, "acsr_26": 0.806, "acsr_30": 0.818, "acsr_54": 0.805, "aaac_7": 0.726, "aaac_19": 0.758, "aaac_37": 0.768, "aaac_61": 0.772},
    "nepal_practice": d.get("nepal_practice"),
}
(root / "data" / "overhead.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print("overhead.json:", len(acsr), "ACSR,", len(aaac), "AAAC:", ", ".join(c["name"] for c in acsr))
