'use client';

// Usage & value: queries, users and last access per licensed dataset next to its cost, so a
// market data manager can decide what to keep at renewal. In Live mode decisions are written
// to APP.LICENSE_REVIEW_DECISIONS and a column adds real queries from ACCESS_HISTORY.
import { Check, CircleDollarSign, History, Scale, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StackedArea } from '@/components/Charts';
import { EDGE, UNDERUSED } from '@/components/tokens';
import { Card, type Col, Drawer, ErrorCard, Kpi, PageHead, PageSkeleton, Pill, PoweredBy, SortTable, SourceBadge, Sparkline, fmt, money, shortDate } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Decision, UsageRow } from '@/lib/types';

const CHOICES: Decision['decision'][] = ['Keep', 'Review at renewal', 'Cancel at renewal'];
const tone = (d: Decision['decision']) => (d === 'Keep' ? 'moss' : d === 'Cancel at renewal' ? 'rasp' : 'saffron') as 'moss' | 'rasp' | 'saffron';

function DecisionForm({ r, onSaved }: { r: UsageRow; onSaved: (d: Decision) => void }) {
  const [choice, setChoice] = useState<Decision['decision']>(r.cost > 0 && r.queries < UNDERUSED ? 'Review at renewal' : 'Keep');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const save = async () => {
    setState('saving');
    try { onSaved(await data.decide(r.dataset, choice, note)); setState('saved'); } catch (e) { setState(String((e as Error).message)); }
  };
  return (
    <div className="space-y-3">
      <div className="text-[11.5px] font-semibold uppercase tracking-wider muted">Renewal decision</div>
      <div className="grid gap-2" role="radiogroup" aria-label={`Decision for ${r.label}`}>
        {CHOICES.map((c) => (
          <button key={c} role="radio" aria-checked={choice === c} onClick={() => { setChoice(c); setState('idle'); }}
            className="inset p-3 text-left flex items-center gap-3" style={{ borderColor: choice === c ? `var(--${tone(c)})` : undefined, background: choice === c ? `color-mix(in srgb, var(--${tone(c)}) 8%, var(--surface))` : undefined }}>
            <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-none" style={{ borderColor: `var(--${tone(c)})` }}>{choice === c && <span className="w-2 h-2 rounded-full" style={{ background: `var(--${tone(c)})` }} />}</span>
            <span className="font-semibold text-[13.5px]">{c}</span>
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-[12.5px] muted">Note for the renewal file</span>
        <textarea className="field mt-1" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Only one user in 90 days; check with the ESG team before January." />
      </label>
      <button className="btn btn-primary w-full" onClick={save} disabled={state === 'saving'}>
        {state === 'saved' ? <><Check className="w-4 h-4" aria-hidden />Recorded</> : state === 'saving' ? 'Recording…' : 'Record decision'}
      </button>
      {state !== 'idle' && state !== 'saving' && state !== 'saved' && <p className="text-[12.5px]" role="alert" style={{ color: 'var(--rasp)' }}>{state}</p>}
    </div>
  );
}

export default function UsagePage() {
  const u = useAsync(() => data.usage(), []);
  const la = useAsync(() => data.liveAccess(), []);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [open, setOpen] = useState<UsageRow>();
  useEffect(() => { if (u.data) setDecisions(u.data.decisions); }, [u.data]);
  const live = la.data?.status === 'available';
  const latest = useMemo(() => Object.fromEntries([...decisions].reverse().map((d) => [d.dataset, d])), [decisions]);
  const cols = useMemo<Col<UsageRow>[]>(() => [
    { key: 'ds', label: 'Dataset', value: (r) => r.label, render: (r) => <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: EDGE[r.dataset] }} aria-hidden /><span className="font-medium">{r.label}</span></div> },
    { key: 'q', label: 'Queries', num: true, value: (r) => r.queries, render: (r) => fmt(r.queries) },
    { key: 'u', label: 'Users', num: true, value: (r) => r.users, hideSm: true },
    { key: 'l', label: 'Last access', value: (r) => r.lastAccess, render: (r) => (r.lastAccess ? shortDate(r.lastAccess) : '–'), hideSm: true },
    ...(live ? [{ key: 'live', label: 'This account', num: true, value: (r: UsageRow) => la.data!.counts[r.dataset] ?? 0, hideSm: true } as Col<UsageRow>] : []),
    { key: 'c', label: 'Annual cost', num: true, value: (r) => r.cost, render: (r) => (r.cost ? money(r.cost) : 'Included') },
    { key: 'cpq', label: 'Per query', num: true, value: (r) => (r.cost && r.queries ? r.cost / r.queries : r.cost ? Infinity : 0), render: (r) => (r.cost ? (r.queries ? money(r.cost / r.queries) : '–') : '–'), hideSm: true },
    { key: 's', label: 'Status', value: (r) => latest[r.dataset]?.decision ?? (r.cost > 0 && r.queries < UNDERUSED ? 'Barely used' : 'Active'),
      render: (r) => latest[r.dataset] ? <Pill tone={tone(latest[r.dataset].decision)}>{latest[r.dataset].decision}</Pill>
        : r.cost > 0 && r.queries < UNDERUSED ? <Pill tone="saffron">Barely used</Pill> : <Pill tone="muted">Active</Pill> },
  ], [live, la.data, latest]);

  if (u.error) return <ErrorCard what="usage" error={u.error} />;
  if (!u.data) return <PageSkeleton />;
  const v = u.data;
  const paid = v.summary.filter((r) => r.cost > 0);
  const under = paid.filter((r) => r.queries < UNDERUSED);
  const total = paid.reduce((n, r) => n + r.cost, 0), underCost = under.reduce((n, r) => n + r.cost, 0);
  const ids = v.summary.map((r) => r.dataset);
  const label = Object.fromEntries(v.summary.map((r) => [r.dataset, r.label]));
  const colors = Object.fromEntries(ids.map((d) => [d, under.some((x) => x.dataset === d) ? 'var(--saffron)' : EDGE[d]]));
  const weeklyTotal = v.weekly.map((w) => ids.reduce((n, d) => n + Number(w[d] ?? 0), 0));

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Usage & value · market data manager" title={`${under.length} of ${v.summary.length} licensed datasets are barely used`}
        right={<>{live && <PoweredBy>ACCESS_HISTORY (one live column)</PoweredBy>}<SourceBadge p={v} /></>}>
        Queries per dataset from {shortDate(v.windowStart)} to {shortDate(v.windowEnd)}, next to what each license costs. Record a decision before each renewal.
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Annual license cost" value={total} format={money} icon={<CircleDollarSign className="w-4 h-4" aria-hidden />} sub={`${paid.length} paid datasets`} />
        <Kpi label="Cost of barely used" value={underCost} format={money} tone="saffron" sub={`under ${UNDERUSED} queries in 90 days`} />
        <Kpi label="Queries in window" value={v.summary.reduce((n, r) => n + r.queries, 0)} spark={weeklyTotal} icon={<History className="w-4 h-4" aria-hidden />} sub="per week" />
        <Kpi label="Active users" value={Math.max(...v.summary.map((r) => r.users))} icon={<Users className="w-4 h-4" aria-hidden />} sub="on the busiest dataset" />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <Card title="Weekly queries by dataset" sub="Barely used datasets in saffron">
          <StackedArea rows={v.weekly} x="week" series={ids} names={label} colors={colors} height={280} />
        </Card>
        <Card title="Renewals coming up" sub="Barely used first">
          <ul className="space-y-2.5">
            {[...paid].sort((a, b) => a.queries - b.queries || a.renewal.localeCompare(b.renewal)).slice(0, 4).map((r) => {
              const low = r.queries < UNDERUSED;
              return (
                <li key={r.dataset}>
                  <button className="w-full text-left inset card-lift p-3" onClick={() => setOpen(r)}>
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-[13.5px]">{r.label}</span><span className="tabular text-[13px] font-semibold">{money(r.cost)}</span></div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[12px] muted">renews {shortDate(r.renewal)}</span>
                      {low ? <Pill tone="saffron">{r.queries} queries · {r.users} user</Pill> : <Sparkline values={v.weekly.map((w) => Number(w[r.dataset] ?? 0))} color={EDGE[r.dataset]} w={70} h={20} />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><Scale className="w-4 h-4" aria-hidden />License review</span>} sub="Least used first. Click a dataset to record a decision.">
        <SortTable rows={v.summary} cols={cols} rowKey={(r) => r.dataset} initial={{ key: 'q' }} onRow={setOpen} caption="Usage and cost per licensed dataset" />
        <p className="text-[12px] muted mt-3">The 90-day history is a synthetic usage log (FIRM.DATASET_USAGE_LOG), since a new account has no history.
          {live ? ` "This account" counts real queries on the vendor tables here, from ACCESS_HISTORY (read in ${fmt(la.data!.latencyMs ?? 0)} ms; it can lag by up to about 3 hours).`
            : la.data?.status === 'unavailable' ? ' ACCESS_HISTORY isn\'t readable here (it needs Enterprise Edition), so only the synthetic log is shown.'
              : la.data?.status === 'sample' ? ' In Live mode a column adds real queries from ACCOUNT_USAGE.ACCESS_HISTORY.' : ' Reading ACCOUNT_USAGE.ACCESS_HISTORY…'}</p>
      </Card>

      <Card title="Decision log" sub={v.source === 'snowflake' ? 'Written to MARKET_DATA_DISCOVERY.APP.LICENSE_REVIEW_DECISIONS' : 'Kept in this browser session in Sample mode'}>
        {decisions.length === 0 ? <p className="text-[13px] muted">No decisions yet. Open a dataset in the review table to record one.</p> : (
          <ol className="space-y-2">
            {decisions.map((d, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <Pill tone={tone(d.decision)}>{d.decision}</Pill>
                <div className="min-w-0"><strong>{label[d.dataset] ?? d.dataset}</strong>{d.note && <span className="muted"> · {d.note}</span>}
                  <div className="text-[11.5px] muted mono">{d.at.slice(0, 16).replace('T', ' ')}</div></div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(undefined)} title={open?.label ?? ''} sub={open && <span className="mono">ACME_MARKET_DATA.CORE.{open.dataset.toUpperCase()}</span>}>
        {open && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[['Queries, 90 days', fmt(open.queries)], ['Users', String(open.users)], ['Last access', open.lastAccess ? shortDate(open.lastAccess) : 'Never'], ['Annual cost', open.cost ? money(open.cost) : 'Included'],
                ['Cost per query', open.cost && open.queries ? money(open.cost / open.queries) : '–'], ['Renews', shortDate(open.renewal)]].map(([k, val]) => (
                <div key={k} className="inset p-3"><div className="text-[11.5px] muted">{k}</div><div className="font-display text-[17px] font-semibold tabular">{val}</div></div>
              ))}
            </div>
            {live && <p className="text-[12.5px] muted">ACCESS_HISTORY: <strong style={{ color: 'var(--ink)' }}>{fmt(la.data!.counts[open.dataset] ?? 0)}</strong> real queries on this table in this account.</p>}
            <div className="inset p-3"><StackedArea rows={v.weekly} x="week" series={[open.dataset]} names={label} colors={{ [open.dataset]: colors[open.dataset] }} height={140} /></div>
            <DecisionForm key={open.dataset} r={open} onSaved={(d) => setDecisions((x) => [d, ...x])} />
          </>
        )}
      </Drawer>
    </div>
  );
}
