/* ═══ PWA: Service-Worker-Registrierung, Online/Offline-Status, Install-Prompt ═══ */
export function initPWA() {
  /* SW nur in Produktion registrieren (im Dev stört es HMR) */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => {});
    });
  }

  /* Online/Offline-Badge (dezent, oben) */
  const badge = document.createElement('div');
  badge.id = 'netBadge'; badge.hidden = true;
  badge.innerHTML = '📡 Offline – ich zeige dir die zuletzt geladenen Revierdaten. Live-Lage aktualisiert, sobald du wieder online bist.';
  document.body.appendChild(badge);
  const sync = () => {
    const off = !navigator.onLine;
    badge.hidden = !off;
    document.documentElement.classList.toggle('is-offline', off);
  };
  addEventListener('online', sync); addEventListener('offline', sync); sync();

  /* Install-Prompt (Android/Chrome) — dezenter CTA in der Wave-Bite-Sektion */
  let deferred: any = null;
  addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault(); deferred = e;
    const host = document.getElementById('installSlot');
    if (!host) return;
    host.hidden = false;
    host.innerHTML = '<button class="cta-btn ghost" id="installBtn">📲 Wasserlage installieren</button>';
    document.getElementById('installBtn')?.addEventListener('click', async () => {
      if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; host.hidden = true;
    });
  });
}
