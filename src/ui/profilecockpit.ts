/* ═══ Tiefencheck · EIN nautisches Entscheidungs-Cockpit (2.5D-Fahrrinnen-Profil) ═══
 * EIN Verdikt + interaktives 2.5D-Balken-Profil (Canvas-2D, leichte 3D-Tiefenwirkung) +
 * Routen-Copilot. Der Nutzer fährt/tippt Abschnitte selbst an (Hover/Tap → Tooltip + Detail-
 * Panel; Klick → Abschnitt als Maßstab). Einmalige sanfte Aufbau-Animation, KEIN Dauer-Film.
 * Edel/kompakt, echte ELWIS-Tiefen, keine erfundenen Routen. */

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
#tcx .pc{color:#eafaff;--gold:#E8C66B}
#tcx .pc-strip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-height:32px;background:rgba(6,20,34,.55);border:1px solid rgba(143,233,255,.14);border-radius:12px;padding:7px 12px;margin-bottom:10px;font-size:12px}
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
#tcx .pc-verdict .pcv-sub .g{color:var(--gold);font-weight:800}
#tcx .pc-verdict.ok{background:linear-gradient(180deg,rgba(36,224,139,.16),rgba(7,26,40,.42));border-color:rgba(36,224,139,.4)}
#tcx .pc-verdict.tight{background:linear-gradient(180deg,rgba(255,196,77,.16),rgba(7,26,40,.42));border-color:rgba(255,196,77,.42)}
#tcx .pc-verdict.bad{background:linear-gradient(180deg,rgba(255,75,92,.18),rgba(7,26,40,.42));border-color:rgba(255,75,92,.46)}
#tcx .pc-verdict.ok .pcv-tx{color:#9ff0d2}#tcx .pc-verdict.tight .pcv-tx{color:#ffd98a}#tcx .pc-verdict.bad .pcv-tx{color:#ffc0c4}
#tcx .pc-pcard{border-radius:18px;border:1px solid rgba(143,233,255,.16);background:linear-gradient(180deg,rgba(9,30,46,.55),rgba(6,18,30,.5));box-shadow:0 30px 64px -44px rgba(0,8,20,.9),inset 0 1px 0 rgba(255,255,255,.04);overflow:hidden}
#tcx .pc-pchead{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:11px 14px 4px;font:700 13px ${FONT};color:#bfe0ee}
#tcx .pc-pchead .pc-h-ic{color:#6fe0e6}
#tcx .pc-pchead small{color:#7fa0b4;font-weight:500;font-size:10.5px}
#tcx .pc-pchead .pc-scope{margin-left:auto;font-size:11px;color:#9fd0e0;font-weight:600;display:inline-flex;align-items:center;gap:5px}
#tcx .pc-pchead .pc-scope b{color:var(--gold)}
#tcx .pc-stage{position:relative;width:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
#tcx .pc-stage::-webkit-scrollbar{height:6px}#tcx .pc-stage::-webkit-scrollbar-thumb{background:rgba(143,233,255,.3);border-radius:3px}
#tcx .pc-canvas{display:block;height:clamp(300px,42vh,440px);touch-action:pan-x}
#tcx .pc-tip{position:absolute;z-index:6;transform:translate(-50%,-100%);background:rgba(5,18,31,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(143,233,255,.26);border-radius:11px;padding:7px 11px;font-size:11.5px;line-height:1.4;color:#eafaff;opacity:0;transition:opacity .16s;pointer-events:none;white-space:nowrap;box-shadow:0 14px 30px -16px rgba(0,8,20,.85)}
#tcx .pc-tip b{color:#fff}#tcx .pc-tip .t-vd{font-weight:800}
#tcx .pc-detail{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 15px;border-top:1px solid rgba(143,233,255,.1);background:rgba(5,16,28,.4)}
#tcx .pc-dt-nm{flex:1 1 100%;font:800 13.5px ${FONT};color:#eafaff;display:flex;align-items:center;gap:8px;letter-spacing:-.01em}
#tcx .pc-dt-nm .pc-dt-pill{font:800 10px ${FONT};letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
#tcx .pc-dt-pill.ok{color:#04212b;background:linear-gradient(180deg,#5be3a0,#24c07e)}
#tcx .pc-dt-pill.tight{color:#3a2c00;background:linear-gradient(180deg,#ffd98a,#e8b94d)}
#tcx .pc-dt-pill.bad{color:#fff;background:linear-gradient(180deg,#ff6b78,#d8323f)}
#tcx .pc-kpi{display:flex;flex-direction:column;gap:1px}
#tcx .pc-kpi .k-v{font:800 clamp(17px,2.3vw,21px) ${FONT};font-variant-numeric:tabular-nums;line-height:1.05}
#tcx .pc-kpi .k-v.gold{color:var(--gold)}#tcx .pc-kpi .k-v.bad{color:#ff8a92}
#tcx .pc-kpi .k-u{font-size:11px;font-weight:700;color:#9fc0d2}
#tcx .pc-kpi .k-l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#8fb6c8;font-weight:700}
#tcx .pc-donut{width:46px;height:46px;flex:0 0 auto;border-radius:50%;position:relative;margin-left:auto}
#tcx .pc-donut span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 13px ${FONT};color:#fff}
#tcx .pc-foot{font-size:10px;color:#7fa0b4;padding:9px 14px 12px;line-height:1.4}
@media(max-width:680px){
  #tcx .pc-canvas{height:clamp(260px,40vh,340px)}
  #tcx .pc-verdict{padding:11px 12px}#tcx .pc-strip{font-size:11px}
  #tcx .pc-detail{gap:11px}#tcx .pc-kpi .k-v{font-size:16px}
}`;

const CSS2 = `
#tcx .pc-copilot{margin-top:11px;background:linear-gradient(180deg,rgba(11,32,49,.62),rgba(7,24,38,.44));border:1px solid rgba(232,198,107,.24);border-radius:15px;padding:11px 13px}
#tcx .pc-copilot:empty{display:none}
#tcx .pc-cop-h{font:800 13px ${FONT};color:#E8C66B;margin-bottom:8px}
#tcx .pc-sol{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:12px;padding:9px 11px;margin-bottom:7px;color:#e6f2f8;font:600 12.5px ${FONT};transition:transform .25s cubic-bezier(.34,1.4,.5,1),border-color .2s}
#tcx button.pc-sol{cursor:pointer;-webkit-tap-highlight-color:transparent}
#tcx button.pc-sol:hover{transform:translateY(-1px);border-color:rgba(232,198,107,.5)}
#tcx button.pc-sol:active{transform:scale(.99)}
#tcx .pc-sol .sol-ic{font-size:17px;flex:0 0 auto}
#tcx .pc-sol .sol-tx{flex:1;line-height:1.4}#tcx .pc-sol .sol-tx b{color:#fff}
#tcx .pc-sol .sol-cta{flex:0 0 auto;font:800 12px ${FONT};color:#04212b;background:linear-gradient(180deg,#F0D27A,#D9B14D);border-radius:9px;padding:7px 12px;white-space:nowrap}
#tcx .pc-sol-map .sol-cta{color:#bfe6f5;background:rgba(143,233,255,.14)}
#tcx .pc-cop-note{font-size:10px;color:#86a8bc;margin-top:2px;line-height:1.4}
#tcx .pc-flash{animation:pcFlash 1.3s ease}@keyframes pcFlash{0%{box-shadow:0 0 0 0 rgba(232,198,107,.5)}100%{box-shadow:0 0 0 22px rgba(232,198,107,0)}}
@media(max-width:680px){#tcx .pc-copilot{padding:9px 10px}#tcx .pc-sol{padding:8px 9px;font-size:11.5px}#tcx .pc-sol .sol-cta{padding:6px 9px;font-size:11px}}`;

let host: HTMLElement | null = null, DATA: PCData | null = null, focusGroup: string | null = null;
let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;
let DPR = 1, CW = 0, CH = 0, slot = 44, padL = 40, padR = 14, padT = 30, padB = 16;
let bars: { cm: number; sec: string; group: string; gi: number }[] = [];
let groupSpan: { name: string; from: number; to: number; worst: string }[] = [];
let scaleCm = 300, hoverIdx = -1, anim = 1, animRaf = 0, ro: ResizeObserver | null = null, io: IntersectionObserver | null = null, seen = false;

function injectCSS() {
  if (!document.getElementById('pc-css')) { const s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (!document.getElementById('pc-css2')) { const s = document.createElement('style'); s.id = 'pc-css2'; s.textContent = CSS2; document.head.appendChild(s); }
}
function worstSeg(): PCSeg | null { if (!DATA || !DATA.segs.length) return null; return DATA.segs.reduce((a, b) => b.cm < a.cm ? b : a); }
function counts() { const d = DATA!; let ok = 0, tight = 0, bad = 0; for (const s of d.segs) { const c = s.cm - d.draftCm; if (c >= d.reserveCm) ok++; else if (c >= 0) tight++; else bad++; } return { ok, tight, bad, total: d.segs.length }; }
function clsOf(cm: number) { const c = cm - DATA!.draftCm; return c >= DATA!.reserveCm ? 'ok' : c >= 0 ? 'tight' : 'bad'; }

function verdict() {
  const d = DATA!, ws = worstSeg();
  if (!ws) return { cls: 'tight', ic: '❓', tx: 'Noch keine gemeldeten Tiefen', sub: 'Sobald ELWIS Werte liefert, bewerte ich die Strecke.' };
  const clr = ws.cm - d.draftCm, draftM = d.draftCm / 100;
  if (clr >= d.reserveCm) return { cls: 'ok', ic: '✅', tx: `Sicher befahrbar — <span class="g">${clr} cm</span> Reserve`, sub: `für ${m2(draftM)} Tiefgang · engste Stelle: ${E(ws.sec)}` };
  if (clr >= 0) return { cls: 'tight', ic: '⚠️', tx: `Knapp — nur <span class="g">${clr} cm</span> Reserve`, sub: `engste Stelle: ${E(ws.sec)} · empf. ${d.reserveCm} cm` };
  return { cls: 'bad', ic: '⛔', tx: `Nicht empfohlen für ${m2(draftM)}`, sub: `${E(ws.sec)}: <span class="g">${Math.abs(clr)} cm</span> zu flach` };
}
function solver() {
  const d = DATA!, ws = worstSeg(); if (!ws) return null;
  const clr = ws.cm - d.draftCm; if (clr >= d.reserveCm) return null;
  const safeDraftCm = ws.cm - d.reserveCm, reduce = Math.round(d.draftCm - safeDraftCm), feasible = safeDraftCm >= 14 && reduce > 0;
  return { ws, clr, safeDraftCm: Math.round(safeDraftCm), reduce, feasible };
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
  return `<div class="pc-cop-h">⚓ Was du tun kannst</div>${rows.join('')}<div class="pc-cop-note">Ehrlich: Fahrzeit/Schleusenzeiten einer Ausweichroute brauchen Schleusen-Fahrpläne (nicht offen verfügbar) — hier nur belegbare Lösungen + die Karte.</div>`;
}
function detailHtml(idx: number) {
  const d = DATA!; if (!bars.length) return '';
  const b = idx >= 0 && idx < bars.length ? bars[idx] : null;
  const c = counts();
  if (!b) {
    const ws = worstSeg(); const cl = ws ? clsOf(ws.cm) : 'tight';
    const pill = cl === 'ok' ? 'frei' : cl === 'tight' ? 'knapp' : 'gesperrt';
    const clr = ws ? ws.cm - d.draftCm : 0; const a = c.total ? Math.round(c.ok / c.total * 100) : 0, bb = c.total ? Math.round((c.ok + c.tight) / c.total * 100) : 0;
    return `<div class="pc-dt-nm">⚓ ${E(ws ? ws.sec : 'engste Stelle')} <span class="pc-dt-pill ${cl}">${pill}</span></div>
      <div class="pc-kpi"><span class="k-l">Fahrrinnentiefe</span><span class="k-v">${ws ? m2(ws.cm / 100).replace(' m', '') : '–'}<span class="k-u"> m</span></span></div>
      <div class="pc-kpi"><span class="k-l">bei ${m2(d.draftCm / 100)} Tiefgang</span><span class="k-v ${clr >= 0 ? 'gold' : 'bad'}">${clr >= 0 ? clr : Math.abs(clr)}<span class="k-u"> cm ${clr >= 0 ? 'Reserve' : 'zu flach'}</span></span></div>
      <div class="pc-kpi"><span class="k-l">Abschnitte</span><span class="k-v">${c.total}<span class="k-u"> · ${c.bad} ⛔</span></span></div>
      <div class="pc-donut" style="background:conic-gradient(#24E08B 0 ${a}%,#FFC44D ${a}% ${bb}%,#FF5C6B ${bb}% 100%)"><span style="background:radial-gradient(circle 14px at 50% 50%,rgba(5,18,31,.96) 64%,transparent 66%)">${c.bad || c.tight || '✓'}</span></div>`;
  }
  const cl = clsOf(b.cm); const pill = cl === 'ok' ? 'frei' : cl === 'tight' ? 'knapp' : 'gesperrt'; const clr = b.cm - d.draftCm;
  const grp = d.groups.find(g => g.name === b.group);
  return `<div class="pc-dt-nm">📍 ${E(b.sec)} <span class="pc-dt-pill ${cl}">${pill}</span></div>
    <div class="pc-kpi"><span class="k-l">Fahrrinnentiefe</span><span class="k-v">${m2(b.cm / 100).replace(' m', '')}<span class="k-u"> m</span></span></div>
    <div class="pc-kpi"><span class="k-l">bei ${m2(d.draftCm / 100)} Tiefgang</span><span class="k-v ${clr >= 0 ? 'gold' : 'bad'}">${clr >= 0 ? clr : Math.abs(clr)}<span class="k-u"> cm ${clr >= 0 ? 'Reserve' : 'zu flach'}</span></span></div>
    <div class="pc-kpi"><span class="k-l">${E(b.group)}</span><span class="k-v">${grp ? grp.count : 1}<span class="k-u"> Abschn.</span></span></div>`;
}
function lillyHtml() {
  const d = DATA!, ws = worstSeg(); if (!ws) return '';
  const clr = ws.cm - d.draftCm, draftM = m2(d.draftCm / 100); const s = solver();
  if (clr >= d.reserveCm) return `Für <b>${draftM}</b> ist die Strecke sicher — engste Stelle (${E(ws.sec)}) hält ${clr} cm Reserve.`;
  const sol = s && s.feasible ? ` Mit <b>${m2(s.safeDraftCm / 100)}</b> wäre sie befahrbar.` : ' Mit aktuellem Tiefgang nicht lösbar — Alternativroute/Pegel abwarten.';
  if (clr >= 0) return `Für <b>${draftM}</b> knapp: bei ${E(ws.sec)} nur ${clr} cm Reserve.${sol}`;
  return `Für <b>${draftM}</b> nicht empfohlen: bei ${E(ws.sec)} fehlen ${Math.abs(clr)} cm.${sol}`;
}

function buildShell(h: HTMLElement) {
  h.innerHTML = `
    <div class="pc">
      <div class="pc-strip" id="pcStrip"></div>
      <div class="pc-verdict" id="pcVerdict"></div>
      <div class="pc-pcard">
        <div class="pc-pchead"><span class="pc-h-ic">🧭</span>Fahrrinnen-Profil <small id="pcSub"></small><span class="pc-scope" id="pcScope"></span></div>
        <div class="pc-stage" id="pcStage"><canvas class="pc-canvas" id="pcCanvas"></canvas><div class="pc-tip" id="pcTip"></div></div>
        <div class="pc-detail" id="pcDetail"></div>
        <div class="pc-foot">Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen · gleich breit, keine GPS-Distanzen · Balken antippen/anfahren für Abschnitts-Details, Klick wählt die Strecke · verbindlich bleibt ELWIS.</div>
      </div>
      <div class="pc-copilot" id="pcCopilot"></div>
    </div>`;
  h.querySelector('#pcCopilot')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button.pc-sol') as HTMLElement | null; if (!b) return;
    const act = b.dataset.act; const s = solver();
    if (act === 'draft' && s && s.feasible) {
      try { (window as any).__wlSetDraft && (window as any).__wlSetDraft(s.safeDraftCm / 100); } catch { /* */ }
      saveIntent('reduced-draft', { toDraftCm: s.safeDraftCm });
      const card = h.querySelector('.pc-pcard'); if (card) { card.classList.add('pc-flash'); (card as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => card.classList.remove('pc-flash'), 1400); }
    } else if (act === 'map') { saveIntent('plan-map'); document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}
function setHtml(id: string, html: string) { const e = host!.querySelector('#' + id) as HTMLElement; if (e) e.innerHTML = html; }
function updateDetail() { setHtml('pcDetail', detailHtml(hoverIdx)); }
function updateContent() {
  if (!host || !DATA) return; const d = DATA;
  setHtml('pcStrip', stripHtml());
  const v = verdict(); const vd = host.querySelector('#pcVerdict') as HTMLElement; if (vd) { vd.className = 'pc-verdict ' + v.cls; vd.innerHTML = `<span class="pcv-ic">${v.ic}</span><div><div class="pcv-tx">${v.tx}</div><div class="pcv-sub">${v.sub}</div></div>`; }
  setHtml('pcSub', `· ${d.segs.length} gemeldete Abschnitte · ${counts().ok}/${d.segs.length} frei`);
  const scopeNm = (d.sectionKey && d.sectionKey !== 'auto') ? d.sectionKey : 'Gesamtnetz';
  setHtml('pcScope', `Strecke: <b>${E(scopeNm)}</b>`);
  setHtml('pcCopilot', copilotHtml());
  updateDetail();
}

function computeBars() {
  const d = DATA!; bars = []; groupSpan = []; let curr = ' ';
  d.segs.forEach(s => {
    const idx = bars.length; bars.push({ cm: s.cm, sec: s.sec, group: s.group, gi: 0 });
    if (s.group !== curr) { groupSpan.push({ name: s.group, from: idx, to: idx, worst: (d.groups.find(g => g.name === s.group)?.worst) || 'tight' }); curr = s.group; }
    else groupSpan[groupSpan.length - 1].to = idx;
    bars[idx].gi = groupSpan.length - 1;
  });
  const maxCm = bars.length ? Math.max(...bars.map(b => b.cm)) : 300;
  scaleCm = Math.max(160, d.draftCm + d.reserveCm + 30, Math.round(maxCm * 1.08));
}
function layout() {
  if (!cv) return; const stage = cv.parentElement as HTMLElement; const availW = stage.clientWidth || 320;
  CH = parseFloat(getComputedStyle(cv).height) || 320;
  const n = Math.max(1, bars.length); const minSlot = (window.innerWidth <= 680) ? 46 : 42;
  const fitSlot = (availW - padL - padR) / n;
  if (fitSlot >= minSlot) { slot = fitSlot; CW = availW; } else { slot = minSlot; CW = slot * n + padL + padR; }
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = CW + 'px'; cv.style.height = CH + 'px'; cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  if (cx) cx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
const barX = (i: number) => padL + i * slot + slot * 0.16;
const barWidth = () => slot * 0.68;
function niceTicks(scale: number) { const step = scale <= 200 ? 50 : scale <= 450 ? 100 : 200; const t: number[] = []; for (let v = 0; v <= scale; v += step) t.push(v); return t; }

function draw() {
  if (!cx || !cv || CW < 2) return; const ctx = cx, d = DATA!; const baseY = CH - padB, useH = CH - padT - padB;
  const yOf = (cm: number) => baseY - clamp(cm / scaleCm, 0, 1) * useH;
  ctx.clearRect(0, 0, CW, CH);
  let g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, 'rgba(11,40,59,.5)'); g.addColorStop(.55, 'rgba(8,30,48,.4)'); g.addColorStop(1, 'rgba(4,14,24,.62)'); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  ctx.font = `10px ${FONT}`; ctx.textBaseline = 'middle';
  for (const tk of niceTicks(scaleCm)) { const y = yOf(tk); ctx.strokeStyle = 'rgba(143,233,255,.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(CW - padR, y); ctx.stroke(); ctx.fillStyle = 'rgba(143,200,224,.45)'; ctx.textAlign = 'right'; ctx.fillText(m2(tk / 100).replace(' m', ''), padL - 6, y); }
  for (let i = 0; i < bars.length; i++) drawBar(i, yOf, baseY);
  drawGroups();
  drawRef(yOf(d.draftCm), 'rgba(255,255,255,.9)', `Tiefgang ${m2(d.draftCm / 100)}`, false);
  drawRef(yOf(d.draftCm + d.reserveCm), 'rgba(232,198,107,.92)', `empf. Reserve ${d.reserveCm} cm`, true);
}
function drawBar(i: number, yOf: (cm: number) => number, baseY: number) {
  const b = bars[i], ctx = cx!, d = DATA!; const bx = barX(i), bw = barWidth();
  const top = baseY - (baseY - yOf(b.cm)) * anim; const col = clearColor(b.cm, d.draftCm, d.reserveCm);
  const dx = Math.min(bw * 0.36, 11), dy = -dx * 0.55;
  const sel = !!(focusGroup && b.group === focusGroup), hov = i === hoverIdx, lift = hov ? -4 : 0;
  ctx.save(); ctx.translate(0, lift);
  ctx.fillStyle = rgb(mix(col, [0, 0, 0], 0.4), 0.92); ctx.beginPath(); ctx.moveTo(bx + bw, top); ctx.lineTo(bx + bw + dx, top + dy); ctx.lineTo(bx + bw + dx, baseY + dy); ctx.lineTo(bx + bw, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgb(mix(col, [255, 255, 255], 0.34), 0.96); ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + bw, top); ctx.lineTo(bx + bw + dx, top + dy); ctx.lineTo(bx + dx, top + dy); ctx.closePath(); ctx.fill();
  const fg = ctx.createLinearGradient(0, top, 0, baseY); fg.addColorStop(0, rgb(mix(col, [255, 255, 255], 0.16), 0.98)); fg.addColorStop(1, rgb(mix(col, [0, 0, 0], 0.22), 0.95)); ctx.fillStyle = fg; ctx.fillRect(bx, top, bw, Math.max(0, baseY - top));
  const sh = ctx.createLinearGradient(bx, 0, bx + bw * 0.5, 0); sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(bx, top, bw * 0.5, Math.max(0, baseY - top));
  if (hov || sel) { ctx.strokeStyle = hov ? 'rgba(255,255,255,.9)' : 'rgba(232,198,107,.95)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, top, bw, Math.max(0, baseY - top)); }
  ctx.restore();
}
function drawGroups() {
  const ctx = cx!; ctx.textBaseline = 'middle'; ctx.font = `700 10.5px ${FONT}`;
  for (const gs of groupSpan) {
    if (gs.from > 0) { const sx = padL + gs.from * slot; ctx.strokeStyle = 'rgba(143,233,255,.09)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, padT - 4); ctx.lineTo(sx, CH - padB); ctx.stroke(); }
    const x0 = barX(gs.from), x1 = barX(gs.to) + barWidth(), cxp = (x0 + x1) / 2, spanW = x1 - x0 + 8;
    const col = gs.worst === 'ok' ? '#24E08B' : gs.worst === 'tight' ? '#FFC44D' : '#FF5C6B';
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(clamp(cxp - 5, padL + 5, CW - 8), 12, 3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(220,238,248,.92)'; ctx.textAlign = 'center';
    let nm = gs.name; while (nm.length > 4 && ctx.measureText(nm).width > spanW - 14) nm = nm.slice(0, -2);
    if (nm !== gs.name) nm = nm.replace(/\s+\S*$/, '') + '…';
    ctx.fillText(nm, clamp(cxp + 4, padL + 20, CW - 24), 12);
  }
}
function drawRef(y: number, color: string, label: string, dashed: boolean) {
  const ctx = cx!; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; if (dashed) ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(CW - padR, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = color;
  ctx.fillText(label, padL + 5, y - 2); ctx.restore();
}
function growIn() {
  if (!cv || CW < 2) { anim = 1; return; }
  if (reduceMotion()) { anim = 1; draw(); return; }
  cancelAnimationFrame(animRaf); const t0 = performance.now();
  const step = (t: number) => { const p = clamp((t - t0) / 620, 0, 1); anim = 1 - Math.pow(1 - p, 3); draw(); if (p < 1) animRaf = requestAnimationFrame(step); else { anim = 1; draw(); } };
  animRaf = requestAnimationFrame(step);
}
function hitIdx(clientX: number) { if (!cv) return -1; const r = cv.getBoundingClientRect(); const mx = clientX - r.left; const i = Math.floor((mx - padL) / slot); return (i >= 0 && i < bars.length) ? i : -1; }
function updateTip() {
  const tip = host!.querySelector('#pcTip') as HTMLElement | null; if (!tip) return;
  if (hoverIdx < 0) { tip.style.opacity = '0'; return; }
  const b = bars[hoverIdx], d = DATA!, clr = b.cm - d.draftCm; const ic = clr >= d.reserveCm ? '✅' : clr >= 0 ? '⚠️' : '⛔';
  const col = clr >= d.reserveCm ? '#9ff0d2' : clr >= 0 ? '#ffd98a' : '#ffb3b9';
  tip.innerHTML = `<b>${E(b.sec)}</b> · ${m2(b.cm / 100)} · <span class="t-vd" style="color:${col}">${ic} ${clr >= 0 ? clr + ' cm Reserve' : Math.abs(clr) + ' cm zu flach'}</span>`;
  tip.style.left = clamp(padL + hoverIdx * slot + slot / 2, 74, CW - 74) + 'px'; tip.style.top = '8px'; tip.style.opacity = '1';
}
function onPointer(e: PointerEvent) { const idx = hitIdx(e.clientX); if (idx !== hoverIdx) { hoverIdx = idx; draw(); updateDetail(); } updateTip(); }
function onLeave() { if (hoverIdx !== -1) { hoverIdx = -1; draw(); updateDetail(); } const tip = host!.querySelector('#pcTip') as HTMLElement | null; if (tip) tip.style.opacity = '0'; }
function onClick(e: PointerEvent) {
  const idx = hitIdx(e.clientX); if (idx < 0) return; const b = bars[idx];
  focusGroup = focusGroup === b.group ? null : b.group;
  const sel = document.getElementById('tcxSection') as HTMLSelectElement | null;
  if (sel) { const opt = [...sel.options].find(o => o.value === (focusGroup || 'auto')) || [...sel.options].find(o => o.value === 'auto'); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } }
}
function ensureCanvas() {
  const c = host!.querySelector('#pcCanvas') as HTMLCanvasElement | null; const stage = host!.querySelector('#pcStage') as HTMLElement | null; if (!c || !stage) return;
  const fresh = c !== cv; cv = c; cx = c.getContext('2d');
  layout();
  if (fresh) {
    try { ro = new ResizeObserver(() => { layout(); if (!grown && CW > 40) { grown = true; growIn(); } else draw(); }); ro.observe(stage); } catch { window.addEventListener('resize', () => { layout(); draw(); }); }
    c.addEventListener('pointermove', onPointer); c.addEventListener('pointerdown', onPointer);
    c.addEventListener('pointerleave', onLeave); c.addEventListener('click', onClick as any);
  }
}
let grown = false;
export function renderProfileCockpit(data: PCData) {
  DATA = data; host = data.host; if (!host) return; injectCSS();
  if (!host.querySelector('.pc')) buildShell(host);
  if (focusGroup && !data.groups.some(g => g.name === focusGroup)) focusGroup = null;
  hoverIdx = -1; computeBars(); updateContent(); ensureCanvas();
  if (grown || reduceMotion()) { anim = 1; draw(); } else if (CW > 40) { grown = true; growIn(); } else { anim = 0; draw(); }
}
