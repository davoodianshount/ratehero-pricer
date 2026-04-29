# Rate Hero Engine — Claude Code Operating Manual

**This file is read by Claude Code at the start of every session.** Treat it as authoritative on conventions, gotchas, and what "done" means. When in doubt, follow it literally; when it conflicts with anything you remember from training, this file wins.

Last updated: 2026-04-29 (after shipping 4 lenders, sign-flip convention discovery, cap-direction bug fix).

---

## What this project is

Rate Hero Engine (RHE) is a multi-lender DSCR pricing engine for `goratehero.com/rates`. Static HTML/JS deployed via Cloudflare Pages. Borrower-facing 3-card UI with comp baked in. Lender names hidden in UI; visible in lead emails and audit logs.

**Owner:** Sean Davoodian (Rate Hero, Inc. NMLS #2822806; individual NMLS #1252107).

**Primary domain expert is Sean.** Defer to him on mortgage pricing intuition. He has caught multiple subtle pricing bugs that test suites missed.

---

## V1 SCOPE LOCK — read this before writing any code

The pricer is intentionally narrow in v1. Anything in this list is **out of scope** until Sean explicitly opens it:

**Loan products IN scope:**
- ✅ DSCR (investor / non-owner-occupied)
- ✅ 30-year fixed amortizing only
- ✅ Standard escrow (taxes + insurance impounded)
- ✅ Standard PPP terms (no prepay / 1yr / 2yr / 3yr / 4yr / 5yr)

**Loan products OUT of scope (do NOT build, do NOT price, do NOT add to JSON):**
- ❌ Interest-only loans of any kind
- ❌ Step-payment loans
- ❌ ARM products (5/6 SOFR, 7/6 SOFR, 10/6 SOFR — all variants)
- ❌ 15-year, 20-year, 25-year, 40-year amortization
- ❌ Escrow-waived loans
- ❌ Bank Statement / P&L / Asset Depletion / Asset Utilization / VOE / 1099 / Full Doc programs
- ❌ Owner-occupied or 2nd home occupancy
- ❌ Closed-end seconds, HELOCs, stand-alone seconds
- ❌ Community Mortgage / Liquid 360 / NonQM Prime / NonQM Express / any non-DSCR investor program
- ❌ Alternative PPP structures like "5% Fixed PPP" — only standard step-down PPP is in scope
- ❌ Buy-up / buy-down options (rate sheets sometimes publish "2:1 Buy-Up" — ignore)
- ❌ Lock periods other than 30-day (45-day and 60-day extensions exist; ignore them)
- ❌ Owner-Occupied DSCR programs (some lenders publish OO DSCR — ignore, we are investor-only)

**Borrower types IN scope:**
- ✅ US Citizens
- ✅ Permanent Resident Aliens
- ✅ ITIN borrowers (only when the lender supports them and pricing is published)
- ✅ Foreign Nationals (only when the lender has a dedicated FN DSCR program with published pricing)

**LLPA sections you should encode in the JSON:**
- ✅ FICO/LTV grid (mandatory)
- ✅ DSCR ratio buckets (when the lender uses them)
- ✅ Loan amount / loan balance bands
- ✅ Loan purpose (Purchase, Rate-Term Refi, Cash-Out Refi)
- ✅ Property type (SFR, 2-unit, 3-4 unit, Condo Warrantable, Condo Non-Warrantable, FL Condo overlay, Short Term Rental)
- ✅ Prepay penalty per term (no prepay through 5-year)
- ✅ State tier overlays (when published)
- ✅ Foreign National / ITIN overlays (when the lender bundles them under one DSCR program)
- ✅ Max price caps per PPP term
- ✅ State licensing exclusions

**LLPA sections you should NOT encode in the JSON (even if they appear on the rate sheet):**
- ❌ Interest-only LLPAs
- ❌ Step-payment LLPAs
- ❌ ARM-specific LLPAs (5/6, 7/6, 10/6 columns)
- ❌ Escrow waiver LLPAs
- ❌ Lock-term LLPAs (45-day, 60-day extension fees)
- ❌ Income doc type LLPAs (Bank Statement, Asset Depletion, P&L, etc.)
- ❌ DTI LLPAs (DSCR loans don't use DTI)
- ❌ Buy-up / buy-down LLPAs
- ❌ Credit event LLPAs (FC/SS/DIL/BK7) and payment history LLPAs (1x30x12, etc.) — Phase 1B only, do not include in initial program build
- ❌ Subordinate financing LLPAs — Phase 1B only

**Rate ladder filtering:** When a rate sheet publishes columns for 5/6 SOFR ARM, 10/6 SOFR ARM, AND Fixed 30 YR, build the JSON's `base_rate_table` from the **Fixed 30 YR column ONLY**. Ignore the ARM columns entirely.

**Rate filtering by sub-rates:** When a rate sheet publishes "5.999%" or "6.499%" (the .999 trick that some lenders use to mean an extra eighth), include those in the rate ladder as published. They are real pricing tiers.

**Eligibility filtering:** When a JSON's `eligibility_rules` is built, set:
- `interest_only_allowed: false`
- `arm_allowed: false`
- `occupancy_allowed: ["non_owner_occupied"]`

regardless of what the lender's rate sheet might allow. Even if the rate sheet has IO pricing or 5/6 ARM pricing, we don't price it. The engine will reject scenarios that ask for these.

**Phase 1B is a separate effort.** Do not add Phase 1B sections (subord financing, ITIN-specific overlays, escrow waiver, payment history, credit events, etc.) when building a NEW program. Stick to Phase 1A scope. Phase 1B work is additive and explicitly scoped by Sean.

**If a rate sheet has multiple programs and you're not sure which are in scope:** A program is in scope only if it's a DSCR program for non-owner-occupied investment property with published 30-year fixed pricing. Anything else (Alt-Doc Prime, Alt-Doc Express, Community Mortgage, Liquid 360, Closed-End Seconds, Foreign National with no DSCR component, etc.) is OUT of scope. When in doubt, ask Sean before building.

---

## Current state (live in repo, four lenders pricing)

| # | Lender | Program JSON | Status | Verified Sections |
|---|---|---|---|---|
| 1 | Cake Mortgage | `lenders/cake/pound-cake-dscr.json` | ✅ fully verified | 11 LLPA sections, 340 cells hand-checked |
| 2 | AmWest Funding | `lenders/amwest/amwest-investor-advantage-dscr.json` | ✅ verified (AE confirmation pending on max prices) | 12 LLPA sections |
| 3 | LoanStream Mortgage | `lenders/loanstream/loanstream-core-dscr.json` | ⚠️ Phase 1A only | 5 sections (13 in Phase 1B backlog) |
| 4 | Change Lending | `lenders/change/change-investor-dscr.json` | ⚠️ Phase 1A only | 7 sections (6 in Phase 1B backlog) |
| 5 | Emporium | (not built) | ⏳ rate sheet pending | — |

Tests passing as of last commit: 10 Cake + 5 multi-lender best-execution + 2 hand-verifies = 17/17.

---

## The two pricing conventions you must understand

This is the #1 source of bugs on this project. Read carefully.

**Cake and AmWest** use **DP convention**: positive value = cost to borrower, negative = rebate. JSON values are stored exactly as the engine wants them.

**LoanStream and Change** use **standard wholesale price convention** on their rate sheets: price > 100 = lender rebate, price < 100 = borrower cost; LLPAs are added to the base price with positive = improvement = good for borrower.

When building a new program from a rate sheet:

1. **First thing you do** is identify the convention. Check the base rate ladder: at the LOWEST rate, is the wholesale price BELOW 100 (standard wholesale convention) or POSITIVE (DP convention)? At the HIGHEST rate, is the price ABOVE 100 or NEGATIVE? That tells you which family.
2. If the rate sheet uses standard wholesale convention, the build script must apply a **mechanical sign-flip**: `our_base = 100 - rate_sheet_price`, and every LLPA value gets negated. `"NA"` stays `"NA"`.
3. **Always document the convention conversion in the JSON's `_pricing_convention_note` field** so future readers know what was done.
4. **Hand-verification is mandatory** for any new program in this family. Sign-flip errors look correct in the test suite but produce backwards prices. The only way to catch them is to hand-calculate one scenario against the rate sheet PDF.

---

## Build pattern (use this for every new program)

The repo has an established pattern. Do not invent new structures.

**Step 1: Drop the rate sheet PDF in `rate-sheets/{lender}/`** (create the subfolder if needed).

**Step 2: Write a build script in `source-builds/build-{lender}-{program}.py`.** Mirror the structure of `source-builds/build-loanstream-core-dscr.py` or `source-builds/build-change-investor-dscr.py`. The script encodes raw rate-sheet values as Python data, applies the sign-flip transform if needed, and writes the JSON. The build script IS the source of truth — anyone can re-run it to regenerate the JSON.

**Step 3: The JSON it outputs must include these top-level fields:**

```
_README, lender_id, lender_display_name, lender_nmls, program_id,
program_display_name_internal, program_category, rate_sheet_source_page,
rate_sheet_date, rate_sheet_filename_when_imported, schema_version,
verification_status, _pricing_convention_note, pricing_convention,
products_offered, eligibility_rules, base_rate_table,
fico_ltv_adjustments, additional_llpas, max_price_caps
```

**Step 4: Write a hand-verify test in `tests/{lender}-handverify.js`.** Mirror `tests/loanstream-handverify.js` or `tests/change-handverify.js`. Pick a clean mid-ladder scenario, walk through every LLPA component, compare cell-by-cell to the rate sheet PDF. Test must end with `Match: ✅ PASS`. **Do not commit a new program if its hand-verify fails or is skipped.**

**Step 5: Run the full regression suite.** All of these must pass:

```
node tests/cake-dscr-scenarios.js
node tests/best-execution-scenarios.js
node tests/loanstream-handverify.js
node tests/change-handverify.js
node tests/{new}-handverify.js
```

**Step 6: Commit and push.** Commit message format: `Add {Lender} {Program} — Phase 1A` or `Add {Lender} {Program} — Phase 1B (loan_amount, property_type)`.

---

## Engine convention reference

The engine (`engine/engine.js`) is pure-functional. It autodetects FICO/LTV/DSCR band schemes per program. When adding a new program, you generally do NOT modify the engine. Modify it ONLY if the new program uses an LLPA structure that's not yet supported. Examples that have required engine patches in past sessions:

- **Per-LTV prepay LLPAs** (LoanStream/Change pattern; `prepay_penalty_llpa.{term}` is a per-LTV grid instead of `{all_ltvs: value}`). Engine falls back to LTV lookup when `all_ltvs` is missing.
- **`program_overlay`** (LoanStream — flat per-LTV LLPA tied to program variant).
- **`loan_purpose_fico_lt_680_overlay`** (LoanStream — additional refi LLPA when FICO < 680).
- **`state_tier_overlay`** (LoanStream — 3-tier state grouping).
- **STR overlay** (Change — `additional_llpas.property_type.short_term_rental` stacks on top of base property_type when `scenario.is_str` is true).
- **Lender-specific DSCR bucket naming** (`getDscrBand` is hardcoded per `lender_id`).

When you add a new pattern, **add a new branch to the engine, do not modify existing branches.** The engine has defensive guards on every section so missing sections are silently skipped, never crash.

---

## Naming conventions (these have caused real bugs)

**Prepay LLPA keys MUST use English form**, not numeric. The engine constructs the lookup key as `${scenario.prepay_term}_prepay`, where `prepay_term` is `one_year` / `two_year` / `three_year` / `four_year` / `five_year` / `no_prepay`. So the keys in `additional_llpas.prepay_penalty_llpa` must be:

```
no_prepay, one_year_prepay, two_year_prepay, three_year_prepay, four_year_prepay, five_year_prepay
```

NOT `1_year_prepay`, `2_year_prepay`, etc. (Past bug: LoanStream JSON had numeric keys, engine returned `undefined`, prepay LLPA was silently treated as 0, prices were off by ~$2,500 on a $400K loan. Test suite "passed" but pricing was wrong.)

**PPP cap keys USE numeric form** because they're looked up via the `PREPAY_TERM_TO_CAP_KEY` mapping table. Don't rename these.

**LTV bands** have two schemes:
- "Cake-style" 8 bands: `lte_50, 50_55, 55_60, 60_65, 65_70, 70_75, 75_80, 80_85`
- "AmWest-style" 6 bands: `lte_55, 55_60, 60_65, 65_70, 70_75, 75_80`

Engine autodetects via `program.fico_ltv_adjustments.ltv_bands` (presence of `lte_55` triggers AmWest path).

**FICO bands** also two schemes:
- "Cake-style": `760_plus, 740_759, 720_739, 700_719_no_score_fn, 680_699, ...`
- "AmWest-style": `780_plus, 760_779, 740_759, 720_739, 700_719, ...`

Engine autodetects via `program.fico_ltv_adjustments.fico_bands` (presence of `780_plus` triggers AmWest path).

---

## Cap-direction logic (caught a real bug here)

`max_price_caps.ppp_buydown_max_price_caps` are **floors on `final_price` in DP convention** (most-negative value allowed). The engine's `enforceMaxPriceCap` function takes the larger of `globalFloor` and `pppFloor` and applies it as `if (final < effFloor) final = effFloor`.

**Past bug:** The engine treated PPP caps as ceilings limiting cost instead of floors limiting rebate. Result: No PPP scenarios were forced into a $4K credit when the borrower should have owed $25K. Sean caught it by intuition ("5-year PPP shouldn't price worse than No PPP") long before the test suite did. The fix is now in place; do not re-introduce ceiling logic.

---

## Things requiring human review (do NOT commit autonomously)

If you encounter any of these while building a new program, **stop and surface them in the session output**. Don't guess.

1. **Sign convention ambiguity.** If the rate sheet uses unusual signs in any section (especially state-tier or jurisdiction overlays), flag it. Example: LoanStream's State Tier section has Tier 3 = +0.250, which could mean "+0.250 cost" or "+0.250 improvement." Wrong guess = systematic regional pricing error. The default conservative interpretation is "Tier 3 = more cost for borrower," but always flag for Sean to confirm with the lender's AE.
2. **Max price caps not explicitly published.** Some lenders publish per-PPP caps; some don't. If the rate sheet doesn't show a cap for a given PPP term, use the most conservative value from sibling programs and flag for AE confirmation.
3. **LLPA cells you can't read clearly** from the PDF (smudged, ambiguous columns, etc.). Surface as a question.
4. **Eligibility rules outside the rate sheet's published grid.** Examples: minimum FICO, maximum loan, foreign national handling, ITIN handling, vesting/entity rules. Default to the most restrictive interpretation if not published, and flag.
5. **Convention shifts mid-rate-sheet.** Rare but real. Some sheets use one sign convention for FICO/LTV and another for state overlays. If the data doesn't fit one consistent rule, stop and ask.

---

## State licensing (Rate Hero NMLS #2822806)

**Currently EXCLUDED:** AZ, CA, ID, MN, NV, ND, OR, UT, VT.
**CA pending** — estimated 2026-08.
**All other states** are licensed and eligible.

State-licensing exclusion runs FIRST in eligibility filtering, before any program-specific rules.

---

## State-by-state prepay rules

**Blanket no-prepay states** (no PPP allowed regardless of loan size): AK, DE, KS, MD, MI, NJ, NH, NM, RI, VT.

**Conditional prepay states:**
- **OH:** PPP allowed only when `loan_amount > $112,000`.

These are encoded per-lender in the JSON's `eligibility_rules` block. When building a new program, copy these state lists from an existing JSON unless the lender's rate sheet explicitly says otherwise.

---

## Compensation logic (do NOT modify without commit + approval)

Comp config lives in `config/comp.json`. Default is 200 bps LPC, with loan-size-based overrides. Federal max comp is 275 bps — the engine enforces this as a hard ceiling and the JSON config must never publish a value above it.

The engine reads comp at the time of pricing and adds it to the wholesale price to produce the borrower-facing price. Lender-specific comp overrides exist in `compensation_by_lender` but are NOT currently read by the engine (TODO).

---

## What you should NOT do

- Do NOT modify `lenders/*.json` files manually. Edit the corresponding `source-builds/build-*.py` script and re-run it.
- Do NOT modify `config/comp.json` without an explicit Sean-approved task.
- Do NOT modify `copy.md` without an explicit Sean-approved task.
- Do NOT add new dependencies. Vanilla JS only for UI; standard library only for Python build scripts.
- Do NOT use OCR/AI to fill in lender JSON values. Build scripts must be hand-encoded against the rate sheet PDF.
- Do NOT add disclosures or borrower-facing language beyond what's in `copy.md`.
- Do NOT rename tier labels (Lightning/Thunder/Bolt — brand-locked).
- Do NOT show lender names in any borrower-facing UI string. Lender names appear in lead emails and audit logs only.
- Do NOT commit a new program without a passing hand-verify test.
- Do NOT use `localStorage` or `sessionStorage` in the UI (Cloudflare Pages restriction).

---

## Tier naming (LOCKED)

| Internal logic | Borrower label |
|---|---|
| Lowest rate, most points to buy down | **Lightning** |
| Balanced (closest to par price) | **Thunder** |
| Lowest cost upfront, highest rate, most lender credit | **Bolt** |

---

## Lead delivery (form payload)

The strategist form on `/rates` posts to Web3Forms with field names matching the existing site CTA schema (so leads land in the same Google Sheet columns A-O and Benji imports them like any other CTA lead). All pricer-specific data (FICO, exact LTV, exact DSCR, prepay term, selected tier, selected lender) is packed into the `scenario_summary` field which lands in column O.

When a borrower clicks Lightning/Thunder/Bolt cards, the chosen tier and matching lender (cake/amwest/loanstream/change) are captured in both the email subject (`[Lightning / amwest]`) and the scenario summary block.

If you modify form payload logic, update both `ui/app.js` and `tests/payload-preview.js` to keep the preview script accurate.

---

## How to ask Sean a question mid-session

If you encounter ambiguity that requires human judgment (sign convention, missing rate sheet section, conflicting eligibility rules), don't guess. End your turn with a clearly-formatted "BLOCKED — needs human review" output that lists exactly:

1. What you were building
2. The specific ambiguity
3. The two or three reasonable interpretations
4. Your recommended default and why
5. What needs to be confirmed externally (e.g., "AE call to confirm Tier 3 sign convention")

Sean will read this when he checks in and unblock you.

---

## Additional safeguards (read carefully)

These are protections against the failure modes that have actually cost time or money on this project, or are predictable failure modes that haven't bitten yet.

### Hand-verify must include a sanity check, not just a decimal match

A hand-verify test that says "engine wholesale matches expected to 4 decimals" is necessary but not sufficient. The dollar amount must be plausible.

**Plausibility rules** (apply to every hand-verify scenario):
- A 30-year fixed DSCR loan at a rate **between 5.5% and 7.5%** at typical FICO/LTV on a $400K loan should produce a borrower-facing closing cost or credit **between -$15,000 (credit) and +$25,000 (cost)** in most cases. Numbers outside this range are SUSPICIOUS, not necessarily wrong, but they require an extra written sanity-check note in the test output explaining why the number is large.
- **A rate at the bottom of the ladder** (e.g., 5.750%–5.875%) should produce a positive cost (borrower pays points) for a normal scenario. If it shows a credit, sign-flip is wrong.
- **A rate at the top of the ladder** (e.g., 9.5%–10.625%) should produce a credit (lender pays borrower) for a normal scenario. If it shows a cost, sign-flip is wrong OR cap logic is wrong.
- **5-year PPP** should never price WORSE than No PPP. If it does, prepay LLPA or cap-direction logic is wrong (this exact bug shipped once and cost real time).
- **Higher FICO at same LTV** should never cost MORE than lower FICO. If a 740 FICO scenario shows worse pricing than 660 FICO, FICO/LTV grid is wrong.

If a hand-verify test produces a number outside the sanity ranges, **stop and surface it before committing**, even if the decimal-level math reconciles. Surface output should include: "Math reconciles to rate sheet, but dollar amount feels [unusually large / unusually small / wrong sign]; needs Sean review."

### Rate sheet cell mapping rules

LLPA cells on rate sheets show up as several different values. Map them all to JSON values consistently:

| Rate sheet cell | JSON value |
|---|---|
| Empty / blank | `"NA"` |
| `"—"` (em-dash) or `"-"` (hyphen) | `"NA"` |
| `"#N/A"` or `"N/A"` | `"NA"` |
| `"Ineligible"` | `"NA"` |
| `"Not eligible"` | `"NA"` |
| `"Not available"` | `"NA"` |
| `0.000` or `0` (an actual zero number) | `0` |
| Any number in parentheses, e.g. `(0.625)` | negative number, e.g. `-0.625` (parens denote negative in financial documents) |

**Critical:** Never confuse a blank cell with a zero. Blank means "not eligible at this combination" (return NA, reject). Zero means "eligible, but no LLPA adjustment" (proceed with no add). This distinction has caused real bugs in this industry.

### All required sections must be present, or surfaced

Every new DSCR program JSON must include all of the following sections from the rate sheet. If a section appears not to exist on the rate sheet you're reading, **stop and surface it** rather than skipping silently:

**Required sections (must be present, or explicitly absent-and-noted):**
- `base_rate_table` (30-year fixed column)
- `fico_ltv_adjustments.grid`
- `additional_llpas.loan_purpose` (Purchase / Cash-Out Refi / Rate-Term Refi)
- `additional_llpas.prepay_penalty_llpa` (no_prepay through five_year_prepay)
- `eligibility_rules` (state exclusions, FICO/loan/DSCR floors, max LTV per purpose)
- `max_price_caps.ppp_buydown_max_price_caps`

**Recommended sections (include if rate sheet has them):**
- `additional_llpas.dscr_ratio` (DSCR buckets if used)
- `additional_llpas.loan_amount` (loan size LLPAs)
- `additional_llpas.property_type` (SFR baseline + condo/multi-unit overlays)
- State-specific overlays (FL Condo, NY, etc.)

If the rate sheet has a section you can't easily encode (unfamiliar pattern, ambiguous columns), surface it. Do not skip. Skipping a section silently is the third-most-common bug after sign-flip and cell-mapping.

### Engine code is patched, not refactored

The engine (`engine/engine.js`) is intentionally written in a specific style: pure functions, defensive guards, autodetection of band schemes, no classes, no async, no inheritance. Patches must follow this style.

**Allowed engine changes:**
- Adding a new branch for an LLPA pattern that doesn't exist yet
- Adding a new `lender_id` case to `getDscrBand`
- Adding defensive guards on a section that didn't have them
- Fixing a bug in an existing branch (with hand-verify proof of the fix)

**Prohibited engine changes:**
- Refactoring to classes, modules, or async patterns
- "DRYing up" the LLPA stacking sequence
- Reordering existing branches
- Changing function signatures of any exported function
- Switching the comp injection path
- Adding new dependencies

If you think the engine needs a structural change, surface it as a proposal — do not implement it.

### Defensive guards exist for backward-compat, not as an excuse to skip work

The engine silently skips missing LLPA sections. That's intentional — older JSONs from earlier in this project may not have every newer pattern, and the engine should price them anyway with whatever they do have.

This **does NOT mean** new programs can omit sections. Defensive guards protect old code; new code must be complete. If you build a new program and skip a section, the engine won't crash, but the prices will be wrong by the magnitude of that section's LLPAs. Verify completeness explicitly.

### Cost control — stop and ask threshold

If you find yourself in any of the following situations, **stop and surface a status update instead of grinding:**

- A test has been failing for more than 3 consecutive fix-and-rerun attempts (you're guessing at the cause)
- You've made more than 15 file edits in a single task without committing
- You're about to modify a file outside the standard pattern (anything other than `lenders/`, `source-builds/`, `tests/`, `engine/engine.js`, `ui/app.js`)
- You're considering adding a new dependency, a new tool, a new test framework, or a new build process
- The hand-verify produces a number that violates the plausibility rules above
- You don't fully understand what a section of a rate sheet means

In all of these cases, the right move is to stop, write up where you are and what's stuck, and let Sean weigh in. A 5-minute pause to ask saves 30 minutes of API credits spent thrashing.

### Communication boundary — AE outreach is human-only

When the codebase has unresolved questions for a lender's Account Executive (max prices not published, sign convention ambiguity, eligibility rules unclear), **do not draft, suggest drafting, or simulate emails to lender AEs.** Do not guess at what an AE would say. Surface the question and let Sean handle the AE conversation.

### Don't build infrastructure speculatively

The codebase has references to features that are planned but not implemented (audit logging to Cloudflare KV, lender-specific comp overrides, Phase 1B sections, etc.). Do not implement these unless explicitly asked. Reference doesn't mean "should be built next." It means "Sean knows about this and will direct when to build it."

---

## Glossary (for fresh sessions)

| Term | Meaning |
|---|---|
| DSCR | Debt-Service Coverage Ratio. Loan qualifies on rental income vs PITIA, not borrower W2 income. |
| LLPA | Loan-Level Pricing Adjustment. Add or subtract from the base rate's wholesale price based on borrower/loan characteristics. |
| LTV | Loan-to-Value. Percentage of property value borrowed. |
| CLTV | Combined Loan-to-Value. LTV including any subordinate financing. Used by Change. |
| FICO | Credit score (typically the middle of 3 bureau scores). |
| PPP | Prepayment Penalty. Investor-loan feature where borrower pays a fee for paying off early. Pricing improves with longer PPP. |
| NMLS | Nationwide Multistate Licensing System. Every mortgage lender, broker, and LO has an NMLS number. |
| LPC | Lender-Paid Compensation. Lender pays the broker; brokerage fee is built into the rate. Default for this project. |
| BPC | Borrower-Paid Compensation. Borrower pays the broker directly at closing. Not currently used. |
| NOO | Non-Owner-Occupied. Investor property. |
| OO | Owner-Occupied. Borrower's primary residence. Out of scope for this project. |
| 2nd Home | Vacation/secondary home. Out of scope for this project. |
| ITIN | Individual Taxpayer Identification Number. Used by borrowers without SSN. |
| FN | Foreign National. Borrower without US residency. |
| STR | Short-Term Rental (Airbnb-style). Higher LLPAs on most rate sheets. |
| SFR | Single-Family Residence. |
| 2-4 Unit | Multi-unit residential property. |
| NW Condo | Non-Warrantable Condo. Higher LLPAs and lower max LTV. |
| FL Condo Overlay | Florida-specific additional LLPA on condo properties. |
| YSP | Yield Spread Premium. Old term for lender rebate. Modern equivalent is "lender credit." |
| Wholesale Price | Price the lender charges the broker, before broker comp. Above 100 = rebate, below 100 = cost (in standard convention). |
| DP Convention | Discount Points. Positive = cost to borrower, negative = rebate. The engine's internal convention. |
| Par | A wholesale price of exactly 100 = exactly the rate with no add-on cost or rebate. |
| Lock | Rate lock — commitment from lender to honor a rate for a fixed period (usually 30 days). |

---

## Sean's working style (read this carefully)

- Prefers verified, tested, deployable work over theoretical architecture.
- Pushes back when something looks economically wrong, even if tests pass. Trust his instincts on pricing.
- Wants concrete deliverables — diffs, test outputs, dollar examples — not summaries.
- Iterates fast. Will ask for the next thing as soon as the current thing ships.
- Hates wasted ceremony. If a step doesn't add value, skip it.
- Will catch sign-flip and cap-direction errors that test suites miss. Always run a hand-verify with a real dollar number ($credit/cost on a $400K loan) so he can sanity-check by feel.

---

## Work queue (in priority order)

1. **Change Foreign National DSCR** — page 5 of `rate-sheets/change/Change_rate_sheet.pdf`. Adds a separate program JSON (`lenders/change/change-fn-dscr.json`). FN borrower segment is currently served only by Cake/AmWest; adding Change/LoanStream coverage improves best-execution. **In scope: Change has a dedicated FN DSCR program with published 30-year fixed pricing.**
2. **LoanStream Phase 1B — loan_amount and property/units LLPAs.** These two sections affect every priced LoanStream scenario by 0.125–0.500 points. Highest-impact accuracy improvement. **STR is in scope (it's a property-type variant, not an income-doc variant).**
3. **LoanStream Core ≥1.00 program** — same rate sheet (page 2), different DSCR threshold and LTV cap. New JSON: `lenders/loanstream/loanstream-core-dscr-gte-1-00.json`.
4. **LoanStream Foreign National DSCR program** — if LoanStream has a dedicated FN DSCR program on their rate sheet (Sean to confirm — page 5 of his rate sheet may be a separate FN program). Different LTV caps, different LLPA structure.
5. **LoanStream Sub1 / No Ratio / Fusion programs** — same rate sheet, different DSCR thresholds. Lower priority because borrower segments are smaller. **All three are still DSCR — in scope.**
6. **Cake's other DSCR programs** — needs Cake rate sheet PDF re-uploaded to `rate-sheets/cake/`. Build only the DSCR ones; ignore any NonQM / Alt-Doc / Bank Statement / Asset Depletion programs. (Cake's rate sheet is large; many programs on it are out of scope per V1 SCOPE LOCK.)
7. **AmWest's other DSCR programs** — needs AmWest rate sheet re-uploaded. Same filter: DSCR only.
8. **Emporium** — pending rate sheet from lender. DSCR only.
9. **AmWest LPC max prices** — Sean to email AE; update JSON when confirmed.

**EXPLICITLY DEFERRED until Sean opens scope:**

- Interest-Only DSCR products (some lenders publish IO DSCR; we don't price it in v1)
- Escrow-Waived DSCR pricing
- ARM products (5/6, 7/6, 10/6 SOFR variants from any lender)
- 40-year amortization or 40-year IO amortization
- Lock-term variations beyond 30-day
- Buy-up / buy-down option pricing
- Credit-event LLPAs (FC/SS/DIL/BK7) — exists on most rate sheets; Phase 1B only
- Payment-history LLPAs (1x30x12, etc.) — Phase 1B only
- Subordinate financing LLPAs — Phase 1B only
- Bank Statement / P&L / 1099 / Asset Depletion / Asset Utilization / Full Doc programs (these are NonQM, not DSCR)
- Owner-occupied or 2nd home programs

If you encounter rate sheet sections covering any of the deferred items, **skip them silently** in the build script. Do not add them to JSON. Do not flag them as ambiguities. They are intentionally out of scope.

Always do items in this order unless Sean explicitly directs otherwise.

---

## First task for a fresh Claude Code session

If this is your first time on this codebase, do exactly this before anything else:

1. Read this file fully.
2. Read `source-builds/build-loanstream-core-dscr.py` and `source-builds/build-change-investor-dscr.py` end-to-end. They demonstrate the full build pattern.
3. Read `tests/loanstream-handverify.js` and `tests/change-handverify.js`. They demonstrate the verification pattern.
4. Run all four test files. Confirm 17/17 passing.
5. Pick item 1 from the work queue.
6. Surface any ambiguities before committing.
