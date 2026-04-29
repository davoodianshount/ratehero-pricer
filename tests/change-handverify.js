/**
 * Hand-verify ONE Change Investor DSCR price against the rate sheet (page 4).
 * Convention check: same as LoanStream (sign-flipped from standard wholesale).
 */

const path = require("path");
const fs = require("fs");
const engine = require("../engine/engine.js");

const program = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../lenders/change/change-investor-dscr.json"), "utf8"
));

console.log("=".repeat(80));
console.log("CHANGE INVESTOR DSCR — HAND-VERIFICATION");
console.log("=".repeat(80));
console.log("");
console.log("Scenario: 740 FICO, 70% LTV, $400K purchase, 1.30 DSCR, NOO SFR, TX, 5yr PPP");
console.log("Rate: 6.625% (mid-ladder)");
console.log("");

const rate = "6.625";
console.log(`HAND-CALC AT ${rate}%:`);
console.log("");

console.log("Step 1: Base price");
const changeBasePrice = 100.559;  // From rate sheet page 4, Fixed 30 YR column
const ourBase = program.base_rate_table[rate];
console.log(`  Change rate sheet:      ${changeBasePrice}`);
console.log(`  Expected (100 - price): ${(100 - changeBasePrice).toFixed(4)}`);
console.log(`  JSON stored:            ${ourBase}`);
console.log(`  Match: ${Math.abs(ourBase - (100 - changeBasePrice)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 2: CLTV/FICO grid (740-759 at 65.01-70)");
const changeFicoLtv = 0.125;  // From rate sheet page 4
const ourFicoLtv = program.fico_ltv_adjustments.grid["740_759"]["65_70"];
console.log(`  Change rate sheet:      +${changeFicoLtv}`);
console.log(`  Expected (negated):     ${(-changeFicoLtv).toFixed(4)}`);
console.log(`  JSON stored:            ${ourFicoLtv}`);
console.log(`  Match: ${Math.abs(ourFicoLtv - (-changeFicoLtv)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 3: DSCR bucket (1.30 → DSCR ≥ 1.25 at 65.01-70)");
const changeDscr = 0.375;  // From rate sheet, DSCR 1.25 row at 65.01-70
const ourDscr = program.additional_llpas.dscr_ratio.dscr_gte_1_25["65_70"];
console.log(`  Change rate sheet:      +${changeDscr}`);
console.log(`  Expected (negated):     ${(-changeDscr).toFixed(4)}`);
console.log(`  JSON stored:            ${ourDscr}`);
console.log(`  Match: ${Math.abs(ourDscr - (-changeDscr)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 4: Loan Balance (>$250k <=$1.5M at 65.01-70)");
const changeLoanBal = 0.125;  // $400K loan → $250k-$1.5M band
const ourLoanBal = program.additional_llpas.loan_amount["250k_to_1_5m"]["65_70"];
console.log(`  Change rate sheet:      +${changeLoanBal}`);
console.log(`  Expected (negated):     ${(-changeLoanBal).toFixed(4)}`);
console.log(`  JSON stored:            ${ourLoanBal}`);
console.log(`  Match: ${Math.abs(ourLoanBal - (-changeLoanBal)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 5: Loan purpose (purchase at 65.01-70)");
const changePurpose = 0.000;
const ourPurpose = program.additional_llpas.loan_purpose.purchase["65_70"];
console.log(`  Change rate sheet:      ${changePurpose}`);
console.log(`  Expected (negated):     ${(-changePurpose).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPurpose}`);
console.log(`  Match: ${Math.abs(ourPurpose - (-changePurpose)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 6: Property type (SFR — baseline)");
const changeProp = 0.000;
const ourProp = program.additional_llpas.property_type.sfr["65_70"];
console.log(`  Change rate sheet:      ${changeProp} (SFR is baseline, no LLPA row)`);
console.log(`  Expected (negated):     ${(-changeProp).toFixed(4)}`);
console.log(`  JSON stored:            ${ourProp}`);
console.log(`  Match: ${Math.abs(ourProp - (-changeProp)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 7: Prepay LLPA (5-year PPP at 65.01-70)");
const changePrepay = 1.750;  // From rate sheet, 5 year row at 65.01-70
const ourPrepay = program.additional_llpas.prepay_penalty_llpa.five_year_prepay["65_70"];
console.log(`  Change rate sheet:      +${changePrepay}`);
console.log(`  Expected (negated):     ${(-changePrepay).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPrepay}`);
console.log(`  Match: ${Math.abs(ourPrepay - (-changePrepay)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("=".repeat(80));
console.log("EXPECTED TOTAL (in our DP convention):");
const expectedWholesale =
  (100 - changeBasePrice) +
  (-changeFicoLtv) +
  (-changeDscr) +
  (-changeLoanBal) +
  (-changePurpose) +
  (-changeProp) +
  (-changePrepay);
console.log(`  base + fico_ltv + dscr + loan_bal + purpose + prop + prepay`);
console.log(`  = ${(100 - changeBasePrice).toFixed(4)} + ${(-changeFicoLtv).toFixed(4)} + ${(-changeDscr).toFixed(4)} + ${(-changeLoanBal).toFixed(4)} + ${(-changePurpose).toFixed(4)} + ${(-changeProp).toFixed(4)} + ${(-changePrepay).toFixed(4)}`);
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
  borrower_type: "us_citizen", state: "TX", purpose: "purchase",
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
}
