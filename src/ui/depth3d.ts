/* ═══ depth3d.ts · Echte WebGL-3D-Tiefenlandschaft (Three.js, lazy) ═══
 * Mappt echte ELWIS-Fahrrinnentiefen auf einen 3D-Korridor: Boden-Ribbon (Farbe türkis→rot
 * nach Kielfreiheit), gläserne Wasseroberfläche, ein Boot, das die Strecke abfährt — sein
 * glühender Kielfreiheit-Strahl wird rot, wo es zu flach wird. Engste Stelle = pulsierender
 * roter Marker am Grund. Tiefennebel, Sonnenlicht, sanfte Kamerafahrt. Keine erfundenen Daten.
 * Perf: DPR≤2, Pause offscreen/hidden, reduced-motion = ein Frame, sauberes dispose(). */

export type D3Sample = { x: number; cm: number; sec: string; group: string };
export type D3State = { samples: D3Sample[]; draftCm: number; reserveCm: number; scale: number };
export type Depth3D = { update: (s: D3State) => void; dispose: () => void; setReduced: (r: boolean) => void };

let THREE: any = null, loading: Promise<any> | null = null;
function loadThree(): Promise<any> { if (THREE) return Promise.resolve(THREE); if (!loading) loading = import('three').then(m => { THREE = (m as any).default || m; return THREE; }); return loading; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C_DEEP: RGB = [49, 213, 231], C_OK: RGB = [42, 162, 214], C_WARN: RGB = [255, 213, 138], C_HOT: RGB = [255, 138, 77], C_BAD: RGB = [255, 75, 92];
function clearColor(cm: number, draftCm: number, reserveCm: number): RGB {
  const clr = cm - draftCm, r = reserveCm > 0 ? clr / reserveCm : (clr >= 0 ? 1 : -1);
  if (r >= 1.4) return C_DEEP; if (r >= 1) return mix(C_OK, C_DEEP, clamp((r - 1) / 0.4, 0, 1));
  if (r >= 0.45) return mix(C_WARN, C_OK, clamp((r - 0.45) / 0.55, 0, 1));
  if (r >= 0) return mix(C_HOT, C_WARN, clamp(r / 0.45, 0, 1)); return mix(C_HOT, C_BAD, clamp(-r / 0.6, 0, 1));
}
const hexOf = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];

const LEN = 26, WID = 9, DEPTHW = 7, NZ = 130, NX = 18;

export async function mountDepth3D(canvas: HTMLCanvasElement, initial: D3State): Promise<Depth3D | null> {
  const T = await loadThree(); if (!T || !canvas) return null;
  let gl: any; try { gl = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { return null; }
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in gl) gl.outputColorSpace = T.SRGBColorSpace;
  if ('toneMapping' in gl) { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }

  const scene = new T.Scene();
  scene.fog = new T.Fog(0x06182c, 13, 36);

  const camera = new T.PerspectiveCamera(50, 2, 0.1, 140);
  camera.position.set(0, 3.7, LEN * 0.5 + 4); camera.lookAt(0, -2.1, -3);

  scene.add(new T.HemisphereLight(0xc4f0ff, 0x05121f, 0.95));
  const sun = new T.DirectionalLight(0xfff1d8, 1.15); sun.position.set(-7, 15, 11); scene.add(sun);
  const glow = new T.PointLight(0x9fe9ff, 0.55, 46); glow.position.set(0, 4, LEN * 0.3); scene.add(glow);

  // Boden
  const bedGeo = new T.PlaneGeometry(WID, LEN, NX, NZ);
  bedGeo.setAttribute('color', new T.BufferAttribute(new Float32Array((NX + 1) * (NZ + 1) * 3), 3));
  const bedMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.05, side: T.DoubleSide });
  const bed = new T.Mesh(bedGeo, bedMat); bed.rotation.x = -Math.PI / 2; scene.add(bed);

  // Wasseroberfläche
  const waterGeo = new T.PlaneGeometry(WID * 2.6, LEN * 1.5, 44, 70);
  const waterMat = new T.MeshStandardMaterial({ color: 0x1ba6c8, transparent: true, opacity: 0.30, roughness: 0.1, metalness: 0.65, depthWrite: false });
  const water = new T.Mesh(waterGeo, waterMat); water.rotation.x = -Math.PI / 2; water.position.y = 0.002; water.renderOrder = 2; scene.add(water);
  const waterBase = (waterGeo.attributes.position.array as Float32Array).slice();

  // empf.-Reserve-Ebene (Gold)
  const recGeo = new T.PlaneGeometry(WID * 0.98, LEN);
  const recMat = new T.MeshBasicMaterial({ color: 0xE8C66B, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide });
  const recPlane = new T.Mesh(recGeo, recMat); recPlane.rotation.x = -Math.PI / 2; scene.add(recPlane);

  // Boot
  const boat = new T.Group();
  const hullShape = new T.Shape();
  hullShape.moveTo(-0.85, 0.16); hullShape.lineTo(0.85, 0.16); hullShape.quadraticCurveTo(0.58, -0.4, 0, -0.48); hullShape.quadraticCurveTo(-0.58, -0.4, -0.85, 0.16);
  const hullGeo = new T.ExtrudeGeometry(hullShape, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }); hullGeo.center();
  const hullMat = new T.MeshStandardMaterial({ color: 0xf3f8fc, roughness: 0.38, metalness: 0.3 });
  const hull = new T.Mesh(hullGeo, hullMat); hull.rotation.y = Math.PI / 2; boat.add(hull);
  const cabinMat = new T.MeshStandardMaterial({ color: 0x2f6f86, roughness: 0.5 });
  const cabin = new T.Mesh(new T.BoxGeometry(0.66, 0.32, 1.05), cabinMat); cabin.position.set(0, 0.32, 0.05); boat.add(cabin);
  const beamGeo = new T.CylinderGeometry(0.14, 0.36, 1, 18, 1, true);
  const beamMat = new T.MeshBasicMaterial({ color: 0x24E08B, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  const beam = new T.Mesh(beamGeo, beamMat); boat.add(beam);
  scene.add(boat);

  // Engstellen-Marker
  const markGeo = new T.SphereGeometry(0.5, 20, 16);
  const markMat = new T.MeshBasicMaterial({ color: 0xff4b5c, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false });
  const mark = new T.Mesh(markGeo, markMat); scene.add(mark);

  let state: D3State = initial;
  let worstX = 0.5, worstCm = 0, worstClr = 1e9, hasBad = false;

  const yOf = (cm: number) => -clamp(cm / state.scale, 0, 1.06) * DEPTHW;
  const zOf = (x: number) => LEN * (0.5 - x);
  function floorCmAt(x: number): number {
    const s = state.samples; if (!s.length) return state.scale * 0.5;
    if (x <= s[0].x) return s[0].cm; if (x >= s[s.length - 1].x) return s[s.length - 1].cm;
    for (let i = 1; i < s.length; i++) if (x <= s[i].x) { const a = s[i - 1], b = s[i], t = (x - a.x) / (b.x - a.x || 1); return lerp(a.cm, b.cm, t); }
    return s[s.length - 1].cm;
  }

  function build() {
    const pos = bedGeo.attributes.position.array as Float32Array;
    const col = bedGeo.attributes.color.array as Float32Array;
    worstClr = 1e9; worstX = 0.5; worstCm = state.scale * 0.5;
    let p = 0;
    for (let iz = 0; iz <= NZ; iz++) {
      const x01 = iz / NZ;
      const cm = floorCmAt(x01);
      const clr = cm - state.draftCm; if (clr < worstClr) { worstClr = clr; worstX = x01; worstCm = cm; }
      const c = clearColor(cm, state.draftCm, state.reserveCm).map(n => n / 255);
      for (let ix = 0; ix <= NX; ix++) {
        const u = ix / NX, bank = Math.pow(Math.abs(u - 0.5) * 2, 2.3);
        const cmHere = cm - bank * Math.min(cm * 0.8, state.scale * 0.66);
        const depthW = clamp(cmHere / state.scale, 0, 1.06) * DEPTHW;
        pos[p + 2] = -depthW + Math.sin(u * 8 + x01 * 26) * 0.045;
        col[p] = c[0]; col[p + 1] = c[1]; col[p + 2] = c[2];
        p += 3;
      }
    }
    bedGeo.attributes.position.needsUpdate = true; bedGeo.attributes.color.needsUpdate = true; bedGeo.computeVertexNormals();
    recPlane.position.y = yOf(state.draftCm + state.reserveCm);
    hasBad = worstClr < state.reserveCm;
    mark.position.set(0, yOf(worstCm) + 0.35, zOf(worstX));
    (mark.material as any).color.setHex(worstClr < 0 ? 0xff4b5c : 0xFFC44D);
  }

  function resize() { const w = canvas.clientWidth || 320, h = canvas.clientHeight || 220; gl.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
  let ro: ResizeObserver | null = null;
  try { ro = new ResizeObserver(() => { resize(); renderOnce(); }); ro.observe(canvas); } catch { window.addEventListener('resize', resize); }

  let raf = 0, running = false, t0 = 0, t = 0, onScreen = false, reduced = false, io: IntersectionObserver | null = null;
  function placeBoat(prog: number) {
    const x = clamp(prog, 0, 1), z = zOf(x), bedY = yOf(floorCmAt(x)), keelY = yOf(state.draftCm), clr = floorCmAt(x) - state.draftCm;
    boat.position.set(0, Math.sin(t * 1.7) * 0.07, z); boat.rotation.z = Math.sin(t * 1.15) * 0.035;
    const kc = clr >= state.reserveCm ? 0x24E08B : clr >= 0 ? 0xFFC44D : 0xFF4B5C;
    (beam.material as any).color.setHex(kc);
    const h = Math.max(0.18, keelY - bedY); beam.scale.set(1, h, 1); beam.position.set(0, (keelY + bedY) / 2 - boat.position.y, 0);
    glow.position.set(0, 2.4, z + 2); (glow.color as any).setHex(kc);
  }
  function frame(ts: number) {
    if (!running) return; if (!t0) t0 = ts; t = (ts - t0) / 1000;
    const wp = waterGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < wp.length; i += 3) { const bx = waterBase[i], by = waterBase[i + 1]; wp[i + 2] = Math.sin(bx * 0.5 + t * 1.25) * 0.075 + Math.cos(by * 0.4 + t * 0.85) * 0.06; }
    waterGeo.attributes.position.needsUpdate = true;
    placeBoat(worstX);                            // Boot an der bindenden (engsten) Stelle = Verdikt sichtbar
    (beam.material as any).opacity = 0.42 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.7));
    (mark.material as any).opacity = hasBad ? 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.1)) : 0;
    const ms = 1 + (hasBad ? 0.2 * (0.5 + 0.5 * Math.sin(t * 3.1)) : 0); mark.scale.set(ms, ms, ms);
    const wz = zOf(worstX);
    camera.position.set(Math.sin(t * 0.17) * 1.7, 3.7 + Math.sin(t * 0.22) * 0.24, wz + 9.5);
    camera.lookAt(0, -2.0, wz - 3.5);
    gl.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function renderOnce() { try { placeBoat(worstX); (mark.material as any).opacity = hasBad ? 0.4 : 0; const wz = zOf(worstX); camera.position.set(0, 3.7, wz + 9.5); camera.lookAt(0, -2.0, wz - 3.5); gl.render(scene, camera); } catch { /* */ } }
  function sync() { const want = onScreen && !document.hidden && !reduced; if (want && !running) { running = true; raf = requestAnimationFrame(frame); } else if (!want && running) { running = false; cancelAnimationFrame(raf); if (reduced) renderOnce(); } }
  try { io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }, { rootMargin: '160px' }); io.observe(canvas); } catch { onScreen = true; }
  document.addEventListener('visibilitychange', sync);

  resize(); build(); renderOnce(); onScreen = true; sync();

  return {
    update(s: D3State) { state = s; build(); if (reduced || !running) renderOnce(); },
    setReduced(r: boolean) { reduced = r; sync(); if (r) renderOnce(); },
    dispose() {
      running = false; cancelAnimationFrame(raf);
      try { io?.disconnect(); } catch { /* */ } try { ro?.disconnect(); } catch { /* */ }
      document.removeEventListener('visibilitychange', sync);
      [bedGeo, waterGeo, recGeo, hullGeo, beamGeo, markGeo].forEach(g => { try { g.dispose(); } catch { /* */ } });
      [bedMat, waterMat, recMat, hullMat, cabinMat, beamMat, markMat].forEach(m => { try { m.dispose(); } catch { /* */ } });
      try { gl.dispose(); } catch { /* */ }
    }
  };
}
