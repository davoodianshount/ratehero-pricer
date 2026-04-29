#!/usr/bin/env python3
"""
Change Lending — Investor DSCR Program — Source-to-JSON Build Script
=====================================================================
Source: Change_rate_sheet.pdf, page 4 (Investor DSCR Program)
Effective Date: 2026-04-28
Lender NMLS: 1839 (Change Lending LLC)

Convention Conversion:
  Change rate sheet uses STANDARD wholesale price convention:
    - price > 100 = above par = lender pays borrower rebate
    - price < 100 = below par = borrower pays cost
    - LLPAs added to base price; positive LLPA = price improvement (good for borrower)
    - Negative LLPA = price reduction (bad for borrower / more cost)
    - Same convention as LoanStream

  Our engine uses DP (discount points) convention (positive = cost).
  All values are negated; base_rate_table = 100 - rate_sheet_price.
"""

import json
from pathlib import Path


# =============================================================================
# RAW DATA — page 4 of Change_rate_sheet.pdf (Investor DSCR Program)
# =============================================================================

# Base rate table — Fixed 30 YR column on page 4
# Rate -> wholesale price (Change convention, standard wholesale)
CHANGE_BASE_PRICE = {
    "5.750": 95.746,
    "5.875": 96.496,
    "5.990": 97.246,
    "6.000": 97.246,
    "6.125": 97.933,
    "6.250": 98.621,
    "6.375": 99.309,
    "6.490": 99.934,
    "6.500": 99.934,
    "6.625": 100.559,
    "6.750": 101.121,
    "6.875": 101.684,
    "6.990": 102.184,
    "7.000": 102.184,
    "7.125": 102.684,
    "7.250": 103.121,
    "7.375": 103.559,
    "7.490": 103.934,
    "7.500": 103.934,
    "7.625": 104.309,
    "7.750": 104.621,
    "7.875": 104.934,
    "7.990": 105.246,
    "8.000": 105.246,
    "8.125": 105.559,
    "8.250": 105.840,
    "8.375": 106.090,
    "8.490": 106.340,
    "8.500": 106.340,
    "8.625": 106.590,
}

# LTV bands (8 bands, Cake-style with 80_85)
LTV_BANDS = ["lte_50", "50_55", "55_60", "60_65", "65_70", "70_75", "75_80", "80_85"]

# CLTV/FICO LLPA grid (7 FICO bands × 8 LTV bands)
# Note: 640-659 and 620-639 rows are entirely NA on the Investor DSCR program
FICO_LTV_GRID_CHANGE = {
    "780_plus":  [ 1.000,  0.875,  0.750,  0.625,  0.375, -0.375, -1.000, -2.375],
    "760_779":   [ 0.875,  0.750,  0.625,  0.500,  0.250, -0.500, -1.000, -2.625],
    "740_759":   [ 0.750,  0.625,  0.500,  0.375,  0.125, -0.500, -1.125, -2.875],
    "720_739":   [ 0.625,  0.500,  0.375,  0.250,  0.000, -0.625, -1.250,   "NA"],
    "700_719":   [ 0.375,  0.375,  0.250,  0.000, -0.250, -1.125, -1.500,   "NA"],
    "680_699":   [ 0.125, -0.250, -0.625, -0.625, -1.375, -1.625,   "NA",   "NA"],
    "660_679":   [-0.125, -0.500, -0.875, -1.125, -1.625,   "NA",   "NA",   "NA"],
}

# Loan Balance LLPAs (3 size bands × 8 LTV bands)
LOAN_BALANCE_CHANGE = {
    "lte_250k":          [-0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.250],
    "250k_to_1_5m":      [ 0.125,  0.125,  0.125,  0.125,  0.125,  0.125,  0.000, -0.375],
    "gt_1_5m":           [-0.250, -0.250, -0.250, -0.250, -0.375, -0.500, -0.750,   "NA"],
}

# Loan Type LLPAs (purpose etc., 8 LTV bands)
LOAN_TYPE_CHANGE = {
    "interest_only":     [-0.125, -0.125, -0.250, -0.250, -0.250, -0.250, -0.250,   "NA"],
    "escrow_waiver":     [-0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125,   "NA"],
    "purchase":          [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "cash_out_refi":     [-0.375, -0.375, -0.375, -0.375, -0.375, -0.500,   "NA",   "NA"],
    "rate_term_refi":    [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,   "NA"],
}

# Property Type LLPAs (incl FL Condo overlay and Short Term Rental)
PROPERTY_TYPE_CHANGE = {
    "condo_warrantable":     [-0.125, -0.125, -0.250, -0.250, -0.375, -0.500,   "NA",   "NA"],
    "multi_unit":            [-0.250, -0.250, -0.250, -0.250, -0.250, -0.250, -0.250,   "NA"],
    "condo_non_warrantable": [-0.375, -0.375, -0.500, -0.500, -0.625, -0.750,   "NA",   "NA"],
    "fl_condo_overlay":      [ 0.000, -0.125, -0.125, -0.250, -0.250,   "NA", -0.400,   "NA"],
    "short_term_rental":     [-0.250, -0.250, -0.250, -0.250, -0.250, -0.400, -0.400,   "NA"],
}

# Prepay Penalty LLPAs (per-LTV — like LoanStream)
PREPAY_CHANGE = {
    "no_prepay":         [-1.500, -1.500, -1.500, -1.500, -1.750, -1.750, -1.750, -1.750],
    "one_year_prepay":   [-0.500, -0.500, -0.500, -0.500, -0.750, -0.750, -0.750, -0.875],
    "two_year_prepay":   [ 0.375,  0.375,  0.375,  0.375,  0.375,  0.375,  0.000, -0.125],
    "three_year_prepay": [ 1.500,  1.500,  1.500,  1.500,  1.375,  1.375,  0.875,  0.875],
    "four_year_prepay":  [ 1.625,  1.625,  1.625,  1.625,  1.625,  1.625,  1.000,  1.000],
    "five_year_prepay":  [ 1.750,  1.750,  1.750,  1.750,  1.750,  1.625,  1.125,  1.125],
}

# DSCR LLPAs — 3 buckets, applied based on DSCR ratio
# DSCR 0.75-0.99: -2.000 (penalty in Change convention) → +2.000 in our convention
# DSCR 1.00-1.24: par (no adjustment)
# DSCR ≥ 1.25:    +0.250 to +0.375 (improvement) → -0.250 to -0.375 in our convention
DSCR_BUCKETS_CHANGE = {
    "dscr_0_75_to_0_99": [-2.000, -2.000, -2.000, -2.000, -2.000,   "NA",   "NA",   "NA"],
    "dscr_1_00_to_1_24": [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "dscr_gte_1_25":     [ 0.250,  0.250,  0.250,  0.375,  0.375,  0.375,  0.375,  0.375],
}

# Credit Event (single row — flat -0.250 across all LTVs for FC/SS/DIL/BK7 37-48mo)
CREDIT_EVENT_CHANGE = {
    "fc_ss_dil_bk7_37_48mo": [-0.250, -0.250, -0.250, -0.250, -0.250, -0.250, -0.250, -0.250],
}

# Max Price caps by prepay term (Change convention — wholesale price ceilings)
MAX_PRICE_CHANGE = {
    "no_prepay":          101.000,
    "one_year_ppp":       101.000,
    "two_year_ppp":       101.250,
    "three_to_five_ppp":  101.500,
    "min_price":          95.000,
}


# =============================================================================
# CONVENTION CONVERSION HELPERS
# =============================================================================

def flip(value):
    if value == "NA":
        return "NA"
    return round(-value, 4)


def flip_row_to_grid(values):
    return {LTV_BANDS[i]: flip(values[i]) for i in range(len(values))}


# =============================================================================
# BUILD JSON
# =============================================================================

# Base rate table
base_rate_table = {rate: round(100 - price, 4) for rate, price in CHANGE_BASE_PRICE.items()}

# FICO/LTV grid
fico_ltv_grid = {fico: flip_row_to_grid(row) for fico, row in FICO_LTV_GRID_CHANGE.items()}

# Loan Balance — store with bands metadata
loan_balance = {
    "_bands_definition_usd": {
        "lte_250k": {"min": 0, "max": 250000},
        "250k_to_1_5m": {"min": 250001, "max": 1500000},
        "gt_1_5m": {"min": 1500001, "max": 3000000}
    }
}
for band, row in LOAN_BALANCE_CHANGE.items():
    loan_balance[band] = flip_row_to_grid(row)

# Loan purpose (engine reads this section by scenario.purpose)
loan_purpose = {
    "purchase": flip_row_to_grid(LOAN_TYPE_CHANGE["purchase"]),
    "cash_out_refi": flip_row_to_grid(LOAN_TYPE_CHANGE["cash_out_refi"]),
    "rate_term_refi": flip_row_to_grid(LOAN_TYPE_CHANGE["rate_term_refi"]),
}

# Other loan-type LLPAs (interest only, escrow waiver) handled separately
loan_type_extra = {
    "interest_only": flip_row_to_grid(LOAN_TYPE_CHANGE["interest_only"]),
    "escrow_waiver": flip_row_to_grid(LOAN_TYPE_CHANGE["escrow_waiver"]),
}

# Property type (engine reads by scenario.property_type)
# Map Change's labels to the engine's property_type values
property_type = {
    "sfr": flip_row_to_grid([0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000]),  # baseline
    "condo_warrantable": flip_row_to_grid(PROPERTY_TYPE_CHANGE["condo_warrantable"]),
    "condo_non_warrantable": flip_row_to_grid(PROPERTY_TYPE_CHANGE["condo_non_warrantable"]),
    "two_unit": flip_row_to_grid(PROPERTY_TYPE_CHANGE["multi_unit"]),
    "three_four_unit": flip_row_to_grid(PROPERTY_TYPE_CHANGE["multi_unit"]),
    "fl_condo_overlay": flip_row_to_grid(PROPERTY_TYPE_CHANGE["fl_condo_overlay"]),
    "short_term_rental": flip_row_to_grid(PROPERTY_TYPE_CHANGE["short_term_rental"]),
}

# DSCR buckets — engine's getDscrBand needs to recognize Change's buckets
dscr_ratio = {bucket: flip_row_to_grid(row) for bucket, row in DSCR_BUCKETS_CHANGE.items()}

# Prepay (per-LTV)
prepay_penalty_llpa = {term: flip_row_to_grid(values) for term, values in PREPAY_CHANGE.items()}

# Credit event
credit_history = {
    "fc_ss_dil_bk7_37_48mo": flip_row_to_grid(CREDIT_EVENT_CHANGE["fc_ss_dil_bk7_37_48mo"]),
}

# Max Price caps in DP-convention (negative = max rebate floor)
max_price_caps = {
    "_README": (
        "Change publishes max price as wholesale-price ceilings. Engine converts to "
        "DP floors via -(price-100). PPP buydown caps already in DP convention here."
    ),
    "investor_max_price_default": MAX_PRICE_CHANGE["no_prepay"],  # 101.000 cap with No PPP
    "min_price": MAX_PRICE_CHANGE["min_price"],

    "ppp_buydown_max_price_caps": {
        "no_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["no_prepay"] - 100), 4),  # -1.0
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["no_prepay"] - 100), 4),
        },
        "1_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["one_year_ppp"] - 100), 4),  # -1.0
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["one_year_ppp"] - 100), 4),
        },
        "2_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["two_year_ppp"] - 100), 4),  # -1.25
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["two_year_ppp"] - 100), 4),
        },
        "3_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),  # -1.5
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),
        },
        "4_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),
        },
        "5_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_CHANGE["three_to_five_ppp"] - 100), 4),
        },
    },
}


# =============================================================================
# ASSEMBLE FULL JSON
# =============================================================================

data = {
    "_README": (
        "Change Lending — Investor DSCR Program. Source: Change_rate_sheet.pdf "
        "page 4 dated 2026-04-28. Built by build-change-investor-dscr.py. "
        "PRICING CONVENTION: This JSON has been sign-flipped from the Change "
        "rate sheet to match the Rate Hero engine's DP convention (positive = cost). "
        "DO NOT manually edit this JSON; re-run the build script if values need updating."
    ),

    "lender_id": "change",
    "lender_display_name": "Change Lending",
    "lender_nmls": "1839",
    "program_id": "change_investor_dscr",
    "program_display_name_internal": "Investor DSCR Program",
    "program_category": "dscr",
    "rate_sheet_source_page": 4,
    "rate_sheet_date": "2026-04-28",
    "rate_sheet_filename_when_imported": "Change_rate_sheet.pdf",
    "schema_version": "3.0",
    "verification_status": "phase_1a_2026_04_28_phase_1b_pending",

    "_pricing_convention_note": (
        "Change rate sheet uses STANDARD wholesale price convention "
        "(price above 100 = lender rebate). Same as LoanStream; opposite of Cake/AmWest. "
        "All values in this JSON have been NEGATED. base_rate_table = 100 - rate_sheet_price."
    ),

    "pricing_convention": {
        "type": "adjustment_from_par",
        "par": 100.0
    },

    "products_offered": {
        "30_year_fixed_amortizing": {
            "term_months": 360,
            "amortization": "fully_amortizing"
        }
    },

    "eligibility_rules": {
        "min_fico": 660,  # 640-659 and 620-639 rows are entirely NA on Investor DSCR
        "max_fico": 850,
        "no_score_allowed": False,
        "min_loan": 100000,  # No explicit minimum on rate sheet; using lender-typical floor
        "max_loan": 3500000,  # >$3.0M, <=$3.5M is the largest Loan Balance band on Alt-Doc Prime
        "min_dscr": 0.75,    # DSCR 0.75-0.99 still priceable with -2.000 LLPA
        "max_ltv_purchase": 80,
        "max_ltv_rate_term_refi": 80,
        "max_ltv_cashout": 75,  # Cash-out NA at 75-80, max LTV is one band lower
        "interest_only_allowed": True,
        "arm_allowed": False,  # 30Y fixed only for v1
        "occupancy_allowed": ["non_owner_occupied"],
        "property_types_allowed": ["sfr", "two_unit", "three_four_unit",
                                   "condo_warrantable", "condo_non_warrantable",
                                   "short_term_rental"],
        "borrower_types_allowed": ["us_citizen", "permanent_resident"],
        # Foreign National DSCR is a SEPARATE program at Change; see change-fn-dscr.json (Phase 1B)
        "states_excluded_for_program": ["CA", "AZ", "ID", "MN", "NV", "ND", "OR", "UT", "VT"],
        "states_pending_licensing": {
            "CA": {"estimated_approval_date": "2026-08", "_note": "Rate Hero CA license expected ~Aug 2026"}
        },
    },

    "base_rate_table": base_rate_table,

    "fico_ltv_adjustments": {
        "fico_bands": ["780_plus", "760_779", "740_759", "720_739", "700_719",
                       "680_699", "660_679"],
        "ltv_bands": LTV_BANDS,
        "grid": fico_ltv_grid
    },

    "additional_llpas": {
        "dscr_ratio": dscr_ratio,
        "loan_amount": loan_balance,
        "loan_purpose": loan_purpose,
        "property_type": property_type,
        "prepay_penalty_llpa": prepay_penalty_llpa,
        "credit_history": credit_history,
        "loan_type_extra": loan_type_extra,
    },

    "max_price_caps": max_price_caps,

    "_phase_1b_pending": [
        "Foreign National DSCR program (page 5) as separate change-fn-dscr.json",
        "Interest Only LLPA wiring (currently in loan_type_extra; engine needs to read it)",
        "Escrow Waiver LLPA wiring (currently in loan_type_extra)",
        "ARM products (5/6 SOFR, 10/6 SOFR)",
        "Lock term LLPA (currently 30-day implied; 5/10/15/20/30-day extensions exist)",
        "DTI > 50% LLPA (mentioned on Alt-Doc programs but unclear if applies to DSCR)",
    ]
}


# =============================================================================
# WRITE JSON
# =============================================================================

if __name__ == "__main__":
    output_path = Path(__file__).resolve().parent.parent / "lenders" / "change" / "change-investor-dscr.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"✓ Wrote {output_path}")
    print(f"  - {len(base_rate_table)} rates in ladder")
    print(f"  - {len(fico_ltv_grid)} FICO bands × {len(LTV_BANDS)} LTV bands = "
          f"{len(fico_ltv_grid) * len(LTV_BANDS)} cells")
    print(f"  - {len(LOAN_BALANCE_CHANGE)} loan balance bands")
    print(f"  - {len(loan_purpose)} purpose LLPAs")
    print(f"  - {len(prepay_penalty_llpa)} prepay LLPAs")
    print(f"  - {len(dscr_ratio)} DSCR buckets")
    print(f"  - {len(property_type)} property types (incl FL condo overlay + STR)")
