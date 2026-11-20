'use client';

// Recharts wrappers in the Tidemere style: thin lines, dashed grid, tooltips on a surface card.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const SERIES = ['var(--link)', 'var(--rasp)', 'var(--saffron)', 'var(--moss)', '#6C7A8C', '#4F8FC9', '#C45C86'];
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--rule)" strokeDasharray="3 4" vertical={false} />;
const tip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 10, fontSize: 12, color: 'var(--ink)', boxShadow: 'var(--shadow)' },
  itemStyle: { fontFamily: 'var(--font-mono)', padding: 0 },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
  cursor: { stroke: 'var(--rule)', fill: 'color-mix(in srgb, var(--link) 6%, transparent)' },
};
const legend = <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="circle" iconSize={8} />;
const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v));

type Datum = Record<string, string | number | null>;

export function LineSeries({ rows, x, series, names, height = 260, marker }: {
  rows: Datum[]; x: string; series: string[]; names?: Record<string, string>; height?: number; marker?: { x: string; label: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 14, right: 12, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey={x} {...axis} minTickGap={48} />
        <YAxis {...axis} width={52} tickFormatter={compact} />
        <Tooltip {...tip} />
        {series.length > 1 && legend}
        {marker && <ReferenceLine x={marker.x} stroke="var(--rasp)" strokeDasharray="4 3" label={{ value: marker.label, position: 'insideTopRight', fill: 'var(--rasp)', fontSize: 11, fontWeight: 600 }} />}
        {series.map((s, i) => <Line key={s} type="monotone" dataKey={s} name={names?.[s] ?? s} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({ rows, x, series, names, stacked, height = 260, highlight, zoom }: {
  rows: Datum[]; x: string; series: string[]; names?: Record<string, string>; stacked?: boolean; height?: number; highlight?: (d: Datum) => boolean; zoom?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey={x} {...axis} minTickGap={16} interval="preserveStartEnd" />
        <YAxis {...axis} width={48} tickFormatter={compact} domain={zoom ? [(m: number) => Math.max(0, Math.floor((m - 5) / 5) * 5), 'auto'] : undefined} />
        <Tooltip {...tip} />
        {series.length > 1 && legend}
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} name={names?.[s] ?? s} stackId={stacked ? 'a' : undefined} fill={SERIES[i % SERIES.length]} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={44}>
            {highlight && rows.map((d, j) => <Cell key={j} fill={highlight(d) ? 'var(--rasp)' : SERIES[i % SERIES.length]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedArea({ rows, x, series, names, colors, height = 260 }: {
  rows: Datum[]; x: string; series: string[]; names?: Record<string, string>; colors?: Record<string, string>; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey={x} {...axis} minTickGap={32} />
        <YAxis {...axis} width={44} tickFormatter={compact} />
        <Tooltip {...tip} />
        {legend}
        {series.map((s, i) => {
          const c = colors?.[s] ?? SERIES[i % SERIES.length];
          return <Area key={s} type="monotone" dataKey={s} name={names?.[s] ?? s} stackId="a" stroke={c} fill={c} fillOpacity={0.22} strokeWidth={1.6} />;
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Before/after paired horizontal bars: ghost bar for before, harbor blue for after. */
export function BeforeAfter({ rows, height }: { rows: { key: string; before: number; after: number; flag?: boolean }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? 34 * rows.length + 40}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="3 4" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="key" {...axis} width={128} tick={{ fontSize: 11.5, fill: 'var(--ink)' }} />
        <Tooltip {...tip} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        {legend}
        <Bar dataKey="before" name="Before merger" fill="var(--ghost)" radius={[0, 4, 4, 0]} barSize={9} />
        <Bar dataKey="after" name="Latest" radius={[0, 4, 4, 0]} barSize={9}>
          {rows.map((r) => <Cell key={r.key} fill={r.flag ? 'var(--rasp)' : 'var(--link)'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
