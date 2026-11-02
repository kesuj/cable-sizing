# Cable sizing practice: Nepal first, then the rest of the world

Research compiled 2026-11-02 for the open-source LV + HV conductor sizing tool.

How to read this file:
- Every factual statement carries a source tag like **[S3]**. The tags are listed in the source list at the end.
- **UNVERIFIED** means no primary or reliable secondary source was found. The tool should treat these items as `null` or as a user input, not as a default.
- Out of scope here because other research streams cover them: IS 7098-2 MV catalogue data, LV reactance, IS 3961 rating factors, and Indian voltage-drop tables.
- The IEC 60364-5-52 numeric tables are in `iec_60364_5_52.json`, next to this file.

---

## PART A: Nepal

### A1. Legal and normative framework

| Instrument | What it says about conductors and cables | Status / source |
|---|---|---|
| **Electricity Act 2049 (1992) and Electricity Regulation (Rules) 2050 (1993)** | Sets the statutory voltages and their tolerances (A2). Requires earthing of all metal supports in HV systems (Rule 58). Requires a cut-out or circuit breaker at the meter and an isolating switch near the meter (Rule 59). Requires earthing of consumer appliances and three-pin earthed sockets (Rule 60). Requires internal wiring "in accordance with the prevailing technical standard" (Rule 61). Gives conductor-to-ground clearances (Schedule 12) and conductor-to-house/tree clearances (Schedule 13). | In force, as amended (amendment noted 2007) [S1] |
| **Nepal National Building Code NBC 207:2003, "Electrical Design Requirements for Public Buildings"** (DUDBC, reprinted 2064 BS) | Wiring practice: refers to **IS 732** (clause 1.2). Current-carrying capacity: "chosen in accordance with good practice **IS 3961** … and **IS 1554 (Part 1)**" (5.1). Standard sizes 1.5 to 500 mm² (5.1). Cable size depends on laying method, maximum temperature, prospective short-circuit current, protective device, load cycle and soil thermal resistivity, with **IS 1255** referenced (5.8). **Minimum sizes: lighting circuits 2.5 mm² Cu PVC, power circuits 4.0 mm² Cu PVC** (5.10). Voltage drop from the consumer terminals to any point must not exceed "the provision of electricity rule 2050" (6.1.4). Earthing per **IS 3043**, with an earth electrode at all premises (7.3, 7.5). MCB ratings per IS 8828 (5.5). The code describes itself as "a standard of good practice" in the form of recommendations. | 2003 edition; no later revision found [S2]. NBC compliance is mandatory in all municipalities [S3]. |
| **Nepal Electricity Grid Code 2080 (2023)**, Electricity Regulatory Commission | Grid connection, operation and maintenance rules. | Existence confirmed [S4]. Voltage and fault-level clauses **UNVERIFIED** (PDF not reached). |
| **NEA Community Electricity Distribution Bye-laws 2060** | Bye-laws for community distribution under the NEA Act 2041. | Exists [S5]. No cable-sizing content seen. |
| **NEA "Distribution System Master Plan", DoED guidelines, any "Nepal Electrical Code"** | n/a | **Not located.** No national LV wiring code separate from NBC 207 was found [S6]. |

**Do IS or IEC standards apply in practice?**
- Building wiring follows Indian Standards by explicit reference: NBC 207 cites IS 732, IS 3961, IS 1554, IS 1255 and IS 3043 [S2].
- Nepali cable makers certify LV ABC to IS 14255 (Janaki) [S7]. Rathi cites IS 398-4, IS 14255, IS 7098-1 and IS 8130 [S8].
- Donor-funded utility projects use "internationally accepted standards such as IEC, JIS, BS and ASTM". JICA's Kathmandu substation project listed IEC/BS/JCS for cable and wire [S9].
- **Practical conclusion for the tool:** IS-based sizing (IS 3961/IS 7098 data plus IS 732 rules) is the de-facto national default. IEC 60364-5-52 and IEC 60502/60287 are accepted alternatives, especially on donor (ADB/AIIB/JICA) work. This conclusion is drawn from [S2][S7][S8][S9]. No single source states it outright.

### A2. Voltage levels and permissible variation (Electricity Regulation 2050, Chapter 4) [S1]

| Level | Statutory nominal voltages | Permitted fluctuation |
|---|---|---|
| LV supply (Rule 40) | 230 V single-phase; 400 V three-phase; 230/400 V four-wire | **±5 %** |
| "High voltage distribution" (Rule 41) | 3.3, 6.6, 11, 22, 33 kV | **±5 %** |
| "High voltage transmission" (Rule 42) | 33, 66, 132, 220, 400 kV. The English translation prints "3,3000" and "6,6000" for the first two. | **±10 %** |
| Frequency (Rule 43) | 50 Hz | ±2.5 % |
| Power factor (Rule 44) | not below 0.8 lagging | n/a |

- ADB describes the levels in actual use as: LV 400/230 V; MV distribution 11 kV; MV sub-transmission 33 kV; HV 66, 115(sic) and 220 kV; EHV 400 kV [S10]. 132 kV is also in wide use, for example 132/11 kV grid substations in Kathmandu Valley [S10] and 132 kV lines with Bear ACSR [S11].
- **Tool implication:** NBC 207 ties the installation voltage-drop limit to the Rules [S2]. The only statutory number is the ±5 % supply tolerance at the consumer terminals. Neither document specifies how much of that ±5 % belongs to the utility network and how much to the installation.
  - A common engineering approach is to apply IEC 60364-5-52 Annex G (3 % lighting / 5 % other) inside the installation (Part B).
  - This split is a **design choice, not a Nepali rule**. The tool should show it as an editable default.

### A3. Typical NEA conductors and cables

| Application | Typical choice | Source / confidence |
|---|---|---|
| 11 kV overhead | ACSR **Dog (100 mm²)**, also **Rabbit (50 mm²)** and **Weasel (30 mm²)** | ADB technical review, Kathmandu Valley [S10] |
| 33 kV and 11 kV overhead (rural projects) | ACSR **Dog** listed for both 33 kV and 11 kV lines in a 2019 NEA tender (Rasuwa/Nuwakot) | NEA tender, seen via search snippet only [S12] |
| 11 kV covered conductor (bare-line replacement) | 55 mm² covered AAAC | NEA tender, search snippet only [S12] |
| 132 kV | ACSR **Bear**. Some lines re-conductored with ACCC (for example Khimti–Lamosangu: "Cordoba" ACCC, 100 MW raised to 170 MW) | NEA/ADB HTLS presentation; CTC Global [S11] |
| 220 kV / 400 kV | ACSR **Moose** (both levels shown in the NEA/ADB presentation) | [S11] |
| ACSR "Wolf" in NEA use | **UNVERIFIED** | No source found |
| 11 kV underground | 3-core, Al, XLPE, armoured, **300 mm²**. NEA tender clarification quotes a conductor short-circuit rating of **28.2 kA for 1 s** for that size. | NEA tender and clarification, search snippets only [S13] |
| 33 kV underground | **UNVERIFIED**: no NEA sizes found | n/a |
| LV aerial bundled cable (ABC) | NEA runs ICB tenders for LT ABC (ICB/DCSD-079/80-04) [S14]. Nepali makers that list NEA as a client offer 25–150 mm² [S7][S15]. **NEA's standard phase + messenger combinations (e.g. 3×95+70) are UNVERIFIED.** | [S7][S14][S15] |
| Distribution transformers | 3-phase 50, 100, 200 kVA; 1-phase 15 and 25 kVA in some areas | ADB [S10] |
| Service drop and meter cable sizes | **UNVERIFIED**: no NEA document found. Rule 59 requires only a sealed cut-out or circuit breaker at the meter and a consumer isolator [S1]. | n/a |

### A4. Fault levels and clearing times
- 11 kV switchgear at the JICA-built K3 substation in Kathmandu: rated 12 kV, **25 kA** breaking. 66 kV GIS: 72.5 kV, **20 kA** [S9].
- 11 kV 300 mm² Al XLPE cable: **28.2 kA / 1 s** conductor rating quoted in an NEA tender clarification [S13]. This is a cable rating, not a system fault level.
- **System fault levels and protection clearing times used by NEA for cable short-circuit checks: UNVERIFIED.** The tool should require these as user inputs. A conservative placeholder could be the switchgear rating (e.g. 25 kA at 11 kV) for 1 s, but that is a design assumption, not NEA data.

### A5. Earthing system (TT vs TN) in Nepalese LV networks
- The Rules require earthing of HV supports, of consumer appliances such as water heaters and air-conditioners, and of three-pin sockets. The consumer earthing system must be "in accordance with the technically proper system" [S1].
- NBC 207 requires an earth electrode (pipe or plate) at all premises, per IS 3043 [S2].
- A presentation hosted by the Nepal Engineers' Association states "TN-C-S is used in Public Electricity Network". However, it is an Indian vendor deck citing **Indian CEA regulations**, not NEA practice [S16].
- **Whether NEA's LV network is formally TN-C-S (PME) or TT is UNVERIFIED.** Local electrodes at every premises are compatible with either.
- **Tool implication:** make the earthing system a user input. Run the IEC 60364-4-41 disconnection check for TN (loop impedance) or TT (RCD) accordingly.

### A6. How cable sizing is actually done in Nepal
- **Building services:** follow NBC 207 [S2]. Rate cables from IS 3961 or manufacturer catalogues (Indian, plus Nepali makers who build to IS) [S2][S7][S8]. Apply the 2.5 mm² / 4 mm² minimums [S2].
- **Utility and planning studies:** engineers use ETAP for load flow and short circuit (for example an OCEM journal study of the central Nepal grid [S17]). IOE Pulchowk theses run feeder studies with "optimal cable selection" on NEA feeders [S18].
- **Donor projects:** the consultant's own IEC/JIS/BS design basis applies [S9].
- **No published survey of consultant practice exists.** Statements beyond the citations above are anecdotal and are deliberately omitted.

### A7. Climate and altitude
- **Terai heat:** Nepal's recorded maximum is 46.4 °C at Dhangadhi, 5 June 1995 [S19]. Tikapur reached 45.2 °C on 30 May 2024 [S20]. Nepalgunj recorded a station record of 44.2 °C [S21].
  - IEC 60364-5-52 at 45 °C ambient: PVC 0.79, XLPE 0.87 (Table B.52.14, see JSON).
  - At 50 °C (sun-heated enclosures, roofs): 0.71 / 0.82.
- **Kathmandu:** recorded extremes 35.2 °C (May 1994) and −3.0 °C (Jan 1998) [S9].
- **Altitude:**
  - IEC 60364-5-52 contains **no altitude correction factor** for cable ratings. A full-text search of the identical GOST adoption found none [S22].
  - Altitude derating above about 1000 m applies to **equipment**. Examples: soft starters and drives (no derating to 1000 m, then 2.2 % per 100 m [S23]); fuses and breakers (thresholds of 2000 m in some products [S24]).
  - **Partly confirmed:** for cables in air, lower air density reduces convective cooling [S25]. However, no cable standard was found that prescribes an altitude factor.
  - Two effects at high altitude offset each other in opposite directions:
    - Lower ambient temperatures *raise* ratings (B.52.14 factors are above 1 below 30 °C).
    - High solar irradiance is **not** covered by B.52.14/15. IEC directs an individual IEC 60287 calculation for sun-exposed cables [S22].
  - **Tool implication:** no altitude factor for cables. Do add a "sun-exposed" warning or flag, and offer an optional extra ambient rise.
- **Ground:** IEC reference is 20 °C and 2.5 K·m/W [S22]. No Nepali soil-resistivity survey data was found (**UNVERIFIED**). Dry Terai sand in the pre-monsoon season may sit above the reference.

---

## PART B: Rest of the world

### B1. Common sizing logic (all codes)
1. Find the design current Ib. In the NEC, continuous loads are taken at 125 %.
2. Choose a protective device In ≥ Ib.
3. Find the required tabulated current: It ≥ In ÷ (product of correction factors for ambient, grouping, soil, thermal insulation and harmonics).
4. Check voltage drop.
5. Check short-circuit withstand (adiabatic S ≥ √(I²t)/k).
6. Check earth-fault loop impedance or disconnection time, or the RCD for TT systems.
7. Check motor-starting voltage dip, and the neutral or harmonic case.

The IEC version of steps 3–4 is laid out in the Schneider guide [S26][S27]. The BS version is in [S29][S30].

### B2. Code-by-code summary

| | **IEC 60364-5-52** (Europe, much of Asia and Africa; base for Nepal's donor work) | **UK BS 7671 + IET** | **USA NEC (NFPA 70)** | **AS/NZS 3008.1.1 + AS/NZS 3000** | **India IS 732 / IS 3961 / NEC India (SP 30:2023)** |
|---|---|---|---|---|---|
| Ampacity tables | Annex B, B.52.2–B.52.13, by reference method A1–G [S22] | Appendix 4 tables (4D1A …) by reference method [S29][S30] | Table 310.16: ≤3 current-carrying conductors, 30 °C [S31][S32] | Tables by installation method; 3008.1.1 for Australian conditions [S35] | IS 3961 and manufacturer catalogues (separate research stream). SP 30:2023 is current; the 2011 edition is withdrawn [S38] |
| Base ambient | Air 30 °C; ground 20 °C; 2.5 K·m/W; 0.7 m depth [S22] | Air 30 °C (Ca from Table 4B1) [S30] | 30 °C (86 °F) [S31] | **Air 40 °C, soil 25 °C** in 3008.1.1. NZ part 3008.1.2: 30 °C / 15 °C [S35] | **UNVERIFIED** here (covered by the IS 3961 stream) |
| Correction factors | Ambient B.52.14, ground B.52.15, soil B.52.16, grouping B.52.17–21 [S22] | Ca, Cg (Table 4C1), Ci (thermal insulation), Cc (BS 3036 fuse) [S30] | Ambient 310.15(B); >3 conductors 310.15(C)(1): 4–6 = 80 %, 7–9 = 70 %, 10–20 = 50 % [S32] | Derating tables in 3008.1.1 [S35] | IS 3961 factors (other stream) |
| Voltage-drop limit | Annex G: 3 % lighting / 5 % other (public LV supply); 6 % / 8 % (private supply). Above 100 m, +0.005 %/m up to +0.5 % [S22][S28] | 3 % lighting / 5 % other (public supply); 6 % / 8 % (private) [S29] | **Informational notes only:** 3 % branch, 5 % feeder + branch [S33] | 5 % from point of supply to point of use (AS/NZS 3000 cl. 3.6) [S36][S37] | Secondary sources disagree: 3 % to farthest point (IS 732 cl. 7.7) vs 2.5 % lighting / 5 % power. **Verify against the standard** [S39][S40] |
| Load rule | Ib from load; diversity allowed | Ib ≤ In ≤ Iz; overload I2 ≤ 1.45 Iz | **125 % of continuous load (≥3 h) + 100 % non-continuous, before correction/adjustment factors** (210.19(A)(1), 215.2(A)(1)) [S32][S34] | Load per AS/NZS 3000 | IS 732 |
| Short circuit | Adiabatic, k from IEC 60364-5-54 / 4-43. Cu/PVC k = 115; Cu/XLPE k = 143 [S41] | Same adiabatic check (Reg. 434) | Insulation withstand per ICEA/IEEE (not covered here) | Adiabatic check in 3008.1.1 | IS 732; IS 3961 short-circuit curves |
| Disconnection / EFLI | IEC 60364-4-41 (TN 0.4 s final circuits ≤32 A at 230 V; 5 s distribution) **UNVERIFIED** here | Zs tables, Chapter 41 | Equipment grounding conductor per 250.122 (not covered here) | AS/NZS 3000 Section 5 + 3008.1.1 | IS 732 |
| Harmonics / neutral | Annex E: 3rd-harmonic factors 0.86 (15–33 % on phase current; 33–45 % size on neutral) [S22][S27] | Appendix 11 (same approach) **UNVERIFIED** | Neutral counted as current-carrying when it carries harmonics, 310.15(E) **UNVERIFIED** | n/a | n/a |
| Motor starting | Annex G note: larger drop accepted during starting if within equipment limits [S22] | Similar | No specific rule in the voltage-drop notes | n/a | n/a |

**Notable differences:**
- **Base ambient:**
  - The NEC and IEC both use 30 °C, but NEC tables are by termination temperature (60/75/90 °C columns) and AWG/kcmil sizes, not mm².
  - AS/NZS uses 40 °C, so its tabulated amps are lower for the same cable [S35].
- **Voltage drop:**
  - Mandatory in AS/NZS (5 %) [S36].
  - Recommendatory in the NEC (informational notes) [S33].
  - Informative in IEC Annex G [S22].
  - Nepal has only the ±5 % statutory supply tolerance [S1].
- **Continuous-load factor:** the 125 % rule is NEC-specific [S34]. IEC/BS/AS instead coordinate Ib ≤ In ≤ Iz.

### B3. MV/HV cable rating methods

| Method | Scope | Base / notes |
|---|---|---|
| **IEC 60502-2** Annex B | Tabulated ratings for 6–30 kV XLPE/EPR cables | ETAP's implementation uses 90 °C conductor, 30 °C air, 20 °C ground, 0.8 m depth, 1.5 K·m/W [S42]. Another secondary source shows soil factors normalised at 2.5 K·m/W, so the **base resistivity is ambiguous across secondary sources; verify against the standard** [S43]. |
| **IEC 60287** (-1-1 losses, -2-1 thermal resistance, -3-1 site reference conditions) | Analytical steady-state rating for any cable and installation | National reference ambient/soil values are listed in 60287-3-1 [S44][S45] |
| **IEC 60949** | Short-circuit capacity including **non-adiabatic** heat loss | Multiplies the adiabatic current by a factor ε. Gives noticeably higher permissible currents for screens, sheaths and conductors under 10 mm² [S41][S46] |
| **Neher–McGrath (1957) / IEEE 835** | US analytical method behind NEC MV tables; IEEE 835 publishes tabulated ampacities | [S47][S48] |
| **NEC Article 311** (formerly 310.60) | MV (2001–35 000 V) ampacity tables | Underground tables assume earth 20 °C, ρ = 90 °C·cm/W (= 0.9 K·m/W), 36 in depth [S47][S48]. Correction for other earth temperatures: I' = I·√((90 − Ta)/70) for 90 °C cable [S49]. |

**Recommendation for the tool's HV mode (design suggestion, not a sourced rule):**
- Use IEC 60502-2/60287-style ratings at 20 °C ground for Nepal. Make soil ρ a user input (default 1.5 or 2.5 K·m/W, clearly labelled).
- Check the short circuit with the IEC 60949 adiabatic method using the user's fault level and clearing time.
- Use IEEE 835 / NEC 311 only in "US mode".

---

## Things that could not be verified (keep as null or user input in the tool)
- NEA standard LV ABC configurations; NEA service-drop and meter cable sizes.
- NEA 33 kV underground cable sizes; whether NEA uses ACSR Wolf.
- NEA system fault levels and protection clearing times by voltage. Only switchgear and cable ratings were found.
- Whether NEA's LV system is TT or TN-C-S.
- Grid Code 2080 voltage clauses; any NEA Distribution Master Plan design criteria (voltage-drop limits for 11 kV / LV feeder planning).
- The split of the ±5 % statutory tolerance between network and installation.
- Nepali soil thermal resistivity data.
- Primary-text confirmation of the BS 7671, NEC, AS/NZS and IS figures above. All came from secondary sources, which are cited, and should be checked against the latest editions.
- IEC 60364-5-52 AMD1:2024 changes.

---

## Source list (all accessed 2026-11-02)

| Tag | Title | URL |
|---|---|---|
| S1 | Electricity Regulation, 2050 (1993), English translation (Chapter 4 Rules 40–47; Rules 58–61; Schedules 12–13) | https://policy.thinkbluedata.com/sites/default/files/Electricity-Regulation-2050-english.pdf |
| S2 | NBC 207:2003 Electrical Design Requirements for Public Buildings, DUDBC | https://iibh.org/kijun/pdf/Nepal_26_NBC_207_2003_Electrical_Design.pdf |
| S3 | Wikipedia, "Nepal Building Codes" | https://en.wikipedia.org/wiki/Nepal_Building_Codes |
| S4 | ShareSansar, "Nepal's Electricity Regulatory Commission Introduces 2080 Electricity Grid Code" | https://www.sharesansar.com/newsdetail/nepals-electricity-regulatory-commission-introduces-2080-electricity-grid-code-2023-08-27 |
| S5 | NEA Community Electricity Distribution Bye-laws (search listing) | https://cms.nea.org.np/admin/assets/uploads/supportive_docs/Community%20Electricity%20Distribution%20Bylaw.pdf |
| S6 | Search for a Nepal electrical installation code: nothing found beyond NBC/Electricity Rules (negative result; see asiapacificenergy listing of Electricity Rules) | https://policy.asiapacificenergy.org/node/386 |
| S7 | Janaki Cable Industry, Aerial Bunched Cables (IS 14255; 25–150 mm²) | https://www.janakicable.com.np/cable-wiring-products-nepal/aerial-bunched-cables/ |
| S8 | Rathi Cable Nepal, ABC cable (IS 398-4, IS 14255, IS 7098-1, IS 8130) | https://www.rathicable.com.np/abc-cable/ |
| S9 | JICA, Basic Design Study Report, Extension and Reinforcement of Power Transmission and Distribution System in Kathmandu Valley (Phase-3), Nov 2002 | https://openjicareport.jica.go.jp/pdf/11712163_01.pdf |
| S10 | ADB, Technical and Economic Review of Distribution Voltage in Kathmandu Valley (RRP NEP 50059) | https://ewsdata.rightsindevelopment.org/files/documents/02/ADB-50059-002_HpYVTb0.pdf |
| S11 | ADB Asia Clean Energy Forum, NEA HTLS presentation (Bear 132 kV, Moose 220/400 kV); CTC Global Khimti–Lamosangu ACCC case | https://asiacleanenergyforum.adb.org/wp-content/uploads/2015/06/HTLS-DDW-Surendra_Nepal-HTLS-presentation_rev.pdf ; https://ctcglobal.com/?p=226663 |
| S12 | NEA tender Vol. III, Rasuwa/Nuwakot (ACSR Dog 33/11 kV; 55 mm² covered conductor), search-snippet only | https://cms.nea.org.np/admin/assets/uploads/supportive_docs/1562654376_vol%20III.pdf |
| S13 | NEA tender clarification (11 kV 300 mm² Al XLPE; 28.2 kA 1 s), search-snippet only; NEA Vol III Lot 4 | https://nea.org.np/admin/assets/uploads/supportive_docs/1563445046_1563425802_clarification%20II.pdf ; https://cms.nea.org.np/admin/assets/uploads/supportive_docs/1585740149_Volume-III-Lot4.pdf |
| S14 | Nepal e-GP (bolpatra), NEA ICB/DCSD-079/80-04 Supply of LT Aerial Bundled Conductor (notice) | https://bolpatra.gov.np/egp/download?alfId=cm%3ABidding_Documentsnull%2Fcm%3AY2022%2Fcm%3AM2%40%40%40%40%40be2a0727-4f30-4baa-849a-93d646d955c3&docId=71881874 |
| S15 | Litmus Cables, Aerial Bunched Cables in Nepal | https://litmus.com.np/products/overhead-conductors/aerial-bunched-cables-abc-1 |
| S16 | Cape Electric, "Earthing & Equipotential Bonding" (hosted by Nepal Engineers' Association) | https://members.neanepal.org.np/uploads/downloads/file_BVoYs0yrUdgXMmPekkY7.pdf |
| S17 | Rijal & Acharya, "Load Flow and Short Circuit Analysis in Central Part of Nepal using ETAP", OCEM Journal | https://www.nepjol.info/index.php/ocemjmtss/article/view/74751 |
| S18 | P. K. Shah, IOE thesis 2023, "Impact of Increasing Load on the Distribution Network with the addition of Electric Cooking Stoves" | https://elibrary.tucl.edu.np/bitstream/123456789/18508/1/Prashant%20k%20shah%20thesis%20electrical%20engine%202023.pdf |
| S19 | Himalpress, "Many cities across the country setting heat records" | https://en.himalpress.com/many-cities-across-the-country-setting-heat-records/ |
| S20 | Kathmandu Post, "Valley sizzles as temperature persists over 30 degrees" (June 2024) | https://kathmandupost.com/weather/2024/06/13/valley-sizzles-as-temperature-persists-over-30-degrees |
| S21 | Himalayan Times, "Record high temperature: Nepalgunj sizzles at 44.2 degrees Celsius" | https://thehimalayantimes.com/nepal/record-high-temperature-nepalgunj-sizzles-at-442-degrees-celsius |
| S22 | GOST R 50571.5.52-2011 / IEC 60364-5-52:2009 (IDT), full text | https://meganorm.ru/Data2/1/4293792/4293792410.htm |
| S23 | Schneider Electric FAQ, altitude derating of Altistart/Altivar | https://www.se.com/in/en/faqs/FA341875/ |
| S24 | Littelfuse, Altitude Derating (fuses) | https://www.littelfuse.com/~/media/Electrical/faq-documents/Altitude-Derating.pdf |
| S25 | Glenair catalogue note on wire current vs altitude (air density) | https://catalogs.glenair.com/view/1063911466/13/ |
| S26 | Schneider EIG wiki, Recommended simplified approach for cable sizing | https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing |
| S27 | Schneider EIG wiki, General method for cable sizing | https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing |
| S28 | Schneider EIG wiki, Maximum voltage drop limit (Table G.52.1) | https://www.electrical-installation.org/enwiki/Maximum_voltage_drop_limit |
| S29 | myCableEngineering, BS 7671 voltage drop | https://mycableengineering.com/knowledge-base/bs-7671-voltage-drop |
| S30 | IET, Appendix 4 of Amendment 1 of BS 7671:2008; Professional Electrician article | https://electrical.theiet.org/media/1548/appendix-4-of-amendment-1-of-bs-7671-2008.pdf ; https://professional-electrician.com/?p=46956 |
| S31 | EEPower, "NEC Basics: Sizing and Protecting Branch Circuit Conductors" | https://eepower.com/technical-articles/national-electrical-code-basics-sizing-and-protecting-branch-circuit-conductors/ |
| S32 | Open Exam Prep, "Conductor Ampacity & NEC Table 310.16 Derating Adjustments" | https://open-exam-prep.com/study-guides/pe-electrical-power/nec-wiring-methods/conductor-ampacity-derating-nec-310-16 |
| S33 | Electrical-contractor.net forum quoting NEC 210.19(A) and 215.2(A) informational notes | https://www.electrical-contractor.net/forums/ubbthreads.php/posts/221845.html |
| S34 | EC&M / EC Mag, "Codes & Standards: Sizing Conductors, Part III" | https://www.ecmag.com/magazine/articles/article-detail/codes-standards-sizing-conductors-part-iii |
| S35 | Standards NZ, AS/NZS 3008.1.1:2025 listing (40 °C air / 25 °C soil; NZ 3008.1.2 30/15 °C) | https://www.standards.govt.nz/shop/asnzs-3008-1-12025 |
| S36 | Sunlith Energy, "AS/NZS 3008.1.1:2025: What changed" | https://sunlithenergy.com/?p=6228 |
| S37 | Voltflow, "Cable sizing Australia AS3000 (2026)" | https://www.voltflow.net/blog/cable-sizing-australia-as3000-2026 |
| S38 | BIS blog, National Electrical Code of India 2023 | https://www.services.bis.gov.in/php/BIS_2.0/BISBlog/national-electrical-code-of-india-2023/ |
| S39 | Infralens, IS 732 summary (cl. 7.7, 3 %) | https://infralens.in/code/IS-732 |
| S40 | Voltflow, "Wire size calculator India 2026" | https://www.voltflow.net/blog/wire-size-calculator-india-2026 |
| S41 | Elek, "Short circuit rating calculations for cables" | https://elek.com/articles/short-circuit-rating-calculations-for-cables |
| S42 | Slideshare, "Cable ampacity calculations IEC" (ETAP IEC 60502-2 base conditions) | https://www.slideshare.net/slideshow/cable-ampacity-calculations-iec/62955619 |
| S43 | IET EngX forum, "Soil thermal resistivity and ambient temperature" | https://engx.theiet.org/f/wiring-and-regulations/32293/soil-thermal-resistivity-and-ambient-temperature |
| S44 | GlobalSpec, IEC 60287-2-1 listing | https://standards.globalspec.com/std/283193/iec-60287-2-1 |
| S45 | BSI, IEC/BS 60287-3-1 site reference conditions | https://shop-checkout.bsigroup.com/products/electric-cables-calculation-of-the-current-rating-operating-conditions-site-reference-conditions |
| S46 | myCableEngineering, Non-adiabatic effects (IEC 60949) | https://mycableengineering.com/knowledge-base/non-adiabatic-effects |
| S47 | Allumiax, "Neher-McGrath study of cables in power system" | https://www.allumiax.com/blog/neher-mcgrath-study-of-cables-in-power-system |
| S48 | Maplesoft, "Cable Ampacity using the Neher-McGrath Method" | https://aws.webstore.maplesoft.com/products/MapleFlow/Electrical-Engineering/PDFs/Cable-Ampacity-using-the-Nehers-McGrath-Method.flow.pdf |
| S49 | Mike Holt forum, "Ampacity derating for depth" (NEC annex formulas quoted) | https://forums.mikeholt.com/threads/ampacity-derating-for-depth.83200/latest |
