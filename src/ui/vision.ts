/* ═══ Vision Mode · AR-Copilot (Phase 4) — experimentell, ehrlich ═══
 * Smartphone: Kamera + GPS + Kompass/Gyro → POIs als Peilungs-Chips über dem echten Wasserbild.
 * Desktop/Fallback: ruhige Three.js-Marine-Simulation (Horizont, Wasser, Route, Kompass, Marker).
 * GRUNDGESETZ: keine Fake-AR, keine künstliche Präzision. Fehlt ein Sensor → ehrlich kennzeichnen,
 * Route bei schwachem GPS ausblenden. Vision ersetzt NIE die amtliche Navigation. */
import type { MapAPI } from '../map/map';
import { KINDS } from '../map/map';
import { currentMode } from './modes';

const ICON: Record<string, string> = (() => { const m: Record<string, string> = {}; for (const k of KINDS) m[k.kind] = k.icon; return m; })();
const LABEL: Record<string, string> = (() => { const m: Record<string, string> = {}; for (const k of KINDS) m[k.kind] = k.label; return m; })();
const FOCUS_EXTRA = ['gelbe_welle', 'wsp', 'notfall', 'medizin', 'schleuse']; // Sicherheit/Orientierung immer relevant

const toR = Math.PI / 180, toD = 180 / Math.PI;
function distM(a: [number, number], b: [number, number]): number {
  const R = 6371000, dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function bearing(a: [number, number], b: [number, number]): number {
  const y = Math.sin((b[0] - a[0]) * toR) * Math.cos(b[1] * toR);
  const x = Math.cos(a[1] * toR) * Math.sin(b[1] * toR) - Math.sin(a[1] * toR) * Math.cos(b[1] * toR) * Math.cos((b[0] - a[0]) * toR);
  return (Math.atan2(y, x) * toD + 360) % 360;
}
const fmtDist = (m: number) => m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
const E = (s: any) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

let API: MapAPI | null = null;
let root: HTMLElement | null = null;
let raf = 0, watch = 0, stream: MediaStream | null = null;
let orientOn = false, headingDeg: number | null = null, headingFix = false;
let userPos: [number, number] | null = null, gpsAcc: number | null = null, gpsHeading: number | null = null, gpsSpeed: number | null = null;
let disposeSim: (() => void) | null = null;
let lillyTimer = 0;

interface VPoi { lng: number; lon?: number; lat: number; kind: string; name: string; dist: number; brg: number }

/* Fokus-POIs der aktuellen Zielgruppe rund um die Nutzerposition (echte Karten-POIs). */
function nearbyPois(pos: [number, number], maxM = 4000, cap = 7): VPoi[] {
  if (!API) return [];
  const focus = new Set([...currentMode().kinds, ...FOCUS_EXTRA]);
  let feats: any[] = []; try { feats = API.features() || []; } catch { feats = []; }
  const out: VPoi[] = [];
  for (const f of feats) {
    const k = f.properties?.kind; if (!focus.has(k)) continue;
    const g = f.geometry; if (!g || g.type !== 'Point') continue;
    const ll = g.coordinates as [number, number];
    const d = distM(pos, ll); if (d > maxM) continue;
    out.push({ lng: ll[0], lat: ll[1], kind: k, name: f.properties?.name || LABEL[k] || k, dist: d, brg: bearing(pos, ll) });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, cap);
}
function lastRoute(): { coords: [number, number][]; km: number } | null {
  try { const s = JSON.parse(localStorage.getItem('wl3_last_route') || 'null'); return s && s.coords ? { coords: s.coords, km: s.km } : null; } catch { return null; }
}

function setStatus(txt: string, warn = false) {
  const el = document.getElementById('vStatus'); if (el) { el.innerHTML = txt; el.classList.toggle('warn', warn); }
}
function setLilly(txt: string) { const el = document.getElementById('vLilly'); if (el) el.innerHTML = txt; }

function buildShell() {
  root = document.createElement('div'); root.id = 'visionRoot'; root.className = 'vision';
  root.innerHTML = `
    <video id="vCam" playsinline muted hidden></video>
    <canvas id="vSim" hidden></canvas>
    <div class="v-overlay" id="vOverlay">
      <div class="v-compass" id="vCompass" hidden></div>
      <div class="v-route" id="vRoute" hidden></div>
      <div class="v-markers" id="vMarkers"></div>
      <div class="v-reticle" aria-hidden="true"></div>
    </div>
    <div class="v-top">
      <span class="v-badge">👁 Vision <em>experimentell</em></span>
      <span class="v-audience" id="vAudience"></span>
      <span class="v-status" id="vStatus">startet …</span>
      <button id="vClose" class="v-close" aria-label="Vision schließen">✕</button>
    </div>
    <div class="v-bottom">
      <div class="v-lilly" id="vLilly"><span class="v-lilly-av">🧭</span><span id="vLillyTxt">Lilly Vision an Bord.</span></div>
      <div class="v-safe">⚠ Nur unterstützende Darstellung — keine amtliche Navigation. Verbindlich: ELWIS &amp; Fahrrinne.</div>
    </div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add('vision-on');
  const aud = document.getElementById('vAudience'); if (aud) aud.textContent = currentMode().label;
  document.getElementById('vClose')?.addEventListener('click', closeVision);
  root.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') closeVision(); });
}

export function closeVision() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (lillyTimer) { clearInterval(lillyTimer); lillyTimer = 0; }
  if (watch && navigator.geolocation) { try { navigator.geolocation.clearWatch(watch); } catch { /* */ } watch = 0; }
  if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch { /* */ } stream = null; }
  if (orientOn) { try { window.removeEventListener('deviceorientation', onOrient as any); window.removeEventListener('deviceorientationabsolute', onOrient as any); } catch { /* */ } orientOn = false; }
  if (disposeSim) { try { disposeSim(); } catch { /* */ } disposeSim = null; }
  headingDeg = null; headingFix = false; userPos = null; gpsAcc = null;
  document.documentElement.classList.remove('vision-on');
  if (root) { root.remove(); root = null; }
}

function onOrient(e: any) {
  let h: number | null = null;
  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;   // iOS: echte Nordpeilung
  else if (e.alpha != null) h = (360 - e.alpha);                                                                   // Android: alpha gegen den Uhrzeigersinn
  if (h != null) { const scr = (screen.orientation && (screen.orientation as any).angle) || 0; headingDeg = ((h + scr) % 360 + 360) % 360; headingFix = true; }
}

export async function openVision() {
  if (root) return;
  buildShell();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && matchMedia('(pointer:coarse)').matches;
  let orientGranted = true;
  const DOE: any = (window as any).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') { try { orientGranted = (await DOE.requestPermission()) === 'granted'; } catch { orientGranted = false; } }
  if (canCam) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const v = document.getElementById('vCam') as HTMLVideoElement;
      v.srcObject = stream; v.hidden = false; await v.play().catch(() => {});
      startAR(orientGranted);
      return;
    } catch { /* Kamera verweigert/nicht verfügbar → Simulation */ }
  }
  startSim(reduce);
}

const FOV = 64;                         // angenommenes horizontales Sichtfeld (Smartphone-Kamera, grob)
function startAR(orientGranted: boolean) {
  setStatus('Kamera aktiv · suche GPS & Kompass …');
  const cmp = document.getElementById('vCompass'); if (cmp) cmp.hidden = false;
  if (orientGranted && (window as any).DeviceOrientationEvent) {
    window.addEventListener('deviceorientationabsolute', onOrient as any, true);
    window.addEventListener('deviceorientation', onOrient as any, true);
    orientOn = true;
  }
  if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition(p => {
      userPos = [p.coords.longitude, p.coords.latitude];
      gpsAcc = p.coords.accuracy ?? null;
      gpsHeading = (p.coords.heading != null && !isNaN(p.coords.heading)) ? p.coords.heading : null;
      gpsSpeed = (p.coords.speed != null && !isNaN(p.coords.speed)) ? p.coords.speed * 3.6 : null;
    }, () => setStatus('📡 GPS fehlt — Peilung nicht möglich', true), { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 });
  } else setStatus('📡 Kein GPS auf diesem Gerät', true);
  startLilly();
  const loop = () => { renderAR(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

function effHeading(): number | null {
  if (headingFix && headingDeg != null) return headingDeg;
  if (gpsHeading != null && (gpsSpeed == null || gpsSpeed > 1.5)) return gpsHeading;  // nur bei Bewegung verlässlich
  return null;
}
function renderAR() {
  const markers = document.getElementById('vMarkers'); const route = document.getElementById('vRoute'); const cmp = document.getElementById('vCompass');
  if (!markers) return;
  const h = effHeading();
  const weak = !userPos || gpsAcc == null || gpsAcc > 80;
  // Status ehrlich
  const parts: string[] = [];
  parts.push(userPos ? (gpsAcc != null ? `📍 ±${Math.round(gpsAcc)} m` : '📍 GPS') : '📍 kein GPS');
  parts.push(h != null ? `🧭 ${Math.round(h)}°${headingFix ? '' : ' (GPS-Kurs)'}` : '🧭 kein Kompass');
  setStatus(parts.join(' · '), weak || h == null);
  if (cmp) renderCompass(cmp, h);
  if (weak || h == null) {
    markers.innerHTML = `<div class="v-hint">${!userPos ? 'Warte auf GPS …' : gpsAcc && gpsAcc > 80 ? 'GPS zu ungenau für Peilung — bitte freie Sicht zum Himmel.' : 'Kompass nicht verfügbar — bewege dich kurz, dann nutze ich den GPS-Kurs.'}</div>`;
    if (route) route.hidden = true;
    return;
  }
  const pois = nearbyPois(userPos!);
  const W = window.innerWidth;
  const html: string[] = [];
  for (const p of pois) {
    let rel = ((p.brg - h + 540) % 360) - 180;                 // -180..180
    if (Math.abs(rel) > FOV / 2) continue;                      // außerhalb des Blickfelds
    const x = 50 + (rel / FOV) * 100;                           // 0..100 % der Breite
    const near = 1 - Math.min(1, p.dist / 4000);                // näher = tiefer im Bild
    const y = 34 + (1 - near) * 30;                             // dezente Distanz-Höhe (kein Ground-Lock!)
    const sym = ICON[p.kind] || '📍';
    html.push(`<div class="v-chip" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><span class="v-chip-ic">${sym}</span><span class="v-chip-tx"><b>${E(p.name)}</b><em>${fmtDist(p.dist)}</em></span></div>`);
  }
  markers.innerHTML = html.join('') || `<div class="v-hint soft">Keine Fokus-Ziele im Blickfeld — dreh dich langsam.</div>`;
  // Route-Peilung (Lichtspur-Andeutung am Horizont) — nur bei gutem GPS
  const lr = lastRoute();
  if (route && lr && lr.coords.length > 1) {
    let best = Infinity, bi = 0; for (let i = 0; i < lr.coords.length; i++) { const d = distM(userPos!, lr.coords[i]); if (d < best) { best = d; bi = i; } }
    const ahead = lr.coords[Math.min(lr.coords.length - 1, bi + 2)];
    const rb = bearing(userPos!, ahead); let rel = ((rb - h + 540) % 360) - 180;
    if (Math.abs(rel) <= FOV / 2 + 6) { route.hidden = false; route.style.left = (50 + (rel / FOV) * 100).toFixed(1) + '%'; route.innerHTML = `<span class="v-route-chevron">▲</span><span class="v-route-lbl">Route</span>`; }
    else { route.hidden = false; route.style.left = (rel < 0 ? 6 : 94) + '%'; route.innerHTML = `<span class="v-route-chevron">${rel < 0 ? '◀' : '▶'}</span><span class="v-route-lbl">Route</span>`; }
  } else if (route) route.hidden = true;
}
function renderCompass(el: HTMLElement, h: number | null) {
  if (h == null) { el.innerHTML = ''; return; }
  const marks = [['N', 0], ['NO', 45], ['O', 90], ['SO', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]] as [string, number][];
  const html = marks.map(([lbl, deg]) => { let rel = ((deg - h + 540) % 360) - 180; if (Math.abs(rel) > 70) return ''; const x = 50 + (rel / 140) * 100; return `<span class="v-cmark${deg % 90 === 0 ? ' card' : ''}" style="left:${x.toFixed(1)}%">${lbl}</span>`; }).join('');
  el.innerHTML = `<div class="v-cscale">${html}</div><div class="v-cneedle"></div>`;
}

/* ── Desktop / Fallback: ruhige Three.js-Marine-Simulation (klar als Simulation gekennzeichnet) ── */
async function startSim(reduce: boolean) {
  setStatus('🖥️ Simulation — Vision ohne Kamera/Sensoren');
  const cmp = document.getElementById('vCompass'); if (cmp) cmp.hidden = false;
  const markers = document.getElementById('vMarkers'); if (markers) markers.innerHTML = '';
  const canvas = document.getElementById('vSim') as HTMLCanvasElement; if (!canvas) return;
  canvas.hidden = false;
  startLilly();
  let THREE: any;
  try { THREE = await import('three'); } catch { setStatus('3D nicht verfügbar', true); return; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
  cam.position.set(0, 4.2, 12); cam.lookAt(0, 2.4, -60);
  /* Himmel: Navy → Cyan Gradient */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x081a29) }, hor: { value: new THREE.Color(0x19719A) }, gold: { value: new THREE.Color(0x3FC3C9) } },
    vertexShader: `varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top,hor,gold; varying vec3 v; void main(){ float y=clamp(v.y*0.5+0.5,0.0,1.0); vec3 c=mix(hor,top,smoothstep(0.42,0.95,y)); float band=smoothstep(0.50,0.46,y)*smoothstep(0.40,0.46,y); c=mix(c,gold,band*0.5); gl_FragColor=vec4(c,1.0);} ` }));
  scene.add(sky);
  /* Wasser: dezente Dünung, Cyan→Navy */
  const wGeo = new THREE.PlaneGeometry(900, 600, 120, 80);
  const wMat = new THREE.ShaderMaterial({ transparent: true,
    uniforms: { t: { value: 0 }, shallow: { value: new THREE.Color(0x19719A) }, deep: { value: new THREE.Color(0x081a29) }, foam: { value: new THREE.Color(0x9fe9ef) } },
    vertexShader: `uniform float t; varying float h; varying float d; void main(){ vec3 p=position; float w=sin(p.y*0.06 - t*1.1 + sin(p.x*0.02)*0.6)*0.7 + sin(p.y*0.13 - t*1.7)*0.3; p.z+=w; h=w; d=clamp(-p.y/300.0,0.0,1.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
    fragmentShader: `uniform vec3 shallow,deep,foam; varying float h; varying float d; void main(){ vec3 c=mix(shallow,deep,smoothstep(0.0,0.7,d)); c+=foam*smoothstep(0.55,1.0,h)*0.10; gl_FragColor=vec4(c,0.96);} ` });
  const water = new THREE.Mesh(wGeo, wMat); water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water);
  /* Route als ruhige cyanfarbene Lichtspur in die Tiefe */
  const rGeo = new THREE.PlaneGeometry(2.2, 150, 1, 60);
  const rMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(0x3FC3C9) } },
    vertexShader: `varying vec2 u; void main(){ u=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float t; uniform vec3 col; varying vec2 u; void main(){ float edge=smoothstep(0.0,0.35,u.x)*smoothstep(1.0,0.65,u.x); float flow=0.45+0.55*sin(u.y*22.0 - t*3.0); float fade=smoothstep(1.0,0.15,u.y); gl_FragColor=vec4(col, edge*flow*fade*0.5);} ` });
  const ribbon = new THREE.Mesh(rGeo, rMat); ribbon.rotation.x = -Math.PI / 2; ribbon.position.set(0, -0.3, -68); scene.add(ribbon);
  /* POI-Marker als Billboards (echte Fokus-POIs um die Kartenmitte; klar als Simulation) */
  const center: [number, number] = [13.35, 52.41];
  const pois = nearbyPois(center, 9000, 6);
  const sprites: any[] = [];
  pois.forEach((p, i) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgba(8,26,41,0.78)'; roundRect(ctx, 6, 6, 244, 84, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(63,195,201,0.7)'; ctx.lineWidth = 2; roundRect(ctx, 6, 6, 244, 84, 16); ctx.stroke();
    ctx.font = '40px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(ICON[p.kind] || '📍', 20, 50);
    ctx.fillStyle = '#eafffe'; ctx.font = 'bold 22px sans-serif'; ctx.fillText((p.name || '').slice(0, 14), 74, 38);
    ctx.fillStyle = '#9fe9ef'; ctx.font = '18px sans-serif'; ctx.fillText(fmtDist(p.dist), 74, 66);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 2;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const ang = (i / Math.max(1, pois.length - 1) - 0.5) * 0.9;
    sp.position.set(Math.sin(ang) * 30, 3.2 + (i % 2) * 1.4, -22 - i * 8);
    sp.scale.set(7.5, 2.8, 1); scene.add(sp); sprites.push(sp);
  });
  let run = true, t0 = performance.now(), simHead = 0;
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize, { passive: true });
  const loop = () => {
    if (!run) return;
    const t = (performance.now() - t0) / 1000;
    (wMat.uniforms.t.value as number) = t; (rMat.uniforms.t.value as number) = t;
    if (!reduce) { cam.position.y = 4.2 + Math.sin(t * 0.5) * 0.18; cam.position.x = Math.sin(t * 0.22) * 1.2; cam.rotation.z = Math.sin(t * 0.3) * 0.004; }
    simHead = (Math.sin(t * 0.05) * 18 + 360) % 360;
    const cmpEl = document.getElementById('vCompass'); if (cmpEl) renderCompass(cmpEl, simHead);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  disposeSim = () => {
    run = false; removeEventListener('resize', onResize);
    try { scene.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); renderer.dispose(); } catch { /* */ }
  };
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ── Lilly Vision · ruhige, kontextbezogene Hinweise (kein Dauerreden) ── */
function startLilly() {
  const tips: (() => string | null)[] = [
    () => { const p = userPos ? nearbyPois(userPos, 4000, 1)[0] : null; return p ? `${ICON[p.kind] || '•'} ${p.name} — ${fmtDist(p.dist)} ${bearingWord(p)}` : null; },
    () => { const w: any = (window as any).__wlw; return w && w.sunset ? `🌅 Sonnenuntergang heute ${w.sunset} Uhr — Lichterführung einplanen.` : null; },
    () => audienceTip(),
    () => lastRoute() ? `🟦 Deine letzte Route liegt als ruhige Spur im Bild — nur zur Orientierung.` : null,
  ];
  let i = 0;
  const tick = () => {
    for (let n = 0; n < tips.length; n++) { const txt = tips[(i + n) % tips.length](); if (txt) { setLilly(`<span class="v-lilly-av">🧭</span><span>${txt}</span>`); i = (i + n + 1) % tips.length; return; } }
  };
  tick(); lillyTimer = window.setInterval(tick, 11000);
}
function bearingWord(p: VPoi): string {
  const h = effHeading(); if (h == null) return '';
  const rel = ((p.brg - h + 540) % 360) - 180;
  return Math.abs(rel) < 18 ? 'voraus' : rel < 0 ? 'links' : 'rechts';
}
function audienceTip(): string {
  const id = currentMode().id;
  const tipByMode: Record<string, string> = {
    kapitaen: '⚓ Fahrrinne & Tonnen im Blick — Berufsschifffahrt hat Vorrang.',
    hausboot: '🛥️ Ruhig fahren, an Stegen Schrittgeschwindigkeit.',
    charter: '⛵ Brückenhöhen & Tiefgang im Blick behalten.',
    sup: '🛶 Ablandiger Wind ist tückisch — nah am Ufer bleiben.',
    angler: '🎣 Ruhige Buchten & Schongebiete beachten.',
    familie: '👨‍👩‍👧 Schwimmwesten an, Abstand zu Schiffen halten.',
    tourist: '📸 Schöne Fotospots — aber Wellenschlag vermeiden.',
    notfall: '🆘 Im Ernstfall: 112 · UKW Kanal 16 · Position durchgeben.',
    b2b: '🏢 Vision zeigt Versorgung & Liegeplätze im Revier.',
  };
  return tipByMode[id] || 'Vision unterstützt deine Orientierung — verbindlich bleibt ELWIS.';
}

export function initVision(api: MapAPI) {
  API = api;
  document.getElementById('visionBtn')?.addEventListener('click', () => { openVision().catch(() => {}); });
}
