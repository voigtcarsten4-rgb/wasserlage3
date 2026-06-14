/* Premium-Wetter-Footer-Band: Luxusuhr + Deutschlandkarte (mittig, Blickfang) + 8 Stadt-Kacheln,
 * live aus Open-Meteo (deutschlandweit, kein Key). Wird oben in <footer.foot3> eingesetzt; die alte
 * Navigation/Marke/Links/Legal bleiben unangetastet, nur das kleine #footWx-Widget wird ausgeblendet. */
const CITIES = [
  {n:'Hamburg',la:53.55,lo:9.99,x:39,y:22},{n:'Rostock',la:54.09,lo:12.13,x:55,y:18},
  {n:'Berlin',la:52.52,lo:13.40,x:62,y:31},{n:'Dresden',la:51.05,lo:13.74,x:67,y:46},
  {n:'Köln',la:50.94,lo:6.96,x:31,y:42},{n:'Frankfurt',la:50.11,lo:8.68,x:39,y:53},
  {n:'München',la:48.14,lo:11.58,x:58,y:75},{n:'Konstanz',la:47.66,lo:9.18,x:43,y:85}
];
const DE_PATH='M78 96C80 80 96 74 110 72L120 66C124 50 128 34 140 30C150 28 154 40 152 56L150 64C168 62 196 64 208 78C214 96 214 120 220 140C228 156 236 162 230 178C224 196 214 200 216 214C222 232 214 250 196 270C190 286 196 300 184 314C172 312 160 300 150 298C134 304 122 312 116 300C110 286 112 270 104 256C96 244 86 244 84 232C82 220 92 212 90 198C86 176 78 160 80 140C82 120 74 108 78 96Z';
function cond(c:number){ if(c===0)return'clear'; if(c<=2)return'partly'; if(c===3)return'cloudy'; if(c<=48)return'fog'; if(c>=95)return'thunder'; if(c>=71&&c<=77)return'snow'; if(c>=51)return'rain'; return'cloudy'; }
const CL:Record<string,string>={clear:'Klar',partly:'Heiter',cloudy:'Bewölkt',rain:'Regen',thunder:'Gewitter',snow:'Schnee',fog:'Nebel'};
function dir(d:number){ return ['N','NO','O','SO','S','SW','W','NW'][Math.round(((d||0)%360)/45)%8]; }
function scene(c:string){ const night=(new Date().getHours()<6||new Date().getHours()>=21); let s='';
  if(c==='clear') s=night?'<i class="fw-moon"></i>':'<i class="fw-sun"></i>';
  else if(c==='partly') s=(night?'<i class="fw-moon" style="left:42%"></i>':'<i class="fw-sun" style="left:42%;top:42%"></i>')+'<i class="fw-cl move"></i>';
  else if(c==='cloudy'||c==='fog') s='<i class="fw-cl move"></i>';
  else if(c==='rain'){ s='<i class="fw-cl d"></i>'; for(let i=0;i<5;i++) s+='<i class="fw-dp" style="left:'+(30+i*10)+'%;top:52%;animation-delay:'+(i*.14)+'s"></i>'; }
  else if(c==='thunder'){ s='<i class="fw-cl d"></i><i class="fw-bo"></i>'; for(let j=0;j<4;j++) s+='<i class="fw-dp" style="left:'+(30+j*12)+'%;top:52%;animation-delay:'+(j*.18)+'s"></i>'; }
  else if(c==='snow'){ s='<i class="fw-cl"></i>'; for(let k=0;k<5;k++) s+='<i class="fw-fk" style="left:'+(30+k*10)+'%;top:50%;animation-delay:'+(k*.4)+'s"></i>'; }
  return s; }
const CSS=`
#fw3{position:relative;overflow:hidden;border-bottom:1px solid rgba(217,177,77,.16);padding:6px 4px 14px}
#fw3 .fw-sky{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}
#fw3 .fw-star{position:absolute;width:2px;height:2px;border-radius:50%;background:#dCEBFF;animation:fwTw 4s ease-in-out infinite alternate}
@keyframes fwTw{0%{opacity:.25}100%{opacity:1}}
#fw3 .fw-sweep{position:absolute;top:0;left:-40%;width:40%;height:100%;mix-blend-mode:screen;opacity:.5;background:linear-gradient(100deg,transparent,rgba(180,215,235,.10) 45%,rgba(243,220,138,.10) 55%,transparent);animation:fwSweep 14s ease-in-out infinite}
@keyframes fwSweep{0%{left:-45%}55%,100%{left:130%}}
#fw3 .fw-grid{position:relative;z-index:2;display:grid;grid-template-columns:286px 230px 1fr;gap:18px;align-items:center;max-width:1280px;margin:0 auto;padding:6px 24px}
#fw3 .fw-watch{display:flex;align-items:center;gap:14px}
#fw3 .fw-dial{position:relative;width:98px;height:98px;border-radius:50%;flex:0 0 auto;background:radial-gradient(circle at 50% 36%,#103048,#061320 72%);box-shadow:0 0 0 2px rgba(217,177,77,.6),0 0 0 6px rgba(217,177,77,.12),0 0 22px rgba(217,177,77,.18),inset 0 2px 12px rgba(0,0,0,.6)}
#fw3 .fw-tick{position:absolute;left:50%;top:6px;width:2px;height:7px;background:rgba(217,177,77,.5);transform-origin:50% 43px;border-radius:2px}
#fw3 .fw-tick.maj{height:10px;width:2.5px;background:#e9c46a}
#fw3 .fw-hand{position:absolute;left:50%;bottom:50%;transform-origin:bottom center;border-radius:4px}
#fw3 .fw-hr{width:4px;height:24px;background:linear-gradient(#f3dC8a,#d9a93f)}#fw3 .fw-mn{width:3px;height:35px;background:linear-gradient(#fbeec0,#e9c46a)}
#fw3 .fw-sc{width:1.5px;height:39px;background:#3fc3c9;box-shadow:0 0 6px rgba(63,195,201,.7)}
#fw3 .fw-capn{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);background:#e9c46a;box-shadow:0 0 0 2px #061320}
#fw3 .fw-dt{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px;line-height:1;background:linear-gradient(180deg,#f7e6a8,#d9a93f 78%,#b5832b);-webkit-background-clip:text;background-clip:text;color:transparent}
#fw3 .fw-dd{font-size:11.5px;color:#9fb8cc;margin-top:5px}#fw3 .fw-tz{font-size:10px;color:#7f9bb0;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px}
#fw3 .fw-live{display:inline-block;margin-left:7px;font-size:9.5px;font-weight:800;color:#06281a;background:#39d98a;border-radius:999px;padding:2px 7px;vertical-align:2px;box-shadow:0 0 12px rgba(57,217,138,.5)}
#fw3 .fw-agg{display:flex;gap:8px;margin-top:11px}#fw3 .fw-pill{background:rgba(255,255,255,.05);border:1px solid rgba(217,177,77,.24);border-radius:11px;padding:6px 11px;font-size:11.5px;color:#cfe2ee}#fw3 .fw-pill b{color:#f3dC8a;font-weight:700;font-size:14px}
#fw3 .fw-map{position:relative;width:226px;height:276px;justify-self:center;align-self:center}
#fw3 .fw-map::before{content:'';position:absolute;inset:-14% -10%;background:radial-gradient(circle at 50% 45%,rgba(63,195,201,.18),rgba(217,177,77,.07) 48%,transparent 72%);filter:blur(10px);animation:fwMg 7s ease-in-out infinite}
@keyframes fwMg{0%,100%{opacity:.7}50%{opacity:1}}
#fw3 .fw-map svg{position:relative;width:100%;height:100%;overflow:visible}
#fw3 .fw-glow{fill:none;stroke:rgba(217,177,77,.30);stroke-width:7;filter:blur(5px)}
#fw3 .fw-land{fill:rgba(63,195,201,.07);stroke:url(#fwgt);stroke-width:2.6;stroke-linejoin:round;filter:drop-shadow(0 0 8px rgba(63,195,201,.5));animation:fwDl 6s ease-in-out infinite}
@keyframes fwDl{0%,100%{filter:drop-shadow(0 0 7px rgba(63,195,201,.4))}50%{filter:drop-shadow(0 0 15px rgba(217,177,77,.45))}}
#fw3 .fw-mcap{position:absolute;bottom:-4px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9fb8cc}
#fw3 .fw-pin{position:absolute;width:9px;height:9px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff3cf,#e9c46a 55%,#c9952f);box-shadow:0 0 10px 2px rgba(243,220,138,.8);animation:fwBlink 2.2s ease-in-out infinite}
@keyframes fwBlink{0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(.85)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}}
#fw3 .fw-pin::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:1px solid rgba(243,220,138,.55);animation:fwPing 2.6s ease-out infinite}
@keyframes fwPing{0%{transform:scale(.4);opacity:.9}100%{transform:scale(3);opacity:0}}
#fw3 .fw-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-content:center}
#fw3 .fw-tile{position:relative;background:linear-gradient(180deg,rgba(16,44,68,.66),rgba(8,22,38,.58));border:1px solid rgba(217,177,77,.30);border-radius:15px;padding:10px 11px 9px;backdrop-filter:blur(9px);overflow:hidden;box-shadow:0 0 44px -2px rgba(217,177,77,.30),inset 0 1px 0 rgba(243,220,138,.20);transition:border-color .25s,transform .2s,box-shadow .25s}
#fw3 .fw-tile::before{content:'';position:absolute;left:-10%;right:-10%;bottom:-34%;height:70%;background:radial-gradient(60% 100% at 50% 100%,rgba(217,177,77,.40),transparent 72%);pointer-events:none;animation:fwGlow 6s ease-in-out infinite}
#fw3 .fw-tile:nth-child(2n)::before{animation-delay:-3s}
@keyframes fwGlow{0%,100%{opacity:.55}50%{opacity:1}}
#fw3 .fw-tile:hover{border-color:rgba(243,220,138,.6);transform:translateY(-3px);box-shadow:0 0 60px 4px rgba(217,177,77,.5)}
#fw3 .fw-cn{font-size:12px;font-weight:700;position:relative}
#fw3 .fw-scene{height:40px;position:relative;margin:2px 0}
#fw3 .fw-trow{display:flex;align-items:baseline;gap:6px;position:relative}#fw3 .fw-tp{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}#fw3 .fw-cd{font-size:10px;color:#9fc0d6}
#fw3 .fw-meta{display:flex;gap:9px;margin-top:4px;font-size:10px;color:#9fc0d6;position:relative}
#fw3 .fw-sun{position:absolute;left:50%;top:50%;width:16px;height:16px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#ffe9a8,#ffc04d 60%,#ff9e2c);box-shadow:0 0 12px 3px rgba(255,190,80,.6)}
#fw3 .fw-sun::before{content:'';position:absolute;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);background:conic-gradient(from 0deg,transparent 0 15deg,rgba(255,210,120,.55) 17deg 21deg,transparent 23deg 59deg,rgba(255,210,120,.55) 61deg 65deg,transparent 67deg 103deg,rgba(255,210,120,.55) 105deg 109deg,transparent 111deg 147deg,rgba(255,210,120,.55) 149deg 153deg,transparent 155deg);-webkit-mask:radial-gradient(circle,transparent 8px,#000 9px);mask:radial-gradient(circle,transparent 8px,#000 9px);animation:fwSpin 13s linear infinite}
@keyframes fwSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
#fw3 .fw-moon{position:absolute;left:50%;top:50%;width:15px;height:15px;border-radius:50%;transform:translate(-50%,-50%);background:#eef4ff;box-shadow:inset -5px -1px 0 #cdddef,0 0 12px 2px rgba(160,190,255,.45)}
#fw3 .fw-cl{position:absolute;width:24px;height:9px;background:#cfe0ee;border-radius:9px;left:34%;top:38%}
#fw3 .fw-cl::before{content:'';position:absolute;width:12px;height:12px;background:#cfe0ee;border-radius:50%;top:-6px;left:4px}
#fw3 .fw-cl::after{content:'';position:absolute;width:9px;height:9px;background:#cfe0ee;border-radius:50%;top:-3px;left:12px}
#fw3 .fw-cl.d,#fw3 .fw-cl.d::before,#fw3 .fw-cl.d::after{background:#9fb3c4}
#fw3 .fw-cl.move{animation:fwFlo 6s ease-in-out infinite alternate}@keyframes fwFlo{to{transform:translateX(5px)}}
#fw3 .fw-dp{position:absolute;width:2px;height:6px;background:linear-gradient(#bfe6ff,transparent);border-radius:2px;animation:fwRn .75s linear infinite}
@keyframes fwRn{0%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(18px);opacity:0}}
#fw3 .fw-fk{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;animation:fwSn 2.6s linear infinite}
@keyframes fwSn{0%{transform:translateY(0);opacity:0}25%{opacity:1}100%{transform:translateY(20px) translateX(4px);opacity:0}}
#fw3 .fw-bo{position:absolute;left:45%;top:50%;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:10px solid #ffe14d;filter:drop-shadow(0 0 5px #ffd23d);animation:fwFla 3.2s ease-in-out infinite;opacity:0}
@keyframes fwFla{0%,90%,100%{opacity:0}93%,97%{opacity:1}}
.foot3 .foot-wx{display:none!important}
@media(max-width:900px){#fw3 .fw-grid{grid-template-columns:1fr;justify-items:center}#fw3 .fw-tiles{grid-template-columns:repeat(2,1fr);width:100%}}
`;
function band(){
  let pins=CITIES.map((c,i)=>'<div class="fw-pin" style="left:'+c.x+'%;top:'+c.y+'%;animation-delay:'+(i*.2)+'s"></div>').join('');
  let tiles=CITIES.map(c=>'<div class="fw-tile" data-c="'+c.n+'"><div class="fw-cn">'+c.n+'</div><div class="fw-scene"></div><div class="fw-trow"><span class="fw-tp">–</span><span class="fw-cd">…</span></div><div class="fw-meta"><span class="fw-wind">💨 –</span></div></div>').join('');
  return '<div id="fw3"><div class="fw-sky"><div class="fw-sweep"></div><div class="fw-stars"></div></div>'+
    '<div class="fw-grid">'+
      '<div class="fw-left"><div class="fw-watch"><div class="fw-dial"><div class="fw-hand fw-hr"></div><div class="fw-hand fw-mn"></div><div class="fw-hand fw-sc"></div><div class="fw-capn"></div></div>'+
      '<div><div class="fw-dt" id="fwClk">--:--:--</div><div class="fw-dd" id="fwDat">—<span class="fw-live">● LIVE</span></div><div class="fw-tz">Deutschland · MEZ</div></div></div>'+
      '<div class="fw-agg"><div class="fw-pill">Ø Luft <b id="fwAir">—</b></div><div class="fw-pill" id="fwLoc">Berlin/Bbg —</div></div></div>'+
      '<div class="fw-map"><svg viewBox="0 0 300 360" aria-hidden="true"><defs><linearGradient id="fwgt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fc3c9"/><stop offset=".55" stop-color="#8fc6b4"/><stop offset="1" stop-color="#e9c46a"/></linearGradient></defs>'+
        '<path class="fw-glow" d="'+DE_PATH+'"/><path class="fw-land" d="'+DE_PATH+'"/></svg><div class="fw-pins">'+pins+'</div><div class="fw-mcap">≈ Deutschland · live</div></div>'+
      '<div class="fw-tiles">'+tiles+'</div>'+
    '</div></div>';
}
export function initFooterWeather(){
  const ft=document.querySelector('footer.foot3'); if(!ft || document.getElementById('fw3')) return;
  if(!document.getElementById('fw3-css')){ const st=document.createElement('style'); st.id='fw3-css'; st.textContent=CSS; document.head.appendChild(st); }
  ft.insertAdjacentHTML('afterbegin', band());
  const root=document.getElementById('fw3')!; const q=(s:string)=>root.querySelector(s) as HTMLElement;
  // Uhr
  const dial=root.querySelector('.fw-dial')!; let tk=''; for(let i=0;i<12;i++) tk+='<div class="fw-tick'+(i%3===0?' maj':'')+'" style="transform:rotate('+(i*30)+'deg)"></div>'; dial.insertAdjacentHTML('afterbegin',tk);
  const hr=q('.fw-hr'),mn=q('.fw-mn'),sc=q('.fw-sc'),clk=root.querySelector('#fwClk')!,dat=root.querySelector('#fwDat')!;
  const hands=()=>{const d=new Date();const s=d.getSeconds()+d.getMilliseconds()/1000,m=d.getMinutes()+s/60,h=(d.getHours()%12)+m/60;
    sc.style.transform='translateX(-50%) rotate('+(s*6)+'deg)';mn.style.transform='translateX(-50%) rotate('+(m*6)+'deg)';hr.style.transform='translateX(-50%) rotate('+(h*30)+'deg)';};
  const digi=()=>{const d=new Date(),p=(n:number)=>String(n).padStart(2,'0');clk.textContent=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
    dat.innerHTML=d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+' <span class="fw-live">● LIVE</span>';};
  hands();digi();setInterval(hands,200);setInterval(digi,1000);
  // Sterne
  let stx=''; for(let i=0;i<28;i++) stx+='<div class="fw-star" style="left:'+(Math.random()*100)+'%;top:'+(Math.random()*70)+'%;animation-delay:'+(Math.random()*4)+'s"></div>';
  (root.querySelector('.fw-stars') as HTMLElement).innerHTML=stx;
  // Live-Wetter (Open-Meteo, deutschlandweit) — echte Luft-Werte
  const url='https://api.open-meteo.com/v1/forecast?latitude='+CITIES.map(c=>c.la).join(',')+'&longitude='+CITIES.map(c=>c.lo).join(',')+'&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Europe%2FBerlin';
  fetch(url).then(r=>r.json()).then((data:any)=>{
    const list=Array.isArray(data)?data:[data]; let sum=0,n=0;
    CITIES.forEach((c,i)=>{ const cur=list[i]&&list[i].current; const tile=root.querySelector('.fw-tile[data-c="'+c.n+'"]'); if(!cur||!tile) return;
      const t=Math.round(cur.temperature_2m), cc=cond(cur.weather_code), wd=dir(cur.wind_direction_10m), ws=Math.round(cur.wind_speed_10m);
      (tile.querySelector('.fw-scene') as HTMLElement).innerHTML=scene(cc);
      (tile.querySelector('.fw-tp') as HTMLElement).textContent=t+'°';
      (tile.querySelector('.fw-cd') as HTMLElement).textContent=CL[cc];
      (tile.querySelector('.fw-wind') as HTMLElement).textContent='💨 '+wd+' '+ws;
      sum+=t; n++; if(c.n==='Berlin'){ const loc=root.querySelector('#fwLoc'); if(loc) loc.innerHTML='Berlin/Bbg · <b style="color:#cfe2ee;font-size:12px">'+t+'° '+CL[cc]+'</b>'; }
    });
    if(n){ const a=root.querySelector('#fwAir'); if(a) a.textContent=Math.round(sum/n)+'°'; }
  }).catch(()=>{ /* offline: Uhr+Karte laufen, Kacheln zeigen Platzhalter (keine Fake-Daten) */ });
}
