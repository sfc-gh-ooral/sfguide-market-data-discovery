// The interface every screen uses. Two implementations: mock-data.ts (bundled synthetic data,
// no account) and live-data.ts (Snowflake). Same shapes, so screens don't know which is on.
import type { AskAnswer, Catalog, Decision, JoinView, LiveAccess, SplitView, UsageView } from './types';

export interface MarketData {
  catalog(): Promise<Catalog>;
  ask(question: string): Promise<AskAnswer>;
  join(): Promise<JoinView>;
  /** Weekly adjusted and unadjusted close around the latest split of one ticker (story 2). */
  split(ticker: string): Promise<SplitView>;
  usage(): Promise<UsageView>;
  /** Real queries on the vendor tables in this account (ACCESS_HISTORY). Slow, so it loads separately. */
  liveAccess(): Promise<LiveAccess>;
  decide(dataset: string, decision: Decision['decision'], note: string): Promise<Decision>;
}
