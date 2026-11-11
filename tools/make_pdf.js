// Pravi docs/Moonstack-wiki.pdf iz wiki/index.html (A4, svako poglavlje na novoj strani, slike kao JPEG).
// Pokretanje iz korena repoa:  python3 tools/build_print.py && node tools/make_pdf.js
// Pre toga pokreni lokalni server iz korena repoa:  python3 -m http.server 8765
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 1500 } });
  await p.goto('http://localhost:8765/build/print.html', { waitUntil: 'networkidle' });
  await p.evaluate(async () => { window.__printAll(); await document.fonts.ready; });
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'docs/Moonstack-wiki.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close();
})();
