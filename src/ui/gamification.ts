/* ═══ Community-Gamification · Captain-Pass (Punkte/Rang/Badges) + Leaderboard ═══ */
import { SB_URL, SB_KEY } from '../lib/auth';
import { device } from '../lib/points';
const SB = `${SB_URL}/rest/v1`;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };

const RANKS: [number,string,string][] = [
  [0,'decksmann','Decksmann'],[40,'matrose','Matrose'],[100,'bootsmann','Bootsmann'],
  [250,'steuermann','Steuermann'],[500,'kapitaen','Kapitän'],[1000,'commodore','Commodore'],
];
const rankLabel = (id:string) => (RANKS.find(r=>r[1]===id)||RANKS[0])[2];
const nextRank = (pts:number) => RANKS.find(r=>r[0]>pts);
const BADGES: Record<string,[string,string]> = {
  first_report:['📣','Erste Meldung'], confirmer:['👍','Bestätiger'], rater:['⭐','Bewerter'],
  photographer:['📷','Fotograf'], local_hero:['🏅','Revierkenner'],
};

export function initGamification() {
  const passEl = document.getElementById('captainPass');
  const lbEl = document.getElementById('leaderboard');
  if (passEl) renderPass(passEl);
  if (lbEl) renderLeaderboard(lbEl);
  document.addEventListener('wl3-points', () => { if (passEl) renderPass(passEl); });
}

async function renderPass(el: HTMLElement) {
  let p: any = null;
  try { const r = await fetch(`${SB}/profile?device=eq.${encodeURIComponent(device())}&select=handle,points,rank,badges`, { headers: H }); p = (await r.json())[0]; } catch {}
  const pts = p?.points || 0; const rk = p?.rank || 'decksmann'; const nx = nextRank(pts);
  const handle = localStorage.getItem('wl3_handle') || p?.handle || '';
  const prog = nx ? Math.round((pts - (RANKS.find(r=>r[1]===rk)?.[0]||0)) / (nx[0] - (RANKS.find(r=>r[1]===rk)?.[0]||0)) * 100) : 100;
  el.innerHTML = `
    <div class="pass-top">
      <div class="pass-rank">⚓ <b>${E(rankLabel(rk))}</b></div>
      <div class="pass-pts">${pts} Punkte</div>
    </div>
    <input id="passHandle" class="pass-handle" placeholder="Dein Skipper-Name (optional)" value="${E(handle)}" maxlength="24">
    <div class="pass-bar"><span style="width:${prog}%"></span></div>
    <div class="pass-next">${nx ? `Noch ${nx[0]-pts} Punkte bis <b>${E(rankLabel(nx[1]))}</b>` : 'Höchster Rang erreicht — Commodore! 🎖️'}</div>
    <div class="pass-badges">${(p?.badges||[]).length ? (p.badges as string[]).map(b=>BADGES[b]?`<span title="${E(BADGES[b][1])}">${BADGES[b][0]}</span>`:'').join('') : '<small>Sammle Badges durch Melden, Bestätigen & Bewerten.</small>'}</div>
    <p class="pass-how">So sammelst du Punkte: Meldung +10 · Bestätigen +5 · Bewerten +4 · Foto +8 · neuen Spot vorschlagen +12.</p>`;
  const h = el.querySelector('#passHandle') as HTMLInputElement;
  h?.addEventListener('change', ()=>localStorage.setItem('wl3_handle', h.value.trim().slice(0,24)));
}

async function renderLeaderboard(el: HTMLElement) {
  try {
    const r = await fetch(`${SB}/leaderboard?select=handle,points,rank,pos&limit=10`, { headers: H, signal: AbortSignal.timeout(10000) });
    const rows = await r.json();
    el.innerHTML = rows.length ? rows.map((x:any)=>`<div class="lb-row"><span class="lb-pos">${x.pos}</span><b>${E(x.handle)}</b><span class="lb-rank">${E(rankLabel(x.rank))}</span><em>${x.points}</em></div>`).join('')
      : '<p class="exp-empty">Noch keine Platzierungen — sei die/der Erste und melde etwas!</p>';
  } catch { el.innerHTML = '<p class="exp-empty">Rangliste gerade nicht erreichbar.</p>'; }
}
