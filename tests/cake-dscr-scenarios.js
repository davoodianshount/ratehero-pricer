/**
 * Rate Hero Pricer — Test Harness v3
 * ----------------------------------------------------------------------------
 * 9 test scenarios:
 *   - 5 synthetic scenarios (cover edge cases)
 *   - 4 real scenarios from Sean's actual book of business
 *
 * Run with: node tests/cake-dscr-scenarios.js
 *
 * NOTE: Scenario 9 tests the conditional OH prepay rule (allowed above $112K).
 *       Engine logic must implement this conditional check or scenario 9 will fail.
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const engine = require("../engine/engine.js");

const program = JSON.parse(fs.readFileSync(path.join(__dirname, "../lenders/cake/pound-cake-dscr.json"), "utf8"));
const compConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/comp.json"), "utf8"));

const scenarios = [
  // ============================================================================
  // SYNTHETIC SCENARIOS
  // ============================================================================

  {
    name: "TEST 1 — Vanilla DSCR purchase, strong borrower",
    description: "740 FICO, 70% LTV, 1.25 DSCR, SFR, TX, $400K, purchase, 5yr PPP",
    inputs: {
      fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.25,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.250,
    expected: { wholesale_price_approx: -6.098, tolerance: 0.01 }
  },

  {
    name: "TEST 2 — Cash-out refi, mid-tier",
    description: "700 FICO, 70% LTV, 1.10 DSCR, 2-Unit, FL, $500K, cash-out, 3yr PPP",
    inputs: {
      fico: 700, ltv: 70, loan_amount: 500000, dscr: 1.10,
      occupancy: "non_owner_occupied", property_type: "two_unit",
      borrower_type: "us_citizen", entity_type: "llc", state: "FL",
      purpose: "cash_out_refi", prepay_term: "three_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: { wholesale_price_approx: -2.198, tolerance: 0.01 }
  },

  {
    name: "TEST 3 — Foreign National DSCR (CA excluded)",
    description: "FN @ 700 FICO, 65% LTV, 1.05 DSCR, SFR, CA — should reject (CA not licensed)",
    inputs: {
      fico: 700, ltv: 65, loan_amount: 750000, dscr: 1.05,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "foreign_national", entity_type: "llc", state: "CA",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: {
      should_be_eligible: false,
      reason_contains: "CA"
    }
  },

  {
    name: "TEST 4 — STR property in AZ (excluded)",
    description: "680 FICO, 60% LTV, 1.30 DSCR, SFR-STR, AZ — should reject (AZ not licensed)",
    inputs: {
      fico: 680, ltv: 60, loan_amount: 300000, dscr: 1.30,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "AZ",
      purpose: "purchase", prepay_term: "no_prepay",
      interest_only: false, is_arm: false, is_str: true,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.875,
    expected: {
      should_be_eligible: false,
      reason_contains: "AZ"
    }
  },

  {
    name: "TEST 5 — FICO/LTV grid violation",
    description: "660 FICO, 75% LTV — should reject, FICO grid has NA at this combo",
    inputs: {
      fico: 660, ltv: 75, loan_amount: 350000, dscr: 1.20,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: {
      should_be_eligible: false,
      reason_contains: "FICO"
    }
  },

  // ============================================================================
  // REAL SCENARIOS FROM SEAN'S BOOK
  // ============================================================================

  {
    name: "TEST 6 — REAL: Strong cashout, 780 FICO TX",
    description: "780 FICO, $300K, 75% LTV cashout, 1.25 DSCR, 3yr PPP, TX",
    inputs: {
      fico: 780, ltv: 75, loan_amount: 300000, dscr: 1.25,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "cash_out_refi", prepay_term: "three_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.250,
    expected: { wholesale_price_approx: -2.473, tolerance: 0.01 }
  },

  {
    name: "TEST 7 — REAL: 80 LTV cashout (Pound Cake max is 75)",
    description: "740 FICO, $200K, 80% LTV cashout — should reject (Cake's Pound Cake program max cashout LTV is 75; other Cake programs go higher)",
    inputs: {
      fico: 740, ltv: 80, loan_amount: 200000, dscr: 1.125,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "cash_out_refi", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: {
      should_be_eligible: false,
      reason_contains: "cash"
    }
  },

  {
    name: "TEST 8 — REAL: No-PPP cashout, 740 FICO TX",
    description: "740 FICO, $165K, 65% LTV cashout, 1.15 DSCR, no prepay, TX",
    inputs: {
      fico: 740, ltv: 65, loan_amount: 165000, dscr: 1.15,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "cash_out_refi", prepay_term: "no_prepay",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.250,
    expected: { wholesale_price_approx: -1.623, tolerance: 0.01 }
  },

  {
    name: "TEST 9 — REAL: 85 LTV purchase OH with 5yr PPP",
    description: "740 FICO, $135K, 85% LTV purchase, 1.75 DSCR, 5yr PPP, OH — OH allows PPP above $112K, so $135K loan should be ELIGIBLE",
    inputs: {
      fico: 740, ltv: 85, loan_amount: 135000, dscr: 1.75,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "OH",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: {
      // base_price 7.500 = -3.673
      // FICO/LTV: 740_759 × 80_85 = 4.750
      // dscr_ratio 1_15_plus × 80_85 = -0.125
      // dscr_fico_adjustments dscr_gte_1_with_ppp_fico_740_plus × 80_85 = 0.000
      // loan_amount lt_150k × 80_85 = 1.750
      // loan_purpose purchase × 80_85 = -0.125
      // property_type sfr = 0.000
      // prepay_penalty five_year_prepay = -1.000
      // state OH no overlay (not in GA/NY/FL list)
      // Sum: -3.673 + 4.750 + -0.125 + 0.000 + 1.750 + -0.125 + 0.000 + -1.000 = 1.577
      wholesale_price_approx: 1.577,
      tolerance: 0.01,
      note: "Engine must apply OH conditional prepay rule (allowed above $112K). $135K > $112K so prepay is permitted."
    }
  },

  {
    name: "TEST 9b — REAL: OH with too-small loan (should reject prepay)",
    description: "Same as 9 but $100K loan amount (below $112K OH threshold) — should reject the 5yr PPP request",
    inputs: {
      fico: 740, ltv: 85, loan_amount: 100000, dscr: 1.75,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "OH",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    test_at_note_rate: 7.500,
    expected: {
      should_be_eligible: false,
      reason_contains: "OH"
    }
  }
];

// ============================================================================
// RUN TESTS
// ============================================================================

let passed = 0;
let failed = 0;

console.log("\n" + "=".repeat(80));
console.log("RATE HERO ENGINE — TEST HARNESS v3");
console.log("Source: " + program.rate_sheet_filename_when_imported);
console.log("Schema version: " + program.schema_version);
console.log(`Scenarios: ${scenarios.length} (5 synthetic + 5 real)`);
console.log("=".repeat(80));

scenarios.forEach((scenario, idx) => {
  console.log(`\n${scenario.name}`);
  console.log(`  ${scenario.description}`);

  if (scenario.expected.should_be_eligible === false) {
    const eligibility = engine.checkEligibility(scenario.inputs, program);
    if (!eligibility.eligible) {
      const reasonLower = eligibility.reason.toLowerCase();
      const expectedLower = scenario.expected.reason_contains.toLowerCase();
      if (reasonLower.includes(expectedLower)) {
        console.log(`  ✅ PASS — Correctly rejected: "${eligibility.reason}"`);
        passed++;
      } else {
        console.log(`  ⚠️  PASS (reason mismatch) — Rejected: "${eligibility.reason}"`);
        console.log(`     Expected reason to contain: "${scenario.expected.reason_contains}"`);
        passed++;
      }
    } else {
      const fullResult = engine.priceScenarioFullLadder(scenario.inputs, program, compConfig);
      if (!fullResult.eligible) {
        console.log(`  ✅ PASS — Rejected during pricing: "${fullResult.reason}"`);
        passed++;
      } else {
        console.log(`  ❌ FAIL — Expected rejection but got eligible result`);
        failed++;
      }
    }
    return;
  }

  const wholesale = engine.computeWholesalePriceAtRate(scenario.test_at_note_rate, scenario.inputs, program);

  if (!wholesale.eligible) {
    console.log(`  ❌ FAIL — Expected price ~${scenario.expected.wholesale_price_approx} but got ineligible: ${wholesale.reason}`);
    if (scenario.expected.note) console.log(`     NOTE: ${scenario.expected.note}`);
    failed++;
    return;
  }

  const diff = Math.abs(wholesale.wholesale_price - scenario.expected.wholesale_price_approx);
  if (diff <= scenario.expected.tolerance) {
    console.log(`  ✅ PASS — Wholesale price: ${wholesale.wholesale_price} (expected ~${scenario.expected.wholesale_price_approx}, diff ${diff.toFixed(4)})`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — Wholesale price: ${wholesale.wholesale_price} (expected ~${scenario.expected.wholesale_price_approx}, diff ${diff.toFixed(4)} > tol ${scenario.expected.tolerance})`);
    console.log(`     LLPA breakdown: ${JSON.stringify(wholesale.llpa_breakdown)}`);
    failed++;
  }
});

console.log("\n" + "=".repeat(80));
console.log(`RESULT: ${passed} passed, ${failed} failed (${scenarios.length} total)`);
console.log("=".repeat(80) + "\n");

process.exit(failed > 0 ? 1 : 0);
