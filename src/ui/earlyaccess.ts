/* ═══ Early Access / Revier-Updates · DSGVO-konform (Consent Pflicht, kein Tracking) ═══ */
import { SB_URL, SB_KEY } from '../lib/auth';
import { LAENDER } from '../map/map';
const SB = `${SB_URL}/rest/v1`;

export function initEarlyAccess() {
  const form = document.getElementById('eaForm') as HTMLFormElement | null;
  const sel = document.getElementById('eaLand') as HTMLSelectElement | null;
  const hint = document.getElementById('eaHint');
  if (!form || !sel) return;
  if (sel.options.length <= 1) for (const [code,L] of Object.entries(LAENDER)) {
    const o = document.createElement('option'); o.value = code; o.textContent = L.name; sel.appendChild(o);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('eaEmail') as HTMLInputElement).value.trim();
    const name = (document.getElementById('eaName') as HTMLInputElement).value.trim().slice(0,60);
    const consent = (document.getElementById('eaConsent') as HTMLInputElement).checked;
    const land = sel.value;
    const interessen = [...form.querySelectorAll<HTMLInputElement>('input[name=eaInt]:checked')].map(i=>i.value);
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { if(hint) hint.textContent='Bitte gültige E-Mail eingeben.'; return; }
    if (!consent) { if(hint) hint.textContent='Bitte bestätige die Einwilligung, dann kann ich dich benachrichtigen.'; return; }
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement; btn.disabled=true; btn.textContent='Sende …';
    try {
      const r = await fetch(`${SB}/early_access_signups`, { method:'POST',
        headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify({ email, name:name||null, bundesland:land||null, interessen, consent, source:'wl3-web' }) });
      if (!r.ok && r.status !== 409) throw 0;
      if (hint) hint.innerHTML = '✅ Eingetragen — du bekommst Bescheid, sobald dein Revier live geht. Danke!';
      form.reset(); btn.textContent='Eingetragen ✓';
    } catch { if(hint) hint.textContent='Eintragen fehlgeschlagen — bitte später erneut.'; btn.disabled=false; btn.textContent='Benachrichtige mich'; }
  });
}
