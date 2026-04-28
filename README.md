# Rate Hero Pricer

Multi-lender DSCR scenario builder. Borrower-facing 3-card UI (Cold/Warm/Hot) with Rate Hero compensation baked into displayed pricing. Audit-logged best-execution across multiple wholesale lenders.

## Status

**Phase 1 — Foundation**

- [x] Repo structure
- [x] Schema for first lender JSON (Cake — Pound Cake DSCR)
- [x] Comp config schema
- [ ] Hand-fill remaining values in `lenders/cake/pound-cake-dscr.json` from rate sheet
- [ ] Verify NMLS for Cake Mortgage Corp
- [ ] `engine/engine.js` — single-program pricer
- [ ] `engine/tier-builder.js` — Cold/Warm/Hot generator
- [ ] `engine/best-execution.js` — multi-lender winner picker
- [ ] `tests/cake-dscr-scenarios.js` — 10 verification scenarios
- [ ] Bare-bones HTML UI on Cloudflare Pages

## Repo structure

```
ratehero-pricer/
├── README.md
├── lenders/
│   └── cake/
│       ├── pound-cake-dscr.json    ← hand-built from rate sheet
│       ├── coffee-cake-dscr.json   (next)
│       ├── sponge-cake-dscr.json   (next)
│       ├── velvet-cake-dscr.json   (next)
│       ├── cup-cake-dscr-fn-itin.json  (next)
│       └── ...
├── config/
│   └── comp.json                   ← Rate Hero comp injection
├── engine/
│   ├── engine.js                   ← LLPA stacker + price computer
│   ├── tier-builder.js             ← generates Cold/Warm/Hot from rate ladder
│   ├── eligibility.js              ← scenario filter against program rules
│   └── best-execution.js           ← multi-lender winner per tier
├── tests/
│   └── cake-dscr-scenarios.js      ← 10 known-good scenarios for math validation
└── ui/
    └── (later)
```

## How pricing works (data flow)

```
Borrower Scenario (FICO, LTV, DSCR, state, prop type, etc.)
        ↓
[eligibility.js]  ← filters out programs the scenario can't qualify for
        ↓
Eligible programs across all lenders
        ↓
[engine.js]  ← for each eligible program: base rate + LLPA stack
        ↓
Wholesale price at par for each program
        ↓
[comp injection from config/comp.json]  ← Rate Hero margin baked in
        ↓
Borrower-facing par price for each program
        ↓
[tier-builder.js]  ← generates Cold/Warm/Hot from each program's rate ladder
        ↓
[best-execution.js]  ← picks winning lender/program per tier
        ↓
Three cards displayed to borrower. Audit log captures everything.
```

## What I'm doing this week

**Day 2 — finish the JSON**
Open the Cake rate sheet to page 11. Fill every value in `lenders/cake/pound-cake-dscr.json` against the PDF. Don't trust the placeholder values — verify each one. Look up Cake's NMLS on consumeraccess.org and add it.

**Day 3 — engine.js**
Write the LLPA stacker. Validate against 10 hand-calculated scenarios from the rate sheet.

**Day 4 — tier-builder + bare UI**
Generate Cold/Warm/Hot from the rate ladder. Single HTML page with form on left, three cards on right. Deploy to Cloudflare Pages on a private URL.

## Compliance ground rules (do not violate)

1. **No lender names appear in borrower-facing UI.** Not "Cake," not "Pound Cake DSCR," not anything. Borrower sees "Rate Hero pricing" only.
2. **The audit log captures everything.** Every priced scenario, every winning lender, every comp injection — written to KV with timestamp.
3. **State licensing gate runs first.** If Rate Hero isn't licensed in the borrower's state, the engine returns ineligible before any pricing logic runs.
4. **Comp never exceeds 275 bps.** Hard federal ceiling. Engine clamps and flags.
5. **The borrower's selection is logged.** When they click a tier card, that selection is captured. Their choice, not Rate Hero's recommendation.

## NMLS

Rate Hero, Inc. — Corp NMLS #2822806
Sean Davoodian — Individual NMLS #1252107
