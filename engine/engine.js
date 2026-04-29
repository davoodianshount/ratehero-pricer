/**
 * Rate Hero Pricer — Engine v3
 * ----------------------------------------------------------------------------
 * Pure pricing engine for a single program. No side effects. No API calls.
 * No state. Takes a scenario object in, returns a priced result out.
 *
 * v2: state licensing exclusion + OH-style conditional prepay rules.
 * v3: defensive guards for lender-specific LLPA sections that may not
 *     exist on every program (e.g. AmWest doesn't have dscr_fico_adjustments).
 *     Engine now gracefully skips missing sections instead of crashing.
 * ============================================================================
 */

// ============================================================================
// HELPER: BAND LOOKUPS
// ============================================================================

function getFicoBand(fico) {
  if (fico === null || fico === undefined) return "700_719_no_score_fn";
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

function getFicoBandAmwest(fico) {
  // AmWest uses a different FICO band naming
  if (fico === null || fico === undefined) return null;
  if (fico >= 780) return "780_plus";
  if (fico >= 760) return "760_779";
  if (fico >= 740) return "740_759";
  if (fico >= 720) return "720_739";
  if (fico >= 700) return "700_719";
  if (fico >= 680) return "680_699";
  if (fico >= 660) return "660_679";
  if (fico >= 640) return "640_659";
  if (fico >= 620) return "620_639";
  return null;
}

function getLtvBandCake(ltv) {
  if (ltv <= 50)    return "lte_50";
  if (ltv <= 55)    return "50_55";
  if (ltv <= 60)    return "55_60";
  if (ltv <= 65)    return "60_65";
  if (ltv <= 70)    return "65_70";
  if (ltv <= 75)    return "70_75";
  if (ltv <= 80)    return "75_80";
  if (ltv <= 85)    return "80_85";
  return null;
}

function getLtvBandAmwest(ltv) {
  // AmWest uses 6 LTV bands, no 80-85
  if (ltv <= 55)    return "lte_55";
  if (ltv <= 60)    return "55_60";
  if (ltv <= 65)    return "60_65";
  if (ltv <= 70)    return "65_70";
  if (ltv <= 75)    return "70_75";
  if (ltv <= 80)    return "75_80";
  return null;
}

function getLtvBand(ltv, program) {
  // Determine which LTV band scheme based on the program's grid
  if (program && program.fico_ltv_adjustments && program.fico_ltv_adjustments.ltv_bands) {
    const bands = program.fico_ltv_adjustments.ltv_bands;
    if (bands.includes("lte_55")) return getLtvBandAmwest(ltv);
  }
  return getLtvBandCake(ltv);
}

function getFicoBandForProgram(fico, program) {
  if (program && program.fico_ltv_adjustments && program.fico_ltv_adjustments.fico_bands) {
    const bands = program.fico_ltv_adjustments.fico_bands;
    if (bands.includes("780_plus")) return getFicoBandAmwest(fico);
  }
  return getFicoBand(fico);
}

function getDscrBand(dscr, program) {
  // Cake uses 4 DSCR buckets; AmWest uses 3
  if (program && program.lender_id === "amwest") {
    if (dscr === null || dscr === undefined) return null;
    if (dscr >= 1.25) return "dscr_gte_1_25";
    if (dscr >= 1.00) return "dscr_gte_1_00";
    return "dscr_lt_1_00";
  }
  // Default to Cake's 4-bucket scheme
  if (dscr === null || dscr === undefined || dscr < 0.75) return "no_ratio_lt_0_75";
  if (dscr < 1.00) return "0_75_to_0_99";
  if (dscr < 1.15) return "1_00_to_1_14";
  return "1_15_plus";
}

function getLoanSizeBand(loan, bands) {
  if (!bands) return null;
  for (const [bandKey, range] of Object.entries(bands)) {
    if (bandKey.startsWith("_")) continue;
    if (typeof range === "object" && range.min !== undefined && range.max !== undefined) {
      if (loan >= range.min && loan <= range.max) return bandKey;
    }
  }
  return null;
}

function getDscrFicoAdjustmentKey(fico, hasPpp, dscr, purpose) {
  if (dscr < 1.00) return null;

  if (purpose === "rate_term_refi" && hasPpp && fico <= 700) {
    return "dscr_rt_refi_with_ppp_fico_lte_700";
  }

  if (!hasPpp && fico >= 700) {
    return "dscr_gte_1_no_ppp_fico_700_plus";
  }

  if (hasPpp) {
    if (fico >= 740) return "dscr_gte_1_with_ppp_fico_740_plus";
    if (fico >= 720) return "dscr_gte_1_with_ppp_fico_720_739";
    if (fico >= 700) return "dscr_gte_1_with_ppp_fico_700_719";
    if (fico >= 680) return "dscr_gte_1_with_ppp_fico_680_699";
    if (fico >= 620) return "dscr_gte_1_with_ppp_fico_620_679";
  }

  return null;
}

function lookupCell(grid, ltvBand) {
  if (!grid) return 0;
  const value = grid[ltvBand];
  if (value === undefined) return 0;
  if (value === "NA") return "NA";
  return value;
}

function sumLlpas(values) {
  let sum = 0;
  for (const v of values) {
    if (v === "NA") return "NA";
    sum += v;
  }
  return Math.round(sum * 10000) / 10000;
}

// ============================================================================
// ELIGIBILITY FILTER
// ============================================================================

function checkEligibility(scenario, program) {
  const rules = program.eligibility_rules;

  // State licensing exclusion
  if (Array.isArray(rules.states_excluded_for_program) && rules.states_excluded_for_program.includes(scenario.state)) {
    const pendingInfo = rules.states_pending_licensing && rules.states_pending_licensing[scenario.state];
    if (pendingInfo) {
      return {
        eligible: false,
        reason: `Rate Hero is not currently licensed in ${scenario.state}. Estimated approval: ${pendingInfo.estimated_approval_date || "unknown"}.`
      };
    }
    return {
      eligible: false,
      reason: `Rate Hero is not currently licensed for this product in ${scenario.state}.`
    };
  }

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

  // Amortization / IO / ARM
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

  // Prepay state restrictions with conditional logic
  if (scenario.prepay_term && scenario.prepay_term !== "no_prepay") {
    if (Array.isArray(rules.states_no_prepay_allowed) && rules.states_no_prepay_allowed.includes(scenario.state)) {
      return { eligible: false, reason: `Prepay penalties not allowed in ${scenario.state}` };
    }

    const conditionalRule = rules.states_prepay_allowed_above_loan_amount && rules.states_prepay_allowed_above_loan_amount[scenario.state];
    if (conditionalRule && typeof conditionalRule === "number" && scenario.loan_amount <= conditionalRule) {
      return {
        eligible: false,
        reason: `Prepay penalties in ${scenario.state} require loan amount above $${conditionalRule.toLocaleString()}`
      };
    }

    if (Array.isArray(rules.states_no_prepay_for_individual_vesting) && rules.states_no_prepay_for_individual_vesting.includes(scenario.state) && scenario.entity_type === "individual") {
      return { eligible: false, reason: `Prepay penalties not allowed for individual vesting in ${scenario.state}` };
    }
  }

  if (scenario.credit_history === "housing_1x30x12" && scenario.dscr < rules.min_dscr_for_1x30x12_history) {
    return { eligible: false, reason: `1x30x12 history requires min DSCR ${rules.min_dscr_for_1x30x12_history}` };
  }

  return { eligible: true };
}

// ============================================================================
// LLPA STACKING — COMPUTE PRICE AT A GIVEN NOTE RATE (v3 — defensive)
// ============================================================================

function computeWholesalePriceAtRate(noteRate, scenario, program) {
  const ltvBand = getLtvBand(scenario.ltv, program);
  const ficoBand = getFicoBandForProgram(scenario.fico, program);

  const basePrice = program.base_rate_table[noteRate.toFixed(3)];
  if (basePrice === undefined) {
    return { eligible: false, reason: `Rate ${noteRate} not in rate ladder` };
  }

  const breakdown = { base_rate: noteRate, base_price: basePrice };
  const llpaValues = [];

  // FICO × LTV grid
  if (program.fico_ltv_adjustments && program.fico_ltv_adjustments.grid) {
    const ficoLtvLlpa = lookupCell(program.fico_ltv_adjustments.grid[ficoBand], ltvBand);
    if (ficoLtvLlpa === "NA") return { eligible: false, reason: `FICO ${scenario.fico} not allowed at LTV ${scenario.ltv}%` };
    breakdown.fico_ltv = ficoLtvLlpa;
    llpaValues.push(ficoLtvLlpa);
  }

  const additional = program.additional_llpas || {};

  // DSCR ratio
  if (additional.dscr_ratio && !scenario.is_str) {
    const dscrBand = getDscrBand(scenario.dscr, program);
    if (dscrBand) {
      const dscrLlpa = lookupCell(additional.dscr_ratio[dscrBand], ltvBand);
      if (dscrLlpa === "NA") return { eligible: false, reason: `DSCR ${scenario.dscr} band not allowed at LTV ${scenario.ltv}%` };
      breakdown.dscr_ratio = dscrLlpa;
      llpaValues.push(dscrLlpa);
    }
  } else if (scenario.is_str && additional.short_term_rental) {
    const strLlpa = lookupCell(additional.short_term_rental.gte_1_15_minimum, ltvBand);
    if (strLlpa === "NA") return { eligible: false, reason: `STR not allowed at LTV ${scenario.ltv}%` };
    breakdown.short_term_rental = strLlpa;
    llpaValues.push(strLlpa);
  }

  // Program overlay (LoanStream) — flat per-LTV LLPA tied to the program variant
  // (e.g. Core DSCR >=1.20 has 0.500 across <=50..70_75, NA above 75)
  if (additional.program_overlay) {
    const programLlpa = lookupCell(additional.program_overlay, ltvBand);
    if (programLlpa === "NA") return { eligible: false, reason: `Program '${program.program_id}' not available at LTV ${scenario.ltv}%` };
    breakdown.program_overlay = programLlpa;
    llpaValues.push(programLlpa);
  }

  // DSCR FICO adjustments — only if program has this section (Cake does, AmWest doesn't)
  if (additional.dscr_fico_adjustments) {
    const hasPpp = scenario.prepay_term && scenario.prepay_term !== "no_prepay";
    const dscrFicoKey = getDscrFicoAdjustmentKey(scenario.fico, hasPpp, scenario.dscr, scenario.purpose);
    if (dscrFicoKey && additional.dscr_fico_adjustments[dscrFicoKey]) {
      const dscrFicoLlpa = lookupCell(additional.dscr_fico_adjustments[dscrFicoKey], ltvBand);
      if (dscrFicoLlpa !== "NA") {
        breakdown.dscr_fico_adjustment = dscrFicoLlpa;
        llpaValues.push(dscrFicoLlpa);
      }
    }
  }

  // Foreign National — handle Cake vs AmWest structure differences
  if (scenario.borrower_type === "foreign_national" && additional.foreign_national) {
    let fnLlpa;
    if (additional.foreign_national.dscr_gte_1_0) {
      // Cake structure
      fnLlpa = lookupCell(additional.foreign_national.dscr_gte_1_0, ltvBand);
    } else if (additional.foreign_national.no_fico) {
      // AmWest structure
      fnLlpa = lookupCell(additional.foreign_national.no_fico, ltvBand);
    }
    if (fnLlpa !== undefined) {
      if (fnLlpa === "NA") return { eligible: false, reason: `Foreign National not allowed at LTV ${scenario.ltv}%` };
      breakdown.foreign_national = fnLlpa;
      llpaValues.push(fnLlpa);
    }
  }

  // Loan amount band
  if (additional.loan_amount && additional.loan_amount._bands_definition_usd) {
    const loanBand = getLoanSizeBand(scenario.loan_amount, additional.loan_amount._bands_definition_usd);
    if (loanBand) {
      const loanLlpa = lookupCell(additional.loan_amount[loanBand], ltvBand);
      if (loanLlpa === "NA") return { eligible: false, reason: `Loan size ${scenario.loan_amount} not allowed at LTV ${scenario.ltv}%` };
      breakdown.loan_amount = loanLlpa;
      llpaValues.push(loanLlpa);
    }
  }

  // AmWest's loan_specific_adjusters — flat by loan size
  if (additional.loan_specific_adjusters) {
    if (scenario.loan_amount < 100000 && additional.loan_specific_adjusters.lt_100k) {
      breakdown.lt_100k = additional.loan_specific_adjusters.lt_100k.all_ltvs;
      llpaValues.push(additional.loan_specific_adjusters.lt_100k.all_ltvs);
    } else if (scenario.loan_amount > 1000000 && scenario.loan_amount <= 2000000 && additional.loan_specific_adjusters.gt_1m_to_2m) {
      breakdown.gt_1m_to_2m = additional.loan_specific_adjusters.gt_1m_to_2m.all_ltvs;
      llpaValues.push(additional.loan_specific_adjusters.gt_1m_to_2m.all_ltvs);
    } else if (scenario.loan_amount > 2000000 && scenario.loan_amount <= 2500000 && additional.loan_specific_adjusters.gt_2m_to_2_5m) {
      breakdown.gt_2m_to_2_5m = additional.loan_specific_adjusters.gt_2m_to_2_5m.all_ltvs;
      llpaValues.push(additional.loan_specific_adjusters.gt_2m_to_2_5m.all_ltvs);
    }
  }

  // Loan purpose
  if (additional.loan_purpose) {
    // Cake structure: full loan_purpose section
    const purposeLlpa = lookupCell(additional.loan_purpose[scenario.purpose], ltvBand);
    if (purposeLlpa === "NA") return { eligible: false, reason: `Purpose '${scenario.purpose}' not allowed at LTV ${scenario.ltv}%` };
    breakdown.loan_purpose = purposeLlpa;
    llpaValues.push(purposeLlpa);
  } else if (additional.loan_purpose_overlay && scenario.purpose === "cash_out_refi") {
    // AmWest structure: only cash_out_refi has overlay; purchase/r&t are baseline
    const cashoutLlpa = lookupCell(additional.loan_purpose_overlay.cash_out_refi, ltvBand);
    if (cashoutLlpa === "NA") return { eligible: false, reason: `Cash-out not allowed at LTV ${scenario.ltv}%` };
    breakdown.loan_purpose = cashoutLlpa;
    llpaValues.push(cashoutLlpa);
  }

  // Loan purpose FICO < 680 overlay (LoanStream) — additional LLPA on refis
  // when FICO is below 680. Stacks on top of base loan_purpose LLPA.
  if (additional.loan_purpose_fico_lt_680_overlay && scenario.fico !== null && scenario.fico < 680) {
    const overlay = additional.loan_purpose_fico_lt_680_overlay[scenario.purpose];
    if (overlay) {
      const overlayLlpa = lookupCell(overlay, ltvBand);
      if (overlayLlpa === "NA") return { eligible: false, reason: `${scenario.purpose} with FICO < 680 not allowed at LTV ${scenario.ltv}%` };
      breakdown.loan_purpose_fico_lt_680 = overlayLlpa;
      llpaValues.push(overlayLlpa);
    }
  }

  // Property type
  if (additional.property_type) {
    const propertyLlpa = lookupCell(additional.property_type[scenario.property_type], ltvBand);
    if (propertyLlpa === "NA") return { eligible: false, reason: `Property type '${scenario.property_type}' not allowed at LTV ${scenario.ltv}%` };
    breakdown.property_type = propertyLlpa;
    llpaValues.push(propertyLlpa);
  }

  // FL Condo overlay (Cake or AmWest both have this)
  if (scenario.state === "FL" && (scenario.property_type === "condo_warrantable" || scenario.property_type === "condo_non_warrantable")) {
    const flCondoCake = additional.property_type && additional.property_type.fl_condo_overlay;
    const flCondoAmwest = additional.property_type && additional.property_type.florida_condo_overlay;
    const flCondoGrid = flCondoCake || flCondoAmwest;
    if (flCondoGrid) {
      const flCondoLlpa = lookupCell(flCondoGrid, ltvBand);
      if (flCondoLlpa !== "NA") {
        breakdown.fl_condo_overlay = flCondoLlpa;
        llpaValues.push(flCondoLlpa);
      }
    }
  }

  // Prepay penalty LLPA — supports both flat all_ltvs (Cake/AmWest) and per-LTV (LoanStream)
  if (scenario.prepay_term && additional.prepay_penalty_llpa) {
    const prepayKey = `${scenario.prepay_term}_prepay`.replace("no_prepay_prepay", "no_prepay");
    const prepayEntry = additional.prepay_penalty_llpa[prepayKey];
    if (prepayEntry) {
      let prepayLlpa;
      if (prepayEntry.all_ltvs !== undefined) {
        prepayLlpa = prepayEntry.all_ltvs;  // Cake/AmWest flat structure
      } else {
        prepayLlpa = lookupCell(prepayEntry, ltvBand);  // LoanStream per-LTV structure
      }
      if (prepayLlpa === "NA") return { eligible: false, reason: `Prepay term '${scenario.prepay_term}' not allowed at LTV ${scenario.ltv}%` };
      if (prepayLlpa !== undefined && prepayLlpa !== 0) {
        breakdown.prepay_penalty_llpa = prepayLlpa;
        llpaValues.push(prepayLlpa);
      }
    }
  }

  // Michigan prepay overlay
  if (scenario.state === "MI" && scenario.prepay_term && additional.michigan_prepay_overlay) {
    const miKey = scenario.prepay_term === "one_year" ? "1_year_ppp" :
                  scenario.prepay_term === "two_year" ? "2_year_ppp" :
                  scenario.prepay_term === "three_year" ? "3_year_ppp" : null;
    if (miKey && additional.michigan_prepay_overlay[miKey]) {
      breakdown.michigan_prepay_overlay = additional.michigan_prepay_overlay[miKey].all_ltvs;
      llpaValues.push(additional.michigan_prepay_overlay[miKey].all_ltvs);
    }
  }

  // NY state overlay (AmWest)
  if (scenario.state === "NY" && additional.state_overlay && additional.state_overlay.ny) {
    breakdown.ny_overlay = additional.state_overlay.ny.all_ltvs;
    llpaValues.push(additional.state_overlay.ny.all_ltvs);
  }

  // State tier overlay (LoanStream) — 3-tier state classification
  // Each tier has a flat LLPA applied to all LTVs based on which tier
  // the borrower's state falls into.
  if (additional.state_tier_overlay && scenario.state) {
    const tier = additional.state_tier_overlay;
    let tierLlpa = null;
    let tierName = null;
    if (Array.isArray(tier.tier_1_states) && tier.tier_1_states.includes(scenario.state)) {
      tierLlpa = tier.tier_1_llpa;
      tierName = "tier_1";
    } else if (Array.isArray(tier.tier_2_states) && tier.tier_2_states.includes(scenario.state)) {
      tierLlpa = tier.tier_2_llpa;
      tierName = "tier_2";
    } else if (Array.isArray(tier.tier_3_states) && tier.tier_3_states.includes(scenario.state)) {
      tierLlpa = tier.tier_3_llpa;
      tierName = "tier_3";
    }
    if (tierLlpa !== null && tierLlpa !== undefined && tierLlpa !== 0) {
      breakdown.state_tier_overlay = { tier: tierName, llpa: tierLlpa };
      llpaValues.push(tierLlpa);
    }
  }

  // Credit history
  if (scenario.credit_history && scenario.credit_history !== "clean" && additional.credit_history) {
    const historyLlpa = lookupCell(additional.credit_history[scenario.credit_history], ltvBand);
    if (historyLlpa === "NA") return { eligible: false, reason: `Credit history '${scenario.credit_history}' not allowed at LTV ${scenario.ltv}%` };
    breakdown.credit_history = historyLlpa;
    llpaValues.push(historyLlpa);
  }

  // Other (escrow waiver, state overlay) — Cake structure
  if (additional.other) {
    if (scenario.escrow_waiver) {
      const waiverKey = scenario.state === "NY" ? "escrow_waiver_ny_only" : "escrow_waiver_non_ny";
      if (additional.other[waiverKey]) {
        const waiverLlpa = lookupCell(additional.other[waiverKey], ltvBand);
        if (waiverLlpa === "NA") return { eligible: false, reason: `Escrow waiver not allowed at LTV ${scenario.ltv}% in ${scenario.state}` };
        breakdown.escrow_waiver = waiverLlpa;
        llpaValues.push(waiverLlpa);
      }
    }

    if (["GA", "NY", "FL"].includes(scenario.state) && additional.other.state_ga_ny_fl_overlay) {
      const stateLlpa = lookupCell(additional.other.state_ga_ny_fl_overlay, ltvBand);
      breakdown.state_overlay = stateLlpa;
      llpaValues.push(stateLlpa);
    }
  }

  const llpaSum = sumLlpas(llpaValues);
  if (llpaSum === "NA") return { eligible: false, reason: "An LLPA in the stack returned NA" };

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

function applyCompensation(wholesalePriceResult, scenario, compConfig) {
  if (!wholesalePriceResult.eligible) return wholesalePriceResult;

  let compBps = compConfig.default_compensation.comp_bps;

  if (compConfig.compensation_by_loan_size) {
    for (const [band, override] of Object.entries(compConfig.compensation_by_loan_size)) {
      const parts = band.split("_to_");
      const minStr = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
      const maxStr = parts[1] && !parts[1].includes("plus") ? parseInt(parts[1].replace(/[^0-9]/g, ""), 10) : 999999999;
      if (scenario.loan_amount >= minStr && scenario.loan_amount <= maxStr) {
        compBps = override.comp_bps;
        break;
      }
    }
  }

  if (compConfig.compensation_by_state && compConfig.compensation_by_state[scenario.state]) {
    compBps = compConfig.compensation_by_state[scenario.state].comp_bps;
  }

  if (compBps > compConfig.federal_max_comp_bps) compBps = compConfig.federal_max_comp_bps;

  const compAsPoints = compBps / 100;
  const borrowerFacingPrice = Math.round((wholesalePriceResult.wholesale_price + compAsPoints) * 10000) / 10000;

  return Object.assign({}, wholesalePriceResult, {
    comp_bps: compBps,
    comp_as_points: compAsPoints,
    borrower_facing_price: borrowerFacingPrice
  });
}

// ============================================================================
// MAX PRICE CAP ENFORCEMENT
// ============================================================================

// Map our scenario.prepay_term strings ("five_year") to the JSON key format ("5_year_prepay")
const PREPAY_TERM_TO_CAP_KEY = {
  'five_year':  '5_year_prepay',
  'four_year':  '4_year_prepay',
  'three_year': '3_year_prepay',
  'two_year':   '2_year_prepay',
  'one_year':   '1_year_prepay',
  'no_prepay':  'no_prepay'
};

function enforceMaxPriceCap(pricedResult, scenario, program) {
  if (!pricedResult.eligible) return pricedResult;

  const caps = program.max_price_caps || {};

  // ============================================================
  // FLOOR-BASED CAP (max rebate cap)
  //
  // Pricing convention: positive final_price = cost to borrower,
  //                     negative final_price = lender rebate.
  //
  // investor_max_price (e.g., 103.0) is the max WHOLESALE PRICE the lender
  // will offer = max 3.0 points rebate above par. In our convention this
  // is a FLOOR at -3.0 (final_price can't go more negative than that).
  //
  // ppp_buydown_max_price_caps values are already expressed as floors in
  // our convention (e.g., -3.0 for 5-year PPP allows 3 points rebate;
  // -1.0 for no_prepay only allows 1 point rebate). The lender offers
  // MORE rebate (more negative floor) for longer PPPs.
  // ============================================================

  let globalFloor = -999;
  if (scenario.occupancy === "non_owner_occupied") {
    if (caps.investor_max_price !== undefined) {
      globalFloor = -(caps.investor_max_price - 100);
    } else if (caps.investor_max_price_default !== undefined) {
      globalFloor = -(caps.investor_max_price_default - 100);
    }
  } else if (caps.owner_occupied_or_2nd_home_max_price !== undefined) {
    globalFloor = -(caps.owner_occupied_or_2nd_home_max_price - 100);
  }

  let pppFloor = -999;
  const ppKey = scenario.prepay_term ? PREPAY_TERM_TO_CAP_KEY[scenario.prepay_term] : null;
  const ppCaps = ppKey && caps.ppp_buydown_max_price_caps && caps.ppp_buydown_max_price_caps[ppKey];
  if (ppCaps) {
    const k = scenario.purpose === "cash_out_refi" ? "max_price_cashout" : "max_price_purch_rt";
    if (typeof ppCaps[k] === "number") {
      pppFloor = ppCaps[k];
    }
  }

  // Effective floor: less negative = stricter
  const effectiveFloor = Math.max(globalFloor, pppFloor);

  let finalPrice = pricedResult.borrower_facing_price;
  let wasCapped = false;
  if (finalPrice < effectiveFloor) {
    finalPrice = effectiveFloor;
    wasCapped = true;
  }

  return Object.assign({}, pricedResult, {
    effective_max_price_cap: effectiveFloor,
    final_price: finalPrice,
    was_capped: wasCapped
  });
}

// ============================================================================
// MAIN: PRICE A SCENARIO ACROSS THE FULL RATE LADDER
// ============================================================================

function priceScenarioFullLadder(scenario, program, compConfig) {
  const eligibility = checkEligibility(scenario, program);
  if (!eligibility.eligible) {
    return {
      eligible: false,
      reason: eligibility.reason,
      lender_id: program.lender_id,
      program_id: program.program_id
    };
  }

  const ladder = [];
  for (const rateStr of Object.keys(program.base_rate_table)) {
    if (rateStr.startsWith("_")) continue;
    const rate = parseFloat(rateStr);
    const wholesale = computeWholesalePriceAtRate(rate, scenario, program);
    if (!wholesale.eligible) continue;

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
// TIER BUILDER
// ============================================================================

function buildTiers(ladderResult, loanAmount) {
  if (!ladderResult.eligible) return ladderResult;

  const ladder = ladderResult.ladder;

  const actualPrices = ladder.map(entry => Object.assign({}, entry, {
    actual_price: 100 + entry.final_price
  }));

  const lightning = actualPrices.reduce((lowest, entry) =>
    entry.note_rate < lowest.note_rate ? entry : lowest, actualPrices[0]);

  const bolt = actualPrices.reduce((highest, entry) =>
    entry.note_rate > highest.note_rate ? entry : highest, actualPrices[0]);

  const thunder = actualPrices.reduce((closest, entry) => {
    const closestDiff = Math.abs(closest.actual_price - 100);
    const entryDiff = Math.abs(entry.actual_price - 100);
    return entryDiff < closestDiff ? entry : closest;
  }, actualPrices[0]);

  const enrichTier = (entry, label) => {
    const costAdjustment = entry.final_price;
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
    bolt: enrichTier(bolt, "Bolt"),
    thunder: enrichTier(thunder, "Thunder"),
    lightning: enrichTier(lightning, "Lightning"),
    full_ladder: actualPrices
  };
}

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
  getFicoBand,
  getFicoBandAmwest,
  getFicoBandForProgram,
  getLtvBandCake,
  getLtvBandAmwest,
  getLtvBand,
  getDscrBand,
  getLoanSizeBand,
  getDscrFicoAdjustmentKey,
  calculateMonthlyPayment
};
