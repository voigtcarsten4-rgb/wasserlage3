/* ═══ Amtliche Lage · Berlin/Brandenburg-Standard + bundesweiter Revier-Filter (notices-de.json) ═══
   Fällt ohne DE-Daten exakt auf die BB-Ansicht zurück (keine Regression). ═══ */
import type { NoticesDoc, NoticesDEDoc } from '../lib/live';
import { activeToday } from '../lib/live';

const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const $ = (id:string) => document.getElementById(id);
function badge(id:string, ok:boolean, text:string){ const b=$(id); if(!b) return; b.textContent=text; b.className='badge'+(ok?'':' err'); }

const ORDER:any = { red:0, orange:1, yellow:2 };
const ICON = (t:string)=> t==='red'?'🔴':t==='orange'?'🟠':'🟡';
const N = 8;
function row(n:any){ return `<div class="row sev-${n.type}"><span class="ic">${ICON(n.type)}</span><div>
      <div class="t">${E(n.description||n.type_label)} ${n.waterway?'· '+E(n.waterway):''}</div>
      <div class="m">${E([n.wsa,n.reason,(n.valid_from||'')+(n.valid_to?'–'+n.valid_to:'')].filter(Boolean).join(' · '))}
      ${n.detail_url?` · <a href="${E(n.detail_url)}" target="_blank" rel="noopener">ELWIS ›</a>`:''}</div></div></div>`; }

type S = { active:any[]; useDE:boolean; region:string; expanded:boolean };
let st: S | null = null;

function paint(){
  const el = $('meldungen'); const s = st; if(!el||!s) return;
  const items = (s.useDE && s.region!=='__all__') ? s.active.filter(n=>n.region===s.region) : s.active;
  const sorted = [...items].sort((a,b)=>ORDER[a.type]-ORDER[b.type]);
  let bar = '';
  if (s.useDE){
    const counts:Record<string,number> = {}; for(const n of s.active){ const r=n.region||'Sonstige'; counts[r]=(counts[r]||0)+1; }
    const regions = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
    const chip=(v:string,label:string,c:number,on:boolean)=>`<button class="rv-chip${on?' on':''}" data-rv="${E(v)}">${E(label)}${c?` <span class="rv-n">${c}</span>`:''}</button>`;
    bar = `<div class="rv-bar">${chip('__all__','Alle Reviere',s.active.length,s.region==='__all__')}${regions.map(r=>chip(r,r,counts[r],s.region===r)).join('')}</div>`;
  }
  const list = sorted.length
    ? (s.expanded?sorted:sorted.slice(0,N)).map(row).join('') + (sorted.length>N?`<div class="more">${s.expanded?'▴ Weniger anzeigen':'▾ Alle '+sorted.length+' Meldungen anzeigen'}</div>`:'')
    : `<div class="row"><span class="ic">🟢</span><div class="t">${s.useDE?'Im gewählten Revier':'Im Revier'} heute keine aktiven amtlichen Einschränkungen.</div></div>`;
  el.innerHTML = bar + list;
}

export function renderMeldungen(doc: NoticesDoc|null, deDoc?: NoticesDEDoc|null){
  const el = $('meldungen'); if(!el) return;
  const useDE = !!(deDoc && deDoc.notices && deDoc.notices.length);
  const src:any = useDE ? deDoc : doc;
  if (!src){ badge('bdgElwis',false,'nicht erreichbar'); el.innerHTML='<div class="row"><span class="ic">📡</span><div>ELWIS-Daten gerade nicht erreichbar — verbindlich bleibt ELWIS.de.</div></div>'; return; }
  badge('bdgElwis',true,`● Live · ELWIS · ${E(src.updated_de)}${useDE?' · bundesweit':''}`);
  const active = (src.notices as any[]).filter(activeToday);
  let region = '__all__';
  if (useDE){
    const present = new Set(active.map((n:any)=>n.region));
    let saved=''; try{ saved=localStorage.getItem('wl3_revier')||''; }catch{}
    region = (saved && (saved==='__all__'||present.has(saved))) ? saved : (present.has('Berlin/Brandenburg')?'Berlin/Brandenburg':'__all__');
  }
  st = { active, useDE, region, expanded:false };
  paint();
  if (!el.dataset.rvBound){
    el.dataset.rvBound='1';
    el.addEventListener('click',(ev)=>{
      const t = ev.target as HTMLElement; if(!st) return;
      const chip = t.closest('.rv-chip') as HTMLElement|null;
      if (chip){ st.region = chip.dataset.rv||'__all__'; st.expanded=false; try{localStorage.setItem('wl3_revier',st.region);}catch{}; paint(); return; }
      if (t.closest('.more')){ st.expanded=!st.expanded; paint(); }
    });
  }
}
