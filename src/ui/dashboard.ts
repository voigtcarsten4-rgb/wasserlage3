/* ═══ Kapitäns-Dashboard · ELWIS / Wetter / Pegel — immer mit Quelle + Stand ═══ */
import type { NoticesDoc, Weather, Gauge } from '../lib/live';
import { activeToday } from '../lib/live';

const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const $ = (id:string) => document.getElementById(id)!;
function badge(id:string, ok:boolean, text:string){ const b=$(id); b.textContent=text; b.className='badge'+(ok?'':' err'); }

export function renderMeldungen(doc: NoticesDoc|null) {
  const el = $('meldungen');
  if (!doc) { badge('bdgElwis',false,'nicht erreichbar'); el.innerHTML='<div class="row"><span class="ic">📡</span><div>ELWIS-Daten gerade nicht erreichbar — verbindlich bleibt ELWIS.de.</div></div>'; return; }
  badge('bdgElwis',true,`● Live · ELWIS · ${doc.updated_de}`);
  const act = doc.notices.filter(activeToday);
  const order = { red:0, orange:1, yellow:2 } as any;
  const sorted = [...act].sort((a,b)=>order[a.type]-order[b.type]);
  const icon = (t:string)=> t==='red'?'🔴':t==='orange'?'🟠':'🟡';
  const N = 8;
  const row = (n:any)=>`<div class="row sev-${n.type}"><span class="ic">${icon(n.type)}</span><div>
      <div class="t">${E(n.description||n.type_label)} ${n.waterway?'· '+E(n.waterway):''}</div>
      <div class="m">${E([n.wsa,n.reason,(n.valid_from||'')+(n.valid_to?'–'+n.valid_to:'')].filter(Boolean).join(' · '))}
      ${n.detail_url?` · <a href="${E(n.detail_url)}" target="_blank" rel="noopener">ELWIS ›</a>`:''}</div></div></div>`;
  el.innerHTML = (sorted.length
    ? sorted.slice(0,N).map(row).join('')
    : '<div class="row"><span class="ic">🟢</span><div class="t">Heute keine aktiven amtlichen Einschränkungen im Revier.</div></div>')
    + (sorted.length>N ? `<div class="more" data-all="0">▾ Alle ${sorted.length} heute aktiven Meldungen anzeigen</div>` : '');
  el.querySelector('.more')?.addEventListener('click', (ev)=>{
    const b = ev.currentTarget as HTMLElement;
    if (b.dataset.all==='0') { el.innerHTML = sorted.map(row).join('') + `<div class="more" data-all="1">▴ Weniger anzeigen</div>`; }
    renderMeldungenRebind(el, sorted, row, N);
  });
}
function renderMeldungenRebind(el:HTMLElement, sorted:any[], row:(n:any)=>string, N:number){
  el.querySelector('.more')?.addEventListener('click', ()=>{
    el.innerHTML = sorted.slice(0,N).map(row).join('') + `<div class="more" data-all="0">▾ Alle ${sorted.length} heute aktiven Meldungen anzeigen</div>`;
    el.querySelector('.more')?.addEventListener('click', ()=>{ el.innerHTML = sorted.map(row).join('') + `<div class="more" data-all="1">▴ Weniger anzeigen</div>`; renderMeldungenRebind(el,sorted,row,N); });
  });
}

const WICON: Record<number,string> = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',80:'🌧️',95:'⛈️',96:'⛈️',99:'⛈️'};
const DIR_DEG: Record<string,number> = {N:0,NNO:22.5,NO:45,ONO:67.5,O:90,OSO:112.5,SO:135,SSO:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5};
/* Windrose — Messing/Glas-Instrument, Nadel = Windrichtung (woher) */
function windrose(dirStr:string, bft:number, kmh:number): string {
  const deg = DIR_DEG[dirStr?.toUpperCase?.()] ?? 0;
  let ticks='';
  for (let a=0;a<360;a+=15){ const r1=44, r2=(a%90===0)?36:(a%45===0)?38:41, rad=Math.PI*a/180;
    ticks+=`<line x1="${(50+r1*Math.sin(rad)).toFixed(1)}" y1="${(50-r1*Math.cos(rad)).toFixed(1)}" x2="${(50+r2*Math.sin(rad)).toFixed(1)}" y2="${(50-r2*Math.cos(rad)).toFixed(1)}"/>`; }
  return `<div class="windrose-wrap" title="Windrichtung ${E(dirStr)} · ${bft} Bft">
  <svg viewBox="0 0 100 100" class="windrose" role="img" aria-label="Windrose: Wind aus ${E(dirStr)}, ${bft} Beaufort">
    <defs><radialGradient id="wrglass" cx="50%" cy="38%"><stop offset="0%" stop-color="rgba(180,230,240,.16)"/><stop offset="100%" stop-color="rgba(8,26,41,.55)"/></radialGradient>
    <linearGradient id="wrbrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFE29A"/><stop offset="50%" stop-color="#D9B14D"/><stop offset="100%" stop-color="#C9982F"/></linearGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#wrglass)" stroke="url(#wrbrass)" stroke-width="1.6"/>
    <g stroke="url(#wrbrass)" stroke-width="1" opacity=".8">${ticks}</g>
    <text x="50" y="13" text-anchor="middle" font-size="8.5" fill="#FFE29A" font-weight="700">N</text>
    <text x="89" y="53" text-anchor="middle" font-size="7.5" fill="rgba(255,226,154,.7)">O</text>
    <text x="50" y="94" text-anchor="middle" font-size="7.5" fill="rgba(255,226,154,.7)">S</text>
    <text x="11" y="53" text-anchor="middle" font-size="7.5" fill="rgba(255,226,154,.7)">W</text>
    <g transform="rotate(${deg} 50 50)" class="wr-needle">
      <path d="M50 16 L54 50 L50 58 L46 50 Z" fill="#3FC3C9" opacity=".95"/>
      <path d="M50 58 L53 76 L50 82 L47 76 Z" fill="rgba(255,255,255,.35)"/>
    </g>
    <circle cx="50" cy="50" r="11.5" fill="rgba(8,26,41,.85)" stroke="url(#wrbrass)" stroke-width="1"/>
    <text x="50" y="48.5" text-anchor="middle" font-size="9" font-weight="800" fill="#eafaff">${bft}</text>
    <text x="50" y="57" text-anchor="middle" font-size="4.6" fill="rgba(234,250,255,.65)" letter-spacing=".5">BFT</text>
  </svg>
  <div class="wr-cap">Wind aus ${E(dirStr)} · ${kmh} km/h</div></div>`;
}
const bftOf = (k:number) => { const b=[1,6,12,20,29,39,50,62,75,89,103,118]; for(let i=0;i<b.length;i++) if(k<b[i]) return i; return 12; };
/* Bootsfahrer-Ampel je Tag: Wind + Regen + Gewitter → frei/Hinweis/Einschränkung */
function boaterRating(bft:number, precip:number, code:number): {cls:string; dot:string; txt:string} {
  if (bft>=6 || code>=95) return {cls:'r', dot:'🔴', txt:'Sturm/Gewitter — besser an Land'};
  if (bft>=4 || precip>=60) return {cls:'a', dot:'🟡', txt: bft>=4?'Frischer Wind — aufpassen':'Regen wahrscheinlich'};
  return {cls:'g', dot:'🟢', txt:'Gute Bedingungen'};
}
function renderForecast(w: Weather): string {
  const d = w.daily; if (!d || !d.time) return '';
  const days = d.time.length;
  const wd = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  let cells = '';
  for (let i=0;i<days;i++){
    const date = new Date(d.time[i]); const label = i===0?'Heute':wd[date.getDay()];
    const code = d.weather_code[i]; const tmax = Math.round(d.temperature_2m_max[i]); const tmin = Math.round(d.temperature_2m_min[i]);
    const wmax = Math.round(d.wind_speed_10m_max[i]); const bft = bftOf(wmax);
    const gust = d.wind_gusts_10m_max ? Math.round(d.wind_gusts_10m_max[i]) : 0;
    const precip = d.precipitation_probability_max?.[i] ?? 0;
    const r = boaterRating(bft, precip, code);
    cells += `<div class="fcd fc-${r.cls}" title="${E(r.txt)} · Böen ~${gust} km/h · Regen ${precip}%">
      <div class="fcw">${E(label)}</div><div class="fci">${WICON[code]??'🌤️'}</div>
      <div class="fct">${tmax}°<small>${tmin}°</small></div>
      <div class="fcwind">💨 ${bft} Bft</div><div class="fcrain">💧 ${precip}%</div>
      <div class="fcdot" aria-label="${E(r.txt)}">${r.dot}</div></div>`;
  }
  return `<div class="fc-h">📅 7-Tage-Ausblick · Bootsfahrer-Ampel <span class="fc-src">Open-Meteo/DWD</span></div>
    <div class="fc-strip">${cells}</div>
    <div class="fc-legend">🟢 frei · 🟡 Hinweis (Wind ab 4 Bft / Regen) · 🔴 Sturm/Gewitter — Bewertung für kleine & mittlere Boote</div>`;
}
export function renderWetter(w: Weather|null) {
  const el = $('wetter');
  if (!w) { badge('bdgWetter',false,'nicht erreichbar'); el.innerHTML='<div class="row"><span class="ic">📡</span><div>Wetterdaten gerade nicht erreichbar.</div></div>'; return; }
  badge('bdgWetter',true,`● Live · Open-Meteo · ${w.fetched} Uhr`);
  const warn = w.bft>=5?'<div class="row sev-red"><span class="ic">💨</span><div class="t">Kräftiger Wind — kleine Boote, SUP & Kajak heute meiden.</div></div>'
    : w.bft>=4?'<div class="row sev-orange"><span class="ic">💨</span><div class="t">Frischer Wind — vorausschauend fahren.</div></div>':'';
  el.innerHTML = windrose(w.dir, w.bft, w.kmh) + `
    <div class="kv"><span>${WICON[w.code]??'🌤️'} Wind</span><b>${w.bft} Bft aus ${w.dir} · ${w.kmh} km/h</b></div>
    <div class="kv"><span>Böen</span><b>~${w.gust} km/h</b></div>
    <div class="kv"><span>Temperatur</span><b>${w.temp} °C</b></div>
    <div class="kv"><span>Sonne</span><b>↑ ${w.sunrise} · ↓ ${w.sunset} Uhr</b></div>${warn}`
    + renderForecast(w)
    + `<details class="wx-radar"><summary>🛰️ Live-Wetterradar (Regen) · Berlin/Brandenburg</summary>
        <iframe loading="lazy" title="Wetterradar" src="https://embed.windy.com/embed2.html?lat=52.45&lon=13.4&zoom=7&level=surface&overlay=rain&menu=&message=&type=map&location=coordinates&metricWind=bft&metricTemp=%C2%B0C&radarRange=-1"></iframe>
        <div class="wx-radar-src">Radar © Windy.com</div></details>`;
}

export function renderPegel(gauges: Gauge[], ft: {stand:string; havel_min_cm:number}|null) {
  const el = $('pegel');
  if (!gauges.length) { badge('bdgPegel',false,'nicht erreichbar'); el.innerHTML='<div class="row"><span class="ic">📡</span><div>Pegelonline gerade nicht erreichbar.</div></div>'; return; }
  /* Wasserstand-Einordnung je Pegel (offizielle WSV-Kennwerte): Niedrig-/Mittel-/Hochwasser + schiffbare Marken NSW/HSW */
  const waterState = (cm?: Gauge['currentMeasurement']): { cls: 'ok'|'lo'|'hi'; t: string } | null => {
    if (!cm) return null;
    const m = cm.stateMnwMhw, n = cm.stateNswHsw;
    if (m === 'high') return { cls: 'hi', t: 'Hochwasser' };
    if (n === 'high') return { cls: 'hi', t: 'über HSW' };
    if (m === 'low') return { cls: 'lo', t: 'Niedrigwasser' };
    if (n === 'low') return { cls: 'lo', t: 'unter NSW' };
    if (m === 'normal' || n === 'normal') return { cls: 'ok', t: 'Mittel' };
    return null;
  };
  /* Auffällige über ALLE Stationen zählen (Headline-Mehrwert) */
  let nLo = 0, nHi = 0, nKnown = 0;
  for (const g of gauges) { const s = waterState(g.currentMeasurement); if (s) { nKnown++; if (s.cls === 'lo') nLo++; else if (s.cls === 'hi') nHi++; } }
  badge('bdgPegel', true, `● Live · Pegelonline · ${gauges.length} Stationen`);
  /* repräsentative Auswahl: je Gewässer bis zu 2 Pegel — auffällige (Hoch-/Niedrigwasser) bevorzugt */
  const byWater: Record<string, Gauge[]> = {};
  for (const g of gauges) { const w = g.water?.shortname || '—'; (byWater[w] = byWater[w] || []).push(g); }
  const rank = (g: Gauge) => { const s = waterState(g.currentMeasurement); return s ? (s.cls === 'hi' ? 0 : s.cls === 'lo' ? 1 : 2) : 3; };
  const top: Gauge[] = [];
  for (const w of Object.keys(byWater)) top.push(...byWater[w].sort((a, b) => rank(a) - rank(b)).slice(0, 2));
  top.sort((a, b) => rank(a) - rank(b)); top.splice(20);
  const pill = (g: Gauge) => { const s = waterState(g.currentMeasurement); return s ? ` <span class="pg-state ${s.cls}">${s.t}</span>` : ''; };
  const head = (nHi || nLo)
    ? `<div class="pg-head ${nHi ? 'hi' : 'lo'}">${nHi ? `🔴 ${nHi} Pegel mit Hochwasser-Lage` : ''}${nHi && nLo ? ' · ' : ''}${nLo ? `🟡 ${nLo} Pegel mit Niedrigwasser` : ''} <small>(von ${nKnown} amtlich eingestuften)</small></div>`
    : (nKnown ? `<div class="pg-head ok">🟢 Alle ${nKnown} eingestuften Pegel im Mittelwasser-Bereich</div>` : '');
  el.innerHTML = head + top.map(g=>`<div class="kv"><span>${E(g.shortname)} <small style="color:var(--ink2)">${E(g.water?.shortname??'')}</small>${pill(g)}</span>
      <b>${g.currentMeasurement?Math.round(g.currentMeasurement.value)+' cm':'—'}</b></div>`).join('')
    + (ft?`<div class="kv"><span>⚓ Fahrrinne Havel (min)</span><b>${(ft.havel_min_cm/100).toFixed(2).replace('.',',')} m</b></div>`:'')
    + `<div class="row"><span class="ic">ℹ️</span><div class="m">Einstufung nach amtlichen WSV-Kennwerten (Niedrig-/Mittel-/Hochwasser, schiffbare Marken NSW/HSW)${ft?` · Fahrrinnentiefen ELWIS, Stand ${E(ft.stand)}`:''}. Verbindlich: ELWIS & amtliche Fahrrinne.</div></div>`;
}
 

/* ═══ Tiefen-Check (Fahrrinnen-/Tauchtiefe F/T) — „Passt mein Boot?" ═══ */
interface FTItem { revier:string; group:string; abk:string; section:string; kind:string; value:string; cm:number|null; status:string }
interface FTDoc { updated_de?:string; stand?:string; items?:FTItem[] }
let lastFT: FTDoc | null = null;

function draftCm(): number {
  const inp = document.getElementById('draft') as HTMLInputElement | null;
  return Math.round(parseFloat(inp?.value || '1.2') * 100);
}
const m2 = (cm:number) => (cm/100).toFixed(2).replace('.', ',') + ' m';

export function initTiefe() {
  const inp = document.getElementById('draft') as HTMLInputElement | null;
  if (!inp) return;
  const saved = localStorage.getItem('wl_draft');
  if (saved && +saved >= 0.3 && +saved <= 2.5) inp.value = saved;
  const upd = () => {
    const out = document.getElementById('draftVal'); if (out) out.textContent = m2(draftCm());
    localStorage.setItem('wl_draft', inp.value);
    renderFTBars();
  };
  inp.addEventListener('input', upd);
  upd();
}

export function renderFT(ft: FTDoc | null) { lastFT = ft; renderFTBars(); }

function verdict(cm:number|null, dCm:number): {cls:string; ic:string; t:string} {
  if (cm == null) return { cls:'na', ic:'—', t:'nicht gemeldet' };
  const margin = cm - dCm;
  if (margin >= 40) return { cls:'ok', ic:'✅', t:'frei' };
  if (margin >= 0)  return { cls:'warn', ic:'⚠️', t:'knapp' };
  return { cls:'bad', ic:'⛔', t:'zu flach' };
}

function renderFTBars() {
  const el = document.getElementById('tiefe'); if (!el) return;
  const sum = document.getElementById('tiefeSum');
  if (!lastFT || !lastFT.items || !lastFT.items.length) {
    badge('bdgTiefe', false, 'nicht erreichbar');
    el.innerHTML = '<div class="row"><span class="ic">📡</span><div>Fahrrinnentiefen gerade nicht erreichbar.</div></div>';
    if (sum) sum.textContent = '';
    return;
  }
  const dCm = draftCm();
  const items = lastFT.items;
  const reported = items.filter(i => i.cm != null);
  const maxCm = Math.max(300, dCm, ...reported.map(i => i.cm as number));
  const scale = Math.ceil(maxCm / 50) * 50;
  let free = 0, tight = 0, blocked = 0;
  for (const i of reported) { const v = verdict(i.cm, dCm); if (v.cls==='ok') free++; else if (v.cls==='warn') tight++; else blocked++; }

  badge('bdgTiefe', true, `● Live · ELWIS · ${E(lastFT.stand || lastFT.updated_de || '')}`);
  if (sum) sum.innerHTML = reported.length
    ? `Bei <b>${m2(dCm)}</b> Tiefgang: <b class="t-ok">${free} frei</b>${tight?` · <b class="t-warn">${tight} knapp</b>`:''}${blocked?` · <b class="t-bad">${blocked} zu flach</b>`:''} <small>(${reported.length} gemeldet)</small>`
    : 'Aktuell keine Tiefen gemeldet.';

  /* nach Revier → Gewässer gruppieren */
  const groups: Record<string, FTItem[]> = {};
  for (const i of items) { (groups[i.group] = groups[i.group] || []).push(i); }
  const draftPct = Math.min(100, dCm / scale * 100);
  let html = '';
  for (const g of Object.keys(groups)) {
    const rows = groups[g].map(i => {
      const v = verdict(i.cm, dCm);
      const fillPct = i.cm != null ? Math.min(100, i.cm / scale * 100) : 0;
      const kindLabel = i.kind === 'T' ? 'Tauchtiefe' : 'Fahrrinnentiefe';
      return `<div class="ft-row ${v.cls}">
        <div class="ft-meta"><b>${E(i.section)}</b><small>${E(i.kind)} · ${kindLabel}</small></div>
        <div class="ft-bar" title="Tiefgang-Marke bei ${m2(dCm)}">
          <div class="ft-fill ${v.cls}" style="width:${fillPct}%"></div>
          <div class="ft-draft" style="left:${draftPct}%"></div>
        </div>
        <div class="ft-val">${i.cm != null ? m2(i.cm) : '<span class="ft-na">n. gem.</span>'}</div>
        <div class="ft-vd ${v.cls}" title="${v.t}">${v.ic}</div>
      </div>`;
    }).join('');
    html += `<div class="ft-group"><div class="ft-gh">${E(g)} <small>${E(groups[g][0].abk)}</small></div>${rows}</div>`;
  }
  el.innerHTML = html + `<div class="row"><span class="ic">⚓</span><div class="m">Marke = dein Tiefgang. Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen, Stand ${E(lastFT.stand || '—')}. Empfehlung: mind. 30–40 cm Sicherheitswasser unter dem Kiel. Verbindlich bleibt ELWIS.</div></div>`;
}
