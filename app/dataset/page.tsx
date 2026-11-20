'use client';

// Dataset page: one vendor dataset, its documented fields, sample rows read in place, its
// usage, and for prices the split explainer (adjusted vs. unadjusted close around a split).
import { ArrowLeft, Copy, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LineSeries } from '@/components/Charts';
import { useGuide } from '@/components/Guide';
import { loadCatalog } from '@/components/Shell';
import { EDGE, UNDERUSED } from '@/components/tokens';
import { Card, type Col, ErrorCard, Kpi, PageHead, PageSkeleton, Pill, PoweredBy, RawTable, SortTable, SourceBadge, fmt, money, shortDate } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { DictEntry } from '@/lib/types';

const ASK: Record<string, string> = {
  prices_daily: 'Show the price history for CRVL adjusted for splits.',
  esg_scores: 'Top 10 holdings across client books by ESG score.',
  securities: 'What is our sector exposure across client books after the Quillfield merger?',
  corporate_actions: 'What is the difference between close and adjusted close?',
};
const SPLIT_FOR = new Set(['prices_daily', 'corporate_actions']);

function SplitExplainer() {
  const s = useAsync(() => data.split('CRVL'), []);
  if (s.error) return <ErrorCard what="the split history" error={s.error} />;
  if (!s.data) return <div className="skel h-[340px]" />;
  const v = s.data;
  const drop = Math.round((1 - v.onSplit.close_unadj / v.preSplit.close_unadj) * 100);
  return (
    <Card title={`${v.issuer} (${v.ticker}): a ${drop}% drop that isn't one`}
      sub={`Weekly closes since Nov 2024. On ${shortDate(v.exDate)} the ${v.ratio}-for-1 split steps the printed price; the adjusted series is continuous.`}
      right={<><PoweredBy>Secure Data Sharing</PoweredBy><SourceBadge p={v} /></>}>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="inset p-3"><div className="text-[11.5px] muted">CLOSE_UNADJ, {shortDate(v.preSplit.trade_date)} → {shortDate(v.onSplit.trade_date)}</div>
          <div className="font-display text-[20px] font-semibold tabular mt-0.5" style={{ color: 'var(--rasp)' }}>{v.preSplit.close_unadj.toFixed(2)} → {v.onSplit.close_unadj.toFixed(2)}</div></div>
        <div className="inset p-3"><div className="text-[11.5px] muted">CLOSE_ADJ, same two days</div>
          <div className="font-display text-[20px] font-semibold tabular mt-0.5" style={{ color: 'var(--link)' }}>{v.preSplit.close_adj.toFixed(2)} → {v.onSplit.close_adj.toFixed(2)}</div></div>
        <div className="inset p-3"><div className="text-[11.5px] muted">CORPORATE_ACTIONS</div>
          <div className="font-display text-[20px] font-semibold mt-0.5">SPLIT · ratio {v.ratio}</div></div>
      </div>
      <LineSeries rows={v.series} x="trade_date" series={['close_adj', 'close_unadj']} names={{ close_adj: 'Adjusted close (CLOSE_ADJ)', close_unadj: 'As printed (CLOSE_UNADJ)' }}
        marker={{ x: v.series.reduce((best, b) => (b.trade_date <= v.exDate ? b.trade_date : best), v.series[0].trade_date), label: `${v.ratio}-for-1 split` }} height={290} />
    </Card>
  );
}

function Dataset() {
  const id = useSearchParams().get('id') ?? 'prices_daily';
  const cat = useAsync(() => loadCatalog(), []);
  const use = useAsync(() => data.usage(), []);
  const { ask } = useGuide();
  const [tab, setTab] = useState<'fields' | 'rows' | 'sql'>('fields');
  const [copied, setCopied] = useState(false);
  if (cat.error) return <ErrorCard what="the dataset" error={cat.error} />;
  if (use.error) return <ErrorCard what="usage" error={use.error} />;
  if (!cat.data || !use.data) return <PageSkeleton />;
  const c = cat.data;
  const d = c.datasets.find((x) => x.id === id) ?? c.datasets[0];
  const us = use.data.summary.find((r) => r.dataset === d.id);
  const fields = c.dictionary.filter((e) => e.dataset === d.id);
  const cols = d.sample[0] ? Object.keys(d.sample[0]) : [];
  const low = !!us && us.cost > 0 && us.queries < UNDERUSED;
  const sql = `-- Read in place from the share: no copy, no pipeline\nSELECT *\nFROM ACME_MARKET_DATA.CORE.${d.table}\nLIMIT 100;`;
  const fieldCols: Col<DictEntry>[] = [
    { key: 'c', label: 'Field', value: (r) => r.column_name, render: (r) => <code className="font-semibold">{r.column_name}</code> },
    { key: 't', label: 'Type', value: (r) => r.data_type, render: (r) => <span className="mono text-[12px] muted">{r.data_type}</span>, hideSm: true },
    { key: 'd', label: 'Meaning', value: (r) => r.description, render: (r) => <span className="text-[12.5px]">{r.description}</span> },
    { key: 'e', label: 'Example', value: (r) => r.example, render: (r) => <span className="mono text-[12px]">{r.example}</span>, hideSm: true },
  ];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-[13px] inline-flex items-center gap-1 muted no-underline"><ArrowLeft className="w-4 h-4" aria-hidden />Catalog</Link>
      <div className="card place-edge p-5 pl-6" style={{ ['--edge' as string]: EDGE[d.id] }}>
        <PageHead eyebrow="Dataset" title={d.label}
          right={<><Pill tone="link"><span className="dot dot-live" aria-hidden />Live share</Pill>{low && <Pill tone="saffron">Barely used</Pill>}
            <button className="btn btn-primary" onClick={() => ask(ASK[d.id] ?? `What is in ${d.table} and how do I join it?`)}><Sparkles className="w-4 h-4" aria-hidden />Ask about this data</button></>}>
          <span className="mono text-[12.5px]">ACME_MARKET_DATA.CORE.{d.table}</span> · {d.description}
        </PageHead>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Rows" value={d.rows} />
        <Kpi label="Documented fields" value={fields.length} sub="in DATA_DICTIONARY" />
        <Kpi label="Queries, 90 days" value={us?.queries ?? 0} tone={low ? 'saffron' : 'link'} sub={`${us?.users ?? 0} users · last ${us?.lastAccess ? shortDate(us.lastAccess) : 'never'}`} />
        <Kpi label="Annual license" value={us?.cost ?? 0} format={(n) => (n ? money(n) : 'Included')} sub={us?.renewal ? `renews ${shortDate(us.renewal)}` : undefined} />
      </div>

      {SPLIT_FOR.has(d.id) && <SplitExplainer />}

      <Card title="Inside the dataset" right={<SourceBadge p={c} />}>
        <div className="flex gap-1 mb-3" role="tablist">
          {([['fields', `Fields (${fields.length})`], ['rows', 'Sample rows'], ['sql', 'Query it']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: tab === k ? 'var(--surface-2)' : 'transparent', border: `1px solid ${tab === k ? 'var(--rule)' : 'transparent'}`, color: tab === k ? 'var(--ink)' : 'var(--muted)' }}>{label}</button>
          ))}
        </div>
        {tab === 'fields' && (fields.length ? <SortTable rows={fields} cols={fieldCols} rowKey={(r) => r.column_name} filter="Filter fields" caption={`Fields in ${d.table}`} />
          : <p className="text-[13px] muted">This dataset documents the others; its own columns are DATASET, TABLE_NAME, COLUMN_NAME, DATA_TYPE, DESCRIPTION and EXAMPLE.</p>)}
        {tab === 'rows' && <RawTable columns={cols.map((x) => x.toUpperCase())} rows={d.sample.map((r) => cols.map((k) => r[k]))} />}
        {tab === 'sql' && (
          <div>
            <pre className="inset p-3 text-[12.5px] overflow-x-auto">{sql}</pre>
            <div className="flex items-center gap-2 mt-2">
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="w-4 h-4" aria-hidden />{copied ? 'Copied' : 'Copy SQL'}</button>
              <span className="text-[12px] muted">Runs as MDD_ANALYST_ROLE, which has exactly the grants the share carries.</span>
            </div>
          </div>
        )}
      </Card>
      <p className="text-[12px] muted">{fmt(d.rows)} rows as of {shortDate(d.freshness)}. Row counts come from INFORMATION_SCHEMA in Live mode.</p>
    </div>
  );
}

export default function DatasetPage() {
  return <Suspense fallback={<PageSkeleton />}><Dataset /></Suspense>;
}
