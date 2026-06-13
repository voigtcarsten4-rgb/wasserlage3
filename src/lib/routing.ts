/* ═══ Wasser-Routing 3.0 · client-side Dijkstra über schiffbaren OSM-Graphen ═══
 * Graph: public/data/waterways-bb.json (Knoten=Kreuzungen/Schleusen, Kanten=Polylinien+Länge).
 * EHRLICH: Planungshilfe entlang gemappter schiffbarer Wege — verbindlich bleiben ELWIS-Meldungen,
 * amtliche Fahrrinne & Befahrensregeln. Seen-Fahrrinnen können vereinfacht sein. */

export type LngLat = [number, number];
export interface WGraph {
  meta: any; nodes: LngLat[];
  edges: [number, number, number, LngLat[], string, number?][];
  locks: { n: number; name: string }[];
}
export interface RouteResult {
  coords: LngLat[]; distanceKm: number; durationMin: number;
  locks: string[]; connectors: number; fromSnapM: number; toSnapM: number;
  startV: number; endV: number; networkKm: number;
  crowKm: number; detour: number;   // Luftlinie & Umweg-Verhältnis (Ehrlichkeits-Check)
}
export interface RouteOpts { speedKmh?: number; lockMin?: number }

let G: WGraph | null = null;
let adj: { to: number; w: number; ei: number }[][] = [];
let lockName = new Map<number, string>();
let loading: Promise<WGraph> | null = null;

const hav = (a: number, b: number, c: number, d: number) => {
  const R = 6371000, p = Math.PI / 180;
  const x = Math.sin((c - a) * p / 2) ** 2 +
    Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export function isRoutingReady() { return !!G; }
export function graphMeta() { return G?.meta ?? null; }

export async function loadGraph(): Promise<WGraph> {
  if (G) return G;
  if (loading) return loading;
  loading = (async () => {
    const r = await fetch(`${import.meta.env.BASE_URL}data/waterways-bb.json?v=1`);
    if (!r.ok) throw new Error('Wasserwege-Graph nicht ladbar (' + r.status + ')');
    const g: WGraph = await r.json();
    adj = Array.from({ length: g.nodes.length }, () => []);
    g.edges.forEach((e, ei) => {
      const [a, b, w] = e;
      adj[a].push({ to: b, w, ei }); adj[b].push({ to: a, w, ei });
    });
    lockName = new Map(g.locks.map(l => [l.n, l.name]));
    G = g; return g;
  })();
  return loading;
}

/* Snap auf nächsten Punkt EINER KANTE (nicht nur Vertex) — bei kontrahierten
 * Kanten ist der nächste Vertex oft km entfernt; entscheidend für korrektes Routing. */
interface Snap { ei: number; proj: LngLat; distM: number; dA: number; dB: number; toA: LngLat[]; toB: LngLat[] }
function projSeg(plng: number, plat: number, a: LngLat, b: LngLat): [number, number, LngLat] {
  const latc = (a[1] + b[1]) / 2 * Math.PI / 180;
  const mx = 111320 * Math.cos(latc), my = 110540;
  const Ax = a[0]*mx, Ay = a[1]*my, Bx = b[0]*mx, By = b[1]*my, Px = plng*mx, Py = plat*my;
  const dx = Bx - Ax, dy = By - Ay; const L2 = dx*dx + dy*dy || 1e-9;
  let t = ((Px-Ax)*dx + (Py-Ay)*dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = Ax + t*dx, cy = Ay + t*dy; const d = Math.hypot(Px-cx, Py-cy);
  return [t, d, [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t]];
}
function snapEdge(lng: number, lat: number): Snap | null {
  let bEi = -1, bSeg = 0, bProj: LngLat = [0,0], bD = Infinity;
  const E = G!.edges;
  for (let ei = 0; ei < E.length; ei++) {
    const g = E[ei][3];
    for (let i = 0; i < g.length - 1; i++) {
      const p0 = g[i], p1 = g[i+1];
      if (Math.min(p0[1],p1[1]) - lat > 0.06 || lat - Math.max(p0[1],p1[1]) > 0.06 ||
          Math.min(p0[0],p1[0]) - lng > 0.09 || lng - Math.max(p0[0],p1[0]) > 0.09) continue;
      const [, d, proj] = projSeg(lng, lat, p0, p1);
      if (d < bD) { bD = d; bEi = ei; bSeg = i; bProj = proj; }
    }
  }
  if (bEi < 0) return null;
  const g = E[bEi][3];
  // Längen + Teilgeometrien vom Projektionspunkt zu Endpunkt a (=g[0]) und b (=g[last])
  let dA = hav(bProj[1], bProj[0], g[bSeg][1], g[bSeg][0]);
  for (let i = bSeg; i > 0; i--) dA += hav(g[i][1], g[i][0], g[i-1][1], g[i-1][0]);
  let dB = hav(bProj[1], bProj[0], g[bSeg+1][1], g[bSeg+1][0]);
  for (let i = bSeg+1; i < g.length - 1; i++) dB += hav(g[i][1], g[i][0], g[i+1][1], g[i+1][0]);
  const toA: LngLat[] = [bProj]; for (let i = bSeg; i >= 0; i--) toA.push(g[i]);
  const toB: LngLat[] = [bProj]; for (let i = bSeg+1; i < g.length; i++) toB.push(g[i]);
  return { ei: bEi, proj: bProj, distM: bD, dA, dB, toA, toB };
}

/* Minimaler Binary-Heap (Distanz, Knoten) */
class Heap {
  private a: [number, number][] = [];
  get size() { return this.a.length; }
  push(d: number, n: number) { const a = this.a; a.push([d, n]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop(): [number, number] | undefined { const a = this.a; if (!a.length) return; const top = a[0], last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2*i+1, r = 2*i+2; let s = i;
      if (l < a.length && a[l][0] < a[s][0]) s = l; if (r < a.length && a[r][0] < a[s][0]) s = r;
      if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } } return top; }
}

export async function route(from: LngLat, to: LngLat, opts: RouteOpts = {}): Promise<RouteResult | null> {
  await loadGraph();
  const speed = opts.speedKmh ?? 9;       // Verdränger/kanaltauglich ~9 km/h
  const lockMin = opts.lockMin ?? 20;     // Schleusung inkl. Wartezeit
  const S = snapEdge(from[0], from[1]); const T = snapEdge(to[0], to[1]);
  if (!S || !T) return null;
  const crowKm = hav(from[1], from[0], to[1], to[0]) / 1000;
  const Es = G!.edges[S.ei], Et = G!.edges[T.ei];
  const aS = Es[0], bS = Es[1], aT = Et[0], bT = Et[1];

  /* Sonderfall: Start & Ziel auf derselben Kante */
  if (S.ei === T.ei) {
    const distM = Math.abs(S.dA - T.dA);
    const coords: LngLat[] = [S.proj, T.proj];
    return { coords, distanceKm: distM/1000, durationMin: distM/1000/speed*60, locks: [],
      connectors: Es[5] ? 1 : 0, fromSnapM: Math.round(S.distM), toSnapM: Math.round(T.distM),
      startV: aS, endV: aT, networkKm: G!.meta?.network_km ?? 0,
      crowKm, detour: (distM/1000) / Math.max(crowKm, 0.1) };
  }

  const N = G!.nodes.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prevN = new Int32Array(N).fill(-1);
  const prevE = new Int32Array(N).fill(-1);
  const h = new Heap();
  dist[aS] = S.dA; h.push(S.dA, aS);
  if (S.dB < dist[bS]) { dist[bS] = S.dB; h.push(S.dB, bS); }
  while (h.size) {
    const [d, u] = h.pop()!;
    if (d > dist[u]) continue;
    for (const e of adj[u]) {
      const nd = d + e.w;
      if (nd < dist[e.to]) { dist[e.to] = nd; prevN[e.to] = u; prevE[e.to] = e.ei; h.push(nd, e.to); }
    }
  }
  const viaA = dist[aT] + T.dA, viaB = dist[bT] + T.dB;
  if (!isFinite(viaA) && !isFinite(viaB)) return null;
  const useA = viaA <= viaB; const endV = useA ? aT : bT; const totalM = useA ? viaA : viaB;

  /* Vertex-Sequenz vom Ziel-Endpunkt zurück bis zu einer Quelle (aS/bS) */
  const seq: number[] = []; for (let c = endV; c !== -1; c = prevN[c]) seq.push(c); seq.reverse();
  const startV = seq[0];
  /* Geometrie: Start-Teilstück (Proj→startV) + Mittelkanten + Ziel-Teilstück (endV→Proj) */
  let coords: LngLat[] = (startV === aS ? S.toA : S.toB).slice();   // [Proj … startV]
  const locks: string[] = []; let connectors = (Es[5] ? 1 : 0) + (Et[5] ? 1 : 0);
  if (lockName.has(startV)) locks.push(lockName.get(startV)!);
  for (let i = 1; i < seq.length; i++) {
    const u = seq[i-1], v = seq[i], e = G!.edges[prevE[v]];
    let g = e[3]; if (e[0] !== u) g = g.slice().reverse();
    for (let k = 1; k < g.length; k++) coords.push(g[k]);
    if (e[5]) connectors++;
    if (lockName.has(v)) { const nm = lockName.get(v)!; if (locks[locks.length-1] !== nm) locks.push(nm); }
  }
  const endPart = (endV === aT ? T.toA : T.toB).slice().reverse();  // [endV … Proj]
  for (let k = 1; k < endPart.length; k++) coords.push(endPart[k]);

  const distanceKm = totalM / 1000;
  const durationMin = distanceKm / speed * 60 + locks.length * lockMin;
  return { coords, distanceKm, durationMin, locks, connectors,
    fromSnapM: Math.round(S.distM), toSnapM: Math.round(T.distM),
    startV, endV, networkKm: G!.meta?.network_km ?? 0,
    crowKm, detour: distanceKm / Math.max(crowKm, 0.1) };
}
