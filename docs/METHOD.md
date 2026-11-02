# The complete conductor-sizing process

This is the method the engine (`src/size.js`) follows, step by step, for both LV (≤ 1.1 kV) and HV
(3.3–33 kV). Each step names the clause it comes from. Symbols: **Ib** design current, **In** device
rating, **Iz** derated cable capacity, **It** tabulated rating, **k** total rating factor.

```
 load ─► Ib ─► In ─► factors k ─► It ≥ In/k ─► voltage drop ─► motor-start dip ─► short circuit ─► earth conductor
                                      │              │                 │                 │
                                      └──────── smallest standard size passing ALL checks ┘
                                                        │ none passes? → parallel runs (with extra grouping)
```

## 1. Load current
| Supply | Formula |
|---|---|
| 3-phase, power in kW | I = P / (√3 · U_L · cos φ · η) |
| 1-phase | I = P / (U · cos φ · η) |
| apparent power kVA | I = S / (√3 · U_L) or S / U |
| motor in HP | P = HP × 745.7 W of **shaft output**, so η always applies |
| DC | I = P / (U · η) |

η is applied only when the power is a motor's mechanical output (nameplate). Defaults used in Simple
mode: house/shop pf 0.9; motor pf 0.85, η 0.9; resistive pf 1.0.

## 2. Design current Ib
Ib = I × (1 + growth allowance) × motor factor.
* Growth allowance: 25 % in Simple mode for building supplies (common consultant practice).
* Motor factor 1.25 for a single motor branch: IS 732 / NEC 430.22 practice, so the cable is not
  the weak link when the motor runs at its service factor.

## 3. Protective device (LV)
Choose the next standard rating **In ≥ Ib** (6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200,
250, 315, 400, 500, 630, 800 … A). Coordination rule, IEC 60364-4-43 §433.1 / IS 732:

  **Ib ≤ In ≤ Iz**  and  **I2 ≤ 1.45 Iz**

For MCBs (IEC 60898) and MCCBs (IEC 60947-2) the conventional tripping current I2 ≤ 1.45 In, so the
second condition is met automatically once In ≤ Iz. For gG fuses I2 = 1.6 In, so size on
Iz ≥ 1.1 In (enter a 10 % margin in Engineer mode).

HV: the cable is sized on **Ib ≤ Iz** and the relay is then set at or below Iz.

## 4. Rating factors k (derating)
Iz = It × k, with k = product of the factors for the installation:

| Installed | Factors | Source |
|---|---|---|
| In air | ambient air temperature × grouping on trays/racks | IS 3961-2 / catalogue tables 8, 9, 20 |
| In ground (direct) | ground temperature × soil thermal resistivity × depth × grouping | tables 6, 7, 10, 11, 12 |
| In buried duct | ground temperature × soil resistivity (duct) × depth × duct grouping | tables 7, 10, 12, 13 |

Base conditions of IS ratings (IS 3961-2 cl. 2.1, confirmed by Polycab): air 40 °C, ground 30 °C, soil
150 K·cm/W (1.5 K·m/W), depth 750 mm (LV); 900 mm (≤ 11 kV) / 1050 mm (22–33 kV) for HV. IEC 60364-5-52 uses air 30 °C, ground 20 °C, soil 2.5 K·m/W, depth 0.7 m; **never mix a
table from one system with factors from the other**.

Where a published factor is missing, the engine uses the heat-balance formula the tables come from:

  k_θ = √((θmax − θ) / (θmax − θbase))   with θmax = 70 °C PVC, 85 °C HR-PVC, 90 °C XLPE/EPR

It reproduces the IS tables within ±0.01 (tested in `tests/engine.test.js`).

Lookup rules always err on the safe side: a group count between two rows takes the larger count;
a spacing between two columns takes the smaller spacing; soil/temperature values are interpolated;
values beyond a table are extrapolated and flagged.

## 5. Required tabulated rating and first size
It ≥ In / k (LV) or It ≥ Ib / k (HV). The smallest size whose table value satisfies this passes
the thermal check.

## 6. Voltage drop
  ΔU = √3 · Ib · L · (R cos φ + X sin φ)   (3-phase, line-to-line)
  ΔU = 2 · Ib · L · (R cos φ + X sin φ)    (1-phase and DC loop; X = 0 for DC)

R is the **AC resistance at maximum conductor temperature** (conservative; IEC 60364-5-52 Annex G
allows a lower R at actual temperature, which the working also reports as θ = θa + (θmax−θa)(Ib/Iz)²).
Limits used as defaults, with where they come from:

| Where | Limit | Source |
|---|---|---|
| Nepal, supply at the customer | 230/400 V **±5 %** | Electricity Rules 2050 (1993), Rule 40 |
| India, consumer installation | 4 % from origin to equipment (5 % "deemed to satisfy"); lighting 3 % | NEC 2011 (SP 30) §4.8 and §4.2.10.1 |
| IEC 60364-5-52 Annex G | 3 % lighting / 5 % other (public LV supply); 6 % / 8 % (private transformer) | IEC 60364-5-52 G.52.1 |
| Nepal, 11 kV and 33 kV feeders | < 5 % at target-year load | NEA distribution design criteria (AIIB-financed project, 2019) |

The tool uses 5 % by default; set 3 % for lighting or sensitive loads, 4 % for strict NEC-India
compliance. Because NEA only guarantees ±5 % at the meter, a 5 % internal drop can leave
equipment at −10 %: for long rural runs, aim lower.

## 7. Motor starting
  ΔU_start = √3 · (m · I_FL) · L · (R cos φ_s + X sin φ_s)

m = 6–7 DOL, 2–3 star-delta, 3–4 soft starter, ≈1.2 VFD; cos φ_s ≈ 0.3. Limit 15 % at the motor
terminals for the cable alone (motor must still produce enough torque; check supply dip separately).

## 8. Short-circuit withstand (adiabatic)
  S ≥ I · √t / k   (IEC 60364-4-43 §434.5.2, IEC 60949, IS 732)
  For current-limiting devices clearing in < 0.1 s: k²S² ≥ I²t (let-through, from the catalogue)

| Insulation (θ start → θ final) | Cu | Al |
|---|---|---|
| PVC ≤ 300 mm² (70 → 160 °C) | 115 | 76 |
| PVC > 300 mm² (70 → 140 °C) | 103 | 68 |
| HR-PVC ≤ 300 mm² (85 → 160 °C) | 104 | 69 |
| HR-PVC > 300 mm² (85 → 140 °C) | 90 | 59 |
| XLPE / EPR (90 → 250 °C) | 143 | 94 |

At HV this is often the deciding check: e.g. 13.1 kA for 1 s on Al XLPE needs ≥ 139 mm² → 150 mm².
The metallic screen/armour must also carry the earth-fault current; check it from the catalogue.

## 9. Parallel runs
If no size passes, the engine tries 2, 3 … 6 runs. Each run carries Ib/n, and the runs are added to
the group (more mutual heating). Parallel conductors must be the same size, material, length and
route (IEC 60364-5-52 §523.7).

## 10. Protective (earth) conductor
IEC 60364-5-54 Table 54.2 / IS 732, same material as the phase conductor:

| Phase S | PE |
|---|---|
| S ≤ 16 mm² | S |
| 16 < S ≤ 35 | 16 |
| S > 35 | S / 2 |

Or calculate it with the same adiabatic formula using the earth-fault current. Armour may serve as
the PE if its cross-section passes that check.

## 11. Earth-fault loop / disconnection time (check outside this tool)
TN systems: Zs × Ia ≤ U0, with Ia the current that trips the device in 0.4 s (final circuits ≤ 32 A)
or 5 s (distribution). Nepal LV networks are generally TT at the customer end, so an RCD (30 mA for
sockets, 100–300 mA for main) is what provides the fast disconnection. See `research/world_practice.md`.
