/* ═══ Rechtliches · Impressum · Datenschutz · Cookies · Kontakt (edles Modal) ═══
 * Inhalte aus Wasserlage 2.0 / Wave Bite extrahiert und für 3.0 angepasst (kein GA, DE-weit). */
const CONTENT: Record<string, { title: string; html: string }> = {
  impressum: { title: '⚓ Impressum', html: `
    <h5>Anbieter</h5>
    <p>Wave Bite by Voigt · Einzelfirma (Schweiz) · Inhaber: Carsten Voigt<br>
    Hauptstrasse 23 · 4242 Laufen · Schweiz<br>
    E-Mail: <a href="mailto:info@wave-bite.com">info@wave-bite.com</a> · Tel: +41 78 406 16 67<br>
    UID: CHE-431.108.641 · EHRA-ID 1727877 · CH-ID CH-280.103.2066-1 (HR-Amt Basel-Landschaft / ZEFIX) · nicht mehrwertsteuerpflichtig (Art. 10 MWSTG)<br>
    Operativ in DE: Wave Bite UG (haftungsbeschränkt) i. G. · c/o Oberste Chefetage · Flämingstrasse 4 · 15738 Zeuthen · Deutschland</p>
    <h5>Wichtiger Hinweis</h5>
    <p>Wasserlage ist <b>kein amtlicher Informationsdienst</b> und keine Navigationsempfehlung. Verbindliche Schifffahrtsmeldungen ausschließlich auf <a href="https://www.elwis.de" target="_blank" rel="noopener">ELWIS.de</a>. Alle Angaben ohne Gewähr.</p>
    <h5>Datenquellen</h5>
    <p>Karten © OpenStreetMap-Mitwirkende, OpenFreeMap &amp; CARTO · Seezeichen © OpenSeaMap · Wetter © Open-Meteo/DWD · Pegel © Pegelonline (WSV) · Amtliche Lage © ELWIS · Wasserwege-Routing aus OpenStreetMap · Wetterradar © Windy.com. Community-Angaben sind Erfahrungswerte.</p>
    <h5>Urheberrecht</h5>
    <p>© Wave Bite — Inhalte unterliegen dem Urheberrecht; Verwertung nur mit Zustimmung. Marken &amp; Partner-Logos gehören den jeweiligen Inhabern.</p>` },
  datenschutz: { title: '🔒 Datenschutz', html: `
    <p>Wir <b>verkaufen keine Daten und zeigen keine Werbung</b>. Wasserlage 3.0 setzt <b>keine Werbe- oder Tracking-Cookies</b> und kein Google Analytics ein.</p>
    <h5>Lokale Speicherung</h5>
    <p>Funktionale Einstellungen (Tag/Nacht, Captain-Pass, Sprachausgabe, gesehene Hinweise) liegen ausschließlich lokal in deinem Browser (localStorage) und verlassen dein Gerät nicht.</p>
    <h5>Standort</h5>
    <p>Dein Standort wird nur nach ausdrücklicher Freigabe und ausschließlich lokal genutzt (z. B. „In meiner Nähe", Routen-Start).</p>
    <h5>Externe Dienste</h5>
    <p>Beim Laden von Karte, Wetter, Pegel &amp; Wasserwegen werden technisch bedingt Anfragen an Dritte gestellt (dabei wird u. a. deine IP-Adresse übertragen): OpenFreeMap/OpenStreetMap &amp; CARTO, OpenSeaMap, Open-Meteo/DWD, Pegelonline (WSV), ELWIS, Windy.com. Community-Beiträge werden über Supabase (EU) gelesen und gespeichert.</p>
    <h5>Assistentin „Nele"</h5>
    <p>Frei getippte Fragen an Nele werden zur Beantwortung an einen KI-Dienst (Anthropic Claude, via Wave-Bite-Server) übermittelt — bitte dort keine personenbezogenen Daten eingeben.</p>
    <h5>Auskunft &amp; Löschung</h5>
    <p>Anfragen jederzeit an <a href="mailto:info@wave-bite.com">info@wave-bite.com</a>.</p>` },
  cookies: { title: '🍪 Cookies', html: `
    <p>Wasserlage 3.0 nutzt <b>keine Tracking- oder Werbe-Cookies</b>. Es gibt bewusst kein Cookie-Banner, weil keine einwilligungspflichtigen Cookies gesetzt werden.</p>
    <h5>Was lokal gespeichert wird</h5>
    <p>Nur technisch notwendige, funktionale Daten im <b>localStorage</b> deines Browsers (z. B. Tag/Nacht-Einstellung, Sprachausgabe an/aus, Captain-Pass-Fortschritt, bereits gesehene Hinweise). Diese Daten bleiben auf deinem Gerät und lassen sich jederzeit über die Browser-Einstellungen löschen.</p>
    <h5>Offline / Service-Worker</h5>
    <p>Für die Offline-Fähigkeit werden Karten- und Revierdaten im Browser-Cache zwischengespeichert — rein funktional, ohne Personenbezug.</p>` },
  kontakt: { title: '✉️ Kontakt', html: `
    <p>Wir freuen uns über Feedback, Korrekturen sowie Partner- &amp; Event-Anfragen.</p>
    <h5>Wave Bite by Voigt</h5>
    <p>E-Mail: <a href="mailto:info@wave-bite.com">info@wave-bite.com</a><br>
    Telefon: +41 78 406 16 67<br>
    Operativ DE: Flämingstrasse 4 · 15738 Zeuthen</p>
    <p class="legal-ctas"><a class="legal-cta" href="mailto:info@wave-bite.com?subject=Wasserlage%20Anfrage">✉️ Nachricht schreiben</a>
    <a class="legal-cta" href="https://wave-bite.com/" target="_blank" rel="noopener">🌊 wave-bite.com</a></p>
    <p class="legal-hint">Daten- oder POI-Korrektur? Nutze „Melden" in der Community oder schreib uns — wir pflegen den Bestand laufend.</p>` },
};

export function initLegal() {
  const modal = document.getElementById('legalModal'); if (!modal) return;
  const title = document.getElementById('legalTitle')!, content = document.getElementById('legalContent')!;
  const open = (key: string) => { const c = CONTENT[key]; if (!c) return;
    title.textContent = c.title; content.innerHTML = c.html; modal.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { modal.hidden = true; document.body.style.overflow = ''; };
  document.querySelectorAll<HTMLElement>('[data-legal]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open(a.dataset.legal!); }));
  document.getElementById('legalClose')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
}
