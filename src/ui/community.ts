/* ═══ Community 3.0 · Feed mit Foto, Bestätigen-Button & Status (Supabase, RLS) ═══ */
import { SB_URL, SB_KEY, photoUrl } from '../lib/auth';
const SB = `${SB_URL}/rest/v1`;
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const CAT: Record<string,[string,string]> = { gefahr:['⚠️','Gefahr'], liegeplatz:['🅿️','Liegeplatz'], erlebnis:['⭐','Erlebnis'], hinweis:['ℹ️','Hinweis'] };
function rel(ts:string): string {
  const d = (Date.now()-Date.parse(ts))/36e5;
  if (d < 1) return 'vor weniger als 1 Std.'; if (d < 24) return `vor ${Math.round(d)} Std.`;
  return `vor ${Math.round(d/24)} Tag${d>=48?'en':''}`;
}
const confirmed = (): string[] => { try { return JSON.parse(localStorage.getItem('wl3_confirmed')||'[]'); } catch { return []; } };

/* Statuslogik: ungeprüft → Community-bestätigt → veraltet (Zeit-Decay wie 2.0 itemTTL) · hidden = nie geladen */
function badge(p:any): string {
  const ageH = (Date.now()-Date.parse(p.created_at))/36e5;
  const ttl = p.category==='gefahr' ? 7*24 : p.category==='liegeplatz' ? 24 : 30*24;
  if (ageH > ttl) return '<span class="comm-badge stale">⏳ möglicherweise veraltet</span>';
  if (p.status === 'confirmed' || (p.confirms||0) >= 3) return '<span class="comm-badge ok">🟢 von Community bestätigt</span>';
  return '<span class="comm-badge">🟡 ungeprüft</span>';
}

export async function initCommunity() {
  const grid = document.getElementById('commGrid')!;
  const bdg = document.getElementById('bdgComm')!;
  try {
    const r = await fetch(`${SB}/posts?select=id,author,role,category,title,body,place,created_at,photo_path,confirms,status&status=in.(live,confirmed)&order=created_at.desc&limit=12`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw 0;
    const rows = await r.json();
    const done = confirmed();
    bdg.textContent = `● Live · ${rows.length} Meldung${rows.length===1?'':'en'}`;
    grid.innerHTML = rows.length ? rows.map((p:any) => { const c = CAT[p.category] || ['📍', p.category];
      const n = p.confirms||0, did = done.includes(p.id);
      return `<article class="comm-card glass" data-id="${E(p.id)}">
        <div class="comm-head"><span class="comm-ic">${c[0]}</span><b>${E(p.title||c[1])}</b>${badge(p)}</div>
        ${p.photo_path ? `<img class="comm-photo" src="${photoUrl(p.photo_path)}" alt="Foto zur Meldung" loading="lazy">` : ''}
        <p class="comm-body">${E(p.body||'')}</p>
        <div class="comm-meta">${E(p.author||'Gast')} · ${E(p.role||'Bootsfahrer')}${p.place?` · ${E(p.place)}`:''} · ${rel(p.created_at)}</div>
        <button type="button" class="comm-confirm${did?' done':''}" data-id="${E(p.id)}" ${did?'disabled':''}>
          👍 Stimmt noch${n>0?` · ${n}`:''}</button>
      </article>`; }).join('')
      : '<p class="exp-empty">Noch keine Meldungen heute — sei der Erste!</p>';
    grid.querySelectorAll<HTMLButtonElement>('.comm-confirm:not(.done)').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const rr = await fetch(`${SB}/rpc/confirm_post`, { method:'POST',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type':'application/json' },
            body: JSON.stringify({ post_id: btn.dataset.id }) });
          const n = await rr.json();
          if (typeof n === 'number' && n >= 0) {
            localStorage.setItem('wl3_confirmed', JSON.stringify([...confirmed(), btn.dataset.id]));
            btn.textContent = `✓ Bestätigt · ${n}`; btn.classList.add('done');
            if (n >= 3) { const h = btn.closest('.comm-card')?.querySelector('.comm-badge'); if (h) h.outerHTML = '<span class="comm-badge ok">🟢 von Community bestätigt</span>'; }
          } else { btn.disabled = false; }
        } catch { btn.disabled = false; }
      });
    });
  } catch {
    bdg.textContent = 'nicht erreichbar'; bdg.classList.add('err');
    grid.innerHTML = '<p class="exp-empty">📡 Community gerade nicht erreichbar.</p>';
  }
}
