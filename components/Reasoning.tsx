'use client';

// Staged progress for the agent call. The steps mirror what the live agent actually does
// (dictionary search, Cortex Analyst SQL on the semantic view, query on the vendor tables
// in place, answer). Steps advance on a timer; the last one holds until the answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

const STEPS = [
  'Planning with the Cortex Agent',
  'Searching the vendor data dictionary with Cortex Search',
  'Generating SQL with Cortex Analyst on MARKET_DATA_SV',
  'Querying the shared tables in place as MDD_ANALYST_ROLE',
  'Writing the answer and citing dictionary fields',
];

export function Reasoning() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const per = SAMPLE_DELAY_MS.ask / STEPS.length;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      setStep(Math.min(STEPS.length - 1, Math.floor(ms / per)));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="reasoning" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
          <span className="reasoning-orb" aria-hidden />Reasoning
        </div>
        <span className="text-[11px] muted tabular">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className={`reasoning-step ${state} flex items-center gap-2 text-xs`}>
              {state === 'done' ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} aria-hidden />
                : <span className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: 'var(--border)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="reasoning-bar mt-3" aria-hidden><span style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS.ask) * 100)}%` }} /></div>
    </div>
  );
}
