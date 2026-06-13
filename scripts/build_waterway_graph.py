#!/usr/bin/env python3
"""Baut einen schiffbaren Wasserwege-Routinggraphen fuer Berlin/Brandenburg aus OSM.
Quelle: Overpass API (read-only, kein Key). Output: public/data/waterways-bb.json
Kontrahierter Graph: Knoten = Kreuzungen/Endpunkte/Schleusen, Kanten = Polylinien + Laenge.
"""
import urllib.request, urllib.parse, json, math, os, sys, time
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB  = os.path.join(ROOT, "public", "data")
DE   = "--de" in sys.argv
OUT  = os.path.join(PUB, "waterways-de.json" if DE else "waterways-bb.json")
OVERPASS = os.environ.get("OVERPASS_URL", "https://overpass-api.de/api/interpreter")

# S, W, N, E  (Brandenburg + Berlin, leicht gepolstert)
BBOX = (51.30, 11.20, 53.60, 14.80)

# DE-weit: 1°-Kachelgitter (viele kleine, schnelle, einzeln gecachte Overpass-Abfragen
# statt großflächiger Bundesland-Bboxen, die bei Overpass hängen)
def de_tiles(step=1.0):
    S, W, N, E = 47.2, 5.8, 55.1, 15.1
    tiles = {}; la = S
    while la < N:
        lo = W
        while lo < E:
            tiles["t%02d_%02d" % (int(round((la-S)/step)), int(round((lo-W)/step)))] = \
                (round(la,3), round(lo,3), round(min(la+step,N),3), round(min(lo+step,E),3))
            lo += step
        la += step
    return tiles
REGIONS = {"DE": (47.20, 5.80, 55.10, 15.10)}   # eine Abfrage: schlanke Kanal+CEMT-Wirbelsäule
# (de_tiles bleibt verfügbar für Fallback-Kachelung, falls eine Einzelabfrage scheitert)
# BB: alle Flüsse (Lückenschluss). DE: nur schiffbare Flüsse (CEMT/ship/motorboat/boat) + Kanäle — schnell & kompakt.
QTPL_BB = ('[out:json][timeout:240];('
  'way["waterway"="canal"]["boat"!="no"](%f,%f,%f,%f);'
  'way["waterway"="river"](%f,%f,%f,%f);'
  ');(._;>;);out body;')
QTPL_DE = ('[out:json][timeout:180];('
  'way["waterway"="canal"]["boat"!="no"](%f,%f,%f,%f);'
  'way["waterway"="river"]["CEMT"](%f,%f,%f,%f);'
  ');(._;>;);out body;')

def hav(a, b, c, d):
    """km zwischen (lat a,lon b) und (lat c,lon d)."""
    R = 6371.0088
    p = math.pi/180
    x = (math.sin((c-a)*p/2)**2 +
         math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2)
    return R*2*math.atan2(math.sqrt(x), math.sqrt(1-x))

def fetch_region(code, bbox):
    cache = os.path.join(HERE, "_osm_cache_%s.json" % code)
    if "--cache" in sys.argv and os.path.exists(cache):
        return json.load(open(cache, encoding="utf-8"))
    q = (QTPL_DE if DE else QTPL_BB) % (bbox*2)
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(OVERPASS, data=data,
            headers={"User-Agent": "wasserlage3-routinggraph/1.1 (kontakt via wavebite.info)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        osm = json.load(r)
    try: json.dump(osm, open(cache, "w", encoding="utf-8"))
    except Exception: pass
    return osm

def collect():
    """Regionsweise holen (DE: 16 Länder, sonst nur BB) und global deduplizieren."""
    regions = REGIONS if DE else {"BB": BBOX}
    coords, ways, wseen = {}, [], set()
    print("[1] Overpass: %d Region(en)%s ..." % (len(regions), " [--cache]" if "--cache" in sys.argv else ""), flush=True)
    for code, bbox in regions.items():
        try:
            osm = fetch_region(code, bbox)
        except Exception as ex:
            print("    ! %s fehlgeschlagen: %s" % (code, ex), flush=True); continue
        nadd = 0
        for e in osm.get("elements", []):
            if e["type"] == "node" and e["id"] not in coords:
                coords[e["id"]] = (round(e["lon"], 6), round(e["lat"], 6)); nadd += 1
        for e in osm.get("elements", []):
            if e["type"] == "way" and e["id"] not in wseen:
                wseen.add(e["id"]); nd = [n for n in e.get("nodes", []) if n in coords]
                if len(nd) >= 2: ways.append((nd, e.get("tags", {}).get("name", "")))
        print("    [%s] +%d Knoten (Σ %d), Σ %d Wege" % (code, nadd, len(coords), len(ways)), flush=True)
        if DE and "--cache" not in sys.argv: time.sleep(0.5)
    return coords, ways

def load_locks():
    """Schleusen aus dem POI-Bestand (pois.geojson + BB + BE), dedupe by id."""
    locks, seen = [], set()
    files = ["pois.geojson"]
    de_dir = os.path.join(PUB, "de")
    if DE and os.path.isdir(de_dir):
        files += [os.path.join("de", f) for f in os.listdir(de_dir) if f.endswith(".json")]
    else:
        files += [os.path.join("de","BB.json"), os.path.join("de","BE.json")]
    for fn in files:
        p = os.path.join(PUB, fn)
        if not os.path.exists(p): continue
        try:
            fc = json.load(open(p, encoding="utf-8"))
        except Exception as e:
            print("   ! konnte %s nicht lesen: %s" % (fn, e)); continue
        for f in fc.get("features", []):
            pr = f.get("properties", {})
            if pr.get("kind") != "schleuse": continue
            i = pr.get("id")
            if i in seen: continue
            seen.add(i)
            c = f["geometry"]["coordinates"]
            locks.append({"name": pr.get("name","Schleuse"), "lng": c[0], "lat": c[1]})
    return locks

def weld(coords, ways, thr_m=25):
    """Fast deckungsgleiche Knoten (<= thr_m) zusammenlegen — schliesst OSM-Luecken
    an Kanal-/Fluss-Uebergaengen, ohne die Geometrie sichtbar zu verziehen."""
    dlat = thr_m/111320.0
    dlon = thr_m/(111320.0*math.cos(52.5*math.pi/180))
    cellf = lambda lo, la: (int(lo//dlon), int(la//dlat))
    grid, canon, rep = {}, {}, {}
    for nid, (lo, la) in coords.items():
        c = cellf(lo, la); found = None
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for r in grid.get((c[0]+dx, c[1]+dy), ()):
                    rlo, rla = rep[r]
                    if hav(la, lo, rla, rlo)*1000 <= thr_m: found = r; break
                if found: break
            if found: break
        if found is None:
            grid.setdefault(c, []).append(nid); rep[nid] = (lo, la); canon[nid] = nid
        else:
            canon[nid] = found
    new_ways = []
    for nd, nm in ways:
        rn = [canon[n] for n in nd if n in canon]
        cl = rn[:1]
        for x in rn[1:]:
            if x != cl[-1]: cl.append(x)
        if len(cl) >= 2: new_ways.append((cl, nm))
    return rep, new_ways

def build():
    coords, ways = collect()
    print("[2] OSM gesamt: %d Knoten, %d Wege" % (len(coords), len(ways)), flush=True)
    coords, ways = weld(coords, ways)
    print("[2b] nach Verschweissung: %d Knoten" % len(coords), flush=True)

    # Voll-Adjazenz (ungerichtet) ueber alle Wegsegmente; Name am Knoten merken
    adj = {}               # node -> set(neighbor)
    name_at = {}           # node -> waterway name (best effort)
    for nd, nm in ways:
        for i in range(len(nd)-1):
            a, b = nd[i], nd[i+1]
            if a == b: continue
            adj.setdefault(a, set()).add(b)
            adj.setdefault(b, set()).add(a)
            if nm:
                name_at.setdefault(a, nm); name_at.setdefault(b, nm)

    # Schleusen auf naechsten Graphknoten snappen (<= 300 m) -> erzwungene Vertices
    locks = load_locks()
    lock_nodes = {}; snapped = 0
    cs = 0.008  # ~0,6-0,9 km Gitterzellen für schnelles Snapping
    grid = {}
    for n in adj:
        lo, la = coords[n]; grid.setdefault((int(lo/cs), int(la/cs)), []).append(n)
    for lk in locks:
        la0, lo0 = lk["lat"], lk["lng"]; cx, cy = int(lo0/cs), int(la0/cs)
        best, bestkm = None, 9e9
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for n in grid.get((cx+dx, cy+dy), ()):
                    lo, la = coords[n]; km = hav(la0, lo0, la, lo)
                    if km < bestkm: bestkm, best = km, n
        if best is not None and bestkm <= 0.30:
            lock_nodes[best] = lk["name"]; snapped += 1
    print("[3] Schleusen: %d im Bestand, %d auf Graph gesnappt (<=300m)" % (len(locks), snapped), flush=True)

    # Vertices = Grad != 2  ODER  Schleusenknoten
    deg = {n: len(s) for n, s in adj.items()}
    is_vertex = {n: (deg[n] != 2 or n in lock_nodes) for n in adj}
    return coords, adj, is_vertex, lock_nodes, name_at

def contract(coords, adj, is_vertex, lock_nodes, name_at):
    """Ketten zwischen Vertices zu Kanten zusammenfassen (Geometrie + Laenge)."""
    edges = []             # (vA, vB, len_km, [geom node ids], name)
    seen = set()           # ungerichtete Segment-Marker (a,b) der ersten Kantenschritte
    verts = [n for n in adj if is_vertex[n]]
    for v in verts:
        for nb in adj[v]:
            if (v, nb) in seen: continue
            # Kette von v ueber nb bis zum naechsten Vertex laufen
            path = [v, nb]
            seen.add((v, nb))
            prev, cur = v, nb
            while not is_vertex[cur]:
                nxts = [x for x in adj[cur] if x != prev]
                if len(nxts) != 1: break          # Sackgasse/Anomalie
                prev, cur = cur, nxts[0]
                path.append(cur)
                if cur == v: break                # Schleifenkante
            seen.add((cur, path[-2]))
            # Laenge + gerundete Geometrie
            L = 0.0; geom = []
            for k in range(len(path)):
                lo, la = coords[path[k]]
                geom.append([round(lo,5), round(la,5)])
                if k: 
                    plo, pla = coords[path[k-1]]
                    L += hav(pla, plo, la, lo)
            nm = name_at.get(v) or name_at.get(cur) or ""
            edges.append((v, path[-1], round(L,4), geom, nm))
    return edges

def _udir(p_from, p_to):
    """Einheitsvektor in lokalen Metern (lon mit cos skaliert)."""
    k = math.cos((p_from[1]+p_to[1])/2*math.pi/180)
    dx = (p_to[0]-p_from[0])*k; dy = p_to[1]-p_from[1]
    n = math.hypot(dx, dy) or 1e-9
    return dx/n, dy/n

def connect_gaps(edges, gap_m=3200, min_cos=0.18):
    """Seelücken schliessen: Sackgasse (Grad 1) mit nächster anderer Sackgasse <= gap_m
    verbinden — ABER nur wenn beide *aufeinander zu* zeigen (Fluss läuft in den See
    hinein und gegenüber heraus). Verhindert falsche Land-Abkürzungen."""
    vc, deg, e_of = {}, {}, {}
    for e in edges:
        a, b, geom = e[0], e[1], e[3]
        vc[a]=geom[0]; vc[b]=geom[-1]
        deg[a]=deg.get(a,0)+1; deg[b]=deg.get(b,0)+1
        e_of.setdefault(a,[]).append(e); e_of.setdefault(b,[]).append(e)
    ends=[v for v in vc if deg[v]==1]
    # Auswärtsrichtung jeder Sackgasse (vom inneren Nachbarpunkt zum Endpunkt)
    out, other = {}, {}
    for v in ends:
        e = e_of[v][0]; g = e[3]
        if e[0]==v: out[v]=_udir(g[1], g[0]); other[v]=e[1]
        else:       out[v]=_udir(g[-2], g[-1]); other[v]=e[0]
    used=set(); extra=[]
    for v in ends:
        if v in used: continue
        lo1,la1=vc[v]; best=None
        for w in ends:
            if w==v or w in used or w==other.get(v): continue
            lo2,la2=vc[w]
            if abs(la1-la2)>0.035 or abs(lo1-lo2)>0.055: continue
            d=hav(la1,lo1,la2,lo2)*1000
            if d>gap_m: continue
            uvw=_udir(vc[v], vc[w])                      # v -> w
            if out[v][0]*uvw[0]+out[v][1]*uvw[1] < min_cos: continue   # v zeigt zu w
            if out[w][0]*(-uvw[0])+out[w][1]*(-uvw[1]) < min_cos: continue  # w zeigt zu v
            if best is None or d<best[0]: best=(d,w)
        if best:
            d,w=best
            extra.append((v,w,round(d/1000,4),[vc[v],vc[w]],"⟶ Verbindung (Fahrrinne pruefen)",1))
            used.add(v); used.add(w)
    print("    Seeluecken geschlossen: %d Verbindungen (<= %dm, gerichtet)" % (len(extra), gap_m), flush=True)
    return extra

# Bekannte Fahrrinnen-Querungen (Seen >Schwelle), die das Linien-OSM nicht durchzieht.
# Jeder Eintrag: (lng1,lat1, lng2,lat2). Wird auf nächste Vertices gesnappt + gebrückt.
SEEDS = [
    (13.05459, 52.43610, 13.06196, 52.39253),  # Potsdam: Stadtdurchfahrt Havel (Templiner/Alte Fahrt)
    (13.20126, 52.61398, 13.21333, 52.57303),  # Nord-Havel: Hennigsdorf / Nieder Neuendorf
]
def apply_seeds(edges, seeds, max_snap_m=900):
    vc = {}
    for e in edges:
        vc[e[0]] = e[3][0]; vc[e[1]] = e[3][-1]
    items = list(vc.items())
    def nearest(lng, lat):
        best, bd = None, 9e9
        for v, c in items:
            if abs(c[1]-lat) > 0.02 or abs(c[0]-lng) > 0.03: continue
            d = hav(lat, lng, c[1], c[0])*1000
            if d < bd: bd, best = d, v
        return best, bd
    extra = []
    for (l1, a1, l2, a2) in seeds:
        v1, d1 = nearest(l1, a1); v2, d2 = nearest(l2, a2)
        if v1 is None or v2 is None or v1 == v2 or d1 > max_snap_m or d2 > max_snap_m:
            print("    ! Seed verworfen (Snap %s/%s m)" % (round(d1), round(d2)), flush=True); continue
        d = hav(vc[v1][1], vc[v1][0], vc[v2][1], vc[v2][0])
        extra.append((v1, v2, round(d, 4), [vc[v1], vc[v2]], "⟶ Fahrrinne (Seed)", 1))
        print("    + Seed-Fahrrinne %.0f m @ %.3f,%.3f" % (d*1000, vc[v1][1], vc[v1][0]), flush=True)
    return extra

def connect_components(edges, bridge_m=4000, min_comp=20, min_cos=0.25):
    """Grosse, durch Seen getrennte Komponenten verbinden — NUR wenn die echten
    Sackgassen (Grad 1) *aufeinander zu* zeigen (Fahrrinnen-Fortsetzung). Verhindert
    perpendikulare Land-Abkuerzungen. Connector-Kanten werden markiert (c=1)."""
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
        return x
    def union(a,b):
        ra,rb=find(a),find(b)
        if ra!=rb: parent[ra]=rb
    vc, deg, e_of = {}, {}, {}
    for e in edges:
        a, b, geom = e[0], e[1], e[3]
        vc[a]=geom[0]; vc[b]=geom[-1]
        deg[a]=deg.get(a,0)+1; deg[b]=deg.get(b,0)+1
        e_of.setdefault(a,[]).append(e); e_of.setdefault(b,[]).append(e)
        union(a,b)
    # Auswaertsrichtung jeder echten Sackgasse (Grad 1) — nur diese sind Bruecken-Kandidaten
    out = {}
    for v in vc:
        if deg.get(v,0) != 1: continue
        e = e_of[v][0]; g = e[3]
        out[v] = _udir(g[1], g[0]) if e[0]==v else _udir(g[-2], g[-1])
    extra=[]
    for _ in range(12):
        comp={}
        for v in vc: comp.setdefault(find(v),[]).append(v)
        big=sorted(((len(m),r) for r,m in comp.items()), reverse=True)
        if len(big)<2 or big[1][0]<min_comp: break
        root=big[0][1]
        L=[v for v in out if find(v)==root]
        best=None
        for sz,r in big[1:]:
            if sz<min_comp: continue
            R=[v for v in out if find(v)==r]
            for u in L:
                lo1,la1=vc[u]
                for w in R:
                    lo2,la2=vc[w]
                    if abs(la1-la2)>0.05 or abs(lo1-lo2)>0.08: continue
                    d=hav(la1,lo1,la2,lo2)*1000
                    if d>bridge_m: continue
                    uvw=_udir(vc[u], vc[w])
                    if out[u][0]*uvw[0]+out[u][1]*uvw[1] < min_cos: continue      # u zeigt zu w
                    if out[w][0]*(-uvw[0])+out[w][1]*(-uvw[1]) < min_cos: continue # w zeigt zu u
                    if best is None or d<best[0]: best=(d,u,w)
        if not best: break
        d,u,w=best
        extra.append((u,w,round(d/1000,4),[vc[u],vc[w]],"⟶ Verbindung (Fahrrinne pruefen)",1))
        union(u,w)
        print("    + gerichtete Verbindung %.0f m @ %.3f,%.3f" % (d, vc[u][1], vc[u][0]), flush=True)
    return extra

def largest_component(edges):
    """Union-Find ueber Kanten; groesste Komponente behalten."""
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb
    for a, b, *_ in edges: union(a, b)
    comp = {}
    for a, b, *_ in edges:
        comp.setdefault(find(a), []).append((a,b))
    if not comp: return set()
    sizes = sorted(((len(set([x for e in v for x in e])), r) for r, v in comp.items()), reverse=True)
    print("[4] Komponenten (Top5 Knotenzahl): %s" % [s for s,_ in sizes[:5]], flush=True)
    # Diagnose Top-3: haeufigste Namen + Zentrum
    from collections import Counter
    for sz, r in sizes[:3]:
        ce = [e for e in edges if find(e[0])==r]
        names = Counter(e[4] for e in ce if len(e)>4 and e[4])
        pts = [p for e in ce for p in e[3]]
        clo = sum(p[0] for p in pts)/len(pts); cla = sum(p[1] for p in pts)/len(pts)
        print("    Komp %d Knoten @ %.3f,%.3f · Top: %s" %
              (sz, cla, clo, [n for n,_ in names.most_common(4)]), flush=True)
    root = sizes[0][1]
    return {a for a,b,*_ in edges if find(a)==root} | {b for a,b,*_ in edges if find(b)==root}

def _perp_m(p, a, b):
    latc = (a[1]+b[1])/2*math.pi/180; mx = 111320*math.cos(latc); my = 110540
    ax,ay,bx,by,px,py = a[0]*mx,a[1]*my,b[0]*mx,b[1]*my,p[0]*mx,p[1]*my
    dx,dy = bx-ax,by-ay; L2 = dx*dx+dy*dy
    if L2 == 0: return math.hypot(px-ax, py-ay)
    t = ((px-ax)*dx+(py-ay)*dy)/L2; t = 0 if t<0 else 1 if t>1 else t
    return math.hypot(px-(ax+t*dx), py-(ay+t*dy))
def simplify(geom, tol_m=12):
    """Douglas-Peucker — schrumpft Geometrie ohne sichtbaren Verlust bei Routing-Zoom."""
    if len(geom) <= 2: return geom
    keep = [False]*len(geom); keep[0] = keep[-1] = True; stack = [(0, len(geom)-1)]
    while stack:
        i, j = stack.pop()
        if j <= i+1: continue
        dmax, idx = 0.0, -1
        for k in range(i+1, j):
            d = _perp_m(geom[k], geom[i], geom[j])
            if d > dmax: dmax, idx = d, k
        if dmax > tol_m and idx > 0:
            keep[idx] = True; stack.append((i, idx)); stack.append((idx, j))
    return [geom[k] for k in range(len(geom)) if keep[k]]

def main():
    t0 = time.time()
    coords, adj, is_vertex, lock_nodes, name_at = build()
    edges = contract(coords, adj, is_vertex, lock_nodes, name_at)
    edges = edges + connect_gaps(edges)
    edges = edges + apply_seeds(edges, SEEDS)
    edges = edges + connect_components(edges)
    keep = largest_component(edges)
    edges = [e for e in edges if e[0] in keep and e[1] in keep]

    # Vertex-Reindex (kompakt 0..N)
    vid = {}
    def vix(n):
        if n not in vid: vid[n] = len(vid)
        return vid[n]
    out_edges, total_km = [], 0.0
    for e in edges:
        a, b, L, geom, nm = e[0], e[1], e[2], e[3], e[4]
        ia, ib = vix(a), vix(b)
        row = [ia, ib, int(round(L*1000)), simplify(geom), nm]   # [a,b,len_m,geom,name]
        if len(e) > 5 and e[5]: row.append(1)             # Connector-Flag
        out_edges.append(row)
        total_km += L
    nodes = [None]*len(vid)
    for n, i in vid.items():
        lo, la = coords[n]; nodes[i] = [round(lo,5), round(la,5)]
    out_locks = [{"n": vid[n], "name": nm} for n, nm in lock_nodes.items() if n in vid]

    payload = {
        "meta": {
            "region": "Deutschland" if DE else "Berlin/Brandenburg", "bbox": list(BBOX),
            "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "OpenStreetMap via Overpass (waterway=canal/river, schiffbar)",
            "vertices": len(nodes), "edges": len(out_edges),
            "locks": len(out_locks), "network_km": round(total_km,1),
            "note": "Planungshilfe. Verbindlich bleiben ELWIS-Meldungen. Seen-Fahrrinnen ggf. unvollstaendig.",
        },
        "nodes": nodes, "edges": out_edges, "locks": out_locks,
    }
    if len(nodes) < 50:
        print("[5] ABBRUCH: nur %d Vertices — Output NICHT geschrieben (Overpass-Ausfall?). Spaeter erneut versuchen." % len(nodes), flush=True)
        return
    os.makedirs(PUB, exist_ok=True)
    json.dump(payload, open(OUT, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    kb = os.path.getsize(OUT)/1024
    print("[5] OK -> %s" % OUT, flush=True)
    print("    %d Vertices, %d Kanten, %d Schleusen, %.0f km Netz, %.0f kB, %.1fs"
          % (len(nodes), len(out_edges), len(out_locks), total_km, kb, time.time()-t0), flush=True)

if __name__ == "__main__":
    main()
