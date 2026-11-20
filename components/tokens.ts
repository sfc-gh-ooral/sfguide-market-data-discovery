// Per-dataset edge colors (docs/DESIGN.md) and the "barely used" threshold.
export const EDGE: Record<string, string> = {
  securities: 'var(--link)', prices_daily: 'var(--rasp)', corporate_actions: 'var(--saffron)', fundamentals_quarterly: 'var(--moss)',
  esg_scores: '#4F8FC9', fund_holdings: '#C45C86', data_dictionary: '#6C7A8C',
};
export const UNDERUSED = 20; // queries in the 90-day window
