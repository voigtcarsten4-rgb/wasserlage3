# Merge Gelbe Welle Rest-DE in per-Land-Dateien + Supabase-Importdatei
import json, re, os
SRC = r'C:\Users\Startklar\Documents\Claude\Projects\Elwis\data\gw_rest_de_geocoded.json'
DE = r'C:\Users\Startklar\Documents\Claude\Projects\wasserlage3-src\public\data\de'
SUP = r'C:\Users\Startklar\Documents\Claude\Projects\wasserlage3-src\public\data\gelbewelle_rest.json'

def slug(s):
    s = s.lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')[:48]

CQ = {'name':'exact','address':'approx','cluster':'cluster'}
data = json.load(open(SRC, encoding='utf-8'))
byland = {}
rows = []
seen = set()
for e in data:
    if not e.get('lat'): continue
    name = e.get('anleger') or e['betreiber']
    sid = 'gw-' + slug(name + '-' + e['plz'])
    while sid in seen: sid += '-2'
    seen.add(sid)
    pl = e.get('plaetze')
    desc = 'Offizieller Gelbe-Welle-Gastliegeplatz' + (f" · {pl} Gastliegeplätze" if pl and pl != 'Kanu' else (' · Kanu-Anleger' if pl == 'Kanu' else ''))
    if e.get('gewaesser'): desc += f" · {e['gewaesser']}" + (f" km {e['km']}" if e.get('km') else '')
    props = dict(id=sid, kind='gelbe_welle', name=name[:80], area=(e.get('gewaesser') or e['ort']),
        region=None, land=e['land'], desc=desc,
        tags=[t for t in ['Gastliegeplatz', 'Kanu' if pl == 'Kanu' else None] if t],
        tel=e.get('tel'), web=e.get('web'),
        source='DTV Gelbe Welle Standortliste', source_detail='Stand März 2026 · Geokodierung OSM/Nominatim',
        quality='curated', coord_quality=CQ.get(e.get('geocode'), 'approx'))
    f = dict(type='Feature', geometry=dict(type='Point', coordinates=[round(e['lon'],5), round(e['lat'],5)]), properties=props)
    byland.setdefault(e['land'], []).append(f)
    rows.append({**props, 'lat': round(e['lat'],5), 'lon': round(e['lon'],5)})

tot = 0
for L, feats in byland.items():
    p = os.path.join(DE, L + '.json')
    fc = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else dict(type='FeatureCollection', features=[])
    have = {f['properties']['id'] for f in fc['features']}
    add = [f for f in feats if f['properties']['id'] not in have]
    fc['features'] += add
    json.dump(fc, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    tot += len(add)
    print(L, len(add))
json.dump(rows, open(SUP, 'w', encoding='utf-8'), ensure_ascii=False)
print('TOTAL merged', tot, '· supabase rows', len(rows))
