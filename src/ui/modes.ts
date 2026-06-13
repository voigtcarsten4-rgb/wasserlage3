/* ═══ Zielgruppen-Modi · jeder Modus = Layer-Preset + Fokus ═══ */
export interface Mode { id:string; label:string; kinds:string[] }
export const MODES: Mode[] = [
  { id:'kapitaen',  label:'⚓ Kapitän',     kinds:['gelbe_welle','hafen','anleger','schleuse','tank','entsorgung','wsp','notfall'] },
  { id:'hausboot',  label:'🛥️ Hausboot',    kinds:['gelbe_welle','hafen','anleger','schleuse','tank','entsorgung','gastro','shop'] },
  { id:'familie',   label:'👨‍👩‍👧 Familie',     kinds:['badestelle','gastro','sight','event','medizin','hafen'] },
  { id:'sup',       label:'🛶 SUP & Kajak', kinds:['badestelle','slip','gastro','sight'] },
  { id:'angler',    label:'🎣 Angler',      kinds:['slip','shop','hafen','badestelle'] },
  { id:'tourist',   label:'📸 Tourist',     kinds:['sight','event','gastro','charter','hafen'] },
  { id:'charter',   label:'⛵ Charter',     kinds:['charter','gelbe_welle','hafen','tank','gastro'] },
  { id:'b2b',       label:'🏢 Marina/B2B',  kinds:['hafen','gelbe_welle','charter','werkstatt','tank','gastro'] },
  { id:'notfall',   label:'🆘 Notfall',     kinds:['wsp','notfall','medizin','hafen','schleuse'] },
];
const LS_MODE = 'wl3_mode';
export function currentModeId(): string { try { return localStorage.getItem(LS_MODE) || MODES[0].id; } catch { return MODES[0].id; } }
export function currentMode(): Mode { return MODES.find(m => m.id === currentModeId()) || MODES[0]; }
/* Modus persistieren + global signalisieren — Checklisten/Lilly/Karte hängen sich daran (Zielgruppen-Intelligenz). */
export function applyMode(id: string) {
  try { localStorage.setItem(LS_MODE, id); } catch { /* */ }
  document.documentElement.dataset.mode = id;
  try { window.dispatchEvent(new CustomEvent('wl3-mode', { detail: id })); } catch { /* */ }
}
export function renderModes(el: HTMLElement, onPick: (m: Mode)=>void) {
  el.innerHTML = '';
  const active = currentModeId();
  MODES.forEach((m) => {
    const b = document.createElement('button');
    b.className = 'mode' + (m.id === active ? ' on' : ''); b.textContent = m.label;
    b.onclick = () => { el.querySelectorAll('.mode').forEach(x=>x.classList.remove('on')); b.classList.add('on'); applyMode(m.id); onPick(m); };
    el.appendChild(b);
  });
  document.documentElement.dataset.mode = active;
}
