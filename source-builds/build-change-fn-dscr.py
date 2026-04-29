#!/usr/bin/env python3
"""
Change Lending — Foreign National DSCR Program — Source-to-JSON Build Script
=============================================================================
Source: Change rate sheet.pdf, page 5 (Foreign National DSCR Program)
Effective Date: 2026-04-28
Lender NMLS: 1839 (Change Lending LLC)

Convention Conversion:
  Change rate sheet uses STANDARD wholesale price convention (same as page 4
  Investor DSCR / LoanStream). Engine uses DP convention. All values negated;
  base_rate_table = 100 - rate_sheet_price.

Notes specific to this program:
  - This program has NO FICO-keyed LLPA grid on the rate sheet. The only FICO
    restriction is the program-level min_fico floor (encoded in eligibility_rules).
    fico_ltv_adjustments.grid is left empty; engine's defensive guards return 0.
  - The FN program publishes only 6 LTV bands (max LTV 75%); no 75-80 or 80-85.
  - The "LTV LLPA" row on the rate sheet is the FN program-level overlay,
    encoded as additional_llpas.program_overlay (mirrors LoanStream's pattern).
  - Loan Balance has only 2 published bands (UPB <=$250k, UPB >$2M); the
    middle range ($250k-$2M) is encoded as an explicit no-LLPA band so the
    engine resolves it cleanly rather than returning null and silently skipping.
  - DSCR has only ONE published bucket (DSCR >= 1.00 = 0). Sub-1.00 DSCR
    rejected upfront via foreign_national_min_dscr in eligibility_rules.
  - NW Condo and STR are NOT published on this program. Runtime ineligibility
    is enforced via explicit NA rows in additional_llpas.property_type (NOT via
    eligibility_rules.property_types_allowed, which is documentation only on
    this engine version — see _phase_1b_pending).
  - Interest Only and Escrow Waiver LLPAs published on rate sheet but OUT OF
    SCOPE per V1 SCOPE LOCK; not encoded.
  - Lock Extension Fees published but OUT OF SCOPE per V1; not encoded.
  - ARM columns (5/6 SOFR, 10/6 SOFR) ignored per V1; only Fixed 30 YR encoded.

Eligibility values not on the rate sheet (defaults; flag for AE confirmation):
  - min_fico: 680  (FN programs typically 680+; conservative default)
  - max_loan: 3,000,000  (>$2M LLPA implies cap above $2M; conservative)
  - min_loan: 150,000
"""

import json
from pathlib import Path


# =============================================================================
# RAW DATA — page 5 of Change rate sheet.pdf (Foreign National DSCR Program)
# =============================================================================

# Base rate table — Fixed 30 YR column on page 5
# Rate -> wholesale price (Change convention, standard wholesale)
CHANGE_FN_BASE_PRICE = {
    "6.490": 97.684,
    "6.500": 97.684,
    "6.625": 98.309,
    "6.750": 98.871,
    "6.875": 99.434,
    "6.990": 99.934,
    "7.000": 99.934,
    "7.125": 100.434,
    "7.250": 100.871,
    "7.375": 101.309,
    "7.490": 101.684,
    "7.500": 101.684,
    "7.625": 102.059,
    "7.750": 102.371,
    "7.875": 102.684,
    "7.990": 102.996,
    "8.000": 102.996,
    "8.125": 103.309,
    "8.250": 103.590,
    "8.375": 103.840,
    "8.490": 104.090,
    "8.500": 104.090,
    "8.625": 104.340,
    "8.750": 104.590,
    "8.875": 104.840,
    "8.990": 105.090,
    "9.000": 105.090,
    "9.125": 105.340,
    "9.250": 105.590,
}

# LTV bands — only 6 bands on this program (max LTV 75%)
LTV_BANDS = ["lte_50", "50_55", "55_60", "60_65", "65_70", "70_75"]

# Program-level "LTV LLPA" row (FN overlay applied to all FN borrowers).
LTV_LLPA_FN = [0.000, 0.000, 0.000, -0.250, -0.500, -1.000]

# Loan Balance LLPAs.
# Rate sheet publishes 2 bands; middle band ($250k-$2M) explicitly encoded
# at 0.000 so engine resolves the band cleanly.
LOAN_BALANCE_FN = {
    "lte_250k":   [-0.125, -0.125, -0.125, -0.125, -0.125, -0.125],
    "250k_to_2m": [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "gt_2m":      [-0.250, -0.250, -0.250, -0.250, -0.500, -0.750],
}

# Loan Type / Purpose LLPAs (Fixed 30 YR row).
# Cashout NA at 70.01-75 LTV (rate sheet "—" → "NA"; max cashout LTV = 70).
LOAN_PURPOSE_FN = {
    "purchase":          [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "cash_out_refi":     [-0.500, -0.500, -0.500, -0.500, -0.500,  "NA"],
    "rate_term_refi":    [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
}

# Property Type LLPAs.
# NW Condo and STR not published on this FN program → ineligible.
# Explicit NA rows are the runtime enforcement mechanism (engine doesn't read
# property_types_allowed at runtime — see _phase_1b_pending).
PROPERTY_TYPE_FN = {
    "condo_warrantable":      [-0.125, -0.125, -0.250, -0.250, -0.375, -0.500],
    "multi_unit":             [-0.250, -0.250, -0.250, -0.250, -0.250, -0.500],
    "fl_condo_overlay":       [ 0.000, -0.125, -0.125, -0.250, -0.250,  "NA"],
    "sfr_baseline":           [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
    "condo_non_warrantable":  [  "NA",  "NA",  "NA",  "NA",  "NA",  "NA"],
    "short_term_rental":      [  "NA",  "NA",  "NA",  "NA",  "NA",  "NA"],
}

# Prepay Penalty LLPAs (per-LTV grid; flat across LTVs on this program).
PREPAY_FN = {
    "no_prepay":         [-1.625, -1.625, -1.625, -1.625, -1.625, -1.625],
    "one_year_prepay":   [-0.750, -0.750, -0.750, -0.750, -0.750, -0.750],
    "two_year_prepay":   [-0.500, -0.500, -0.500, -0.500, -0.500, -0.500],
    "three_year_prepay": [ 0.125,  0.125,  0.125,  0.125,  0.125,  0.125],
    "four_year_prepay":  [ 0.375,  0.375,  0.375,  0.375,  0.375,  0.375],
    "five_year_prepay":  [ 0.625,  0.625,  0.625,  0.625,  0.625,  0.625],
}

# DSCR LLPAs — only one bucket on this program (DSCR >= 1.00 = 0).
# Sub-1.00 DSCR rejected via foreign_national_min_dscr=1.00 in eligibility_rules.
DSCR_BUCKETS_FN = {
    "dscr_gte_1_25":     [0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
    "dscr_1_00_to_1_24": [0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
    "dscr_0_75_to_0_99": [ "NA",  "NA",  "NA",  "NA",  "NA",  "NA"],
}

# Max Price caps by prepay term (Change convention — wholesale price ceilings)
MAX_PRICE_FN = {
    "no_prepay":          101.000,
    "one_year_ppp":       101.000,
    "two_year_ppp":       101.250,
    "three_to_five_ppp":  101.500,
    "min_price":           95.000,
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
base_rate_table = {rate: round(100 - price, 4) for rate, price in CHANGE_FN_BASE_PRICE.items()}

# Program overlay — the FN "LTV LLPA" row, sign-flipped
program_overlay = flip_row_to_grid(LTV_LLPA_FN)

# Loan Balance — store with bands metadata
loan_balance = {
    "_bands_definition_usd": {
        "lte_250k":   {"min": 0,       "max": 250000},
        "250k_to_2m": {"min": 250001,  "max": 2000000},
        "gt_2m":      {"min": 2000001, "max": 3000000},
    }
}
for band, row in LOAN_BALANCE_FN.items():
    loan_balance[band] = flip_row_to_grid(row)

# Loan Purpose
loan_purpose = {p: flip_row_to_grid(v) for p, v in LOAN_PURPOSE_FN.items()}

# Property Type
property_type = {
    "sfr": flip_row_to_grid(PROPERTY_TYPE_FN["sfr_baseline"]),
    "condo_warrantable": flip_row_to_grid(PROPERTY_TYPE_FN["condo_warrantable"]),
    "two_unit": flip_row_to_grid(PROPERTY_TYPE_FN["multi_unit"]),
    "three_four_unit": flip_row_to_grid(PROPERTY_TYPE_FN["multi_unit"]),
    "fl_condo_overlay": flip_row_to_grid(PROPERTY_TYPE_FN["fl_condo_overlay"]),
    "condo_non_warrantable": flip_row_to_grid(PROPERTY_TYPE_FN["condo_non_warrantable"]),
    "short_term_rental": flip_row_to_grid(PROPERTY_TYPE_FN["short_term_rental"]),
}

# DSCR buckets
dscr_ratio = {bucket: flip_row_to_grid(row) for bucket, row in DSCR_BUCKETS_FN.items()}

# Prepay (per-LTV)
prepay_penalty_llpa = {term: flip_row_to_grid(values) for term, values in PREPAY_FN.items()}

# Max Price caps in DP-convention (negative = max rebate floor)
max_price_caps = {
    "_README": (
        "Change publishes max price as wholesale-price ceilings. Engine converts to "
        "DP floors via -(price-100). PPP buydown caps already in DP convention here."
    ),
    "investor_max_price_default": MAX_PRICE_FN["no_prepay"],
    "min_price": MAX_PRICE_FN["min_price"],

    "ppp_buydown_max_price_caps": {
        "no_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["no_prepay"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["no_prepay"] - 100), 4),
        },
        "1_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["one_year_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["one_year_ppp"] - 100), 4),
        },
        "2_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["two_year_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["two_year_ppp"] - 100), 4),
        },
        "3_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
        },
        "4_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
        },
        "5_year_prepay": {
            "max_price_purch_rt": round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
            "max_price_cashout":  round(-(MAX_PRICE_FN["three_to_five_ppp"] - 100), 4),
        },
    },
}


# =============================================================================
# ASSEMBLE FULL JSON
# =============================================================================

data = {
    "_README": (
        "Change Lending — Foreign National DSCR Program. Source: Change rate sheet.pdf "
        "page 5 dated 2026-04-28. Built by build-change-fn-dscr.py. "
        "PRICING CONVENTION: Sign-flipped from standard wholesale to DP convention "
        "(positive = cost). DO NOT manually edit this JSON; re-run the build script. "
        "Note: this program has NO FICO-keyed LLPA grid on the rate sheet; min_fico "
        "is enforced as an eligibility floor only."
    ),

    "lender_id": "change",
    "lender_display_name": "Change Lending",
    "lender_nmls": "1839",
    "program_id": "change_fn_dscr",
    "program_display_name_internal": "Foreign National DSCR Program",
    "program_category": "dscr",
    "rate_sheet_source_page": 5,
    "rate_sheet_date": "2026-04-28",
    "rate_sheet_filename_when_imported": "Change rate sheet.pdf",
    "schema_version": "3.0",
    "verification_status": "phase_1a_2026_04_29_eligibility_floors_pending_ae_confirmation",

    "_pricing_convention_note": (
        "Change FN rate sheet uses STANDARD wholesale price convention "
        "(price above 100 = lender rebate). Same as Change Investor DSCR / LoanStream. "
        "All values NEGATED. base_rate_table = 100 - rate_sheet_price."
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
        "min_fico": 680,
        "max_fico": 850,
        "no_score_allowed": False,
        "min_loan": 150000,
        "max_loan": 3000000,
        "min_dscr": 1.00,
        "foreign_national_min_dscr": 1.00,
        "max_ltv_purchase": 75,
        "max_ltv_rate_term_refi": 75,
        "max_ltv_cashout": 70,
        "interest_only_allowed": False,
        "arm_allowed": False,
        "occupancy_allowed": ["non_owner_occupied"],
        "property_types_allowed": [
            "sfr",
            "two_unit",
            "three_four_unit",
            "condo_warrantable"
        ],
        "borrower_types_allowed": ["foreign_national"],
        "states_excluded_for_program": ["CA", "AZ", "ID", "MN", "NV", "ND", "OR", "UT", "VT"],
        "states_pending_licensing": {
            "CA": {"estimated_approval_date": "2026-08", "_note": "Rate Hero CA license expected ~Aug 2026"}
        },
        "states_no_prepay_allowed": ["AK", "DE", "KS", "MD", "MI", "NJ", "NH", "NM", "RI", "VT"],
        "states_prepay_allowed_above_loan_amount": {"OH": 112000},
    },

    "base_rate_table": base_rate_table,

    "fico_ltv_adjustments": {
        "_note": (
            "Change FN program has NO FICO-keyed LLPA grid on the rate sheet. "
            "FICO eligibility is enforced via eligibility_rules.min_fico = 680 only. "
            "Empty grid is intentional; engine returns 0 LLPA from this section."
        ),
        "fico_bands": [],
        "ltv_bands": LTV_BANDS,
        "grid": {}
    },

    "additional_llpas": {
        "program_overlay": program_overlay,
        "dscr_ratio": dscr_ratio,
        "loan_amount": loan_balance,
        "loan_purpose": loan_purpose,
        "property_type": property_type,
        "prepay_penalty_llpa": prepay_penalty_llpa,
    },

    "max_price_caps": max_price_caps,

    "_phase_1b_pending": [
        "Interest Only LLPA (published on rate sheet; OUT OF SCOPE in V1)",
        "Escrow Waiver LLPA (published on rate sheet; OUT OF SCOPE in V1)",
        "ARM products 5/6 SOFR, 10/6 SOFR (OUT OF SCOPE in V1)",
        "Lock-term extension fees (OUT OF SCOPE in V1)",
        "Engine should be updated to enforce property_types_allowed at eligibility filtering time (currently only enforced via NA values in additional_llpas.property_type)."
    ],

    "_pending_ae_confirmation": [
        "min_fico=680 default — confirm with Change AE; FN programs sometimes 700+",
        "max_loan=3,000,000 default — rate sheet has >$2M LLPA but no published cap",
        "min_loan=150,000 default — no explicit minimum on rate sheet"
    ]
}


# =============================================================================
# WRITE JSON
# =============================================================================

if __name__ == "__main__":
    output_path = Path(__file__).resolve().parent.parent / "lenders" / "change" / "change-fn-dscr.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"OK Wrote {output_path}")
    print(f"  - {len(base_rate_table)} rates in ladder")
    print(f"  - 0 FICO bands x {len(LTV_BANDS)} LTV bands (FN program has no FICO grid)")
    print(f"  - {len([k for k in loan_balance if not k.startswith('_')])} loan balance bands")
    print(f"  - {len(loan_purpose)} purpose LLPAs")
    print(f"  - {len(prepay_penalty_llpa)} prepay LLPAs")
    print(f"  - {len(dscr_ratio)} DSCR buckets (1 priceable + 1 NA)")
    print(f"  - {len(property_type)} property type entries (incl 2 NA-rows for ineligible types)")
    print(f"  - max LTV: 75% (no 75-80 or 80-85 bands)")
