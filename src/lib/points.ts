/* ═══ Punkte-Vergabe (zentrale Stelle, von Melden/Bestätigen/Bewerten aufgerufen) ═══ */
import { SB_URL, SB_KEY } from './auth';
const SB = `${SB_URL}/rest/v1`;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
export const device = () => { let d = localStorage.getItem('wl_client'); if (!d) { d = 'wl3-' + Math.random().toString(36).slice(2,10); localStorage.setItem('wl_client', d); } return d; };

export async function award(kind: string, ref?: string): Promise<{points:number;rank:string;awarded:number}|null> {
  try {
    const r = await fetch(`${SB}/rpc/award_points`, { method:'POST', headers:H,
      body: JSON.stringify({ p_device: device(), p_kind: kind, p_ref: ref||null, p_handle: localStorage.getItem('wl3_handle')||null }) });
    const j = await r.json();
    if (j?.ok) { document.dispatchEvent(new CustomEvent('wl3-points', { detail: j })); return j; }
    return null;
  } catch { return null; }
}
