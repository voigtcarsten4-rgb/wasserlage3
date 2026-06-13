/* ═══ Offline-Snapshot der letzten Live-Lage (Phase 3) · „Stand letzter Abruf" ═══
 * Speichert die zuletzt erfolgreich geladene Lage (Wetter/ELWIS/Fahrrinne) lokal, damit die App
 * offline hilfreich bleibt — IMMER mit ehrlichem Zeitstempel, nie als Live ausgegeben. */
const LS = 'wl3_snapshot';
export interface Snapshot { ts: number; w: any; doc: any; ft: any }

export function saveSnapshot(s: { w: any; doc: any; ft: any }) {
  try { localStorage.setItem(LS, JSON.stringify({ ts: Date.now(), w: s.w, doc: s.doc, ft: s.ft })); }
  catch { /* localStorage-Quota o. ä. → still überspringen */ }
}
export function loadSnapshot(): Snapshot | null {
  try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; }
}
export const snapTime = (ts: number) =>
  new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
