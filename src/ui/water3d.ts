/* ═══ Wasserwelt 3.0 · Three.js · Himmel + reflektierendes Wasser, 4 Tagesphasen + Wetter ═══
 * Reagiert auf data-tod (dawn|day|dusk|night) und data-wx (clear|cloudy|rain|storm|snow|fog).
 * Bewusst leichtgewichtig (low-power, kein Postprocessing) — seriös, nicht verspielt. */
type V3 = [number, number, number];
interface Phase { top: V3; horizon: V3; sun: V3; sunY: number; waterDeep: V3; waterCrest: V3; }
const PHASES: Record<string, Phase> = {
  dawn:  { top:[0.16,0.20,0.34], horizon:[0.95,0.55,0.32], sun:[1.0,0.72,0.42], sunY:0.06, waterDeep:[0.07,0.11,0.20], waterCrest:[0.55,0.42,0.40] },
  day:   { top:[0.18,0.45,0.66], horizon:[0.62,0.82,0.92], sun:[1.0,0.96,0.80], sunY:0.42, waterDeep:[0.03,0.13,0.24], waterCrest:[0.16,0.52,0.70] },
  dusk:  { top:[0.12,0.10,0.26], horizon:[0.92,0.42,0.30], sun:[1.0,0.55,0.36], sunY:0.05, waterDeep:[0.05,0.07,0.17], waterCrest:[0.45,0.26,0.36] },
  night: { top:[0.02,0.05,0.12], horizon:[0.06,0.12,0.24], sun:[0.70,0.80,1.0], sunY:0.30, waterDeep:[0.012,0.05,0.11], waterCrest:[0.10,0.20,0.38] },
};
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k];

export async function initWater3D() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const THREE = await import('three');
  const host = document.createElement('div'); host.id = 'water3d';
  document.body.prepend(host);
  const renderer = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:'low-power' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 200);
  cam.position.set(0, 3.1, 9.5); cam.lookAt(0, 1.0, -20);

  /* ── Himmel: großer Dome hinter der Szene, Verlauf + Sonne/Glow via Shader ── */
  const skyU = {
    top:{value:new THREE.Color()}, horizon:{value:new THREE.Color()},
    sun:{value:new THREE.Color()}, sunY:{value:0.4}, haze:{value:0.0},
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite:false,
      uniforms: skyU,
      vertexShader:`varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform float sunY; uniform float haze; varying vec3 vd;
        void main(){
          float y = clamp(vd.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(horizon, top, smoothstep(0.48, 0.92, y));
          /* Sonne/Mond am Horizont (vorne, -z) */
          vec3 sundir = normalize(vec3(0.0, sunY, -1.0));
          float d = max(dot(normalize(vd), sundir), 0.0);
          col += sun * pow(d, 220.0) * 0.9;                 /* Scheibe */
          col += sun * pow(d, 8.0) * 0.28;                  /* Glow */
          col = mix(col, horizon, haze*0.5);                /* Nebel/Wolken: flacher */
          gl_FragColor = vec4(col, 1.0); }`,
    })
  );
  scene.add(sky);

  /* ── Wasser: Wellen + Sky-Reflexion (Fresnel) + Sonnenglitzer-Pfad ── */
  const geo = new THREE.PlaneGeometry(260, 200, 140, 90);
  const watU = {
    t:{value:0}, storm:{value:0},
    deep:{value:new THREE.Color()}, crest:{value:new THREE.Color()},
    skyTop:{value:new THREE.Color()}, skyHor:{value:new THREE.Color()}, sun:{value:new THREE.Color()}, sunY:{value:0.4},
  };
  const mat = new THREE.ShaderMaterial({ transparent:true, uniforms: watU,
    vertexShader:`uniform float t; uniform float storm; varying float h; varying vec3 wp;
      void main(){ vec3 p = position;
        float amp = 1.0 + storm*1.6;
        float w = (sin(p.x*0.10 + t*0.9)*0.34 + sin(p.y*0.13 - t*0.6)*0.28
                 + sin((p.x+p.y)*0.06 + t*0.45)*0.46 + sin(p.x*0.38 + t*(1.6+storm))*0.08) * amp;
        p.z += w; h = w; wp = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader:`uniform float t; uniform float storm;
      uniform vec3 deep; uniform vec3 crest; uniform vec3 skyTop; uniform vec3 skyHor; uniform vec3 sun; uniform float sunY;
      varying float h; varying vec3 wp;
      void main(){
        vec3 base = mix(deep, crest, smoothstep(-0.7, 1.0, h));
        /* Fresnel: flacher Blickwinkel zum Horizont → mehr Himmelreflexion */
        float dist = clamp(-wp.y / 90.0, 0.0, 1.0);
        float fres = pow(dist, 1.4);
        vec3 refl = mix(skyHor, skyTop, dist*0.5);
        vec3 c = mix(base, refl, fres*0.62*(1.0-storm*0.5));
        /* Sonnenglitzer-Pfad zur Sonne (mittig, nach hinten) */
        float path = exp(-abs(wp.x)*0.05) * smoothstep(-90.0, 0.0, wp.y);
        float spark = pow(max(h,0.0), 2.5) * (0.5 + 0.5*sin(wp.x*2.4 + t*3.0));
        c += sun * (path*0.10 + path*spark*0.4) * (1.0 - storm*0.6);
        float a = 0.96;
        gl_FragColor = vec4(c, a); }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI/2; water.position.y = -0.6; scene.add(water);

  /* ── Sterne (nur nachts sichtbar via Opacity) ── */
  const sn = 220, spos = new Float32Array(sn*3);
  for (let i=0;i<sn;i++){ const r=110, th=Math.random()*Math.PI*2, ph=Math.random()*0.5;
    spos[i*3]=r*Math.cos(ph)*Math.cos(th); spos[i*3+1]=r*Math.sin(ph)+8; spos[i*3+2]=-Math.abs(r*Math.cos(ph)*Math.sin(th))-10; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos,3));
  const starMat = new THREE.PointsMaterial({ color:0xdfefff, size:0.35, transparent:true, opacity:0 });
  scene.add(new THREE.Points(sgeo, starMat));

  /* ── State + Phasen-Interpolation ── */
  let px = 0, storm = 0, snowing = 0;
  const cur: Phase = JSON.parse(JSON.stringify(PHASES.day));
  function targetPhase(): Phase {
    const tod = (document.documentElement.dataset.tod || 'day') as keyof typeof PHASES;
    return PHASES[tod] || PHASES.day;
  }
  addEventListener('pointermove', e => { px = e.clientX/innerWidth - 0.5; }, { passive:true });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }, { passive:true });

  const clock = new THREE.Clock();
  (function loop(){
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    const wx = document.body.dataset.wx || 'clear';
    const stT = wx==='storm'?1 : wx==='rain'?0.55 : (wx==='cloudy'||wx==='fog')?0.25 : 0;
    storm += (stT - storm) * 0.012;
    snowing += ((wx==='snow'?1:0) - snowing) * 0.02;
    /* Phase weich überblenden (1,2 s) */
    const tp = targetPhase();
    const k = 0.012;
    cur.top = lerp3(cur.top, tp.top, k); cur.horizon = lerp3(cur.horizon, tp.horizon, k);
    cur.sun = lerp3(cur.sun, tp.sun, k); cur.sunY += (tp.sunY - cur.sunY) * k;
    cur.waterDeep = lerp3(cur.waterDeep, tp.waterDeep, k); cur.waterCrest = lerp3(cur.waterCrest, tp.waterCrest, k);
    skyU.top.value.setRGB(...cur.top); skyU.horizon.value.setRGB(...cur.horizon);
    skyU.sun.value.setRGB(...cur.sun); skyU.sunY.value = cur.sunY; skyU.haze.value = Math.max(storm, snowing*0.6);
    watU.t.value = t; watU.storm.value = storm;
    watU.deep.value.setRGB(...cur.waterDeep); watU.crest.value.setRGB(...cur.waterCrest);
    watU.skyTop.value.setRGB(...cur.top); watU.skyHor.value.setRGB(...cur.horizon);
    watU.sun.value.setRGB(...cur.sun); watU.sunY.value = cur.sunY;
    starMat.opacity += (((document.documentElement.dataset.tod==='night')?0.85:0) - starMat.opacity) * 0.02;
    /* dezentes Bootsschaukeln, bei Wetter stärker */
    cam.position.x += (px*1.4 - cam.position.x) * 0.03;
    cam.position.y = 3.1 + Math.sin(t*0.4) * (0.06 + storm*0.10);
    cam.rotation.z = Math.sin(t*0.3) * (0.003 + storm*0.006);
    renderer.render(scene, cam);
  })();
}
