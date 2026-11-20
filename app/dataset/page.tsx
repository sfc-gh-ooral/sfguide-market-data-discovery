'use client';

// Drill-down: one vendor dataset, its documented fields, and sample rows read in place.
import { ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DataTable } from '@/components/DataTable';
import { Card, Kpi, SourceBadge, fmt } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const ASK: Record<string, string> = {
  prices_daily: 'Show the price history for CRVL adjusted for splits.',
  esg_scores: 'Top 10 holdings across client books by ESG score.',
  securities: 'What is our sector exposure across client books after the Quillfield merger?',
  corporate_actions: 'What is the difference between close and adjusted close?',
};

function Dataset() {
  const id = useSearchParams().get('id') ?? 'prices_daily';
  const { data: c, error } = useAsync(() => data.catalog(), []);
  if (error) return <Card><p className="text-sm" style={{ color: 'var(--negative)' }}>Couldn’t load the dataset: {error}</p></Card>;
  if (!c) return <div className="muted text-sm">Loading…</div>;
  const d = c.datasets.find((x) => x.id === id) ?? c.datasets[0];
  const fields = c.dictionary.filter((e) => e.dataset === d.id);
  const cols = d.sample[0] ? Object.keys(d.sample[0]) : [];
  const q = ASK[d.id] ?? 'Show the price history for CRVL adjusted for splits.';

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm inline-flex items-center gap-1 muted no-underline"><ArrowLeft className="w-4 h-4" aria-hidden />Catalog</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{d.label}</h1>
          <div className="text-sm muted"><code>ACME_MARKET_DATA.CORE.{d.table}</code> · {d.description}</div>
        </div>
        <Link href={`/ask/?q=${encodeURIComponent(q)}`} className="btn btn-ai no-underline"><MessageSquare className="w-4 h-4" aria-hidden />Ask about this data</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Rows" value={fmt(d.rows)} />
        <Kpi label="As of" value={d.freshness} />
        <Kpi label="Documented fields" value={String(fields.length)} sub="In DATA_DICTIONARY" />
        <Kpi label="Copies in firm database" value={String(c.firmCopies)} sub="Read in place" />
      </div>
      {fields.length > 0 && (
        <Card title="Field definitions" right={<span className="text-xs muted">From the vendor data dictionary</span>}>
          <DataTable columns={['Field', 'Type', 'Meaning', 'Example']} rows={fields.map((f) => [f.column_name, f.data_type, f.description, f.example])} />
        </Card>
      )}
      <Card title="Sample rows" right={<SourceBadge p={c} />}>
        <DataTable columns={cols.map((x) => x.toUpperCase())} rows={d.sample.map((r) => cols.map((k) => r[k]))} />
      </Card>
    </div>
  );
}

export default function DatasetPage() {
  return <Suspense fallback={<div className="muted text-sm">Loading…</div>}><Dataset /></Suspense>;
}
