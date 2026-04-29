/**
 * Rate Hero Pricer — Engine
 * ----------------------------------------------------------------------------
 * Pure pricing engine for a single program. No side effects. No API calls.
 * No state. Takes a scenario object in, returns a priced result out.
 *
 * Architecture:
 *   1. Eligibility filter — does this program qualify the scenario at all?
 *   2. LLPA stack — base rate table + FICO×LTV grid + all additional LLPAs
 *   3. Comp injection — apply Rate Hero margin from comp config
 *   4. Max price cap enforcement — Cake's 103.5/102 ceiling
 *   5. Tier generator — Cold/Warm/Hot from rate ladder
 *
 * The audit log captures wholesale price (pre-comp) and final price (post-comp)
 * separately so compliance can reconstruct exactly what happened.
 * ============================================================================
 */

// ============================================================================
// HELPER: BAND LOOKUPS
// ============================================================================

/**
 * Convert a raw FICO score to the FICO band string used in the JSON grid.
 * Returns null if FICO is outside any band (program will reject).
 */
function getFicoBand(fico) {
  if (fico === null || fico === undefined) return "700_719_no_score_fn"; // No-score / FN
  if (fico >= 760) return "760_plus";
  if (fico >= 740) return "740_759";
  if (fico >= 720) return "720_739";
  if (fico >= 700) return "700_719_no_score_fn";
  if (fico >= 680) return "680_699";
  if (fico >= 660) return "660_679";
  if (fico >= 640) return "640_659";
  if (fico >= 620) return "620_639";
  if (fico >= 600) return "600_619";
  return null;
}

/**
 * Convert a raw LTV percent to the LTV band string used in the JSON grid.
 */
function getLtvBand(ltv) {
  if (ltv <= 50)    return "lte_50";
  if (ltv <= 55)    return "50_55";
  if (ltv <= 60)    return "55_60";
  if (ltv <= 65)    return "60_65";
  if (ltv <= 70)    return "65_70";
  if (ltv <= 75)    return "70_75";
  if (ltv <= 80)    return "75_80";
  if (ltv <= 85)    return "80_85";
  return null; // Above 85% LTV — not eligible on Pound Cake DSCR
}

/**
 * Convert raw DSCR ratio to the DSCR band key in additional_llpas.dscr_ratio.
 */
function getDscrBand(dscr) {
  if (dscr === null || dscr === undefined || dscr < 0.75) return "no_ratio_lt_0_75";
  if (dscr < 1.00) return "0_75_to_0_99";
  if (dscr < 1.15) return "1_00_to_1_14";
  return "1_15_plus";
}

/**
 * Convert raw loan amount to the loan size band key.
 */
function getLoanSizeBand(loan, bands) {
  for (const [bandKey, range] of Object.entries(bands)) {
    if (loan >= range.min && loan <= range.max) return bandKey;
  }
  // Fallback: if loan is between $250K and $1M, no LLPA applies — return null
  return null;
}

/**
 * Convert raw FICO + PPP status to the dscr_fico_adjustments key.
 * Returns null if no FICO-based adjustment applies.
 */
function getDscrFicoAdjustmentKey(fico, hasPpp, dscr, purpose) {
  if (dscr < 1.00) return null; // Section only applies when DSCR >= 1.0

  // R/T Refi w/PPP, FICO <= 700 — special case
  if (purpose === "rate_term_refi" && hasPpp && fico <= 700) {
    return "dscr_rt_refi_with_ppp_fico_lte_700";
  }

  // No PPP, FICO 700+
  if (!hasPpp && fico >= 700) {
    return "dscr_gte_1_no_ppp_fico_700_plus";
  }

  // With PPP, by FICO band
  if (hasPpp) {
    if (fico >= 740) return "dscr_gte_1_with_ppp_fico_740_plus";
    if (fico >= 720) return "dscr_gte_1_with_ppp_fico_720_739";
    if (fico >= 700) return "dscr_gte_1_with_ppp_fico_700_719";
    if (fico >= 680) return "dscr_gte_1_with_ppp_fico_680_699";
    if (fico >= 620) return "dscr_gte_1_with_ppp_fico_620_679";
  }

  return null;
}

/**
 * Safely look up a cell value from an LLPA grid. Returns:
 *   - a number if the cell has a numeric value
 *   - "NA" if the cell is not available for this combination
 *   - 0 if the lookup path is missing entirely (defensive)
 */
function lookupCell(grid, ltvBand) {
  if (!grid) return 0;
  const value = grid[ltvBand];
  if (value === undefined) return 0;
  if (value === "NA") return "NA";
  return value;
}

/**
 * Sum a list of LLPA values. Any "NA" in the stack means the loan is not
 * eligible — return "NA" to short-circuit.
 */
function sumLlpas(values) {
  let sum = 0;
  for (const v of values) {
    if (v === "NA") return "NA";
    sum += v;
  }
  // Round to 4 decimal places to avoid floating-point noise
  return Math.round(sum * 10000) / 10000;
}

// ============================================================================
// ELIGIBILITY FILTER
// ============================================================================

/**
 * Check whether a scenario qualifies for a program.
 * Returns { eligible: true } or { eligible: false, reason: "..." }
 */
function checkEligibility(scenario, program) {
  const rules = program.eligibility_rules;

  // FICO checks
  if (scenario.fico !== null && scenario.fico !== undefined) {
    if (scenario.fico < rules.min_fico) return { eligible: false, reason: `FICO ${scenario.fico} below minimum ${rules.min_fico}` };
    if (scenario.fico > rules.max_fico) return { eligible: false, reason: `FICO ${scenario.fico} above max ${rules.max_fico}` };
  } else if (!rules.no_score_allowed) {
    return { eligible: false, reason: "No FICO score not allowed on this program" };
  } else if (scenario.ltv > rules.no_score_max_ltv) {
    return { eligible: false, reason: `No-score borrowers limited to ${rules.no_score_max_ltv}% LTV` };
  }

  // Loan amount
  if (scenario.loan_amount < rules.min_loan) return { eligible: false, reason: `Loan amount below ${rules.min_loan} minimum` };
  if (scenario.loan_amount > rules.max_loan) return { eligible: false, reason: `Loan amount above ${rules.max_loan} maximum` };

  // LTV by purpose
  if (scenario.purpose === "purchase" && scenario.ltv > rules.max_ltv_purchase) {
    return { eligible: false, reason: `LTV ${scenario.ltv}% exceeds purchase max ${rules.max_ltv_purchase}%` };
  }
  if (scenario.purpose === "rate_term_refi" && scenario.ltv > rules.max_ltv_rate_term_refi) {
    return { eligible: false, reason: `LTV ${scenario.ltv}% exceeds rate/term refi max ${rules.max_ltv_rate_term_refi}%` };
  }
  if (scenario.purpose === "cash_out_refi" && scenario.ltv > rules.max_ltv_cashout) {
    return { eligible: false, reason: `LTV ${scenario.ltv}% exceeds cash-out refi max ${rules.max_ltv_cashout}%` };
  }

  // Amortization / IO / ARM (v1 = 30yr fixed amortizing only)
  if (scenario.interest_only && !rules.interest_only_allowed) return { eligible: false, reason: "Interest-only not allowed" };
  if (scenario.is_arm && !rules.arm_allowed) return { eligible: false, reason: "ARM not allowed" };

  // Occupancy
  if (!rules.occupancy_allowed.includes(scenario.occupancy)) {
    return { eligible: false, reason: `Occupancy '${scenario.occupancy}' not allowed (program is ${rules.occupancy_allowed.join(", ")})` };
  }

  // Property type
  if (!rules.property_types_allowed.includes(scenario.property_type)) {
    return { eligible: false, reason: `Property type '${scenario.property_type}' not allowed` };
  }

  // Borrower type
  if (!rules.borrower_types_allowed.includes(scenario.borrower_type)) {
    return { eligible: false, reason: `Borrower type '${scenario.borrower_type}' not allowed` };
  }

  // Foreign National checks
  if (scenario.borrower_type === "foreign_national") {
    if (scenario.dscr < rules.foreign_national_min_dscr) {
      return { eligible: false, reason: `Foreign National min DSCR ${rules.foreign_national_min_dscr}` };
    }
  }

  // Prepay state restrictions
  if (scenario.prepay_term && scenario.prepay_term !== "no_prepay") {
    if (rules.states_no_prepay_allowed.includes(scenario.state)) {
      return { eligible: false, reason: `Prepay penalties not allowed in ${scenario.state}` };
    }
    if (rules.states_no_prepay_for_individual_vesting.includes(scenario.state) && scenario.entity_type === "individual") {
      return { eligible: false, reason: `Prepay penalties not allowed for individual vesting in ${scenario.state}` };
    }
  }

  // 1x30x12 mortgage history requires min 0.75 DSCR
  if (scenario.credit_history === "housing_1x30x12" && scenario.dscr < rules.min_dscr_for_1x30x12_history) {
    return { eligible: false, reason: `1x30x12 history requires min DSCR ${rules.min_dscr_for_1x30x12_history}` };
  }

  return { eligible: true };
}

// ============================================================================
// LLPA STACKING — COMPUTE PRICE AT A GIVEN NOTE RATE
// ============================================================================

/**
 * For a given note rate and scenario, compute the total wholesale price
 * (base price from rate ladder + all stacking LLPAs).
 *
 * Returns:
 *   - { eligible: true, wholesalePrice, llpaBreakdown: {...} } on success
 *   - { eligible: false, reason: "..." } if any required LLPA is "NA"
 */
function computeWholesalePriceAtRate(noteRate, scenario, program) {
  const ltvBand = getLtvBand(scenario.ltv);
  const ficoBand = getFicoBand(scenario.fico);

  // 1. Base price from the rate ladder
  const basePrice = program.base_rate_table[noteRate.toFixed(3)];
  if (basePrice === undefined) {
    return { eligible: false, reason: `Rate ${noteRate} not in rate ladder` };
  }

  const breakdown = { base_rate: noteRate, base_price: basePrice };
  const llpaValues = [];

  // 2. FICO × LTV grid
  const ficoLtvLlpa = lookupCell(program.fico_ltv_adjustments.grid[ficoBand], ltvBand);
  if (ficoLtvLlpa === "NA") return { eligible: false, reason: `FICO ${scenario.fico} not allowed at LTV ${scenario.ltv}%` };
  breakdown.fico_ltv = ficoLtvLlpa;
  llpaValues.push(ficoLtvLlpa);

  const additional = program.additional_llpas;

  // 3. DSCR ratio (skip the standard ratio if borrower is STR — STR overlay applies instead)
  if (!scenario.is_str) {
    const dscrBand = getDscrBand(scenario.dscr);
    const dscrLlpa = lookupCell(additional.dscr_ratio[dscrBand], ltvBand);
    if (dscrLlpa === "NA") return { eligible: false, reason: `DSCR ${scenario.dscr} band not allowed at LTV ${scenario.ltv}%` };
    breakdown.dscr_ratio = dscrLlpa;
    llpaValues.push(dscrLlpa);
  } else {
    // STR overlay replaces standard DSCR
    const strLlpa = lookupCell(additional.short_term_rental.gte_1_15_minimum, ltvBand);
    if (strLlpa === "NA") return { eligible: false, reason: `STR not allowed at LTV ${scenario.ltv}%` };
    breakdown.short_term_rental = strLlpa;
    llpaValues.push(strLlpa);
  }

  // 4. DSCR FICO adjustments (when DSCR >= 1.0)
  const hasPpp = scenario.prepay_term && scenario.prepay_term !== "no_prepay";
  const dscrFicoKey = getDscrFicoAdjustmentKey(scenario.fico, hasPpp, scenario.dscr, scenario.purpose);
  if (dscrFicoKey) {
    const dscrFicoLlpa = lookupCell(additional.dscr_fico_adjustments[dscrFicoKey], ltvBand);
    if (dscrFicoLlpa !== "NA") {
      breakdown.dscr_fico_adjustment = dscrFicoLlpa;
      llpaValues.push(dscrFicoLlpa);
    }
  }

  // 5. Foreign National (additive when borrower is FN)
  if (scenario.borrower_type === "foreign_national") {
    const fnLlpa = lookupCell(additional.foreign_national.dscr_gte_1_0, ltvBand);
    if (fnLlpa === "NA") return { eligible: false, reason: `Foreign National not allowed at LTV ${scenario.ltv}%` };
    breakdown.foreign_national = fnLlpa;
    llpaValues.push(fnLlpa);
  }

  // 6. Loan amount band
  const loanBand = getLoanSizeBand(scenario.loan_amount, additional.loan_amount._bands_definition_usd);
  if (loanBand) {
    const loanLlpa = lookupCell(additional.loan_amount[loanBand], ltvBand);
    if (loanLlpa === "NA") return { eligible: false, reason: `Loan size ${scenario.loan_amount} not allowed at LTV ${scenario.ltv}%` };
    breakdown.loan_amount = loanLlpa;
    llpaValues.push(loanLlpa);
  }

  // 7. Loan purpose
  const purposeLlpa = lookupCell(additional.loan_purpose[scenario.purpose], ltvBand);
  if (purposeLlpa === "NA") return { eligible: false, reason: `Purpose '${scenario.purpose}' not allowed at LTV ${scenario.ltv}%` };
  breakdown.loan_purpose = purposeLlpa;
  llpaValues.push(purposeLlpa);

  // 8. Property type
  const propertyLlpa = lookupCell(additional.property_type[scenario.property_type], ltvBand);
  if (propertyLlpa === "NA") return { eligible: false, reason: `Property type '${scenario.property_type}' not allowed at LTV ${scenario.ltv}%` };
  breakdown.property_type = propertyLlpa;
  llpaValues.push(propertyLlpa);

  // 8b. FL Condo overlay (additive on top of warrantable/non-warrantable)
  if (scenario.state === "FL" && (scenario.property_type === "condo_warrantable" || scenario.property_type === "condo_non_warrantable")) {
    const flCondoLlpa = lookupCell(additional.property_type.fl_condo_overlay, ltvBand);
    if (flCondoLlpa !== "NA") {
      breakdown.fl_condo_overlay = flCondoLlpa;
      llpaValues.push(flCondoLlpa);
    }
  }

  // 9. Prepay penalty LLPA (rate adjustment, separate from max_price_caps)
  if (scenario.prepay_term) {
    const prepayKey = `${scenario.prepay_term}_prepay`.replace("no_prepay_prepay", "no_prepay");
    const prepayLlpa = additional.prepay_penalty_llpa[prepayKey]?.all_ltvs;
    if (prepayLlpa !== undefined) {
      breakdown.prepay_penalty_llpa = prepayLlpa;
      llpaValues.push(prepayLlpa);
    }
  }

  // 10. Credit history
  if (scenario.credit_history && scenario.credit_history !== "clean") {
    const historyLlpa = lookupCell(additional.credit_history[scenario.credit_history], ltvBand);
    if (historyLlpa === "NA") return { eligible: false, reason: `Credit history '${scenario.credit_history}' not allowed at LTV ${scenario.ltv}%` };
    breakdown.credit_history = historyLlpa;
    llpaValues.push(historyLlpa);
  }

  // 11. Other (escrow waiver, state overlay)
  if (scenario.escrow_waiver) {
    const waiverKey = scenario.state === "NY" ? "escrow_waiver_ny_only" : "escrow_waiver_non_ny";
    const waiverLlpa = lookupCell(additional.other[waiverKey], ltvBand);
    if (waiverLlpa === "NA") return { eligible: false, reason: `Escrow waiver not allowed at LTV ${scenario.ltv}% in ${scenario.state}` };
    breakdown.escrow_waiver = waiverLlpa;
    llpaValues.push(waiverLlpa);
  }

  // 11b. State overlay (GA / NY / FL)
  if (["GA", "NY", "FL"].includes(scenario.state)) {
    const stateLlpa = lookupCell(additional.other.state_ga_ny_fl_overlay, ltvBand);
    breakdown.state_overlay = stateLlpa;
    llpaValues.push(stateLlpa);
  }

  // Sum it all
  const llpaSum = sumLlpas(llpaValues);
  if (llpaSum === "NA") return { eligible: false, reason: "An LLPA in the stack returned NA" };

  // Wholesale price = base_price (negative is discount) + sum of LLPAs
  // In Cake's convention, negative price = discount (better for borrower)
  // Higher price = costs more
  const wholesalePrice = Math.round((basePrice + llpaSum) * 10000) / 10000;

  return {
    eligible: true,
    note_rate: noteRate,
    wholesale_price: wholesalePrice,
    llpa_breakdown: breakdown,
    llpa_total: llpaSum
  };
}

// ============================================================================
// COMP INJECTION
// ============================================================================

/**
 * Apply Rate Hero compensation to a wholesale price.
 * comp_bps is added to the price (in points = bps/100).
 */
function applyCompensation(wholesalePriceResult, scenario, compConfig) {
  if (!wholesalePriceResult.eligible) return wholesalePriceResult;

  // Determine comp bps: lender override > loan-size band > default
  let compBps = compConfig.default_compensation.comp_bps;

  // Loan size band override
  for (const [band, override] of Object.entries(compConfig.compensation_by_loan_size)) {
    const [minStr, maxStr] = band.split("_to_").map(s => parseInt(s.replace("plus", "999999999"), 10));
    if (scenario.loan_amount >= minStr && scenario.loan_amount <= (isNaN(maxStr) ? 999999999 : maxStr)) {
      compBps = override.comp_bps;
      break;
    }
  }

  // State override
  if (compConfig.compensation_by_state[scenario.state]) {
    compBps = compConfig.compensation_by_state[scenario.state].comp_bps;
  }

  // Lender override
  if (compConfig.compensation_by_lender.cake) {
    compBps = compConfig.compensation_by_lender.cake.comp_bps;
  }

  // Federal cap
  if (compBps > compConfig.federal_max_comp_bps) compBps = compConfig.federal_max_comp_bps;

  // Convert bps to points: 200 bps = 2.000 points = 2.000 added to price
  const compAsPoints = compBps / 100;

  // Final price = wholesale price + comp (higher price = better margin for Rate Hero)
  // Actually in mortgage convention: comp ADDS to what borrower pays / reduces lender credit
  // Borrower-facing price = wholesale_price + comp_as_points
  const borrowerFacingPrice = Math.round((wholesalePriceResult.wholesale_price + compAsPoints) * 10000) / 10000;

  return {
    ...wholesalePriceResult,
    comp_bps: compBps,
    comp_as_points: compAsPoints,
    borrower_facing_price: borrowerFacingPrice
  };
}

// ============================================================================
// MAX PRICE CAP ENFORCEMENT
// ============================================================================

/**
 * Validate that the final price doesn't exceed Cake's max price cap.
 * For investor loans: 103.5
 * For owner-occupied / 2nd home: 102.0
 * Plus PPP-specific caps in max_price_caps.ppp_buydown_max_price_caps
 *
 * Note: Cake quotes prices as "points adjustment from par (100)".
 * So a wholesale_price of -3.973 means actual price = 100 + (-3.973) = 96.027.
 * Max price 103.5 means absolute price ceiling at 103.5.
 * In our convention: a PRICE ADJUSTMENT of +3.5 means at the cap.
 */
function enforceMaxPriceCap(pricedResult, scenario, program) {
  if (!pricedResult.eligible) return pricedResult;

  // Pound Cake DSCR is investor only — use 103.5 cap
  const maxAdjustment = scenario.occupancy === "non_owner_occupied"
    ? program.max_price_caps.investor_max_price - 100
    : program.max_price_caps.owner_occupied_or_2nd_home_max_price - 100;

  // PPP-specific cap (further restricts max price)
  const prepayKey = scenario.prepay_term ? `${scenario.prepay_term}_prepay`.replace("no_prepay_prepay", "no_prepay") : null;
  const ppCaps = prepayKey ? program.max_price_caps.ppp_buydown_max_price_caps[prepayKey] : null;

  let pppMaxAdjustment = maxAdjustment;
  if (ppCaps) {
    const cashoutOrPurch = scenario.purpose === "cash_out_refi" ? "max_price_cashout" : "max_price_purch_rt";
    pppMaxAdjustment = ppCaps[cashoutOrPurch];
  }

  // The tighter of the two caps applies
  const effectiveCap = Math.min(maxAdjustment, pppMaxAdjustment);

  let cappedPrice = pricedResult.borrower_facing_price;
  let wasCapped = false;

  if (cappedPrice > effectiveCap) {
    cappedPrice = effectiveCap;
    wasCapped = true;
  }

  return {
    ...pricedResult,
    effective_max_price_cap: effectiveCap,
    final_price: cappedPrice,
    was_capped: wasCapped
  };
}

// ============================================================================
// MAIN: PRICE A SCENARIO ACROSS THE FULL RATE LADDER
// ============================================================================

/**
 * For a given scenario and program, price every available note rate
 * and return the full ladder of (rate, price) pairs.
 */
function priceScenarioFullLadder(scenario, program, compConfig) {
  // 1. Eligibility check
  const eligibility = checkEligibility(scenario, program);
  if (!eligibility.eligible) {
    return {
      eligible: false,
      reason: eligibility.reason,
      lender_id: program.lender_id,
      program_id: program.program_id
    };
  }

  // 2. Price every note rate in the rate ladder
  const ladder = [];
  for (const rateStr of Object.keys(program.base_rate_table)) {
    if (rateStr.startsWith("_")) continue; // skip _comment, _format
    const rate = parseFloat(rateStr);
    const wholesale = computeWholesalePriceAtRate(rate, scenario, program);
    if (!wholesale.eligible) continue; // skip rates that don't price for this scenario

    const withComp = applyCompensation(wholesale, scenario, compConfig);
    const capped = enforceMaxPriceCap(withComp, scenario, program);

    ladder.push(capped);
  }

  if (ladder.length === 0) {
    return {
      eligible: false,
      reason: "No rates in ladder produced valid pricing",
      lender_id: program.lender_id,
      program_id: program.program_id
    };
  }

  return {
    eligible: true,
    lender_id: program.lender_id,
    program_id: program.program_id,
    rate_sheet_date: program.rate_sheet_date,
    rate_sheet_time_pt: program.rate_sheet_time_pt,
    ladder: ladder
  };
}

// ============================================================================
// TIER BUILDER — COLD / WARM / HOT
// ============================================================================

/**
 * From a full rate ladder, generate Cold / Warm / Hot tiers.
 *
 * COLD = lowest cost (highest rate, borrower gets lender credit or no points)
 *   Find ladder entries where final_price < 100 (lender credit) — pick the lowest rate.
 *   If none, pick the lowest rate where price is closest to 100.
 *
 * WARM = balanced (closest to par / 100)
 *   Pick the ladder entry where final_price is closest to 100.
 *
 * HOT = lowest rate (borrower pays points to buy down)
 *   Pick the lowest rate where final_price is within reason (<= effective cap).
 */
function buildTiers(ladderResult, loanAmount) {
  if (!ladderResult.eligible) return ladderResult;

  const ladder = ladderResult.ladder;

  // Convert "price adjustment" to "actual price" (price = 100 + adjustment)
  // For tier classification, work in actual price space
  const actualPrices = ladder.map(entry => ({
    ...entry,
    actual_price: 100 + entry.final_price
  }));

  // HOT: lowest note rate with valid pricing
  const hot = actualPrices.reduce((lowest, entry) =>
    entry.note_rate < lowest.note_rate ? entry : lowest, actualPrices[0]);

  // COLD: highest note rate (highest rate = most lender credit / no points)
  const cold = actualPrices.reduce((highest, entry) =>
    entry.note_rate > highest.note_rate ? entry : highest, actualPrices[0]);

  // WARM: closest to par (price = 100, i.e. 0 points cost)
  const warm = actualPrices.reduce((closest, entry) => {
    const closestDiff = Math.abs(closest.actual_price - 100);
    const entryDiff = Math.abs(entry.actual_price - 100);
    return entryDiff < closestDiff ? entry : closest;
  }, actualPrices[0]);

  // Calculate dollar costs and monthly P&I
  const enrichTier = (entry, label) => {
    const costAdjustment = entry.final_price; // in points
    const costDollars = Math.round(costAdjustment * loanAmount / 100);
    const monthlyPI = calculateMonthlyPayment(loanAmount, entry.note_rate, 360);
    return {
      label,
      note_rate: entry.note_rate,
      monthly_pi: monthlyPI,
      cost_points: costAdjustment,
      cost_dollars: costDollars,
      is_lender_credit: costDollars < 0,
      lender_id: ladderResult.lender_id,
      program_id: ladderResult.program_id,
      _full_entry: entry
    };
  };

  return {
    eligible: true,
    cold: enrichTier(cold, "Cold"),
    warm: enrichTier(warm, "Warm"),
    hot: enrichTier(hot, "Hot"),
    full_ladder: actualPrices
  };
}

/**
 * Standard mortgage P&I monthly payment calculation.
 */
function calculateMonthlyPayment(principal, annualRatePct, termMonths) {
  const monthlyRate = (annualRatePct / 100) / 12;
  if (monthlyRate === 0) return Math.round(principal / termMonths);
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                  (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(payment);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  priceScenarioFullLadder,
  buildTiers,
  computeWholesalePriceAtRate,
  applyCompensation,
  enforceMaxPriceCap,
  checkEligibility,
  // helpers exposed for testing
  getFicoBand,
  getLtvBand,
  getDscrBand,
  getLoanSizeBand,
  getDscrFicoAdjustmentKey,
  calculateMonthlyPayment
};
