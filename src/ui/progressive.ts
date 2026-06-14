/* Progressive Disclosure · Wellen-Accordion — eingeklappte Sektionen als gestapelte Wellen
 * (clip-path-Wellenform + Schaumkrone + Tiefen-Gradient), ausgeklappt = saubere Karte.
 * Transluzent → Foto-Hintergrund bleibt dezent sichtbar; dunkler Textbereich = Kontrast/Lesbarkeit.
 * Emil-Motion (Spring-Easing), GPU-only, reduced-motion-safe. Dashboard-Panels + Karte bleiben außen vor. */
const SECS: [string, boolean][] = [
  ['entdecken', false], ['sicherheit', false], ['touren', false],
  ['community', false], ['partner', false], ['academy', false], ['wavebite', false], ['earlyaccess', true]
];
const A={e:"M0,12 C13,8 27,8 40,13 C50,16 58,16 71,12 C83,8 93,9 100,12",r:"M0,19 C16,16 30,16 44,19 C58,22 72,22 100,18"};
const B={e:"M0,11 C11,16 24,16 36,12 C47,8 58,8 70,12 C82,16 92,15 100,11",r:"M0,18 C14,22 28,22 42,18 C56,15 70,15 100,19"};
const DEFS=`<svg id="wl-acc-defs" width="0" height="0" aria-hidden="true"><defs>
<clipPath id="wlwA" clipPathUnits="objectBoundingBox"><path d="M0,0.30 C0.13,0.21 0.27,0.21 0.40,0.31 C0.50,0.38 0.58,0.38 0.71,0.30 C0.83,0.22 0.93,0.24 1,0.30 L1,1 L0,1 Z"/></clipPath>
<clipPath id="wlwB" clipPathUnits="objectBoundingBox"><path d="M0,0.29 C0.11,0.38 0.24,0.38 0.36,0.30 C0.47,0.22 0.58,0.22 0.70,0.31 C0.82,0.38 0.92,0.36 1,0.29 L1,1 L0,1 Z"/></clipPath>
<linearGradient id="wlcg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bcd9dc"/><stop offset=".6" stop-color="#8fbabb"/><stop offset="1" stop-color="#d7bd92"/></linearGradient></defs></svg>`;
const CSS=`
.wl-acc-head{position:relative;cursor:pointer;user-select:none;font:800 clamp(17px,2.4vw,22px)/1.15 var(--font-h,inherit);letter-spacing:-.02em;
  padding:13px 52px 13px 22px!important;margin:10px 0!important;border-radius:16px;
  background:linear-gradient(180deg,rgba(16,52,74,.5),rgba(9,28,46,.6));border:1px solid rgba(217,177,77,.20);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);text-shadow:0 1px 12px rgba(3,14,26,.8);
  transition:transform .5s cubic-bezier(.34,1.3,.5,1),background .3s ease,box-shadow .3s ease;box-shadow:0 8px 22px -14px rgba(0,16,32,.55)}
.wl-acc-head>*{position:relative;z-index:1}
.wl-crest{position:absolute;left:0;right:0;top:7px;height:30px;pointer-events:none;opacity:0;z-index:0;transition:opacity .35s ease;animation:wlDrift 11s ease-in-out infinite alternate}
.wl-pB .wl-crest{animation-direction:alternate-reverse;animation-duration:13s}
.wl-crest .wl-foam{fill:none;stroke:#eafbff;stroke-width:3.5;opacity:.18;filter:blur(2.5px)}
.wl-crest .wl-edge{fill:none;stroke:url(#wlcg);stroke-width:1.2;filter:drop-shadow(0 0 2px rgba(140,200,205,.3))}
.wl-crest .wl-rip{fill:none;stroke:rgba(180,230,240,.32);stroke-width:1}
@keyframes wlDrift{0%{transform:translateX(0)}100%{transform:translateX(-4%)}}
.wl-acc-head:hover{transform:translateY(-2px);box-shadow:0 12px 28px -14px rgba(0,22,44,.7)}
.wl-acc-head:active{transform:translateY(-1px) scale(.998)}
.wl-acc-head:focus-visible{outline:2px solid rgba(63,195,201,.8);outline-offset:3px}
.wl-acc-head::after{content:'';position:absolute;right:18px;top:calc(50% - 6px);width:11px;height:11px;border-right:2.5px solid #6fe0e6;border-bottom:2.5px solid #6fe0e6;transform:rotate(45deg);transition:transform .4s cubic-bezier(.34,1.4,.5,1);opacity:.9;z-index:1}
section.wl-collapsed{margin:0!important;padding:0!important;border:0!important;background:transparent!important}
section.wl-collapsed>.wl-acc-head{-webkit-clip-path:url(#wlwA);clip-path:url(#wlwA);border-radius:0;border:none;
  margin:-8px 0 0!important;padding:30px 52px 15px 22px!important;min-height:66px;
  background:linear-gradient(180deg,rgba(66,160,182,.42) 0%,rgba(20,64,90,.56) 26%,rgba(9,30,48,.74) 62%,rgba(6,22,38,.83) 100%);
  filter:drop-shadow(0 -7px 18px rgba(2,14,26,.42));box-shadow:none}
section.wl-collapsed.wl-pB>.wl-acc-head{-webkit-clip-path:url(#wlwB);clip-path:url(#wlwB);
  background:linear-gradient(180deg,rgba(58,150,176,.4) 0%,rgba(18,60,86,.55) 26%,rgba(8,28,46,.73) 62%,rgba(5,20,36,.83) 100%)}
section.wl-collapsed:first-of-type>.wl-acc-head{margin-top:0!important}
section.wl-collapsed>.wl-acc-head .wl-crest{opacity:.5}
section.wl-collapsed>.wl-acc-head::after{top:auto;bottom:19px}
section.wl-collapsed>:not(.wl-acc-head){display:none!important}
@media (prefers-reduced-motion:reduce){.wl-crest{animation:none!important}.wl-acc-head{transition:none!important}}
`;
export function initProgressive(){
  if(!document.getElementById('wl-acc-defs')) document.body.insertAdjacentHTML('beforeend', DEFS);
  if(!document.getElementById('wl-acc-css')){ const st=document.createElement('style'); st.id='wl-acc-css'; st.textContent=CSS; document.head.appendChild(st); }
  const apply=()=>{ SECS.forEach(([id,open],idx)=>{
    const sec=document.getElementById(id) as HTMLElement|null; if(!sec || sec.dataset.wlAcc) return;
    const h=sec.querySelector('h2'); if(!h) return;
    let head=h as HTMLElement; while(head.parentElement && head.parentElement!==sec) head=head.parentElement;
    if(head.parentElement!==sec) return;
    head.classList.add('wl-acc-head'); head.setAttribute('role','button'); head.tabIndex=0; head.setAttribute('aria-expanded',String(open));
    const w = (idx%2) ? B : A; if(idx%2) sec.classList.add('wl-pB');
    if(!head.querySelector('.wl-crest')){
      head.insertAdjacentHTML('afterbegin','<svg class="wl-crest" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="wl-foam" d="'+w.e+'"/><path class="wl-edge" d="'+w.e+'"/><path class="wl-rip" d="'+w.r+'"/></svg>');
    }
    if(!open) sec.classList.add('wl-collapsed');
    const toggle=()=>{ const c=sec.classList.toggle('wl-collapsed'); head.setAttribute('aria-expanded',String(!c)); };
    head.addEventListener('click',(e:any)=>{ if(e.target&&e.target.closest&&e.target.closest('a,input,select,textarea,button')) return; toggle(); });
    head.addEventListener('keydown',(e:any)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
    sec.dataset.wlAcc='1';
  }); };
  apply(); setTimeout(apply,1500); setTimeout(apply,3500);
}
