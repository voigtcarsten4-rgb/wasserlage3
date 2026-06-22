/* ═══ Tiefencheck · Captain Depth Assistant ═══
 * Interaktiver Marine-Mini-Simulator + intelligenter Tiefen-Co-Pilot.
 * Canvas-Querschnitt (Wasser/Caustics/Grund/Boot/Kielfreiheit-Glow) + maritimer Dreh-Regler
 * + Präzisionseingabe (−/＋/Zahl) + Boot-Garage + Captain-Score + Fahrrinnen-Profil + Smart-Warnungen.
 * Werte LIVE aus ELWIS-Fahrrinnentiefe; Wind aus Open-Meteo; Sperrungen aus ELWIS-Notices.
 * wl3-Grundgesetz: keine Fake-Daten — jeder Score-Punkt ist nachvollziehbar. Verbindlich bleibt ELWIS.
 * Self-contained: eigenes <style>, eigene Helfer, rAF pausiert offscreen/hidden. */

import { windAdvice } from '../lib/wind';
import { currentMode } from './modes';
import { activeToday, fetchTrend } from '../lib/live';
import { captainDepthScore } from '../lib/depthscore';
import { renderProfileCockpit } from './profilecockpit';

interface FTItem { revier?:string; group?:string; abk?:string; section?:string; kind?:string; value?:string; cm?:number|null; status?:string }
interface FTDoc { updated_de?:string; stand?:string; items?:FTItem[] }
interface TiefeCtx { weather?:any; notices?:any[]|null }

const E = (s:any)=>{ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; };
const reduceMotion = ()=> window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { navy:'#07263B', deepw:'#0C496A', turq:'#31D5E7', emer:'#24E08B', amber:'#FFC44D', warn:'#FF914D', dang:'#FF4B5C', sand:'#B69468', gold:'#D9B14D' };
function hex(h:string,a:number){ const n=parseInt(h.slice(1),16); return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
const m2 = (m:number)=> m.toFixed(2).replace('.',',')+' m';
const clampN = (v:number,lo:number,hi:number)=> Math.max(lo,Math.min(hi,v));
const lvlCls = (l:number)=> l>=2?'bad':l>=1?'warn':'ok';
const parseNum = (s:any)=>{ if(s==null) return undefined; const v=parseFloat(String(s).replace(',','.').trim()); return isFinite(v)?v:undefined; };
const normW = (s:string)=> (s||'').toLowerCase().replace(/wasserstra(ss|ß)e|wasserstr\.?|kanal|[\s.\-(),]/g,'');

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

/* ── gespeicherte Boote (Boot-Garage) ── */
interface SavedBoat { id:string; name:string; type:string; draft:number; length?:number; beam?:number; weight?:number }
let boats: SavedBoat[] = [];
function loadBoats(){ try{ const r=localStorage.getItem('wl_boats'); const a=r?JSON.parse(r):[]; boats=Array.isArray(a)?a:[]; }catch{ boats=[]; } }
function persistBoats(){ try{ localStorage.setItem('wl_boats', JSON.stringify(boats)); }catch{ /* */ } }

/* ── Modul-State ── */
let typeIdx = 4;                 // Motoryacht
let draft = 1.0, draftT = 1.0;   // ist / ziel
let reserveMode = 'norm', profile = 'none';
let MAXD = 3.0;
let ft: FTDoc | null = null;
let ctxWeather:any = null, ctxNotices:any[]|null = null;
let ctxPegel:any[]|null = null;
let pegelTrend:{dir:-1|0|1;delta:number;strong:boolean;station:string}|null = null;
const trendCache:Record<string,any> = {};
let bedDepth = 1.29;             // gewählte Fahrrinnentiefe (Median oder Abschnitt)
let bedLabel = 'typ. Fahrrinnentiefe (Median)';
let groups: Record<string, FTItem[]> = {};
let sectionKey = 'auto';
let running = false, rafId = 0, t = 0;
let cv:any=null, ctx:any=null, W=0, H=0, DPR=1;   // 2D-Tiefgang-Simulator (M44 reaktiviert + mit Cockpit synchronisiert)
let bedShown=1.29; let simPreviewCm:number|null=null;
let roT:any = 0;
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
#tcx canvas{display:block;width:100%;height:clamp(230px,30vh,300px)}
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

/* ── Captain-Depth-Assistant: zusätzliche Stile ── */
const CSS_X = `
#tcx .tcx-garage{display:flex;flex-wrap:wrap;gap:7px;align-items:center;justify-content:center;max-width:920px;margin:0 auto 4px}
#tcx .gar-lab{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#7fa0b4}
#tcx .tc-boat{display:inline-flex;align-items:center;gap:6px;background:rgba(7,26,40,.5);border:1px solid rgba(217,177,77,.28);color:#e6f4fb;border-radius:999px;padding:6px 10px;font:600 12px var(--font-b,sans-serif);cursor:pointer;transition:transform .2s,border-color .2s}
#tcx .tc-boat:hover{transform:translateY(-1px);border-color:rgba(217,177,77,.6)}
#tcx .tc-boat .dr{color:#9fd0e0;font-variant-numeric:tabular-nums}
#tcx .tc-boat .x{margin-left:2px;color:#9bb6c6;font-weight:700;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center}
#tcx .tc-boat .x:hover{background:rgba(255,75,92,.25);color:#fff}
#tcx .tc-boat.add{border-style:dashed;border-color:rgba(143,233,255,.4);color:#bfe6f5}
#tcx .tcx-boatform{max-width:760px;margin:6px auto 0;background:rgba(7,26,40,.6);border:1px solid rgba(143,233,255,.2);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:9px}
#tcx .tcx-boatform[hidden]{display:none!important}
#tcx .tcx-sheet-bd{display:none}
@keyframes tcxSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes tcxBdIn{from{opacity:0}to{opacity:1}}
#tiefe-sect{will-change:auto}
#tcx .bf-row{display:flex;gap:9px;flex-wrap:wrap}
#tcx .bf-row label{flex:1 1 130px;display:flex;flex-direction:column;gap:3px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#8fb6c8}
#tcx .bf-row input,#tcx .bf-row select{background:rgba(4,18,31,.7);border:1px solid rgba(143,233,255,.2);color:#eafaff;border-radius:9px;padding:8px 10px;font:600 13px var(--font-b,sans-serif)}
#tcx .bf-act{display:flex;gap:8px;align-items:center}
#tcx .bf-sp{flex:1}
#tcx .bf-act button{border:none;border-radius:9px;padding:8px 14px;font:700 12.5px var(--font-b,sans-serif);cursor:pointer}
#tcx .bf-cur{background:rgba(143,233,255,.14);color:#bfe6f5}
#tcx .bf-cancel{background:rgba(255,255,255,.08);color:#cfe2ee}
#tcx .bf-save{background:linear-gradient(180deg,#31D5E7,#1f9e9e);color:#04212b}
#tcx .tcx-precision{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:920px;margin:14px auto 0}
#tcx .pr-btn{width:46px;height:46px;border-radius:13px;border:1px solid rgba(143,233,255,.22);background:rgba(7,26,40,.55);color:#eafaff;font-size:24px;font-weight:700;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform .12s,background .2s,border-color .2s}
#tcx .pr-btn:hover{border-color:var(--turq)}
#tcx .pr-btn:active{transform:scale(.92);background:rgba(49,213,231,.22)}
#tcx .dialwrap .dialrow{display:flex;align-items:center;justify-content:center;gap:16px}
#tcx .pr-btn-dial{width:48px;height:48px;border-radius:50%;font-size:26px;flex:0 0 auto;background:rgba(7,26,40,.62);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-color:rgba(217,177,77,.34);box-shadow:0 10px 26px -14px rgba(0,8,20,.85),inset 0 1px 0 rgba(217,177,77,.18)}
#tcx .pr-btn-dial:hover{border-color:var(--turq);transform:translateY(-1px)}
#tcx .pr-btn-dial:active{transform:scale(.9);background:rgba(49,213,231,.26)}
@media(max-width:680px){#tcx .dialwrap .dialrow{gap:12px;align-items:flex-end}#tcx .pr-btn-dial{width:44px;height:44px;font-size:23px}#tcx .dialwrap .pr-btn-dial{margin-bottom:-6px}}
#tcx .pr-field{display:flex;align-items:baseline;gap:4px;background:rgba(7,26,40,.55);border:1px solid rgba(217,177,77,.34);border-radius:13px;padding:6px 12px}
#tcx .pr-field input{width:74px;background:transparent;border:none;outline:none;color:#fff;font:800 24px var(--font-b,sans-serif);font-variant-numeric:tabular-nums;text-align:right}
#tcx .pr-field .pr-u{font-size:14px;font-weight:700;color:#9fd0e0}
#tcx .tcx-score{max-width:1180px;margin:16px auto 0;display:flex;gap:18px;align-items:center;background:linear-gradient(180deg,rgba(9,30,46,.7),rgba(7,26,40,.5));border:1px solid rgba(143,233,255,.16);border-radius:18px;padding:16px 18px;box-shadow:0 24px 60px -40px rgba(0,8,20,.9),inset 0 1px 0 rgba(217,177,77,.14)}
#tcx .sc-ring{position:relative;width:108px;height:108px;flex:0 0 auto}
#tcx .sc-ring svg{width:100%;height:100%;transform:none}
#tcx .sc-bg{fill:none;stroke:rgba(255,255,255,.09);stroke-width:9}
#tcx .sc-arc{fill:none;stroke-width:9;stroke-linecap:round;transition:stroke-dasharray .6s cubic-bezier(.3,1,.4,1),stroke .4s}
#tcx .sc-arc.ok{stroke:#24E08B}#tcx .sc-arc.warn{stroke:#FFC44D}#tcx .sc-arc.bad{stroke:#FF4B5C}
#tcx .sc-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
#tcx .sc-num{font:800 32px var(--font-b,sans-serif);font-variant-numeric:tabular-nums;color:#fff;line-height:1}
#tcx .sc-of{font-size:10px;letter-spacing:.1em;color:#8fb6c8}
#tcx .sc-body{flex:1;min-width:0}
#tcx .sc-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
#tcx .sc-ttl{font:800 14px var(--font-b,sans-serif);color:#eafaff;letter-spacing:-.01em}
#tcx .sc-stars{font-size:15px;letter-spacing:1px}
#tcx .sc-stars.ok{color:#24E08B}#tcx .sc-stars.warn{color:#FFC44D}#tcx .sc-stars.bad{color:#FF7a85}
#tcx .sc-hd{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px}
#tcx .sc-hd.ok{color:#9ff0d2;background:rgba(46,196,182,.16)}#tcx .sc-hd.warn{color:#ffd98a;background:rgba(217,177,77,.16)}#tcx .sc-hd.bad{color:#ffc0c4;background:rgba(255,75,92,.18)}
#tcx .sc-verdict{font-size:13.5px;line-height:1.5;color:#dcecf3;margin:7px 0 8px}
#tcx .sc-drivers{display:flex;flex-wrap:wrap;gap:6px}
#tcx .sc-dv{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid transparent}
#tcx .sc-dv.ok{color:#9ff0d2;background:rgba(36,224,139,.12);border-color:rgba(36,224,139,.3)}
#tcx .sc-dv.warn{color:#ffd98a;background:rgba(255,196,77,.12);border-color:rgba(255,196,77,.32)}
#tcx .sc-dv.bad{color:#ffb3b9;background:rgba(255,75,92,.14);border-color:rgba(255,75,92,.36)}
#tcx .sc-foot{font-size:10.5px;color:#7fa0b4;margin-top:9px;line-height:1.45}
#tcx .tcx-warn{max-width:1180px;margin:12px auto 0;display:flex;flex-direction:column;gap:7px}
#tcx .wn{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;border-radius:11px;padding:9px 12px;border:1px solid transparent}
#tcx .wn>span{flex:0 0 auto;font-size:14px}
#tcx .wn.ok{color:#cdeede;background:rgba(36,224,139,.08);border-color:rgba(36,224,139,.22)}
#tcx .wn.warn{color:#ffe6bd;background:rgba(255,196,77,.09);border-color:rgba(255,196,77,.28)}
#tcx .wn.bad{color:#ffd0d4;background:rgba(255,75,92,.1);border-color:rgba(255,75,92,.32)}
#tcx .wn b{color:#fff}
#tcx .tcx-profile{max-width:1180px;margin:14px auto 0;background:rgba(7,26,40,.42);border:1px solid rgba(143,233,255,.14);border-radius:16px;padding:13px 16px 14px}
#tcx .pf-head{font:700 13px var(--font-b,sans-serif);color:#9fd0e0;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-bottom:9px}
#tcx .pf-head small{color:#7fa0b4;font-weight:500;font-size:10.5px}
#tcx .pf-track{position:relative;height:120px;border-radius:10px;background:linear-gradient(180deg,rgba(49,213,231,.05),rgba(7,38,59,.4));overflow:hidden}
#tcx .pf-bars{position:absolute;inset:0;display:flex;align-items:flex-end;gap:3px;padding:0 6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
#tcx .pf-bars::-webkit-scrollbar{height:5px}#tcx .pf-bars::-webkit-scrollbar-thumb{background:rgba(143,233,255,.3);border-radius:3px}
#tcx .pf-seg{position:relative;flex:0 0 auto;width:26px;height:100%;background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:flex-end}
#tcx .pf-fill{width:100%;height:var(--h,10%);border-radius:5px 5px 0 0;transition:height .4s cubic-bezier(.3,1,.4,1)}
#tcx .pf-seg.ok .pf-fill{background:linear-gradient(180deg,#31D5E7,#1f9e6e)}
#tcx .pf-seg.tight .pf-fill{background:linear-gradient(180deg,#FFD98A,#caa033)}
#tcx .pf-seg.bad .pf-fill{background:linear-gradient(180deg,#FF7a85,#c0392f)}
#tcx .pf-seg.sel .pf-fill{outline:2px solid #fff;outline-offset:-1px}
#tcx .pf-ic{position:absolute;left:50%;top:8px;transform:translateX(-50%);font-size:11px;pointer-events:none}
#tcx .pf-grp{position:relative;flex:0 0 auto;align-self:stretch;width:1px;background:rgba(143,233,255,.22);margin:0 5px}
#tcx .pf-grp span{position:absolute;top:2px;left:3px;font-size:9px;color:#8fb6c8;white-space:nowrap;writing-mode:vertical-rl;text-orientation:mixed;max-height:112px;overflow:hidden}
#tcx .pf-line{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed rgba(255,255,255,.55);pointer-events:none}
#tcx .pf-line.rec{border-top-style:dashed;border-top-color:rgba(217,177,77,.7)}
#tcx .pf-line.draft{border-top:2px solid rgba(255,255,255,.85)}
#tcx .pf-line span{position:absolute;right:6px;top:-13px;font-size:9px;font-weight:700;background:rgba(4,18,31,.7);padding:1px 5px;border-radius:5px}
#tcx .pf-line.rec span{color:#ffd98a}#tcx .pf-line.draft span{color:#eafaff}
#tcx .pf-info{margin-top:9px;font-size:12px;color:#cfe2ee;line-height:1.5;min-height:18px}
#tcx .pf-info b{color:#fff}
#tcx .pf-empty{color:#7fa0b4;align-self:center;margin:auto;font-size:12px}
#tcx .tcx-route{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(180deg,rgba(217,177,77,.28),rgba(217,177,77,.12));border:1px solid rgba(217,177,77,.45);color:#ffe9bd;border-radius:12px;padding:9px 15px;font:700 12.5px var(--font-b,sans-serif);cursor:pointer;transition:transform .2s,box-shadow .2s}
#tcx .tcx-route:hover{transform:translateY(-1px);box-shadow:0 10px 24px -12px rgba(217,177,77,.5)}
@media(max-width:680px){
  #tcx .tcx-score{flex-direction:column;text-align:center;align-items:center}
  #tcx .sc-body{width:100%}#tcx .sc-top,#tcx .sc-drivers{justify-content:center}
  #tcx .pr-field input{font-size:21px;width:64px}
  #tcx .tcx-types,#tcx .tcx-precision,#tcx .tcx-score,#tcx .tcx-warn,#tcx .tcx-profile,#tcx .tcx-ctrl,#tcx .tcx-detail,#tcx .tcx-note{margin-top:11px}
  #tcx canvas{height:clamp(200px,28vh,260px)}
  #tcx .pf-bars{scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;gap:4px}
  #tcx .pf-seg{width:30px;scroll-snap-align:center}
  #tcx .pr-field{min-height:46px}
  #tcx select.tcx-sec{padding:11px 12px;min-height:44px}
  #tcx .tcx-ctrl{gap:8px}
  #tcx .tcx-types{flex-wrap:wrap;justify-content:center;overflow:visible;scroll-snap-type:none}
  #tcx .tcx-sheet-bd:not([hidden]){display:block;position:fixed;inset:0;z-index:1400;background:rgba(2,8,16,.6);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:tcxBdIn .25s ease}
  #tcx .tcx-boatform:not([hidden]){position:fixed;left:0;right:0;bottom:0;z-index:1401;max-width:none;margin:0;border-radius:20px 20px 0 0;padding:22px 16px calc(16px + env(safe-area-inset-bottom));max-height:88vh;overflow:auto;box-shadow:0 -24px 60px -18px rgba(0,8,20,.88);animation:tcxSheetUp .3s cubic-bezier(.22,1,.36,1)}
  #tcx .tcx-boatform:not([hidden])::before{content:"";position:absolute;top:9px;left:50%;transform:translateX(-50%);width:42px;height:4px;border-radius:999px;background:rgba(143,233,255,.45)}
}`;

/* ── M40: Boot & Tiefgang einklappbar — Handy führt mit dem Entscheidungs-Cockpit ── */
const CSS_M40 = `
#tcx .tcx-adjbtn{display:none}
#tcx .tcx-adjust{display:block}
@media(max-width:760px){
  #tcx .tcx-adjbtn{display:flex;width:100%;max-width:560px;margin:13px auto 0;align-items:center;gap:11px;
    background:linear-gradient(180deg,rgba(9,30,46,.82),rgba(7,26,40,.6));border:1px solid rgba(143,233,255,.22);
    border-radius:15px;padding:12px 15px;cursor:pointer;color:#eafaff;text-align:left;
    box-shadow:0 14px 30px -22px rgba(0,8,20,.85),inset 0 1px 0 rgba(217,177,77,.16);-webkit-tap-highlight-color:transparent;transition:transform .12s,border-color .2s}
  #tcx .tcx-adjbtn:active{transform:scale(.99)}
  #tcx .tcx-adjbtn .ab-ic{font-size:21px;flex:0 0 auto}
  #tcx .tcx-adjbtn .ab-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
  #tcx .tcx-adjbtn .ab-tx b{font-size:13.5px;font-weight:800;color:#eafaff;letter-spacing:-.01em}
  #tcx .tcx-adjbtn .ab-sum{font-size:11.5px;color:#9fd0e0;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #tcx .tcx-adjbtn .ab-chev{flex:0 0 auto;color:#6fe0e6;font-size:14px;transition:transform .3s}
  #tcx .tcx-adjbtn[aria-expanded="true"] .ab-chev{transform:rotate(180deg)}
  #tcx .tcx-adjust{display:none}
  #tcx .tcx-adjust.open{display:block;animation:tcxAdjIn .3s ease}
}
#tcx .tcx-dialbox{display:flex;flex-direction:column;align-items:center;gap:5px;max-width:1180px;margin:2px auto 0;padding:4px 0}
#tcx .tcx-dialbox .dialwrap{position:static;transform:none;left:auto;bottom:auto}
#tcx .tcx-dialbox .tcx-src{position:static;max-width:none;text-align:center;background:none;color:#86a8bc;padding:0}
@keyframes tcxAdjIn{from{opacity:0}to{opacity:1}}`;

function buildDOM(host:HTMLElement){
  const boatOpts = BOATS.map(b=>`<option value="${b.id}">${b.ic} ${E(b.n)}</option>`).join('');
  host.innerHTML = `
  <div id="tcx">
    <div class="tcx-head">
      <h2>⚓ Tiefencheck — passt mein Boot? <span class="tcx-badge" id="tcxBadge">lädt…</span></h2>
      <p>Stell <b>Boot &amp; Tiefgang</b> ein — der Tiefencheck zeigt dir sofort, wo's auf deiner Strecke eng wird: Fahrrinnen-Profil, Score &amp; Warnungen aus echten ELWIS-Daten.</p>
    </div>
    <button class="tcx-adjbtn" id="tcxAdjBtn" type="button" aria-expanded="true" aria-controls="tcxAdjust"><span class="ab-ic">⚓</span><span class="ab-tx"><b>Boot &amp; Tiefgang einstellen</b><span class="ab-sum" id="tcxAdjSum">—</span></span><span class="ab-chev">▾</span></button>
    <div class="tcx-adjust" id="tcxAdjust">
    <div class="tcx-garage" id="tcxGarage"></div>
    <div class="tcx-sheet-bd" id="tcxSheetBd" hidden></div>
    <form class="tcx-boatform" id="tcxBoatForm" hidden>
      <div class="bf-row">
        <label>Name<input name="name" type="text" maxlength="24" placeholder="Mein Boot" required></label>
        <label>Typ<select name="type">${boatOpts}</select></label>
        <label>Tiefgang (m)<input name="draft" type="text" inputmode="decimal" placeholder="1,00" required></label>
      </div>
      <div class="bf-row">
        <label>Länge (m)<input name="length" type="text" inputmode="decimal" placeholder="optional"></label>
        <label>Breite (m)<input name="beam" type="text" inputmode="decimal" placeholder="optional"></label>
        <label>Gewicht (kg)<input name="weight" type="text" inputmode="decimal" placeholder="optional"></label>
      </div>
      <div class="bf-act"><button type="button" class="bf-cur" data-cur>aktuelles übernehmen</button><span class="bf-sp"></span><button type="button" class="bf-cancel" data-cancel>abbrechen</button><button type="submit" class="bf-save">speichern</button></div>
    </form>
    <div class="tcx-types" id="tcxTypes"></div>
    <div class="stage" id="tcxStage">
      <canvas id="tcxSea"></canvas>
      <div class="vig"></div>
      <div class="hud hud-status" id="tcxStatus"><span class="dot"></span><span class="st">—</span></div>
      <div class="hud hud-left"><div class="lab">Tiefgang</div><div class="val" id="tcxDraft">1,00<span class="u"> m</span></div></div>
      <div class="hud hud-right"><div class="lab">Fahrrinnentiefe</div><div class="val" id="tcxBed">1,29<span class="u"> m</span></div></div>
      <div class="verdict" id="tcxVerdict"><div class="big">—</div><div class="sub" id="tcxSub"></div></div>
      <div class="dialwrap">
        <div class="dialrow">
        <button class="pr-btn pr-btn-dial" id="tcxMinus" type="button" aria-label="Tiefgang 5 cm verringern">−</button>
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
        <button class="pr-btn pr-btn-dial" id="tcxPlus" type="button" aria-label="Tiefgang 5 cm erhöhen">＋</button>
        </div>
        <div class="hint">−/＋ in 5-cm-Schritten · drehen · ziehen · ◀▶ · Mausrad</div>
      </div>
      <div class="tcx-src" id="tcxSrc">Quelle: ELWIS · lädt…</div>
    </div>
    <div class="tcx-precision">
      <div class="pr-field"><input id="tcxDraftInput" type="text" inputmode="decimal" aria-label="Tiefgang in Meter" value="1,00"><span class="pr-u">m</span></div>
      <span class="pr-hint">Tiefgang exakt eintippen · oder −/＋ am Dial oben (5-cm-Schritte)</span>
    </div>
    </div><!-- /tcxAdjust -->
    <div class="tcx-warn" id="tcxWarn"></div>
    <div class="tcx-profile" id="tcxProfile">
      <div class="pf-head">🧭 Fahrrinnen-Profil <small id="pfScope"></small></div>
      <div class="pf-track" id="pfTrack">
        <div class="pf-bars" id="pfScroll"></div>
        <div class="pf-line rec" id="pfLineRec"><span>empf. Reserve</span></div>
        <div class="pf-line draft" id="pfLineDraft"><span>Tiefgang</span></div>
      </div>
      <div class="pf-info" id="pfInfo">Balken antippen für Abschnitts-Details.</div>
    </div>
    <div class="tcx-ctrl">
      <div class="seg" id="tcxReserve"><span class="seg-lab">Reserve</span>
        <button data-r="kons">konservativ</button><button data-r="norm" class="on">normal</button><button data-r="sport">sportlich</button></div>
      <div class="seg" id="tcxProfile2"><span class="seg-lab">Profil</span>
        <button data-p="none" class="on">Standard</button><button data-p="fam">👨‍👩‍👧 Familie</button><button data-p="anf">🔰 Anfänger</button><button data-p="charter">🚤 Charter</button></div>
      <select class="tcx-sec" id="tcxSection" aria-label="Gewässerabschnitt"><option value="auto">📍 Typisch (Median, alle gemeldet)</option></select>
      <button class="tcx-route" id="tcxToRoute" type="button">🧭 Tiefgang für Route übernehmen</button>
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

/* ── Daten / Kontext setzen (LIVE ELWIS + Wetter + Sperrungen) ── */
export function setTiefeFT(doc:any){ ft = doc; recompute(); }
export function setTiefeContext(c:TiefeCtx){ if(c){ if('weather' in c) ctxWeather=c.weather; if('notices' in c) ctxNotices=c.notices||null; } renderReadout(); }

/* ── Pegel-Trend (Pegelonline) → fließt zielgenau in den Captain-Score ── */
function targetGroup():string|null{
  if(sectionKey!=='auto' && groups[sectionKey]) return sectionKey;
  let best:string|null=null, bestMin=Infinity;
  for(const g of Object.keys(groups)){ const rc=reportedCm(groups[g]); if(!rc.length) continue; const mn=Math.min(...rc); if(mn<bestMin){ bestMin=mn; best=g; } }
  return best;
}
function matchPegel(){
  pegelTrend=null;
  const g = targetGroup();
  if(!ctxPegel || !ctxPegel.length || !g){ renderScore(); return; }
  const GEN = new Set(['wasserstrasse','wasserstr','kanal','verbindungskanal','querfahrt','obere','untere','mittlere','sonstige']);
  const toks = (s:string)=>{ const set=new Set<string>(); for(const t of String(s||'').toLowerCase().replace(/ß/g,'ss').split(/[^a-zäöü]+/)) if(t.length>=4 && !GEN.has(t)) set.add(t); return set; };
  const gt = toks(g); let gauge:any=null;
  for(const s of ctxPegel){ const wt=toks(s.water?.shortname||''); let hit=false; for(const tk of wt) if(gt.has(tk)){ hit=true; break; } if(hit){ gauge=s; break; } }
  if(!gauge){ renderScore(); return; }
  if(gauge.uuid in trendCache){ pegelTrend=trendCache[gauge.uuid]; renderScore(); return; }
  fetchTrend(gauge.uuid).then(tr=>{ const val= tr? {dir:tr.dir,delta:tr.delta,strong:tr.strong,station:String(gauge.shortname||gauge.water?.shortname||g)} : null; trendCache[gauge.uuid]=val; pegelTrend=val; renderScore(); }).catch(()=>{ trendCache[gauge.uuid]=null; });
}
export function setTiefePegel(gauges:any[]){ ctxPegel = (gauges&&gauges.length)?gauges:null; matchPegel(); }

function reportedCm(items:FTItem[]){ return items.filter(i=>i.cm!=null).map(i=>i.cm as number); }
function median(arr:number[]){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }
/* Alter des F/T-Snapshots in Tagen (Ehrlichkeit über Aktualität — kein 9 Tage alter „Live"-Schwindel) */
function ftAgeDays(stand:string):number|null{ const m=/(\d{2})\.(\d{2})\.(\d{4})/.exec(stand||''); if(!m) return null; const d=new Date(+m[3],+m[2]-1,+m[1]); if(isNaN(d.getTime())) return null; return Math.floor((Date.now()-d.getTime())/86400000); }
function scopeItems():FTItem[]{ return (sectionKey!=='auto' && groups[sectionKey]) ? groups[sectionKey] : (ft?.items || []); }
function scopeLabel():string{ return (sectionKey!=='auto' && groups[sectionKey]) ? sectionKey : 'allen gemeldeten Revieren'; }
function minSection(items:FTItem[]):FTItem|null{ let best:FTItem|null=null; for(const i of items){ if(i.cm==null) continue; if(!best||(i.cm as number)<(best.cm as number)) best=i; } return best; }

function computeWind():{lvl:0|1|2;text:string}|null{
  const w = ctxWeather || (window as any).__wlw;
  if(!w) return null;
  try{ const a = windAdvice(currentMode().id, w); return { lvl:a.lvl, text:a.text }; }catch{ return null; }
}
function matchClosures(items:FTItem[]):{count:number;severe:boolean;first?:string}|null{
  if(!ctxNotices || !ctxNotices.length) return null;
  const names = new Set<string>();
  const src = (sectionKey!=='auto' && groups[sectionKey])
    ? [{ group:sectionKey, abk:groups[sectionKey][0]?.abk }]
    : Object.keys(groups).map(g=>({ group:g, abk:groups[g][0]?.abk }));
  for(const s of src){ if(s.group) names.add(normW(s.group)); }
  let count=0, severe=false, first='';
  for(const n of ctxNotices){
    try{ if(!activeToday(n)) continue; }catch{ /* */ }
    const w = normW(n.waterway||'');
    if(w.length<4) continue;
    let hit=false;
    for(const nm of names){ if(nm.length>=4 && (w.includes(nm)||nm.includes(w))){ hit=true; break; } }
    if(hit){ count++; if(n.type==='red') severe=true; if(!first) first=((n.waterway||'')+(n.reason?' — '+n.reason:'')).slice(0,80); }
  }
  return count? { count, severe, first } : null;
}

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
    renderReadout();
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
    const rcA = reportedCm(items);
    bedDepth = (rcA.length? Math.min(...rcA):0)/100 || 1.29;   // M44: engste Stelle = synchron mit Cockpit-Verdikt
    bedLabel = 'engste Fahrrinnentiefe (Gesamtnetz)';
  } else {
    const rc = reportedCm(groups[sectionKey]);
    bedDepth = (rc.length? Math.min(...rc):0)/100 || 1.29;
    bedLabel = 'min. Fahrrinnentiefe '+sectionKey;
  }
  const stand = ft.stand || ft.updated_de || '';
  const ageD = ftAgeDays(stand);
  const stale = ageD != null && ageD >= 2;
  if (badge){
    if (stale){ badge.textContent = `● Stand vor ${ageD} Tg`; badge.style.color = '#ffd98a'; }
    else { badge.textContent = '● Live · ELWIS'; badge.style.color = '#9ff0d2'; }
  }
  if (src) src.textContent = `Quelle: ELWIS · ${bedLabel} · Stand ${stand||'—'}${stale?` · ⚠️ ${ageD} Tage alt`:''}`;
  if (nEl){ const rep=reportedCm(items).length; nEl.textContent='('+rep+')'; }
  renderReadout();
}

/* ── Gesammeltes Re-Rendern aller HTML-Anzeigen (nicht im rAF-Loop) ── */
function renderReadout(){ renderScore(); renderWarnings(); renderProfile(); renderBars(); updateAdjSum(); renderDial(); }
/* ── Dreh-Regler-SVG aktualisieren (entkoppelt vom alten Canvas-Loop) ── */
function renderDial(){
  const d=draftT;
  const dv=document.getElementById('tcxDialV'); if(dv) dv.textContent=d.toFixed(2).replace('.',',');
  const frac=(d-0.1)/(MAXD-0.1);
  const arc=document.getElementById('tcxArcV'); if(arc) arc.setAttribute('stroke-dasharray',(frac*245)+' 327');
  const ndl=document.getElementById('tcxNeedle'); if(ndl) ndl.setAttribute('transform','rotate('+(-135+frac*270)+' 60 60)');
  const dl=document.getElementById('tcxDial'); if(dl) dl.setAttribute('aria-valuenow',d.toFixed(2));
}
function readoutSoon(){ clearTimeout(roT); roT=setTimeout(renderReadout,140); }

function renderScore(){
  const items=scopeItems();
  const s = captainDepthScore({
    draftCm: Math.round(draftT*100), recCm: recReserveCm(), depthsCm: reportedCm(items),
    scopeLabel: scopeLabel(), wind: computeWind(), closures: matchClosures(items), pegel: pegelTrend,
  });
  (window as any).__wlDepthScore = s;
  const host=document.getElementById('tcxScore'); if(!host) return;
  const num=document.getElementById('scNum'); if(num) num.textContent=String(s.score);
  const arc=document.getElementById('scArc'); if(arc){ const CR=2*Math.PI*50; arc.setAttribute('stroke-dasharray',`${(s.score/100*CR).toFixed(1)} ${CR.toFixed(1)}`); arc.setAttribute('class','sc-arc '+s.cls); }
  const stars=document.getElementById('scStars'); if(stars){ stars.textContent='★'.repeat(s.stars)+'☆'.repeat(5-s.stars); stars.className='sc-stars '+s.cls; }
  const hd=document.getElementById('scHead'); if(hd){ hd.textContent=s.headline; hd.className='sc-hd '+s.cls; }
  const vd=document.getElementById('scVerdict'); if(vd) vd.textContent=s.verdict;
  const dr=document.getElementById('scDrivers'); if(dr) dr.innerHTML=s.drivers.map(d=>`<span class="sc-dv ${lvlCls(d.lvl)}" title="${E(d.note)}">${E(d.label)}</span>`).join('');
}

function renderWarnings(){
  const host=document.getElementById('tcxWarn'); if(!host) return;
  const items=scopeItems(); const dCm=Math.round(draftT*100), rec=recReserveCm();
  const out:string[]=[];
  const ms=minSection(items);
  if(ms && ms.cm!=null){ const clr=(ms.cm as number)-dCm; const nm=E(ms.section||ms.group||'Engste Stelle');
    if(clr<0) out.push(`<div class="wn bad"><span>⛔</span><div><b>${nm}</b> nur ${m2((ms.cm as number)/100)} — ${Math.abs(clr)} cm zu flach für ${m2(draftT)} Tiefgang.</div></div>`);
    else if(clr<rec) out.push(`<div class="wn warn"><span>⚠️</span><div><b>${nm}</b> ${m2((ms.cm as number)/100)} — nur ${clr} cm Reserve (empf. ${rec}). Langsam fahren, Fahrrinnenmitte halten.</div></div>`);
  }
  const cl=matchClosures(items);
  if(cl) out.push(`<div class="wn ${cl.severe?'bad':'warn'}"><span>🚧</span><div><b>ELWIS-Sperrung</b> — ${cl.count} aktive Meldung${cl.count>1?'en':''} auf der Strecke${cl.first?': '+E(cl.first):''}.</div></div>`);
  const wnd=computeWind();
  if(wnd && wnd.lvl>=1) out.push(`<div class="wn ${wnd.lvl>=2?'bad':'warn'}"><span>💨</span><div>${E(wnd.text)}</div></div>`);
  if(!out.length){
    const any=reportedCm(items).length;
    out.push(any
      ? `<div class="wn ok"><span>✅</span><div>Keine kritischen Hinweise für ${m2(draftT)} Tiefgang auf ${E(scopeLabel())}.</div></div>`
      : `<div class="wn warn"><span>📡</span><div>Aktuell keine ELWIS-Tiefen gemeldet — bitte Originalmeldung prüfen.</div></div>`);
  }
  host.innerHTML=out.join('');
}

function profInfo(sec:string, cm:number, dCm:number, rec:number){
  const clr=cm-dCm;
  const verd = clr>=rec? `<b style="color:#24E08B">✅ ${clr} cm Reserve</b>` : clr>=0? `<b style="color:#FFC44D">⚠️ knapp · ${clr} cm Reserve</b>` : `<b style="color:#FF7a85">⛔ ${Math.abs(clr)} cm zu flach</b>`;
  return `<b>${E(sec)}</b> · Fahrrinnentiefe ${m2(cm/100)} · bei ${m2(draftT)} Tiefgang: ${verd} <span style="color:#7fa0b4">(empf. ${rec} cm)</span>`;
}
function renderProfile(){
  const hostP=document.getElementById('tcxProfile'); if(!hostP) return;
  const dCm=Math.round(draftT*100), rec=recReserveCm();
  const single = sectionKey!=='auto' && !!groups[sectionKey];
  const order = single? [sectionKey] : Object.keys(groups);
  const segs:{group:string;sec:string;cm:number}[]=[];
  const grp:{name:string;minCm:number;avgCm:number;count:number;worst:'ok'|'tight'|'bad'}[]=[];
  for(const g of order){
    const its=(groups[g]||[]).filter(i=>i.cm!=null); if(!its.length) continue;
    const cms=its.map(i=>i.cm as number);
    for(const i of its) segs.push({group:g, sec:String(i.section||g), cm:i.cm as number});
    const minCm=Math.min(...cms), avgCm=Math.round(cms.reduce((a,b)=>a+b,0)/cms.length);
    const wclr=minCm-dCm;
    grp.push({name:g, minCm, avgCm, count:its.length, worst: wclr>=rec?'ok':wclr>=0?'tight':'bad'});
  }
  renderProfileCockpit({ host:hostP, segs, groups:grp, draftCm:dCm, reserveCm:rec, sectionKey, pegel: (pegelTrend as any) });
}

function renderBars(){
  const bars = document.getElementById('tcxBars'); if(!bars || !ft || !ft.items) return;
  const dCm = Math.round(draftT*100), recCm = recReserveCm();
  const allRep = reportedCm(ft.items);
  const scale = Math.max(300, dCm, ...(allRep.length?allRep:[300]));
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

/* ── Canvas-Render (unveränderte, bewährte Engine) ── */
function resize(){ if(!cv) return; const r=cv.getBoundingClientRect(); W=r.width; H=r.height; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }

function drawBoat(id:string, keelPx:number, w:number){
  ctx.fillStyle='#16252f'; ctx.strokeStyle='#0a151c'; ctx.lineWidth=2;
  const kp=Math.max(7,keelPx);
  ctx.beginPath();
  if (id==='kajak'){ ctx.moveTo(-w/2,-3); ctx.quadraticCurveTo(0,-9,w/2,-3); ctx.quadraticCurveTo(0,kp,-w/2,-3); ctx.fill();
    ctx.strokeStyle='#cfd8de'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(-14,-16); ctx.lineTo(14,-2); ctx.stroke(); }
  else if (id==='haus'){ ctx.moveTo(-w/2,0); ctx.lineTo(w/2,0); ctx.lineTo(w/2-6,kp*.6); ctx.lineTo(-w/2+6,kp*.6); ctx.closePath(); ctx.fill();
    ctx.fillRect(-w/2+10,-30,w-20,30); ctx.fillStyle='#9fb6c6'; ctx.fillRect(-w/2+18,-24,w-36,14); ctx.fillStyle='#16252f'; }
  else if (id==='segel'){ ctx.moveTo(-w/2,-9); ctx.quadraticCurveTo(0,-15,w/2,-9); ctx.lineTo(w/2-14,2); ctx.lineTo(-w/2+14,2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-4,0,8,kp); ctx.beginPath(); ctx.moveTo(-4,kp); ctx.lineTo(-15,kp-5); ctx.lineTo(4,kp-24); ctx.fill();
    ctx.fillRect(-2,-86,3,77); ctx.fillStyle=hex(C.turq,.5); ctx.beginPath(); ctx.moveTo(1,-84); ctx.lineTo(1,-14); ctx.lineTo(40,-20); ctx.fill(); ctx.fillStyle='#16252f'; }
  else if (id==='sport'){ ctx.moveTo(-w/2,-9); ctx.quadraticCurveTo(0,-13,w/2,-6); ctx.lineTo(w/2-12,2); ctx.quadraticCurveTo(0,kp,-w/2+8,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#bcd7e6'; ctx.beginPath(); ctx.moveTo(-w/6,-9); ctx.lineTo(w/8,-9); ctx.lineTo(w/10,-20); ctx.lineTo(-w/8,-20); ctx.closePath(); ctx.fill(); ctx.fillStyle='#16252f'; }
  else if (id==='angel'){ ctx.moveTo(-w/2,-8); ctx.quadraticCurveTo(0,-12,w/2,-8); ctx.lineTo(w/2-9,2); ctx.quadraticCurveTo(0,kp,-w/2+9,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3a4a55'; ctx.fillRect(-8,-22,16,14); ctx.fillStyle='#16252f';
    ctx.strokeStyle='#c8a24a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(w/2-14,-10); ctx.quadraticCurveTo(w/2+28,-30,w/2+44,-46); ctx.stroke(); ctx.strokeStyle='#0a151c'; }
  else if (id==='yacht'){ ctx.moveTo(-w/2,-14); ctx.quadraticCurveTo(0,-19,w/2,-12); ctx.lineTo(w/2-10,2); ctx.quadraticCurveTo(0,kp,-w/2+10,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#dfe7ec'; ctx.fillRect(-w/3,-32,w*.62,18); ctx.fillRect(-w/5,-46,w*.4,16); ctx.fillStyle='#16252f'; ctx.fillRect(-w/5+5,-44,w*.4-10,11); }
  else {
    ctx.moveTo(-w/2,-12); ctx.quadraticCurveTo(0,-17,w/2,-12); ctx.lineTo(w/2-10,1); ctx.quadraticCurveTo(0,kp,-w/2+10,1); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfd8de'; ctx.fillRect(-w/4,-30,w/2,18); ctx.fillStyle='#16252f'; ctx.fillRect(-10,-43,20,13); }
  ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,kp); ctx.stroke(); ctx.setLineDash([]);
}

function frame(){
  if(!cv||!ctx) return;
  t += 0.016; draft += (draftT-draft)*0.12;
  const bedTarget=(simPreviewCm!=null?simPreviewCm/100:bedDepth); bedShown += (bedTarget-bedShown)*0.16; const bedM=clampN(bedShown,0.05,MAXD);  // M44: synchrone, weiche Tiefen-Animation
  const waterY=H*0.15, pxM=(H-waterY-22)/MAXD;
  const keelY=waterY+draft*pxM, bedY=waterY+Math.min(bedM,MAXD)*pxM;
  const recCm=recReserveCm(), clrCm=Math.round((bedM-draft)*100);
  const recY=waterY+Math.max(0,(bedM-recCm/100))*pxM;
  const v=verdictFor(clrCm, recCm);
  ctx.clearRect(0,0,W,H);
  let sky=ctx.createLinearGradient(0,0,0,waterY); sky.addColorStop(0,'#0c2c41'); sky.addColorStop(1,'#16506b'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,waterY);
  let wat=ctx.createLinearGradient(0,waterY,0,H); wat.addColorStop(0,'#3fb9cf'); wat.addColorStop(.2,C.turq); wat.addColorStop(.55,C.deepw); wat.addColorStop(1,C.navy); ctx.fillStyle=wat; ctx.fillRect(0,waterY,W,H-waterY);
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){ const y=waterY+30+i*((H-waterY)/5); ctx.beginPath(); ctx.moveTo(0,y); for(let x=0;x<=W;x+=24) ctx.lineTo(x,y+Math.sin(x*0.02+t*1.4+i)*6);
    ctx.strokeStyle=hex('#bdf3ff',0.05+0.03*Math.sin(t+i)); ctx.lineWidth=10+i*4; ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let i=0;i<W;i+=10){ const a=0.10*Math.max(0,Math.sin(i*0.05+t*2)); ctx.fillStyle=hex('#eafcff',a); ctx.fillRect(i,waterY+Math.sin(i*0.06+t)*2,5,2); }
  ctx.restore();
  if (clrCm>=0){ ctx.strokeStyle=hex(C.gold,.45); ctx.setLineDash([6,6]); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(0,recY); ctx.lineTo(W,recY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=hex(C.gold,.75); ctx.font='600 10px system-ui'; ctx.fillText('empf. Reserve '+recCm+' cm', 12, recY-5); }
  ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,bedY);
  for(let x=0;x<=W;x+=20) ctx.lineTo(x,bedY+Math.sin(x*0.018+t*0.3)*5+Math.sin(x*0.05)*3);
  ctx.lineTo(W,H); ctx.closePath();
  let bg=ctx.createLinearGradient(0,bedY-10,0,H); bg.addColorStop(0,'#8a6f49'); bg.addColorStop(.3,C.sand); bg.addColorStop(1,'#5b4126'); ctx.fillStyle=bg; ctx.fill();
  ctx.strokeStyle=hex('#2e6b4a',.6); ctx.lineWidth=2;
  for(let x=34;x<W;x+=72){ const by=bedY+Math.sin(x*0.018+t*0.3)*5; ctx.beginPath(); ctx.moveTo(x,by); ctx.quadraticCurveTo(x+Math.sin(t*1.3+x)*6,by-16,x+Math.sin(t+x)*3,by-26); ctx.stroke(); }
  const cx=W/2;
  if (clrCm>=0){ ctx.save(); ctx.globalCompositeOperation='screen'; const g=ctx.createLinearGradient(0,keelY,0,bedY); g.addColorStop(0,hex(v.c,0)); g.addColorStop(.5,hex(v.c,.26+.12*Math.sin(t*3))); g.addColorStop(1,hex(v.c,0)); ctx.fillStyle=g; ctx.fillRect(cx-150,keelY,300,Math.max(2,bedY-keelY)); ctx.restore(); }
  else { ctx.save(); ctx.globalCompositeOperation='screen'; ctx.fillStyle=hex(C.dang,.3+.15*Math.sin(t*5)); ctx.fillRect(cx-150,bedY-4,300,(keelY-bedY)+8); ctx.restore(); }
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(const b of bubbles){ b.y-=b.sp*0.004; if(b.y<0){ b.y=1; b.x=Math.random(); } const bx=cx-120+b.x*240, by=keelY+(1-b.y)*Math.max(10,bedY-keelY); ctx.beginPath(); ctx.arc(bx,by,b.s,0,7); ctx.fillStyle=hex('#cdeefc',.4); ctx.fill(); }
  ctx.restore();
  const bob=Math.sin(t*1.1)*4, tilt=Math.sin(t*0.9)*0.02;
  ctx.save(); ctx.translate(cx,waterY+bob); ctx.rotate(tilt); drawBoat(BOATS[typeIdx].id, draft*pxM, BOATS[typeIdx].w); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0,waterY); for(let x=0;x<=W;x+=16) ctx.lineTo(x,waterY+Math.sin(x*0.03+t*1.6)*3); ctx.strokeStyle=hex('#cdf3ff',.55); ctx.lineWidth=2; ctx.stroke();
  if (clrCm>=0){ ctx.strokeStyle=hex(v.c,.9); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx+95,keelY); ctx.lineTo(cx+95,bedY); ctx.moveTo(cx+90,keelY); ctx.lineTo(cx+100,keelY); ctx.moveTo(cx+90,bedY); ctx.lineTo(cx+100,bedY); ctx.stroke();
    ctx.fillStyle=v.c; ctx.font='700 13px system-ui'; ctx.fillText('≈ '+clrCm+' cm', cx+106, (keelY+bedY)/2+4); }
  const dEl=document.getElementById('tcxDraft'); if(dEl) dEl.innerHTML=draft.toFixed(2).replace('.',',')+'<span class="u"> m</span>';
  const bEl=document.getElementById('tcxBed'); if(bEl) bEl.innerHTML=bedM.toFixed(2).replace('.',',')+'<span class="u"> m</span>';
  const stt=document.getElementById('tcxStatus'); if(stt){ const dot=stt.querySelector('.dot') as HTMLElement, st=stt.querySelector('.st') as HTMLElement; dot.style.color=v.c; dot.style.background=v.c; st.textContent=v.t.replace(/[✅⚠❌]\s?/,''); st.style.color=v.c; }
  const vd=document.getElementById('tcxVerdict'); if(vd){ const big=vd.querySelector('.big') as HTMLElement; big.textContent=v.t; big.style.color=v.c; }
  const sub=document.getElementById('tcxSub'); if(sub) sub.textContent = clrCm>=0 ? (`Kielreserve ${clrCm} cm · empfohlen ≥ ${recCm} cm · ${v.tip}`) : (`${Math.abs(clrCm)} cm zu tief · ${v.tip}`);
  const dv=document.getElementById('tcxDialV'); if(dv) dv.textContent=draft.toFixed(2).replace('.',',');
  const inp=document.getElementById('tcxDraftInput') as HTMLInputElement|null; if(inp && document.activeElement!==inp) inp.value=draftT.toFixed(2).replace('.',',');
  const frac=(draft-0.1)/(MAXD-0.1); const arc=document.getElementById('tcxArcV'); const ndl=document.getElementById('tcxNeedle'); const dl=document.getElementById('tcxDial');
  if(arc) arc.setAttribute('stroke-dasharray',(frac*245)+' 327'); if(ndl) ndl.setAttribute('transform','rotate('+(-135+frac*270)+' 60 60)'); if(dl) dl.setAttribute('aria-valuenow',draft.toFixed(2));
}

function loop(){ frame(); rafId=requestAnimationFrame(loop); }
function start(){ if(running||reduceMotion()) { if(reduceMotion()) frame(); return; } running=true; loop(); }
function stop(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }

/* ── Tiefgang zentral setzen ── */
function setDraft(v:number, persist=true){ draftT=+clampN(v,0.1,MAXD).toFixed(2); if(persist) saveDraft(); renderReadout(); if(reduceMotion()) frame(); }
function saveDraft(){ try{ localStorage.setItem('wl_draft', draftT.toFixed(2)); }catch{ /* */ } (window as any).__wlDraft = draftT; }

/* ── Steuerung: Dreh-Regler ── */
function wireDial(){
  const dial=document.getElementById('tcxDial'); if(!dial) return;
  const setFromAngle=(cx:number,cy:number,px:number,py:number)=>{ let a=Math.atan2(py-cy,px-cx)*180/Math.PI; a=(a+90+360)%360; if(a>270) a=(a<315)?270:0; const frac=Math.min(1,Math.max(0,a/270)); draftT=+(0.1+frac*(MAXD-0.1)).toFixed(2); saveDraft(); syncInput(); };
  let drag=false;
  dial.addEventListener('pointerdown',(e:any)=>{ drag=true; dial.setPointerCapture(e.pointerId); const r=dial.getBoundingClientRect(); setFromAngle(r.left+r.width/2,r.top+r.height/2,e.clientX,e.clientY); readoutSoon(); });
  dial.addEventListener('pointermove',(e:any)=>{ if(!drag) return; const r=dial.getBoundingClientRect(); setFromAngle(r.left+r.width/2,r.top+r.height/2,e.clientX,e.clientY); readoutSoon(); });
  addEventListener('pointerup',()=>{ if(drag){ drag=false; renderReadout(); } });
  dial.addEventListener('wheel',(e:any)=>{ e.preventDefault(); draftT=+clampN(draftT+(e.deltaY>0?-0.05:0.05),0.1,MAXD).toFixed(2); saveDraft(); syncInput(); readoutSoon(); },{passive:false});
  dial.addEventListener('keydown',(e:any)=>{ if(e.key==='ArrowRight'||e.key==='ArrowUp'){ setDraft(draftT+0.05); e.preventDefault(); } else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){ setDraft(draftT-0.05); e.preventDefault(); } });
}
function syncInput(){ const inp=document.getElementById('tcxDraftInput') as HTMLInputElement|null; if(inp && document.activeElement!==inp) inp.value=draftT.toFixed(2).replace('.',','); renderDial(); }

/* ── Steuerung: Präzisionseingabe (−/＋/Zahl) ── */
function wirePrecision(){
  const inp=document.getElementById('tcxDraftInput') as HTMLInputElement|null;
  const minus=document.getElementById('tcxMinus'); const plus=document.getElementById('tcxPlus');
  inp?.addEventListener('input',()=>{ const v=parseNum(inp.value); if(v!=null) setDraft(v); });
  inp?.addEventListener('blur',()=>{ const v=parseNum(inp!.value); setDraft(v!=null?v:draftT); });
  inp?.addEventListener('keydown',(e:any)=>{ if(e.key==='Enter'){ (inp as HTMLInputElement).blur(); } });
  const hold=(dir:number)=>{ let iv:any=0, to:any=0; const step=()=>{ draftT=+clampN(draftT+dir*0.05,0.1,MAXD).toFixed(2); saveDraft(); syncInput(); if(reduceMotion()) frame(); readoutSoon(); };
    const down=(e:any)=>{ e.preventDefault(); step(); to=setTimeout(()=>{ iv=setInterval(step,90); },360); };
    const up=()=>{ clearTimeout(to); clearInterval(iv); renderReadout(); };
    return { down, up };
  };
  if(minus){ const h=hold(-1); minus.addEventListener('pointerdown',h.down); ['pointerup','pointerleave','pointercancel'].forEach(ev=>minus.addEventListener(ev,h.up)); }
  if(plus){ const h=hold(1); plus.addEventListener('pointerdown',h.down); ['pointerup','pointerleave','pointercancel'].forEach(ev=>plus.addEventListener(ev,h.up)); }
}

/* ── Steuerung: Boot-Garage ── */
function markType(){ const types=document.getElementById('tcxTypes'); types?.querySelectorAll('.tc-type').forEach(x=>x.classList.toggle('on',+(x as HTMLElement).dataset.i! === typeIdx)); }
function applyBoatType(typeId:string){ const i=BOATS.findIndex(b=>b.id===typeId); if(i>=0){ typeIdx=i; markType(); } }
function renderGarage(){
  const host=document.getElementById('tcxGarage'); if(!host) return;
  const chips=boats.map(b=>`<button class="tc-boat" type="button" data-id="${E(b.id)}"><span class="ic">${BOATS.find(x=>x.id===b.type)?.ic||'🚤'}</span><span class="nm">${E(b.name)}</span><span class="dr">${m2(b.draft)}</span><span class="x" data-del="${E(b.id)}" title="löschen" role="button" aria-label="löschen">×</span></button>`).join('');
  host.innerHTML=`<span class="gar-lab">⚓ Meine Boote</span>${chips}<button class="tc-boat add" id="tcxBoatAdd" type="button">＋ Boot speichern</button>`;
}
function toggleBoatForm(show:boolean){ const f=document.getElementById('tcxBoatForm') as HTMLFormElement|null; if(!f) return; f.hidden=!show; const bd=document.getElementById('tcxSheetBd'); if(bd) bd.hidden=!show; if(show){ (f.querySelector('[name=type]') as HTMLSelectElement).value=BOATS[typeIdx].id; (f.querySelector('[name=draft]') as HTMLInputElement).value=draftT.toFixed(2).replace('.',','); (f.querySelector('[name=name]') as HTMLInputElement).focus(); } }
function wireGarage(){
  const host=document.getElementById('tcxGarage');
  host?.addEventListener('click',e=>{
    const t=e.target as HTMLElement;
    const del=t.closest('[data-del]') as HTMLElement|null;
    if(del){ e.stopPropagation(); boats=boats.filter(b=>b.id!==del.dataset.del); persistBoats(); renderGarage(); return; }
    if(t.closest('#tcxBoatAdd')){ toggleBoatForm(true); return; }
    const chip=t.closest('.tc-boat[data-id]') as HTMLElement|null;
    if(chip){ const b=boats.find(x=>x.id===chip.dataset.id); if(b){ applyBoatType(b.type); setDraft(b.draft); } }
  });
  const form=document.getElementById('tcxBoatForm') as HTMLFormElement|null;
  form?.addEventListener('submit',e=>{
    e.preventDefault();
    const get=(n:string)=>(form.querySelector(`[name=${n}]`) as HTMLInputElement|HTMLSelectElement)?.value || '';
    const name=get('name').trim(); const type=get('type'); const dr=parseNum(get('draft'));
    if(!name || dr==null){ return; }
    const b:SavedBoat={ id:'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name, type, draft:+clampN(dr,0.05,MAXD).toFixed(2),
      length:parseNum(get('length')), beam:parseNum(get('beam')), weight:parseNum(get('weight')) };
    boats.push(b); persistBoats(); renderGarage(); toggleBoatForm(false); applyBoatType(type); setDraft(b.draft);
    form.reset();
  });
  form?.querySelector('[data-cancel]')?.addEventListener('click',()=>{ toggleBoatForm(false); });
  document.getElementById('tcxSheetBd')?.addEventListener('click',()=>{ toggleBoatForm(false); });
  form?.querySelector('[data-cur]')?.addEventListener('click',()=>{ (form.querySelector('[name=type]') as HTMLSelectElement).value=BOATS[typeIdx].id; (form.querySelector('[name=draft]') as HTMLInputElement).value=draftT.toFixed(2).replace('.',','); });
}

/* ── Steuerung: Typen / Reserve / Profil / Abschnitt / Profil-Klick / Route ── */
function wireControls(){
  const types=document.getElementById('tcxTypes');
  if(types){ types.innerHTML=BOATS.map((b,i)=>`<button class="tc-type${i===typeIdx?' on':''}" data-i="${i}"><span class="ic">${b.ic}</span>${E(b.n)}</button>`).join('');
    types.addEventListener('click',e=>{ const t=(e.target as HTMLElement).closest('.tc-type') as HTMLElement|null; if(!t)return; typeIdx=+t.dataset.i!; markType(); setDraft(BOATS[typeIdx].draft); }); }
  const res=document.getElementById('tcxReserve');
  res?.addEventListener('click',e=>{ const b=(e.target as HTMLElement).closest('button[data-r]') as HTMLElement|null; if(!b)return; reserveMode=b.dataset.r!; res.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); renderReadout(); if(reduceMotion()) frame(); });
  const prof=document.getElementById('tcxProfile2');
  prof?.addEventListener('click',e=>{ const b=(e.target as HTMLElement).closest('button[data-p]') as HTMLElement|null; if(!b)return; profile=b.dataset.p!; prof.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    if(PROF[profile].cons){ reserveMode='kons'; const r=document.getElementById('tcxReserve'); r?.querySelectorAll('button').forEach(x=>x.classList.toggle('on',(x as HTMLElement).dataset.r==='kons')); }
    renderReadout(); if(reduceMotion()) frame(); });
  const sel=document.getElementById('tcxSection') as HTMLSelectElement|null;
  sel?.addEventListener('change',()=>{ sectionKey=sel.value; matchPegel(); const info=document.getElementById('pfInfo') as HTMLElement|null; if(info) delete info.dataset.touched; recompute(); if(reduceMotion()) frame(); });
  const scroll=document.getElementById('pfScroll');
  scroll?.addEventListener('click',e=>{ const seg=(e.target as HTMLElement).closest('.pf-seg') as HTMLElement|null; if(!seg)return;
    scroll.querySelectorAll('.pf-seg').forEach(x=>x.classList.remove('sel')); seg.classList.add('sel');
    const info=document.getElementById('pfInfo') as HTMLElement|null; if(info){ info.dataset.touched='1'; info.innerHTML=profInfo(seg.dataset.sec||'', +seg.dataset.cm!, Math.round(draftT*100), recReserveCm()); } });
  const rt=document.getElementById('tcxToRoute');
  rt?.addEventListener('click',()=>{ saveDraft(); try{ window.dispatchEvent(new CustomEvent('wl3-draft',{detail:draftT})); }catch{ /* */ }
    const target=document.getElementById('ziel')||document.getElementById('route')||document.getElementById('karte');
    if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    const old=rt.textContent; rt.textContent=`✓ ${m2(draftT)} übernommen`; setTimeout(()=>{ rt.textContent=old||''; },2200);
  });
}

/* ── M40: Boot & Tiefgang einklappbar (Handy: standardmäßig zu, Desktop: offen) ── */
function updateAdjSum(){ const el=document.getElementById('tcxAdjSum'); if(el) el.textContent=`${BOATS[typeIdx].ic} ${BOATS[typeIdx].n} · Tiefgang ${m2(draftT)}`; }
function setAdjustOpen(open:boolean, persist=false){
  const panel=document.getElementById('tcxAdjust'); const btn=document.getElementById('tcxAdjBtn');
  if(!panel||!btn) return;
  panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', open?'true':'false');
  if(persist){ try{ localStorage.setItem('wl_tcx_open', open?'1':'0'); }catch{ /* */ } }
  if(open){ requestAnimationFrame(()=>{ try{ resize(); frame(); }catch{ /* */ } }); }
}
function wireAdjust(){
  const btn=document.getElementById('tcxAdjBtn'); if(!btn) return;
  let open = true;   // M44: Tiefgang-Simulator standardmäßig sichtbar
  try{ const s=localStorage.getItem('wl_tcx_open'); if(s!=null) open = s==='1'; }catch{ /* */ }
  setAdjustOpen(open);
  btn.addEventListener('click',()=>{ const p=document.getElementById('tcxAdjust'); setAdjustOpen(!p?.classList.contains('open'), true); });
  updateAdjSum();
}

export function initTiefeSim(doc:any, ctx2?:TiefeCtx){
  const sect=document.getElementById('tiefe-sect'); if(!sect) return;
  if(!document.getElementById('tcx-css')){ const st=document.createElement('style'); st.id='tcx-css'; st.textContent=CSS+CSS_X+CSS_M40; document.head.appendChild(st); }
  if(ctx2){ ctxWeather=ctx2.weather??null; ctxNotices=ctx2.notices??null; }
  loadBoats();
  buildDOM(sect);
  try{ const s=localStorage.getItem('wl_draft'); if(s && +s>=0.1 && +s<=MAXD){ draftT=+s; draft=+s; } else { draftT=BOATS[typeIdx].draft; draft=draftT; } }catch{ draftT=BOATS[typeIdx].draft; draft=draftT; }
  (window as any).__wlDraft = draftT;
  (window as any).__wlSetDraft = (m:number)=>{ try{ setDraft(+m); }catch{ /* */ } };
  cv=document.getElementById('tcxSea'); if(cv){ ctx=cv.getContext('2d'); DPR=Math.min(devicePixelRatio||1,2); bubbles.length=0; for(let i=0;i<14;i++) bubbles.push({x:Math.random(),y:Math.random(),s:1+Math.random()*2,sp:.15+Math.random()*.3}); resize(); }
  bedShown = bedDepth;
  (window as any).__wlSimBed = (cm:number|null)=>{ simPreviewCm = (cm!=null && isFinite(+cm)) ? +cm : null; if(reduceMotion()) frame(); };
  renderGarage(); wireDial(); wirePrecision(); wireGarage(); wireControls(); wireAdjust();
  if(cv && 'ResizeObserver' in window){ new ResizeObserver(()=>{ resize(); if(reduceMotion()) frame(); }).observe(cv); }
  ft=doc; recompute(); renderDial();
  const stage=document.getElementById('tcxStage'); let onScreen=false;
  const upd=()=>{ if(onScreen && !document.hidden){ if(!running){ try{ bedShown=(simPreviewCm!=null?simPreviewCm/100:bedDepth); }catch{ /* */ } } start(); } else stop(); };
  if(stage && 'IntersectionObserver' in window){ new IntersectionObserver(es=>{ onScreen=es[0].isIntersecting; upd(); },{rootMargin:'80px'}).observe(stage); } else { onScreen=true; }
  document.addEventListener('visibilitychange',upd);
  if(cv){ frame(); upd(); }
}
