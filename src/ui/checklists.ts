/* ═══ Zielgruppen-Checklisten · offline & modusabhängig (Phase 3) ═══
 * Jeder Zielgruppen-Modus sieht die für ihn sinnvolle Vor-Abfahrt-/Sicherheits-Checkliste.
 * Vollständig offline (im Bundle), gespeist vom gewählten Modus (ui/modes). */
import { currentModeId } from './modes';
const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

export interface Checklist { title: string; items: string[] }
const DEFAULT: Checklist = { title: 'Vor dem Ablegen', items: [
  'Lage gecheckt: Ampel, Sperrungen & Wind oben prüfen',
  'Rettungswesten für alle an Bord — Kinder immer an',
  'Boots- & Führerscheinpapiere dabei',
  'Kraftstoff & Reserve geprüft, Bilge trocken',
  'Lichterführung ab Sonnenuntergang Pflicht',
  'Handy geladen + wasserdicht verpackt',
]};
const CHECKLISTS: Record<string, Checklist> = {
  kapitaen: { title: 'Kapitän · Vorbereitung', items: [
    'ELWIS-Lage & Pegel für die Route geprüft',
    'Tiefgang gegen Fahrrinnentiefe abgeglichen',
    'Schleusen-Betriebszeiten & UKW-Kanäle notiert',
    'Lichterführung & Signalmittel klar',
    'Crew-Briefing: Mann-über-Bord, Funk, Rollen',
    'Wetterfenster & Rückfahrt eingeplant',
  ]},
  hausboot: { title: 'Hausboot · entspannt los', items: [
    'Route einfach gehalten, Schleusenzeiten passen',
    'Liegeplatz/Hafen fürs Ziel im Blick (ggf. anmelden)',
    'Frischwasser voll, Abwasser/Chemie-WC entsorgt',
    'Landstromkabel & Adapter an Bord',
    'Fender & Leinen griffbereit, langsam an Stegen',
    'Rettungswesten da, Notruf 112 erklärt',
  ]},
  charter: { title: 'Yacht / größeres Boot', items: [
    'Tiefgang & Brückendurchfahrtshöhen der Route geprüft',
    'Schleusenmaße & Marina-Slot abgeklärt',
    'Tankfüllung & Reserve, Motorcheck',
    'Wind, Pegel & Strömung bewertet',
    'Seekarte/Plotter aktuell, ELWIS-Sperrungen geprüft',
    'Rettungsmittel & Funk einsatzbereit',
  ]},
  sup: { title: 'Kajak · Kanu · SUP', items: [
    'Ein- & Ausstieg geplant, kurze Etappe',
    'Wetter, Wind & Strömung geprüft (ablandiger Wind ist tückisch)',
    'Schwimmweste an, Leash/Kenterschutz',
    'Nicht allein — jemand kennt Route & Rückkehrzeit',
    'Handy wasserdicht, Sonnenschutz & Trinkwasser dabei',
    'Abstand zu Badezonen & Naturschutz, Berufsschiff hat Vorrang',
  ]},
  angler: { title: 'Angler · ruhig & legal', items: [
    'Gültiger Fischerei-/Erlaubnisschein dabei',
    'Schonzeiten & Schongebiete geprüft (nicht befahren/angeln)',
    'Ruhige Bucht/Stelle, Wetter & Wind passen',
    'Sonnenauf-/untergang im Blick (beste Zeiten)',
    'Rettungsweste an, Handy geladen',
    'Müll mitnehmen, Naturschutz beachten',
  ]},
  familie: { title: 'Familie · sicher & schön', items: [
    'Schwimmwesten für Kinder — immer an',
    'Sonnenschutz, Trinkwasser & Snacks an Bord',
    'Kurze, ruhige Etappe mit Bade-/Pausenstopp',
    'Notruf 112 erklärt, Treffpunkt vereinbart',
    'Wetter & Wind geprüft, Boot nicht überladen',
    'Langsam an Badestellen, Abstand zu Schiffen',
  ]},
  tourist: { title: 'Tourist · entspannt entdecken', items: [
    'Wetter & Sonnenzeiten geprüft',
    'Schöne Stopps & Restaurants vorgemerkt',
    'Schwimmwesten an Bord, Notruf 112 bekannt',
    'Kurze Tour passend zur Erfahrung',
    'Genug Zeit für Schleusen einplanen',
    'Naturschutz & Badezonen respektieren',
  ]},
  notfall: { title: 'Notfall · das Wichtigste zuerst', items: [
    'Ruhig bleiben, Position bestimmen (GPS — „Meine Position")',
    'Notruf 112 · Wasserschutzpolizei 110',
    'UKW Kanal 16 (Not/Anruf) absetzen/mithören',
    'Rettungswesten an, Person im Blick behalten',
    'Gewässer, km & Ufer durchgeben',
  ]},
  b2b: DEFAULT,
};
export function checklistFor(id?: string): Checklist { return CHECKLISTS[id || currentModeId()] || DEFAULT; }

export function initChecklists() {
  const render = () => {
    const ul = document.getElementById('checklist'); if (!ul) return;
    const c = checklistFor();
    const head = ul.closest('.panel')?.querySelector('h3');
    if (head) head.innerHTML = '✅ ' + E(c.title);
    ul.innerHTML = c.items.map(i => `<li>${E(i)}</li>`).join('');
  };
  render();
  window.addEventListener('wl3-mode', render);
}
