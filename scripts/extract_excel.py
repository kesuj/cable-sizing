"""Extract the LV cable data from the original workbook into clean JSON.

Usage:  python scripts/extract_excel.py source/conductor_calculator_original.xlsx data/lv_is.json

Everything in data/lv_is.json comes from the workbook except the corrections listed in
ERRATA below. Each correction is a transcription typo in the source catalogue, found by
the automatic checks at the bottom of this script (monotonic ratings, Cu > Al, resistance
consistency with IS 8130 / IEC 60228). See docs/DATA_ERRATA.md.
"""
from __future__ import annotations

import json
import sys

import openpyxl

# (insulation, cores, size, field, wrong_value, corrected_value, reason)
ERRATA = [
    ("XLPE", "3", 25, "amp.duct.al", 65, 85,
     "65 A breaks the rising sequence (51, 66, 65, 102); identical 3.5C and 4C tables give 85 A."),
    ("XLPE", "2", 630, "rac.al", 0.606, 0.0606, "Decimal slip: 0.606 > 500 mm2 value 0.0782."),
    ("XLPE", "3.5", 25, "rac.al", 1.538, 1.53, "3C and 4C tables give 1.53."),
    ("XLPE", "3", 630, "amp.ground.cu", 944, None,
     "944 A is impossible (Al = 529 A, 500 mm2 Cu = 582 A). Unknown true value -> size withdrawn for this case."),
    ("XLPE", "3.5", 630, "amp.ground.cu", 944, None, "Same typo as 3C table."),
    ("XLPE", "4", 630, "amp.ground.cu", 944, None, "Same typo as 3C table."),
    ("PVC", "1", 500, "rdc20.al", 0.0065, 0.0605, "IS 8130 value for 500 mm2 Al is 0.0605."),
    ("PVC", "1", 630, "rdc20.cu", 0.0233, 0.0283, "IS 8130 value for 630 mm2 Cu is 0.0283."),
    ("PVC", "2", 95, "isc1s.cu", 10.09, 10.9, "1C and 4C tables give 10.9 kA (= 0.115 x 95)."),
    ("PVC", "3", 95, "isc1s.cu", 10.09, 10.9, "1C and 4C tables give 10.9 kA (= 0.115 x 95)."),
    ("PVC", "3.5", 95, "isc1s.cu", 10.09, 10.9, "1C and 4C tables give 10.9 kA (= 0.115 x 95)."),
    ("PVC", "4", 500, "amp.air.al", 540, 405,
     "540 A Al exceeds the 500 A Cu value; every other 4C row equals the 3C table, which gives 405 A."),
    ("PVC", "4", 500, "amp.ground.cu", 440, 440, "kept"),
]

# Row layout per sheet/table: index of the first data column for each block.
# 1-core tables:  DC(Al,Cu)=15,16  AC(Al,Cu)=17,18  cap=19,20  amps G/D/A (Al,Cu)=21..26  SC=27,28
# XLPE multi-core: DC=14,15 AC=16,17 cap=18 amps=19..24 SC=25,26
# PVC multi-core:  DC=14,15 AC=16,17 cap=18,19 amps=20..25 SC=26,27
LAYOUT = {
    ("XLPE", "1"): dict(dc=15, ac=17, amp=21, sc=27, od=9),
    ("PVC", "1"): dict(dc=15, ac=17, amp=21, sc=27, od=9),
    ("XLPE", "multi"): dict(dc=14, ac=16, amp=19, sc=25, od=8),
    ("PVC", "multi"): dict(dc=14, ac=16, amp=20, sc=26, od=8),
}
CORE_FROM_TITLE = {"SINGLE CORE": "1", "2 CORE": "2", "3 CORE": "3", "3.5 CORE": "3.5", "4 CORE": "4"}


def num(v):
    if v is None or v == "-" or v == "NA":
        return None
    return float(v) if not float(v).is_integer() else int(v)


def cores_of(title: str) -> str:
    for key in ("3.5 CORE", "SINGLE CORE", "2 CORE", "4 CORE", "3 CORE"):
        if key in title:
            return CORE_FROM_TITLE[key]
    raise ValueError(title)


def extract(path: str) -> dict:
    wb = openpyxl.load_workbook(path, data_only=True)
    out: dict = {}
    for ins in ("XLPE", "PVC"):
        ws = wb[ins]
        out[ins] = {}
        cur = None
        for row in ws.iter_rows(values_only=True):
            first = row[0]
            if isinstance(first, str) and "TABLE" in first:
                cur = cores_of(first)
                out[ins][cur] = {"title": first.strip(), "rows": []}
                continue
            if cur is None or not isinstance(first, (int, float)):
                continue
            lay = LAYOUT[(ins, "1" if cur == "1" else "multi")]
            d, a, m, s = lay["dc"], lay["ac"], lay["amp"], lay["sc"]
            out[ins][cur]["rows"].append({
                "size": num(first),
                "rdc20": {"al": num(row[d]), "cu": num(row[d + 1])},
                "rac": {"al": num(row[a]), "cu": num(row[a + 1])},
                "amp": {
                    "ground": {"al": num(row[m]), "cu": num(row[m + 1])},
                    "duct": {"al": num(row[m + 2]), "cu": num(row[m + 3])},
                    "air": {"al": num(row[m + 4]), "cu": num(row[m + 5])},
                },
                "isc1s": {"al": num(row[s]), "cu": num(row[s + 1])},
                "od": {"arm": num(row[lay["od"]]), "unarm": num(row[lay["od"] + 1])},  # approx. overall diameter, mm
            })
    return out


def get_set(obj, dotted, value=None, write=False):
    keys = dotted.split(".")
    for k in keys[:-1]:
        obj = obj[k]
    if write:
        obj[keys[-1]] = value
    return obj[keys[-1]]


def apply_errata(data: dict) -> list:
    applied = []
    for ins, cores, size, field, wrong, right, reason in ERRATA:
        if wrong == right:
            continue
        row = next(r for r in data[ins][cores]["rows"] if r["size"] == size)
        found = get_set(row, field)
        if found != wrong:
            raise SystemExit(f"Errata mismatch {ins} {cores}C {size} {field}: found {found}, expected {wrong}")
        get_set(row, field, right, write=True)
        applied.append(dict(insulation=ins, cores=cores, size=size, field=field,
                            source_value=wrong, used_value=right, reason=reason))
    return applied


def check(data: dict) -> list:
    """Sanity checks that caught the errata. Returns remaining warnings."""
    warn = []
    for ins, tables in data.items():
        for cores, t in tables.items():
            rows = t["rows"]
            for mat in ("al", "cu"):
                for meth in ("ground", "duct", "air"):
                    prev = 0
                    for r in rows:
                        v = r["amp"][meth][mat]
                        if v is None:
                            continue
                        if v < prev:
                            warn.append(f"{ins} {cores}C {meth} {mat}: {r['size']} mm2 {v} A < previous {prev} A")
                        prev = v
                for key in ("rdc20", "rac"):
                    prev = 1e9
                    for r in rows:
                        v = r[key][mat]
                        if v is None:
                            continue
                        if v > prev:
                            warn.append(f"{ins} {cores}C {key} {mat}: {r['size']} mm2 {v} > previous {prev}")
                        prev = v
            for r in rows:
                for meth in ("ground", "duct", "air"):
                    al, cu = r["amp"][meth]["al"], r["amp"][meth]["cu"]
                    if al and cu and al > cu:
                        warn.append(f"{ins} {cores}C {r['size']} {meth}: Al {al} > Cu {cu}")
    return warn


def main(src: str, dst: str) -> None:
    data = extract(src)
    applied = apply_errata(data)
    warnings = check(data)
    payload = {
        "source": "conductor calculator.xlsx (manufacturer catalogue tables to IS 1554-1 PVC and IS 7098-1 XLPE, 1.1 kV)",
        "units": {"rdc20": "ohm/km at 20 C", "rac": "ohm/km AC at max conductor temp (PVC 70 C, XLPE 90 C)",
                  "amp": "A, continuous, standard conditions", "isc1s": "kA for 1 s"},
        "standard_conditions": {"ground_temp_c": 30, "air_temp_c": 40, "soil_resistivity_kmw": 1.5,
                                "depth_mm": 750, "note": "IS 3961 / IS 1554 / IS 7098-1 base conditions"},
        "errata_applied": applied,
        "remaining_warnings": warnings,
        "tables": data,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print(f"wrote {dst}: {sum(len(t['rows']) for x in data.values() for t in x.values())} rows, "
          f"{len(applied)} corrections, {len(warnings)} remaining warnings")
    for w in warnings:
        print("  WARN", w)


if __name__ == "__main__":
    main(*sys.argv[1:3])
