/* ═══ Captain Quick Planner · Premium-Einstieg ═══
 * Aufwertung der Hero-Sektion zum „digitalen Co-Kapitän":
 * Modus wählen → Intents wählen → ehrliches „Heute relevant"-Panel aus ECHTEN Daten
 * (Wind via __wlw/windAdvice, amtliche Lage aus dem Live-DOM, Fahrrinnentiefen via __wlFT).
 * KEINE Fake-Echtzeitdaten. Fehlende Daten (z. B. Brückenhöhen) werden ehrlich gekennzeichnet.
 * POI-Intents recyceln die bestehenden #destCats-Buttons (kein Duplikat, keine Risiko-Logik). */
import { currentMode, applyMode } from './modes';
import { windAdvice } from '../lib/wind';

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

type QMode = { id: string; ic: string; label: string; audience?: string; hint: string; prio: string[] };
const MODES: QMode[] = [
  { id: 'allg',   ic: '🧭', label: 'Allgemein', hint: 'Lage, Tiefe, Versorgung & Wetter im Blick — wähle, was du brauchst.', prio: [] },
  { id: 'haus',   ic: '🛥️', label: 'Hausboot', audience: 'hausboot', hint: 'Schleusen, Tankstellen & Liegeplätze priorisiert. Brücken-/Durchfahrtshöhen vor der Fahrt prüfen.', prio: ['bruecke', 'schleuse', 'tank', 'hafen'] },
  { id: 'fam',    ic: '👨‍👩‍👧', label: 'Familie', audience: 'familie', hint: 'Ruhige Reviere, Badestellen & kurze Etappen. Schwimmwesten an Bord nicht vergessen.', prio: ['badestelle', 'hafen', 'warnung'] },
  { id: 'anf',    ic: '🔰', label: 'Anfänger', hint: 'Wenig Schleusen, klare Reviere. Langsam fahren, Mitte der Fahrrinne halten.', prio: ['wenig_schleusen', 'schleuse', 'hafen'] },
  { id: 'vers',   ic: '⛽', label: 'Versorgung', hint: 'Tankstellen, Trinkwasser, Entsorgung & Liegeplätze in der Nähe zuerst.', prio: ['tank', 'trinkwasser', 'hafen'] },
  { id: 'sicher', ic: '🛟', label: 'Sicherheit', hint: 'Amtliche Lage, Wind & Pegel zuerst. Sicherheitsanker griffbereit halten.', prio: ['warnung', 'bruecke', 'route'] },
];

type QIntent = { id: string; ic: string; label: string; cat?: number; scroll?: string; info?: string; warn?: boolean };
const INTENTS: QIntent[] = [
  { id: 'hafen',           ic: '⚓',  label: 'Hafen',          cat: 0 },
  { id: 'badestelle',      ic: '🏖️', label: 'Badestelle',     cat: 2 },
  { id: 'tank',            ic: '⛽',  label: 'Tankstelle',     cat: 3 },
  { id: 'trinkwasser',     ic: '🚰',  label: 'Trinkwasser',    scroll: 'entdecken', info: 'Trinkwasser gibt es meist an Häfen & Gelbe-Welle-Stationen. Wir erfassen eigene Trinkwasser-Punkte laufend — Hafen-Filter hilft weiter.' },
  { id: 'schleuse',        ic: '🚪',  label: 'Schleuse',       cat: 4 },
  { id: 'bruecke',         ic: '🌉',  label: 'Brückenhöhe',    scroll: 'tiefe-sect', warn: true, info: 'Brücken-/Durchfahrtshöhen sind noch nicht flächendeckend verifiziert. Vor der Fahrt verbindlich prüfen (ELWIS · örtliche Beschilderung). Tiefe deines Boots checkst du im Tiefencheck.' },
  { id: 'warnung',         ic: '⚠️', label: 'Warnungen',       scroll: 'dashboard' },
  { id: 'route',           ic: '🚤',  label: 'Sichere Route',  scroll: 'karte', info: 'Wasser-Route (Beta): Start (A) & Ziel (B) auf der Karte tippen — Lage, Tiefe & Schleusen fließen ein. Verbindlich bleibt ELWIS.' },
  { id: 'wenig_schleusen', ic: '〰️', label: 'Wenig Schleusen', scroll: 'touren', info: 'Schleusenarme Reviere & Etappen findest du unter „Reviere & Events" — mit Schleusenzahl je Tour.' },
  { id: 'schoen',          ic: '✨',  label: 'Schöne Strecke',  scroll: 'touren', info: 'Kuratierte Erlebnis-Routen (Sonnenuntergang, Natur, Familie) findest du unter „Reviere & Events".' },
];

let activeMode = 'allg';
let lastPick: QIntent | null = null;

const CSS = `
/* — Hero-Lesbarkeit — */
#destQ::placeholder{color:#bcd6e6;opacity:1}
.dest-bar input{background:rgba(6,20,34,.64)!important;border:1px solid rgba(143,233,255,.3)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 32px -18px rgba(0,8,20,.78)}
.dest-bar input:focus{outline:none;border-color:#31D5E7!important;box-shadow:0 0 0 3px rgba(49,213,231,.22),0 14px 36px -16px rgba(0,8,20,.85)}
.dest-h{text-shadow:0 2px 18px rgba(2,12,22,.6)}
#destCats{display:none}
/* — Quick Planner — */
#qp{max-width:680px;margin:13px auto 0}
.qp-sub{text-align:center;font-size:13.5px;color:#cfe6f2;margin:0 0 11px;text-shadow:0 1px 10px rgba(2,12,22,.6)}
.qp-card{position:relative;background:linear-gradient(180deg,rgba(9,28,44,.72),rgba(7,22,36,.54));border:1px solid rgba(143,233,255,.2);border-radius:18px;padding:13px 13px 12px;backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);box-shadow:0 28px 64px -40px rgba(0,8,20,.92),inset 0 1px 0 rgba(217,177,77,.13);text-align:left}
.qp-lab{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#8fb6c8;margin:0 0 7px 3px;font-weight:700}
.qp-modes,.qp-intents{display:flex;flex-wrap:wrap;gap:7px}
.qp-mode{display:inline-flex;align-items:center;gap:6px;min-height:40px;background:rgba(255,255,255,.06);border:1px solid rgba(143,233,255,.2);color:#dcecf3;border-radius:12px;padding:7px 12px;font:600 13px var(--font-b,sans-serif);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .18s,border-color .2s,background .2s,box-shadow .2s}
.qp-mode .qpm-ic{font-size:15px}
.qp-mode:hover{border-color:rgba(49,213,231,.5);transform:translateY(-1px)}
.qp-mode.on{background:linear-gradient(180deg,rgba(49,213,231,.3),rgba(12,73,106,.46));border-color:#31D5E7;color:#fff;box-shadow:0 0 20px -5px rgba(49,213,231,.6)}
.qp-intents{margin-top:6px}
.qp-intent{display:inline-flex;align-items:center;gap:6px;min-height:38px;background:rgba(7,26,40,.5);border:1px solid rgba(217,177,77,.26);color:#e9f4fb;border-radius:999px;padding:7px 13px;font:600 12.5px var(--font-b,sans-serif);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .18s,border-color .2s,background .2s}
.qp-intent:hover{transform:translateY(-1px);border-color:rgba(217,177,77,.6)}
.qp-intent.hot{border-color:rgba(49,213,231,.6);background:rgba(49,213,231,.12);box-shadow:0 0 14px -6px rgba(49,213,231,.5)}
.qp-intent.warn{border-color:rgba(255,196,77,.5)}
.qp-out{margin-top:12px;border-top:1px solid rgba(143,233,255,.14);padding-top:10px}
.qp-out-h{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#9fd0e0;font-weight:700;margin:0 0 6px 1px}
.qp-row{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.5;color:#dcecf3;padding:3px 0}
.qp-row .qp-ic{flex:0 0 auto;font-size:14px;margin-top:1px}
.qp-row b{color:#fff}
.qp-row.ok{color:#cdeede}
.qp-row.warn{color:#ffe6bd}
.qp-row.bad{color:#ffd0d4}
.qp-row.pick{background:rgba(49,213,231,.08);border:1px solid rgba(49,213,231,.22);border-radius:10px;padding:8px 10px;margin-bottom:5px}
html[data-tod="dusk"] .qp-card,html[data-tod="dawn"] .qp-card{box-shadow:0 28px 64px -40px rgba(0,8,20,.92),inset 0 1px 0 rgba(217,177,77,.24)}
@media(max-width:680px){ #qp{margin-top:11px} .qp-card{padding:12px 11px 11px;border-radius:16px} .qp-mode,.qp-intent{font-size:12px} }`;

function elwisCount(): number { try { const n = document.querySelectorAll('#pnlMeldungen .row').length; return (n > 0 && n < 200) ? n : 0; } catch { return 0; } }
function hasDepth(): boolean { try { const w: any = window as any; return !!(w.__wlFT && w.__wlFT.items && w.__wlFT.items.length) || !!w.__wlDepthScore; } catch { return false; } }

function renderOut(): string {
  const m = MODES.find(x => x.id === activeMode) || MODES[0];
  const rows: string[] = [];
  if (lastPick && lastPick.info) rows.push(`<div class="qp-row pick ${lastPick.warn ? 'warn' : ''}"><span class="qp-ic">${lastPick.ic}</span><div><b>${E(lastPick.label)}:</b> ${E(lastPick.info)}</div></div>`);
  rows.push(`<div class="qp-row"><span class="qp-ic">${m.ic}</span><div>${E(m.hint)}</div></div>`);
  try { const w: any = (window as any).__wlw; if (w) { const a: any = windAdvice(currentMode().id, w); if (a && a.text) { const cls = a.lvl >= 2 ? 'bad' : (a.lvl === 1 ? 'warn' : 'ok'); rows.push(`<div class="qp-row ${cls}"><span class="qp-ic">💨</span><div><b>Wind:</b> ${E(a.text)}</div></div>`); } } } catch { /* */ }
  const n = elwisCount();
  if (n > 0) rows.push(`<div class="qp-row ${m.prio.includes('warnung') ? 'warn' : ''}"><span class="qp-ic">⚠️</span><div><b>${n} amtliche ${n === 1 ? 'Meldung' : 'Meldungen'}</b> heute (ELWIS) — Sperrungen vor Fahrt prüfen.</div></div>`);
  else rows.push(`<div class="qp-row"><span class="qp-ic">📋</span><div>Amtliche Lage ist live geladen — Sperrungen vor Fahrt prüfen.</div></div>`);
  if (hasDepth()) rows.push(`<div class="qp-row"><span class="qp-ic">⚓</span><div>Echte ELWIS-Fahrrinnentiefen geladen — passt dein Tiefgang? Im <b>Tiefencheck</b> prüfen.</div></div>`);
  if (m.prio.includes('bruecke') || (lastPick && lastPick.id === 'bruecke')) rows.push(`<div class="qp-row warn"><span class="qp-ic">🌉</span><div>Brücken-/Durchfahrtshöhen noch <b>nicht flächendeckend verifiziert</b> — vor Fahrt prüfen.</div></div>`);
  rows.push(`<div class="qp-row"><span class="qp-ic">📍</span><div>Tipp: Ziel oben suchen — dann zeige ich Versorgung &amp; Service in der Nähe.</div></div>`);
  return `<div class="qp-out-h">Für deine Tour relevant</div>${rows.join('')}`;
}

export function initQuickPlanner() {
  const ziel = document.getElementById('ziel'); if (!ziel) return;
  const bar = ziel.querySelector('.dest-bar'); if (!bar) return;
  if (document.getElementById('qp')) return;
  if (!document.getElementById('qp-css')) { const st = document.createElement('style'); st.id = 'qp-css'; st.textContent = CSS; document.head.appendChild(st); }

  const wrap = document.createElement('div'); wrap.id = 'qp';
  wrap.innerHTML = `
    <p class="qp-sub">Dein digitaler Co-Kapitän — sag, was du heute brauchst:</p>
    <div class="qp-card">
      <div class="qp-lab">Modus</div>
      <div class="qp-modes" id="qpModes">${MODES.map(m => `<button class="qp-mode${m.id === activeMode ? ' on' : ''}" data-m="${m.id}" type="button" aria-pressed="${m.id === activeMode}"><span class="qpm-ic">${m.ic}</span>${E(m.label)}</button>`).join('')}</div>
      <div class="qp-lab" style="margin-top:11px">Was brauchst du?</div>
      <div class="qp-intents" id="qpIntents">${INTENTS.map(it => `<button class="qp-intent${it.warn ? ' warn' : ''}" data-i="${it.id}" type="button"><span>${it.ic}</span>${E(it.label)}</button>`).join('')}</div>
      <div class="qp-out" id="qpOut"></div>
    </div>`;
  bar.insertAdjacentElement('afterend', wrap);

  const out = wrap.querySelector('#qpOut') as HTMLElement;
  const markHot = () => { const m = MODES.find(x => x.id === activeMode) || MODES[0]; wrap.querySelectorAll<HTMLButtonElement>('.qp-intent').forEach(b => b.classList.toggle('hot', m.prio.includes(b.dataset.i!))); };
  const paint = () => { out.innerHTML = renderOut(); markHot(); };

  wrap.querySelectorAll<HTMLButtonElement>('.qp-mode').forEach(b => b.addEventListener('click', () => {
    activeMode = b.dataset.m!; lastPick = null;
    wrap.querySelectorAll('.qp-mode').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    const m = MODES.find(x => x.id === activeMode); if (m && m.audience) { try { applyMode(m.audience); } catch { /* */ } }
    paint();
  }));

  wrap.querySelectorAll<HTMLButtonElement>('.qp-intent').forEach(b => b.addEventListener('click', () => {
    const it = INTENTS.find(x => x.id === b.dataset.i); if (!it) return;
    lastPick = it;
    if (it.cat != null) { const btn = document.querySelector<HTMLButtonElement>(`#destCats .dest-cat[data-i="${it.cat}"]`); if (btn) btn.click(); }
    else if (it.scroll) { document.getElementById(it.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    paint();
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));

  try { window.addEventListener('wl3-mode', paint); } catch { /* */ }
  paint();
  setTimeout(paint, 2500); setTimeout(paint, 6000);
}
