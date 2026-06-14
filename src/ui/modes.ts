/* ═══ Zielgruppen-Modi · jeder Modus = Layer-Preset + Fokus ═══ */
export interface Mode { id:string; label:string; kinds:string[]; focus:string; reco:string }
export const MODES: Mode[] = [
  { id:'kapitaen',  label:'⚓ Kapitän',     kinds:['gelbe_welle','hafen','anleger','schleuse','tank','entsorgung','wsp','notfall'],
    focus:'ELWIS, Pegel, Tiefen, Schleusen & Wind', reco:'Schneller Daten-Blick: amtliche Lage, Pegel, Tiefen & Schleusen auf deiner Route.' },
  { id:'hausboot',  label:'🛥️ Hausboot',    kinds:['gelbe_welle','hafen','anleger','schleuse','tank','entsorgung','gastro','shop'],
    focus:'Liegeplätze, Schleusen, Versorgung & Restaurants', reco:'Entspannt unterwegs: Liegeplätze, Schleusenzeiten, Strom/Wasser & Versorgung im Blick.' },
  { id:'familie',   label:'👨‍👩‍👧 Familie',     kinds:['badestelle','gastro','sight','event','medizin','hafen'],
    focus:'Badestellen, Restaurants, Highlights & Sicherheit', reco:'Sicher & schön: Badestellen, einfache Stopps und klare Sicherheits-Hinweise.' },
  { id:'sup',       label:'🛶 SUP & Kajak', kinds:['badestelle','slip','gastro','sight'],
    focus:'Ein-/Ausstiege, Wind, Badestellen & Gefahren', reco:'Klein & wendig: Wind, Ein-/Ausstiege & Badestellen — kurze Etappen, ablandiger Wind im Blick.' },
  { id:'angler',    label:'🎣 Angler',      kinds:['slip','shop','hafen','badestelle'],
    focus:'Ruhige Buchten, Wind, Sonnenzeiten & Community', reco:'Ruhig ansitzen: Wind, Sonnenzeiten & ruhige Plätze — Schongebiete beachten.' },
  { id:'tourist',   label:'📸 Tourist',     kinds:['sight','event','gastro','charter','hafen'],
    focus:'Sehenswürdigkeiten, Badestellen & Restaurants', reco:'Entdecken: schöne Orte, Fotospots & Restaurants entlang des Wassers.' },
  { id:'charter',   label:'⛵ Yacht/Charter', kinds:['charter','gelbe_welle','hafen','tank','gastro','schleuse'],
    focus:'Tiefgang, Brückenhöhen, Marinas, Tank & Wind', reco:'Größeres Boot: Tiefgang, Brücken, Schleusenmaße & Marinas beachten.' },
  { id:'b2b',       label:'🏢 Marina/B2B',  kinds:['hafen','gelbe_welle','charter','werkstatt','tank','gastro'],
    focus:'Häfen, Marinas, Charter & Versorgung', reco:'Revier-Überblick: Häfen, Marinas & Versorgung für Partner.' },
  { id:'notfall',   label:'🆘 Notfall',     kinds:['wsp','notfall','medizin','hafen','schleuse'],
    focus:'Standort, WSP, 112/110 & nächste Anlegestelle', reco:'Im Ernstfall: Standort teilen, WSP & nächste Anlegestelle — auch offline verfügbar.' },
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
    const mm = m.label.match(/^(\S+)\s+([\s\S]+)$/);
    const ic = mm ? mm[1] : ''; const tx = mm ? mm[2] : m.label;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mode' + (m.id === active ? ' on' : '');
    b.dataset.mode = m.id;
    b.setAttribute('aria-pressed', m.id === active ? 'true' : 'false');
    b.innerHTML = `<span class="m-sheen" aria-hidden="true"></span><span class="m-ic" aria-hidden="true">${ic}</span><span class="m-tx">${tx}</span>`;
    b.onclick = () => {
      el.querySelectorAll('.mode').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
      b.classList.remove('sweep'); void b.offsetWidth; b.classList.add('sweep'); // weicher Glow-Sweep beim Wechsel
      applyMode(m.id); onPick(m);
      try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch { /* */ }
    };
    el.appendChild(b);
  });
  document.documentElement.dataset.mode = active;
}

/* Smart-Sticky-Rollenleiste: Hero sichtbar = groß · gescrollt = kompakt · tief = Floating-Mini.
 * Reine Klassen-Toggles (CSS-Transitions, GPU) via IntersectionObserver + rAF-gedrosseltem Scroll — keine Reflows im Loop. */
export function initModeBarScroll() {
  const bar = document.getElementById('modes'); if (!bar) return;
  let queued = false;
  // deterministisch, viewport-relativ: <1.3vh = groß (Hero-Nähe) · 1.3–2.6vh = kompakt · >2.6vh = Floating-Mini
  const compute = () => {
    queued = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0, vh = innerHeight || 800;
    bar.classList.toggle('m-compact', y >= vh * 1.3 && y < vh * 2.6);
    bar.classList.toggle('m-float', y >= vh * 2.6);
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(compute); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  compute();
}
