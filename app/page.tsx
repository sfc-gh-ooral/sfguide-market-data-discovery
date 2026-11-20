'use client';

// Catalog: the vendor datasets the firm licenses, read in place, with a data dictionary search.
import { ArrowRight, Database, Search, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, Kpi, SourceBadge, fmt } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { DictEntry } from '@/lib/types';

function DictionarySearch({ entries }: { entries: DictEntry[] }) {
  const [q, setQ] = useState('close');
  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries.filter((e) => terms.every((t) => `${e.table_name} ${e.column_name} ${e.description}`.toLowerCase().includes(t))).slice(0, 8);
  }, [q, entries]);
  return (
    <Card title={<span className="flex items-center gap-2"><Search className="w-4 h-4" aria-hidden />Search the data dictionary</span>}
      right={<span className="text-xs muted">{entries.length} documented fields</span>}>
      <label className="sr-only" htmlFor="dict-q">Search fields</label>
      <input id="dict-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: close, sector, ESG, ratio"
        className="w-full rounded-lg px-3 py-2 text-sm mb-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
      {hits.length === 0 ? <p className="text-sm muted">No fields match “{q}”. Try a shorter word.</p> : (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {hits.map((e) => (
            <li key={`${e.table_name}.${e.column_name}`} className="py-2">
              <div className="text-sm"><code className="font-semibold">{e.table_name}.{e.column_name}</code> <span className="muted text-xs">{e.data_type}</span></div>
              <div className="text-sm text-2">{e.description}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function CatalogPage() {
  const { data: c, error } = useAsync(() => data.catalog(), []);
  if (error) return <Card><p className="text-sm" style={{ color: 'var(--negative)' }}>Couldn’t load the catalog: {error}</p></Card>;
  if (!c) return <div className="muted text-sm">Loading catalog…</div>;
  const rows = c.datasets.reduce((n, d) => n + d.rows, 0);
  const latest = c.datasets.find((d) => d.id === 'prices_daily')?.freshness;

  return (
    <div className="space-y-5">
      <section className="hero">
        <div className="text-xs uppercase tracking-wider font-semibold muted mb-1">Acme Market Data · licensed datasets</div>
        <h1 className="page-title mb-2">Find the right dataset and field, then ask in plain English</h1>
        <p className="text-sm text-2 max-w-3xl">Seven vendor datasets, read where the vendor publishes them. Nothing is copied into a pipeline:
          positions join to vendor prices in views at query time.</p>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Licensed datasets" value={String(c.datasets.length)} sub="Shared by the vendor" />
        <Kpi label="Rows available" value={fmt(rows)} sub="Across all datasets" />
        <Kpi label="Vendor tables copied" value={String(c.firmCopies)} sub="In the firm database" />
        <Kpi label="Latest price date" value={latest ?? '–'} sub="PRICES_DAILY" />
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <SourceBadge p={c} />
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
          <Share2 className="w-3 h-3" aria-hidden />Provider tables published in share MDD_ACME_SHARE
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="grid sm:grid-cols-2 gap-3 stagger">
          {c.datasets.map((d) => (
            <Link key={d.id} href={`/dataset/?id=${d.id}`} className="card card-hover p-4 no-underline block">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 font-semibold text-sm"><Database className="w-4 h-4" style={{ color: 'var(--accent)' }} aria-hidden />{d.label}</div>
                <span className="text-[11px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap" style={{ color: 'var(--positive)', background: 'color-mix(in srgb, var(--positive) 14%, transparent)' }}>Live share</span>
              </div>
              <div className="text-xs muted mb-2"><code>ACME_MARKET_DATA.CORE.{d.table}</code></div>
              <p className="text-sm text-2 mb-3">{d.description}</p>
              <div className="flex items-center justify-between text-xs muted">
                <span className="tabular">{fmt(d.rows)} rows · as of {d.freshness}</span>
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>Open<ArrowRight className="w-3 h-3" aria-hidden /></span>
              </div>
            </Link>
          ))}
        </div>
        <DictionarySearch entries={c.dictionary} />
      </div>
    </div>
  );
}
