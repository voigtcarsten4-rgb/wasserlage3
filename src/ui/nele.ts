/* ═══ Nele · Wasserlage-Lotsin fürs Revier (Wave-Bite) ═══
 * Video-Avatar-Loop + Voice (TTS + Mikrofon-STT) + Freitext mit AI-Bridge & lokalem Fallback.
 * Antworten kommen AUS echten Live-Daten — keine Fake-Antworten. Verbindlich bleibt ELWIS. */
import type { Weather, NoticesDoc } from '../lib/live';
import { activeToday } from '../lib/live';

export interface NeleState {
  weather: () => Weather | null;
  doc: () => NoticesDoc | null;
  ft: () => { stand: string; havel_min_cm: number } | null;
  ampel: () => { cls: string; text: string } | null;
  nearest: (kinds: string[]) => Promise<{ name: string; km: number; area?: string } | null>;
}

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function reco(s: NeleState): string {
  const a = s.ampel(); const w = s.weather(); const doc = s.doc();
  if (!a) return 'Ich lade gerade die aktuelle Lage … einen Moment.';
  if (a.cls === 'ok') return `🟢 Aus amtlicher Sicht spricht heute nichts gegen eine Fahrt.${w ? ` Wind ${w.bft} Bft aus ${w.dir}, ${w.temp} °C.` : ''} Sperrungen auf deiner konkreten Route prüfst du am besten unten in der amtlichen Lage.`;
  const act = doc ? doc.notices.filter(activeToday).filter(n => n.type === 'red') : [];
  if (a.cls === 'danger') return `⚠️ Fahrt ist möglich, aber plane um: ${act[0] ? E(act[0].waterway) + ' — ' + E(String(act[0].description || '').slice(0, 90)) : 'es gibt aktive Sperrungen im Revier'}. Details in der amtlichen Lage.`;
  return `🟡 Heute gibt es Einschränkungen.${w && w.bft >= 4 ? ` Außerdem frischer Wind (${w.bft} Bft) — kleine Boote, SUP & Kajak mit Vorsicht.` : ''} Schau dir die amtliche Lage unten an.`;
}
async function nearby(s: NeleState, kinds: string[], label: string): Promise<string> {
  const n = await s.nearest(kinds);
  if (!n) return `Aktiviere kurz deinen Standort (📍 oben auf der Karte), dann zeige ich dir ${label} in deiner Nähe.`;
  return `Am nächsten: <b>${E(n.name)}</b> — ca. ${n.km.toFixed(1)} km entfernt${n.area ? ` (${E(n.area)})` : ''}. Tipp ihn in „Revier entdecken" für Route & Kontakt an.`;
}
function sperrungen(s: NeleState): string {
  const doc = s.doc(); if (!doc) return 'Die amtliche Lage lade ich gerade — gleich kann ich dir die Sperrungen nennen.';
  const act = doc.notices.filter(activeToday); const hard = act.filter(n => n.type !== 'yellow');
  if (!hard.length) return `Heute keine aktiven Sperrungen oder ernsten Einschränkungen im Revier — nur ${act.length} allgemeine Hinweise. Verbindlich bleibt ELWIS.`;
  const top = hard.slice(0, 3).map(n => `• ${E(n.waterway)}: ${E(String(n.description || n.type_label).slice(0, 70))}`).join('<br>');
  return `Aktuell ${hard.length} ernste Einschränkung${hard.length === 1 ? '' : 'en'}:<br>${top}${hard.length > 3 ? '<br>… weitere in der amtlichen Lage.' : ''}`;
}
function wetterTxt(s: NeleState): string {
  const w = s.weather(); if (!w) return 'Die Wetterdaten lade ich gerade.';
  const warn = w.bft >= 5 ? ' Kräftiger Wind — kleine Boote besser im Hafen lassen.' : w.bft >= 4 ? ' Frischer Wind — vorausschauend fahren.' : ' Gute Bedingungen für die meisten Boote.';
  return `Aktuell ${w.temp} °C, Wind ${w.bft} Bft aus ${w.dir} (${w.kmh} km/h), Böen bis ${w.gust} km/h.${warn} Sonne ↑ ${w.sunrise} · ↓ ${w.sunset} Uhr.`;
}

const KNOW: Record<string,string> = {
  checkliste: `<b>Vor-Abfahrt-Checkliste:</b><br>• Wetter & Wind geprüft, Tankfüllung ausreichend<br>• Rettungswesten an Bord & griffbereit, Kinder angelegt<br>• Leinen, Fender, Anker klar · Bordwerkzeug & Pumpe<br>• Funk/Handy geladen · Erste-Hilfe & Feuerlöscher geprüft<br>• Lichter funktionieren · Crew kennt Mann-über-Bord-Plan<br>• Fahrtgebiet & Schleusenzeiten bekannt`,
  notfall: `<b>Notfall auf dem Wasser:</b><br>• Europaweiter Notruf <b>112</b><br>• UKW-Seefunk: Kanal <b>16</b> (Not/Anruf), DSC-Notruf via Kanal 70<br>• Wasserschutzpolizei über 110<br>• Mann über Bord: Position merken, Boje werfen, Person im Blick, langsam wenden<br>• Position so genau wie möglich durchgeben (GPS – „Sicherheitsanker").`,
  sicherheit: `<b>Sicherheitsregeln:</b><br>• Rechts ausweichen, Berufsschifffahrt hat Vorrang<br>• In der Fahrrinne fahren, Tonnen beachten (rot/grün)<br>• Abstand zu Badenden & Naturschutzzonen, Wellenschlag vermeiden<br>• Tempo nach Beschilderung · nachts ohne Ortskenntnis nicht fahren<br>• Alkohol: 0,5 ‰ gilt sinngemäß auch hier — lieber ganz lassen.`,
  schleuse: `<b>Schleusen-Knigge:</b><br>• Vor Anfahrt Betriebszeiten & UKW-Kanal prüfen<br>• Am Warteplatz auf Lichtsignal warten (rot = warten, grün = einfahren)<br>• Langsam einfahren, Leinen mittschiffs belegen, Fender raus<br>• Motor an lassen, Crew an den Leinen, ruhig nachführen<br>• Erst ausfahren, wenn das Signal frei gibt.`,
  knoten: `<b>Wichtige Knoten:</b><br>• <b>Webleinstek</b> (Festmachen am Poller)<br>• <b>Palstek</b> (feste Schlaufe, klemmt nicht)<br>• <b>Achtknoten</b> (Stopper am Leinenende)<br>• <b>Belegen</b> an der Klampe in 8er-Schlägen.`,
  revier: `<b>Reviere Berlin/Brandenburg:</b> Havel & Seen (weite Reviere, Westhavelland-Sternenpark) · Spree City (Funkpflicht Berlin-Mitte, Landwehrkanal Einbahn) · Dahme-Seenkette (führerscheinfrei, einsteigerfreundlich) · Oder (frei fließend, für Erfahrene). Mehr unter „Reviere & Events".`,
  route: `🚤 Klar! Tippe oben auf der Karte deinen <b>Start (A)</b> und dein <b>Ziel (B)</b> an — ich route dich entlang der schiffbaren Wege, mit Distanz, Fahrzeit und Schleusen. Oder wähle ein Ziel bei „Wo möchtest du heute hin?" und tippe „🚤 Route auf dem Wasser".`,
};
type QA = { q: string; icon: string; a: (s: NeleState) => string | Promise<string>; offline?: boolean };
const QUESTIONS: QA[] = [
  { q: 'Kann ich heute fahren?', icon: '⛵', a: reco },
  { q: 'Welche Sperrungen betreffen mich?', icon: '⚠️', a: sperrungen },
  { q: 'Wie ist Wetter & Wind?', icon: '🌤️', a: wetterTxt },
  { q: 'Route auf dem Wasser', icon: '🚤', a: () => KNOW.route, offline: true },
  { q: 'Wo kann ich tanken?', icon: '⛽', a: (s) => nearby(s, ['tank'], 'Tankstellen') },
  { q: 'Wo kann ich anlegen?', icon: '⚓', a: (s) => nearby(s, ['gelbe_welle', 'hafen', 'anleger'], 'Gastliegeplätze') },
  { q: 'Wo kann ich baden?', icon: '🏖️', a: (s) => nearby(s, ['badestelle'], 'Badestellen') },
  { q: 'Wo esse ich gut?', icon: '🍽️', a: (s) => nearby(s, ['gastro'], 'Gastronomie am Wasser') },
  { q: 'Vor-Abfahrt-Checkliste', icon: '✅', a: () => KNOW.checkliste, offline: true },
  { q: 'Notfall & Hilfe', icon: '🆘', a: () => KNOW.notfall, offline: true },
  { q: 'Sicherheitsregeln', icon: '🛟', a: () => KNOW.sicherheit, offline: true },
  { q: 'Wie läuft eine Schleuse?', icon: '🚪', a: () => KNOW.schleuse, offline: true },
  { q: 'Erklär mir das Revier', icon: '🗺️', a: () => KNOW.revier, offline: true },
];
/* Freitext → bestes lokales Match (Keyword-Router) */
function localAnswer(s: NeleState, q: string): string | Promise<string> | null {
  const t = q.toLowerCase();
  if (/(kann ich|darf ich|heute).*(fahr|raus)|fahrbar|geht.*wasser/.test(t)) return reco(s);
  if (/sperr|gesperrt|baustelle|einschränk|elwis|meldung/.test(t)) return sperrungen(s);
  if (/wetter|wind|böe|boe|regen|sturm|sonne|temperatur/.test(t)) return wetterTxt(s);
  if (/route|törn|toern|strecke|wegpunkt|von .* nach|fahren nach/.test(t)) return KNOW.route;
  if (/tank|sprit|diesel|benzin/.test(t)) return nearby(s, ['tank'], 'Tankstellen');
  if (/anleg|liege|hafen|marina|festmach|gastlieg|gelbe welle/.test(t)) return nearby(s, ['gelbe_welle','hafen','anleger'], 'Gastliegeplätze');
  if (/bade|schwimm|strand/.test(t)) return nearby(s, ['badestelle'], 'Badestellen');
  if (/essen|restaurant|gastro|café|cafe|hunger|einkehr/.test(t)) return nearby(s, ['gastro'], 'Gastronomie am Wasser');
  if (/check|abfahrt|vor.*los/.test(t)) return KNOW.checkliste;
  if (/notfall|hilfe|112|mann über bord|mob|unfall/.test(t)) return KNOW.notfall;
  if (/sicher|regel|vorfahrt|ausweich/.test(t)) return KNOW.sicherheit;
  if (/schleus/.test(t)) return KNOW.schleuse;
  if (/knoten|leine|palstek/.test(t)) return KNOW.knoten;
  if (/revier|gebiet|spree|havel|dahme|oder|erklär/.test(t)) return KNOW.revier;
  return null;
}
/* Live-Kontext für die AI-Bridge */
function aiContext(s: NeleState): string {
  const w = s.weather(); const doc = s.doc(); const ft = s.ft(); const parts: string[] = [];
  if (w) parts.push(`Wind ${w.bft} Bft ${w.dir} ${w.kmh}km/h, Böen ${w.gust}, ${w.temp}°C, Sonne ${w.sunrise}-${w.sunset}`);
  if (ft && ft.havel_min_cm) parts.push(`Fahrrinne Havel min ${(ft.havel_min_cm/100).toFixed(2)} m`);
  if (doc) { const act = doc.notices.filter(activeToday); parts.push(`${act.filter(n=>n.type!=='yellow').length} ernste Einschränkungen, ${act.length} ELWIS-Hinweise heute`); }
  return `Live-Wasserlage Berlin/Brandenburg heute: ${parts.length ? parts.join(' · ') : 'Daten laden'}. Quellen: Open-Meteo, Pegelonline, ELWIS.`;
}
const NELE_FN = 'https://wjqicituxwtlkddgspzc.supabase.co/functions/v1/nele';
const NELE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcWljaXR1eHd0bGtkZGdzcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc1MzcsImV4cCI6MjA5NjE4MzUzN30.gH9OIHU7zepGhzsz5ZusBQ3r_bxxitrt8iW61iA1V8E';
async function aiAnswer(s: NeleState, q: string): Promise<string | null> {
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 22000);
    const r = await fetch(NELE_FN, { method: 'POST', signal: ctl.signal,
      headers: { 'apikey': NELE_KEY, 'Authorization': 'Bearer ' + NELE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ question: q, context: aiContext(s), mode: 'chat' }) });
    clearTimeout(to); const d = await r.json();
    let raw: string = (d && d.answer) || '';
    if (!raw) return null;
    raw = raw.replace(/```[\s\S]*?```/g, '').trim();
    return E(raw).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  } catch { return null; }
}

let voiceOn = false;
function speak(t: string) {
  if (!voiceOn || !('speechSynthesis' in window) || !t) return;
  try {
    const plain = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
    const u = new SpeechSynthesisUtterance(plain); u.lang = 'de-DE'; u.rate = 1.03; u.pitch = 1.06;
    const vs = window.speechSynthesis.getVoices() || []; const de = vs.filter(v => /de(-|_)/i.test(v.lang));
    const f = de.find(v => /female|frau|petra|marlene|katja|google/i.test(v.name)) || de[0];
    if (f) u.voice = f;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function initNele(state: NeleState) {
  if (document.getElementById('nele')) return;
  try { voiceOn = localStorage.getItem('wl3_voice') === '1'; } catch { /* */ }
  const avatarHTML = reduceMotion()
    ? `<img src="${import.meta.env.BASE_URL}nele.jpg" alt="Nele">`
    : `<video src="${import.meta.env.BASE_URL}nele.mp4" poster="${import.meta.env.BASE_URL}nele_poster.jpg" autoplay loop muted playsinline preload="metadata"></video>`;
  const root = document.createElement('div'); root.id = 'nele';
  root.innerHTML = `
    <button id="neleFab" aria-label="Nele – deine Wasserlage-Lotsin" title="Frag Nele">
      <span class="nele-av">${avatarHTML}</span><span class="nele-fab-txt">Nele&nbsp;fragen</span><span class="nele-pulse"></span>
    </button>
    <section id="nelePanel" hidden role="dialog" aria-label="Nele – deine Wasserlage-Lotsin">
      <header class="nele-head">
        <span class="nele-av">${avatarHTML}</span>
        <div><b>Nele</b><small>deine Lotsin fürs Revier 💙</small></div>
        <button id="neleVoice" aria-label="Sprachausgabe an/aus" title="Sprachausgabe">${voiceOn ? '🔊' : '🔈'}</button>
        <button id="neleClose" aria-label="Schließen">✕</button>
      </header>
      <div class="nele-body" id="neleBody"></div>
      <div class="nele-chips" id="neleChips"></div>
      <div class="nele-in">
        <input id="neleInput" placeholder="Frag mich zur Wasserlage…" autocomplete="off" aria-label="Frage an Nele">
        <button id="neleMic" type="button" aria-label="Per Stimme fragen" title="Per Stimme fragen">🎤</button>
        <button id="neleSend" aria-label="Senden">→</button>
      </div>
    </section>`;
  document.body.appendChild(root);
  const $ = (id: string) => root.querySelector(id) as HTMLElement;
  const panel = $('#nelePanel'), body = $('#neleBody'), chips = $('#neleChips'), fab = $('#neleFab');
  const input = $('#neleInput') as HTMLInputElement;

  const say = (html: string, who: 'nele' | 'me' = 'nele') => {
    const b = document.createElement('div'); b.className = `nele-msg ${who}`; b.innerHTML = html;
    body.appendChild(b); body.scrollTop = body.scrollHeight;
    if (who === 'nele') speak(html);
  };
  const renderChips = () => {
    const offline = !navigator.onLine; chips.innerHTML = '';
    QUESTIONS.forEach(item => {
      const b = document.createElement('button'); b.className = 'nele-chip' + (offline && !item.offline ? ' needs-net' : '');
      b.innerHTML = `${item.icon} ${E(item.q)}`;
      b.onclick = () => run(item.q, item);
      chips.appendChild(b);
    });
  };
  async function run(label: string, item?: QA) {
    say(E(label), 'me');
    if (!navigator.onLine && item && !item.offline) {
      say('📡 Dafür brauche ich kurz Netz (Live-Daten). Offline helfe ich mit <b>Checkliste, Sicherheit, Notfall, Schleuse & Revier</b>.'); return;
    }
    const t = document.createElement('div'); t.className = 'nele-msg nele typing'; t.textContent = 'Nele schaut nach …';
    body.appendChild(t); body.scrollTop = body.scrollHeight;
    let ans: string;
    if (item) ans = await item.a(state);
    else {
      const loc = localAnswer(state, label);
      if (loc != null) ans = await loc;
      else ans = (navigator.onLine ? await aiAnswer(state, label) : null)
        || `Dazu habe ich gerade keine sichere Antwort. Frag mich z. B. nach <b>Wetter</b>, <b>Sperrungen</b>, <b>Tanken/Anlegen/Baden</b>, einer <b>Route</b> oder der <b>Checkliste</b>. ⚓`;
    }
    t.remove(); say(ans);
  }
  addEventListener('online', renderChips); addEventListener('offline', renderChips);

  let greeted = false;
  const open = () => {
    panel.hidden = false; fab.style.display = 'none';
    if (!greeted) { greeted = true;
      say('Moin! 👋 Ich bin <b>Nele</b>, deine Lotsin fürs Revier. Sag mir, was du vorhast — ich verrate dir in einem Satz, ob du heute rausfahren kannst, wo\'s eng wird, wo du tankst, anlegst, isst oder die schönste Route findest. ⚓');
      if (navigator.onLine) setTimeout(() => say(reco(state)), 500);
      else setTimeout(() => say('Du bist gerade <b>offline</b> — Live-Lage & Wetter zeige ich wieder online. Checkliste, Sicherheit, Notfall, Schleuse & Revier habe ich auch ohne Netz.'), 500);
      renderChips();
    }
    setTimeout(() => input.focus(), 200);
  };
  const close = () => { panel.hidden = true; fab.style.display = ''; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  fab.onclick = () => { if (panel.hidden) open(); else close(); };
  $('#neleClose').onclick = close;
  $('#neleVoice').onclick = () => {
    voiceOn = !voiceOn; try { localStorage.setItem('wl3_voice', voiceOn ? '1' : '0'); } catch { /* */ }
    $('#neleVoice').textContent = voiceOn ? '🔊' : '🔈';
    if (!voiceOn) { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
    else speak('Sprachausgabe aktiv. Ich bin Nele, deine Lotsin fürs Revier.');
  };
  const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; run(v); };
  $('#neleSend').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

  /* Mikrofon-Eingabe (Web Speech, de-DE) */
  const mic = $('#neleMic') as HTMLButtonElement;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) mic.style.display = 'none';
  else {
    let rec: any = null, listening = false;
    mic.onclick = () => {
      if (listening) { try { rec.stop(); } catch { /* */ } return; }
      if (!rec) {
        rec = new SR(); rec.lang = 'de-DE'; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onresult = (e: any) => { let fin = '', int = '';
          for (let i = e.resultIndex; i < e.results.length; i++) { const tt = e.results[i][0].transcript; if (e.results[i].isFinal) fin += tt; else int += tt; }
          input.value = (fin + int).trim();
          if (fin) { try { rec.stop(); } catch { /* */ } setTimeout(() => { if (input.value.trim()) send(); }, 220); } };
        rec.onerror = (e: any) => { listening = false; mic.classList.remove('listening'); input.placeholder = 'Frag mich zur Wasserlage…';
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') say('🎙️ Mikrofon ist blockiert — erlaube den Zugriff im Browser, dann fragst du mich per Stimme. ⚓'); };
        rec.onend = () => { listening = false; mic.classList.remove('listening'); input.placeholder = 'Frag mich zur Wasserlage…'; };
      }
      try { input.value = ''; rec.start(); listening = true; mic.classList.add('listening'); input.placeholder = '🎙️ Ich höre…'; } catch { /* */ }
    };
  }

  /* Programmatischer Einstieg (z. B. aus anderen Sektionen): window.openNele('frage') */
  (window as any).openNele = (q?: string) => { if (panel.hidden) open(); if (q) setTimeout(() => run(q), 280); };

  /* Dezenter Erst-Hinweis: einmal pro Gerät */
  try {
    if (!localStorage.getItem('wl3_nele_seen')) {
      setTimeout(() => { if (panel.hidden) fab.classList.add('hint'); }, 6000);
      fab.addEventListener('click', () => { localStorage.setItem('wl3_nele_seen', '1'); fab.classList.remove('hint'); }, { once: true });
    }
  } catch { /* */ }
}
