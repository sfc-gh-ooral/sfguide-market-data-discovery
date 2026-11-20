// Seeded, deterministic synthetic data for the Market Data Discovery example.
//
//   npm run generate-data
//
// Writes data/csv/*.csv.gz (loaded by sql/setup.sql) and lib/mock/market.json (the
// no-account mode). Same seed, same numbers, every run. All names are invented.
//
// Daily prices are NOT shipped as a file: sql/setup.sql computes them with the closed-form
// formula in priceAdj() below, from PRICE_PARAMS. This script uses the same formula, so the
// sample mode and live mode agree (to the cent, give or take float rounding).

import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CSV = resolve(ROOT, "data/csv");
const MOCK = resolve(ROOT, "lib/mock");
mkdirSync(CSV, { recursive: true });
mkdirSync(MOCK, { recursive: true });

// ---------- deterministic helpers ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261107);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const r2 = (x) => Math.round(x * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);

function writeCsv(name, header, rows) {
  const esc = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const body = [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n") + "\n";
  writeFileSync(resolve(CSV, `${name}.csv.gz`), gzipSync(body, { level: 9, mtime: 0 }));
}

// ---------- calendar: weekdays 2021-11-01 .. 2026-10-30 ----------
export const START = "2021-11-01";
export const END = "2026-10-30";
const DAYS = [];
for (let d = new Date(`${START}T00:00:00Z`); iso(d) <= END; d.setUTCDate(d.getUTCDate() + 1)) {
  const w = d.getUTCDay();
  if (w !== 0 && w !== 6) DAYS.push(iso(d));
}
const dayIndex = new Map(DAYS.map((d, i) => [d, i]));

// Closed form, mirrored in sql/setup.sql (PRICES_DAILY). t = trading-day index from START.
function priceAdj(p, t) {
  return r2(p.base_price * Math.exp(p.drift * t + p.vol * (0.6 * Math.sin(t / 37 + p.phase) + 0.3 * Math.sin(t / 11 + 2 * p.phase) + 0.1 * Math.sin(t * 1.3 + 3 * p.phase))));
}

// ---------- securities ----------
const SECTORS = ["Technology", "Health Care", "Financials", "Industrials", "Consumer Discretionary", "Consumer Staples", "Energy", "Utilities", "Materials", "Communication Services", "Real Estate"];
const SECTOR_WORDS = {
  "Technology": ["Systems", "Software", "Semiconductor", "Networks", "Digital"],
  "Health Care": ["Therapeutics", "Biosciences", "Medical", "Health", "Diagnostics"],
  "Financials": ["Bancorp", "Capital", "Financial", "Assurance", "Trust"],
  "Industrials": ["Industries", "Aerospace", "Logistics", "Machinery", "Engineering"],
  "Consumer Discretionary": ["Brands", "Retail", "Motors", "Leisure", "Apparel"],
  "Consumer Staples": ["Foods", "Beverages", "Household", "Grocers", "Farms"],
  "Energy": ["Energy", "Petroleum", "Midstream", "Drilling", "Renewables"],
  "Utilities": ["Utilities", "Power", "Water", "Gas & Electric", "Grid"],
  "Materials": ["Materials", "Chemicals", "Metals", "Packaging", "Minerals"],
  "Communication Services": ["Media", "Telecom", "Interactive", "Broadcasting", "Studios"],
  "Real Estate": ["Realty", "Properties", "REIT", "Land", "Estates"],
};
const STEMS = ["Arvane", "Brellis", "Calderon", "Dravik", "Elsmere", "Fenwyn", "Galtrey", "Halvorn", "Istrel", "Jorvane", "Kestril", "Lunaris", "Marrow", "Nolvar", "Orlesk", "Pellam", "Quillfield", "Rendal", "Sorvik", "Tamsin", "Ulvera", "Vantorr", "Wrenfold", "Xandel", "Yarrow", "Zephyrine", "Ashby", "Brightmoor", "Corvella", "Delmont", "Eastbrook", "Fairhaven", "Glenvar", "Holloway", "Ironvale", "Juniper", "Kingsley", "Larchmont", "Meridale", "Northam", "Oakhurst", "Pinecrest", "Queensbury", "Redfern", "Stonebridge", "Thornbury", "Upland", "Valecrest", "Westmere", "Yewdale"];
const COUNTRIES = [["US", 0.52, "USD"], ["CA", 0.07, "CAD"], ["GB", 0.08, "GBP"], ["DE", 0.06, "EUR"], ["FR", 0.05, "EUR"], ["JP", 0.08, "JPY"], ["CH", 0.04, "CHF"], ["NL", 0.03, "EUR"], ["AU", 0.04, "AUD"], ["SE", 0.03, "SEK"]];
function country() {
  let x = rnd();
  for (const c of COUNTRIES) { if ((x -= c[1]) <= 0) return c; }
  return COUNTRIES[0];
}

// Planted names (stories 1 and 2) are fixed; the rest are generated.
const PLANTED = [
  { issuer: "Arvane Systems", ticker: "ARVN", sector: "Technology", c: COUNTRIES[0] },          // acquirer
  { issuer: "Quillfield Semiconductor", ticker: "QLFD", sector: "Technology", c: COUNTRIES[0] }, // merger target
  { issuer: "Corvella Therapeutics", ticker: "CRVL", sector: "Health Care", c: COUNTRIES[0] },  // 4-for-1 split
];
const securities = [];
const usedNames = new Set(PLANTED.map((p) => p.issuer));
const usedTickers = new Set(PLANTED.map((p) => p.ticker));
function isinLike(n) {
  // "ZZ" is not an ISO country code, so these can never collide with a real ISIN.
  const body = `ZZ${String(100000000 + n * 7919).slice(-9)}`;
  const digits = body.split("").map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch)).join("");
  let sum = 0;
  digits.split("").reverse().forEach((ch, i) => { let v = +ch; if (i % 2 === 0) { v *= 2; if (v > 9) v -= 9; } sum += v; });
  return body + ((10 - (sum % 10)) % 10);
}
for (let i = 0; i < 800; i++) {
  let issuer, ticker, sector, c;
  if (i < PLANTED.length) ({ issuer, ticker, sector, c } = PLANTED[i]);
  else {
    sector = SECTORS[i % SECTORS.length];
    c = country();
    do { issuer = `${pick(STEMS)} ${pick(SECTOR_WORDS[sector])}`; } while (usedNames.has(issuer) && rnd() < 0.999) ;
    if (usedNames.has(issuer)) issuer = `${issuer} ${["Group", "Holdings", "International", "Partners"][i % 4]}`;
    if (usedNames.has(issuer)) issuer = `${issuer} ${i}`;
    const letters = issuer.replace(/[^A-Za-z]/g, "").toUpperCase();
    ticker = letters.slice(0, 4);
    for (let k = 0; usedTickers.has(ticker); k++) ticker = letters.slice(0, 3) + "ABCDEFGHJKLMNPRSTUVWXYZ"[k % 23] + (k >= 23 ? String(k) : "");
  }
  usedNames.add(issuer); usedTickers.add(ticker);
  const id = `SEC${String(i + 1).padStart(5, "0")}`;
  securities.push({
    security_id: id, ticker, isin_like_id: isinLike(i + 1), issuer_name: issuer, sector, country: c[0], currency: c[2],
    listing_date: iso(new Date(Date.UTC(1985 + int(0, 34), int(0, 11), int(1, 28)))),
  });
}
const SEC = new Map(securities.map((s) => [s.security_id, s]));
const byTicker = (t) => securities.find((s) => s.ticker === t);
const ARVN = byTicker("ARVN"), QLFD = byTicker("QLFD"), CRVL = byTicker("CRVL");

// Price generator parameters (not a vendor table; setup.sql drops it after building prices).
const params = securities.map((s, i) => ({
  security_id: s.security_id,
  base_price: r2(8 + rnd() * 240),
  drift: Math.round((rnd() * 0.0009 - 0.0002) * 1e6) / 1e6,
  vol: Math.round((0.08 + rnd() * 0.22) * 1e4) / 1e4,
  phase: Math.round(rnd() * 6.2832 * 1e4) / 1e4,
  _i: i,
}));
const P = new Map(params.map((p) => [p.security_id, p]));
// Planted prices: Corvella runs up into its split; Arvane steady; Quillfield modest.
Object.assign(P.get(CRVL.security_id), { base_price: 96, drift: 0.0011, vol: 0.12, phase: 1.1 });
Object.assign(P.get(ARVN.security_id), { base_price: 58, drift: 0.0006, vol: 0.1, phase: 2.4 });
Object.assign(P.get(QLFD.security_id), { base_price: 41, drift: 0.0004, vol: 0.14, phase: 0.6 });

// ---------- corporate actions ----------
const MERGER_DATE = "2026-03-02", MERGER_RATIO = 0.85; // 0.85 ARVN per QLFD share
const SPLIT_DATE = "2025-06-16", SPLIT_RATIO = 4;
const corporateActions = [];
let caN = 0;
const ca = (o) => corporateActions.push({ action_id: `CA${String(++caN).padStart(5, "0")}`, acquirer_security_id: null, cash_amount: null, ratio: null, ...o });
ca({ security_id: CRVL.security_id, action_type: "SPLIT", ex_date: SPLIT_DATE, ratio: SPLIT_RATIO, description: "4-for-1 forward stock split" });
ca({ security_id: QLFD.security_id, action_type: "MERGER", ex_date: MERGER_DATE, ratio: MERGER_RATIO, acquirer_security_id: ARVN.security_id, description: "Acquired by Arvane Systems in an all-stock merger; 0.85 ARVN shares per QLFD share. QLFD delisted." });
const otherSplits = [];
for (let k = 0; k < 7; k++) {
  const s = securities[10 + k * 97];
  const ratio = [2, 3, 2, 5, 2, 3, 2][k];
  const ex = DAYS[200 + k * 140];
  otherSplits.push({ id: s.security_id, ex, ratio });
  ca({ security_id: s.security_id, action_type: "SPLIT", ex_date: ex, ratio, description: `${ratio}-for-1 forward stock split` });
}
for (let k = 0; k < 140; k++) {
  const s = securities[int(3, 799)];
  ca({ security_id: s.security_id, action_type: "CASH_DIVIDEND", ex_date: DAYS[int(20, DAYS.length - 5)], cash_amount: r2(0.05 + rnd() * 1.4), description: "Regular quarterly cash dividend" });
}
corporateActions.sort((a, b) => (a.ex_date < b.ex_date ? -1 : a.ex_date > b.ex_date ? 1 : a.action_id < b.action_id ? -1 : 1));
// Split factor for unadjusted close before each ex-date (mirrored in setup.sql).
const splitsBy = new Map();
for (const a of corporateActions.filter((x) => x.action_type === "SPLIT")) splitsBy.set(a.security_id, [...(splitsBy.get(a.security_id) ?? []), a]);
const lastDay = (id) => (id === QLFD.security_id ? DAYS[dayIndex.get(MERGER_DATE) - 1] : END);
function bar(id, date) {
  const t = dayIndex.get(date);
  const adj = priceAdj(P.get(id), t);
  let f = 1;
  for (const s of splitsBy.get(id) ?? []) if (date < s.ex_date) f *= s.ratio;
  return { trade_date: date, close_adj: adj, close_unadj: r2(adj * f) };
}

// ---------- fundamentals, ESG, fund holdings ----------
const quarterEnds = ["2021-12-31"];
for (let y = 2022; y <= 2026; y++) for (const q of ["03-31", "06-30", "09-30", "12-31"]) if (`${y}-${q}` <= "2026-09-30") quarterEnds.push(`${y}-${q}`);
const fundamentals = [];
for (const s of securities) {
  const rev0 = 80 + rnd() * 6000, margin = -2 + rnd() * 28, g = rnd() * 0.04 - 0.008;
  quarterEnds.forEach((q, i) => {
    if (s.security_id === QLFD.security_id && q > "2025-12-31") return;
    const rev = rev0 * Math.pow(1 + g, i) * (0.96 + rnd() * 0.08);
    const m = margin + (rnd() * 4 - 2);
    fundamentals.push({ security_id: s.security_id, fiscal_quarter_end: q, revenue_musd: r2(rev), net_margin_pct: r2(m), eps: r2((rev * m) / 100 / (40 + (s.security_id.charCodeAt(7) % 30) * 10)), debt_to_equity: r2(0.1 + rnd() * 2.2) });
  });
}
const esgDates = ["2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
const esg = [];
for (const s of securities) {
  const base = 35 + rnd() * 50;
  esgDates.forEach((d) => {
    if (s.security_id === QLFD.security_id && d > "2025-12-31") return;
    const e = Math.min(99, Math.max(5, base + rnd() * 10 - 5)), so = Math.min(99, Math.max(5, base + rnd() * 14 - 7)), gv = Math.min(99, Math.max(5, base + rnd() * 12 - 6));
    esg.push({ security_id: s.security_id, as_of_date: d, esg_score: r2((e + so + gv) / 3), environmental: r2(e), social: r2(so), governance: r2(gv) });
  });
}
const FUND_NAMES = ["Acme Global Equity Index", "Acme US Large Cap", "Acme Technology Leaders", "Acme Health Innovation", "Acme Dividend Income", "Acme International Developed", "Acme Clean Energy", "Acme Financials Select", "Acme Small Cap Value", "Acme Real Assets", "Acme ESG Leaders", "Acme Consumer Trends"];
const fundHoldings = [];
FUND_NAMES.forEach((name, fi) => {
  const picks = new Set();
  while (picks.size < 50) picks.add(securities[int(0, 799)].security_id);
  const w = [...picks].map(() => rnd() + 0.2), tot = w.reduce((a, b) => a + b, 0);
  [...picks].forEach((id, k) => fundHoldings.push({ fund_id: `FND${String(fi + 1).padStart(3, "0")}`, fund_name: name, security_id: id, weight_pct: r2((w[k] / tot) * 100), as_of_date: "2026-09-30" }));
});

// ---------- data dictionary (story 3: adjusted vs unadjusted close) ----------
const D = (dataset, column_name, data_type, description, example) => ({ dataset, table_name: dataset.toUpperCase(), column_name, data_type, description, example });
const dictionary = [
  D("securities", "SECURITY_ID", "VARCHAR", "Vendor's permanent security key. Join key for every other dataset.", "SEC00001"),
  D("securities", "TICKER", "VARCHAR", "Exchange ticker symbol. Tickers can be reused after delisting; join on SECURITY_ID, not TICKER.", "ARVN"),
  D("securities", "ISIN_LIKE_ID", "VARCHAR", "Synthetic 12-character identifier in ISIN format (ZZ prefix, never a real ISIN).", "ZZ1000079198"),
  D("securities", "ISSUER_NAME", "VARCHAR", "Legal name of the issuer.", "Arvane Systems"),
  D("securities", "SECTOR", "VARCHAR", "Issuer's sector classification (11 sectors). Use this for sector exposure.", "Technology"),
  D("securities", "COUNTRY", "VARCHAR", "Country of incorporation, ISO 3166 alpha-2. Use this for country exposure.", "US"),
  D("securities", "CURRENCY", "VARCHAR", "Trading currency of the primary listing, ISO 4217.", "USD"),
  D("securities", "LISTING_DATE", "DATE", "Date the security first listed on its primary exchange.", "2004-05-12"),
  D("prices_daily", "TRADE_DATE", "DATE", "Trading date (weekdays only).", "2026-10-30"),
  D("prices_daily", "CLOSE_UNADJ", "NUMBER(12,2)", "Official closing price as printed on the trade date, NOT adjusted for later splits. Shows a step change on a split ex-date. Use it to value a position on that date with that date's share count.", "412.80"),
  D("prices_daily", "CLOSE_ADJ", "NUMBER(12,2)", "Closing price adjusted for all subsequent stock splits so the series is continuous. Use it for returns, charts, and price history. Not adjusted for cash dividends.", "103.20"),
  D("prices_daily", "VOLUME", "NUMBER", "Shares traded on the trade date, as printed (not split-adjusted).", "742310"),
  D("corporate_actions", "ACTION_TYPE", "VARCHAR", "SPLIT, CASH_DIVIDEND, or MERGER.", "SPLIT"),
  D("corporate_actions", "EX_DATE", "DATE", "First trading date the action applies. Unadjusted prices change on this date.", "2025-06-16"),
  D("corporate_actions", "RATIO", "NUMBER(10,4)", "For SPLIT: new shares per old share (4 = 4-for-1). For MERGER: acquirer shares received per target share.", "4"),
  D("corporate_actions", "ACQUIRER_SECURITY_ID", "VARCHAR", "For MERGER: the surviving security that holders receive.", "SEC00001"),
  D("corporate_actions", "CASH_AMOUNT", "NUMBER(10,2)", "For CASH_DIVIDEND: amount per share in the trading currency.", "0.42"),
  D("fundamentals_quarterly", "FISCAL_QUARTER_END", "DATE", "Last day of the fiscal quarter reported.", "2026-09-30"),
  D("fundamentals_quarterly", "REVENUE_MUSD", "NUMBER(14,2)", "Quarterly revenue in millions of US dollars.", "1520.44"),
  D("fundamentals_quarterly", "NET_MARGIN_PCT", "NUMBER(8,2)", "Net income as a percent of revenue for the quarter.", "14.20"),
  D("fundamentals_quarterly", "EPS", "NUMBER(10,2)", "Diluted earnings per share for the quarter.", "1.87"),
  D("fundamentals_quarterly", "DEBT_TO_EQUITY", "NUMBER(8,2)", "Total debt divided by shareholders' equity at quarter end.", "0.65"),
  D("esg_scores", "AS_OF_DATE", "DATE", "Quarter-end date of the score. Use the latest AS_OF_DATE per security for current scores.", "2026-09-30"),
  D("esg_scores", "ESG_SCORE", "NUMBER(6,2)", "Overall ESG score, 0 to 100, higher is better. Average of the three pillar scores.", "71.35"),
  D("esg_scores", "ENVIRONMENTAL", "NUMBER(6,2)", "Environmental pillar score, 0 to 100.", "68.10"),
  D("esg_scores", "SOCIAL", "NUMBER(6,2)", "Social pillar score, 0 to 100.", "74.02"),
  D("esg_scores", "GOVERNANCE", "NUMBER(6,2)", "Governance pillar score, 0 to 100.", "71.93"),
  D("fund_holdings", "FUND_ID", "VARCHAR", "Vendor key for the fund.", "FND003"),
  D("fund_holdings", "FUND_NAME", "VARCHAR", "Fund display name.", "Acme Technology Leaders"),
  D("fund_holdings", "WEIGHT_PCT", "NUMBER(6,2)", "Holding weight as a percent of fund net assets on AS_OF_DATE.", "2.41"),
  D("fund_holdings", "AS_OF_DATE", "DATE", "Portfolio disclosure date.", "2026-09-30"),
  D("data_dictionary", "DESCRIPTION", "VARCHAR", "Plain-English meaning of each field, as published by the vendor.", "Closing price adjusted for…"),
];

// ---------- firm side: advisors and client books ----------
const ADVISORS = [
  ["ADV01", "Priya Natarajan", "Lakeshore"], ["ADV02", "Tomas Ferreira", "Lakeshore"], ["ADV03", "Hannah Lindqvist", "Riverside"],
  ["ADV04", "Marcus Oyelaran", "Riverside"], ["ADV05", "Elena Varga", "Hillcrest"], ["ADV06", "Daniel Achterberg", "Hillcrest"],
].map(([advisor_id, advisor_name, office]) => ({ advisor_id, advisor_name, office }));
const FIRST = ["Avery", "Jordan", "Morgan", "Riley", "Casey", "Quinn", "Rowan", "Sasha", "Emerson", "Hayden", "Parker", "Reese", "Logan", "Drew", "Skyler", "Blair", "Cameron", "Dakota", "Finley", "Harper"];
const LAST = ["Abernathy", "Bellweather", "Castellano", "Delacroix", "Ellingham", "Fairbanks", "Goldwyn", "Hargrove", "Iverson", "Jansen", "Kowalczyk", "Lindgren", "Montague", "Nakashima", "Oduya", "Pemberton", "Quintero", "Rosales", "Sterling", "Thackeray", "Underhill", "Valdivia", "Whitlock", "Yamamoto"];
const PRE = "2026-02-27", POST = END; // snapshot dates: before and after the merger
const accounts = [];
const holdingsPre = [];
const techIds = securities.filter((s) => s.sector === "Technology").map((s) => s.security_id);
for (let a = 0; a < 240; a++) {
  const adv = ADVISORS[a % ADVISORS.length];
  const acct = `ACC${String(a + 1).padStart(4, "0")}`;
  accounts.push({ account_id: acct, advisor_id: adv.advisor_id, client_name: `${pick(FIRST)} ${pick(LAST)}` });
  const n = int(10, 18);
  const picks = new Set();
  // Story 1: most books hold both Quillfield and Arvane; the merger stacks them into one name.
  if (rnd() < 0.62) picks.add(QLFD.security_id);
  if (rnd() < 0.7) picks.add(ARVN.security_id);
  while (picks.size < n) picks.add(rnd() < 0.06 ? pick(techIds) : securities[int(3, 799)].security_id);
  for (const id of picks) {
    const px = bar(id, PRE).close_unadj;
    const target = id === QLFD.security_id ? 14000 + rnd() * 22000 : id === ARVN.security_id ? 12000 + rnd() * 20000 : 4000 + rnd() * 26000;
    holdingsPre.push({ account_id: acct, advisor_id: adv.advisor_id, security_id: id, quantity: Math.max(1, Math.round(target / px)), as_of_date: PRE });
  }
}
// Post-merger snapshot: QLFD converts to ARVN at 0.85; splits after PRE scale quantity.
const holdingsPost = [];
for (const acct of accounts) {
  const rows = holdingsPre.filter((h) => h.account_id === acct.account_id);
  const q = new Map();
  for (const h of rows) {
    let id = h.security_id, qty = h.quantity;
    if (id === QLFD.security_id) { id = ARVN.security_id; qty = Math.floor(qty * MERGER_RATIO); }
    for (const s of splitsBy.get(id) ?? []) if (s.ex_date > PRE && s.ex_date <= POST) qty *= s.ratio;
    q.set(id, (q.get(id) ?? 0) + qty);
  }
  for (const [id, qty] of q) holdingsPost.push({ account_id: acct.account_id, advisor_id: acct.advisor_id, security_id: id, quantity: qty, as_of_date: POST });
}
const clientHoldings = [...holdingsPre, ...holdingsPost];

// ---------- licenses and usage (story 4) ----------
const DATASETS = ["securities", "prices_daily", "corporate_actions", "fundamentals_quarterly", "esg_scores", "fund_holdings", "data_dictionary"];
const DATASET_LABEL = { securities: "Securities master", prices_daily: "Daily prices", corporate_actions: "Corporate actions", fundamentals_quarterly: "Quarterly fundamentals", esg_scores: "ESG scores", fund_holdings: "Fund holdings", data_dictionary: "Data dictionary" };
const DATASET_DESC = {
  securities: "Security master: identifiers, issuer, sector, and country for 800 listed equities.",
  prices_daily: "Five years of daily closing prices, both as printed and split-adjusted, plus volume.",
  corporate_actions: "Splits, cash dividends, and mergers with ex-dates and ratios.",
  fundamentals_quarterly: "Quarterly revenue, margin, EPS, and leverage per issuer.",
  esg_scores: "Quarterly ESG scores with environmental, social, and governance pillars.",
  fund_holdings: "Constituents and weights for 12 Acme index and active funds.",
  data_dictionary: "Plain-English definitions for every field in the share.",
};
const LICENSE = { securities: 38000, prices_daily: 96000, corporate_actions: 24000, fundamentals_quarterly: 62000, esg_scores: 45000, fund_holdings: 31000, data_dictionary: 0 };
const licenses = DATASETS.map((d) => ({ dataset: d, annual_cost_usd: LICENSE[d], renewal_date: d === "esg_scores" ? "2027-01-31" : d === "fund_holdings" ? "2027-02-28" : "2027-06-30" }));
const USERS = ["a.moreau", "b.okonkwo", "c.halloran", "d.sato", "e.brandt", "f.mensah", "g.rivera", "h.kaur", "i.petrov", "j.whitaker", "k.lund", "l.adeyemi", "m.castro", "n.fischer"];
const usage = [];
const usageStart = new Date(Date.UTC(2026, 7, 2)); // 2026-08-02 .. 2026-10-30 (90 days)
for (let k = 0; k < 90; k++) {
  const d = new Date(usageStart); d.setUTCDate(d.getUTCDate() + k);
  const day = iso(d), w = d.getUTCDay();
  if (w === 0 || w === 6) continue;
  for (const ds of DATASETS) {
    const plan = { securities: [10, 2.2], prices_daily: [12, 3.5], corporate_actions: [6, 1.1], fundamentals_quarterly: [8, 1.6], esg_scores: [0, 0], fund_holdings: [0, 0], data_dictionary: [7, 0.8] }[ds];
    for (let u = 0; u < plan[0]; u++) {
      const n = Math.round(rnd() * plan[1] * 2);
      if (n > 0) usage.push({ usage_date: day, user_name: USERS[(u * 3 + k) % USERS.length], dataset: ds, queries: n });
    }
  }
}
// Barely used: a handful of queries from one or two people, weeks ago.
usage.push({ usage_date: "2026-08-11", user_name: "k.lund", dataset: "esg_scores", queries: 2 });
usage.push({ usage_date: "2026-08-25", user_name: "k.lund", dataset: "esg_scores", queries: 1 });
usage.push({ usage_date: "2026-09-03", user_name: "g.rivera", dataset: "fund_holdings", queries: 1 });
usage.sort((a, b) => (a.usage_date + a.dataset + a.user_name < b.usage_date + b.dataset + b.user_name ? -1 : 1));

// ---------- write CSVs ----------
writeCsv("securities", ["security_id", "ticker", "isin_like_id", "issuer_name", "sector", "country", "currency", "listing_date"], securities);
writeCsv("price_params", ["security_id", "base_price", "drift", "vol", "phase"], params);
writeCsv("corporate_actions", ["action_id", "security_id", "action_type", "ex_date", "ratio", "acquirer_security_id", "cash_amount", "description"], corporateActions);
writeCsv("fundamentals_quarterly", ["security_id", "fiscal_quarter_end", "revenue_musd", "net_margin_pct", "eps", "debt_to_equity"], fundamentals);
writeCsv("esg_scores", ["security_id", "as_of_date", "esg_score", "environmental", "social", "governance"], esg);
writeCsv("fund_holdings", ["fund_id", "fund_name", "security_id", "weight_pct", "as_of_date"], fundHoldings);
writeCsv("data_dictionary", ["dataset", "table_name", "column_name", "data_type", "description", "example"], dictionary);
writeCsv("advisors", ["advisor_id", "advisor_name", "office"], ADVISORS);
writeCsv("client_accounts", ["account_id", "advisor_id", "client_name"], accounts);
writeCsv("client_holdings", ["account_id", "advisor_id", "security_id", "quantity", "as_of_date"], clientHoldings);
writeCsv("dataset_licenses", ["dataset", "annual_cost_usd", "renewal_date"], licenses);
writeCsv("dataset_usage_log", ["usage_date", "user_name", "dataset", "queries"], usage);

// ---------- precompute the no-account mode ----------
const priceRows = securities.reduce((n, s) => n + dayIndex.get(lastDay(s.security_id)) + 1, 0);
const counts = { securities: securities.length, prices_daily: priceRows, corporate_actions: corporateActions.length, fundamentals_quarterly: fundamentals.length, esg_scores: esg.length, fund_holdings: fundHoldings.length, data_dictionary: dictionary.length };
const freshness = { securities: END, prices_daily: END, corporate_actions: corporateActions.at(-1).ex_date, fundamentals_quarterly: "2026-09-30", esg_scores: "2026-09-30", fund_holdings: "2026-09-30", data_dictionary: END };
const sampleRows = {
  securities: securities.slice(0, 5),
  prices_daily: DAYS.slice(-5).reverse().map((d) => ({ security_id: ARVN.security_id, ...bar(ARVN.security_id, d), volume: Math.round(200000 + 800000 * Math.abs(Math.sin(dayIndex.get(d) * 0.7 + P.get(ARVN.security_id).phase))) })),
  corporate_actions: corporateActions.filter((c) => c.action_type !== "CASH_DIVIDEND").slice(-5).reverse().map(({ action_id, security_id, action_type, ex_date, ratio, acquirer_security_id }) => ({ action_id, security_id, action_type, ex_date, ratio, acquirer_security_id })),
  fundamentals_quarterly: fundamentals.filter((f) => f.fiscal_quarter_end === "2026-09-30").slice(0, 5),
  esg_scores: esg.filter((e) => e.as_of_date === "2026-09-30").slice(0, 5),
  fund_holdings: fundHoldings.slice(0, 5),
  data_dictionary: dictionary.filter((d) => d.dataset === "prices_daily").slice(0, 5).map(({ table_name, column_name, description }) => ({ table_name, column_name, description })),
};
const catalog = DATASETS.map((d) => ({
  id: d, label: DATASET_LABEL[d], table: d.toUpperCase(), description: DATASET_DESC[d], rows: counts[d], freshness: freshness[d],
  columns: dictionary.filter((x) => x.dataset === d).length || null, sample: sampleRows[d],
}));

// Exposure (story 1)
function exposure(rows, date) {
  const bySector = new Map(), byCountry = new Map(), byName = new Map();
  let total = 0;
  for (const h of rows) {
    const s = SEC.get(h.security_id), mv = h.quantity * bar(h.security_id, date).close_unadj;
    total += mv;
    bySector.set(s.sector, (bySector.get(s.sector) ?? 0) + mv);
    byCountry.set(s.country, (byCountry.get(s.country) ?? 0) + mv);
    byName.set(s.security_id, (byName.get(s.security_id) ?? 0) + mv);
  }
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, value: Math.round(v), pct: r2((v / total) * 100) }));
  return { total: Math.round(total), sector: top(bySector), country: top(byCountry), names: top(byName).slice(0, 10).map((n) => ({ ...n, ticker: SEC.get(n.key).ticker, issuer: SEC.get(n.key).issuer_name, sector: SEC.get(n.key).sector })) };
}
const accountsOver = (rows, date, id, limit) => {
  const per = new Map();
  for (const h of rows) {
    const mv = h.quantity * bar(h.security_id, date).close_unadj;
    const o = per.get(h.account_id) ?? { total: 0, name: 0 };
    o.total += mv; if (h.security_id === id) o.name += mv;
    per.set(h.account_id, o);
  }
  return [...per].filter(([, o]) => o.name / o.total > limit).map(([acct, o]) => {
    const a = accounts.find((x) => x.account_id === acct);
    return { account_id: acct, client_name: a.client_name, advisor: ADVISORS.find((x) => x.advisor_id === a.advisor_id).advisor_name, pct: r2((o.name / o.total) * 100), value: Math.round(o.name) };
  }).sort((a, b) => b.pct - a.pct);
};
const pre = exposure(holdingsPre, PRE), post = exposure(holdingsPost, POST);
const byAdvisor = ADVISORS.map((a) => {
  const pr = exposure(holdingsPre.filter((h) => h.advisor_id === a.advisor_id), PRE), po = exposure(holdingsPost.filter((h) => h.advisor_id === a.advisor_id), POST);
  const tech = (e) => e.sector.find((s) => s.key === "Technology")?.pct ?? 0;
  return { advisor_id: a.advisor_id, advisor: a.advisor_name, office: a.office, accounts: accounts.filter((x) => x.advisor_id === a.advisor_id).length, aum: po.total, techPre: tech(pr), techPost: tech(po) };
});
const join = {
  preDate: PRE, postDate: POST, merger: { target: QLFD.ticker, targetName: QLFD.issuer_name, acquirer: ARVN.ticker, acquirerName: ARVN.issuer_name, exDate: MERGER_DATE, ratio: MERGER_RATIO },
  pre, post, byAdvisor,
  overLimit: accountsOver(holdingsPost, POST, ARVN.security_id, 0.1), overLimitPre: accountsOver(holdingsPre, PRE, ARVN.security_id, 0.1).length,
  accounts: accounts.length, positions: holdingsPost.length,
};

// Usage (story 4)
const usageSummary = DATASETS.map((d) => {
  const rows = usage.filter((u) => u.dataset === d);
  return { dataset: d, label: DATASET_LABEL[d], queries: rows.reduce((n, r) => n + r.queries, 0), users: new Set(rows.map((r) => r.user_name)).size, lastAccess: rows.map((r) => r.usage_date).sort().at(-1) ?? null, cost: LICENSE[d], renewal: licenses.find((l) => l.dataset === d).renewal_date };
});
const weekly = new Map();
for (const u of usage) {
  const d = new Date(`${u.usage_date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const wk = iso(d), o = weekly.get(wk) ?? { week: wk };
  o[u.dataset] = (o[u.dataset] ?? 0) + u.queries; weekly.set(wk, o);
}

// Ask the data: scripted answers computed from the same data
const weeklyPrices = (id, from) => DAYS.filter((d, i) => d >= from && d <= lastDay(id) && (i % 5 === 0 || d === lastDay(id))).map((d) => bar(id, d));
const crvlSeries = weeklyPrices(CRVL.security_id, "2024-11-01");
const latestEsg = new Map();
for (const e of esg) { const o = latestEsg.get(e.security_id); if (!o || e.as_of_date > o.as_of_date) latestEsg.set(e.security_id, e); }
const heldIds = [...new Set(holdingsPost.map((h) => h.security_id))];
const esgTop = heldIds.map((id) => {
  const mv = holdingsPost.filter((h) => h.security_id === id).reduce((n, h) => n + h.quantity * bar(id, POST).close_unadj, 0);
  return { ticker: SEC.get(id).ticker, issuer: SEC.get(id).issuer_name, sector: SEC.get(id).sector, esg: latestEsg.get(id).esg_score, value: Math.round(mv), accounts: holdingsPost.filter((h) => h.security_id === id).length };
}).sort((a, b) => b.esg - a.esg || b.value - a.value).slice(0, 10);
const preSplit = bar(CRVL.security_id, DAYS[dayIndex.get(SPLIT_DATE) - 1]), onSplit = bar(CRVL.security_id, SPLIT_DATE);
const dict = (t, c) => dictionary.find((x) => x.table_name === t && x.column_name === c);

const mock = {
  generatedFrom: "scripts/generate-data.mjs (seed 20261107)",
  asOf: END, provider: "Acme Market Data (fictional)", firm: "Northwind Wealth (fictional)",
  catalog, dictionary, join, usage: { summary: usageSummary, weekly: [...weekly.values()].sort((a, b) => (a.week < b.week ? -1 : 1)), windowStart: iso(usageStart), windowEnd: END },
  ask: {
    split: { ticker: CRVL.ticker, issuer: CRVL.issuer_name, exDate: SPLIT_DATE, ratio: SPLIT_RATIO, series: crvlSeries, preSplit, onSplit, cites: [dict("PRICES_DAILY", "CLOSE_ADJ"), dict("PRICES_DAILY", "CLOSE_UNADJ"), dict("CORPORATE_ACTIONS", "RATIO")] },
    esgTop: { rows: esgTop, asOf: "2026-09-30", cites: [dict("ESG_SCORES", "ESG_SCORE"), dict("ESG_SCORES", "AS_OF_DATE")] },
    sector: { rows: post.sector, pre: pre.sector, cites: [dict("SECURITIES", "SECTOR"), dict("PRICES_DAILY", "CLOSE_UNADJ"), dict("CORPORATE_ACTIONS", "ACQUIRER_SECURITY_ID")] },
    closeDef: { cites: [dict("PRICES_DAILY", "CLOSE_ADJ"), dict("PRICES_DAILY", "CLOSE_UNADJ"), dict("CORPORATE_ACTIONS", "EX_DATE")] },
  },
};
writeFileSync(resolve(MOCK, "market.json"), JSON.stringify(mock));
console.log({ counts, techPre: pre.sector.find((s) => s.key === "Technology"), techPost: post.sector.find((s) => s.key === "Technology"), overLimit: join.overLimit.length, overLimitPre: join.overLimitPre, top: post.names.slice(0, 3), preSplit, onSplit });
