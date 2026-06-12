/* ═══ Community 3.0 · Melden mit Magic-Link-Login & Foto-Upload (Supabase, RLS) ═══ */
import { SB_URL, SB_KEY, getSession, sendMagicLink, captureSessionFromUrl, logout, uploadPhoto } from '../lib/auth';
const SB = `${SB_URL}/rest/v1`;
const TITLES: Record<string,string> = { gefahr:'⚠ Gefahr', hinweis:'ℹ️ Info/Tipp', liegeplatz:'🅿️ Liegeplatz frei', erlebnis:'⭐ Schöner Ort' };

function renderAuth() {
  const box = document.getElementById('cfAuth'); if (!box) return;
  const s = getSession();
  if (s) {
    box.innerHTML = `<span class="cf-auth-ok">✓ Angemeldet als <b></b> — Foto-Upload frei</span>
      <button type="button" class="cf-auth-out" id="cfLogout">Abmelden</button>`;
    (box.querySelector('b') as HTMLElement).textContent = s.email || 'Mitglied';
    document.getElementById('cfLogout')?.addEventListener('click', () => { logout(); renderAuth(); });
    (document.getElementById('cfPhoto') as HTMLInputElement)?.removeAttribute('disabled');
    const lbl = document.getElementById('cfPhotoLbl'); if (lbl) lbl.classList.remove('off');
  } else {
    box.innerHTML = `<input id="cfEmail" type="email" placeholder="E-Mail für Login-Link (für Fotos)" autocomplete="email">
      <button type="button" class="exp-act" id="cfLogin">🔑 Login-Link senden</button>`;
    (document.getElementById('cfPhoto') as HTMLInputElement)?.setAttribute('disabled','');
    const lbl = document.getElementById('cfPhotoLbl'); if (lbl) lbl.classList.add('off');
    document.getElementById('cfLogin')?.addEventListener('click', async () => {
      const em = (document.getElementById('cfEmail') as HTMLInputElement).value.trim();
      const hint = document.getElementById('cfHint')!;
      if (!/^\S+@\S+\.\S+$/.test(em)) { hint.textContent = 'Bitte gültige E-Mail eingeben.'; return; }
      hint.textContent = 'Sende Login-Link …';
      hint.textContent = (await sendMagicLink(em).catch(()=>false))
        ? `✉️ Login-Link an ${em} gesendet — Posteingang öffnen, Link tippen, fertig.`
        : 'Login-Link konnte nicht gesendet werden — später erneut versuchen.';
    });
  }
}

export function initMelden(onSent: ()=>void) {
  const $ = (id:string)=>document.getElementById(id) as any;
  captureSessionFromUrl();
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
    const cat = $('cfCat').value, place = $('cfPlace').value.trim(), body = $('cfBody').value.trim(),
          name = $('cfName').value.trim().slice(0,40);
    if (!body && !place) { hint.textContent = 'Bitte kurz beschreiben, was andere wissen sollen.'; return; }
    btn.disabled = true; btn.textContent = 'Sende …';
    /* Foto zuerst (nur eingeloggt) */
    let photo_path: string|null = null;
    const file: File|undefined = $('cfPhoto')?.files?.[0];
    const sess = getSession();
    if (file && sess) {
      btn.textContent = 'Lade Foto …';
      photo_path = await uploadPhoto(file, sess).catch(()=>null);
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
      btn.textContent = '✓ Live gemeldet — danke!'; hint.textContent = 'Deine Meldung ist jetzt für alle sichtbar (Status: ungeprüft, ab 3 Bestätigungen: 🟢).';
      $('cfBody').value=''; $('cfPlace').value=''; if ($('cfPhoto')) $('cfPhoto').value='';
      setTimeout(()=>{ btn.disabled=false; btn.textContent='Meldung absenden'; }, 4000);
      onSent();
    } catch {
      btn.disabled = false; btn.textContent = 'Meldung absenden';
      hint.textContent = '📡 Senden fehlgeschlagen — bitte später erneut versuchen.';
    }
  });
}
