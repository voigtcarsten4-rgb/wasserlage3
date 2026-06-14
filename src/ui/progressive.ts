/* Progressive Disclosure — sekundaere Sektionen ein-/ausklappbar fuer eine kompakte Seite.
 * Klick/Enter auf die Sektions-Ueberschrift klappt den Inhalt auf/zu. Kern offen, lange/sekundaere zu.
 * Karte + Ziel bleiben unangetastet (kein Map-Resize-Risiko). Idempotent + Retry fuer async-Sektionen. */
const SECS: [string, boolean][] = [
  ['pnlMeldungen', true], ['pnlWetter', false], ['pnlPegel', false], ['tiefe-sect', false],
  ['entdecken', false], ['sicherheit', false], ['touren', false], ['community', false],
  ['partner', false], ['academy', false], ['wavebite', false], ['earlyaccess', true]
];
const CSS = `
.wl-acc-head{cursor:pointer;position:relative;user-select:none;padding-right:34px!important}
.wl-acc-head::after{content:'';position:absolute;right:12px;top:calc(50% - 6px);width:10px;height:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .3s ease;opacity:.5}
section.wl-collapsed>.wl-acc-head::after{transform:rotate(-45deg)}
.wl-acc-head:hover::after{opacity:.95}
.wl-acc-head:focus-visible{outline:2px solid rgba(63,195,201,.75);outline-offset:3px;border-radius:8px}
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
