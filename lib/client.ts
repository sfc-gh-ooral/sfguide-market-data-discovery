// Browser-side access to MarketData. The hosted /try/ build has no server, so it calls the
// mock implementation directly; otherwise every call goes to /api/data, which picks mock or live.
import { HOSTED_EXAMPLE } from './hosted';
import type { MarketData } from './market-data';
import { mockData } from './mock-data';
import { preferSample } from './mode';

type Op = keyof MarketData;

async function call<T>(op: Op, args: unknown[]): Promise<T> {
  const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(preferSample() ? { 'x-mdd-mode': 'sample' } : {}) }, body: JSON.stringify({ op, args }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

const remote = new Proxy({} as MarketData, {
  get: (_t, op: Op) => (...args: unknown[]) => call(op, args),
});

export const data: MarketData = HOSTED_EXAMPLE ? mockData : remote;
