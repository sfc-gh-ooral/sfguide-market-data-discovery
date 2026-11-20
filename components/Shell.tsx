'use client';

// Tidemere app shell (docs/DESIGN.md): icon rail, top bar, share-lineage strip, canvas, and
// the docked Guide. Below 1100 px the Guide is a slide-over; below 768 px the rail becomes a
// bottom tab bar.
import { BarChart3, BookOpenText, Briefcase, LayoutGrid, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { data } from '@/lib/client';
import type { Catalog, DictEntry } from '@/lib/types';
import { GuidePanel, GuideProvider, useGuide } from './Guide';
import { ModeSwitch } from './ModeChip';
import { shortDate } from './ui';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="#12355B" />
      <path d="M5 8.5c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0M5 12.5c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0" fill="none" stroke="#9CC3EA" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 16.5c2.3-1.6 4.7-1.6 7 0" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.6" cy="16.4" r="2.1" fill="#F06A98" />
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Catalog', icon: LayoutGrid, title: 'Dataset catalog' },
  { href: '/ask/', label: 'Ask', icon: Sparkles, title: 'Ask the data' },
  { href: '/book/', label: 'My book', icon: Briefcase, title: 'Join to my book' },
  { href: '/usage/', label: 'Usage', icon: BarChart3, title: 'Usage & value' },
];
const TITLES: Record<string, string> = { '/': 'Dataset catalog', '/dataset/': 'Dataset', '/ask/': 'Ask the data', '/book/': 'Join to my book', '/usage/': 'Usage & value' };
const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`).replace(/^\/sfguide-market-data-discovery\/try/, '') || '/';

// One catalog load per page view, shared by the share strip and the dictionary palette.
let catalogOnce: Promise<Catalog> | undefined;
export const loadCatalog = () => (catalogOnce ??= data.catalog().catch((e) => { catalogOnce = undefined; throw e; }));

function ThemeToggle() {
  const [dark, setDark] = useState<boolean>();
  useEffect(() => {
    const saved = localStorage.getItem('mdd-theme');
    const d = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(d); document.documentElement.dataset.theme = d ? 'dark' : 'light';
  }, []);
  const flip = () => { const d = !dark; setDark(d); document.documentElement.dataset.theme = d ? 'dark' : 'light'; localStorage.setItem('mdd-theme', d ? 'dark' : 'light'); };
  return (
    <button className="btn btn-ghost !p-2" onClick={flip} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function DictionaryPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<DictEntry[]>();
  const [err, setErr] = useState<string>();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const { ask } = useGuide();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0); input.current?.focus();
    loadCatalog().then((c) => setEntries(c.dictionary), (e) => setErr(String(e.message ?? e)));
  }, [open]);
  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const all = entries ?? [];
    const score = (e: DictEntry) => terms.reduce((n, t) => n + (`${e.table_name}.${e.column_name}`.toLowerCase().includes(t) ? 2 : 0), 0);
    return (terms.length ? all.filter((e) => terms.every((t) => `${e.table_name} ${e.column_name} ${e.description}`.toLowerCase().includes(t))).sort((a, b) => score(b) - score(a)) : all).slice(0, 9);
  }, [q, entries]);
  if (!open) return null;
  const pick = (e: DictEntry) => { onClose(); ask(`What does ${e.table_name}.${e.column_name} mean, and when should I use it?`); };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 sheet-backdrop" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Search the data dictionary" className="card rise relative w-full max-w-xl overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
        }}>
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Search className="w-4 h-4 muted" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Search 32 vendor fields: close, sector, ratio, ESG…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[14.5px]" aria-label="Search fields" />
          <button className="btn btn-ghost !p-1" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label="Matching fields">
          {err && <li className="p-3 text-[13px]" style={{ color: 'var(--rasp)' }}>Couldn&apos;t load the dictionary: {err}</li>}
          {!entries && !err && [0, 1, 2].map((i) => <li key={i} className="skel h-12 m-1" />)}
          {entries && hits.length === 0 && <li className="p-4 text-[13px] muted">No field matches &ldquo;{q}&rdquo;. Try a shorter word, or ask the Guide.</li>}
          {hits.map((e, i) => (
            <li key={`${e.table_name}.${e.column_name}`} role="option" aria-selected={i === sel}>
              <button className="w-full text-left rounded-xl px-3 py-2.5" onMouseEnter={() => setSel(i)} onClick={() => pick(e)}
                style={{ background: i === sel ? 'color-mix(in srgb, var(--link) 9%, var(--surface))' : 'transparent' }}>
                <div className="flex items-center gap-2 flex-wrap"><code className="font-semibold text-[12.5px]">{e.table_name}.{e.column_name}</code><span className="text-[11px] muted mono">{e.data_type}</span></div>
                <div className="text-[12.5px] muted mt-0.5 line-clamp-2">{e.description}</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 text-[11.5px] muted flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--rule)', background: 'var(--surface-2)' }}>
          <span>Enter asks the Guide about the field</span><span className="hidden sm:inline"><span className="kbd">↑</span> <span className="kbd">↓</span> to move · <span className="kbd">Esc</span> to close</span>
        </div>
      </div>
    </div>
  );
}

function ShareStrip() {
  const [c, setC] = useState<Catalog>();
  useEffect(() => { loadCatalog().then(setC, () => undefined); }, []);
  const asOf = c?.datasets.find((d) => d.id === 'prices_daily')?.freshness;
  return (
    <div className="share-strip">
      <div className="scroll-x">
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 text-[12px] w-max">
          <span className="lineage-node"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--saffron)' }} aria-hidden />Acme Market Data <span className="muted">provider</span></span>
          <span className="lineage-flow" aria-hidden />
          <span className="lineage-node mono"><span className="dot dot-live" style={{ color: 'var(--link)' }} aria-hidden />MDD_ACME_SHARE</span>
          <span className="lineage-flow" aria-hidden />
          <span className="lineage-node"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--moss)' }} aria-hidden />Northwind Wealth <span className="muted">consumer</span></span>
          <span className="muted pl-2">·</span>
          <span><strong className="tabular">{c ? c.firmCopies : '–'}</strong> <span className="muted">vendor tables copied</span></span>
          <span className="muted">·</span>
          <span className="muted">prices as of <strong style={{ color: 'var(--ink)' }}>{asOf ? shortDate(asOf) : '–'}</strong></span>
        </div>
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const path = norm(usePathname() ?? '/');
  const { open, setOpen } = useGuide();
  const [palette, setPalette] = useState(false);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1100px)');
    const on = () => setWide(m.matches); on(); m.addEventListener('change', on);
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', k);
    return () => { m.removeEventListener('change', on); window.removeEventListener('keydown', k); };
  }, []);
  const onAsk = path === '/ask/';
  const docked = wide && !onAsk;

  return (
    <div className="min-h-screen flex">
      {/* Icon rail (tablet and desktop) */}
      <nav aria-label="Main" className="rail hidden md:flex fixed inset-y-0 left-0 w-[76px] flex-col items-center gap-1 py-4 z-30">
        <Link href="/" aria-label="Tidemere home" className="mb-4 rounded-[12px] p-[3px]" style={{ background: 'rgba(255,255,255,0.14)' }}><Logo size={36} /></Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rail-link w-[62px]" aria-current={path === n.href || (n.href === '/' && path === '/dataset/') ? 'page' : undefined}>
            <n.icon className="w-5 h-5" aria-hidden />{n.label}<span className="tip">{n.title}</span>
          </Link>
        ))}
        <button className="rail-link w-[62px] mt-1" onClick={() => setPalette(true)}><BookOpenText className="w-5 h-5" aria-hidden />Fields<span className="tip">Data dictionary (/ or ⌘K)</span></button>
      </nav>

      <div className={`flex-1 min-w-0 md:pl-[76px] ${docked ? 'pr-[392px]' : ''}`}>
        <header className="topbar sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-[60px]">
            <Link href="/" className="md:hidden flex-none" aria-label="Tidemere home"><Logo /></Link>
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-[15px] leading-tight truncate"><span className="hidden sm:inline">Tidemere</span><span className="hidden sm:inline muted font-normal"> / </span>{TITLES[path] ?? 'Tidemere'}</div>
              <div className="text-[11.5px] muted truncate hidden sm:block">Market data atlas · synthetic data</div>
            </div>
            <button className="field !w-auto hidden lg:flex items-center gap-2 !py-1.5 text-left muted cursor-pointer" style={{ minWidth: 230 }} onClick={() => setPalette(true)}>
              <Search className="w-4 h-4" aria-hidden /><span className="flex-1 text-[13px]">Search fields</span><span className="kbd">/</span>
            </button>
            <button className="btn btn-ghost !p-2 lg:hidden" onClick={() => setPalette(true)} aria-label="Search fields"><Search className="w-4 h-4" /></button>
            <span className="hidden 2xl:inline-flex items-center gap-2 text-[12px] pl-1 pr-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--rule)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white" style={{ background: 'var(--harbor)' }} aria-hidden>RA</span>
              Research analyst · Northwind Wealth
            </span>
            <ModeSwitch />
            <ThemeToggle />
          </div>
        </header>
        <ShareStrip />
        <main className="contour min-h-[calc(100vh-100px)]">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-10">
            {children}
            <footer className="mt-10 pt-4 text-[12px] muted" style={{ borderTop: '1px solid var(--rule)' }}>
              Tidemere, Acme Market Data and Northwind Wealth are fictional. Synthetic data and illustrative logic only; not investment, production, regulatory or compliance advice.
              An example built on Snowflake, not an official Snowflake product.
            </footer>
          </div>
        </main>
      </div>

      {/* Guide: docked on wide screens, slide-over otherwise */}
      {docked && <div className="fixed top-0 right-0 bottom-0 w-[392px] z-20"><GuidePanel docked /></div>}
      {!docked && !onAsk && open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="drawer relative w-full sm:w-[420px] h-full"><GuidePanel docked={false} /></div>
        </div>
      )}
      {!docked && !onAsk && !open && (
        <button onClick={() => setOpen(true)} className="fixed right-4 bottom-20 md:bottom-6 z-40 btn btn-primary !rounded-full !px-4 !py-2.5 shadow-lg" aria-label="Open the Guide">
          <span className="orb !w-4 !h-4" aria-hidden />Ask the Guide
        </button>
      )}

      {/* Bottom tabs on phones */}
      <nav aria-label="Main" className="tabbar md:hidden fixed bottom-0 inset-x-0 z-40 rail grid grid-cols-5 px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom))]">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rail-link" aria-current={path === n.href ? 'page' : undefined}><n.icon className="w-5 h-5" aria-hidden />{n.label}</Link>
        ))}
        <button className="rail-link" onClick={() => setPalette(true)}><BookOpenText className="w-5 h-5" aria-hidden />Fields</button>
      </nav>

      <DictionaryPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return <GuideProvider><Frame>{children}</Frame></GuideProvider>;
}
