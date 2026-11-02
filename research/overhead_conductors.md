# Overhead conductors (ACSR/AAAC): research summary

Data file: `overhead_conductors.json`. Every value there lists its source id. Values I couldn't verify are set to `null` with a note.

## What is verified

- **ACSR to IS 398-2.** Covers Mole, Squirrel, Weasel, Rabbit, Raccoon, Dog, Leopard, Coyote, Wolf (30/7), Lynx, Panther, Goat, Drake, Kundah, Zebra, Deer, Moose, Morkulla and Bersimis. Fields are stranding, Al/total area, diameter, R20, mass and UTS. The source is the Satcon IS 398-2 reproduction, cross-checked against Lumino and Apar. Where these disagree, the row has a note (for example, Kundah R20 is 0.07269 vs 0.0731).
- **BS 215 / BS EN 50182 codes.** Gopher, Ferret, Mink, Bear, Goat, Sheep, plus the BS versions of Weasel, Rabbit, Dog, Wolf, Lynx, Panther and Zebra. Sources are Lumino BS 215:1970 and Sierra Cables. Mink, Bear and Sheep come from Sierra only. Their Al area is computed as n·πd²/4.
- **AAAC to IS 398-4.** 15, 20, 34, 55, 80, 100, 125, 150, 175, 200, 232, 290, 345, 400 and 465 mm². Each has R20 twice: the standard value at nominal wire diameter and the maximum value. Source is Satcon. Mass is `null` for 290 mm² and above because the table text came out misaligned.
- **Reference ampacities (222 rows).** Each row records its exact conditions:
  - **CEA Manual on Transmission Planning Criteria 2023, Table II.** Zebra, Moose, Panther, Bersimis, Snowbird and Lapwing, plus AAAC/AL59 equivalents. Ambient 40, 45, 48 and 50 °C; conductor 65, 75, 85 and 95 °C. Conditions: wind 0.56 m/s at 90°, 1045 W/m², α 0.8, ε 0.45, 0 m elevation. The table's AC resistances are included.
  - **Satcon IS 398-2 ACSR and IS 398-4 AAAC.** Conductor 65 and 75 °C. Ambient 40 °C, 0.61 m/s, α = ε = 0.5, 985 W/m². The AC resistances are printed in the table.
  - **Apar/Lumino IS 398-2.** Conductor 75 and 85 °C. Ambient 45 °C, 0.56 m/s, ε 0.45, α 0.8, 1045 W/m², 0 m.
  - **Prysmian (US datasheet).** Drake, Cardinal, Partridge and Penguin at 75 °C. Ambient 25 °C, 0.61 m/s, ε = α = 0.5, latitude 30°N, line running E-W, noon on July 1.
- **IEEE 738-2012 equations.** All SI equations are in the JSON. They come from the PyPacity port of the IEEE 738 program and arXiv:2607.23536; I did not read the standard itself (paywalled). I wrote my own implementation of them and it reproduces:
  - **CEA Table II:** within ±1 A.
  - **Satcon ACSR and AAAC tables:** within ±1 A.
  - **Prysmian ratings:** within 3 A.
  - **Drake example:** 1025.4 A at 100 °C.
- **Drake example inputs.** D = 28.14 mm, R25 = 7.283e-5 Ω/m, R75 = 8.688e-5 Ω/m, ε = α = 0.8, 30°N, line azimuth 90° (E-W), 0 m, day 161 (June 10), clear atmosphere. Source is arXiv Table I. Ambient 40 °C and wind 0.61 m/s ⊥ come from PyPacity's demo case.
- **Nepal practice.** Source is the AIIB/NEA 2019 project document:
  - **11 kV:** Dog, Rabbit, Weasel.
  - **33 kV:** Dog for 3/8 MVA substations; Panther or Zebra for 24 MVA.
  - **Voltage drop:** 5% design limit at 11 and 33 kV.
- **Nepal Electricity Rules 2050.** Voltage may vary by ±5% at 3.3–33 kV distribution and ±10% at 33–400 kV transmission. Frequency may vary by ±2.5%.
- **132 kV:** Most existing NEA lines use ACSR Bear, with some Panther (TU thesis abstract).
- **220/400 kV:** Twin and quad Moose were considered; 220 kV twin HTLS was chosen (ADB/NEA 2015 slides).

## Key findings for the implementation

1. **Use AC resistance, not DC.** Indian tables compute ampacity with AC resistance. The AC/DC ratio at 75 °C implied by the CEA and Satcon tables depends on the number of aluminium layers:
   - **Single layer (6/1, 6/7: Mole to Dog):** about 1.15.
   - **Two layers (Wolf, Panther, Drake, Kundah):** about 1.005.
   - **Three layers (54/7: Zebra, Moose):** about 1.04.

   Using DC resistance gives ratings about 7% high for Dog-class conductors.
2. **Solar term in CEA/Apar tables.** It is simply qs = α·S·D, with the sun at 90° incidence and no elevation factor.
3. **GMR/r ratios.** I computed these from the Prysmian GMR column; they are not printed as ratios in any source:
   - **26/7:** 0.806
   - **30/7:** 0.818
   - **54/7:** 0.805
   - **45/7:** 0.79
   - **6/1:** 0.30–0.43. This depends on size and current because the steel core magnetises.

   Reactance: X = 2πf·2e-4·ln(GMD/GMR) Ω/km.
4. **CEA reactance values.** 132 kV Panther D/C: X = 0.405 Ω/km. 66 kV Dog D/C: X = 0.446 Ω/km. I converted both from per-unit on a 100 MVA base.

## Not verified (null in the JSON)

- **Published Drake result.** I didn't see the standard's own 1025 A figure or its intermediate heat terms in any source I could open. Only my computed values are recorded.
- **NEA design temperatures.** No source found for NEA's design ambient or maximum conductor temperature (NEA bid documents returned 404 or DNS errors). CEA uses 45 °C ambient, with a lower value allowed in hilly areas.
- **Phase spacing.** No source found for NEA or REC 11, 33 or 132 kV phase spacing.
- **Single-source or missing conductors.** Wolf at 33 kV, BISON at 132 kV and NEA 66 kV conductors were not found. Cardinal at 132 kV appears only in a search snippet.
- **Moose 876 A.** This figure on the ADB slide has no conditions stated.
- **Nepal elevation ranges.** These come from the brief, not from a source.
- **IEEE 738-2023 changes.** Not checked.
