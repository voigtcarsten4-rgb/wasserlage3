/* ═══ Atmosphäre: Sonnenbogen-Instrument + Wetterpartikel (Port der 2.0-Stärken) ═══ */
import type { Weather } from '../lib/live';
const toM = (s:string) => +s.slice(0,2)*60 + +s.slice(3,5);
export function renderSky(w: Weather|null) {
  const dot = document.getElementById('sunDot'), t1 = document.getElementById('sunT1'),
        t2 = document.getElementById('sunT2'), srT = document.getElementById('srT'), suT = document.getElementById('suT');
  if (!dot || !t1) return;
  const now = new Date(); const nm = now.getHours()*60 + now.getMinutes();
  const sr = w ? toM(w.sunrise) : 5*60, su = w ? toM(w.sunset) : 21.5*60;
  const day = nm >= sr && nm <= su;
  /* Position auf dem Bogen: Cosinus-Bahn wie 2.0 */
  let tt: number;
  if (day) tt = (nm - sr) / (su - sr);
  else { const start = su, end = sr + 1440, cur = nm < sr ? nm + 1440 : nm; tt = (cur - start) / (end - start); }
  tt = Math.max(0, Math.min(1, tt));
  const ang = Math.PI * (1 - tt);
  const cx = 110 + 95 * Math.cos(ang), cy = 105 - 95 * Math.sin(ang);
  dot.setAttribute('cx', String(cx.toFixed(1))); dot.setAttribute('cy', String(cy.toFixed(1)));
  t1.textContent = now.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
  if (t2) t2.textContent = day ? '☀ SONNENSTAND' : '☾ MONDWACHE';
  if (srT && w) srT.textContent = '↑ ' + w.sunrise; if (suT && w) suT.textContent = '↓ ' + w.sunset;
  /* Wetter-Atmosphäre */
  const wx = document.getElementById('heroWx'); if (!wx) return;
  const code = w?.code ?? 1;
  const mode = code >= 95 ? 'storm'
    : (code>=71&&code<=77)||code===85||code===86 ? 'snow'
    : ((code>=51&&code<=67)||(code>=80&&code<=84)) ? 'rain'
    : code===45||code===48 ? 'fog'
    : (code>=2&&code<=44) ? 'cloudy' : 'clear';
  document.body.dataset.wx = mode;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let h = '';
  if (mode==='rain' || mode==='storm') for (let i=0;i<22;i++)
    h += `<span class="wxdrop" style="left:${(Math.random()*100).toFixed(1)}%;animation-duration:${(0.7+Math.random()*0.5).toFixed(2)}s;animation-delay:${(Math.random()*1.5).toFixed(2)}s"></span>`;
  if (mode==='snow') for (let i=0;i<26;i++)
    h += `<span class="wxflake" style="left:${(Math.random()*100).toFixed(1)}%;animation-duration:${(4+Math.random()*4).toFixed(2)}s;animation-delay:${(Math.random()*5).toFixed(2)}s;font-size:${(7+Math.random()*7).toFixed(0)}px">❄</span>`;
  if (mode==='fog') for (let i=0;i<4;i++)
    h += `<span class="wxfog" style="top:${12+i*20}%;animation-delay:${-i*7}s;animation-duration:${(22+i*6)}s"></span>`;
  if (mode==='cloudy' || mode==='rain' || mode==='storm') for (let i=0;i<3;i++)
    h += `<span class="wxcloud" style="top:${8+i*16}%;animation-delay:${-i*9}s"></span>`;
  wx.innerHTML = h;
}
export function startSkyTicker(get: ()=>Weather|null) {
  setInterval(() => renderSky(get()), 30000);
}
