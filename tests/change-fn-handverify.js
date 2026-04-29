/**
 * Hand-verify ONE Change Foreign National DSCR price against the rate sheet (page 5).
 * Convention check: standard wholesale (sign-flipped). Same family as Change Investor / LoanStream.
 *
 * Test scenario (Sean-suggested mid-ladder):
 *   740 FICO, 70% LTV, 1.30 DSCR, $400K, NOO SFR, FL, purchase, 5yr PPP, foreign_national
 *
 * Note: this program has NO FICO/LTV grid on the rate sheet, so there is no
 * FICO/LTV LLPA step. The FN program-level "LTV LLPA" row is encoded as
 * additional_llpas.program_overlay (mirrors LoanStream's pattern).
 */

const path = require("path");
const fs = require("fs");
const engine = require("../engine/engine.js");

const program = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../lenders/change/change-fn-dscr.json"), "utf8"
));
const compConfig = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../config/comp.json"), "utf8"
));

console.log("=".repeat(80));
console.log("CHANGE FOREIGN NATIONAL DSCR — HAND-VERIFICATION");
console.log("=".repeat(80));
console.log("");
console.log("Scenario: 740 FICO, 70% LTV, $400K purchase, 1.30 DSCR, NOO SFR, FL, 5yr PPP, FN");
console.log("Rate: 6.625% (mid-ladder)");
console.log("");

const rate = "6.625";
console.log(`HAND-CALC AT ${rate}%:`);
console.log("");

console.log("Step 1: Base price");
const changeBasePrice = 98.309;  // From rate sheet page 5, Fixed 30 YR column
const ourBase = program.base_rate_table[rate];
console.log(`  Change FN rate sheet:   ${changeBasePrice}`);
console.log(`  Expected (100 - price): ${(100 - changeBasePrice).toFixed(4)}`);
console.log(`  JSON stored:            ${ourBase}`);
console.log(`  Match: ${Math.abs(ourBase - (100 - changeBasePrice)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 2: FICO/LTV grid — N/A on FN program (empty grid by design)");
const grid = program.fico_ltv_adjustments.grid;
const ficoBandCount = Object.keys(grid).length;
console.log(`  FICO bands in grid:     ${ficoBandCount} (expected 0)`);
console.log(`  Engine LLPA returned:   0 (lookupCell on undefined returns 0)`);
console.log(`  Match: ${ficoBandCount === 0 ? "✓" : "✗"}`);
console.log("");

console.log("Step 3: Program overlay — FN LTV LLPA at 65.01-70 LTV band");
const changeFnOverlay = -0.500;  // From rate sheet "LTV LLPA" row at 65.01-70
const ourOverlay = program.additional_llpas.program_overlay["65_70"];
console.log(`  Change FN rate sheet:   ${changeFnOverlay} (LTV LLPA row, FN overlay)`);
console.log(`  Expected (negated):     ${(-changeFnOverlay).toFixed(4)}`);
console.log(`  JSON stored:            ${ourOverlay}`);
console.log(`  Match: ${Math.abs(ourOverlay - (-changeFnOverlay)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 4: DSCR bucket (1.30 → DSCR ≥ 1.25 at 65.01-70)");
const changeDscr = 0.000;  // FN program: DSCR ≥ 1.00 = 0
const ourDscr = program.additional_llpas.dscr_ratio.dscr_gte_1_25["65_70"];
console.log(`  Change FN rate sheet:   ${changeDscr} (FN program has only one DSCR bucket: ≥1.00 = 0)`);
console.log(`  Expected (negated):     ${(-changeDscr).toFixed(4)}`);
console.log(`  JSON stored:            ${ourDscr}`);
console.log(`  Match: ${Math.abs(ourDscr - (-changeDscr)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 5: Loan Balance ($400K → middle band $250k-$2M = 0)");
const changeLoanBal = 0.000;
const ourLoanBal = program.additional_llpas.loan_amount["250k_to_2m"]["65_70"];
console.log(`  Change FN rate sheet:   ${changeLoanBal} (no LLPA published for $250k-$2M middle range)`);
console.log(`  Expected (negated):     ${(-changeLoanBal).toFixed(4)}`);
console.log(`  JSON stored:            ${ourLoanBal}`);
console.log(`  Match: ${Math.abs(ourLoanBal - (-changeLoanBal)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 6: Loan purpose (purchase at 65.01-70)");
const changePurpose = 0.000;
const ourPurpose = program.additional_llpas.loan_purpose.purchase["65_70"];
console.log(`  Change FN rate sheet:   ${changePurpose}`);
console.log(`  Expected (negated):     ${(-changePurpose).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPurpose}`);
console.log(`  Match: ${Math.abs(ourPurpose - (-changePurpose)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 7: Property type (SFR — baseline, FL state but property is SFR not condo)");
const changeProp = 0.000;
const ourProp = program.additional_llpas.property_type.sfr["65_70"];
console.log(`  Change FN rate sheet:   ${changeProp} (SFR baseline)`);
console.log(`  Expected (negated):     ${(-changeProp).toFixed(4)}`);
console.log(`  JSON stored:            ${ourProp}`);
console.log(`  Match: ${Math.abs(ourProp - (-changeProp)) < 0.001 ? "✓" : "✗"}`);
console.log(`  Note: FL Condo overlay does NOT apply (property is sfr, not condo_warrantable)`);
console.log("");

console.log("Step 8: Prepay LLPA (5-year PPP at 65.01-70)");
const changePrepay = 0.625;  // Rate sheet 5-year row
const ourPrepay = program.additional_llpas.prepay_penalty_llpa.five_year_prepay["65_70"];
console.log(`  Change FN rate sheet:   +${changePrepay}`);
console.log(`  Expected (negated):     ${(-changePrepay).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPrepay}`);
console.log(`  Match: ${Math.abs(ourPrepay - (-changePrepay)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("=".repeat(80));
console.log("EXPECTED TOTAL (in our DP convention):");
const expectedWholesale =
  (100 - changeBasePrice) +
  (-changeFnOverlay) +
  (-changeDscr) +
  (-changeLoanBal) +
  (-changePurpose) +
  (-changeProp) +
  (-changePrepay);
console.log(`  base + program_overlay + dscr + loan_bal + purpose + prop + prepay`);
console.log(`  = ${(100 - changeBasePrice).toFixed(4)} + ${(-changeFnOverlay).toFixed(4)} + ${(-changeDscr).toFixed(4)} + ${(-changeLoanBal).toFixed(4)} + ${(-changePurpose).toFixed(4)} + ${(-changeProp).toFixed(4)} + ${(-changePrepay).toFixed(4)}`);
console.log(`  = ${expectedWholesale.toFixed(4)} (wholesale price, our convention)`);
console.log("");

console.log("Add 200 bps comp (LPC, $400K loan):");
const expectedBorrowerFacing = expectedWholesale + 2.000;
console.log(`  ${expectedWholesale.toFixed(4)} + 2.000 = ${expectedBorrowerFacing.toFixed(4)} points`);
const expectedDollarCost = expectedBorrowerFacing / 100 * 400000;
console.log(`  At $400K: $${Math.round(expectedDollarCost)} ${expectedBorrowerFacing >= 0 ? "cost" : "credit"}`);
console.log("");

console.log("=".repeat(80));
console.log("ENGINE OUTPUT:");
const result = engine.computeWholesalePriceAtRate(parseFloat(rate), {
  fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.30,
  occupancy: "non_owner_occupied", property_type: "sfr",
  borrower_type: "foreign_national", state: "FL", purpose: "purchase",
  prepay_term: "five_year", credit_history: "clean", escrow_waiver: false,
  is_str: false, is_arm: false, interest_only: false
}, program);
console.log(JSON.stringify(result, null, 2));
console.log("");

if (result.eligible) {
  const engineWholesale = result.wholesale_price;
  const diff = Math.abs(engineWholesale - expectedWholesale);
  console.log(`Engine wholesale: ${engineWholesale.toFixed(4)}`);
  console.log(`Expected:         ${expectedWholesale.toFixed(4)}`);
  console.log(`Diff:             ${diff.toFixed(4)}`);
  console.log(`Match: ${diff < 0.001 ? "✅ PASS" : "❌ FAIL"}`);
} else {
  console.log(`❌ Engine rejected: ${result.reason}`);
  process.exit(1);
}

// =============================================================================
// PLAUSIBILITY SANITY CHECKS (per CLAUDE.md additional safeguards)
// =============================================================================
console.log("");
console.log("=".repeat(80));
console.log("PLAUSIBILITY SANITY CHECKS:");
console.log("=".repeat(80));

const dollarAmt = expectedBorrowerFacing / 100 * 400000;
const inRange = dollarAmt >= -15000 && dollarAmt <= 25000;
console.log(`  $${Math.round(dollarAmt)} on $400K @ 6.625% (mid-ladder, FN, 5yr PPP)`);
console.log(`  Plausibility range: -$15,000 (credit) to +$25,000 (cost)`);
console.log(`  In range: ${inRange ? "✅" : "❌ SUSPICIOUS — needs review"}`);
console.log("");

// 5yr PPP must price BETTER than No PPP
const fivePppLlpa = program.additional_llpas.prepay_penalty_llpa.five_year_prepay["65_70"];
const noPppLlpa = program.additional_llpas.prepay_penalty_llpa.no_prepay["65_70"];
const fivePppBetter = fivePppLlpa < noPppLlpa;  // more negative = bigger rebate = better
console.log(`  5yr PPP LLPA at 65_70: ${fivePppLlpa} (DP convention: more negative = better)`);
console.log(`  No PPP LLPA at 65_70:  ${noPppLlpa}`);
console.log(`  5yr PPP < No PPP (i.e., prices better): ${fivePppBetter ? "✅" : "❌ CRITICAL BUG"}`);
console.log("");

// Bottom of ladder should show COST (positive borrower-facing price)
const bottomRate = "6.490";
const bottomBase = program.base_rate_table[bottomRate];
console.log(`  Bottom-of-ladder check at ${bottomRate}%:`);
console.log(`    Base price: ${bottomBase} (DP convention)`);
console.log(`    With same LLPAs (overlay +0.5, prepay -0.625, others 0) + 2.000 comp:`);
const bottomFinal = bottomBase + 0.5 - 0.625 + 2.000;
console.log(`    ≈ ${bottomFinal.toFixed(4)} points = $${Math.round(bottomFinal/100*400000)} ${bottomFinal >= 0 ? "cost" : "credit"}`);
console.log(`    Expected: COST (sign-flip sanity check)`);
console.log(`    Match: ${bottomFinal > 0 ? "✅" : "❌ SIGN-FLIP MAY BE WRONG"}`);
console.log("");

// Top of ladder should show CREDIT (negative borrower-facing price), modulo cap
const topRate = "9.250";
const topBase = program.base_rate_table[topRate];
const topFinal = topBase + 0.5 - 0.625 + 2.000;
console.log(`  Top-of-ladder check at ${topRate}%:`);
console.log(`    Base price: ${topBase} (DP convention)`);
console.log(`    With same LLPAs + comp (pre-cap):`);
console.log(`    ≈ ${topFinal.toFixed(4)} points (pre-cap)`);
console.log(`    Expected: CREDIT pre-cap (sign-flip sanity check)`);
console.log(`    Match: ${topFinal < 0 ? "✅" : "❌ SIGN-FLIP OR CAP MAY BE WRONG"}`);
console.log(`    Note: 5yr PPP cap floor is -1.500, so post-cap final ≈ -1.500 = -$6,000 credit`);
console.log("");

// Property type ineligibility: condo_non_warrantable must reject
const nwCondoResult = engine.computeWholesalePriceAtRate(6.625, {
  fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.30,
  occupancy: "non_owner_occupied", property_type: "condo_non_warrantable",
  borrower_type: "foreign_national", state: "FL", purpose: "purchase",
  prepay_term: "five_year", credit_history: "clean", escrow_waiver: false,
  is_str: false, is_arm: false, interest_only: false
}, program);
console.log(`  NW Condo ineligibility check (NA-row enforcement):`);
console.log(`    Engine result: eligible=${nwCondoResult.eligible}, reason="${nwCondoResult.reason || "n/a"}"`);
console.log(`    Match: ${!nwCondoResult.eligible ? "✅ correctly rejected" : "❌ should reject"}`);
console.log("");

// STR ineligibility: is_str=true must reject
const strResult = engine.computeWholesalePriceAtRate(6.625, {
  fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.30,
  occupancy: "non_owner_occupied", property_type: "sfr",
  borrower_type: "foreign_national", state: "FL", purpose: "purchase",
  prepay_term: "five_year", credit_history: "clean", escrow_waiver: false,
  is_str: true, is_arm: false, interest_only: false
}, program);
console.log(`  STR ineligibility check (is_str=true with NA short_term_rental row):`);
console.log(`    Engine result: eligible=${strResult.eligible}, reason="${strResult.reason || "n/a"}"`);
console.log(`    Match: ${!strResult.eligible ? "✅ correctly rejected" : "❌ should reject"}`);
console.log("");

// Cashout NA at 70_75 — check via priceScenarioFullLadder rather than single rate
const cashoutFullResult = engine.priceScenarioFullLadder({
  fico: 740, ltv: 72, loan_amount: 400000, dscr: 1.30,
  occupancy: "non_owner_occupied", property_type: "sfr",
  borrower_type: "foreign_national", state: "FL", purpose: "cash_out_refi",
  prepay_term: "five_year", credit_history: "clean", escrow_waiver: false,
  is_str: false, is_arm: false, interest_only: false
}, program, compConfig);
console.log(`  Cashout @ LTV 72 (>70 max cashout) eligibility check:`);
console.log(`    Engine result: eligible=${cashoutFullResult.eligible}, reason="${cashoutFullResult.reason || "n/a"}"`);
console.log(`    Match: ${!cashoutFullResult.eligible ? "✅ correctly rejected" : "❌ should reject (max_ltv_cashout=70)"}`);
