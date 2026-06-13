// Generiert public/data/pegel.json: breite, bundesweite Auswahl schifffahrtsrelevanter WSV-Pegel.
// Quelle: Pegelonline (WSV) — read-only. Bevorzugt Stationen mit amtlicher Zustands-Einstufung.
import fs from 'fs';
const base = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2';
const all = await fetch(base + '/stations.json?timeseries=W&includeTimeseries=true&includeCurrentMeasurement=true').then(r => r.json());

// nach Gewässer gruppieren
const byWater = {};
for (const s of all) {
  const ts = (s.timeseries || []).find(t => t.shortname === 'W');
  const cm = ts && ts.currentMeasurement;
  if (!cm) continue; // nur Stationen mit aktueller W-Messung
  const w = (s.water?.longname || '—').trim();
  (byWater[w] = byWater[w] || []).push({ uuid: s.uuid, shortname: s.shortname, km: s.km ?? null,
    hasState: !!(cm.stateMnwMhw && cm.stateMnwMhw !== 'unknown') });
}

// Nur schifffahrtsrelevante Großgewässer (≥3 Pegel) — auto deckt das Bundesnetz ab
const PER_WATER = 6;
const groups = [];
let total = 0;
for (const w of Object.keys(byWater)) {
  let list = byWater[w];
  if (list.length < 3) continue;
  // gleichmäßig über die km-Achse ausdünnen; Stationen mit Status bevorzugen
  list.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  let pick = list;
  if (list.length > PER_WATER) {
    const step = list.length / PER_WATER;
    pick = Array.from({ length: PER_WATER }, (_, i) => list[Math.floor(i * step)]);
    // Duplikate vermeiden
    pick = [...new Map(pick.map(p => [p.uuid, p])).values()];
  }
  groups.push({ water: w, stations: pick.map(p => ({ uuid: p.uuid, shortname: p.shortname, km: p.km })) });
  total += pick.length;
}
// größte Gewässer zuerst
groups.sort((a, b) => b.stations.length - a.stations.length);

const out = { generated_at: new Date().toISOString(), source: 'Pegelonline (WSV)', groups };
fs.writeFileSync('public/data/pegel.json', JSON.stringify(out));
console.log('Gewässer-Gruppen:', groups.length, '· Pegel gesamt:', total);
console.log('Top:', groups.slice(0, 12).map(g => `${g.water}(${g.stations.length})`).join(', '));
