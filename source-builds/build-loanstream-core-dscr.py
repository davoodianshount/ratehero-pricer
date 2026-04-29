#!/usr/bin/env python3
"""
LoanStream Core DSCR (>=1.20) — Source-to-JSON Build Script
=============================================================
Source: loanstream_pricer.pdf, page 2 (DSCR program)
Effective Date: Thu, April 23, 2026 06:48 PT
Distribution Date: 2026-04-23

Convention Conversion:
  LoanStream rate sheet uses STANDARD wholesale price convention:
    - price > 100 = above par = lender pays borrower rebate
    - price < 100 = below par = borrower pays cost
    - LLPAs are ADDED to base price; positive LLPA = price improvement = good for borrower
    - Negative LLPA = price reduction = bad for borrower (more cost)

  Our engine uses DP (discount points) convention:
    - positive final_price = cost to borrower
    - negative final_price = rebate to borrower
    - LLPAs additive to base; positive LLPA = penalty (more cost), negative = discount

  Conversion rules:
    - base_rate_table values: our_value = 100 - loanstream_price
    - All LLPA values: our_value = -loanstream_value
    - "NA" stays "NA"
"""

import json
from pathlib import Path


# =============================================================================
# RAW DATA — exactly as they appear in LoanStream rate sheet (page 2, DSCR)
# =============================================================================

# Base rate table — DSCR column on page 2
# Rate -> wholesale price (LoanStream convention)
LS_BASE_PRICE = {
    "5.875": 97.538,
    "5.999": 98.288,
    "6.125": 98.913,
    "6.250": 99.350,
    "6.375": 99.726,
    "6.499": 100.226,
    "6.625": 100.694,
    "6.750": 101.132,
    "6.875": 101.554,
    "6.999": 101.960,
    "7.125": 102.335,
    "7.250": 102.710,
    "7.375": 103.085,
    "7.499": 103.429,
    "7.625": 103.741,
    "7.750": 104.022,
    "7.875": 104.304,
    "7.999": 104.585,
    "8.125": 104.866,
    "8.250": 105.147,
    "8.375": 105.429,
    "8.499": 105.710,
    "8.625": 105.960,
    "8.750": 106.210,
    "8.875": 106.460,
    "8.999": 106.710,
    "9.125": 106.960,
    "9.250": 107.085,
    "9.375": 107.210,
    "9.499": 107.335,
    "9.625": 107.460,
    "9.750": 107.585,
    "9.875": 107.710,
    "9.999": 107.835,
    "10.125": 107.960,
    "10.250": 108.085,
    "10.375": 108.210,
    "10.499": 108.335,
    "10.625": 108.460,
    "10.750": 108.585,
}

# LTV bands order (matches columns on rate sheet)
LTV_BANDS = ["lte_50", "50_55", "55_60", "60_65", "65_70", "70_75", "75_80", "80_85"]

# FICO/LTV grid — DSCR program
# Each FICO row has 8 LTV column values
FICO_LTV_GRID_LS = {
    "780_plus":  [ 1.275,  1.150,  1.025,  1.000,  0.625,  0.550, -0.625, -2.500],
    "760_779":   [ 1.150,  1.000,  1.000,  0.850,  0.500,  0.425, -0.875, -2.750],
    "740_759":   [ 1.000,  0.875,  0.875,  0.713,  0.400,  0.213, -1.000, -3.000],
    "720_739":   [ 0.875,  0.750,  0.750,  0.650,  0.025, -0.100, -1.875, -3.500],
    "700_719":   [ 0.500,  0.250, -0.250,  0.025, -0.250, -1.000, -2.625,   "NA"],
    "680_699":   [ 0.250, -0.125, -0.125, -0.250, -0.850, -1.500, -3.375,   "NA"],
    "660_679":   [-0.250, -0.250, -0.750, -1.250, -1.975, -2.600,   "NA",   "NA"],
    "640_659":   [-0.900, -1.250, -1.650, -1.875, -2.875, -3.625,   "NA",   "NA"],
    "620_639":   [-2.000, -2.250, -2.400, -2.875, -3.625,   "NA",   "NA",   "NA"],
}

# Program LLPA — Core DSCR (>=1.20)
PROGRAM_CORE_DSCR_GTE_1_20_LS = [0.500, 0.500, 0.500, 0.500, 0.500, 0.500, "NA", "NA"]

# Loan Purpose LLPAs (8 LTV bands)
PURPOSE_LS = {
    "purchase":          [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "rate_term_refi":    [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000, -0.250, -0.500],
    "cash_out_refi":     [-0.125, -0.250, -0.375, -0.500, -0.500, -0.750,   "NA",   "NA"],
}

# Additional FICO < 680 overlay for refis (applied IN ADDITION to base purpose LLPA)
PURPOSE_FICO_LT_680_LS = {
    "rate_term_refi":    [-0.250, -0.250, -0.250, -0.250, -0.250, -0.250, -0.375,   "NA"],
    "cash_out_refi":     [-0.500, -0.500, -0.625, -0.750, -0.750, -1.000,   "NA",   "NA"],
}

# Prepay penalty LLPAs (8 LTV bands).
# Note: LoanStream has TWO no_prepay rows — one for "states not allowed" (where prepay is
# legally restricted; lender treats no-prepay as the only option, so smaller penalty)
# and one for "states that DO allow" prepay (where borrower CHOSE no-prepay; bigger penalty
# because lender lost optionality).
# We use "states_allowed" since most of our investor loans are in prepay-allowed states.
#
# Key naming uses English word form (one_year_prepay, etc.) to match the engine's
# lookup key construction: `${scenario.prepay_term}_prepay`.
PREPAY_LS = {
    "no_prepay":          [-1.750, -1.750, -1.750, -1.750, -1.750, -1.750, -1.750, -2.000],  # most common
    "one_year_prepay":    [-1.000, -1.000, -1.000, -1.000, -1.000, -1.000, -1.000, -1.000],
    "two_year_prepay":    [-0.500, -0.500, -0.500, -0.500, -0.500, -0.750, -0.750, -0.750],
    "three_year_prepay":  [ 0.250,  0.125,  0.125,  0.125,  0.125,  0.125,  0.125,  0.063],
    "four_year_prepay":   [ 0.375,  0.250,  0.250,  0.250,  0.250,  0.250,  0.250,  0.125],
    "five_year_prepay":   [ 0.750,  0.625,  0.625,  0.625,  0.625,  0.625,  0.625,  0.500],
}

# State Tier system (single LLPA per tier, applies to all LTVs)
TIER_1_STATES = ["AZ", "CA", "CO", "CT", "GA", "HI", "MA", "MD", "NJ", "NV", "OR", "SC", "UT", "VA", "WA"]
TIER_2_STATES = ["DC", "FL", "ID", "IL", "IN", "LA", "MI", "MN", "MO", "NC", "OH", "OK", "PA", "RI", "TN", "TX"]
TIER_3_STATES = ["AK", "AL", "AR", "DE", "IA", "KS", "KY", "ME", "MS", "MT", "ND", "NE", "NH", "NM", "SD", "VT", "WI", "WV", "WY"]
STATE_TIER_LLPA_LS = {
    "tier_1": 0.000,    # No adjustment
    "tier_2": -0.150,   # -0.150 in LS convention = price reduction (cost in our convention)
    "tier_3": -0.250,   # -0.250 in LS convention
}

# Max Price (LoanStream convention — wholesale price ceilings)
MAX_PRICE_LS = {
    "owner_or_2nd_home":  102.000,
    "investor_default":   102.000,  # LS doesn't publish separate investor cap; uses same
    "no_prepay":          100.000,  # No rebate allowed for No PPP
    "12_months_ppp":      101.500,
    "24_months_ppp":      102.000,
    "36_to_60_months_ppp":102.500,
    "subord_financing":   100.000,
    "itin_foreign_natl":  101.000,
    "ltv_above_80":       101.000,
    "loan_above_2_5m":    101.000,
    "min_price":          95.000,   # Floor (worst price = max cost)
}


# =============================================================================
# CONVENTION CONVERSION HELPERS
# =============================================================================

def flip(value):
    """Sign-flip a single value. NA stays NA."""
    if value == "NA":
        return "NA"
    return round(-value, 4)


def flip_row_to_grid(values):
    """Sign-flip a row of 8 LTV values and zip with band names."""
    return {LTV_BANDS[i]: flip(values[i]) for i in range(len(values))}


# =============================================================================
# BUILD JSON
# =============================================================================

# Base rate table: 100 - LS price
base_rate_table = {rate: round(100 - price, 4) for rate, price in LS_BASE_PRICE.items()}

# FICO/LTV grid: negate every cell
fico_ltv_grid = {fico: flip_row_to_grid(row) for fico, row in FICO_LTV_GRID_LS.items()}

# Program LLPA (Core DSCR >=1.20): negate
program_overlay = flip_row_to_grid(PROGRAM_CORE_DSCR_GTE_1_20_LS)

# Loan purpose LLPAs: negate
loan_purpose = {p: flip_row_to_grid(v) for p, v in PURPOSE_LS.items()}

# FICO < 680 overlay
loan_purpose_fico_lt_680 = {p: flip_row_to_grid(v) for p, v in PURPOSE_FICO_LT_680_LS.items()}

# Prepay LLPAs (per-LTV — first per-LTV prepay structure in our system)
prepay_penalty_llpa = {term: flip_row_to_grid(values) for term, values in PREPAY_LS.items()}

# State tier overlay
state_tier_overlay = {
    "tier_1_states": TIER_1_STATES,
    "tier_1_llpa": flip(STATE_TIER_LLPA_LS["tier_1"]),
    "tier_2_states": TIER_2_STATES,
    "tier_2_llpa": flip(STATE_TIER_LLPA_LS["tier_2"]),
    "tier_3_states": TIER_3_STATES,
    "tier_3_llpa": flip(STATE_TIER_LLPA_LS["tier_3"]),
}

# Max price caps: LoanStream stores wholesale price ceilings (above 100). Our engine
# converts these (via investor_max_price - 100, then negated to get DP floor).
# We can keep them in LoanStream format here; the engine handles conversion.
max_price_caps = {
    "_README": (
        "LoanStream caps in standard wholesale price format. Engine converts: "
        "globalFloor = -(investor_max_price - 100). PPP buydown caps already "
        "expressed in our DP convention (negative = max rebate)."
    ),
    "investor_max_price_default": MAX_PRICE_LS["investor_default"],
    "owner_occupied_or_2nd_home_max_price": MAX_PRICE_LS["owner_or_2nd_home"],
    "min_price": MAX_PRICE_LS["min_price"],

    "ppp_buydown_max_price_caps": {
        # Engine expects negative DP-convention floors here.
        # Convert: dp_floor = -(loanstream_price - 100)
        "no_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["no_prepay"] - 100), 4),  # 0.0 (no rebate)
            "max_price_cashout":  round(-(MAX_PRICE_LS["no_prepay"] - 100), 4),
        },
        "1_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["12_months_ppp"] - 100), 4),  # -1.5
            "max_price_cashout":  round(-(MAX_PRICE_LS["12_months_ppp"] - 100), 4),
        },
        "2_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["24_months_ppp"] - 100), 4),  # -2.0
            "max_price_cashout":  round(-(MAX_PRICE_LS["24_months_ppp"] - 100), 4),
        },
        "3_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),  # -2.5
            "max_price_cashout":  round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),
        },
        "4_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),
        },
        "5_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_LS["36_to_60_months_ppp"] - 100), 4),
        },
    },

    "additional_overlays_pending_phase_1b": {
        "subord_financing": MAX_PRICE_LS["subord_financing"],
        "itin_foreign_natl": MAX_PRICE_LS["itin_foreign_natl"],
        "ltv_above_80": MAX_PRICE_LS["ltv_above_80"],
        "loan_above_2_5m": MAX_PRICE_LS["loan_above_2_5m"],
    }
}


# =============================================================================
# ASSEMBLE FULL JSON
# =============================================================================

data = {
    "_README": (
        "LoanStream Mortgage — Core DSCR (>=1.20) program. Source: rate sheet PDF "
        "page 2 dated 2026-04-23. Built by build-loanstream-core-dscr.py. "
        "PRICING CONVENTION: This JSON has been sign-flipped from the LoanStream "
        "rate sheet to match the Rate Hero engine's DP convention (positive = cost "
        "to borrower). DO NOT use raw LoanStream values without re-running the "
        "build script — manual edits will introduce inversion bugs."
    ),

    "lender_id": "loanstream",
    "lender_display_name": "LoanStream Mortgage",
    "lender_nmls": "129932",
    "program_id": "loanstream_core_dscr_gte_1_20",
    "program_display_name_internal": "Core DSCR (>=1.20)",
    "program_category": "dscr",
    "rate_sheet_source_page": 2,
    "rate_sheet_date": "2026-04-23",
    "rate_sheet_time_pt": "06:48",
    "rate_sheet_lock_cutoff_pt": "17:00",
    "rate_sheet_filename_when_imported": "loanstream_pricer.pdf",
    "schema_version": "3.0",
    "verification_status": "phase_1a_2026_04_28_phase_1b_pending",

    "_pricing_convention_note": (
        "LoanStream rate sheet uses STANDARD wholesale price convention "
        "(price above 100 = lender rebate). Rate Hero engine uses DP convention "
        "(positive = cost). All values in this JSON have been NEGATED from the "
        "source rate sheet. base_rate_table = 100 - rate_sheet_price; LLPAs negated."
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
        "min_fico": 620,
        "max_fico": 850,
        "no_score_allowed": False,
        "min_loan": 150000,
        "max_loan": 4000000,
        "min_dscr": 1.20,
        "max_ltv_purchase": 75,
        "max_ltv_rate_term_refi": 75,
        "max_ltv_cashout": 70,
        "interest_only_allowed": False,
        "arm_allowed": False,
        "occupancy_allowed": ["non_owner_occupied"],
        "property_types_allowed": ["sfr", "two_unit", "three_four_unit",
                                   "condo_warrantable", "condo_non_warrantable"],
        "borrower_types_allowed": ["us_citizen", "permanent_resident",
                                   "foreign_national", "itin"],
        "foreign_national_min_dscr": 1.20,
        "foreign_national_min_fico_pricing": 700,
        "states_excluded_for_program": ["CA", "AZ", "ID", "MN", "NV", "ND", "OR", "UT", "VT"],
        "states_pending_licensing": {
            "CA": {"estimated_approval_date": "2026-08", "_note": "Rate Hero CA license expected ~Aug 2026"}
        },
        "states_no_prepay_allowed": [],
        "states_prepay_allowed_above_loan_amount": {},
        "min_dscr_for_1x30x12_history": 1.20,
    },

    "base_rate_table": base_rate_table,

    "fico_ltv_adjustments": {
        "fico_bands": ["780_plus", "760_779", "740_759", "720_739", "700_719",
                       "680_699", "660_679", "640_659", "620_639"],
        "ltv_bands": LTV_BANDS,
        "grid": fico_ltv_grid
    },

    "additional_llpas": {
        "program_overlay": program_overlay,
        "loan_purpose": loan_purpose,
        "loan_purpose_fico_lt_680_overlay": loan_purpose_fico_lt_680,
        "prepay_penalty_llpa": prepay_penalty_llpa,
        "state_tier_overlay": state_tier_overlay
    },

    "max_price_caps": max_price_caps,

    "_phase_1b_pending": [
        "loan_amount LLPA (11 size bands)",
        "property/units LLPA (NOO, 2nd, NW Condo, STR, 2-unit, 3-4 unit)",
        "subordinate_financing LLPA",
        "interest-only and ARM products",
        "escrow_waived LLPA",
        "ITIN LLPA",
        "foreign_national LLPA",
        "payment history (0x30x12, 1x30x12, etc.)",
        "credit events (12/24/36/48 months)",
        "DSCR 5-8 unit pricing column",
        "other DSCR programs: Core >=1.00, Sub1, No Ratio, Fusion",
        "lock term LLPA (45-day, 60-day)",
        "additional max-price overlay enforcement (subord, ITIN, LTV>80, jumbo)",
    ]
}


# =============================================================================
# WRITE JSON
# =============================================================================

if __name__ == "__main__":
    output_path = Path(__file__).resolve().parent.parent / "lenders" / "loanstream" / "loanstream-core-dscr.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"✓ Wrote {output_path}")
    print(f"  - {len(base_rate_table)} rates in ladder")
    print(f"  - {len(fico_ltv_grid)} FICO bands × {len(LTV_BANDS)} LTV bands = "
          f"{len(fico_ltv_grid) * len(LTV_BANDS)} cells")
    print(f"  - {len(loan_purpose)} purpose LLPAs")
    print(f"  - {len(prepay_penalty_llpa)} prepay LLPAs")
    print(f"  - 3 state tiers ({len(TIER_1_STATES)}+{len(TIER_2_STATES)}+{len(TIER_3_STATES)} states)")
