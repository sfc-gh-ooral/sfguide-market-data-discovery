'use client';

// Join to my book: firm client holdings joined in place to vendor reference data and prices.
// Exposure by sector, country and name before and after the merger corporate action, and a
// work queue of accounts above the 10% single-name guideline.
import { ArrowRight, Briefcase, GitMerge, Globe2, Target, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bars, BeforeAfter } from '@/components/Charts';
import { useGuide } from '@/components/Guide';
import { Card, type Col, Drawer, ErrorCard, Kpi, PageHead, PageSkeleton, Pill, PoweredBy, SortTable, SourceBadge, fmt, money, pct, shortDate } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { JoinView } from '@/lib/types';

type Acct = JoinView['overLimit'][number];
const LIMIT = 10;
const severity = (p: number) => (p >= 25 ? { tone: 'rasp' as const, label: 'Critical' } : p >= 15 ? { tone: 'saffron' as const, label: 'High' } : { tone: 'link' as const, label: 'Above guideline' });

function Gauge({ value, max = 40 }: { value: number; max?: number }) {
  const w = Math.min(100, (value / max) * 100), lim = (LIMIT / max) * 100;
  return (
    <div className="relative h-3 rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--rule)' }} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: value > LIMIT ? 'var(--rasp)' : 'var(--link)' }} />
      <div className="absolute -top-1 -bottom-1 w-0.5" style={{ left: `${lim}%`, background: 'var(--ink)' }} />
    </div>
  );
}

export default function BookPage() {
  const j = useAsync(() => data.join(), []);
  const { ask } = useGuide();
  const [open, setOpen] = useState<Acct>();
  const [queued, setQueued] = useState<Record<string, string>>({});
  const cols = useMemo<Col<Acct>[]>(() => [
    { key: 'client', label: 'Client', value: (r) => r.client_name, render: (r) => <div><div className="font-medium">{r.client_name}</div><div className="mono text-[11px] muted">{r.account_id}</div></div> },
    { key: 'adv', label: 'Advisor', value: (r) => r.advisor, hideSm: true },
    { key: 'pct', label: 'Weight', num: true, value: (r) => r.pct, render: (r) => <span className="font-semibold">{pct(r.pct)}</span> },
    { key: 'pre', label: 'Before', num: true, value: (r) => r.preAcquirerPct, render: (r) => <span className="muted">{pct(r.preAcquirerPct)}</span>, hideSm: true },
    { key: 'val', label: 'Value', num: true, value: (r) => r.value, render: (r) => money(r.value), hideSm: true },
    { key: 'sev', label: 'Status', value: (r) => (queued[r.account_id] ? 'In review' : severity(r.pct).label), render: (r) => queued[r.account_id] ? <Pill tone="moss"><UserCheck className="w-3 h-3" aria-hidden />In review</Pill> : <Pill tone={severity(r.pct).tone}>{severity(r.pct).label}</Pill> },
  ], [queued]);

  if (j.error) return <ErrorCard what="client exposure" error={j.error} />;
  if (!j.data) return <PageSkeleton />;
  const v = j.data, m = v.merger;
  const techPre = v.pre.sector.find((s) => s.key === 'Technology')?.pct ?? 0, techPost = v.post.sector.find((s) => s.key === 'Technology')?.pct ?? 0;
  const acq = v.post.names[0];
  const sectors = v.post.sector.map((s) => ({ key: s.key, after: s.pct, before: v.pre.sector.find((p) => p.key === s.key)?.pct ?? 0, flag: s.key === 'Technology' }));
  const countries = v.post.country.slice(0, 8).map((c) => ({ country: c.key, pct: c.pct }));
  const crit = v.overLimit.filter((a) => a.pct >= 25).length;

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Join to my book · client holdings × vendor data" title={`One merger moved client books into ${m.acquirer}`}
        right={<><PoweredBy>Secure Data Sharing</PoweredBy><SourceBadge p={v} /></>}>
        {fmt(v.accounts)} client accounts and {fmt(v.positions)} positions, valued with vendor prices in a view at query time. Snapshots on {shortDate(v.preDate)} and {shortDate(v.postDate)}.
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Client market value" value={v.post.total} format={money} icon={<Briefcase className="w-4 h-4" aria-hidden />} sub={`as of ${shortDate(v.postDate)}`} />
        <Kpi label="Technology share" value={techPost} format={(n) => pct(n)} tone="rasp" trend={{ text: `${(techPost - techPre).toFixed(1)} pts`, dir: 'up', good: false }} sub={`from ${pct(techPre)}`} />
        <Kpi label={`${m.acquirer} share of value`} value={acq.pct} format={(n) => pct(n)} tone="rasp" icon={<Target className="w-4 h-4" aria-hidden />} sub="largest single name" />
        <Kpi label={`Accounts over ${LIMIT}% in ${m.acquirer}`} value={v.overLimit.length} tone="rasp" trend={{ text: `from ${v.overLimitPre}`, dir: 'up', good: false }} sub={`${crit} above 25%`} />
      </div>

      <Card className="ai-bar">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-none" style={{ background: 'color-mix(in srgb, var(--saffron) 14%, var(--surface))', color: 'var(--saffron)' }}><GitMerge className="w-5 h-5" aria-hidden /></span>
          <div className="flex-1 min-w-[220px]">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider muted">Corporate action · CORPORATE_ACTIONS</div>
            <div className="font-display text-[17px] font-semibold mt-0.5">{m.targetName} ({m.target}) merged into {m.acquirerName} ({m.acquirer})</div>
            <p className="text-[13px] muted mt-1">Ex-date {shortDate(m.exDate)}. Holders received {m.ratio} {m.acquirer} per {m.target} share, so books that held both now hold more of one name.</p>
          </div>
          <div className="flex items-center gap-2 text-[12px] flex-wrap">
            <span className="lineage-node">{shortDate(v.preDate)} <strong className="tabular">{v.overLimitPre}</strong> over</span>
            <ArrowRight className="w-4 h-4 muted" aria-hidden />
            <span className="lineage-node" style={{ borderColor: 'var(--rasp)' }}>{shortDate(v.postDate)} <strong className="tabular" style={{ color: 'var(--rasp)' }}>{v.overLimit.length}</strong> over</span>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <Card title="Sector exposure, before and after" sub="Share of client market value. Sector from SECURITIES.SECTOR; prices from PRICES_DAILY.CLOSE_UNADJ on each snapshot date.">
          <BeforeAfter rows={sectors} />
        </Card>
        <div className="space-y-4 min-w-0">
          <Card title="Top names now" sub="Share of all client value">
            <ul className="space-y-2.5">
              {v.post.names.slice(0, 6).map((n, i) => (
                <li key={n.key}>
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate"><span className="mono font-semibold">{n.ticker}</span> <span className="muted">{n.issuer}</span></span>
                    <span className="tabular font-semibold" style={{ color: i === 0 ? 'var(--rasp)' : 'var(--ink)' }}>{pct(n.pct)}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${(n.pct / v.post.names[0].pct) * 100}%`, background: i === 0 ? 'var(--rasp)' : 'var(--link)' }} /></div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Globe2 className="w-4 h-4" aria-hidden />Country exposure</span>} sub="SECURITIES.COUNTRY, latest">
            <Bars rows={countries} x="country" series={['pct']} names={{ pct: '% of value' }} height={170} />
          </Card>
        </div>
      </div>

      <Card title="By advisor book" sub="Technology share of each advisor's book, before and after the merger">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {v.byAdvisor.map((a) => (
            <div key={a.advisor_id} className="inset p-3.5">
              <div className="flex items-center justify-between gap-2"><div className="font-semibold text-[13.5px] truncate">{a.advisor}</div><span className="text-[11.5px] muted">{a.office}</span></div>
              <div className="text-[12px] muted">{a.accounts} accounts · {money(a.aum)}</div>
              <div className="flex items-end gap-2 mt-2">
                <span className="font-display text-[20px] font-semibold tabular">{pct(a.techPost)}</span>
                <Pill tone={a.techPost - a.techPre > 3 ? 'rasp' : 'saffron'}>+{(a.techPost - a.techPre).toFixed(1)} pts</Pill>
                <span className="text-[11.5px] muted ml-auto">was {pct(a.techPre)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Review queue: accounts over ${LIMIT}% in ${m.acquirer}`} sub="Click an account to see where the weight came from and send it to the advisor."
        right={<button className="btn" onClick={() => ask('What is our sector exposure across client books after the Quillfield merger?')}><span className="orb !w-3.5 !h-3.5" aria-hidden />Explain with the Guide</button>}>
        <SortTable rows={v.overLimit} cols={cols} rowKey={(r) => r.account_id} initial={{ key: 'pct', desc: true }} filter="Filter by client, advisor or account" onRow={setOpen} caption="Accounts over the single-name guideline" />
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(undefined)} title={open?.client_name ?? ''} sub={open && <><span className="mono">{open.account_id}</span> · {open.advisor}</>}>
        {open && (
          <>
            <div className="inset p-4">
              <div className="flex items-baseline justify-between"><span className="text-[12px] muted">{m.acquirer} weight now</span><span className="font-display text-[26px] font-semibold tabular" style={{ color: 'var(--rasp)' }}>{pct(open.pct)}</span></div>
              <div className="mt-2"><Gauge value={open.pct} /></div>
              <div className="text-[11.5px] muted mt-1.5">Bar marks the {LIMIT}% single-name guideline · {money(open.value)} in {m.acquirer}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wider muted mb-2">Where it came from · {shortDate(v.preDate)}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="inset p-3"><div className="text-[12px] muted">{m.acquirer} held</div><div className="font-display text-[18px] font-semibold tabular">{pct(open.preAcquirerPct)}</div></div>
                <div className="inset p-3"><div className="text-[12px] muted">{m.target} held</div><div className="font-display text-[18px] font-semibold tabular">{pct(open.preTargetPct)}</div></div>
              </div>
              <p className="text-[12.5px] muted mt-2">The {m.target} shares converted at {m.ratio} {m.acquirer} each on {shortDate(m.exDate)}. Weights use each snapshot&apos;s printed close (CLOSE_UNADJ), so price moves since February also count.</p>
            </div>
            <Pill tone={severity(open.pct).tone}>{severity(open.pct).label}</Pill>
            {queued[open.account_id] ? (
              <div className="inset p-3 text-[13px] flex items-center gap-2" style={{ color: 'var(--moss)' }}><UserCheck className="w-4 h-4" aria-hidden />Sent to {open.advisor} for review at {queued[open.account_id]} (this session only).</div>
            ) : (
              <button className="btn btn-primary w-full" onClick={() => setQueued((q) => ({ ...q, [open.account_id]: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))}>
                <UserCheck className="w-4 h-4" aria-hidden />Send to advisor for review
              </button>
            )}
            <p className="text-[11.5px] muted">The review list lives in this browser session. Decisions that are saved to Snowflake are on the Usage &amp; value screen.</p>
          </>
        )}
      </Drawer>
    </div>
  );
}
