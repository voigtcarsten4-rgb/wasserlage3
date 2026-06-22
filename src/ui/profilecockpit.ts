/* ═══ Tiefencheck · EIN nautisches Entscheidungs-Cockpit (WebGL-3D) ═══
 * Verschmilzt Verdikt + 3D-Tiefenlandschaft + Routen-Copilot + „Wo kann ich lang?" in EINE Einheit.
 *  · ELWIS-Statusleiste (kritischster Abschnitt · live)
 *  · EIN Verdikt (Kann ich fahren?) — Worst-Case der gewählten Strecke, kein Zweit-Verdikt
 *  · Echte WebGL-3D-Tiefenlandschaft (depth3d.ts, lazy Three.js) + schwebende HUD-KPIs
 *  · Routen-Copilot (echter Reduzierter-Tiefgang-Solver + Karten-Handoff, keine erfundenen Routen)
 *  · „Wo kann ich lang?" — Korridor-Passierbarkeit aus echten ELWIS-Tiefen (frei/knapp/gesperrt)
 * Nur belegbare Daten. Fallback-Gradient falls kein WebGL. */

import { mountDepth3D, type Depth3D, type D3State } from './depth3d';

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
#tcx .pc-stage{position:relative;width:100%;border-radius:18px;overflow:hidden;border:1px solid rgba(143,233,255,.16);box-shadow:0 34px 70px -44px rgba(0,8,20,.92),inset 0 1px 0 rgba(255,255,255,.05),inset 0 0 0 1px rgba(232,198,107,.07);background:radial-gradient(120% 90% at 50% 0%,#0e3650 0%,#0a263c 42%,#06182b 100%)}
#tcx .pc-canvas{display:block;width:100%;height:clamp(300px,42vh,440px)}
#tcx .pc-3dbadge{position:absolute;left:11px;bottom:10px;z-index:3;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#8fb6c8;background:rgba(5,18,31,.5);border:1px solid rgba(143,233,255,.16);border-radius:8px;padding:3px 8px;backdrop-filter:blur(6px);pointer-events:none}
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
#tcx .pc-lilly{position:absolute;right:11px;bottom:11px;z-index:4;max-width:46%;display:flex;gap:8px;align-items:flex-start;background:linear-gradient(180deg,rgba(11,32,49,.82),rgba(7,24,38,.7));backdrop-filter:blur(11px);-webkit-backdrop-filter:blur(11px);border:1px solid rgba(232,198,107,.26);border-radius:13px;padding:9px 11px;box-shadow:0 16px 36px -20px rgba(0,8,20,.85)}
#tcx .pc-lilly .pcl-av{font-size:16px;flex:0 0 auto}
#tcx .pc-lilly .pcl-tx{font-size:11.5px;line-height:1.42;color:#e6f2f8}
#tcx .pc-lilly .pcl-tx b{color:var(--gold)}
#tcx .pc-lilly-btn{display:none}
/* Wo kann ich lang? */
#tcx .pc-pass{margin-top:12px}
#tcx .pc-pass-h{font:800 13.5px ${FONT};color:#eafaff;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:9px}
#tcx .pc-pass-h small{color:#9fc0d2;font-weight:600;font-size:11px}
#tcx .pc-heat{display:flex;gap:2px;margin-bottom:10px;height:9px;border-radius:5px;overflow:hidden}
#tcx .pc-heat i{flex:1 1 auto;min-width:2px}
#tcx .pc-corr{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
#tcx .pc-cr{text-align:left;background:rgba(7,26,40,.55);border:1px solid rgba(143,233,255,.14);border-radius:13px;padding:10px 12px;cursor:pointer;transition:transform .25s cubic-bezier(.34,1.4,.5,1),border-color .2s,box-shadow .2s}
#tcx .pc-cr:hover{transform:translateY(-2px);border-color:rgba(49,213,231,.4)}
#tcx .pc-cr.sel{border-color:var(--gold);box-shadow:0 0 16px -5px rgba(232,198,107,.6)}
#tcx .pc-cr-top{display:flex;align-items:center;gap:7px;margin-bottom:7px}
#tcx .pc-cr-nm{font:700 12.5px ${FONT};color:#eafaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
#tcx .pc-cr-pill{flex:0 0 auto;font:800 10px ${FONT};letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
#tcx .pc-cr-pill.ok{color:#04212b;background:linear-gradient(180deg,#5be3a0,#24c07e)}
#tcx .pc-cr-pill.tight{color:#3a2c00;background:linear-gradient(180deg,#ffd98a,#e8b94d)}
#tcx .pc-cr-pill.bad{color:#fff;background:linear-gradient(180deg,#ff6b78,#d8323f)}
#tcx .pc-cr-bar{position:relative;height:12px;border-radius:7px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:5px}
#tcx .pc-cr-fill{position:absolute;left:0;top:0;bottom:0;border-radius:7px}
#tcx .pc-cr-draft{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;box-shadow:0 0 5px rgba(255,255,255,.9);z-index:2}
#tcx .pc-cr-rec{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--gold);box-shadow:0 0 5px rgba(232,198,107,.9);z-index:2}
#tcx .pc-cr-meta{font-size:10.5px;color:#9fc0d2;font-variant-numeric:tabular-nums}
#tcx .pc-cr-meta b{color:#fff}#tcx .pc-cr-meta .w{color:#ffd98a}
#tcx .pc-outlook{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
#tcx .pc-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#bcd8e6;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:999px;padding:5px 10px}
#tcx .pc-chip.up{color:#9ff0d2;border-color:rgba(36,224,139,.3)}#tcx .pc-chip.down{color:#ffd0c4;border-color:rgba(255,138,77,.35)}
#tcx .pc-foot{font-size:10px;color:#7fa0b4;margin-top:10px;line-height:1.4}
@media(max-width:680px){
  #tcx .pc-canvas{height:clamp(240px,40vh,320px)}
  #tcx .pc-hud{padding:5px 8px}#tcx .pc-hud .h-val{font-size:14px}#tcx .pc-hud-r .pc-donut{width:34px;height:34px}
  #tcx .pc-hud-l,#tcx .pc-hud-r{top:8px}#tcx .pc-hud-l{left:8px}#tcx .pc-hud-r{right:8px}
  #tcx .pc-lilly{position:static;max-width:none;margin-top:9px;display:none}
  #tcx .pc-lilly.show{display:flex}
  #tcx .pc-lilly-btn{display:inline-flex;align-items:center;gap:6px;margin-top:9px;background:rgba(232,198,107,.14);border:1px solid rgba(232,198,107,.4);color:var(--gold);border-radius:999px;padding:7px 13px;font:700 12px ${FONT};cursor:pointer}
  #tcx .pc-corr{grid-template-columns:1fr 1fr}
}
@media(max-width:430px){#tcx .pc-corr{grid-template-columns:1fr}}`;

const CSS2 = `
#tcx .pc-copilot{margin-top:11px;background:linear-gradient(180deg,rgba(11,32,49,.62),rgba(7,24,38,.44));border:1px solid rgba(232,198,107,.24);border-radius:15px;padding:11px 13px}
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
@media(max-width:680px){#tcx .pc-copilot{padding:9px 10px}#tcx .pc-sol{padding:8px 9px;font-size:11.5px;gap:8px}#tcx .pc-sol .sol-cta{padding:6px 9px;font-size:11px}#tcx .pc-cop-h{font-size:12px}#tcx .pc-verdict{padding:11px 12px}#tcx .pc-strip{font-size:11px}}`;

let host: HTMLElement | null = null, DATA: PCData | null = null, focusGroup: string | null = null;
let d3: Depth3D | null = null, d3pending = false;

function injectCSS() {
  if (!document.getElementById('pc-css')) { const s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (!document.getElementById('pc-css2')) { const s = document.createElement('style'); s.id = 'pc-css2'; s.textContent = CSS2; document.head.appendChild(s); }
}
function worstSeg(): PCSeg | null { if (!DATA || !DATA.segs.length) return null; return DATA.segs.reduce((a, b) => b.cm < a.cm ? b : a); }
function minCmAll(): number { return DATA && DATA.segs.length ? Math.min(...DATA.segs.map(s => s.cm)) : 0; }
function counts() { const d = DATA!; let ok = 0, tight = 0, bad = 0; for (const s of d.segs) { const c = s.cm - d.draftCm; if (c >= d.reserveCm) ok++; else if (c >= 0) tight++; else bad++; } return { ok, tight, bad, total: d.segs.length }; }

function verdict() {
  const d = DATA!, ws = worstSeg();
  if (!ws) return { cls: 'tight', ic: '❓', tx: 'Noch keine gemeldeten Tiefen', sub: 'Sobald ELWIS Werte liefert, bewerte ich die Strecke.' };
  const clr = ws.cm - d.draftCm, draftM = d.draftCm / 100;
  if (clr >= d.reserveCm) return { cls: 'ok', ic: '✅', tx: `Sicher befahrbar — <span class="g">${clr} cm</span> Reserve`, sub: `für ${m2(draftM)} Tiefgang · engste Stelle: ${E(ws.sec)}`, clr, ws };
  if (clr >= 0) return { cls: 'tight', ic: '⚠️', tx: `Knapp — nur <span class="g">${clr} cm</span> Reserve`, sub: `engste Stelle: ${E(ws.sec)} · empf. ${d.reserveCm} cm`, clr, ws };
  return { cls: 'bad', ic: '⛔', tx: `Nicht empfohlen für ${m2(draftM)}`, sub: `${E(ws.sec)}: <span class="g">${Math.abs(clr)} cm</span> zu flach`, clr, ws };
}

function solver() {
  const d = DATA!, ws = worstSeg(); if (!ws) return null;
  const clr = ws.cm - d.draftCm; if (clr >= d.reserveCm) return null;
  const safeDraftCm = ws.cm - d.reserveCm, reduce = Math.round(d.draftCm - safeDraftCm), feasible = safeDraftCm >= 14 && reduce > 0;
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
  const s = solver(); if (!s) return ''; const d = DATA!; const rows: string[] = [];
  if (s.feasible) rows.push(`<button class="pc-sol pc-sol-go" data-act="draft"><span class="sol-ic">🎚️</span><span class="sol-tx"><b>Weniger Tiefgang:</b> auf ${m2(s.safeDraftCm / 100)} (−${s.reduce} cm) → engste Stelle erreicht die Reserve.</span><span class="sol-cta">So simulieren</span></button>`);
  else rows.push(`<div class="pc-sol pc-sol-info"><span class="sol-ic">⚓</span><span class="sol-tx">Auch mit minimalem Tiefgang bleibt es an <b>${E(s.ws.sec)}</b> zu flach — Alternativroute oder steigenden Pegel abwarten.</span></div>`);
  if (d.pegel && /steig|rise|up|pos/i.test(String(d.pegel.dir))) rows.push(`<div class="pc-sol pc-sol-info"><span class="sol-ic">🕒</span><span class="sol-tx"><b>${E(d.pegel.station)} steigt</b> → Reserve verbessert sich tendenziell. Beobachten statt riskieren.</span></div>`);
  rows.push(`<button class="pc-sol pc-sol-map" data-act="map"><span class="sol-ic">🗺️</span><span class="sol-tx">Ausweich-Strecke auf der Karte planen (Start/Ziel setzen)</span><span class="sol-cta">Öffnen</span></button>`);
  return `<div class="pc-cop-h">⚓ Was du tun kannst</div>${rows.join('')}<div class="pc-cop-note">Ehrlich: Fahrzeit & Schleusenzeiten einer Ausweichroute brauchen Schleusen-Fahrpläne (nicht als offene Daten verfügbar) — hier kommen nur belegbare Lösungen + die Karte.</div>`;
}

function heatHtml() { const d = DATA!; return d.segs.map(s => `<i style="background:${rgb(clearColor(s.cm, d.draftCm, d.reserveCm))}"></i>`).join(''); }

function passHtml() {
  const d = DATA!; if (!d.groups.length) return '';
  const rank = (g: PCGroup) => g.worst === 'bad' ? 0 : g.worst === 'tight' ? 1 : 2;
  const order = [...d.groups].sort((a, b) => rank(a) - rank(b) || a.minCm - b.minCm);
  const free = d.groups.filter(g => g.worst === 'ok').length;
  const scale = Math.max(160, d.draftCm + d.reserveCm + 25, ...d.groups.map(g => g.minCm));
  const draftPct = clamp(d.draftCm / scale * 100, 0, 100), recPct = clamp((d.draftCm + d.reserveCm) / scale * 100, 0, 100);
  const rows = order.map(g => {
    const pillTx = g.worst === 'ok' ? 'frei' : g.worst === 'tight' ? 'knapp' : 'gesperrt';
    const fillPct = clamp(g.minCm / scale * 100, 0, 100);
    const col = clearColor(g.minCm, d.draftCm, d.reserveCm);
    const probs = d.segs.filter(s => s.group === g.name && (s.cm - d.draftCm) < d.reserveCm).length;
    return `<button class="pc-cr${focusGroup === g.name ? ' sel' : ''}" type="button" data-g="${E(g.name)}">
      <div class="pc-cr-top"><span class="pc-cr-nm">${E(g.name)}</span><span class="pc-cr-pill ${g.worst}">${pillTx}</span></div>
      <div class="pc-cr-bar"><div class="pc-cr-fill" style="width:${fillPct}%;background:${rgb(col, .9)}"></div><div class="pc-cr-rec" style="left:${recPct}%"></div><div class="pc-cr-draft" style="left:${draftPct}%"></div></div>
      <div class="pc-cr-meta">min <b>${m2(g.minCm / 100)}</b> · Ø ${m2(g.avgCm / 100)} · ${g.count} Abschn.${probs ? ` · <span class="w">${probs} kritisch</span>` : ''}</div>
    </button>`;
  }).join('');
  return `<div class="pc-pass-h">🧭 Wo kann ich lang? <small>${free}/${d.groups.length} Reviere frei für ${m2(d.draftCm / 100)} Tiefgang · weiße Linie = dein Tiefgang, gold = empf. Reserve</small></div>
    <div class="pc-heat">${heatHtml()}</div>
    <div class="pc-corr">${rows}</div>${outlookHtml()}`;
}

function lillyHtml() {
  const d = DATA!, ws = worstSeg(); if (!ws) return 'Sobald Tiefen gemeldet sind, ordne ich deine Strecke ein.';
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
  return `<div class="pc-outlook"><span class="pc-chip ${cls}">📈 Pegel-Tendenz: ${txt}</span></div>`;
}

function buildShell(h: HTMLElement) {
  h.innerHTML = `
    <div class="pc">
      <div class="pc-strip" id="pcStrip"></div>
      <div class="pc-verdict" id="pcVerdict"></div>
      <div class="pc-stage" id="pcStage">
        <canvas class="pc-canvas" id="pcCanvas"></canvas>
        <div class="pc-hud pc-hud-l" id="pcHudL"></div>
        <div class="pc-hud pc-hud-c" id="pcHudC"></div>
        <div class="pc-hud pc-hud-r" id="pcHudR"></div>
        <div class="pc-lilly" id="pcLilly"></div>
        <div class="pc-3dbadge">3D · echte ELWIS-Tiefen</div>
      </div>
      <button class="pc-lilly-btn" id="pcLillyBtn" type="button">⚓ Lillys Einschätzung</button>
      <div class="pc-copilot" id="pcCopilot"></div>
      <div class="pc-pass" id="pcPass"></div>
      <div class="pc-foot">Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen · 3D-Landschaft maßstäblich aus den gemeldeten Tiefen, keine GPS-Distanzen · verbindlich bleibt ELWIS.</div>
    </div>`;
  h.querySelector('#pcPass')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('.pc-cr') as HTMLElement | null; if (!b) return;
    const g = b.dataset.g!; focusGroup = focusGroup === g ? null : g;
    const sel = document.getElementById('tcxSection') as HTMLSelectElement | null;
    if (sel) { const opt = [...sel.options].find(o => o.value === (focusGroup || 'auto')) || [...sel.options].find(o => o.value === 'auto'); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } }
    updateContent();
  });
  h.querySelector('#pcCopilot')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button.pc-sol') as HTMLElement | null; if (!b) return;
    const act = b.dataset.act; const s = solver();
    if (act === 'draft' && s && s.feasible) {
      try { (window as any).__wlSetDraft && (window as any).__wlSetDraft(s.safeDraftCm / 100); } catch { /* */ }
      saveIntent('reduced-draft', { toDraftCm: s.safeDraftCm });
      const stage = document.getElementById('pcStage'); if (stage) { stage.classList.add('pc-flash'); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => stage.classList.remove('pc-flash'), 1400); }
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
  set('pcHudL', `<div class="h-lab">Min-Tiefe</div><div class="h-val">${m2(minCmAll() / 100).replace(' m', '')}<span class="h-u"> m</span></div>`);
  const ws = worstSeg(); const clr = ws ? ws.cm - d.draftCm : 0;
  set('pcHudC', clr >= 0 ? `<div class="h-lab">Reserve engste Stelle</div><div class="h-val gold">${clr}<span class="h-u"> cm</span></div>` : `<div class="h-lab">Es fehlen</div><div class="h-val bad">${Math.abs(clr)}<span class="h-u"> cm</span></div>`);
  const c = counts(); const a = c.total ? Math.round(c.ok / c.total * 100) : 0, bb = c.total ? Math.round((c.ok + c.tight) / c.total * 100) : 0;
  set('pcHudR', `<div><div class="h-lab">Abschnitte</div><div class="h-val">${c.total}</div></div><div class="pc-donut" style="background:conic-gradient(#24E08B 0 ${a}%,#FFC44D ${a}% ${bb}%,#FF5C6B ${bb}% 100%)"><span style="background:radial-gradient(circle 13px at 50% 50%,rgba(5,18,31,.96) 64%,transparent 66%)">${c.bad || c.tight || '✓'}</span></div>`);
  set('pcLilly', `<span class="pcl-av">⚓</span><div class="pcl-tx"><b>Lilly meint:</b> ${lillyHtml()}</div>`);
  set('pcCopilot', copilotHtml());
  set('pcPass', passHtml());
}

function d3state(): D3State {
  const d = DATA!; const segs = d.segs;
  const maxCm = segs.length ? Math.max(...segs.map(s => s.cm)) : 300;
  const scale = Math.max(160, d.draftCm + d.reserveCm + 25, Math.round(maxCm * 1.1));
  const n = Math.max(1, segs.length);
  let samples = segs.map((s, i) => ({ x: n === 1 ? 0.5 : i / (n - 1), cm: s.cm, sec: s.sec, group: s.group }));
  if (samples.length === 1) samples = [{ ...samples[0], x: 0.1 }, { ...samples[0], x: 0.9 }];
  return { samples, draftCm: d.draftCm, reserveCm: d.reserveCm, scale };
}
function ensure3D() {
  const c = host!.querySelector('#pcCanvas') as HTMLCanvasElement | null; if (!c) return;
  if (d3) { d3.update(d3state()); return; }
  if (d3pending) return; d3pending = true;
  mountDepth3D(c, d3state()).then(ctrl => { d3pending = false; if (ctrl) { d3 = ctrl; ctrl.setReduced(reduceMotion()); ctrl.update(d3state()); } }).catch(() => { d3pending = false; });
}

export function renderProfileCockpit(data: PCData) {
  DATA = data; host = data.host; if (!host) return;
  injectCSS();
  if (!host.querySelector('.pc')) buildShell(host);
  if (focusGroup && !data.groups.some(g => g.name === focusGroup)) focusGroup = null;
  updateContent();
  ensure3D();
}
