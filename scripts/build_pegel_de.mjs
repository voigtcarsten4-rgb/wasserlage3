// Holt echte Pegelonline-UUIDs für große deutsche Wasserstraßen und ergänzt pegel.json um eine DE-Gruppe.
import fs from 'fs';
const url='https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json';
const res=await fetch(url); const all=await res.json();
console.log('Pegelonline Stationen gesamt:', all.length);
// Wunschliste: bekannte Großschifffahrts-Pegel je Strom (name-Match auf shortname/longname, water)
const want=[
  ['Rhein','MAXAU'],['Rhein','MANNHEIM'],['Rhein','MAINZ'],['Rhein','KAUB'],['Rhein','KOBLENZ'],['Rhein','KÖLN'],['Rhein','DUISBURG-RUHRORT'],['Rhein','EMMERICH'],
  ['Donau','KELHEIM'],['Donau','PFELLING'],['Donau','HOFKIRCHEN'],['Donau','PASSAU'],
  ['Elbe','DRESDEN'],['Elbe','TORGAU'],['Elbe','WITTENBERGE'],['Elbe','MAGDEBURG-STROMBRÜCKE'],['Elbe','HAMBURG'],
  ['Main','WÜRZBURG'],['Main','FRANKFURT'],['Main','SCHWEINFURT'],
  ['Weser','HANN.MÜNDEN'],['Weser','MINDEN'],['Weser','BREMEN'],['Weser','INTSCHEDE'],
  ['Mosel','TRIER'],['Mosel','COCHEM'],['Neckar','HEIDELBERG'],['Neckar','PLOCHINGEN'],
  ['Mittellandkanal','MINDEN'],['Saar','SAARBRÜCKEN'],
];
function find(water, key){
  const w=water.toLowerCase();
  let c=all.filter(s=> (s.water?.shortname||s.water?.longname||'').toLowerCase().includes(w));
  c=c.filter(s=> (s.longname||'').toUpperCase().includes(key) || (s.shortname||'').toUpperCase().includes(key));
  // bevorzuge mit longname
  return c[0]||null;
}
const seen=new Set(); const stations=[];
for(const [water,key] of want){ const s=find(water,key);
  if(s && !seen.has(s.uuid)){ seen.add(s.uuid);
    stations.push({name: (s.longname||s.shortname).replace(/\b([A-ZÄÖÜ])([A-ZÄÖÜ.-]+)/g,(m,a,b)=>a+b.toLowerCase()), water, uuid:s.uuid}); }
  else if(!s) console.log('  ! nicht gefunden:', water, key);
}
console.log('gefunden:', stations.length);
const pj=JSON.parse(fs.readFileSync(new URL('../public/data/pegel.json',import.meta.url)));
pj.groups = pj.groups.filter(g=>g.title!=='Deutschland · Ströme');
pj.groups.push({ icon:'🇩🇪', title:'Deutschland · Ströme', stations });
pj.generated_at = new Date().toISOString().slice(0,10);
pj.source = 'Pegelonline WSV · BB kuratiert (2.0) + DE-Ströme (Live-UUIDs)';
fs.writeFileSync(new URL('../public/data/pegel.json',import.meta.url), JSON.stringify(pj,null,1));
console.log('pegel.json aktualisiert · Gruppen:', pj.groups.map(g=>g.title+' ('+g.stations.length+')').join(', '));
