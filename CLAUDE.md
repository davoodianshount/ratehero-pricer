# Rate Hero Engine (RHE) — Claude Code Instructions

## Project context

**Rate Hero Engine** (internal code: RHE) is a multi-lender DSCR scenario builder for goratehero.com/rates. Borrower-facing 3-card UI (Cold/Warm/Hot tiers) with comp baked in and lender names hidden. Static HTML/JS deployed via Cloudflare Pages.

## v1 lender lineup

| # | Lender | Program | NMLS | Status |
|---|---|---|---|---|
| 1 | Cake Mortgage Corp | Pound Cake DSCR | 1734623 | ✅ verified v4 |
| 2 | AmWest Funding | Investor Advantage (page 9) | TBD | pending |
| 3 | LoanStream | DSCR Calculator (Core ≥1.20) | TBD | pending |
| 4 | Change Wholesale | Investor DSCR (page 4) | TBD | pending |
| 5 | Emporium | TBD | TBD | rate sheet pending from Sean |

## State licensing matrix (Rate Hero, Inc. NMLS #2822806)

**Currently EXCLUDED from pricer (Rate Hero needs license to broker BPL here):**
- AZ (commercial license required for 5-10 unit; SFR/2-4 unit may be OK)
- CA (license required if originating > 5 BPL/year — currently throttling)
- ID, MN, NV, ND, OR, UT, VT

**Pending approval — re-enable when license confirmed:**
- CA — estimated August 2026 (~4 months out)

**No license needed (already eligible — DON'T add to exclusion list):**
- TX, FL, IN, GA, NC, OH, AL, AK, AR, CO, CT, DE, DC, HI, IL, IA, KS, KY, LA, ME, MD, MA, MI, MS, MO, MT, NE, NH, NJ, NM, NY (with conditions), OK, PA, RI (≥$25K), SC, SD, TN, VA, WA, WV, WI, WY

## Architecture rules

- Lender data lives in `/lenders/{lender_id}/{program_id}.json`
- All comp logic reads from `/config/comp.json` — no hardcoded comp anywhere
- Engine is pure functions — no side effects, no API calls, no state
- Audit log is the only side effect, written via a separate writer module
- No lender names appear in UI-facing strings — borrowers never see "Cake" or "Change"
- Pricing convention varies by lender (`pricing_convention` field) — engine normalizes internally

## Compliance rules

1. **Federal max comp = 275 bps.** Engine clamps and flags. Never exceeds.
2. **State licensing gate runs first** in eligibility filtering. Engine checks `states_excluded_for_program` before any pricing.
3. **Every priced scenario logs to audit trail** before the response renders.
4. **Max price caps** vary by lender — engine reads from each program's JSON.
5. **Borrower-facing displays no lender names.** Backend audit log captures everything.
6. **No "we shop loans" disclosure on pricer.** A scenario builder is not a credit application — disclosures belong on a 1003, not a rate calculator.

## Scenario Builder UX rules

- 3 tier cards (Cold / Warm / Hot) — borrower picks one or proceeds with all info
- Below cards: "Notes / Additional Context" textarea + "Talk to a Loan Officer" CTA
- CTA submits via Web3Forms → Google Sheet → routes to Benji for callback
- No lender names visible
- Disclosures: minimal. Just "For business-purpose loans on investment property only" + "Rates subject to change" + "Final terms determined at underwriting"

## What you should not do

- Do NOT modify any `/lenders/*.json` files. Sean hand-builds and verifies those.
- Do NOT modify `/config/comp.json`. Comp changes require git commit + approval workflow.
- Do NOT add new dependencies without asking. Vanilla JS only for UI.
- Do NOT write to localStorage or sessionStorage in artifacts.
- Do NOT use OCR or AI to fill in lender JSON values. Sean verifies these manually.
- Do NOT add disclosures or "shopping" language to the pricer UI.

## Testing

Every change to `/engine/*` must pass `/tests/cake-dscr-scenarios.js`.
Run tests after every code change. Report any regressions.

```bash
node tests/cake-dscr-scenarios.js
```

## Project status

✅ `lenders/cake/pound-cake-dscr.json` — v4, fully verified, NMLS filled, state exclusions added
✅ `config/comp.json` — comp config schema set
✅ `engine/engine.js` — engine v1 written
✅ `tests/cake-dscr-scenarios.js` — 5 test scenarios

⏭️ Next steps:
1. Run test harness, debug any failures
2. Add AmWest Investor Advantage (rate sheet page 9 of AmWest)
3. Add LoanStream DSCR (Core ≥1.20 tier)
4. Add Change Investor DSCR (rate sheet page 4)
5. Build best-execution.js (multi-lender winner picker)
6. Build minimal HTML UI (form left, three cards right)
7. Build audit log writer (Cloudflare Workers KV)
8. Deploy to goratehero.com/rates

## Sean's working style

- Prefers verified, tested code over theoretical architecture
- Wants to see results and validate before scaling
- Engineers under-promise, over-deliver mindset
- Pushes back on AI when things look wrong — keep your work checkable

## NMLS

- Rate Hero, Inc. — Corp NMLS #2822806
- Sean Davoodian — Individual NMLS #1252107
