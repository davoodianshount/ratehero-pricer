# Rate Hero Engine (RHE) — Claude Code Instructions

## Project context

**Rate Hero Engine** (internal code: RHE) is a multi-lender DSCR scenario builder for goratehero.com/rates. Borrower-facing 3-card UI (**Lightning / Thunder / Bolt**) with comp baked in and lender names hidden. Static HTML/JS deployed via Cloudflare Pages.

## v1 lender lineup

| # | Lender | Program | NMLS | Rate Sheet Sender | Status |
|---|---|---|---|---|---|
| 1 | Cake Mortgage Corp | Pound Cake DSCR | 1734623 | Lockdesk@cakehome.com | ✅ verified v6 |
| 2 | AmWest Funding Corp | Investor Advantage (page 9) | 167441 | donotreply@amwestfunding.com | pending |
| 3 | LoanStream Mortgage | DSCR Calculator (Core ≥1.20) | 129932 ✅ | TBD (Sean to provide) | pending |
| 4 | Change Lending LLC | Investor DSCR (page 4) | 1839 ✅ | TBD (Sean to provide) | pending |
| 5 | Emporium | TBD — rate sheet pending | 2278548 | TBD | rate sheet pending |

LoanStream and Change NMLS IDs verified by Sean — both legitimately have low IDs because they are older companies.

## Cake's program-level details that affect engine behavior

**Pound Cake DSCR specifically:**
- Max cashout LTV is 75 (rate sheet shows NA at 75-80 column for cash_out_refi)
- Max purchase / R&T LTV is 85 (rate sheet supports up to 85 for 720+ FICO)
- This is program-specific. Other Cake DSCR programs (Cheese Cake, Coffee Cake, etc.) have different LTV caps. When those programs are added, each gets its own JSON with its own caps.

## State-by-state prepay rules

**Blanket no-prepay states (per Cake rate sheet):**
AK, DE, KS, MD, MI, NJ, NH, NM, RI, VT

**Conditional prepay (allowed above loan amount threshold):**
- **OH**: PPP allowed above $112,000 loan amount

This is encoded in the JSON as `states_prepay_allowed_above_loan_amount`. Engine logic:
- If state is in `states_no_prepay_allowed` → reject prepay regardless of loan amount
- If state is in `states_prepay_allowed_above_loan_amount` AND loan_amount > threshold → allow prepay
- If state is in `states_prepay_allowed_above_loan_amount` AND loan_amount ≤ threshold → reject prepay (treat as no-prepay state)

**To-do for Sean:** Confirm whether other "no prepay" states (NJ, MD, etc.) have similar loan-amount conditional rules. Default behavior is the safer interpretation (reject) if not specified.

## State licensing matrix (Rate Hero, Inc. NMLS #2822806)

**Currently EXCLUDED from pricer:**
AZ, CA, ID, MN, NV, ND, OR, UT, VT

**Licensing in progress:**
- CA — estimated August 2026
- Long-term plan: get fully licensed in all yes-license states for owner-occupied conventional/non-QM business

**No license needed (already eligible):**
TX, FL, IN, GA, NC, OH, AL, AK, AR, CO, CT, DE, DC, HI, IL, IA, KS, KY, LA, ME, MD, MA, MI, MS, MO, MT, NE, NH, NJ, NM, NY (with conditions), OK, PA, RI (≥$25K), SC, SD, TN, VA, WA, WV, WI, WY

## Architecture rules

- Lender data lives in `/lenders/{lender_id}/{program_id}.json`
- All comp logic reads from `/config/comp.json`
- All borrower-facing copy lives in `/copy.md`
- Engine is pure functions — no side effects, no API calls, no state
- Audit log is the only side effect, written via a separate writer module
- No lender names appear in UI-facing strings
- Pricing convention varies by lender (`pricing_convention` field) — engine normalizes internally
- Conditional eligibility rules (like OH prepay >$112K) are encoded in JSON, evaluated by engine

## Compliance rules

1. Federal max comp = 275 bps. Engine clamps and flags. Never exceeds.
2. State licensing gate runs first in eligibility filtering.
3. Every priced scenario logs to audit trail before the response renders.
4. Max price caps vary by lender — engine reads from each program's JSON.
5. Borrower-facing displays no lender names. Backend audit log captures everything.
6. Disclosures: minimal. See `/copy.md` for approved language.

## Tier naming (LOCKED)

**Internal tier logic → Borrower-facing labels:**
- Lowest cost upfront (highest rate, most lender credit) → **Bolt**
- Balanced (closest to par price) → **Thunder**
- Lowest rate (most points to buy down) → **Lightning**

## Homepage placement (LOCKED — Sean approved 2026-04-28)

**Position:** Second screen, directly below hero, above trust stats.

**Section structure:**
- Full-width horizontal strip
- Eyebrow: "INSTANT PRICING"
- Headline: "Build Your Deal. Choose Your Rate."
- Sub: "Instantly structure your loan using rental income — the property qualifies itself."
- Three benefit bullets:
  - ⚡ No phone calls required
  - ⚡ Real rates from real lenders
  - ⚡ See pricing in under 60 seconds
- Primary CTA button: "Build Your Deal →" (links to /rates)
- Right column (desktop only): static or animated mockup of the 3 tier cards

**Mobile treatment:**
- Stack vertically — eyebrow, headline, one sub-line, CTA button only
- Skip the bullet list and right-column mockup
- Sticky "Build Your Deal" CTA in bottom mobile nav across all pages

**Navigation update:**
- Add "Rates" to top nav between "Loan Programs" and the next item
- Bold weight, gold underline on hover
- This becomes primary navigational driver for repeat visitors

**Why this placement:**
1. Above-the-fold for hero pitch (what Rate Hero is); second-screen for differentiator (what makes it unique)
2. Curiosity-to-action gap is short
3. SEO juice — dedicated section above fold helps time-on-page and bounce rate

## Scenario Builder UX rules

See `/copy.md` for full UX copy specification.

Key constraints:
- 8 form fields, no more
- Property Use field is locked to "Investment Property" in v1
- State auto-detected via geolocation OR shown as dropdown (only licensed states)
- 3 tier cards stack vertically on mobile, side-by-side on desktop
- Sticky "Talk to a Loan Strategist" CTA on mobile after results render
- "Talk to LO" form submits via Web3Forms → Google Sheet → routes to Benji for callback (1 business day SLA)

## What you should not do

- Do NOT modify any `/lenders/*.json` files. Sean hand-builds and verifies those.
- Do NOT modify `/config/comp.json`. Comp changes require git commit + approval workflow.
- Do NOT modify `/copy.md` without Sean's approval.
- Do NOT add new dependencies without asking. Vanilla JS only for UI.
- Do NOT write to localStorage or sessionStorage in artifacts.
- Do NOT use OCR or AI to fill in lender JSON values.
- Do NOT add disclosures or "shopping" language beyond `/copy.md`.
- Do NOT rename the tier labels (Lightning / Thunder / Bolt). Brand-locked.
- Do NOT change homepage placement spec without Sean's approval.

## Testing

```bash
node tests/cake-dscr-scenarios.js
```

9 test scenarios (5 synthetic + 4 from Sean's real book). All must pass.

## Project status

✅ `lenders/cake/pound-cake-dscr.json` — v6
✅ `config/comp.json`
✅ `engine/engine.js`
⚠️ `tests/cake-dscr-scenarios.js` — needs engine update for OH conditional prepay before scenario 9 will pass
✅ `copy.md`
✅ `CLAUDE.md` — this file
✅ `README.md`

## Known engine work needed

The engine's `checkEligibility` function needs to be updated to handle the new conditional prepay rule:

```javascript
// In checkEligibility, replace the existing state prepay check with:
if (scenario.prepay_term && scenario.prepay_term !== "no_prepay") {
  const isBlanketNoPrepay = rules.states_no_prepay_allowed.includes(scenario.state);
  const conditionalRule = rules.states_prepay_allowed_above_loan_amount?.[scenario.state];
  
  if (isBlanketNoPrepay) {
    return { eligible: false, reason: `Prepay penalties not allowed in ${scenario.state}` };
  }
  
  if (conditionalRule && scenario.loan_amount <= conditionalRule) {
    return { eligible: false, reason: `Prepay penalties in ${scenario.state} require loan amount above $${conditionalRule.toLocaleString()}` };
  }
  
  if (rules.states_no_prepay_for_individual_vesting.includes(scenario.state) && scenario.entity_type === "individual") {
    return { eligible: false, reason: `Prepay penalties not allowed for individual vesting in ${scenario.state}` };
  }
}
```

Sean: This update should happen during the next session when you can run tests. The current engine.js will incorrectly reject scenario 9 (740/85/OH/$135K/5yr PPP) until this update is made.

## Sean's working style

- Prefers verified, tested code over theoretical architecture
- Wants to see results and validate before scaling
- Engineers under-promise, over-deliver mindset
- Pushes back on AI when things look wrong — keep your work checkable

## NMLS

- Rate Hero, Inc. — Corp NMLS #2822806
- Sean Davoodian — Individual NMLS #1252107
