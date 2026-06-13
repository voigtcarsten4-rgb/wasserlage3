/* ═══ Services & Erlebnisse · Hafen-Concierge · DE-weit ═══ */
import { KINDS, LAENDER } from '../map/map';
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const REG_LABELS: Record<string,string> = {
  spandau:'Havel · Berlin/Spandau', potsdam:'Havel · Potsdam/Werder', brb:'Untere Havel · Brandenburg',
  oberhavel:'Oberhavel', spree:'Spree · Köpenick/Müggelsee', dahme:'Dahme · KW/Zeuthen',
  seenland:'Dahme-Seenland · Teupitz', scharmuetzel:'Scharmützelsee · Bad Saarow', oder:'Oder & Kanäle', region:'Überregional',
};
const PAGE = 12;
function classifyLand(lng:number, lat:number): string {
  for (const [code, L] of Object.entries(LAENDER)) {
    const b = L.bbox; if (lng>=b[0] && lng<=b[2] && lat>=b[1] && lat<=b[3]) return code;
  }
  return '';
}
export interface ExplorerAPI { addFeatures(extra:any[]): void }

export function initExplorer(features: any[], flyTo: (lng:number,lat:number)=>void): ExplorerAPI {
  const q = document.getElementById('expQ') as HTMLInputElement;
  const kindSel = document.getElementById('expKind') as HTMLSelectElement;
  const landSel = document.getElementById('expLand') as HTMLSelectElement | null;
  const regSel = document.getElementById('expReg') as HTMLSelectElement;
  const grid = document.getElementById('expGrid')!;
  const more = document.getElementById('expMore')!;
  const countEl = document.getElementById('expCount');
  const ids = new Set<string>();
  let shown = PAGE; let nearPos: {lat:number;lon:number}|null = null;
  const landOf = (f:any) => f._land || (f._land = f.properties.land || classifyLand(f.geometry.coordinates[0], f.geometry.coordinates[1]) || 'BB');
  features.forEach(f => { ids.add(f.properties.id); landOf(f); });

  const hav = (a:{lat:number;lon:number}, lat:number, lon:number) => {
    const R=6371, dLa=(lat-a.lat)*Math.PI/180, dLo=(lon-a.lon)*Math.PI/180;
    const x=Math.sin(dLa/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLo/2)**2;
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  const nearBtn = document.createElement('button');
  nearBtn.className='exp-act'; nearBtn.id='expNear'; nearBtn.type='button'; nearBtn.textContent='📍 In meiner Nähe';
  document.querySelector('.exp-bar')?.appendChild(nearBtn);
  nearBtn.addEventListener('click', () => {
    if (nearPos) { nearPos=null; nearBtn.textContent='📍 In meiner Nähe'; nearBtn.classList.remove('on'); render(); return; }
    if (!navigator.geolocation) { nearBtn.textContent='📍 kein GPS'; return; }
    nearBtn.textContent='📍 suche …';
    navigator.geolocation.getCurrentPosition(p => { nearPos={lat:p.coords.latitude,lon:p.coords.longitude};
      nearBtn.textContent='✓ Nähe aktiv'; nearBtn.classList.add('on'); shown=PAGE; render(); }, () => { nearBtn.textContent='📍 In meiner Nähe'; });
  });

  KINDS.forEach(k => { const o=document.createElement('option'); o.value=k.kind; o.textContent=`${k.icon} ${k.label}`; kindSel.appendChild(o); });
  function fillLandOptions() {
    if (!landSel) return; const have = new Set(features.map(landOf));
    const cur = landSel.value;
    landSel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
    Object.entries(LAENDER).filter(([c])=>have.has(c)).forEach(([c,L]) => {
      const o=document.createElement('option'); o.value=c; o.textContent=L.name; landSel.appendChild(o); });
    landSel.value = cur;
  }
  function fillRegOptions() {
    const cur = regSel.value; regSel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
    [...new Set(features.map(f=>f.properties.region).filter(Boolean))].forEach(r => {
      const o=document.createElement('option'); o.value=r as string; o.textContent=REG_LABELS[r as string]||(r as string); regSel.appendChild(o); });
    regSel.value = cur;
  }
  fillLandOptions(); fillRegOptions();

  function match(f:any): boolean {
    const p = f.properties;
    if (kindSel.value && p.kind !== kindSel.value) return false;
    if (landSel && landSel.value && landOf(f) !== landSel.value) return false;
    if (regSel.value && p.region !== regSel.value) return false;
    const needle = q.value.trim().toLowerCase();
    if (needle) {
      const hay = `${p.name} ${p.area||''} ${p.desc||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }
  function card(f:any): string {
    const p = f.properties; const k = KINDS.find(x=>x.kind===p.kind);
    const [lng,lat] = f.geometry.coordinates;
    const acts = [
      `<button class="exp-act" data-fly="${lng},${lat}">🗺️ Karte</button>`,
      p.tel ? `<a class="exp-act" href="tel:${E(String(p.tel).replace(/[^0-9+]/g,''))}">📞</a>` : '',
      p.web ? `<a class="exp-act" href="https://${E(String(p.web).replace(/^https?:\/\//,''))}" target="_blank" rel="noopener">🌐</a>` : '',
      `<a class="exp-act" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">🧭</a>`,
    ].filter(Boolean).join('');
    const quality = p.quality==='verified' ? '<span class="pp-q verified">✓ verifiziert</span>'
      : p.quality==='curated' ? '<span class="pp-q curated">kuratiert</span>'
      : '<span class="pp-q unverified">ungeprüft</span>';
    return `<article class="exp-card glass" style="--kc:${k?.color||'#888'}">
      <div class="exp-kind">${k?.icon||'📍'} ${E(k?.label||p.kind)} ${quality}</div>
      <h3>${E(p.name)}</h3>
      ${p.area?`<div class="exp-area">📍 ${E(p.area)}</div>`:''}
      <p class="exp-desc">${E(p.desc||'')}</p>
      ${(p.tags||[]).length?`<div class="exp-tags">${p.tags.map((t:string)=>`<span>${E(t)}</span>`).join('')}</div>`:''}
      <div class="exp-acts">${acts}</div>
      <div class="exp-meta">Quelle: ${E(p.source)}${p.verified_at?` · geprüft ${E(p.verified_at)}`:''}</div>
    </article>`;
  }
  function setCount(hits:number) {
    if (!countEl) return; const cats = new Set(features.map(f=>f.properties.kind)).size;
    countEl.textContent = `· ${features.length.toLocaleString('de-DE')} Einträge · ${cats} Kategorien${hits!==features.length?` · ${hits} Treffer`:''}`;
  }
  function render() {
    let hits = features.filter(match);
    if (nearPos) hits = [...hits].sort((a,b)=>
      hav(nearPos!, a.geometry.coordinates[1], a.geometry.coordinates[0]) -
      hav(nearPos!, b.geometry.coordinates[1], b.geometry.coordinates[0]));
    grid.innerHTML = hits.slice(0, shown).map(card).join('')
      || '<p class="exp-empty">Keine Treffer — Suche anpassen oder anderes Revier/Bundesland wählen.</p>';
    (more as HTMLElement).hidden = hits.length <= shown;
    more.textContent = `▾ ${Math.min(PAGE, hits.length-shown)} weitere von ${hits.length} anzeigen`;
    setCount(hits.length);
    grid.querySelectorAll('[data-fly]').forEach(b => b.addEventListener('click', () => {
      const [lng,lat] = (b as HTMLElement).dataset.fly!.split(',').map(Number);
      document.getElementById('karte')!.scrollIntoView({ behavior:'smooth', block:'center' });
      flyTo(lng,lat);
    }));
  }
  [q,kindSel,regSel].forEach(el => el.addEventListener('input', () => { shown = PAGE; render(); }));
  landSel?.addEventListener('change', () => { shown = PAGE; render(); });
  more.addEventListener('click', () => { shown += PAGE; render(); });
  render();

  return {
    addFeatures(extra:any[]) {
      let n = 0;
      for (const f of extra) { const id=f.properties?.id; if (!id || ids.has(id)) continue; ids.add(id); landOf(f); features.push(f); n++; }
      if (n) { fillLandOptions(); fillRegOptions(); render(); }
    }
  };
}
