const BASE_TV=1327,MULT=[1,2,3,4],RESPAWN=900,WARN_AT=60;
const CX=180,CY=180,OR=150,IR=68,SPAN=53,NR=10;

const DISTRICTS=[
  {name:'Memorial', angle:0,   bosses:['Volghass','Nunatak']},
  {name:'Arena',    angle:60,  bosses:['Glorgoloch the Destroyer','King Khrogo']},
  {name:'Arboretum',angle:120, bosses:['Lady Malygda','Ysenda Resplendent']},
  {name:'Temple',   angle:180, bosses:['Immolator Charr','Mazaluhad']},
  {name:'Nobles',   angle:240, bosses:['Baron Thirsk','Amoncrul']},
  {name:'Elvens',   angle:300, bosses:['Zoal the Ever-Wakeful','Screeching Matron']},
];


const BOSS_IMAGES={
  'Volghass':'assets/bosses/volghass.jpg',
  'Nunatak':'assets/bosses/nunatak.jpg',
  'Glorgoloch the Destroyer':'assets/bosses/glorgoloch-the-destroyer.jpg',
  'King Khrogo':'assets/bosses/king-khrogo.jpg',
  'Lady Malygda':'assets/bosses/lady-malygda.jpg',
  'Ysenda Resplendent':'assets/bosses/ysenda-resplendent.jpg',
  'Immolator Charr':'assets/bosses/immolator-charr.jpg',
  'Mazaluhad':'assets/bosses/mazaluhad.jpg',
  'Baron Thirsk':'assets/bosses/baron-thirsk.jpg',
  'Amoncrul':'assets/bosses/amoncrul.jpg',
  'Zoal the Ever-Wakeful':'assets/bosses/zoal-the-ever-wakeful.jpg',
  'Screeching Matron':'assets/bosses/screeching-matron.jpg',
};

const DEFAULT_SKULLS=[
  {di:0,label:'Memorial bosses',                   x:180,y:98},
  {di:1,label:'Arena bosses',                      x:248,y:137},
  {di:2,label:'Arboretum bosses',                  x:253,y:219},
  {di:3,label:'Temple bosses',                     x:181,y:307},
  {di:4,bi:0,label:'Baron Thirsk',                 x:72, y:258},
  {di:4,bi:1,label:'Amoncrul',                     x:54, y:221},
  {di:5,label:'Elvens bosses',                     x:84, y:123},
];

const C={
  nA:{f:'#1a3d22',s:'#2a5e34'},nD:{f:'#3a1806',s:'#742c0e'},nW:{f:'#372b06',s:'#826a14'},
  dA:{f:'#0c2644',s:'#174482'},dD:{f:'#261630',s:'#522870'},dW:{f:'#182436',s:'#386088'},
};
const ALLIANCE_HELD={
  ep:{dA:{f:'#3d0e10',s:'#8a1f20'},dD:{f:'#2e0c0e',s:'#6a181a'},dW:{f:'#3a1812',s:'#8a3024'}},
  dc:{dA:{f:'#0c2644',s:'#174482'},dD:{f:'#0c1c34',s:'#1a3a6a'},dW:{f:'#182436',s:'#386088'}},
  ad:{dA:{f:'#3d3a0a',s:'#8a8217'},dD:{f:'#2e2a0c',s:'#6a5c18'},dW:{f:'#3a3212',s:'#8a7a24'}},
};
const ALLIANCE_TX={
  ep:{dcA:'#ff6a58',dcD:'#c86868',dcW:'#e08878'},
  dc:{dcA:'#68b8e8',dcD:'#9868c8',dcW:'#78a0c8'},
  ad:{dcA:'#f0d840',dcD:'#c8b048',dcW:'#d8c060'},
};
function heldC(){return ALLIANCE_HELD[alliance]||ALLIANCE_HELD.dc;}
function heldTX(){return ALLIANCE_TX[alliance]||ALLIANCE_TX.dc;}
const TX={alive:'#58c070',dead:'#d07828',urgent:'#f03418',warn:'#ccaa28'};

const timers=DISTRICTS.map(()=>({end:null,running:false,wasRunning:false,warnFired:false,unknown:false,unknownAt:null}));
const dcHeld=new Set();
let muted=true,actx=null,stI=0,grSz=1,totalKills=0,currentTelVar=0,bankedTelVar=0,lostTelVar=0,farmStart=null,farmEnd=null,farmRunning=false,activePreset=null,sortByRespawn=false,telvarTarget=0;
let alliance='dc';
const ALLIANCES={ep:{name:'Ebonheart Pact',short:'EP',color:'#e04a3a'},dc:{name:'Daggerfall Covenant',short:'DC',color:'#5aa0e8'},ad:{name:'Aldmeri Dominion',short:'AD',color:'#d4c030'}};
const ALLIANCE_IMG={ep:'assets/alliance-ep-crest.png',dc:'assets/alliance-dc-crest.png',ad:'assets/alliance-ad-crest.png'};
const ALLIANCE_IMG_FULL={ep:'assets/alliance-ep.png',dc:'assets/alliance-dc.png',ad:'assets/alliance-ad.jpg'};
const skulls=DEFAULT_SKULLS;

function ns(t){return document.createElementNS('http://www.w3.org/2000/svg',t);}
function rad(d){return d*Math.PI/180;}
function pol(a,r){const rd=rad(a-90);return[CX+r*Math.cos(rd),CY+r*Math.sin(rd)];}
function slP(ang,oR,iR,sp){const a1=ang-sp/2,a2=ang+sp/2;const[ox1,oy1]=pol(a1,oR),[ox2,oy2]=pol(a2,oR);const[ix1,iy1]=pol(a2,iR),[ix2,iy2]=pol(a1,iR);return`M${ox1} ${oy1} A${oR} ${oR} 0 0 1 ${ox2} ${oy2} L${ix1} ${iy1} A${iR} ${iR} 0 0 0 ${ix2} ${iy2}Z`;}
function fmt(s){const m=Math.floor(Math.max(0,s)/60),sc=Math.floor(Math.max(0,s)%60);return`${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;}
function fmtH(s){s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;}
function farmElapsed(){if(!farmStart)return 0;return ((farmRunning?Date.now():farmEnd)-farmStart)/1000;}

function sliceC(i){const h=dcHeld.has(i),t=timers[i],HC=heldC();let rem=0,up=true,wn=false;if(t.unknown){return h?HC.dD:C.nD;}if(t.running&&t.end){rem=Math.max(0,(t.end-Date.now())/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;}if(up)return h?HC.dA:C.nA;if(wn)return h?HC.dW:C.nW;return h?HC.dD:C.nD;}
function textC(i){const h=dcHeld.has(i),t=timers[i],HT=heldTX();let rem=0,up=true,wn=false;if(t.unknown)return TX.warn;if(t.running&&t.end){rem=Math.max(0,(t.end-Date.now())/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;}const urg=!up&&rem<15;if(up)return h?HT.dcA:TX.alive;if(urg)return TX.urgent;if(wn)return h?HT.dcW:TX.warn;return h?HT.dcD:TX.dead;}

function districtCapturesLocked(){return activePreset==='streakah';}
function toggleDC(i){if(districtCapturesLocked())return;dcHeld.has(i)?dcHeld.delete(i):dcHeld.add(i);refreshSlice(i);refreshRow(i);buildDCToggles();updateTV();}
function refreshSlice(i){const c=sliceC(i),p=document.getElementById(`sl${i}`);if(p){p.setAttribute('fill',c.f);p.setAttribute('stroke',c.s);p.classList.toggle('locked',districtCapturesLocked());}const t=document.getElementById(`st${i}`);if(t)t.setAttribute('fill',textC(i));const cr=document.getElementById(`crest${i}`);if(cr){if(dcHeld.has(i)){const src=ALLIANCE_IMG[alliance]||ALLIANCE_IMG.dc;cr.setAttributeNS('http://www.w3.org/1999/xlink','href',src);cr.setAttribute('href',src);cr.style.display='';}else{cr.style.display='none';}}}
function refreshRow(i){const row=document.getElementById(`dr${i}`),pill=document.getElementById(`dp${i}`);if(!row)return;const h=dcHeld.has(i);if(pill)pill.style.display=h?'':'none';h?row.classList.add('dc-held'):row.classList.remove('dc-held');}

function buildDCToggles(){
  const wrap=document.getElementById('dcToggles');wrap.innerHTML='';
  DISTRICTS.forEach((d,i)=>{
    const btn=document.createElement('button');
    btn.className='dc-toggle'+(dcHeld.has(i)?' held':'')+(districtCapturesLocked()?' locked':'');
    btn.textContent=d.name;
    btn.title=districtCapturesLocked()?'Locked by The Streakah mode':d.name;
    btn.disabled=districtCapturesLocked();
    btn.onclick=()=>toggleDC(i);
    wrap.appendChild(btn);
  });
}

function perKill(){return Math.round(BASE_TV*MULT[stI]*(1+dcHeld.size*0.33)/grSz);}
function updateTV(){
  const m=MULT[stI],b=1+dcHeld.size*0.33,raw=Math.round(BASE_TV*m*b),pk=Math.round(raw/grSz);
  const sessionTelVar=bankedTelVar+currentTelVar,elapsed=farmElapsed();
  const grpLabel=grSz===1?'÷ Solo':`÷ ${grSz}`;
  document.getElementById('formula').innerHTML=
    `<div class="formula-row"><span class="lbl">Base</span><span class="val">1,327</span></div>`+
    `<div class="formula-row"><span class="lbl">× Stones mult</span><span class="val">×${m}</span></div>`+
    `<div class="formula-row"><span class="lbl">× District bonus</span><span class="val dc">×${b.toFixed(2)} <em>(${dcHeld.size}/6)</em></span></div>`+
    `<div class="formula-row"><span class="lbl">${grSz===1?'Group':'÷ Group'}</span><span class="val">${grpLabel}</span></div>`+
    `<div class="formula-result"><span class="lbl">Per Kill</span><span class="res">${pk.toLocaleString()}</span></div>`;
  document.getElementById('tvK').textContent=totalKills;
  document.getElementById('tvT').textContent=currentTelVar.toLocaleString();
  document.getElementById('tvB').textContent=bankedTelVar.toLocaleString();
  document.getElementById('tvL').textContent=lostTelVar.toLocaleString();
  document.getElementById('tvPK').textContent=pk.toLocaleString();
  document.getElementById('tvTime').textContent=fmtH(elapsed);
  const tvTGTel=document.getElementById('tvTGT');
  if(tvTGTel)tvTGTel.textContent=telvarTarget>0?telvarTarget.toLocaleString():'—';
  if(farmStart&&sessionTelVar>0&&elapsed>0){document.getElementById('tvH').textContent=Math.round(sessionTelVar/(elapsed/3600)).toLocaleString();}
  else document.getElementById('tvH').textContent='—';
  const startBtn=document.getElementById('farmStartBtn'),endBtn=document.getElementById('farmEndBtn');
  if(startBtn)startBtn.disabled=farmRunning;
  if(endBtn)endBtn.disabled=!farmRunning;
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  const presetBtn=document.getElementById(activePreset?`preset${activePreset.charAt(0).toUpperCase()+activePreset.slice(1)}`:'');
  if(presetBtn)presetBtn.classList.add('active');
  const presetNote=document.getElementById('presetNote');
  if(presetNote)presetNote.classList.toggle('show',districtCapturesLocked());
}
function setSt(i){stI=i;document.querySelectorAll('#stonesEl .seg').forEach((b,j)=>b.classList.toggle('sel',j===i));updateTV();}
function setGr(g){grSz=g;document.querySelectorAll('#groupEl .seg').forEach((b,j)=>b.classList.toggle('sel',j+1===g));updateTV();}
function applyPreset(mode){
  activePreset=mode;
  if(mode==='chud'){
    setSt(1);
    setGr(1);
  }else if(mode==='chad'){
    setSt(3);
    setGr(2);
  }else if(mode==='streakah'){
    setSt(3);
    setGr(1);
    dcHeld.clear();
    DISTRICTS.forEach((_,i)=>{refreshSlice(i);refreshRow(i);});
  }
  buildDCToggles();
  updateTV();

  if (mode === "streakah" && typeof showStreakahSplashIfReady === "function") {
    showStreakahSplashIfReady();
  }
}
function startFarm(){farmStart=Date.now();farmEnd=null;farmRunning=true;totalKills=0;currentTelVar=0;bankedTelVar=0;lostTelVar=0;updateTV();}
function endFarm(){if(farmRunning){farmEnd=Date.now();farmRunning=false;}updateTV();}
function bankTelVar(){bankedTelVar+=currentTelVar;currentTelVar=0;totalKills=0;updateTV();}
function gankedTelVar(){const lost=Math.floor(currentTelVar*0.5);lostTelVar+=lost;currentTelVar-=lost;updateTV();}

function getA(){if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();return actx;}
function playSpawn(){if(muted)return;try{const c=getA();[523.25,659.25,783.99,1046.5].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;const t=c.currentTime+i*0.18;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.35,t+0.04);g.gain.exponentialRampToValueAtTime(0.001,t+1.1);o.start(t);o.stop(t+1.2);});}catch(e){}}
function playWarn(){if(muted)return;try{const c=getA();[392,523.25].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='triangle';o.frequency.value=f;const t=c.currentTime+i*0.22;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.25,t+0.03);g.gain.exponentialRampToValueAtTime(0.001,t+0.7);o.start(t);o.stop(t+0.8);});}catch(e){}}
function toggleMute(){muted=!muted;const b=document.getElementById('muteBtn');b.textContent=muted?'🔕 Muted':'🔔 Sound On';b.className=muted?'muted':'';}
function flash(type){const el=document.getElementById('flashOverlay');el.className='';void el.offsetWidth;el.className=`flash-${type}`;}
function toast(name,type='info'){
  const bn=document.getElementById('alertBanner'),t=document.createElement('div');
  const config={
    spawn:{icon:'⚔️',label:'Boss Respawned',cls:'spawn'},
    warning:{icon:'⚠️',label:'Spawning in 1 Min',cls:'warning'},
    info:{icon:'ℹ️',label:'Notice',cls:'info'},
    success:{icon:'✓',label:'Updated',cls:'success'},
    error:{icon:'⚠️',label:'Check Input',cls:'error'}
  }[type]||{icon:'ℹ️',label:'Notice',cls:'info'};
  t.className=`alert-toast ${config.cls}`;
  t.innerHTML=`<div class="toast-icon">${config.icon}</div><div><div class="toast-label ${config.cls}">${config.label}</div><div class="toast-name">${name}</div></div>`;
  bn.appendChild(t);
  setTimeout(()=>t.remove(),4200);
}

function drawSkull(g,sk,idx){
  const tmr=timers[sk.di];const alive=!tmr.unknown&&(!tmr.running||!tmr.end||(tmr.end-Date.now())<=0);
  const sz=16;
  const grp=ns('g');grp.setAttribute('transform',`translate(${sk.x},${sk.y})`);grp.classList.add('skull-hit');
  grp.addEventListener('mouseenter',(ev)=>showSkullTooltip(ev,sk));
  grp.addEventListener('mousemove',(ev)=>moveSkullTooltip(ev));
  grp.addEventListener('mouseleave',hideSkullTooltip);
  grp.addEventListener('click',()=>openBossModal(sk.di,typeof sk.bi==='number'?sk.bi:null));
  const im=ns('image');
  im.setAttribute('x',-sz/2);im.setAttribute('y',-sz/2);
  im.setAttribute('width',sz);im.setAttribute('height',sz);
  im.setAttribute('preserveAspectRatio','xMidYMid meet');
  im.setAttribute('href','assets/boss-skull.png');
  im.setAttributeNS('http://www.w3.org/1999/xlink','href','assets/boss-skull.png');
  im.style.opacity=alive?'0.92':'1';
  if(!alive)im.style.filter='brightness(0.55) sepia(1) saturate(22) hue-rotate(-32deg) brightness(1.35)';
  grp.appendChild(im);
  const ti=ns('title');ti.textContent=sk.label;grp.appendChild(ti);
  g.appendChild(grp);
}

function skullBosses(sk){
  const d=DISTRICTS[sk.di];
  if(typeof sk.bi==='number')return [d.bosses[sk.bi]];
  return d.bosses;
}

function showSkullTooltip(ev,sk){
  const tip=document.getElementById('skullTooltip');
  if(!tip)return;
  const d=DISTRICTS[sk.di],bosses=skullBosses(sk);
  const cards=bosses.map(boss=>{
    const img=BOSS_IMAGES[boss];
    const visual=img?`<img class="skull-tooltip-img" src="${img}" alt="${boss}">`:`<div class="skull-tooltip-img boss-placeholder">?</div>`;
    return `<div class="skull-tooltip-card">${visual}<div class="skull-tooltip-name">${boss}</div></div>`;
  }).join('');
  tip.innerHTML=`<div class="skull-tooltip-kicker">${d.name} District</div><div class="skull-tooltip-title">${sk.label}</div><div class="skull-tooltip-grid">${cards}</div>`;
  tip.classList.add('show');
  moveSkullTooltip(ev);
}

function moveSkullTooltip(ev){
  const tip=document.getElementById('skullTooltip');
  if(!tip)return;
  const pad=16;
  let x=ev.clientX+14,y=ev.clientY+14;
  tip.style.left='0px';tip.style.top='0px';
  const r=tip.getBoundingClientRect();
  if(x+r.width+pad>window.innerWidth)x=ev.clientX-r.width-14;
  if(y+r.height+pad>window.innerHeight)y=ev.clientY-r.height-14;
  tip.style.left=Math.max(pad,x)+'px';
  tip.style.top=Math.max(pad,y)+'px';
}

function hideSkullTooltip(){
  const tip=document.getElementById('skullTooltip');
  if(tip)tip.classList.remove('show');
}
function buildSkulls(){const g=document.getElementById('skulls');g.innerHTML='';skulls.forEach((s,i)=>drawSkull(g,s,i));}


function buildGear(){const g=document.getElementById('gear');for(let i=0;i<24;i++){const a1=i*15,a2=a1+9;const[x1,y1]=pol(a1,58),[x2,y2]=pol(a2,58),[x3,y3]=pol(a2,65),[x4,y4]=pol(a1,65);const p=ns('path');p.setAttribute('d',`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} L${x4} ${y4}Z`);p.setAttribute('fill','#120e05');p.setAttribute('stroke','rgba(201,168,76,0.28)');p.setAttribute('stroke-width','0.5');g.appendChild(p);}}

function buildMap(){
  const sG=document.getElementById('slices'),spG=document.getElementById('spokes'),nG=document.getElementById('nodes'),lG=document.getElementById('labels'),crG=document.getElementById('crests');
  DISTRICTS.forEach((d,i)=>{
    const ang=d.angle;
    const path=ns('path');path.setAttribute('d',slP(ang,OR,IR,SPAN));path.setAttribute('fill',C.nA.f);path.setAttribute('stroke',C.nA.s);path.setAttribute('stroke-width','1.5');path.id=`sl${i}`;path.classList.add('sc');path.addEventListener('click',()=>toggleDC(i));sG.appendChild(path);
    if(crG){const sz=48,[cx,cy]=pol(ang,108);const cr=ns('image');cr.setAttribute('x',cx-sz/2);cr.setAttribute('y',cy-sz/2);cr.setAttribute('width',sz);cr.setAttribute('height',sz);cr.setAttribute('preserveAspectRatio','xMidYMid meet');cr.id=`crest${i}`;cr.style.display='none';cr.style.pointerEvents='none';cr.style.opacity='0.55';crG.appendChild(cr);}
    const sa=ang+30,[bx1,by1]=pol(sa,IR),[bx2,by2]=pol(sa,OR);
    const l1=ns('line');l1.setAttribute('x1',bx1);l1.setAttribute('y1',by1);l1.setAttribute('x2',bx2);l1.setAttribute('y2',by2);l1.setAttribute('stroke','#090805');l1.setAttribute('stroke-width','8');spG.appendChild(l1);
    const l2=ns('line');l2.setAttribute('x1',bx1);l2.setAttribute('y1',by1);l2.setAttribute('x2',bx2);l2.setAttribute('y2',by2);l2.setAttribute('stroke','rgba(201,168,76,0.28)');l2.setAttribute('stroke-width','1');spG.appendChild(l2);
    const oc=ns('circle');oc.setAttribute('cx',bx2);oc.setAttribute('cy',by2);oc.setAttribute('r',NR+3);oc.setAttribute('fill','#090805');nG.appendChild(oc);
    const gm=ns('circle');gm.setAttribute('cx',bx2);gm.setAttribute('cy',by2);gm.setAttribute('r',NR);gm.setAttribute('fill','#1c1408');gm.setAttribute('stroke','rgba(201,168,76,0.52)');gm.setAttribute('stroke-width','1.5');nG.appendChild(gm);
    const gd=ns('circle');gd.setAttribute('cx',bx2);gd.setAttribute('cy',by2);gd.setAttribute('r',3.5);gd.setAttribute('fill','rgba(201,168,76,0.45)');nG.appendChild(gd);
    const lr=(OR+IR)/2+4,[lx,ly]=pol(ang,lr);
    const nt=ns('text');nt.setAttribute('x',lx);nt.setAttribute('y',ly-10);nt.setAttribute('text-anchor','middle');nt.setAttribute('font-family','Cinzel,serif');nt.setAttribute('font-size','11.5');nt.setAttribute('font-weight','600');nt.setAttribute('fill','rgba(201,168,76,0.65)');nt.setAttribute('letter-spacing','1');nt.textContent=d.name;lG.appendChild(nt);
    const tt=ns('text');tt.setAttribute('x',lx);tt.setAttribute('y',ly+10);tt.setAttribute('text-anchor','middle');tt.setAttribute('font-family','Cinzel,serif');tt.setAttribute('font-size','13.5');tt.setAttribute('font-weight','700');tt.setAttribute('fill',TX.alive);tt.id=`st${i}`;tt.textContent='ALIVE';lG.appendChild(tt);
  });
}

function bossChipHtml(boss, di, bi){
  const img=BOSS_IMAGES[boss];
  const thumb=img
    ? `<img class="boss-thumb" src="${img}" alt="${boss}">`
    : `<span class="boss-thumb boss-placeholder">?</span>`;
  return `<button class="boss-chip ${img?'':'missing'}" onclick="openBossModal(${di},${bi})" title="${boss}">
    ${thumb}<span class="boss-chip-name">${boss}</span>
  </button>`;
}

function districtStatusHtml(i){
  const t=timers[i];let rem=0,up=true,wn=false,urg=false;
  if(t.unknown)return `<span class="warn">Timer unknown — respawn uncertain</span>`;
  if(t.running&&t.end){
    rem=Math.max(0,(t.end-Date.now())/1000);
    up=rem<=0;wn=!up&&rem<=WARN_AT;urg=!up&&rem<15;
  }
  if(up)return `<span class="alive">Alive now</span>`;
  if(urg)return `<span class="urgent">Respawning in ${fmt(rem)}</span>`;
  if(wn)return `<span class="warn">Respawning in ${fmt(rem)}</span>`;
  return `<span class="dead">Respawning in ${fmt(rem)}</span>`;
}

function openBossModal(di,bi){
  const district=DISTRICTS[di];
  const bossNames=(typeof bi==='number')?[district.bosses[bi]]:district.bosses;
  const modal=document.getElementById('bossModal');
  const imagesEl=document.getElementById('bossModalImages');
  if(imagesEl){
    imagesEl.innerHTML=bossNames.map(name=>{
      const img=BOSS_IMAGES[name];
      const visual=img
        ? `<img class="boss-modal-image" src="${img}" alt="${name}">`
        : `<div class="boss-modal-image boss-placeholder">?</div>`;
      return `<div class="boss-modal-image-slot"><div class="boss-modal-image-wrap">${visual}</div><div class="boss-modal-image-name">${name}</div></div>`;
    }).join('');
    imagesEl.dataset.count=bossNames.length;
  }
  document.getElementById('bossModalDistrict').textContent=`${district.name} District`;
  document.getElementById('bossModalTitle').textContent=bossNames.length>1?bossNames.join(' & '):bossNames[0];
  document.getElementById('bossModalMeta').innerHTML=`Status: ${districtStatusHtml(di)}<br>Estimated Tel Var if killed now: <span class="alive">${perKill().toLocaleString()}</span><br>${dcHeld.has(di)?'<span class="alliance-bonus">Alliance bonus</span> active for this district.':'No <span class="alliance-bonus">alliance bonus</span> on this district.'}`;
  document.getElementById('bossModalKillBtn').onclick=()=>{killBoss(di);closeBossModal();};
  modal.classList.add('show');
}

function closeBossModal(){
  const modal=document.getElementById('bossModal');
  if(modal)modal.classList.remove('show');
}

function buildRows(){
  const wrap=document.getElementById('districts');wrap.innerHTML='';
  DISTRICTS.forEach((d,i)=>{
    const row=document.createElement('div');row.className='drow alive';row.id=`dr${i}`;
    const chips=d.bosses.map((boss,bi)=>bossChipHtml(boss,i,bi)).join('');
    row.innerHTML=`
      <div class="ddot alive" id="dd${i}"></div>
      <div class="dinfo">
        <div class="dname">${d.name}</div>
        <div class="dbosses boss-chips">${chips}</div>
      </div>
      <span class="dc-pill" id="dp${i}" style="display:none" aria-label="Alliance bonus"><img src="${ALLIANCE_IMG_FULL[alliance]||ALLIANCE_IMG_FULL.dc}" alt=""></span>
      <div class="dtimer alive" id="dt${i}">ALIVE</div>
      <button class="dbtn kill" onclick="killBoss(${i})">Killed</button>
      <button class="dbtn rst" onclick="rstBoss(${i})">Reset</button>`;
    wrap.appendChild(row);
  });
}

function killBoss(i){try{getA();}catch(e){}timers[i].end=Date.now()+RESPAWN*1000;timers[i].running=true;timers[i].wasRunning=true;timers[i].warnFired=false;totalKills++;currentTelVar+=perKill();updateTV();}
function rstBoss(i){timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;}
function resetAll(){DISTRICTS.forEach((_,i)=>rstBoss(i));}

function tick(){
  const now=Date.now();
  DISTRICTS.forEach((d,i)=>{
    const t=timers[i];let rem=0,up=true,wn=false;
    if(t.running&&t.end){
      rem=Math.max(0,(t.end-now)/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;
      if(wn&&!t.warnFired){t.warnFired=true;playWarn();flash('amber');toast(d.name,'warning');}
      if(up&&t.wasRunning){t.running=false;t.end=null;t.wasRunning=false;t.warnFired=false;playSpawn();flash('green');toast(d.name,'spawn');const row=document.getElementById(`dr${i}`);if(row){row.classList.add('just-up');setTimeout(()=>row.classList.remove('just-up'),3600);}}
    }
    const urg=!up&&rem<15,str=up?'ALIVE':fmt(rem);
    refreshSlice(i);
    const svT=document.getElementById(`st${i}`);if(svT)svT.textContent=str;
    const drow=document.getElementById(`dr${i}`),dot=document.getElementById(`dd${i}`),timer=document.getElementById(`dt${i}`);
    if(drow&&!drow.classList.contains('just-up')){drow.className='drow'+(dcHeld.has(i)?' dc-held':'');drow.classList.add(up?'alive':wn?'warn':'dead');}
    if(dot){dot.className='ddot '+(up?'alive':wn?'warn':'dead');}
    if(timer){timer.textContent=str;timer.className='dtimer '+(up?'alive':urg?'urgent':wn?'warn':'dead');}
  });
  buildSkulls();
  updateTV();
}



/* COMMAND CENTER FEATURE LOGIC */
let actionStack=[];
let eventLog=[];
let lastNextTarget=null;
let titleFlashTimer=null;
const baseDocTitle=document.title||'Imperial City';
if(!document.title)document.title=baseDocTitle;

function modeName(){
  if(activePreset==='chud')return 'Chud Mode';
  if(activePreset==='chad')return 'Chad Mode';
  if(activePreset==='streakah')return 'The Streakah';
  return 'Manual';
}

function snapshot(label){
  return {
    label,
    timers:timers.map(t=>({...t})),
    dcHeld:[...dcHeld],
    stI,grSz,totalKills,currentTelVar,bankedTelVar,lostTelVar,
    farmStart,farmEnd,farmRunning,activePreset,
    eventLog:eventLog.map(e=>({...e}))
  };
}

function pushUndo(label){
  actionStack.push(snapshot(label));
  if(actionStack.length>40)actionStack.shift();
}

function restoreSnapshot(s){
  timers.forEach((t,i)=>Object.assign(t,s.timers[i]));
  dcHeld.clear();s.dcHeld.forEach(i=>dcHeld.add(i));
  stI=s.stI;grSz=s.grSz;totalKills=s.totalKills;currentTelVar=s.currentTelVar;
  bankedTelVar=s.bankedTelVar;lostTelVar=s.lostTelVar;farmStart=s.farmStart;farmEnd=s.farmEnd;
  farmRunning=s.farmRunning;activePreset=s.activePreset;eventLog=s.eventLog.map(e=>({...e}));
  document.querySelectorAll('#stonesEl .seg').forEach((b,j)=>b.classList.toggle('sel',j===stI));
  document.querySelectorAll('#groupEl .seg').forEach((b,j)=>b.classList.toggle('sel',j+1===grSz));
  DISTRICTS.forEach((_,i)=>{refreshSlice(i);refreshRow(i);});
  buildDCToggles();buildSkulls();renderEventLog();updateTV();
}

function undoLastAction(){
  const s=actionStack.pop();
  if(!s){toast('Nothing to undo','info');return;}
  restoreSnapshot(s);
  toast(`Undid: ${s.label}`,'info');
}

function logEvent(text){
  eventLog.unshift({time:Date.now(),text});
  if(eventLog.length>80)eventLog.pop();
  renderEventLog();
}

function fmtClock(ts){
  const d=new Date(ts);
  let h=d.getHours(),m=d.getMinutes();
  const ampm=h>=12?'PM':'AM';h=h%12||12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function renderEventLog(){
  const wrap=document.getElementById('sessionLog');
  if(!wrap)return;
  if(!eventLog.length){wrap.innerHTML='<div class="log-empty">No session events yet</div>';return;}
  wrap.innerHTML=eventLog.slice(0,18).map(e=>`<div class="log-row"><div class="log-time">${fmtClock(e.time)}</div><div class="log-text">${e.text}</div></div>`).join('');
}

function districtState(i){
  const t=timers[i];let rem=0,up=true,wn=false,urg=false,unknown=false;
  if(t.unknown){return {up:false,rem:Infinity,wn:false,urg:false,unknown:true};}
  if(t.running&&t.end){rem=Math.max(0,(t.end-Date.now())/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;urg=!up&&rem<15;}
  return {up,rem,wn,urg,unknown};
}

function bossNamesForDistrict(i){return DISTRICTS[i].bosses.join(' / ');}

function getNextTarget(){
  const states=DISTRICTS.map((_,i)=>districtState(i));
  const alive=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>x.state.up&&!x.state.unknown);
  const streak=activePreset==='streakah';
  if(alive.length){
    alive.sort((a,b)=>{
      const ad=(!streak&&dcHeld.has(a.i))?1:0,bd=(!streak&&dcHeld.has(b.i))?1:0;
      if(bd!==ad)return bd-ad;
      return a.i-b.i;
    });
    const n=alive[0];
    return {di:n.i,title:`${n.d.name} — ${bossNamesForDistrict(n.i)}`,ready:true,reason:streak?'Alive now. Streakah mode ignores flags and keeps the route goblin-safe.':dcHeld.has(n.i)?'Alive now + alliance bonus active.':'Alive now. No alliance bonus on this district.'};
  }
  const knownWaiting=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>!x.state.unknown).sort((a,b)=>a.state.rem-b.state.rem);
  if(knownWaiting.length){
    const waiting=knownWaiting[0];
    return {di:waiting.i,title:`${waiting.d.name} — ${bossNamesForDistrict(waiting.i)}`,ready:false,reason:`Closest known respawn in ${fmt(waiting.state.rem)}.`};
  }
  const unknowns=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>x.state.unknown);
  if(unknowns.length){
    const first=unknowns[0];
    return {di:first.i,title:'All tracked bosses are uncertain',ready:false,reason:'Every timer is unknown. Reset a boss when you confirm it is alive, or mark it killed when you kill it.'};
  }
  return {di:null,title:'No target available',ready:false,reason:'No reliable timer data.'};
}

function updateCommandCenter(){
  const next=getNextTarget();lastNextTarget=next;
  const title=document.getElementById('nextTargetTitle'),reason=document.getElementById('nextTargetReason'),btn=document.getElementById('killNextBtn');
  if(title)title.textContent=next.title;
  if(reason)reason.innerHTML=`<span class="${next.ready?'good':'warn'}">${next.ready?'Ready':'Waiting'}</span> · ${next.reason}<br>Estimated value: <span class="good">${perKill().toLocaleString()}</span> Tel Var`;
  if(btn)btn.disabled=!next.ready;

  const net=bankedTelVar+currentTelVar,gross=net+lostTelVar,eff=gross>0?Math.round((net/gross)*100):null;
  const netEl=document.getElementById('netSessionTv'),grossEl=document.getElementById('grossSessionTv'),effEl=document.getElementById('effSessionTv'),undoBtn=document.getElementById('undoBtn');
  if(netEl)netEl.textContent=net.toLocaleString();
  if(grossEl)grossEl.textContent=gross.toLocaleString();
  if(effEl)effEl.textContent=eff===null?'—':`${eff}%`;
  if(undoBtn)undoBtn.disabled=!actionStack.length;
}

function killNextTarget(){if(lastNextTarget&&lastNextTarget.ready)killBoss(lastNextTarget.di);}

function copySessionSummary(){
  const elapsed=farmElapsed(),net=bankedTelVar+currentTelVar,gross=net+lostTelVar,eff=gross>0?Math.round((net/gross)*100)+'%':'—';
  const perHour=(farmStart&&net>0&&elapsed>0)?Math.round(net/(elapsed/3600)).toLocaleString():'—';
  const summary=[
    'Imperial City Farming Session',
    `Mode: ${modeName()}`,
    `Farm time: ${fmtH(elapsed)}`,
    `Boss kills: ${totalKills}`,
    `Current carrying: ${currentTelVar.toLocaleString()}`,
    `Session banked: ${bankedTelVar.toLocaleString()}`,
    `Tel Var lost: ${lostTelVar.toLocaleString()}`,
    `Net Tel Var: ${net.toLocaleString()}`,
    `Gross Tel Var: ${gross.toLocaleString()}`,
    `Efficiency: ${eff}`,
    `Per hour: ${perHour}`,
    `Unknown timers: ${DISTRICTS.filter((_,i)=>timers[i].unknown).map(d=>d.name).join(', ')||'None'}`,
    '',
    'Recent history:',
    ...(eventLog.slice(0,12).map(e=>`${fmtClock(e.time)} — ${e.text}`))
  ].join('\n');
  const pill=document.getElementById('copyPill');
  const done=()=>{if(pill){pill.classList.add('show');setTimeout(()=>pill.classList.remove('show'),2200);}};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(summary).then(done).catch(()=>fallbackCopy(summary,done));}
  else fallbackCopy(summary,done);
}

function fallbackCopy(text,done){
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');done();}catch(e){toast('Copy failed','error');}
  ta.remove();
}

function flashTitle(kind,name){
  clearInterval(titleFlashTimer);
  let on=false,count=0;
  const msg=kind==='spawn'?`⚔ ${name} respawned`:`⚠ ${name} in 1 min`;
  titleFlashTimer=setInterval(()=>{document.title=on?baseDocTitle:msg;on=!on;if(++count>14){clearInterval(titleFlashTimer);document.title=baseDocTitle;}},650);
}

function windowAlert(name,type){
  flash(type==='spawn'?'green':'amber');
  toast(name,type);
  flashTitle(type,name);
  if(type==='spawn')playSpawn();
  else if(type==='warning')playWarn();
}

function updateNextUp(){
  const now=Date.now();
  let bestName='—',bestTimer='—',bestIsAlive=false,bestIdx=-1;
  let bestRem=Infinity;
  DISTRICTS.forEach((d,i)=>{
    const t=timers[i];
    if(t.unknown)return;
    if(!t.running||!t.end){if(!bestIsAlive){bestIsAlive=true;bestName=d.name;bestTimer='ALIVE';bestRem=-1;bestIdx=i;}return;}
    if(bestIsAlive)return;
    const rem=Math.max(0,(t.end-now)/1000);
    if(rem<bestRem){bestRem=rem;bestName=d.name;bestTimer=fmt(rem);bestIsAlive=false;bestIdx=i;}
  });
  const card=document.getElementById('nextUp');
  const nameEl=document.getElementById('nextUpName');
  const bossesEl=document.getElementById('nextUpBosses');
  const timerEl=document.getElementById('nextUpCountdown');
  const tvEl=document.getElementById('nextUpTV');
  const imgEl=document.getElementById('nextUpImg');
  if(nameEl)nameEl.textContent=bestName;
  if(timerEl){timerEl.textContent=bestTimer;timerEl.className='next-up-timer'+(bestIsAlive||bestTimer==='ALIVE'?' alive':'');}
  if(card)card.classList.toggle('alive',bestIsAlive||bestTimer==='ALIVE');
  if(bossesEl){bossesEl.textContent=bestIdx>=0?DISTRICTS[bestIdx].bosses.join(' · '):'—';}
  if(tvEl)tvEl.textContent=perKill().toLocaleString();
  if(imgEl&&bestIdx>=0){
    const firstBoss=DISTRICTS[bestIdx].bosses[0];
    const src=(typeof BOSS_IMAGES!=='undefined'&&BOSS_IMAGES[firstBoss])||'assets/boss-skull.png';
    if(imgEl.dataset.boss!==firstBoss){imgEl.dataset.boss=firstBoss;imgEl.src=src;}
  }
}

function perKill(){return Math.round(BASE_TV*MULT[stI]*(1+dcHeld.size*0.33)/grSz);}

function updateTV(){
  const m=MULT[stI],b=1+dcHeld.size*0.33,raw=Math.round(BASE_TV*m*b),pk=Math.round(raw/grSz);
  const sessionTelVar=bankedTelVar+currentTelVar,elapsed=farmElapsed();
  const grpLabel=grSz===1?'÷ Solo':`÷ ${grSz}`;
  document.getElementById('formula').innerHTML=
    `<div class="formula-row"><span class="lbl">Base</span><span class="val">1,327</span></div>`+
    `<div class="formula-row"><span class="lbl">× Stones mult</span><span class="val">×${m}</span></div>`+
    `<div class="formula-row"><span class="lbl">× District bonus</span><span class="val dc">×${b.toFixed(2)} <em>(${dcHeld.size}/6)</em></span></div>`+
    `<div class="formula-row"><span class="lbl">${grSz===1?'Group':'÷ Group'}</span><span class="val">${grpLabel}</span></div>`+
    `<div class="formula-result"><span class="lbl">Per Kill</span><span class="res">${pk.toLocaleString()}</span></div>`;
  document.getElementById('tvK').textContent=totalKills;
  document.getElementById('tvT').textContent=currentTelVar.toLocaleString();
  document.getElementById('tvB').textContent=bankedTelVar.toLocaleString();
  document.getElementById('tvL').textContent=lostTelVar.toLocaleString();
  document.getElementById('tvPK').textContent=pk.toLocaleString();
  document.getElementById('tvTime').textContent=fmtH(elapsed);
  const tvTGTel=document.getElementById('tvTGT');
  if(tvTGTel)tvTGTel.textContent=telvarTarget>0?telvarTarget.toLocaleString():'—';
  if(farmStart&&sessionTelVar>0&&elapsed>0){document.getElementById('tvH').textContent=Math.round(sessionTelVar/(elapsed/3600)).toLocaleString();}
  else document.getElementById('tvH').textContent='—';
  const startBtn=document.getElementById('farmStartBtn'),endBtn=document.getElementById('farmEndBtn');
  if(startBtn)startBtn.disabled=farmRunning;
  if(endBtn)endBtn.disabled=!farmRunning;
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  const presetBtn=document.getElementById(activePreset?`preset${activePreset.charAt(0).toUpperCase()+activePreset.slice(1)}`:'');
  if(presetBtn)presetBtn.classList.add('active');
  const presetNote=document.getElementById('presetNote');
  if(presetNote)presetNote.classList.toggle('show',districtCapturesLocked());
  const tvTargetWrap=document.getElementById('tvTargetWrap');
  if(tvTargetWrap){
    const net=bankedTelVar+currentTelVar;
    if(telvarTarget>0){
      const pct=Math.min(100,Math.round(net/telvarTarget*100));
      tvTargetWrap.style.display='';
      const tt=document.getElementById('tvTargetText');if(tt)tt.textContent=`${net.toLocaleString()} / ${telvarTarget.toLocaleString()}`;
      const tp=document.getElementById('tvTargetPct');if(tp)tp.textContent=`${pct}%`;
      const fill=document.getElementById('tvTargetFill');if(fill){fill.style.width=pct+'%';fill.classList.toggle('done',pct>=100);}
    }else{
      tvTargetWrap.style.display='none';
    }
  }
  updateCommandCenter();
  if(typeof updateNextUp==='function')updateNextUp();
}

function setSt(i,skipUndo=false){
  if(stI===i)return;
  if(!skipUndo)pushUndo('Multiplier change');
  stI=i;activePreset=skipUndo?activePreset:null;
  document.querySelectorAll('#stonesEl .seg').forEach((b,j)=>b.classList.toggle('sel',j===i));
  if(!skipUndo)logEvent(`Multiplier changed to ×${MULT[i]}.`);
  updateTV();
}

function setGr(g,skipUndo=false){
  if(grSz===g)return;
  if(!skipUndo)pushUndo('Group size change');
  grSz=g;activePreset=skipUndo?activePreset:null;
  document.querySelectorAll('#groupEl .seg').forEach((b,j)=>b.classList.toggle('sel',j+1===g));
  if(!skipUndo)logEvent(`Group size changed to ${g===1?'Solo':g}.`);
  updateTV();
}

function setAlliance(a){
  if(!ALLIANCES[a])return;
  alliance=a;
  document.querySelectorAll('#allianceEl .alliance-btn').forEach(b=>b.classList.toggle('sel',b.dataset.al===a));
  const lbl=document.getElementById('dcLabel');
  if(lbl)lbl.textContent=`${ALLIANCES[a].short}-held districts (tap to toggle)`;
  const hint=document.getElementById('mapHintAlliance');
  if(hint){const img=ALLIANCE_IMG_FULL[a]||ALLIANCE_IMG_FULL.dc;hint.innerHTML=`<img class="hint-alliance-img" id="mapHintImg" src="${img}" alt=""> control`;hint.style.color=ALLIANCES[a].color;}
  document.body.classList.remove('alliance-ep','alliance-dc','alliance-ad');
  document.body.classList.add('alliance-'+a);
  try{localStorage.setItem('ic-alliance',a);}catch(e){}
  if(typeof refreshSlice==='function')DISTRICTS.forEach((_,i)=>refreshSlice(i));
  updateTV();
}

function applyPreset(mode){
  pushUndo('Preset change');
  activePreset=mode;
  if(mode==='chud'){setSt(1,true);setGr(1,true);}
  else if(mode==='chad'){setSt(3,true);setGr(2,true);}
  else if(mode==='streakah'){
    setSt(3,true);setGr(1,true);dcHeld.clear();
    DISTRICTS.forEach((_,i)=>{refreshSlice(i);refreshRow(i);});
  }
  buildDCToggles();
  logEvent(`Preset selected: ${modeName()}.`);
  updateTV();
}

function toggleDC(i){
  if(districtCapturesLocked())return;
  pushUndo('District control toggle');
  dcHeld.has(i)?dcHeld.delete(i):dcHeld.add(i);
  logEvent(`${DISTRICTS[i].name} DC control ${dcHeld.has(i)?'enabled':'removed'}.`);
  refreshSlice(i);refreshRow(i);buildDCToggles();updateTV();
}

function startFarm(){
  pushUndo('Start farming');
  farmStart=Date.now();farmEnd=null;farmRunning=true;totalKills=0;currentTelVar=0;bankedTelVar=0;lostTelVar=0;eventLog=[];
  killStreak=0;
  logEvent('Farming session started.');
  saveSession();
  updateTV();
}

function endFarm(){
  if(farmRunning){pushUndo('End farming');farmEnd=Date.now();farmRunning=false;logEvent('Farming session ended.');saveSession();}
  updateTV();
}

function bankTelVar(){
  if(currentTelVar<=0){toast('No Tel Var to bank','info');return;}
  pushUndo('Bank Tel Var');
  const amount=currentTelVar;
  bankedTelVar+=currentTelVar;currentTelVar=0;totalKills=0;
  logEvent(`Banked ${amount.toLocaleString()} Tel Var.`);
  toast(`Banked ${amount.toLocaleString()} Tel Var`,'success');
  launchConfetti();
  saveSession();
  updateTV();
}

function gankedTelVar(){
  if(currentTelVar<=0){toast('No Tel Var carried','info');return;}
  pushUndo('Ganked');
  const lost=Math.floor(currentTelVar*0.5);
  lostTelVar+=lost;currentTelVar-=lost;
  resetStreak();
  logEvent(`Ganked — lost ${lost.toLocaleString()} Tel Var.`);
  toast(`Ganked — lost ${lost.toLocaleString()} Tel Var`,'error');
  saveSession();
  updateTV();
}

function setManualTelvar(){
  const input=document.getElementById('tvAdjustInput');
  const raw=input?input.value.trim():'';
  const n=parseInt(raw,10);
  if(raw===''||isNaN(n)||n<0){toast('Enter a Tel Var total (0 or more)','info');return;}
  pushUndo('Set Tel Var');
  currentTelVar=n;
  if(input)input.value='';
  logEvent(`Set carrying Tel Var to ${n.toLocaleString()}.`);
  toast(`Tel Var set to ${n.toLocaleString()}`,'success');
  updateTV();
}

function setTelvarTarget(){
  const input=document.getElementById('tvTargetInput');
  const raw=input?input.value.trim():'';
  const n=parseInt(raw,10);
  telvarTarget=(raw===''||!n||n<=0)?0:n;
  if(input)input.value='';
  try{localStorage.setItem('ic-telvar-target',telvarTarget);}catch(e){}
  updateTV();
}

function applyRespawnSort(){
  const wrap=document.getElementById('districts');
  if(!wrap)return;
  const rows=[...wrap.children];
  rows.sort((a,b)=>{
    const ai=parseInt(a.id.replace('dr','')),bi=parseInt(b.id.replace('dr',''));
    const sa=districtState(ai),sb=districtState(bi);
    if(sa.unknown&&!sb.unknown)return 1;
    if(!sa.unknown&&sb.unknown)return -1;
    if(sa.unknown&&sb.unknown)return 0;
    return (sa.up?0:sa.rem)-(sb.up?0:sb.rem);
  });
  rows.forEach(r=>wrap.appendChild(r));
}

function killBoss(i){
  pushUndo('Boss kill');
  const gain=perKill();
  timers[i].end=Date.now()+RESPAWN*1000;timers[i].running=true;timers[i].wasRunning=true;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;
  totalKills++;currentTelVar+=gain;
  logEvent(`Killed ${DISTRICTS[i].name} boss (${bossNamesForDistrict(i)}) — +${gain.toLocaleString()} Tel Var.`);
  updateTV();
}

function rstBoss(i){
  pushUndo('Reset boss timer');
  timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;
  logEvent(`Reset ${DISTRICTS[i].name} timer.`);
  updateTV();
}

function resetAll(){
  pushUndo('Reset all timers');
  DISTRICTS.forEach((_,i)=>{timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;});
  logEvent('Reset all boss timers.');
  updateTV();
}

function tick(){
  const now=Date.now();
  DISTRICTS.forEach((d,i)=>{
    const t=timers[i];let rem=0,up=true,wn=false,unknown=!!t.unknown;
    if(unknown){
      up=false;
    }else if(t.running&&t.end){
      rem=Math.max(0,(t.end-now)/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;
      if(wn&&!t.warnFired){t.warnFired=true;windowAlert(d.name,'warning');logEvent(`${d.name} respawns in 1 minute.`);}
      if(up&&t.wasRunning){t.running=false;t.end=null;t.wasRunning=false;t.warnFired=false;windowAlert(d.name,'spawn');logEvent(`${d.name} boss respawned.`);const row=document.getElementById(`dr${i}`);if(row){row.classList.add('just-up');setTimeout(()=>row.classList.remove('just-up'),3600);}}
    }
    const urg=!up&&!unknown&&rem<15,str=unknown?'UNKNOWN':up?'ALIVE':fmt(rem);
    refreshSlice(i);
    const svT=document.getElementById(`st${i}`);if(svT)svT.textContent=unknown?'UNKNOWN':str;
    const drow=document.getElementById(`dr${i}`),dot=document.getElementById(`dd${i}`),timer=document.getElementById(`dt${i}`);
    if(drow&&!drow.classList.contains('just-up')){drow.className='drow'+(dcHeld.has(i)?' dc-held':'');drow.classList.add(unknown?'unknown':up?'alive':wn?'warn':'dead');}
    if(dot){dot.className='ddot '+(unknown?'unknown':up?'alive':wn?'warn':'dead');}
    if(timer){timer.textContent=str;timer.className='dtimer '+(unknown?'unknown':up?'alive':urg?'urgent':wn?'warn':'dead');timer.title=unknown?'Exact respawn is unknown. Use Reset when you confirm it is alive.':'';}
  });
  buildSkulls();
  updateTV();
}


/* DISTRICT STATUS SUMMARY + SCOUT/GUESS FEATURE OVERRIDES */
function unknownDecayInfo(i){
  const t=timers[i];
  if(!t.unknown||!t.unknownAt)return {age:0,label:'Unknown',detail:'Exact respawn unknown.'};
  const age=(Date.now()-t.unknownAt)/1000;
  if(age<300)return {age,label:'Fresh unknown',detail:`Unknown since ${fmt(age)} ago. Could still be early in its timer.`};
  if(age<600)return {age,label:'Uncertain',detail:`Unknown for ${fmt(age)}. It may still be down.`};
  if(age<900)return {age,label:'Check soon',detail:`Unknown for ${fmt(age)}. Worth checking soon.`};
  return {age,label:'Likely ready',detail:`Unknown for ${fmt(age)}. Treat as checkable.`};
}

function districtState(i){
  const t=timers[i];let rem=0,up=true,wn=false,urg=false,unknown=false;
  if(t.unknown){
    const decay=unknownDecayInfo(i);
    return {up:false,rem:Infinity,wn:false,urg:false,unknown:true,decay};
  }
  if(t.running&&t.end){rem=Math.max(0,(t.end-Date.now())/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;urg=!up&&rem<15;}
  return {up,rem,wn,urg,unknown:false,decay:null};
}

function districtStatusClass(state){
  if(state.unknown)return 'unknown';
  if(state.up)return 'alive';
  if(state.urg)return 'urgent';
  if(state.wn)return 'warn';
  return 'dead';
}

function districtStatusText(i){
  const state=districtState(i),t=timers[i];
  if(state.unknown)return {main:state.decay.label,sub:state.decay.detail};
  if(state.up){
    const seen=t.seenAt?` · scouted ${fmt((Date.now()-t.seenAt)/1000)} ago`:'';
    return {main:'Alive',sub:`Ready now${dcHeld.has(i)?' · alliance bonus active':''}${seen}`};
  }
  if(state.wn)return {main:`${fmt(state.rem)}`,sub:'One-minute warning window'};
  return {main:`${fmt(state.rem)}`,sub:'Respawn timer known'};
}

function renderDistrictStatusSummary(){
  const wrap=document.getElementById('districtStatusSummary');
  if(!wrap)return;
  wrap.innerHTML=DISTRICTS.map((d,i)=>{
    const state=districtState(i),info=districtStatusText(i),cls=districtStatusClass(state),dc=dcHeld.has(i)?' · DC':'';
    return `<div class="status-card ${cls}"><div class="status-name">${d.name}${dc}</div><div class="status-main">${info.main}</div><div class="status-sub">${info.sub}</div></div>`;
  }).join('');
}

function buildRows(){
  const wrap=document.getElementById('districts');wrap.innerHTML='';
  DISTRICTS.forEach((d,i)=>{
    const row=document.createElement('div');row.className='drow alive';row.id=`dr${i}`;
    const chips=d.bosses.map((boss,bi)=>bossChipHtml(boss,i,bi)).join('');
    row.innerHTML=`
      <div class="ddot alive" id="dd${i}"></div>
      <div class="dinfo">
        <div class="dname">${d.name}</div>
        <div class="dbosses boss-chips">${chips}</div>
      </div>
      <span class="dc-pill" id="dp${i}" style="display:none" aria-label="Alliance bonus"><img src="${ALLIANCE_IMG_FULL[alliance]||ALLIANCE_IMG_FULL.dc}" alt=""></span>
      <div class="dtimer alive" id="dt${i}">ALIVE</div>
      <div class="drow-actions">
        <button class="dbtn kill" onclick="killBoss(${i})">Killed</button>
        <button class="dbtn guess" onclick="guessTimer(${i})">Guess</button>
        <button class="dbtn scout" onclick="seenAlive(${i})">Seen Alive</button>
        <button class="dbtn rst" onclick="rstBoss(${i})">Reset</button>
      </div>`;
    wrap.appendChild(row);
  });
}

function seenAlive(i){
  pushUndo('Scout check');
  const staleRem=(timers[i].running&&timers[i].end)?Math.max(0,Math.round((timers[i].end-Date.now())/1000)):0;
  const clearedStale=staleRem>30;
  timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;timers[i].seenAt=Date.now();
  if(clearedStale){
    logEvent(`Scout check: ${DISTRICTS[i].name} (${bossNamesForDistrict(i)}) seen alive — cleared stale ${fmt(staleRem)} timer.`);
    toast(`${DISTRICTS[i].name} seen alive — stale timer cleared`,'success');
  } else {
    logEvent(`Scout check: ${DISTRICTS[i].name} (${bossNamesForDistrict(i)}) seen alive.`);
    toast(`${DISTRICTS[i].name} seen alive`,'success');
  }
  if(typeof tick==='function')tick(); else updateTV();
}

function guessTimer(i) {
  const response = prompt("How many minutes ago do you think it died? Enter 1-14.");
  if (response === null) return;
  const minutesAgo = Number(response);
  if (Number.isNaN(minutesAgo) || minutesAgo < 1 || minutesAgo > 14) {
    showNotice("Invalid guess. Enter a number from 1 to 14.");
    return;
  }

  const now = Date.now();
  const guessedKillTime = now - (minutesAgo * 60 * 1000);
  const previousState = JSON.parse(JSON.stringify(state));
  pushUndo(previousState, "Manual timer guess");

  state.timers[i] = guessedKillTime;
  state.unknowns[i] = null;
  state.seenAlive[i] = null;
  addLog(`Guessed timer: ${DISTRICTS[i].name} died about ${minutesAgo} min ago`);
  saveState();
  renderAll();
}

function setTimerGuess(i,minsAgo){
  pushUndo('Timer guess');
  const elapsed=Math.max(0,minsAgo*60);
  timers[i].unknown=false;timers[i].unknownAt=null;timers[i].seenAt=null;timers[i].warnFired=false;
  if(elapsed>=RESPAWN){
    timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;
    logEvent(`Timer guess: ${DISTRICTS[i].name} died about ${minsAgo} min ago, so it is likely alive/checkable now.`);
  }else{
    timers[i].end=Date.now()+(RESPAWN-elapsed)*1000;timers[i].running=true;timers[i].wasRunning=true;
    logEvent(`Timer guess: ${DISTRICTS[i].name} died about ${minsAgo} min ago. Estimated respawn in ${fmt(RESPAWN-elapsed)}.`);
  }
  if(typeof tick==='function')tick(); else updateTV();
}

function killBoss(i){
  pushUndo('Boss kill');
  const gain=perKill();
  timers[i].end=Date.now()+RESPAWN*1000;timers[i].running=true;timers[i].wasRunning=true;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;timers[i].seenAt=null;
  totalKills++;currentTelVar+=gain;
  bumpStreak();
  logEvent(`Killed ${DISTRICTS[i].name} boss (${bossNamesForDistrict(i)}) — +${gain.toLocaleString()} Tel Var.`);
  saveSession();
  if(typeof tick==='function')tick(); else updateTV();
}

function rstBoss(i){
  pushUndo('Reset boss timer');
  timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;timers[i].seenAt=null;
  logEvent(`Reset ${DISTRICTS[i].name} timer.`);
  saveSession();
  if(typeof tick==='function')tick(); else updateTV();
}

function resetAll(){
  pushUndo('Reset all timers');
  DISTRICTS.forEach((_,i)=>{timers[i].end=null;timers[i].running=false;timers[i].wasRunning=false;timers[i].warnFired=false;timers[i].unknown=false;timers[i].unknownAt=null;timers[i].seenAt=null;});
  logEvent('Reset all boss timers.');
  if(typeof tick==='function')tick(); else updateTV();
}

function getNextTarget(){
  const states=DISTRICTS.map((_,i)=>districtState(i));
  const alive=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>x.state.up&&!x.state.unknown);
  const streak=activePreset==='streakah';
  if(alive.length){
    alive.sort((a,b)=>{
      const ad=(!streak&&dcHeld.has(a.i))?1:0,bd=(!streak&&dcHeld.has(b.i))?1:0;
      if(bd!==ad)return bd-ad;
      const as=timers[a.i].seenAt?1:0,bs=timers[b.i].seenAt?1:0;
      if(bs!==as)return bs-as;
      return a.i-b.i;
    });
    const n=alive[0],seen=timers[n.i].seenAt?' Scout check confirmed alive.':'';
    return {di:n.i,title:`${n.d.name} — ${bossNamesForDistrict(n.i)}`,ready:true,reason:streak?`Alive now.${seen} Streakah mode ignores flags and keeps the route goblin-safe.`:dcHeld.has(n.i)?`Alive now + alliance bonus active.${seen}`:`Alive now. No alliance bonus on this district.${seen}`};
  }
  const knownWaiting=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>!x.state.unknown).sort((a,b)=>a.state.rem-b.state.rem);
  if(knownWaiting.length){
    const waiting=knownWaiting[0];
    return {di:waiting.i,title:`${waiting.d.name} — ${bossNamesForDistrict(waiting.i)}`,ready:false,reason:`Closest known respawn in ${fmt(waiting.state.rem)}.`};
  }
  const unknowns=DISTRICTS.map((d,i)=>({d,i,state:states[i]})).filter(x=>x.state.unknown).sort((a,b)=>a.state.decay.age-b.state.decay.age);
  if(unknowns.length){
    const first=unknowns[0];
    return {di:first.i,title:`Check ${first.d.name} — unknown timer`,ready:false,reason:`${first.state.decay.detail} Use Guess if you have a rough death time, or Seen Alive if you scout it up.`};
  }
  return {di:null,title:'No target available',ready:false,reason:'No reliable timer data.'};
}

function updateCommandCenter(){
  const next=getNextTarget();lastNextTarget=next;
  const title=document.getElementById('nextTargetTitle'),reason=document.getElementById('nextTargetReason'),btn=document.getElementById('killNextBtn');
  if(title)title.textContent=next.title;
  if(reason)reason.innerHTML=`<span class="${next.ready?'good':'warn'}">${next.ready?'Ready':'Waiting'}</span> · ${next.reason}<br>Estimated value: <span class="good">${perKill().toLocaleString()}</span> Tel Var`;
  if(btn)btn.disabled=!next.ready;

  const net=bankedTelVar+currentTelVar,gross=net+lostTelVar,eff=gross>0?Math.round((net/gross)*100):null;
  const netEl=document.getElementById('netSessionTv'),grossEl=document.getElementById('grossSessionTv'),effEl=document.getElementById('effSessionTv'),undoBtn=document.getElementById('undoBtn');
  if(netEl)netEl.textContent=net.toLocaleString();
  if(grossEl)grossEl.textContent=gross.toLocaleString();
  if(effEl)effEl.textContent=eff===null?'—':`${eff}%`;
  if(undoBtn)undoBtn.disabled=!actionStack.length;
  renderDistrictStatusSummary();
}

function tick(){
  const now=Date.now();
  DISTRICTS.forEach((d,i)=>{
    const t=timers[i];let rem=0,up=true,wn=false,unknown=!!t.unknown;
    if(unknown){up=false;}
    else if(t.running&&t.end){
      rem=Math.max(0,(t.end-now)/1000);up=rem<=0;wn=!up&&rem<=WARN_AT;
      if(wn&&!t.warnFired){t.warnFired=true;windowAlert(d.name,'warning');logEvent(`${d.name} respawns in 1 minute.`);const wsl=document.getElementById(`sl${i}`);if(wsl){wsl.classList.add('respawn-pulse');setTimeout(()=>wsl.classList.remove('respawn-pulse'),3500);}}
      if(up&&t.wasRunning){t.running=false;t.end=null;t.wasRunning=false;t.warnFired=false;windowAlert(d.name,'spawn');logEvent(`${d.name} boss respawned.`);const row=document.getElementById(`dr${i}`);if(row){row.classList.add('just-up');setTimeout(()=>row.classList.remove('just-up'),3600);}const rsl=document.getElementById(`sl${i}`);if(rsl){rsl.classList.add('respawn-pulse');setTimeout(()=>rsl.classList.remove('respawn-pulse'),3500);}}
    }
    const state=districtState(i),urg=!up&&!unknown&&rem<15;
    let str=up?'ALIVE':fmt(rem),title='';
    if(unknown){const decay=unknownDecayInfo(i);str=decay.label.toUpperCase();title=decay.detail;}
    refreshSlice(i);
    const svT=document.getElementById(`st${i}`);if(svT)svT.textContent=unknown?'UNKNOWN':str;
    const drow=document.getElementById(`dr${i}`),dot=document.getElementById(`dd${i}`),timer=document.getElementById(`dt${i}`);
    if(drow&&!drow.classList.contains('just-up')){drow.className='drow'+(dcHeld.has(i)?' dc-held':'');drow.classList.add(districtStatusClass(state));}
    if(dot){dot.className='ddot '+districtStatusClass(state);}
    if(timer){timer.textContent=str;timer.className='dtimer '+(unknown?'unknown':up?'alive':urg?'urgent':wn?'warn':'dead');timer.title=title;}
  });
  buildSkulls();
  updateTV();
  updateNextUp();
  updateWakeLock();
}

let wakeLock=null,lastWakeLockState=false;
async function acquireWakeLock(){
  if(wakeLock||!('wakeLock' in navigator))return;
  try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}catch(e){}
}
async function releaseWakeLock(){
  if(!wakeLock)return;
  try{await wakeLock.release();}catch(e){}
  wakeLock=null;
}
function updateWakeLock(){
  const anyRunning=timers.some(t=>t.running);
  if(anyRunning===lastWakeLockState)return;
  lastWakeLockState=anyRunning;
  if(anyRunning)acquireWakeLock();else releaseWakeLock();
}
function isObsMode(){return new URLSearchParams(location.search).get('obs')==='1';}

function openHelp(){const o=document.getElementById('helpOverlay');if(o)o.style.display='flex';}
function closeHelp(){const o=document.getElementById('helpOverlay');if(o)o.style.display='none';}
function maybeCloseHelp(e){if(e&&e.target===e.currentTarget)closeHelp();}

function init(){
  if(isObsMode())document.body.classList.add('obs');
  const savedAlliance=localStorage.getItem('ic-alliance');
  setAlliance(savedAlliance&&ALLIANCES[savedAlliance]?savedAlliance:'dc');
  buildGear();buildMap();buildRows();buildDCToggles();buildSkulls();updateTV();
  if(!isObsMode()&&!localStorage.getItem('ic-help-seen')){openHelp();localStorage.setItem('ic-help-seen','1');}
  tick();setInterval(tick,500);
  setInterval(saveSession,15000);
  checkSavedSession();
}
init();

/* v20 alternate silly visual themes */
let fantasyTheme = localStorage.getItem("esoIcFantasyTheme") || "normal";

function setFantasyTheme(theme) {
  fantasyTheme = theme || "normal";
  localStorage.setItem("esoIcFantasyTheme", fantasyTheme);
  document.body.classList.remove("theme-whip", "theme-guar", "theme-streakah");
  if (fantasyTheme !== "normal") {
    document.body.classList.add(`theme-${fantasyTheme}`);
  }
  updateFantasyThemeButtons();
  if (theme === "streakah" && typeof showStreakahSplashIfReady === "function") {
    showStreakahSplashIfReady();
  }
}

function updateFantasyThemeButtons() {
  const ids = {
    normal: "themeNormal",
    whip: "themeWhip",
    guar: "themeGuar",
    streakah: "themeStreakah"
  };

  Object.entries(ids).forEach(([theme, id]) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("active", fantasyTheme === theme);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setFantasyTheme(fantasyTheme);
});


/* v21 Streakah Joker splash */
let streakahSplashTimer = null;

function isStreakahPresetActive() {
  if (typeof activePreset !== "undefined") {
    return activePreset === "streakah";
  }

  const presetBtn = document.getElementById("presetStreakah");
  return !!presetBtn && presetBtn.classList.contains("active");
}

function isStreakahThemeActive() {
  if (typeof fantasyTheme !== "undefined") {
    return fantasyTheme === "streakah";
  }

  return document.body.classList.contains("theme-streakah");
}

function showStreakahSplashIfReady() {
  if (!isStreakahPresetActive() || !isStreakahThemeActive()) {
    return;
  }

  const splash = document.getElementById("streakahSplash");
  if (!splash) {
    return;
  }

  splash.classList.remove("show");
  void splash.offsetWidth;
  splash.classList.add("show");

  if (typeof showNotice === "function") {
    showNotice("Im the streakah baby", "info");
  } else if (typeof showToast === "function") {
    showToast("Im the streakah baby", "info");
  }

  clearTimeout(streakahSplashTimer);
  streakahSplashTimer = setTimeout(() => {
    splash.classList.remove("show");
  }, 3000);
}


/* v22 collapsible Key / Tips / FAQ */
let helpPanelCollapsed = localStorage.getItem("esoIcHelpCollapsed") === "true";

function applyHelpPanelState() {
  const panel = document.querySelector(".help-panel");
  const btn = document.getElementById("helpToggleBtn");

  if (!panel || !btn) {
    return;
  }

  panel.classList.toggle("collapsed", helpPanelCollapsed);
  btn.textContent = helpPanelCollapsed ? "Show Help" : "Hide Help";
  btn.setAttribute("aria-expanded", String(!helpPanelCollapsed));
}

function toggleHelpPanel() {
  helpPanelCollapsed = !helpPanelCollapsed;
  localStorage.setItem("esoIcHelpCollapsed", String(helpPanelCollapsed));
  applyHelpPanelState();
}

document.addEventListener("DOMContentLoaded", applyHelpPanelState);


// Help panel default state
if (localStorage.getItem("esoIcHelpCollapsed") === null) {
  localStorage.setItem("esoIcHelpCollapsed", "true");
}


/* ═══════════════════════════════════════════
   FEATURE: Kill Streak
   ═══════════════════════════════════════════ */
let killStreak = 0;
let bestStreak = parseInt(localStorage.getItem('esoIcBestStreak') || '0', 10);

function bumpStreak() {
  killStreak++;
  if (killStreak > bestStreak) {
    bestStreak = killStreak;
    try { localStorage.setItem('esoIcBestStreak', String(bestStreak)); } catch(e) {}
  }
  updateStreakBadge();
}

function resetStreak() {
  if (killStreak >= 3) {
    toast(`Kill streak of ${killStreak} ended!`, 'error');
  }
  killStreak = 0;
  updateStreakBadge();
}

function updateStreakBadge() {
  const badge = document.getElementById('streakBadge');
  const countEl = document.getElementById('streakCount');
  if (!badge || !countEl) return;
  if (killStreak >= 2) {
    countEl.textContent = killStreak;
    badge.classList.add('show');
    badge.classList.remove('pop');
    void badge.offsetWidth;
    badge.classList.add('pop');
  } else {
    badge.classList.remove('show');
  }
}


/* ═══════════════════════════════════════════
   FEATURE: Confetti on Bank
   ═══════════════════════════════════════════ */
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ffd060','#c9a84c','#58c070','#68b8e8','#ff6f32','#a98cff','#ff4a34','#8ed9ff'];
  const particles = [];
  const count = 80;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 4,
      w: Math.random() * 8 + 3,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.3,
      life: 1
    });
  }

  let raf;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx;
      p.vy += 0.35;
      p.y += p.vy;
      p.rot += p.rv;
      p.life -= 0.012;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}


/* ═══════════════════════════════════════════
   FEATURE: Session Persistence
   ═══════════════════════════════════════════ */
const SESSION_KEY = 'esoIcSession';

function saveSession() {
  try {
    const data = {
      ts: Date.now(),
      timers: timers.map(t => ({
        end: t.end, running: t.running, wasRunning: t.wasRunning,
        warnFired: t.warnFired, unknown: t.unknown,
        unknownAt: t.unknownAt, seenAt: t.seenAt || null
      })),
      dcHeld: [...dcHeld],
      stI, grSz, totalKills, currentTelVar, bankedTelVar, lostTelVar,
      farmStart, farmEnd, farmRunning,
      activePreset, alliance,
      killStreak, bestStreak,
      eventLog: eventLog.slice(0, 20)
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch(e) {}
}

function loadSession(data) {
  data.timers.forEach((t, i) => {
    if (i < timers.length) Object.assign(timers[i], t);
  });
  dcHeld.clear();
  (data.dcHeld || []).forEach(i => dcHeld.add(i));
  stI = data.stI ?? 0;
  grSz = data.grSz ?? 1;
  totalKills = data.totalKills ?? 0;
  currentTelVar = data.currentTelVar ?? 0;
  bankedTelVar = data.bankedTelVar ?? 0;
  lostTelVar = data.lostTelVar ?? 0;
  farmStart = data.farmStart ?? null;
  farmEnd = data.farmEnd ?? null;
  farmRunning = data.farmRunning ?? false;
  activePreset = data.activePreset ?? null;
  if(data.alliance&&ALLIANCES[data.alliance])setAlliance(data.alliance);
  killStreak = data.killStreak ?? 0;
  bestStreak = data.bestStreak ?? bestStreak;
  eventLog = data.eventLog || [];

  document.querySelectorAll('#stonesEl .seg').forEach((b, j) => b.classList.toggle('sel', j === stI));
  document.querySelectorAll('#groupEl .seg').forEach((b, j) => b.classList.toggle('sel', j + 1 === grSz));
  buildDCToggles();
  updateStreakBadge();
  renderEventLog();
  updateTV();
}

function checkSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const age = Date.now() - (data.ts || 0);
    if (age > 4 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const bar = document.getElementById('restoreBar');
    if (bar) bar.classList.add('show');
  } catch(e) {}
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      loadSession(JSON.parse(raw));
      toast('Session restored', 'success');
    }
  } catch(e) {}
  dismissRestore();
}

function dismissRestore() {
  const bar = document.getElementById('restoreBar');
  if (bar) bar.classList.remove('show');
  localStorage.removeItem(SESSION_KEY);
}


/* ═══════════════════════════════════════════
   FEATURE: Keyboard Shortcuts
   ═══════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  if (key >= '1' && key <= '6') {
    const idx = parseInt(key) - 1;
    if (idx < DISTRICTS.length) {
      killBoss(idx);
      e.preventDefault();
    }
    return;
  }

  switch(key) {
    case 'b':
      bankTelVar();
      e.preventDefault();
      break;
    case 'g':
      gankedTelVar();
      e.preventDefault();
      break;
    case 'u':
      undoLastAction();
      e.preventDefault();
      break;
    case 'n':
      killNextTarget();
      e.preventDefault();
      break;
    case 's':
      if (farmRunning) endFarm();
      else startFarm();
      e.preventDefault();
      break;
  }
});
