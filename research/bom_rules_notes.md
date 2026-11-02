# BOM rules: notes

The data is in `bom_rules.json`. Sources B1–B26 are listed in its `sources` array, all accessed 2026-11-03. Each rule has a `verified` flag, which takes one of these values:

| Flag | Meaning |
|---|---|
| `true` | Read in the cited source. |
| `partial` | The core fact is sourced; part of the rule is practice or inference. |
| `derived` | Calculated from sourced inputs. |
| `false` | Not verified. In the UI, label it "typical, confirm". |

## Main sources (primary text read)

- **CPWD General Specifications Part I (2013)** (B1). Gives the steel-conduit fill table, earth-electrode sizes, the 5 Ω limit, RCD sensitivities, MCB curve uses, switch duty categories AC-20 to AC-23, and DB and circuit-loading rules.
- **SP 30:2011 (NEC India)** (B4). Gives the PVC conduit fill table (1.1 kV cables), the SPD Uc table, the motor capacitor kVAR table, and the breaking-capacity rule.
- **IS 3043:1987** (B2). Plate and pipe electrodes; no fixed resistance target.
- **IS 732:1989** (B3). 40 % space factor.
- **IS 1255:1983** (B19). Duct diameter at least 1.5 × cable OD.
- **BIS summary of IS 1180** (B6). Distribution-transformer impedance: 4.5 % up to 630 kVA, 5 % for 800–1250 kVA, 6.25 % for 1600–2500 kVA.
- **Nepal Electricity Rules 2050** (B5), Rules 56–60.
- **Manufacturer documents:**
  - Havells, MCB curves (B7).
  - ABB Tmax XT, MCCB Icu/Ics (B8).
  - Mersen, gG/aM fuses (B9).
  - ABB CEF-S, HV fuse vs kVA table (B10).
  - ABB, RCD Type F/B guidance (B11).
  - DEHN, Type 2 SPD (B12).
  - Siemens Raja+ DOL and FASD star-delta tables (B14, B15).
  - Schneider, star-delta table (B16).
  - CMP, gland OD ranges (B17).
  - Cembre, lug stud holes (B18).
- **MSEDCL utility specs:** 11 kV surge arrester (9 kV, 8 kV MCOV, 5 kA) (B20) and RMU (12 kV, 630 A, 20 kA for 3 s; 200 A CB up to 630 kVA; IDMT relay ranges) (B21).

## Verified

- **MCB curves** (B1, B7):
  - B: 3–5 In, for lighting and sockets.
  - C: 5–10 In, for inductive loads and motors.
  - D: 10–20 In, for transformers and heavy-start motors.
- **Conventional tripping currents:** 1.13/1.45 In for MCBs; 1.05/1.30 In for MCCBs.
- **Breaking capacity:** the device's breaking capacity must be at least the prospective fault current where it is installed (SP 30).
- **Conduit fill:** SP 30 Table 4 for PVC conduit, CPWD Table I for steel conduit (straight runs and runs with bends), and the 40 % space factor.
- **Buried duct:** at least 1.5 × cable OD; bend radius at least 1.5 m; all three single-core cables of a circuit in one duct.
- **Earthing:**
  - CPWD Table IX: GI pipe 40 mm × 4.5 m; plate 600×600 mm, 6 mm GI or 3 mm Cu; strip and conductor sizes.
  - IS 3043: GI plate at least 6.3 mm and Cu plate at least 3.15 mm thick. Amendment 1 allows a 40 mm GI pipe or MS rod.
  - Resistance: at most 5 Ω per electrode, or 8 Ω in rock (CPWD). For lightning earthing, at most 10 Ω.
- **Earth conductor and PE sizing** (CPWD 8.2.2–8.2.3).
- **RCDs:**
  - Sensitivities 10, 30, 100, 300 and 500 mA. The Indian standard caps RCCBs at about 125 A.
  - Type F for single-phase inverters and Type B for three-phase VFDs (ABB).
  - Use an S-type RCD upstream of an SPD.
- **SPD:**
  - Uc must be at least 1.1 Uo (L-N and L-PE) and at least Uo (N-PE), which is 253 V for Uo = 230 V. A 275 V device satisfies this.
  - A typical Type 2 unit is In 20 kA / Imax 40 kA / Up ≤ 1.5 kV.
- **Fuses (Mersen):** gG versus aM, the aM time-current limits, selectivity at a ratio of about 1.6, and ambient derating.
- **Motor starters:** the DOL table (0.25–7.5 kW, with overload range, back-up fuse and cable size) and the star-delta tables. With star-delta, set the overload relay to 0.58 × FLC (relay in the delta loop). Siemens recommends DOL for submersibles only up to 5.5 kW / 7.5 HP.
- **Motor capacitors:** kVAR by kW and speed from SP 30 Annex F. The current must not exceed the motor's magnetising current.
- **HV fuse:** the ABB CEF-S table at 11 kV and 30 kV (use the 30 kV row for 33 kV). The fuse is about 2–4 × HV FLC because of the inrush criterion, so the "1.5–2 × FLC" rule is **not** supported.
- **11 kV arrester:** 9 kV rated, 5 kA, distribution class (MSEDCL). **RMU:** 12 kV, 630 A, 20 kA for 3 s.

## Derived (formula on sourced inputs)

The table gives LV FLC and the fault level at the transformer's LV terminals (400 V, IS 1180 impedance, infinite source):

| kVA | FLC (A) | Isc (kA) |
|---|---|---|
| 25 | 36 | 0.8 |
| 63 | 91 | 2.0 |
| 100 | 144 | 3.2 |
| 160 | 231 | 5.1 |
| 200 | 289 | 6.4 |
| 250 | 361 | 8.0 |
| 315 | 455 | 10.1 |
| 400 | 577 | 12.8 |
| 630 | 909 | 20.2 |

So a 6 kA MCB is fine for transformers up to 100 kVA. Use 10 kA, or calculate the cable impedance, for 160–250 kVA, and MCCBs of 16–25 kA at the board for 315–630 kVA. Whether NEA transformers have IS 1180 impedances is **not verified**.

## Not verified (show as "typical, confirm")

- **MCB:** the exact rated-current series and the IEC 60898-1 list of Icn values (only 10 kA is confirmed).
- **MCCB:** the thermal adjustment range (0.7/0.8–1 In) and the full list of frame sizes.
- **Fuses:** the IEC 60269 preferred rating series.
- **RCD:** the EV charging rule (Type A + 6 mA DC detection, or Type B). This rests on a vendor article only; IEC 60364-7-722 was not accessed. Also unverified: the solar-inverter rule and the wording "RCCB In ≥ upstream MCB".
- **MPCB settings.** No source found.
- **Single-phasing and dry-run protection:** practice only. Siemens includes a line monitoring relay in its star-delta starter.
- **Lugs:** the IS 8309/8394 texts (unreadable or not retrieved). There is no stud-by-size table: lug hole size follows the equipment's terminal stud.
- **Glands:** the IS 12943/BS 6121 texts. The OD ranges are CMP's; Indian brands differ slightly.
- **Duct sizes:** HDPE/DWC pipe catalogue sizes.
- **Earth resistance:** the "≤1 Ω substation" figure, and the NBC 207 Nepal requirements (no text found online).
- **DB way counts:** catalogue way counts and a spare-way percentage.
- **HV distribution transformer:** the NEA/REC DO fuse-element tables. There is only an Australian example from a search summary.
- **HV arresters:** the 33 kV arrester (30 kV, 10 kA) is from a search summary only.
- **HV protection:** the 1.2–1.5 × FLC relay pickup (textbook examples only), the "CT primary ≥ FLC" rule, the pole-mount AB switch + DO + LA arrangement, and 36 kV switchgear ratings.
- **HV termination kits:** termination kit size groups vary by maker.
- **Transformer LV breaker:** the "FLC × 1.0–1.25" factor.

## Recommended tool behaviour

1. Use `verified: true` and `derived` values as defaults.
2. Show `partial` and `false` values with a "confirm with supplier or NEA" badge.
3. Ask the user for the terminal stud size (lugs) and the measured cable OD (glands).
4. Calculate the fault level from transformer kVA and cable impedance instead of assuming a breaking capacity.
