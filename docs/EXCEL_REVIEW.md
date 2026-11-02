# Review of the original workbook (`source/conductor_calculator_original.xlsx`)

The workbook holds good reference data (IS 1554-1 PVC and IS 7098-1 XLPE catalogue tables, IS 3961
rating factors), but the calculation sheet is unfinished. These are the problems this repo fixes.

## A. Calculation sheet (INPUT / CALC)

| # | Cell | Problem | Effect | Fixed in this repo |
|---|---|---|---|---|
| 1 | `INPUT!B8` | Load current formula hard-codes `0.8` instead of using the power factor in `B7` | Any pf other than 0.8 gives the wrong current | `loadCurrent()` uses the entered pf |
| 2 | `INPUT!B8` | Ignores the *Load unit* list (W / kW / HP / kVA): always treats the input as kW, never applies motor efficiency | HP or kVA loads give wrong currents | Every unit handled; HP = 745.7 W shaft power ÷ η |
| 3 | `LOOKUP!B2` | Single-phase voltage is 220 V; spelling "Singe Phase" | Nepal (NEA) and IS 12360 standard is **230/400 V** | 230 V default |
| 4 | `CALC!B3` | Ambient-temperature factor typed as `1` although `INPUT!B32` says 45 °C | Rating overstated by 5–10 % (XLPE 0.95, PVC 0.90 at 45 °C) | Looked up from the IS table, or computed from √((θmax−θ)/(θmax−θbase)) |
| 5 | `CALC!B8` | Net derating `0.8099` is a typed number, not the product of the factors above it | Changing any input does not change the result | Product of the factors, recomputed every time |
| 6 | `INPUT!B41` | "Continuous current rating to be selected" is a typed `285.15` | Not linked to the load (10 kW gives 18 A) | Required rating = In ÷ k (or Ib ÷ k for HV) |
| 7 | — | No size selection, no voltage-drop, no short-circuit, no breaker, no earth-conductor step | Not a complete sizing | All of these steps are added |
| 8 | `TEMP` Table 7 | Ground-temperature factors are for PVC (70 °C) but are offered for every insulation | XLPE under-rated slightly in hot ground and over-rated in cool ground | XLPE / HR-PVC use their own θmax in the formula |
| 9 | `TEMP` | XLPE air factors missing below 40 °C ("-") | Cannot use the sheet in the hills or mountains | Formula fills the gap (XLPE 30 °C → 1.10) |

## B. Data transcription errors in the catalogue tables

Found automatically by `scripts/extract_excel.py` (ratings must rise with size, copper must beat
aluminium, resistance must fall with size, and values must match IS 8130 / IEC 60228).

| Table | Size | Field | In workbook | Used | Reason |
|---|---|---|---|---|---|
| XLPE 3-core | 25 mm² | in-duct rating, Al | 65 A | 85 A | Breaks the rising sequence; identical 3½C and 4C tables give 85 A |
| XLPE 2-core | 630 mm² | AC resistance, Al | 0.606 Ω/km | 0.0606 | Decimal slip (500 mm² is 0.0782) |
| XLPE 3½-core | 25 mm² | AC resistance, Al | 1.538 | 1.53 | 3C/4C tables |
| XLPE 3C, 3½C, 4C | 630 mm² | in-ground rating, Cu | 944 A | removed | Impossible (Al is 529 A, Cu 500 mm² is 582 A); true value unknown, so this one case is withdrawn |
| PVC 1-core | 500 mm² | DC resistance, Al | 0.0065 | 0.0605 | IS 8130 |
| PVC 1-core | 630 mm² | DC resistance, Cu | 0.0233 | 0.0283 | IS 8130 |
| PVC 2C, 3C, 3½C | 95 mm² | 1 s short-circuit, Cu | 10.09 kA | 10.9 kA | = 0.115 kA/mm² × 95, as in the 1C and 4C tables |
| PVC 4-core | 500 mm² | in-air rating, Al | 540 A | 405 A | Larger than the copper value (500 A); every other 4C row equals the 3C table (405 A) |

The full machine-readable list is in `data/lv_is.json → errata_applied`.

## C. Things that were right
The resistances (IS 8130), the 1-second short-circuit ratings (0.143 × S for XLPE Cu, 0.094 × S for
XLPE Al, 0.115/0.076 for PVC), and the IS 3961 grouping, depth and soil tables are consistent with
the standards and are used unchanged.
