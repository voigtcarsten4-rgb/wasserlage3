import fs from 'fs';
const G = JSON.parse(fs.readFileSync(new URL('../public/data/waterways-de.json', import.meta.url)));
const adj = Array.from({length:G.nodes.length},()=>[]);
G.edges.forEach((e)=>{adj[e[0]].push({to:e[1],w:e[2]});adj[e[1]].push({to:e[0],w:e[2]});});
const lock=new Map(G.locks.map(l=>[l.n,l.name]));
const hav=(a,b,c,d)=>{const R=6371000,p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
function projSeg(pl,pa,a,b){const la=(a[1]+b[1])/2*Math.PI/180,mx=111320*Math.cos(la),my=110540;const Ax=a[0]*mx,Ay=a[1]*my,Bx=b[0]*mx,By=b[1]*my,Px=pl*mx,Py=pa*my,dx=Bx-Ax,dy=By-Ay,L2=dx*dx+dy*dy||1e-9;let t=((Px-Ax)*dx+(Py-Ay)*dy)/L2;t=t<0?0:t>1?1:t;return Math.hypot(Px-(Ax+t*dx),Py-(Ay+t*dy));}
function snap(lng,lat){let bei=-1,bd=1e18;for(let ei=0;ei<G.edges.length;ei++){const g=G.edges[ei][3];for(let i=0;i<g.length-1;i++){const d=projSeg(lng,lat,g[i],g[i+1]);if(d<bd){bd=d;bei=ei;}}}return{a:G.edges[bei][0],b:G.edges[bei][1],d:bd};}
function rt(from,to){const S=snap(...from),T=snap(...to);const N=G.nodes.length,dist=new Float64Array(N).fill(1e18),pn=new Int32Array(N).fill(-1),pe=new Int32Array(N).fill(-1);
  const pq=[[0,S.a]];dist[S.a]=0;if(S.b!==S.a){dist[S.b]=0;pq.push([0,S.b]);}
  while(pq.length){pq.sort((x,y)=>x[0]-y[0]);const[d,u]=pq.shift();if(d>dist[u])continue;for(const e of adj[u]){const nd=d+e.w;if(nd<dist[e.to]){dist[e.to]=nd;pn[e.to]=u;pe[e.to]=e.ei;pq.push([nd,e.to]);}}}
  const dd=Math.min(dist[T.a],dist[T.b]);if(!isFinite(dd))return null;const endV=dist[T.a]<=dist[T.b]?T.a:T.b;
  const seq=[];for(let c=endV;c!==-1;c=pn[c])seq.push(c);const locks=[];for(const n of seq)if(lock.has(n)){const nm=lock.get(n);if(locks[locks.length-1]!==nm)locks.push(nm);}
  return{km:dd/1000,locks:locks.length,sm:S.d,tm:T.d};}
const cases=[
  ['Berlin-Mitte→Potsdam',[13.402,52.520],[13.056,52.392]],
  ['Spandau→Brandenburg a.d.H.',[13.20,52.535],[12.56,52.41]],
  ['Köpenick/Dahme→Storkow',[13.626,52.444],[13.934,52.255]],
  ['Berlin→Hamburg (Elbe/MLK)',[13.30,52.50],[9.97,53.54]],
  ['Rhein: Köln→Duisburg',[6.96,50.94],[6.73,51.43]],
  ['Main: Frankfurt→Aschaffenburg',[8.68,50.11],[9.13,49.97]],
  ['Donau: Regensburg→Passau',[12.10,49.02],[13.45,48.57]],
  ['Mittellandkanal: Hannover→Magdeburg',[9.73,52.37],[11.63,52.13]],
];
console.log('DE-Graph:',G.meta.vertices,'V,',G.meta.edges,'E,',G.meta.network_km,'km,',G.meta.locks,'Schleusen,',(fs.statSync(new URL('../public/data/waterways-de.json',import.meta.url)).size/1024|0),'kB');
for(const[n,a,b]of cases){const r=rt(a,b);console.log('• '+n+': '+(r?(r.km.toFixed(0)+' km, '+r.locks+' Schleusen, Snap '+Math.round(r.sm)+'/'+Math.round(r.tm)+'m'):'KEINE ROUTE'));}
