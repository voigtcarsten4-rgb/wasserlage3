/* ═══ Fahrrinnen-Profil · EIN nautisches Entscheidungs-Cockpit ═══
 * Verdichtet Warnungen + Profil + Kennzahlen + Abschnitte + Lilly in EINE Premium-Einheit:
 *  · Statusleiste (kritischster Abschnitt · ELWIS · live)
 *  · Hero-Entscheidung (Kann ich fahren?)  — Gold-Akzent auf der Reserve
 *  · Unterwasser-Canvas (Tiefennebel · Lichtkegel · Caustics · Partikel · Brechung),
 *    fahrendes Premium-Boot + glühender Kielfreiheit-Strahl
 *  · schwebende HUD-KPIs (Min-Tiefe · fehlende Reserve · Abschnitte+Donut)
 *  · integrierte Abschnitts-Timeline · kompakte Lilly-Glass-Card
 * Echte ELWIS-Tiefen, kein Fake-3D/keine Fake-Zeitreise. Canvas-2D + rAF, offscreen-pause,
 * reduced-motion = ein statischer Frame. „Apple Weather × Garmin Marine × Hyperscreen". */

export type PCSeg = { group: string; sec: string; cm: number };
export type PCGroup = { name: string; minCm: number; avgCm: number; count: number; worst: 'ok' | 'tight' | 'bad' };
export type PCData = { host: HTMLElement; segs: PCSeg[]; groups: PCGroup[]; draftCm: number; reserveCm: number; sectionKey: string; pegel?: { dir: string; delta: number; strong: boolean; station: string } | null };

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const m2 = (m: number) => (m).toFixed(2).replace('.', ',') + ' m';
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c: RGB, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const FONT = '-apple-system,Segoe UI,Roboto,sans-serif';
const C_DEEP: RGB = [49, 213, 231], C_OK: RGB = [42, 162, 214], C_WARN: RGB = [255, 213, 138], C_HOT: RGB = [255, 138, 77], C_BAD: RGB = [255, 75, 92];
function clearColor(cm: number, draftCm: number, reserveCm: number): RGB {
  const clr = cm - draftCm, r = reserveCm > 0 ? clr / reserveCm : (clr >= 0 ? 1 : -1);
  if (r >= 1.4) return C_DEEP; if (r >= 1) return mix(C_OK, C_DEEP, clamp((r - 1) / 0.4, 0, 1));
  if (r >= 0.45) return mix(C_WARN, C_OK, clamp((r - 0.45) / 0.55, 0, 1));
  if (r >= 0) return mix(C_HOT, C_WARN, clamp(r / 0.45, 0, 1)); return mix(C_HOT, C_BAD, clamp(-r / 0.6, 0, 1));
}

const CSS = `
#tcx .pc{color:#eafaff;--gold:#E8C66B;--gold2:#caa23f}
#tcx .pc-strip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-height:34px;max-height:80px;overflow:hidden;background:rgba(6,20,34,.55);border:1px solid rgba(143,233,255,.14);border-radius:12px;padding:7px 12px;margin-bottom:10px;font-size:12px}
#tcx .pc-strip .ps{display:inline-flex;align-items:center;gap:6px;color:#cfe2ee;white-space:nowrap}
#tcx .pc-strip .ps b{color:#fff;font-weight:700}
#tcx .pc-strip .ps-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 7px currentColor}
#tcx .pc-strip .ps-live{margin-left:auto;color:#6fe6c2;font-weight:700;letter-spacing:.04em}
#tcx .pc-strip .ps-live i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#34e0a0;box-shadow:0 0 8px #34e0a0;margin-right:5px;animation:pcBlink 2.4s ease-in-out infinite}
@keyframes pcBlink{0%,100%{opacity:1}50%{opacity:.35}}
#tcx .pc-verdict{display:flex;gap:13px;align-items:center;border-radius:16px;padding:14px 16px;margin-bottom:11px;border:1px solid transparent;background:rgba(7,26,40,.5);transition:background .4s,border-color .4s}
#tcx .pc-verdict .pcv-ic{font-size:30px;line-height:1;flex:0 0 auto;filter:drop-shadow(0 3px 10px rgba(0,10,20,.5))}
#tcx .pc-verdict .pcv-tx{font:800 clamp(16px,2.4vw,21px) ${FONT};letter-spacing:-.02em;line-height:1.16}
#tcx .pc-verdict .pcv-sub{font-size:12.5px;color:#cfe2ee;margin-top:3px;font-weight:600}
#tcx .pc-verdict .pcv-sub .g{color:var(--gold);font-weight:800;text-shadow:0 0 14px rgba(232,198,107,.35)}
#tcx .pc-verdict.ok{background:linear-gradient(180deg,rgba(36,224,139,.16),rgba(7,26,40,.42));border-color:rgba(36,224,139,.4)}
#tcx .pc-verdict.tight{background:linear-gradient(180deg,rgba(255,196,77,.16),rgba(7,26,40,.42));border-color:rgba(255,196,77,.42)}
#tcx .pc-verdict.bad{background:linear-gradient(180deg,rgba(255,75,92,.18),rgba(7,26,40,.42));border-color:rgba(255,75,92,.46)}
#tcx .pc-verdict.ok .pcv-tx{color:#9ff0d2}#tcx .pc-verdict.tight .pcv-tx{color:#ffd98a}#tcx .pc-verdict.bad .pcv-tx{color:#ffc0c4}
#tcx .pc-stage{position:relative;width:100%;border-radius:18px;overflow:hidden;border:1px solid rgba(143,233,255,.16);box-shadow:0 34px 70px -44px rgba(0,8,20,.92),inset 0 1px 0 rgba(255,255,255,.05),inset 0 0 0 1px rgba(232,198,107,.07)}
#tcx .pc-canvas{display:block;width:100%;height:clamp(300px,40vh,440px);cursor:crosshair}
#tcx .pc-hud{position:absolute;z-index:3;background:rgba(5,18,31,.5);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);border:1px solid rgba(143,233,255,.18);border-radius:12px;padding:7px 11px;box-shadow:0 12px 28px -16px rgba(0,8,20,.7);pointer-events:none}
#tcx .pc-hud .h-lab{font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:#8fb6c8;font-weight:700}
#tcx .pc-hud .h-val{font:800 clamp(15px,2.3vw,20px) ${FONT};font-variant-numeric:tabular-nums;line-height:1.05;margin-top:1px}
#tcx .pc-hud .h-u{font-size:11px;font-weight:700;color:#a9c6d6}
#tcx .pc-hud-l{left:11px;top:11px}#tcx .pc-hud-c{left:50%;top:11px;transform:translateX(-50%);text-align:center}
#tcx .pc-hud-r{right:11px;top:11px;display:flex;align-items:center;gap:9px}
#tcx .pc-hud-c .h-val.gold{color:var(--gold);text-shadow:0 0 16px rgba(232,198,107,.4)}
#tcx .pc-hud-c .h-val.bad{color:#ff8a92}
#tcx .pc-donut{width:42px;height:42px;flex:0 0 auto;border-radius:50%;position:relative}
#tcx .pc-donut span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 13px ${FONT};color:#fff}
#tcx .pc-tip{position:absolute;left:11px;bottom:11px;z-index:4;max-width:62%;background:rgba(5,18,31,.84);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(143,233,255,.22);border-radius:11px;padding:7px 11px;font-size:12px;line-height:1.4;color:#eafaff;opacity:0;transition:opacity .25s;pointer-events:none}
#tcx .pc-tip b{color:#fff}
#tcx .pc-lilly{position:absolute;right:11px;bottom:11px;z-index:4;max-width:46%;display:flex;gap:8px;align-items:flex-start;background:linear-gradient(180deg,rgba(11,32,49,.82),rgba(7,24,38,.7));backdrop-filter:blur(11px);-webkit-backdrop-filter:blur(11px);border:1px solid rgba(232,198,107,.26);border-radius:13px;padding:9px 11px;box-shadow:0 16px 36px -20px rgba(0,8,20,.85)}
#tcx .pc-lilly .pcl-av{font-size:16px;flex:0 0 auto}
#tcx .pc-lilly .pcl-tx{font-size:11.5px;line-height:1.42;color:#e6f2f8}
#tcx .pc-lilly .pcl-tx b{color:var(--gold)}
#tcx .pc-lilly-btn{display:none}
#tcx .pc-heat{display:flex;gap:2px;margin-top:10px;height:8px;border-radius:5px;overflow:hidden}
#tcx .pc-heat i{flex:1 1 auto;min-width:2px}
#tcx .pc-stations{display:flex;gap:8px;margin-top:9px;overflow-x:auto;scrollbar-width:thin;padding-bottom:3px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
#tcx .pc-stations::-webkit-scrollbar{height:5px}#tcx .pc-stations::-webkit-scrollbar-thumb{background:rgba(143,233,255,.3);border-radius:3px}
#tcx .pc-st{flex:0 0 auto;scroll-snap-align:start;min-width:124px;text-align:left;background:rgba(7,26,40,.55);border:1px solid rgba(143,233,255,.16);border-radius:12px;padding:8px 11px;cursor:pointer;transition:transform .28s cubic-bezier(.34,1.4,.5,1),border-color .25s,box-shadow .25s}
#tcx .pc-st:hover{transform:translateY(-2px);border-color:rgba(49,213,231,.45)}
#tcx .pc-st.sel{border-color:var(--gold);box-shadow:0 0 16px -5px rgba(232,198,107,.6)}
#tcx .pc-st-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}
#tcx .pc-st-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 7px currentColor}
#tcx .pc-st-nm{font:700 11.5px ${FONT};color:#eafaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
#tcx .pc-st-meta{font-size:10.5px;color:#9fc0d2;font-variant-numeric:tabular-nums}
#tcx .pc-st-meta b{color:#fff}#tcx .pc-st-warn{color:#ffd98a}
#tcx .pc-outlook{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
#tcx .pc-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#bcd8e6;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:999px;padding:5px 10px}
#tcx .pc-chip.up{color:#9ff0d2;border-color:rgba(36,224,139,.3)}#tcx .pc-chip.down{color:#ffd0c4;border-color:rgba(255,138,77,.35)}
#tcx .pc-foot{font-size:10px;color:#7fa0b4;margin-top:9px;line-height:1.4}
@media(max-width:680px){
  #tcx .pc-canvas{height:clamp(240px,38vh,330px)}
  #tcx .pc-hud{padding:5px 8px}#tcx .pc-hud .h-val{font-size:14px}#tcx .pc-hud-r .pc-donut{width:34px;height:34px}
  #tcx .pc-hud-l,#tcx .pc-hud-r{top:8px}#tcx .pc-hud-l{left:8px}#tcx .pc-hud-r{right:8px}
  #tcx .pc-lilly{position:static;max-width:none;margin-top:9px;display:none}
  #tcx .pc-lilly.show{display:flex}
  #tcx .pc-lilly-btn{display:inline-flex;align-items:center;gap:6px;margin-top:9px;background:rgba(232,198,107,.14);border:1px solid rgba(232,198,107,.4);color:var(--gold);border-radius:999px;padding:7px 13px;font:700 12px ${FONT};cursor:pointer}
  #tcx .pc-st{min-width:140px}
}`;

let host: HTMLElement | null = null, DATA: PCData | null = null, focusGroup: string | null = null;
let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;
let W = 0, H = 0, DPR = 1, raf = 0, running = false, io: IntersectionObserver | null = null, onScreen = false;

function injectCSS() { if (!document.getElementById('pc-css')) { const s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); } }
function worstSeg(): PCSeg | null { if (!DATA || !DATA.segs.length) return null; return DATA.segs.reduce((a, b) => b.cm < a.cm ? b : a); }
function minCmAll(): number { return DATA && DATA.segs.length ? Math.min(...DATA.segs.map(s => s.cm)) : 0; }
function counts() { const d = DATA!; let ok = 0, tight = 0, bad = 0; for (const s of d.segs) { const c = s.cm - d.draftCm; if (c >= d.reserveCm) ok++; else if (c >= 0) tight++; else bad++; } return { ok, tight, bad, total: d.segs.length }; }

function verdict() {
  const d = DATA!, ws = worstSeg();
  if (!ws) return { cls: 'tight', ic: '❓', tx: 'Noch keine gemeldeten Tiefen', sub: 'Sobald ELWIS Werte liefert, bewerte ich die Route.' };
  const clr = ws.cm - d.draftCm, draftM = d.draftCm / 100;
  if (clr >= d.reserveCm) return { cls: 'ok', ic: '✅', tx: `Route mit <span class="g">${clr} cm</span> Reserve befahrbar`, sub: `für ${m2(draftM)} Tiefgang · engste Stelle: ${E(ws.sec)}`, clr, ws };
  if (clr >= 0) return { cls: 'tight', ic: '⚠️', tx: `Knapp — nur <span class="g">${clr} cm</span> Reserve`, sub: `engste Stelle: ${E(ws.sec)} · empf. ${d.reserveCm} cm`, clr, ws };
  return { cls: 'bad', ic: '⛔', tx: `Nicht empfohlen für ${m2(draftM)}`, sub: `${E(ws.sec)}: <span class="g">${Math.abs(clr)} cm</span> zu flach`, clr, ws };
}

/* Reduzierter-Tiefgang-Solver — ECHTE Mathematik aus echten Tiefen (kein Fake) */
function solver() {
  const d = DATA!, ws = worstSeg(); if (!ws) return null;
  const clr = ws.cm - d.draftCm; if (clr >= d.reserveCm) return null; // Route ok → kein Copilot
  const safeDraftCm = ws.cm - d.reserveCm;                 // Tiefgang, um an der engsten Stelle die Reserve zu treffen
  const reduce = Math.round(d.draftCm - safeDraftCm);      // nötige Reduktion
  const feasible = safeDraftCm >= 14 && reduce > 0;        // unter ~14 cm Tiefgang unrealistisch
  return { ws, clr, missing: d.reserveCm - clr, safeDraftCm: Math.round(safeDraftCm), reduce, feasible };
}
function saveIntent(kind: string, extra: any = {}) {
  try { const it = { id: 'r' + Date.now().toString(36), kind, draftCm: DATA?.draftCm, reserveCm: DATA?.reserveCm, section: focusGroup || DATA?.sectionKey || 'auto', verdict: verdict().cls, ts: Date.now(), ...extra }; localStorage.setItem('wl_route_intent', JSON.stringify(it)); window.dispatchEvent(new CustomEvent('wl3-route-intent', { detail: it })); return it; } catch { return null; }
}

function stripHtml() {
  const d = DATA!, ws = worstSeg(); const parts: string[] = [];
  if (ws) { const c = ws.cm - d.draftCm, col = c >= d.reserveCm ? '#24E08B' : c >= 0 ? '#FFC44D' : '#FF5C6B'; parts.push(`<span class="ps"><span class="ps-dot" style="color:${col}"></span><b>${E(ws.sec)}</b> ${c < 0 ? Math.abs(c) + ' cm zu flach' : 'engste Stelle'}</span>`); }
  parts.push(`<span class="ps">🌊 ${d.segs.length} Abschnitte</span>`);
  if (d.pegel) parts.push(`<span class="ps">📈 ${E(d.pegel.station)}</span>`);
  const now = new Date(); parts.push(`<span class="ps-live"><i></i>LIVE · ${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}</span>`);
  return parts.join('');
}

function copilotHtml() {
  const s = solver(); if (!s) return '';
  const d = DATA!; const rows: string[] = [];
  if (s.feasible) rows.push(`<button class="pc-sol pc-sol-go" data-act="draft"><span class="sol-ic">🎚️</span><span class="sol-tx"><b>Weniger Tiefgang:</b> auf ${m2(s.safeDraftCm / 100)} (−${s.reduce} cm) → engste Stelle erreicht die Reserve.</span><span class="sol-cta">So simulieren</span></button>`);
  else rows.push(`<div class="pc-sol pc-sol-info"><span class="sol-ic">⚓</span><span class="sol-tx">Auch mit minimalem Tiefgang bleibt es an <b>${E(s.ws.sec)}</b> zu flach — Alternativroute oder steigenden Pegel abwarten.</span></div>`);
  if (d.pegel && /steig|rise|up|pos/i.test(String(d.pegel.dir))) rows.push(`<div class="pc-sol pc-sol-info"><span class="sol-ic">🕒</span><span class="sol-tx"><b>${E(d.pegel.station)} steigt</b> → Reserve verbessert sich tendenziell. Beobachten statt riskieren.</span></div>`);
  rows.push(`<button class="pc-sol pc-sol-map" data-act="map"><span class="sol-ic">🗺️</span><span class="sol-tx">Strecke auf der Karte planen (Start/Ziel setzen)</span><span class="sol-cta">Öffnen</span></button>`);
  return `<div class="pc-cop-h">⚓ Routenvorschläge verfügbar</div>${rows.join('')}<div class="pc-cop-note">Ehrlich: alternative <i>Wasserrouten</i> mit Fahrzeit/Schleusen brauchen einen Routing-Graphen (in Arbeit) — hier kommen nur belegbare Lösungen.</div>`;
}

function stationsHtml() {
  const d = DATA!;
  return d.groups.map(g => { const col = g.worst === 'ok' ? '#24E08B' : g.worst === 'tight' ? '#FFC44D' : '#FF5C6B'; const probs = d.segs.filter(s => s.group === g.name && (s.cm - d.draftCm) < d.reserveCm).length; return `<button class="pc-st${focusGroup === g.name ? ' sel' : ''}" type="button" data-g="${E(g.name)}"><div class="pc-st-top"><span class="pc-st-dot" style="color:${col}"></span><span class="pc-st-nm">${E(g.name)}</span></div><div class="pc-st-meta">min <b>${m2(g.minCm / 100)}</b> · Ø ${m2(g.avgCm / 100)}</div><div class="pc-st-meta">${g.count} Abschnitte${probs ? ` · <span class="pc-st-warn">${probs} kritisch</span>` : ''}</div></button>`; }).join('');
}
function heatHtml() { const d = DATA!; return d.segs.map(s => `<i style="background:${rgb(clearColor(s.cm, d.draftCm, d.reserveCm))}"></i>`).join(''); }
function lillyHtml() {
  const d = DATA!, ws = worstSeg(); if (!ws) return 'Sobald Tiefen gemeldet sind, ordne ich deine Route ein.';
  const clr = ws.cm - d.draftCm, draftM = m2(d.draftCm / 100); const s = solver();
  if (clr >= d.reserveCm) return `Für <b>${draftM}</b> ist die Strecke sicher — engste Stelle (${E(ws.sec)}) hält ${clr} cm Reserve.`;
  const sol = s && s.feasible ? ` Mit <b>${m2(s.safeDraftCm / 100)}</b> Tiefgang wäre sie befahrbar.` : ' Mit aktuellem Tiefgang nicht lösbar — Alternativroute/Pegel abwarten.';
  if (clr >= 0) return `Für <b>${draftM}</b> ist es knapp: bei ${E(ws.sec)} nur ${clr} cm Reserve.${sol}`;
  return `Für <b>${draftM}</b> aktuell nicht empfohlen: bei ${E(ws.sec)} fehlen ${Math.abs(clr)} cm.${sol}`;
}
function outlookHtml() {
  const p = DATA && DATA.pegel; if (!p) return ''; const dir = String(p.dir || ''); let cls = '', txt = '';
  if (/fall|sink|fäll|down|neg/i.test(dir)) { cls = 'down'; txt = `${E(p.station)} fällt → Reserve wird knapper.`; }
  else if (/steig|rise|up|pos/i.test(dir)) { cls = 'up'; txt = `${E(p.station)} steigt → Reserve besser.`; }
  else txt = `${E(p.station)} stabil.`;
  return `<span class="pc-chip ${cls}">📈 Pegel-Tendenz: ${txt}</span>`;
}

const CSS2 = `
#tcx .pc-copilot{margin-bottom:11px;background:linear-gradient(180deg,rgba(11,32,49,.62),rgba(7,24,38,.44));border:1px solid rgba(232,198,107,.24);border-radius:15px;padding:11px 13px}
#tcx .pc-copilot:empty{display:none}
#tcx .pc-cop-h{font:800 13px ${FONT};color:#E8C66B;letter-spacing:-.01em;margin-bottom:8px}
#tcx .pc-sol{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:12px;padding:9px 11px;margin-bottom:7px;color:#e6f2f8;font:600 12.5px ${FONT};transition:transform .25s cubic-bezier(.34,1.4,.5,1),border-color .2s}
#tcx button.pc-sol{cursor:pointer;-webkit-tap-highlight-color:transparent}
#tcx button.pc-sol:hover{transform:translateY(-1px);border-color:rgba(232,198,107,.5)}
#tcx button.pc-sol:active{transform:scale(.99)}
#tcx .pc-sol .sol-ic{font-size:17px;flex:0 0 auto}
#tcx .pc-sol .sol-tx{flex:1;line-height:1.4}#tcx .pc-sol .sol-tx b{color:#fff}
#tcx .pc-sol .sol-cta{flex:0 0 auto;font:800 12px ${FONT};color:#04212b;background:linear-gradient(180deg,#F0D27A,#D9B14D);border-radius:9px;padding:7px 12px;box-shadow:0 8px 20px -10px rgba(232,198,107,.6);white-space:nowrap}
#tcx .pc-sol-map .sol-cta{color:#bfe6f5;background:rgba(143,233,255,.14);box-shadow:none}
#tcx .pc-cop-note{font-size:10px;color:#86a8bc;margin-top:2px;line-height:1.4}
#tcx .pc-flash{animation:pcFlash 1.3s ease}@keyframes pcFlash{0%{box-shadow:0 0 0 0 rgba(232,198,107,.5)}100%{box-shadow:0 0 0 22px rgba(232,198,107,0)}}
@media(min-width:681px){#tcx #tcxStage canvas{height:clamp(230px,32vh,320px)}}
#tcx .tcx-score,#tcx .tcx-warn,#tcx .tcx-precision{margin-top:12px}
@media(max-width:680px){#tcx .pc-copilot{padding:9px 10px}#tcx .pc-sol{padding:8px 9px;font-size:11.5px;gap:8px}#tcx .pc-sol .sol-cta{padding:6px 9px;font-size:11px}#tcx .pc-cop-h{font-size:12px}#tcx .pc-verdict{padding:11px 12px}#tcx .pc-strip{font-size:11px}}`;

function buildShell(h: HTMLElement) {
  if (!document.getElementById('pc-css2')) { const s = document.createElement('style'); s.id = 'pc-css2'; s.textContent = CSS2; document.head.appendChild(s); }
  h.innerHTML = `
    <div class="pc">
      <div class="pc-strip" id="pcStrip"></div>
      <div class="pc-verdict" id="pcVerdict"></div>
      <div class="pc-copilot" id="pcCopilot"></div>
      <div class="pc-stage" id="pcStage">
        <canvas class="pc-canvas" id="pcCanvas"></canvas>
        <div class="pc-hud pc-hud-l" id="pcHudL"></div>
        <div class="pc-hud pc-hud-c" id="pcHudC"></div>
        <div class="pc-hud pc-hud-r" id="pcHudR"></div>
        <div class="pc-tip" id="pcTip"></div>
        <div class="pc-lilly" id="pcLilly"></div>
      </div>
      <button class="pc-lilly-btn" id="pcLillyBtn" type="button">⚓ Lillys Einschätzung</button>
      <div class="pc-heat" id="pcHeat"></div>
      <div class="pc-stations" id="pcStations"></div>
      <div class="pc-outlook" id="pcOutlook"></div>
      <div class="pc-foot">Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen · gleich breit, keine GPS-Distanzen · verbindlich bleibt ELWIS.</div>
    </div>`;
  h.querySelector('#pcStations')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('.pc-st') as HTMLElement | null; if (!b) return;
    const g = b.dataset.g!; focusGroup = focusGroup === g ? null : g;
    const sel = document.getElementById('tcxSection') as HTMLSelectElement | null;
    if (sel) { const opt = [...sel.options].find(o => o.value === (focusGroup || 'auto')) || [...sel.options].find(o => o.value === 'auto'); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } }
    updateContent();
  });
  h.querySelector('#pcCopilot')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button.pc-sol') as HTMLElement | null; if (!b) return;
    const act = b.dataset.act; const s = solver();
    if (act === 'draft' && s && s.feasible) {
      const m = s.safeDraftCm / 100;
      try { (window as any).__wlSetDraft && (window as any).__wlSetDraft(m); } catch { /* */ }
      saveIntent('reduced-draft', { toDraftCm: s.safeDraftCm });
      const stage = h.querySelector('.pc-stage') as HTMLElement | null; if (stage) { stage.classList.add('pc-flash'); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => stage.classList.remove('pc-flash'), 1400); }
    } else if (act === 'map') { saveIntent('plan-map'); document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  const lb = h.querySelector('#pcLillyBtn'); const ll = h.querySelector('#pcLilly');
  lb && lb.addEventListener('click', () => ll && ll.classList.toggle('show'));
}

function updateContent() {
  if (!host || !DATA) return; const d = DATA;
  const set = (id: string, html: string) => { const e = host!.querySelector('#' + id) as HTMLElement; if (e) e.innerHTML = html; };
  set('pcStrip', stripHtml());
  const v = verdict(); const vd = host.querySelector('#pcVerdict') as HTMLElement; if (vd) { vd.className = 'pc-verdict ' + v.cls; vd.innerHTML = `<span class="pcv-ic">${v.ic}</span><div><div class="pcv-tx">${v.tx}</div><div class="pcv-sub">${v.sub}</div></div>`; }
  set('pcCopilot', copilotHtml());
  // HUD
  set('pcHudL', `<div class="h-lab">Min-Tiefe</div><div class="h-val">${m2(minCmAll() / 100).replace(' m', '')}<span class="h-u"> m</span></div>`);
  const ws = worstSeg(); const clr = ws ? ws.cm - d.draftCm : 0;
  const cKey = clr >= 0 ? `<div class="h-lab">Reserve engste Stelle</div><div class="h-val gold">${clr}<span class="h-u"> cm</span></div>` : `<div class="h-lab">Es fehlen</div><div class="h-val bad">${Math.abs(clr)}<span class="h-u"> cm</span></div>`;
  set('pcHudC', cKey);
  const c = counts(); const a = c.total ? Math.round(c.ok / c.total * 100) : 0, bb = c.total ? Math.round((c.ok + c.tight) / c.total * 100) : 0;
  set('pcHudR', `<div><div class="h-lab">Abschnitte</div><div class="h-val">${c.total}</div></div><div class="pc-donut" style="background:conic-gradient(#24E08B 0 ${a}%,#FFC44D ${a}% ${bb}%,#FF5C6B ${bb}% 100%)"><span style="background:radial-gradient(circle 13px at 50% 50%,rgba(5,18,31,.96) 64%,transparent 66%)">${c.bad || c.tight || '✓'}</span></div>`);
  set('pcLilly', `<span class="pcl-av">⚓</span><div class="pcl-tx"><b>Lilly meint:</b> ${lillyHtml()}</div>`);
  set('pcHeat', heatHtml());
  set('pcStations', stationsHtml());
  set('pcOutlook', outlookHtml());
}

let scale = 300, samples: { x: number; cm: number; sec: string; group: string }[] = [];
let hoverX = -1, tSec = 0, lastTs = 0;
let parts: { x: number; y: number; r: number; sp: number }[] = [];

function computeFloor() {
  if (!DATA) return; const segs = DATA.segs;
  const maxCm = segs.length ? Math.max(...segs.map(s => s.cm)) : 300;
  scale = Math.max(160, DATA.draftCm + DATA.reserveCm + 25, Math.round(maxCm * 1.1));
  const n = Math.max(1, segs.length);
  samples = segs.map((s, i) => ({ x: n === 1 ? 0.5 : i / (n - 1), cm: s.cm, sec: s.sec, group: s.group }));
  if (samples.length === 1) samples = [{ ...samples[0], x: 0.12 }, { ...samples[0], x: 0.88 }];
  if (!parts.length) parts = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, sp: 0.004 + Math.random() * 0.01 }));
}
function floorAt(x: number) {
  if (!samples.length) return { cm: scale * 0.5, sec: '', group: '' };
  if (x <= samples[0].x) return samples[0]; if (x >= samples[samples.length - 1].x) return samples[samples.length - 1];
  for (let i = 1; i < samples.length; i++) { if (x <= samples[i].x) { const a = samples[i - 1], b = samples[i], t = (x - a.x) / (b.x - a.x || 1); return { cm: lerp(a.cm, b.cm, t), sec: t < 0.5 ? a.sec : b.sec, group: t < 0.5 ? a.group : b.group }; } }
  return samples[samples.length - 1];
}
function ensureCanvas() {
  const c = host!.querySelector('#pcCanvas') as HTMLCanvasElement | null; if (!c) return;
  if (cv === c && cx) { resize(); return; }
  cv = c; cx = c.getContext('2d'); DPR = Math.min(window.devicePixelRatio || 1, 2); resize();
  try { new ResizeObserver(() => { resize(); draw(tSec); }).observe(c); } catch { addEventListener('resize', resize); }
  try { io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }, { rootMargin: '120px' }); io.observe(c.parentElement!); } catch { onScreen = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  let pinned = false;
  const pos = (ev: PointerEvent) => { pinned = ev.pointerType === 'touch'; const r = c.getBoundingClientRect(); hoverX = clamp((ev.clientX - r.left) / r.width, 0, 1); const tip = host!.querySelector('#pcTip') as HTMLElement, f = floorAt(hoverX); try{ (window as any).__wlSimBed && (window as any).__wlSimBed(f.cm); }catch{ /* */ } if (tip && DATA) { const clr = Math.round(f.cm - DATA.draftCm), m = clr >= DATA.reserveCm ? '✅' : clr >= 0 ? '⚠️' : '⛔'; tip.innerHTML = `<b>${E(f.sec || f.group)}</b> · ${m2(f.cm / 100)} · ${m} ${clr >= 0 ? clr + ' cm Reserve' : Math.abs(clr) + ' cm zu flach'}`; tip.style.opacity = '1'; } if (reduceMotion()) draw(0); };
  c.addEventListener('pointermove', pos); c.addEventListener('pointerdown', pos);
  c.addEventListener('pointerleave', () => { if (pinned) return; hoverX = -1; try{ (window as any).__wlSimBed && (window as any).__wlSimBed(null); }catch{ /* */ } const tip = host!.querySelector('#pcTip') as HTMLElement; if (tip) tip.style.opacity = '0'; if (reduceMotion()) draw(0); });
}
function resize() { if (!cv) return; const w = cv.clientWidth || 320, h = cv.clientHeight || 200; W = Math.round(w * DPR); H = Math.round(h * DPR); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; }
function sync() { const want = onScreen && !document.hidden && !reduceMotion(); if (want && !running) { running = true; lastTs = 0; raf = requestAnimationFrame(loop); } else if (!want && running) { running = false; cancelAnimationFrame(raf); } }
function loop(ts: number) { if (!running) return; if (lastTs) tSec += Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts; draw(tSec); raf = requestAnimationFrame(loop); }
function yOf(cm: number) { const surf = H * 0.15, pad = H * 0.1; return surf + clamp(cm / scale, 0, 1) * (H - surf - pad); }

function draw(t: number) {
  if (!cx || !DATA || !W) return; const ctx = cx, d = DATA, surfY = H * 0.15;
  ctx.clearRect(0, 0, W, H);
  let g = ctx.createLinearGradient(0, 0, 0, surfY); g.addColorStop(0, 'rgba(8,26,42,.95)'); g.addColorStop(1, 'rgba(12,44,64,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, surfY);
  g = ctx.createLinearGradient(0, surfY, 0, H); g.addColorStop(0, 'rgba(49,213,231,.14)'); g.addColorStop(.4, 'rgba(14,82,116,.55)'); g.addColorStop(.78, 'rgba(6,30,48,.85)'); g.addColorStop(1, 'rgba(2,12,22,.97)'); ctx.fillStyle = g; ctx.fillRect(0, surfY, W, H - surfY);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // Lichtkegel
  const cxr = W * 0.5 + Math.sin(t * 0.3) * W * 0.06; g = ctx.createLinearGradient(0, surfY, 0, H); g.addColorStop(0, 'rgba(150,235,250,.16)'); g.addColorStop(1, 'rgba(150,235,250,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cxr - W * 0.06, surfY); ctx.lineTo(cxr + W * 0.06, surfY); ctx.lineTo(cxr + W * 0.34, H); ctx.lineTo(cxr - W * 0.34, H); ctx.closePath(); ctx.fill();
  // Caustics
  for (let k = 0; k < 4; k++) { const yy = surfY + (k + 1) * H * 0.06; ctx.strokeStyle = `rgba(130,228,248,${0.06 - k * 0.012})`; ctx.lineWidth = DPR * (3 - k * 0.5); ctx.beginPath(); for (let x = 0; x <= W; x += 9 * DPR) { const y = yy + Math.sin(x * 0.013 + t * (0.7 + k * 0.3) + k) * 5 * DPR; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  // Partikel
  ctx.fillStyle = 'rgba(180,240,252,.5)'; for (const p of parts) { p.y -= p.sp * 0.6; if (p.y < 0.02) { p.y = 1; p.x = Math.random(); } const px = ((p.x + Math.sin(t * 0.4 + p.y * 9) * 0.01) % 1) * W, py = surfY + p.y * (H - surfY); ctx.globalAlpha = .12 + .25 * (1 - p.y); ctx.beginPath(); ctx.arc(px, py, p.r * DPR, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.restore();
  // Floor
  const N = 64, pX: number[] = [], pY: number[] = []; for (let i = 0; i <= N; i++) { const x = i / N; pX.push(x * W); pY.push(yOf(floorAt(x).cm)); }
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(pX[0], pY[0]); for (let i = 1; i <= N; i++) ctx.lineTo(pX[i], pY[i]); ctx.lineTo(W, H); ctx.closePath();
  g = ctx.createLinearGradient(0, surfY, 0, H); g.addColorStop(0, 'rgba(30,42,54,.7)'); g.addColorStop(1, 'rgba(6,12,20,.99)'); ctx.fillStyle = g; ctx.fill();
  const reserveY = yOf(d.draftCm + d.reserveCm), draftY = yOf(d.draftCm);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) { const c0 = floorAt(i / N).cm, clr = c0 - d.draftCm; if (clr < d.reserveCm) { ctx.fillStyle = rgb(clearColor(c0, d.draftCm, d.reserveCm), clr < 0 ? 0.36 : 0.18); ctx.fillRect(pX[i], Math.min(pY[i], reserveY) - 1, (W / N) + 1, Math.abs(pY[i] - reserveY) + 2); } }
  ctx.restore();
  // Floor-Kante + Glow + Brechungs-Schimmer
  ctx.lineWidth = DPR * 3.7; ctx.lineJoin = 'round'; ctx.shadowBlur = DPR * 13;
  for (let i = 0; i < N; i++) { const col = clearColor(floorAt(i / N).cm, d.draftCm, d.reserveCm); ctx.strokeStyle = rgb(col, .96); ctx.shadowColor = rgb(col, .6); ctx.beginPath(); ctx.moveTo(pX[i], pY[i]); ctx.lineTo(pX[i + 1], pY[i + 1]); ctx.stroke(); }
  ctx.shadowBlur = 0; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,250,255,.5)'; ctx.lineWidth = DPR; const sh = (Math.sin(t * 1.1) * .5 + .5); ctx.beginPath(); for (let i = 0; i <= N; i++) { const x = i / N; if (Math.abs(x - sh) < .12) { i === 0 ? ctx.moveTo(pX[i], pY[i] - 2 * DPR) : ctx.lineTo(pX[i], pY[i] - 2 * DPR); } } ctx.stroke(); ctx.restore();
  // Linien
  ctx.setLineDash([6 * DPR, 5 * DPR]); ctx.lineWidth = DPR * 1.5; ctx.strokeStyle = 'rgba(232,198,107,.8)'; ctx.beginPath(); ctx.moveTo(0, reserveY); ctx.lineTo(W, reserveY); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(0, draftY); ctx.lineTo(W, draftY); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `${10.5 * DPR}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(`Tiefgang ${m2(d.draftCm / 100)}`, 8 * DPR, draftY - 4 * DPR); ctx.fillStyle = 'rgba(232,198,107,.95)'; ctx.fillText(`empf. Reserve ${d.reserveCm} cm`, 8 * DPR, reserveY + 13 * DPR);
  // Kritische Zonen
  const pulse = .5 + .5 * Math.sin(t * 2.4); for (const s of samples) if (s.cm - d.draftCm < 0) { const x = s.x * W, y = yOf(s.cm), rad = ctx.createRadialGradient(x, y, 0, x, y, 32 * DPR); rad.addColorStop(0, `rgba(255,75,92,${.3 + .22 * pulse})`); rad.addColorStop(1, 'rgba(255,75,92,0)'); ctx.fillStyle = rad; ctx.beginPath(); ctx.arc(x, y, 32 * DPR, 0, 7); ctx.fill(); }
  // Oberfläche
  ctx.strokeStyle = 'rgba(155,238,252,.7)'; ctx.lineWidth = DPR * 1.6; ctx.beginPath(); for (let x = 0; x <= W; x += 6 * DPR) { const y = surfY + Math.sin(x * 0.02 + t * 1.3) * 2.5 * DPR; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  // Boot + Kielfreiheit-Strahl
  const wX = samples.length ? samples.reduce((a, b) => b.cm < a.cm ? b : a).x : 0.5;   // engste Stelle (kein Auto-Film)
  const boatX = hoverX >= 0 ? hoverX : wX, bx = boatX * W, bob = Math.sin(t * 1.8) * 3 * DPR, bsurf = surfY + bob, keelY = draftY + bob;
  const f = floorAt(boatX), clrCm = Math.round(f.cm - d.draftCm), kc: RGB = clrCm >= d.reserveCm ? [36, 224, 139] : clrCm >= 0 ? [255, 196, 77] : [255, 75, 92], fy0 = yOf(f.cm);
  const beam = ctx.createLinearGradient(0, keelY, 0, fy0); beam.addColorStop(0, rgb(kc, .85)); beam.addColorStop(1, rgb(kc, .12)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = beam; ctx.fillRect(bx - 5 * DPR, keelY, 10 * DPR, Math.max(2, fy0 - keelY)); ctx.restore();
  ctx.fillStyle = rgb(kc, .95); const pillY = (keelY + fy0) / 2; ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(bx - 26 * DPR, pillY - 9 * DPR, 52 * DPR, 18 * DPR, 9 * DPR) : ctx.rect(bx - 26 * DPR, pillY - 9 * DPR, 52 * DPR, 18 * DPR); ctx.fill();
  ctx.fillStyle = '#04212b'; ctx.font = `800 ${11 * DPR}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(clrCm >= 0 ? `${clrCm} cm` : `${Math.abs(clrCm)} cm ⚠`, bx, pillY + 4 * DPR); ctx.textAlign = 'left';
  const bw = 34 * DPR; ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#9fd6e6'; ctx.beginPath(); ctx.moveTo(bx - bw / 2 + 5 * DPR, bsurf + 4 * DPR); ctx.lineTo(bx + bw / 2 - 5 * DPR, bsurf + 4 * DPR); ctx.lineTo(bx + bw / 2 - 9 * DPR, bsurf + 13 * DPR); ctx.lineTo(bx - bw / 2 + 9 * DPR, bsurf + 13 * DPR); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#f1f8fc'; ctx.beginPath(); ctx.moveTo(bx - bw / 2, bsurf - 8 * DPR); ctx.lineTo(bx + bw / 2, bsurf - 8 * DPR); ctx.lineTo(bx + bw / 2 - 6 * DPR, bsurf + 3 * DPR); ctx.lineTo(bx - bw / 2 + 6 * DPR, bsurf + 3 * DPR); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2f6f86'; ctx.fillRect(bx - 7 * DPR, bsurf - 16 * DPR, 14 * DPR, 8 * DPR); ctx.fillStyle = '#bfe9ff'; ctx.fillRect(bx - 4 * DPR, bsurf - 14 * DPR, 5 * DPR, 4 * DPR);
  if (hoverX >= 0) { ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = DPR; ctx.setLineDash([3 * DPR, 3 * DPR]); ctx.beginPath(); ctx.moveTo(bx, surfY); ctx.lineTo(bx, H); ctx.stroke(); ctx.setLineDash([]); }
  // Tiefen-Vignette → mehr 3D-Raumwirkung
  const vig = ctx.createRadialGradient(W * 0.5, H * 0.4, Math.min(W, H) * 0.18, W * 0.5, H * 0.52, Math.max(W, H) * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(2,10,20,.52)'); ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

export function renderProfileCockpit(data: PCData) {
  DATA = data; host = data.host; if (!host) return;
  injectCSS(); if (!host.querySelector('.pc')) buildShell(host);
  if (focusGroup && !data.groups.some(g => g.name === focusGroup)) focusGroup = null;
  updateContent(); computeFloor(); ensureCanvas();
  draw(0); if (!reduceMotion()) sync();
}
