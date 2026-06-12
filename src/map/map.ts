/* ═══ Karte 3.0 · MapLibre GL + POI-Layer aus Single Source of Truth (pois.geojson) ═══ */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface KindDef { kind:string; label:string; icon:string; color:string; default:boolean }
export const KINDS: KindDef[] = [
  { kind:'gelbe_welle', label:'Gelbe Welle',     icon:'🌊', color:'#e8b54d', default:true },
  { kind:'hafen',       label:'Häfen & Gastlieger', icon:'⚓', color:'#1f6fa8', default:true },
  { kind:'schleuse',    label:'Schleusen',       icon:'🚪', color:'#0e8f9c', default:true },
  { kind:'tank',        label:'Tanken',          icon:'⛽', color:'#c0392b', default:true },
  { kind:'gastro',      label:'Gastronomie',     icon:'🍽️', color:'#9b59b6', default:false },
  { kind:'charter',     label:'Charter',         icon:'⛵', color:'#16a085', default:false },
  { kind:'badestelle',  label:'Badestellen',     icon:'🏖️', color:'#27c08d', default:false },
  { kind:'slip',        label:'Slipanlagen',     icon:'🛞', color:'#7f8c8d', default:false },
  { kind:'entsorgung',  label:'Entsorgung & Pump-Out', icon:'♻️', color:'#2e8b57', default:false },
  { kind:'werkstatt',   label:'Werkstatt',       icon:'🛠️', color:'#8d6e63', default:false },
  { kind:'shop',        label:'Proviant',        icon:'🛒', color:'#e67e22', default:false },
  { kind:'medizin',     label:'Medizin',         icon:'⚕️', color:'#e74c8c', default:false },
  { kind:'sight',       label:'Highlights',      icon:'🏰', color:'#34495e', default:false },
  { kind:'event',       label:'Events',          icon:'🎉', color:'#d35400', default:false },
  { kind:'wsp',         label:'WSP & Notfall',   icon:'🚨', color:'#c0392b', default:false },
  { kind:'notfall',     label:'Notfall',         icon:'🆘', color:'#c0392b', default:false },
];

export interface MapAPI { map: maplibregl.Map; setKinds(on: Set<string>): void; activeKinds: Set<string> }

export async function initMap(container: string): Promise<MapAPI> {
  const map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [13.35, 52.41], zoom: 8.6, pitch: 0, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions:{ enableHighAccuracy:true }, trackUserLocation:true }), 'top-left');

  await new Promise<void>(res => map.on('load', () => res()));

  /* OpenSeaMap-Seezeichen als Overlay */
  map.addSource('seamarks', { type:'raster', tiles:['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenSeaMap' });
  map.addLayer({ id:'seamarks', type:'raster', source:'seamarks', paint:{ 'raster-opacity':0.85 }, minzoom:10 });

  /* POIs: EINE Quelle */
  const pois = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json());
  map.addSource('pois', { type:'geojson', data: pois });

  const active = new Set(KINDS.filter(k=>k.default).map(k=>k.kind));

  const colorExpr: any = ['match', ['get','kind'], ...KINDS.flatMap(k=>[k.kind,k.color]), '#888'];
  map.addLayer({ id:'poi-halo', type:'circle', source:'pois',
    paint:{ 'circle-radius':11, 'circle-color':colorExpr, 'circle-opacity':0.25, 'circle-blur':0.4 } });
  map.addLayer({ id:'poi-dot', type:'circle', source:'pois',
    paint:{ 'circle-radius':5.5, 'circle-color':colorExpr, 'circle-stroke-width':1.6, 'circle-stroke-color':'#ffffff' } });
  map.addLayer({ id:'poi-icon', type:'symbol', source:'pois', minzoom:10.5,
    layout:{ 'text-field':(['match',['get','kind'], ...KINDS.flatMap(k=>[k.kind,k.icon]), '📍'] as any),
      'text-size':14, 'text-offset':[0,-1.4], 'text-allow-overlap':false } });

  function applyFilter() {
    const f: any = ['in', ['get','kind'], ['literal', [...active]]];
    for (const id of ['poi-halo','poi-dot','poi-icon']) map.setFilter(id, f);
  }
  applyFilter();

  const E = (s:string) => { const d=document.createElement('div'); d.textContent=s??''; return d.innerHTML; };
  map.on('click', 'poi-dot', (e) => {
    const f = e.features?.[0]; if (!f) return;
    const p: any = f.properties;
    const tags = (()=>{ try { return JSON.parse(p.tags||'[]'); } catch { return []; } })();
    const kd = KINDS.find(k=>k.kind===p.kind);
    const acts = [
      p.tel ? `<a href="tel:${E(String(p.tel).replace(/[^0-9+]/g,''))}">📞 ${E(p.tel)}</a>` : '',
      p.web ? `<a href="https://${E(p.web)}" target="_blank" rel="noopener">🌐 Web</a>` : '',
      `<a href="https://www.google.com/maps/dir/?api=1&destination=${(f.geometry as any).coordinates[1]},${(f.geometry as any).coordinates[0]}" target="_blank" rel="noopener">🧭 Route</a>`,
    ].filter(Boolean).join('');
    const q = p.quality==='verified' ? '<span class="pp-q verified">✓ verifiziert</span>' : '<span class="pp-q curated">kuratiert</span>';
    new maplibregl.Popup({ offset: 14, maxWidth: '300px' })
      .setLngLat((f.geometry as any).coordinates)
      .setHTML(`<div class="pp-kind">${kd?.icon??''} ${E(kd?.label??p.kind)}${q}</div>
        <div class="pp-name">${E(p.name)}</div>
        <div class="pp-desc">${E(p.desc||'')}${tags.length?'<br><small>'+tags.map((t:string)=>'· '+E(t)).join(' ')+'</small>':''}</div>
        ${acts?`<div class="pp-acts">${acts}</div>`:''}
        <div class="pp-meta">Quelle: ${E(p.source)}${p.verified_at?` · geprüft ${E(p.verified_at)}`:''} · Koordinate: ${E(p.coord_quality)}</div>`)
      .addTo(map);
  });
  map.on('mouseenter','poi-dot',()=>{ map.getCanvas().style.cursor='pointer'; });
  map.on('mouseleave','poi-dot',()=>{ map.getCanvas().style.cursor=''; });

  return { map, activeKinds: active, setKinds(on) { active.clear(); on.forEach(k=>active.add(k)); applyFilter(); } };
}

/* ELWIS-Gefahren als eigene Ebene (heute aktive, grob nach Wasserstraße verortet — wie 2.0) */
const WW: [string,number,number][] = [['untere havel',52.60,12.40],['potsdamer havel',52.39,13.06],['havel-oder',52.77,13.60],['oder-havel',52.77,13.60],['spree-oder',52.34,14.05],['teltow',52.40,13.25],['dahme',52.33,13.63],['müggel',52.44,13.64],['beetzsee',52.43,12.58],['templiner',53.12,13.02],['finow',52.83,13.70],['rüdersdorf',52.47,13.78],['storkow',52.25,13.93],['scharmützel',52.24,14.05],['landwehrkanal',52.50,13.39],['spree',52.45,13.50],['havel',52.46,13.05],['oder',52.58,14.30]];
export function addNoticeMarkers(api: MapAPI, notices: {waterway:string;description:string;type:string;detail_url:string}[]) {
  const feats = notices.map((n,idx) => {
    const w = (n.waterway||'').toLowerCase();
    const hit = WW.find(x=>w.includes(x[0])); if (!hit) return null;
    // deterministischer Versatz statt Zufall (stabil über Reloads)
    const dx = ((idx*73)%100-50)/2000, dy = ((idx*37)%100-50)/2500;
    return { type:'Feature', geometry:{ type:'Point', coordinates:[hit[2]+dx, hit[1]+dy] },
      properties:{ kind:'elwis', name:n.waterway, desc:n.description?.slice(0,180)||'Einschränkung', sev:n.type, url:n.detail_url } };
  }).filter(Boolean);
  api.map.addSource('elwis', { type:'geojson', data:{ type:'FeatureCollection', features: feats as any } });
  api.map.addLayer({ id:'elwis-halo', type:'circle', source:'elwis',
    paint:{ 'circle-radius':13,'circle-color':['match',['get','sev'],'red','#ff5d5d','orange','#f5b73c','#f5d97c'],'circle-opacity':0.3,'circle-blur':0.3 } });
  api.map.addLayer({ id:'elwis-dot', type:'circle', source:'elwis',
    paint:{ 'circle-radius':6,'circle-color':['match',['get','sev'],'red','#ff5d5d','orange','#f5b73c','#f5d97c'],'circle-stroke-width':2,'circle-stroke-color':'#fff' } });
  const E=(s:string)=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML;};
  api.map.on('click','elwis-dot',(e)=>{ const f=e.features?.[0]; if(!f) return; const p:any=f.properties;
    new maplibregl.Popup({offset:14}).setLngLat((f.geometry as any).coordinates)
      .setHTML(`<div class="pp-kind">⚠️ Amtliche Meldung (ELWIS)</div><div class="pp-name">${E(p.name)}</div>
        <div class="pp-desc">${E(p.desc)}</div>
        <div class="pp-acts">${p.url?`<a href="${E(p.url)}" target="_blank" rel="noopener">ELWIS ›</a>`:''}</div>
        <div class="pp-meta">Lage grob nach Wasserstraße verortet · verbindlich: ELWIS.de</div>`).addTo(api.map); });
}
