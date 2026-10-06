// Headless browser check of the built page: loads site/index.html, waits, and checks that it runs cleanly.
//   npm run test:site        (needs the dev dependency: npm ci && npx playwright install chromium)
import { chromium } from "playwright";
import assert from "node:assert/strict";

const url = new URL("../site/index.html", import.meta.url).href;
const browser = await chromium.launch();
const errors = [];
try {
  for (const width of [360, 400, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (e) => errors.push(`${width}px: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push(`${width}px: ${m.text()}`); });
    await page.goto(url);
    await page.waitForTimeout(2000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${width}px: page is ${overflow}px wider than the viewport`);
    if (width === 1440) {
      // poke the brain and check that neurons light up
      await page.click('#stimButtons [data-stim="touch-tail"]');
      await page.waitForTimeout(1500);
      const active = Number(await page.textContent("#heroActive"));
      assert.ok(active > 0, `no active neurons after a stimulus (${active})`);
      // the compare panel runs a second brain on shuffled wiring
      await page.click("#cmpToggle");
      await page.waitForTimeout(800);
      assert.equal(await page.isVisible("#cmp"), true);
      // the genome maps are drawn on load from the inlined data
      assert.equal(await page.locator("#chroms canvas").count(), 12);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("site smoke test passed at 360, 400, 768 and 1440 px");
} finally {
  await browser.close();
}
