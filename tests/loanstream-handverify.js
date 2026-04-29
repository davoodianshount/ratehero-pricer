/**
 * Hand-verify ONE LoanStream price against the rate sheet.
 * This is the critical test: if convention is wrong, we catch it here.
 */

const path = require("path");
const fs = require("fs");
const engine = require("../engine/engine.js");

const program = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../lenders/loanstream/loanstream-core-dscr.json"), "utf8"
));
const compConfig = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../config/comp.json"), "utf8"
));

console.log("=".repeat(80));
console.log("LOANSTREAM HAND-VERIFICATION — Test 4 Thunder scenario");
console.log("=".repeat(80));
console.log("");
console.log("Scenario: 740 FICO, 70% LTV, $400K purchase, 1.30 DSCR, NOO SFR, TX, 5yr PPP");
console.log("Engine output (from best-exec): Thunder = 6.625% / $371 cost via loanstream");
console.log("");

// Compute step by step at 6.625%
const rate = "6.625";
console.log(`HAND-CALC AT ${rate}%:`);
console.log("");

console.log("Step 1: Base price");
const lsBasePrice = 100.694;  // From rate sheet page 2
const ourBase = program.base_rate_table[rate];
console.log(`  LoanStream rate sheet:  ${lsBasePrice}`);
console.log(`  Expected (100 - LSP):   ${(100 - lsBasePrice).toFixed(4)}`);
console.log(`  JSON stored:            ${ourBase}`);
console.log(`  Match: ${Math.abs(ourBase - (100 - lsBasePrice)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 2: FICO/LTV grid (740-759 at 65.01-70)");
const lsFicoLtv = 0.400;  // From rate sheet page 2
const ourFicoLtv = program.fico_ltv_adjustments.grid["740_759"]["65_70"];
console.log(`  LoanStream rate sheet:  +${lsFicoLtv}`);
console.log(`  Expected (negated):     ${(-lsFicoLtv).toFixed(4)}`);
console.log(`  JSON stored:            ${ourFicoLtv}`);
console.log(`  Match: ${Math.abs(ourFicoLtv - (-lsFicoLtv)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 3: Program overlay (Core DSCR >=1.20 at 65.01-70)");
const lsProgram = 0.500;
const ourProgram = program.additional_llpas.program_overlay["65_70"];
console.log(`  LoanStream rate sheet:  +${lsProgram}`);
console.log(`  Expected (negated):     ${(-lsProgram).toFixed(4)}`);
console.log(`  JSON stored:            ${ourProgram}`);
console.log(`  Match: ${Math.abs(ourProgram - (-lsProgram)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 4: Loan purpose (purchase at 65.01-70)");
const lsPurpose = 0.000;
const ourPurpose = program.additional_llpas.loan_purpose.purchase["65_70"];
console.log(`  LoanStream rate sheet:  ${lsPurpose}`);
console.log(`  Expected (negated):     ${(-lsPurpose).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPurpose}`);
console.log(`  Match: ${Math.abs(ourPurpose - (-lsPurpose)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 5: Prepay LLPA (5-year PPP at 65.01-70)");
const lsPrepay = 0.625;
const ourPrepay = program.additional_llpas.prepay_penalty_llpa.five_year_prepay["65_70"];
console.log(`  LoanStream rate sheet:  +${lsPrepay}`);
console.log(`  Expected (negated):     ${(-lsPrepay).toFixed(4)}`);
console.log(`  JSON stored:            ${ourPrepay}`);
console.log(`  Match: ${Math.abs(ourPrepay - (-lsPrepay)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("Step 6: State tier (TX is Tier 2)");
const lsStateTier = -0.150;  // Tier 2 LLPA in LS convention
const isTexasTier2 = program.additional_llpas.state_tier_overlay.tier_2_states.includes("TX");
const ourTier2 = program.additional_llpas.state_tier_overlay.tier_2_llpa;
console.log(`  LoanStream rate sheet:  ${lsStateTier} (Tier 2 LLPA)`);
console.log(`  TX in Tier 2 list?      ${isTexasTier2 ? "✓" : "✗"}`);
console.log(`  Expected (negated):     ${(-lsStateTier).toFixed(4)}`);
console.log(`  JSON stored:            ${ourTier2}`);
console.log(`  Match: ${Math.abs(ourTier2 - (-lsStateTier)) < 0.001 ? "✓" : "✗"}`);
console.log("");

console.log("=".repeat(80));
console.log("EXPECTED TOTAL (in our DP convention):");
const expectedWholesale = (100 - lsBasePrice) + (-lsFicoLtv) + (-lsProgram) + (-lsPurpose) + (-lsPrepay) + (-lsStateTier);
console.log(`  base + fico_ltv + program + purpose + prepay + state_tier`);
console.log(`  = ${(100 - lsBasePrice).toFixed(4)} + ${(-lsFicoLtv).toFixed(4)} + ${(-lsProgram).toFixed(4)} + ${(-lsPurpose).toFixed(4)} + ${(-lsPrepay).toFixed(4)} + ${(-lsStateTier).toFixed(4)}`);
console.log(`  = ${expectedWholesale.toFixed(4)} (wholesale price, our convention)`);
console.log("");

console.log("Add 200 bps comp (LPC, $400K loan):");
const expectedBorrowerFacing = expectedWholesale + 2.000;
console.log(`  ${expectedWholesale.toFixed(4)} + 2.000 = ${expectedBorrowerFacing.toFixed(4)} points`);
const expectedDollarCost = expectedBorrowerFacing / 100 * 400000;
console.log(`  At $400K: ${expectedBorrowerFacing.toFixed(4)} / 100 × $400,000 = $${expectedDollarCost.toFixed(2)} ${expectedBorrowerFacing >= 0 ? "cost" : "credit"}`);
console.log("");

console.log("=".repeat(80));
console.log("ENGINE OUTPUT:");
const result = engine.computeWholesalePriceAtRate(parseFloat(rate), {
  fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.30,
  occupancy: "non_owner_occupied", property_type: "sfr",
  borrower_type: "us_citizen", state: "TX", purpose: "purchase",
  prepay_term: "five_year", credit_history: "clean", escrow_waiver: false
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
}
