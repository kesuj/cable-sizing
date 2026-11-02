# LV (≤1.1 kV) reference data: notes

Data file: `lv_reference.json`. Source IDs (S1–S19) are listed in its `sources` array. Accessed 2026-11-02.

## How much to trust each part

| Area | Status |
|---|---|
| XLPE reactance (S1 Polycab 2025) | Manufacturer catalogue. Single-core vs multicore, armoured vs unarmoured. The formation is not stated, so treat the single-core values as trefoil. |
| PVC/HR-PVC reactance (S2 Gemscab) | Manufacturer catalogue. Polycab, KEI, Havells and Finolex PVC tables could not be retrieved. |
| Flat-formation reactance | **null**. No LV catalogue tabulates it. The formula is given (flat formation uses S × 1.26, which adds about 0.0145 Ω/km over trefoil at the same spacing). |
| IS rating base and PVC factors | Primary: IS 3961-2:**1967** OCR text (S3), cross-checked with Gemscab and Torrent. The 2017 revision was not accessible. |
| XLPE factors | Polycab (S1) and Finolex (S5) agree exactly. |
| SP 30:2011 (NEC India) voltage drop and 1.45 Iz | Primary 2011 text. NEC 2023 and IS 732:2019 were **not accessible**, so they are null. |
| Nepal | Primary: Electricity Rules 2050, Rules 40–44 (S8). |
| IEC 60364 tables (41.1, 54.2, 1.45 Iz, k >300 mm², MCB and fuse series) | Marked `not_verified`. The IEC text is paywalled and the free previews contain only the contents pages. The values are from the standard as I remember it, partly backed by secondary sources. Check them before release. |

## Your quoted numbers versus the sources

- **Base conditions** are confirmed: ground 30 °C, air 40 °C, soil 150 °C·cm/W (1.5 K·m/W), depth 750 mm. PVC conductor temperature is 70 °C, HR-PVC 85 °C, XLPE 90 °C. Do **not** mix in the KEI 2020 catalogue factors (S16), which use UK conditions: ground 15 °C, air 30 °C, 1.2 K·m/W, 0.5 m.
- **PVC ambient air** factors are confirmed: 20→1.32, 25→1.25, 30→1.16, 35→1.09, 40→1.00, 45→0.90, 50→0.81. Torrent alone prints 0.91 at 45 °C; IS 3961-2 and Gemscab both give 0.90.
- **XLPE ambient air at 50 °C:** you have **0.90**, but Polycab and Finolex both give **0.89**. Your 45→0.95 and 55→0.84 agree. The full set is 25→1.14, 30→1.10, 35→1.05, 40→1.00, 45→0.95, 50→0.89, 55→0.84, 60→0.77.
- **HR-PVC ambient air:** 45→0.94 agrees. At 50 °C you have **0.87**, but Gemscab gives **0.88**. No source tabulates 55 °C; the thermal formula gives 0.816, which is consistent with your 0.82 but is not a transcribed value.
- **Ground temperature:** your series is confirmed as **PVC 70 °C**.
  - **XLPE 90 °C:** 15→1.12, 20→1.08, 25→1.04, 30→1.00, 35→0.96, 40→0.91, 45→0.87, 50→0.82 (S1, S5).
  - **HR-PVC 85 °C:** 1.12, 1.08, 1.04, 1.00, 0.95, 0.90, 0.84, 0.77 (S2).
- **Table numbers:** your "Table 9" and "Table 20" do not match the 1967 edition, which uses Table 17 for air and Table 7 for ground. They may come from the 2017 revision, which I could not check.
- **Grouping in air (IS 3961-2):**
  - **Clause 6.1:** no derating if circuits have at least 75 mm clearance (≤70 mm²) or at least 150 mm (>70 mm²), laid in one horizontal plane.
  - **Racks (Amd 1, Tables 19/20, which match Gemscab):**
    - Touching, 1 rack, 1/2/3/6/9 cables: 1.00 / 0.84 / 0.80 / 0.75 / 0.73.
    - Spaced 1D, same counts: 1.00 / 0.98 / 0.96 / 0.93 / 0.92.
  - **XLPE on perforated trays:** values are from Finolex Table 4.17. Its LV ladder table looks like a copy error.

## Other findings worth knowing

- **Voltage drop in India (SP 30:2011)** is inconsistent across clauses:
  - 4 % from origin to equipment (clause 4.8).
  - 5 % "deemed to satisfy" (clause 4.2.10.1).
  - 3 % for lighting circuits (clauses 5.3 and 6.0.2), split as 1 V + 4.5 V + 1.5 V; a house pump motor may reach 7.5 %.
  - A sensible tool default is **3 % lighting / 5 % power from the origin**, which also matches IEC Annex G for a public supply (S13). For a private transformer, Annex G allows 6 % / 8 %.
- **Motor starting dip:** there is no numeric limit in any accessible code, so this is null. Starting is excluded from the steady-state limits and deferred to the equipment standard or manufacturer.
- **Nepal (Electricity Rules 2050):**
  - **Supply voltage (Rule 40):** 230 V single-phase, 400 V three-phase, with **±5 %** maximum fluctuation (218.5–241.5 V and 380–420 V).
  - **HV distribution (Rule 41):** 3.3 to 33 kV, also ±5 %.
  - **Frequency (Rule 43):** 50 Hz ±2.5 %.
  - **Power factor (Rule 44):** at least 0.8 lagging.
  - I found no NEA distribution bylaw text and no Nepal electrical code.
- **Protection rules in old IS 3961-2:1967 (clause 7):** the device's operating current must not exceed 1.5× the rating in air or ducts and 1.3× in ground; otherwise multiply the rating by 0.67 or 0.77. This is older than, and differs from, the IEC/SP 30 rule I2 ≤ 1.45 Iz. Use IEC/SP 30 (IB ≤ In ≤ Iz, I2 ≤ 1.45 Iz). For a rewirable fuse, divide In by 0.725.
- **Conventional tripping currents** (S11): 1.13 / 1.45 In for MCBs (IEC 60898-1); 1.05 / 1.30 In for MCCBs (IEC 60947-2).
- **k-values:** three Indian sources agree on PVC 115/76 (Cu/Al) and XLPE 143/94. HR-PVC is 104/69 (Torrent). For separate PE, IS 3043:1987 starts from 40 °C, so its k is lower than IEC's (Cu/PVC 136 versus IEC 143).
- **PE size (IS 3043 Table 7):** S for S ≤ 16 mm²; 16 mm² for 16 < S ≤ 35 mm². The S > 35 mm² cell is illegible in the OCR. IEC gives S/2 there, but that is unverified. A separately run PE must be at least 2.5 mm² if mechanically protected, 4 mm² if not.
- **Motor efficiency:** IE2 and IE3 minimums for 4-pole, 50 Hz motors from 0.75 to 110 kW are transcribed (S9). Use 0.746 kW per hp (NIST: 745.7 W mechanical; metric hp is 735.5 W). The only sourced default power factor is 0.8 generic (S12); there is no per-rating power factor table, so use the nameplate.
