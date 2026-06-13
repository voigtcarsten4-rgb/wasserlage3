/* ═══ POI-Bewertungen · Sterne lesen/abgeben (Supabase, RLS, 1 Vote/Gerät) ═══ */
import { SB_URL, SB_KEY } from './auth';
const SB = `${SB_URL}/rest/v1`;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const device = () => { let d = localStorage.getItem('wl_client'); if (!d) { d = 'wl3-' + Math.random().toString(36).slice(2,10); localStorage.setItem('wl_client', d); } return d; };
const ratedKey = (id:string) => 'wl3_rated_' + id;
const RATE_KINDS = new Set(['hafen','gelbe_welle','gastro','charter','badestelle','tank','anleger']);

export function ratingAllowed(kind: string) { return RATE_KINDS.has(kind); }

export async function fetchSummary(poiId: string): Promise<{avg:number;n:number}|null> {
  try {
    const r = await fetch(`${SB}/poi_rating_summary?poi_id=eq.${encodeURIComponent(poiId)}&select=avg_stars,n`,
      { headers: H, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return j[0] ? { avg: +j[0].avg_stars, n: +j[0].n } : { avg: 0, n: 0 };
  } catch { return null; }
}

/* Mountet ein interaktives Sterne-Widget in den Container (nach Popup-Open) */
export function mountRating(host: HTMLElement, poiId: string) {
  const already = localStorage.getItem(ratedKey(poiId));
  host.innerHTML = `<div class="rate-row" data-poi="${poiId}">
    ${[1,2,3,4,5].map(s=>`<button class="rate-star" data-s="${s}" ${already?'disabled':''} aria-label="${s} Sterne">★</button>`).join('')}
    <span class="rate-info">${already?'Danke für deine Bewertung':'Bewerten'}</span></div>`;
  fetchSummary(poiId).then(sum => {
    const info = host.querySelector('.rate-info') as HTMLElement;
    if (sum && sum.n > 0 && info && !already) info.textContent = `Ø ${sum.avg} (${sum.n})`;
    if (sum && sum.n > 0 && already) (host.querySelector('.rate-info') as HTMLElement).textContent = `Ø ${sum.avg} (${sum.n}) · danke`;
  });
  if (already) return;
  const stars = [...host.querySelectorAll<HTMLButtonElement>('.rate-star')];
  const paint = (n:number) => stars.forEach((b,i)=>b.classList.toggle('on', i<n));
  stars.forEach((b,i)=>{
    b.addEventListener('mouseenter', ()=>paint(i+1));
    b.addEventListener('click', async ()=>{
      const s = +b.dataset.s!;
      stars.forEach(x=>x.disabled=true);
      const info = host.querySelector('.rate-info') as HTMLElement; info.textContent = 'Sende …';
      try {
        const r = await fetch(`${SB}/poi_rating`, { method:'POST',
          headers:{ ...H, 'Content-Type':'application/json', Prefer:'return=minimal' },
          body: JSON.stringify({ poi_id: poiId, stars: s, device: device() }) });
        if (!r.ok && r.status !== 409) throw 0;
        localStorage.setItem(ratedKey(poiId), String(s)); paint(s);
        info.textContent = 'Danke für deine Bewertung';
      } catch { info.textContent = 'Fehler — später erneut'; stars.forEach(x=>x.disabled=false); }
    });
  });
  host.querySelector('.rate-row')?.addEventListener('mouseleave', ()=>paint(0));
}
