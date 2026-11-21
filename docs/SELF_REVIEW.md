# Self-review

Checked against the Snow Packs [CONTRIBUTING](https://github.com/sfc-gh-ooral/snow-packs/blob/main/CONTRIBUTING.md) Musts and the build standard's "Before you call it done" list. Compiled from the catalog pull request ([sfc-gh-ooral/snow-packs#38](https://github.com/sfc-gh-ooral/snow-packs/pull/38)), its review, and a re-check on November 20, 2026.

## Before you call it done

| Check | Result | Notes |
| --- | --- | --- |
| Sample mode from a fresh clone | Pass | Fresh clone, `npm ci`, `npm run dev`: the home page returns 200 (re-checked November 20, 2026). |
| setup, Live mode, cleanup in the pack role | Pass | Run during the v2 build; see the README for measured cost and time. |
| Files and full history grepped for secrets, account identifiers, user names | Pass | Re-scanned November 20, 2026: no account locators, hosts, private keys or user names; the only owner hit is the public GitHub URL. |
| Pages URL and `/try/` signed out at 390 px and desktop | Pass | All `/try/` JS and CSS return 200; no sideways scroll or console errors at 390 and 1440 px (PR test plan and review). |
| Dark mode | Pass | Renders with the dark theme and no console errors (re-checked November 20, 2026). |
| Every story beat visible in a screenshot | Pass | |

## CONTRIBUTING Musts

| Must | Result | Notes |
| --- | --- | --- |
| Business problem first; one industry and one function | Pass | Wealth Management · Investments. |
| Public `sfguide-market-data-discovery` repo, Apache 2.0 `LICENSE`, Pages from `/docs` with `.nojekyll` | Pass | |
| Problem and outcome on the first screen; screenshots of the running app with captions and alt text | Pass | |
| Only claims capabilities used and tested in Live mode | Pass | Secure Data Sharing (provider side: share created, this single-account demo reads the provider tables in place, as the README says), Cortex Agents, Cortex Analyst on a semantic view, Cortex Search over the data dictionary, ACCESS_HISTORY (one secondary usage column; headline usage is the synthetic DATASET_USAGE_LOG). |
| Disclaimer, links to the repo and Snowflake docs, no Snowflake logo files, no sales motions | Pass | |
| End-user app with a real workflow; no-account Sample mode; simulated AI labeled "Sample AI response" with staged 4–8 s steps; Live mode with errors shown, no silent fallback | Pass | |
| Synthetic, deterministic data | Pass | The reviewer ran the generator twice and got identical output. |
| Self-contained setup (own database, XSMALL warehouse, least-privilege role); cleanup removes all of it | Pass | |
| No credentials, account identifiers or internal hosts in code, screenshots or history; user names redacted | Pass, with a note | Live mode accepts key pair or a programmatic access token (`lib/snowflake.ts`). |
| No customer names, deals, internal programs or roadmap | Pass | Fictional brand and sample firm. |
| GA features, or preview features labeled | Pass | |
| README Musts: prerequisites, steps and objects, cost and time, known limitations, Customize with Cortex Code, `Owner: Oz Oral · Last reviewed: November 2026`, license and as-is disclaimer | Pass | |
| Outcomes as possibilities; synthetic results qualified | Pass | |

## Known gaps

- An account cannot consume its own share, so the consumer side is not exercised.

- `npm run lint` failed from a fresh clone (ESLint 9 found no `eslint.config.*`). Added the flat config with the Next core-web-vitals and TypeScript presets (the two React Compiler advisory rules off, as the app does not use the compiler) and fixed what it reported; lint and `tsc --noEmit` now pass.
