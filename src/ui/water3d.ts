/* ═══ Wasserwelt 3.0 · Fotorealer Live-Hintergrund ═══
 * Zwei animierte Sektionen: oben tageszeit-live-animierter Himmel (Sonnen-/Mondbogen aus echten
 * Sonnenauf-/untergangszeiten), unten echtes Wasser-Video-Loop (Tag/Nacht), weicher Horizont-Blend,
 * dazu animiertes Boot + Vögel (Vorlagen-Stil). Leichtgewichtig: CSS-Animationen + 1×/min
 * Sonnenstand-Update, KEIN WebGL, kein rAF-Dauerloop. Faded weich ein, pausiert Videos im Hintergrund. */
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
#water3d .wl-bird{position:absolute;z-index:3;pointer-events:none;will-change:transform}
#water3d .wl-bird svg{display:block;overflow:visible}
#water3d .wl-wing{fill:none;stroke:var(--wl-silh,#15314a);stroke-width:2.4;stroke-linecap:round;transform-origin:center;animation:wlFlap 1.1s ease-in-out infinite;transition:stroke 1.2s ease}
#water3d #wl-b1{animation:wlGlide1 46s linear infinite}#water3d #wl-b2{animation:wlGlide2 60s linear infinite}#water3d #wl-b3{animation:wlGlide3 53s linear infinite}
#water3d #wl-b2 .wl-wing{animation-duration:1.35s}#water3d #wl-b3 .wl-wing{animation-duration:.95s}
@keyframes wlFlap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.42)}}
@keyframes wlGlide1{0%{transform:translate(-12vw,20vh) scale(.9)}100%{transform:translate(112vw,9vh) scale(.9)}}
@keyframes wlGlide2{0%{transform:translate(114vw,13vh) scale(.62)}100%{transform:translate(-14vw,24vh) scale(.62)}}
@keyframes wlGlide3{0%{transform:translate(-14vw,30vh) scale(1.05)}100%{transform:translate(116vw,17vh) scale(1.05)}}
#water3d #wl-haze{position:absolute;left:0;right:0;top:52%;height:11%;transform:translateY(-50%);pointer-events:none;z-index:2;transition:background 1.6s ease;mix-blend-mode:screen;filter:blur(3px)}
#water3d #wl-boat{position:absolute;left:50%;top:52%;z-index:3;pointer-events:none;width:96px;transform:translate(-50%,-78%);animation:wlBoatDrift 120s ease-in-out infinite}
#water3d #wl-boat .wl-bobber{animation:wlBob 4.6s ease-in-out infinite;transform-origin:center bottom}
#water3d #wl-boat path,#water3d #wl-boat line{fill:var(--wl-silh,#15314a);stroke:var(--wl-silh,#15314a);transition:fill 1.2s ease,stroke 1.2s ease}
#water3d #wl-boat .wl-wake{fill:none;stroke:var(--wl-silh,#15314a);stroke-width:1.6;stroke-linecap:round;opacity:.5}
@keyframes wlBob{0%,100%{transform:translateY(0) rotate(-.6deg)}50%{transform:translateY(-3px) rotate(.6deg)}}
@keyframes wlBoatDrift{0%{left:34%}50%{left:64%}100%{left:34%}}
#water3d #wl-waterwrap{position:absolute;left:0;right:0;top:48%;bottom:0;overflow:hidden;z-index:1;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 17%,#000 100%);mask-image:linear-gradient(to bottom,transparent 0%,#000 17%,#000 100%)}
#water3d .wl-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 1.4s ease,filter 1.6s ease;will-change:opacity}
#water3d #wl-wgrade{position:absolute;inset:0;pointer-events:none;transition:background 1.6s ease;mix-blend-mode:soft-light}
#water3d #wl-glint{position:absolute;top:0;width:120px;height:100%;pointer-events:none;transform:translateX(-50%);mix-blend-mode:screen;filter:blur(7px);transition:opacity 1.2s ease,background 1.2s ease}
#water3d #wl-vign{position:absolute;inset:0;pointer-events:none;z-index:4;background:radial-gradient(125% 95% at 50% 42%,transparent 60%,rgba(2,10,18,.45) 100%)}
.hero-sky,.hero-stars,.hero-waves{display:none!important}
@media (prefers-reduced-motion:reduce){#water3d *{animation:none!important}}
`;
const DOM = `
<div id="wl-sky"><div id="wl-cloudA" class="wl-cloud"></div><div id="wl-cloudB" class="wl-cloud"></div><div id="wl-stars"></div><div id="wl-shoot"></div></div>
<div id="wl-rays"></div><div id="wl-sun"></div>
<div id="wl-b1" class="wl-bird"><svg width="34" height="14" viewBox="0 0 34 14"><path class="wl-wing" d="M1 11 Q9 1 17 8 Q25 1 33 11"/></svg></div>
<div id="wl-b2" class="wl-bird"><svg width="34" height="14" viewBox="0 0 34 14"><path class="wl-wing" d="M1 11 Q9 1 17 8 Q25 1 33 11"/></svg></div>
<div id="wl-b3" class="wl-bird"><svg width="34" height="14" viewBox="0 0 34 14"><path class="wl-wing" d="M1 11 Q9 1 17 8 Q25 1 33 11"/></svg></div>
<div id="wl-haze"></div>
<div id="wl-boat"><svg viewBox="0 0 120 46" width="100%"><g class="wl-bobber"><path class="wl-wake" d="M2 41 q14 -3 26 0 q10 2 16 -1"/><path d="M44 33 L108 33 L99 41 L52 41 Z"/><path d="M62 33 L66 25 L90 25 L94 33 Z"/><path d="M58 22 L98 22 L98 25 L58 25 Z"/><line x1="64" y1="22" x2="66" y2="25" stroke-width="2"/><line x1="92" y1="22" x2="90" y2="25" stroke-width="2"/></g></svg></div>
<div id="wl-waterwrap"><video id="wl-vday" class="wl-vid" autoplay loop muted playsinline preload="auto" src="/water_day.mp4"></video><video id="wl-vnight" class="wl-vid" autoplay loop muted playsinline preload="auto" src="/water_night.mp4" style="opacity:0"></video><div id="wl-glint"></div><div id="wl-wgrade"></div></div>
<div id="wl-vign"></div>`;

export function initWater3D(){
  if (document.getElementById('water3d')) return;
  const st = document.createElement('style'); st.id='wl-bg-css'; st.textContent=CSS; document.head.appendChild(st);
  const host = document.createElement('div'); host.id='water3d'; host.innerHTML=DOM; document.body.prepend(host);
  const q = (s:string)=> host.querySelector(s) as HTMLElement;
  const sky=q('#wl-sky'), sun=q('#wl-sun'), rays=q('#wl-rays'), haze=q('#wl-haze'), cloudA=q('#wl-cloudA'), cloudB=q('#wl-cloudB'),
        stars=q('#wl-stars'), shoot=q('#wl-shoot'), glint=q('#wl-glint'), wgrade=q('#wl-wgrade');
  const vDay=q('#wl-vday') as HTMLVideoElement, vNight=q('#wl-vnight') as HTMLVideoElement;
  let shootOn=false;
  function scheduleShoot(){ if(!shootOn) return; try{ shoot.animate([{transform:'rotate(16deg) translateX(0)',opacity:0},{opacity:1,offset:.1},{transform:'rotate(16deg) translateX(70vw)',opacity:0}],{duration:1300,easing:'ease-in'}); }catch(e){} setTimeout(scheduleShoot, 9000+Math.random()*9000); }
  function render(){
    const {sr,ss}=srss(); const now=new Date(); const m=now.getHours()*60+now.getMinutes();
    const p=phase(m,sr,ss), night=p==='night';
    sky.style.background=SKY[p]; cloudA.style.opacity=night?'0':'0.85'; cloudB.style.opacity=night?'0':'0.7';
    stars.style.opacity=night?'0.95':'0'; vNight.style.opacity=night?'1':'0'; vDay.style.opacity=night?'0':'1';
    wgrade.style.background=WGRADE[p]; host.style.setProperty('--wl-silh',SILH[p]);
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
}
