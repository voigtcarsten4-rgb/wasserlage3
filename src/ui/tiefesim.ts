/* ═══ Tiefencheck-Simulator · interaktiver Marine-Mini-Simulator ═══
 * Canvas-Querschnitt (Wasser/Caustics/Grund/Boot/Kielfreiheit-Glow) + maritimer Dreh-Regler
 * + HUD + Verdikt-Badge. Werte LIVE aus ELWIS-Fahrrinnentiefe. Verbindlich bleibt ELWIS.
 * Self-contained: eigenes <style>, eigene Helfer, rAF pausiert offscreen/hidden. */

interface FTItem { revier?:string; group?:string; abk?:string; section?:string; kind?:string; value?:string; cm?:number|null; status?:string }
interface FTDoc { updated_de?:string; stand?:string; items?:FTItem[] }

const E = (s:any)=>{ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; };
const reduceMotion = ()=> window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { navy:'#07263B', deepw:'#0C496A', turq:'#31D5E7', emer:'#24E08B', amber:'#FFC44D', warn:'#FF914D', dang:'#FF4B5C', sand:'#B69468', gold:'#D9B14D' };
function hex(h:string,a:number){ const n=parseInt(h.slice(1),16); return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
const m2 = (m:number)=> m.toFixed(2).replace('.',',')+' m';

interface Boat { id:string; ic:string; n:string; draft:number; reserve:number; w:number }
const BOATS: Boat[] = [
  { id:'kajak', ic:'🛶', n:'Kajak/SUP', draft:0.18, reserve:10, w:122 },
  { id:'sport', ic:'🚤', n:'Sportboot', draft:0.55, reserve:20, w:124 },
  { id:'angel', ic:'🎣', n:'Angelboot', draft:0.45, reserve:20, w:118 },
  { id:'haus',  ic:'🛖', n:'Hausboot',  draft:0.90, reserve:30, w:172 },
  { id:'motor', ic:'🛥️', n:'Motoryacht',draft:1.00, reserve:30, w:140 },
  { id:'segel', ic:'⛵', n:'Segelyacht', draft:1.80, reserve:40, w:128 },
  { id:'yacht', ic:'🛳️', n:'Groß-Yacht', draft:2.10, reserve:50, w:166 },
];
const RES: Record<string,{f:number;lab:string}> = { kons:{f:1.5,lab:'konservativ'}, norm:{f:1.0,lab:'normal'}, sport:{f:0.65,lab:'sportlich'} };
const PROF: Record<string,{lab:string;cons:boolean}> = { none:{lab:'Standard',cons:false}, fam:{lab:'👨‍👩‍👧 Familie',cons:true}, anf:{lab:'🔰 Anfänger',cons:true}, charter:{lab:'🚤 Charter',cons:true} };

/* ── Modul-State ── */
let typeIdx = 4;                 // Motoryacht
let draft = 1.0, draftT = 1.0;   // ist / ziel
let reserveMode = 'norm', profile = 'none';
let MAXD = 3.0;
let ft: FTDoc | null = null;
let bedDepth = 1.29;             // gewählte Fahrrinnentiefe (Median oder Abschnitt)
let bedLabel = 'typ. Fahrrinnentiefe (Median)';
let groups: Record<string, FTItem[]> = {};
let sectionKey = 'auto';
let running = false, rafId = 0, t = 0;
let cv:HTMLCanvasElement, ctx:CanvasRenderingContext2D, W=0, H=0, DPR=1;
const bubbles:{x:number;y:number;s:number;sp:number}[] = [];

const CSS = `
#tcx{--g:rgba(255,255,255,.08);color:#eafaff;font-family:var(--font-b,-apple-system,Segoe UI,Roboto,sans-serif)}
#tcx .tcx-head{text-align:center;max-width:760px;margin:0 auto 4px}
#tcx .tcx-head h2{font-size:clamp(21px,3.4vw,32px);font-weight:800;letter-spacing:-.025em;line-height:1.08;margin:0;
  background:linear-gradient(180deg,#f3fbff,#9fd6e6);-webkit-background-clip:text;background-clip:text;color:transparent}
#tcx .tcx-head .tcx-badge{-webkit-text-fill-color:initial;font-size:11px;font-weight:700;color:#9ff0d2;background:rgba(46,196,182,.16);
  border:1px solid rgba(46,196,182,.4);border-radius:999px;padding:3px 10px;vertical-align:middle;margin-left:8px;white-space:nowrap}
#tcx .tcx-head p{font-size:clamp(12.5px,1.7vw,15px);color:#b6d2e0;margin:7px auto 0;max-width:600px;line-height:1.5}
#tcx .tcx-types{display:flex;gap:8px;justify-content:flex-start;margin:15px auto 11px;max-width:880px;
  overflow-x:auto;scrollbar-width:none;padding:2px 2px 4px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
#tcx .tcx-types::-webkit-scrollbar{display:none}
@media(min-width:760px){#tcx .tcx-types{flex-wrap:wrap;justify-content:center;overflow:visible}}
#tcx .tc-type{flex:0 0 auto;scroll-snap-align:center;display:flex;align-items:center;gap:6px;background:var(--g);
  border:1px solid rgba(143,233,255,.2);color:#cfeefb;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;
  cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:transform .25s cubic-bezier(.34,1.3,.5,1),border-color .25s,box-shadow .25s,background .25s;white-space:nowrap}
#tcx .tc-type:hover{border-color:rgba(49,213,231,.5);transform:translateY(-1px)}
#tcx .tc-type.on{background:linear-gradient(180deg,rgba(49,213,231,.28),rgba(12,73,106,.42));border-color:var(--turq);color:#fff;box-shadow:0 0 18px -4px rgba(49,213,231,.6)}
#tcx .tc-type .ic{font-size:16px}
#tcx .stage{position:relative;width:100%;max-width:1180px;margin:0 auto;border-radius:22px;overflow:hidden;
  box-shadow:0 38px 80px -36px rgba(0,8,20,.85),inset 0 1px 0 rgba(255,255,255,.06),inset 0 0 0 1px rgba(217,177,77,.16);
  border:1px solid rgba(143,233,255,.14)}
#tcx canvas{display:block;width:100%;height:clamp(380px,54vh,560px)}
#tcx .vig{position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(125% 96% at 50% 40%,transparent 55%,rgba(2,10,18,.55) 100%)}
#tcx .hud{position:absolute;z-index:4;background:rgba(7,26,40,.4);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);
  border:1px solid rgba(143,233,255,.18);border-radius:15px;padding:9px 14px;box-shadow:0 14px 32px -18px rgba(0,8,20,.7),inset 0 1px 0 rgba(217,177,77,.14)}
#tcx .hud .lab{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8fb6c8}
#tcx .hud .val{font-size:clamp(18px,2.4vw,24px);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.05;margin-top:2px}
#tcx .hud .u{font-size:12px;font-weight:600;color:#a9c6d6}
#tcx .hud-left{left:16px;top:50%;transform:translateY(-72%)}
#tcx .hud-right{right:16px;top:50%;transform:translateY(-72%);text-align:right}
#tcx .hud-status{left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;padding:8px 15px;border-radius:999px}
#tcx .hud-status .dot{width:10px;height:10px;border-radius:50%;box-shadow:0 0 10px currentColor}
#tcx .hud-status .st{font-weight:800;font-size:13.5px}
#tcx .verdict{position:absolute;left:50%;bottom:122px;transform:translateX(-50%);z-index:5;text-align:center;pointer-events:none;width:88%}
#tcx .verdict .big{font-size:clamp(18px,2.7vw,27px);font-weight:800;letter-spacing:-.02em;text-shadow:0 2px 16px rgba(0,10,20,.75)}
#tcx .verdict .sub{font-size:12px;color:#dcecf3;margin-top:3px;font-weight:600;text-shadow:0 1px 8px rgba(0,10,20,.8)}
#tcx .dialwrap{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:4px;touch-action:none}
#tcx .dial{position:relative;width:104px;height:104px;cursor:grab;user-select:none;outline:none}
#tcx .dial:focus-visible{filter:drop-shadow(0 0 6px rgba(49,213,231,.8))}
#tcx .dial:active{cursor:grabbing}
#tcx .dial svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#tcx .dial .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
#tcx .dial .dv{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#f3fbff,#7fd0dd);-webkit-background-clip:text;background-clip:text;color:transparent}
#tcx .dial .dl{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#8fb6c8;margin-top:1px}
#tcx .dialwrap .hint{font-size:10px;color:#7fa0b4}
#tcx .tcx-src{position:absolute;left:14px;bottom:12px;z-index:4;font-size:10.5px;color:#86a8bc;background:rgba(4,18,31,.5);border-radius:8px;padding:3px 9px;backdrop-filter:blur(6px);max-width:60%}
#tcx .tcx-ctrl{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;margin:14px auto 0;max-width:920px}
#tcx .seg{display:inline-flex;background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);border-radius:12px;padding:3px;gap:2px}
#tcx .seg button{border:none;background:transparent;color:#bcd8e6;font:600 12.5px var(--font-b,sans-serif);padding:6px 11px;border-radius:9px;cursor:pointer;transition:background .2s,color .2s;white-space:nowrap}
#tcx .seg button.on{background:linear-gradient(180deg,rgba(217,177,77,.32),rgba(217,177,77,.14));color:#fff;box-shadow:inset 0 0 0 1px rgba(217,177,77,.4)}
#tcx .seg-lab{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#7fa0b4;align-self:center;margin-right:2px}
#tcx select.tcx-sec{background:rgba(7,26,40,.5);border:1px solid rgba(143,233,255,.16);color:#dcecf3;border-radius:11px;padding:8px 12px;font:600 12.5px var(--font-b,sans-serif);cursor:pointer}
#tcx .tcx-detail{max-width:1180px;margin:16px auto 0;background:rgba(7,26,40,.42);border:1px solid rgba(143,233,255,.14);border-radius:16px;overflow:hidden}
#tcx .tcx-detail>summary{cursor:pointer;list-style:none;padding:13px 18px;font:700 14px var(--font-b,sans-serif);color:#dcecf3;display:flex;align-items:center;gap:8px}
#tcx .tcx-detail>summary::-webkit-details-marker{display:none}
#tcx .tcx-detail>summary .chev{margin-left:auto;transition:transform .3s;color:#6fe0e6}
#tcx .tcx-detail[open]>summary .chev{transform:rotate(180deg)}
#tcx .tcx-detail .bars{padding:4px 16px 16px}
#tcx .ft-group{margin-top:12px}
#tcx .ft-gh{font:700 12.5px var(--font-b,sans-serif);color:#9fd0e0;margin-bottom:6px}
#tcx .ft-gh small{color:#7fa0b4;font-weight:500}
#tcx .ft-row{display:grid;grid-template-columns:1fr 2.1fr auto auto;gap:9px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(143,233,255,.06)}
#tcx .ft-meta b{font-size:12.5px;color:#eafaff;display:block}
#tcx .ft-meta small{font-size:10.5px;color:#86a8bc}
#tcx .ft-bar{position:relative;height:13px;background:rgba(255,255,255,.07);border-radius:7px;overflow:hidden}
#tcx .ft-fill{position:absolute;left:0;top:0;bottom:0;border-radius:7px}
#tcx .ft-fill.ok{background:linear-gradient(90deg,#1f9e6e,#24E08B)}
#tcx .ft-fill.warn{background:linear-gradient(90deg,#caa033,#FFC44D)}
#tcx .ft-fill.bad{background:linear-gradient(90deg,#c0392f,#FF4B5C)}
#tcx .ft-draft{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;box-shadow:0 0 5px rgba(255,255,255,.9)}
#tcx .ft-val{font:700 12.5px var(--font-b,sans-serif);font-variant-numeric:tabular-nums;color:#dcecf3;min-width:52px;text-align:right}
#tcx .ft-na{color:#7fa0b4;font-weight:500}
#tcx .ft-vd{font-size:14px}
#tcx .tcx-note{max-width:1180px;margin:12px auto 0;font-size:11.5px;line-height:1.55;color:#9db8cc;display:flex;gap:8px}
#tcx .tcx-note .ic{flex:0 0 auto}
@media(max-width:680px){
  #tcx .hud-left,#tcx .hud-right{top:auto;bottom:92px;transform:none;padding:7px 11px}
  #tcx .hud-left{left:10px}#tcx .hud-right{right:10px}
  #tcx .verdict{bottom:140px}#tcx .tcx-src{display:none}
  #tcx .ft-row{grid-template-columns:1fr 1.4fr auto auto;gap:6px}
}`;

function buildDOM(host:HTMLElement){
  host.innerHTML = `
  <div id="tcx">
    <div class="tcx-head">
      <h2>⚓ Tiefencheck — passt mein Boot? <span class="tcx-badge" id="tcxBadge">lädt…</span></h2>
      <p>Bootstyp wählen · Tiefgang am Regler einstellen · sofort sehen, ob die Strecke <b>sicher</b>, <b>knapp</b> oder <b>nicht befahrbar</b> ist.</p>
    </div>
    <div class="tcx-types" id="tcxTypes"></div>
    <div class="stage" id="tcxStage">
      <canvas id="tcxSea"></canvas>
      <div class="vig"></div>
      <div class="hud hud-status" id="tcxStatus"><span class="dot"></span><span class="st">—</span></div>
      <div class="hud hud-left"><div class="lab">Tiefgang</div><div class="val" id="tcxDraft">1,00<span class="u"> m</span></div></div>
      <div class="hud hud-right"><div class="lab">Fahrrinnentiefe</div><div class="val" id="tcxBed">1,29<span class="u"> m</span></div></div>
      <div class="verdict" id="tcxVerdict"><div class="big">—</div><div class="sub" id="tcxSub"></div></div>
      <div class="dialwrap">
        <div class="dial" id="tcxDial" tabindex="0" role="slider" aria-label="Tiefgang einstellen" aria-valuemin="0.1" aria-valuemax="3" aria-valuenow="1.0">
          <svg viewBox="0 0 120 120"><defs>
            <linearGradient id="tcxArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#31D5E7"/><stop offset="1" stop-color="#24E08B"/></linearGradient>
            <radialGradient id="tcxKnob" cx=".5" cy=".4"><stop offset="0" stop-color="#1a3a52"/><stop offset="1" stop-color="#081826"/></radialGradient>
            <linearGradient id="tcxGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4D98A"/><stop offset="1" stop-color="#B98C2E"/></linearGradient></defs>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="8" stroke-linecap="round" stroke-dasharray="245 327" transform="rotate(135 60 60)"/>
            <circle id="tcxArcV" cx="60" cy="60" r="52" fill="none" stroke="url(#tcxArc)" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 327" transform="rotate(135 60 60)" style="filter:drop-shadow(0 0 6px rgba(49,213,231,.6))"/>
            <circle cx="60" cy="60" r="40" fill="url(#tcxKnob)" stroke="url(#tcxGold)" stroke-width="1.6"/>
            <g id="tcxNeedle"><line x1="60" y1="60" x2="60" y2="27" stroke="url(#tcxGold)" stroke-width="2.6" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(255,196,77,.7))"/><circle cx="60" cy="27" r="2.4" fill="#FFE6A6"/></g>
          </svg>
          <div class="center"><div class="dv" id="tcxDialV">1,00</div><div class="dl">Tiefgang m</div></div>
        </div>
        <div class="hint">drehen · ziehen · ◀▶ · Mausrad</div>
      </div>
      <div class="tcx-src" id="tcxSrc">Quelle: ELWIS · lädt…</div>
    </div>
    <div class="tcx-ctrl">
      <div class="seg" id="tcxReserve"><span class="seg-lab">Reserve</span>
        <button data-r="kons">konservativ</button><button data-r="norm" class="on">normal</button><button data-r="sport">sportlich</button></div>
      <div class="seg" id="tcxProfile"><span class="seg-lab">Profil</span>
        <button data-p="none" class="on">Standard</button><button data-p="fam">👨‍👩‍👧 Familie</button><button data-p="anf">🔰 Anfänger</button><button data-p="charter">🚤 Charter</button></div>
      <select class="tcx-sec" id="tcxSection" aria-label="Gewässerabschnitt"><option value="auto">📍 Typisch (Median, alle gemeldet)</option></select>
    </div>
    <details class="tcx-detail" id="tcxDetail">
      <summary>Alle gemeldeten Abschnitte prüfen <span id="tcxN">–</span><span class="chev">▾</span></summary>
      <div class="bars" id="tcxBars"></div>
    </details>
    <div class="tcx-note"><span class="ic">⚓</span><div id="tcxNoteTxt">Marke = dein Tiefgang. Werte: amtliche ELWIS-Fahrrinnen-/Tauchtiefen. Empfehlung: ausreichend Sicherheitswasser unter dem Kiel. Verbindlich bleibt ELWIS.</div></div>
  </div>`;
}

/* ── Verdikt nach echter empfohlener Reserve ── */
function recReserveCm(): number {
  let f = RES[reserveMode].f;
  if (PROF[profile].cons) f = Math.max(f, RES.kons.f);     // Familie/Anfänger/Charter → mind. konservativ
  return Math.max(8, Math.round(BOATS[typeIdx].reserve * f));
}
function verdictFor(clrCm:number, recCm:number){
  if (clrCm >= recCm) return { c:C.emer, t:'✅ Sicher befahrbar', tip:'Route frei — gute Kielfreiheit.' };
  if (clrCm >= 0)     return { c:C.amber, t:'⚠ Knapp — vorsichtig fahren', tip:'Langsam fahren, Mitte der Fahrrinne halten.' };
  return { c:C.dang, t:'❌ Nicht befahrbar', tip:'Andere Route wählen.' };
}
function rowVerdict(cm:number|null, dCm:number, recCm:number){
  if (cm==null) return { cls:'na', ic:'—' };
  const clr = cm - dCm;
  if (clr >= recCm) return { cls:'ok', ic:'✅' };
  if (clr >= 0)     return { cls:'warn', ic:'⚠️' };
  return { cls:'bad', ic:'⛔' };
}

/* ── Daten setzen (LIVE ELWIS) ── */
export function setTiefeFT(doc:any){ ft = doc; recompute(); }

function reportedCm(items:FTItem[]){ return items.filter(i=>i.cm!=null).map(i=>i.cm as number); }
function median(arr:number[]){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }

function recompute(){
  const badge = document.getElementById('tcxBadge');
  const src = document.getElementById('tcxSrc');
  const sel = document.getElementById('tcxSection') as HTMLSelectElement | null;
  const bars = document.getElementById('tcxBars');
  const nEl = document.getElementById('tcxN');
  if (!ft || !ft.items || !ft.items.length){
    if (badge){ badge.textContent='nicht erreichbar'; badge.style.color='#ffd0c4'; }
    if (src) src.textContent='ELWIS-Fahrrinnentiefe gerade nicht erreichbar.';
    if (bars) bars.innerHTML='<div class="ft-na" style="padding:10px 0">Aktuell keine Tiefen gemeldet.</div>';
    return;
  }
  const items = ft.items;
  groups = {};
  for (const i of items){ const g=i.group||i.revier||'Sonstige'; (groups[g]=groups[g]||[]).push(i); }
  /* Abschnitt-Auswahl füllen (einmalig) */
  if (sel && sel.options.length <= 1){
    for (const g of Object.keys(groups)){
      const md = median(reportedCm(groups[g]));
      if (!md) continue;
      const o=document.createElement('option'); o.value=g; o.textContent=`${g} · min ${m2(Math.min(...reportedCm(groups[g]))/100)}`;
      sel.appendChild(o);
    }
  }
  /* bedDepth gemäß Auswahl: auto=Median aller, sonst min des Abschnitts (limitierend) */
  if (sectionKey==='auto' || !groups[sectionKey]){
    bedDepth = median(reportedCm(items))/100 || 1.29;
    bedLabel = 'typ. Fahrrinnentiefe (Median)';
  } else {
    const rc = reportedCm(groups[sectionKey]);
    bedDepth = (rc.length? Math.min(...rc):0)/100 || 1.29;
    bedLabel = 'min. Fahrrinnentiefe '+sectionKey;
  }
  const stand = ft.stand || ft.updated_de || '';
  if (badge){ badge.textContent='● Live · ELWIS'; badge.style.color='#9ff0d2'; }
  if (src) src.textContent = `Quelle: ELWIS · ${bedLabel} · Stand ${stand||'—'}`;
  renderBars();
  if (nEl){ const rep=reportedCm(items).length; nEl.textContent='('+rep+')'; }
}

function renderBars(){
  const bars = document.getElementById('tcxBars'); if(!bars) return;
  const dCm = Math.round(draftT*100), recCm = recReserveCm();
  const allRep = reportedCm(ft!.items!);
  const scale = Math.max(300, dCm, ...allRep);
  const draftPct = Math.min(100, dCm/scale*100);
  let free=0,tight=0,bad=0; let html='';
  for (const g of Object.keys(groups)){
    const rows = groups[g].map(i=>{
      const v = rowVerdict(i.cm??null, dCm, recCm);
      if (v.cls==='ok') free++; else if (v.cls==='warn') tight++; else if (v.cls==='bad') bad++;
      const fillPct = i.cm!=null? Math.min(100,(i.cm as number)/scale*100):0;
      const kind = i.kind==='T'?'Tauchtiefe':'Fahrrinnentiefe';
      return `<div class="ft-row">
        <div class="ft-meta"><b>${E(i.section||'')}</b><small>${E(i.kind||'')} · ${kind}</small></div>
        <div class="ft-bar"><div class="ft-fill ${v.cls}" style="width:${fillPct}%"></div><div class="ft-draft" style="left:${draftPct}%"></div></div>
        <div class="ft-val">${i.cm!=null? m2((i.cm as number)/100):'<span class="ft-na">n. gem.</span>'}</div>
        <div class="ft-vd">${v.ic}</div></div>`;
    }).join('');
    html += `<div class="ft-group"><div class="ft-gh">${E(g)} <small>${E(groups[g][0].abk||'')}</small></div>${rows}</div>`;
  }
  bars.innerHTML = `<div class="ft-gh" style="margin:10px 0 0">Bei ${m2(draftT)} Tiefgang · empf. Reserve ${recCm} cm: <b style="color:#24E08B">${free} frei</b>${tight?` · <b style="color:#FFC44D">${tight} knapp</b>`:''}${bad?` · <b style="color:#FF4B5C">${bad} zu flach</b>`:''}</div>`+html;
}

/* ── Canvas-Render ── */
function resize(){ if(!cv) return; const r=cv.getBoundingClientRect(); W=r.width; H=r.height; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }

function drawBoat(id:string, keelPx:number, w:number){
  ctx.fillStyle='#16252f'; ctx.strokeStyle='#0a151c'; ctx.lineWidth=2;
  const kp=Math.max(7,keelPx);
  ctx.beginPath();
  if (id==='kajak'){ ctx.moveTo(-w/2,-3); ctx.quadraticCurveTo(0,-9,w/2,-3); ctx.quadraticCurveTo(0,kp,-w/2,-3); ctx.fill();
    ctx.strokeStyle='#cfd8de'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(-14,-16); ctx.lineTo(14,-2); ctx.stroke(); }   // Paddel
  else if (id==='haus'){ ctx.moveTo(-w/2,0); ctx.lineTo(w/2,0); ctx.lineTo(w/2-6,kp*.6); ctx.lineTo(-w/2+6,kp*.6); ctx.closePath(); ctx.fill();
    ctx.fillRect(-w/2+10,-30,w-20,30); ctx.fillStyle='#9fb6c6'; ctx.fillRect(-w/2+18,-24,w-36,14); ctx.fillStyle='#16252f'; }
  else if (id==='segel'){ ctx.moveTo(-w/2,-9); ctx.quadraticCurveTo(0,-15,w/2,-9); ctx.lineTo(w/2-14,2); ctx.lineTo(-w/2+14,2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-4,0,8,kp); ctx.beginPath(); ctx.moveTo(-4,kp); ctx.lineTo(-15,kp-5); ctx.lineTo(4,kp-24); ctx.fill();   // Kielflosse
    ctx.fillRect(-2,-86,3,77); ctx.fillStyle=hex(C.turq,.5); ctx.beginPath(); ctx.moveTo(1,-84); ctx.lineTo(1,-14); ctx.lineTo(40,-20); ctx.fill(); ctx.fillStyle='#16252f'; }  // Segel
  else if (id==='sport'){ ctx.moveTo(-w/2,-9); ctx.quadraticCurveTo(0,-13,w/2,-6); ctx.lineTo(w/2-12,2); ctx.quadraticCurveTo(0,kp,-w/2+8,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#bcd7e6'; ctx.beginPath(); ctx.moveTo(-w/6,-9); ctx.lineTo(w/8,-9); ctx.lineTo(w/10,-20); ctx.lineTo(-w/8,-20); ctx.closePath(); ctx.fill(); ctx.fillStyle='#16252f'; }
  else if (id==='angel'){ ctx.moveTo(-w/2,-8); ctx.quadraticCurveTo(0,-12,w/2,-8); ctx.lineTo(w/2-9,2); ctx.quadraticCurveTo(0,kp,-w/2+9,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3a4a55'; ctx.fillRect(-8,-22,16,14); ctx.fillStyle='#16252f';                                       // Konsole
    ctx.strokeStyle='#c8a24a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(w/2-14,-10); ctx.quadraticCurveTo(w/2+28,-30,w/2+44,-46); ctx.stroke(); ctx.strokeStyle='#0a151c'; }  // Angelrute
  else if (id==='yacht'){ ctx.moveTo(-w/2,-14); ctx.quadraticCurveTo(0,-19,w/2,-12); ctx.lineTo(w/2-10,2); ctx.quadraticCurveTo(0,kp,-w/2+10,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#dfe7ec'; ctx.fillRect(-w/3,-32,w*.62,18); ctx.fillRect(-w/5,-46,w*.4,16); ctx.fillStyle='#16252f'; ctx.fillRect(-w/5+5,-44,w*.4-10,11); }
  else { // motor
    ctx.moveTo(-w/2,-12); ctx.quadraticCurveTo(0,-17,w/2,-12); ctx.lineTo(w/2-10,1); ctx.quadraticCurveTo(0,kp,-w/2+10,1); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfd8de'; ctx.fillRect(-w/4,-30,w/2,18); ctx.fillStyle='#16252f'; ctx.fillRect(-10,-43,20,13); }
  // Wasserlinie-Strich (Tiefgang)
  ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,kp); ctx.stroke(); ctx.setLineDash([]);
}

function frame(){
  t += 0.016; draft += (draftT-draft)*0.12;
  const waterY=H*0.15, pxM=(H-waterY-22)/MAXD;
  const keelY=waterY+draft*pxM, bedY=waterY+Math.min(bedDepth,MAXD)*pxM;
  const recCm=recReserveCm(), clrCm=Math.round((bedDepth-draft)*100);
  const recY=waterY+Math.max(0,(bedDepth-recCm/100))*pxM;
  const v=verdictFor(clrCm, recCm);
  ctx.clearRect(0,0,W,H);
  // Himmel
  let sky=ctx.createLinearGradient(0,0,0,waterY); sky.addColorStop(0,'#0c2c41'); sky.addColorStop(1,'#16506b'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,waterY);
  // Wasser
  let wat=ctx.createLinearGradient(0,waterY,0,H); wat.addColorStop(0,'#3fb9cf'); wat.addColorStop(.2,C.turq); wat.addColorStop(.55,C.deepw); wat.addColorStop(1,C.navy); ctx.fillStyle=wat; ctx.fillRect(0,waterY,W,H-waterY);
  // Caustics
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){ const y=waterY+30+i*((H-waterY)/5); ctx.beginPath(); ctx.moveTo(0,y); for(let x=0;x<=W;x+=24) ctx.lineTo(x,y+Math.sin(x*0.02+t*1.4+i)*6);
    ctx.strokeStyle=hex('#bdf3ff',0.05+0.03*Math.sin(t+i)); ctx.lineWidth=10+i*4; ctx.stroke(); }
  ctx.restore();
  // Sonnenglitzer
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let i=0;i<W;i+=10){ const a=0.10*Math.max(0,Math.sin(i*0.05+t*2)); ctx.fillStyle=hex('#eafcff',a); ctx.fillRect(i,waterY+Math.sin(i*0.06+t)*2,5,2); }
  ctx.restore();
  // empf. Reserve-Linie (Gold, gestrichelt)
  if (clrCm>=0){ ctx.strokeStyle=hex(C.gold,.45); ctx.setLineDash([6,6]); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(0,recY); ctx.lineTo(W,recY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=hex(C.gold,.75); ctx.font='600 10px system-ui'; ctx.fillText('empf. Reserve '+recCm+' cm', 12, recY-5); }
  // Grund
  ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,bedY);
  for(let x=0;x<=W;x+=20) ctx.lineTo(x,bedY+Math.sin(x*0.018+t*0.3)*5+Math.sin(x*0.05)*3);
  ctx.lineTo(W,H); ctx.closePath();
  let bg=ctx.createLinearGradient(0,bedY-10,0,H); bg.addColorStop(0,'#8a6f49'); bg.addColorStop(.3,C.sand); bg.addColorStop(1,'#5b4126'); ctx.fillStyle=bg; ctx.fill();
  // Pflanzen
  ctx.strokeStyle=hex('#2e6b4a',.6); ctx.lineWidth=2;
  for(let x=34;x<W;x+=72){ const by=bedY+Math.sin(x*0.018+t*0.3)*5; ctx.beginPath(); ctx.moveTo(x,by); ctx.quadraticCurveTo(x+Math.sin(t*1.3+x)*6,by-16,x+Math.sin(t+x)*3,by-26); ctx.stroke(); }
  const cx=W/2;
  // Kielfreiheit-Glow
  if (clrCm>=0){ ctx.save(); ctx.globalCompositeOperation='screen'; const g=ctx.createLinearGradient(0,keelY,0,bedY); g.addColorStop(0,hex(v.c,0)); g.addColorStop(.5,hex(v.c,.26+.12*Math.sin(t*3))); g.addColorStop(1,hex(v.c,0)); ctx.fillStyle=g; ctx.fillRect(cx-150,keelY,300,Math.max(2,bedY-keelY)); ctx.restore(); }
  else { ctx.save(); ctx.globalCompositeOperation='screen'; ctx.fillStyle=hex(C.dang,.3+.15*Math.sin(t*5)); ctx.fillRect(cx-150,bedY-4,300,(keelY-bedY)+8); ctx.restore(); }
  // Blasen
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(const b of bubbles){ b.y-=b.sp*0.004; if(b.y<0){ b.y=1; b.x=Math.random(); } const bx=cx-120+b.x*240, by=keelY+(1-b.y)*Math.max(10,bedY-keelY); ctx.beginPath(); ctx.arc(bx,by,b.s,0,7); ctx.fillStyle=hex('#cdeefc',.4); ctx.fill(); }
  ctx.restore();
  // Boot
  const bob=Math.sin(t*1.1)*4, tilt=Math.sin(t*0.9)*0.02;
  ctx.save(); ctx.translate(cx,waterY+bob); ctx.rotate(tilt); drawBoat(BOATS[typeIdx].id, draft*pxM, BOATS[typeIdx].w); ctx.restore();
  // Wasseroberfläche
  ctx.beginPath(); ctx.moveTo(0,waterY); for(let x=0;x<=W;x+=16) ctx.lineTo(x,waterY+Math.sin(x*0.03+t*1.6)*3); ctx.strokeStyle=hex('#cdf3ff',.55); ctx.lineWidth=2; ctx.stroke();
  // Maßlinie
  if (clrCm>=0){ ctx.strokeStyle=hex(v.c,.9); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx+95,keelY); ctx.lineTo(cx+95,bedY); ctx.moveTo(cx+90,keelY); ctx.lineTo(cx+100,keelY); ctx.moveTo(cx+90,bedY); ctx.lineTo(cx+100,bedY); ctx.stroke();
    ctx.fillStyle=v.c; ctx.font='700 13px system-ui'; ctx.fillText('≈ '+clrCm+' cm', cx+106, (keelY+bedY)/2+4); }
  // HUD/Verdikt
  const dEl=document.getElementById('tcxDraft'); if(dEl) dEl.innerHTML=draft.toFixed(2).replace('.',',')+'<span class="u"> m</span>';
  const bEl=document.getElementById('tcxBed'); if(bEl) bEl.innerHTML=bedDepth.toFixed(2).replace('.',',')+'<span class="u"> m</span>';
  const stt=document.getElementById('tcxStatus'); if(stt){ const dot=stt.querySelector('.dot') as HTMLElement, st=stt.querySelector('.st') as HTMLElement; dot.style.color=v.c; dot.style.background=v.c; st.textContent=v.t.replace(/[✅⚠❌]\s?/,''); st.style.color=v.c; }
  const vd=document.getElementById('tcxVerdict'); if(vd){ const big=vd.querySelector('.big') as HTMLElement; big.textContent=v.t; big.style.color=v.c; }
  const sub=document.getElementById('tcxSub'); if(sub) sub.textContent = clrCm>=0 ? (`Kielreserve ${clrCm} cm · empfohlen ≥ ${recCm} cm · ${v.tip}`) : (`${Math.abs(clrCm)} cm zu tief · ${v.tip}`);
  // Dial
  const dv=document.getElementById('tcxDialV'); if(dv) dv.textContent=draft.toFixed(2).replace('.',',');
  const frac=(draft-0.1)/(MAXD-0.1); const arc=document.getElementById('tcxArcV'); const ndl=document.getElementById('tcxNeedle'); const dl=document.getElementById('tcxDial');
  if(arc) arc.setAttribute('stroke-dasharray',(frac*245)+' 327'); if(ndl) ndl.setAttribute('transform','rotate('+(-135+frac*270)+' 60 60)'); if(dl) dl.setAttribute('aria-valuenow',draft.toFixed(2));
}

function loop(){ frame(); rafId=requestAnimationFrame(loop); }
function start(){ if(running||reduceMotion()) { if(reduceMotion()) frame(); return; } running=true; loop(); }
function stop(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }

/* ── Steuerung ── */
function wireDial(){
  const dial=document.getElementById('tcxDial'); if(!dial) return;
  const setFromAngle=(cx:number,cy:number,px:number,py:number)=>{ let a=Math.atan2(py-cy,px-cx)*180/Math.PI; a=(a+90+360)%360; if(a>270) a=(a<315)?270:0; const frac=Math.min(1,Math.max(0,a/270)); draftT=+(0.1+frac*(MAXD-0.1)).toFixed(2); saveDraft(); };
  let drag=false;
  dial.addEventListener('pointerdown',(e:any)=>{ drag=true; dial.setPointerCapture(e.pointerId); const r=dial.getBoundingClientRect(); setFromAngle(r.left+r.width/2,r.top+r.height/2,e.clientX,e.clientY); });
  dial.addEventListener('pointermove',(e:any)=>{ if(!drag) return; const r=dial.getBoundingClientRect(); setFromAngle(r.left+r.width/2,r.top+r.height/2,e.clientX,e.clientY); });
  addEventListener('pointerup',()=>{ if(drag){ drag=false; renderBars(); } });
  dial.addEventListener('wheel',(e:any)=>{ e.preventDefault(); draftT=+Math.min(MAXD,Math.max(0.1,draftT+(e.deltaY>0?-0.05:0.05))).toFixed(2); saveDraft(); renderBars(); },{passive:false});
  dial.addEventListener('keydown',(e:any)=>{ if(e.key==='ArrowRight'||e.key==='ArrowUp'){ draftT=+Math.min(MAXD,draftT+0.05).toFixed(2); e.preventDefault(); } else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){ draftT=+Math.max(0.1,draftT-0.05).toFixed(2); e.preventDefault(); } else return; saveDraft(); renderBars(); if(reduceMotion()) frame(); });
}
function saveDraft(){ try{ localStorage.setItem('wl_draft', draftT.toFixed(2)); }catch{ /* */ } }

function wireControls(){
  const types=document.getElementById('tcxTypes');
  if(types){ types.innerHTML=BOATS.map((b,i)=>`<button class="tc-type${i===typeIdx?' on':''}" data-i="${i}"><span class="ic">${b.ic}</span>${E(b.n)}</button>`).join('');
    types.addEventListener('click',e=>{ const t=(e.target as HTMLElement).closest('.tc-type') as HTMLElement|null; if(!t)return; typeIdx=+t.dataset.i!; types.querySelectorAll('.tc-type').forEach(x=>x.classList.remove('on')); t.classList.add('on'); draftT=BOATS[typeIdx].draft; saveDraft(); renderBars(); if(reduceMotion()) frame(); }); }
  const res=document.getElementById('tcxReserve');
  res?.addEventListener('click',e=>{ const b=(e.target as HTMLElement).closest('button[data-r]') as HTMLElement|null; if(!b)return; reserveMode=b.dataset.r!; res.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderBars(); if(reduceMotion()) frame(); });
  const prof=document.getElementById('tcxProfile');
  prof?.addEventListener('click',e=>{ const b=(e.target as HTMLElement).closest('button[data-p]') as HTMLElement|null; if(!b)return; profile=b.dataset.p!; prof.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    // Profil mit Sicherheitsbedarf → Reserve sichtbar auf konservativ ziehen
    if(PROF[profile].cons){ reserveMode='kons'; const r=document.getElementById('tcxReserve'); r?.querySelectorAll('button').forEach(x=>x.classList.toggle('on',(x as HTMLElement).dataset.r==='kons')); }
    renderBars(); if(reduceMotion()) frame(); });
  const sel=document.getElementById('tcxSection') as HTMLSelectElement|null;
  sel?.addEventListener('change',()=>{ sectionKey=sel.value; recompute(); if(reduceMotion()) frame(); });
}

export function initTiefeSim(doc:any){
  const sect=document.getElementById('tiefe-sect'); if(!sect) return;
  if(!document.getElementById('tcx-css')){ const st=document.createElement('style'); st.id='tcx-css'; st.textContent=CSS; document.head.appendChild(st); }
  buildDOM(sect);
  cv=document.getElementById('tcxSea') as HTMLCanvasElement; ctx=cv.getContext('2d')!; DPR=Math.min(devicePixelRatio||1,2);
  for(let i=0;i<14;i++) bubbles.push({x:Math.random(),y:Math.random(),s:1+Math.random()*2,sp:.15+Math.random()*.3});
  try{ const s=localStorage.getItem('wl_draft'); if(s && +s>=0.1 && +s<=MAXD){ draftT=+s; draft=+s; } else { draftT=BOATS[typeIdx].draft; draft=draftT; } }catch{ draftT=BOATS[typeIdx].draft; draft=draftT; }
  resize(); wireDial(); wireControls();
  if('ResizeObserver' in window){ new ResizeObserver(()=>{ resize(); if(reduceMotion()) frame(); }).observe(cv); } else addEventListener('resize',resize);
  ft=doc; recompute();
  // rAF nur wenn Sektion sichtbar UND Tab aktiv
  const stage=document.getElementById('tcxStage')!; let onScreen=false;
  const upd=()=>{ if(onScreen && !document.hidden) start(); else stop(); };
  if('IntersectionObserver' in window){ new IntersectionObserver(es=>{ onScreen=es[0].isIntersecting; upd(); },{rootMargin:'80px'}).observe(stage); }
  else { onScreen=true; }
  document.addEventListener('visibilitychange',upd);
  frame();   // erstes Standbild sofort
  upd();
}
