/* ═══ Karten-Ebene · Reviere & Events als geclusterte Anker (Milestone 22) ═══
 * ADDITIV: eigene Source/Layer auf der bestehenden Karte — keine vorhandene Ebene verändert.
 * Geclustert (keine Markerflut), zielgruppen-gefiltert (wl3-mode), Klick öffnet den Detail-Drawer. */
import type { MapAPI } from '../map/map';
import { currentMode } from './modes';
import { openRevier, openEvent } from './detail';

const SOLO = new Set(['kapitaen', 'b2b', 'notfall']); // Modi ohne eigene Touren/Events → alle Anker zeigen

export async function initMapMarkers(api: MapAPI) {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const grab = (u: string) => fetch(u, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [t, e] = await Promise.all([grab(`${base}data/touren-de.json`), grab(`${base}data/events-de.json`)]);
  const TOURS: Record<string, any> = {}, EVENTS: Record<string, any> = {};
  const all: any[] = [];
  for (const r of (t?.touren || [])) { if (!r.start_coord) continue; TOURS[r.id] = r; all.push({ type: 'Feature', geometry: { type: 'Point', coordinates: r.start_coord }, properties: { kind: 'revier', id: r.id, name: r.name, modes: (r.modes || []).join(',') } }); }
  for (const ev of (e?.events || [])) { if (!ev.coord) continue; EVENTS[ev.id] = ev; all.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ev.coord }, properties: { kind: 'event', id: ev.id, name: ev.name, modes: (ev.modes || []).join(',') } }); }
  if (!all.length) return;
  const map = api.map;

  const filtered = () => { const m = currentMode().id; const showAll = SOLO.has(m); return { type: 'FeatureCollection', features: all.filter(f => showAll || !f.properties.modes || f.properties.modes.split(',').includes(m)) }; };

  if (!map.getSource('wlanchors')) {
    map.addSource('wlanchors', { type: 'geojson', data: filtered() as any, cluster: true, clusterMaxZoom: 10, clusterRadius: 48 });
    map.addLayer({ id: 'wla-cluster', type: 'circle', source: 'wlanchors', filter: ['has', 'point_count'], paint: { 'circle-color': 'rgba(25,113,154,0.9)', 'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 12, 28], 'circle-stroke-width': 2, 'circle-stroke-color': '#eafffe' } });
    map.addLayer({ id: 'wla-cluster-count', type: 'symbol', source: 'wlanchors', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#eafffe' } });
    map.addLayer({ id: 'wla-pt', type: 'circle', source: 'wlanchors', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'kind'], 'event', '#D9B14D', '#3FC3C9'], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    map.on('click', 'wla-pt', (ev: any) => { const f = ev.features && ev.features[0]; if (!f) return; const p: any = f.properties; const o = p.kind === 'revier' ? TOURS[p.id] : EVENTS[p.id]; if (!o) return; if (p.kind === 'revier') openRevier(o); else openEvent(o); });
    map.on('click', 'wla-cluster', (ev: any) => { const f = map.queryRenderedFeatures(ev.point, { layers: ['wla-cluster'] })[0]; if (!f) return; const cid = (f.properties as any).cluster_id; (map.getSource('wlanchors') as any).getClusterExpansionZoom(cid).then((z: number) => map.easeTo({ center: (f.geometry as any).coordinates, zoom: z })).catch(() => { /* */ }); });
    for (const l of ['wla-pt', 'wla-cluster']) { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); }
  }

  window.addEventListener('wl3-mode', () => { const s = map.getSource('wlanchors') as any; if (s) s.setData(filtered()); });

  const setVis = (on: boolean) => { for (const l of ['wla-cluster', 'wla-cluster-count', 'wla-pt']) { if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'); } };
  const cont = map.getContainer();
  if (!cont.querySelector('.wla-toggle')) {
    let on = true;
    const btn = document.createElement('button');
    btn.className = 'wla-toggle'; btn.type = 'button'; btn.innerHTML = '📍 Reviere &amp; Events';
    btn.title = 'Reviere- & Event-Anker auf der Karte ein/aus';
    btn.onclick = () => { on = !on; setVis(on); btn.classList.toggle('off', !on); };
    cont.appendChild(btn);
  }
}
