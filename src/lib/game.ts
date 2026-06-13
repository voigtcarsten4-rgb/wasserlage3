/* ═══ Captain Academy · Brücke zum Wave-Bite-Water-Patrol-Spiel ═══
 * Das Spiel liegt (noch) als eigenes PWA auf GitHub Pages. Wir reichen die Captain-Pass-Identität
 * (geteilte device-id) weiter, damit Spiel-Fortschritt später demselben Pass gutgeschrieben werden
 * kann. Ehrlich: solange das Spiel nicht zurückschreibt, zeigt der Status „noch nicht synchronisiert". */
import { SB_URL, SB_KEY } from './auth';
import { device } from './points';

export const GAME_URL = 'https://voigtcarsten4-rgb.github.io/wave-bite-water-patrol/';

/* Bridged URL: from=wasserlage + geteilte device-id (+ optional Trainings-Mission). */
export function gameUrl(mission?: string): string {
  try {
    const u = new URL(GAME_URL);
    u.searchParams.set('from', 'wasserlage');
    u.searchParams.set('device', device());
    if (mission) u.searchParams.set('mission', mission);
    return u.toString();
  } catch { return GAME_URL; }
}

/* 5 Trainings-Missionen — jede verweist auf einen echten App-Bereich UND eine Spiel-Mission. */
export interface Mission { key: string; icon: string; title: string; desc: string; section: string }
export const GAME_MISSIONS: Mission[] = [
  { key: 'revierwissen', icon: '🧭', title: 'Revierwissen',      desc: 'Wasserstraßen, Reviere & Zeichen kennenlernen.', section: '#touren' },
  { key: 'navigation',   icon: '📐', title: 'Navigation üben',    desc: 'Kurs halten, Fahrrinne lesen, sicher ankommen.', section: '#karte' },
  { key: 'gefahren',     icon: '⚠️', title: 'Gefahren erkennen',  desc: 'Untiefen, Sog & Wellenschlag, Sperrungen.',      section: '#sicherheit' },
  { key: 'schleusen',    icon: '🚪', title: 'Schleusen verstehen', desc: 'Ein- & Ausfahren, Wartezeiten, Signale.',        section: '#karte' },
  { key: 'challenge',    icon: '🎯', title: 'Revier-Challenge',    desc: 'Wissen testen & Punkte für den Captain-Pass.',   section: '#community' },
];

export interface GameStatus { points: number; events: number; lastAt: string | null }
/* Best-effort: liest spiel-gewertete Punkte-Events (kind „game*") des geteilten device.
 * Liefert null bei fehlendem Zugriff → die UI zeigt dann den ehrlichen Vorbereitet-Hinweis. */
export async function fetchGameStatus(): Promise<GameStatus | null> {
  try {
    const did = encodeURIComponent(device());
    const url = `${SB_URL}/rest/v1/point_event?device=eq.${did}&kind=like.game*&select=points,created_at&order=created_at.desc&limit=200`;
    const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const points = rows.reduce((a: number, x: any) => a + (x.points || 0), 0);
    return { points, events: rows.length, lastAt: rows[0]?.created_at || null };
  } catch { return null; }
}
