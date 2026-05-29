/**
 * Headless test runner for CI (and local `npm test`).
 *
 * Spins up a tiny static server rooted at the repo, opens the iframe test
 * harness (tests/index.html) in headless Chromium, waits for the suite to
 * finish, prints a summary, and exits non-zero if anything failed.
 *
 * Self-contained: needs only Node + Playwright's chromium. No Python, no
 * build step for the app itself.
 *
 * Run:  npm install && npx playwright install --with-deps chromium && npm test
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5179);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function ext(p) {
  const i = p.lastIndexOf('.');
  return i === -1 ? '' : p.slice(i).toLowerCase();
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    // Resolve within ROOT, reject path traversal.
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[ext(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

function listen() {
  return new Promise((res) => server.listen(PORT, '127.0.0.1', res));
}

async function main() {
  await listen();
  const url = `http://127.0.0.1:${PORT}/tests/`;
  console.log(`Serving ${ROOT} → ${url}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console.error]', m.text());
  });

  let exitCode = 1;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__testsDone === true, null, { timeout: 30000 });
    const out = await page.evaluate(() => ({ results: window.__testResults, error: window.__testError }));

    if (out.error) {
      console.error(`\nHarness error: ${out.error}`);
    } else {
      const { totalPassed, totalFailed, suites } = out.results;
      for (const s of suites) {
        const mark = s.failures.length ? 'FAIL' : 'ok  ';
        console.log(`${mark} ${s.name} (${s.passed}/${s.total})`);
        for (const f of s.failures) console.log(`       ✗ ${f.name}\n         ${f.message}`);
      }
      const total = totalPassed + totalFailed;
      console.log(`\n${totalFailed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} — ${totalPassed}/${total} passed`);
      exitCode = totalFailed === 0 ? 0 : 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
