/* ═══ Hero-Ampel · worst-of(Wetter, heute aktive ELWIS-Lage) — portiert aus 2.0 Fix A2 ═══ */
import type { Notice, Weather } from './live';
import { activeToday } from './live';

export type Lvl = 0|1|2;
export interface AmpelState { lvl: Lvl; text: string; cls: 'ok'|'warn'|'danger'; detail: string }

export function weatherLvl(w: Weather): Lvl {
  const rain = (w.code>=51 && w.code<=67) || (w.code>=80 && w.code<=99);
  return w.bft>=5 ? 2 : (w.bft>=4 || rain) ? 1 : 0;
}
export function elwisLvl(notices: Notice[]): { lvl: Lvl; red: number; orange: number } {
  const act = notices.filter(activeToday);
  const red = act.filter(n=>n.type==='red').length, orange = act.filter(n=>n.type==='orange').length;
  return { lvl: red ? 2 : orange ? 1 : 0, red, orange };
}
export function combine(w: Weather|null, notices: Notice[]|null): AmpelState {
  const wl: Lvl = w ? weatherLvl(w) : 0;
  const e = notices ? elwisLvl(notices) : { lvl: 0 as Lvl, red: 0, orange: 0 };
  const lvl = Math.max(wl, e.lvl) as Lvl;
  const fromElwis = e.lvl >= wl && e.lvl > 0;
  const TXT = {
    wx: ['Gute Bedingungen','Mit Vorsicht unterwegs','Heute herausfordernd'],
    el: ['Gute Bedingungen','Einschränkungen im Revier','Aktive Sperrung im Revier'],
  };
  let text = fromElwis ? TXT.el[lvl] : TXT.wx[lvl];
  if (fromElwis && lvl===2 && e.red>1) text = `${e.red} aktive Sperrungen im Revier`;
  const detail = [
    w ? `Wind ${w.bft} Bft (${w.dir})` : 'Wetter lädt…',
    notices ? `${e.red} Sperrungen · ${e.orange} Einschränkungen heute aktiv` : 'ELWIS lädt…',
  ].join(' · ');
  return { lvl, text, cls: lvl===2?'danger':lvl===1?'warn':'ok', detail };
}
