# OSM-Overpass Deutschland-Import je Bundesland -> public/data/de/{XX}.json
import urllib.request, urllib.parse, json, time, os
OUT = r'C:\Users\Startklar\Documents\Claude\Projects\wasserlage3-src\public\data\de'
os.makedirs(OUT, exist_ok=True)
LAENDER = ['SH','MV','NI','HH','HB','NW','RP','HE','BW','BY','SL','SN','ST','TH','BE','BB']
Q = '''[out:json][timeout:120];area["ISO3166-2"="DE-{L}"]->.a;(
  nwr["leisure"="marina"](area.a);
  nwr["leisure"="slipway"](area.a);
  nwr["waterway"="fuel"](area.a);
  nwr["lock"="yes"](area.a);
  nwr["amenity"="sanitary_dump_station"](area.a);
  nwr["amenity"="boat_rental"](area.a);
  nwr["leisure"="bathing_place"](area.a);
  nwr["mooring"="guest"](area.a);
);out center tags;'''
def kind(t):
    if t.get('leisure')=='marina': return 'hafen'
    if t.get('leisure')=='slipway': return 'slip'
    if t.get('waterway')=='fuel': return 'tank'
    if t.get('lock')=='yes': return 'schleuse'
    if t.get('amenity')=='sanitary_dump_station': return 'entsorgung'
    if t.get('amenity')=='boat_rental': return 'charter'
    if t.get('leisure')=='bathing_place': return 'badestelle'
    if t.get('mooring')=='guest': return 'anleger'
    return None

for L in LAENDER:
    dst = os.path.join(OUT, L + '.json')
    if os.path.exists(dst):
        print(L, 'skip (exists)', flush=True); continue
    body = 'data=' + urllib.parse.quote(Q.replace('{L}', L))
    try:
        req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=body.encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Wasserlage/3.0 (voigtcarsten4@gmail.com)'})
        j = json.load(urllib.request.urlopen(req, timeout=180))
    except Exception as ex:
        print(L, 'ERROR', ex, flush=True); time.sleep(30); continue
    feats = []
    for el in j.get('elements', []):
        t = el.get('tags', {}); k = kind(t)
        lat = el.get('lat') or (el.get('center') or {}).get('lat')
        lon = el.get('lon') or (el.get('center') or {}).get('lon')
        if not k or not lat or not lon: continue
        nm = t.get('name') or (k=='schleuse' and 'Schleuse') or (k=='slip' and 'Slipanlage') or (k=='badestelle' and 'Badestelle') or (k=='entsorgung' and 'Entsorgungsstation') or (k=='tank' and 'Bootstankstelle') or (k=='anleger' and 'Gastanleger') or None
        if not nm: continue
        tags = [x for x in [t.get('power_supply') and '230V', t.get('drinking_water')=='yes' and 'Trinkwasser',
                t.get('sanitary_dump_station') and 'Entsorgung', t.get('fee')=='no' and 'kostenlos'] if x]
        feats.append(dict(type='Feature', geometry=dict(type='Point', coordinates=[round(lon,5), round(lat,5)]),
            properties=dict(id=f"osm-{el['type']}-{el['id']}", kind=k, name=nm[:80], area=t.get('addr:city') or '',
            region=None, land=L, desc=None, tags=tags, tel=t.get('phone'), web=t.get('website'),
            source='OpenStreetMap', source_detail='Overpass ' + time.strftime('%Y-%m-%d'),
            quality='unverified', coord_quality='exact')))
    json.dump(dict(type='FeatureCollection', features=feats), open(dst, 'w', encoding='utf-8'), ensure_ascii=False)
    print(L, len(feats), flush=True)
    time.sleep(20)
print('ALL DONE', flush=True)
