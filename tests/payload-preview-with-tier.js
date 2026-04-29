// Preview the payload the form would send if a borrower clicked the Lightning tier.
// Uses the real engine + real lender JSONs to compute tier results.

const path = require("path");
const bestExec = require("../engine/best-execution.js");

const LENDERS_PATH = path.join(__dirname, "../lenders");
const COMP_CONFIG_PATH = path.join(__dirname, "../config/comp.json");

// Sean's actual test scenario from the email he shared
const scenario = {
  fico: 780, ltv: 60.4, loan_amount: 160000, dscr: 1.20,
  occupancy: "non_owner_occupied", property_type: "sfr",
  borrower_type: "us_citizen", entity_type: "llc", state: "AL",
  purpose: "cash_out_refi", prepay_term: "five_year",
  interest_only: false, is_arm: false, is_str: false,
  escrow_waiver: false, credit_history: "clean"
};

const result = bestExec.findBestExecution(scenario, LENDERS_PATH, COMP_CONFIG_PATH);

if (!result.eligible) {
  console.log("Not eligible:", result.reason);
  process.exit(1);
}

console.log("Engine returned three tiers:");
console.log("  Lightning: rate=" + result.lightning.note_rate + "  lender=" + result.lightning._source_lender);
console.log("  Thunder:   rate=" + result.thunder.note_rate + "  lender=" + result.thunder._source_lender);
console.log("  Bolt:      rate=" + result.bolt.note_rate + "  lender=" + result.bolt._source_lender);
console.log("");

// Simulate clicking the Lightning tier
const SELECTED_TIER = "lightning";
const LAST_PRICING_RESULT = result;

// === Replicate the payload-building logic from app.js ===
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
function getLoanProgramLabel(p) {
  if (p === 'purchase') return 'DSCR Purchase';
  if (p === 'cash_out_refi') return 'DSCR Cash-Out Refi';
  if (p === 'rate_term_refi') return 'DSCR Rate-Term Refi';
  return 'DSCR';
}
function getPrepayLabel(t) {
  return ({no_prepay:'No prepay',one_year:'1-year',two_year:'2-year',three_year:'3-year',four_year:'4-year',five_year:'5-year'})[t] || t;
}
function fmt(n) {
  const v = parseFloat(n);
  if (!v || isNaN(v)) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function getLenderDisplay(id) {
  const map = { cake: 'Cake Mortgage', amwest: 'AmWest Funding', loanstream: 'LoanStream Mortgage', change: 'Change Lending' };
  return map[id] || id || 'Unknown';
}

const ficoBand = getFicoBandLabel(scenario.fico);
const programLabel = getLoanProgramLabel(scenario.purpose);
const prepayLabel = getPrepayLabel(scenario.prepay_term);
const purchasePrice = 0, propertyValue = 265000;
const valueOrPrice = scenario.purpose === 'purchase' ? purchasePrice : propertyValue;
const valueOrPriceLabel = scenario.purpose === 'purchase' ? 'Purchase Price' : 'Property Value';
const fullName = "Sean PRICER TEST Davoodian";
const borrowerNotes = "Love this option";

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
}

const scenarioSummary =
  'Pricing scenario: ' + programLabel + ', ' + scenario.state + ', ' +
  scenario.property_type + ', ' + fmt(valueOrPrice) + ' ' + valueOrPriceLabel.toLowerCase() + ', ' +
  fmt(scenario.loan_amount) + ' loan, ' + scenario.ltv + '% LTV, ' +
  ficoBand + ' FICO, DSCR ' + scenario.dscr + ', prepay: ' + prepayLabel + '. Borrower wants a real quote.\n\n' +
  'Borrower notes: ' + borrowerNotes + '\n\n' +
  '--- Pricer Scenario ---\n' +
  'Program: ' + programLabel + '\n' +
  valueOrPriceLabel + ': ' + fmt(valueOrPrice) + '\n' +
  'Loan Amount: ' + fmt(scenario.loan_amount) + '\n' +
  'LTV: ' + scenario.ltv + '%\n' +
  'FICO: ' + scenario.fico + ' (band ' + ficoBand + ')\n' +
  'DSCR Ratio: ' + scenario.dscr + '\n' +
  'Property Type: ' + scenario.property_type + '\n' +
  'State: ' + scenario.state + '\n' +
  'Prepay Term: ' + prepayLabel + '\n' +
  'Submission Mode: pricing\n' +
  'Submission Source: goratehero.com/rates' +
  selectedTierBlock;

const subject = 'Rate Hero Engine — Loan Strategist Request' + subjectTierTag;

const notes = borrowerNotes
  ? borrowerNotes + '\n\n' + scenarioSummary
  : scenarioSummary;

console.log("================================================================");
console.log("EMAIL SUBJECT:");
console.log("================================================================");
console.log(subject);
console.log("");
console.log("================================================================");
console.log("NOTES (merged borrower notes + scenario summary):");
console.log("================================================================");
console.log(notes);
console.log("");
console.log("================================================================");
console.log("SCENARIO SUMMARY (column O of Sheet):");
console.log("================================================================");
console.log(scenarioSummary);
