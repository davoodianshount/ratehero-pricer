# Rate Hero Engine — Borrower-Facing Copy

> **Single source of truth for all UI text on goratehero.com/rates.**
> When the UI is built, it pulls strings from this file. Changes here flow through to the live page after deploy.
> Owned and approved by Sean Davoodian, 2026-04-28.

---

## Page Header

**Headline:**
> Build Your Deal. Choose Your Rate.

**Subheadline:**
> Instantly structure your loan using rental income — the property qualifies itself.

---

## Scenario Builder Form

**Section heading:** *(none — form is the primary UI element)*

**Field 1 — Estimated Credit Score**
- Label: `Estimated Credit Score`
- Help text: `Your approximate FICO range`
- Type: select dropdown
- Options: 760+, 740-759, 720-739, 700-719, 680-699, 660-679, 640-659, 620-639, "I don't know"

**Field 2 — Down Payment (%)**
- Label: `Down Payment (%)`
- Help text: `How much you're putting down`
- Type: numeric input or slider
- Range: 15% to 50%
- Default: 25%
- Note: For refinance flows, this becomes "Estimated Equity (%)"

**Field 3 — Loan Amount**
- Label: `Loan Amount`
- Help text: `Estimated loan size`
- Type: numeric input with $ prefix
- Range: $75,000 to $3,000,000
- Default: $300,000

**Field 4 — Property Cash Flow (DSCR)**
- Label: `Property Cash Flow (DSCR)`
- Help text: `Rental income ÷ mortgage payment`
- Type: numeric input
- Range: 0.00 to 3.00
- Default: 1.20
- Tooltip: "DSCR is your monthly rental income divided by your monthly mortgage payment (PITIA). 1.0 = breaks even. 1.25 = 25% positive cash flow."

**Field 5 — Property Type**
- Label: `Property Type`
- Help text: *(none needed)*
- Type: select dropdown
- Options: Single Family Residence (SFR), 2-Unit, 3-4 Unit, Warrantable Condo, Non-Warrantable Condo, Condotel

**Field 6 — Property Use**
- Label: `Property Use`
- Help text: *(none — locked to investment)*
- Type: select dropdown (locked)
- Options: Investment Property *(only option in v1)*

**Field 7 — Goal**
- Label: `Goal`
- Help text: *(none needed)*
- Type: select dropdown
- Options: Purchase, Refinance, Cash-Out Refinance

**Field 8 — Prepayment Option**
- Label: `Prepayment Option`
- Help text: `Lower rate with a short-term hold`
- Type: select dropdown
- Options: 5-Year, 4-Year, 3-Year, 2-Year, 1-Year, No Prepayment Penalty

**Hidden field — State**
- Auto-filled from browser geolocation OR shown as a select dropdown if location is undetermined
- Filtered to states where Rate Hero is licensed for BPL

---

## Pre-Results Microcopy

*(Above the 3 tier cards, after results render):*

> **Choose the structure that fits your strategy.**

---

## Three Tier Cards

### Card 1 — Lightning ⚡

- **Label:** Lightning
- **Tagline:** Lowest Rate
- **Description:** Lower monthly payment with a short-term hold.
- **Visual treatment:** Should be visually distinct (e.g., gold/electric border to match Rate Hero brand)

### Card 2 — Thunder ⚡

- **Label:** Thunder
- **Tagline:** Balanced Option
- **Description:** Optimized rate and cost for flexibility.
- **Visual treatment:** Middle/neutral styling

### Card 3 — Bolt ⚡

- **Label:** Bolt
- **Tagline:** Lowest Cost
- **Description:** Minimize upfront cash to close.
- **Visual treatment:** Standard styling

**Each card displays:**
- Tier label and tagline
- Note rate (e.g., "7.250%")
- Monthly P&I (e.g., "$1,847/mo")
- Cost or credit at closing (e.g., "+$2,400 cost" or "$1,800 credit")
- Sub-text: "30-year fixed, business-purpose investor loan"

**Each card has a select button:**
- Button text: `Choose This Structure`

---

## Post-Results Confidence Copy

*(Directly under the 3 cards):*

> **You're in control. Adjust terms, explore scenarios, or lock in your structure when ready.**
>
> No pressure. No obligation. Just real options built for investors.

---

## Pre-CTA Reinforcement

*(One line directly above the primary CTA):*

> **No calls. No pressure. Just instant clarity.**

---

## Primary CTA

- **Button text:** `See My Options`
- **Action:** Submits form → renders the 3 tier cards

---

## Secondary CTA (Below results)

- **Button text:** `Talk to a Loan Strategist`
- **Subtext under button:** `Get expert guidance tailored to your deal`
- **Action:** Opens the "Notes" form → submits via Web3Forms → Google Sheet → routes to Benji for callback

### Talk to LO Form Fields

When the secondary CTA is clicked, expand to:
- First Name
- Last Name
- Email
- Phone Number
- Notes / Additional Context (textarea)
- *(Hidden: full scenario JSON for Benji's reference)*

**Submit button:** `Send to a Strategist`

**Confirmation message after submit:**
> Thanks. A Rate Hero loan strategist will reach out within one business day.

---

## Compliance Footer

*(Small print at the bottom of the page):*

> Pricing scenarios are estimates for comparison purposes only and subject to change based on full loan review and eligibility.
>
> Rate Hero, Inc. NMLS #2822806. For business-purpose investor loans only.

---

## Error/Edge Case Messages

**No eligible programs found:**
> No matching programs at this scenario. Try adjusting your inputs, or **talk to a loan strategist** for a custom quote.

**State not licensed:**
> Rate Hero isn't currently licensed in your state for this product. **Talk to a loan strategist** to discuss your options.

**FICO too low:**
> Our DSCR programs require a minimum 620 FICO. **Talk to a loan strategist** about alternative options.

**Loan amount out of range:**
> Loans below $75K or above $3M aren't covered by our standard pricer. **Talk to a loan strategist** for a custom quote.

---

## Mobile-Specific Considerations

- Form fields stack vertically (no side-by-side)
- Tier cards stack vertically (one column)
- "Talk to a Loan Strategist" sticky button at bottom of viewport after results render
- Field help text appears as tap-to-expand tooltips, not always-visible

---

## Voice & Tone Guidelines

- **Confident, not arrogant.** "Build your deal" not "Try our calculator."
- **Investor-first.** No first-time buyer language. Borrower already knows what DSCR means (or wants to).
- **No fluff.** Every sentence does work.
- **No hedging.** Avoid "we think" / "you might" / "approximately" except where legally required.
- **Action-oriented.** "Choose," "Build," "See" — not "Explore," "Discover," "Find out."
- **Hero-coded.** Lightning, Bolt, Thunder, Strategist — these reinforce the Rate Hero brand without being cartoonish.
