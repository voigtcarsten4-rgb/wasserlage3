/* ═══ Karte 3.0 · MapLibre GL · Cluster + Lazy-DE-Loading + Suche (Phase D) ═══ */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface KindDef { kind:string; label:string; icon:string; color:string; default:boolean; group:string }
export const KINDS: KindDef[] = [
  { kind:'gelbe_welle', label:'Gelbe Welle',        icon:'🌊', color:'#e8b54d', default:true,  group:'liegen' },
  { kind:'hafen',       label:'Häfen & Marinas',    icon:'⚓', color:'#1f6fa8', default:true,  group:'liegen' },
  { kind:'anleger',     label:'Gastanleger',        icon:'🪢', color:'#3b82a0', default:false, group:'liegen' },
  { kind:'schleuse',    label:'Schleusen',          icon:'🚪', color:'#0e8f9c', default:true,  group:'fahrt' },
  { kind:'tank',        label:'Tanken',             icon:'⛽', color:'#c0392b', default:true,  group:'versorgung' },
  { kind:'entsorgung',  label:'Entsorgung',         icon:'♻️', color:'#2e8b57', default:false, group:'versorgung' },
  { kind:'slip',        label:'Slipanlagen',        icon:'🛞', color:'#7f8c8d', default:false, group:'fahrt' },
  { kind:'werkstatt',   label:'Werkstatt',          icon:'🛠️', color:'#8d6e63', default:false, group:'versorgung' },
  { kind:'shop',        label:'Proviant',           icon:'🛒', color:'#e67e22', default:false, group:'versorgung' },
  { kind:'gastro',      label:'Gastronomie',        icon:'🍽️', color:'#9b59b6', default:false, group:'erlebnis' },
  { kind:'badestelle',  label:'Badestellen',        icon:'🏖️', color:'#27c08d', default:false, group:'erlebnis' },
  { kind:'sight',       label:'Highlights',         icon:'🏰', color:'#34495e', default:false, group:'erlebnis' },
  { kind:'event',       label:'Events',             icon:'🎉', color:'#d35400', default:false, group:'erlebnis' },
  { kind:'charter',     label:'Charter & Verleih',  icon:'⛵', color:'#16a085', default:false, group:'erlebnis' },
  { kind:'medizin',     label:'Medizin',            icon:'⚕️', color:'#e74c8c', default:false, group:'sicherheit' },
  { kind:'wsp',         label:'WSP & Rettung',      icon:'🚨', color:'#c0392b', default:false, group:'sicherheit' },
  { kind:'notfall',     label:'Notfall',            icon:'🆘', color:'#c0392b', default:false, group:'sicherheit' },
];
export const GROUPS: Record<string,{label:string;icon:string}> = {
  liegen:     { label:'Liegen & Häfen', icon:'⚓' },
  fahrt:      { label:'Fahrt & Schleusen', icon:'🚪' },
  versorgung: { label:'Versorgung', icon:'⛽' },
  erlebnis:   { label:'Erlebnis', icon:'🏖️' },
  sicherheit: { label:'Sicherheit', icon:'🚨' },
};
/* Bundesländer: bbox [minlon,minlat,maxlon,maxlat] — Lazy-Loading & Filter */
export const LAENDER: Record<string,{name:string;bbox:[number,number,number,number]}> = {
  BW:{name:'Baden-Württemberg',bbox:[7.50,47.50,10.50,49.80]}, BY:{name:'Bayern',bbox:[8.97,47.27,13.84,50.56]},
  BE:{name:'Berlin',bbox:[13.08,52.33,13.77,52.69]}, BB:{name:'Brandenburg',bbox:[11.27,51.36,14.77,53.56]},
  HB:{name:'Bremen',bbox:[8.48,53.01,8.99,53.61]}, HH:{name:'Hamburg',bbox:[9.73,53.39,10.33,53.74]},
  HE:{name:'Hessen',bbox:[7.77,49.39,10.24,51.66]}, MV:{name:'Mecklenburg-Vorpommern',bbox:[10.59,53.11,14.41,54.69]},
  NI:{name:'Niedersachsen',bbox:[6.65,51.29,11.60,53.89]}, NW:{name:'Nordrhein-Westfalen',bbox:[5.87,50.32,9.46,52.53]},
  RP:{name:'Rheinland-Pfalz',bbox:[6.11,48.97,8.51,50.94]}, SL:{name:'Saarland',bbox:[6.36,49.11,7.40,49.64]},
  SN:{name:'Sachsen',bbox:[11.87,50.17,15.04,51.68]}, ST:{name:'Sachsen-Anhalt',bbox:[10.56,50.94,13.19,53.04]},
  SH:{name:'Schleswig-Holstein',bbox:[7.87,53.36,11.31,55.06]}, TH:{name:'Thüringen',bbox:[9.88,50.20,12.65,51.65]},
};

export interface MapAPI {
  map: maplibregl.Map;
  setKinds(on: Set<string>): void;
  activeKinds: Set<string>;
  features(): any[];
  flyToLand(code: string): void;
  search(q: string): { name:string; sub:string; lng:number; lat:number }[];
}

const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const bboxIntersect = (a:[number,number,number,number], b:[number,number,number,number]) =>
  a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];

export async function initMap(container: string): Promise<MapAPI> {
  const map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [13.35, 52.41], zoom: 8.6, pitch: 0, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions:{ enableHighAccuracy:true }, trackUserLocation:true }), 'top-left');

  await new Promise<void>(res => map.on('load', () => res()));

  map.addSource('seamarks', { type:'raster', tiles:['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenSeaMap' });
  map.addLayer({ id:'seamarks', type:'raster', source:'seamarks', paint:{ 'raster-opacity':0.85 }, minzoom:10 });

  /* ── Datenhaltung: kuratiert (B/BB) sofort, weitere Länder lazy nach Viewport ── */
  const allFeatures: any[] = [];
  const haveIds = new Set<string>();
  const loadedLands = new Set<string>(['BE','BB']); // im Basis-GeoJSON enthalten
  const addFeatures = (feats: any[]) => {
    let n = 0;
    for (const f of feats) {
      const id = f.properties?.id; if (!id || haveIds.has(id)) continue;
      haveIds.add(id); allFeatures.push(f); n++;
    }
    if (n) refresh();
    return n;
  };
  /* Quelle hält nur aktive Kinds → Cluster-Zahlen stimmen mit Filter überein */
  const refresh = () => (map.getSource('pois') as maplibregl.GeoJSONSource)
    ?.setData({ type:'FeatureCollection', features: allFeatures.filter(f=>active.has(f.properties.kind)) } as any);

  const base = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then(r=>r.json());
  base.features.forEach((f:any)=>{ haveIds.add(f.properties.id); allFeatures.push(f); });

  const active = new Set(KINDS.filter(k=>k.default).map(k=>k.kind));
  map.addSource('pois', { type:'geojson',
    data:{ type:'FeatureCollection', features: allFeatures.filter(f=>active.has(f.properties.kind)) } as any,
    cluster:true, clusterMaxZoom:11, clusterRadius:46 });

  async function lazyLoadVisible() {
    const b = map.getBounds();
    const vb: [number,number,number,number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (map.getZoom() < 5.5) return;
    for (const [code, L] of Object.entries(LAENDER)) {
      if (loadedLands.has(code) || !bboxIntersect(vb, L.bbox)) continue;
      loadedLands.add(code);
      fetch(`${import.meta.env.BASE_URL}data/de/${code}.json`)
        .then(r => r.ok ? r.json() : null)
        .then(fc => { if (fc?.features) addFeatures(fc.features); })
        .catch(()=>{ loadedLands.delete(code); });
    }
  }
  map.on('moveend', lazyLoadVisible);

  const colorExpr: any = ['match', ['get','kind'], ...KINDS.flatMap(k=>[k.kind,k.color]), '#888'];

  /* Cluster-Darstellung (Glas-Navy, Anzahl) */
  map.addLayer({ id:'poi-cluster', type:'circle', source:'pois', filter:['has','point_count'],
    paint:{ 'circle-color':'rgba(14,46,77,0.82)', 'circle-stroke-color':'rgba(123,216,232,0.65)', 'circle-stroke-width':1.6,
      'circle-radius':['step',['get','point_count'],14, 25,18, 100,24, 400,30] } });
  map.addLayer({ id:'poi-cluster-count', type:'symbol', source:'pois', filter:['has','point_count'],
    layout:{ 'text-field':['get','point_count_abbreviated'], 'text-size':12, 'text-font':['Noto Sans Regular'] }, paint:{ 'text-color':'#dff3f8' } });
  map.on('click','poi-cluster', async (e) => {
    const f = e.features?.[0]; if (!f) return;
    const src = map.getSource('pois') as maplibregl.GeoJSONSource;
    const z = await src.getClusterExpansionZoom((f.properties as any).cluster_id);
    map.easeTo({ center:(f.geometry as any).coordinates, zoom: z + 0.3 });
  });

  map.addLayer({ id:'poi-halo', type:'circle', source:'pois', filter:['!',['has','point_count']],
    paint:{ 'circle-radius':11, 'circle-color':colorExpr, 'circle-opacity':0.25, 'circle-blur':0.4 } });
  map.addLayer({ id:'poi-dot', type:'circle', source:'pois', filter:['!',['has','point_count']],
    paint:{ 'circle-radius':5.5, 'circle-color':colorExpr, 'circle-stroke-width':1.6, 'circle-stroke-color':'#ffffff' } });
  map.addLayer({ id:'poi-icon', type:'symbol', source:'pois', minzoom:10.5, filter:['!',['has','point_count']],
    layout:{ 'text-field':(['match',['get','kind'], ...KINDS.flatMap(k=>[k.kind,k.icon]), '📍'] as any),
      'text-size':14, 'text-offset':[0,-1.4], 'text-allow-overlap':false, 'text-font':['Noto Sans Regular'] } });

  const applyFilter = () => refresh();

  /* Popup mit Qualitätsstatus, Quelle, Stand */
  map.on('click', 'poi-dot', (e) => {
    const f = e.features?.[0]; if (!f) return;
    const p: any = f.properties;
    const tags = (()=>{ try { return JSON.parse(p.tags||'[]'); } catch { return Array.isArray(p.tags)?p.tags:[]; } })();
    const kd = KINDS.find(k=>k.kind===p.kind);
    const acts = [
      p.tel ? `<a href="tel:${E(String(p.tel).replace(/[^0-9+]/g,''))}">📞 ${E(p.tel)}</a>` : '',
      p.web ? `<a href="https://${E(String(p.web).replace(/^https?:\/\//,''))}" target="_blank" rel="noopener">🌐 Web</a>` : '',
      `<a href="https://www.google.com/maps/dir/?api=1&destination=${(f.geometry as any).coordinates[1]},${(f.geometry as any).coordinates[0]}" target="_blank" rel="noopener">🧭 Route</a>`,
    ].filter(Boolean).join('');
    const q = p.b2b_status==='verified' || p.b2b_status==='premium' ? '<span class="pp-q verified">★ Partner · verifiziert</span>'
      : p.quality==='verified' ? '<span class="pp-q verified">✓ verifiziert</span>'
      : p.quality==='curated' ? '<span class="pp-q curated">kuratiert</span>'
      : '<span class="pp-q unverified">ungeprüft</span>';
    const confirms = Number(p.community_confirms||0) >= 3 ? ' · 🟢 Community-bestätigt' : '';
    new maplibregl.Popup({ offset: 14, maxWidth: '300px' })
      .setLngLat((f.geometry as any).coordinates)
      .setHTML(`<div class="pp-kind">${kd?.icon??''} ${E(kd?.label??p.kind)}${q}</div>
        <div class="pp-name">${E(p.name)}</div>
        <div class="pp-desc">${E(p.desc||p.descr||'')}${tags.length?'<br><small>'+tags.map((t:string)=>'· '+E(t)).join(' ')+'</small>':''}</div>
        ${acts?`<div class="pp-acts">${acts}</div>`:''}
        <div class="pp-meta">Quelle: ${E(p.source||'—')}${p.source_detail?` (${E(p.source_detail)})`:''}${p.verified_at?` · geprüft ${E(p.verified_at)}`:''}${confirms} · Koordinate: ${E(p.coord_quality||'—')}</div>`)
      .addTo(map);
  });
  map.on('mouseenter','poi-dot',()=>{ map.getCanvas().style.cursor='pointer'; });
  map.on('mouseleave','poi-dot',()=>{ map.getCanvas().style.cursor=''; });
  map.on('mouseenter','poi-cluster',()=>{ map.getCanvas().style.cursor='pointer'; });
  map.on('mouseleave','poi-cluster',()=>{ map.getCanvas().style.cursor=''; });

  return {
    map, activeKinds: active,
    setKinds(on) { active.clear(); on.forEach(k=>active.add(k)); applyFilter(); },
    features: () => allFeatures,
    flyToLand(code) {
      const L = LAENDER[code]; if (!L) return;
      map.fitBounds([[L.bbox[0],L.bbox[1]],[L.bbox[2],L.bbox[3]]], { padding: 36, duration: 1600 });
    },
    search(q) {
      const s = q.trim().toLowerCase(); if (s.length < 2) return [];
      const out: { name:string; sub:string; lng:number; lat:number }[] = [];
      for (const f of allFeatures) {
        const p = f.properties;
        if ((p.name||'').toLowerCase().includes(s) || (p.area||'').toLowerCase().includes(s) || (p.region||'').toLowerCase().includes(s)) {
          const kd = KINDS.find(k=>k.kind===p.kind);
          out.push({ name:`${kd?.icon??'📍'} ${p.name}`, sub:[kd?.label,p.area||p.land].filter(Boolean).join(' · '),
            lng:f.geometry.coordinates[0], lat:f.geometry.coordinates[1] });
          if (out.length >= 8) break;
        }
      }
      return out;
    },
  };
}

/* ELWIS-Gefahren als eigene Ebene (heute aktive, grob nach Wasserstraße verortet) */
const WW: [string,number,number][] = [['untere havel',52.60,12.40],['potsdamer havel',52.39,13.06],['havel-oder',52.77,13.60],['oder-havel',52.77,13.60],['spree-oder',52.34,14.05],['teltow',52.40,13.25],['dahme',52.33,13.63],['müggel',52.44,13.64],['beetzsee',52.43,12.58],['templiner',53.12,13.02],['finow',52.83,13.70],['rüdersdorf',52.47,13.78],['storkow',52.25,13.93],['scharmützel',52.24,14.05],['landwehrkanal',52.50,13.39],['spree',52.45,13.50],['havel',52.46,13.05],['oder',52.58,14.30]];
export function addNoticeMarkers(api: MapAPI, notices: {waterway:string;description:string;type:string;detail_url:string}[]) {
  const feats = notices.map((n,idx) => {
    const w = (n.waterway||'').toLowerCase();
    const hit = WW.find(x=>w.includes(x[0])); if (!hit) return null;
    const dx = ((idx*73)%100-50)/2000, dy = ((idx*37)%100-50)/2500;
    return { type:'Feature', geometry:{ type:'Point', coordinates:[hit[2]+dx, hit[1]+dy] },
      properties:{ kind:'elwis', name:n.waterway, desc:n.description?.slice(0,180)||'Einschränkung', sev:n.type, url:n.detail_url } };
  }).filter(Boolean);
  api.map.addSource('elwis', { type:'geojson', data:{ type:'FeatureCollection', features: feats as any } });
  api.map.addLayer({ id:'elwis-halo', type:'circle', source:'elwis',
    paint:{ 'circle-radius':13,'circle-color':['match',['get','sev'],'red','#ff5d5d','orange','#f5b73c','#f5d97c'],'circle-opacity':0.3,'circle-blur':0.3 } });
  api.map.addLayer({ id:'elwis-dot', type:'circle', source:'elwis',
    paint:{ 'circle-radius':6,'circle-color':['match',['get','sev'],'red','#ff5d5d','orange','#f5b73c','#f5d97c'],'circle-stroke-width':2,'circle-stroke-color':'#fff' } });
  api.map.on('click','elwis-dot',(e)=>{ const f=e.features?.[0]; if(!f) return; const p:any=f.properties;
    new maplibregl.Popup({offset:14}).setLngLat((f.geometry as any).coordinates)
      .setHTML(`<div class="pp-kind">⚠️ Amtliche Meldung (ELWIS)</div><div class="pp-name">${E(p.name)}</div>
        <div class="pp-desc">${E(p.desc)}</div>
        <div class="pp-acts">${p.url?`<a href="${E(p.url)}" target="_blank" rel="noopener">ELWIS ›</a>`:''}</div>
        <div class="pp-meta">Lage grob nach Wasserstraße verortet · verbindlich: ELWIS.de</div>`).addTo(api.map); });
}
