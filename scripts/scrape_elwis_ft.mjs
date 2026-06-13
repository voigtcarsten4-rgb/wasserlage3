// Täglicher Headless-Scraper der ELWIS Fahrrinnen-/Tauchtiefen (zwischen Elbe und Oder).
// Läuft in GitHub Actions (Playwright/Chromium). Schreibt public/data/ft-de.json.
import fs from 'fs';
import { chromium } from 'playwright';

const revierOf = (g) => /Elbe|Rothenseer/.test(g) ? 'elbe' : /Saale/.test(g) ? 'saale' : /Havel/.test(g) ? 'havel' : /Hohensaaten|Schwedt|Oder|Querfahrt/.test(g) ? 'oder' : 'sonstige';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (compatible; WaveBiteWasserlage/1.0)' });
  await page.goto('https://www.elwis.de/DE/dynamisch/Ft/Start', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
    page.evaluate(() => { const b = [...document.querySelectorAll('button,input[type=submit]')].find(x => /suchen/i.test(x.textContent || x.value || '')); if (b) b.click(); }),
  ]);
  await page.waitForTimeout(2500);
  const raw = await page.evaluate(() => {
    const tb = [...document.querySelectorAll('table')].find(t => /F\/T/.test(t.textContent) && t.querySelectorAll('tr').length > 5);
    if (!tb) return [];
    const rows = [...tb.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim())).filter(r => r.some(x => x));
    const out = []; let water = '';
    for (const r of rows) {
      if (r.length === 1 && /\(/.test(r[0])) { water = r[0]; continue; }
      if (r.length >= 4 && /^(F|T)$/.test(r[2]) && /^\d+$/.test(r[3])) out.push([water, r[1], r[2], +r[3]]);
    }
    return out;
  });
  if (!raw.length) throw new Error('Keine F/T-Zeilen gefunden — ELWIS-Struktur geändert?');
  const items = raw.map(([w, strecke, kind, cm]) => {
    const abk = (w.match(/\(([^)]+)\)/) || [])[1] || '';
    const group = w.replace(/\s*\([^)]+\)\s*$/, '');
    return { revier: revierOf(w), group, abk, section: strecke, kind, value: String(cm), subs: [], status: 'ok', sev: 'ok', cm };
  });
  const havelF = items.filter(i => i.group.includes('Havel') && i.kind === 'F').map(i => i.cm);
  const now = new Date();
  const doc = {
    updated_de: now.toLocaleString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr',
    stand: now.toLocaleDateString('de-DE') + ', ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
    source: 'ELWIS — Fahrrinnen-/Tauchtiefen zwischen Elbe und Oder',
    region: 'Elbe–Oder (BB/Ost)',
    havel_min_cm: havelF.length ? Math.min(...havelF) : null,
    items,
  };
  fs.writeFileSync('public/data/ft-de.json', JSON.stringify(doc));
  console.log('ft-de.json aktualisiert:', items.length, 'Abschnitte');
} finally { await browser.close(); }
