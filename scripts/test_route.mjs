// Selbsttest: Graph + Kanten-Snapping + Multi-Source-Dijkstra (Spiegel von routing.ts).
import fs from 'fs';
const G = JSON.parse(fs.readFileSync(new URL('../public/data/waterways-bb.json', import.meta.url)));
const adj = Array.from({length:G.nodes.length},()=>[]);
G.edges.forEach((e,ei)=>{const[a,b,w]=e;adj[a].push({to:b,w,ei});adj[b].push({to:a,w,ei});});
const lock=new Map(G.locks.map(l=>[l.n,l.name]));
const hav=(a,b,c,d)=>{const R=6371000,p=Math.PI/180;const x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
function projSeg(plng,plat,a,b){const latc=(a[1]+b[1])/2*Math.PI/180,mx=111320*Math.cos(latc),my=110540;
  const Ax=a[0]*mx,Ay=a[1]*my,Bx=b[0]*mx,By=b[1]*my,Px=plng*mx,Py=plat*my,dx=Bx-Ax,dy=By-Ay,L2=dx*dx+dy*dy||1e-9;
  let t=((Px-Ax)*dx+(Py-Ay)*dy)/L2;t=t<0?0:t>1?1:t;const cx=Ax+t*dx,cy=Ay+t*dy;return[t,Math.hypot(Px-cx,Py-cy),[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]];}
function snap(lng,lat){let bEi=-1,bSeg=0,bP=null,bD=1e18;
  for(let ei=0;ei<G.edges.length;ei++){const g=G.edges[ei][3];for(let i=0;i<g.length-1;i++){const[,d,proj]=projSeg(lng,lat,g[i],g[i+1]);if(d<bD){bD=d;bEi=ei;bSeg=i;bP=proj;}}}
  if(bEi<0)return null;const g=G.edges[bEi][3];
  let dA=hav(bP[1],bP[0],g[bSeg][1],g[bSeg][0]);for(let i=bSeg;i>0;i--)dA+=hav(g[i][1],g[i][0],g[i-1][1],g[i-1][0]);
  let dB=hav(bP[1],bP[0],g[bSeg+1][1],g[bSeg+1][0]);for(let i=bSeg+1;i<g.length-1;i++)dB+=hav(g[i][1],g[i][0],g[i+1][1],g[i+1][0]);
  return{ei:bEi,distM:bD,dA,dB,a:G.edges[bEi][0],b:G.edges[bEi][1]};}
function rt(from,to){const S=snap(...from),T=snap(...to);if(!S||!T)return null;
  if(S.ei===T.ei)return{km:Math.abs(S.dA-T.dA)/1000,locks:[],conn:0,sm:S.distM,tm:T.distM};
  const N=G.nodes.length,dist=new Float64Array(N).fill(1e18),pn=new Int32Array(N).fill(-1),pe=new Int32Array(N).fill(-1);
  const pq=[];dist[S.a]=S.dA;pq.push([S.dA,S.a]);if(S.dB<dist[S.b]){dist[S.b]=S.dB;pq.push([S.dB,S.b]);}
  while(pq.length){pq.sort((x,y)=>x[0]-y[0]);const[d,u]=pq.shift();if(d>dist[u])continue;for(const e of adj[u]){const nd=d+e.w;if(nd<dist[e.to]){dist[e.to]=nd;pn[e.to]=u;pe[e.to]=e.ei;pq.push([nd,e.to]);}}}
  const vA=dist[T.a]+T.dA,vB=dist[T.b]+T.dB;if(!isFinite(vA)&&!isFinite(vB))return null;
  const useA=vA<=vB,endV=useA?T.a:T.b,tot=useA?vA:vB;const seq=[];for(let c=endV;c!==-1;c=pn[c])seq.push(c);seq.reverse();
  const locks=[];if(lock.has(seq[0]))locks.push(lock.get(seq[0]));let conn=0;
  for(let i=1;i<seq.length;i++){const e=G.edges[pe[seq[i]]];if(e[5])conn++;if(lock.has(seq[i])){const nm=lock.get(seq[i]);if(locks[locks.length-1]!==nm)locks.push(nm);}}
  return{km:tot/1000,locks,conn,sm:S.distM,tm:T.distM};}
const cases=[
  ['Berlin-Mitte/Spree→Potsdam/Havel',[13.402,52.520],[13.056,52.392]],
  ['Köpenick/Dahme→Storkow',[13.626,52.444],[13.934,52.255]],
  ['Spandau/Havel→Brandenburg a.d.H.',[13.20,52.535],[12.56,52.41]],
  ['Tegel→Charlottenburg (kurz)',[13.27,52.58],[13.30,52.52]],
];
console.log('Graph:',G.meta.vertices,'V,',G.meta.edges,'E,',G.meta.network_km,'km,',G.meta.locks,'Schleusen');
for(const[name,a,b]of cases){const r=rt(a,b);console.log('\n• '+name);
  if(!r){console.log('  KEINE ROUTE');continue;}
  console.log('  '+r.km.toFixed(1)+' km · '+r.locks.length+' Schleusen ('+r.locks.slice(0,5).join(', ')+(r.locks.length>5?' …':'')+') · '+r.conn+' Connector · Snap '+Math.round(r.sm)+'/'+Math.round(r.tm)+' m');}
