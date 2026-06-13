/* ═══ Lilly · Wasserlage-Gastgeberin & Navigatorin ═══
 * Dezente, persistente Hilfe. Antworten kommen AUS echten Live-Daten (keine Fake-Antworten).
 * Reduziert Komplexität: erklärt, fasst zusammen, schlägt vor — nervt nicht. */
import type { Weather, NoticesDoc } from '../lib/live';
import { activeToday } from '../lib/live';

export interface LillyState {
  weather: () => Weather | null;
  doc: () => NoticesDoc | null;
  ft: () => { stand: string; havel_min_cm: number } | null;
  ampel: () => { cls: string; text: string } | null;
  nearest: (kinds: string[]) => Promise<{ name: string; km: number; area?: string } | null>;
}

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

function reco(s: LillyState): string {
  const a = s.ampel(); const w = s.weather(); const doc = s.doc();
  if (!a) return 'Ich lade gerade die aktuelle Lage … einen Moment.';
  if (a.cls === 'ok') return `🟢 Aus amtlicher Sicht spricht heute nichts gegen eine Fahrt.${w ? ` Wind ${w.bft} Bft aus ${w.dir}, ${w.temp} °C.` : ''} Sperrungen auf deiner konkreten Route prüfst du am besten unten in der amtlichen Lage.`;
  const act = doc ? doc.notices.filter(activeToday).filter(n => n.type === 'red') : [];
  if (a.cls === 'danger') return `⚠️ Fahrt ist möglich, aber plane um: ${act[0] ? E(act[0].waterway) + ' — ' + E(String(act[0].description || '').slice(0, 90)) : 'es gibt aktive Sperrungen im Revier'}. Details in der amtlichen Lage.`;
  return `🟡 Heute gibt es Einschränkungen.${w && w.bft >= 4 ? ` Außerdem frischer Wind (${w.bft} Bft) — kleine Boote, SUP & Kajak mit Vorsicht.` : ''} Schau dir die amtliche Lage unten an.`;
}

async function nearby(s: LillyState, kinds: string[], label: string): Promise<string> {
  const n = await s.nearest(kinds);
  if (!n) return `Aktiviere kurz deinen Standort (📍 oben auf der Karte), dann zeige ich dir ${label} in deiner Nähe.`;
  return `Am nächsten: <b>${E(n.name)}</b> — ca. ${n.km.toFixed(1)} km entfernt${n.area ? ` (${E(n.area)})` : ''}. Tipp ihn in „Revier entdecken" für Route & Kontakt an.`;
}

function sperrungen(s: LillyState): string {
  const doc = s.doc(); if (!doc) return 'Die amtliche Lage lade ich gerade — gleich kann ich dir die Sperrungen nennen.';
  const act = doc.notices.filter(activeToday);
  const hard = act.filter(n => n.type !== 'yellow');
  if (!hard.length) return `Heute keine aktiven Sperrungen oder ernsten Einschränkungen im Revier — nur ${act.length} allgemeine Hinweise. Verbindlich bleibt ELWIS.`;
  const top = hard.slice(0, 3).map(n => `• ${E(n.waterway)}: ${E(String(n.description || n.type_label).slice(0, 70))}`).join('<br>');
  return `Aktuell ${hard.length} ernste Einschränkung${hard.length === 1 ? '' : 'en'}:<br>${top}${hard.length > 3 ? '<br>… weitere in der amtlichen Lage.' : ''}`;
}

function wetterTxt(s: LillyState): string {
  const w = s.weather(); if (!w) return 'Die Wetterdaten lade ich gerade.';
  const warn = w.bft >= 5 ? ' Kräftiger Wind — kleine Boote besser im Hafen lassen.' : w.bft >= 4 ? ' Frischer Wind — vorausschauend fahren.' : ' Gute Bedingungen für die meisten Boote.';
  return `Aktuell ${w.temp} °C, Wind ${w.bft} Bft aus ${w.dir} (${w.kmh} km/h), Böen bis ${w.gust} km/h.${warn} Sonne ↑ ${w.sunrise} · ↓ ${w.sunset} Uhr.`;
}

/* ── Offline-Wissen (statisch, halluzinationsfrei — funktioniert ohne Netz) ── */
const KNOW: Record<string,string> = {
  checkliste: `<b>Vor-Abfahrt-Checkliste:</b><br>• Wetter & Wind geprüft, Tankfüllung ausreichend<br>• Rettungswesten an Bord & griffbereit, Kinder angelegt<br>• Leinen, Fender, Anker klar · Bordwerkzeug & Pumpe<br>• Funk/Handy geladen · Erste-Hilfe & Feuerlöscher geprüft<br>• Lichter funktionieren · Crew kennt Mann-über-Bord-Plan<br>• Fahrtgebiet & Schleusenzeiten bekannt`,
  notfall: `<b>Notfall auf dem Wasser:</b><br>• Europaweiter Notruf <b>112</b><br>• UKW-Seefunk: Kanal <b>16</b> (Not/Anruf), DSC-Notruf via Kanal 70<br>• Wasserschutzpolizei über 110<br>• Mann über Bord: Knopf MOB/Position merken, Boje werfen, Person im Blick behalten, langsam wenden<br>• Position so genau wie möglich durchgeben (GPS – auf der Karte unter „Sicherheitsanker").`,
  sicherheit: `<b>Sicherheitsregeln:</b><br>• Rechts ausweichen, Berufsschifffahrt hat Vorrang<br>• In der Fahrrinne fahren, Tonnen beachten (rot/grün)<br>• Abstand zu Badenden & Naturschutzzonen, Wellenschlag vermeiden<br>• Tempo nach Beschilderung · nachts ohne Ortskenntnis nicht fahren<br>• Alkohol: 0,5 ‰-Grenze gilt sinngemäß auch hier — lieber ganz lassen.`,
  schleuse: `<b>Schleusen-Knigge:</b><br>• Vor Anfahrt Betriebszeiten & UKW-Kanal prüfen<br>• Am Warteplatz auf Lichtsignal warten (rot = warten, grün = einfahren)<br>• Langsam einfahren, Leinen mittschiffs belegen, Fender raus<br>• Motor an lassen, Crew an den Leinen, ruhig nachführen beim Füllen/Leeren<br>• Erst ausfahren, wenn das Signal frei gibt.`,
  knoten: `<b>Wichtige Knoten:</b><br>• <b>Webleinstek</b> (Festmachen am Poller)<br>• <b>Palstek</b> (feste Schlaufe, klemmt nicht)<br>• <b>Achtknoten</b> (Stopperknoten am Leinenende)<br>• <b>Belegen</b> an der Klampe in 8er-Schlägen.`,
  revier: `<b>Reviere Berlin/Brandenburg kurz erklärt:</b> Havel & Seen (weite Reviere, Westhavelland-Sternenpark) · Spree City (Funkpflicht Berlin-Mitte, Landwehrkanal Einbahn) · Dahme-Seenkette (führerscheinfrei, einsteigerfreundlich) · Oder (frei fließend, für Erfahrene). Details findest du unten unter „Reviere & Events".`,
};
const QUESTIONS: { q: string; icon: string; a: (s: LillyState) => string | Promise<string>; offline?: boolean }[] = [
  { q: 'Kann ich heute fahren?', icon: '⛵', a: reco },
  { q: 'Welche Sperrungen betreffen mich?', icon: '⚠️', a: sperrungen },
  { q: 'Wie ist Wetter & Wind?', icon: '🌤️', a: wetterTxt },
  { q: 'Wo kann ich tanken?', icon: '⛽', a: (s) => nearby(s, ['tank'], 'Tankstellen') },
  { q: 'Wo kann ich anlegen?', icon: '⚓', a: (s) => nearby(s, ['gelbe_welle', 'hafen', 'anleger'], 'Gastliegeplätze') },
  { q: 'Wo kann ich baden?', icon: '🏖️', a: (s) => nearby(s, ['badestelle'], 'Badestellen') },
  { q: 'Wo esse ich gut?', icon: '🍽️', a: (s) => nearby(s, ['gastro'], 'Gastronomie am Wasser') },
  { q: 'Vor-Abfahrt-Checkliste', icon: '✅', a: () => KNOW.checkliste, offline: true },
  { q: 'Notfall & Hilfe', icon: '🆘', a: () => KNOW.notfall, offline: true },
  { q: 'Sicherheitsregeln', icon: '🛟', a: () => KNOW.sicherheit, offline: true },
  { q: 'Wie läuft eine Schleuse?', icon: '🚪', a: () => KNOW.schleuse, offline: true },
  { q: 'Erklär mir das Revier', icon: '🗺️', a: () => KNOW.revier, offline: true },
  { q: 'Was sollte ich wissen?', icon: '🧭', a: (s) => `${reco(s)}<br><br>Übrigens: Tippe oben „Wo möchtest du heute hin?" — dann zeige ich dir alles entlang deines Ziels. Weitere Bundesländer schalten wir Schritt für Schritt frei.` },
];

export function initLilly(state: LillyState) {
  if (document.getElementById('lilly')) return;
  const root = document.createElement('div'); root.id = 'lilly';
  root.innerHTML = `
    <button id="lillyFab" aria-label="Lilly – deine Wasserlage-Hilfe" title="Frag Lilly">
      <span class="lilly-av">⚓</span><span class="lilly-fab-txt">Frag&nbsp;Lilly</span>
    </button>
    <section id="lillyPanel" hidden aria-live="polite">
      <header class="lilly-head"><span class="lilly-av">⚓</span><div><b>Lilly</b><small>deine Wasserlage-Lotsin</small></div>
        <button id="lillyClose" aria-label="Schließen">✕</button></header>
      <div class="lilly-body" id="lillyBody"></div>
      <div class="lilly-chips" id="lillyChips"></div>
    </section>`;
  document.body.appendChild(root);
  const panel = root.querySelector('#lillyPanel') as HTMLElement;
  const body = root.querySelector('#lillyBody') as HTMLElement;
  const chips = root.querySelector('#lillyChips') as HTMLElement;
  const fab = root.querySelector('#lillyFab') as HTMLElement;

  const say = (html: string, who: 'lilly' | 'me' = 'lilly') => {
    const b = document.createElement('div'); b.className = `lilly-msg ${who}`; b.innerHTML = html;
    body.appendChild(b); body.scrollTop = body.scrollHeight;
  };
  const renderChips = () => {
    const offline = !navigator.onLine;
    chips.innerHTML = '';
    /* Offline: Live-Fragen zuerst zeigen, aber als „braucht Netz" markiert; Wissensfragen normal */
    QUESTIONS.forEach(item => {
      const b = document.createElement('button'); b.className = 'lilly-chip' + (offline && !item.offline ? ' needs-net' : '');
      b.innerHTML = `${item.icon} ${E(item.q)}`;
      b.onclick = async () => {
        say(E(item.q), 'me');
        if (!navigator.onLine && !item.offline) {
          say('📡 Dafür brauche ich kurz Netz — das sind Live-Daten (Wetter, amtliche Lage, Standort). Sobald du wieder online bist, beantworte ich das sofort. Offline helfe ich dir gern mit <b>Checkliste, Sicherheit, Notfall, Schleuse & Revier</b>.');
          return;
        }
        const t = document.createElement('div'); t.className = 'lilly-msg lilly typing'; t.textContent = 'Lilly schaut nach …'; body.appendChild(t); body.scrollTop = body.scrollHeight;
        const ans = await item.a(state); t.remove(); say(ans);
      };
      chips.appendChild(b);
    });
  };
  addEventListener('online', renderChips); addEventListener('offline', renderChips);
  let greeted = false;
  const open = () => { panel.hidden = false; fab.classList.add('open');
    if (!greeted) { greeted = true;
      say('Moin! 👋 Ich bin <b>Lilly</b>, deine Lotsin auf Wasserlage. Ich zeige dir zuerst nur das, was für <b>deine Fahrt heute</b> wichtig ist — alles Weitere kannst du aufklappen.');
      if (navigator.onLine) setTimeout(() => say(reco(state)), 500);
      else setTimeout(() => say('Du bist gerade <b>offline</b> — Live-Lage und Wetter kann ich dir erst wieder online zeigen. Aber Checkliste, Sicherheit, Notfall, Schleuse & Revier habe ich auch ohne Netz für dich.'), 500);
    }
    renderChips();
  };
  const close = () => { panel.hidden = true; fab.classList.remove('open'); };
  fab.onclick = () => panel.hidden ? open() : close();
  (root.querySelector('#lillyClose') as HTMLElement).onclick = close;

  /* Dezenter Erst-Hinweis: einmal pro Gerät, nach kurzer Ruhe, nicht aufdringlich */
  if (!localStorage.getItem('wl3_lilly_seen')) {
    setTimeout(() => { if (panel.hidden) { fab.classList.add('pulse'); fab.setAttribute('data-hint', 'Brauchst du Hilfe? Frag mich.'); } }, 6000);
    fab.addEventListener('click', () => { localStorage.setItem('wl3_lilly_seen', '1'); fab.classList.remove('pulse'); fab.removeAttribute('data-hint'); }, { once: true });
  }
}
