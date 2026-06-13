/* ═══ Maritime Events · deutschlandweit (Milestone 19) ═══
 * Quellen-belegte 2026-Events aus public/data/events-de.json.
 * Kommende zuerst, zielgruppen-gefiltert, Quelle + Termin + Eintritt sichtbar, offline-fähig.
 * EHRLICH: nur belegte Termine als „exact"; sonst Saison-Label. Keine Navigation. */
import { currentMode } from './modes';

interface Evt {
  id: string; name: string; art: string; bundesland: string[]; ort: string;
  start: string | null; end: string | null; season?: string; dateStatus: string; modes: string[];
  groesse: string; aktivitaeten: string; eintritt: string; link: string; quelle_label: string;
  quellenqualitaet: string; tags: string[]; importprio: string; lilly: string;
}

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const BL: Record<string, string> = { SH: 'Schleswig-Holstein', HH: 'Hamburg', NI: 'Niedersachsen', HB: 'Bremen', MV: 'Meckl.-Vorpommern', BB: 'Brandenburg', BE: 'Berlin', ST: 'Sachsen-Anhalt', SN: 'Sachsen', TH: 'Thüringen', NW: 'NRW', HE: 'Hessen', RP: 'Rheinland-Pfalz', SL: 'Saarland', BW: 'Baden-Württ.', BY: 'Bayern' };
const MC: Record<string, string> = { sup: '🛶 SUP/Kajak', hausboot: '🛥️ Hausboot', charter: '⛵ Yacht/Segeln', familie: '👨‍👩‍👧 Familie', tourist: '📸 Tourist', b2b: '🏢 Branche', angler: '🎣 Angler' };
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const prioRank = (p: string) => p === 'P0' ? 0 : p === 'P1' ? 1 : 2;

let ALL: Evt[] = [];
const today = new Date(); today.setHours(0, 0, 0, 0);

function dateLabel(e: Evt): string {
  if (!e.start) return e.season || 'Termin n/a';
  const s = new Date(e.start + 'T00:00'), en = e.end ? new Date(e.end + 'T00:00') : s;
  return s.getMonth() === en.getMonth() ? `${s.getDate()}.–${en.getDate()}. ${MON[s.getMonth()]}` : `${s.getDate()}. ${MON[s.getMonth()]} – ${en.getDate()}. ${MON[en.getMonth()]}`;
}
function statusOf(e: Evt): 'upcoming' | 'season' | 'past' {
  if (!e.start) return 'season';
  const en = new Date((e.end || e.start) + 'T23:59');
  return en >= today ? 'upcoming' : 'past';
}

function card(e: Evt): string {
  const st = statusOf(e);
  const land = e.bundesland.map(c => E(BL[c] || c)).join(' / ');
  const tags = e.modes.map(m => `<span class="td-tag">${E(MC[m] || m)}</span>`).join('');
  const dateTxt = st === 'past' ? `${E(dateLabel(e))} · 2026 vorbei · jährlich` : E(dateLabel(e));
  return `<article class="ed-card glass${st === 'past' ? ' ed-past' : ''}">
    <div class="ed-top"><span class="ed-date">${dateTxt}</span><span class="td-prio ${e.importprio.toLowerCase()}">${E(e.importprio)}</span></div>
    <h3 class="ed-name">${E(e.name)} <span class="ed-art">${E(e.art)}</span></h3>
    <div class="ed-where">📍 ${E(e.ort)} · ${land}</div>
    <div class="ed-line">${E(e.groesse)} · Eintritt: ${E(e.eintritt)}</div>
    <div class="ed-act">${E(e.aktivitaeten)}</div>
    <div class="ed-tags">${tags}</div>
    <div class="ed-lilly"><span class="ed-lav">🧭</span>${E(e.lilly)}</div>
    <div class="ed-foot"><a class="td-src" href="${E(e.link)}" target="_blank" rel="noopener">Quelle: ${E(e.quelle_label)} ↗</a><span class="td-q q${E(e.quellenqualitaet)}">Q${E(e.quellenqualitaet)}</span></div>
  </article>`;
}

function render() {
  const grid = document.getElementById('eventsDEGrid'); const bdg = document.getElementById('eventsDEbdg');
  if (!grid) return;
  const m = currentMode();
  let list = ALL.filter(e => e.modes.includes(m.id));
  const filtered = list.length > 0;
  if (!filtered) list = ALL.slice();
  const order = { upcoming: 0, season: 1, past: 2 } as Record<string, number>;
  list.sort((a, b) => order[statusOf(a)] - order[statusOf(b)] || prioRank(a.importprio) - prioRank(b.importprio) || ((a.start || '9999') < (b.start || '9999') ? -1 : 1));
  const up = list.filter(e => statusOf(e) !== 'past').length;
  if (bdg) bdg.textContent = filtered ? `${up} kommende · ${list.length} gesamt für ${m.label}` : `${up} kommende · ${list.length} gesamt`;
  grid.innerHTML = list.map(card).join('');
}

export async function initEventsDE() {
  const anchor = document.getElementById('eventList') || document.getElementById('tourDE');
  if (!anchor || document.getElementById('eventsDE')) return;
  const sec = document.createElement('div'); sec.id = 'eventsDE'; sec.className = 'td-wrap';
  sec.innerHTML = `<div class="td-head">📅 Maritime Events · <b>deutschlandweit 2026</b> <span class="badge" id="eventsDEbdg">lädt…</span></div>
    <p class="td-note">Regatten, Hafenfeste, Tall-Ships & Wassersport-Messen — Quelle & Termin je Event. Kommende zuerst, gefiltert nach deiner Zielgruppe. Termine jährlich prüfen.</p>
    <div class="ed-grid" id="eventsDEGrid"></div>`;
  anchor.insertAdjacentElement('afterend', sec);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/events-de.json`, { signal: AbortSignal.timeout(12000) });
    const d = r.ok ? await r.json() : null;
    ALL = (d && Array.isArray(d.events)) ? d.events : [];
  } catch { ALL = []; }
  if (!ALL.length) { const g = document.getElementById('eventsDEGrid'); if (g) g.innerHTML = '<p class="exp-empty">Event-Daten gerade nicht erreichbar.</p>'; return; }
  render();
  window.addEventListener('wl3-mode', render);
}
