/* ═══ Lebendige Wasserwelt · Three.js, lazy, reagiert auf Tageszeit (data-tod) + Wetter (data-wx) ═══ */
export async function initWater3D() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const THREE = await import('three');
  const host = document.createElement('div'); host.id = 'water3d';
  document.body.prepend(host);
  const renderer = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:'low-power' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 0.1, 120);
  cam.position.set(0, 3.1, 9.5); cam.lookAt(0, 0, -6);
  const geo = new THREE.PlaneGeometry(90, 60, 110, 70);
  const mat = new THREE.ShaderMaterial({ transparent:true,
    uniforms: { t:{value:0}, night:{value:0}, storm:{value:0} },
    vertexShader: `uniform float t; uniform float storm; varying float h; varying vec3 wp;
      void main(){ vec3 p = position;
        float amp = 1.0 + storm*1.5;
        float w = (sin(p.x*0.42 + t*0.9)*0.32 + sin(p.y*0.5 - t*0.62)*0.26
                + sin((p.x+p.y)*0.21 + t*0.45)*0.42 + sin(p.x*1.7 + t*(1.7+storm))*0.07) * amp;
        p.z += w; h = w; wp = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `uniform float t; uniform float night; uniform float storm; varying float h; varying vec3 wp;
      void main(){
        vec3 deep  = mix(vec3(0.03,0.13,0.22), vec3(0.012,0.05,0.11), night);
        vec3 crest = mix(vec3(0.13,0.55,0.72), vec3(0.18,0.34,0.55), night);
        crest = mix(crest, vec3(0.32,0.40,0.46), storm*0.7);  /* Wetter: graues Wasser */
        vec3 c = mix(deep, crest, smoothstep(-0.6, 0.9, h));
        float beam = exp(-abs(wp.x - sin(t*0.05)*6.0)*0.16) * smoothstep(-30.0, 8.0, wp.y);
        vec3 beamC = mix(vec3(1.0,0.82,0.45), vec3(0.75,0.85,1.0), night);
        c += beamC * beam * (0.16 + 0.12*smoothstep(0.2,0.9,h)) * (1.0 - storm*0.6);
        float sp = pow(max(h,0.0), 3.0) * (0.5 + 0.5*sin(wp.x*9.0 + t*3.0));
        c += beamC * sp * 0.18 * (1.0 - storm*0.5);
        float a = 0.92 - smoothstep(8.0,-38.0,wp.y)*0.0;  /* volle Fläche */
        gl_FragColor = vec4(c, a); }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI/2; water.position.y = -0.6; scene.add(water);
  const pn = 60, pos = new Float32Array(pn*3);
  for (let i=0;i<pn;i++){ pos[i*3]=(Math.random()-0.5)*60; pos[i*3+1]=Math.random()*6+0.5; pos[i*3+2]=-Math.random()*40; }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ color:0x8fe9ff, size:0.12, transparent:true, opacity:0.5 }));
  scene.add(pts);
  let px = 0;
  addEventListener('pointermove', e => { px = e.clientX/innerWidth - 0.5; }, { passive:true });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }, { passive:true });
  const clock = new THREE.Clock(); let storm = 0;
  (function loop(){
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    const wx = document.body.dataset.wx || 'clear';
    const target = wx==='storm' ? 1 : wx==='rain' ? 0.55 : wx==='cloudy' ? 0.2 : 0;
    storm += (target - storm) * 0.01;                       /* Wetterlayer: weiche Überblendung */
    (mat.uniforms.t as any).value = t;
    (mat.uniforms.storm as any).value = storm;
    (mat.uniforms.night as any).value = document.documentElement.dataset.tod === 'night' ? 1 : 0;
    cam.position.x += (px*1.6 - cam.position.x) * 0.03;
    cam.position.y = 3.1 + Math.sin(t*0.4) * (0.07 + storm*0.1);   /* Bootsschaukeln, bei Wetter stärker */
    cam.rotation.z = Math.sin(t*0.3) * (0.004 + storm*0.006);
    pts.rotation.y = t*0.008;
    renderer.render(scene, cam);
  })();
}
