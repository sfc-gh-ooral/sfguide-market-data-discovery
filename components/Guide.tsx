'use client';

// The Guide: the Cortex Agent, docked beside every screen. Any page can hand it a question
// (useGuide().ask). Sample mode waits 6-7 s and shows scripted answers labeled as samples; Live
// mode runs MARKET_DATA_AGENT and shows the same steps while the real call runs, with no delay.
import { BookOpen, Check, Code2, Loader2, Maximize2, Send, Table2 } from 'lucide-react';
import Link from 'next/link';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { data } from '@/lib/client';
import { SAMPLE_QUESTIONS } from '@/lib/mock-data';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';
import type { AskAnswer } from '@/lib/types';
import { Bars, LineSeries } from './Charts';
import { Markdown, PoweredBy, RawTable, SampleAiBadge, SourceBadge, fmt } from './ui';

export type Turn = { id: number; q: string; a?: AskAnswer; error?: string };
type Ctx = { turns: Turn[]; busy: boolean; ask: (q: string) => void; open: boolean; setOpen: (o: boolean) => void };
const GuideCtx = createContext<Ctx | null>(null);
export const useGuide = () => useContext(GuideCtx)!;

export function GuideProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [open, setOpen] = useState(false);
  const busy = turns.some((t) => !t.a && !t.error);
  const n = useRef(0);
  const ask = useCallback((question: string) => {
    const q = question.trim();
    if (!q) return;
    const id = ++n.current;
    setOpen(true);
    setTurns((t) => (t.some((x) => !x.a && !x.error) ? t : [...t, { id, q }]));
    data.ask(q).then(
      (a) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, a } : x))),
      (e) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: String((e as Error).message ?? e) } : x))),
    );
  }, []);
  const value = useMemo(() => ({ turns, busy, ask, open, setOpen }), [turns, busy, ask, open]);
  return <GuideCtx.Provider value={value}>{children}</GuideCtx.Provider>;
}

// Steps the live path performs, in order (see sql/setup.sql: agent, search service, semantic view).
const STEPS = [
  'Planning with the Cortex Agent',
  'Searching 32 dictionary entries with Cortex Search',
  'Writing SQL with Cortex Analyst on MARKET_DATA_SV',
  'Reading the shared tables in place as MDD_ANALYST_ROLE',
  'Drafting the answer and citing the fields used',
];

export function Reasoning() {
  const [ms, setMs] = useState(0);
  useEffect(() => { const t0 = Date.now(); const id = window.setInterval(() => setMs(Date.now() - t0), 120); return () => window.clearInterval(id); }, []);
  const per = SAMPLE_DELAY_MS.ask / STEPS.length;
  const step = Math.min(STEPS.length - 1, Math.floor(ms / per));
  return (
    <div className="inset p-3.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold"><span className="orb orb-busy !w-3.5 !h-3.5" aria-hidden />Working</div>
        <span className="text-[11.5px] muted tabular mono">{(ms / 1000).toFixed(1)} s</span>
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-[12.5px]" style={{ color: i <= step ? 'var(--ink)' : 'var(--muted)', opacity: i > step ? 0.6 : 1 }}>
            {i < step ? <Check className="w-3.5 h-3.5 flex-none" style={{ color: 'var(--moss)' }} aria-hidden />
              : i === step ? <Loader2 className="w-3.5 h-3.5 flex-none animate-spin" style={{ color: 'var(--rasp)' }} aria-hidden />
                : <span className="w-3.5 h-3.5 flex-none rounded-full border" style={{ borderColor: 'var(--rule)' }} aria-hidden />}
            {s}
          </li>
        ))}
      </ol>
      <div className="progress mt-3" aria-hidden><span style={{ width: `${Math.min(96, (ms / SAMPLE_DELAY_MS.ask) * 100)}%` }} /></div>
    </div>
  );
}

/** Word-by-word reveal of an answer that has already arrived (instant with reduced motion). */
function useStream(text: string) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(words.length); return; }
    setN(0);
    const id = window.setInterval(() => setN((k) => { if (k >= words.length) { window.clearInterval(id); return k; } return k + 3; }), 28);
    return () => window.clearInterval(id);
  }, [words]);
  return { shown: words.slice(0, n).join(''), done: n >= words.length };
}

export function Answer({ a, wide }: { a: AskAnswer; wide?: boolean }) {
  const { shown, done } = useStream(a.text);
  const [tab, setTab] = useState<'chart' | 'sql' | 'rows'>(a.chart ? 'chart' : a.sql ? 'sql' : 'rows');
  const rows = a.table ? a.table.rows.map((r) => Object.fromEntries(a.table!.columns.map((c, i) => [c, r[i]]))) : [];
  const hasChart = !!a.chart && rows.length > 1;
  const tabs = [hasChart && ['chart', 'Chart', null], a.sql && ['sql', 'SQL', Code2], a.table && ['rows', `Rows (${fmt(a.table.rows.length)})`, Table2]].filter(Boolean) as [typeof tab, string, typeof Code2 | null][];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <PoweredBy>Cortex Agent</PoweredBy>
        {a.sample ? <SampleAiBadge /> : <SourceBadge p={a} />}
      </div>
      <Markdown text={shown} caret={!done} />
      {done && (
        <div className="space-y-3 rise">
          {tabs.length > 0 && (
            <div className="inset p-2.5">
              <div className="flex gap-1 mb-2" role="tablist">
                {tabs.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: tab === k ? 'var(--surface)' : 'transparent', border: `1px solid ${tab === k ? 'var(--rule)' : 'transparent'}`, color: tab === k ? 'var(--ink)' : 'var(--muted)' }}>{label}</button>
                ))}
              </div>
              {tab === 'chart' && hasChart && (a.chart!.kind === 'line'
                ? <LineSeries rows={rows} x={a.chart!.x} series={a.chart!.series} height={wide ? 280 : 200} />
                : <Bars rows={rows} x={a.chart!.x} series={a.chart!.series} height={wide ? 280 : 200} zoom={a.chart!.series.some((x) => /SCORE/i.test(x))} />)}
              {tab === 'sql' && a.sql && (
                <>
                  <div className="text-[11.5px] muted mb-1">{a.sample ? 'Sample SQL, as the live agent writes it' : 'Generated by Cortex Analyst'}</div>
                  <pre className="text-[11.5px] leading-relaxed overflow-x-auto whitespace-pre p-2 rounded-lg" style={{ background: 'var(--surface)' }}>{a.sql}</pre>
                </>
              )}
              {tab === 'rows' && a.table && <RawTable columns={a.table.columns} rows={a.table.rows} max={wide ? 50 : 15} />}
            </div>
          )}
          {a.cites.length > 0 && (
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wider muted mb-1.5 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" aria-hidden />Sources · data dictionary</div>
              <ol className="space-y-1.5">
                {a.cites.map((c, i) => (
                  <li key={c.field} className="flex gap-2 text-[12.5px]">
                    <span className="mono text-[11px] font-semibold flex-none w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--rasp) 12%, var(--surface))', color: 'var(--rasp)' }}>{i + 1}</span>
                    <span className="min-w-0"><code className="font-semibold">{c.field}</code> <span className="muted">{c.description}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {a.tools.length > 0 && <div className="text-[11.5px] muted">Tools used: {a.tools.join(' · ')}</div>}
        </div>
      )}
    </div>
  );
}

export function TurnView({ t, wide }: { t: Turn; wide?: boolean }) {
  return (
    <div className="space-y-2.5 rise">
      <div className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px]" style={{ background: 'var(--harbor)', color: '#fff' }}>{t.q}</div></div>
      <div className="flex gap-2.5">
        <span className="orb mt-1" aria-hidden />
        <div className="min-w-0 flex-1">
          {t.a ? <Answer a={t.a} wide={wide} /> : t.error ? (
            <div className="text-[13px] p-3 rounded-xl" role="alert" style={{ background: 'color-mix(in srgb, var(--rasp) 10%, var(--surface))', color: 'var(--rasp)' }}>The agent call failed: {t.error}</div>
          ) : <Reasoning />}
        </div>
      </div>
    </div>
  );
}

export function AskBox({ autoFocus }: { autoFocus?: boolean }) {
  const { ask, busy } = useGuide();
  const [q, setQ] = useState('');
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!busy) { ask(q); setQ(''); } }}>
      <label className="sr-only" htmlFor="guide-q">Ask the data</label>
      <input id="guide-q" autoFocus={autoFocus} className="field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask about securities, prices, ESG or client books…" />
      <button className="btn btn-primary !px-3" disabled={busy || !q.trim()} aria-label="Ask"><Send className="w-4 h-4" aria-hidden /></button>
    </form>
  );
}

export function Suggestions({ compact }: { compact?: boolean }) {
  const { ask, busy } = useGuide();
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-1'}`}>
      {SAMPLE_QUESTIONS.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => ask(s)}>{s}</button>)}
    </div>
  );
}

/** The docked panel (desktop) or slide-over (narrow screens). */
export function GuidePanel({ docked }: { docked: boolean }) {
  const { turns, setOpen } = useGuide();
  const end = useRef<HTMLDivElement>(null);
  const last = turns.at(-1);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, last?.a]);
  return (
    <aside aria-label="Guide: ask the data" className="flex flex-col h-full" style={{ background: 'var(--surface)', borderLeft: docked ? '1px solid var(--rule)' : undefined }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="orb" aria-hidden />
          <div className="min-w-0">
            <div className="font-display font-semibold text-[14.5px] leading-tight">Guide</div>
            <div className="text-[11.5px] muted truncate">Cortex Agent · dictionary-aware</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/ask/" className="btn btn-ghost !p-1.5" aria-label="Open full view" title="Open full view" onClick={() => !docked && setOpen(false)}><Maximize2 className="w-4 h-4" /></Link>
          {!docked && <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setOpen(false)}>Close</button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] muted">Ask in plain English. The Guide checks the vendor&apos;s data dictionary before it picks a field, then answers with SQL on the shared tables and cites what it used.</p>
            <Suggestions compact />
          </div>
        ) : turns.map((t) => <TurnView key={t.id} t={t} />)}
        <div ref={end} />
      </div>
      <div className="p-3" style={{ borderTop: '1px solid var(--rule)' }}><AskBox /></div>
    </aside>
  );
}
