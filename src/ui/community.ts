/* ═══ Community read-only · Supabase posts (gleiche Quelle wie 2.0, anon/RLS) ═══ */
const SB = 'https://wjqicituxwtlkddgspzc.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcWljaXR1eHd0bGtkZGdzcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc1MzcsImV4cCI6MjA5NjE4MzUzN30.gH9OIHU7zepGhzsz5ZusBQ3r_bxxitrt8iW61iA1V8E';
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const CAT: Record<string,[string,string]> = { gefahr:['⚠️','Gefahr'], liegeplatz:['🅿️','Liegeplatz'], erlebnis:['⭐','Erlebnis'], hinweis:['ℹ️','Hinweis'] };
function rel(ts:string): string {
  const d = (Date.now()-Date.parse(ts))/36e5;
  if (d < 1) return 'vor weniger als 1 Std.'; if (d < 24) return `vor ${Math.round(d)} Std.`;
  return `vor ${Math.round(d/24)} Tag${d>=48?'en':''}`;
}
export async function initCommunity() {
  const grid = document.getElementById('commGrid')!;
  const bdg = document.getElementById('bdgComm')!;
  try {
    const r = await fetch(`${SB}/posts?select=author,role,category,title,body,place,created_at&status=eq.live&order=created_at.desc&limit=12`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw 0;
    const rows = await r.json();
    bdg.textContent = `● Live · ${rows.length} Meldung${rows.length===1?'':'en'}`;
    grid.innerHTML = rows.length ? rows.map((p:any) => { const c = CAT[p.category] || ['📍', p.category];
      return `<article class="comm-card glass">
        <div class="comm-head"><span class="comm-ic">${c[0]}</span><b>${E(p.title||c[1])}</b><span class="comm-badge">🟡 ungeprüft</span></div>
        <p class="comm-body">${E(p.body||'')}</p>
        <div class="comm-meta">${E(p.author||'Gast')} · ${E(p.role||'Bootsfahrer')}${p.place?` · ${E(p.place)}`:''} · ${rel(p.created_at)}</div>
      </article>`; }).join('')
      : '<p class="exp-empty">Noch keine Meldungen heute — sei über Wasserlage 2.0 der Erste!</p>';
  } catch {
    bdg.textContent = 'nicht erreichbar'; bdg.classList.add('err');
    grid.innerHTML = '<p class="exp-empty">📡 Community gerade nicht erreichbar.</p>';
  }
}
