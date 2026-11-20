'use client';

// Usage & value: queries, users, and last access per licensed dataset next to its cost, so a
// market data manager can decide what to keep at renewal. Decisions are written to
// APP.LICENSE_REVIEW_DECISIONS in live mode.
import { Check, Scale } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bars } from '@/components/Charts';
import { Card, Kpi, PoweredBy, SourceBadge, fmt, money } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Decision, UsageRow } from '@/lib/types';

const CHOICES: Decision['decision'][] = ['Keep', 'Review at renewal', 'Cancel at renewal'];
const UNDERUSED = 20; // queries in the window

function DecisionRow({ r, onSaved }: { r: UsageRow; onSaved: (d: Decision) => void }) {
  const [choice, setChoice] = useState<Decision['decision']>(r.queries < UNDERUSED ? 'Review at renewal' : 'Keep');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const save = async () => {
    setState('saving');
    try { onSaved(await data.decide(r.dataset, choice, note)); setState('saved'); } catch (e) { setState(String((e as Error).message)); }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="sr-only" htmlFor={`d-${r.dataset}`}>Decision for {r.label}</label>
      <select id={`d-${r.dataset}`} value={choice} onChange={(e) => { setChoice(e.target.value as Decision['decision']); setState('idle'); }}
        className="rounded-lg px-2 py-1 text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {CHOICES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note" aria-label={`Note for ${r.label}`}
        className="rounded-lg px-2 py-1 text-xs w-32" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
      <button className="btn !py-1 text-xs" onClick={save} disabled={state === 'saving'}>{state === 'saved' ? <><Check className="w-3 h-3" aria-hidden />Saved</> : 'Record'}</button>
      {state !== 'idle' && state !== 'saving' && state !== 'saved' && <span className="text-xs" style={{ color: 'var(--negative)' }}>{state}</span>}
    </div>
  );
}

export default function UsagePage() {
  const { data: u, error } = useAsync(() => data.usage(), []);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const { data: la } = useAsync(() => data.liveAccess(), []);
  const live = la?.status === 'available';
  useEffect(() => { if (u) setDecisions(u.decisions); }, [u]);
  if (error) return <Card><p className="text-sm" style={{ color: 'var(--negative)' }}>Couldn’t load usage: {error}</p></Card>;
  if (!u) return <div className="muted text-sm">Loading usage…</div>;
  const paid = u.summary.filter((r) => r.cost > 0);
  const under = paid.filter((r) => r.queries < UNDERUSED);
  const total = paid.reduce((n, r) => n + r.cost, 0), underCost = under.reduce((n, r) => n + r.cost, 0);
  const sorted = [...u.summary].sort((a, b) => a.queries - b.queries);
  const ids = u.summary.map((r) => r.dataset);
  const label = Object.fromEntries(u.summary.map((r) => [r.dataset, r.label]));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Usage &amp; value</h1>
          <p className="text-sm muted">Queries per licensed dataset from {u.windowStart} to {u.windowEnd}, next to what each license costs.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {live && <PoweredBy>ACCOUNT_USAGE.ACCESS_HISTORY</PoweredBy>}
          <SourceBadge p={u} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Annual license cost" value={money(total)} sub={`${paid.length} paid datasets`} />
        <Kpi label="Barely used" value={`${under.length} of ${u.summary.length}`} sub={`Under ${UNDERUSED} queries in 90 days`} />
        <Kpi label="Cost of barely used" value={money(underCost)} sub="Per year, at list" />
        <Kpi label="Queries in window" value={fmt(u.summary.reduce((n, r) => n + r.queries, 0))} sub={`${fmt(Math.max(...u.summary.map((r) => r.users)))} users on the busiest dataset`} />
      </div>

      <Card title="Weekly queries by dataset">
        <Bars rows={u.weekly} x="week" series={ids} names={label} stacked height={260} />
      </Card>

      <Card title={<span className="flex items-center gap-2"><Scale className="w-4 h-4" aria-hidden />License review</span>}
        right={<span className="text-xs muted">Least used first. Record a decision for the renewal.</span>}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Dataset</th><th className="text-right">Queries</th><th className="text-right">Users</th><th>Last access</th>
              {live && <th className="text-right" title="Distinct queries on these tables in this account, from ACCESS_HISTORY (up to ~3 h lag)">This account (live)</th>}
              <th className="text-right">Annual cost</th><th>Renewal</th><th>Decision</th></tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.dataset}>
                  <td><div className="font-medium">{r.label}</div>{r.queries < UNDERUSED && r.cost > 0 && <span className="text-[11px] font-medium" style={{ color: 'var(--warning)' }}>Barely used</span>}</td>
                  <td className="text-right tabular">{fmt(r.queries)}</td>
                  <td className="text-right tabular">{r.users}</td>
                  <td className="tabular">{r.lastAccess ?? '–'}</td>
                  {live && <td className="text-right tabular">{fmt(la.counts[r.dataset] ?? 0)}</td>}
                  <td className="text-right tabular">{r.cost ? money(r.cost) : 'Included'}</td>
                  <td className="tabular">{r.renewal}</td>
                  <td><DecisionRow r={r} onSaved={(d) => setDecisions((x) => [d, ...x])} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs muted mt-3">The 90-day history is a synthetic usage log (FIRM.DATASET_USAGE_LOG), since a new account has no history.
          {live ? ` The live column counts real queries on the vendor tables in this account from ACCESS_HISTORY (read in ${fmt(la.latencyMs ?? 0)} ms; it can lag by up to about 3 hours).`
            : la?.status === 'unavailable' ? ' ACCESS_HISTORY isn’t readable here (it needs Enterprise Edition), so only the synthetic log is shown.'
              : u.liveAccess === 'pending' ? ' Reading real queries from ACCOUNT_USAGE.ACCESS_HISTORY…'
                : ' In Live mode, a column adds real queries from ACCOUNT_USAGE.ACCESS_HISTORY.'}</p>
      </Card>

      {decisions.length > 0 && (
        <Card title="Recorded decisions">
          <ul className="space-y-1 text-sm">
            {decisions.map((d, i) => <li key={i}><strong>{label[d.dataset] ?? d.dataset}</strong>: {d.decision}{d.note && <span className="text-2"> · {d.note}</span>} <span className="text-xs muted">· {d.at.slice(0, 16).replace('T', ' ')}</span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
