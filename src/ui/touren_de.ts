/* ═══ Reviere & Touren · deutschlandweit (Milestone 18) ═══
 * Kuratiertes, quellen-belegtes Revierwissen aus public/data/touren-de.json.
 * Zielgruppen-gefiltert (currentMode), Quelle je Tour sichtbar, offline-fähig (SW-Cache).
 * EHRLICH: keine Navigation — verbindlich bleiben ELWIS & amtliche Fahrrinne. */
import { currentMode } from './modes';

interface Tour {
  id: string; bundesland: string[]; revier: string; name: string; modes: string[];
  type: string; laenge_km: number; dauer: string; start: string; ziel: string; rundtour: boolean;
  schwierigkeit: string; wasserart: string; orte: string[]; pois: string[]; schleusen: any;
  umtragen: string; sicherheit: string; schutzgebiete: string[]; quelle: string; quelle_label: string;
  quellenqualitaet: string; coordsStatus: string; importprio: string;
}

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const BL: Record<string, string> = { SH: 'Schleswig-Holstein', HH: 'Hamburg', NI: 'Niedersachsen', HB: 'Bremen', MV: 'Meckl.-Vorpommern', BB: 'Brandenburg', BE: 'Berlin', ST: 'Sachsen-Anhalt', SN: 'Sachsen', TH: 'Thüringen', NW: 'NRW', HE: 'Hessen', RP: 'Rheinland-Pfalz', SL: 'Saarland', BW: 'Baden-Württ.', BY: 'Bayern' };
const MC: Record<string, string> = { sup: '🛶 SUP/Kajak', hausboot: '🛥️ Hausboot', charter: '⛵ Yacht/Charter', familie: '👨‍👩‍👧 Familie', angler: '🎣 Angler', tourist: '📸 Tourist', kapitaen: '⚓ Kapitän', b2b: '🏢 B2B', notfall: '🆘 Notfall' };
const PRIO_CLS: Record<string, string> = { P0: 'p0', P1: 'p1', P2: 'p2', P3: 'p3' };
const prioRank = (p: string) => p === 'P0' ? 0 : p === 'P1' ? 1 : p === 'P2' ? 2 : 3;

let ALL: Tour[] = [];

function card(t: Tour): string {
  const land = t.bundesland.map(c => `<span class="td-land">${E(BL[c] || c)}</span>`).join('');
  const tags = t.modes.map(m => `<span class="td-tag">${E(MC[m] || m)}</span>`).join('');
  const schl = (t.schleusen === 0 || t.schleusen === '0') ? 'keine Schleusen' : `🚪 ${E(t.schleusen)} Schleusen`;
  const facts = [`📏 ${E(t.laenge_km)} km`, `⏱ ${E(t.dauer)}`, `🌊 ${E(t.wasserart)}`, schl, `📈 ${E(t.schwierigkeit)}`]
    .map(f => `<li>${f}</li>`).join('');
  const pois = t.pois.slice(0, 3).map(E).join(' · ');
  const umt = t.umtragen && t.umtragen !== 'keine' ? `<div class="td-warn">⚠️ Umtragen: ${E(t.umtragen)}</div>` : '';
  const schutz = t.schutzgebiete.length ? `<div class="td-line">🌿 ${t.schutzgebiete.map(E).join(' · ')}</div>` : '';
  return `<article class="td-card glass">
    <div class="td-region">${land}<span class="td-rev">${E(t.revier)}</span><span class="td-prio ${PRIO_CLS[t.importprio] || 'p3'}">${E(t.importprio)}</span></div>
    <h3 class="td-name">${E(t.name)} <span class="td-type">${E(t.type)}${t.rundtour ? ' · Rundtour' : ''}</span></h3>
    <ul class="td-facts">${facts}</ul>
    <div class="td-tags">${tags}</div>
    <div class="td-line">🧭 ${E(t.start)} → ${E(t.ziel)}</div>
    ${pois ? `<div class="td-line">⭐ ${pois}</div>` : ''}
    ${schutz}${umt}
    <div class="td-sec">🛟 ${E(t.sicherheit)}</div>
    <div class="td-foot">
      <a class="td-src" href="${E(t.quelle)}" target="_blank" rel="noopener">Quelle: ${E(t.quelle_label)} ↗</a>
      <span class="td-q q${E(t.quellenqualitaet)}" title="Quellenqualität ${E(t.quellenqualitaet)}">Q${E(t.quellenqualitaet)}</span>
    </div>
  </article>`;
}

function render() {
  const grid = document.getElementById('tourDEGrid'); const bdg = document.getElementById('tourDEbdg');
  if (!grid) return;
  const m = currentMode();
  let list = ALL.filter(t => t.modes.includes(m.id));
  const filtered = list.length > 0;
  if (!filtered) list = ALL.slice();   // Modi ohne Touren-Treffer (z. B. Kapitän/B2B/Notfall) → alle Reviere zeigen
  list.sort((a, b) => prioRank(a.importprio) - prioRank(b.importprio) || a.name.localeCompare(b.name));
  if (bdg) bdg.textContent = filtered ? `${list.length} Reviere für ${m.label}` : `${list.length} Reviere · alle`;
  grid.innerHTML = list.map(card).join('');
}

export async function initTourenDE() {
  const anchor = document.getElementById('tourGrid');
  if (!anchor || document.getElementById('tourDE')) return;
  const sec = document.createElement('div'); sec.id = 'tourDE'; sec.className = 'td-wrap';
  sec.innerHTML = `<div class="td-head">🇩🇪 Reviere & Touren · <b>deutschlandweit</b> <span class="badge" id="tourDEbdg">lädt…</span></div>
    <p class="td-note">Kuratiertes Revierwissen aus offiziellen Portalen — Quelle je Tour ausgewiesen. <b>Keine Navigation</b>, verbindlich bleiben ELWIS & Fahrrinne. Gefiltert nach deiner Zielgruppe.</p>
    <div class="td-grid" id="tourDEGrid"></div>`;
  anchor.insertAdjacentElement('afterend', sec);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/touren-de.json`, { signal: AbortSignal.timeout(12000) });
    const d = r.ok ? await r.json() : null;
    ALL = (d && Array.isArray(d.touren)) ? d.touren : [];
  } catch { ALL = []; }
  if (!ALL.length) { const g = document.getElementById('tourDEGrid'); if (g) g.innerHTML = '<p class="exp-empty">Revierdaten gerade nicht erreichbar.</p>'; return; }
  render();
  window.addEventListener('wl3-mode', render);
}
