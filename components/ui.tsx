'use client';

// Tidemere UI kit: cards, KPI tiles with count-up and sparklines, status pills, capability
// badges, a sortable and filterable table, drawers, skeletons, and a small markdown renderer.
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Database, Search, Sparkles, Timer, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Provenance } from '@/lib/types';

export const money = (x: number): string => {
  if (x < 0) return `−${money(-x)}`;
  return x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `$${Math.round(x / 1e3)}K` : `$${Math.round(x)}`;
};
export const fmt = (n: number) => n.toLocaleString('en-US');
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const shortDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function Card({ title, sub, right, children, className = '', pad = 'p-5' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: string }) {
  return (
    <section className={`card ${pad} ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold">{title}</h2>}
            {sub && <p className="text-[12.5px] muted mt-0.5">{sub}</p>}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Counts up once on first view; instant with reduced motion. */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(target * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Sparkline({ values, color = 'var(--link)', w = 96, h = 28 }: { values: number[]; color?: string; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} opacity=".12" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Kpi({ label, value, format = fmt, sub, trend, tone = 'link', spark, icon }: {
  label: string; value: number; format?: (n: number) => string; sub?: ReactNode;
  trend?: { text: string; dir: 'up' | 'down'; good: boolean }; tone?: 'link' | 'rasp' | 'saffron' | 'moss'; spark?: number[]; icon?: ReactNode;
}) {
  const v = useCountUp(value);
  return (
    <div className="card card-lift p-4 relative overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider muted">{label}</div>
        {icon && <span style={{ color: `var(--${tone})` }}>{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-3 mt-1.5">
        <div className="font-display text-[28px] leading-none font-semibold tabular" style={{ color: tone === 'link' ? 'var(--ink)' : `var(--${tone})` }}>{format(Math.round(v * 100) / 100)}</div>
        {spark && <Sparkline values={spark} color={`var(--${tone})`} />}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[12px] muted flex-wrap">
        {trend && (
          <span className={`pill ${trend.good ? 'pill-moss' : 'pill-rasp'}`}>
            {trend.dir === 'up' ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />}{trend.text}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

export function Pill({ tone = 'link', children, title }: { tone?: 'link' | 'rasp' | 'saffron' | 'moss' | 'muted'; children: ReactNode; title?: string }) {
  return <span className={`pill pill-${tone}`} title={title}>{children}</span>;
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <span className="pill pill-link"><Sparkles className="w-3 h-3" aria-hidden />Powered by {children}</span>;
}

export function SampleAiBadge() {
  return <span className="pill pill-saffron" title="Scripted answer in no-account mode, not live Cortex output"><Sparkles className="w-3 h-3" aria-hidden />Sample AI response</span>;
}

/** Where data came from; latency only when measured in live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <span className="pill pill-muted"><Database className="w-3 h-3" aria-hidden />Sample data</span>;
  return (
    <span className="pill pill-moss" title="Measured round trip from the app server to Snowflake">
      <Timer className="w-3 h-3" aria-hidden />Live · {p.role}{p.latencyMs !== undefined ? ` · ${fmt(p.latencyMs)} ms` : ''}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skel ${className}`} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      <div className="grid lg:grid-cols-2 gap-4"><Skeleton className="h-[280px]" /><Skeleton className="h-[280px]" /></div>
    </div>
  );
}

export function ErrorCard({ what, error }: { what: string; error: string }) {
  return (
    <div className="card p-5 flex gap-3 items-start" role="alert" style={{ borderColor: 'color-mix(in srgb, var(--rasp) 45%, var(--rule))' }}>
      <AlertTriangle className="w-5 h-5 flex-none" style={{ color: 'var(--rasp)' }} aria-hidden />
      <div>
        <div className="font-semibold">Couldn&apos;t load {what}</div>
        <p className="text-[13px] muted mt-1 break-words">{error}</p>
        <p className="text-[12.5px] muted mt-2">Live mode shows the error instead of falling back to sample data. Check the connection in <code>.env.local</code>, or switch to Sample.</p>
      </div>
    </div>
  );
}

export function PageHead({ eyebrow, title, children, right }: { eyebrow: string; title: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 max-w-3xl">
        <div className="text-[11.5px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--rasp)' }}>{eyebrow}</div>
        <h1 className="font-display text-[26px] sm:text-[30px] leading-tight font-semibold mt-1">{title}</h1>
        {children && <p className="text-[14px] muted mt-1.5">{children}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

// ---------- sortable, filterable table ----------
export type Col<T> = { key: string; label: string; num?: boolean; render?: (r: T) => ReactNode; value: (r: T) => string | number | null; hideSm?: boolean };

export function SortTable<T>({ rows, cols, initial, filter, onRow, rowKey, max = 200, empty = 'No rows match.', caption }: {
  rows: T[]; cols: Col<T>[]; initial?: { key: string; desc?: boolean }; filter?: string; onRow?: (r: T) => void; rowKey: (r: T) => string; max?: number; empty?: string; caption?: string;
}) {
  const [sort, setSort] = useState(initial ?? { key: cols[0].key, desc: false });
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const col = cols.find((c) => c.key === sort.key) ?? cols[0];
    const t = q.trim().toLowerCase();
    const f = t ? rows.filter((r) => cols.some((c) => String(c.value(r) ?? '').toLowerCase().includes(t))) : rows;
    return [...f].sort((a, b) => {
      const x = col.value(a), y = col.value(b);
      const c = x == null ? 1 : y == null ? -1 : typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
  }, [rows, cols, sort, q]);
  return (
    <div>
      {filter && (
        <div className="relative mb-3 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 muted" aria-hidden />
          <input className="field !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={filter} aria-label={filter} />
        </div>
      )}
      <div className="scroll-x inset !bg-transparent" style={{ maxHeight: 460, overflowY: 'auto' }}>
        <table className="tbl">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead><tr>{cols.map((c) => {
            const on = sort.key === c.key;
            return (
              <th key={c.key} className={`${c.num ? 'text-right' : ''} ${c.hideSm ? 'hidden md:table-cell' : ''}`} aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                <button onClick={() => setSort({ key: c.key, desc: on ? !sort.desc : !!c.num })}>
                  {c.label}{on ? (sort.desc ? <ArrowDown className="w-3 h-3" aria-hidden /> : <ArrowUp className="w-3 h-3" aria-hidden />) : <ChevronsUpDown className="w-3 h-3 opacity-50" aria-hidden />}
                </button>
              </th>
            );
          })}</tr></thead>
          <tbody>
            {shown.slice(0, max).map((r) => (
              <tr key={rowKey(r)} className={onRow ? 'clickable' : ''} onClick={onRow ? () => onRow(r) : undefined}
                tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r); } : undefined}>
                {cols.map((c) => <td key={c.key} className={`${c.num ? 'text-right tabular' : ''} ${c.hideSm ? 'hidden md:table-cell' : ''}`}>{c.render ? c.render(r) : String(c.value(r) ?? '–')}</td>)}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={cols.length} className="muted text-center py-6">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="text-[12px] muted mt-2">{shown.length > max ? `Showing ${max} of ${fmt(shown.length)}` : `${fmt(shown.length)} rows`}</div>
    </div>
  );
}

/** Simple column/row table for raw query results. */
export function RawTable({ columns, rows, max = 50 }: { columns: string[]; rows: (string | number | null)[][]; max?: number }) {
  return (
    <div className="scroll-x inset !bg-transparent" style={{ maxHeight: 360, overflowY: 'auto' }}>
      <table className="tbl">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.slice(0, max).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === 'number' ? 'text-right tabular' : 'mono text-[12px]'}>{v == null ? '–' : typeof v === 'number' ? fmt(v) : v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------- drawer (right on desktop, full sheet on phones) ----------
export function Drawer({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 sheet-backdrop" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        className="drawer relative h-full w-full sm:w-[460px] overflow-y-auto" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--rule)' }}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 pb-4" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
          <div className="min-w-0"><h2 className="font-display text-[18px] font-semibold">{title}</h2>{sub && <div className="text-[12.5px] muted mt-0.5">{sub}</div>}</div>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ---------- minimal markdown for AI text (React escapes everything) ----------
function inline(s: string, key: number): ReactNode {
  // Underscores inside identifiers (PRICES_DAILY.CLOSE_ADJ) are not italics.
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*|(?<![A-Za-z0-9])_[^_]+_(?![A-Za-z0-9])|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return <span key={key}>{parts.map((p, i) =>
    p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code>
      : p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
        : (p.startsWith('_') && p.endsWith('_')) || (p.startsWith('*') && p.endsWith('*')) ? <em key={i}>{p.slice(1, -1)}</em>
          : p)}</span>;
}

export function Markdown({ text, caret }: { text: string; caret?: boolean }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (body.length) out.push(<table key={k++}><thead><tr>{body[0].map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
      const li = items.map((t, j) => <li key={j}>{inline(t, j)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { i++; continue; }
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className={`md text-[13.5px] leading-relaxed ${caret ? 'caret' : ''}`}>{out}</div>;
}
