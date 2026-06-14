/* ═══ Captain Depth Score · ehrliche Heuristik aus echten Signalen ═══
 * Reine Funktion: kein DOM, kein Fetch. Verdichtet Tiefe + Wind + Sperrungen + Pegel
 * zu einem nachvollziehbaren 0–100-Score (mit Treiber-Aufschlüsselung + Klartext-Verdikt).
 * wl3-Grundgesetz: jeder Punkt stammt aus echten Daten; verbindlich bleibt ELWIS.
 * Bewusst KEINE Black-Box-„KI": die Treiber-Notes machen jede Zahl nachvollziehbar. */

export type Lvl = 0 | 1 | 2;
export interface DepthDriver { key: 'tiefe' | 'wind' | 'sperrung' | 'pegel'; label: string; lvl: Lvl; note: string }
export interface DepthScore {
  score: number;            // 0–100
  stars: number;            // 1–5
  cls: 'ok' | 'warn' | 'bad';
  headline: string;         // kurzes Urteil
  verdict: string;          // ganzer Klartextsatz
  drivers: DepthDriver[];   // transparente Aufschlüsselung
  dist: { ok: number; tight: number; bad: number; total: number };
}

export interface DepthScoreInput {
  draftCm: number;          // Tiefgang des Bootes (cm)
  recCm: number;            // empfohlene Kielreserve (cm)
  depthsCm: number[];       // gemeldete ELWIS-Tiefen im aktuellen Scope (cm)
  scopeLabel: string;       // z. B. „Untere Havel" oder „alle gemeldeten Reviere"
  wind?: { lvl: Lvl; text: string } | null;                                   // aus windAdvice (zielgruppen-kalibriert)
  closures?: { count: number; severe: boolean; first?: string } | null;       // ELWIS-Sperrungen auf der Strecke
  pegel?: { dir: -1 | 0 | 1; delta: number; strong: boolean; station: string } | null; // Pegel-Trend (Pegelonline)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const m = (cm: number) => (cm / 100).toFixed(2).replace('.', ',') + ' m';

export function captainDepthScore(inp: DepthScoreInput): DepthScore {
  const drivers: DepthDriver[] = [];
  const depths = inp.depthsCm.filter((d) => Number.isFinite(d));
  const rec = Math.max(1, inp.recCm);

  /* ── Tiefe (Primärtreiber) — Verteilung der Kielfreiheit über alle gemeldeten Abschnitte ── */
  let base = 60;
  let tLvl: Lvl = 1;
  let tNote = 'Aktuell keine Tiefen gemeldet — Score nur eingeschränkt.';
  const clears = depths.map((d) => d - inp.draftCm);
  const total = clears.length;
  const okN = clears.filter((c) => c >= rec).length;
  const tightN = clears.filter((c) => c >= 0 && c < rec).length;
  const badN = clears.filter((c) => c < 0).length;
  if (total) {
    const minClear = Math.min(...clears);
    const minDepth = Math.min(...depths);
    if (badN > 0) {
      const deficit = -minClear; // cm, die fehlen
      base = clamp(38 - deficit * 0.45 - (badN / total) * 12, 4, 40);
      tLvl = 2;
      tNote = `${badN} von ${total} Abschnitten zu flach — engste Stelle ${m(minDepth)} (${deficit} cm zu wenig).`;
    } else if (tightN > 0) {
      base = clamp(56 + (minClear / rec) * 22 - (tightN / total) * 8, 50, 80);
      tLvl = 1;
      tNote = `Machbar, aber eng — engste Stelle ${m(minDepth)}, nur ${minClear} cm Reserve (empf. ${rec}).`;
    } else {
      base = clamp(88 + Math.min(12, (minClear - rec) * 0.35), 86, 100);
      tLvl = 0;
      tNote = `Alle ${total} gemeldeten Abschnitte mit Reserve frei — knappste ${m(minDepth)} (${minClear} cm frei).`;
    }
  }
  drivers.push({ key: 'tiefe', label: 'Tiefe', lvl: tLvl, note: tNote });

  /* ── Wind (zielgruppen-kalibriert, aus windAdvice) ── */
  let windPen = 0;
  if (inp.wind) {
    windPen = inp.wind.lvl === 2 ? 18 : inp.wind.lvl === 1 ? 8 : 0;
    drivers.push({ key: 'wind', label: 'Wind', lvl: inp.wind.lvl, note: inp.wind.text });
  }

  /* ── ELWIS-Sperrungen auf dem Gewässer ── */
  let closePen = 0;
  if (inp.closures && inp.closures.count > 0) {
    const lvl: Lvl = inp.closures.severe ? 2 : 1;
    closePen = inp.closures.severe ? 22 : 10;
    drivers.push({
      key: 'sperrung', label: 'Sperrungen', lvl,
      note: `${inp.closures.count} ELWIS-Meldung${inp.closures.count > 1 ? 'en' : ''} auf der Strecke${inp.closures.first ? ' — ' + inp.closures.first : ''}.`,
    });
  }

  /* ── Pegel-Trend (Pegelonline) — fallend = Fahrrinnentiefe sinkt ── */
  let pegelPen = 0;
  if (inp.pegel) {
    const { dir, delta, strong, station } = inp.pegel;
    if (dir < 0) {
      const lvl: Lvl = strong ? 1 : 0;
      pegelPen = strong ? 10 : 3;
      drivers.push({ key: 'pegel', label: 'Pegel', lvl, note: `${station} fällt (${delta} cm/8 h) — Fahrrinnentiefe kann sinken.` });
    } else if (dir > 0) {
      drivers.push({ key: 'pegel', label: 'Pegel', lvl: 0, note: `${station} steigt (+${delta} cm/8 h) — entspannt.` });
    } else {
      drivers.push({ key: 'pegel', label: 'Pegel', lvl: 0, note: `${station} stabil.` });
    }
  }

  const score = clamp(Math.round(base - windPen - closePen - pegelPen), 0, 100);
  const stars = score >= 90 ? 5 : score >= 74 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
  const cls: 'ok' | 'warn' | 'bad' = score >= 70 ? 'ok' : score >= 45 ? 'warn' : 'bad';

  /* ── Klartext-Verdikt: führt mit der Tiefe, hängt den stärksten Negativ-Treiber an ── */
  const sc = inp.scopeLabel;
  const headline = tLvl === 2 ? 'Kritisch' : tLvl === 1 ? 'Mit Vorsicht' : 'Gute Bedingungen';
  let verdict: string;
  if (!total) verdict = `Keine ELWIS-Tiefen für ${sc} gemeldet — bitte Originalmeldung prüfen.`;
  else if (tLvl === 2) verdict = `Mit ${m(inp.draftCm)} Tiefgang auf ${sc} teils zu flach.`;
  else if (tLvl === 1) verdict = `Auf ${sc} machbar, aber eng.`;
  else verdict = `Auf ${sc} bei den gemeldeten Tiefen gut befahrbar.`;
  const neg = drivers.filter((d) => d.key !== 'tiefe' && d.lvl >= 1).sort((a, b) => b.lvl - a.lvl)[0];
  if (neg) verdict += ` ${neg.note}`;
  else if (tLvl === 0) verdict += ' Wind und Lage unkritisch.';

  return { score, stars, cls, headline, verdict, drivers, dist: { ok: okN, tight: tightN, bad: badN, total } };
}
