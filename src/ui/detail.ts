/* ═══ Premium Detail-Drawer · Reviere & Events (Milestone 20) ═══
 * Klick auf eine Revier-/Event-Karte → Glas-Drawer mit allen echten Daten, Quellen,
 * zielgruppen-bewusstem Wind-Hinweis (Lilly · M17), Favorit (lokal) & Teilen.
 * EHRLICH: GPX/PDF/Navigation als „in Vorbereitung" markiert (noch keine Geometrie). */
import { currentMode } from './modes';
import { windAdvice } from '../lib/wind';

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const BL: Record<string, string> = { SH: 'Schleswig-Holstein', HH: 'Hamburg', NI: 'Niedersachsen', HB: 'Bremen', MV: 'Meckl.-Vorpommern', BB: 'Brandenburg', BE: 'Berlin', ST: 'Sachsen-Anhalt', SN: 'Sachsen', TH: 'Thüringen', NW: 'NRW', HE: 'Hessen', RP: 'Rheinland-Pfalz', SL: 'Saarland', BW: 'Baden-Württ.', BY: 'Bayern' };
const MC: Record<string, string> = { sup: '🛶 SUP/Kajak', hausboot: '🛥️ Hausboot', charter: '⛵ Yacht/Segeln', familie: '👨‍👩‍👧 Familie', tourist: '📸 Tourist', b2b: '🏢 Branche', angler: '🎣 Angler' };
const FAV = 'wl3_favs';
export const favsList = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV) || '[]'); } catch { return []; } };
const isFav = (k: string) => favsList().includes(k);
function dispatchFav() { try { window.dispatchEvent(new CustomEvent('wl3-fav')); } catch { /* */ } }
function toggleFav(k: string): boolean { const f = favsList(); const i = f.indexOf(k); if (i >= 0) f.splice(i, 1); else f.push(k); try { localStorage.setItem(FAV, JSON.stringify(f)); } catch { /* */ } dispatchFav(); return i < 0; }
export function unfav(k: string) { const f = favsList().filter(x => x !== k); try { localStorage.setItem(FAV, JSON.stringify(f)); } catch { /* */ } dispatchFav(); }
function scrollToMap() { document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function flyToMap(coord: [number, number]) { const m: any = (window as any).__wl3map; if (m) { try { m.flyTo({ center: coord, zoom: 12.5, speed: 1.3, essential: true }); } catch { /* */ } } close(); scrollToMap(); flash('Karte fliegt zum Ort'); }
function routeTo(coord: [number, number], name?: string) { const f: any = (window as any).__wl3routeTo; if (f) { try { f(coord, name); } catch { /* */ } } close(); scrollToMap(); flash('Ziel gesetzt — Route wird geplant'); }

let drawer: HTMLElement | null = null;
function flash(msg: string) {
  const t = document.createElement('div'); t.className = 'wl-toast'; t.textContent = msg; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 1800);
}
function ensureDrawer(): HTMLElement {
  if (drawer) return drawer;
  drawer = document.createElement('div'); drawer.id = 'wlDrawer'; drawer.className = 'wl-drawer'; drawer.hidden = true;
  drawer.innerHTML = `<div class="wl-scrim" data-close></div><aside class="wl-panel glass" role="dialog" aria-modal="true" aria-label="Detailansicht"><button class="wl-x" data-close aria-label="Schließen">×</button><div class="wl-body" id="wlBody"></div></aside>`;
  document.body.appendChild(drawer);
  drawer.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer && !drawer.hidden) close(); });
  return drawer;
}
function close() { if (!drawer) return; drawer.classList.remove('in'); document.body.style.overflow = ''; setTimeout(() => { if (drawer) drawer.hidden = true; }, 240); }

function lillyWind(): string {
  const w: any = (window as any).__wlw; if (!w) return '';
  const wa = windAdvice(currentMode().id, w);
  return `<div class="wl-lilly"><span class="wl-lav">🧭</span><span><b>Lilly heute · ${E(currentMode().label)}:</b> ${wa.html}</span></div>`;
}
function actions(shareTitle: string, favKey: string, coord?: [number, number]): string {
  const mapBtns = coord
    ? `<button class="wl-act wl-act-go" data-map="${coord[0]},${coord[1]}">📍 Auf Karte zeigen</button><button class="wl-act" data-route="${coord[0]},${coord[1]}" data-rn="${E(shareTitle)}">🧭 Route hierher</button>`
    : `<button class="wl-act" disabled title="Koordinaten noch nicht hinterlegt">📍 Auf Karte (n/a)</button>`;
  return `<div class="wl-acts">${mapBtns}<button class="wl-act" data-fav="${E(favKey)}">${isFav(favKey) ? '★ Gemerkt' : '☆ Merken'}</button><button class="wl-act" data-share>📤 Teilen</button></div><div class="wl-soon">${coord ? 'Karte fliegt zum Anker · ' : 'Koordinaten noch nicht hinterlegt · '}GPX/PDF in Vorbereitung</div>`;
}
function show(html: string, shareTitle: string) {
  ensureDrawer();
  const b = document.getElementById('wlBody'); if (b) b.innerHTML = html;
  const fav = b?.querySelector('[data-fav]') as HTMLElement | null;
  fav?.addEventListener('click', () => { const now = toggleFav(fav.dataset.fav!); fav.textContent = now ? '★ Gemerkt' : '☆ Merken'; flash(now ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt'); });
  const sh = b?.querySelector('[data-share]') as HTMLElement | null;
  sh?.addEventListener('click', async () => {
    const url = location.origin + location.pathname; const text = `${shareTitle} · Wasserlage`;
    try { if ((navigator as any).share) await (navigator as any).share({ title: shareTitle, text, url }); else { await navigator.clipboard.writeText(text + ' — ' + url); flash('Link kopiert'); } } catch { /* abgebrochen */ }
  });
  const mp = b?.querySelector('[data-map]') as HTMLElement | null;
  mp?.addEventListener('click', () => { const p = mp.dataset.map!.split(',').map(Number); flyToMap([p[0], p[1]]); });
  const rt = b?.querySelector('[data-route]') as HTMLElement | null;
  rt?.addEventListener('click', () => { const p = rt.dataset.route!.split(',').map(Number); routeTo([p[0], p[1]], rt.dataset.rn); });
  drawer!.hidden = false; requestAnimationFrame(() => drawer!.classList.add('in')); document.body.style.overflow = 'hidden';
}

export function openRevier(t: any) {
  const land = (t.bundesland || []).map((c: string) => E(BL[c] || c)).join(' / ');
  const tags = (t.modes || []).map((m: string) => `<span class="td-tag">${E(MC[m] || m)}</span>`).join('');
  const fact = (ic: string, v: any) => v ? `<li><span class="wl-fi">${ic}</span>${E(v)}</li>` : '';
  const schl = (t.schleusen === 0 || t.schleusen === '0') ? 'keine Schleusen' : `${E(t.schleusen)} Schleusen`;
  const pois = (t.pois || []).map((p: string) => `<li>⭐ ${E(p)}</li>`).join('');
  const schutz = (t.schutzgebiete || []).length ? `<div class="wl-line">🌿 ${t.schutzgebiete.map(E).join(' · ')}</div>` : '';
  const umt = t.umtragen && t.umtragen !== 'keine' ? `<div class="wl-warn">⚠️ Umtragen: ${E(t.umtragen)}</div>` : '';
  const wp = (t.waypoints && t.waypoints.length) ? '<h3 class="wl-h">Wegpunktkette · ' + (t.etappen || t.waypoints.length) + ' Etappen' + ((t.schleusen && t.schleusen !== 0) ? ' · ' + E(t.schleusen) + ' Schleusen' : '') + '</h3><ul class="wl-poi">' + t.waypoints.map((w: any) => '<li>📍 ' + E(w.name) + '</li>').join('') + '</ul><div class="wl-soon">Status: ' + E(t.routeGeometryStatus || 'anchor') + ' — echte Wegpunkte, noch keine durchgehende Linie</div>' : '';
  show(`<div class="wl-kicker">${land} · ${E(t.revier)}</div>
    <h2 class="wl-title">${E(t.name)} <span class="td-prio ${String(t.importprio).toLowerCase()}">${E(t.importprio)}</span></h2>
    <div class="wl-tags">${tags}</div>
    ${lillyWind()}
    <ul class="wl-facts">${fact('📏', t.laenge_km + ' km')}${fact('⏱', t.dauer)}${fact('🌊', t.wasserart)}${fact('📈', t.schwierigkeit)}${fact('🚪', schl)}${fact('🧭', t.start + ' → ' + t.ziel)}</ul>
    ${pois ? `<h3 class="wl-h">Highlights</h3><ul class="wl-poi">${pois}</ul>` : ''}
    ${schutz}${umt}
    <div class="wl-sec">🛟 ${E(t.sicherheit)}</div>
    ${wp}
    <div class="wl-src">Quelle: <a href="${E(t.quelle)}" target="_blank" rel="noopener">${E(t.quelle_label)} ↗</a> · Qualität ${E(t.quellenqualitaet)} · Geo: ${E(t.coordsStatus)}</div>
    ${actions(t.name, 'revier:' + t.id, t.start_coord)}`, t.name);
}

export function openEvent(e: any) {
  const land = (e.bundesland || []).map((c: string) => E(BL[c] || c)).join(' / ');
  const tags = (e.modes || []).map((m: string) => `<span class="td-tag">${E(MC[m] || m)}</span>`).join('');
  const date = e.start ? `${E(e.start)} → ${E(e.end || e.start)}` : E(e.season || 'Termin n/a');
  show(`<div class="wl-kicker">${E(e.art)} · ${E(e.ort)} · ${land}</div>
    <h2 class="wl-title">${E(e.name)} <span class="td-prio ${String(e.importprio).toLowerCase()}">${E(e.importprio)}</span></h2>
    <div class="wl-tags">${tags}</div>
    <ul class="wl-facts"><li><span class="wl-fi">📅</span>${date}</li><li><span class="wl-fi">🎟️</span>Eintritt: ${E(e.eintritt)}</li><li><span class="wl-fi">👥</span>${E(e.groesse)}</li></ul>
    <div class="wl-sec">${E(e.aktivitaeten)}</div>
    <div class="wl-lilly"><span class="wl-lav">🧭</span><span><b>Lilly-Tipp:</b> ${E(e.lilly)}</span></div>
    <div class="wl-src">Quelle: <a href="${E(e.link)}" target="_blank" rel="noopener">${E(e.quelle_label)} ↗</a> · Qualität ${E(e.quellenqualitaet)} · Geo: ${E(e.coordsStatus || 'n/a')}</div>
    ${actions(e.name, 'event:' + e.id, e.coord)}`, e.name);
}
