/* ═══ Community-Geodaten · georeferenzierte Meldungen für den Routen-Copiloten ═══
 * Supabase (RLS, read-only). wl3-Grundgesetz: echte Daten, ehrlicher Stand.
 * Meldungen MIT Koordinaten werden nach Aktualität gewichtet, kategorie-spezifisch
 * gealtert (Decay) und veraltete abgewertet — gespiegelt aus dem Community-Feed. */
import { SB_URL, SB_KEY } from './auth';

export type ReportCat = 'gefahr' | 'hinweis' | 'liegeplatz' | 'erlebnis';
export interface GeoReport {
  id: string; category: ReportCat; title: string; body: string; place: string;
  lat: number; lon: number; confirms: number; status: string; created_at: string;
  ageH: number; weight: number; stale: boolean; confirmed: boolean;
}

/* TTL je Kategorie (Stunden) — identisch zur Feed-Badge-Logik (ui/community.ts) für konsistentes Verhalten. */
const TTL_H: Record<string, number> = { gefahr: 7 * 24, liegeplatz: 24, hinweis: 30 * 24, erlebnis: 30 * 24 };

let cache: { at: number; rows: GeoReport[] } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5-min-Client-Cache (Route + Copilot teilen sich eine Abfrage)

/* Recency-Gewicht 1→0 über die TTL + gedeckelter Bestätigungs-Bonus. stale = älter als TTL. */
function score(category: string, ageH: number, confirms: number): { weight: number; stale: boolean } {
  const ttl = TTL_H[category] ?? 30 * 24;
  const recency = Math.max(0, 1 - ageH / ttl);
  const confBonus = Math.min(0.5, (confirms || 0) * 0.15);
  return { weight: Math.max(0, recency + confBonus), stale: ageH > ttl };
}

/* Holt georeferenzierte Meldungen (mit Koordinaten) — anon-Lesezugriff, wie der Community-Feed. */
export async function fetchGeoReports(force = false): Promise<GeoReport[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  try {
    const url = `${SB_URL}/rest/v1/posts?select=id,category,title,body,place,lat,lon,confirms,status,created_at`
      + `&status=in.(live,confirmed)&lat=not.is.null&lon=not.is.null&order=created_at.desc&limit=200`;
    const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw 0;
    const raw = await r.json();
    const now = Date.now();
    const rows: GeoReport[] = (raw as any[]).map(p => {
      const ageH = (now - Date.parse(p.created_at)) / 36e5;
      const { weight, stale } = score(p.category, ageH, p.confirms);
      return { id: p.id, category: p.category, title: p.title || '', body: p.body || '', place: p.place || '',
        lat: +p.lat, lon: +p.lon, confirms: p.confirms || 0, status: p.status, created_at: p.created_at,
        ageH, weight, stale, confirmed: p.status === 'confirmed' || (p.confirms || 0) >= 3 };
    }).filter(p => isFinite(p.lat) && isFinite(p.lon));
    cache = { at: Date.now(), rows };
    return rows;
  } catch { return cache?.rows ?? []; }
}

export const getCachedReports = (): GeoReport[] => cache?.rows ?? [];

/* Menschliche Altersangabe für Lilly & Routenzusammenfassung */
export function relAge(ageH: number): string {
  if (ageH < 1) return 'vor wenigen Minuten';
  if (ageH < 24) return `vor ${Math.round(ageH)} Std.`;
  const d = Math.round(ageH / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}
