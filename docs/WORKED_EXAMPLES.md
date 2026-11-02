# Worked examples (hand calculations behind the tests)

Every number here is asserted in `tests/*.test.js`, so the engine and this page cannot drift apart.

## 1. House feeder, 10 kW, 400 V, 50 m in a buried duct (IS, PVC, copper, 4-core)
1. I = 10 000 / (√3 × 400 × 0.8) = **18.04 A**
2. Device: next standard rating ≥ 18.04 A → **20 A** (TPN MCB)
3. Factors: ground 30 °C → 1.00; soil 150 K·cm/W → 1.00; depth 750 mm → 1.00; one duct → 1.00; k = 1.00
4. Need It ≥ 20 / 1.00 = 20 A. 4C PVC Cu in duct: 2.5 mm² = **24 A** ✓
5. Voltage drop, R = 8.87 Ω/km (AC at 70 °C), X ≈ 0.10 Ω/km, cos φ 0.8, sin φ 0.6
   ΔU = √3 × 18.04 × 0.050 × (8.87 × 0.8 + 0.10 × 0.6) = 11.18 V = **2.80 %** ≤ 5 % ✓
6. Result: **4-core 2.5 mm² Cu PVC armoured, 20 A TPN MCB, PE 2.5 mm²**

## 2. 30 HP pump, 250 m, Al XLPE 3-core buried with two other circuits, fault 15 kA for 0.2 s
1. P = 30 × 745.7 = 22 371 W shaft; I = 22 371 / (√3 × 400 × 0.85 × 0.9) = **42.21 A**
2. Ib = 42.21 × 1.25 (motor branch) = 52.76 A → In = **63 A**
3. Three multicore cables touching in a flat row (IS table 11): k = **0.69**
4. Need It ≥ 63 / 0.69 = 91.3 A → 25 mm² Al = 94 A ✓ (thermal alone)
5. Short circuit: S ≥ 15 000 × √0.2 / 94 = **71.4 mm²** → 95 mm² — **this decides the size**
6. Starting dip at 95 mm² (R 0.409, X 0.075, 6 × FLC = 253 A, cos φs 0.3):
   √3 × 253.3 × 0.25 × (0.409 × 0.3 + 0.075 × 0.954) = 21.3 V = **5.3 %** ≤ 15 % ✓
7. Result: **3-core 95 mm² Al XLPE armoured** (25 mm² would overheat only during a fault)

Lesson: on a strong supply with a slow protective device, the short-circuit check — not the load —
sets the size. A faster device (e.g. MCCB instantaneous trip, 0.02 s) brings it down: 15 000 × √0.02
/ 94 = 22.6 mm² → 25 mm².

## 3. 5 kW single-phase load 200 m away, PVC Cu 2-core in air
The 25 A breaker needs only 4 mm² for heat, but voltage drop is 2·I·L·(R cos φ + X sin φ): the
engine walks up until ΔU ≤ 5 % of 230 V = 11.5 V. Voltage drop decides the size.

## 4. 1 500 kVA, 400 V: parallel runs
I = 1 500 000 / (√3 × 400) = 2 165 A → In = 2 500 A. No single cable carries this, so the engine
tries n = 2, 3 … runs of single-core XLPE in air, adding each run to the group, until one size passes.

## 5. 11 kV, 5 MVA, two circuits in one trench, 3 km, 13.1 kA for 1 s (Polycab, Al, 3-core)
1. I = 5 000 / (√3 × 11) = **262.4 A** (HV: sized on Ib; relay set ≤ Iz)
2. Two 3-core cables touching (MV table): k = 0.79; ground 30 °C, soil 150, depth 0.9 m → 1.00
3. 240 mm²: 315 × 0.79 = 248.9 A ✗ ; 300 mm²: 355 × 0.79 = **280.5 A** ✓
4. Short circuit: 13 100 × √1 / 94 = 139.4 mm² ✓ ; VD at 3 km ≈ 1.9 % ✓
5. Result: **3-core 300 mm² Al XLPE 6.35/11 kV (E)** — decided by current-carrying capacity

## 6. 33 kV, same 5 MVA
I = 87.5 A — thermally the smallest 33 kV cable (95 mm²) carries it easily, but 13.1 kA·1 s needs 139.4 mm² → **150 mm²**.
At 33 kV the fault level and protection time usually decide the cable, not the load.
