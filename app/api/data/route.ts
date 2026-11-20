import { NextResponse } from 'next/server';
import type { MarketData } from '@/lib/market-data';
import { mockData } from '@/lib/mock-data';
import { isSnowflakeConfigured } from '@/lib/snowflake';

// One entry point for every screen. Uses Snowflake when .env.local is configured and the user
// hasn't switched to Sample (x-mdd-mode: sample); otherwise the bundled synthetic data.
// Live failures are returned as errors, never silently replaced with sample data.
const OPS = new Set<keyof MarketData>(['catalog', 'ask', 'join', 'split', 'usage', 'liveAccess', 'decide']);
const DECISIONS = new Set(['Keep', 'Review at renewal', 'Cancel at renewal']);

export async function POST(request: Request) {
  const { op, args } = await request.json();
  if (!OPS.has(op) || !Array.isArray(args)) return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  if (op === 'ask' && (typeof args[0] !== 'string' || !args[0].trim() || args[0].length > 500)) return NextResponse.json({ error: 'Ask a question of up to 500 characters' }, { status: 400 });
  if (op === 'split' && (typeof args[0] !== 'string' || !/^[A-Z]{1,6}$/.test(args[0]))) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  if (op === 'decide' && (typeof args[0] !== 'string' || !DECISIONS.has(args[1]) || typeof args[2] !== 'string' || args[2].length > 500)) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });

  const wantSample = request.headers.get('x-mdd-mode') === 'sample';
  const impl: MarketData = isSnowflakeConfigured() && !wantSample ? (await import('@/lib/live-data')).liveData : mockData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (impl[op as keyof MarketData] as (...a: any[]) => Promise<unknown>)(...args);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`${op} failed:`, error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
