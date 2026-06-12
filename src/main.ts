/* ═══ WASSERLAGE 3.0 · Boot ═══ */
import './styles/app.css';
import { fetchNotices, fetchFT, fetchPegel, fetchWeather, activeToday } from './lib/live';
import { combine } from './lib/ampel';
import { initMap, addNoticeMarkers, KINDS, type MapAPI } from './map/map';
import { renderModes, MODES } from './ui/modes';
import { renderMeldungen, renderWetter, renderPegel } from './ui/dashboard';
import { initExplorer } from './ui/explorer';
import { initCommunity } from './ui/community';
import { renderSky, startSkyTicker } from './ui/sky';
import { initMelden } from './ui/melden';
import { initTouren } from './ui/touren';

function applyTod(sunrise?: string, sunset?: string) {
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes();
  const toM = (s?:string) => s ? +s.slice(0,2)*60 + +s.slice(3,5) : null;
  const sr = toM(sunrise) ?? 5*60, su = toM(sunset) ?? 21*60+30;
  document.documentElement.dataset.tod = (mins >= sr-30 && mins <= su+30) ? 'day' : 'night';
}
function setAmpel(state: { cls:string; text:string; detail:string }) {
  document.getElementById('ampel')!.innerHTML = `<span class="dot ${state.cls}"></span> ${state.text}`;
  document.getElementById('ampelSrc')!.textContent = state.detail + ' · Quellen: ELWIS · Pegelonline · Open-Meteo';
}
/* Klartext-Empfehlung — ehrlich, aus echten Daten abgeleitet */
function setReco(state:{cls:string}, doc:any, w:any) {
  const el = document.getElementById('heroReco')!;
  if (state.cls==='ok') { el.textContent = '✅ Heute spricht aus amtlicher Sicht nichts gegen eine Fahrt — Sperrungen auf der Route trotzdem unten prüfen.'; return; }
  const act = doc ? doc.notices.filter(activeToday).filter((n:any)=>n.type==='red') : [];
  const first = act[0];
  el.textContent = state.cls==='danger'
    ? `⚠️ Fahrt möglich, aber plane um: ${first ? first.waterway + ' — ' + String(first.description||'').slice(0,90) + '…' : 'aktive Sperrungen im Revier'} — Details unten.`
    : (w && w.bft>=4 ? '🟡 Frischer Wind — kleine Boote, SUP & Kajak heute mit Vorsicht.' : '🟡 Einschränkungen beachten — Details unten in der amtlichen Lage.');
}
function setChips(w: any, doc: any, ft: any) {
  const chips: string[] = [];
  if (w) chips.push(`💨 Wind ${w.bft} Bft ${w.dir}`, `🌅 ${w.sunrise}–${w.sunset} Uhr`, `🌡️ ${w.temp} °C`);
  if (doc) { const act = doc.notices.filter(activeToday); chips.push(`⚠️ ${act.filter((n:any)=>n.type!=='yellow').length} Einschränkungen heute`); }
  if (ft) chips.push(`⚓ FT Havel ${(ft.havel_min_cm/100).toFixed(2).replace('.',',')} m`);
  document.getElementById('heroChips')!.innerHTML = chips.map(c=>`<span class="chip">${c}</span>`).join('');
}
function renderLegend(api: MapAPI) {
  const el = document.getElementById('legend')!; el.innerHTML = '';
  KINDS.forEach(k => {
    const b = document.createElement('button');
    b.className = 'lg' + (api.activeKinds.has(k.kind) ? '' : ' off');
    b.innerHTML = `<span style="color:${k.color}">●</span> ${k.icon} ${k.label}`;
    b.onclick = () => { if (api.activeKinds.has(k.kind)) api.activeKinds.delete(k.kind); else api.activeKinds.add(k.kind);
      api.setKinds(api.activeKinds); b.classList.toggle('off'); };
    el.appendChild(b);
  });
}
function initSafety() {
  const btn = document.getElementById('sharePos');
  btn?.addEventListener('click', () => {
    if (!navigator.geolocation) { btn.innerHTML = '📍 Standort nicht verfügbar<small>Gerät unterstützt kein GPS</small>'; return; }
    btn.innerHTML = '📍 Position wird ermittelt …<small>GPS-Freigabe nötig</small>';
    navigator.geolocation.getCurrentPosition(p => {
      const la = p.coords.latitude.toFixed(5), lo = p.coords.longitude.toFixed(5);
      btn.innerHTML = `📍 ${la} N · ${lo} O<small>±${Math.round(p.coords.accuracy)} m — für die Leitstelle durchgeben</small>`;
    }, () => { btn.innerHTML = '📍 Position nicht verfügbar<small>GPS-Freigabe verweigert oder kein Empfang</small>'; },
    { enableHighAccuracy: true, timeout: 10000 });
  });
}

async function boot() {
  applyTod();
  initSafety();
  initCommunity();
  initTouren();
  initMelden(()=>setTimeout(initCommunity, 1200));
  renderSky(null);
  const mapP = initMap('map').catch(e => { console.error('Karte konnte nicht geladen werden', e); return null; });
  const [w, doc, ft] = await Promise.all([fetchWeather(), fetchNotices(), fetchFT()]);
  if (w) applyTod(w.sunrise, w.sunset);
  renderSky(w); startSkyTicker(()=>w);
  const state = combine(w, doc?.notices ?? null);
  setAmpel(state); setReco(state, doc, w); setChips(w, doc, ft);
  renderMeldungen(doc); renderWetter(w);
  fetch(`${import.meta.env.BASE_URL}data/pegel.json`).then(r=>r.json()).then(async (pj)=>{
    const uuids = pj.groups.flatMap((g:any)=>g.stations.map((s:any)=>s.uuid));
    renderPegel(await fetchPegel(uuids), ft);
  }).catch(()=>renderPegel([], ft));

  const api = await mapP;
  if (api) {
    renderModes(document.getElementById('modes')!, (m)=>{ api.setKinds(new Set(m.kinds)); renderLegend(api); });
    api.setKinds(new Set(MODES[0].kinds)); renderLegend(api);
    if (doc) { try { addNoticeMarkers(api, doc.notices.filter(activeToday).filter(n=>n.type!=='yellow')); } catch(e) { console.error(e); } }
    /* Explorer aus derselben Quelle wie die Karte */
    fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json()).then(fc => {
      initExplorer(fc.features, (lng,lat) => api.map.flyTo({ center:[lng,lat], zoom: 13.5, speed: 1.4 }));
    }).catch(e => console.error('Explorer-Daten nicht ladbar', e));
  } else {
    fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json()).then(fc => initExplorer(fc.features, ()=>{}));
  }
}
boot();
/* Wasserwelt: lazy nach erstem Render, kostet den Erstaufbau nichts */
setTimeout(() => { import('./ui/water3d').then(m => m.initWater3D()).catch(()=>{}); }, 1200);
