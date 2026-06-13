/* ═══ Vorbereitete Datenmodelle (Phase 1) · optional ladbar, ehrlich gegated ═══
 * Diese Modelle liefern erst Inhalte, sobald echte Daten gepflegt sind — KEIN Fake.
 * Solange die JSON-Quellen leer sind, zeigt die App ehrlich „nicht hinterlegt". */

/* ── Schleusen-Betriebszeiten (Quelle: WSV/ELWIS, folgt). Datei darf leer sein. ── */
export interface LockHours { season?: string; times?: string; self_service?: boolean; note?: string; source?: string }
let lockHours: Record<string, LockHours> = {};
let lockHoursLoaded = false;
export async function loadLockHours(): Promise<void> {
  if (lockHoursLoaded) return; lockHoursLoaded = true;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/lock-hours.json`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); lockHours = j.hours || {}; }
  } catch { /* optional */ }
}
const normLock = (s: string) => (s || '').toLowerCase().replace(/^schleuse\s+/, '').replace(/[^a-zäöüß0-9]/g, '');
export function lockHoursFor(name: string): LockHours | null {
  const k = normLock(name); if (!k) return null;
  for (const key of Object.keys(lockHours)) if (normLock(key) === k) return lockHours[key];
  return null;
}
export const hasLockHours = () => Object.keys(lockHours).length > 0;

/* ── Erlaubte Geschwindigkeit je Wasserstraße/Abschnitt (Quelle: Befahrensregeln, folgt). ── */
export interface SpeedZone { match: string; kmh: number; note?: string }
let speedZones: SpeedZone[] = [];
let speedLoaded = false;
export async function loadSpeedZones(): Promise<void> {
  if (speedLoaded) return; speedLoaded = true;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/speed-zones.json`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); speedZones = j.zones || []; }
  } catch { /* optional */ }
}
export function speedForWaterways(wws: string[]): SpeedZone | null {
  for (const ww of wws) { const w = (ww || '').toLowerCase(); for (const z of speedZones) if (z.match && w.includes(z.match.toLowerCase())) return z; }
  return null;
}

/* ── Vorbereitete POI-Kategorien (Erlebnis-Ausbau): Copilot & Karte erkennen sie,
 *    sobald POIs mit diesen kinds existieren. Heute ohne Daten → unsichtbar, kein Fake. ── */
export interface PoiCatDef { kind: string; icon: string; label: string; prio: 1 | 2 | 3; group: string }
export const PREPARED_POI_CATS: PoiCatDef[] = [
  { kind: 'angelspot',   icon: '🎣', label: 'Angelspot',        prio: 3, group: 'erlebnis' },
  { kind: 'sunset',      icon: '🌅', label: 'Sonnenuntergang',  prio: 3, group: 'erlebnis' },
  { kind: 'cafe',        icon: '☕', label: 'Café am Wasser',    prio: 2, group: 'versorgung' },
  { kind: 'hundestrand', icon: '🐕', label: 'Hundestrand',      prio: 3, group: 'erlebnis' },
];
