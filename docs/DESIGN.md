# Design: Tidemere (Market Data Discovery)

This file sets the look of the app and the landing page. The Tailwind tokens in `app/globals.css` come from it.

## Brand

- **Name:** Tidemere, "the market data atlas". A coined name (tide + mere, a still lake): data flows in from vendors and pools, readable, in one place. It is fictional, and so are the vendor in the data (Acme Market Data) and the firm (Northwind Wealth).
- **Audience:** research analysts, market data managers and data engineers at a wealth firm. They know the instruments cold but not the vendor's 32 fields, and they get asked every quarter to justify license spend.
- **Voice:** a well-made field guide. Plain names first, the exact column second ("Adjusted close · `PRICES_DAILY.CLOSE_ADJ`"). Short, specific, sourced: every number says where it came from and as of when. No hype; the agent says which field it picked and why.
- **Logo mark** (inline SVG, 24×24): a rounded tile in harbor blue with three stacked tide lines, the lowest one ending in a raspberry dot (the answer found).

```svg
<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="7" fill="#12355B"/>
<path d="M5 8.5c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0M5 12.5c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0" fill="none" stroke="#9CC3EA" stroke-width="1.6" stroke-linecap="round"/>
<path d="M5 16.5c2.3-1.6 4.7-1.6 7 0" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.6" cy="16.4" r="2.1" fill="#F06A98"/></svg>
```

## Direction: "the atlas"

A cool, calm, map-room product. Datasets are places on a chart, the dictionary is the legend, and the agent is the guide who knows both. Light "glacier" by default with a deep "night harbor" dark mode. Color is used for data series and status; the chrome stays quiet.

### Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` (glacier) | `#EEF3F7` | `#0A1320` | Page background, with faint topographic contour lines in the header band |
| `surface` | `#FFFFFF` | `#111D2E` | Cards, tables, drawers |
| `surface-2` | `#F5F8FB` | `#16243A` | Table headers, code, inset panels |
| `ink` | `#0E1B2C` | `#E6EDF5` | Text |
| `muted` | `#4E5D70` | `#93A3B8` | Secondary text (AA on `bg` and `surface`) |
| `rule` | `#D5DEE7` | `#22324A` | Borders and grid lines |
| `harbor` | `#12355B` | `#12355B` | Navigation rail, logo tile, primary buttons |
| `harbor-text` | `#1F5FA8` | `#8DB8EA` | Links, series 1, "Live share" badge, info |
| `raspberry` | `#B0245A` | `#F06A98` | Brand accent, focus ring, concentration risk, series 2 |
| `saffron` | `#8A5600` | `#E5B04A` | Warnings, "Sample" environment badge, series 3 |
| `moss` | `#2E6B36` | `#6CC27A` | Healthy, kept, fresh, series 4 |
| `agent` | gradient `#1F5FA8 → #B0245A` | gradient `#8DB8EA → #F06A98` | The agent orb and the thin bar on AI panels only |

`scripts/check-contrast.mjs` checks every text/background pair the app uses for WCAG AA (4.5:1 for body text, 3:1 for large text and UI glyphs). Accents are darker in light mode so they still work as text on tinted pills.

### Typography

- **Space Grotesk** (500/600) for headings, KPI figures and the wordmark.
- **Inter** (400/500/600) for UI text.
- **JetBrains Mono** (400/500) for field names, SQL, IDs and tickers.
- All three are self-hosted through `next/font` at build time (OFL). The landing page uses the same woff2 files copied to `docs/fonts/` with the license. No font CDN.
- Tabular figures wherever numbers line up.

### Layout model

- **Three panes.** A narrow harbor-blue **icon rail** on the left (logo, five destinations, labels on hover and as tooltips), the **canvas** in the middle, and a docked **Guide** panel on the right where the Cortex Agent lives. The Guide stays open across screens, so a question asked on the Catalog is still there on the Book.
- A **share strip** under the top bar on every screen: `Acme Market Data → share MDD_ACME_SHARE → Northwind Wealth · 0 vendor tables copied · prices as of 30 Oct 2026`. It is the pack's signature element and keeps the zero-copy point in view.
- **Dictionary command palette** (`/` or ⌘K) searches all 32 field definitions from anywhere and opens the field card.
- Top bar: page title, the dictionary search field, a role chip ("Research analyst · Northwind Wealth"), the Sample/Live environment switch and a theme toggle.
- Max canvas width 1180 px. Below 1100 px the Guide becomes a slide-over opened from a floating button; below 720 px the rail becomes a bottom tab bar and drawers become full-height sheets. The page never scrolls sideways; wide tables scroll inside their card.

### Density

Comfortable for reading definitions, dense where it counts: 14 px body, 13 px tables, 40 px rows, sticky table headers. Dataset cards are "place cards": a colored edge, name, plain description, row count, freshness and a 13-week usage sparkline.

### Charts

- Recharts. Thin 2 px lines with no dots except on hover; bars with 4 px top radius; 1 px dashed grid in `rule`. Tooltips on a `surface` card with a 1 px `rule` border and mono values.
- **Signature chart:** the split explainer, adjusted vs. unadjusted close on one axis with the ex-date marked by a raspberry reference line and a callout ("4-for-1 split, not a crash").
- Before/after **sector shift** as paired horizontal bars (glacier ghost bar for before, harbor for after) and a single-name concentration gauge.
- Usage as a stacked weekly area chart; underused datasets drawn in saffron.

### Motion

- 180 ms ease-out for hover, rail tooltips, drawers and the Guide; counters count up once on first view; skeleton shimmer while loading.
- The agent shows staged steps with a pulsing orb, then a word-by-word streaming reveal of the answer; citations fade in after the text.
- Respect `prefers-reduced-motion`: no counters, no shimmer, instant text.

## How it differs from the other packs

Looked at the landing pages and Try apps of Odometer (auto-finance portfolio analytics), Workforce Intelligence, Loss Triangle Analysis, Credit Risk Model Studio, Wealth Advisor Assistant, Contact Driver Analytics and Cyber Risk Copilot, and at the design note of Tallyward (continuous control testing, being rebuilt now).

| Seen elsewhere | Avoided here |
| --- | --- |
| Left sidebar with text labels (Odometer, Loss Triangles, Workforce, Wealth Advisor) | Slim icon rail plus a docked agent panel on the right: three panes |
| Top bar with tabs and a period ribbon (Tallyward) | No tab bar; the signature strip is the share lineage, not a time ribbon |
| Navy with lime (Odometer), violet/teal (Workforce), purple gradient (Loss Triangles), violet/cyan (Wealth Advisor), cream and coral (Credit Risk), ink/paper/vermilion (Tallyward) | Cool glacier blue-grey with harbor blue and raspberry; no cream, no purple, no lime |
| Serif display headlines (Odometer, Workforce, Credit Risk); IBM Plex (Tallyward); Fraunces/Manrope and Geist in other packs | Space Grotesk + Inter + JetBrains Mono |
| Chat as its own page (Wealth Advisor, Cyber Risk) | The agent is a persistent guide beside every screen, with a full-page view for long answers |
| Hero with a floating screenshot or a counter strip | Hero is a topographic contour field with a working-looking dictionary search and the share lineage diagram; screenshots follow in "atlas plates" |

## Landing page (`docs/index.html`)

Same tokens, fonts and logo. Hero: problem-first headline ("Your licensed market data is already in Snowflake. Your analysts just can't find the right field."), a one-paragraph scenario, the share lineage diagram, and two buttons (Try the example, View the repository). Then the four story beats as numbered "plates" with captioned screenshots, how it runs on Snowflake (capability by screen), requirements, time and cost, Customize with Cortex Code, and the disclaimer. Dark mode via `prefers-color-scheme`. No external scripts or fonts.
