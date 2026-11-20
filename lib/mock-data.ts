// No-account mode: everything comes from lib/mock/market.json (scripts/generate-data.mjs).
// AI answers are scripted samples built from the same numbers, and labeled as samples.
import type { MarketData } from './market-data';
import marketJson from './mock/market.json';
import { SAMPLE_DELAY_MS } from './sample-timing';
import type { AskAnswer, Catalog, Cite, Decision, DictEntry, JoinView, Snapshot, UsageView } from './types';

type Bar = { trade_date: string; close_adj: number; close_unadj: number };
type Mock = {
  catalog: Catalog['datasets']; dictionary: DictEntry[];
  join: Omit<JoinView, 'source'>;
  usage: Omit<UsageView, 'source' | 'liveAccess' | 'decisions'>;
  ask: {
    split: { ticker: string; issuer: string; exDate: string; ratio: number; series: Bar[]; preSplit: Bar; onSplit: Bar; cites: DictEntry[] };
    esgTop: { rows: { ticker: string; issuer: string; sector: string; esg: number; value: number; accounts: number }[]; asOf: string; cites: DictEntry[] };
    sector: { rows: Snapshot['sector']; pre: Snapshot['sector']; cites: DictEntry[] };
    closeDef: { cites: DictEntry[] };
  };
};
export const MOCK = marketJson as unknown as Mock;

const cite = (d: DictEntry): Cite => ({ field: `${d.table_name}.${d.column_name}`, description: d.description });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.round(Math.random() * 900)));

export const SAMPLE_QUESTIONS = [
  'Show the price history for CRVL adjusted for splits.',
  'Top 10 holdings across client books by ESG score.',
  'What is our sector exposure across client books after the Quillfield merger?',
  'What is the difference between close and adjusted close?',
];

function scripted(question: string): Omit<AskAnswer, 'source'> {
  const q = question.toLowerCase();
  const a = MOCK.ask;
  if (/esg/.test(q)) {
    const r = a.esgTop.rows;
    return {
      question, sample: true,
      text: `The highest-rated name held across client books is **${r[0].issuer} (${r[0].ticker})**, with an ESG score of ${r[0].esg.toFixed(1)}. All ten below score above ${Math.floor(r[9].esg)} on the latest quarterly scores (${a.esgTop.asOf}). I used ESG_SCORES.ESG_SCORE at the latest ESG_SCORES.AS_OF_DATE per security, joined to the firm's latest holdings snapshot.\n\nSynthetic data, not investment advice.`,
      sql: `SELECT sec.ticker, sec.issuer_name, sec.sector,\n       esg.esg_score,\n       SUM(pos.market_value) AS client_value,\n       COUNT(DISTINCT pos.account_id) AS accounts\nFROM MARKET_DATA_DISCOVERY.FIRM.POSITIONS_VALUED pos\nJOIN MARKET_DATA_DISCOVERY.FIRM.LATEST_ESG esg USING (security_id)\nJOIN ACME_MARKET_DATA.CORE.SECURITIES sec USING (security_id)\nWHERE pos.as_of_date = '2026-10-30'\nGROUP BY 1, 2, 3, 4\nORDER BY esg.esg_score DESC, client_value DESC\nLIMIT 10;`,
      table: { columns: ['TICKER', 'ISSUER_NAME', 'SECTOR', 'ESG_SCORE', 'CLIENT_VALUE', 'ACCOUNTS'], rows: r.map((x) => [x.ticker, x.issuer, x.sector, x.esg, x.value, x.accounts]) },
      chart: { kind: 'bar', x: 'TICKER', series: ['ESG_SCORE'] },
      cites: a.esgTop.cites.map(cite), tools: ['FieldDictionary (Cortex Search)', 'MarketAnalyst (Cortex Analyst)'],
    };
  }
  if (/sector|exposure|concentrat|merger|quillfield/.test(q)) {
    const tech = a.sector.rows.find((s) => s.key === 'Technology')!, techPre = a.sector.pre.find((s) => s.key === 'Technology')!;
    const m = MOCK.join.merger;
    return {
      question, sample: true,
      text: `After the **${m.targetName} → ${m.acquirerName}** merger (ex-date ${m.exDate}), Technology is **${tech.pct.toFixed(1)}%** of client market value, up from ${techPre.pct.toFixed(1)}% on ${MOCK.join.preDate}. Converted ${m.target} shares now sit in ${m.acquirer}, so a single name, ${m.acquirer}, is ${MOCK.join.post.names[0].pct.toFixed(1)}% of all client value. Values use SECURITIES.SECTOR and PRICES_DAILY.CLOSE_UNADJ on each snapshot date, the printed price that matches that day's share count.\n\nSynthetic data, not investment advice.`,
      sql: `SELECT sec.sector,\n       SUM(pos.market_value) AS client_value,\n       ROUND(100 * RATIO_TO_REPORT(SUM(pos.market_value)) OVER (), 2) AS pct\nFROM MARKET_DATA_DISCOVERY.FIRM.POSITIONS_VALUED pos\nJOIN ACME_MARKET_DATA.CORE.SECURITIES sec USING (security_id)\nWHERE pos.as_of_date = '2026-10-30'\nGROUP BY 1\nORDER BY 2 DESC;`,
      table: { columns: ['SECTOR', 'CLIENT_VALUE', 'PCT'], rows: a.sector.rows.map((s) => [s.key, s.value, s.pct]) },
      chart: { kind: 'bar', x: 'SECTOR', series: ['PCT'] },
      cites: a.sector.cites.map(cite), tools: ['FieldDictionary (Cortex Search)', 'MarketAnalyst (Cortex Analyst)'],
    };
  }
  if (/differen|adjusted close|unadj|which close|mean/.test(q) && !/history|chart|show/.test(q)) {
    const s = a.split;
    return {
      question, sample: true,
      text: `**CLOSE_ADJ** is the closing price adjusted for every later stock split, so the series stays continuous. Use it for charts, returns, and price history. **CLOSE_UNADJ** is the price as printed that day. It steps on a split ex-date, and it's the right price to value a position with that day's share count.\n\nExample: ${s.issuer} split ${s.ratio}-for-1 on ${s.exDate}. Unadjusted close went from ${s.preSplit.close_unadj.toFixed(2)} to ${s.onSplit.close_unadj.toFixed(2)}, while adjusted close moved from ${s.preSplit.close_adj.toFixed(2)} to ${s.onSplit.close_adj.toFixed(2)}. Neither field adjusts for cash dividends.\n\nSynthetic data, not investment advice.`,
      cites: a.closeDef.cites.map(cite), tools: ['FieldDictionary (Cortex Search)'],
    };
  }
  const s = a.split;
  const note = /crvl|corvella|price|split|history|chart/.test(q) ? '' : '_Sample mode answers four built-in questions, so this is the closest one. Switch to Live mode to ask anything._\n\n';
  const first = s.series[0], last = s.series[s.series.length - 1];
  return {
    question, sample: true,
    text: `${note}${s.issuer} (${s.ticker}) split-adjusted close went from **${first.close_adj.toFixed(2)}** on ${first.trade_date} to **${last.close_adj.toFixed(2)}** on ${last.trade_date}. I used **PRICES_DAILY.CLOSE_ADJ**. The dictionary says it adjusts for all later splits, so the ${s.ratio}-for-1 split on ${s.exDate} doesn't show as a false ${Math.round((1 - s.onSplit.close_unadj / s.preSplit.close_unadj) * 100)}% drop. The unadjusted series (CLOSE_UNADJ) is shown for comparison, and CORPORATE_ACTIONS confirms the split ratio.\n\nSynthetic data, not investment advice.`,
    sql: `SELECT px.trade_date, px.close_adj, px.close_unadj\nFROM ACME_MARKET_DATA.CORE.PRICES_DAILY px\nJOIN ACME_MARKET_DATA.CORE.SECURITIES sec USING (security_id)\nWHERE sec.ticker = 'CRVL'\n  AND px.trade_date >= '2024-11-01'\nQUALIFY MOD(ROW_NUMBER() OVER (ORDER BY px.trade_date), 5) = 1  -- one point per trading week\nORDER BY px.trade_date;`,
    table: { columns: ['TRADE_DATE', 'CLOSE_ADJ', 'CLOSE_UNADJ'], rows: s.series.map((b) => [b.trade_date, b.close_adj, b.close_unadj]) },
    chart: { kind: 'line', x: 'TRADE_DATE', series: ['CLOSE_ADJ', 'CLOSE_UNADJ'] },
    cites: s.cites.map(cite), tools: ['FieldDictionary (Cortex Search)', 'MarketAnalyst (Cortex Analyst)'],
  };
}

const decisions: Decision[] = [];

export const mockData: MarketData = {
  async catalog() {
    return { source: 'mock', datasets: MOCK.catalog, firmCopies: 0, dictionary: MOCK.dictionary };
  },
  async ask(question) {
    await wait(SAMPLE_DELAY_MS.ask);
    return { ...scripted(question), source: 'mock' };
  },
  async join() {
    return { ...MOCK.join, source: 'mock' };
  },
  async split() {
    const { cites: _c, ...s } = MOCK.ask.split;
    return { ...s, source: 'mock' };
  },
  async usage() {
    return { ...MOCK.usage, source: 'mock', liveAccess: 'sample', decisions: [...decisions] };
  },
  async liveAccess() {
    return { source: 'mock', status: 'sample', counts: {} };
  },
  async decide(dataset, decision, note) {
    const d: Decision = { dataset, decision, note, at: new Date().toISOString() };
    decisions.unshift(d);
    return d;
  },
};
