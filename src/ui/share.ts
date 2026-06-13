/* ═══ Teilen & QR · Traffic-Generator (Web Share API + Fallback, QR clientseitig) ═══ */
const URL_ = 'https://wasserlage.wavebite.info';
const TEXT = 'Wasserlage — dein Revier live: amtliche Lage, Pegel, Wetter & Gewässerkarte für Bootsfahrer. Schau mal:';

/* Minimaler QR (Numeric/Byte, Version-unabhängig) — wir nutzen eine kompakte QR-Lib-freie SVG via Google-Chart-Alternative:
   Da keine externe Lib gewünscht: QR als <img> über api.qrserver.com (kostenlos, kein Key). Fallback: Link-Text. */
function qrSvg(url: string): string {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&color=0E2A40&bgcolor=255-255-255&data=${encodeURIComponent(url)}`;
  return `<img class="share-qr" src="${src}" alt="QR-Code zu Wasserlage" width="160" height="160" loading="lazy">`;
}

export function initShare() {
  const host = document.getElementById('shareSlot');
  if (!host) return;
  host.innerHTML = `
    <div class="share-box panel glass">
      <div class="share-txt">
        <b>📣 Wasserlage weitersagen</b>
        <p>Hilf anderen Crews — teile Wasserlage oder scanne den Code, um es aufs Handy zu holen.</p>
        <div class="share-actions">
          <button class="cta-btn gold" id="shareBtn">Teilen</button>
          <button class="cta-btn ghost" id="copyBtn">🔗 Link kopieren</button>
        </div>
        <span class="share-hint" id="shareHint"></span>
      </div>
      <div class="share-qrwrap">${qrSvg(URL_)}<small>Scan = Wasserlage</small></div>
    </div>`;
  const hint = document.getElementById('shareHint')!;
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Wasserlage', text: TEXT, url: URL_ }); } catch {}
    } else {
      await copy(); hint.textContent = 'Teilen wird hier nicht unterstützt — Link wurde kopiert.';
    }
  });
  document.getElementById('copyBtn')?.addEventListener('click', copy);
  async function copy() {
    try { await navigator.clipboard.writeText(URL_); hint.textContent = '✓ Link kopiert — einfach einfügen & teilen.'; }
    catch { hint.textContent = URL_; }
  }
}
