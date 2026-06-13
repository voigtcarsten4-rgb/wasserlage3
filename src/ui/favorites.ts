/* ═══ Favoriten · Meine Reviere & Events (Milestone 21) ═══
 * Nutzt wl3_favs (Drawer-Favoriten), öffnet den Detail-Drawer, offline-fähig.
 * Reagiert live auf 'wl3-fav' (Merken/Entfernen aus dem Drawer). */
import { favsList, unfav, openRevier, openEvent } from './detail';

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const TOURS: Record<string, any> = {};
const EVENTS: Record<string, any> = {};
let loaded = false;

async function load() {
  if (loaded) return;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const grab = (u: string) => fetch(u, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [t, e] = await Promise.all([grab(`${base}data/touren-de.json`), grab(`${base}data/events-de.json`)]);
  (t?.touren || []).forEach((x: any) => TOURS[x.id] = x);
  (e?.events || []).forEach((x: any) => EVENTS[x.id] = x);
  loaded = true;
}

function card(kind: string, o: any, key: string): string {
  const sub = kind === 'revier' ? (o.bundesland || []).join('/') + ' · ' + E(o.revier) : E(o.art) + ' · ' + E(o.ort);
  return `<article class="fav-card glass" data-open="${kind}:${E(o.id)}" tabindex="0" role="button" aria-label="${E(o.name)}">
    <div class="fav-main"><span class="fav-ic">${kind === 'revier' ? '🚤' : '📅'}</span><div class="fav-tx"><b>${E(o.name)}</b><span class="fav-sub">${sub}</span></div></div>
    <button class="fav-x" data-rm="${E(key)}" title="Aus Favoriten entfernen" aria-label="Entfernen">★</button>
  </article>`;
}

function render() {
  const grid = document.getElementById('favGrid'); const bdg = document.getElementById('favBdg');
  if (!grid) return;
  const items = favsList().map(k => { const [kind, id] = k.split(':'); const o = kind === 'revier' ? TOURS[id] : EVENTS[id]; return o ? { kind, o, key: k } : null; }).filter(Boolean) as any[];
  if (bdg) bdg.textContent = items.length ? `${items.length} gespeichert` : 'leer';
  if (!items.length) { grid.innerHTML = `<div class="fav-empty">⭐ Noch keine Favoriten. Tippe in einer Revier- oder Event-Karte auf <b>☆ Merken</b> — sie erscheinen hier, auch offline.</div>`; return; }
  grid.innerHTML = items.map(i => card(i.kind, i.o, i.key)).join('');
}

export async function initFavorites() {
  const anchor = document.getElementById('eventsDE') || document.getElementById('tourDE');
  if (!anchor || document.getElementById('favSec')) return;
  const sec = document.createElement('div'); sec.id = 'favSec'; sec.className = 'td-wrap';
  sec.innerHTML = `<div class="td-head">⭐ Meine Reviere & Events <span class="badge" id="favBdg">leer</span></div>
    <p class="td-note">Deine gemerkten Reviere und Events — offline verfügbar. Tippen öffnet die Detailansicht.</p>
    <div class="fav-grid" id="favGrid"></div>`;
  anchor.insertAdjacentElement('afterend', sec);
  await load();
  render();
  window.addEventListener('wl3-fav', render);
  document.getElementById('favGrid')?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const rm = t.closest('[data-rm]') as HTMLElement | null;
    if (rm) { ev.stopPropagation(); unfav(rm.getAttribute('data-rm')!); return; }
    const c = t.closest('[data-open]') as HTMLElement | null; if (!c) return;
    const [kind, id] = c.getAttribute('data-open')!.split(':');
    const o = kind === 'revier' ? TOURS[id] : EVENTS[id]; if (!o) return;
    if (kind === 'revier') openRevier(o); else openEvent(o);
  });
}
