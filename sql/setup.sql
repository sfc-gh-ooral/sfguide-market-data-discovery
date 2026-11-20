-- =============================================================================
-- Market Data Discovery Agent: Snowflake setup
-- Synthetic data only. "Acme Market Data" and "Northwind Wealth" are fictional.
-- Illustrative logic; not investment, regulatory, or compliance advice.
--
-- Run top to bottom in a Snowsight SQL worksheet (about 5 minutes on an XSMALL warehouse).
-- Requirements (see README): Enterprise Edition or higher for ACCOUNT_USAGE.ACCESS_HISTORY
-- (the Usage screen falls back to the synthetic usage log without it), Cortex AI in your
-- region or cross-region inference, and ACCOUNTADMIN (or a role that can create roles,
-- warehouses, databases, shares, and API integrations).
--
-- About the share: Snowflake does not let an account mount its own share ("self-sharing").
-- So this script plays both sides in one account. It creates the vendor's provider database
-- ACME_MARKET_DATA and a real share, MDD_ACME_SHARE, that you can add a second account to.
-- The firm-side reader role gets exactly the grants the share carries and queries the
-- provider tables in place. Nothing is copied into the firm database. In production you
-- would mount the vendor's share or Marketplace listing and point the app at it (README).
--
-- Creates (and sql/cleanup.sql drops):
--   roles        MDD_DEMO_ROLE (owner), MDD_ANALYST_ROLE (what the app uses)
--   warehouse    MDD_WH (XSMALL, AUTO_SUSPEND = 60)
--   databases    ACME_MARKET_DATA (provider: schema CORE)
--                MARKET_DATA_DISCOVERY (firm: schemas FIRM, APP)
--   share        MDD_ACME_SHARE (no consumer accounts added)
--   integration  MDD_GIT_API (read-only access to the public example repository)
-- It changes nothing that already exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1. Account-level objects (ACCOUNTADMIN)
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS MDD_DEMO_ROLE    COMMENT = 'Market Data Discovery example: object owner';
CREATE ROLE IF NOT EXISTS MDD_ANALYST_ROLE COMMENT = 'Market Data Discovery example: research analyst / market data manager (read the share, write review decisions)';
GRANT ROLE MDD_DEMO_ROLE TO ROLE SYSADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE MDD_DEMO_ROLE    TO USER IDENTIFIER($my_user);
GRANT ROLE MDD_ANALYST_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS MDD_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Market Data Discovery example';
GRANT OWNERSHIP ON WAREHOUSE MDD_WH TO ROLE MDD_DEMO_ROLE;
GRANT USAGE ON WAREHOUSE MDD_WH TO ROLE MDD_ANALYST_ROLE;

CREATE DATABASE IF NOT EXISTS ACME_MARKET_DATA      COMMENT = 'Fictional vendor provider database (synthetic market and reference data)';
CREATE DATABASE IF NOT EXISTS MARKET_DATA_DISCOVERY COMMENT = 'Fictional firm database: client books, semantic view, agent (synthetic)';
GRANT OWNERSHIP ON DATABASE ACME_MARKET_DATA      TO ROLE MDD_DEMO_ROLE;
GRANT OWNERSHIP ON DATABASE MARKET_DATA_DISCOVERY TO ROLE MDD_DEMO_ROLE;

GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE MDD_DEMO_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE MDD_ANALYST_ROLE;
-- The owner reads ACCESS_HISTORY to build a view limited to the vendor tables (Part 4).
-- The analyst role gets that view only, not account-wide ACCOUNT_USAGE.
GRANT DATABASE ROLE SNOWFLAKE.GOVERNANCE_VIEWER TO ROLE MDD_DEMO_ROLE;

CREATE OR REPLACE API INTEGRATION MDD_GIT_API
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/')
  ENABLED = TRUE
  COMMENT = 'Market Data Discovery example: public repo, no credentials';
GRANT USAGE ON INTEGRATION MDD_GIT_API TO ROLE MDD_DEMO_ROLE;

-- -----------------------------------------------------------------------------
-- Part 2. The vendor side: provider database ACME_MARKET_DATA (owner role)
-- -----------------------------------------------------------------------------
USE ROLE MDD_DEMO_ROLE;
USE WAREHOUSE MDD_WH;
USE DATABASE MARKET_DATA_DISCOVERY;
CREATE SCHEMA IF NOT EXISTS FIRM COMMENT = 'Northwind Wealth (fictional): advisors, client books, licenses, usage';
CREATE SCHEMA IF NOT EXISTS APP  COMMENT = 'App-written records: license review decisions';
USE SCHEMA FIRM;

-- Load the synthetic CSVs from the public repository (Git repository clone + stage).
CREATE OR REPLACE GIT REPOSITORY MDD_REPO
  API_INTEGRATION = MDD_GIT_API
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-market-data-discovery.git';
CREATE STAGE IF NOT EXISTS MDD_DATA COMMENT = 'Synthetic CSVs copied from the repository';
COPY FILES INTO @MDD_DATA FROM @MDD_REPO/branches/main/data/csv/;
CREATE OR REPLACE FILE FORMAT MDD_CSV
  TYPE = CSV COMPRESSION = GZIP SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"' EMPTY_FIELD_AS_NULL = TRUE;

USE DATABASE ACME_MARKET_DATA;
CREATE SCHEMA IF NOT EXISTS CORE COMMENT = 'Acme Market Data (fictional): shared datasets';
USE SCHEMA CORE;

CREATE OR REPLACE TABLE SECURITIES (
  security_id VARCHAR, ticker VARCHAR, isin_like_id VARCHAR, issuer_name VARCHAR,
  sector VARCHAR, country VARCHAR, currency VARCHAR, listing_date DATE)
  COMMENT = 'Security master: identifiers, issuer, sector, and country for 800 listed equities';
CREATE OR REPLACE TABLE CORPORATE_ACTIONS (
  action_id VARCHAR, security_id VARCHAR, action_type VARCHAR, ex_date DATE, ratio NUMBER(10,4),
  acquirer_security_id VARCHAR, cash_amount NUMBER(10,2), description VARCHAR)
  COMMENT = 'Splits, cash dividends, and mergers with ex-dates and ratios';
CREATE OR REPLACE TABLE FUNDAMENTALS_QUARTERLY (
  security_id VARCHAR, fiscal_quarter_end DATE, revenue_musd NUMBER(14,2), net_margin_pct NUMBER(8,2),
  eps NUMBER(10,2), debt_to_equity NUMBER(8,2))
  COMMENT = 'Quarterly revenue, margin, EPS, and leverage per issuer';
CREATE OR REPLACE TABLE ESG_SCORES (
  security_id VARCHAR, as_of_date DATE, esg_score NUMBER(6,2), environmental NUMBER(6,2),
  social NUMBER(6,2), governance NUMBER(6,2))
  COMMENT = 'Quarterly ESG scores with environmental, social, and governance pillars';
CREATE OR REPLACE TABLE FUND_HOLDINGS (
  fund_id VARCHAR, fund_name VARCHAR, security_id VARCHAR, weight_pct NUMBER(6,2), as_of_date DATE)
  COMMENT = 'Constituents and weights for 12 Acme index and active funds';
CREATE OR REPLACE TABLE DATA_DICTIONARY (
  dataset VARCHAR, table_name VARCHAR, column_name VARCHAR, data_type VARCHAR, description VARCHAR, example VARCHAR)
  CHANGE_TRACKING = TRUE
  COMMENT = 'Plain-English definitions for every field in the share';
CREATE OR REPLACE TEMPORARY TABLE PRICE_PARAMS (security_id VARCHAR, base_price FLOAT, drift FLOAT, vol FLOAT, phase FLOAT);

COPY INTO SECURITIES             FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/securities.csv.gz             FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO CORPORATE_ACTIONS      FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/corporate_actions.csv.gz      FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO FUNDAMENTALS_QUARTERLY FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/fundamentals_quarterly.csv.gz FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO ESG_SCORES             FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/esg_scores.csv.gz             FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO FUND_HOLDINGS          FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/fund_holdings.csv.gz          FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO DATA_DICTIONARY        FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/data_dictionary.csv.gz        FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);
COPY INTO PRICE_PARAMS           FROM @MARKET_DATA_DISCOVERY.FIRM.MDD_DATA/price_params.csv.gz           FILE_FORMAT = (FORMAT_NAME = MARKET_DATA_DISCOVERY.FIRM.MDD_CSV);

-- Daily prices: about 1 million rows computed here from a closed-form formula, the same one
-- scripts/generate-data.mjs uses, so the no-account mode and live mode agree.
-- CLOSE_ADJ is continuous; CLOSE_UNADJ multiplies by every later split ratio (story 2).
-- The merger target stops trading the day before its ex-date (story 1).
CREATE OR REPLACE TABLE PRICES_DAILY
  COMMENT = 'Five years of daily closing prices, both as printed (CLOSE_UNADJ) and split-adjusted (CLOSE_ADJ), plus volume'
AS
WITH days AS (
  SELECT d AS trade_date, ROW_NUMBER() OVER (ORDER BY d) - 1 AS t
  FROM (SELECT DATEADD(day, SEQ4(), '2021-11-01'::DATE) AS d FROM TABLE(GENERATOR(ROWCOUNT => 1825)))
  WHERE d <= '2026-10-30' AND DAYOFWEEKISO(d) <= 5
), adj AS (
  SELECT p.security_id, d.trade_date, d.t,
    ROUND(p.base_price * EXP(p.drift * d.t + p.vol * (0.6 * SIN(d.t / 37 + p.phase) + 0.3 * SIN(d.t / 11 + 2 * p.phase) + 0.1 * SIN(d.t * 1.3 + 3 * p.phase))), 2) AS close_adj,
    ROUND(200000 + 800000 * ABS(SIN(d.t * 0.7 + p.phase))) AS volume
  FROM PRICE_PARAMS p CROSS JOIN days d
), split_factor AS (
  SELECT a.security_id, a.trade_date, EXP(SUM(LN(c.ratio))) AS f
  FROM adj a JOIN CORPORATE_ACTIONS c
    ON c.security_id = a.security_id AND c.action_type = 'SPLIT' AND a.trade_date < c.ex_date
  GROUP BY 1, 2
)
SELECT a.security_id, a.trade_date,
  ROUND(a.close_adj * COALESCE(s.f, 1), 2)::NUMBER(12,2) AS close_unadj,
  a.close_adj::NUMBER(12,2) AS close_adj,
  a.volume::NUMBER AS volume
FROM adj a
LEFT JOIN split_factor s ON s.security_id = a.security_id AND s.trade_date = a.trade_date
WHERE NOT EXISTS (SELECT 1 FROM CORPORATE_ACTIONS m
                  WHERE m.action_type = 'MERGER' AND m.security_id = a.security_id AND a.trade_date >= m.ex_date);
DROP TABLE PRICE_PARAMS;

-- -----------------------------------------------------------------------------
-- Part 3. The share (ACCOUNTADMIN). Add a consumer account to see it from the other side:
--   ALTER SHARE MDD_ACME_SHARE ADD ACCOUNTS = <org>.<consumer_account>;
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;
CREATE SHARE IF NOT EXISTS MDD_ACME_SHARE COMMENT = 'Acme Market Data (fictional) datasets for licensed consumers';
GRANT USAGE ON DATABASE ACME_MARKET_DATA TO SHARE MDD_ACME_SHARE;
GRANT USAGE ON SCHEMA ACME_MARKET_DATA.CORE TO SHARE MDD_ACME_SHARE;
GRANT SELECT ON ALL TABLES IN SCHEMA ACME_MARKET_DATA.CORE TO SHARE MDD_ACME_SHARE;

-- -----------------------------------------------------------------------------
-- Part 4. The firm side: client books, semantic view, search, agent (owner role)
-- -----------------------------------------------------------------------------
USE ROLE MDD_DEMO_ROLE;
USE WAREHOUSE MDD_WH;
USE DATABASE MARKET_DATA_DISCOVERY;
USE SCHEMA FIRM;

CREATE OR REPLACE TABLE ADVISORS         (advisor_id VARCHAR, advisor_name VARCHAR, office VARCHAR);
CREATE OR REPLACE TABLE CLIENT_ACCOUNTS  (account_id VARCHAR, advisor_id VARCHAR, client_name VARCHAR);
CREATE OR REPLACE TABLE CLIENT_HOLDINGS  (account_id VARCHAR, advisor_id VARCHAR, security_id VARCHAR, quantity NUMBER(14,0), as_of_date DATE)
  COMMENT = 'Advisor books: share quantities per account on two snapshot dates (before and after the merger)';
CREATE OR REPLACE TABLE DATASET_LICENSES (dataset VARCHAR, annual_cost_usd NUMBER(12,0), renewal_date DATE)
  COMMENT = 'Annual license cost per vendor dataset (synthetic)';
CREATE OR REPLACE TABLE DATASET_USAGE_LOG (usage_date DATE, user_name VARCHAR, dataset VARCHAR, queries NUMBER)
  COMMENT = 'Synthetic 90-day query log per dataset and user, standing in for ACCESS_HISTORY history this new account does not have';
COPY INTO ADVISORS          FROM @MDD_DATA/advisors.csv.gz          FILE_FORMAT = (FORMAT_NAME = MDD_CSV);
COPY INTO CLIENT_ACCOUNTS   FROM @MDD_DATA/client_accounts.csv.gz   FILE_FORMAT = (FORMAT_NAME = MDD_CSV);
COPY INTO CLIENT_HOLDINGS   FROM @MDD_DATA/client_holdings.csv.gz   FILE_FORMAT = (FORMAT_NAME = MDD_CSV);
COPY INTO DATASET_LICENSES  FROM @MDD_DATA/dataset_licenses.csv.gz  FILE_FORMAT = (FORMAT_NAME = MDD_CSV);
COPY INTO DATASET_USAGE_LOG FROM @MDD_DATA/dataset_usage_log.csv.gz FILE_FORMAT = (FORMAT_NAME = MDD_CSV);

-- Firm holdings valued against the vendor tables, in place (a view, not a copy).
-- Positions are valued at CLOSE_UNADJ on the snapshot date: the printed price matches that
-- date's share count (see the data dictionary).
CREATE OR REPLACE VIEW POSITIONS_VALUED
  COMMENT = 'Client positions joined to the vendor security master and prices on each snapshot date'
AS
SELECT h.account_id, a.client_name, h.advisor_id, adv.advisor_name, adv.office, h.as_of_date,
       h.security_id, s.ticker, s.issuer_name, s.sector, s.country,
       h.quantity, p.close_unadj, ROUND(h.quantity * p.close_unadj, 2) AS market_value
FROM CLIENT_HOLDINGS h
JOIN CLIENT_ACCOUNTS a USING (account_id)
JOIN ADVISORS adv ON adv.advisor_id = h.advisor_id
JOIN ACME_MARKET_DATA.CORE.SECURITIES s ON s.security_id = h.security_id
JOIN ACME_MARKET_DATA.CORE.PRICES_DAILY p ON p.security_id = h.security_id AND p.trade_date = h.as_of_date;

CREATE OR REPLACE VIEW LATEST_ESG
  COMMENT = 'Latest ESG score per security (vendor table, in place)'
AS
SELECT * FROM ACME_MARKET_DATA.CORE.ESG_SCORES
QUALIFY ROW_NUMBER() OVER (PARTITION BY security_id ORDER BY as_of_date DESC) = 1;

-- Real usage of the vendor tables in this account (Enterprise Edition). ACCESS_HISTORY can lag
-- by up to about 3 hours. Owner's rights: the analyst role sees these rows and nothing else.
CREATE OR REPLACE VIEW LIVE_DATASET_ACCESS
  COMMENT = 'Queries against ACME_MARKET_DATA tables in the last 90 days, from ACCOUNT_USAGE.ACCESS_HISTORY'
AS
SELECT LOWER(SPLIT_PART(o.value:"objectName"::VARCHAR, '.', 3)) AS dataset,
       ah.user_name, ah.query_start_time, ah.query_id
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah,
     LATERAL FLATTEN(ah.base_objects_accessed) o
WHERE ah.query_start_time >= DATEADD(day, -90, CURRENT_TIMESTAMP())
  AND o.value:"objectName"::VARCHAR ILIKE 'ACME_MARKET_DATA.CORE.%';

-- Semantic view for Cortex Analyst: vendor tables (in place) plus the firm's positions.
CREATE OR REPLACE SEMANTIC VIEW MARKET_DATA_SV
  TABLES (
    sec AS ACME_MARKET_DATA.CORE.SECURITIES PRIMARY KEY (security_id)
      COMMENT = 'Vendor security master: ticker, issuer, sector, country',
    px AS ACME_MARKET_DATA.CORE.PRICES_DAILY PRIMARY KEY (security_id, trade_date)
      COMMENT = 'Vendor daily prices. CLOSE_ADJ is split-adjusted (use for history, charts, returns). CLOSE_UNADJ is the price as printed that day.',
    ca AS ACME_MARKET_DATA.CORE.CORPORATE_ACTIONS PRIMARY KEY (action_id)
      COMMENT = 'Vendor corporate actions: SPLIT, CASH_DIVIDEND, MERGER',
    esg AS MARKET_DATA_DISCOVERY.FIRM.LATEST_ESG PRIMARY KEY (security_id)
      COMMENT = 'Latest vendor ESG score per security, 0-100, higher is better',
    fh AS ACME_MARKET_DATA.CORE.FUND_HOLDINGS
      COMMENT = 'Vendor fund constituents and weights',
    pos AS MARKET_DATA_DISCOVERY.FIRM.POSITIONS_VALUED
      COMMENT = 'Firm client positions valued with vendor prices. Two snapshots: 2026-02-27 (before the merger) and 2026-10-30 (latest). Use the latest unless asked otherwise.'
  )
  RELATIONSHIPS (
    px_to_sec AS px (security_id) REFERENCES sec,
    ca_to_sec AS ca (security_id) REFERENCES sec,
    esg_to_sec AS esg (security_id) REFERENCES sec,
    fh_to_sec AS fh (security_id) REFERENCES sec,
    pos_to_sec AS pos (security_id) REFERENCES sec
  )
  FACTS (
    px.close_adj AS close_adj COMMENT = 'Split-adjusted close. Use for price history, charts, and returns.',
    px.close_unadj AS close_unadj COMMENT = 'Close as printed on the trade date, not adjusted for later splits. Steps on a split ex-date.',
    pos.market_value AS market_value COMMENT = 'Position value in USD: quantity times CLOSE_UNADJ on the snapshot date',
    pos.quantity AS quantity,
    esg.esg_score AS esg_score COMMENT = 'Overall ESG score 0-100, higher is better',
    fh.weight_pct AS weight_pct
  )
  DIMENSIONS (
    sec.security_id AS security_id,
    sec.ticker AS ticker WITH SYNONYMS = ('symbol') COMMENT = 'Exchange ticker, e.g. ARVN, CRVL',
    sec.issuer_name AS issuer_name WITH SYNONYMS = ('company', 'issuer', 'name'),
    sec.sector AS sector COMMENT = 'Issuer sector (11 sectors)',
    sec.country AS country COMMENT = 'Country of incorporation, ISO alpha-2',
    px.trade_date AS trade_date,
    ca.action_type AS action_type COMMENT = 'SPLIT, CASH_DIVIDEND, or MERGER',
    ca.ex_date AS ex_date, ca.ratio AS ratio, ca.action_description AS description,
    esg.esg_as_of_date AS as_of_date,
    fh.fund_name AS fund_name,
    pos.snapshot_date AS as_of_date WITH SYNONYMS = ('as of', 'holdings date') COMMENT = '2026-02-27 or 2026-10-30 (latest)',
    pos.account_id AS account_id, pos.client_name AS client_name,
    pos.advisor_name AS advisor_name WITH SYNONYMS = ('advisor', 'book'), pos.office AS office
  )
  METRICS (
    pos.total_market_value AS SUM(pos.market_value) COMMENT = 'Total client market value in USD',
    pos.account_count AS COUNT(DISTINCT pos.account_id) COMMENT = 'Number of client accounts',
    px.avg_close_adj AS AVG(px.close_adj),
    esg.avg_esg_score AS AVG(esg.esg_score)
  )
  COMMENT = 'Market Data Discovery: vendor market data (queried in place) joined to Northwind Wealth client books';

-- Cortex Search over the vendor data dictionary, so the agent can cite field definitions.
CREATE OR REPLACE CORTEX SEARCH SERVICE DICTIONARY_SEARCH
  ON description
  ATTRIBUTES table_name, column_name
  WAREHOUSE = MDD_WH
  TARGET_LAG = '1 day'
  COMMENT = 'Acme Market Data dictionary: what each field means'
  AS SELECT table_name || '.' || column_name AS field, table_name, column_name, data_type, description
     FROM ACME_MARKET_DATA.CORE.DATA_DICTIONARY;

CREATE OR REPLACE AGENT MARKET_DATA_AGENT
  COMMENT = 'Market Data Discovery agent (synthetic data)'
  PROFILE = '{"display_name": "Market Data Agent"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget:
      seconds: 60
      tokens: 16000
  instructions:
    system: >
      You help research analysts at a fictional wealth firm use licensed market data from a fictional
      vendor, Acme Market Data. All data is synthetic. The latest price date is 2026-10-30.
    orchestration: >
      Use FieldDictionary first whenever the question depends on which field to use (prices, close,
      adjusted, ESG, sector, country), then use MarketAnalyst once to answer with data.
      For price history, charts, or returns, always use CLOSE_ADJ (split-adjusted) and say so.
      For client exposure, use the latest snapshot_date 2026-10-30 unless asked otherwise.
      Keep tool calls to a minimum.
    response: >
      Be concise. Lead with the answer in one or two sentences, then a short table if useful.
      Cite each dictionary field you relied on as TABLE.COLUMN. End with:
      "Synthetic data, not investment advice."
    sample_questions:
      - question: "Show the price history for CRVL adjusted for splits."
      - question: "Top 10 holdings across client books by ESG score."
  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "MarketAnalyst"
        description: "Answers questions with SQL over vendor securities, daily prices (adjusted and unadjusted close), corporate actions, latest ESG scores, fund holdings, and the firm's client positions valued with vendor prices."
    - tool_spec:
        type: "cortex_search"
        name: "FieldDictionary"
        description: "Searches the vendor data dictionary for what a field means and when to use it, e.g. adjusted vs unadjusted close."
  tool_resources:
    MarketAnalyst:
      semantic_view: "MARKET_DATA_DISCOVERY.FIRM.MARKET_DATA_SV"
      execution_environment:
        type: "warehouse"
        warehouse: "MDD_WH"
    FieldDictionary:
      search_service: "MARKET_DATA_DISCOVERY.FIRM.DICTIONARY_SEARCH"
      max_results: 4
      title_column: "FIELD"
      id_column: "FIELD"
  $$;

USE SCHEMA APP;
CREATE OR REPLACE TABLE LICENSE_REVIEW_DECISIONS (
  decision_id VARCHAR DEFAULT UUID_STRING(),
  decided_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
  user_name VARCHAR DEFAULT CURRENT_USER(),
  dataset VARCHAR, decision VARCHAR, note VARCHAR
) COMMENT = 'Market data manager decisions from the Usage screen (keep, review, or cancel at renewal)';

-- -----------------------------------------------------------------------------
-- Part 5. Least-privilege grants for the app role
-- Vendor tables: exactly what MDD_ACME_SHARE carries (USAGE + SELECT), nothing more.
-- -----------------------------------------------------------------------------
GRANT USAGE ON DATABASE ACME_MARKET_DATA TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON SCHEMA ACME_MARKET_DATA.CORE TO ROLE MDD_ANALYST_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA ACME_MARKET_DATA.CORE TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON DATABASE MARKET_DATA_DISCOVERY TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON SCHEMA MARKET_DATA_DISCOVERY.FIRM TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON SCHEMA MARKET_DATA_DISCOVERY.APP TO ROLE MDD_ANALYST_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA MARKET_DATA_DISCOVERY.FIRM TO ROLE MDD_ANALYST_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA MARKET_DATA_DISCOVERY.FIRM TO ROLE MDD_ANALYST_ROLE;
GRANT SELECT ON SEMANTIC VIEW MARKET_DATA_DISCOVERY.FIRM.MARKET_DATA_SV TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON CORTEX SEARCH SERVICE MARKET_DATA_DISCOVERY.FIRM.DICTIONARY_SEARCH TO ROLE MDD_ANALYST_ROLE;
GRANT USAGE ON AGENT MARKET_DATA_DISCOVERY.FIRM.MARKET_DATA_AGENT TO ROLE MDD_ANALYST_ROLE;
GRANT SELECT, INSERT ON TABLE MARKET_DATA_DISCOVERY.APP.LICENSE_REVIEW_DECISIONS TO ROLE MDD_ANALYST_ROLE;

-- Quick checks
USE ROLE MDD_ANALYST_ROLE;
SELECT COUNT(*) AS price_rows FROM ACME_MARKET_DATA.CORE.PRICES_DAILY;
SELECT trade_date, close_unadj, close_adj FROM ACME_MARKET_DATA.CORE.PRICES_DAILY
WHERE security_id = 'SEC00003' AND trade_date BETWEEN '2025-06-12' AND '2025-06-17' ORDER BY 1;
SELECT as_of_date, ROUND(100 * SUM(IFF(sector = 'Technology', market_value, 0)) / SUM(market_value), 2) AS tech_pct
FROM MARKET_DATA_DISCOVERY.FIRM.POSITIONS_VALUED GROUP BY 1 ORDER BY 1;
