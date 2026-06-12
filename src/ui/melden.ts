/* ═══ Community 3.0 · Melden direkt aus v3 (gleiche Supabase wie 2.0, RLS-geschützt) ═══ */
const SB = 'https://wjqicituxwtlkddgspzc.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcWljaXR1eHd0bGtkZGdzcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc1MzcsImV4cCI6MjA5NjE4MzUzN30.gH9OIHU7zepGhzsz5ZusBQ3r_bxxitrt8iW61iA1V8E';
const TITLES: Record<string,string> = { gefahr:'⚠ Gefahr', hinweis:'ℹ️ Info/Tipp', liegeplatz:'🅿️ Liegeplatz frei', erlebnis:'⭐ Schöner Ort' };
export function initMelden(onSent: ()=>void) {
  const $ = (id:string)=>document.getElementById(id) as any;
  let pos: {lat:number;lon:number}|null = null;
  $('cfGeo')?.addEventListener('click', () => {
    const hint = $('cfHint');
    if (!navigator.geolocation) { hint.textContent = 'Standort wird von diesem Gerät nicht unterstützt.'; return; }
    hint.textContent = 'Frage Standort an …';
    navigator.geolocation.getCurrentPosition(p => {
      pos = { lat:+p.coords.latitude.toFixed(4), lon:+p.coords.longitude.toFixed(4) };
      $('cfGeo').textContent = `✓ Standort erfasst (±${Math.round(p.coords.accuracy)} m)`;
      hint.textContent = 'Deine Meldung bekommt einen Karten-Pin an deiner Position.';
    }, () => { hint.textContent = 'Standort nicht verfügbar — Meldung erscheint ohne Karten-Pin.'; },
    { enableHighAccuracy:true, timeout:8000 });
  });
  $('cfSend')?.addEventListener('click', async () => {
    const btn = $('cfSend'), hint = $('cfHint');
    const last = +(localStorage.getItem('wl3_last_report')||0);
    if (Date.now() - last < 120000) { hint.textContent = '⏳ Spam-Schutz: bitte kurz warten, du hast gerade erst gemeldet.'; return; }
    const cat = $('cfCat').value, place = $('cfPlace').value.trim(), body = $('cfBody').value.trim(),
          name = $('cfName').value.trim().slice(0,40);
    if (!body && !place) { hint.textContent = 'Bitte kurz beschreiben, was andere wissen sollen.'; return; }
    btn.disabled = true; btn.textContent = 'Sende …';
    const payload: any = { author: name||'Gast', role:'Bootsfahrer', category:cat,
      title: TITLES[cat] + (place ? ' · ' + place.slice(0,60) : ''), body: body||'(ohne Beschreibung)',
      place: place||null, device: localStorage.getItem('wl_client')||'wl3' };
    if (pos) { payload.lat = pos.lat; payload.lon = pos.lon; }
    try {
      const r = await fetch(`${SB}/posts`, { method:'POST',
        headers:{ apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw 0;
      localStorage.setItem('wl3_last_report', String(Date.now()));
      btn.textContent = '✓ Live gemeldet — danke!'; hint.textContent = 'Deine Meldung ist jetzt für alle sichtbar (Status: ungeprüft).';
      $('cfBody').value=''; $('cfPlace').value='';
      setTimeout(()=>{ btn.disabled=false; btn.textContent='Meldung absenden'; }, 4000);
      onSent();
    } catch {
      btn.disabled = false; btn.textContent = 'Meldung absenden';
      hint.textContent = '📡 Senden fehlgeschlagen — bitte später erneut versuchen.';
    }
  });
}
