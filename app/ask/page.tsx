'use client';

// Ask the data, full view. Same conversation as the docked Guide, with room for charts.
// The Cortex Agent searches the vendor dictionary (Cortex Search), writes SQL with Cortex
// Analyst on the semantic view, and answers with a chart, the SQL and dictionary citations.
import { BookOpenText, Database, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { AskBox, Suggestions, TurnView, useGuide } from '@/components/Guide';
import { Card, PageHead, PoweredBy } from '@/components/ui';

function Ask() {
  const initial = useSearchParams().get('q');
  const { turns, ask } = useGuide();
  const asked = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (initial && !asked.current) { asked.current = true; ask(initial); } }, [initial, ask]);
  const last = turns.at(-1);
  useEffect(() => { if (turns.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, last?.a]);

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Guide · full view" title="Ask the data in plain English"
        right={<><PoweredBy>Cortex Agent</PoweredBy><PoweredBy>Cortex Search</PoweredBy><PoweredBy>Cortex Analyst</PoweredBy></>}>
        Questions over the vendor datasets and your client books. The Guide looks up the vendor&apos;s field definitions first, so it picks adjusted close for history and the printed close for valuations.
      </PageHead>

      <div className="grid md:grid-cols-3 gap-3 stagger">
        {[
          [BookOpenText, '1. Dictionary first', 'Cortex Search over DATA_DICTIONARY finds the fields that match the question.'],
          [Database, '2. SQL on the share', 'Cortex Analyst writes SQL on MARKET_DATA_SV, a semantic view over the shared tables and client positions.'],
          [Sparkles, '3. Answer with sources', 'Chart, SQL and result rows, with every dictionary entry it relied on.'],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Sparkles;
          return (
            <div key={t as string} className="card p-4 flex gap-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-none" style={{ background: 'color-mix(in srgb, var(--link) 12%, var(--surface))', color: 'var(--link)' }}><I className="w-4 h-4" aria-hidden /></span>
              <div><div className="font-semibold text-[13.5px]">{t as string}</div><p className="text-[12.5px] muted mt-0.5">{d as string}</p></div>
            </div>
          );
        })}
      </div>

      <Card className="ai-bar" pad="p-5 sm:p-6">
        {turns.length === 0 ? (
          <div className="text-center py-6">
            <span className="orb !w-10 !h-10 inline-block" aria-hidden />
            <h2 className="font-display text-[19px] font-semibold mt-3">What do you want to know?</h2>
            <p className="text-[13px] muted mt-1 mb-4">Pick a question or type your own.</p>
            <div className="flex justify-center"><Suggestions /></div>
          </div>
        ) : (
          <div className="space-y-7">{turns.map((t) => <TurnView key={t.id} t={t} wide />)}<div ref={end} /></div>
        )}
        <div className="mt-6"><AskBox autoFocus /></div>
        {turns.length > 0 && <div className="mt-3"><Suggestions compact /></div>}
      </Card>
    </div>
  );
}

export default function AskPage() {
  return <Suspense fallback={null}><Ask /></Suspense>;
}
