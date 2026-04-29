# Claude Code Launch Prompts — Rate Hero Pricer

Paste these into Claude Code in order. Wait for each to finish before pasting the next. Don't skip Prompt 0; it's how you make sure Claude Code is reading your codebase the way you want it to.

---

## Setup (one time, before any of these)

1. In your repo root, create a folder: `rate-sheets/`
2. Inside it, create subfolders for each lender: `cake/`, `amwest/`, `loanstream/`, `change/`, `emporium/`
3. Drop the rate sheet PDFs into the matching folder. So far you have:
   - `rate-sheets/change/Change_rate_sheet.pdf` (8 pages, you uploaded this)
   - `rate-sheets/loanstream/loanstream_pricer.pdf` (3 pages)
   - You'll need to find and re-upload the Cake and AmWest rate sheets when you're ready for those
4. Open PowerShell in your repo root, run `claude` to start Claude Code

---

## Prompt 0 — Baseline check (DO THIS FIRST, every session)

```
Read CLAUDE.md fully. Then read source-builds/build-loanstream-core-dscr.py and source-builds/build-change-investor-dscr.py end-to-end. Then read tests/loanstream-handverify.js and tests/change-handverify.js. Confirm you understand:

1. The two pricing conventions (DP vs standard wholesale) and when each applies
2. The mandatory build pattern (rate sheet -> source-builds script -> JSON -> hand-verify test)
3. The naming conventions that have caused real bugs (English-form prepay keys, etc.)
4. The cap-direction logic
5. The "things requiring human review" list
6. V1 SCOPE LOCK — every item that is in scope vs out of scope
7. The Additional Safeguards section — especially:
   - Hand-verify plausibility rules (5-year PPP must price BETTER than No PPP, not worse; bottom of ladder = cost; top of ladder = credit)
   - Cell-mapping rules (blank/—/Ineligible/N/A all map to "NA"; parens denote negative)
   - Engine code is patched, not refactored (no classes, no async, no DRYing up)
   - Cost control stop-and-ask threshold (3 failed retries, 15 unsaved edits, etc.)
8. The glossary terms

Then run all four test files and confirm 17 of 17 are passing.

Report back what you understood, what passed, and what's the current state. Specifically state what you would do differently from a fresh GPT-style approach (e.g., "I would NOT refactor the engine to use classes," "I would NOT skip cells that show 'Ineligible' as zero," etc.). Do NOT start any new work yet.
```

Wait for the response. Read it carefully. If anything in the response shows misunderstanding of the conventions or safeguards, stop and clarify before going further. **This is the most important step.** A Claude Code session that misunderstands conventions will produce bugs that cost you real money on real borrowers.

---

## Prompt 1 — Trial build (close supervision)

When Prompt 0 looks good, run this:

```
Build Change Foreign National DSCR from page 5 of rate-sheets/change/Change_rate_sheet.pdf. This becomes a new program JSON: lenders/change/change-fn-dscr.json.

V1 SCOPE REMINDER: 30-year fixed amortizing only. Do NOT include Interest-Only LLPAs, ARM (5/6, 10/6) LLPAs, escrow-waiver LLPAs, lock-term LLPAs, credit-event LLPAs, payment-history LLPAs, or buy-up/buy-down LLPAs even if they appear on the rate sheet. See V1 SCOPE LOCK in CLAUDE.md for the full list.

Follow the build pattern in CLAUDE.md exactly. Mirror the structure of build-change-investor-dscr.py.

Sign-flip convention applies (same as the existing Change Investor DSCR program — standard wholesale convention).

DO NOT commit anything yet. When you're done:

1. Show me a diff of what you wrote
2. Show me the hand-verify test output with a real dollar number on a $400K test scenario
3. Flag every ambiguity you encountered (sign convention, missing data, eligibility rules not on the rate sheet)
4. Wait for my approval before committing
```

This is your trial run. Compare what it produces to what we built together for the original Change Investor DSCR. If it gets sign-flip right, encodes the rate sheet correctly, and surfaces real ambiguities (instead of guessing), you can trust it for batch work. If it commits silently or gets sign convention wrong, you've learned a lot about its limits before you let it run unsupervised.

Once you approve and Claude Code commits Prompt 1's work, pricer has 5 programs across 4 lenders.

---

## Prompt 2 — Constrained autonomy (medium supervision)

```
Build LoanStream Phase 1B — focus only on these two LLPA sections from page 2 of rate-sheets/loanstream/loanstream_pricer.pdf:

1. loan_amount band LLPAs (the 11 size bands)
2. property/units LLPAs (NOO, 2nd home, NW Condo, STR, 2-unit, 3-4 unit) — note 2nd home is out of scope, but NW Condo and STR are in scope

V1 SCOPE REMINDER: 30-year fixed amortizing only. Do NOT add Interest-Only, ARM, escrow-waiver, lock-term, credit-event, or payment-history LLPAs. See V1 SCOPE LOCK in CLAUDE.md.

Update the existing source-builds/build-loanstream-core-dscr.py script and re-run it to regenerate the JSON. Do NOT touch other sections.

Update tests/loanstream-handverify.js to verify these two new sections in addition to what it already verifies.

Run all tests. If anything fails, fix it. If everything passes, commit and push with message "LoanStream Core DSCR Phase 1B — loan_amount + property/units LLPAs". Surface any ambiguities you encountered after pushing.
```

This is partially autonomous — it commits and pushes if tests pass, but you're still scoping the work tightly. Phase 1B is the highest-impact accuracy improvement on LoanStream.

---

## Prompt 3 — Batch autonomy (light supervision)

After Prompt 2 lands cleanly, you can give it bigger scope:

```
Build the remaining LoanStream DSCR program variants from page 2 of rate-sheets/loanstream/loanstream_pricer.pdf:

1. Core DSCR (>=1.00) -> lenders/loanstream/loanstream-core-dscr-gte-1-00.json
2. Sub1 DSCR (0.75-0.99) -> lenders/loanstream/loanstream-sub1-dscr.json
3. No Ratio DSCR -> lenders/loanstream/loanstream-no-ratio-dscr.json
4. DSCR Fusion -> lenders/loanstream/loanstream-fusion-dscr.json

V1 SCOPE REMINDER: 30-year fixed amortizing only. Skip Interest-Only, ARM, escrow-waiver, lock-term, credit-event, payment-history, and buy-up LLPAs even if they appear on the rate sheet. See V1 SCOPE LOCK in CLAUDE.md.

Each gets:
- A build script in source-builds/
- A JSON in lenders/loanstream/
- A hand-verify test in tests/
- A passing test run

Sign-flip convention applies to all of them. The Program section LLPAs differ per variant; everything else (FICO/LTV grid, base rate ladder, prepay, state tiers) is shared with Core >=1.20.

Commit each program separately with a descriptive message. Surface ambiguities after each commit, not at the end.

If any variant has fundamental ambiguity (DSCR threshold for "No Ratio" not clear from rate sheet, etc.) skip that one and move to the next, then surface as a blocker at the end.
```

This is real autonomous work. You can leave the room. When you come back, you should have 4 new programs committed individually (so each is reviewable), with a list of any blockers Claude Code surfaced.

---

## Prompt 4 — When you upload Cake's rate sheet

Same shape as Prompt 3 but for Cake:

```
Read rate-sheets/cake/<filename>.pdf. Identify every DSCR program on it (we already have Pound Cake DSCR).

V1 SCOPE FILTER — only build programs that meet ALL of these criteria:
- DSCR program (qualifies on rental income, not borrower income docs)
- 30-year fixed amortizing
- Investor / non-owner-occupied
- Has published 30-year fixed pricing on the rate sheet

Do NOT build any of the following even if they appear on the rate sheet:
- Bank Statement, P&L, Asset Depletion, Asset Utilization, 1099, Full Doc, VOE programs (these are NonQM income-doc programs, not DSCR)
- Owner-Occupied DSCR variants
- 2nd Home DSCR variants
- Interest-Only DSCR variants
- ARM-only variants (5/6 SOFR, 7/6 SOFR, 10/6 SOFR)
- 40-year amortization variants
- Closed-End Seconds, HELOCs, Stand-Alone Seconds

For each in-scope program not yet in lenders/cake/, build it following the standard pattern:
- source-builds/build-cake-{program-id}.py
- lenders/cake/{program-id}.json
- tests/cake-{program-id}-handverify.js

Important: Cake uses DP convention (positive = cost), NOT sign-flipped. Confirm this matches what you see on the rate sheet (low rates have positive prices like +1.757, high rates have negative prices like -7.468). If it doesn't, stop and flag — that means Cake changed conventions or you're looking at a different program type.

Build only the rate ladder (30-year fixed column), FICO/LTV grid, DSCR ratio buckets, loan amount bands, loan purpose, property type, prepay penalty, and state-related sections. Skip everything else per V1 SCOPE LOCK.

For each new program, commit separately. Surface any sign-convention or LLPA-pattern surprises mid-session, not at the end.
```

---

## Prompt 5 — When you upload AmWest's rate sheet

Same shape:

```
Read rate-sheets/amwest/<filename>.pdf. Identify every DSCR program on it (we already have Investor Advantage DSCR).

V1 SCOPE FILTER — only build programs that meet ALL of these criteria:
- DSCR program (qualifies on rental income, not borrower income docs)
- 30-year fixed amortizing
- Investor / non-owner-occupied
- Has published 30-year fixed pricing on the rate sheet

Do NOT build NonQM Bank Statement / P&L / Asset Depletion / Full Doc / Asset Utilization programs. Do NOT build Owner-Occupied or 2nd Home variants. Do NOT build IO, ARM, or 40-year amortization variants. See V1 SCOPE LOCK in CLAUDE.md.

For each in-scope program not yet in lenders/amwest/, build it.

AmWest uses DP convention (positive = cost). Verify this on the rate sheet at the lowest rate (should show a positive number for the lender wholesale price in their convention).

AmWest uses 6-band LTV scheme (lte_55 through 75_80) and 9-band FICO scheme (780_plus through 620_639). The engine autodetects via the band names in fico_ltv_adjustments. Stay consistent with that.

Commit each program separately. Surface ambiguities after each commit.
```

---

## Things to watch for in Claude Code's responses

You're building trust progressively. Red flags to watch for:

- **Silent assumptions.** If it builds something without flagging the State Tier sign question, it's not following the "Things requiring human review" list. Pause and re-read CLAUDE.md with it.
- **Skipping hand-verify.** Tests passing isn't enough. Hand-verify with dollar-amount output is mandatory. If it commits without one, push back.
- **Modifying files it shouldn't.** It should NOT touch `lenders/*.json` directly, `config/comp.json`, or `copy.md`. If it does, ask why.
- **Inventing new structures.** It should follow `build-loanstream-core-dscr.py` and `build-change-investor-dscr.py` patterns. If it writes a fundamentally different build script, ask why.

Green flags:

- It runs tests proactively and reports the dollar amounts in hand-verify output
- It surfaces ambiguities with concrete options (Tier 3 could mean A or B; my recommended default is A; please confirm)
- It commits individual programs separately with descriptive messages
- It re-reads CLAUDE.md when you push back instead of arguing

---

## When to come back to ME (the chat-Claude that built this)

Use Claude Code for: batch building of programs, refactoring, Phase 1B work, mechanical sign-flip transformations, test scaffolding.

Use chat-Claude (here) for:
- Strategy/scope conversations
- Reviewing Claude Code's output when you're uncertain
- Working through new mortgage concepts that haven't been encoded yet
- Sanity-checking pricing logic when something looks economically off
- Anything where the answer requires understanding mortgage industry context that isn't in CLAUDE.md
