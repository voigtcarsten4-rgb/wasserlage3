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
  badge('bdgPegel',true,`● Live · Pegelonline · ${gauges.length} Stationen`);
  const KEY = ['Spandau','Potsdam','Mühlendamm','Köpenick','Neue Mühle','Frankfurt','Kleinmachnow','Brandenburg'];
  const top = gauges.filter(g=>KEY.some(k=>g.shortname.toLowerCase().includes(k.toLowerCase()))).slice(0,8);
  el.innerHTML = top.map(g=>`<div class="kv"><span>${E(g.shortname)} <small style="color:var(--ink2)">${E(g.water?.shortname??'')}</small></span>
      <b>${g.currentMeasurement?Math.round(g.currentMeasurement.value)+' cm':'—'}</b></div>`).join('')
    + (ft?`<div class="kv"><span>⚓ Fahrrinne Havel (min)</span><b>${(ft.havel_min_cm/100).toFixed(2).replace('.',',')} m</b></div>
       <div class="row"><span class="ic">ℹ️</span><div class="m">Fahrrinnen-/Tauchtiefen: ELWIS, Stand ${E(ft.stand)}</div></div>`:'');
}
