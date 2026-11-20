'use client';

// Join to my book: firm holdings joined to vendor securities and prices in place (a view, not a
// copy). Shows sector and country exposure before and after the merger corporate action.
import { AlertTriangle, Download, GitMerge } from 'lucide-react';
import { Bars } from '@/components/Charts';
import { DataTable } from '@/components/DataTable';
import { Card, Kpi, SourceBadge, fmt, money, pct } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { JoinView } from '@/lib/types';

function exportCsv(j: JoinView) {
  const head = 'account_id,client_name,advisor,arvn_pct,arvn_value_usd';
  const lines = j.overLimit.map((r) => [r.account_id, `"${r.client_name}"`, `"${r.advisor}"`, r.pct, r.value].join(','));
  const url = URL.createObjectURL(new Blob([[head, ...lines].join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `single-name-review-${j.merger.acquirer}-${j.postDate}.csv` });
  a.click(); URL.revokeObjectURL(url);
}

export default function BookPage() {
  const { data: j, error } = useAsync(() => data.join(), []);
  if (error) return <Card><p className="text-sm" style={{ color: 'var(--negative)' }}>Couldn’t load client exposure: {error}</p></Card>;
  if (!j) return <div className="muted text-sm">Joining client books to vendor data…</div>;
  const m = j.merger;
  const techPre = j.pre.sector.find((s) => s.key === 'Technology')?.pct ?? 0, techPost = j.post.sector.find((s) => s.key === 'Technology')?.pct ?? 0;
  const top = j.post.names[0];
  const sectors = j.post.sector.map((s) => ({ sector: s.key, [`Before (${j.preDate})`]: j.pre.sector.find((p) => p.key === s.key)?.pct ?? 0, [`After (${j.postDate})`]: s.pct }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Join to my book</h1>
          <p className="text-sm muted">{fmt(j.accounts)} client accounts joined to vendor securities and prices in the view <code>FIRM.POSITIONS_VALUED</code>. The vendor tables stay where they are.</p>
        </div>
        <SourceBadge p={j} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Client market value" value={money(j.post.total)} sub={`As of ${j.postDate}`} />
        <Kpi label="Technology exposure" value={pct(techPost)} sub={`${pct(techPre)} before the merger`} />
        <Kpi label={`${top.ticker} share of client value`} value={pct(top.pct)} sub="Largest single name" />
        <Kpi label={`Accounts over 10% in ${m.acquirer}`} value={fmt(j.overLimit.length)} sub={`${fmt(j.overLimitPre)} before the merger`} />
      </div>

      <Card title={<span className="flex items-center gap-2"><GitMerge className="w-4 h-4" aria-hidden />Corporate action: {m.targetName} merged into {m.acquirerName}</span>}
        right={<span className="text-xs muted">CORPORATE_ACTIONS · ex-date {m.exDate}</span>}>
        <p className="text-sm text-2">Each {m.target} share became {m.ratio} {m.acquirer} shares. Client books that held both names now hold one larger {m.acquirer} position,
          which lifts Technology from {pct(techPre)} to {pct(techPost)} of client value on this synthetic data set.</p>
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card title="Sector exposure, before and after (% of client value)">
          <Bars rows={sectors} x="sector" series={[`Before (${j.preDate})`, `After (${j.postDate})`]} height={300} />
        </Card>
        <Card title="Top 10 names after the merger">
          <DataTable columns={['Ticker', 'Issuer', 'Sector', '% of value']} rows={j.post.names.map((n) => [n.ticker, n.issuer, n.sector, n.pct])} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Country exposure (% of client value)">
          <DataTable columns={['Country', 'Before', 'After', 'Value after']} rows={j.post.country.map((c) => [c.key, j.pre.country.find((p) => p.key === c.key)?.pct ?? 0, c.pct, money(c.value)])} />
        </Card>
        <Card title="Technology exposure by advisor book">
          <DataTable columns={['Advisor', 'Office', 'Accounts', 'Value', 'Tech before %', 'Tech after %']} rows={j.byAdvisor.map((a) => [a.advisor, a.office, a.accounts, money(a.aum), a.techPre, a.techPost])} />
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} aria-hidden />Accounts above a 10% single-name guideline in {m.acquirer}</span>}
        right={<button className="btn btn-primary" onClick={() => exportCsv(j)}><Download className="w-4 h-4" aria-hidden />Export review list</button>}>
        <p className="text-xs muted mb-2">An illustrative guideline for advisor review, not a rule or advice. Export the list to send to each advisor.</p>
        <DataTable columns={['Account', 'Client', 'Advisor', `${m.acquirer} %`, `${m.acquirer} value`]} rows={j.overLimit.map((r) => [r.account_id, r.client_name, r.advisor, r.pct, money(r.value)])} max={12} />
      </Card>
    </div>
  );
}
