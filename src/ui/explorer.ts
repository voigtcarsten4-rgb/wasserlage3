/* ═══ Revier-Explorer · Suche/Filter über die EINE POI-Quelle ═══ */
import { KINDS } from '../map/map';
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const REG_LABELS: Record<string,string> = {
  spandau:'Havel · Berlin/Spandau', potsdam:'Havel · Potsdam/Werder', brb:'Untere Havel · Brandenburg',
  oberhavel:'Oberhavel', spree:'Spree · Köpenick/Müggelsee', dahme:'Dahme · KW/Zeuthen',
  seenland:'Dahme-Seenland · Teupitz', scharmuetzel:'Scharmützelsee · Bad Saarow', oder:'Oder & Kanäle', region:'Überregional',
};
const PAGE = 12;
export function initExplorer(features: any[], flyTo: (lng:number,lat:number)=>void) {
  const q = document.getElementById('expQ') as HTMLInputElement;
  const kindSel = document.getElementById('expKind') as HTMLSelectElement;
  const regSel = document.getElementById('expReg') as HTMLSelectElement;
  const grid = document.getElementById('expGrid')!;
  const more = document.getElementById('expMore')!;
  let shown = PAGE;

  KINDS.forEach(k => { const o=document.createElement('option'); o.value=k.kind; o.textContent=`${k.icon} ${k.label}`; kindSel.appendChild(o); });
  const regs = [...new Set(features.map(f=>f.properties.region).filter(Boolean))];
  regs.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=REG_LABELS[r]||r; regSel.appendChild(o); });

  function match(f:any): boolean {
    const p = f.properties;
    if (kindSel.value && p.kind !== kindSel.value) return false;
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
      p.web ? `<a class="exp-act" href="https://${E(p.web)}" target="_blank" rel="noopener">🌐</a>` : '',
      `<a class="exp-act" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">🧭</a>`,
    ].filter(Boolean).join('');
    const quality = p.quality==='verified' ? '<span class="pp-q verified">✓ verifiziert</span>' : '<span class="pp-q curated">kuratiert</span>';
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
  function render() {
    const hits = features.filter(match);
    grid.innerHTML = hits.slice(0, shown).map(card).join('')
      || '<p class="exp-empty">Keine Treffer — Suche anpassen oder anderes Revier wählen.</p>';
    (more as HTMLElement).hidden = hits.length <= shown;
    more.textContent = `▾ ${Math.min(PAGE, hits.length-shown)} weitere von ${hits.length} anzeigen`;
    grid.querySelectorAll('[data-fly]').forEach(b => b.addEventListener('click', () => {
      const [lng,lat] = (b as HTMLElement).dataset.fly!.split(',').map(Number);
      document.getElementById('karte')!.scrollIntoView({ behavior:'smooth', block:'center' });
      flyTo(lng,lat);
    }));
  }
  [q,kindSel,regSel].forEach(el => el.addEventListener('input', () => { shown = PAGE; render(); }));
  more.addEventListener('click', () => { shown += PAGE; render(); });
  render();
}
