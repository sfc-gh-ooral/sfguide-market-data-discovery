'use client';

// Catalog: the vendor datasets the firm licenses, read in place from the share, with a
// dictionary search and usage at a glance. Each card opens the dataset page.
import { ArrowRight, BookOpenText, Database, Layers, Search, Share2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { loadCatalog } from '@/components/Shell';
import { useGuide } from '@/components/Guide';
import { Card, ErrorCard, Kpi, PageHead, PageSkeleton, Pill, PoweredBy, SourceBadge, Sparkline, fmt, money, shortDate } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { DictEntry } from '@/lib/types';
import { EDGE, UNDERUSED } from '@/components/tokens';

function DictionaryFinder({ entries }: { entries: DictEntry[] }) {
  const [q, setQ] = useState('close');
  const { ask } = useGuide();
  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries.filter((e) => terms.every((t) => `${e.table_name} ${e.column_name} ${e.description}`.toLowerCase().includes(t))).slice(0, 5);
  }, [q, entries]);
  return (
    <Card title={<span className="flex items-center gap-2"><BookOpenText className="w-4 h-4" style={{ color: 'var(--rasp)' }} aria-hidden />Which field do I need?</span>}
      sub={`Search ${entries.length} definitions the vendor publishes with the share.`} right={<PoweredBy>DATA_DICTIONARY in the share</PoweredBy>}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 muted" aria-hidden />
        <label className="sr-only" htmlFor="dict-q">Search fields</label>
        <input id="dict-q" className="field !pl-9 !py-2.5 !text-[14.5px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: close, sector, ratio, ESG" />
      </div>
      <div className="flex gap-1.5 flex-wrap mt-2.5">
        {['close', 'sector', 'ratio', 'esg', 'merger'].map((t) => <button key={t} className="chip !py-1 !text-[12px]" onClick={() => setQ(t)}>{t}</button>)}
      </div>
      <ul className="mt-3 divide-y" style={{ borderColor: 'var(--rule)' }}>
        {hits.length === 0 && <li className="py-3 text-[13px] muted">No field matches &ldquo;{q}&rdquo;. Try a shorter word, or ask the Guide.</li>}
        {hits.map((e) => (
          <li key={`${e.table_name}.${e.column_name}`} className="py-2.5 flex items-start gap-3" style={{ borderColor: 'var(--rule)' }}>
            <span className="w-1 self-stretch rounded-full flex-none" style={{ background: EDGE[e.dataset] ?? 'var(--rule)' }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap"><code className="font-semibold text-[12.5px]">{e.table_name}.{e.column_name}</code><span className="text-[11px] muted mono">{e.data_type}</span></div>
              <p className="text-[12.5px] muted mt-0.5">{e.description}</p>
            </div>
            <button className="btn btn-ghost !px-2 !py-1 text-[12px] flex-none" onClick={() => ask(`What does ${e.table_name}.${e.column_name} mean, and when should I use it?`)}>Ask</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CatalogPage() {
  const cat = useAsync(() => loadCatalog(), []);
  const use = useAsync(() => data.usage(), []);
  const { ask } = useGuide();
  if (cat.error) return <ErrorCard what="the catalog" error={cat.error} />;
  if (use.error) return <ErrorCard what="usage" error={use.error} />;
  if (!cat.data || !use.data) return <PageSkeleton />;
  const c = cat.data, u = use.data;
  const rows = c.datasets.reduce((n, d) => n + d.rows, 0);
  const paid = u.summary.filter((r) => r.cost > 0);
  const spend = paid.reduce((n, r) => n + r.cost, 0);
  const under = paid.filter((r) => r.queries < UNDERUSED);
  const weeklyTotal = u.weekly.map((w) => Object.entries(w).reduce((n, [k, v]) => (k === 'week' ? n : n + Number(v)), 0));
  const spark = (id: string) => u.weekly.map((w) => Number(w[id] ?? 0));

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Acme Market Data · licensed datasets" title="Seven licensed datasets, already in your account"
        right={<><PoweredBy>Secure Data Sharing (provider side)</PoweredBy><SourceBadge p={c} /></>}>
        The provider database is published in share MDD_ACME_SHARE (share created; consumers query it in place). This single-account demo reads the provider tables directly. Nothing lands in a pipeline: client positions join to vendor prices in views at query time.
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Licensed datasets" value={c.datasets.length} icon={<Layers className="w-4 h-4" aria-hidden />} spark={weeklyTotal} sub="queries per week, 13 weeks" />
        <Kpi label="Rows available" value={rows} icon={<Database className="w-4 h-4" aria-hidden />} sub={`${fmt(c.dictionary.length)} documented fields`} />
        <Kpi label="Vendor tables copied" value={c.firmCopies} tone="moss" icon={<Share2 className="w-4 h-4" aria-hidden />} sub="in the firm database" />
        <Kpi label="Annual license spend" value={spend} format={money} icon={<Wallet className="w-4 h-4" aria-hidden />}
          trend={{ text: `${under.length} barely used`, dir: 'down', good: false }} />
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4 items-start">
        <DictionaryFinder entries={c.dictionary} />
        <Card title="Start here" sub="Three questions analysts ask in their first week with a new vendor.">
          <ul className="space-y-2">
            {[
              ['Close or adjusted close?', 'What is the difference between close and adjusted close?', 'Two similar fields; the dictionary says which to use.'],
              ['A 75% drop that isn\'t one', 'Show the price history for CRVL adjusted for splits.', 'Corporate actions explain the gap.'],
              ['Where are we concentrated?', 'What is our sector exposure across client books after the Quillfield merger?', 'Vendor reference data joined to client books.'],
            ].map(([title, q, why]) => (
              <li key={title}>
                <button onClick={() => ask(q)} className="w-full text-left inset card-lift p-3 flex items-center gap-3">
                  <span className="orb !w-3 !h-3" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-[13.5px]">{title}</span><span className="block text-[12px] muted">{why}</span></span>
                  <ArrowRight className="w-4 h-4 muted flex-none" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="ds-h">
        <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
          <h2 id="ds-h" className="font-display text-[18px] font-semibold">Datasets in the share</h2>
          <span className="text-[12px] muted">Usage: {shortDate(u.windowStart)} to {shortDate(u.windowEnd)}</span>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
          {c.datasets.map((d) => {
            const us = u.summary.find((r) => r.dataset === d.id);
            const low = !!us && us.cost > 0 && us.queries < UNDERUSED;
            return (
              <Link key={d.id} href={`/dataset/?id=${d.id}`} className="card card-lift place-edge p-4 pl-5 no-underline block" style={{ ['--edge' as string]: EDGE[d.id], color: 'var(--ink)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display font-semibold text-[15.5px]">{d.label}</div>
                  <Pill tone="link"><span className="dot dot-live" aria-hidden />Share created (provider)</Pill>
                </div>
                <div className="mono text-[11.5px] muted mt-0.5 truncate">ACME_MARKET_DATA.CORE.{d.table}</div>
                <p className="text-[13px] muted mt-2 min-h-[40px]">{d.description}</p>
                <div className="flex items-end justify-between gap-3 mt-3">
                  <div className="text-[12px] space-y-0.5">
                    <div><strong className="tabular">{fmt(d.rows)}</strong> <span className="muted">rows</span></div>
                    <div className="muted">as of {shortDate(d.freshness)}</div>
                  </div>
                  <div className="text-right">
                    <Sparkline values={spark(d.id)} color={low ? 'var(--saffron)' : EDGE[d.id]} w={88} h={26} />
                    <div className="text-[11.5px] mt-0.5">{low ? <Pill tone="saffron">Barely used · {us!.queries} queries</Pill> : <span className="muted tabular">{fmt(us?.queries ?? 0)} queries / 90 d</span>}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
