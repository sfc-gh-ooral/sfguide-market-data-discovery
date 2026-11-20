// Shared shapes for both data sources (bundled sample data and live Snowflake).

export type Provenance = { source: 'mock' | 'snowflake'; role?: string; latencyMs?: number };

export type Row = Record<string, string | number | null>;

export type DictEntry = { dataset: string; table_name: string; column_name: string; data_type: string; description: string; example: string };

export type Dataset = {
  id: string; label: string; table: string; description: string;
  rows: number; freshness: string; columns: number | null; sample: Row[];
};

export type Catalog = Provenance & { datasets: Dataset[]; firmCopies: number; dictionary: DictEntry[] };

export type Cite = { field: string; description: string };

export type AskAnswer = Provenance & {
  question: string;
  text: string;
  sql?: string;
  table?: { columns: string[]; rows: (string | number | null)[][] };
  chart?: { kind: 'line' | 'bar'; x: string; series: string[] };
  cites: Cite[];
  tools: string[];
  sample?: boolean;
};

export type Exposure = { key: string; value: number; pct: number };
export type TopName = Exposure & { ticker: string; issuer: string; sector: string };
export type Snapshot = { total: number; sector: Exposure[]; country: Exposure[]; names: TopName[] };

export type JoinView = Provenance & {
  preDate: string; postDate: string;
  merger: { target: string; targetName: string; acquirer: string; acquirerName: string; exDate: string; ratio: number };
  pre: Snapshot; post: Snapshot;
  byAdvisor: { advisor_id: string; advisor: string; office: string; accounts: number; aum: number; techPre: number; techPost: number }[];
  overLimit: { account_id: string; client_name: string; advisor: string; pct: number; value: number; preAcquirerPct: number; preTargetPct: number }[];
  overLimitPre: number; accounts: number; positions: number;
};

export type LiveAccess = Provenance & { status: 'available' | 'unavailable' | 'sample'; counts: Record<string, number>; detail?: string };
export type UsageRow = { dataset: string; label: string; queries: number; users: number; lastAccess: string | null; cost: number; renewal: string; };
export type Decision = { dataset: string; decision: 'Keep' | 'Review at renewal' | 'Cancel at renewal'; note: string; at: string; user?: string };

export type UsageView = Provenance & {
  summary: UsageRow[];
  weekly: Record<string, string | number>[];
  windowStart: string; windowEnd: string;
  liveAccess: 'pending' | 'sample';
  decisions: Decision[];
};

export type Bar = { trade_date: string; close_adj: number; close_unadj: number };
export type SplitView = Provenance & { ticker: string; issuer: string; exDate: string; ratio: number; series: Bar[]; preSplit: Bar; onSplit: Bar };
