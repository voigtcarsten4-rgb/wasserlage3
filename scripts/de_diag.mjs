import fs from 'fs';
const G = JSON.parse(fs.readFileSync(new URL('../public/data/waterways-de.json', import.meta.url)));
const adj = Array.from({length:G.nodes.length},()=>[]);
const deg={}; G.edges.forEach((e)=>{adj[e[0]].push({to:e[1],w:e[2]});adj[e[1]].push({to:e[0],w:e[2]});deg[e[0]]=(deg[e[0]]||0)+1;deg[e[1]]=(deg[e[1]]||0)+1;});
const hav=(a,b,c,d)=>{const R=6371000,p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const nearV=(lng,lat)=>{let bi=-1,bm=1e18;for(let i=0;i<G.nodes.length;i++){const n=G.nodes[i];const m=hav(lat,lng,n[1],n[0]);if(m<bm){bm=m;bi=i;}}return bi;};
function dijFrom(s){const N=G.nodes.length,dist=new Float64Array(N).fill(1e18);dist[s]=0;const pq=[[0,s]];
  while(pq.length){pq.sort((x,y)=>x[0]-y[0]);const[d,u]=pq.shift();if(d>dist[u])continue;for(const e of adj[u]){const nd=d+e.w;if(nd<dist[e.to]){dist[e.to]=nd;pq.push([nd,e.to]);}}}return dist;}
const box=process.argv[2]||'donau';
const BOXES={ donau:[9.5,47.4,13.95,49.3], main:[7.5,49.5,11.9,50.4], elbe:[9.0,50.5,11.6,53.7], rhein:[6.0,47.5,8.7,51.9] };
const [W,S,E,N]=BOXES[box];
const anchor={donau:[12.10,49.02],main:[8.68,50.11],elbe:[11.63,52.13],rhein:[6.96,50.94]}[box];
const sA=nearV(...anchor); const dist=dijFrom(sA);
console.log('Box',box,'Anker v'+sA,G.nodes[sA]);
const inbox=(n)=>G.nodes[n][0]>=W&&G.nodes[n][0]<=E&&G.nodes[n][1]>=S&&G.nodes[n][1]<=N;
const ends=[];for(let i=0;i<G.nodes.length;i++)if(deg[i]===1&&inbox(i))ends.push(i);
console.log('Sackgassen in Box:',ends.length);
const rep=[];
for(const u of ends){let bw=-1,bd=1e18;for(const w of ends){if(w===u)continue;const m=hav(G.nodes[u][1],G.nodes[u][0],G.nodes[w][1],G.nodes[w][0]);if(m<bd){bd=m;bw=w;}}
  if(bw<0)continue;const gd=Math.abs(dist[u]-dist[bw]);rep.push({u,w:bw,air:Math.round(bd),gkm:Math.round(gd/100)/10,uc:G.nodes[u],wc:G.nodes[bw]});}
rep.sort((a,b)=>b.gkm-a.gkm);
console.log('\nGrößte Lücken (geo-nah, graph-fern):');
for(const r of rep.slice(0,8)) if(isFinite(r.gkm)&&r.air<5000) console.log(`  ${r.uc[0].toFixed(4)},${r.uc[1].toFixed(4)} ↔ ${r.wc[0].toFixed(4)},${r.wc[1].toFixed(4)} · Luft ${r.air}m · Graph-Diff ${r.gkm}km`);
