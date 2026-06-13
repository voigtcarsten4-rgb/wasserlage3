/* ═══ Captain Academy · Spiel inline spielbar + Game-Status (Phase 2) ═══
 * Bindet Wave Bite · Water Patrol prominent ein: „Hier spielen" lädt das Spiel lazy in einen
 * Inline-Rahmen (Vollbild möglich), plus Tab-Fallback. Status wird ehrlich aus echten Daten gespeist. */
import { gameUrl, fetchGameStatus } from '../lib/game';

export function initAcademy() {
  const playBtn = document.getElementById('acadPlay');
  const stage = document.getElementById('acadStage');
  const wrap = document.getElementById('acadFrameWrap');
  const openLink = document.getElementById('acadOpen') as HTMLAnchorElement | null;
  if (openLink) openLink.href = gameUrl();           // Tab-Öffnen mit geteilter device-id

  let iframe: HTMLIFrameElement | null = null;
  const ensureFrame = () => {
    if (iframe || !wrap) return;
    iframe = document.createElement('iframe');
    iframe.className = 'acad-frame';
    iframe.src = gameUrl();
    iframe.title = 'Wave Bite · Water Patrol';
    iframe.loading = 'lazy';
    iframe.allow = 'fullscreen; accelerometer; gyroscope; autoplay; gamepad';
    iframe.setAttribute('allowfullscreen', 'true');
    wrap.appendChild(iframe);
  };
  playBtn?.addEventListener('click', () => {
    if (!stage) { window.open(gameUrl(), '_blank', 'noopener'); return; }
    stage.hidden = false; ensureFrame();
    playBtn.setAttribute('hidden', 'true');
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('acadFs')?.addEventListener('click', () => {
    const el: any = stage || iframe; if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((iframe as any)?.requestFullscreen) (iframe as any).requestFullscreen().catch(() => {});
  });
  document.getElementById('acadClose')?.addEventListener('click', () => {
    if (iframe) { iframe.remove(); iframe = null; }            // Spiel stoppen (Audio/Frame frei)
    if (stage) stage.hidden = true;
    playBtn?.removeAttribute('hidden');
  });

  renderStatus();
}

async function renderStatus() {
  const el = document.getElementById('acadGameStatus'); if (!el) return;
  const s = await fetchGameStatus();
  if (s && s.events > 0) {
    el.innerHTML = `🎮 <b>${s.points} Spiel-Punkte</b> auf deinem Captain-Pass · ${s.events} Einsätze gewertet.`;
  } else {
    el.innerHTML = `📊 Spiel-Fortschritt &amp; Captain-Pass-Punkte werden synchronisiert, sobald du im Spiel Einsätze abschließt. <span class="acad-soon">Bereit — noch keine Einsätze gewertet.</span>`;
  }
}
