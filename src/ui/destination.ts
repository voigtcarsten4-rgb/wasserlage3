/* ═══ Ziel-Einstieg · „Wo möchtest du heute hin?" ═══
 * Destinationszentriert: Ziel wählen → Karte fliegt hin + zeigt, was rundum liegt (echte POIs).
 * EHRLICH: Das ist kein Turn-by-Turn-Wasser-Routing (braucht Routing-Graph) — es ist der
 * destinationszentrierte Einstieg + „Was liegt an meinem Ziel". Grundstein, kein Fake-Nav. */
import type { MapAPI } from '../map/map';
import { setRouteDestination } from './route';
const E = (s:any) => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const CATS: [string,string,string[]][] = [
  ['⚓','Hafen / Liegeplatz',['hafen','gelbe_welle','anleger']], ['🍽️','Restaurant',['gastro']],
  ['🏖️','Badestelle',['badestelle']], ['⛽','Tankstelle',['tank']], ['🚪','Schleuse',['schleuse']],
  ['⛵','Charter',['charter']], ['🏰','Sehenswürdigkeit',['sight']],
];
const hav=(a:number,b:number,c:number,d:number)=>{const R=6371,x=Math.sin((c-a)*Math.PI/360)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin((d-b)*Math.PI/360)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};

export function initDestination(api: MapAPI) {
  const inp = document.getElementById('destQ') as HTMLInputElement | null;
  const res = document.getElementById('destRes') as HTMLElement | null;
  const cats = document.getElementById('destCats') as HTMLElement | null;
  const card = document.getElementById('destCard') as HTMLElement | null;
  if (!inp || !res || !cats || !card) return;

  cats.innerHTML = CATS.map((c,i)=>`<button class="dest-cat" data-i="${i}">${c[0]} ${E(c[1])}</button>`).join('');
  cats.querySelectorAll<HTMLButtonElement>('.dest-cat').forEach(b=>b.addEventListener('click',()=>{
    const c = CATS[+b.dataset.i!]; const hit = api.features().find(f=>c[2].includes(f.properties.kind));
    if (hit) showTarget(hit);
  }));

  const showList = (items:{name:string;sub:string;lng:number;lat:number;feat?:any}[]) => {
    res.hidden = items.length===0;
    res.innerHTML = items.map((it,i)=>`<button data-i="${i}"><b>${E(it.name)}</b><span>${E(it.sub)}</span></button>`).join('');
    res.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      const it = items[+b.dataset.i!]; res.hidden=true; inp.value='';
      const feat = api.features().find(f=>Math.abs(f.geometry.coordinates[0]-it.lng)<1e-4 && Math.abs(f.geometry.coordinates[1]-it.lat)<1e-4);
      if (feat) showTarget(feat); else { api.map.flyTo({center:[it.lng,it.lat],zoom:13,speed:1.5}); }
    }));
  };
  let t:any; inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>showList(api.search(inp.value)),160);});
  document.addEventListener('click',e=>{ if(!res.contains(e.target as Node)&&e.target!==inp) res.hidden=true; });

  function showTarget(feat:any) {
    const [lng,lat] = feat.geometry.coordinates; const p = feat.properties;
    api.map.flyTo({ center:[lng,lat], zoom:13.5, speed:1.5 });
    document.getElementById('karte')?.scrollIntoView({behavior:'smooth',block:'center'});
    /* Was liegt rund um das Ziel? (echte POIs aus dem Bestand, 8 km Umkreis) */
    const near: Record<string,{name:string;km:number}> = {};
    const want = ['tank','gelbe_welle','hafen','gastro','badestelle','schleuse','entsorgung'];
    for (const f of api.features()) {
      const k = f.properties.kind; if (!want.includes(k) || f.properties.id===p.id) continue;
      const km = hav(lat,lng,f.geometry.coordinates[1],f.geometry.coordinates[0]);
      if (km>8) continue;
      if (!near[k] || km<near[k].km) near[k]={name:f.properties.name,km};
    }
    const ICO:Record<string,string>={tank:'⛽ Tanken',gelbe_welle:'🌊 Gelbe Welle',hafen:'⚓ Hafen',gastro:'🍽️ Essen',badestelle:'🏖️ Baden',schleuse:'🚪 Schleuse',entsorgung:'♻️ Entsorgung'};
    const rows = Object.entries(near).map(([k,v])=>`<li><span>${ICO[k]||k}</span><b>${E(v.name)}</b><em>${v.km.toFixed(1)} km</em></li>`).join('')
      || '<li class="dest-empty">In 8 km Umkreis sind noch keine weiteren Service-Punkte erfasst — weitere Reviere bauen wir laufend aus.</li>';
    card.hidden = false;
    card.innerHTML = `
      <div class="dest-card-head"><b>📍 ${E(p.name)}</b>${p.area?`<span>${E(p.area)}</span>`:''}</div>
      <p class="dest-lilly">⚓ <b>Lilly:</b> Ich habe dein Ziel auf der Karte markiert. Das liegt in der Nähe:</p>
      <ul class="dest-near">${rows}</ul>
      <div class="dest-actions">
        <button class="dest-go water" id="destWater">🚤 Route auf dem Wasser</button>
        <a class="dest-go" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">🧭 Anfahrt (Land)</a>
        <button class="dest-go ghost" id="destClose">Schließen</button>
      </div>
      <p class="dest-note">Hinweis: Wasserlage zeigt dir Ziele & Versorgung am Wasser. Eine verbindliche Wasser-Routenführung (Fahrrinne, Schleusen-Timing) ist in Entwicklung — verbindlich bleibt heute ELWIS.</p>`;
    document.getElementById('destClose')?.addEventListener('click',()=>{card.hidden=true;});
    document.getElementById('destWater')?.addEventListener('click',()=>{ try { setRouteDestination([lng,lat], p.name); } catch(e){ console.error(e); } });
  }
}
