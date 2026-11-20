'use client';

// Small Recharts wrappers with theme colors. Used by Ask, Join to my book, and Usage.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const COLORS = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)', '#8aa4c8', '#c48ad8'];
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false };
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text)' } };

type Datum = Record<string, string | number | null>;

export function LineSeries({ rows, x, series, height = 260 }: { rows: Datum[]; x: string; series: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={40} />
        <YAxis {...axis} width={56} />
        <Tooltip {...tip} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => <Line key={s} dataKey={s} stroke={COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({ rows, x, series, height = 260, stacked = false, horizontal = false, names }: { rows: Datum[]; x: string; series: string[]; height?: number; stacked?: boolean; horizontal?: boolean; names?: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? <><XAxis type="number" {...axis} /><YAxis type="category" dataKey={x} {...axis} width={150} interval={0} /></>
          : <><XAxis dataKey={x} {...axis} interval={0} angle={rows.length > 6 ? -30 : 0} textAnchor={rows.length > 6 ? 'end' : 'middle'} height={rows.length > 6 ? 80 : 30} /><YAxis {...axis} width={52} /></>}
        <Tooltip {...tip} cursor={{ fill: 'var(--accent-soft)' }} />
        {series.length > 1 && <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => <Bar key={s} dataKey={s} name={names?.[s] ?? s} fill={COLORS[i]} stackId={stacked ? 'a' : undefined} radius={stacked ? 0 : [4, 4, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
