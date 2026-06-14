/* ═══ Wasserwelt 3.0 · Fotorealer Live-Hintergrund ═══
 * Zwei animierte Sektionen: oben tageszeit-live-animierter Himmel (Sonnen-/Mondbogen aus echten
 * Sonnenauf-/untergangszeiten, Wolken, Sterne, Sternschnuppe, weiche Sonnenstrahlen) + viele Vögel
 * (einzelne Möwen + ziehende V-Formation, Vorlagen-Stil); unten echtes Wasser-Video-Loop (Tag/Nacht),
 * weicher Horizont-Blend. Leichtgewichtig: CSS-Animationen + 1×/min Sonnenstand-Update, KEIN WebGL. */
const HORIZON = 52;
function srss(){ const w:any=(window as any).__wlw; const toM=(s?:string)=> s?(+s.slice(0,2))*60+(+s.slice(3,5)):null; return { sr: toM(w?.sunrise) ?? 330, ss: toM(w?.sunset) ?? 1290 }; }
const SKY:Record<string,string> = {
  dawn:'linear-gradient(180deg,#1a2f5c 0%,#3f4f86 30%,#e8915a 78%,#ffd6a0 100%)',
  day:'linear-gradient(180deg,#2f6fb0 0%,#67a6d8 45%,#bfe0ef 84%,#e8f4fb 100%)',
  dusk:'linear-gradient(180deg,#241a47 0%,#5b3f74 32%,#e0613a 80%,#ffb06a 100%)',
  night:'linear-gradient(180deg,#02040e 0%,#061026 45%,#0b1c3a 82%,#12233f 100%)'};
const WGRADE:Record<string,string> = { dawn:'linear-gradient(180deg,rgba(255,180,110,.40),rgba(20,60,90,.15))',day:'linear-gradient(180deg,rgba(150,200,235,.30),rgba(10,50,80,.10))',dusk:'linear-gradient(180deg,rgba(255,140,80,.42),rgba(20,30,70,.20))',night:'linear-gradient(180deg,rgba(8,18,44,.62),rgba(2,8,20,.55))'};
const HAZE:Record<string,string> = { dawn:'rgba(255,190,120,.55)',day:'rgba(200,228,245,.45)',dusk:'rgba(255,150,90,.55)',night:'rgba(90,120,180,.30)'};
const SILH:Record<string,string> = { dawn:'#173049',day:'#15314a',dusk:'#241a3a',night:'#9fb4cc'};
function phase(m:number,sr:number,ss:number){ if(m>=sr-45&&m<=sr+45)return'dawn'; if(m>=ss-45&&m<=ss+45)return'dusk'; if(m>sr+45&&m<ss-45)return'day'; return'night'; }

const CSS = `
#water3d #wl-sky{position:absolute;left:0;right:0;top:0;height:56%;transition:background 1.6s ease;will-change:background}
#water3d .wl-cloud{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1.6s ease;background-repeat:no-repeat;will-change:transform}
#water3d #wl-cloudA{background:radial-gradient(440px 56px at 22% 36%,rgba(255,255,255,.18),transparent 70%),radial-gradient(520px 64px at 64% 24%,rgba(255,255,255,.13),transparent 70%);animation:wlDriftA 90s linear infinite}
#water3d #wl-cloudB{background:radial-gradient(360px 44px at 42% 48%,rgba(255,255,255,.12),transparent 70%),radial-gradient(300px 40px at 84% 40%,rgba(255,255,255,.10),transparent 72%);animation:wlDriftB 140s linear infinite}
@keyframes wlDriftA{0%{transform:translateX(-6%)}100%{transform:translateX(106%)}}
@keyframes wlDriftB{0%{transform:translateX(110%)}100%{transform:translateX(-10%)}}
#water3d #wl-stars{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1.6s ease;background-image:radial-gradient(1.5px 1.5px at 12% 22%,#fff,transparent),radial-gradient(1.2px 1.2px at 26% 38%,#fff,transparent),radial-gradient(1.6px 1.6px at 44% 16%,#fff,transparent),radial-gradient(1.1px 1.1px at 60% 30%,#dfe9ff,transparent),radial-gradient(1.5px 1.5px at 76% 14%,#fff,transparent),radial-gradient(1.2px 1.2px at 88% 34%,#fff,transparent),radial-gradient(1px 1px at 34% 9%,#fff,transparent),radial-gradient(1.3px 1.3px at 69% 7%,#fff,transparent),radial-gradient(1px 1px at 52% 44%,#fff,transparent),radial-gradient(1.1px 1.1px at 16% 52%,#fff,transparent),radial-gradient(1.2px 1.2px at 7% 12%,#fff,transparent),radial-gradient(1px 1px at 92% 20%,#fff,transparent);animation:wlTwinkle 4.5s ease-in-out infinite alternate}
@keyframes wlTwinkle{from{opacity:.5}to{opacity:1}}
#water3d #wl-shoot{position:absolute;top:14%;left:-8%;width:120px;height:1.6px;border-radius:2px;opacity:0;pointer-events:none;background:linear-gradient(90deg,transparent,#fff);transform:rotate(16deg)}
#water3d #wl-sun{position:absolute;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);filter:blur(1px);z-index:3;transition:opacity 1.2s ease,background 1.2s ease}
#water3d #wl-rays{position:absolute;width:520px;height:520px;pointer-events:none;transform:translate(-50%,-50%);z-index:2;mix-blend-mode:screen;transition:opacity 1.4s ease;opacity:0;animation:wlSpin 90s linear infinite;background:conic-gradient(from 0deg,transparent 0deg,rgba(255,240,200,.16) 8deg,transparent 16deg,transparent 34deg,rgba(255,240,200,.12) 40deg,transparent 48deg,transparent 80deg,rgba(255,240,200,.15) 86deg,transparent 94deg,transparent 140deg,rgba(255,240,200,.11) 146deg,transparent 154deg,transparent 210deg,rgba(255,240,200,.14) 216deg,transparent 224deg,transparent 290deg,rgba(255,240,200,.11) 296deg,transparent 304deg,transparent 360deg);-webkit-mask-image:radial-gradient(circle,#000 0%,transparent 62%);mask-image:radial-gradient(circle,#000 0%,transparent 62%)}
@keyframes wlSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
#water3d #wl-birds{position:absolute;inset:0;z-index:3;pointer-events:none;transition:opacity 1.6s ease}
#water3d .wl-bird{position:absolute;will-change:transform}
#water3d .wl-bird svg{display:block;overflow:visible}
#water3d .wl-wing{fill:none;stroke:var(--wl-silh,#15314a);stroke-width:2.4;stroke-linecap:round;transform-origin:center;animation:wlFlap 1.1s ease-in-out infinite;transition:stroke 1.2s ease}
@keyframes wlFlap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.4)}}
#water3d #wl-b1{animation:wlG1 42s linear infinite}#water3d #wl-b2{animation:wlG2 58s linear infinite}#water3d #wl-b3{animation:wlG3 66s linear infinite}
#water3d #wl-b4{animation:wlG4 50s linear infinite}#water3d #wl-b5{animation:wlG5 74s linear infinite}#water3d #wl-b6{animation:wlG6 46s linear infinite}
#water3d #wl-b2 .wl-wing{animation-duration:1.3s}#water3d #wl-b3 .wl-wing{animation-duration:1.6s}#water3d #wl-b4 .wl-wing{animation-duration:1s}#water3d #wl-b5 .wl-wing{animation-duration:.9s}#water3d #wl-b6 .wl-wing{animation-duration:1.2s}
@keyframes wlG1{0%{transform:translate(-12vw,22vh) scale(.95)}50%{transform:translate(50vw,15vh) scale(.95)}100%{transform:translate(112vw,20vh) scale(.95)}}
@keyframes wlG2{0%{transform:translate(114vw,12vh) scale(.6)}50%{transform:translate(48vw,18vh) scale(.6)}100%{transform:translate(-16vw,10vh) scale(.6)}}
@keyframes wlG3{0%{transform:translate(-16vw,9vh) scale(1.15)}50%{transform:translate(50vw,13vh) scale(1.15)}100%{transform:translate(116vw,8vh) scale(1.15)}}
@keyframes wlG4{0%{transform:translate(116vw,30vh) scale(.78)}50%{transform:translate(50vw,26vh) scale(.78)}100%{transform:translate(-16vw,32vh) scale(.78)}}
@keyframes wlG5{0%{transform:translate(-10vw,7vh) scale(.5)}50%{transform:translate(50vw,11vh) scale(.5)}100%{transform:translate(110vw,6vh) scale(.5)}}
@keyframes wlG6{0%{transform:translate(112vw,25vh) scale(.85)}50%{transform:translate(50vw,19vh) scale(.85)}100%{transform:translate(-14vw,26vh) scale(.85)}}
#water3d #wl-flock{position:absolute;left:0;top:0;animation:wlFlock 115s linear infinite}
#water3d #wl-flock .wl-bird{transform:scale(.5)}
#water3d #wl-flock .wl-wing{animation-duration:.85s}
@keyframes wlFlock{0%{transform:translate(-18vw,11vh)}100%{transform:translate(118vw,7vh)}}
#water3d #wl-haze{position:absolute;left:0;right:0;top:52%;height:11%;transform:translateY(-50%);pointer-events:none;z-index:2;transition:background 1.6s ease;mix-blend-mode:screen;filter:blur(3px)}
#water3d #wl-waterwrap{position:absolute;left:0;right:0;top:48%;bottom:0;overflow:hidden;z-index:1;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 17%,#000 100%);mask-image:linear-gradient(to bottom,transparent 0%,#000 17%,#000 100%)}
#water3d .wl-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 1.4s ease,filter 1.6s ease;will-change:opacity}
#water3d #wl-wgrade{position:absolute;inset:0;pointer-events:none;transition:background 1.6s ease;mix-blend-mode:soft-light}
#water3d #wl-glint{position:absolute;top:0;width:120px;height:100%;pointer-events:none;transform:translateX(-50%);mix-blend-mode:screen;filter:blur(7px);transition:opacity 1.2s ease,background 1.2s ease}
#water3d #wl-vign{position:absolute;inset:0;pointer-events:none;z-index:4;background:radial-gradient(125% 96% at 50% 42%,transparent 56%,rgba(2,10,18,.52) 100%)}
.hero-sky,.hero-stars,.hero-waves{display:none!important}
#wl-scrim{position:fixed;inset:0;z-index:0;pointer-events:none;background:#06121f;opacity:.12;transition:opacity .25s linear}
.sect>h2,.sect>p,.sect>.lead,.sect>.sub,.hero h1,.hero h2,.hero p,.hero .sub,#ziel>h2{text-shadow:0 1px 11px rgba(3,14,26,.62)}
@media (prefers-reduced-motion:reduce){#water3d *{animation:none!important}}
`;
const BIRD = '<svg width="34" height="14" viewBox="0 0 34 14"><path class="wl-wing" d="M1 11 Q9 1 17 8 Q25 1 33 11"/></svg>';
const DOM = `
<div id="wl-sky"><div id="wl-cloudA" class="wl-cloud"></div><div id="wl-cloudB" class="wl-cloud"></div><div id="wl-stars"></div><div id="wl-shoot"></div></div>
<div id="wl-rays"></div><div id="wl-sun"></div>
<div id="wl-birds">
  <div id="wl-b1" class="wl-bird">`+BIRD+`</div><div id="wl-b2" class="wl-bird">`+BIRD+`</div><div id="wl-b3" class="wl-bird">`+BIRD+`</div>
  <div id="wl-b4" class="wl-bird">`+BIRD+`</div><div id="wl-b5" class="wl-bird">`+BIRD+`</div><div id="wl-b6" class="wl-bird">`+BIRD+`</div>
  <div id="wl-flock">
    <div class="wl-bird" style="left:28px;top:0">`+BIRD+`</div>
    <div class="wl-bird" style="left:16px;top:7px">`+BIRD+`</div><div class="wl-bird" style="left:40px;top:7px">`+BIRD+`</div>
    <div class="wl-bird" style="left:5px;top:14px">`+BIRD+`</div><div class="wl-bird" style="left:51px;top:14px">`+BIRD+`</div>
  </div>
</div>
<div id="wl-haze"></div>
<div id="wl-waterwrap"><video id="wl-vday" class="wl-vid" autoplay loop muted playsinline preload="auto" src="/water_day.mp4"></video><video id="wl-vnight" class="wl-vid" autoplay loop muted playsinline preload="auto" src="/water_night.mp4" style="opacity:0"></video><div id="wl-glint"></div><div id="wl-wgrade"></div></div>
<div id="wl-vign"></div>`;

export function initWater3D(){
  if (document.getElementById('water3d')) return;
  const st = document.createElement('style'); st.id='wl-bg-css'; st.textContent=CSS; document.head.appendChild(st);
  const host = document.createElement('div'); host.id='water3d'; host.innerHTML=DOM; document.body.prepend(host);
  const q = (s:string)=> host.querySelector(s) as HTMLElement;
  const sky=q('#wl-sky'), sun=q('#wl-sun'), rays=q('#wl-rays'), haze=q('#wl-haze'), cloudA=q('#wl-cloudA'), cloudB=q('#wl-cloudB'),
        stars=q('#wl-stars'), shoot=q('#wl-shoot'), glint=q('#wl-glint'), wgrade=q('#wl-wgrade'), birds=q('#wl-birds');
  const vDay=q('#wl-vday') as HTMLVideoElement, vNight=q('#wl-vnight') as HTMLVideoElement;
  let shootOn=false;
  function scheduleShoot(){ if(!shootOn) return; try{ shoot.animate([{transform:'rotate(16deg) translateX(0)',opacity:0},{opacity:1,offset:.1},{transform:'rotate(16deg) translateX(70vw)',opacity:0}],{duration:1300,easing:'ease-in'}); }catch(e){} setTimeout(scheduleShoot, 9000+Math.random()*9000); }
  function render(){
    const {sr,ss}=srss(); const now=new Date(); const m=now.getHours()*60+now.getMinutes();
    const p=phase(m,sr,ss), night=p==='night';
    sky.style.background=SKY[p]; cloudA.style.opacity=night?'0':'0.85'; cloudB.style.opacity=night?'0':'0.7';
    stars.style.opacity=night?'0.95':'0'; vNight.style.opacity=night?'1':'0'; vDay.style.opacity=night?'0':'1';
    wgrade.style.background=WGRADE[p]; host.style.setProperty('--wl-silh',SILH[p]); birds.style.opacity=night?'0.5':'1';
    let isMoon:boolean, f:number;
    if(m>=sr&&m<=ss){ isMoon=false; f=(m-sr)/Math.max(ss-sr,1); }
    else { isMoon=true; const nl=(1440-ss)+sr, mm=m>ss?m-ss:m+(1440-ss); f=mm/Math.max(nl,1); }
    const elev=Math.sin(f*Math.PI), x=6+f*88, y=HORIZON-elev*(HORIZON-8);
    sun.style.left=x+'%'; sun.style.top=y+'%'; rays.style.left=x+'%'; rays.style.top=y+'%';
    const dia=120+elev*70; sun.style.width=sun.style.height=(isMoon?120:dia)+'px';
    glint.style.left=x+'%'; haze.style.background='radial-gradient(60% 100% at '+x+'% 50%,'+HAZE[p]+',transparent 70%)';
    if(isMoon){ sun.style.background='radial-gradient(circle,rgba(238,245,255,.98),rgba(205,222,255,.45) 30%,rgba(180,205,255,0) 70%)'; sun.style.opacity='0.92'; rays.style.opacity='0'; glint.style.background='linear-gradient(180deg,rgba(220,232,255,.45),rgba(180,205,255,0))'; glint.style.opacity='0.45'; }
    else { const warm=p==='day'?'255,247,220':'255,193,120'; sun.style.background='radial-gradient(circle,rgba('+warm+',1),rgba('+warm+',.5) 28%,rgba('+warm+',0) 70%)'; sun.style.opacity=String(Math.max(.4,elev)); rays.style.opacity=String(Math.max(0,elev*(p==='day'?.5:.65))); glint.style.background='linear-gradient(180deg,rgba('+warm+',.7),rgba('+warm+',0))'; glint.style.opacity=String(Math.max(.25,elev*.85)); }
    if(night){ if(!shootOn){ shootOn=true; scheduleShoot(); } } else shootOn=false;
  }
  render(); setInterval(render, 60000);
  document.addEventListener('visibilitychange', ()=>{ const h=document.hidden; [vDay,vNight].forEach(v=>{ try{ h? v.pause(): v.play().catch(()=>{}); }catch(e){} }); });
  requestAnimationFrame(()=> requestAnimationFrame(()=> host.classList.add('ready')));
  const scrim=document.createElement('div'); scrim.id='wl-scrim'; document.body.appendChild(scrim);
  let _st=false; const sc=()=>{ _st=false; scrim.style.opacity=String(Math.min(.56, .12 + (window.scrollY/Math.max(innerHeight*0.7,1))*0.5)); };
  addEventListener('scroll', ()=>{ if(!_st){ _st=true; requestAnimationFrame(sc); } }, {passive:true}); sc();
}
