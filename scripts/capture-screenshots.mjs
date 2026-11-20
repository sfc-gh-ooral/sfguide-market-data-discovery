// Captures the landing-page screenshots and catalog card images from the hosted example.
//
//   npm run build:example        # refresh docs/try/ first if the UI changed
//   npm run capture              # writes docs/images/*.png and docs/catalog/*.jpg
//
// Runs headless Chromium at a fixed viewport, so image size never depends on your screen
// or editor window. It uses a fresh browser with no sign-in: only synthetic sample data
// can appear in the images. Review every image before publishing anyway.

import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const BASE = "/sfguide-market-data-discovery/try"; // must match basePath in next.config.ts
const CARD_ID = "market-data-discovery";             // catalog id: cards are <id>-<n>.jpg

const VIEWPORT = { width: 1600, height: 1000 };       // 16:10, same shape as catalog cards
const PAGE_SCALE = 1.0;                               // 1600x1000 PNGs, under the guide's 500 KB
const CARD_SCALE = 0.6;                               // 1600x1000 CSS px -> 960x600 card
const SCHEME = process.env.COLOR_SCHEME || "dark";   // "dark" or "light"

const ask = (q) => async (page) => {
  await page.getByRole("button", { name: q }).click();
  await page.locator(".ai-panel").first().waitFor({ timeout: 20000 });
};

// The walkthrough, in landing-page order (the story beats). `card` marks catalog cards, in order.
const SHOTS = [
  { name: "01-catalog", card: 1, path: "/", wait: "text=Licensed datasets" },
  {
    name: "02-dictionary", path: "/dataset/?id=prices_daily", wait: "text=Field definitions",
  },
  { name: "03-ask-adjusted-close", card: 2, path: "/ask/", act: ask("Show the price history for CRVL adjusted for splits.") },
  {
    name: "04-ask-citations", path: "/ask/",
    async act(page) {
      await ask("Show the price history for CRVL adjusted for splits.")(page);
      await page.locator(".ai-panel summary", { hasText: "SQL" }).first().click();
      await page.getByText("Dictionary entries used").first().scrollIntoViewIfNeeded();
    },
  },
  { name: "05-join-to-book", card: 3, path: "/book/", wait: "text=Top 10 names" },
  {
    name: "06-concentration", card: 4, path: "/book/", wait: "text=Top 10 names",
    async act(page) { await page.getByText("single-name guideline").scrollIntoViewIfNeeded(); },
  },
  { name: "07-ask-esg", card: 5, path: "/ask/", act: ask("Top 10 holdings across client books by ESG score.") },
  {
    name: "08-usage", card: 6, path: "/usage/", wait: "text=License review",
    async act(page) {
      await page.getByLabel("Note for ESG scores").fill("Three queries in 90 days; ask research first");
      await page.getByRole("button", { name: "Record" }).first().click();
      await page.getByText("Recorded decisions").waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

// Serves docs/try/ at the GitHub Pages path, the way the hosted example is published.
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DOCS, "try", decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(join(DOCS, "try"))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Let entrance animations finish so every run produces the same frame.
  await page.waitForTimeout(800);
}

async function main() {
  if (!existsSync(join(DOCS, "try", "index.html"))) throw new Error("docs/try/ is missing. Run `npm run build:example` first.");
  mkdirSync(join(DOCS, "images"), { recursive: true });
  mkdirSync(join(DOCS, "catalog"), { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      for (const [scale, out] of [
        [PAGE_SCALE, join(DOCS, "images", `${shot.name}.png`)],
        ...(shot.card ? [[CARD_SCALE, join(DOCS, "catalog", `${CARD_ID}-${shot.card}.jpg`)]] : []),
      ]) {
        const context = await browser.newContext({
          viewport: VIEWPORT, deviceScaleFactor: scale, colorScheme: SCHEME, reducedMotion: "reduce",
          // Fixed locale and time zone so dates render the same on every machine.
          locale: "en-US", timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        await page.goto(origin + shot.path);
        if (shot.wait) await page.locator(shot.wait).first().waitFor();
        await settle(page);
        if (shot.act) { await shot.act(page); await settle(page); }
        await page.screenshot({ path: out, ...(out.endsWith(".jpg") ? { type: "jpeg", quality: 82 } : {}) });
        await context.close();
        console.log(`${out.replace(ROOT + "/", "")}  ${Math.round(statSync(out).size / 1024)} KB`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((failure) => { console.error(failure.message); process.exit(1); });
