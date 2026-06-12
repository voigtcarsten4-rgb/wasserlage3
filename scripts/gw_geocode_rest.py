# Gelbe Welle Rest-DE Geocoder (Nominatim fair use 1 req/s)
import urllib.request, urllib.parse, json, time, re, os
UA = {'User-Agent': 'Wasserlage/3.0 (voigtcarsten4@gmail.com)'}
SRC = r'C:\Users\Startklar\Documents\Claude\Projects\Elwis\data\gw_rest_de_parsed.json'
DST = r'C:\Users\Startklar\Documents\Claude\Projects\Elwis\data\gw_rest_de_geocoded.json'

def nom(params):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params) + '&format=json&limit=1&countrycodes=de'
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=12))
        if r: return float(r[0]['lat']), float(r[0]['lon'])
    except Exception:
        pass
    return None

data = json.load(open(SRC, encoding='utf-8'))
out = []
for i, e in enumerate(data):
    muni = bool(re.match(r'^(Stadt|Gemeinde|Amt|Verwaltungsgem|Landkreis|Markt|Samtgemeinde)', e['betreiber']))
    name = e.get('anleger') or e['betreiber']
    if muni:
        tries = [({'q': f"{name}, {e['ort']}"}, 'name'),
                 ({'postalcode': e['plz'], 'city': e['ort']}, 'cluster')]
    else:
        tries = [({'street': e.get('strasse') or '', 'postalcode': e['plz'], 'city': e['ort']}, 'address'),
                 ({'q': f"{name}, {e['ort']}"}, 'name'),
                 ({'postalcode': e['plz'], 'city': e['ort']}, 'cluster')]
    lat = lon = None; method = None
    for params, m in tries:
        if 'street' in params and not params['street']: continue
        res = nom(params); time.sleep(1.05)
        if res: lat, lon = res; method = m; break
    e['lat'], e['lon'], e['geocode'] = lat, lon, method
    out.append(e)
    if (i + 1) % 20 == 0:
        print(f"{i+1}/{len(data)}", flush=True)
        json.dump(out, open(DST, 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(out, open(DST, 'w', encoding='utf-8'), ensure_ascii=False)
ok = sum(1 for e in out if e['lat'])
print(f"DONE {ok}/{len(out)}", flush=True)
