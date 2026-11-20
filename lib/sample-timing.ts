// Sample-mode response time for the agent, in ms (plus up to 0.9 s jitter). Live agent calls
// measured 14–33 s on this data; this is shorter but long enough that the steps read like a real call.
export const SAMPLE_DELAY_MS = { ask: 6400 } as const;
