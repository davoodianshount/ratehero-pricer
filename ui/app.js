/* ============================================================================
   Rate Hero Engine — Browser App v4
   Adds Purchase Price field, auto-calculates loan amount from price + down %
   ============================================================================ */

(function() {
  'use strict';

  // =========================================================================
  // EMBEDDED LENDER DATA + COMP CONFIG
  // =========================================================================

const CAKE_PROGRAM = {"_README":"Pound Cake DSCR \u2014 Cake Mortgage Corp. Source: rate sheet page 11, dated 4/27/2026 9:47 AM PT. v6 PATCH: OH prepay restriction is loan-amount-conditional, not absolute. OH allows PPP above $112K loan amount.","lender_id":"cake","lender_display_name":"Cake Mortgage Corp","lender_nmls":"1734623","program_id":"pound_cake_dscr","program_display_name_internal":"Pound Cake DSCR","program_category":"dscr","rate_sheet_source_page":11,"rate_sheet_date":"2026-04-27","rate_sheet_time_pt":"09:47","rate_sheet_lock_cutoff_pt":"17:00","rate_sheet_filename_when_imported":"Cake_Mortgage_Corp-04272026-0947am.pdf","schema_version":"6.0","verification_status":"fully_verified_2026_04_28","pricing_convention":{"type":"adjustment_from_par","par":100.0},"products_offered":{"30_year_fixed_amortizing":true},"base_rate_table":{"_format":"rate_pct: base_price_adjustment_from_par","10.625":-7.468,"10.500":-7.368,"10.375":-7.268,"10.250":-7.168,"10.125":-7.068,"10.000":-6.968,"9.875":-6.868,"9.750":-6.768,"9.625":-6.668,"9.500":-6.568,"9.375":-6.468,"9.250":-6.358,"9.125":-6.248,"9.000":-6.123,"8.875":-5.998,"8.750":-5.873,"8.625":-5.723,"8.500":-5.573,"8.375":-5.423,"8.250":-5.223,"8.125":-5.023,"8.000":-4.773,"7.875":-4.523,"7.750":-4.273,"7.625":-3.973,"7.500":-3.673,"7.375":-3.373,"7.250":-2.998,"7.125":-2.498,"7.000":-2.118,"6.875":-1.743,"6.750":-1.368,"6.625":-0.868,"6.500":-0.243,"6.375":0.507,"6.250":1.132,"6.125":1.757},"fico_ltv_adjustments":{"fico_bands":["760_plus","740_759","720_739","700_719_no_score_fn","680_699","660_679","640_659","620_639","600_619"],"ltv_bands":["lte_50","50_55","55_60","60_65","65_70","70_75","75_80","80_85"],"grid":{"760_plus":{"lte_50":-0.875,"50_55":-0.875,"55_60":-0.75,"60_65":-0.625,"65_70":-0.25,"70_75":1.375,"75_80":2.625,"80_85":4.375},"740_759":{"lte_50":-0.75,"50_55":-0.75,"55_60":-0.625,"60_65":-0.375,"65_70":0.0,"70_75":1.5,"75_80":3.125,"80_85":4.75},"720_739":{"lte_50":-0.625,"50_55":-0.625,"55_60":-0.625,"60_65":-0.5,"65_70":0.375,"70_75":1.75,"75_80":3.25,"80_85":4.875},"700_719_no_score_fn":{"lte_50":-0.5,"50_55":-0.25,"55_60":0.0,"60_65":0.625,"65_70":1.125,"70_75":3.0,"75_80":"NA","80_85":"NA"},"680_699":{"lte_50":0.5,"50_55":0.75,"55_60":0.875,"60_65":1.625,"65_70":2.75,"70_75":3.375,"75_80":"NA","80_85":"NA"},"660_679":{"lte_50":1.0,"50_55":1.375,"55_60":1.75,"60_65":2.5,"65_70":3.375,"70_75":"NA","75_80":"NA","80_85":"NA"},"640_659":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"},"620_639":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"},"600_619":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}}},"additional_llpas":{"dscr_ratio":{"no_ratio_lt_0_75":{"lte_50":2.625,"50_55":2.875,"55_60":3.0,"60_65":3.25,"65_70":3.5,"70_75":3.875,"75_80":"NA","80_85":"NA"},"0_75_to_0_99":{"lte_50":1.25,"50_55":1.25,"55_60":1.5,"60_65":1.5,"65_70":1.5,"70_75":3.125,"75_80":"NA","80_85":"NA"},"1_00_to_1_14":{"lte_50":-0.125,"50_55":-0.125,"55_60":-0.125,"60_65":0.125,"65_70":0.125,"70_75":0.125,"75_80":0.125,"80_85":0.125},"1_15_plus":{"lte_50":-0.375,"50_55":-0.375,"55_60":-0.375,"60_65":-0.375,"65_70":-0.375,"70_75":-0.375,"75_80":-0.375,"80_85":-0.125}},"dscr_fico_adjustments":{"dscr_gte_1_with_ppp_fico_740_plus":{"lte_50":-1.875,"50_55":-1.875,"55_60":-1.875,"60_65":-1.775,"65_70":-1.6,"70_75":-1.6,"75_80":-1.6,"80_85":0.0},"dscr_gte_1_with_ppp_fico_720_739":{"lte_50":-1.775,"50_55":-1.775,"55_60":-1.775,"60_65":-1.775,"65_70":-1.5,"70_75":-1.5,"75_80":-1.5,"80_85":0.0},"dscr_gte_1_with_ppp_fico_700_719":{"lte_50":-1.675,"50_55":-1.675,"55_60":-1.675,"60_65":-1.675,"65_70":-1.4,"70_75":-1.4,"75_80":-0.7,"80_85":0.0},"dscr_gte_1_with_ppp_fico_680_699":{"lte_50":-1.655,"50_55":-1.655,"55_60":-1.655,"60_65":-1.655,"65_70":-1.38,"70_75":-1.38,"75_80":-0.88,"80_85":0.0},"dscr_gte_1_with_ppp_fico_620_679":{"lte_50":-1.605,"50_55":-1.605,"55_60":-1.605,"60_65":-1.33,"65_70":-0.83,"70_75":-0.83,"75_80":-0.83,"80_85":0.0},"dscr_gte_1_no_ppp_fico_700_plus":{"lte_50":-0.75,"50_55":-0.75,"55_60":-0.75,"60_65":-0.75,"65_70":-0.75,"70_75":-0.75,"75_80":-0.75,"80_85":0.0},"dscr_rt_refi_with_ppp_fico_lte_700":{"lte_50":0.5,"50_55":0.5,"55_60":0.5,"60_65":0.5,"65_70":0.5,"70_75":0.5,"75_80":0.5,"80_85":0.5}},"foreign_national":{"dscr_gte_1_0":{"lte_50":1.25,"50_55":1.375,"55_60":1.5,"60_65":1.75,"65_70":1.875,"70_75":2.75,"75_80":"NA","80_85":"NA"}},"short_term_rental":{"gte_1_15_minimum":{"lte_50":1.25,"50_55":1.25,"55_60":1.25,"60_65":1.5,"65_70":1.5,"70_75":1.75,"75_80":"NA","80_85":"NA"}},"buydown":{"buydown_2_1":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}},"loan_amount":{"_bands_definition_usd":{"75k_to_lt_100k":{"min":75000,"max":99999},"lt_150k":{"min":100000,"max":149999},"lt_250k":{"min":150000,"max":249999},"gt_1m":{"min":1000001,"max":1500000},"gt_1_5m":{"min":1500001,"max":2000000},"gt_2m":{"min":2000001,"max":2500000},"gt_2_5m":{"min":2500001,"max":3000000},"gt_3m":{"min":3000001,"max":3500000}},"75k_to_lt_100k":{"lte_50":1.25,"50_55":1.25,"55_60":1.25,"60_65":1.25,"65_70":1.25,"70_75":"NA","75_80":"NA","80_85":"NA"},"lt_150k":{"lte_50":1.0,"50_55":1.0,"55_60":1.0,"60_65":1.0,"65_70":1.0,"70_75":1.0,"75_80":1.375,"80_85":1.75},"lt_250k":{"lte_50":-0.125,"50_55":-0.125,"55_60":-0.125,"60_65":-0.125,"65_70":-0.125,"70_75":0.25,"75_80":0.625,"80_85":0.875},"gt_1m":{"lte_50":0.0,"50_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.375,"80_85":0.5},"gt_1_5m":{"lte_50":0.5,"50_55":0.5,"55_60":0.5,"60_65":0.5,"65_70":0.5,"70_75":0.875,"75_80":"NA","80_85":"NA"},"gt_2m":{"lte_50":0.625,"50_55":0.625,"55_60":0.75,"60_65":0.875,"65_70":1.0,"70_75":"NA","75_80":"NA","80_85":"NA"},"gt_2_5m":{"lte_50":1.0,"50_55":1.0,"55_60":1.0,"60_65":1.125,"65_70":1.25,"70_75":"NA","75_80":"NA","80_85":"NA"},"gt_3m":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}},"loan_purpose":{"purchase":{"lte_50":-0.125,"50_55":-0.125,"55_60":-0.125,"60_65":-0.125,"65_70":-0.125,"70_75":-0.125,"75_80":-0.125,"80_85":-0.125},"rate_term_refi":{"lte_50":-0.125,"50_55":-0.125,"55_60":-0.125,"60_65":-0.125,"65_70":-0.125,"70_75":-0.125,"75_80":-0.125,"80_85":-0.125},"cash_out_refi":{"lte_50":0.75,"50_55":0.75,"55_60":0.75,"60_65":1.0,"65_70":1.0,"70_75":1.375,"75_80":"NA","80_85":"NA"},"delayed_financing":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}},"property_type":{"sfr":{"lte_50":0.0,"50_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.0,"80_85":0.0},"condo_warrantable":{"lte_50":0.125,"50_55":0.125,"55_60":0.25,"60_65":0.25,"65_70":0.375,"70_75":0.5,"75_80":0.75,"80_85":"NA"},"condo_non_warrantable":{"lte_50":0.375,"50_55":0.375,"55_60":0.5,"60_65":0.5,"65_70":0.625,"70_75":0.75,"75_80":0.875,"80_85":"NA"},"fl_condo_overlay":{"lte_50":0.0,"50_55":0.125,"55_60":0.125,"60_65":0.25,"65_70":0.25,"70_75":0.375,"75_80":0.5,"80_85":"NA"},"condotel":{"lte_50":1.0,"50_55":1.0,"55_60":1.0,"60_65":1.25,"65_70":1.25,"70_75":"NA","75_80":"NA","80_85":"NA"},"two_unit":{"lte_50":0.5,"50_55":0.5,"55_60":0.5,"60_65":0.5,"65_70":0.625,"70_75":0.75,"75_80":1.5,"80_85":1.875},"three_four_unit":{"lte_50":0.625,"50_55":0.625,"55_60":0.625,"60_65":0.625,"65_70":0.875,"70_75":1.0,"75_80":1.75,"80_85":2.125},"five_to_ten_unit":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}},"prepay_penalty_llpa":{"five_year_prepay":{"all_ltvs":-1.0},"four_year_prepay":{"all_ltvs":-0.625},"three_year_prepay":{"all_ltvs":-0.25},"two_year_prepay":{"all_ltvs":0.25},"one_year_prepay":{"all_ltvs":0.875},"no_prepay":{"all_ltvs":2.0}},"credit_history":{"covid_forbearance_lt_6mo":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"},"housing_1x30x12":{"lte_50":0.5,"50_55":0.75,"55_60":0.75,"60_65":0.75,"65_70":0.875,"70_75":1.0,"75_80":1.0,"80_85":"NA"},"bk_ss_nod_dil_2_to_3_yrs":{"lte_50":0.5,"50_55":0.625,"55_60":0.75,"60_65":0.875,"65_70":1.125,"70_75":1.375,"75_80":1.5,"80_85":1.625},"bk_ss_nod_dil_3_to_4_yrs":{"lte_50":0.25,"50_55":0.375,"55_60":0.5,"60_65":0.625,"65_70":1.0,"70_75":1.25,"75_80":1.375,"80_85":1.5},"ss_dil_modification_lt_2yrs":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"},"ss_dil_modification_lt_1yr":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"},"exception":{"lte_50":"NA","50_55":"NA","55_60":"NA","60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA","80_85":"NA"}},"other":{"escrow_waiver_non_ny":{"lte_50":0.25,"50_55":0.25,"55_60":0.25,"60_65":0.25,"65_70":0.25,"70_75":0.25,"75_80":0.25,"80_85":0.25},"escrow_waiver_ny_only":{"lte_50":0.0,"50_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.0,"80_85":"NA"},"state_ga_ny_fl_overlay":{"lte_50":0.25,"50_55":0.25,"55_60":0.25,"60_65":0.25,"65_70":0.25,"70_75":0.25,"75_80":0.25,"80_85":0.25}}},"rebate_grid":{"use_base_rate_table_as_ladder":true},"max_price_caps":{"investor_max_price":103.5,"owner_occupied_or_2nd_home_max_price":102.0,"min_price":4.0,"ppp_buydown_max_price_caps":{"no_prepay":{"max_price_purch_rt":0.5,"max_price_cashout":0.75},"1_year_prepay":{"max_price_purch_rt":0.0,"max_price_cashout":0.25},"2_year_prepay":{"max_price_purch_rt":-0.75,"max_price_cashout":-0.5},"3_year_prepay":{"max_price_purch_rt":-1.5,"max_price_cashout":-1.25},"4_year_prepay":{"max_price_purch_rt":-1.5,"max_price_cashout":-1.25},"5_year_prepay":{"max_price_purch_rt":-2.0,"max_price_cashout":-1.75}}},"lock_terms":{"available_days":[30],"default_lock_days":30,"extension_cost_bps_per_day":2,"max_extension_days":30,"max_extension_per_request_days":15,"relock_policy":"worse_of_market_plus_25_bps"},"eligibility_rules":{"min_fico":620,"max_fico":850,"no_score_allowed":true,"no_score_max_ltv":70,"min_dscr":0.0,"max_ltv_purchase":85,"max_ltv_rate_term_refi":85,"max_ltv_cashout":75,"min_loan":75000,"max_loan":3000000,"amortization_required":"fully_amortizing_30yr_fixed","interest_only_allowed":false,"arm_allowed":false,"occupancy_allowed":["non_owner_occupied"],"property_types_allowed":["sfr","condo_warrantable","condo_non_warrantable","condotel","two_unit","three_four_unit"],"borrower_types_allowed":["us_citizen","permanent_resident","non_permanent_resident","foreign_national","itin"],"entity_types_allowed":["individual","llc","corporation","partnership","trust"],"states_excluded_for_program":["AZ","CA","ID","MN","NV","ND","OR","UT","VT"],"states_pending_licensing":{"CA":{"estimated_approval_date":"2026-08-28","notes":"License pending. Re-enable when approved."}},"states_no_prepay_allowed":["AK","DE","KS","MD","MI","NJ","NH","NM","RI","VT"],"states_prepay_allowed_above_loan_amount":{"_comment":"States where PPP is conditionally allowed above a minimum loan amount. Engine: if state matches AND loan_amount > threshold, prepay is allowed. Below threshold, treat as no_prepay required.","OH":112000},"states_declining_prepay_only":["MS"],"states_no_prepay_for_individual_vesting":["IL","NJ"],"min_dscr_for_1x30x12_history":0.75,"credit_event_seasoning_min_months":24,"foreign_national_min_fico_pricing":700,"foreign_national_min_dscr":1.0},"_v6_changelog":["FIXED: Removed OH from states_no_prepay_allowed blanket list","ADDED: states_prepay_allowed_above_loan_amount conditional structure","ADDED: OH allows PPP above $112,000 loan amount (per Sean's domain knowledge)","Engine logic update needed: when state is in states_prepay_allowed_above_loan_amount, check if loan_amount > threshold before applying state-level no-prepay rejection","Other states with potentially conditional prepay rules (NJ, MS, etc.) \u2014 to be confirmed with Sean as encountered"]};

const AMWEST_PROGRAM = {"_README":"AmWest Investor Advantage (AIA) DSCR \u2014 AmWest Funding Corp. Source: rate sheet page 9, dated 4/28/2026. v1 SCOPE: 30-year fixed amortizing only. v3 PATCH: max_price_caps populated with safe defaults pending AE confirmation. AmWest only publishes BPC max prices on the rate sheet; LPC max prices need direct confirmation from AmWest AE.","lender_id":"amwest","lender_display_name":"AmWest Funding Corp","lender_nmls":"167441","program_id":"amwest_investor_advantage_dscr","program_display_name_internal":"AmWest Investor Advantage DSCR","program_category":"dscr","rate_sheet_source_page":9,"rate_sheet_date":"2026-04-28","rate_sheet_time_pt":"08:00","rate_sheet_lock_cutoff_pt":"17:00","rate_sheet_filename_when_imported":"AMWEST.pdf","schema_version":"3.0","verification_status":"verified_pending_ae_confirmation_2026_04_28","pricing_convention":{"type":"adjustment_from_par","par":100.0},"products_offered":{"30_year_fixed_amortizing":true,"_excluded_from_v1":["7_6_arm","interest_only"]},"comp_model":{"_comment":"Rate Hero uses Lender Paid Compensation (LPC). AmWest publishes BPC max prices on the rate sheet \u2014 LPC max prices below are placeholder safe defaults pending AE confirmation.","model":"lender_paid_compensation","broker_paid_via":"lender_rebate","borrower_facing_origination_fee":false},"base_rate_table":{"_comment":"\u2705 VERIFIED \u2014 all 21 rates from AIA30 30 YR column on page 9.","_format":"rate_pct: base_price_adjustment_from_par","5.750":5.945,"5.875":5.32,"6.000":4.695,"6.125":4.07,"6.250":3.57,"6.375":3.07,"6.500":2.695,"6.625":2.32,"6.750":1.945,"6.875":1.57,"7.000":1.195,"7.125":0.82,"7.250":0.445,"7.375":0.07,"7.500":-0.282,"7.625":-0.61,"7.750":-0.914,"7.875":-1.196,"8.000":-1.453,"8.125":-1.688,"8.250":-1.899},"fico_ltv_adjustments":{"_comment":"\u2705 VERIFIED \u2014 all 54 cells. AmWest uses 6 LTV bands (no 80-85). 9 FICO bands \u00d7 6 LTV bands.","fico_bands":["780_plus","760_779","740_759","720_739","700_719","680_699","660_679","640_659","620_639"],"ltv_bands":["lte_55","55_60","60_65","65_70","70_75","75_80"],"grid":{"780_plus":{"lte_55":-1.5,"55_60":-1.5,"60_65":-1.5,"65_70":-1.375,"70_75":-1.0,"75_80":-0.5},"760_779":{"lte_55":-1.375,"55_60":-1.375,"60_65":-1.375,"65_70":-1.25,"70_75":-0.875,"75_80":-0.375},"740_759":{"lte_55":-1.25,"55_60":-1.25,"60_65":-1.25,"65_70":-1.0,"70_75":-0.75,"75_80":-0.25},"720_739":{"lte_55":-1.125,"55_60":-1.125,"60_65":-1.0,"65_70":-0.875,"70_75":-0.25,"75_80":0.375},"700_719":{"lte_55":-1.0,"55_60":-0.875,"60_65":-0.625,"65_70":-0.125,"70_75":0.75,"75_80":2.0},"680_699":{"lte_55":-0.5,"55_60":-0.25,"60_65":0.125,"65_70":0.75,"70_75":1.875,"75_80":"NA"},"660_679":{"lte_55":0.0,"55_60":0.375,"60_65":1.375,"65_70":2.125,"70_75":3.375,"75_80":"NA"},"640_659":{"lte_55":0.5,"55_60":1.0,"60_65":2.375,"65_70":2.875,"70_75":"NA","75_80":"NA"},"620_639":{"lte_55":1.125,"55_60":1.875,"60_65":"NA","65_70":"NA","70_75":"NA","75_80":"NA"}}},"additional_llpas":{"_comment":"\u2705 VERIFIED. From 'ADDITIONAL PRICE ADJUSTMENTS' section on page 9.","dscr_ratio":{"dscr_gte_1_25":{"lte_55":-2.875,"55_60":-2.875,"60_65":-2.75,"65_70":-2.625,"70_75":-2.25,"75_80":-1.375},"dscr_gte_1_00":{"lte_55":-2.75,"55_60":-2.625,"60_65":-2.625,"65_70":-2.5,"70_75":-2.25,"75_80":-1.0},"dscr_lt_1_00":{"lte_55":-2.25,"55_60":-2.125,"60_65":-1.375,"65_70":0.5,"70_75":1.25,"75_80":"NA"}},"foreign_national":{"_comment":"AmWest does NOT use FICO for Foreign National pricing.","no_fico":{"lte_55":0.25,"55_60":0.25,"60_65":0.5,"65_70":0.875,"70_75":"NA","75_80":"NA"}},"non_perm_resident":{"with_fico":{"lte_55":0.125,"55_60":0.125,"60_65":0.25,"65_70":0.25,"70_75":0.375,"75_80":0.375}},"interest_only":{"_comment":"v1 EXCLUDES IO. Stored for future use only.","all_ltvs":{"lte_55":0.25,"55_60":0.25,"60_65":0.25,"65_70":0.375,"70_75":0.5,"75_80":"NA"}},"loan_purpose_overlay":{"cash_out_refi":{"lte_55":0.25,"55_60":0.25,"60_65":0.375,"65_70":0.5,"70_75":0.75,"75_80":"NA"}},"property_type":{"sfr":{"lte_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.0},"two_unit":{"lte_55":0.5,"55_60":0.5,"60_65":0.5,"65_70":0.5,"70_75":0.625,"75_80":0.75},"three_four_unit":{"lte_55":0.5,"55_60":0.5,"60_65":0.5,"65_70":0.5,"70_75":0.625,"75_80":0.75},"florida_condo_overlay":{"_comment":"Stacks on top of base condo LLPA.","lte_55":0.125,"55_60":0.125,"60_65":0.25,"65_70":0.25,"70_75":0.375,"75_80":0.5},"condo_warrantable":{"lte_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.0},"condo_non_warrantable":{"lte_55":0.0,"55_60":0.0,"60_65":0.0,"65_70":0.0,"70_75":0.0,"75_80":0.0}},"fthb_overlay":{"fthb_excl_foreign_national":{"lte_55":0.5,"55_60":0.5,"60_65":0.625,"65_70":0.75,"70_75":0.75,"75_80":"NA"}},"loan_specific_adjusters":{"cltv_overlay":{"all_ltvs":0.25},"lt_100k":{"all_ltvs":0.75},"gt_1m_to_2m":{"all_ltvs":0.375},"gt_2m_to_2_5m":{"all_ltvs":0.5},"non_warrantable_condotel":{"all_ltvs":1.0},"short_term_rental":{"all_ltvs":0.25},"lock_45_days":{"all_ltvs":0.125},"ace_special":{"all_ltvs":-0.125}},"prepay_penalty_llpa":{"five_year_prepay":{"all_ltvs":-1.25},"four_year_prepay":{"all_ltvs":-1.0},"three_year_prepay":{"all_ltvs":-0.6},"two_year_prepay":{"all_ltvs":0.0},"one_year_prepay":{"all_ltvs":0.5},"no_prepay":{"all_ltvs":1.5}},"michigan_prepay_overlay":{"1_year_ppp":{"all_ltvs":0.75},"2_year_ppp":{"all_ltvs":1.0},"3_year_ppp":{"all_ltvs":1.5}},"state_overlay":{"ny":{"all_ltvs":0.25}}},"max_price_caps":{"_comment":"\u26a0\ufe0f PENDING AE CONFIRMATION \u26a0\ufe0f AmWest only publishes BPC max prices on page 9 of the rate sheet. Rate Hero uses LPC. Below values are SAFE DEFAULTS based on industry-typical LPC max prices for DSCR programs (slightly below the 103.5 Cake equivalent given AmWest's tighter overall pricing structure). When AmWest AE confirms actual LPC max prices, replace these values.","verification_required":true,"verification_method":"Direct confirmation from AmWest AE","verification_email_template":"What are AmWest AIA Lender Paid Comp max prices by PPP term?","investor_max_price_default":103.0,"ppp_buydown_max_price_caps":{"no_prepay":{"max_price_purch_rt":-1.0,"max_price_cashout":-0.75,"_status":"default_pending_ae_confirmation"},"1_year_prepay":{"max_price_purch_rt":-1.5,"max_price_cashout":-1.25,"_status":"default_pending_ae_confirmation"},"2_year_prepay":{"max_price_purch_rt":-2.0,"max_price_cashout":-1.75,"_status":"default_pending_ae_confirmation"},"3_year_prepay":{"max_price_purch_rt":-2.5,"max_price_cashout":-2.25,"_status":"default_pending_ae_confirmation"},"4_year_prepay":{"max_price_purch_rt":-2.75,"max_price_cashout":-2.5,"_status":"default_pending_ae_confirmation"},"5_year_prepay":{"max_price_purch_rt":-3.0,"max_price_cashout":-2.75,"_status":"default_pending_ae_confirmation"}},"min_price":95.0},"lock_terms":{"available_days":[30,45],"default_lock_days":30,"extension_cost_bps_per_day":2,"max_extension_days":30,"max_extension_per_request_days":15},"eligibility_rules":{"min_fico":620,"max_fico":850,"no_score_allowed":true,"no_score_max_ltv":70,"min_dscr":0.0,"max_ltv_purchase":80,"max_ltv_rate_term_refi":80,"max_ltv_cashout":75,"min_loan":75000,"max_loan":2500000,"amortization_required":"fully_amortizing_30yr_fixed","interest_only_allowed":false,"arm_allowed":false,"occupancy_allowed":["non_owner_occupied"],"property_types_allowed":["sfr","condo_warrantable","condo_non_warrantable","two_unit","three_four_unit"],"borrower_types_allowed":["us_citizen","permanent_resident","non_perm_resident","foreign_national"],"entity_types_allowed":["individual","llc","corporation","partnership","trust"],"states_excluded_for_program":["AZ","CA","ID","MN","NV","ND","OR","UT","VT"],"states_pending_licensing":{"CA":{"estimated_approval_date":"2026-08-28","notes":"License pending. Re-enable when approved."}},"_amwest_state_groups":{"_comment":"From AmWest page 9 'STANDARD/NO/RESTRICTED PREPAYMENT' tables.","group_1_standard_prepay_allowed":["AL","AZ","CA","CT","CO","DC","DE","FL","GA","HI","ID","IA","LA","ME","MD","MA","MO","MT","NE","NV","NH","NY","NC","ND","OK","OR","SC","SD","TN","UT","VA","WA","WV","WI","WY"],"group_2_no_prepay_allowed":["AK","KS","MN","NJ","NM","RI","VT"],"group_3_restricted_prepay":["IL","IN","KY","OH","TX","MI","MS","PA"]},"states_no_prepay_allowed":["AK","KS","MN","NJ","NM","RI","VT"],"states_restricted_prepay":{"_comment":"AmWest's Group 3 \u2014 prepay allowed but with conditions. v1 treats as ALLOWED with LO review flag.","states":["IL","IN","KY","OH","TX","MI","MS","PA"],"v1_treatment":"allow_with_lo_review_flag","v1_lo_review_required":true},"states_prepay_allowed_above_loan_amount":{"OH":112000},"states_no_prepay_for_individual_vesting":["IL","NJ"],"min_dscr_for_credit_event":1.0,"credit_event_seasoning_min_months":24,"foreign_national_uses_fico":false,"foreign_national_min_dscr":1.0,"first_time_investor_allowed":true,"non_warrantable_condo_allowed":true},"_v3_changelog":["VERIFIED: All 21 base rates","VERIFIED: All 54 FICO\u00d7LTV grid cells","VERIFIED: All additional LLPAs (DSCR, FN, NPR, IO, cash-out, property type, FTHB, loan-specific, prepay, MI, NY)","VERIFIED: Eligibility rules ($2.5M max, 620 FICO min, 80 LTV purchase, 75 LTV cashout)","VERIFIED: AmWest's actual state grouping (Group 1/2/3)","PENDING: max_price_caps \u2014 AmWest only publishes BPC; LPC needs AE confirmation","DEFAULT: Safe LPC max price defaults set based on industry-typical DSCR LPC structures","ADDED: comp_model section explicitly documenting Rate Hero uses LPC"],"_pending_ae_confirmation":["MAX PRICE table for Lender Paid Comp by PPP term","MIN PRICE for LPC structure","Confirm whether ACE Special promo is still active and applies to LPC structure","Confirm Group 3 'restricted prepay' specific rules per state (IL, IN, KY, OH, TX, MI, MS, PA)"]};

const COMP_CONFIG = {"_README":"Rate Hero compensation config. This file injects margin into wholesale pricing before display to the borrower. Version every change via git commits. Single source of truth \u2014 engine reads this file at runtime, no other comp logic exists anywhere.","config_version":"2026.04.28.01","effective_date":"2026-04-28","approved_by":"Sean Davoodian","approval_nmls":"1252107","compensation_type":"lender_paid","_compensation_type_options":["lender_paid","borrower_paid"],"_note":"DSCR default is lender_paid \u2014 cleaner UX, no separate origination line, what-you-see-is-what-you-get. Borrower-paid mode is a future toggle for sophisticated borrowers who want to see wholesale + comp broken out.","default_compensation":{"comp_bps":200,"_comp_bps_meaning":"200 basis points = 2.00 points = 2.00% of loan amount paid by lender to Rate Hero","min_dollars":3500,"max_dollars":25000,"_min_max_meaning":"Floor and ceiling on dollar comp regardless of loan size. $3,500 minimum protects small loans; $25,000 ceiling caps jumbos."},"compensation_by_loan_size":{"_comment":"Override default comp_bps based on loan size band. Larger loans get tighter bps because the dollar amount still works. This is your primary lever for being competitive on jumbo DSCR.","100000_to_249999":{"comp_bps":225},"250000_to_499999":{"comp_bps":200},"500000_to_999999":{"comp_bps":175},"1000000_to_1999999":{"comp_bps":150},"2000000_plus":{"comp_bps":125}},"compensation_by_state":{"_comment":"State-level overrides for licensing-required states or competitive markets. Empty object = use default. Add as needed.","_example":{"CA":{"comp_bps":200},"TX":{"comp_bps":200}}},"compensation_by_lender":{"_comment":"Per-lender overrides. Some wholesale lenders cap LPC tier lower than 275 bps; some pay better, allowing tighter consumer pricing.","cake":{"comp_bps":200,"max_lender_comp_bps_allowed":275},"kiavi":{"comp_bps":200,"max_lender_comp_bps_allowed":275},"visio":{"comp_bps":215,"max_lender_comp_bps_allowed":275},"lima_one":{"comp_bps":200,"max_lender_comp_bps_allowed":275},"a_and_d":{"comp_bps":200,"max_lender_comp_bps_allowed":275}},"federal_max_comp_bps":275,"_federal_max_meaning":"Reg Z LO comp cap. Engine NEVER lets total comp exceed 275 bps on any loan. Hard ceiling.","audit_logging":{"log_every_priced_scenario":true,"log_destination":"cloudflare_workers_kv","_alternative_destinations":["google_sheets_via_apps_script","cloudflare_d1"],"log_retention_days":2555,"_retention_meaning":"7 years \u2014 covers federal record retention requirements for mortgage origination."},"compliance_disclosures":{"borrower_facing_comp_disclosure":"Rate Hero earns a fee from the lender based on your loan amount. This fee is included in the rate shown \u2014 you don't pay anything extra at closing for our service.","scenario_builder_disclaimer":"Rates and costs shown reflect the scenario you built. Final pricing depends on full underwriting review. This is not a quote, lock, or commitment to lend. Rate Hero, Inc. NMLS #2822806.","lender_partner_disclosure":"Rate Hero is a licensed mortgage broker. Your loan will be funded by one of our wholesale lender partners. The specific partner is selected at closing based on best execution for your scenario."}};

  const PROGRAMS = [CAKE_PROGRAM, AMWEST_PROGRAM];
  const WEB3FORMS_KEY = '544fd03b-53dd-4844-ae11-af8c8871adf8';

  const WAITLIST_STATES = {
    CA: { name: 'California', eta: 'August 2026' },
    AZ: { name: 'Arizona',    eta: 'TBD' },
    ID: { name: 'Idaho',      eta: 'TBD' },
    MN: { name: 'Minnesota',  eta: 'TBD' },
    NV: { name: 'Nevada',     eta: 'TBD' },
    ND: { name: 'North Dakota', eta: 'TBD' },
    OR: { name: 'Oregon',     eta: 'TBD' },
    UT: { name: 'Utah',       eta: 'TBD' },
    VT: { name: 'Vermont',    eta: 'TBD' }
  };

  let SUBMISSION_MODE = 'pricing';
  let CURRENT_WAITLIST_STATE = null;
  let LAST_PRICING_RESULT = null;  // cached after every pricing run; null on waitlist/rejected
  let SELECTED_TIER = null;        // 'lightning' | 'thunder' | 'bolt' | null (null = generic CTA)
  let LOAN_AMOUNT_MANUALLY_EDITED = false;

  // =========================================================================
  // ENGINE CORE
  // =========================================================================

  function getFicoBandCake(fico) {
    if (fico === null || fico === undefined) return "700_719_no_score_fn";
    if (fico >= 760) return "760_plus";
    if (fico >= 740) return "740_759";
    if (fico >= 720) return "720_739";
    if (fico >= 700) return "700_719_no_score_fn";
    if (fico >= 680) return "680_699";
    if (fico >= 660) return "660_679";
    if (fico >= 640) return "640_659";
    if (fico >= 620) return "620_639";
    return null;
  }
  function getFicoBandAmwest(fico) {
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
  function getFicoBandForProgram(fico, program) {
    if (program && program.fico_ltv_adjustments && program.fico_ltv_adjustments.fico_bands) {
      if (program.fico_ltv_adjustments.fico_bands.includes("780_plus")) return getFicoBandAmwest(fico);
    }
    return getFicoBandCake(fico);
  }

  function getLtvBandCake(ltv) {
    if (ltv <= 50) return "lte_50";
    if (ltv <= 55) return "50_55";
    if (ltv <= 60) return "55_60";
    if (ltv <= 65) return "60_65";
    if (ltv <= 70) return "65_70";
    if (ltv <= 75) return "70_75";
    if (ltv <= 80) return "75_80";
    if (ltv <= 85) return "80_85";
    return null;
  }
  function getLtvBandAmwest(ltv) {
    if (ltv <= 55) return "lte_55";
    if (ltv <= 60) return "55_60";
    if (ltv <= 65) return "60_65";
    if (ltv <= 70) return "65_70";
    if (ltv <= 75) return "70_75";
    if (ltv <= 80) return "75_80";
    return null;
  }
  function getLtvBand(ltv, program) {
    if (program && program.fico_ltv_adjustments && program.fico_ltv_adjustments.ltv_bands) {
      if (program.fico_ltv_adjustments.ltv_bands.includes("lte_55")) return getLtvBandAmwest(ltv);
    }
    return getLtvBandCake(ltv);
  }

  function getDscrBand(dscr, program) {
    if (program && program.lender_id === "amwest") {
      if (dscr === null || dscr === undefined) return null;
      if (dscr >= 1.25) return "dscr_gte_1_25";
      if (dscr >= 1.00) return "dscr_gte_1_00";
      return "dscr_lt_1_00";
    }
    if (dscr === null || dscr === undefined || dscr < 0.75) return "no_ratio_lt_0_75";
    if (dscr < 1.00) return "0_75_to_0_99";
    if (dscr < 1.15) return "1_00_to_1_14";
    return "1_15_plus";
  }

  function getLoanSizeBand(loan, bands) {
    if (!bands) return null;
    for (const bandKey of Object.keys(bands)) {
      if (bandKey.startsWith("_")) continue;
      const range = bands[bandKey];
      if (typeof range === "object" && range.min !== undefined && range.max !== undefined) {
        if (loan >= range.min && loan <= range.max) return bandKey;
      }
    }
    return null;
  }

  function getDscrFicoAdjustmentKey(fico, hasPpp, dscr, purpose) {
    if (dscr < 1.00) return null;
    if (purpose === "rate_term_refi" && hasPpp && fico <= 700) return "dscr_rt_refi_with_ppp_fico_lte_700";
    if (!hasPpp && fico >= 700) return "dscr_gte_1_no_ppp_fico_700_plus";
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

  function checkEligibility(scenario, program) {
    const rules = program.eligibility_rules;
    if (Array.isArray(rules.states_excluded_for_program) && rules.states_excluded_for_program.includes(scenario.state)) {
      const pendingInfo = rules.states_pending_licensing && rules.states_pending_licensing[scenario.state];
      if (pendingInfo) {
        return { eligible: false, reason: "Rate Hero is not currently licensed in " + scenario.state + ". Estimated approval: " + (pendingInfo.estimated_approval_date || "unknown") + "." };
      }
      return { eligible: false, reason: "Rate Hero is not currently licensed in " + scenario.state + " for this product." };
    }
    if (scenario.fico !== null && scenario.fico !== undefined) {
      if (scenario.fico < rules.min_fico) return { eligible: false, reason: "FICO " + scenario.fico + " below minimum " + rules.min_fico };
      if (scenario.fico > rules.max_fico) return { eligible: false, reason: "FICO " + scenario.fico + " above max " + rules.max_fico };
    }
    if (scenario.loan_amount < rules.min_loan) return { eligible: false, reason: "Loan amount below " + rules.min_loan + " minimum" };
    if (scenario.loan_amount > rules.max_loan) return { eligible: false, reason: "Loan amount above " + rules.max_loan + " maximum" };
    if (scenario.purpose === "purchase" && scenario.ltv > rules.max_ltv_purchase) {
      return { eligible: false, reason: "LTV " + scenario.ltv + "% exceeds purchase max " + rules.max_ltv_purchase + "%" };
    }
    if (scenario.purpose === "rate_term_refi" && scenario.ltv > rules.max_ltv_rate_term_refi) {
      return { eligible: false, reason: "LTV " + scenario.ltv + "% exceeds rate/term refi max " + rules.max_ltv_rate_term_refi + "%" };
    }
    if (scenario.purpose === "cash_out_refi" && scenario.ltv > rules.max_ltv_cashout) {
      return { eligible: false, reason: "LTV " + scenario.ltv + "% exceeds cash-out refi max " + rules.max_ltv_cashout + "%" };
    }
    if (scenario.interest_only && !rules.interest_only_allowed) return { eligible: false, reason: "Interest-only not allowed" };
    if (scenario.is_arm && !rules.arm_allowed) return { eligible: false, reason: "ARM not allowed" };
    if (!rules.occupancy_allowed.includes(scenario.occupancy)) return { eligible: false, reason: "Occupancy not allowed" };
    if (!rules.property_types_allowed.includes(scenario.property_type)) return { eligible: false, reason: "Property type not allowed" };
    if (!rules.borrower_types_allowed.includes(scenario.borrower_type)) return { eligible: false, reason: "Borrower type not allowed" };
    if (scenario.borrower_type === "foreign_national" && scenario.dscr < rules.foreign_national_min_dscr) {
      return { eligible: false, reason: "Foreign National min DSCR " + rules.foreign_national_min_dscr };
    }
    if (scenario.prepay_term && scenario.prepay_term !== "no_prepay") {
      if (Array.isArray(rules.states_no_prepay_allowed) && rules.states_no_prepay_allowed.includes(scenario.state)) {
        return { eligible: false, reason: "Prepay penalties not allowed in " + scenario.state };
      }
      const conditional = rules.states_prepay_allowed_above_loan_amount && rules.states_prepay_allowed_above_loan_amount[scenario.state];
      if (conditional && typeof conditional === "number" && scenario.loan_amount <= conditional) {
        return { eligible: false, reason: "Prepay penalties in " + scenario.state + " require loan amount above $" + conditional.toLocaleString() };
      }
      if (Array.isArray(rules.states_no_prepay_for_individual_vesting) && rules.states_no_prepay_for_individual_vesting.includes(scenario.state) && scenario.entity_type === "individual") {
        return { eligible: false, reason: "Prepay penalties not allowed for individual vesting in " + scenario.state };
      }
    }
    return { eligible: true };
  }

  function computeWholesalePriceAtRate(noteRate, scenario, program) {
    const ltvBand = getLtvBand(scenario.ltv, program);
    const ficoBand = getFicoBandForProgram(scenario.fico, program);
    const basePrice = program.base_rate_table[noteRate.toFixed(3)];
    if (basePrice === undefined) return { eligible: false, reason: "Rate " + noteRate + " not in ladder" };
    const breakdown = { base_rate: noteRate, base_price: basePrice };
    const llpas = [];

    if (program.fico_ltv_adjustments && program.fico_ltv_adjustments.grid) {
      const v = lookupCell(program.fico_ltv_adjustments.grid[ficoBand], ltvBand);
      if (v === "NA") return { eligible: false, reason: "FICO " + scenario.fico + " not allowed at LTV " + scenario.ltv + "%" };
      breakdown.fico_ltv = v; llpas.push(v);
    }

    const a = program.additional_llpas || {};

    if (a.dscr_ratio && !scenario.is_str) {
      const band = getDscrBand(scenario.dscr, program);
      if (band) {
        const v = lookupCell(a.dscr_ratio[band], ltvBand);
        if (v === "NA") return { eligible: false, reason: "DSCR not allowed at this LTV" };
        breakdown.dscr_ratio = v; llpas.push(v);
      }
    } else if (scenario.is_str && a.short_term_rental) {
      const v = lookupCell(a.short_term_rental.gte_1_15_minimum, ltvBand);
      if (v === "NA") return { eligible: false, reason: "STR not allowed at this LTV" };
      breakdown.str = v; llpas.push(v);
    }

    if (a.dscr_fico_adjustments) {
      const hasPpp = scenario.prepay_term && scenario.prepay_term !== "no_prepay";
      const key = getDscrFicoAdjustmentKey(scenario.fico, hasPpp, scenario.dscr, scenario.purpose);
      if (key && a.dscr_fico_adjustments[key]) {
        const v = lookupCell(a.dscr_fico_adjustments[key], ltvBand);
        if (v !== "NA") { breakdown.dscr_fico = v; llpas.push(v); }
      }
    }

    if (scenario.borrower_type === "foreign_national" && a.foreign_national) {
      let v;
      if (a.foreign_national.dscr_gte_1_0) v = lookupCell(a.foreign_national.dscr_gte_1_0, ltvBand);
      else if (a.foreign_national.no_fico) v = lookupCell(a.foreign_national.no_fico, ltvBand);
      if (v !== undefined) {
        if (v === "NA") return { eligible: false, reason: "Foreign National not allowed at this LTV" };
        breakdown.foreign_national = v; llpas.push(v);
      }
    }

    if (a.loan_amount && a.loan_amount._bands_definition_usd) {
      const band = getLoanSizeBand(scenario.loan_amount, a.loan_amount._bands_definition_usd);
      if (band) {
        const v = lookupCell(a.loan_amount[band], ltvBand);
        if (v === "NA") return { eligible: false, reason: "Loan size not allowed at this LTV" };
        breakdown.loan_amount = v; llpas.push(v);
      }
    }

    if (a.loan_specific_adjusters) {
      if (scenario.loan_amount < 100000 && a.loan_specific_adjusters.lt_100k) {
        breakdown.lt_100k = a.loan_specific_adjusters.lt_100k.all_ltvs;
        llpas.push(a.loan_specific_adjusters.lt_100k.all_ltvs);
      } else if (scenario.loan_amount > 1000000 && scenario.loan_amount <= 2000000 && a.loan_specific_adjusters.gt_1m_to_2m) {
        breakdown.gt_1m_to_2m = a.loan_specific_adjusters.gt_1m_to_2m.all_ltvs;
        llpas.push(a.loan_specific_adjusters.gt_1m_to_2m.all_ltvs);
      } else if (scenario.loan_amount > 2000000 && scenario.loan_amount <= 2500000 && a.loan_specific_adjusters.gt_2m_to_2_5m) {
        breakdown.gt_2m_to_2_5m = a.loan_specific_adjusters.gt_2m_to_2_5m.all_ltvs;
        llpas.push(a.loan_specific_adjusters.gt_2m_to_2_5m.all_ltvs);
      }
    }

    if (a.loan_purpose) {
      const v = lookupCell(a.loan_purpose[scenario.purpose], ltvBand);
      if (v === "NA") return { eligible: false, reason: "Purpose not allowed at this LTV" };
      breakdown.loan_purpose = v; llpas.push(v);
    } else if (a.loan_purpose_overlay && scenario.purpose === "cash_out_refi") {
      const v = lookupCell(a.loan_purpose_overlay.cash_out_refi, ltvBand);
      if (v === "NA") return { eligible: false, reason: "Cash-out not allowed at this LTV" };
      breakdown.cashout_overlay = v; llpas.push(v);
    }

    if (a.property_type) {
      const v = lookupCell(a.property_type[scenario.property_type], ltvBand);
      if (v === "NA") return { eligible: false, reason: "Property type not allowed at this LTV" };
      breakdown.property_type = v; llpas.push(v);
    }

    if (scenario.state === "FL" && (scenario.property_type === "condo_warrantable" || scenario.property_type === "condo_non_warrantable")) {
      const fl1 = a.property_type && a.property_type.fl_condo_overlay;
      const fl2 = a.property_type && a.property_type.florida_condo_overlay;
      const grid = fl1 || fl2;
      if (grid) {
        const v = lookupCell(grid, ltvBand);
        if (v !== "NA") { breakdown.fl_condo = v; llpas.push(v); }
      }
    }

    if (scenario.prepay_term && a.prepay_penalty_llpa) {
      const key = scenario.prepay_term + "_prepay";
      const k = key.replace("no_prepay_prepay", "no_prepay");
      const entry = a.prepay_penalty_llpa[k];
      if (entry && entry.all_ltvs !== undefined) {
        breakdown.prepay = entry.all_ltvs; llpas.push(entry.all_ltvs);
      }
    }

    if (scenario.state === "MI" && scenario.prepay_term && a.michigan_prepay_overlay) {
      const miKey = scenario.prepay_term === "one_year" ? "1_year_ppp" :
                    scenario.prepay_term === "two_year" ? "2_year_ppp" :
                    scenario.prepay_term === "three_year" ? "3_year_ppp" : null;
      if (miKey && a.michigan_prepay_overlay[miKey]) {
        breakdown.mi_overlay = a.michigan_prepay_overlay[miKey].all_ltvs;
        llpas.push(a.michigan_prepay_overlay[miKey].all_ltvs);
      }
    }

    if (scenario.state === "NY" && a.state_overlay && a.state_overlay.ny) {
      breakdown.ny_overlay = a.state_overlay.ny.all_ltvs;
      llpas.push(a.state_overlay.ny.all_ltvs);
    }

    if (a.other) {
      if (scenario.escrow_waiver) {
        const wKey = scenario.state === "NY" ? "escrow_waiver_ny_only" : "escrow_waiver_non_ny";
        if (a.other[wKey]) {
          const v = lookupCell(a.other[wKey], ltvBand);
          if (v === "NA") return { eligible: false, reason: "Escrow waiver not allowed" };
          breakdown.escrow_waiver = v; llpas.push(v);
        }
      }
      if (["GA", "NY", "FL"].includes(scenario.state) && a.other.state_ga_ny_fl_overlay) {
        const v = lookupCell(a.other.state_ga_ny_fl_overlay, ltvBand);
        breakdown.state_overlay = v; llpas.push(v);
      }
    }

    const sum = sumLlpas(llpas);
    if (sum === "NA") return { eligible: false, reason: "An LLPA returned NA" };
    const wholesale = Math.round((basePrice + sum) * 10000) / 10000;
    return { eligible: true, note_rate: noteRate, wholesale_price: wholesale, llpa_breakdown: breakdown, llpa_total: sum };
  }

  function applyCompensation(result, scenario, comp) {
    if (!result.eligible) return result;
    let bps = comp.default_compensation.comp_bps;
    if (comp.compensation_by_loan_size) {
      for (const band of Object.keys(comp.compensation_by_loan_size)) {
        const parts = band.split("_to_");
        const min = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
        const max = parts[1] && !parts[1].includes("plus") ? parseInt(parts[1].replace(/[^0-9]/g, ""), 10) : 999999999;
        if (scenario.loan_amount >= min && scenario.loan_amount <= max) {
          bps = comp.compensation_by_loan_size[band].comp_bps;
          break;
        }
      }
    }
    if (bps > comp.federal_max_comp_bps) bps = comp.federal_max_comp_bps;
    const points = bps / 100;
    const facing = Math.round((result.wholesale_price + points) * 10000) / 10000;
    return Object.assign({}, result, { comp_bps: bps, comp_as_points: points, borrower_facing_price: facing });
  }

  // Map scenario.prepay_term ("five_year") to JSON cap key ("5_year_prepay")
  const PREPAY_TERM_TO_CAP_KEY = {
    'five_year':  '5_year_prepay',
    'four_year':  '4_year_prepay',
    'three_year': '3_year_prepay',
    'two_year':   '2_year_prepay',
    'one_year':   '1_year_prepay',
    'no_prepay':  'no_prepay'
  };

  function enforceMaxPriceCap(result, scenario, program) {
    if (!result.eligible) return result;
    const caps = program.max_price_caps || {};

    // Floor-based cap: positive final_price = cost, negative = rebate.
    // investor_max_price (e.g., 103.0) = max wholesale price = max 3 pts rebate
    // → in our convention, FLOOR at -3.0.
    // ppp_buydown_max_price_caps values are already negative floors (e.g., -3.0
    // for 5-year PPP allows 3 pts rebate; -1.0 for no_prepay only allows 1 pt).
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
    const pp = ppKey && caps.ppp_buydown_max_price_caps && caps.ppp_buydown_max_price_caps[ppKey];
    if (pp) {
      const k = scenario.purpose === "cash_out_refi" ? "max_price_cashout" : "max_price_purch_rt";
      if (typeof pp[k] === "number") pppFloor = pp[k];
    }

    // Effective floor: less negative = stricter
    const effFloor = Math.max(globalFloor, pppFloor);

    let final = result.borrower_facing_price;
    let capped = false;
    if (final < effFloor) { final = effFloor; capped = true; }

    return Object.assign({}, result, {
      effective_max_price_cap: effFloor,
      final_price: final,
      was_capped: capped
    });
  }

  function priceScenarioFullLadder(scenario, program, comp) {
    const elig = checkEligibility(scenario, program);
    if (!elig.eligible) return { eligible: false, reason: elig.reason, lender_id: program.lender_id, program_id: program.program_id };
    const ladder = [];
    for (const rateStr of Object.keys(program.base_rate_table)) {
      if (rateStr.startsWith("_")) continue;
      const rate = parseFloat(rateStr);
      const w = computeWholesalePriceAtRate(rate, scenario, program);
      if (!w.eligible) continue;
      const c = applyCompensation(w, scenario, comp);
      const cap = enforceMaxPriceCap(c, scenario, program);
      ladder.push(cap);
    }
    if (ladder.length === 0) return { eligible: false, reason: "No rates produced valid pricing", lender_id: program.lender_id, program_id: program.program_id };
    return { eligible: true, lender_id: program.lender_id, program_id: program.program_id, ladder };
  }

  function calculateMonthlyPayment(p, r, n) {
    const m = (r / 100) / 12;
    if (m === 0) return Math.round(p / n);
    return Math.round(p * (m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1));
  }

  function buildTiers(ladderResult, loanAmount) {
    if (!ladderResult.eligible) return ladderResult;
    const ladder = ladderResult.ladder.map(e => Object.assign({}, e, { actual_price: 100 + e.final_price }));
    const lightning = ladder.reduce((lo, e) => e.note_rate < lo.note_rate ? e : lo, ladder[0]);
    const bolt = ladder.reduce((hi, e) => e.note_rate > hi.note_rate ? e : hi, ladder[0]);
    const thunder = ladder.reduce((cl, e) => Math.abs(e.actual_price - 100) < Math.abs(cl.actual_price - 100) ? e : cl, ladder[0]);
    const enrich = (e, label) => ({
      label,
      note_rate: e.note_rate,
      monthly_pi: calculateMonthlyPayment(loanAmount, e.note_rate, 360),
      cost_points: e.final_price,
      cost_dollars: Math.round(e.final_price * loanAmount / 100),
      is_lender_credit: e.final_price < 0,
      lender_id: ladderResult.lender_id,
      program_id: ladderResult.program_id,
      _full_entry: e
    });
    return { eligible: true, bolt: enrich(bolt, "Bolt"), thunder: enrich(thunder, "Thunder"), lightning: enrich(lightning, "Lightning") };
  }

  function adaptScenarioForLender(scenario, program) {
    const a = Object.assign({}, scenario);
    if (program.lender_id === "cake" && scenario.borrower_type === "foreign_national") {
      a.fico = (program.eligibility_rules.foreign_national_min_fico_pricing) || 700;
    }
    if (program.lender_id === "amwest" && scenario.borrower_type === "foreign_national") {
      a.fico = 700;
    }
    return a;
  }

  function findBestExecution(scenario) {
    const eligible = [];
    const rejected = [];
    for (const program of PROGRAMS) {
      const adapted = adaptScenarioForLender(scenario, program);
      const result = priceScenarioFullLadder(adapted, program, COMP_CONFIG);
      if (!result.eligible) {
        rejected.push({ lender_id: program.lender_id, program_id: program.program_id, reason: result.reason });
        continue;
      }
      const tiers = buildTiers(result, scenario.loan_amount);
      eligible.push({ lender_id: program.lender_id, program_id: program.program_id, tiers });
    }
    if (eligible.length === 0) {
      return { eligible: false, rejected, reason: rejected.length > 0 ? rejected[0].reason : "No lenders qualified" };
    }
    const allBolts = eligible.map(r => Object.assign({}, r.tiers.bolt, { _source_lender: r.lender_id }));
    const allThunders = eligible.map(r => Object.assign({}, r.tiers.thunder, { _source_lender: r.lender_id }));
    const allLightnings = eligible.map(r => Object.assign({}, r.tiers.lightning, { _source_lender: r.lender_id }));
    const bestBolt = allBolts.reduce((b, c) => c._full_entry.final_price > b._full_entry.final_price ? c : b, allBolts[0]);
    const bestLightning = allLightnings.reduce((b, c) => c.note_rate < b.note_rate ? c : b, allLightnings[0]);
    const bestThunder = allThunders.reduce((b, c) => Math.abs(c._full_entry.final_price) < Math.abs(b._full_entry.final_price) ? c : b, allThunders[0]);
    return { eligible: true, bolt: bestBolt, thunder: bestThunder, lightning: bestLightning, eligible_count: eligible.length, rejected };
  }

  // =========================================================================
  // FORM HANDLING — money formatting + auto-calculation
  // =========================================================================

  function parseMoneyInput(value) {
    if (typeof value !== 'string') value = String(value || '');
    const cleaned = value.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  function formatMoneyInput(value) {
    const num = parseMoneyInput(value);
    if (num === 0) return '';
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function attachMoneyFormatting(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('blur', function() {
      const num = parseMoneyInput(this.value);
      if (num > 0) this.value = formatMoneyInput(this.value);
    });
    inputEl.addEventListener('focus', function() {
      this.select();
    });
    if (inputEl.value) {
      inputEl.value = formatMoneyInput(inputEl.value);
    }
  }

  // Auto-calculate loan amount from purchase price + down payment %
  function recalculateLoanAmount() {
    const goal = document.getElementById('goal').value;
    if (goal !== 'purchase') return;
    if (LOAN_AMOUNT_MANUALLY_EDITED) return; // Don't override if user manually entered

    const purchasePrice = parseMoneyInput(document.getElementById('purchase_price').value);
    const downPaymentPct = parseFloat(document.getElementById('down_payment').value) || 25;

    if (purchasePrice > 0) {
      const calculatedLoan = Math.round(purchasePrice * (1 - downPaymentPct / 100));
      const loanInput = document.getElementById('loan_amount');
      loanInput.value = '$' + calculatedLoan.toLocaleString('en-US');
    }
  }

  function readScenarioFromForm() {
    const goal = document.getElementById('goal').value;
    const fico = parseInt(document.getElementById('fico').value, 10);
    const dscr = parseFloat(document.getElementById('dscr').value);
    const propertyType = document.getElementById('property_type').value;
    const prepayTerm = document.getElementById('prepay_term').value;
    const state = document.getElementById('state').value;
    const loanAmount = parseMoneyInput(document.getElementById('loan_amount').value);

    let purpose, ltv;

    if (goal === 'purchase') {
      purpose = 'purchase';
      const purchasePrice = parseMoneyInput(document.getElementById('purchase_price').value);
      if (purchasePrice > 0 && loanAmount > 0) {
        ltv = Math.round((loanAmount / purchasePrice) * 1000) / 10;
      } else {
        const downPayment = parseFloat(document.getElementById('down_payment').value) || 25;
        ltv = Math.round((100 - downPayment) * 10) / 10;
      }
    } else {
      purpose = document.getElementById('refi_type').value || 'rate_term_refi';
      const propertyValue = parseMoneyInput(document.getElementById('property_value').value);
      if (propertyValue > 0) {
        ltv = Math.round((loanAmount / propertyValue) * 1000) / 10;
      } else {
        ltv = 75;
      }
    }

    return {
      fico, ltv, loan_amount: loanAmount, dscr,
      occupancy: 'non_owner_occupied',
      property_type: propertyType,
      borrower_type: 'us_citizen',
      entity_type: 'llc',
      state, purpose, prepay_term: prepayTerm,
      interest_only: false, is_arm: false, is_str: false,
      escrow_waiver: false, credit_history: 'clean'
    };
  }

  function formatMoney(n) {
    if (n === undefined || n === null || isNaN(n)) return "$—";
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString();
  }

  function renderTier(tierEl, tierData) {
    document.getElementById(tierEl + '-rate').textContent = tierData.note_rate.toFixed(3) + '%';
    document.getElementById(tierEl + '-payment').textContent = formatMoney(tierData.monthly_pi);
    const costEl = document.getElementById(tierEl + '-cost');
    if (tierData.is_lender_credit) {
      costEl.textContent = formatMoney(Math.abs(tierData.cost_dollars)) + ' lender credit';
      costEl.className = 'rh-tier-cost is-credit';
    } else if (tierData.cost_dollars > 0) {
      costEl.textContent = formatMoney(tierData.cost_dollars) + ' cost at closing';
      costEl.className = 'rh-tier-cost is-cost';
    } else {
      costEl.textContent = 'Par price';
      costEl.className = 'rh-tier-cost';
    }
  }

  function showWaitlistPanel(state) {
    const empty = document.getElementById('rh-results-empty');
    const active = document.getElementById('rh-results-active');
    const rejected = document.getElementById('rh-results-rejected');
    const waitlist = document.getElementById('rh-results-waitlist');
    empty.style.display = 'none';
    active.style.display = 'none';
    rejected.style.display = 'none';
    waitlist.style.display = 'flex';
    const stateInfo = WAITLIST_STATES[state] || { name: state, eta: 'TBD' };
    document.getElementById('rh-waitlist-headline').textContent = stateInfo.name + ' — Coming Soon';
    document.getElementById('rh-waitlist-message').textContent = "Rate Hero's " + stateInfo.name + " license is in progress. Get on the waitlist and we'll reach out the moment we can serve investors in " + stateInfo.name + ".";
    document.getElementById('rh-waitlist-eta').textContent = 'Estimated availability: ' + stateInfo.eta;
    SUBMISSION_MODE = 'waitlist';
    CURRENT_WAITLIST_STATE = state;
  }

  function showPricingResults(result) {
    const empty = document.getElementById('rh-results-empty');
    const active = document.getElementById('rh-results-active');
    const rejected = document.getElementById('rh-results-rejected');
    const waitlist = document.getElementById('rh-results-waitlist');
    empty.style.display = 'none';
    waitlist.style.display = 'none';
    if (!result.eligible) {
      active.style.display = 'none';
      rejected.style.display = 'flex';
      document.getElementById('rh-rejected-headline').textContent = 'No matching programs at this scenario';
      document.getElementById('rh-rejected-message').textContent = result.reason || 'Try adjusting your inputs, or talk to a loan strategist for a custom quote.';
      SUBMISSION_MODE = 'pricing';
      CURRENT_WAITLIST_STATE = null;
      LAST_PRICING_RESULT = null;
      SELECTED_TIER = null;
      return;
    }
    rejected.style.display = 'none';
    active.style.display = 'block';
    renderTier('lightning', result.lightning);
    renderTier('thunder', result.thunder);
    renderTier('bolt', result.bolt);
    SUBMISSION_MODE = 'pricing';
    CURRENT_WAITLIST_STATE = null;
    LAST_PRICING_RESULT = result;
    SELECTED_TIER = null;
  }

  function handleScenarioSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('rh-scenario-form');
    if (!form.reportValidity()) return;
    const scenario = readScenarioFromForm();
    if (WAITLIST_STATES[scenario.state]) {
      showWaitlistPanel(scenario.state);
      if (window.innerWidth < 968) {
        const panel = document.querySelector('.rh-results-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    const result = findBestExecution(scenario);
    showPricingResults(result);
    if (window.innerWidth < 968) {
      const panel = document.querySelector('.rh-results-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateConditionalFields() {
    const goal = document.getElementById('goal').value;
    const conditional = document.querySelectorAll('.rh-conditional');
    conditional.forEach(function(field) {
      const showIf = field.getAttribute('data-show-if-goal');
      if (showIf === goal) {
        field.style.display = '';
        field.style.animation = 'none';
        field.offsetHeight;
        field.style.animation = '';
      } else {
        field.style.display = 'none';
      }
    });
    // Reset manual edit flag when goal changes — recalc will run
    LOAN_AMOUNT_MANUALLY_EDITED = false;
    recalculateLoanAmount();
  }

  function toggleDscrTooltip() {
    const btn = document.getElementById('rh-dscr-tooltip-btn');
    const content = document.getElementById('rh-dscr-tooltip');
    if (content.style.display === 'none') {
      content.style.display = 'block';
      btn.classList.add('is-open');
    } else {
      content.style.display = 'none';
      btn.classList.remove('is-open');
    }
  }

  function openStrategistModal() {
    const modal = document.getElementById('rh-strategist-modal');
    const title = document.getElementById('rh-modal-title');
    const subtitle = document.getElementById('rh-modal-subtitle');
    const submitBtn = document.getElementById('rh-strategist-submit');
    const successTitle = document.getElementById('rh-modal-success-title');
    const successMsg = document.getElementById('rh-modal-success-msg');
    if (SUBMISSION_MODE === 'waitlist' && CURRENT_WAITLIST_STATE) {
      const stateInfo = WAITLIST_STATES[CURRENT_WAITLIST_STATE] || { name: CURRENT_WAITLIST_STATE, eta: 'TBD' };
      title.textContent = 'Join the ' + stateInfo.name + ' Waitlist';
      subtitle.textContent = "We'll reach out as soon as Rate Hero is licensed in " + stateInfo.name + ". Estimated: " + stateInfo.eta + ".";
      submitBtn.textContent = 'Join the Waitlist';
      successTitle.textContent = "You're on the list.";
      successMsg.textContent = "We'll reach out the moment Rate Hero is licensed in " + stateInfo.name + ".";
    } else {
      title.textContent = 'Talk to a Loan Strategist';
      subtitle.textContent = 'A Rate Hero loan strategist will reach out within one business day.';
      submitBtn.textContent = 'Send to a Strategist';
      successTitle.textContent = 'Thanks!';
      successMsg.textContent = 'A Rate Hero loan strategist will reach out within one business day.';
    }
    document.getElementById('rh-strategist-form').style.display = 'block';
    document.getElementById('rh-modal-success').style.display = 'none';
    submitBtn.disabled = false;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeStrategistModal() {
    document.getElementById('rh-strategist-modal').style.display = 'none';
    document.body.style.overflow = '';
  }

  async function handleStrategistSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('rh-strategist-form');
    if (!form.reportValidity()) return;
    const scenario = readScenarioFromForm();
    const submitBtn = document.getElementById('rh-strategist-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    const formData = new FormData(form);
    const isWaitlist = SUBMISSION_MODE === 'waitlist';
    const stateInfo = isWaitlist && CURRENT_WAITLIST_STATE ? WAITLIST_STATES[CURRENT_WAITLIST_STATE] : null;
    const subject = isWaitlist
      ? 'Rate Hero Engine — ' + (stateInfo ? stateInfo.name : scenario.state) + ' Waitlist Signup'
      : 'Rate Hero Engine — Loan Strategist Request';
    const submissionSource = isWaitlist
      ? 'Rate Hero Engine — ' + (stateInfo ? stateInfo.name : scenario.state) + ' Waitlist'
      : 'goratehero.com/rates';
    const purchasePrice = parseMoneyInput(document.getElementById('purchase_price') ? document.getElementById('purchase_price').value : '0');
    const propertyValue = parseMoneyInput(document.getElementById('property_value') ? document.getElementById('property_value').value : '0');
    const borrowerNotes = formData.get('notes') || '';
    const fullName = ((formData.get('first_name') || '') + ' ' + (formData.get('last_name') || '')).trim();

    // Map raw FICO to band label (matches existing CTA format like "760plus")
    function getFicoBandLabel(fico) {
      const f = parseInt(fico, 10);
      if (f >= 780) return '780plus';
      if (f >= 760) return '760-779';
      if (f >= 740) return '740-759';
      if (f >= 720) return '720-739';
      if (f >= 700) return '700-719';
      if (f >= 680) return '680-699';
      if (f >= 660) return '660-679';
      if (f >= 640) return '640-659';
      if (f >= 620) return '620-639';
      return 'below620';
    }

    function getLoanProgramLabel(purpose) {
      if (purpose === 'purchase') return 'DSCR Purchase';
      if (purpose === 'cash_out_refi') return 'DSCR Cash-Out Refi';
      if (purpose === 'rate_term_refi') return 'DSCR Rate-Term Refi';
      return 'DSCR';
    }

    function getPrepayLabel(term) {
      const map = {
        no_prepay: 'No prepay',
        one_year: '1-year',
        two_year: '2-year',
        three_year: '3-year',
        four_year: '4-year',
        five_year: '5-year'
      };
      return map[term] || term;
    }

    function fmt(amount) {
      const n = parseFloat(amount);
      if (!n || isNaN(n)) return '—';
      return '$' + Math.round(n).toLocaleString();
    }

    const ficoBand = getFicoBandLabel(scenario.fico);
    const programLabel = getLoanProgramLabel(scenario.purpose);
    const prepayLabel = getPrepayLabel(scenario.prepay_term);
    const valueOrPrice = scenario.purpose === 'purchase' ? purchasePrice : propertyValue;
    const valueOrPriceLabel = scenario.purpose === 'purchase' ? 'Purchase Price' : 'Property Value';

    // === SELECTED TIER + LENDER (the gap we're closing) ===
    // If borrower clicked Lightning/Thunder/Bolt, capture which one and which
    // lender priced it (cake / amwest / loanstream / change). Otherwise
    // (generic CTA, waitlist, or rejected scenario), this block is empty.
    function getLenderDisplay(id) {
      const map = {
        cake: 'Cake Mortgage',
        amwest: 'AmWest Funding',
        loanstream: 'LoanStream Mortgage',
        change: 'Change Lending'
      };
      return map[id] || id || 'Unknown';
    }
    let selectedTierBlock = '';
    let subjectTierTag = '';
    if (SELECTED_TIER && LAST_PRICING_RESULT && LAST_PRICING_RESULT.eligible && LAST_PRICING_RESULT[SELECTED_TIER]) {
      const t = LAST_PRICING_RESULT[SELECTED_TIER];
      const tierName = SELECTED_TIER.charAt(0).toUpperCase() + SELECTED_TIER.slice(1);
      const lenderId = t._source_lender || (t._full_entry && t._full_entry.lender_id) || 'unknown';
      const lenderDisplay = getLenderDisplay(lenderId);
      const rate = (typeof t.note_rate === 'number') ? t.note_rate.toFixed(3) + '%' : '—';
      const monthly = (typeof t.monthly_pi === 'number') ? '$' + Math.round(t.monthly_pi).toLocaleString() : '—';
      const dollars = t._full_entry && typeof t._full_entry.dollar_cost_or_credit === 'number'
        ? t._full_entry.dollar_cost_or_credit
        : (t.cost_dollars || 0);
      const dollarLabel = (t.is_lender_credit || dollars < 0)
        ? '$' + Math.abs(Math.round(dollars)).toLocaleString() + ' lender credit'
        : '$' + Math.round(dollars).toLocaleString() + ' cost at closing';
      subjectTierTag = ' [' + tierName + ' / ' + lenderId + ']';
      selectedTierBlock =
        '\n--- Selected Tier (Borrower Clicked) ---\n' +
        'Tier: ' + tierName + '\n' +
        'Lender: ' + lenderDisplay + ' (lender_id: ' + lenderId + ')\n' +
        'Rate: ' + rate + '\n' +
        'Monthly P&I: ' + monthly + '\n' +
        'Closing: ' + dollarLabel + '\n';
    } else if (LAST_PRICING_RESULT && LAST_PRICING_RESULT.eligible) {
      selectedTierBlock =
        '\n--- Selected Tier (Borrower Clicked) ---\n' +
        '(Generic "Talk to a Strategist" CTA — borrower did not pick a specific tier. ' +
        'They saw the full Lightning / Thunder / Bolt menu.)\n';
    }

    // Build the Scenario Summary text (lands in column O of the Google Sheet,
    // and is the cell Benji's import + the LO email both read for full context).
    let scenarioSummary;
    if (isWaitlist) {
      scenarioSummary =
        'WAITLIST SIGNUP for ' + (stateInfo ? stateInfo.name : scenario.state) + '. ' +
        'Borrower wants to be notified when Rate Hero is licensed in ' + (stateInfo ? stateInfo.name : scenario.state) + '. ' +
        'They built a pricing scenario but the state is not yet licensed.\n\n' +
        (borrowerNotes ? 'Borrower notes: ' + borrowerNotes + '\n\n' : '') +
        '--- Pricer Scenario ---\n' +
        'Pricer Program: ' + programLabel + '\n' +
        'Pricer ' + valueOrPriceLabel + ': ' + fmt(valueOrPrice) + '\n' +
        'Pricer Loan Amount: ' + fmt(scenario.loan_amount) + '\n' +
        'Pricer LTV: ' + scenario.ltv + '%\n' +
        'Pricer FICO: ' + scenario.fico + ' (band ' + ficoBand + ')\n' +
        'Pricer DSCR Ratio: ' + scenario.dscr + '\n' +
        'Pricer Property Type: ' + scenario.property_type + '\n' +
        'Pricer State: ' + scenario.state + '\n' +
        'Pricer Prepay Term: ' + prepayLabel + '\n' +
        'Pricer Submission Mode: waitlist\n' +
        'Pricer Waitlist State: ' + (CURRENT_WAITLIST_STATE || scenario.state) + '\n' +
        'Pricer Submission Source: ' + submissionSource +
        selectedTierBlock;
    } else {
      scenarioSummary =
        'Pricing scenario: ' + programLabel + ', ' + scenario.state + ', ' +
        scenario.property_type + ', ' + fmt(valueOrPrice) + ' ' + valueOrPriceLabel.toLowerCase() + ', ' +
        fmt(scenario.loan_amount) + ' loan, ' + scenario.ltv + '% LTV, ' +
        ficoBand + ' FICO, DSCR ' + scenario.dscr + ', prepay: ' + prepayLabel + '. ' +
        'Borrower wants a real quote.\n\n' +
        (borrowerNotes ? 'Borrower notes: ' + borrowerNotes + '\n\n' : '') +
        '--- Pricer Scenario ---\n' +
        'Pricer Program: ' + programLabel + '\n' +
        'Pricer ' + valueOrPriceLabel + ': ' + fmt(valueOrPrice) + '\n' +
        'Pricer Loan Amount: ' + fmt(scenario.loan_amount) + '\n' +
        'Pricer LTV: ' + scenario.ltv + '%\n' +
        'Pricer FICO: ' + scenario.fico + ' (band ' + ficoBand + ')\n' +
        'Pricer DSCR Ratio: ' + scenario.dscr + '\n' +
        'Pricer Property Type: ' + scenario.property_type + '\n' +
        'Pricer State: ' + scenario.state + '\n' +
        'Pricer Prepay Term: ' + prepayLabel + '\n' +
        'Pricer Submission Mode: pricing\n' +
        'Pricer Submission Source: ' + submissionSource +
        selectedTierBlock;
    }

    // Payload uses the SAME field names as your other goratehero.com CTAs so
    // the Web3Forms -> Google Sheet -> Benji import flow doesn't need any changes.
    // Pricer-specific richness lives inside scenario_summary (column O).
    const payload = {
      access_key: WEB3FORMS_KEY,
      subject: subject + subjectTierTag,
      from_name: 'Rate Hero Engine',
      name: fullName,
      email: formData.get('email'),
      phone: formData.get('phone'),
      loan_program: 'dscr',
      borrower_type: 'real estate investor',
      property_type: scenario.property_type,
      state: scenario.state,
      property_address: '',
      loan_amount: scenario.loan_amount,
      credit_score: ficoBand,
      timeline: 'asap',
      properties: '1',
      notes: borrowerNotes ? borrowerNotes + '\n\n' + scenarioSummary : scenarioSummary,
      scenario_summary: scenarioSummary
    };
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        document.getElementById('rh-strategist-form').style.display = 'none';
        document.getElementById('rh-modal-success').style.display = 'block';
        setTimeout(closeStrategistModal, 4000);
      } else {
        alert('There was a problem submitting your request. Please try again or call (747) 308-1635.');
        submitBtn.disabled = false;
        submitBtn.textContent = isWaitlist ? 'Join the Waitlist' : 'Send to a Strategist';
      }
    } catch (err) {
      alert('There was a problem submitting your request. Please try again or call (747) 308-1635.');
      submitBtn.disabled = false;
      submitBtn.textContent = isWaitlist ? 'Join the Waitlist' : 'Send to a Strategist';
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('rh-scenario-form').addEventListener('submit', handleScenarioSubmit);
    document.getElementById('rh-strategist-btn').addEventListener('click', function() { SELECTED_TIER = null; openStrategistModal(); });
    document.getElementById('rh-rejected-strategist-btn').addEventListener('click', function() { SELECTED_TIER = null; openStrategistModal(); });
    document.getElementById('rh-waitlist-btn').addEventListener('click', function() { SELECTED_TIER = null; openStrategistModal(); });
    document.getElementById('rh-modal-close').addEventListener('click', closeStrategistModal);
    document.getElementById('rh-strategist-form').addEventListener('submit', handleStrategistSubmit);
    document.getElementById('rh-strategist-modal').addEventListener('click', function(e) {
      if (e.target === this) closeStrategistModal();
    });
    document.querySelectorAll('.rh-btn-tier').forEach(function(btn) {
      btn.addEventListener('click', function() {
        SELECTED_TIER = btn.getAttribute('data-tier') || null;
        openStrategistModal();
      });
    });

    // Conditional fields based on Goal
    document.getElementById('goal').addEventListener('change', updateConditionalFields);

    // Money formatting
    attachMoneyFormatting(document.getElementById('loan_amount'));
    attachMoneyFormatting(document.getElementById('purchase_price'));
    attachMoneyFormatting(document.getElementById('property_value'));

    // Auto-calculate loan amount when purchase price or down payment changes
    document.getElementById('purchase_price').addEventListener('input', recalculateLoanAmount);
    document.getElementById('purchase_price').addEventListener('blur', recalculateLoanAmount);
    document.getElementById('down_payment').addEventListener('input', recalculateLoanAmount);

    // Track if user manually edits loan amount (so we don't override their value)
    document.getElementById('loan_amount').addEventListener('input', function() {
      LOAN_AMOUNT_MANUALLY_EDITED = true;
    });

    // DSCR tooltip
    document.getElementById('rh-dscr-tooltip-btn').addEventListener('click', toggleDscrTooltip);

    // Initial state
    updateConditionalFields();
  });

})();
