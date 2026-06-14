/* ═══ Tourismusmodus · automatischer Tour-Vorschlag je Zielgruppe (Milestone 28) ═══
 * Kuratiert aus echten Reviere-Daten (touren-de.json) — keine Fake-Touren.
 * Re-pickt bei Moduswechsel, Klick öffnet die Detailansicht (Drawer). */
import { currentMode } from './modes';
import { openRevier } from './detail';

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const AUD_NOUN: Record<string, string> = { sup: 'SUP/Kajak', familie: 'Familien', hausboot: 'Hausboot', charter: 'Yacht', angler: 'Angel', tourist: 'Entdecker', kapitaen: 'Kapitäns', b2b: 'Revier', notfall: 'Revier' };
const prioRank = (p: string) => p === 'P0' ? 0 : p === 'P1' ? 1 : p === 'P2' ? 2 : 3;
const SOLO = new Set(['kapitaen', 'b2b', 'notfall']);
let ALL: any[] = [];
const BY_ID: Record<string, any> = {};

function tripType(t: any, modeId: string): string {
  const noun = AUD_NOUN[modeId] || 'Revier';
  const d = (t.dauer || '').toLowerCase();
  const span = (d.includes('tagestour') || d.includes('halbtag')) ? 'Tagestour' : (d.includes('tage') || d.includes('mehrtages') || d.includes('wochenend')) ? 'Mehrtages-Tour' : 'Revier';
  return `${noun}-${span}`;
}

function card(t: any, modeId: string): string {
  const pois = (t.pois || []).slice(0, 2).map(E).join(' · ');
  const schl = (t.schleusen === 0 || t.schleusen === '0') ? 'keine Schleusen' : `${E(t.schleusen)} Schleusen`;
  return `<article class="ts-card glass" data-open="${E(t.id)}" tabindex="0" role="button" aria-label="${E(t.name)} — Tourvorschlag">
    <div class="ts-kick">🧭 ${E(tripType(t, modeId))} · empfohlen</div>
    <h3 class="ts-name">${E(t.name)} <span class="td-prio ${String(t.importprio).toLowerCase()}">${E(t.importprio)}</span></h3>
    <div class="ts-facts">📏 ${E(t.laenge_km)} km · ⏱ ${E(t.dauer)} · 📈 ${E(t.schwierigkeit)} · 🚪 ${schl}</div>
    ${pois ? `<div class="ts-why">⭐ ${pois}</div>` : ''}
  </article>`;
}

function render() {
  const grid = document.getElementById('tsGrid'); const bdg = document.getElementById('tsBdg');
  if (!grid) return;
  const m = currentMode();
  let list = ALL.filter(t => SOLO.has(m.id) || (t.modes || []).includes(m.id));
  list.sort((a, b) => prioRank(a.importprio) - prioRank(b.importprio) || (b.start_coord ? 1 : 0) - (a.start_coord ? 1 : 0) || a.name.localeCompare(b.name));
  const top = list.slice(0, 2);
  if (bdg) bdg.textContent = `für ${m.label}`;
  grid.innerHTML = top.length ? top.map(t => card(t, m.id)).join('') : '<p class="exp-empty">Für diese Zielgruppe noch kein Vorschlag.</p>';
}

export async function initTourSuggest() {
  const anchor = document.getElementById('tourDE');
  if (!anchor || document.getElementById('tsSec')) return;
  const sec = document.createElement('div'); sec.id = 'tsSec'; sec.className = 'td-wrap';
  sec.innerHTML = `<div class="td-head">🧭 Tour-Empfehlung <span class="badge" id="tsBdg">…</span></div>
    <p class="td-note">Automatischer Vorschlag für deine Zielgruppe — kuratiert aus echten Revierdaten. Tippen öffnet die Details.</p>
    <div class="ts-grid" id="tsGrid"></div>`;
  anchor.insertAdjacentElement('beforebegin', sec);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/touren-de.json`, { signal: AbortSignal.timeout(12000) });
    const d = r.ok ? await r.json() : null;
    ALL = (d && Array.isArray(d.touren)) ? d.touren : [];
    ALL.forEach(t => BY_ID[t.id] = t);
  } catch { ALL = []; }
  if (!ALL.length) { const g = document.getElementById('tsGrid'); if (g) g.innerHTML = '<p class="exp-empty">Vorschlag gerade nicht verfügbar.</p>'; return; }
  render();
  window.addEventListener('wl3-mode', render);
  document.getElementById('tsGrid')?.addEventListener('click', (ev) => {
    const c = (ev.target as HTMLElement).closest('.ts-card'); if (!c) return;
    const t = BY_ID[c.getAttribute('data-open') || '']; if (t) openRevier(t);
  });
}
