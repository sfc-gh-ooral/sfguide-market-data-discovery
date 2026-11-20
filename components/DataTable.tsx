// Plain table for sample rows and agent results. Numbers right-aligned.
export function DataTable({ columns, rows, max = 50 }: { columns: string[]; rows: (string | number | null)[][]; max?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === 'number' ? 'tabular text-right' : ''}>{v == null ? '–' : typeof v === 'number' ? v.toLocaleString('en-US') : v}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && <div className="text-xs muted mt-2">Showing {max} of {rows.length.toLocaleString()} rows.</div>}
    </div>
  );
}
