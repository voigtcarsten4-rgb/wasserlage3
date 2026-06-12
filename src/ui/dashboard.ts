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
export function renderWetter(w: Weather|null) {
  const el = $('wetter');
  if (!w) { badge('bdgWetter',false,'nicht erreichbar'); el.innerHTML='<div class="row"><span class="ic">📡</span><div>Wetterdaten gerade nicht erreichbar.</div></div>'; return; }
  badge('bdgWetter',true,`● Live · Open-Meteo · ${w.fetched} Uhr`);
  const warn = w.bft>=5?'<div class="row sev-red"><span class="ic">💨</span><div class="t">Kräftiger Wind — kleine Boote, SUP & Kajak heute meiden.</div></div>'
    : w.bft>=4?'<div class="row sev-orange"><span class="ic">💨</span><div class="t">Frischer Wind — vorausschauend fahren.</div></div>':'';
  el.innerHTML = `
    <div class="kv"><span>${WICON[w.code]??'🌤️'} Wind</span><b>${w.bft} Bft aus ${w.dir} · ${w.kmh} km/h</b></div>
    <div class="kv"><span>Böen</span><b>~${w.gust} km/h</b></div>
    <div class="kv"><span>Temperatur</span><b>${w.temp} °C</b></div>
    <div class="kv"><span>Sonne</span><b>↑ ${w.sunrise} · ↓ ${w.sunset} Uhr</b></div>${warn}`;
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
