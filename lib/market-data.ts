// The interface every screen uses. Two implementations: mock-data.ts (bundled synthetic data,
// no account) and live-data.ts (Snowflake). Same shapes, so screens don't know which is on.
import type { AskAnswer, Catalog, Decision, JoinView, LiveAccess, UsageView } from './types';

export interface MarketData {
  catalog(): Promise<Catalog>;
  ask(question: string): Promise<AskAnswer>;
  join(): Promise<JoinView>;
  usage(): Promise<UsageView>;
  /** Real queries on the vendor tables in this account (ACCESS_HISTORY). Slow, so it loads separately. */
  liveAccess(): Promise<LiveAccess>;
  decide(dataset: string, decision: Decision['decision'], note: string): Promise<Decision>;
}
