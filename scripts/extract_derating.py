"""Extract IS 3961-style rating factors from the workbook's INSTALLATION and TEMP sheets."""
import json, sys
import openpyxl

def grid(ws, r0, r1, c0, c1):
    return [[ws.cell(r, c).value for c in range(c0, c1 + 1)] for r in range(r0, r1 + 1)]

def table(ws, hdr_row, rows, c0, c1, keys):
    """rows: (first,last); first column = row key; columns c0..c1 mapped to keys."""
    out = {}
    for r in range(rows[0], rows[1] + 1):
        k = ws.cell(r, 1).value
        vals = [ws.cell(r, c).value for c in range(c0, c1 + 1)]
        out[str(k)] = {kk: (None if v in ("-", None) else v) for kk, v in zip(keys, vals)}
    return out

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
I, T = wb["INSTALLATION"], wb["TEMP"]
sp5 = ["touching", "150", "300", "450", "600"]
d = {
 "source": "conductor calculator.xlsx sheets INSTALLATION and TEMP (IS 3961 / IS 1554 catalogue rating-factor tables)",
 "group_1c_trefoil_ground": {"title": I["A2"].value + " " + I["A3"].value,
     "key": "circuits -> spacing(mm)", "data": table(I, 5, (6, 16), 2, 6, sp5)},
 "group_multicore_racks_air": {"title": I["A20"].value + " " + I["A21"].value,
     "key": "racks -> cables per rack", "data": table(I, 23, (24, 27), 2, 6, ["1", "2", "3", "6", "9"])},
 "depth_ground": {"title": I["A30"].value + " " + I["A31"].value, "key": "size band -> depth(mm)",
     "data": dict(zip(["le25", "le300", "gt300"],
        [ {k: I.cell(r, c).value for k, c in zip(["750", "900", "1050", "1200", "1500", "1800"], range(2, 8))} for r in (34, 35, 36)]))},
 "group_multicore_ground_flat": {"title": I["A38"].value + " (horizontal)", "key": "cables -> spacing(mm)",
     "data": table(I, 41, (42, 52), 2, 6, sp5)},
 "group_multicore_ground_trefoil": {"title": I["A38"].value + " (trefoil)", "key": "cables -> spacing(mm)",
     "data": table(I, 41, (42, 52), 7, 11, sp5)},
 "soil_resistivity_direct": {"title": I["A55"].value + " laid direct", "key": "size -> K.cm/W",
     "data": table(I, 59, (60, 78), 2, 5, ["100", "120", "150", "200"])},
 "soil_resistivity_duct": {"title": I["A55"].value + " in single-way duct", "key": "size -> K.cm/W",
     "data": table(I, 59, (60, 78), 6, 9, ["100", "120", "150", "200"])},
 "group_ducts_flat": {"title": I["A80"].value + " (horizontal)", "key": "ducts -> spacing(mm)",
     "data": table(I, 82, (83, 93), 2, 5, ["touching", "300", "450", "600"])},
 "group_ducts_trefoil": {"title": I["A80"].value + " (trefoil)", "key": "ducts -> spacing(mm)",
     "data": table(I, 82, (83, 93), 6, 8, ["touching", "300", "450"])},
 "ground_temp_pvc": {"title": T["A1"].value, "data": {str(T.cell(2, c).value): T.cell(3, c).value for c in range(2, 10)}},
 "air_temp": {"title": T["A5"].value + " + " + T["A10"].value,
     "PVC": {str(T.cell(6, c).value): T.cell(7, c).value for c in range(2, 9)},
     "XLPE": {str(T.cell(6, c).value): T.cell(8, c).value for c in range(2, 9) if T.cell(8, c).value != "-"},
     "HRPVC": {"40": 1, "45": T["D14"].value, "50": T["E14"].value, "55": T["F14"].value}},
}
d["air_temp"]["PVC"]["55"] = T["F13"].value
d["air_temp"]["XLPE"]["55"] = T["F15"].value
json.dump(d, open(sys.argv[2], "w"), indent=1)
print(f"wrote {sys.argv[2]}: {len(d) - 1} rating-factor tables")
