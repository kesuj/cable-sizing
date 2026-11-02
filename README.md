# Conductor sizing — LV and HV, Nepal (IS) and international (IEC)

Choose the right cable and breaker the way a design engineer does, in a page that a homeowner or
an electrician can also use. It covers **low voltage (230/400 V, up to 1.1 kV)** and **high voltage
(3.3, 6.6, 11, 22, 33 kV)**, and shows every step of the working.

Started from the workbook `source/conductor_calculator_original.xlsx` (IS 1554 / IS 7098 catalogue
tables and IS 3961 rating factors). The workbook's data is kept; its unfinished calculation is
replaced by a complete, tested method. See [docs/EXCEL_REVIEW.md](docs/EXCEL_REVIEW.md) for the
errors found in it.

## Use it

**No install.** Double-click `index.html` — it runs offline in any browser (also from a USB stick or
a phone's file manager). Or publish the folder on GitHub Pages.

Live: **https://kesuj.github.io/cable-sizing/**

* **Simple** (English / नेपाली) — start from the job: house main cable (from the NEA meter
  category on your bill), geyser/heater, AC, water pump (nameplate HP or amps, starter type),
  EV charger, shop/small industry, or an 11/33 kV transformer feed. Pick how the cable is laid from
  pictures, where in Nepal, and the length. You get the cable to ask for, the breaker (rating, trip
  curve, poles), the RCD, the earth wire, **the voltage your appliance actually gets** (at 230 V and
  at NEA's −5 % limit), why one size smaller would fail, every assumption, and a shop checklist.
  Every term has a "What is this?" note with a figure.
* **Engineer** — every input is open: voltage, pf, efficiency, growth margin, motor factor, soil
  resistivity, depth, grouping, spacing, formation, voltage-drop limit, fault level and clearing time
  (or breaker let-through I²t), motor starting, sizing basis (In or Ib), HV catalogue choice.

## What it checks (the complete process)
1. Load current from W / kW / HP / kVA / A, 1-phase, 3-phase or DC
2. Design current (growth allowance, motor factor 1.25)
3. Protective device: next standard rating, Ib ≤ In ≤ Iz (IEC 60364-4-43 / IS 732)
4. Rating factors: air or ground temperature, soil resistivity, depth, grouping (IS 3961 / catalogue / MV tables)
5. Smallest size whose derated rating carries the current
6. Voltage drop with R and X (running), and motor-starting dip
7. Short-circuit withstand, S ≥ I√t/k or k²S² ≥ I²t
8. Parallel runs when one cable is not enough (with the extra grouping)
9. Protective earth conductor (IEC 60364-5-54 Table 54.2)
10. What to buy: cores, size, material, insulation, armour, voltage grade, length with 10 % spare

It tells you **which check decided the size**, and shows the result of every size it tried.
Full method with formulas and clauses: [docs/METHOD.md](docs/METHOD.md).

## Data
| File | Contents | Source |
|---|---|---|
| `data/lv_is.json` | 1.1 kV PVC (IS 1554-1) and XLPE (IS 7098-1) cables: 1, 2, 3, 3½, 4 core, Al/Cu, ratings in ground/duct/air, R, short-circuit | your workbook, 12 typos corrected |
| `data/derating_is.json` | IS 3961-style rating factors | your workbook |
| `data/hv_is.json` | IS 7098-2 XLPE 3.3–33 kV, 1 and 3 core, Al/Cu, R, X, C, ratings, 1 s short-circuit, MV rating factors | Polycab HT XLPE catalogue; KEI handbook as cross-check |
| `research/` | Raw transcriptions and research notes with source links | see each file |

Regenerate everything: `python scripts/build.py` (needs Python 3 and `openpyxl` only for re-reading the Excel file).

## Tests
`node --test tests/*.test.js` — hand-checked worked examples (LV house feeder, motor pump, long
run, parallel runs, Terai temperatures, 11 kV and 33 kV feeders) plus data self-checks. Worked
examples are explained in [docs/WORKED_EXAMPLES.md](docs/WORKED_EXAMPLES.md).

## Layout
```
index.html  styles.css      the app (works from file://)
guide.html                  how it works, Nepal and world practice, for laymen and engineers
src/core.js                 formulas (current, VD, short circuit, k values, PE size, interpolation)
src/size.js                 the sizing process
src/adapters/               data sources: IS LV, IS HV, IEC 60364-5-52
src/jobs.js                 Simple-mode jobs: plain answers -> engineering input, protection, voltage at load
src/explain.js              "What is this?" explainers (EN/NE) and line figures
src/app.js  src/xsec.js     UI and the to-scale cable cross-section
dist/app.bundle.js          generated single-file bundle
scripts/                    extract Excel, build data, build bundle
docs/                       method, Excel review, worked examples
```

## Limits — read before you buy or build
* Catalogue ratings differ between manufacturers by a few percent. Check the datasheet of the cable
  you actually buy.
* Earth-fault loop impedance / disconnection time, harmonics (neutral sizing with > 15 % third
  harmonic), cables in direct sun, and HV screen earth-fault capacity are flagged but not calculated.
* In Nepal, work on the NEA network and service connections must be approved by NEA and done by a
  licensed electrician/contractor.
