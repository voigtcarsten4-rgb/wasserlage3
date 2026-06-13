/* ═══ Community 3.0 · Melden mit Magic-Link-Login & Foto-Upload (Supabase, RLS) ═══ */
import { SB_URL, SB_KEY, uploadPhotoAnon } from '../lib/auth';
const SB = `${SB_URL}/rest/v1`;
const TITLES: Record<string,string> = { gefahr:'⚠ Gefahr', hinweis:'ℹ️ Info/Tipp', liegeplatz:'🅿️ Liegeplatz frei', erlebnis:'⭐ Schöner Ort' };

/* Kein Login mehr nötig — Foto-Upload ist direkt frei (anon, mit Schutzregeln serverseitig) */
function renderAuth() {
  const box = document.getElementById('cfAuth'); if (!box) return;
  box.innerHTML = '<span class="cf-auth-ok">📷 Foto direkt anhängen — ganz ohne Anmeldung.</span>';
  (document.getElementById('cfPhoto') as HTMLInputElement)?.removeAttribute('disabled');
  const lbl = document.getElementById('cfPhotoLbl'); if (lbl) lbl.classList.remove('off');
}

export function initMelden(onSent: ()=>void) {
  const $ = (id:string)=>document.getElementById(id) as any;
  renderAuth();
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
    const cat = $('cfCat').value, place = $('cfPlace').value.trim().slice(0,80), body = $('cfBody').value.trim().slice(0,600),
          name = $('cfName').value.trim().slice(0,40);
    /* Missbrauchsschutz: Link-Spam abfangen */
    if ((body.match(/https?:\/\//g)||[]).length > 1) { hint.textContent = 'Bitte ohne Link-Listen melden — maximal ein Link pro Meldung.'; btn.disabled=false; return; }
    if (!body && !place) { hint.textContent = 'Bitte kurz beschreiben, was andere wissen sollen.'; return; }
    btn.disabled = true; btn.textContent = 'Sende …';
    /* Foto direkt hochladen — ohne Login (anon-Upload mit Schutzregeln) */
    let photo_path: string|null = null;
    const file: File|undefined = $('cfPhoto')?.files?.[0];
    if (file) {
      btn.textContent = 'Lade Foto …';
      photo_path = await uploadPhotoAnon(file).catch(()=>null);
      if (!photo_path) hint.textContent = 'Foto konnte nicht geladen werden — Meldung geht ohne Foto raus.';
    }
    const payload: any = { author: name||'Gast', role:'Bootsfahrer', category:cat,
      title: TITLES[cat] + (place ? ' · ' + place.slice(0,60) : ''), body: body||'(ohne Beschreibung)',
      place: place||null, device: localStorage.getItem('wl_client')||'wl3' };
    if (pos) { payload.lat = pos.lat; payload.lon = pos.lon; }
    if (photo_path) payload.photo_path = photo_path;
    try {
      const r = await fetch(`${SB}/posts`, { method:'POST',
        headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw 0;
      localStorage.setItem('wl3_last_report', String(Date.now()));
      import('../lib/points').then(m => m.award(photo_path?'photo':'report', 'report-'+Date.now())).catch(()=>{});
      btn.textContent = '✓ Live gemeldet — danke! (+Punkte)'; hint.textContent = 'Deine Meldung ist jetzt für alle sichtbar (Status: ungeprüft, ab 3 Bestätigungen: 🟢).';
      $('cfBody').value=''; $('cfPlace').value=''; if ($('cfPhoto')) $('cfPhoto').value='';
      setTimeout(()=>{ btn.disabled=false; btn.textContent='Meldung absenden'; }, 4000);
      onSent();
    } catch {
      btn.disabled = false; btn.textContent = 'Meldung absenden';
      hint.textContent = '📡 Senden fehlgeschlagen — bitte später erneut versuchen.';
    }
  });
}
