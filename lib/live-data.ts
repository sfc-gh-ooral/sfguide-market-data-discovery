// Live mode: every screen reads Snowflake as MDD_ANALYST_ROLE. The vendor tables in
// ACME_MARKET_DATA are queried in place (no copies), and Ask runs the Cortex Agent.
// Latency shown in the UI is measured here, in live mode only. Server only.
import type { MarketData } from './market-data';
import { ROLE, query } from './snowflake';
import type { AskAnswer, Bar, Cite, Dataset, Decision, DictEntry, Exposure, JoinView, LiveAccess, Row, Snapshot, SplitView, TopName, UsageRow } from './types';

const AGENT = process.env.SNOWFLAKE_AGENT_NAME ?? 'MARKET_DATA_DISCOVERY.FIRM.MARKET_DATA_AGENT';
type R = Record<string, unknown>;

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).slice(0, 10));
const num = (v: unknown) => Number(v ?? 0);
const cell = (v: unknown): string | number | null => (v == null ? null : v instanceof Date ? day(v) : typeof v === 'number' ? v : String(v));
const lower = (r: R): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), cell(v)]));

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const v = await fn();
  return [v, Date.now() - t0];
}

const LABEL: Record<string, [string, string]> = {
  securities: ['Securities master', 'Security master: identifiers, issuer, sector, and country for 800 listed equities.'],
  prices_daily: ['Daily prices', 'Five years of daily closing prices, both as printed and split-adjusted, plus volume.'],
  corporate_actions: ['Corporate actions', 'Splits, cash dividends, and mergers with ex-dates and ratios.'],
  fundamentals_quarterly: ['Quarterly fundamentals', 'Quarterly revenue, margin, EPS, and leverage per issuer.'],
  esg_scores: ['ESG scores', 'Quarterly ESG scores with environmental, social, and governance pillars.'],
  fund_holdings: ['Fund holdings', 'Constituents and weights for 12 Acme index and active funds.'],
  data_dictionary: ['Data dictionary', 'Plain-English definitions for every field in the share.'],
};
const ORDER = Object.keys(LABEL);

// Fixed, parameter-free sample queries per dataset (same rows as the bundled sample).
const SAMPLE_SQL: Record<string, string> = {
  securities: 'SELECT * FROM ACME_MARKET_DATA.CORE.SECURITIES ORDER BY security_id LIMIT 5',
  prices_daily: "SELECT security_id, trade_date, close_adj, close_unadj, volume FROM ACME_MARKET_DATA.CORE.PRICES_DAILY WHERE security_id = 'SEC00001' ORDER BY trade_date DESC LIMIT 5",
  corporate_actions: "SELECT action_id, security_id, action_type, ex_date, ratio, acquirer_security_id FROM ACME_MARKET_DATA.CORE.CORPORATE_ACTIONS WHERE action_type <> 'CASH_DIVIDEND' ORDER BY ex_date DESC, action_id DESC LIMIT 5",
  fundamentals_quarterly: "SELECT * FROM ACME_MARKET_DATA.CORE.FUNDAMENTALS_QUARTERLY WHERE fiscal_quarter_end = '2026-09-30' ORDER BY security_id LIMIT 5",
  esg_scores: "SELECT * FROM ACME_MARKET_DATA.CORE.ESG_SCORES WHERE as_of_date = '2026-09-30' ORDER BY security_id LIMIT 5",
  fund_holdings: "SELECT * FROM ACME_MARKET_DATA.CORE.FUND_HOLDINGS ORDER BY fund_id, security_id LIMIT 5",
  data_dictionary: "SELECT table_name, column_name, description FROM ACME_MARKET_DATA.CORE.DATA_DICTIONARY WHERE dataset = 'prices_daily' LIMIT 5",
};

function snapshot(sector: R[], country: R[], names: R[]): Snapshot {
  const ex = (r: R): Exposure => ({ key: String(r.K), value: Math.round(num(r.V)), pct: num(r.PCT) });
  return {
    total: Math.round(sector.reduce((n, r) => n + num(r.V), 0)),
    sector: sector.map(ex), country: country.map(ex),
    names: names.map((r): TopName => ({ ...ex(r), ticker: String(r.TICKER), issuer: String(r.ISSUER_NAME), sector: String(r.SECTOR) })),
  };
}

const BY = (col: string) => `SELECT ${col} AS k, SUM(market_value) AS v, ROUND(100 * RATIO_TO_REPORT(SUM(market_value)) OVER (), 2) AS pct
  FROM POSITIONS_VALUED WHERE as_of_date = ? GROUP BY 1 ORDER BY 2 DESC`;
const NAMES = `SELECT security_id AS k, ticker, issuer_name, sector, SUM(market_value) AS v, ROUND(100 * RATIO_TO_REPORT(SUM(market_value)) OVER (), 2) AS pct
  FROM POSITIONS_VALUED WHERE as_of_date = ? GROUP BY 1, 2, 3, 4 ORDER BY v DESC LIMIT 10`;
const OVER = `SELECT account_id, ANY_VALUE(client_name) AS client_name, ANY_VALUE(advisor_name) AS advisor,
    ROUND(100 * SUM(IFF(security_id = ?, market_value, 0)) / SUM(market_value), 2) AS pct, ROUND(SUM(IFF(security_id = ?, market_value, 0))) AS value
  FROM POSITIONS_VALUED WHERE as_of_date = ? GROUP BY 1 HAVING pct > 10 ORDER BY pct DESC`;

// Accounts over the guideline after the merger, with their pre-merger weights in the acquirer and target.
const OVER_POST = `WITH post AS (
    SELECT account_id, ANY_VALUE(client_name) AS client_name, ANY_VALUE(advisor_name) AS advisor,
      ROUND(100 * SUM(IFF(security_id = ?, market_value, 0)) / SUM(market_value), 2) AS pct, ROUND(SUM(IFF(security_id = ?, market_value, 0))) AS value
    FROM POSITIONS_VALUED WHERE as_of_date = ? GROUP BY 1 HAVING pct > 10),
  pre AS (
    SELECT account_id, ROUND(100 * SUM(IFF(security_id = ?, market_value, 0)) / SUM(market_value), 2) AS pre_acq,
      ROUND(100 * SUM(IFF(security_id = ?, market_value, 0)) / SUM(market_value), 2) AS pre_tgt
    FROM POSITIONS_VALUED WHERE as_of_date = ? GROUP BY 1)
  SELECT post.*, COALESCE(pre.pre_acq, 0) AS pre_acq, COALESCE(pre.pre_tgt, 0) AS pre_tgt
  FROM post LEFT JOIN pre USING (account_id) ORDER BY pct DESC`;

// Pull text, SQL, the result table, and dictionary citations out of a DATA_AGENT_RUN response.
function parseAgent(question: string, resp: R): Omit<AskAnswer, 'source'> {
  const content = (resp.content as R[] | undefined) ?? [];
  const text = content.filter((c) => c.type === 'text').map((c) => String(c.text)).join('\n').trim();
  const tools = [...new Set(content.filter((c) => c.type === 'tool_use').map((c) => String((c.tool_use as R).name)).filter((n) => !/^(server_skill|data_to_chart)$/.test(n)))];
  const sqlUse = content.map((c) => c.tool_use as R | undefined).filter((t) => t && (t.input as R | undefined)?.sql).pop();
  const sql = sqlUse ? String((sqlUse.input as R).sql) : undefined;
  const cites: Cite[] = [];
  for (const c of content) {
    const tr = c.tool_result as R | undefined;
    if (!tr || tr.name !== 'FieldDictionary') continue;
    for (const part of (tr.content as R[] | undefined) ?? []) {
      for (const s of (((part.json as R | undefined)?.search_results as R[] | undefined) ?? [])) {
        const field = String(s.doc_title ?? s.doc_id);
        if (!cites.some((x) => x.field === field)) cites.push({ field, description: String(s.text ?? '') });
      }
    }
  }
  const tbl = content.filter((c) => c.type === 'table').map((c) => c.table as R).pop();
  let table: AskAnswer['table'], chart: AskAnswer['chart'];
  if (tbl) {
    const rs = tbl.result_set as R;
    const rowType = ((rs.resultSetMetaData as R).rowType as R[]).map((t) => ({ name: String(t.name), type: String(t.type) }));
    const isNum = (t: string) => /fixed|real|number|float/i.test(t);
    const rows = ((rs.data as unknown[][]) ?? []).slice(0, 2000).map((r) => r.map((v, i) => (v == null ? null : isNum(rowType[i].type) ? Number(v) : String(v))));
    table = { columns: rowType.map((t) => t.name), rows };
    const x = rowType.find((t) => !isNum(t.type));
    // One measure per bar chart (columns often mix scales, e.g. value and percent); prices can share a line chart.
    const nums = rowType.filter((t) => isNum(t.type) && !/(_ID|COUNT|ACCOUNTS)$/i.test(t.name)).map((t) => t.name);
    const kind = x && /date|time/i.test(x.type) ? 'line' as const : 'bar' as const;
    const series = kind === 'line' ? nums.filter((n) => /CLOSE|PRICE/i.test(n)).slice(0, 2) : [nums.find((n) => /PCT|SCORE|WEIGHT/i.test(n)) ?? nums[0]].filter(Boolean);
    if (x && series.length && rows.length > 1) chart = { kind, x: x.name, series: series.length ? series : nums.slice(0, 1) };
  }
  return { question, text, sql, table, chart, cites, tools };
}

export const liveData: MarketData = {
  async catalog() {
    const [res, latencyMs] = await timed(async () => {
      const [counts, fresh, dict, copies, ...samples] = await Promise.all([
        query<R>("SELECT LOWER(table_name) AS t, row_count FROM ACME_MARKET_DATA.INFORMATION_SCHEMA.TABLES WHERE table_schema = 'CORE'"),
        query<R>(`SELECT 'prices_daily' AS t, MAX(trade_date) AS d FROM ACME_MARKET_DATA.CORE.PRICES_DAILY
          UNION ALL SELECT 'corporate_actions', MAX(ex_date) FROM ACME_MARKET_DATA.CORE.CORPORATE_ACTIONS
          UNION ALL SELECT 'fundamentals_quarterly', MAX(fiscal_quarter_end) FROM ACME_MARKET_DATA.CORE.FUNDAMENTALS_QUARTERLY
          UNION ALL SELECT 'esg_scores', MAX(as_of_date) FROM ACME_MARKET_DATA.CORE.ESG_SCORES
          UNION ALL SELECT 'fund_holdings', MAX(as_of_date) FROM ACME_MARKET_DATA.CORE.FUND_HOLDINGS`),
        query<R>('SELECT * FROM ACME_MARKET_DATA.CORE.DATA_DICTIONARY'),
        // Proof of zero-copy: vendor table names that exist as tables in the firm database.
        query<R>(`SELECT COUNT(*) AS n FROM MARKET_DATA_DISCOVERY.INFORMATION_SCHEMA.TABLES
          WHERE table_type = 'BASE TABLE' AND table_name IN ('SECURITIES','PRICES_DAILY','CORPORATE_ACTIONS','FUNDAMENTALS_QUARTERLY','ESG_SCORES','FUND_HOLDINGS','DATA_DICTIONARY')`),
        ...ORDER.map((d) => query<R>(SAMPLE_SQL[d])),
      ]);
      const dictionary = dict.map((r) => lower(r) as unknown as DictEntry);
      const latestPrice = day(fresh.find((f) => f.T === 'prices_daily')?.D);
      const datasets: Dataset[] = ORDER.map((d, i) => ({
        id: d, label: LABEL[d][0], table: d.toUpperCase(), description: LABEL[d][1],
        rows: num(counts.find((c) => c.T === d)?.ROW_COUNT),
        freshness: day(fresh.find((f) => f.T === d)?.D) || latestPrice,
        columns: dictionary.filter((x) => x.dataset === d).length || null,
        sample: samples[i].map(lower),
      }));
      return { datasets, dictionary, firmCopies: num(copies[0]?.N) };
    });
    return { ...res, source: 'snowflake', role: ROLE, latencyMs };
  },

  async ask(question) {
    const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: question }] }] });
    const [rows, latencyMs] = await timed(() => query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?, TRUE)::VARCHAR AS R', [AGENT, body]));
    const parsed = parseAgent(question, JSON.parse(rows[0].R));
    return { ...parsed, text: parsed.text || '(No text in agent response.)', source: 'snowflake', role: ROLE, latencyMs };
  },

  async join() {
    const [res, latencyMs] = await timed(async () => {
      const [m] = await query<R>(`SELECT c.ex_date, c.ratio, t.security_id AS target_id, t.ticker AS target, t.issuer_name AS target_name, a.ticker AS acquirer, a.issuer_name AS acquirer_name, a.security_id AS acquirer_id
        FROM ACME_MARKET_DATA.CORE.CORPORATE_ACTIONS c
        JOIN ACME_MARKET_DATA.CORE.SECURITIES t ON t.security_id = c.security_id
        JOIN ACME_MARKET_DATA.CORE.SECURITIES a ON a.security_id = c.acquirer_security_id
        WHERE c.action_type = 'MERGER' ORDER BY c.ex_date DESC LIMIT 1`);
      const dates = await query<R>('SELECT DISTINCT as_of_date AS d FROM CLIENT_HOLDINGS ORDER BY 1');
      const preDate = day(dates[0].D), postDate = day(dates[dates.length - 1].D);
      const acq = String(m.ACQUIRER_ID);
      const [s1, c1, n1, s2, c2, n2, adv, over, overPre, totals] = await Promise.all([
        query<R>(BY('sector'), [preDate]), query<R>(BY('country'), [preDate]), query<R>(NAMES, [preDate]),
        query<R>(BY('sector'), [postDate]), query<R>(BY('country'), [postDate]), query<R>(NAMES, [postDate]),
        query<R>(`SELECT advisor_id, ANY_VALUE(advisor_name) AS advisor, ANY_VALUE(office) AS office,
            COUNT(DISTINCT account_id) AS accounts, ROUND(SUM(IFF(as_of_date = ?, market_value, 0))) AS aum,
            ROUND(100 * SUM(IFF(as_of_date = ? AND sector = 'Technology', market_value, 0)) / NULLIF(SUM(IFF(as_of_date = ?, market_value, 0)), 0), 2) AS tech_pre,
            ROUND(100 * SUM(IFF(as_of_date = ? AND sector = 'Technology', market_value, 0)) / NULLIF(SUM(IFF(as_of_date = ?, market_value, 0)), 0), 2) AS tech_post
          FROM POSITIONS_VALUED GROUP BY 1 ORDER BY 1`, [postDate, preDate, preDate, postDate, postDate]),
        query<R>(OVER_POST, [acq, acq, postDate, acq, String(m.TARGET_ID), preDate]), query<R>(OVER, [acq, acq, preDate]),
        query<R>('SELECT COUNT(DISTINCT account_id) AS a, COUNT_IF(as_of_date = ?) AS p FROM CLIENT_HOLDINGS', [postDate]),
      ]);
      const view: Omit<JoinView, 'source'> = {
        preDate, postDate,
        merger: { target: String(m.TARGET), targetName: String(m.TARGET_NAME), acquirer: String(m.ACQUIRER), acquirerName: String(m.ACQUIRER_NAME), exDate: day(m.EX_DATE), ratio: num(m.RATIO) },
        pre: snapshot(s1, c1, n1), post: snapshot(s2, c2, n2),
        byAdvisor: adv.map((r) => ({ advisor_id: String(r.ADVISOR_ID), advisor: String(r.ADVISOR), office: String(r.OFFICE), accounts: num(r.ACCOUNTS), aum: num(r.AUM), techPre: num(r.TECH_PRE), techPost: num(r.TECH_POST) })),
        overLimit: over.map((r) => ({ account_id: String(r.ACCOUNT_ID), client_name: String(r.CLIENT_NAME), advisor: String(r.ADVISOR), pct: num(r.PCT), value: num(r.VALUE), preAcquirerPct: num(r.PRE_ACQ), preTargetPct: num(r.PRE_TGT) })),
        overLimitPre: overPre.length, accounts: num(totals[0].A), positions: num(totals[0].P),
      };
      return view;
    });
    return { ...res, source: 'snowflake', role: ROLE, latencyMs };
  },

  async split(ticker) {
    const [res, latencyMs] = await timed(async () => {
      const [a] = await query<R>(`SELECT s.ticker, s.issuer_name, c.ex_date, c.ratio
        FROM ACME_MARKET_DATA.CORE.CORPORATE_ACTIONS c JOIN ACME_MARKET_DATA.CORE.SECURITIES s USING (security_id)
        WHERE s.ticker = ? AND c.action_type = 'SPLIT' ORDER BY c.ex_date DESC LIMIT 1`, [ticker]);
      if (!a) throw new Error(`No split found for ${ticker}`);
      const exDate = day(a.EX_DATE);
      // One point per trading week (every fifth trading day of the full history, plus the latest), from Nov 2024.
      const rows = await query<R>(`SELECT trade_date, close_adj, close_unadj FROM (
          SELECT px.trade_date, px.close_adj, px.close_unadj,
            ROW_NUMBER() OVER (ORDER BY px.trade_date) - 1 AS i, MAX(px.trade_date) OVER () AS last_day
          FROM ACME_MARKET_DATA.CORE.PRICES_DAILY px JOIN ACME_MARKET_DATA.CORE.SECURITIES s USING (security_id)
          WHERE s.ticker = ?)
        WHERE trade_date >= '2024-11-01' AND (MOD(i, 5) = 0 OR trade_date = last_day) ORDER BY trade_date`, [ticker]);
      const around = await query<R>(`SELECT trade_date, close_adj, close_unadj FROM (
          SELECT px.trade_date, px.close_adj, px.close_unadj FROM ACME_MARKET_DATA.CORE.PRICES_DAILY px
          JOIN ACME_MARKET_DATA.CORE.SECURITIES s USING (security_id)
          WHERE s.ticker = ? AND px.trade_date <= ? ORDER BY px.trade_date DESC LIMIT 2) ORDER BY trade_date`, [ticker, exDate]);
      const bar = (r: R): Bar => ({ trade_date: day(r.TRADE_DATE), close_adj: num(r.CLOSE_ADJ), close_unadj: num(r.CLOSE_UNADJ) });
      return { ticker: String(a.TICKER), issuer: String(a.ISSUER_NAME), exDate, ratio: num(a.RATIO), series: rows.map(bar), preSplit: bar(around[0]), onSplit: bar(around[1]) };
    });
    return { ...res, source: 'snowflake', role: ROLE, latencyMs } as SplitView;
  },

  async usage() {
    const [res, latencyMs] = await timed(async () => {
      const [sum, weekly, decisions] = await Promise.all([
        query<R>(`SELECT l.dataset, COALESCE(SUM(u.queries), 0) AS queries, COUNT(DISTINCT u.user_name) AS users, MAX(u.usage_date) AS last_access,
            l.annual_cost_usd AS cost, l.renewal_date AS renewal
          FROM DATASET_LICENSES l LEFT JOIN DATASET_USAGE_LOG u ON u.dataset = l.dataset
          GROUP BY l.dataset, l.annual_cost_usd, l.renewal_date`),
        query<R>(`SELECT DATE_TRUNC('week', usage_date) AS week, dataset, SUM(queries) AS q FROM DATASET_USAGE_LOG GROUP BY 1, 2 ORDER BY 1`),
        query<R>(`SELECT dataset, decision, note, decided_at, user_name FROM MARKET_DATA_DISCOVERY.APP.LICENSE_REVIEW_DECISIONS ORDER BY decided_at DESC LIMIT 20`),
      ]);
      const win = await query<R>('SELECT MIN(usage_date) AS a, MAX(usage_date) AS b FROM DATASET_USAGE_LOG');
      const summary: UsageRow[] = ORDER.map((d) => {
        const r = sum.find((x) => x.DATASET === d) ?? {};
        return { dataset: d, label: LABEL[d][0], queries: num(r.QUERIES), users: num(r.USERS), lastAccess: r.LAST_ACCESS ? day(r.LAST_ACCESS) : null, cost: num(r.COST), renewal: day(r.RENEWAL) };
      });
      const wk = new Map<string, Record<string, string | number>>();
      for (const r of weekly) { const k = day(r.WEEK); const o = wk.get(k) ?? { week: k }; o[String(r.DATASET)] = num(r.Q); wk.set(k, o); }
      return {
        summary, weekly: [...wk.values()], windowStart: day(win[0].A), windowEnd: day(win[0].B),
        liveAccess: 'pending' as const,
        decisions: decisions.map((r) => ({ dataset: String(r.DATASET), decision: String(r.DECISION) as Decision['decision'], note: String(r.NOTE ?? ''), at: String(r.DECIDED_AT), user: String(r.USER_NAME) })),
      };
    });
    return { ...res, source: 'snowflake', role: ROLE, latencyMs };
  },

  async liveAccess() {
    // Enterprise Edition. ACCESS_HISTORY can lag by up to about 3 hours.
    try {
      const [rows, latencyMs] = await timed(() => query<R>('SELECT dataset, COUNT(DISTINCT query_id) AS n FROM LIVE_DATASET_ACCESS GROUP BY 1'));
      return <LiveAccess>{ source: 'snowflake', role: ROLE, latencyMs, status: 'available', counts: Object.fromEntries(rows.map((r) => [String(r.DATASET), num(r.N)])) };
    } catch (e) {
      return <LiveAccess>{ source: 'snowflake', role: ROLE, status: 'unavailable', counts: {}, detail: String((e as Error).message) };
    }
  },

  async decide(dataset, decision, note) {
    await query('INSERT INTO MARKET_DATA_DISCOVERY.APP.LICENSE_REVIEW_DECISIONS (dataset, decision, note) VALUES (?, ?, ?)', [dataset, decision, note]);
    return { dataset, decision, note, at: new Date().toISOString() };
  },
};
