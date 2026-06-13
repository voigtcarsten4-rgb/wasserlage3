/* ═══ Wasser-Route 3.0 · UI über der Karte ═══
 * A/B per Karten-Tap oder GPS → Dijkstra (routing.ts) → Linie + Summary.
 * EHRLICH: Planungshilfe entlang schiffbarer Wege. Verbindlich: ELWIS & amtliche Fahrrinne. */
import maplibregl from 'maplibre-gl';
import type { MapAPI } from '../map/map';
import { route, loadGraph, graphMeta, type LngLat, type RouteResult } from '../lib/routing';
import { activeToday, type Notice } from '../lib/live';

let API: MapAPI | null = null;
let getNotices: (() => { notices: Notice[] } | null) | null = null;
let A: LngLat | null = null, B: LngLat | null = null;
let mA: maplibregl.Marker | null = null, mB: maplibregl.Marker | null = null;
let pick: 'A' | 'B' | null = null;
let busy = false;

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const fmtKm = (k: number) => k < 10 ? k.toFixed(1).replace('.', ',') + ' km' : Math.round(k) + ' km';
const fmtMin = (m: number) => { m = Math.round(m); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h} h ${mm} min` : `${mm} min`; };
const $ = (id: string) => document.getElementById(id);

function ensureLayers(map: maplibregl.Map) {
  if (map.getSource('wlroute')) return;
  map.addSource('wlroute', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
  map.addLayer({ id: 'wlroute-casing', type: 'line', source: 'wlroute',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#04121f', 'line-width': 9, 'line-opacity': 0.45, 'line-blur': 1.5 } });
  map.addLayer({ id: 'wlroute-glow', type: 'line', source: 'wlroute',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#9fe9ef', 'line-width': 9, 'line-opacity': 0.35, 'line-blur': 3 } });
  map.addLayer({ id: 'wlroute-line', type: 'line', source: 'wlroute',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3FC3C9', 'line-width': 4.5 } });
}
function setLine(coords: LngLat[]) {
  const src = API!.map.getSource('wlroute') as maplibregl.GeoJSONSource | undefined;
  src?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} } as any);
}

function marker(slot: 'A' | 'B', ll: LngLat) {
  const color = slot === 'A' ? '#27c08d' : '#D9B14D';
  const m = new maplibregl.Marker({ color }).setLngLat(ll).addTo(API!.map);
  if (slot === 'A') { mA?.remove(); mA = m; } else { mB?.remove(); mB = m; }
}
function setSlot(slot: 'A' | 'B', ll: LngLat, label?: string) {
  if (slot === 'A') A = ll; else B = ll;
  marker(slot, ll);
  const t = $(slot === 'A' ? 'rtAtxt' : 'rtBtxt');
  if (t) t.textContent = label || `${ll[1].toFixed(4)}, ${ll[0].toFixed(4)}`;
  const cl = $('rtClear'); if (cl) cl.hidden = false;
  if (A && B) compute();
}

async function compute() {
  if (!A || !B || busy) return;
  busy = true;
  const hint = $('rtHint'); if (hint) hint.textContent = '⏳ Berechne Wasser-Route …';
  ensureLayers(API!.map);
  try {
    const r = await route(A, B);
    if (!r) { renderSummary(null); setLine([]); }
    else {
      setLine(r.coords);
      const b = r.coords.reduce((acc, c) => [Math.min(acc[0], c[0]), Math.min(acc[1], c[1]), Math.max(acc[2], c[0]), Math.max(acc[3], c[1])],
        [180, 90, -180, -90]);
      API!.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, duration: 1200 });
      renderSummary(r);
    }
  } catch (e) { console.error('Routing-Fehler', e); renderSummary(null); }
  finally { busy = false; if (hint) hint.textContent = 'Tippe Start (A) & Ziel (B) auf die Karte — oder nutze 📍 Standort.'; }
}

/* ELWIS-Sperrungen, die auf der berechneten Route liegen (Wasserstraße oder Schleuse) */
function elwisOnRoute(r: RouteResult): string {
  const doc = getNotices ? getNotices() : null; if (!doc) return '';
  const ww = r.waterways.map(s => s.toLowerCase());
  const lk = r.locks.map(s => s.toLowerCase());
  const norm = (s: string) => (s || '').toLowerCase();
  const hits = doc.notices.filter(activeToday).filter(n => n.type !== 'yellow').filter(n => {
    const w = norm(n.waterway), txt = w + ' ' + norm(n.description);
    return ww.some(x => x.length > 4 && (w.includes(x) || x.includes(w) && w.length > 4))
      || lk.some(name => name.length > 5 && txt.includes(name.replace(/^schleuse\s+/, '')));
  });
  if (!hits.length) return `<div class="rt-sum-row" style="color:var(--ok)">✅ Auf deiner Route aktuell keine ernsten ELWIS-Meldungen.</div>`;
  const ic = (t: string) => t === 'red' ? '🔴' : '🟠';
  const rows = hits.slice(0, 4).map(n => `<li>${ic(n.type)} <b>${E(n.waterway)}</b>: ${E(String(n.description || n.type_label).slice(0, 90))}${n.detail_url ? ` <a href="${E(n.detail_url)}" target="_blank" rel="noopener">ELWIS ›</a>` : ''}</li>`).join('');
  return `<div class="rt-elwis"><b>⚠️ ${hits.length} ELWIS-Meldung${hits.length > 1 ? 'en' : ''} auf deiner Route:</b><ul>${rows}</ul></div>`;
}
function renderSummary(r: RouteResult | null) {
  const el = $('routeSummary'); if (!el) return;
  el.hidden = false;
  if (!r) {
    el.innerHTML = `<div class="rt-sum-head">🚤 Keine durchgehende Wasser-Route gefunden</div>
      <p class="rt-sum-note">Start oder Ziel liegt zu weit von einer gemappten schiffbaren Wasserstraße entfernt, oder die Reviere sind nicht durchgehend verbunden. Setze die Punkte näher ans Wasser oder prüfe ein anderes Revier.</p>`;
    return;
  }
  const locks = r.locks.length
    ? `<div class="rt-sum-row">🚪 <b>${r.locks.length} Schleuse${r.locks.length > 1 ? 'n' : ''}</b> <span>${r.locks.map(E).join(' · ')}</span></div>` : '';
  const conn = r.connectors
    ? `<div class="rt-sum-row warn">⚠️ ${r.connectors} verbindende${r.connectors > 1 ? '' : 'r'} See-/Fahrrinnenabschnitt — Verlauf vereinfacht, Fahrrinne vor Ort prüfen.</div>` : '';
  const snap = (r.fromSnapM > 250 || r.toSnapM > 250)
    ? `<div class="rt-sum-row">📍 Einstieg ans Wasser: ~${r.fromSnapM} m ab Start · ~${r.toSnapM} m ab Ziel</div>` : '';
  const detourBad = r.detour > 4 && r.distanceKm > 25;
  const detour = detourBad
    ? `<div class="rt-sum-row warn">↩️ Großer Umweg (${fmtKm(r.distanceKm)} für ${fmtKm(r.crowKm)} Luftlinie): eine direkte Wasserverbindung in diesem Revier ist noch nicht vollständig erfasst. Die angezeigte Strecke kann unrealistisch lang sein — bitte mit Seekarte/ELWIS gegenprüfen.</div>` : '';
  el.innerHTML = `
    <div class="rt-sum-head">🚤 Route auf dem Wasser <span class="rt-beta">Beta</span></div>
    <div class="rt-sum-big"${detourBad ? ' style="opacity:.6"' : ''}><b>${fmtKm(r.distanceKm)}</b> · ~${fmtMin(r.durationMin)}
      <span class="rt-sum-sub">bei ~9 km/h inkl. ~20 min/Schleuse · Luftlinie ${fmtKm(r.crowKm)}</span></div>
    ${detour}${elwisOnRoute(r)}${locks}${conn}${snap}
    <p class="rt-sum-note">Planungshilfe entlang gemappter schiffbarer Wege (OSM). <b>Keine Navigationsgrundlage</b> — verbindlich bleiben ELWIS-Meldungen, amtliche Fahrrinne & Befahrensregeln. Aktuelle Sperrungen siehe „Amtliche Lage".</p>`;
}

function clearRoute() {
  A = B = null; pick = null;
  mA?.remove(); mB?.remove(); mA = mB = null;
  setLine([]);
  const s = $('routeSummary'); if (s) s.hidden = true;
  const at = $('rtAtxt'); if (at) at.textContent = 'Start setzen';
  const bt = $('rtBtxt'); if (bt) bt.textContent = 'Ziel setzen';
  const cl = $('rtClear'); if (cl) cl.hidden = true;
  document.querySelectorAll('.rt-pt').forEach(b => b.classList.remove('active'));
  const hint = $('rtHint'); if (hint) hint.textContent = 'Tippe Start (A) & Ziel (B) auf die Karte — oder nutze 📍 Standort.';
}

/** Von der Ziel-Sektion aufgerufen: Ziel setzen, zur Karte scrollen, Start anbieten. */
export function setRouteDestination(ll: LngLat, name?: string) {
  if (!API) return;
  loadGraph().catch(() => {});
  setSlot('B', ll, name);
  document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!A) {
    const hint = $('rtHint');
    if (hint) hint.textContent = '📍 Tippe „Mein Standort" oder den Startpunkt auf die Karte.';
    tryGeo(true);
  }
}

function tryGeo(silent = false) {
  if (!navigator.geolocation) { if (!silent) alert('GPS auf diesem Gerät nicht verfügbar.'); return; }
  const geo = $('rtGeo'); if (geo) geo.textContent = '📍 …';
  navigator.geolocation.getCurrentPosition(
    p => { setSlot('A', [p.coords.longitude, p.coords.latitude], 'Mein Standort'); if (geo) geo.textContent = '📍 Mein Standort'; },
    () => { if (geo) geo.textContent = '📍 Mein Standort'; if (!silent) alert('Standort nicht verfügbar — tippe den Start auf die Karte.'); },
    { enableHighAccuracy: true, timeout: 9000 });
}

export function initRoute(api: MapAPI, noticesProvider?: () => { notices: Notice[] } | null) {
  API = api;
  getNotices = noticesProvider || null;
  const bar = $('routeBar'); if (!bar) return;
  bar.querySelectorAll<HTMLButtonElement>('.rt-pt').forEach(b => b.addEventListener('click', () => {
    pick = (b.dataset.slot as 'A' | 'B');
    bar.querySelectorAll('.rt-pt').forEach(x => x.classList.toggle('active', x === b));
    const hint = $('rtHint'); if (hint) hint.textContent = `Tippe den ${pick === 'A' ? 'Start (A)' : 'Ziel (B)'}-Punkt auf die Karte.`;
  }));
  $('rtGeo')?.addEventListener('click', () => tryGeo(false));
  $('rtClear')?.addEventListener('click', clearRoute);
  api.map.on('click', (e) => {
    if (!pick) return;
    const ll: LngLat = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    const slot = pick; pick = null;
    bar.querySelectorAll('.rt-pt').forEach(x => x.classList.remove('active'));
    setSlot(slot, ll);
  });
  /* Graph vorladen sobald die Karte sichtbar ist (spart Wartezeit beim ersten Routen) */
  const obs = new IntersectionObserver((ents) => {
    if (ents.some(en => en.isIntersecting)) { loadGraph().then(() => {
      const m = graphMeta(); const hint = $('rtHint');
      if (m && hint && !A && !B) hint.textContent = `Tippe Start (A) & Ziel (B) — ${Math.round(m.network_km)} km schiffbares Netz, ${m.locks} Schleusen geladen.`;
    }).catch(() => {}); obs.disconnect(); }
  });
  const mapEl = document.getElementById('karte'); if (mapEl) obs.observe(mapEl);
}
