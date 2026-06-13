/* ═══ Live-Datenquellen · jede Antwort trägt Quelle + Stand (wl3-Grundgesetz: keine Fake-Live-Daten) ═══ */
const WL2 = 'https://voigtcarsten4-rgb.github.io/wasserlage/data'; // 2.0-Pipeline (GitHub Action, täglich) = aktuelle SoT für ELWIS

export interface Notice {
  type: 'red'|'orange'|'yellow'; type_label: string; waterway: string; wsa: string;
  reason: string; description: string; valid_from: string; valid_to: string;
  detail_url: string; notice_id: string;
}
export interface NoticesDoc { updated_de: string; notices: Notice[] }

export async function fetchNotices(): Promise<NoticesDoc|null> {
  try { const r = await fetch(`${WL2}/notices.json?ts=${Date.now()}`, { signal: AbortSignal.timeout(12000) }); return r.ok ? r.json() : null; }
  catch { return null; }
}
export async function fetchFT(): Promise<{updated_de:string; stand:string; havel_min_cm:number; items:any[]}|null> {
  const ts = Date.now();
  const base = (import.meta as any).env?.BASE_URL || '/';
  const grab = (u: string) => fetch(u, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : null).catch(() => null);
  /* Live-2.0-Feed (täglich, Havel/Oder frisch) + erweiterter Elbe–Oder-Datensatz (ft-de.json, mehr Strecken) zusammenführen */
  const [live, de] = await Promise.all([ grab(`${WL2}/ft.json?ts=${ts}`), grab(`${base}data/ft-de.json?ts=${ts}`) ]);
  if (!live && !de) return null;
  const norm = (s: string) => (s || '').toLowerCase().replace(/wasserstrasse|wasserstraße|wasserstr\.?/g, 'ws').replace(/[\s.\-(),]/g, '');
  const k = (i: any) => `${norm(i.abk || i.group)}|${norm(i.section)}`;
  const seen = new Set((live?.items || []).map(k));
  const items = [ ...(live?.items || []), ...((de?.items || []).filter((i: any) => !seen.has(k(i)))) ];
  const baseDoc = live || de;
  return { ...baseDoc, items, stand: live?.stand || de?.stand, havel_min_cm: baseDoc.havel_min_cm };
}

/* Pegelonline: EIN Aggregat-Call statt 27 Einzelrequests (Lehre aus 2.0-Audit) */
export interface Gauge { uuid:string; shortname:string; water:{shortname:string}; currentMeasurement?:{value:number; timestamp:string; stateMnwMhw?:string; stateNswHsw?:string} }
export async function fetchPegel(uuids: string[]): Promise<Gauge[]> {
  /* Pegelonline limitiert die ids-Liste → in Batches (≤20) parallel abrufen und mergen */
  const chunks: string[][] = [];
  for (let i = 0; i < uuids.length; i += 20) chunks.push(uuids.slice(i, i + 20));
  const out: Gauge[] = [];
  await Promise.all(chunks.map(async ch => {
    try {
      const r = await fetch(`https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?ids=${ch.join(',')}&includeCurrentMeasurement=true&includeTimeseries=true`, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) return;
      const all = await r.json();
      for (const s of all) out.push({ uuid:s.uuid, shortname:s.shortname, water:s.water,
        currentMeasurement: s.timeseries?.find((t:any)=>t.shortname==='W')?.currentMeasurement });
    } catch { /* Batch übersprungen */ }
  }));
  return out;
}

export interface Trend { dir:-1|0|1; delta:number; strong:boolean }
/* Trend je Pegel aus der ~8h-Messreihe (steigend/fallend/stabil) — nur für angezeigte Pegel aufrufen */
export async function fetchTrend(uuid:string): Promise<Trend|null> {
  try {
    const r = await fetch(`https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/${uuid}/W/measurements.json?start=PT8H`, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const m = await r.json();
    if (!Array.isArray(m) || m.length < 3) return null;
    const delta = Math.round(m[m.length-1].value - m[0].value);
    const dir: -1|0|1 = Math.abs(delta) < 3 ? 0 : (delta > 0 ? 1 : -1);
    return { dir, delta, strong: Math.abs(delta) >= 15 };
  } catch { return null; }
}

export interface Weather { bft:number; kmh:number; gust:number; dir:string; temp:number; code:number;
  sunrise:string; sunset:string; daily:any; fetched:string }
const DIRS = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const kmhToBft = (k:number) => { const b=[1,6,12,20,29,39,50,62,75,89,103,118]; for(let i=0;i<b.length;i++) if(k<b[i]) return i; return 12; };
export async function fetchWeather(lat=52.45, lon=13.35): Promise<Weather|null> {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max&forecast_days=7&timezone=Europe%2FBerlin`;
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) }); if (!r.ok) return null;
    const d = await r.json(); const c = d.current;
    return { bft: kmhToBft(c.wind_speed_10m), kmh: Math.round(c.wind_speed_10m), gust: Math.round(c.wind_gusts_10m),
      dir: DIRS[Math.round(c.wind_direction_10m/22.5)%16], temp: Math.round(c.temperature_2m), code: c.weather_code,
      sunrise: d.daily.sunrise[0].slice(11,16), sunset: d.daily.sunset[0].slice(11,16), daily: d.daily,
      fetched: new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) };
  } catch { return null; }
}

/* Nur HEUTE gültige Meldungen steuern die Ampel (2.0-Fix A2 portiert) */
const pD = (s:string) => { const m=/(\d{2})\.(\d{2})\.(\d{4})/.exec(s||''); return m? new Date(+m[3],+m[2]-1,+m[1]) : null; };
export function activeToday(n: Notice): boolean {
  const t = new Date(); t.setHours(12,0,0,0);
  const f = pD(n.valid_from), e = pD(n.valid_to);
  if (f && f > t) return false;
  if (e) { e.setHours(23,59,59,0); if (e < t) return false; }
  return true;
}
