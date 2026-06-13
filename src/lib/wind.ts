/* ═══ Lilly Wind-Intelligenz · zielgruppen-kalibrierte Marine-Windbewertung ═══
 * Ein erfahrener Skipper warnt eine SUP-Crew schon bei 4 Bft — das Hausboot erst bei 6.
 * Quelle: echtes Open-Meteo (__wlw). wl3-Grundgesetz: ohne Daten kein Urteil (keine Fake-Werte).
 * Ampel wie 2.0: 0 = Frei · 1 = Hinweis · 2 = Einschränkung. */
import type { Weather } from './live';

export type WindLvl = 0 | 1 | 2;
export interface WindAdvice {
  lvl: WindLvl;
  cls: 'ok' | 'hinweis' | 'warnung';
  label: string;   // Frei · Hinweis · Einschränkung
  short: string;   // kompakter Chip fürs Hero-Fokus
  text: string;    // Klartext (ohne HTML) für textContent-Kontexte
  html: string;    // Lilly-Satz mit Betonung
  say: string;     // ruhige TTS-Variante
}

/* Beaufort-Schwellen je Zielgruppe: [HinweisAb, EinschränkungAb] — marine-fachlich kalibriert. */
const TH: Record<string, [number, number]> = {
  sup: [3, 4], familie: [4, 5], angler: [4, 5], tourist: [4, 5], notfall: [4, 5],
  kapitaen: [5, 6], hausboot: [5, 6], charter: [5, 6], b2b: [5, 6],
};
const SMALL = new Set(['sup']);  // windempfindliche, kippelige Fahrzeuge (SUP & Kajak)

export function windAdvice(modeId: string, w: Weather): WindAdvice {
  const [hi, warn] = TH[modeId] || [5, 6];
  const b = w.bft, dir = w.dir, gust = Math.round(w.gust || 0);
  const gusty = gust >= Math.round(w.kmh) + 18 && gust >= 35;   // ausgeprägte Böenspitzen
  const lvl: WindLvl = b >= warn ? 2 : (b >= hi || (gusty && b >= hi - 1)) ? 1 : 0;
  const small = SMALL.has(modeId);
  const gT = gusty ? ` Böen bis ${gust} km/h.` : '';
  /* EHRLICH: nie behaupten „der Wind ist ablandig" (Uferlage unbekannt) — nur als Prüf-Erinnerung. */
  const abl = small ? ' Windrichtung am Ufer prüfen — ablandiger Wind treibt dich aufs offene Wasser.' : '';

  if (lvl === 0) return { lvl, cls: 'ok', label: 'Frei',
    short: `🟢 ${b} Bft ${dir} · gute Bedingungen`,
    text: `Wind ${b} Bft aus ${dir} — gute Bedingungen.`,
    html: `🟢 Wind <b>${b} Bft</b> aus ${dir} — gute Bedingungen.`,
    say: `Wind ${b} Beaufort aus ${dir}, gute Bedingungen.` };

  if (lvl === 1) {
    const v = small
      ? { short: `🌬️ ${b} Bft ${dir} · für SUP grenzwertig`,
          text: `Frischer Wind ${b} Bft aus ${dir} — für SUP & Kajak grenzwertig: kurze Etappen, ufernah bleiben.`,
          html: `🌬️ Frischer Wind <b>${b} Bft</b> aus ${dir} — für <b>SUP & Kajak</b> grenzwertig: kurze Etappen, ufernah bleiben.${gT}${abl}`,
          say: `Frischer Wind ${b} Beaufort. Für SUP und Kajak grenzwertig, ufernah bleiben.` }
      : { short: `🌬️ ${b} Bft ${dir} · vorausschauend fahren`,
          text: `Frischer Wind ${b} Bft aus ${dir} — vorausschauend fahren, beim Anlegen & Schleusen aufpassen.`,
          html: `🌬️ Frischer Wind <b>${b} Bft</b> aus ${dir} — vorausschauend fahren, beim Anlegen & Schleusen aufpassen.${gT}`,
          say: `Frischer Wind ${b} Beaufort. Beim Anlegen und Schleusen aufpassen.` };
    return { lvl, cls: 'hinweis', label: 'Hinweis', ...v };
  }

  const v = small
    ? { short: `⚠️ ${b} Bft · SUP heute ungeeignet`,
        text: `Kräftiger Wind ${b} Bft aus ${dir} — für SUP & Kajak heute ungeeignet. Besser an Land bleiben.`,
        html: `⚠️ Kräftiger Wind <b>${b} Bft</b> aus ${dir} — für <b>SUP & Kajak heute ungeeignet</b>. Besser an Land bleiben.${gT}${abl}`,
        say: `Achtung: ${b} Beaufort. Für SUP und Kajak heute ungeeignet, besser an Land bleiben.` }
    : { short: `⚠️ ${b} Bft · kleine Boote im Hafen`,
        text: `Starker Wind ${b} Bft aus ${dir} — kleine Boote im Hafen lassen; Anlegen & Schleusen nur mit Erfahrung.`,
        html: `⚠️ Starker Wind <b>${b} Bft</b> aus ${dir} — kleine Boote im Hafen lassen; Anlegen & Schleusen nur mit Erfahrung.${gT}`,
        say: `Achtung: starker Wind ${b} Beaufort. Kleine Boote besser im Hafen lassen.` };
  return { lvl, cls: 'warnung', label: 'Einschränkung', ...v };
}
