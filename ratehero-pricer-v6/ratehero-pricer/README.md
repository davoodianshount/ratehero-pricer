# Rate Hero Engine (RHE)

> Multi-lender DSCR scenario builder for goratehero.com/rates.
> Borrower runs a scenario; engine prices across 4-5 wholesale lenders;
> returns Cold / Warm / Hot tier cards with no lender names visible.

## What this is

Rate Hero Engine is the pricing brain behind a borrower-facing rate tool. It takes a borrower scenario (FICO, LTV, DSCR, property type, state, purpose, prepay term, etc.) and:

1. **Filters eligibility** across all configured lenders/programs
2. **Stacks LLPAs** for each eligible program against its rate ladder
3. **Injects Rate Hero compensation** from a central comp config
4. **Enforces max price caps** per lender's rate sheet rules
5. **Picks best execution** across the eligible programs
6. **Generates 3 tiers** (Cold/Warm/Hot) for the borrower to compare
7. **Logs the scenario** to an audit trail for compliance reconstruction

## v1 Scope

- DSCR loans only (no full-doc, no bank statement, no FHA/VA/conforming)
- 30-year fixed amortizing only (no ARMs, no IO)
- Investor / non-owner-occupied only
- 5 lenders: Cake, AmWest, LoanStream, Change, Emporium

## Repo structure

```
ratehero-pricer/
├── README.md                      ← this file
├── CLAUDE.md                      ← Claude Code instructions
├── lenders/
│   ├── cake/
│   │   └── pound-cake-dscr.json   ← v4, fully verified
│   ├── amwest/                    ← pending
│   ├── loanstream/                ← pending
│   ├── change/                    ← pending
│   └── emporium/                  ← pending
├── config/
│   └── comp.json                  ← Rate Hero compensation config
├── engine/
│   ├── engine.js                  ← LLPA stacker, comp injection, tier builder
│   ├── best-execution.js          ← multi-lender winner picker (TODO)
│   └── audit-log.js               ← audit log writer (TODO)
├── tests/
│   └── cake-dscr-scenarios.js     ← 5 hand-calculated test scenarios
└── ui/                            ← HTML/CSS/JS for goratehero.com/rates (TODO)
```

## How to run

```bash
# Install Node.js if not already installed
# https://nodejs.org/ (LTS version)

# From repo root
node tests/cake-dscr-scenarios.js
```

If all 5 tests pass, the engine matches Cake's published rate sheet math. Move to building UI and adding more lenders.

## Compliance & Architecture

**State licensing:** Rate Hero, Inc. (NMLS #2822806) is currently licensed in 40+ states. The engine excludes states where Rate Hero needs additional licensing to broker business-purpose loans (AZ, CA, ID, MN, NV, ND, OR, UT, VT — see CLAUDE.md for matrix). CA license expected ~August 2026.

**Comp:** Default 200 bps lender-paid, with loan-size band overrides. Federal max 275 bps cap hard-enforced. All comp logic in `/config/comp.json` — never hardcoded.

**Audit log:** Every priced scenario is logged to Cloudflare Workers KV with 7-year retention (federal mortgage record requirement). Captures borrower scenario, all priced ladder entries, comp injection, final tier presented, and any user notes.

**Disclosures:** Minimal. The pricer is a scenario builder, not a credit application — no Reg Z application, no "we shop loans" disclosure.

## Project Owner

**Sean Davoodian**
Founder, Rate Hero, Inc.
NMLS #1252107
sean@goratehero.com

## License

Proprietary. © 2026 Rate Hero, Inc.
