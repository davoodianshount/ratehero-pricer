/**
 * Rate Hero Engine — Best Execution
 * ----------------------------------------------------------------------------
 * Runs a borrower scenario through all configured lender programs, picks the
 * best Lightning/Thunder/Bolt tier across all eligible programs.
 *
 * Borrower never sees lender names. Audit log captures everything for
 * compliance reconstruction.
 *
 * Architecture:
 *   1. Load all programs from /lenders/* directory
 *   2. For each program, run priceScenarioFullLadder() and buildTiers()
 *   3. Collect all eligible tier sets
 *   4. Pick the winning Lightning/Thunder/Bolt across all programs
 *   5. Return the 3 tier cards plus a separate audit object with full detail
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const engine = require("./engine.js");

// ============================================================================
// LOAD ALL LENDER PROGRAMS
// ============================================================================

/**
 * Scan the /lenders directory and load every program JSON.
 * Returns an array of program objects.
 */
function loadAllPrograms(lendersRootPath) {
  const programs = [];

  if (!fs.existsSync(lendersRootPath)) {
    return programs;
  }

  const lenderDirs = fs.readdirSync(lendersRootPath).filter(name => {
    const fullPath = path.join(lendersRootPath, name);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const lenderDir of lenderDirs) {
    const lenderPath = path.join(lendersRootPath, lenderDir);
    const programFiles = fs.readdirSync(lenderPath).filter(f => f.endsWith(".json"));

    for (const programFile of programFiles) {
      const filePath = path.join(lenderPath, programFile);
      try {
        const programData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        programs.push(programData);
      } catch (err) {
        console.error(`Failed to load ${filePath}:`, err.message);
      }
    }
  }

  return programs;
}

// ============================================================================
// PRICE SCENARIO ACROSS ALL PROGRAMS
// ============================================================================

/**
 * For a borrower scenario, run pricing across every program.
 * Returns:
 *   - eligibleResults: array of {program, ladder, tiers} for programs that priced
 *   - rejectedResults: array of {program_id, lender_id, reason} for programs that rejected
 */
function priceAcrossAllPrograms(scenario, programs, compConfig) {
  const eligibleResults = [];
  const rejectedResults = [];

  for (const program of programs) {
    // Adapt scenario for this lender's quirks
    // Cross-lender business rule: Cake prices FN at 700 FICO; AmWest doesn't use FICO for FN
    const adaptedScenario = adaptScenarioForLender(scenario, program);

    const ladderResult = engine.priceScenarioFullLadder(adaptedScenario, program, compConfig);

    if (!ladderResult.eligible) {
      rejectedResults.push({
        lender_id: program.lender_id,
        program_id: program.program_id,
        reason: ladderResult.reason
      });
      continue;
    }

    const tiers = engine.buildTiers(ladderResult, scenario.loan_amount);
    eligibleResults.push({
      lender_id: program.lender_id,
      program_id: program.program_id,
      tiers: tiers,
      ladder_result: ladderResult
    });
  }

  return { eligibleResults, rejectedResults };
}

/**
 * Apply lender-specific scenario adaptations.
 * For example, Cake prices Foreign National borrowers at 700 FICO regardless
 * of actual FICO; AmWest doesn't use FICO for FN at all.
 */
function adaptScenarioForLender(scenario, program) {
  const adapted = Object.assign({}, scenario);

  // Cake: Foreign National pricing uses 700 FICO
  if (program.lender_id === "cake" && scenario.borrower_type === "foreign_national") {
    adapted.fico = program.eligibility_rules.foreign_national_min_fico_pricing || 700;
  }

  // AmWest: Foreign National doesn't use FICO at all
  if (program.lender_id === "amwest" && scenario.borrower_type === "foreign_national") {
    adapted._fn_no_fico = true;
    // Engine still needs a FICO value for grid lookup; use 700 as neutral default
    // The foreign_national LLPA section will be applied separately
    adapted.fico = 700;
  }

  return adapted;
}

// ============================================================================
// PICK BEST EXECUTION (WINNERS ACROSS LENDERS)
// ============================================================================

/**
 * Given results from multiple programs, pick the best Lightning/Thunder/Bolt
 * tier across all of them.
 *
 * Logic:
 *   - Bolt: lowest cost (highest final_price ≈ most lender credit / smallest cost)
 *   - Lightning: lowest rate (lowest note_rate, regardless of cost)
 *   - Thunder: best balanced (closest to par, i.e. final_price closest to 0)
 *
 * Each tier might come from a different lender. That's the entire point of
 * best execution.
 */
function pickBestExecution(eligibleResults) {
  if (eligibleResults.length === 0) {
    return {
      eligible: false,
      reason: "No lenders qualified for this scenario",
      bolt: null,
      thunder: null,
      lightning: null
    };
  }

  // Collect every individual tier offer across all programs
  const allBolts = eligibleResults.map(r => Object.assign({}, r.tiers.bolt, { _source_lender: r.lender_id, _source_program: r.program_id }));
  const allThunders = eligibleResults.map(r => Object.assign({}, r.tiers.thunder, { _source_lender: r.lender_id, _source_program: r.program_id }));
  const allLightnings = eligibleResults.map(r => Object.assign({}, r.tiers.lightning, { _source_lender: r.lender_id, _source_program: r.program_id }));

  // Bolt = lowest cost (highest final_price = best for borrower's wallet)
  // In adjustment_from_par convention: more positive = more credit/less cost
  const bestBolt = allBolts.reduce((best, current) => {
    return current._full_entry.final_price > best._full_entry.final_price ? current : best;
  }, allBolts[0]);

  // Lightning = lowest note rate
  const bestLightning = allLightnings.reduce((best, current) => {
    return current.note_rate < best.note_rate ? current : best;
  }, allLightnings[0]);

  // Thunder = closest to par (final_price closest to 0)
  const bestThunder = allThunders.reduce((best, current) => {
    return Math.abs(current._full_entry.final_price) < Math.abs(best._full_entry.final_price) ? current : best;
  }, allThunders[0]);

  return {
    eligible: true,
    bolt: bestBolt,
    thunder: bestThunder,
    lightning: bestLightning
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Top-level function: borrower submits a scenario, get back the 3 tier cards.
 *
 * Returns:
 *   {
 *     eligible: true/false,
 *     bolt: { note_rate, monthly_pi, cost_dollars, ... } | null,
 *     thunder: { ... } | null,
 *     lightning: { ... } | null,
 *     audit: {
 *       scenario,
 *       eligible_programs_count,
 *       rejected_programs: [{lender_id, program_id, reason}],
 *       all_eligible_results: [...]
 *     }
 *   }
 */
function findBestExecution(scenario, lendersRootPath, compConfigPath) {
  // Validate inputs
  if (!scenario || typeof scenario !== "object") {
    return { eligible: false, reason: "Invalid scenario object" };
  }

  // Load programs and comp config
  const programs = loadAllPrograms(lendersRootPath);
  const compConfig = JSON.parse(fs.readFileSync(compConfigPath, "utf8"));

  if (programs.length === 0) {
    return { eligible: false, reason: "No lender programs configured" };
  }

  // Price across all programs
  const { eligibleResults, rejectedResults } = priceAcrossAllPrograms(scenario, programs, compConfig);

  // Pick best execution
  const winners = pickBestExecution(eligibleResults);

  // Build audit object
  const audit = {
    timestamp: new Date().toISOString(),
    scenario: scenario,
    programs_evaluated: programs.length,
    eligible_programs_count: eligibleResults.length,
    rejected_programs: rejectedResults,
    eligible_programs: eligibleResults.map(r => ({
      lender_id: r.lender_id,
      program_id: r.program_id,
      bolt_price: r.tiers.bolt && r.tiers.bolt._full_entry ? r.tiers.bolt._full_entry.final_price : null,
      thunder_price: r.tiers.thunder && r.tiers.thunder._full_entry ? r.tiers.thunder._full_entry.final_price : null,
      lightning_price: r.tiers.lightning && r.tiers.lightning._full_entry ? r.tiers.lightning._full_entry.final_price : null
    }))
  };

  return Object.assign({}, winners, { audit });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  findBestExecution,
  loadAllPrograms,
  priceAcrossAllPrograms,
  pickBestExecution,
  adaptScenarioForLender
};