/* Progressive Disclosure — grosse Einzelsektionen ein-/ausklappbar (edle Wellen-Header).
 * NICHT die 3-Spalten-Dashboard-Panels (Lage/Wetter/Pegel) — die bleiben als Cockpit sichtbar
 * (Einklappen im Grid wuerde leere Spalten strecken). Karte + Ziel ebenfalls unangetastet. */
const SECS: [string, boolean][] = [
  ['tiefe-sect', false], ['entdecken', false], ['sicherheit', false], ['touren', false],
  ['community', false], ['partner', false], ['academy', false], ['wavebite', false], ['earlyaccess', true]
];
const WAVE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 34'%3E%3Cpath d='M0 22 Q27 8 55 18 T110 18 T165 18 T220 18' fill='none' stroke='%233fc3c9' stroke-opacity='0.18' stroke-width='3'/%3E%3C/svg%3E\")";
const CSS = `
.wl-acc-head{cursor:pointer;position:relative;user-select:none;overflow:hidden;
  background-color:rgba(11,34,54,.5);
  background-image:linear-gradient(100deg,rgba(15,44,68,.55),rgba(10,30,49,.32)), ${WAVE};
  background-repeat:no-repeat,no-repeat;background-position:center,right -12px bottom -3px;background-size:cover,250px 32px;
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
  border:1px solid rgba(125,205,232,.20);border-radius:16px;
  padding:15px 56px 15px 22px!important;margin:12px 0!important;
  transition:background-color .25s ease,transform .2s ease,box-shadow .25s ease,border-color .25s ease;
  box-shadow:0 8px 24px -14px rgba(0,16,32,.6)}
.wl-acc-head::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,#3fc3c9,#2a86b0)}
.wl-acc-head:hover{background-color:rgba(16,50,76,.62);transform:translateX(3px);border-color:rgba(125,205,232,.42);box-shadow:0 12px 30px -14px rgba(0,22,44,.78)}
.wl-acc-head::after{content:'';position:absolute;right:20px;top:calc(50% - 7px);width:11px;height:11px;border-right:2.5px solid #6fe0e6;border-bottom:2.5px solid #6fe0e6;transform:rotate(45deg);transition:transform .3s ease;opacity:.85}
section.wl-collapsed>.wl-acc-head::after{transform:rotate(-45deg)}
.wl-acc-head:hover::after{opacity:1}
section:not(.wl-collapsed)>.wl-acc-head{margin-bottom:16px!important}
.wl-acc-head:focus-visible{outline:2px solid rgba(63,195,201,.85);outline-offset:3px}
section.wl-collapsed>:not(.wl-acc-head){display:none!important}
`;
export function initProgressive(){
  if(!document.getElementById('wl-acc-css')){ const st=document.createElement('style'); st.id='wl-acc-css'; st.textContent=CSS; document.head.appendChild(st); }
  const apply=()=>{ SECS.forEach(([id,open])=>{
    const sec=document.getElementById(id) as HTMLElement|null; if(!sec || sec.dataset.wlAcc) return;
    const h=sec.querySelector('h2'); if(!h) return;
    let head=h as HTMLElement; while(head.parentElement && head.parentElement!==sec) head=head.parentElement;
    if(head.parentElement!==sec) return;
    head.classList.add('wl-acc-head'); head.setAttribute('role','button'); head.tabIndex=0; head.setAttribute('aria-expanded',String(open));
    if(!open) sec.classList.add('wl-collapsed');
    const toggle=()=>{ const c=sec.classList.toggle('wl-collapsed'); head.setAttribute('aria-expanded',String(!c)); };
    head.addEventListener('click',(e:any)=>{ if(e.target&&e.target.closest&&e.target.closest('a,input,select,textarea,button')) return; toggle(); });
    head.addEventListener('keydown',(e:any)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
    sec.dataset.wlAcc='1';
  }); };
  apply(); setTimeout(apply,1500); setTimeout(apply,3500);
}
