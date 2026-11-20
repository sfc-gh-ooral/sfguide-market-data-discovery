// Live mode: one Snowflake connection as the least-privilege app role. Server only.
// Every statement uses bind variables; nothing user-supplied is concatenated into SQL.
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

export const ROLE = process.env.SNOWFLAKE_ROLE ?? 'MDD_ANALYST_ROLE';
let pool: Promise<snowflake.Connection> | undefined;

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME &&
    (process.env.SNOWFLAKE_PRIVATE_KEY_PATH || process.env.SNOWFLAKE_TOKEN));
}

function config(): snowflake.ConnectionOptions {
  const base: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    role: ROLE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'MDD_WH',
    database: 'MARKET_DATA_DISCOVERY',
    schema: 'FIRM',
    clientSessionKeepAlive: true,
  };
  // Key-pair auth is recommended; a programmatic access token also works for local testing.
  if (process.env.SNOWFLAKE_PRIVATE_KEY_PATH) return { ...base, authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH };
  return { ...base, authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: process.env.SNOWFLAKE_TOKEN };
}

function run<T>(conn: snowflake.Connection, sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, _s, rows) => (err ? reject(new Error(err.message)) : resolve((rows ?? []) as T[])) });
  });
}

async function connect(): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection(config());
  await new Promise<void>((resolve, reject) => conn.connect((err) => (err ? reject(err) : resolve())));
  // Only the app role counts, so the least-privilege grants in setup.sql are the whole story.
  await run(conn, 'USE SECONDARY ROLES NONE');
  return conn;
}

export async function query<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  if (!pool) { pool = connect(); pool.catch(() => { pool = undefined; }); }
  const conn = await pool;
  if (!conn.isUp()) { pool = undefined; return query(sqlText, binds); }
  return run<T>(conn, sqlText, binds);
}
