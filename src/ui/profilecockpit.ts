/* ═══ Fahrrinnen-Profil · Route-Cockpit ═══
 * Hebt das flache Balken-Profil auf nautisches Premium-Niveau: Verdikt-Hero,
 * zusammenhängende Canvas-Tiefenlandschaft (türkis→rot interpoliert, Wasseroberfläche,
 * Tiefgang-/Reserve-Linie, Kielfreiheit, bobbing Boot, kritische Zonen + Glow),
 * Heatmap-Band, klickbare Stationsleiste, Lillys Einschätzung, ehrlicher Pegel-Ausblick.
 * EHRLICH: echte ELWIS-Tiefen, kein Fake-3D, keine erfundene Zeitreise — Ausblick nur
 * aus echtem Pegel-Trend. Performance: ein Canvas + rAF, pausiert offscreen/hidden,
 * reduced-motion = ein statischer Frame. Self-contained (eigenes <style id="pc-css">). */

export type PCSeg = { group: string; sec: string; cm: number };
export type PCGroup = { name: string; minCm: number; avgCm: number; count: number; worst: 'ok' | 'tight' | 'bad' };
export type PCData = {
  host: HTMLElement;
  segs: PCSeg[];
  groups: PCGroup[];
  draftCm: number;
  reserveCm: number;
  sectionKey: string;
  pegel?: { dir: string; delta: number; strong: boolean; station: string } | null;
};

const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const m2 = (m: number) => (m).toFixed(2).replace('.', ',') + ' m';
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c: RGB, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;

/* Farb-Stopps nach Kielfreiheit (Reserve-relativ) */
const C_DEEP: RGB = [49, 213, 231];   // türkis – sehr sicher
const C_OK: RGB = [42, 162, 214];    // blau – normal
const C_WARN: RGB = [255, 217, 138];  // gelb – kritisch
const C_HOT: RGB = [255, 138, 77];   // orange – sehr kritisch
const C_BAD: RGB = [255, 75, 92];    // rot – zu flach
function clearColor(cm: number, draftCm: number, reserveCm: number): RGB {
  const clr = cm - draftCm; const r = reserveCm > 0 ? clr / reserveCm : (clr >= 0 ? 1 : -1);
  if (r >= 1.4) return C_DEEP;
  if (r >= 1) return mix(C_OK, C_DEEP, clamp((r - 1) / 0.4, 0, 1));
  if (r >= 0.45) return mix(C_WARN, C_OK, clamp((r - 0.45) / 0.55, 0, 1));
  if (r >= 0) return mix(C_HOT, C_WARN, clamp(r / 0.45, 0, 1));
  return mix(C_HOT, C_BAD, clamp(-r / 0.6, 0, 1));
}
function clsOf(cm: number, draftCm: number, reserveCm: number): 'ok' | 'tight' | 'bad' {
  const clr = cm - draftCm; return clr >= reserveCm ? 'ok' : clr >= 0 ? 'tight' : 'bad';
}

const CSS = `
#tcx .pc{color:#eafaff}
#tcx .pc-head{font:700 13px var(--font-b,sans-serif);color:#9fd0e0;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-bottom:10px}
#tcx .pc-head small{color:#7fa0b4;font-weight:500;font-size:10.5px}
#tcx .pc-verdict{display:flex;gap:12px;align-items:center;border-radius:15px;padding:13px 15px;margin-bottom:12px;border:1px solid transparent;background:rgba(7,26,40,.5)}
#tcx .pc-verdict .pcv-ic{font-size:26px;line-height:1;flex:0 0 auto}
#tcx .pc-verdict .pcv-tx{font:800 clamp(15px,2.2vw,19px) var(--font-b,sans-serif);letter-spacing:-.01em;line-height:1.18}
#tcx .pc-verdict .pcv-sub{font-size:12px;color:#cfe2ee;margin-top:3px;font-weight:600}
#tcx .pc-verdict.ok{background:linear-gradient(180deg,rgba(36,224,139,.16),rgba(7,26,40,.4));border-color:rgba(36,224,139,.4)}
#tcx .pc-verdict.tight{background:linear-gradient(180deg,rgba(255,196,77,.16),rgba(7,26,40,.4));border-color:rgba(255,196,77,.42)}
#tcx .pc-verdict.bad{background:linear-gradient(180deg,rgba(255,75,92,.18),rgba(7,26,40,.4));border-color:rgba(255,75,92,.46)}
#tcx .pc-verdict.ok .pcv-tx{color:#9ff0d2}#tcx .pc-verdict.tight .pcv-tx{color:#ffd98a}#tcx .pc-verdict.bad .pcv-tx{color:#ffc0c4}
#tcx .pc-stage{position:relative;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(143,233,255,.16);box-shadow:0 30px 64px -42px rgba(0,8,20,.9),inset 0 1px 0 rgba(255,255,255,.05)}
#tcx .pc-canvas{display:block;width:100%;height:clamp(190px,30vh,300px)}
#tcx .pc-tip{position:absolute;left:10px;top:10px;max-width:78%;background:rgba(5,18,31,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(143,233,255,.22);border-radius:11px;padding:8px 11px;font-size:12px;line-height:1.45;color:#eafaff;box-shadow:0 12px 28px -16px rgba(0,8,20,.8);transition:opacity .2s;pointer-events:none}
#tcx .pc-tip b{color:#fff}
#tcx .pc-heat{display:flex;gap:2px;margin-top:9px;height:9px;border-radius:6px;overflow:hidden}
#tcx .pc-heat i{flex:1 1 auto;min-width:2px}
#tcx .pc-heat-lab{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:.05em;color:#7fa0b4;margin-top:4px}
#tcx .pc-stations{display:flex;gap:8px;margin-top:12px;overflow-x:auto;scrollbar-width:thin;padding-bottom:3px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
#tcx .pc-stations::-webkit-scrollbar{height:5px}#tcx .pc-stations::-webkit-scrollbar-thumb{background:rgba(143,233,255,.3);border-radius:3px}
#tcx .pc-st{flex:0 0 auto;scroll-snap-align:start;min-width:128px;text-align:left;background:rgba(7,26,40,.55);border:1px solid rgba(143,233,255,.16);border-radius:13px;padding:9px 11px;cursor:pointer;transition:transform .18s,border-color .2s,box-shadow .2s}
#tcx .pc-st:hover{transform:translateY(-1px);border-color:rgba(49,213,231,.45)}
#tcx .pc-st.sel{border-color:#31D5E7;box-shadow:0 0 16px -5px rgba(49,213,231,.6)}
#tcx .pc-st-top{display:flex;align-items:center;gap:6px;margin-bottom:4px}
#tcx .pc-st-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 7px currentColor}
#tcx .pc-st-nm{font:700 12px var(--font-b,sans-serif);color:#eafaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tcx .pc-st-meta{font-size:11px;color:#9fc0d2;font-variant-numeric:tabular-nums}
#tcx .pc-st-meta b{color:#fff}
#tcx .pc-st-warn{color:#ffd98a}
#tcx .pc-lilly{display:flex;gap:10px;align-items:flex-start;margin-top:13px;background:linear-gradient(180deg,rgba(9,30,46,.6),rgba(7,26,40,.42));border:1px solid rgba(143,233,255,.16);border-radius:14px;padding:12px 14px}
#tcx .pc-lilly .pcl-av{font-size:20px;flex:0 0 auto;margin-top:-1px}
#tcx .pc-lilly .pcl-tx{font-size:13px;line-height:1.5;color:#dcecf3}
#tcx .pc-lilly .pcl-tx b{color:#fff}
#tcx .pc-outlook{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
#tcx .pc-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#bcd8e6;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:999px;padding:5px 11px}
#tcx .pc-chip.up{color:#9ff0d2;border-color:rgba(36,224,139,.3)}#tcx .pc-chip.down{color:#ffd0c4;border-color:rgba(255,138,77,.35)}
#tcx .pc-foot{font-size:10.5px;color:#7fa0b4;margin-top:11px;line-height:1.45}
@media(max-width:680px){
  #tcx .pc-canvas{height:clamp(210px,40vh,320px)}
  #tcx .pc-st{min-width:142px;padding:11px 12px}
  #tcx .pc-verdict{padding:12px 13px}
  #tcx .pc-tip{font-size:11.5px;max-width:84%}
}`;

let host: HTMLElement | null = null;
let DATA: PCData | null = null;
let focusGroup: string | null = null;
let focusIdx = -1;            // hovered/selected segment index (canvas)
let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;
let W = 0, H = 0, DPR = 1, raf = 0, running = false, io: IntersectionObserver | null = null, onScreen = false;

function injectCSS() { if (!document.getElementById('pc-css')) { const s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); } }
function worstSeg(): PCSeg | null { if (!DATA || !DATA.segs.length) return null; return DATA.segs.reduce((a, b) => b.cm < a.cm ? b : a); }

function verdict() {
  const d = DATA!; const ws = worstSeg();
  if (!ws) return { cls: 'tight', ic: '❓', tx: 'Noch keine gemeldeten Tiefen', sub: 'Sobald ELWIS Werte liefert, bewerte ich die Route.' };
  const clr = ws.cm - d.draftCm, draftM = d.draftCm / 100;
  if (clr >= d.reserveCm) return { cls: 'ok', ic: '✅', tx: `Route mit ${clr} cm Reserve befahrbar`, sub: `für ${m2(draftM)} Tiefgang · engste Stelle: ${ws.sec}` };
  if (clr >= 0) return { cls: 'tight', ic: '⚠️', tx: `Knapp — engste Stelle nur ${clr} cm Reserve`, sub: `${ws.sec} · empf. ${d.reserveCm} cm · langsam & mittig fahren` };
  return { cls: 'bad', ic: '⛔', tx: `Nicht empfohlen für ${m2(draftM)} Tiefgang`, sub: `${ws.sec}: ${Math.abs(clr)} cm zu flach · Tiefgang reduzieren oder Alternativroute` };
}

function stationsHtml() {
  const d = DATA!;
  return d.groups.map(g => {
    const col = g.worst === 'ok' ? '#24E08B' : g.worst === 'tight' ? '#FFC44D' : '#FF7a85';
    const probs = d.segs.filter(s => s.group === g.name && (s.cm - d.draftCm) < d.reserveCm).length;
    return `<button class="pc-st${focusGroup === g.name ? ' sel' : ''}" type="button" data-g="${E(g.name)}"><div class="pc-st-top"><span class="pc-st-dot" style="color:${col}"></span><span class="pc-st-nm">${E(g.name)}</span></div><div class="pc-st-meta">min <b>${m2(g.minCm / 100)}</b> · Ø ${m2(g.avgCm / 100)}</div><div class="pc-st-meta">${g.count} Abschnitte${probs ? ` · <span class="pc-st-warn">${probs} kritisch</span>` : ''}</div></button>`;
  }).join('');
}

function heatHtml() { const d = DATA!; return d.segs.map(s => `<i style="background:${rgb(clearColor(s.cm, d.draftCm, d.reserveCm))}"></i>`).join(''); }

function lillyHtml() {
  const d = DATA!; const ws = worstSeg(); if (!ws) return 'Sobald Tiefen gemeldet sind, ordne ich deine Route ein.';
  const clr = ws.cm - d.draftCm, draftM = m2(d.draftCm / 100);
  if (clr >= d.reserveCm) return `Für <b>${draftM}</b> Tiefgang ist die Strecke <b>sicher befahrbar</b> — auch die engste Stelle (<b>${E(ws.sec)}</b>) hält ${clr} cm Reserve. Trotzdem Pegel &amp; ELWIS vor Abfahrt prüfen.`;
  if (clr >= 0) return `Für <b>${draftM}</b> Tiefgang ist die Strecke <b>kritisch</b>. Besonders bei <b>${E(ws.sec)}</b> bleibt nur ${clr} cm Reserve (empfohlen ${d.reserveCm} cm). Mit etwas weniger Tiefgang oder langsamer, mittiger Fahrt ist die Passage machbar.`;
  return `Für <b>${draftM}</b> Tiefgang ist die Strecke <b>aktuell nicht empfohlen</b>: bei <b>${E(ws.sec)}</b> fehlen ${Math.abs(clr)} cm. Mit reduziertem Tiefgang oder einer alternativen Route besteht eine sichere Passage.`;
}

function outlookHtml() {
  const p = DATA && DATA.pegel; if (!p) return '';
  const dir = String(p.dir || ''); let cls = '', txt = '';
  if (/fall|sink|fäll|down|neg/i.test(dir)) { cls = 'down'; txt = `Pegel ${E(p.station)} fällt → Reserve wird tendenziell knapper.`; }
  else if (/steig|rise|up|pos/i.test(dir)) { cls = 'up'; txt = `Pegel ${E(p.station)} steigt → Reserve tendenziell besser.`; }
  else { txt = `Pegel ${E(p.station)} stabil → Reserve voraussichtlich unverändert.`; }
  return `<span class="pc-chip ${cls}">📈 Tendenz: ${txt}</span><span class="pc-chip">🔄 Ausblick aus echtem Pegel-Trend — keine Wettervorhersage.</span>`;
}

function buildShell(h: HTMLElement) {
  h.innerHTML = `
    <div class="pc">
      <div class="pc-head">🧭 Fahrrinnen-Profil <small class="pc-scope"></small></div>
      <div class="pc-verdict" id="pcVerdict"></div>
      <div class="pc-stage"><canvas class="pc-canvas" id="pcCanvas"></canvas><div class="pc-tip" id="pcTip" style="opacity:0"></div></div>
      <div class="pc-heat" id="pcHeat"></div>
      <div class="pc-heat-lab"><span>Start</span><span>kritische Zonen rot · sicher türkis</span><span>Ziel</span></div>
      <div class="pc-stations" id="pcStations"></div>
      <div class="pc-lilly"><span class="pcl-av">⚓</span><div class="pcl-tx"><b>Lillys Einschätzung:</b> <span id="pcLilly"></span></div></div>
      <div class="pc-outlook" id="pcOutlook"></div>
      <div class="pc-foot">Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen · gleich breit dargestellt, keine GPS-Distanzen · verbindlich bleibt ELWIS.</div>
    </div>`;
  h.querySelector('#pcStations')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('.pc-st') as HTMLElement | null; if (!b) return;
    const g = b.dataset.g!;
    focusGroup = focusGroup === g ? null : g;
    // bestehende ELWIS-Abschnittswahl ansteuern, falls vorhanden (wiederverwenden statt koppeln)
    const sel = document.getElementById('tcxSection') as HTMLSelectElement | null;
    if (sel) { const opt = [...sel.options].find(o => o.value === (focusGroup || 'auto')) || [...sel.options].find(o => o.value === 'auto'); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } }
    updateContent();
  });
}

function updateContent() {
  if (!host || !DATA) return;
  const v = verdict();
  const vd = host.querySelector('#pcVerdict') as HTMLElement; if (vd) { vd.className = 'pc-verdict ' + v.cls; vd.innerHTML = `<span class="pcv-ic">${v.ic}</span><div><div class="pcv-tx">${v.tx}</div><div class="pcv-sub">${E(v.sub)}</div></div>`; }
  const sc = host.querySelector('.pc-scope') as HTMLElement; if (sc) sc.textContent = `· ${DATA.segs.length} gemeldete Abschnitte`;
  const ht = host.querySelector('#pcHeat') as HTMLElement; if (ht) ht.innerHTML = heatHtml();
  const stn = host.querySelector('#pcStations') as HTMLElement; if (stn) stn.innerHTML = stationsHtml();
  const ll = host.querySelector('#pcLilly') as HTMLElement; if (ll) ll.innerHTML = lillyHtml();
  const ol = host.querySelector('#pcOutlook') as HTMLElement; if (ol) ol.innerHTML = outlookHtml();
}

let scale = 300;
let samples: { x: number; cm: number; sec: string; group: string }[] = [];
let boatX = 0.04, hoverX = -1, tSec = 0, lastTs = 0;

function computeFloor() {
  if (!DATA) return;
  const segs = DATA.segs;
  const maxCm = segs.length ? Math.max(...segs.map(s => s.cm)) : 300;
  scale = Math.max(180, DATA.draftCm + DATA.reserveCm + 25, Math.round(maxCm * 1.12));
  const n = Math.max(1, segs.length);
  samples = segs.map((s, i) => ({ x: n === 1 ? 0.5 : i / (n - 1), cm: s.cm, sec: s.sec, group: s.group }));
  if (samples.length === 1) samples = [{ ...samples[0], x: 0.12 }, { ...samples[0], x: 0.88 }];
}
function floorAt(x: number) {
  if (!samples.length) return { cm: scale * 0.5, sec: '', group: '' };
  if (x <= samples[0].x) return samples[0];
  if (x >= samples[samples.length - 1].x) return samples[samples.length - 1];
  for (let i = 1; i < samples.length; i++) { if (x <= samples[i].x) { const a = samples[i - 1], b = samples[i]; const t = (x - a.x) / (b.x - a.x || 1); return { cm: lerp(a.cm, b.cm, t), sec: t < 0.5 ? a.sec : b.sec, group: t < 0.5 ? a.group : b.group }; } }
  return samples[samples.length - 1];
}

function ensureCanvas() {
  const c = host!.querySelector('#pcCanvas') as HTMLCanvasElement | null; if (!c) return;
  if (cv === c && cx) { resize(); return; }
  cv = c; cx = c.getContext('2d'); DPR = Math.min(window.devicePixelRatio || 1, 2);
  resize();
  try { new ResizeObserver(() => { resize(); if (reduceMotion()) draw(0); }).observe(c); } catch { addEventListener('resize', resize); }
  const stage = c.parentElement!;
  try { io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }, { rootMargin: '120px' }); io.observe(stage); } catch { onScreen = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  const pos = (ev: PointerEvent) => { const r = c.getBoundingClientRect(); hoverX = clamp((ev.clientX - r.left) / r.width, 0, 1); const tip = host!.querySelector('#pcTip') as HTMLElement; const f = floorAt(hoverX); if (tip && DATA) { const clr = Math.round(f.cm - DATA.draftCm); const cls = clr >= DATA.reserveCm ? '✅' : clr >= 0 ? '⚠️' : '⛔'; tip.innerHTML = `<b>${E(f.sec || f.group)}</b><br>Fahrrinnentiefe ${m2(f.cm / 100)} · ${cls} ${clr >= 0 ? clr + ' cm Reserve' : Math.abs(clr) + ' cm zu flach'}`; tip.style.opacity = '1'; } if (reduceMotion()) draw(0); };
  c.addEventListener('pointermove', pos); c.addEventListener('pointerdown', pos);
  c.addEventListener('pointerleave', () => { hoverX = -1; const tip = host!.querySelector('#pcTip') as HTMLElement; if (tip) tip.style.opacity = '0'; if (reduceMotion()) draw(0); });
}
function resize() { if (!cv) return; const w = cv.clientWidth || 320, h = cv.clientHeight || 220; W = Math.round(w * DPR); H = Math.round(h * DPR); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; }
function sync() { const want = onScreen && !document.hidden && !reduceMotion(); if (want && !running) { running = true; lastTs = 0; raf = requestAnimationFrame(loop); } else if (!want && running) { running = false; cancelAnimationFrame(raf); if (onScreen && reduceMotion()) draw(0); } }
function loop(ts: number) { if (!running) return; if (lastTs) tSec += Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts; draw(tSec); raf = requestAnimationFrame(loop); }

function yOf(cm: number) { const surf = H * 0.17, pad = H * 0.12; return surf + clamp(cm / scale, 0, 1) * (H - surf - pad); }

function draw(t: number) {
  if (!cx || !DATA || !W) return; const ctx = cx; const d = DATA; const surfY = H * 0.17;
  ctx.clearRect(0, 0, W, H);
  // Luft/Horizont
  let g = ctx.createLinearGradient(0, 0, 0, surfY); g.addColorStop(0, 'rgba(10,28,44,.9)'); g.addColorStop(1, 'rgba(12,40,60,.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, surfY);
  // Wasserkörper
  g = ctx.createLinearGradient(0, surfY, 0, H); g.addColorStop(0, 'rgba(49,213,231,.12)'); g.addColorStop(.45, 'rgba(14,78,112,.55)'); g.addColorStop(1, 'rgba(3,16,28,.92)'); ctx.fillStyle = g; ctx.fillRect(0, surfY, W, H - surfY);
  // Caustics (subtil)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const yy = surfY + (k + 1) * H * 0.07; ctx.strokeStyle = `rgba(120,225,245,${0.05 - k * 0.012})`; ctx.lineWidth = DPR * (3 - k); ctx.beginPath(); for (let x = 0; x <= W; x += 8 * DPR) { const y = yy + Math.sin(x * 0.012 + t * (0.8 + k * 0.3) + k) * 5 * DPR; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
  // Floor-Pfad
  const fy = (x: number) => yOf(floorAt(x).cm); const N = 64;
  const pathX: number[] = [], pathY: number[] = []; for (let i = 0; i <= N; i++) { const x = i / N; pathX.push(x * W); pathY.push(fy(x)); }
  // Bett (unter dem Floor)
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(pathX[0], pathY[0]); for (let i = 1; i <= N; i++) ctx.lineTo(pathX[i], pathY[i]); ctx.lineTo(W, H); ctx.closePath();
  g = ctx.createLinearGradient(0, surfY, 0, H); g.addColorStop(0, 'rgba(26,38,50,.7)'); g.addColorStop(1, 'rgba(8,14,22,.98)'); ctx.fillStyle = g; ctx.fill();
  // Reserve-Linie + Tiefgang-Linie
  const reserveY = yOf(d.draftCm + d.reserveCm), draftY = yOf(d.draftCm);
  ctx.setLineDash([6 * DPR, 5 * DPR]); ctx.lineWidth = DPR * 1.4;
  ctx.strokeStyle = 'rgba(217,177,77,.75)'; ctx.beginPath(); ctx.moveTo(0, reserveY); ctx.lineTo(W, reserveY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(0, draftY); ctx.lineTo(W, draftY); ctx.stroke(); ctx.setLineDash([]);
  // Gefahren-Wedge wo Floor über Reserve liegt
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) { const x0 = i / N, c0 = floorAt(x0).cm; const clr = c0 - d.draftCm; if (clr < d.reserveCm) { const col = clearColor(c0, d.draftCm, d.reserveCm); ctx.fillStyle = rgb(col, clr < 0 ? 0.34 : 0.18); ctx.fillRect(pathX[i], Math.min(pathY[i], reserveY) - 1, (W / N) + 1, Math.abs(pathY[i] - reserveY) + 2); } }
  ctx.restore();
  // Floor-Kante segmentweise eingefärbt + Glow
  ctx.lineWidth = DPR * 3; ctx.lineJoin = 'round'; ctx.shadowBlur = DPR * 8;
  for (let i = 0; i < N; i++) { const cm = floorAt(i / N).cm; const col = clearColor(cm, d.draftCm, d.reserveCm); ctx.strokeStyle = rgb(col, .95); ctx.shadowColor = rgb(col, .6); ctx.beginPath(); ctx.moveTo(pathX[i], pathY[i]); ctx.lineTo(pathX[i + 1], pathY[i + 1]); ctx.stroke(); }
  ctx.shadowBlur = 0;
  // Kritische Zonen – pulsierender Glow
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  for (const s of samples) { if (s.cm - d.draftCm < 0) { const x = s.x * W, y = yOf(s.cm); const rad = ctx.createRadialGradient(x, y, 0, x, y, 34 * DPR); rad.addColorStop(0, `rgba(255,75,92,${0.28 + 0.22 * pulse})`); rad.addColorStop(1, 'rgba(255,75,92,0)'); ctx.fillStyle = rad; ctx.beginPath(); ctx.arc(x, y, 34 * DPR, 0, 7); ctx.fill(); } }
  // Wasseroberfläche
  ctx.strokeStyle = 'rgba(150,235,250,.7)'; ctx.lineWidth = DPR * 1.6; ctx.beginPath(); for (let x = 0; x <= W; x += 6 * DPR) { const y = surfY + Math.sin(x * 0.02 + t * 1.3) * 2.5 * DPR; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  // Labels
  ctx.font = `${11 * DPR}px -apple-system,Segoe UI,Roboto,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(`Tiefgang ${m2(d.draftCm / 100)}`, 8 * DPR, draftY - 5 * DPR);
  ctx.fillStyle = 'rgba(217,177,77,.92)'; ctx.fillText(`empf. Reserve ${d.reserveCm} cm`, 8 * DPR, reserveY + 13 * DPR);
  // Boot fährt entlang (oder parkt bei Hover)
  const traverse = 16; boatX = hoverX >= 0 ? hoverX : (tSec / traverse) % 1; const bx = boatX * W;
  const bob = Math.sin(t * 1.8) * 3 * DPR; const bsurf = surfY + bob; const f = floorAt(hoverX >= 0 ? hoverX : boatX); const keelY = draftY + bob;
  // Kielfreiheit-Linie
  const clrCm = Math.round(f.cm - d.draftCm); const kc: RGB = clrCm >= d.reserveCm ? [36, 224, 139] : clrCm >= 0 ? [255, 196, 77] : [255, 75, 92];
  ctx.strokeStyle = rgb(kc, .9); ctx.lineWidth = DPR * 2.4; ctx.beginPath(); ctx.moveTo(bx, keelY); ctx.lineTo(bx, yOf(f.cm)); ctx.stroke();
  ctx.fillStyle = rgb(kc, 1); ctx.font = `700 ${10.5 * DPR}px -apple-system,Segoe UI,Roboto,sans-serif`; ctx.textAlign = 'center'; ctx.fillText(clrCm >= 0 ? `${clrCm} cm` : `${Math.abs(clrCm)} cm zu flach`, bx, (keelY + yOf(f.cm)) / 2 + 3 * DPR); ctx.textAlign = 'left';
  // Boot-Rumpf
  const bw = 26 * DPR; ctx.fillStyle = '#eef6fb'; ctx.strokeStyle = 'rgba(10,30,46,.5)'; ctx.beginPath(); ctx.moveTo(bx - bw / 2, bsurf - 7 * DPR); ctx.lineTo(bx + bw / 2, bsurf - 7 * DPR); ctx.lineTo(bx + bw / 2 - 5 * DPR, bsurf + 3 * DPR); ctx.lineTo(bx - bw / 2 + 5 * DPR, bsurf + 3 * DPR); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2f6f86'; ctx.fillRect(bx - 6 * DPR, bsurf - 13 * DPR, 12 * DPR, 6 * DPR);
  // Hover-Crosshair
  if (hoverX >= 0) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = DPR; ctx.setLineDash([3 * DPR, 3 * DPR]); ctx.beginPath(); ctx.moveTo(bx, surfY); ctx.lineTo(bx, H); ctx.stroke(); ctx.setLineDash([]); }
}

export function renderProfileCockpit(data: PCData) {
  DATA = data; host = data.host; if (!host) return;
  injectCSS();
  if (!host.querySelector('.pc')) buildShell(host);
  if (focusGroup && !data.groups.some(g => g.name === focusGroup)) focusGroup = null;
  updateContent();
  computeFloor();
  ensureCanvas();
  if (reduceMotion()) draw(0); else sync();
}
