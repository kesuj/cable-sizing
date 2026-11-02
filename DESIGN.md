# Design — Conductor Sizing Workbench

## Subject, audience, job
A cable-sizing workbench for Nepal (and anywhere IS/IEC is used). Two audiences share one screen:
a homeowner/electrician who answers four plain questions, and an engineer who opens every factor.
Primary job: say **which cable to buy and which breaker to fit**, and show the working.

## Direction: "drafting film + phase colours"
Not a SaaS dashboard. It borrows from the engineer's own world: the pale grey-green of drafting film,
pencil-grey rules, ink text, and the IS 1554 core colours (red, yellow, blue, black) which are the only
colours that carry meaning. One memorable element: a **to-scale cable cross-section** that redraws as
inputs change. Everything else stays quiet.

## Colour tokens
| name | light | dark | use |
|---|---|---|---|
| film | `#EEF1EE` | `#141A1D` | page background |
| sheet | `#FFFFFF` | `#1C2428` | panels |
| ink | `#18212A` | `#E6ECEC` | text |
| graphite | `#58656E` | `#9AA7AE` | secondary text |
| rule | `#C9D1D0` | `#33414A` | borders |
| phase-yellow (accent) | `#E2B007` | `#E8BC2A` | selected size, primary button, focus ring |
| pass / fail | `#2E7D4F` / `#B3261E` | `#5DBB84` / `#F0796F` | check states only |
Core colours (cross-section only): R `#C62828`, Y `#E2B007`, B `#1F5FAF`, N `#222`, PE green/yellow.

## Type
Archivo (variable, wdth 62–125). Headings: Archivo at wdth 75, weight 700, tight tracking. Body 16 px,
line-height 1.5. Numbers: `font-variant-numeric: tabular-nums` (no monospace). Scale 1.25: 13 / 16 / 20 / 25 / 31 / 39.
Sentence case everywhere; no all-caps labels.

## Spacing
4 px base: 4, 8, 12, 16, 24, 32, 48, 64. Radius: 2 px for inputs, 0 for tables, 6 px only for the result panel.

## Layout
```
desktop ≥ 1024
┌──────────────────────────────────────────────────────────────┐
│ Conductor sizing   [LV ≤1.1 kV | HV 3.3–33 kV] [IS·Nepal|IEC] [Simple|Engineer] │
├───────────────────────────────┬──────────────────────────────┤
│ 1 What it powers              │  ┌─ cross-section (SVG) ─┐  │
│ 2 The cable                   │  │   ◉ to scale          │  │
│ 3 Where it runs               │  └───────────────────────┘  │
│ 4 Checks (VD, fault, motor)   │  Buy: 4-core 16 mm² Cu XLPE │
│                               │  Breaker: 63 A               │
│                               │  ▮▮▮▮▮▯ current 78 %          │
│                               │  ▮▮▯▯▯▯ voltage drop 2.1/5 % │
├───────────────────────────────┴──────────────────────────────┤
│ Working: currents → factors → every size tried (table) → notes │
└──────────────────────────────────────────────────────────────┘
phone 390: form, then result, then working; a slim sticky bar shows the answer.
```
Steps 1–4 are numbered because they are a real sequence. Left-aligned throughout.

## Motion
Only the cross-section animates (rings resize, 180 ms ease-out) when the answer changes. Respect
`prefers-reduced-motion`.

## Slop check (done before coding)
- No cream+serif+terracotta, no black+acid accent, no gradient, no card grid, no emoji, no "→" links.
- Accent comes from the subject (IS phase yellow), not from a theme default.
