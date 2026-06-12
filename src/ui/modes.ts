/* ═══ Zielgruppen-Modi · jeder Modus = Layer-Preset + Fokus ═══ */
export interface Mode { id:string; label:string; kinds:string[] }
export const MODES: Mode[] = [
  { id:'kapitaen',  label:'⚓ Kapitän',     kinds:['gelbe_welle','hafen','schleuse','tank','entsorgung','wsp','notfall'] },
  { id:'hausboot',  label:'🛥️ Hausboot',    kinds:['gelbe_welle','hafen','schleuse','tank','entsorgung','gastro','shop'] },
  { id:'familie',   label:'👨‍👩‍👧 Familie',     kinds:['badestelle','gastro','sight','event','medizin','hafen'] },
  { id:'sup',       label:'🛶 SUP & Kajak', kinds:['badestelle','slip','gastro','sight'] },
  { id:'angler',    label:'🎣 Angler',      kinds:['slip','shop','hafen','badestelle'] },
  { id:'tourist',   label:'📸 Tourist',     kinds:['sight','event','gastro','charter','hafen'] },
  { id:'charter',   label:'⛵ Charter',     kinds:['charter','gelbe_welle','hafen','tank','gastro'] },
  { id:'b2b',       label:'🏢 Marina/B2B',  kinds:['hafen','gelbe_welle','charter','werkstatt','tank','gastro'] },
  { id:'notfall',   label:'🆘 Notfall',     kinds:['wsp','notfall','medizin','hafen','schleuse'] },
];
export function renderModes(el: HTMLElement, onPick: (m: Mode)=>void) {
  el.innerHTML = '';
  MODES.forEach((m,i) => {
    const b = document.createElement('button');
    b.className = 'mode' + (i===0?' on':''); b.textContent = m.label;
    b.onclick = () => { el.querySelectorAll('.mode').forEach(x=>x.classList.remove('on')); b.classList.add('on'); onPick(m); };
    el.appendChild(b);
  });
}
