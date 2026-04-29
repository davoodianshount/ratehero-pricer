/**
 * Best Execution Test Harness
 * ----------------------------------------------------------------------------
 * Verifies multi-lender best-execution works correctly across Cake + AmWest.
 *
 * Run with: node tests/best-execution-scenarios.js
 * ============================================================================
 */

const path = require("path");
const bestExec = require("../engine/best-execution.js");

const LENDERS_PATH = path.join(__dirname, "../lenders");
const COMP_CONFIG_PATH = path.join(__dirname, "../config/comp.json");

const scenarios = [
  {
    name: "TEST 1 — Strong borrower in TX, both lenders should compete",
    description: "740 FICO, 70% LTV, 1.25 DSCR, SFR, TX, $400K, purchase, 5yr PPP",
    inputs: {
      fico: 740, ltv: 70, loan_amount: 400000, dscr: 1.25,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    expected: {
      should_be_eligible: true,
      min_eligible_programs: 2
    }
  },

  {
    name: "TEST 2 — CA borrower, both lenders should reject",
    description: "780 FICO, 70% LTV in CA — Rate Hero not licensed, both lenders excluded",
    inputs: {
      fico: 780, ltv: 70, loan_amount: 500000, dscr: 1.30,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "CA",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    expected: {
      should_be_eligible: false
    }
  },

  {
    name: "TEST 3 — 80% LTV cashout — Cake rejects (max 75), AmWest rejects (max 75)",
    description: "Both lenders cap cashout at 75 LTV; should be rejected",
    inputs: {
      fico: 740, ltv: 80, loan_amount: 200000, dscr: 1.10,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "cash_out_refi", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    expected: {
      should_be_eligible: false
    }
  },

  {
    name: "TEST 4 — High DSCR (1.25+) plays to AmWest's strength",
    description: "DSCR of 1.30 should give AmWest aggressive pricing because they discount heavily for >=1.25",
    inputs: {
      fico: 760, ltv: 65, loan_amount: 350000, dscr: 1.30,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "us_citizen", entity_type: "llc", state: "TX",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    expected: {
      should_be_eligible: true,
      min_eligible_programs: 2
    }
  },

  {
    name: "TEST 5 — Foreign National in TX, both lenders should price",
    description: "FN borrower with strong DSCR. Cake will price at 700 FICO; AmWest no FICO — engine adapts",
    inputs: {
      fico: 720, ltv: 60, loan_amount: 500000, dscr: 1.25,
      occupancy: "non_owner_occupied", property_type: "sfr",
      borrower_type: "foreign_national", entity_type: "llc", state: "TX",
      purpose: "purchase", prepay_term: "five_year",
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: "clean"
    },
    expected: {
      should_be_eligible: true,
      min_eligible_programs: 2
    }
  }
];

// ============================================================================
// RUN TESTS
// ============================================================================

let passed = 0;
let failed = 0;

console.log("\n" + "=".repeat(80));
console.log("RATE HERO ENGINE — BEST EXECUTION TEST HARNESS");
console.log("=".repeat(80) + "\n");

scenarios.forEach((scenario, idx) => {
  console.log(`${scenario.name}`);
  console.log(`  ${scenario.description}`);

  const result = bestExec.findBestExecution(scenario.inputs, LENDERS_PATH, COMP_CONFIG_PATH);

  // Eligibility check
  if (scenario.expected.should_be_eligible === false) {
    if (!result.eligible) {
      console.log(`  ✅ PASS — Correctly rejected: "${result.reason}"`);
      console.log(`     Programs evaluated: ${result.audit.programs_evaluated}`);
      console.log(`     Rejected programs: ${result.audit.rejected_programs.length}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL — Expected rejection but got eligible result`);
      failed++;
    }
    console.log();
    return;
  }

  // Should be eligible
  if (!result.eligible) {
    console.log(`  ❌ FAIL — Expected eligible but rejected: "${result.reason}"`);
    if (result.audit && result.audit.rejected_programs) {
      result.audit.rejected_programs.forEach(r => {
        console.log(`     ${r.lender_id}/${r.program_id}: ${r.reason}`);
      });
    }
    failed++;
    console.log();
    return;
  }

  // Min eligible programs check
  if (scenario.expected.min_eligible_programs && result.audit.eligible_programs_count < scenario.expected.min_eligible_programs) {
    console.log(`  ❌ FAIL — Expected at least ${scenario.expected.min_eligible_programs} eligible programs, got ${result.audit.eligible_programs_count}`);
    failed++;
    console.log();
    return;
  }

  // Show the winners
  console.log(`  ✅ PASS — ${result.audit.eligible_programs_count} programs eligible`);
  console.log(`     ⚡ Bolt:      Rate ${result.bolt.note_rate.toFixed(3)}% | $${result.bolt.monthly_pi}/mo | ${result.bolt.cost_dollars >= 0 ? "$" + result.bolt.cost_dollars + " cost" : "$" + Math.abs(result.bolt.cost_dollars) + " credit"} | source: ${result.bolt._source_lender}`);
  console.log(`     ⚡ Thunder:   Rate ${result.thunder.note_rate.toFixed(3)}% | $${result.thunder.monthly_pi}/mo | ${result.thunder.cost_dollars >= 0 ? "$" + result.thunder.cost_dollars + " cost" : "$" + Math.abs(result.thunder.cost_dollars) + " credit"} | source: ${result.thunder._source_lender}`);
  console.log(`     ⚡ Lightning: Rate ${result.lightning.note_rate.toFixed(3)}% | $${result.lightning.monthly_pi}/mo | ${result.lightning.cost_dollars >= 0 ? "$" + result.lightning.cost_dollars + " cost" : "$" + Math.abs(result.lightning.cost_dollars) + " credit"} | source: ${result.lightning._source_lender}`);
  passed++;
  console.log();
});

console.log("=".repeat(80));
console.log(`RESULT: ${passed} passed, ${failed} failed (${scenarios.length} total)`);
console.log("=".repeat(80) + "\n");

process.exit(failed > 0 ? 1 : 0);