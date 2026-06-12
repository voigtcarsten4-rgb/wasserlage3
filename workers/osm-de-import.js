/* ═══ Wasserlage 3.0 · OSM-DE-Import-Worker (Cloudflare Cron, Phase C vorbereitet) ═══
 * Importiert je Nacht EIN Bundesland aus Overpass (fair use) in Supabase poi.
 * Deploy: wrangler deploy workers/osm-de-import.js --name wasserlage-osm-import
 * Secrets: wrangler secret put SUPABASE_SERVICE_KEY · SUPABASE_URL · TRIGGER_KEY
 * Cron: "0 2 * * *" (Land rotiert nach Kalendertag)
 */
const LAENDER = [
  { code: 'BE', bbox: '52.33,13.08,52.69,13.77' },
  { code: 'BB', bbox: '51.36,11.27,53.56,14.77' },
  { code: 'MV', bbox: '53.11,10.59,54.69,14.41' },
  { code: 'SH', bbox: '53.36,7.87,55.06,11.31' },
  { code: 'NI', bbox: '51.29,6.65,53.89,11.6' },
];
const QUERY = (bbox) => `[out:json][timeout:90];(
  nwr["leisure"="marina"](${bbox});
  nwr["leisure"="slipway"](${bbox});
  nwr["waterway"="fuel"](${bbox});
  nwr["lock"="yes"](${bbox});
  nwr["amenity"="sanitary_dump_station"](${bbox});
);out center tags;`;
const KIND = (t) =>
  t.leisure === 'marina' ? 'hafen' :
  t.leisure === 'slipway' ? 'slip' :
  t.waterway === 'fuel' ? 'tank' :
  t.lock === 'yes' ? 'schleuse' :
  t.amenity === 'sanitary_dump_station' ? 'entsorgung' : null;

export default {
  async scheduled(_ev, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(req, env) {
    if (new URL(req.url).searchParams.get('key') !== env.TRIGGER_KEY) return new Response('forbidden', { status: 403 });
    return new Response(JSON.stringify(await run(env)), { headers: { 'content-type': 'application/json' } });
  }
};

async function run(env) {
  const land = LAENDER[new Date().getDate() % LAENDER.length];
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: 'data=' + encodeURIComponent(QUERY(land.bbox)),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Wasserlage/3.0 (voigtcarsten4@gmail.com)' }
  });
  if (!r.ok) return { land: land.code, error: r.status };
  const j = await r.json();
  const rows = (j.elements || []).map(el => {
    const t = el.tags || {}, kind = KIND(t);
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (!kind || !lat || !lon || !t.name) return null;
    return {
      id: `osm-${el.type}-${el.id}`, kind, name: t.name, lat, lon,
      land: land.code, source: 'OpenStreetMap', source_detail: `Overpass ${new Date().toISOString().slice(0, 10)}`,
      quality: 'unverified', coord_quality: 'exact',
      tel: t.phone || null, web: t.website || null,
      tags: [t.power_supply && '230V', t.drinking_water === 'yes' && 'Trinkwasser'].filter(Boolean)
    };
  }).filter(Boolean);
  /* Upsert in Tranchen à 500 — kuratierte Einträge werden NIE überschrieben (ignore-duplicates) */
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/poi?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'content-type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500))
    });
    if (res.ok) n += Math.min(500, rows.length - i);
  }
  return { land: land.code, fetched: rows.length, upserted: n };
}
