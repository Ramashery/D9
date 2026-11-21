(function(){
'use strict';

/* ---------- helpers ---------- */
let M=false;
const P=(d,m)=>M?m:d;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const INK='#f3f1ec';

/* scramble line: diagonal "\" mask sweeps across the text */
const sc=(t,o={})=>{
  const L=t.length, i=o.i||0, sg=o.sg||.07, s0=o.s??.5, d=o.d||.04, e=o.e||.9, m=o.m||2;
  return `<span class="sc" style="--length:${L};--stagger-index:${i};--stagger:${sg}s;--start-delay:${s0}s;--max-duration:.7s;--duration-per-char:${d}s;--easing-steps-factor:${e};--easing-steps:${Math.max(1,Math.trunc(L*e))};--mask-offset-factor:${m};${o.st||''}"><span class="sb">${esc(t)}</span><span class="sm" aria-hidden="true" style="--maskText:'${'\\\\'.repeat(L)}'"></span></span>`;
};
/* typewriter: characters appear one by one */
const tw=(t,s,st=.04,x='')=>`<span class="tw" style="--st:${st}s;--sd:${s}s;--n:${t.length};${x}">${[...t].map((c,i)=>`<span class="tc" style="--i:${i}">${c===' '?'&nbsp;':esc(c)}</span>`).join('')}</span>`;

/* brand slash — same parallelogram as the reference, used as a "/" from a URL */
const SL=`<svg class="sl" viewBox="0 0 211 315"><path d="M52.54 0H0l157.459 315h52.623z" fill="${INK}"/></svg>`;
const SLo=`<svg class="sl" viewBox="-2 -2 215 319" overflow="visible"><path d="M52.54 0H0l157.459 315h52.623z" fill="none" stroke="${INK}" stroke-width="1.5"/></svg>`;
const SLp=`<svg viewBox="0 0 211 315"><path d="M52.54 0H0l157.459 315h52.623z" fill="${INK}"/></svg>`;
const slashLoader=w=>{let p='';for(let i=0;i<40;i++)p+=`M${(i*8.2).toFixed(1)} ${i%5?7:0}h1.6v${i%5?12:19}h-1.6z`;return `<svg width="${w}" height="${w/17.32}" viewBox="0 0 329 19" fill="${INK}"><path d="${p}"/></svg>`};

/* justified word row */
function rw3(s,ws){const ml=[0,P(8,6),P(8,6),P(10,8),P(18,14)];return `<div class="j">${ws.map((w,i)=>tw(w,s+i*.05,.04,i?`margin-left:${ml[i]}px`:'')).join('')}</div>`}

/* ---------- geometry (filled by fit) ---------- */
let SW=1440,SH=810,OX=0,OY=0,CW=1440,CH=810;

/* ================= SLIDE 1 — manifesto ================= */
function buildK1(){
  const para=P(
    ['Custom websites for Tbilisi businesses and','beyond. Hand-written code, not bloated','templates. A fixed scope and honest','timelines. SEO built in from day one,','not bolted on after launch.'],
    ['Custom websites for Tbilisi','businesses and beyond. Hand-written','code, not bloated templates. A fixed','scope and honest timelines. SEO','built in from day one, not bolted','on after launch.']);
  const lh=P(21,16), gap=3, n=para.length, H=n*lh+(n-1)*gap, pad=14, bw=16, h=H+pad*2;
  const bk=side=>`<svg class="a br" style="${side}:-22px;top:${-pad}px" width="${bw}" height="${h}" viewBox="0 0 ${bw} ${h}"><path pathLength="1" d="${side==='left'?`M${bw-.75} .75H.75V${h-.75}H${bw-.75}`:`M.75 .75H${bw-.75}V${h-.75}H.75`}"/></svg>`;
  const X=P([40,385,730,1075],[20,139.3,258.7]), hl=P(90,48), fz=P(104,44);
  const HL=P([['Built fast.',0,200],['Found first.',1,200],['Made to sell.',0,900,'var(--accent)']],
             [['Built fast.',0,200],['Found first.',0,200],['Made to sell.',0,900,'var(--accent)']]);
  const hd=HL.map((l,i)=>`<div class="a" style="left:${X[l[1]]}px;top:${P(130,112)+i*hl}px;height:${hl}px;line-height:${hl}px;font-family:var(--display);font-size:${fz}px;font-weight:${l[2]};letter-spacing:${l[2]>500?'-.05em':'-.035em'};${l[3]?'color:'+l[3]:''}">${sc(l[0],{i,sg:.12,s:.7,e:2,m:4})}</div>`).join('');
  const svc=['WEB DEVELOPMENT','UI/UX & DESIGN','SEO'];
  return `<div class="kv k1" data-i="0">
  ${hd}
  <div class="a" style="left:${P(1075,44)}px;top:${P(490,350)}px">
    <div style="position:relative;font-size:${P(12,11.5)}px;font-weight:800;line-height:${lh}px;letter-spacing:0">
      ${bk('left')}${bk('right')}
      <div style="display:flex;flex-direction:column;gap:${gap}px">${para.map((t,i)=>sc(t,{i,sg:.09,s:1.1,e:.4,m:15})).join('')}</div>
    </div>
  </div>
  <div class="a" style="left:${P(730,195)}px;top:${P(690,CH-100)}px">
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:10px">${sc('Services',{s:.5,d:.03})}</div>
    ${svc.map((t,i)=>`<div style="font-size:12.3px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;line-height:1.15">${sc(t,{s:.7+i*.12,d:.02})}</div>`).join('')}
  </div>
  ${M?'':`<div class="a ld" style="left:1075px;top:692px">${slashLoader(325)}</div>`}
  </div>`;
}

/* ================= SLIDE 3 — big type ================= */
function bigLine(cls,t1,t2,sd,di,w1,w2,arrow,wa,wb){
  return `<div class="tb ${cls}"><div class="ln" style="--di:${di}">${tw(t1,w1,.05,`font-weight:${wa}`)}${tw(t2,w2,.05,`font-weight:${wb}${arrow?';color:var(--accent)':''}`)}</div></div>`;
}
function buildK5(){
  const lines=P(
    ['One small team, start to finish: strategy,','design, code and SEO. No handoffs, no','templates, no surprises. Just a site that','loads fast and ranks.'],
    ['One small team, start to finish:','strategy, design, code and SEO.','No handoffs, no templates, no','surprises. Just a site that loads','fast and ranks.']);
  return `<div class="kv k5" data-i="2"><div class="k5col">
  ${bigLine('l1','Web','sites',.55,1,.6,.8,false,900,200)}
  ${bigLine('l2','that','grow',.6,0,.5,.7,true,200,900)}
  <div class="st" style="margin-top:${P(64,34)}px;width:${P(1360,350)}px;font-size:${P(15,10)}px;font-weight:800">
    <div class="mono" style="width:${P(345,52)}px;font-size:${P(10,8.5)}px;color:var(--accent);visibility:hidden">${sc(P('02 — HOW WE WORK','02'),{s:.2})}</div>
    <div style="display:flex;flex-direction:column;gap:3px">${lines.map((t,i)=>sc(t,{i,sg:.04,s:.2})).join('')}</div>
  </div>
  </div></div>`;
}
/* fit the big words to the canvas once the real font is available */
function fitBig(el){
  const col=el.querySelector('.k5col'),l1=el.querySelector('.tb.l1'),l2=el.querySelector('.tb.l2');
  const target=P(1360,350);
  l1.style.fontSize='100px';
  const F1=Math.min(target/l1.offsetWidth*100,P(260,999));
  l1.style.fontSize=F1+'px';
  const OFF=P(345,119.3); l2.style.marginLeft=OFF+'px'; let F2=F1*P(.62,.8);
  l2.style.fontSize=F2+'px';
  if(l2.offsetWidth>target-OFF){F2*=(target-OFF)/l2.offsetWidth;l2.style.fontSize=F2+'px'}
  l2.style.marginTop=(F1*P(-.01,.02))+'px';
  col.style.left=P(40,20)+'px';
  col.style.top='0px';
  const H=col.offsetHeight;
  let top=Math.max(P(60,100),(CH-H)/2-P(0,10));
  if(!M){const base=top+F1*.764,snap=40+90*Math.round((base-40)/90);top+=snap-base}   /* baseline of line 1 sits on a grid row */
  col.style.top=top+'px';
  /* design-tool selection box around the headline */
  const BW=Math.max(l1.offsetWidth,OFF+l2.offsetWidth);
  let sel=col.querySelector('.sel');
  if(!sel){sel=document.createElement('div');sel.className='sel';sel.innerHTML='<i class="h a1"></i><i class="h a2"></i><i class="h a3"></i><i class="h a4"></i><span class="chip c1"></span><span class="chip c2"></span>';col.appendChild(sel)}
  const a=l1.offsetTop,b=l2.offsetTop+l2.offsetHeight;
  sel.style.cssText=`left:-14px;top:${a-14}px;width:${BW+28}px;height:${b-a+28}px`;
  sel.querySelector('.c1').textContent=`H1 · ${Math.round(F1)}PX · 900/200`;
  sel.querySelector('.c2').textContent=`${Math.round(BW)} × ${Math.round(b-a)}`;
}

/* ================= SLIDE 5 — zooming type grid (rebuilt from the original Lottie timeline) ================= */
const ZD=[100.0, 99.8, 99.1, 97.5, 94.0, 85.2, 76.3, 72.8, 71.2, 70.5, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 70.3, 71.0, 73.5, 79.1, 91.3, 122.1, 153.0, 165.2, 170.8, 173.3, 174.0, 173.3, 170.8, 165.2, 153.0, 122.1, 91.3, 79.1, 73.5, 71.0, 70.3, 70.5, 71.2, 72.8, 76.3, 85.2, 94.0, 97.5, 99.1, 99.8, 100.0], ZM=[100.0, 99.9, 99.3, 98.1, 95.5, 88.9, 82.2, 79.6, 78.4, 77.8, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.7, 77.9, 78.7, 80.5, 84.4, 94.1, 103.9, 107.8, 109.6, 110.4, 110.6, 110.4, 109.6, 107.8, 103.9, 94.1, 84.4, 80.5, 78.7, 77.9, 77.7, 77.8, 78.4, 79.6, 82.2, 88.9, 95.5, 98.1, 99.3, 99.9, 100.0];
function bez(x1,y1,x2,y2){const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
  const X=t=>((ax*t+bx)*t+cx)*t,Y=t=>((ay*t+by)*t+cy)*t,dX=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{let t=x;for(let i=0;i<8;i++){const e=X(t)-x;if(Math.abs(e)<1e-5)break;const d=dX(t);if(Math.abs(d)<1e-6)break;t-=e/d}return Y(Math.min(1,Math.max(0,t)))}}
const E4=bez(.76,0,.24,1);
/* keyframe sampler: keys = [[frame,value],...] (60 fps timeline of the original) */
function kv(k,f,ez=E4){
  const n=k.length;
  if(f<=k[0][0])return k[0][1];
  if(f>=k[n-1][0])return k[n-1][1];
  for(let i=0;i<n-1;i++){const a=k[i],b=k[i+1];if(f<=b[0]){const u=(f-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*ez(u)}}
}
const lin=u=>u;
const opK=f0=>[[f0,0],[f0+5,1],[f0+10,0],[f0+15,1],[f0+20,0],[f0+25,1],[435+f0,1],[440+f0,0],[445+f0,1],[450+f0,0],[455+f0,1],[460+f0,0]];
const LZ={
  /* left group: sits bottom-left, swaps to the right + jumps to the top */
  L:[
    {logo:1,t:'',f0:0,x:[[120,-336.5],[180,70],[240,70],[300,-336.5]],y:[[60,-192.2],[120,82.8],[300,82.8],[360,-192.2]]},
    {t:'WE BUILD',w:300,f0:3,x:[[60,-336.5],[120,-336.5],[180,-7],[240,-7],[300,-336.5]],y:[[0,131.8]]},
    {t:'WEBSITES',w:900,f0:6,x:[[60,-294.5],[120,-340],[180,-30.9],[240,-30.9],[300,-338],[360,-338],[419,-294.5]],y:[[0,181.8]]},
    {t:'THAT GROW',w:300,f0:9,x:[[60,-269.5],[120,-338],[180,20],[240,20],[300,-338],[360,-338],[419,-269.5]],y:[[0,231.8]]}
  ],
  /* right group: sits top-right (right-aligned), swaps flush-left + drops to the bottom */
  R:[
    {t:'DESIGN',w:900,f0:9,dx:[[60,-59.2],[120,0],[360,0],[419,-62.7]],y:[[0,-192.2]]},
    {t:'BUILD',w:300,f0:6,dx:[[60,-35.2],[120,0],[360,0],[419,-35.2]],y:[[0,-142.2]]},
    {t:'RANK',w:900,f0:3,dx:[[0,0]],y:[[0,-92.2]]},
    {t:'TBILISI',w:300,f0:0,dx:[[0,0]],y:[[60,232.8],[120,-41.2],[300,-41.2],[360,232.8]]}
  ]
};
LZ.L.forEach(l=>l.ok=opK(l.f0));LZ.R.forEach(l=>l.ok=opK(l.f0));
const KB=[[180,0],[240,-275],[300,-275],[360,0]], KT=[[180,0],[240,273.4],[300,273.4],[360,0]], KP=[[120,0],[180,1],[240,1],[300,0]], SLOK=opK(12), RE=333;
let lzEl=null, lzW=[], raf=0, t0=0;

function buildK2(){return `<div class="kv k2" data-i="4"><div class="lz"></div></div>`}
function lzTiles(){
  const out=[];
  if(M){
    const px=380,py=254.5,K=Math.ceil(((SH/2)/.77-121)/py)+1,C=OX>2?Math.max(1,Math.ceil(((SW/2)/.77-180)/px)):0;
    for(let k=-K;k<=K;k++)for(let c=-C;c<=C;c++)out.push([c*px,-90.5+k*py]);
  }else{
    const px=691,py=466,C=Math.max(1,Math.ceil(((SW/2)/.7-345)/px)),R=Math.max(1,Math.ceil(((SH/2)/.7-233)/py));
    for(let r=-R;r<=R;r++)for(let c=-C;c<=C;c++)out.push([c*px,r*py]);
  }
  return out;
}
function fillLZ(el){
  lzEl=el.querySelector('.lz');
  lzEl.style.left=CW/2+'px';lzEl.style.top=CH/2+'px';
  const all=[...LZ.L,...LZ.R];
  const tile=([x,y])=>`<div class="tl" style="left:${x}px;top:${y}px;transform:scale(${P(1,.521)})">${all.map((l,i)=>`<div class="tx" data-i="${i}" style="font-weight:${l.w||800};transform:translate(var(--x${i}),var(--y${i}));opacity:var(--o${i})">${l.logo?'<i class="logo"></i>':esc(l.t)}</div>`).join('')}</div>`;
  lzEl.innerHTML=lzTiles().map(tile).join('');
  lzW=[...lzEl.querySelector('.tl').querySelectorAll('.tx')].map(e=>e.offsetWidth);
}
function lzSet(f){
  const zs=M?ZM:ZD;let z=1;
  if(f>=60&&f<360){const u=(f-60)/6,i=Math.floor(u),r=u-i;z=(zs[i]+(zs[i+1]-zs[i])*r)/100}
  const s=lzEl.style, dyB=kv(KB,f), dyT=kv(KT,f), pw=kv(KP,f);
  s.setProperty('--z',z);
  LZ.L.forEach((l,i)=>{
    s.setProperty('--x'+i,kv(l.x,f)+'px');
    s.setProperty('--y'+i,(kv(l.y,f)+dyB-45.4)+'px');
    s.setProperty('--o'+i,kv(l.ok,f,lin));
  });
  LZ.R.forEach((l,j)=>{
    const i=4+j,x0=RE-(lzW[i]||200);
    s.setProperty('--x'+i,(x0+kv(l.dx,f)+pw*(-338-x0))+'px');
    s.setProperty('--y'+i,(kv(l.y,f)+dyT-45.4)+'px');
    s.setProperty('--o'+i,kv(l.ok,f,lin));
  });
  s.setProperty('--o8',kv(SLOK,f,lin));
}
function lzFrame(now){
  const f=Math.min(479,(now-t0)*.06);
  lzSet(f);
  if(f<479)raf=requestAnimationFrame(lzFrame);
}
function startLZ(el){
  cancelAnimationFrame(raf);
  fillLZ(el);
  t0=performance.now();
  lzFrame(t0);
}

/* ================= layout-guide grid (12-col web grid, rulers, registration marks) ================= */
function gridHTML(i){
  const f=n=>+n.toFixed(1);
  const cs=P([40,385,730,1075],[20,139.3,258.7]), y0=P(40,30), y1=P(760,CH-30);
  let V=cs.concat(P(1400,370)), Hs;
  if(M)Hs=[[y0,112,332,y1],[y0,CH-303,CH-184,y1],[y0,CH/2,y1],[y0,CH*.14,CH*.6,y1],[y0,CH/2,y1]][i];
  else Hs=[[40,130,400,490,690,760],[40,130,553,720,760],[40,400,760],[40,130,205,420,760],[40,400,760]][i];
  if(i===4)V=P([40,720,1400],[20,195,370]);
  const p=(d,o,c='')=>`<path${c?` class="${c}"`:''} pathLength="1" stroke-opacity="${o}" d="${d}"/>`;
  let s='',d='';
  V.forEach(x=>s+=p(`M${f(x+OX)} 0V${f(SH)}`,.5));
  Hs.forEach(y=>s+=p(`M0 ${f(y+OY)}H${f(SW)}`,.28));
  V.forEach(x=>Hs.forEach(y=>d+=`M${f(x+OX-6)} ${f(y+OY)}h12M${f(x+OX)} ${f(y+OY-6)}v12`));
  s+=p(d,.95,'x');
  return `<div class="gr"><svg viewBox="0 0 ${f(SW)} ${f(SH)}" preserveAspectRatio="none">${s}</svg></div>`;
}
const EASE='cubic-bezier(.77,0,0,.99)';
const gp=(s,f)=>s.querySelectorAll('.gr svg').forEach(v=>[...v.children].forEach(f));
const gridReset=s=>gp(s,p=>{p.style.transition='none';p.style.strokeDashoffset=1});
const gridIn=s=>gp(s,(p,i)=>{p.style.transition=`stroke-dashoffset .95s ${EASE} ${i*.035}s`;p.style.strokeDashoffset=0});
const gridOut=s=>gp(s,(p,i)=>{p.style.transition=`stroke-dashoffset .7s ${EASE} ${i*.012}s`;p.style.strokeDashoffset=1});

/* ================= engine ================= */
const hero=document.getElementById('top'),stage=document.getElementById('stage'),cv=document.getElementById('cv'),ov=document.getElementById('ov'),v=document.getElementById('bgVideo');
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isM=()=>(hero.clientWidth||innerWidth)<=860;
let slides=[],T=[],mode=null,order=[0,2,4],pi=0;
const w=(f,ms)=>T.push(setTimeout(f,ms));
const HOLD=[6500,5000,6000,5500,8000], LEAVE=1100;

function fit(){
  const W=hero.clientWidth||innerWidth, H=hero.clientHeight||innerHeight;
  let s;
  if(M){
    s=W/390; let sh=H/s;
    if(sh<680){s=H/680;sh=680}
    SW=W/s; SH=sh; CW=390; CH=sh; OX=(SW-CW)/2; OY=0;
  }else{
    s=Math.min(W/1440,H/810);
    SW=W/s; SH=H/s; CW=1440; CH=810; OX=(SW-CW)/2; OY=(SH-CH)/2;
  }
  const st=stage.style;
  st.width=SW+'px'; st.height=SH+'px'; st.transform=`scale(${s})`;
  st.setProperty('--sw',SW+'px'); st.setProperty('--sh',SH+'px'); st.setProperty('--shn',SH);
  st.setProperty('--ox',OX+'px'); st.setProperty('--oy',OY+'px');
  cv.style.cssText=`left:${OX}px;top:${OY}px;width:${CW}px;height:${CH}px`;
}
function hudHTML(){ return ''; }
function hudSet(){ const h=document.getElementById('hud'); if(h)h.classList.add('on'); }
function build(){
  cv.innerHTML=buildK1()+'<div class="kv"></div>'+buildK5()+'<div class="kv"></div>'+buildK2();
  slides=[...cv.querySelectorAll(':scope > .kv')];
  slides.forEach((s,i)=>s.insertAdjacentHTML('afterbegin',gridHTML(i)));
}
function regrid(){
  slides.forEach((s,i)=>{
    const o=s.querySelector('.gr'); if(o)o.remove();
    s.insertAdjacentHTML('afterbegin',gridHTML(i));
    if(s.classList.contains('on'))gp(s,p=>{p.style.transition='none';p.style.strokeDashoffset=0});
  });
  if(cur===4){fillLZ(slides[4]);lzFrame(performance.now()-(t0?performance.now()-t0:0))}
}
let cur=-1;
function show(idx){
  cur=idx;
  const el=slides[idx];
  slides.forEach(e=>e.classList.remove('on','is-active','is-leaving'));
  stage.dataset.index=idx;
  hudSet(idx);
  el.classList.add('on');
  cancelAnimationFrame(raf);
  if(idx===2)fitBig(el);
  if(idx===4)startLZ(el);
  gridReset(el); void el.offsetWidth;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{gridIn(el);el.classList.add('is-active')}));
  if(RM)return;
  w(()=>{
    pi=(pi+1)%order.length;
    const next=order[pi];
    gridOut(el);el.classList.add('is-leaving');
    w(()=>show(next),LEAVE);
  },HOLD[idx]);
}
function start(){
  T.forEach(clearTimeout);T=[];cancelAnimationFrame(raf);
  M=isM(); mode=M;
  stage.classList.toggle('m',M);
  fit(); build();
  slides.forEach(e=>e.classList.remove('on','is-active','is-leaving'));
  stage.dataset.index=0;
  pi=0;
  if(RM){ov.className='ov gone';show(2);return}
  ov.className='ov';void ov.offsetWidth;
  ov.classList.add('go');
  w(()=>ov.classList.add('lv'),2000);
  w(()=>show(order[0]),2420);
  w(()=>ov.classList.add('gone'),2800);
}

let rt;
addEventListener('resize',()=>{
  clearTimeout(rt);
  rt=setTimeout(()=>{
    if(mode!==isM())start();
    else{fit();regrid()}
  },150);
});

/* wait for the fonts so the big words are measured with the real glyphs */
const fonts=document.fonts&&document.fonts.load
  ? Promise.allSettled(['800 1em "Neue Montreal"','800 1em Inter','500 1em "JetBrains Mono"'].map(f=>document.fonts.load(f)))
  : Promise.resolve();
Promise.race([fonts,new Promise(r=>setTimeout(r,1500))]).then(start);

window.restartHero=start;
})();