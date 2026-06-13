/* ═══ Wasserwelt 3.0 · Three.js · realistisches Tiefen-Wasser + Himmel ═══
 * Palette nach klarem Türkiswasser (Sandgrund→Türkis→Tiefblau), animierte Kaustik in der
 * Flachwasserzone, Fresnel-Himmelreflexion, Sonnen-/Mond-Glitzerpfad der dem ECHTEN Stand
 * von Sonne/Mond folgt (aus Sonnenauf-/untergang). Reagiert auf data-tod & data-wx.
 * Leichtgewichtig (low-power, kein Postprocessing). */
type V3 = [number, number, number];
interface Phase { top:V3; horizon:V3; sun:V3; sand:V3; shallow:V3; deep:V3; }
const PHASES: Record<string, Phase> = {
  dawn:  { top:[0.13,0.18,0.34], horizon:[0.92,0.52,0.32], sun:[1.0,0.74,0.44], sand:[0.46,0.46,0.44], shallow:[0.16,0.46,0.54], deep:[0.03,0.09,0.22] },
  day:   { top:[0.14,0.44,0.70], horizon:[0.58,0.80,0.92], sun:[1.0,0.97,0.82], sand:[0.50,0.60,0.54], shallow:[0.13,0.58,0.64], deep:[0.02,0.13,0.30] },
  dusk:  { top:[0.11,0.10,0.26], horizon:[0.92,0.42,0.30], sun:[1.0,0.57,0.37], sand:[0.42,0.36,0.40], shallow:[0.18,0.38,0.50], deep:[0.03,0.07,0.19] },
  night: { top:[0.01,0.04,0.11], horizon:[0.05,0.11,0.23], sun:[0.78,0.86,1.0], sand:[0.07,0.13,0.20], shallow:[0.04,0.18,0.32], deep:[0.01,0.04,0.11] },
};
const lerp3 = (a:V3,b:V3,k:number):V3 => [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k];
const toMin = (s?:string) => s ? +s.slice(0,2)*60 + +s.slice(3,5) : null;

/* Kontinuierlicher Sonnen-/Mondstand aus echten Auf-/Untergangszeiten:
 * gibt Höhe (-1..1, >0 = über Horizont) und Azimut (-1 Ost … +1 West). */
function celestial(): { elev:number; az:number; moon:boolean } {
  const w:any = (window as any).__wlw;
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes();
  const sr = toMin(w?.sunrise) ?? 5*60, su = toMin(w?.sunset) ?? 21*60+30;
  if (mins >= sr && mins <= su) {                       // Tag → Sonne
    const f = (mins - sr) / Math.max(su - sr, 1);        // 0..1
    return { elev: Math.sin(f*Math.PI), az: f*2-1, moon:false };
  }
  // Nacht → Mond (gespiegelter Bogen über die Nachtstunden)
  const nightLen = (24*60 - su) + sr;
  const m = mins > su ? mins - su : mins + (24*60 - su);
  const f = m / Math.max(nightLen, 1);
  return { elev: Math.sin(f*Math.PI)*0.8, az: f*2-1, moon:true };
}

export async function initWater3D() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const THREE = await import('three');
  const host = document.createElement('div'); host.id = 'water3d';
  document.body.prepend(host);
  const renderer = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:'low-power' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 220);
  cam.position.set(0, 3.0, 9.5); cam.lookAt(0, 0.9, -20);

  /* ── Himmel ── */
  const skyU = { top:{value:new THREE.Color()}, horizon:{value:new THREE.Color()},
    sun:{value:new THREE.Color()}, sunX:{value:0.0}, sunY:{value:0.4}, haze:{value:0.0}, moon:{value:0.0}, t:{value:0.0} };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16),
    new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, uniforms:skyU,
      vertexShader:`varying vec3 vd; void main(){ vd=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 top,horizon,sun; uniform float sunX,sunY,haze,moon,t; varying vec3 vd;
        void main(){ vec3 n=normalize(vd); float y=clamp(n.y*0.5+0.5,0.0,1.0);
          vec3 col=mix(horizon, top, smoothstep(0.46,0.94,y));
          vec3 sd=normalize(vec3(sunX*0.9, max(sunY,0.005), -1.0));
          float d=max(dot(n, sd),0.0);
          float disk = moon>0.5 ? pow(d,900.0)*0.85 : pow(d,300.0)*1.05;
          col += sun*disk;                                  /* Scheibe */
          col += sun*pow(d,7.0)*(moon>0.5?0.10:0.32);       /* weicher Hof */
          /* strahlender Sonnenschein: langsam rotierende Strahlen */
          float ang = atan(n.x - sd.x, n.y - sd.y);
          float rays = pow(d, 16.0) * (0.55 + 0.45*sin(ang*18.0 + t*0.5));
          col += sun * rays * (moon>0.5?0.05:0.16);
          col = mix(col, horizon, haze*0.55);
          gl_FragColor=vec4(col,1.0); }`,
    }));
  scene.add(sky);

  /* ── Wasser: Tiefenverlauf + Kaustik + Fresnel + Glitzerpfad ── */
  const geo = new THREE.PlaneGeometry(300, 220, 150, 100);
  const watU = { t:{value:0}, storm:{value:0}, sunX:{value:0.0}, sunElev:{value:0.5}, moon:{value:0.0},
    sand:{value:new THREE.Color()}, shallow:{value:new THREE.Color()}, deep:{value:new THREE.Color()},
    skyTop:{value:new THREE.Color()}, skyHor:{value:new THREE.Color()}, sun:{value:new THREE.Color()} };
  const mat = new THREE.ShaderMaterial({ transparent:true, uniforms:watU,
    vertexShader:`uniform float t,storm; varying float h; varying vec3 wp; varying float depth;
      void main(){ vec3 p=position;
        float amp=1.0+storm*1.7;
        /* Dünungs-Wellen rollen AUF DEN BETRACHTER ZU (Phase entlang p.y, läuft mit -t nach vorn).
           Kammlinien ~parallel zum Ufer, leicht versetzt — kein gleichfrequentes Gitter. */
        float w =  sin(p.y*0.150 - t*1.05 + sin(p.x*0.03)*0.6) * 0.46
                 + sin(p.y*0.305 - t*1.55 + sin(p.x*0.05)*0.5) * 0.22
                 + sin(p.y*0.560 - t*2.05 + p.x*0.045)        * 0.10
                 + sin(p.x*0.060 - p.y*0.02 - t*0.50)         * 0.13;   /* sanfte Quer-Dünung */
        w *= amp;
        depth = clamp(-p.y/100.0, 0.0, 1.0);              /* 0 = nah/flach … 1 = fern/tief */
        w *= mix(0.5, 1.0, depth);
        p.z += w; h=w; wp=p;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader:`uniform float t,storm,sunX,sunElev,moon;
      uniform vec3 sand,shallow,deep,skyTop,skyHor,sun; varying float h; varying vec3 wp; varying float depth;
      void main(){
        /* Tiefen-Farbe: Türkis (flach/nah) → Tiefblau (fern) */
        vec3 base = mix(shallow, deep, smoothstep(0.03, 0.70, depth));
        /* feiner Sandschimmer NUR im unmittelbaren Vordergrund */
        float nearMask = 1.0 - smoothstep(0.0, 0.13, depth);
        base = mix(base, sand, nearMask*0.16);
        /* organische Schaumkronen aus Wellenhöhe — KEIN Gitter */
        float foam = smoothstep(0.42, 0.95, h);
        base += vec3(0.72,0.93,0.96) * foam * 0.13 * (1.0 - storm*0.3);
        /* Fresnel dezent — Wasser behält seine Farbe */
        float fres = pow(depth, 1.7);
        vec3 refl = mix(skyHor, skyTop, depth*0.4);
        vec3 c = mix(base, refl, fres*0.30*(1.0-storm*0.4));
        /* Glitzerpfad zum Sonnen-/Mondstand (Azimut = sunX) */
        float path = exp(-abs(wp.x - sunX*70.0)*0.045) * smoothstep(-100.0, -4.0, wp.y);
        float spark = pow(max(h,0.0), 2.3) * (0.5+0.5*sin(wp.x*2.6 + t*3.1));
        float si = clamp(sunElev,0.0,1.0) * (moon>0.5?0.45:1.0);
        c += sun * (path*0.10 + path*spark*0.45) * si * (1.0-storm*0.6);
        gl_FragColor=vec4(c, 0.97); }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI/2; water.position.y = -0.6; scene.add(water);

  /* ── Schiff am Horizont (schlanke Motoryacht-Silhouette, zieht langsam vorbei) ── */
  const ship = new THREE.Group();
  const shipMat = new THREE.MeshBasicMaterial({ color:0x14252f, transparent:true, opacity:0.85 });
  /* langer, niedriger Rumpf mit spitzem Bug (rechts) — kein hoher Block */
  const hull = new THREE.Shape();
  hull.moveTo(-4.8,0.18); hull.lineTo(-4.6,1.02); hull.lineTo(3.4,1.02);
  hull.lineTo(6.4,0.74); hull.lineTo(3.2,0.10); hull.closePath();
  ship.add(new THREE.Mesh(new THREE.ShapeGeometry(hull), shipMat));
  /* flache, schräge Kabine vorn — niedrige Aufbauten */
  const cab = new THREE.Shape();
  cab.moveTo(-2.6,1.02); cab.lineTo(-2.0,1.74); cab.lineTo(1.7,1.74); cab.lineTo(2.7,1.02); cab.closePath();
  ship.add(new THREE.Mesh(new THREE.ShapeGeometry(cab), shipMat));
  /* kurze Antenne */
  const mast = new THREE.Mesh(new THREE.PlaneGeometry(0.07,1.2), shipMat); mast.position.set(2.1,2.3,0.01); ship.add(mast);
  ship.position.set(-26, -0.05, -92); ship.scale.setScalar(0.9); scene.add(ship);

  /* ── Vögel (V-Silhouetten, flattern & gleiten) ── */
  const birds: any[] = [];
  for (let i=0;i<5;i++){
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9),3));
    const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0x223240, transparent:true, opacity:0 }));
    ln.userData = { x:-34+Math.random()*68, y:13+Math.random()*12, z:-50-Math.random()*38, sp:0.5+Math.random()*0.6, fl:5+Math.random()*4, ph:Math.random()*7, sc:0.8+Math.random()*0.9 };
    scene.add(ln); birds.push(ln);
  }

  /* ── Sterne (nur nachts) ── */
  const sn = 240, spos = new Float32Array(sn*3);
  for (let i=0;i<sn;i++){ const r=125, th=Math.random()*Math.PI*2, ph=Math.random()*0.5;
    spos[i*3]=r*Math.cos(ph)*Math.cos(th); spos[i*3+1]=r*Math.sin(ph)+10; spos[i*3+2]=-Math.abs(r*Math.cos(ph)*Math.sin(th))-12; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos,3));
  const starMat = new THREE.PointsMaterial({ color:0xeaf4ff, size:0.4, transparent:true, opacity:0 });
  scene.add(new THREE.Points(sgeo, starMat));

  /* ── State + weiche Überblendung ── */
  let px=0, storm=0, snowing=0, sunX=0, sunY=0.4, sunElev=0.6, moon=0;
  const cur:Phase = JSON.parse(JSON.stringify(PHASES.day));
  const tgt = () => PHASES[(document.documentElement.dataset.tod||'day') as keyof typeof PHASES] || PHASES.day;
  addEventListener('pointermove', e => { px = e.clientX/innerWidth - 0.5; }, { passive:true });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); }, { passive:true });

  const clock = new THREE.Clock(); let frame=0;
  (function loop(){
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    const wx = document.body.dataset.wx || 'clear';
    const stT = wx==='storm'?1 : wx==='rain'?0.55 : (wx==='cloudy'||wx==='fog')?0.25 : 0;
    storm += (stT - storm)*0.012; snowing += ((wx==='snow'?1:0)-snowing)*0.02;
    /* Himmels-/Wasserfarben weich überblenden */
    const tp = tgt(), k = 0.012;
    cur.top=lerp3(cur.top,tp.top,k); cur.horizon=lerp3(cur.horizon,tp.horizon,k); cur.sun=lerp3(cur.sun,tp.sun,k);
    cur.sand=lerp3(cur.sand,tp.sand,k); cur.shallow=lerp3(cur.shallow,tp.shallow,k); cur.deep=lerp3(cur.deep,tp.deep,k);
    /* echten Sonnen-/Mondstand nur ~1×/s neu rechnen */
    if (frame++ % 60 === 0) { const c = celestial(); sunX += (c.az - sunX)*1; sunElev += (Math.max(c.elev,0) - sunElev)*1; moon += ((c.moon?1:0)-moon)*1; }
    sunY += (Math.max(sunElev*0.55+0.04, 0.02) - sunY)*0.05;
    skyU.top.value.setRGB(...cur.top); skyU.horizon.value.setRGB(...cur.horizon); skyU.sun.value.setRGB(...cur.sun);
    skyU.sunX.value=sunX; skyU.sunY.value=sunY; skyU.haze.value=Math.max(storm, snowing*0.6); skyU.moon.value=moon;
    watU.t.value=t; watU.storm.value=storm; watU.sunX.value=sunX; watU.sunElev.value=sunElev; watU.moon.value=moon;
    watU.sand.value.setRGB(...cur.sand); watU.shallow.value.setRGB(...cur.shallow); watU.deep.value.setRGB(...cur.deep);
    watU.skyTop.value.setRGB(...cur.top); watU.skyHor.value.setRGB(...cur.horizon); watU.sun.value.setRGB(...cur.sun);
    skyU.t.value = t;
    const night = document.documentElement.dataset.tod === 'night';
    const dayl = night ? 0.0 : 1.0;
    /* Sterne funkeln (nur nachts) */
    starMat.opacity += ((night ? 0.9*(0.78+0.22*Math.sin(t*2.5)) : 0) - starMat.opacity)*0.04;
    /* Schiff am Horizont: langsam ziehen + leicht schaukeln */
    ship.position.x += 0.018 + storm*0.012; if (ship.position.x > 34) ship.position.x = -34;
    ship.position.y = -0.05 + Math.sin(t*0.5)*(0.09+storm*0.18);
    ship.rotation.z = Math.sin(t*0.5)*0.02;
    (shipMat as any).opacity += ((0.5 + 0.35*dayl) - (shipMat as any).opacity)*0.02;
    /* Vögel: Flügelschlag + Gleiten */
    for (const b of birds){ const u=b.userData; u.x += u.sp*0.03; if (u.x>40) u.x=-40;
      const flap = Math.sin(t*u.fl + u.ph)*0.9*u.sc;
      const pos = b.geometry.attributes.position.array as Float32Array;
      pos[0]=-1.1*u.sc; pos[1]=flap; pos[3]=0; pos[4]=0.20*u.sc; pos[6]=1.1*u.sc; pos[7]=flap;
      b.geometry.attributes.position.needsUpdate = true;
      b.position.set(u.x, u.y + Math.sin(t*0.3+u.ph)*0.6, u.z);
      (b.material as any).opacity += ((0.42*dayl) - (b.material as any).opacity)*0.02;
    }
    /* dezentes Bootsschaukeln */
    cam.position.x += (px*1.4 - cam.position.x)*0.03;
    cam.position.y = 3.0 + Math.sin(t*0.4)*(0.06+storm*0.10);
    cam.rotation.z = Math.sin(t*0.3)*(0.003+storm*0.006);
    renderer.render(scene, cam);
  })();
}
