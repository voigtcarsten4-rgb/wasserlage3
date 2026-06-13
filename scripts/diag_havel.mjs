// Diagnose der West-Havel-Lücke: wo bricht das Netz zwischen Spandau und Brandenburg?
import fs from 'fs';
const G = JSON.parse(fs.readFileSync(new URL('../public/data/waterways-bb.json', import.meta.url)));
const adj = Array.from({length:G.nodes.length},()=>[]);
G.edges.forEach((e)=>{adj[e[0]].push({to:e[1],w:e[2]});adj[e[1]].push({to:e[0],w:e[2]});});
const deg={}; G.edges.forEach(e=>{deg[e[0]]=(deg[e[0]]||0)+1;deg[e[1]]=(deg[e[1]]||0)+1;});
const hav=(a,b,c,d)=>{const R=6371000,p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const nearV=(lng,lat)=>{let bi=-1,bm=1e18;for(let i=0;i<G.nodes.length;i++){const n=G.nodes[i];const m=hav(lat,lng,n[1],n[0]);if(m<bm){bm=m;bi=i;}}return bi;};
function dijFrom(s){const N=G.nodes.length,dist=new Float64Array(N).fill(1e18);dist[s]=0;const pq=[[0,s]];
  while(pq.length){pq.sort((x,y)=>x[0]-y[0]);const[d,u]=pq.shift();if(d>dist[u])continue;for(const e of adj[u]){const nd=d+e.w;if(nd<dist[e.to]){dist[e.to]=nd;pq.push([nd,e.to]);}}}return dist;}
const sA=nearV(13.20,52.535); // Spandau Havel
const dist=dijFrom(sA);
console.log('Spandau-Anker v'+sA+' @',G.nodes[sA]);
// Dead-ends in West-Havel-Box; Graph-Distanz ab Spandau + nächste Sackgasse
const box=(n)=>G.nodes[n][0]>=12.3&&G.nodes[n][0]<=13.25&&G.nodes[n][1]>=52.25&&G.nodes[n][1]<=52.65;
const ends=[];for(let i=0;i<G.nodes.length;i++)if(deg[i]===1&&box(i))ends.push(i);
console.log('Sackgassen in West-Havel-Box:',ends.length);
// Für jede Sackgasse: nächste ANDERE Sackgasse (egal Grad-1) Luftlinie + Graph-Distanz-Differenz
const rep=[];
for(const u of ends){let bw=-1,bd=1e18;for(const w of ends){if(w===u)continue;const m=hav(G.nodes[u][1],G.nodes[u][0],G.nodes[w][1],G.nodes[w][0]);if(m<bd){bd=m;bw=w;}}
  const gd=Math.abs(dist[u]-dist[bw]); rep.push({u,w:bw,airM:Math.round(bd),graphKm:Math.round(gd/100)/10,uc:G.nodes[u],ucd:Math.round(dist[u]/1000)});}
// sortiere nach Luftlinie der nächsten Sackgasse, zeige große Graph-Sprünge (=echte Lücken)
rep.sort((a,b)=>b.graphKm-a.graphKm);
console.log('\nGrößte Graph-Sprünge zwischen geografisch nahen Sackgassen (echte Fahrrinnen-Lücken):');
for(const r of rep.slice(0,12)) console.log(`  v${r.u} @ ${r.uc[0].toFixed(4)},${r.uc[1].toFixed(4)} (${r.ucd}km ab Spandau) ↔ v${r.w} · Luftlinie ${r.airM}m · Graph-Diff ${r.graphKm}km`);
