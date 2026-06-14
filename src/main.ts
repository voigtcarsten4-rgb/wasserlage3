/* ═══ WASSERLAGE 3.0 · Boot ═══ */
import './styles/app.css';
import { fetchNotices, fetchNoticesDE, fetchFT, fetchPegel, fetchWeather, activeToday } from './lib/live';
import { combine } from './lib/ampel';
import { windAdvice } from './lib/wind';
import { initMap, addNoticeMarkers, KINDS, GROUPS, LAENDER, type MapAPI } from './map/map';
import { renderModes, MODES, currentMode } from './ui/modes';
import { renderWetter, renderPegel } from './ui/dashboard';
import { initTiefeSim, setTiefePegel } from './ui/tiefesim';
import { renderMeldungen } from './ui/meldungen';
import { initExplorer } from './ui/explorer';
import { initCommunity } from './ui/community';
import { renderSky, startSkyTicker } from './ui/sky';
import { initMelden } from './ui/melden';
import { initTouren } from './ui/touren';
import { initTourenDE } from './ui/touren_de';
import { initEventsDE } from './ui/events_de';
import { initFavorites } from './ui/favorites';
import { initTourSuggest } from './ui/toursuggest';
import { initNele, type NeleState } from './ui/nele';
import { initDestination } from './ui/destination';
import { initRoute, setRouteDestination } from './ui/route';
import { initVision } from './ui/vision';
import { initMapMarkers } from './ui/mapmarkers';
import { initEarlyAccess } from './ui/earlyaccess';
import { initGamification } from './ui/gamification';
import { initAcademy } from './ui/academy';
import { initChecklists } from './ui/checklists';
import { saveSnapshot, loadSnapshot, snapTime } from './lib/snapshot';
import { initPWA } from './lib/pwa';
import { initShare } from './ui/share';
import { initLegal } from './ui/legal';

/* 4 Tagesphasen: dawn (±45 min um Sonnenaufgang) · day · dusk (±45 min um Untergang) · night */
function applyTod(sunrise?: string, sunset?: string) {
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes();
  const toM = (s?:string) => s ? +s.slice(0,2)*60 + +s.slice(3,5) : null;
  const sr = toM(sunrise) ?? 5*60, su = toM(sunset) ?? 21*60+30;
  const tod = (mins >= sr-45 && mins <= sr+45) ? 'dawn'
    : (mins >= su-45 && mins <= su+45) ? 'dusk'
    : (mins > sr+45 && mins < su-45) ? 'day' : 'night';
  document.documentElement.dataset.tod = tod;
}
setInterval(()=>{ const w=(window as any).__wlw; applyTod(w?.sunrise, w?.sunset); }, 120000);
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
  if (state.cls==='danger') { el.textContent = `⚠️ Fahrt möglich, aber plane um: ${first ? first.waterway + ' — ' + String(first.description||'').slice(0,90) + '…' : 'aktive Sperrungen im Revier'} — Details unten.`; return; }
  const wa = w ? windAdvice(currentMode().id, w) : null;   // zielgruppen-kalibrierter Wind statt pauschalem bft>=4
  el.textContent = wa && wa.lvl >= 1 ? '🟡 ' + wa.text : '🟡 Einschränkungen beachten — Details unten in der amtlichen Lage.';
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
  for (const [gid, g] of Object.entries(GROUPS)) {
    const kinds = KINDS.filter(k => k.group === gid);
    const det = document.createElement('details');
    det.className = 'lg-group';
    det.open = kinds.some(k => api.activeKinds.has(k.kind));
    const sum = document.createElement('summary');
    const cnt = () => kinds.filter(k=>api.activeKinds.has(k.kind)).length;
    const setSum = () => { sum.innerHTML = `${g.icon} ${g.label} <span class="lg-cnt">${cnt()}/${kinds.length}</span>`; };
    setSum();
    det.appendChild(sum);
    const wrap = document.createElement('div'); wrap.className = 'lg-pills';
    kinds.forEach(k => {
      const b = document.createElement('button');
      b.className = 'lg' + (api.activeKinds.has(k.kind) ? '' : ' off');
      b.innerHTML = `<span style="color:${k.color}">●</span> ${k.icon} ${k.label}`;
      b.onclick = () => { if (api.activeKinds.has(k.kind)) api.activeKinds.delete(k.kind); else api.activeKinds.add(k.kind);
        api.setKinds(api.activeKinds); b.classList.toggle('off'); setSum(); };
      wrap.appendChild(b);
    });
    det.appendChild(wrap);
    el.appendChild(det);
  }
}
function initMapControls(api: MapAPI) {
  /* Bundesland-Auswahl */
  const sel = document.getElementById('mapLand') as HTMLSelectElement | null;
  if (sel) {
    for (const [code, L] of Object.entries(LAENDER)) {
      const o = document.createElement('option'); o.value = code; o.textContent = L.name; sel.appendChild(o);
    }
    sel.addEventListener('change', () => { if (sel.value) api.flyToLand(sel.value); });
  }
  /* Suche: erst lokale POIs, Enter ohne Treffer → Nominatim-Ortssuche */
  const q = document.getElementById('mapQ') as HTMLInputElement | null;
  const res = document.getElementById('mapQRes') as HTMLDivElement | null;
  if (!q || !res) return;
  const E=(s:string)=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML;};
  const show = (items:{name:string;sub:string;lng:number;lat:number}[]) => {
    res.hidden = items.length===0;
    res.innerHTML = items.map((it,i)=>`<button data-i="${i}"><b>${E(it.name)}</b><span>${E(it.sub)}</span></button>`).join('');
    res.querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{
      const it = items[+b.dataset.i!];
      api.map.flyTo({ center:[it.lng,it.lat], zoom:13.5, speed:1.5 });
      res.hidden = true; q.value = '';
    }));
  };
  let t=0 as any;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(()=>show(api.search(q.value)), 160); });
  q.addEventListener('keydown', async (ev) => {
    if (ev.key !== 'Enter') return;
    const local = api.search(q.value);
    if (local.length) { show(local); return; }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.value)}&countrycodes=de&format=json&limit=5`,
        { headers:{ 'Accept':'application/json' } }).then(r=>r.json());
      show(r.map((x:any)=>({ name:'📍 '+x.display_name.split(',')[0], sub:x.display_name.split(',').slice(1,3).join(','), lng:+x.lon, lat:+x.lat })));
    } catch { /* still */ }
  });
  document.addEventListener('click', (ev) => { if (!res.contains(ev.target as Node) && ev.target!==q) res.hidden = true; });
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

function initFooter(w: any) {
  const el = document.getElementById('footWx');
  if (el && w) {
    const wc = (c:number)=> c===0?'Klar': c<=3?'Leicht bewölkt': c<=48?'Bewölkt': c<=67?'Regen': c<=77?'Schnee': c<=82?'Schauer': c>=95?'Gewitter':'Wechselhaft';
    const bf = (b:number)=> b<=1?'Windstill': b<=3?'Sanfte Brise': b<=4?'Mäßiger Wind': b<=5?'Frischer Wind': b<=6?'Starker Wind':'Sturm';
    const ic = (c:number)=> c===0?'☀️': c<=2?'🌤️': c<=3?'☁️': c>=95?'⛈️': c>=71?'❄️': c>=51?'🌧️':'⛅';
    const t = el.querySelector('.fwx-tx'), i = el.querySelector('.fwx-ic');
    if (i) i.textContent = ic(w.code); if (t) t.textContent = `Berlin/Brandenburg · ${w.temp}° · ${wc(w.code)} · ${bf(w.bft)}`;
  }
  document.getElementById('footTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initNav() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.tn-links a'));
  const map = new Map<Element, HTMLAnchorElement>();
  links.forEach(a => { const id = a.getAttribute('href')?.slice(1); const s = id && document.getElementById(id); if (s) map.set(s, a); });
  if (!map.size || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(ents => ents.forEach(e => {
    if (e.isIntersecting) { links.forEach(l => l.classList.remove('active')); map.get(e.target)?.classList.add('active'); }
  }), { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  map.forEach((_, s) => io.observe(s));
}

function initReveal() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll('.sect, .map-stage, .dest-stage, main.dash > .panel, .b2b-grid > .panel'));
  els.forEach(e => e.classList.add('reveal'));
  const io = new IntersectionObserver((ents) => {
    ents.forEach((x, i) => { if (x.isIntersecting) { (x.target as HTMLElement).style.transitionDelay = (Math.min(i, 4) * 60) + 'ms'; x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => e.classList.add('in')), 3500); // Sicherheitsnetz
}

/* Zielgruppen-Intelligenz: sichtbar machen, was der Modus fokussiert (30-Sekunden-Klarheit). */
function applyAudience() {
  const m = currentMode();
  const el = document.getElementById('modeFocus');
  if (!el) return;
  const w = (window as any).__wlw;
  const wa = w ? windAdvice(m.id, w) : null;   // sofortige, boots-spezifische Wind-Einordnung beim Moduswechsel
  const windChip = wa && wa.lvl >= 1 ? ` <span class="mf-wind ${wa.cls}">${wa.short}</span>` : '';
  el.hidden = false;
  el.innerHTML = `<b>${m.label}</b> — du siehst v.a. ${m.focus}. <span class="mf-reco">${m.reco}</span>${windChip}`;
}
async function boot() {
  applyTod();
  initPWA();
  initSafety();
  initReveal();
  initNav();
  initCommunity();
  initTouren();
  initTourenDE();
  initTourSuggest();
  initEventsDE();
  initFavorites();
  initChecklists();
  applyAudience(); window.addEventListener('wl3-mode', applyAudience);
  initMelden(()=>setTimeout(initCommunity, 1200));
  renderSky(null);
  const mapP = initMap('map').catch(e => { console.error('Karte konnte nicht geladen werden', e); return null; });
  let [w, doc, ft, deDoc] = await Promise.all([fetchWeather(), fetchNotices(), fetchFT(), fetchNoticesDE()]);
  let snapNote = '';
  if (w || doc || ft) saveSnapshot({ w, doc, ft });                    // letzte Live-Lage sichern (für Offline)
  else { const s = loadSnapshot(); if (s) { w = s.w; doc = s.doc; ft = s.ft; snapNote = `📡 Offline · Stand letzter Abruf ${snapTime(s.ts)} Uhr — keine Live-Daten`; } }
  (window as any).__wlw = w;
  (window as any).__wlFT = ft;
  if (w) applyTod(w.sunrise, w.sunset);
  renderSky(w); startSkyTicker(()=>w);
  const state = combine(w, doc?.notices ?? null);
  setAmpel(state); setReco(state, doc, w); setChips(w, doc, ft);
  if (snapNote) { const _src = document.getElementById('ampelSrc'); if (_src) _src.textContent = snapNote; }
  renderMeldungen(doc, deDoc); renderWetter(w); initFooter(w); initTiefeSim(ft, { weather: w, notices: doc?.notices || null });
  initEarlyAccess(); initGamification(); initAcademy(); initShare(); initLegal();
  fetch(`${import.meta.env.BASE_URL}data/pegel.json`).then(r=>r.json()).then(async (pj)=>{
    const uuids = pj.groups.flatMap((g:any)=>g.stations.map((s:any)=>s.uuid));
    const gauges = await fetchPegel(uuids); renderPegel(gauges, ft); try { setTiefePegel(gauges); } catch { /* */ }
  }).catch(()=>renderPegel([], ft));

  const api = await mapP;
  if (api) {
    renderModes(document.getElementById('modes')!, (m)=>{ api.setKinds(new Set(m.kinds)); renderLegend(api); });
    api.setKinds(new Set(currentMode().kinds)); renderLegend(api); initMapControls(api);
    if (doc) { try { addNoticeMarkers(api, doc.notices.filter(activeToday).filter(n=>n.type!=='yellow')); } catch(e) { console.error(e); } }
    /* Explorer aus derselben Quelle wie die Karte */
    fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json()).then(fc => {
      const exp = initExplorer(fc.features, (lng,lat) => api.map.flyTo({ center:[lng,lat], zoom: 13.5, speed: 1.4 }));
      /* DE-weit: alle Bundesländer-POIs im Hintergrund in den Concierge mergen */
      Object.keys(LAENDER).forEach(code => {
        if (code==='BE'||code==='BB') return; // bereits in der Basis
        fetch(`${import.meta.env.BASE_URL}data/de/${code}.json`).then(r=>r.ok?r.json():null)
          .then(d => { if (d?.features) exp.addFeatures(d.features); }).catch(()=>{});
      });
    }).catch(e => console.error('Explorer-Daten nicht ladbar', e));
    initDestination(api);
    initRoute(api, () => doc);
    (window as any).__wl3routeTo = (ll: [number, number], name?: string) => { try { setRouteDestination(ll, name); } catch { /* */ } };
    initVision(api);
    initMapMarkers(api);
  } else {
    fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json()).then(fc => initExplorer(fc.features, ()=>{}));
  }

  /* Lilly: Gastgeberin/Lotsin — antwortet aus echten Live-Daten */
  const haversine = (la1:number,lo1:number,la2:number,lo2:number) => {
    const R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
    const x=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  let userPos: {lat:number;lon:number}|null = null;
  const lillyState: NeleState = {
    weather: () => w, doc: () => doc, ft: () => ft, ampel: () => state,
    nearest: async (kinds) => {
      if (!userPos) {
        userPos = await new Promise(res => navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}), ()=>res(null), {timeout:8000})
          : res(null));
        if (!userPos) return null;
      }
      const feats = api ? api.features() : [];
      let best:any=null, bestKm=Infinity;
      for (const f of feats) {
        if (!kinds.includes(f.properties.kind)) continue;
        const km = haversine(userPos.lat, userPos.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]);
        if (km < bestKm) { bestKm = km; best = f; }
      }
      return best ? { name: best.properties.name, km: bestKm, area: best.properties.area } : null;
    },
  };
  initNele(lillyState);
}
boot();
/* Wasserwelt: lazy nach erstem Render, kostet den Erstaufbau nichts */
setTimeout(() => { import('./ui/water3d').then(m => m.initWater3D()).catch(()=>{}); }, 250);
setTimeout(() => { import('./ui/progressive').then(m => m.initProgressive()).catch(()=>{}); }, 500);
setTimeout(() => { import('./ui/footerweather').then(m => m.initFooterWeather()).catch(()=>{}); }, 600);
