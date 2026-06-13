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
let lastRoute: RouteResult | null = null;

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
  /* „Licht auf Wasser" — heller, fließender Glanz, deutet die Fahrtrichtung an (start unsichtbar, animiert via startFlow) */
  map.addLayer({ id: 'wlroute-flow', type: 'line', source: 'wlroute',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#eafffe', 'line-width': 2.6, 'line-opacity': 0, 'line-blur': 0.6 } });
  /* Connector-Überbrückungen (Netzlücken) — gestrichelt & amber: KEIN exakter Wasserweg */
  map.addSource('wlroute-conn', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
  map.addLayer({ id: 'wlroute-conn', type: 'line', source: 'wlroute-conn',
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#E8B54D', 'line-width': 3, 'line-opacity': 0.95, 'line-dasharray': [1.4, 1.4] } });
}
function setRouteGeom(water: LngLat[][], conn: LngLat[][]) {
  const ml = (segs: LngLat[][]) => ({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segs }, properties: {} });
  (API!.map.getSource('wlroute') as maplibregl.GeoJSONSource | undefined)?.setData(ml(water) as any);
  (API!.map.getSource('wlroute-conn') as maplibregl.GeoJSONSource | undefined)?.setData(ml(conn) as any);
  if (water.length) startFlow(); else stopFlow();
}

/* ── „Licht auf Wasser": fließender Glanz entlang der Route + sanftes Atmen des Glows.
   Performant (Repaint nur bei Dash-Schrittwechsel ~11 fps) und reduced-motion-sicher. ── */
const FLOW_SEQ: number[][] = [
  [0,4,3],[0.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,0.5],[3,4,0],
  [0,0.5,3,3.5],[0,1,3,3],[0,1.5,3,2.5],[0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,0.5],
];
let flowRaf = 0; let flowStep = -1;
const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function startFlow() {
  stopFlow();
  if (!API || reduceMotion()) return;
  const map = API.map;
  try { map.setPaintProperty('wlroute-flow', 'line-opacity', 0.85); } catch { /* Layer noch nicht bereit */ }
  const tick = (ts: number) => {
    const step = Math.floor((ts / 90) % FLOW_SEQ.length);
    if (step !== flowStep) {
      flowStep = step;
      try {
        map.setPaintProperty('wlroute-flow', 'line-dasharray', FLOW_SEQ[step] as any);
        map.setPaintProperty('wlroute-glow', 'line-opacity', 0.32 + 0.13 * Math.sin(ts / 900));
      } catch { /* ignore */ }
    }
    flowRaf = requestAnimationFrame(tick);
  };
  flowRaf = requestAnimationFrame(tick);
}
function stopFlow() {
  if (flowRaf) { cancelAnimationFrame(flowRaf); flowRaf = 0; }
  flowStep = -1;
  try { API?.map.setPaintProperty('wlroute-flow', 'line-opacity', 0); } catch { /* ignore */ }
  try { API?.map.setPaintProperty('wlroute-glow', 'line-opacity', 0.35); } catch { /* ignore */ }
}

/* ── Captain-View · native MapLibre-3D-Kamera (Pitch-Neigung + Fahrtrichtung-oben) ── */
let captainOn = (() => { try { return localStorage.getItem('wl3_captain') === '1'; } catch { return false; } })();
function bearingOf(a: LngLat, b: LngLat): number {
  const toR = Math.PI/180, toD = 180/Math.PI;
  const y = Math.sin((b[0]-a[0])*toR) * Math.cos(b[1]*toR);
  const x = Math.cos(a[1]*toR)*Math.sin(b[1]*toR) - Math.sin(a[1]*toR)*Math.cos(b[1]*toR)*Math.cos((b[0]-a[0])*toR);
  return (Math.atan2(y, x)*toD + 360) % 360;
}
function routeBearing(): number {
  if (lastRoute && lastRoute.coords.length >= 2) { const c = lastRoute.coords; return bearingOf(c[0], c[c.length-1]); }
  if (A && B) return bearingOf(A, B);
  return API ? API.map.getBearing() : 0;
}
function updateViewBtn() {
  const btn = $('rtView'); if (!btn) return;
  btn.textContent = captainOn ? '🗺 Karte' : '🧭 Captain-View';
  btn.classList.toggle('on', captainOn);
  btn.setAttribute('aria-pressed', captainOn ? 'true' : 'false');
}
function applyCaptain(animate: boolean) {
  if (!API) return;
  const dur = (animate && !reduceMotion()) ? 900 : 0;
  API.map.easeTo({ pitch: captainOn ? 56 : 0, bearing: captainOn ? routeBearing() : 0, duration: dur });
  updateViewBtn();
}
/* GPS Course-Up: solange Captain-View an ist UND das Gerät einen echten Heading liefert (Handy in Bewegung),
   dreht sich die Karte sanft in die tatsächliche Fahrtrichtung — wie Apple-Navigation. Auf Desktop/ohne Heading
   bleibt es bei Route-oben (kein Eingriff). Ehrlich: nur bei vorhandenem GPS-Kurs. */
let courseWatch = 0; let lastCourseTs = 0;
function startCourseUp() {
  if (courseWatch || !navigator.geolocation || reduceMotion()) return;
  try {
    courseWatch = navigator.geolocation.watchPosition(p => {
      if (!API || !captainOn) return;
      const h = p.coords.heading, sp = p.coords.speed;
      if (h == null || isNaN(h) || (sp != null && sp < 0.5)) return;     // nur bei echtem Kurs/Bewegung
      const now = performance.now(); if (now - lastCourseTs < 700) return; // sanft throttlen
      lastCourseTs = now;
      API.map.easeTo({ bearing: h, pitch: 56, duration: 650 });
    }, () => {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
  } catch { courseWatch = 0; }
}
function stopCourseUp() {
  if (courseWatch && navigator.geolocation) { try { navigator.geolocation.clearWatch(courseWatch); } catch { /* ignore */ } }
  courseWatch = 0;
}
function toggleCaptain() {
  captainOn = !captainOn;
  try { localStorage.setItem('wl3_captain', captainOn ? '1' : '0'); } catch { /* ignore */ }
  applyCaptain(true);
  if (captainOn) startCourseUp(); else stopCourseUp();
  flashHint(captainOn ? '🧭 Captain-View: 3D, Fahrtrichtung oben — bei aktivem GPS-Kurs dreht die Karte mit.' : '🗺 Klassische Kartenansicht (Norden oben).');
}

/* ════════ Live-Copilot · Etappe H ════════
 * Mitlaufender Boots-Punkt + Cockpit + Lilly-Echtzeithinweise. Zwei Quellen:
 *   · Vorschau ("Tour abspielen"): fliegt die Route ab — auf Desktop & Mobil ohne GPS.
 *   · Live-GPS: watchPosition folgt der echten Fahrt (Fahrtrichtung-oben).
 * Hinweise kommen aus echten Daten: positionierte Schleusen (lockPts), ELWIS-Lage, Restweg/Ankunft.
 * Ehrlich: Vorschau ist eine Demo-/Planungsansicht, Live nutzt echtes GPS. */
type NavSource = 'preview' | 'live';
let navOn = false;
let navRaf = 0, navWatch = 0, navPrevTs = 0, navCamTs = 0;
let navS = 0, navTotM = 0, navSeg = 1; let navCum: number[] = []; let navCoords: LngLat[] = [];
let navPlayMps = 0;
let boat: maplibregl.Marker | null = null;
let speakOn = false; let lastHintKey = ''; let navSavedCam: any = null;

function navParam(coords: LngLat[]) {
  navCoords = coords; navCum = [0]; let t = 0;
  for (let i = 1; i < coords.length; i++) { t += haversineM(coords[i - 1], coords[i]); navCum.push(t); }
  navTotM = t;
}
function navPosAt(s: number): { pos: LngLat; brg: number } {
  const n = navCoords.length;
  if (n < 2) return { pos: navCoords[0] || [0, 0], brg: 0 };
  if (s <= 0) return { pos: navCoords[0], brg: bearingOf(navCoords[0], navCoords[1]) };
  if (s >= navTotM) return { pos: navCoords[n - 1], brg: bearingOf(navCoords[n - 2], navCoords[n - 1]) };
  if (navCum[navSeg] < s) { while (navSeg < n - 1 && navCum[navSeg] < s) navSeg++; }
  else { while (navSeg > 1 && navCum[navSeg - 1] > s) navSeg--; }
  const a = navCoords[navSeg - 1], b = navCoords[navSeg];
  const segLen = navCum[navSeg] - navCum[navSeg - 1];
  const tt = segLen > 0 ? (s - navCum[navSeg - 1]) / segLen : 0;
  return { pos: [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt], brg: bearingOf(a, b) };
}
function navNearestS(pos: LngLat): number {
  let best = Infinity, bi = 0;
  for (let i = 0; i < navCoords.length; i++) { const d = haversineM(pos, navCoords[i]); if (d < best) { best = d; bi = i; } }
  return navCum[bi] || 0;
}
function ensureBoat(): maplibregl.Marker {
  if (boat) return boat;
  const el = document.createElement('div'); el.className = 'nav-boat';
  el.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><defs><radialGradient id="nbG" cx="50%" cy="58%" r="60%"><stop offset="0%" stop-color="#bafcff"/><stop offset="100%" stop-color="#2ea7ad"/></radialGradient></defs><circle cx="20" cy="20" r="12" fill="rgba(63,195,201,.22)"/><path d="M20 3 L31 32 L20 25 L9 32 Z" fill="url(#nbG)" stroke="#eafffe" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  boat = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
  return boat;
}
function speak(t: string) {
  if (!speakOn || !t) return;
  try { const u = new SpeechSynthesisUtterance(t); u.lang = 'de-DE'; u.rate = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* TTS optional */ }
}
function toggleSpeak() {
  speakOn = !speakOn;
  const b = document.getElementById('nvSpeak'); if (b) { b.textContent = speakOn ? '🔊 Ansagen' : '🔈 Stumm'; b.classList.toggle('on', speakOn); }
  if (speakOn) speak('Sprachansagen aktiv.'); else { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
}
function navUI(create: boolean) {
  if (!API) return;
  const cont = API.map.getContainer();
  let wrap = document.getElementById('navHud');
  if (create && !wrap) {
    wrap = document.createElement('div'); wrap.id = 'navHud'; wrap.className = 'nav-hud';
    wrap.innerHTML = `
      <div class="nav-cockpit">
        <div class="nv"><span class="nv-k">Tempo</span><span class="nv-v" id="nvSpeed">–</span></div>
        <div class="nv"><span class="nv-k">Kurs</span><span class="nv-v" id="nvHead">–</span></div>
        <div class="nv"><span class="nv-k">Rest</span><span class="nv-v" id="nvRest">–</span></div>
        <div class="nv"><span class="nv-k">Ankunft</span><span class="nv-v" id="nvEta">–</span></div>
      </div>
      <div class="nav-lilly" id="nvLilly"><span class="nav-lilly-av">🧭</span><span id="nvHint">Lilly an Bord — gute Fahrt!</span></div>
      <div class="nav-ctrls">
        <button type="button" id="nvSpeak" class="nav-btn" title="Sprachansagen an/aus">🔈 Stumm</button>
        <button type="button" id="nvStop" class="nav-btn stop" title="Navigation beenden">⏹ Stopp</button>
      </div>`;
    cont.appendChild(wrap);
    document.getElementById('nvStop')?.addEventListener('click', stopNav);
    document.getElementById('nvSpeak')?.addEventListener('click', toggleSpeak);
    requestAnimationFrame(() => wrap?.classList.add('in'));
  } else if (!create && wrap) { wrap.remove(); }
}
function navHint(s: number): { key: string; html: string; say: string } {
  const r = lastRoute!; const restM = Math.max(0, navTotM - s);
  const ahead = (r.lockPts || []).map(l => ({ name: l.name, dM: l.km * 1000 - s })).filter(l => l.dM > -60).sort((a, b) => a.dM - b.dM)[0];
  if (ahead) {
    if (ahead.dM < 140) return { key: 'lock0:' + ahead.name, html: `🔒 <b>Schleuse ${E(ahead.name)}</b> — Schleusung, Wartebereich & Signal beachten.`, say: `Schleuse ${ahead.name}. Bitte Schleusung beachten.` };
    if (ahead.dM < 8000) { const dk = fmtKm(ahead.dM / 1000); return { key: 'lock:' + ahead.name + ':' + Math.round(ahead.dM / 300), html: `🔒 In <b>${dk}</b> Schleuse <b>${E(ahead.name)}</b>.`, say: `In ${dk}: Schleuse ${ahead.name}.` }; }
  }
  if (restM < 120) return { key: 'ziel', html: `🏁 <b>Ziel erreicht.</b> Gute Fahrt gehabt!`, say: 'Ziel erreicht. Gute Fahrt.' };
  if (restM < 900) { const dk = fmtKm(restM / 1000); return { key: 'near', html: `🏁 Ziel in <b>${dk}</b> — Anlegen vorbereiten.`, say: `Ziel in ${dk}. Anlegen vorbereiten.` }; }
  const dk = fmtKm(restM / 1000);
  return { key: 'go:' + Math.round(restM / 500), html: `➡️ Dem Verlauf folgen · Ziel in <b>${dk}</b>.`, say: '' };
}
function navUpdate(pos: LngLat, brg: number, s: number, realSpeedKmh: number | null) {
  if (!lastRoute) return;
  const restKm = Math.max(0, navTotM - s) / 1000;
  const remLocks = (lastRoute.lockPts || []).filter(l => l.km * 1000 > s + 80).length;
  const cruise = realSpeedKmh && realSpeedKmh > 1.5 ? realSpeedKmh : 9;
  const etaMin = restKm / cruise * 60 + remLocks * 20;
  const arr = new Date(Date.now() + etaMin * 60000);
  const set = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('nvSpeed', realSpeedKmh != null ? (realSpeedKmh >= 1 ? Math.round(realSpeedKmh) + ' km/h' : '0 km/h') : '~9 km/h');
  set('nvHead', Math.round((brg + 360) % 360) + '°');
  set('nvRest', fmtKm(restKm));
  set('nvEta', arr.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  const h = navHint(s);
  if (h.key !== lastHintKey) {
    lastHintKey = h.key;
    const el = document.getElementById('nvHint'); if (el) el.innerHTML = h.html;
    const lil = document.getElementById('nvLilly'); if (lil) { lil.classList.remove('pulse'); void (lil as HTMLElement).offsetWidth; lil.classList.add('pulse'); }
    speak(h.say);
  }
  ensureBoat().setLngLat(pos).setRotation((brg + 360) % 360);
  const now = performance.now();
  if (now - navCamTs > 200) { navCamTs = now; API!.map.easeTo({ center: pos, bearing: (brg + 360) % 360, pitch: 56, duration: 260, essential: true } as any); }
}
function previewTick(ts: number) {
  if (!navOn) return;
  if (!navPrevTs) navPrevTs = ts;
  const dt = Math.min(0.1, (ts - navPrevTs) / 1000); navPrevTs = ts;
  navS += navPlayMps * dt;
  const reached = navS >= navTotM;
  const { pos, brg } = navPosAt(Math.min(navS, navTotM));
  navUpdate(pos, brg, Math.min(navS, navTotM), null);
  if (reached) { finishNav(); return; }
  navRaf = requestAnimationFrame(previewTick);
}
function startLiveWatch() {
  if (!navigator.geolocation) { flashHint('GPS nicht verfügbar — nutze die Vorschau.'); return; }
  flashHint('🧭 Live-Navigation — die Karte folgt deiner Fahrt.');
  let lastPos: LngLat | null = null;
  navWatch = navigator.geolocation.watchPosition(p => {
    if (!navOn) return;
    const pos: LngLat = [p.coords.longitude, p.coords.latitude];
    let brg = p.coords.heading as number | null;
    if (brg == null || isNaN(brg)) brg = lastPos ? bearingOf(lastPos, pos) : navPosAt(navNearestS(pos)).brg;
    lastPos = pos;
    const spdKmh = p.coords.speed != null && !isNaN(p.coords.speed) ? p.coords.speed * 3.6 : null;
    navUpdate(pos, brg, navNearestS(pos), spdKmh);
  }, () => { flashHint('GPS-Signal fehlt gerade — Vorschau („Tour abspielen") nutzen?'); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}
function finishNav() {
  const el = document.getElementById('nvHint'); if (el) el.innerHTML = '🏁 <b>Ziel erreicht.</b> Gute Fahrt!';
  speak('Ziel erreicht. Gute Fahrt.');
  setTimeout(stopNav, 2600);
}
function startNav(source: NavSource) {
  if (!API || !lastRoute || lastRoute.coords.length < 2) { flashHint('Erst Start & Ziel setzen — dann „Tour abspielen".'); return; }
  stopNav();
  navOn = true;
  navParam(lastRoute.coords); navSeg = 1; navS = 0; lastHintKey = ''; navPrevTs = 0; navCamTs = 0;
  navSavedCam = { pitch: API.map.getPitch(), bearing: API.map.getBearing() };
  navUI(true);
  const start = navPosAt(0);
  ensureBoat().setLngLat(start.pos).setRotation((start.brg + 360) % 360).addTo(API.map);
  API.map.flyTo({ center: start.pos, zoom: 14, pitch: 56, bearing: (start.brg + 360) % 360, duration: 900, essential: true } as any);
  const ew = elwisOnRoute(lastRoute);
  setTimeout(() => {
    if (!navOn) return;
    if (ew.count > 0) { const el = document.getElementById('nvHint'); if (el) el.innerHTML = `⚠️ <b>${ew.count} ELWIS-Hinweis${ew.count > 1 ? 'e' : ''}</b> auf der Route — aufmerksam fahren.`; lastHintKey = 'elwis'; speak(`Achtung: ${ew.count} ELWIS Hinweis auf der Route.`); }
  }, 1000);
  if (source === 'preview') {
    const durSec = Math.min(30, Math.max(12, navTotM / 220));
    navPlayMps = navTotM / durSec;
    navRaf = requestAnimationFrame(previewTick);
    flashHint('▶ Vorschau läuft — so verläuft deine Tour.');
  } else { startLiveWatch(); }
}
function stopNav() {
  navOn = false;
  if (navRaf) { cancelAnimationFrame(navRaf); navRaf = 0; }
  if (navWatch && navigator.geolocation) { try { navigator.geolocation.clearWatch(navWatch); } catch { /* ignore */ } navWatch = 0; }
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  if (boat) { try { boat.remove(); } catch { /* ignore */ } boat = null; }
  navUI(false);
  lastHintKey = ''; navPrevTs = 0;
  if (API && navSavedCam) {
    if (captainOn) API.map.easeTo({ pitch: 56, bearing: navSavedCam.bearing, duration: 600 });
    else API.map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }
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
    if (!r) { renderSummary(null); setRouteGeom([], []); }
    else {
      setRouteGeom(r.waterSegs, r.connectorSegs);
      lastRoute = r;
      const b = r.coords.reduce((acc, c) => [Math.min(acc[0], c[0]), Math.min(acc[1], c[1]), Math.max(acc[2], c[0]), Math.max(acc[3], c[1])],
        [180, 90, -180, -90]);
      const fb: any = { padding: captainOn ? { top: 150, bottom: 90, left: 60, right: 60 } : 70, duration: 1200 };
      if (captainOn) { fb.pitch = 56; fb.bearing = bearingOf(r.coords[0], r.coords[r.coords.length - 1]); }
      API!.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], fb);
      renderSummary(r);
    }
  } catch (e) { console.error('Routing-Fehler', e); renderSummary(null); }
  finally { busy = false; if (hint) hint.textContent = 'Tippe Start (A) & Ziel (B) auf die Karte — oder nutze 📍 Standort.'; }
}

/* ELWIS-Sperrungen, die auf der berechneten Route liegen (Wasserstraße oder Schleuse) */
function elwisOnRoute(r: RouteResult): { html: string; count: number } {
  const doc = getNotices ? getNotices() : null; if (!doc) return { html: '', count: 0 };
  const ww = r.waterways.map(s => s.toLowerCase());
  const lk = r.locks.map(s => s.toLowerCase());
  const norm = (s: string) => (s || '').toLowerCase();
  const hits = doc.notices.filter(activeToday).filter(n => n.type !== 'yellow').filter(n => {
    const w = norm(n.waterway), txt = w + ' ' + norm(n.description);
    return ww.some(x => x.length > 4 && (w.includes(x) || x.includes(w) && w.length > 4))
      || lk.some(name => name.length > 5 && txt.includes(name.replace(/^schleuse\s+/, '')));
  });
  if (!hits.length) return { html: `<div class="rt-sum-row" style="color:var(--ok)">✅ Auf deiner Route aktuell keine ernsten ELWIS-Meldungen.</div>`, count: 0 };
  const ic = (t: string) => t === 'red' ? '🔴' : '🟠';
  const rows = hits.slice(0, 4).map(n => `<li>${ic(n.type)} <b>${E(n.waterway)}</b>: ${E(String(n.description || n.type_label).slice(0, 90))}${n.detail_url ? ` <a href="${E(n.detail_url)}" target="_blank" rel="noopener">ELWIS ›</a>` : ''}</li>`).join('');
  return { html: `<div class="rt-elwis"><b>⚠️ ${hits.length} ELWIS-Meldung${hits.length > 1 ? 'en' : ''} auf deiner Route:</b><ul>${rows}</ul></div>`, count: hits.length };
}
/* ── Nav 4D · Alles entlang der Route (POIs im Korridor + Sonnenuntergang) ── */
const ALONG_CATS: { key:string; label:string; icon:string; kinds:string[] }[] = [
  { key:'liegen',  label:'Häfen & Liegeplätze',  icon:'⚓',  kinds:['hafen','gelbe_welle','anleger'] },
  { key:'tank',    label:'Tanken',               icon:'⛽',  kinds:['tank'] },
  { key:'essen',   label:'Essen & Proviant',     icon:'🍽️', kinds:['gastro','shop'] },
  { key:'baden',   label:'Baden & Strände',      icon:'🏖️', kinds:['badestelle'] },
  { key:'sight',   label:'Sehenswürdigkeiten',   icon:'🏰',  kinds:['sight'] },
  { key:'service', label:'Service & Entsorgung', icon:'🛠️', kinds:['entsorgung','werkstatt','slip'] },
];
function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[1]-a[1])*toR, dLng = (b[0]-a[0])*toR;
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
  const x = s1*s1 + Math.cos(a[1]*toR)*Math.cos(b[1]*toR)*s2*s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function sunsetRow(): string {
  const w = (window as any).__wlw;
  return (w && w.sunset)
    ? `<div class="rt-sum-row">🌅 Sonnenuntergang heute <b>${E(w.sunset)}</b> — Ankunft vor der Dämmerung einplanen.</div>` : '';
}
interface AlongData { total: number; cats: { key:string; label:string; icon:string; count:number; top:string[] }[]; sights: string[]; }
/* POIs im ~1,5-km-Korridor um die Route, nach Kategorie gebündelt (Quelle: geladene Karten-POIs) */
function alongData(r: RouteResult): AlongData {
  const empty: AlongData = { total: 0, cats: [], sights: [] };
  if (!API) return empty;
  let feats: any[] = [];
  try { feats = API.features() || []; } catch { return empty; }
  const co = r.coords; if (!feats.length || co.length < 2) return empty;
  let minx=180, miny=90, maxx=-180, maxy=-90;
  for (const c of co){ if(c[0]<minx)minx=c[0]; if(c[0]>maxx)maxx=c[0]; if(c[1]<miny)miny=c[1]; if(c[1]>maxy)maxy=c[1]; }
  minx-=0.03; maxx+=0.03; miny-=0.02; maxy+=0.02;             // ~2 km Marge
  const step = Math.max(1, Math.floor(co.length / 400));
  const pts: LngLat[] = []; for (let i=0;i<co.length;i+=step) pts.push(co[i]); pts.push(co[co.length-1]);
  const kindToCat: Record<string, typeof ALONG_CATS[number]> = {};
  for (const c of ALONG_CATS) for (const k of c.kinds) kindToCat[k] = c;
  const buckets: Record<string, { name:string; dist:number }[]> = {};
  const CORRIDOR = 1500;
  for (const f of feats){
    const k = f.properties?.kind; const cat = kindToCat[k]; if (!cat) continue;
    const g = f.geometry; if (!g || g.type !== 'Point') continue;
    const ll = g.coordinates as LngLat;
    if (ll[0]<minx||ll[0]>maxx||ll[1]<miny||ll[1]>maxy) continue;
    let best = Infinity;
    for (const p of pts){ const d = haversineM(ll, p); if (d<best){ best=d; if (best<120) break; } }
    if (best > CORRIDOR) continue;
    if (!buckets[cat.key]) buckets[cat.key] = [];
    buckets[cat.key].push({ name: f.properties?.name || cat.label, dist: best });
  }
  let total = 0; const cats: AlongData['cats'] = [];
  for (const cat of ALONG_CATS){
    const arr = buckets[cat.key]; if (!arr || !arr.length) continue;
    arr.sort((a,b)=>a.dist-b.dist); total += arr.length;
    cats.push({ key: cat.key, label: cat.label, icon: cat.icon, count: arr.length, top: arr.slice(0,3).map(x=>x.name) });
  }
  const sights = buckets['sight'] ? buckets['sight'].slice().sort((a,b)=>a.dist-b.dist).map(x=>x.name) : [];
  return { total, cats, sights };
}
function renderAlong(d: AlongData): string {
  if (!d.total) return '';
  const parts = d.cats.map(c => `<li><span class="rt-al-ic">${c.icon}</span><b>${c.count}</b> ${E(c.label)}<span class="rt-al-top">${c.top.map(E).join(' · ')}${c.count>3?' …':''}</span></li>`);
  return `<div class="rt-along"><div class="rt-along-h">🧭 Entlang deiner Route <span class="rt-al-n">${d.total} Stopps im 1,5-km-Korridor</span></div><ul class="rt-along-list">${parts.join('')}</ul></div>`;
}
/* Lilly-Lotsin · ein Satz, der die Route zusammenfasst (inkl. ehrlicher Datenlücken-Hinweis) */
function lillyLine(r: RouteResult, d: AlongData, elwisN: number): string {
  const hin = elwisN > 0 ? `${elwisN} Hinweis${elwisN>1?'e':''}` : 'keine ernsten Hinweise';
  const high = d.sights.slice(0,2);
  const highTxt = high.length ? ` Unterwegs lohnen sich <b>${high.map(E).join('</b> &amp; <b>')}</b>.` : '';
  const connTxt = r.connectors > 0
    ? ` <span class="rt-lilly-warn">⚠️ ${r.connectors} Abschnitt${r.connectors>1?'e':''} sind <b>Datenlücken</b> (gestrichelt): dort fehlt im offenen Kartennetz eine saubere Wasserverbindung — bitte als grobe Orientierung verstehen, nicht als Navigation.</span>` : '';
  return `<div class="rt-lilly"><span class="rt-lilly-av">🧭</span><div class="rt-lilly-txt"><b>Lilly:</b> Diese Route ist <b>${fmtKm(r.distanceKm)}</b>, dauert ca. <b>${fmtMin(r.durationMin)}</b>, ${hin} und <b>${d.total}</b> mögliche Stopps.${highTxt}${connTxt}</div></div>`;
}
/* Kompakte Routen-Timeline: Start → Schleusen → Highlight → Liegeplätze → Sonnenuntergang → Ziel */
function timeline(r: RouteResult, d: AlongData): string {
  const w = (window as any).__wlw;
  const nodes: { ic:string; lab:string }[] = [{ ic:'🟢', lab:'Start' }];
  if (r.locks.length) nodes.push({ ic:'🚪', lab:`${r.locks.length} Schleuse${r.locks.length>1?'n':''}` });
  const sight = d.sights[0]; if (sight) nodes.push({ ic:'🏰', lab: sight.length>20?sight.slice(0,18)+'…':sight });
  const liegen = d.cats.find(c=>c.key==='liegen'); if (liegen) nodes.push({ ic:'⚓', lab:`${liegen.count} Liegeplätze` });
  if (w && w.sunset) nodes.push({ ic:'🌅', lab: w.sunset });
  nodes.push({ ic:'🏁', lab:'Ziel' });
  return `<div class="rt-tl">${nodes.map(n=>`<div class="rt-tl-n"><span class="rt-tl-ic">${n.ic}</span><span class="rt-tl-lab">${E(n.lab)}</span></div>`).join('<span class="rt-tl-sep">›</span>')}</div>`;
}
function renderSummary(r: RouteResult | null) {
  const el = $('routeSummary'); if (!el) return;
  lastRoute = r;
  el.hidden = false;
  if (!r) {
    el.innerHTML = `<div class="rt-sum-head">🚤 Keine durchgehende Wasser-Route gefunden</div>
      <p class="rt-sum-note">Start oder Ziel liegt zu weit von einer gemappten schiffbaren Wasserstraße entfernt, oder die Reviere sind nicht durchgehend verbunden. Setze die Punkte näher ans Wasser oder prüfe ein anderes Revier.</p>`;
    return;
  }
  const d = alongData(r); const ew = elwisOnRoute(r);
  const locks = r.locks.length
    ? `<div class="rt-sum-row">🚪 <b>${r.locks.length} Schleuse${r.locks.length > 1 ? 'n' : ''}</b> <span>${r.locks.map(E).join(' · ')}</span></div>` : '';
  const conn = r.connectors
    ? `<div class="rt-sum-row warn">⚠️ ${r.connectors} <b>gestrichelte</b> Verbindung${r.connectors > 1 ? 'en' : ''} überbrücken Lücken im Wasserwege-Netz — können über Land/offenes Wasser verlaufen und sind <b>kein exakter Wasserweg</b>. Dort Seekarte &amp; ELWIS prüfen.</div>` : '';
  const snap = (r.fromSnapM > 250 || r.toSnapM > 250)
    ? `<div class="rt-sum-row">📍 Einstieg ans Wasser: ~${r.fromSnapM} m ab Start · ~${r.toSnapM} m ab Ziel</div>` : '';
  const detourBad = r.detour > 4 && r.distanceKm > 25;
  const detour = detourBad
    ? `<div class="rt-sum-row warn">↩️ Großer Umweg (${fmtKm(r.distanceKm)} für ${fmtKm(r.crowKm)} Luftlinie): eine direkte Wasserverbindung in diesem Revier ist noch nicht vollständig erfasst. Die angezeigte Strecke kann unrealistisch lang sein — bitte mit Seekarte/ELWIS gegenprüfen.</div>` : '';
  el.innerHTML = `
    <div class="rt-sum-head">🚤 Route auf dem Wasser <span class="rt-beta">Beta</span></div>
    ${lillyLine(r, d, ew.count)}
    <div class="rt-sum-big"${detourBad ? ' style="opacity:.6"' : ''}><b>${fmtKm(r.distanceKm)}</b> · ~${fmtMin(r.durationMin)}
      <span class="rt-sum-sub">bei ~9 km/h inkl. ~20 min/Schleuse · Luftlinie ${fmtKm(r.crowKm)}</span></div>
    ${timeline(r, d)}
    ${detour}${ew.html}${sunsetRow()}${renderAlong(d)}${locks}${conn}${snap}
    <div class="rt-sum-acts">
      <button type="button" data-act="preview" class="rt-act rt-act-go" title="Tour als 3D-Vorschau abspielen — Boot fährt die Route ab">▶ Tour abspielen</button>
      <button type="button" data-act="live" class="rt-act" title="Live-Navigation mit GPS — Karte folgt deiner Fahrt (Fahrtrichtung oben)">🧭 Live</button>
      <button type="button" data-act="share" class="rt-act" title="Route als Link teilen">📤 Teilen</button>
      <button type="button" data-act="gpx" class="rt-act" title="Als GPX für Kartenplotter/Navi-App exportieren">⬇️ GPX</button>
    </div>
    <p class="rt-sum-note">Planungshilfe entlang gemappter schiffbarer Wege (OSM). <b>Keine Navigationsgrundlage</b> — verbindlich bleiben ELWIS-Meldungen, amtliche Fahrrinne & Befahrensregeln. Aktuelle Sperrungen siehe „Amtliche Lage".</p>`;
}

function clearRoute() {
  stopNav();
  A = B = null; pick = null;
  mA?.remove(); mB?.remove(); mA = mB = null;
  setRouteGeom([], []);
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

let netShown = false;
async function toggleNet() {
  if (!API) return; const map = API.map; const btn = document.getElementById('rtNet'); const hint = document.getElementById('rtHint');
  try {
    const g = await loadGraph();
    if (!map.getSource('wlnet')) {
      const feats = g.edges.map(e => ({ type:'Feature', properties:{ c: e[5]?1:0 }, geometry:{ type:'LineString', coordinates: e[3] } }));
      map.addSource('wlnet', { type:'geojson', data:{ type:'FeatureCollection', features: feats } as any });
      const before = map.getLayer('poi-halo') ? 'poi-halo' : undefined;
      map.addLayer({ id:'wlnet-line', type:'line', source:'wlnet',
        layout:{ 'line-cap':'round', 'line-join':'round', visibility:'none' },
        paint:{ 'line-color':['case',['==',['get','c'],1],'#D9B14D','#3FC3C9'] as any,
          'line-opacity':0.5,
          'line-width':['interpolate',['linear'],['zoom'],6,0.6,10,1.4,14,2.8] as any } }, before);
    }
    netShown = !netShown;
    map.setLayoutProperty('wlnet-line','visibility', netShown ? 'visible' : 'none');
    btn?.classList.toggle('on', netShown);
    if (hint) hint.textContent = netShown
      ? '≈ Schiffbares Netz eingeblendet (gold = verbindende Fahrrinnen-/Seeabschnitte).'
      : 'Tippe Start (A) & Ziel (B) auf die Karte — oder nutze 📍 Standort.';
  } catch { if (hint) hint.textContent = 'Wasserstraßennetz konnte nicht geladen werden.'; }
}

function flashHint(msg: string) {
  const hint = $('rtHint'); if (!hint) return;
  const prev = hint.textContent; hint.textContent = msg;
  setTimeout(() => { if (hint.textContent === msg) hint.textContent = prev || ''; }, 2600);
}

/** Teilbarer Deep-Link: A/B als Koordinaten in der URL. */
async function shareRoute() {
  if (!A || !B) return;
  const u = new URL(location.href.split('?')[0]);
  u.searchParams.set('a', `${A[0]},${A[1]}`);
  u.searchParams.set('b', `${B[0]},${B[1]}`);
  const url = u.toString();
  try { if ((navigator as any).share) { await (navigator as any).share({ title: 'Wasserlage · Wasser-Route', text: 'Geplante Route auf dem Wasser', url }); return; } } catch { /* abgebrochen */ }
  try { await navigator.clipboard.writeText(url); flashHint('🔗 Routen-Link kopiert — am Handy öffnen & weiterfahren.'); }
  catch { window.prompt('Routen-Link kopieren:', url); }
}

/** GPX-Export der berechneten Linie (für Kartenplotter / Navi-Apps). */
function exportGpx() {
  if (!lastRoute || !lastRoute.coords.length) return;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wpt = (ll: LngLat, name: string) => `  <wpt lat="${ll[1].toFixed(6)}" lon="${ll[0].toFixed(6)}"><name>${esc(name)}</name></wpt>\n`;
  const rtepts = lastRoute.coords.map(c => `    <rtept lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}"/>`).join('\n');
  const km = lastRoute.distanceKm.toFixed(1).replace('.', ',');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wasserlage (wavebite)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Wasserlage Wasser-Route</name><desc>${km} km · Planungshilfe entlang schiffbarer Wege. Verbindlich: ELWIS &amp; amtliche Fahrrinne.</desc></metadata>
${A ? wpt(A, 'Start (A)') : ''}${B ? wpt(B, 'Ziel (B)') : ''}  <rte>
    <name>Wasser-Route (${km} km)</name>
${rtepts}
  </rte>
</gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wasserlage-route.gpx'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  flashHint('⬇️ GPX gespeichert — in Kartenplotter oder Navi-App importieren.');
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
  $('rtNet')?.addEventListener('click', toggleNet);
  $('rtView')?.addEventListener('click', toggleCaptain);
  updateViewBtn();
  if (captainOn) { try { API.map.once('idle', () => applyCaptain(false)); } catch { applyCaptain(false); } }
  $('routeSummary')?.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]'); if (!t) return;
    const act = t.getAttribute('data-act');
    if (act === 'gpx') exportGpx(); else if (act === 'share') shareRoute();
    else if (act === 'preview') startNav('preview'); else if (act === 'live') startNav('live');
  });
  /* Geteilter Deep-Link ?a=lng,lat&b=lng,lat → Auto-Route */
  try {
    const sp = new URLSearchParams(location.search);
    const pa = sp.get('a'), pb = sp.get('b');
    if (pa && pb) {
      const av = pa.split(',').map(Number), bv = pb.split(',').map(Number);
      if (av.length === 2 && bv.length === 2 && av.every(isFinite) && bv.every(isFinite)) {
        loadGraph().then(() => {
          setSlot('A', [av[0], av[1]], 'Geteilter Start');
          setSlot('B', [bv[0], bv[1]], 'Geteiltes Ziel');
          document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }).catch(() => {});
      }
    }
  } catch { /* ignore */ }
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
