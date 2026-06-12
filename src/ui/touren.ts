/* ═══ Touren & Events 3.0 · Revier-Steckbriefe + Saison-Events (Supabase, RLS) ═══ */
import { SB_URL, SB_KEY } from '../lib/auth';
const SB = `${SB_URL}/rest/v1`;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };

export async function initTouren() {
  const tEl = document.getElementById('tourGrid');
  const evEl = document.getElementById('eventList');
  const bdg = document.getElementById('bdgTouren');
  try {
    const [tr, er] = await Promise.all([
      fetch(`${SB}/tour?select=id,revier,title,subtitle,story&visibility=eq.public&order=id`, { headers: H, signal: AbortSignal.timeout(12000) }),
      fetch(`${SB}/events?select=title,date_label,location,icon,url&active=eq.true&order=sort`, { headers: H, signal: AbortSignal.timeout(12000) })
    ]);
    const tours = tr.ok ? await tr.json() : [];
    const events = er.ok ? await er.json() : [];
    if (bdg) bdg.textContent = `● ${tours.length} Reviere · ${events.length} Events`;
    if (tEl) tEl.innerHTML = tours.map((t:any) => `
      <article class="tour-card glass">
        <div class="tour-head"><b>${E(t.title)}</b><span class="tour-sub">${E(t.subtitle||'')}</span></div>
        <ul class="tour-facts">${(t.story?.facts||[]).map((f:any)=>`<li><span class="ic">${E(f.ic)}</span>${E(f.t)}</li>`).join('')}</ul>
      </article>`).join('');
    if (evEl) evEl.innerHTML = events.length ? events.map((e:any) => `
      <div class="ev-row glass">
        <span class="ev-ic">${E(e.icon||'🎉')}</span>
        <div class="ev-main"><b>${E(e.title)}</b><span>${E(e.location||'')}</span></div>
        <span class="ev-date">${E(e.date_label||'')}</span>
      </div>`).join('') : '<p class="exp-empty">Saisonpause — neue Events folgen.</p>';
  } catch {
    if (bdg) { bdg.textContent = 'nicht erreichbar'; bdg.classList.add('err'); }
  }
}
