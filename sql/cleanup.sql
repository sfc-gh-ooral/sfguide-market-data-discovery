-- =============================================================================
-- Market Data Discovery Agent: cleanup
-- Drops everything sql/setup.sql created. Dropping the databases removes their tables, views,
-- semantic view, Cortex Search service, Cortex Agent, stage, and Git repository clone.
-- =============================================================================
USE ROLE ACCOUNTADMIN;

DROP SHARE IF EXISTS MDD_ACME_SHARE;
DROP DATABASE IF EXISTS MARKET_DATA_DISCOVERY;
DROP DATABASE IF EXISTS ACME_MARKET_DATA;
DROP WAREHOUSE IF EXISTS MDD_WH;
DROP INTEGRATION IF EXISTS MDD_GIT_API;
DROP ROLE IF EXISTS MDD_ANALYST_ROLE;
DROP ROLE IF EXISTS MDD_DEMO_ROLE;

-- Confirm nothing is left (each should return no rows).
SHOW SHARES LIKE 'MDD_%';
SHOW DATABASES LIKE 'ACME_MARKET_DATA';
SHOW DATABASES LIKE 'MARKET_DATA_DISCOVERY';
SHOW WAREHOUSES LIKE 'MDD_%';
SHOW INTEGRATIONS LIKE 'MDD_%';
SHOW ROLES LIKE 'MDD_%';
