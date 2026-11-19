// ===== GAME (render + UI) =====
(function(){
'use strict';
window.addEventListener('error',function(e){ if(window.PokiSDK||window.CrazyGames) return; var d=document.getElementById('errbox')||document.body.appendChild(Object.assign(document.createElement('pre'),{id:'errbox'})); d.style.cssText='position:fixed;left:0;bottom:0;z-index:99;background:#a00;color:#fff;font-size:11px;max-width:100%;white-space:pre-wrap;margin:0'; d.textContent+=e.message+' @'+e.lineno+'\n'; });
var $=function(id){return document.getElementById(id);};
var QS = new URLSearchParams(location.search), DEBUG = QS.has('debug'); var COVER = QS.has('cover'); try{ if(localStorage.getItem('dj_debug')==='1') DEBUG=true; }catch(e){}

// ---------------- platform wrapper ----------------
// Poki: init > gameLoadingFinished > gameplayStart/Stop (deduped) > commercialBreak between rooms.
// CrazyGames v3: init (body exists here) > loadingStart > loadingStop > gameplayStart/Stop > midgame between rooms.
function plog(){ if(!DEBUG) return; var m=[].slice.call(arguments).join(' '); (window.__pflog=window.__pflog||[]).push(((performance.now()/1000).toFixed(1))+' '+m); console.log('[PF] '+m); }
var PF = {
  kind: window.PokiSDK?'poki':(window.CrazyGames&&window.CrazyGames.SDK?'cg':'none'),
  playing:false, adBusy:false, locale:null,
  init: function(){ var self=this;
    plog('init',self.kind);
    if (self.kind==='poki') return window.PokiSDK.init().catch(function(){});
    if (self.kind==='cg') return window.CrazyGames.SDK.init().then(function(){
      var S=window.CrazyGames.SDK;
      try{ S.game.loadingStart(); plog('loadingStart'); }catch(e){}
      try{ self.locale=(S.user&&S.user.systemInfo&&S.user.systemInfo.locale)||null; }catch(e){}
      try{ Snd.pmute(!!(S.game.settings&&S.game.settings.muteAudio)); }catch(e){}
      try{ S.game.addSettingsChangeListener(function(st){ Snd.pmute(!!(st&&st.muteAudio)); }); }catch(e){}
    }).catch(function(){ self.kind='none'; });
    return Promise.resolve(); },
  loaded: function(){ plog('loadingStop'); try{ if(this.kind==='poki') PokiSDK.gameLoadingFinished(); if(this.kind==='cg') CrazyGames.SDK.game.loadingStop(); }catch(e){} },
  setPlaying: function(on){ if(on===this.playing) return; this.playing=on; plog(on?'gameplayStart':'gameplayStop'); try{
    if(this.kind==='poki') on?PokiSDK.gameplayStart():PokiSDK.gameplayStop();
    if(this.kind==='cg') on?CrazyGames.SDK.game.gameplayStart():CrazyGames.SDK.game.gameplayStop(); }catch(e){} },
  happy: function(){ try{ if(this.kind==='cg') CrazyGames.SDK.game.happytime(); }catch(e){} },
  midgame: function(cb){ var self=this; if(self.adBusy) return; plog('midgame'); self.adBusy=true; self.setPlaying(false);
    var fin=false, done=function(){ if(fin) return; fin=true; plog('adDone'); self.adBusy=false; Snd.mute(false); cb&&cb(); };
    try{
      if (self.kind==='poki'){ Snd.mute(true); return PokiSDK.commercialBreak(function(){ Snd.mute(true); }).then(done,done); }
      if (self.kind==='cg') return CrazyGames.SDK.ad.requestAd('midgame',{adStarted:function(){ Snd.mute(true); plog('adStarted'); },adFinished:done,adError:done});
    }catch(e){}
    done(); },
  rewarded: function(cb){ var self=this; if(self.adBusy) return; plog('rewarded'); self.adBusy=true; self.setPlaying(false);
    var fin=false, done=function(ok){ if(fin) return; fin=true; self.adBusy=false; Snd.mute(false); cb(!!ok); };
    try{
      if (self.kind==='poki'){ Snd.mute(true); return PokiSDK.rewardedBreak(function(){ Snd.mute(true); }).then(function(w){done(w);},function(){done(false);}); }
      if (self.kind==='cg') return CrazyGames.SDK.ad.requestAd('rewarded',{adStarted:function(){ Snd.mute(true); },adFinished:function(){done(true);},adError:function(){toast(tl('noAd'));done(false);}});
    }catch(e){}
    // test build: placeholder
    var f=$('adfake'); f.textContent=tl('adTest'); f.style.display='flex';
    setTimeout(function(){ f.style.display='none'; done(true); }, 1200); },
  saveData: function(k,v){ try{ if(this.kind==='cg') CrazyGames.SDK.data.setItem(k,v); else localStorage.setItem(k,v); }catch(e){} },
  loadData: function(k){ try{ if(this.kind==='cg') return CrazyGames.SDK.data.getItem(k); return localStorage.getItem(k); }catch(e){ return null; } }
};
document.body.classList.add('pf-'+PF.kind);

// ---------------- sound ----------------
var Snd = (function(){
  var ac=null, master=null, muted=false, pmuted=false, off=false;
  try{ off = localStorage.getItem('dj_snd')==='0'; }catch(e){}
  function ctx(){ if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=0.5; master.connect(ac.destination);}catch(e){} } if(ac&&ac.state==='suspended') ac.resume(); return ac; }
  function tone(f, d, type, vol, slide, delay){
    if (muted||pmuted||off) return; var a=ctx(); if(!a) return; var t=a.currentTime+(delay||0);
    var o=a.createOscillator(), g=a.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide), t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.2,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+d+0.02);
  }
  function noise(d, vol, f, delay){
    if (muted||pmuted||off) return; var a=ctx(); if(!a) return; var t=a.currentTime+(delay||0);
    var b=a.createBuffer(1, Math.floor(a.sampleRate*d), a.sampleRate), ch=b.getChannelData(0);
    for (var i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
    var s=a.createBufferSource(); s.buffer=b; var fl=a.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=f||1200;
    var g=a.createGain(); g.gain.value=vol||0.2; s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }
  // background music: a quiet, bouncy minor-key loop scheduled ahead with WebAudio (no audio files)
  var mus=null, musOn=false, nextT=0, stepI=0, BPM=104, SPB=60/BPM/2;
  var PROG=[[57,60,64],[53,57,60],[55,59,62],[52,56,59]]; // Am F G E
  var MEL=[69,-1,72,71,69,-1,64,-1, 65,-1,69,67,65,-1,60,-1, 67,-1,71,69,67,-1,62,64, 68,-1,71,-1,64,-1,-1,-1];
  function mtof(m){ return 440*Math.pow(2,(m-69)/12); }
  function note(m,t,d,type,vol){ var a=ac, o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.value=mtof(m);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.015); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g); g.connect(mus); o.start(t); o.stop(t+d+0.05); }
  function sched(){
    if (!ac||!musOn) return;
    if (nextT<ac.currentTime) nextT=ac.currentTime+0.05;
    while (nextT<ac.currentTime+0.4){
      var bar=Math.floor(stepI/8)%4, i=stepI%8, ch=PROG[bar], m=MEL[stepI%32];
      if (i===0||i===4) note(ch[0]-24, nextT, SPB*3.5, 'triangle', 0.22);
      if (i%2===1) note(ch[(i>>1)%3], nextT, SPB*0.9, 'square', 0.025);
      if (m>0) note(m, nextT, SPB*1.6, 'triangle', 0.07);
      if (i===2||i===6) { var b=ac.createBuffer(1,Math.floor(ac.sampleRate*0.05),ac.sampleRate),c=b.getChannelData(0); for(var k=0;k<c.length;k++) c[k]=(Math.random()*2-1)*(1-k/c.length);
        var src=ac.createBufferSource(), hg=ac.createGain(), hf=ac.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=6000; hg.gain.value=0.05; src.buffer=b; src.connect(hf); hf.connect(hg); hg.connect(mus); src.start(nextT); }
      nextT+=SPB; stepI++;
    }
  }
  setInterval(sched, 150);
  function bgm(){
    var want=!(muted||pmuted||off||document.hidden);
    if (!ac) return; // created on the first key/touch/click (autoplay rules)
    if (!mus){ mus=ac.createGain(); mus.gain.value=0; mus.connect(master); }
    musOn = want && ac.state==='running';
    mus.gain.cancelScheduledValues(ac.currentTime); mus.gain.setTargetAtTime(musOn?0.55:0, ac.currentTime, 0.15);
  }
  document.addEventListener('visibilitychange', function(){ bgm(); });
  var lastCoin=0;
  var S = {
    coin:function(){ var n=performance.now(); if(n-lastCoin<70) return; lastCoin=n; tone(1320,0.08,'square',0.06); tone(1760,0.12,'square',0.06,0,0.06); },
    squish:function(){ tone(260,0.15,'sine',0.18,0.5); noise(0.12,0.08,700); },
    clank:function(){ tone(520,0.08,'square',0.08); tone(780,0.12,'triangle',0.12,0,0.05); },
    spring:function(){ noise(0.18,0.25,2500); tone(180,0.2,'sawtooth',0.1,0.4); },
    thud:function(){ noise(0.25,0.3,400); tone(90,0.25,'sine',0.25,0.5); },
    take:function(){ tone(420,0.06,'triangle',0.1,1.4); },
    fill:function(){ tone(660,0.06,'triangle',0.1); tone(990,0.1,'triangle',0.1,0,0.05); },
    buy:function(){ [523,659,784,1046].forEach(function(f,i){ tone(f,0.16,'square',0.07,0,i*0.08); }); },
    horn:function(){ tone(392,0.25,'sawtooth',0.07); tone(523,0.4,'sawtooth',0.07,0,0.22); },
    boss:function(){ [196,247,294,392].forEach(function(f,i){ tone(f,0.35,'sawtooth',0.08,0,i*0.18); }); },
    bad:function(){ tone(300,0.25,'sawtooth',0.07,0.6); },
    pay:function(){ tone(880,0.03,'square',0.04); },
    hit:function(){ noise(0.05,0.1,1800); },
    swing:function(){ noise(0.09,0.07,3500); tone(240,0.08,'triangle',0.05,0.6); },
    glug:function(n){ for (var k=0;k<2+n*2;k++) tone(420+k*70+Math.random()*40, 0.09, 'sine', 0.09, 1.35, k*0.075); noise(0.18+0.1*n, 0.05, 1400); },
    cork:function(){ tone(190,0.07,'square',0.1,2.4); [784,988,1175].forEach(function(f,i){ tone(f,0.14,'triangle',0.09,0,0.06+i*0.07); }); },
    nope:function(){ tone(200,0.09,'triangle',0.09,0.8); },
    win:function(){ [523,659,784,1046,1318].forEach(function(f,i){ tone(f,0.2,'square',0.07,0,i*0.09); tone(f/2,0.25,'triangle',0.08,0,i*0.09); }); },
    pop:function(){ tone(700,0.08,'sine',0.15,1.8); },
    pour:function(){ noise(0.25,0.12,1800); tone(500,0.18,'sine',0.06,1.6); },
    sizzle:function(){ noise(0.35,0.06,5000); },
    door:function(){ noise(0.3,0.25,900); tone(140,0.2,'square',0.06,0.6); },
    mute:function(m){ muted=m; S.bgm&&S.bgm(); },
    pmute:function(m){ pmuted=m; plog('platformMute',m); S.bgm&&S.bgm(); },
    toggle:function(){ off=!off; try{localStorage.setItem('dj_snd',off?'0':'1');}catch(e){} bgm(); return !off; },
    bgm:bgm,
    isOn:function(){ return !off; }, unlock:function(){ ctx(); if(ac&&ac.state!=='running') ac.resume().then(bgm); else bgm(); }
  };
  return S;
})();

// ---------------- canvas ----------------
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){ this.rect(x,y,w,h); };
var cv=$('c'), cx=cv.getContext('2d'), VW=0, VH=0, DPR=1, bgCache=null;
var COL=['#f04848','#4a8cf7','#59d86a','#ff9a3c','#ffe14a','#8b5cf6','#a16b3f','#22c7c7','#2b3a8f','#f472d0','#f3efe2','#1f7a4d'];
var COL_HI=COL.map(function(c){ return shade(c, 0.28); }), COL_LO=COL.map(function(c){ return shade(c, -0.22); });
function shade(hex, k){ var n=parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255, f=function(v){ return Math.round(k>0? v+(255-v)*k : v*(1+k)); }; return 'rgb('+f(r)+','+f(g)+','+f(b)+')'; }
var CAP=DJ.CAP;
function ease(t){ t=Math.max(0,Math.min(1,t)); return t<0.5? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function easeOut(t){ t=Math.max(0,Math.min(1,t)); return 1-Math.pow(1-t,3); }
function backOut(t){ t=Math.max(0,Math.min(1,t)); var c=1.9; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

// ---------------- state ----------------
var SAVE={v:5, level:1, coins:0, up:{s:0,a:0,h:0}, gear:{}}, curStage=0, curLane=0, curType='f', RT=null, choosing=false, nextRoom=null, carryHp=null, entryHp=null, walk=0, energy=0, magic=false, revived=false, lastReward=0, UPMAX=10, L=null, B=[], KN=[], V=[], sel=-1, hist=[], undoLeft=5, extra=0, anims=[], won=false, winT=0, moved=0, hintMv=null, hintUntil=0, parts=[], bw=40, bh=124, uh=24, stuckShown=false, lastAdT=performance.now(), F=null, VS=null, lost=false, laters=[], floats=[], orbs=[], STG={top:58,h:150};
function later(sec, fn){ laters.push({t:sec, fn:fn}); }
function loadSave(){ try{ var s=PF.loadData('dj_save_v5'); if (s && !QS.has('reset')){ var o=JSON.parse(s); if (o && o.v===5 && o.level>=1) SAVE=o; } SAVE.coins=SAVE.coins|0; SAVE.up=SAVE.up||{}; ['s','a','h'].forEach(function(k){ SAVE.up[k]=Math.max(0,Math.min(UPMAX,SAVE.up[k]|0)); }); SAVE.gear=SAVE.gear||{}; SLOTS.forEach(function(k){ var r=SAVE.gear[k]; SAVE.gear[k]=(r>=0 && r<=3)? r|0 : -1; }); }catch(e){} if (QS.has('level')) SAVE.level=Math.max(1,+QS.get('level')||1); }
function saveNow(){ PF.saveData('dj_save_v5', JSON.stringify(SAVE)); }
var SLOTS=['hat','top','glv','pnt','sho','rng','amu'], RAR=['#e9e9f0','#5fd86a','#5a9cff','#b97aff'];
var GSTAT={hat:{k:'hp',v:[8,16,26,40]}, top:{k:'hp',v:[12,24,40,60]}, glv:{k:'atk',v:[2,4,7,12]}, pnt:{k:'def',v:[1,2,3,5]}, sho:{k:'spd',v:[1,2,3,4]}, rng:{k:'crit',v:[8,14,22,35]}, amu:{k:'heal',v:[4,8,14,22]}};
function gearSum(k){ var t=0; SLOTS.forEach(function(sl){ var r=SAVE.gear[sl]; if (r>=0 && GSTAT[sl].k===k) t+=GSTAT[sl].v[r]; }); return t; }
function gearVal(sl,r){ var g=GSTAT[sl], v=g.v[r]; return g.k==='crit'? v+'%' : (g.k==='def'? '-'+v : '+'+v); }
function loadLevel(n, keepExtra, st, hp, lane, type){
  curStage=st||0; curLane=lane||0; curType=type||'f'; walk=0; magic=false; L=DJ.gen(n,curStage,curLane,curType); L.lane=curLane; L.tut=(n===1 && curStage<2); B=L.bottles.map(function(b){ return b.slice(); });
  if (!keepExtra) extra=0; for (var e=0;e<extra;e++) B.push([]);
  KN=B.map(function(b){ return b.map(function(c,i){ return !L.hidden || i===b.length-1; }); });
  V=B.map(function(b,i){ return {x:0,y:0, lift:0, shake:0, busy:0, cork:DJ.done(b)&&b.length?1:0, pop:0, drop:0.5+i*0.05, ox:0, oy:0, ang:0, disp:null}; });
  tutMv=null; plan=null; sel=-1; hist=[]; undoLeft=5; anims=[]; won=false; lost=false; moved=0; hintMv=null; parts=[]; stuckShown=false; laters=[]; floats=[]; orbs=[];
  F={}; for (var fk in L.fight) F[fk]=L.fight[fk]; F.atk+=5*SAVE.up.s+gearSum('atk'); F.heroMax+=10*SAVE.up.a+gearSum('hp'); F.heal+=6*SAVE.up.h+gearSum('heal'); F.def=gearSum('def'); F.crit=gearSum('crit')/100; F.cd+=gearSum('spd');
  if (hp==null){ F.hHp=F.heroMax; if (!keepExtra) revived=false; } else F.hHp=Math.max(1,Math.min(F.heroMax,Math.round(hp))); entryHp=F.hHp;
  VS={hHp:F.hHp, mHp:F.mHp, hBar:F.hHp/F.heroMax, mBar:1, hLag:F.hHp/F.heroMax, mLag:1, fadeIn:curStage>0&&hp!=null?0.45:0, shield:0, poison:0, hAtk:0, hHurt:0, hDrink:0, hDead:0, hGlow:0, dc:0, shPop:0, shBreak:0, mAtk:0, mHurt:0, mDead:0, mIn:0.7, landed:0, poofed:0, dizzy:0, cd:F.cd, cdPop:0, cdSeq:cdSeq, kind:monsterKind(L), tier:L.role==='big'? (Math.floor(n/24)+3)%4 : tierOf(n), scn:tierOf(n)}; fx=[]; shk=0;
  layout(); syncAll(); updHud();
  $('winM').classList.remove('show'); $('loseM').classList.remove('show');
  var seen=function(k){ if (SAVE[k]) return false; SAVE[k]=1; saveNow(); return true; };
  if (curStage===0 && L.kind!=='n') banner(tl(L.kind==='big'?'bigF':'bossF'), '', 2400);
  else if (L.king) banner((L.role==='big'?'🐉 ':'👹 ')+tl('m_'+VS.kind), '', 2400);
  else if (n===1 && curStage===2 && seen('pT')) banner(tl('pwTip'), '', 6000);
  else if (n>=2 && seen('k1')) banner(tl('sk1'), '', 5200);
  else if (n>=4 && seen('k2')) banner(tl('sk2'), '', 5200);
  else if (L.colors>=5 && seen('sS')) banner(tl('r_stun'), '', 3600);
  else if (L.colors>=6 && seen('sP')) banner(tl('r_psn'), '', 3600);
  else if (L.hidden && seen('sM')) banner(tl('mystery'), '', 3000);
  setTut(L.tut? tl(curStage? 'tutB2' : 'tutA2') : '');
}
function dispOf(i){ return B[i].map(function(c,k){ return {c:c, a:1, k:KN[i][k]}; }); }
function syncAll(){ V.forEach(function(v,i){ if (!v.busy) v.disp=dispOf(i); }); }
function knownRun(i){ var b=B[i], n=0; for (var k=b.length-1;k>=0 && b[k]===b[b.length-1] && KN[i][k];k--) n++; return n; }
function pourCount(i,j){ if (!DJ.canPour(B,i,j)) return 0; return Math.min(knownRun(i), CAP-B[j].length); }

// ---------------- layout ----------------
function layout(){
  var n=B.length; if (!n) return;
  var small=VW<=600; STG.top=(PF.kind==='poki'? (small?140:112) : (small?96:58)); STG.h=Math.round(Math.max(118, Math.min(250, VH*(VW>VH?0.3:0.255)))); $('banner').style.top=Math.round(STG.top+STG.h+76)+'px';
  var sg=stg(), skE=$('skills'); skE.style.top=Math.round(STG.top+STG.h+5)+'px'; skE.style.width=Math.round(Math.min(sg.w-8, 420))+'px';
  var top=STG.top+STG.h+50, bot=92, availH=VH-top-bot, availW=VW-20, best=0, bestRows=1;
  for (var rows=1; rows<=4; rows++){ var per=Math.ceil(n/rows), w=Math.min(availW/(per*1.8), (availH-0)/(rows*(3.15+1.55)));
    if (w>best+0.5){ best=w; bestRows=rows; } }
  bw=Math.max(18, Math.min(62, best)); bh=bw*3.15; uh=bh*0.91/CAP;
  var per2=Math.ceil(n/bestRows), cellH=bh+bw*1.55, totalH=bestRows*cellH, y0=top+Math.max(0,(availH-totalH)/2)+bw*1.55;
  for (var i=0;i<n;i++){ var r=Math.floor(i/per2), inRow=(r===bestRows-1)? n-per2*(bestRows-1) : per2, k=i-r*per2;
    V[i].x=VW/2+(k-(inRow-1)/2)*bw*1.8; V[i].y=y0+r*cellH+bh; V[i].row=r; }
  bgCache=null;
}
function resize(){ DPR=Math.min(window.devicePixelRatio||1, 2); VW=innerWidth; VH=innerHeight; cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR); layout(); }
addEventListener('resize', resize);

// ---------------- moves ----------------
function startPour(i,j,n){
  var c=DJ.top(B[i]), si=V[i], dj=V[j], k;
  var before=dispOf(i), dBefore=dispOf(j);
  for (k=0;k<n;k++){ B[i].pop(); KN[i].pop(); B[j].push(c); KN[j].push(true); }
  var revealed=false; if (B[i].length && !KN[i][B[i].length-1]){ KN[i][B[i].length-1]=true; revealed=true; }
  if (plan && plan.length && plan[0][0]===i && plan[0][1]===j && n===Math.min(DJ.run(B[j]), n) && !L.hidden) plan.shift(); else plan=null;
  hist.push({i:i,j:j,n:n,rev:revealed}); moved++;
  var dir = dj.x>si.x+1 ? 1 : (dj.x<si.x-1 ? -1 : (dj.x>VW/2 ? -1 : 1));
  if (dj.x-bh*1.05<4) dir=-1; else if (dj.x+bh*1.05>VW-4) dir=1;
  var sd=before.slice(0,before.length-n); sd.push({c:c,a:n,k:true}); si.disp=sd;
  dBefore.push({c:c,a:0,k:true}); dj.disp=dBefore;
  si.busy=1; dj.busy=1; si.cork=0;
  anims.push({i:i,j:j,n:n,c:c,dir:dir,t:0, tGo:0.2, tPour:0.2+0.11*n, tBack:0.2, h0:sum(before), hd0:sum(dBefore), snd:false});
  hintMv=null; if (L.tut && moved>=2) setTut('');
}
function sum(d){ var s=0; d.forEach(function(u){ s+=u.a; }); return s; }
function finishAnim(a){
  var si=V[a.i], dj=V[a.j]; si.busy=0; dj.busy=0; si.ox=si.oy=si.ang=0;
  si.disp=dispOf(a.i); dj.disp=dispOf(a.j);
  var drank=false;
  if (DJ.done(B[a.j]) && B[a.j].length){ dj.pop=1; Snd.cork(); sparkle(dj.x, dj.y-bh*0.5, a.c, 16); drank=true; doDrink(a.c, dj); }
  doMonsterTurn(drank? 1.15 : 0.05);
  energy=Math.min(100, energy+(drank? 22 : 5)); updSkills();
  checkEnd(drank? 1.0 : 0.3);
}
function checkEnd(dieAt){
  if (won || lost) return;
  if (F.mHp<=0){ won=true; }
  else if (F.hHp<=0){ lost=true; }
  else if (DJ.solved(B)){ F.mHp=0; won=true; dieAt=1.5; later(1.12, function(){ VS.hAtk=HA; Snd.swing(); }); later(1.12+HA*0.42, function(){ VS.mHp=0; hitMonster(999, true); }); }
  if (won){ magic=false; later(dieAt, function(){ VS.mHp=0; VS.mDead=0.001; Snd.thud(); Snd.squish(); }); }
}
// ---------------- fight (rules live in sim.js, this is the show) ----------------
var doorHits=[], OL='#221528', FNT='"Trebuchet MS","Arial Rounded MT Bold",system-ui,sans-serif', HA=0.46, MA=0.5, cdSeq=0, shk=0, hitStop=0, hurtFlash=0, fx=[], stageCache=null, stageKey='', torches=[];
var THEMES=[{w0:'#5a4582',w1:'#2b1e3e',fl:'#7d6c93',fd:'#4a3c5c',gl:'255,170,80'},{w0:'#3a6a5d',w1:'#1a2e2b',fl:'#73917f',fd:'#42594e',gl:'200,255,120'},{w0:'#3f6298',w1:'#1b2a48',fl:'#829cc2',fd:'#4c6288',gl:'130,225,255'},{w0:'#84403a',w1:'#3a1a1c',fl:'#a3725f',fd:'#643e36',gl:'255,130,60'}];
var MCOL={slime:['#6fd16a','#5ab8f0','#f0914a','#b684f5'], gob:['#86d95a','#55c9a8','#d9b04a','#c77ae0'], skel:['#f1ecdc','#cfe6ee','#ecdcae','#e6cdea'], bat:['#8a55c4','#4a7cc4','#c4556a','#4f9a78'], orc:['#5f9447','#4a8f8a','#a8823c','#8a5aa8'], ogre:['#6a9a4a','#4a86a8','#b8683c','#8a4ab0'], dragon:['#d0483a','#3a9a6a','#4a78d0','#8a4ac8']};
var MD={slime:{h:48,w:60,s:1}, gob:{h:70,w:50,s:1}, skel:{h:72,w:44,s:1}, bat:{h:76,w:70,s:1}, orc:{h:84,w:62,s:1.08}, ogre:{h:100,w:72,s:1.22}, dragon:{h:106,w:84,s:1.3}};
function monsterKind(l){ return l.role==='big' ? 'dragon' : (l.role==='boss' ? 'ogre' : ['slime','gob','skel','bat','orc'][((l.level-1)*2+l.stage+(l.lane||0)*2)%5]); }
function tierOf(n){ return Math.floor((n-1)/6)%4; }
function stg(){ var k=STG.h/200, w=Math.min(VW-12, STG.h*3.4), x=(VW-w)/2; return {x:x, w:w, k:k, hx:x+w*0.25, mx:x+w*0.75, gy:STG.top+STG.h-24*k}; }
function mCY(g){ var d=MD[VS.kind]; return g.gy-(VS.kind==='bat'? 52 : d.h*0.5)*d.s*g.k; }
function fs(c,col,lw){ c.fillStyle=col; c.fill(); if (lw!==0){ c.lineWidth=lw||3; c.strokeStyle=OL; c.stroke(); } }
function rr(c,x,y,w,h,r){ c.beginPath(); c.roundRect(x,y,w,h,r); }
function el(c,x,y,rx,ry,rot){ c.beginPath(); c.ellipse(x,y,rx,ry==null?rx:ry,rot||0,0,6.3); }
function poly(c,p){ c.beginPath(); c.moveTo(p[0],p[1]); for (var i=2;i<p.length;i+=2) c.lineTo(p[i],p[i+1]); c.closePath(); }
function bone(c,x1,y1,x2,y2,col){ c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineWidth=8; c.strokeStyle=OL; c.stroke(); c.lineWidth=4.4; c.strokeStyle=col; c.stroke(); }
// mood: 0 open, 1 blink, 2 hurt, 3 happy
function eye(c,x,y,r,mood,col){ c.lineWidth=2.6; c.strokeStyle=col||OL;
  if (mood===2){ c.beginPath(); c.moveTo(x-r,y-r); c.lineTo(x+r*0.6,y); c.lineTo(x-r,y+r); c.stroke(); return; }
  if (mood===3){ c.beginPath(); c.arc(x,y+r*0.5,r,Math.PI*1.12,Math.PI*1.88); c.stroke(); return; }
  if (mood===1){ c.beginPath(); c.moveTo(x-r,y); c.lineTo(x+r,y); c.stroke(); return; }
  c.fillStyle=col||OL; el(c,x,y,r*0.85,r*1.12); c.fill(); c.fillStyle='#fff'; el(c,x+r*0.28,y-r*0.42,r*0.36); c.fill(); }
function brow(c,x,y,d){ c.beginPath(); c.moveTo(x-5,y-2.6*d); c.lineTo(x+5,y+2.6*d); c.lineWidth=3; c.strokeStyle=OL; c.stroke(); }
function dashP(a){ return a<0? 0 : a<0.2? -0.07*Math.sin(a/0.2*1.57) : a<0.42? -0.07+1.07*easeOut((a-0.2)/0.22) : a<0.6? 1 : 1-ease((a-0.6)/0.4); }
function swingA(a){ return a<0.25? a/0.25*1.7 : (a<0.5? 1.7-4.4*easeOut((a-0.25)/0.25) : -2.7+2.7*ease((a-0.5)/0.5)); }   // 0 > wind up > strike > 0
// small white pictograms (same ones inside the bottles and on the fight HUD)
function icon(c, role, x, y, s, col, lw){
  c.save(); c.translate(x,y); c.scale(s,s); c.lineJoin='round'; c.beginPath();
  if (role==='atk'){ c.rotate(0.7); poly(c,[-0.17,0.25,-0.17,-0.7,0,-1.02,0.17,-0.7,0.17,0.25,0.52,0.25,0.52,0.47,0.13,0.47,0.13,1,-0.13,1,-0.13,0.47,-0.52,0.47,-0.52,0.25]); }
  else if (role==='shd'){ c.moveTo(0,-0.95); c.lineTo(0.82,-0.66); c.lineTo(0.82,0); c.quadraticCurveTo(0.76,0.7,0,1); c.quadraticCurveTo(-0.76,0.7,-0.82,0); c.lineTo(-0.82,-0.66); c.closePath(); }
  else if (role==='heal'){ c.moveTo(0,0.92); c.bezierCurveTo(-1.5,-0.05,-0.78,-1.25,0,-0.45); c.bezierCurveTo(0.78,-1.25,1.5,-0.05,0,0.92); }
  else if (role==='mag'){ poly(c,[0,-1,0.24,-0.24,1,0,0.24,0.24,0,1,-0.24,0.24,-1,0,-0.24,-0.24]); }
  else if (role==='stun'){ poly(c,[0.3,-1,-0.62,0.14,-0.06,0.14,-0.32,1,0.62,-0.22,0.06,-0.22]); }
  else { c.arc(0,-0.2,0.78,0,6.3); c.roundRect(-0.42,0.3,0.84,0.62,0.14); }
  if (lw){ c.lineWidth=lw/s; c.strokeStyle=OL; c.stroke(); } c.fillStyle=col; c.fill();
  if (role==='psn'){ c.fillStyle=OL; el(c,-0.3,-0.2,0.22); c.fill(); el(c,0.3,-0.2,0.22); c.fill(); c.fillRect(-0.05,0.5,0.1,0.42); }
  c.restore();
}
function floatTx(x,y,txt,col,big,ic){ floats.push({x:x,y:y,txt:txt,col:col||'#fff',t:1.0,big:big,ic:ic}); }
function hitMonster(v, big, c, crit){ var g=stg(), k=g.k, y=mCY(g); VS.mHurt=0.34; shk=Math.max(shk, crit?1.1:(big?0.7:0.35)); hitStop=crit?0.12:0.07;
  if (v<900) floatTx(g.mx+(Math.random()-0.5)*14*k, y-34*k, '-'+v+(crit?'!!':''), crit?'#ff9a3c':'#ffd84a', big); Snd.hit(); Snd.thud();
  fx.push({ty:'slash', x:g.mx-6*k, y:y, t:0, d:0.24, c:c==null?'#fff':COL_HI[c], r:46*k});
  for (var i=0;i<12;i++) parts.push({x:g.mx,y:y,vx:(Math.random()-0.2)*320,vy:-80-Math.random()*240,t:0.5,c:i%3?'#ffe9a8':'#fff',r:2+Math.random()*3,g:700}); }
function doDrink(c, bv){
  var ev=DJ.drink(F, c), g=stg(), k=g.k, hpAfter=F.hHp, mAfter=F.mHp, cdA=F.cd, sq=++cdSeq, T=0.62; hist=[];
  orbs.push({x0:bv.x, y0:bv.y-bh-bw*0.3, x1:g.hx+16*k, y1:g.gy-58*k, t:0, d:0.36, c:c});
  later(0.36, function(){ VS.hDrink=0.3; VS.dc=c; Snd.fill(); });
  later(0.58, function(){ fx.push({ty:'ring', x:g.hx, y:g.gy-40*k, t:0, d:0.4, c:COL_HI[c], r:50*k}); });
  if (ev.role==='atk'){ later(T, function(){ VS.hAtk=HA; Snd.swing(); }); later(T+HA*0.42, function(){ VS.mHp=Math.max(0,Math.min(VS.mHp,mAfter)); hitMonster(ev.v, true, c, ev.crit); }); }
  else if (ev.role==='heal'){ later(T, function(){ VS.hHp=hpAfter; VS.hGlow=0.5; floatTx(g.hx, g.gy-70*k, '+'+ev.v, '#8df07a', true, 'heal'); Snd.buy();
    for (var i=0;i<14;i++) parts.push({x:g.hx+(Math.random()-0.5)*50*k, y:g.gy-Math.random()*60*k, vx:0, vy:-40-Math.random()*60, t:0.7+Math.random()*0.4, c:i%2?'#8df07a':'#d6ffc8', r:2+Math.random()*2.5, g:-60}); }); }
  else if (ev.role==='shd'){ later(T, function(){ VS.shield++; VS.shPop=0.4; floatTx(g.hx, g.gy-70*k, '+1', '#9cc8ff', true, 'shd'); Snd.clank(); }); }
  else if (ev.role==='stun'){ later(T, function(){ fx.push({ty:'bolt', x:g.mx, y:mCY(g), t:0, d:0.3}); VS.mHurt=0.3; VS.dizzy=1.8; shk=Math.max(shk,0.4);
    if (sq>VS.cdSeq){ VS.cdSeq=sq; VS.cd=cdA; VS.cdPop=0.4; } floatTx(g.mx, mCY(g)-40*k, '+'+F.stun, '#ffe14a', true, 'stun'); Snd.spring(); Snd.hit(); }); }
  else if (ev.role==='psn'){ later(T, function(){ VS.poison+=F.psn; fx.push({ty:'cloud', x:g.mx, y:mCY(g), t:0, d:0.6, r:40*k}); VS.mHurt=0.2; floatTx(g.mx, mCY(g)-40*k, '+'+F.psn, '#d3b0ff', true, 'psn'); Snd.squish(); }); }
}
function doMonsterTurn(delay){
  var ev=DJ.monsterTurn(F), g=stg(), k=g.k, hpAfter=F.hHp, mAfter=F.mHp, cdA=F.cd, sq=++cdSeq;
  later(delay, function(){ if (sq>VS.cdSeq){ VS.cdSeq=sq; if (VS.cd!==cdA) VS.cdPop=0.22; VS.cd=cdA; } });
  if (ev.psn) later(delay, function(){ VS.mHp=Math.max(0,Math.min(VS.mHp,mAfter)); VS.mHurt=Math.max(VS.mHurt,0.16); floatTx(g.mx+22*k, mCY(g)-26*k, '-'+ev.psn, '#d3b0ff');
    for (var i=0;i<5;i++) parts.push({x:g.mx+(Math.random()-0.5)*40*k, y:mCY(g)+(Math.random()-0.5)*30*k, vx:0, vy:-30-Math.random()*40, t:0.6, c:'#b684f5', r:2+Math.random()*3, g:-50}); });
  if (ev.blocked||ev.hit){ later(delay+0.1, function(){ VS.mAtk=MA; Snd.swing(); if (VS.kind==='dragon'){ Snd.sizzle(); var d=MD.dragon, x0=g.mx-46*d.s*k, y0=g.gy-70*d.s*k, tt=MA*0.42;
      for (var q=0;q<34;q++){ var dl=Math.random()*0.12; parts.push({x:x0,y:y0,vx:(g.hx+20*k-x0)/tt*(0.8+Math.random()*0.3),vy:(g.gy-40*k-y0)/tt+(Math.random()-0.5)*120,t:tt+dl,c:['#ffe14a','#ff9a3c','#f04848'][q%3],r:4+Math.random()*6,g:0}); } } });
    later(delay+0.1+MA*0.42, function(){ var hy=g.gy-44*k;
      if (ev.blocked){ VS.shield=Math.max(0,VS.shield-1); VS.shPop=0.45; VS.shBreak=0.45; floatTx(g.hx, g.gy-70*k, tl('blocked'), '#9cc8ff', true); Snd.clank(); Snd.hit(); shk=Math.max(shk,0.3);
        for (var i=0;i<12;i++) parts.push({x:g.hx+30*k,y:hy,vx:(Math.random()-0.6)*300,vy:-60-Math.random()*200,t:0.45,c:i%2?'#cfe4ff':'#fff',r:2+Math.random()*2.5,g:600}); }
      else { VS.hHp=Math.max(0,hpAfter); VS.hHurt=0.4; floatTx(g.hx, g.gy-70*k, '-'+ev.hit, '#ff6a5a', true); Snd.bad(); Snd.thud(); hurtFlash=1; shk=Math.max(shk,1); hitStop=0.08;
        fx.push({ty:'slash', x:g.hx+6*k, y:hy, t:0, d:0.24, c:'#ff8a7a', r:44*k, flip:1});
        for (var j=0;j<10;j++) parts.push({x:g.hx,y:hy,vx:(Math.random()-0.8)*300,vy:-60-Math.random()*220,t:0.5,c:j%2?'#ff9a8a':'#fff',r:2+Math.random()*2.5,g:700}); } }); }
}
// ----- characters: drawn at 1 unit = 1px around their feet, facing each other -----
function heroArt(c, t){
  var a=VS.hAtk>0? 1-VS.hAtk/HA : -1, drink=VS.hDrink>0, cheer=won && VS.mDead>0.3 && !choosing && !VS.empty, down=VS.hDead>0;
  var mood= down||VS.hHurt>0? 2 : (cheer? 3 : (drink? 1 : ((t%3.4)<0.12? 1 : 0)));
  var br=Math.sin(t*3.2), sway=Math.sin(t*2.1)*3+(a>=0?8:0);
  var sw= a>=0? 0.5-swingA(a)*0.7 : (cheer? -0.5+Math.sin(t*9)*0.12 : (drink? 1.5 : 0.5+br*0.04));
  var lean= a>=0? (a<0.25? -0.14 : (a<0.6? 0.24 : 0.24*(1-(a-0.6)/0.4))) : (drink? -0.18 : 0);
  c.save(); c.rotate(lean); c.translate(0, br*0.8);
  c.beginPath(); c.moveTo(-8,-48); c.quadraticCurveTo(-30-sway,-36,-27-sway*1.5,-9); c.lineTo(-12,-13); c.closePath(); fs(c,'#d9484e');
  el(c,-17,-31,11,13); fs(c,'#5b8fe6'); el(c,-17,-31,5,6); fs(c,'#ffd84a',2);
  var G0=SAVE.gear, lgC= G0.pnt>=0? ['#9a9fb0','#2f8f5a','#3a5fb8','#7a3fb0'][G0.pnt] : '#3b3350', btC= G0.sho>=0? ['#c9c9d4','#3fb87a','#5a9cff','#b97aff'][G0.sho] : null;
  rr(c,-12,-17,10,17,4); fs(c,lgC); rr(c,2,-17,10,17,4); fs(c,lgC); if (btC){ rr(c,-13,-7,12,7,3); fs(c,btC,2.5); rr(c,1,-7,12,7,3); fs(c,btC,2.5); }
  var G=SAVE.gear, arC= G.top>=0? ['#dfe6ee','#3fb87a','#4f8fe8','#a05ae0'][G.top] : ['#4f8fe8','#3f9fd8','#5a7ae8','#6a6ae8'][Math.min(3,Math.floor(SAVE.up.a/3))], swC=['#eef3fa','#ffe9a0','#a8f2ff','#ffb09a'][Math.min(3,Math.floor(SAVE.up.s/3))];
  rr(c,-15,-47,30,33,10); fs(c,arC);
  c.fillStyle='rgba(255,255,255,0.32)'; rr(c,-11,-44,9,13,4.5); c.fill();
  c.fillStyle='#ffd84a'; c.fillRect(-13.5,-25,27,5); rr(c,-3.5,-27,7,8.5,2); fs(c,'#fff3b0',2); if (G.amu>=0){ c.lineWidth=1.6; c.strokeStyle='#ffd84a'; c.beginPath(); c.arc(1,-46,7,0.3,Math.PI-0.3); c.stroke(); el(c,1,-38,3.2,3.8); fs(c,RAR[G.amu],1.8); }
  el(c,1,-63,18,17.5); fs(c,'#ffd9b3');
  c.fillStyle='rgba(255,120,120,0.45)'; el(c,13,-54,4,2.6); c.fill();
  c.beginPath(); c.moveTo(-3,-82); c.quadraticCurveTo(-20,-102,-28+sway*0.5,-80); c.quadraticCurveTo(-15,-87,-4,-78); c.closePath(); fs(c,'#ff5a5a',2.5);
  c.beginPath(); c.arc(1,-66,19.5,Math.PI,0); c.closePath(); fs(c,G.hat>=1? ['','#a8ecb0','#a8ccff','#d9b8ff'][G.hat] : '#cfd8e6'); if (G.hat>=2){ poly(c,[14,-70,22,-80,20,-68]); fs(c,'#ffd84a',2); }
  c.fillStyle='rgba(255,255,255,0.6)'; el(c,-6,-78,6,3,-0.5); c.fill();
  rr(c,-19.5,-68,9,17,3); fs(c,'#b4bfd2'); rr(c,-20.5,-70,43,6.5,3); fs(c,'#aab6c9');
  eye(c,6,-59,3.3,mood); eye(c,15.5,-59,3.3,mood);
  c.lineWidth=2.2; c.strokeStyle=OL;
  if (cheer){ c.beginPath(); c.arc(11,-52,4,0,Math.PI); c.closePath(); fs(c,'#7a2a2a',2); }
  else if (mood===2){ el(c,11,-51,2.4,2.8); fs(c,'#7a2a2a',2); }
  else if (!drink){ c.beginPath(); c.arc(11,-53,3,0.2,Math.PI-0.2); c.stroke(); }
  if (drink){ c.save(); c.translate(20,-56); c.rotate(-2.0); rr(c,-4.5,-13,9,14,3.5); fs(c,COL[VS.dc||0],2.2); rr(c,-3,-17,6,5,1.5); fs(c,'#e6edf5',2); c.restore(); el(c,17,-49,5,5); fs(c,'#ffd9b3',2.5); }
  c.save(); c.translate(13,-37); c.rotate(sw);
  poly(c,[-4,-9,4,-9,3.5,-45,0,-53,-3.5,-45]); fs(c,swC,2.5); c.fillStyle='rgba(0,0,0,0.16)'; c.fillRect(0,-45,3,36);
  rr(c,-9,-11.5,18,5.5,2); fs(c,'#ffcf3a',2.5); rr(c,-2.6,-7,5.2,12,2); fs(c,'#8a5a2a',2.2); el(c,0,0,5.6); fs(c,G.glv>=0? ['#c9c9d4','#3fb87a','#5a9cff','#b97aff'][G.glv] : '#ffd9b3',2.5); if (G.rng>=0){ el(c,3.5,-2.5,2); fs(c,RAR[G.rng],1.4); }
  c.restore(); c.restore();
}
var mArt={
  slime:function(c,t,col,wa,ang,mood,a){
    var sq=1+Math.sin(t*4.2)*0.05-(a>=0&&a<0.3? 0.16*Math.sin(a/0.3*Math.PI) : 0), w=30*sq, h=46/sq;
    c.beginPath(); c.moveTo(-w,0); c.bezierCurveTo(-w*1.18,-h*0.75,-w*0.55,-h,0,-h); c.bezierCurveTo(w*0.55,-h,w*1.18,-h*0.75,w,0); c.quadraticCurveTo(0,7,-w,0); fs(c,col);
    c.fillStyle=shade(col,-0.16); c.beginPath(); c.moveTo(-w*0.9,-2); c.quadraticCurveTo(0,5,w*0.9,-2); c.quadraticCurveTo(0,-10,-w*0.9,-2); c.fill();
    c.fillStyle='rgba(255,255,255,0.6)'; el(c,11,-h*0.74,8,4.2,0.5); c.fill(); el(c,19,-h*0.52,2.4); c.fill();
    c.fillStyle='rgba(255,255,255,0.22)'; el(c,12,-14,3); c.fill(); el(c,-20,-12,2); c.fill();
    eye(c,-14,-h*0.47,4.8,mood); eye(c,0,-h*0.47,4.8,mood); if (ang){ brow(c,-15,-h*0.47-8,-1); brow(c,1,-h*0.47-8,1); }
    if (ang||a>=0){ el(c,-7,-h*0.24,5,3.6); fs(c,'#3a1a2a',2); c.fillStyle='#fff'; c.fillRect(-9,-h*0.24-3.4,3,3); } else { c.lineWidth=2.2; c.strokeStyle=OL; c.beginPath(); c.arc(-7,-h*0.3,4,0.2,Math.PI-0.2); c.stroke(); } },
  gob:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3.6)*1.2);
    rr(c,-10,-12,8,12,3); fs(c,'#5a3d24'); rr(c,2,-12,8,12,3); fs(c,'#5a3d24');
    el(c,13,-27,5); fs(c,col,2.5);
    rr(c,-13,-39,26,29,9); fs(c,'#9a6638'); c.fillStyle='#4a2f1a'; c.fillRect(-11.5,-21,23,4); poly(c,[-6,-39,0,-30,6,-39]); fs(c,shade(col,-0.1),2);
    poly(c,[-12,-57,-37,-67,-15,-45]); fs(c,col); poly(c,[12,-57,35,-69,15,-45]); fs(c,col);
    el(c,0,-52,17,15.5); fs(c,col);
    poly(c,[-12,-53,-27,-48,-12,-45]); fs(c,shade(col,-0.14),2.5);
    el(c,-8,-57,4.6,5); fs(c,'#fff27a',2.2); el(c,4,-57,4.6,5); fs(c,'#fff27a',2.2);
    if (mood===2){ eye(c,-8,-57,3,2); eye(c,4,-57,3,2); } else { c.fillStyle=OL; el(c,-9.5,-57,1.9); c.fill(); el(c,2.5,-57,1.9); c.fill(); }
    brow(c,-9,-64,ang?-1:-0.4); brow(c,5,-64,ang?1:0.4);
    c.beginPath(); c.moveTo(-12,-43); c.quadraticCurveTo(-3,-36,9,-44); c.lineWidth=2.4; c.strokeStyle=OL; c.stroke(); poly(c,[-8,-41.5,-6,-37,-4,-40.5]); fs(c,'#fff',1.5); poly(c,[1,-40.5,3,-37,5,-41.5]); fs(c,'#fff',1.5);
    c.save(); c.translate(-15,-27); c.rotate(wa); rr(c,-2.6,-8,5.2,13,2); fs(c,'#6e4224',2.2); rr(c,-7,-11,14,4.5,2); fs(c,'#8a8090',2.2); poly(c,[-4.2,-11,4.2,-11,0,-36]); fs(c,'#dfe6ee',2.5); el(c,0,0,5.2); fs(c,col,2.5); c.restore(); },
  skel:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3.3)*1.2); var dk=shade(col,-0.2);
    bone(c,-6,-19,-7,-3,col); bone(c,6,-19,7,-3,col); el(c,-9,-2,5,3); fs(c,col,2.5); el(c,5,-2,5,3); fs(c,col,2.5);
    bone(c,9,-39,15,-24,col); bone(c,0,-41,0,-22,col);
    rr(c,-9,-24,18,7,3); fs(c,col,2.5);
    [-39,-33,-27].forEach(function(y,i){ rr(c,-11+i,y,22-i*2,4.4,2.2); fs(c,col,2.2); });
    rr(c,-9,-48,18,10,3.5); fs(c,dk); el(c,0,-57,16,15); fs(c,col);
    c.strokeStyle=OL; c.lineWidth=1.8; [-4,0,4].forEach(function(x){ c.beginPath(); c.moveTo(x,-47); c.lineTo(x,-40); c.stroke(); });
    c.beginPath(); c.moveTo(7,-71); c.lineTo(5,-66); c.lineTo(9,-63); c.stroke();
    el(c,-7,-58,4.8,5.4); c.fillStyle=OL; c.fill(); el(c,4,-58,4.8,5.4); c.fill(); poly(c,[-2.5,-49.5,-1,-53,0.5,-49.5]); c.fill();
    if (mood===2){ eye(c,-7,-58,2.6,2,'#ff7a6a'); eye(c,4,-58,2.6,2,'#ff7a6a'); } else { c.fillStyle=ang?'#ff4a3a':'#7ee0ff'; el(c,-7.5,-58,ang?2.3:1.7); c.fill(); el(c,3.5,-58,ang?2.3:1.7); c.fill(); }
    c.save(); c.translate(-11,-36); c.rotate(wa); bone(c,0,0,0,2,col); rr(c,-2.2,-7,4.4,11,2); fs(c,'#6e4224',2.2); rr(c,-7,-10,14,4.4,2); fs(c,'#8a8090',2.2);
    c.beginPath(); c.moveTo(-3.6,-10); c.lineTo(3.6,-10); c.quadraticCurveTo(8,-30,-2,-48); c.quadraticCurveTo(-1,-30,-3.6,-10); c.closePath(); fs(c,'#dfe6ee',2.5); el(c,0,0,4.6); fs(c,col,2.5); c.restore(); },
  bat:function(c,t,col,wa,ang,mood,a){
    c.translate(0,-52+Math.sin(t*3.4)*5+(a>=0? Math.sin(Math.min(1,a/0.6)*Math.PI)*22 : 0));
    var fl=Math.sin(t*15)*0.42, wc=shade(col,-0.3);
    [-1,1].forEach(function(sd){ c.save(); c.scale(sd,1); c.rotate(-fl-0.1); c.beginPath(); c.moveTo(8,-4); c.lineTo(27,-24); c.lineTo(46,-13); c.quadraticCurveTo(39,-4,42,9); c.quadraticCurveTo(33,2,28,11); c.quadraticCurveTo(22,3,15,11); c.lineTo(8,6); c.closePath(); fs(c,wc);
      c.lineWidth=1.8; c.beginPath(); c.moveTo(27,-24); c.lineTo(28,11); c.stroke(); c.restore(); });
    poly(c,[-14,-9,-12,-29,-2,-14]); fs(c,col); poly(c,[14,-9,12,-29,2,-14]); fs(c,col);
    el(c,0,0,16,17); fs(c,col); c.fillStyle=shade(col,0.28); el(c,-1,7,9,8); c.fill();
    el(c,-8,-4,4.6,5.2); fs(c,'#fff',2.2); el(c,3,-4,4.6,5.2); fs(c,'#fff',2.2);
    if (mood===2){ eye(c,-8,-4,3,2); eye(c,3,-4,3,2); } else { c.fillStyle='#e0303a'; el(c,-9.2,-4,2.2); c.fill(); el(c,1.8,-4,2.2); c.fill(); }
    brow(c,-9,-11,ang?-1:-0.5); brow(c,4,-11,ang?1:0.5);
    el(c,-3,7,5.4,3.6); fs(c,'#3a1a2a',2); poly(c,[-6.5,5,-5,10,-3.5,5]); fs(c,'#fff',1.2); poly(c,[-2.5,5,-1,10,0.5,5]); fs(c,'#fff',1.2); },
  orc:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3)*1.2); var dk=shade(col,-0.16);
    rr(c,-15,-14,12,14,4); fs(c,'#4a3324'); rr(c,3,-14,12,14,4); fs(c,'#4a3324');
    el(c,20,-34,6.5); fs(c,col,2.5);
    rr(c,-22,-53,44,43,14); fs(c,col); c.fillStyle=shade(col,0.16); el(c,-6,-36,9,10); c.fill();
    poly(c,[-22,-46,-14,-51,22,-20,22,-12]); fs(c,'#6e4224',2.5);
    rr(c,-21.5,-23,43,7,2); fs(c,'#5a3a22',2.5); rr(c,-5,-24.5,9,10,2.5); fs(c,'#d9d2bf',2.2);
    el(c,19,-50,9,7); fs(c,'#8a8090');
    rr(c,-8,-86,7,13,3); fs(c,'#3a2a1a',2.5);
    el(c,-3,-64,16,15); fs(c,col); rr(c,-16,-61,25,13,6); fs(c,dk);
    poly(c,[-13.5,-54,-11.5,-65,-8,-54]); fs(c,'#fff8e8',2); poly(c,[0,-54,2.5,-65,5.5,-54]); fs(c,'#fff8e8',2);
    if (mood===2){ eye(c,-10,-68,2.8,2); eye(c,1,-68,2.8,2); } else { c.fillStyle=ang?'#ff4a3a':'#fff27a'; el(c,-10,-68,3,3.2); c.fill(); el(c,1,-68,3,3.2); c.fill(); c.fillStyle=OL; el(c,-10.6,-68,1.4); c.fill(); el(c,0.4,-68,1.4); c.fill(); }
    brow(c,-10,-73,-1); brow(c,1.5,-73,1);
    el(c,-19,-49,10,8); fs(c,'#8a8090'); poly(c,[-23,-55,-20,-66,-15,-56]); fs(c,'#dfe6ee',2.2);
    c.save(); c.translate(-23,-35); c.rotate(wa); rr(c,-3,-42,6,50,3); fs(c,'#6e4224',2.5);
    c.beginPath(); c.moveTo(-3,-40); c.quadraticCurveTo(-24,-48,-22,-22); c.quadraticCurveTo(-11,-28,-3,-25); c.closePath(); fs(c,'#cfd8e6',2.5);
    c.beginPath(); c.moveTo(3,-38); c.quadraticCurveTo(14,-40,13,-26); c.quadraticCurveTo(8,-29,3,-27); c.closePath(); fs(c,'#aab6c9',2.5); el(c,0,0,6.6); fs(c,col,2.5); c.restore(); },
  ogre:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*2.6)*1.4); var dk=shade(col,-0.16);
    poly(c,[-4,-66,31,-24,24,-3,6,-10]); fs(c,'#8a1f2a');
    rr(c,-16,-12,12,12,4); fs(c,dk); rr(c,4,-12,12,12,4); fs(c,dk);
    el(c,24,-38,7.5); fs(c,col,2.5);
    el(c,0,-35,27,27); fs(c,col); c.fillStyle=shade(col,0.2); el(c,-4,-30,15,15); c.fill();
    poly(c,[-19,-17,19,-17,13,-2,0,-9,-13,-2]); fs(c,'#7a4a2a',2.5); rr(c,-20,-20,40,6,2); fs(c,'#4a2f1a',2.5); el(c,0,-17,5); fs(c,'#ffcf3a',2.2);
    el(c,15,-73,4,6); fs(c,col,2.5);
    el(c,-2,-71,17,15.5); fs(c,col); rr(c,-16,-67,27,14,6.5); fs(c,dk);
    poly(c,[-14,-60,-11.5,-73,-7.5,-60]); fs(c,'#fff8e8',2); poly(c,[1,-60,4,-73,7.5,-60]); fs(c,'#fff8e8',2);
    if (mood===2){ eye(c,-9,-76,2.8,2); eye(c,2,-76,2.8,2); } else { c.fillStyle=ang?'#ff4a3a':'#fff27a'; el(c,-9,-76,3.2,3.4); c.fill(); el(c,2,-76,3.2,3.4); c.fill(); c.fillStyle=OL; el(c,-9.7,-76,1.5); c.fill(); el(c,1.3,-76,1.5); c.fill(); }
    brow(c,-9,-81.5,-1); brow(c,2.5,-81.5,1);
    poly(c,[-15,-83,-16,-97,-9,-89,-2,-99,5,-89,12,-97,11,-83]); fs(c,'#ffcf3a',2.5); c.fillStyle='#ff5a5a'; el(c,-2,-88,2.2); c.fill();
    c.save(); c.translate(-27,-41); c.rotate(wa); rr(c,-3.5,-22,7,30,3); fs(c,'#6e4224',2.5); el(c,0,-42,11,23); fs(c,'#9a6638');
    [[-10,-52],[10,-52],[-11,-38],[11,-38],[0,-65]].forEach(function(p){ var d=p[0]<0?-1:(p[0]>0?1:0); poly(c, d? [p[0],p[1]-3.5,p[0]+d*8,p[1],p[0],p[1]+3.5] : [-3.5,p[1],0,p[1]-8,3.5,p[1]]); fs(c,'#eef3fa',2); });
    el(c,0,0,8); fs(c,col,2.5); c.restore(); }
};
mArt.dragon=function(c,t,col,wa,ang,mood,a){
  c.translate(0,Math.sin(t*2.4)*1.5); var dk=shade(col,-0.24), fire=a>=0.2&&a<0.7, fl=Math.sin(t*4)*0.14+(a>=0?0.45:0);
  c.beginPath(); c.moveTo(16,-16); c.quadraticCurveTo(50,-8,48,-36); c.quadraticCurveTo(44,-22,34,-25); c.quadraticCurveTo(30,-6,12,-3); c.closePath(); fs(c,col); poly(c,[48,-36,56,-47,40,-44]); fs(c,dk,2.5);
  [[14,-60,1,dk],[2,-62,0.86,shade(col,-0.1)]].forEach(function(w){ c.save(); c.translate(w[0],w[1]); c.rotate(-fl*w[2]-0.1); c.scale(w[2],w[2]); c.beginPath(); c.moveTo(0,0); c.lineTo(30,-42); c.lineTo(48,-22); c.quadraticCurveTo(38,-18,42,-5); c.quadraticCurveTo(30,-9,28,5); c.quadraticCurveTo(18,-4,7,8); c.closePath(); fs(c,w[3]); c.lineWidth=1.8; c.beginPath(); c.moveTo(30,-42); c.lineTo(28,5); c.stroke(); c.restore(); });
  rr(c,-19,-15,14,15,5); fs(c,dk); rr(c,4,-15,14,15,5); fs(c,dk); c.fillStyle='#fff8e8'; [-18,-13,5,10].forEach(function(x){ poly(c,[x,-1,x+2.5,-6,x+5,-1]); c.fill(); });
  el(c,0,-38,26,28); fs(c,col); c.fillStyle='#f6e6b0'; el(c,-7,-31,15,20); c.fill(); c.strokeStyle='rgba(120,90,40,0.5)'; c.lineWidth=1.6; [-42,-34,-26,-18].forEach(function(y){ c.beginPath(); c.moveTo(-19,y); c.lineTo(4,y); c.stroke(); });
  [[16,-60],[22,-48],[25,-35]].forEach(function(p){ poly(c,[p[0]-4,p[1]+4,p[0]+7,p[1]-5,p[0]+3,p[1]+8]); fs(c,dk,2.2); });
  el(c,-24,-40,6.5,5.5); fs(c,col,2.5); c.fillStyle='#fff8e8'; poly(c,[-30,-41,-35,-37,-29,-37]); c.fill();
  poly(c,[-9,-86,-1,-106,1,-84]); fs(c,'#fff8e8',2.5); poly(c,[-22,-88,-19,-104,-13,-87]); fs(c,'#fff8e8',2.5);
  if (fire){ c.save(); c.translate(-30,-66); c.rotate(-0.28); rr(c,-14,0,22,8,4); fs(c,dk); c.restore(); el(c,-38,-64,7,5); fs(c,'#ff9a3c',2); }
  el(c,-15,-75,18,15); fs(c,col); rr(c,-44,-78,30,15,7.5); fs(c,col); c.fillStyle=col; c.fillRect(-28,-76,12,11);
  c.fillStyle=OL; el(c,-39,-73,1.6); c.fill(); c.fillStyle='#fff8e8'; [-40,-34,-28].forEach(function(x){ poly(c,[x,-63.5,x+2.5,-58,x+5,-63.5]); c.fill(); c.lineWidth=1.3; c.strokeStyle=OL; c.stroke(); });
  if (mood===2) eye(c,-17,-79,3.4,2); else { el(c,-17,-79,4.6,5); fs(c,ang?'#ff5a3a':'#ffe14a',2.2); c.fillStyle=OL; el(c,-18,-79,1.3,3.6); c.fill(); }
  brow(c,-17,-86,1);
};
function gearIcon(c, sl, x, y, s, col){
  c.save(); c.translate(x,y); c.scale(s,s); c.lineJoin='round'; var w=2.8/s, dk=shade(col,-0.22);
  if (sl==='hat'){ c.beginPath(); c.arc(0,0.15,0.74,Math.PI,0); c.closePath(); fs(c,col,w); rr(c,-0.92,0.1,1.84,0.32,0.14); fs(c,dk,w); poly(c,[-0.05,-0.58,-0.5,-0.98,0.12,-0.8]); fs(c,'#ff5a5a',w); }
  else if (sl==='top'){ poly(c,[-0.82,-0.72,-0.34,-0.86,0,-0.6,0.34,-0.86,0.82,-0.72,0.96,-0.18,0.6,-0.04,0.6,0.86,-0.6,0.86,-0.6,-0.04,-0.96,-0.18]); fs(c,col,w); c.fillStyle=dk; c.fillRect(-0.58,0.3,1.16,0.16); }
  else if (sl==='glv'){ el(c,0.48,-0.08,0.24,0.4,0.5); fs(c,col,w); rr(c,-0.52,-0.92,0.84,1.3,0.36); fs(c,col,w); rr(c,-0.62,0.32,1.04,0.52,0.12); fs(c,dk,w); }
  else if (sl==='pnt'){ poly(c,[-0.72,-0.86,0.72,-0.86,0.82,0.9,0.14,0.9,0,-0.1,-0.14,0.9,-0.82,0.9]); fs(c,col,w); c.fillStyle=dk; c.fillRect(-0.7,-0.84,1.4,0.2); }
  else if (sl==='sho'){ poly(c,[-0.52,-0.9,0.1,-0.9,0.1,0.08,0.86,0.36,0.86,0.86,-0.52,0.86]); fs(c,col,w); c.fillStyle=dk; c.fillRect(-0.5,0.62,1.34,0.22); }
  else if (sl==='rng'){ c.lineWidth=0.3+w; c.strokeStyle=OL; el(c,0,0.24,0.56); c.stroke(); c.lineWidth=0.3; c.strokeStyle='#ffcf3a'; c.stroke(); poly(c,[-0.3,-0.42,0,-0.86,0.3,-0.42,0,-0.14]); fs(c,col,w); }
  else { c.lineWidth=0.14+w; c.strokeStyle=OL; c.beginPath(); c.arc(0,-0.62,0.72,0.35,Math.PI-0.35); c.stroke(); c.lineWidth=0.14; c.strokeStyle='#ffcf3a'; c.stroke(); poly(c,[0,-0.12,0.42,0.3,0,0.92,-0.42,0.3]); fs(c,col,w); c.fillStyle='rgba(255,255,255,0.6)'; poly(c,[0,0.04,0.2,0.3,0,0.4]); c.fill(); }
  c.restore();
}
var spr=document.createElement('canvas'), sc=spr.getContext('2d');
function sprite(art, x, y, k, big, o){
  var K=k*1.25*DPR, W=Math.ceil(300*K), H=Math.ceil(270*K); if (spr.width!==W || spr.height!==H){ spr.width=W; spr.height=H; }
  sc.setTransform(1,0,0,1,0,0); sc.globalCompositeOperation='source-over'; sc.globalAlpha=1; sc.clearRect(0,0,W,H);
  sc.setTransform(k*big*DPR,0,0,k*big*DPR,150*K,225*K); sc.lineJoin='round'; sc.lineCap='round'; sc.save(); art(sc); sc.restore();
  if (o.ta>0){ sc.setTransform(1,0,0,1,0,0); sc.globalCompositeOperation='source-atop'; sc.globalAlpha=Math.min(1,o.ta); sc.fillStyle=o.tint; sc.fillRect(0,0,W,H); sc.globalCompositeOperation='source-over'; sc.globalAlpha=1; }
  var c=cx; c.save(); c.translate(x,y); if (o.rot) c.rotate(o.rot); c.scale(o.sx||1,o.sy||1); c.globalAlpha=o.alpha==null?1:o.alpha; c.drawImage(spr,-150*K/DPR,-225*K/DPR,300*K/DPR,270*K/DPR); c.restore();
}
function buildStage(g){
  var k=g.k, W=g.w, H=STG.h, th=THEMES[VS.scn], s=stageCache=document.createElement('canvas'); s.width=Math.round(W*DPR); s.height=Math.round(H*DPR);
  var c=s.getContext('2d'), fy=H-46*k, mx=W/2, aw=Math.min(60*k, W*0.17), ah=112*k, i, y, r=DJ_rnd(L.level*31+L.stage*977+7);
  c.setTransform(DPR,0,0,DPR,0,0); rr(c,0,0,W,H,18); c.clip();
  var gr=c.createLinearGradient(0,0,0,fy); gr.addColorStop(0,th.w1); gr.addColorStop(0.45,th.w0); gr.addColorStop(1,th.w1); c.fillStyle=gr; c.fillRect(0,0,W,H);
  var bhh=20*k, bww=46*k, row=0;
  for (y=fy-bhh*8; y<fy; y+=bhh, row++) for (var x=(row%2? -bww/2 : 0); x<W; x+=bww){ var q=r(); c.fillStyle= q<0.14? 'rgba(255,255,255,0.06)' : (q<0.26? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0)'); rr(c,x+1.5,y+1.5,bww-3,bhh-3,3); c.fill(); c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1.5; c.stroke(); }
  var scn= L.role!=='min' ? 0 : (L.kind==='n' ? L.stage%3 : (L.stage%2? 1 : 2));
  if (L.role==='big'){ aw*=1.25; ah*=1.04; }
  if (scn===0){
  // archway into the dark
  var arch=function(w,h){ c.beginPath(); c.moveTo(mx-w,fy); c.lineTo(mx-w,fy-h+w); c.arc(mx,fy-h+w,w,Math.PI,0); c.lineTo(mx+w,fy); c.closePath(); };
  arch(aw+9*k,ah+9*k); c.fillStyle=th.fl; c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke();
  c.save(); arch(aw+9*k,ah+9*k); c.clip(); c.strokeStyle='rgba(0,0,0,0.25)'; c.lineWidth=1.5; for (i=0;i<9;i++){ var an=Math.PI+i*Math.PI/8; c.beginPath(); c.moveTo(mx+Math.cos(an)*aw, fy-ah+aw+Math.sin(an)*aw); c.lineTo(mx+Math.cos(an)*(aw+10*k), fy-ah+aw+Math.sin(an)*(aw+10*k)); c.stroke(); } c.restore();
  arch(aw,ah); gr=c.createLinearGradient(0,fy-ah,0,fy); gr.addColorStop(0,'#0c0612'); gr.addColorStop(1,L.role==='big'?'#7a2a10':(L.king?'#5a1420':th.w1)); c.fillStyle=gr; c.fill(); c.strokeStyle=OL; c.stroke();
  c.save(); arch(aw,ah); c.clip(); var rg=c.createRadialGradient(mx,fy,2,mx,fy,aw*1.6); rg.addColorStop(0,'rgba('+(L.role==='big'?'255,140,40':(L.king?'255,60,60':th.gl))+',0.34)'); rg.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=rg; c.fillRect(mx-aw,fy-ah,aw*2,ah);
  c.fillStyle='rgba(0,0,0,0.35)'; for (i=1;i<4;i++) c.fillRect(mx-aw+i*aw/2-1.5*k,fy-ah,3*k,ah); c.restore();
    if (L.role==='big'){ c.fillStyle='#fff8e8'; c.strokeStyle=OL; c.lineWidth=2; for (i=-2;i<=2;i++){ var tx=mx+i*aw*0.36, ty=fy-ah+aw-Math.sqrt(Math.max(0,aw*aw-(i*aw*0.36)*(i*aw*0.36)))+1; poly(c,[tx-6*k,ty,tx+6*k,ty,tx,ty+16*k]); c.fill(); c.stroke(); }
      [[-1],[1]].forEach(function(d){ poly(c,[mx+d[0]*(aw+4*k),fy-ah+aw*0.5,mx+d[0]*(aw+30*k),fy-ah-6*k,mx+d[0]*(aw+12*k),fy-ah+aw*0.9]); c.fillStyle=th.fl; c.fill(); c.stroke(); }); }
  } else if (scn===1){   // a row of barred windows
    for (i=-1;i<=1;i++){ var wx=mx+i*62*k, wb=fy-34*k, ww=17*k, wh=64*k; c.beginPath(); c.moveTo(wx-ww,wb); c.lineTo(wx-ww,wb-wh+ww); c.arc(wx,wb-wh+ww,ww,Math.PI,0); c.lineTo(wx+ww,wb); c.closePath(); c.fillStyle=th.fl; c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke();
      c.beginPath(); c.moveTo(wx-ww+5*k,wb-4*k); c.lineTo(wx-ww+5*k,wb-wh+ww); c.arc(wx,wb-wh+ww,ww-5*k,Math.PI,0); c.lineTo(wx+ww-5*k,wb-4*k); c.closePath(); gr=c.createLinearGradient(0,wb-wh,0,wb); gr.addColorStop(0,'#1a2a5a'); gr.addColorStop(1,'#3a4a8a'); c.fillStyle=gr; c.fill(); c.stroke();
      c.fillStyle='#fff6c9'; if (i===0){ el(c,wx+3*k,wb-wh+ww+2*k,5*k); c.fill(); } c.fillStyle=OL; [-0.4,0.4].forEach(function(d){ c.fillRect(wx+d*ww-1.2*k,wb-wh+4*k,2.4*k,wh-8*k); });
      c.fillStyle='rgba(200,220,255,0.07)'; poly(c,[wx-ww,wb,wx+ww,wb,wx+ww-30*k,fy+40*k,wx-ww-50*k,fy+40*k]); c.fill(); }
  } else {              // a heavy wooden door between two pillars
    var dw=34*k, dh=92*k; c.beginPath(); c.moveTo(mx-dw-7*k,fy); c.lineTo(mx-dw-7*k,fy-dh+dw); c.arc(mx,fy-dh+dw,dw+7*k,Math.PI,0); c.lineTo(mx+dw+7*k,fy); c.closePath(); c.fillStyle=th.fl; c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke();
    c.beginPath(); c.moveTo(mx-dw,fy); c.lineTo(mx-dw,fy-dh+dw); c.arc(mx,fy-dh+dw,dw,Math.PI,0); c.lineTo(mx+dw,fy); c.closePath(); c.fillStyle='#7a4a2a'; c.fill(); c.stroke();
    c.save(); c.clip(); c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=2; for (i=-2;i<=2;i++){ c.beginPath(); c.moveTo(mx+i*dw/2.5,fy); c.lineTo(mx+i*dw/2.5,fy-dh-10); c.stroke(); } c.fillStyle='#4a4a58'; c.fillRect(mx-dw,fy-dh*0.72,dw*2,6*k); c.fillRect(mx-dw,fy-dh*0.28,dw*2,6*k); c.restore();
    el(c,mx+dw*0.55,fy-dh*0.48,4*k); c.fillStyle='#ffcf3a'; c.fill(); c.lineWidth=2; c.stroke();
    [mx-dw-44*k, mx+dw+44*k].forEach(function(px){ c.fillStyle=th.fl; c.strokeStyle=OL; c.lineWidth=2.5; rr(c,px-11*k,fy-118*k,22*k,118*k,3); c.fill(); c.stroke(); rr(c,px-15*k,fy-124*k,30*k,10*k,3); c.fill(); c.stroke(); rr(c,px-15*k,fy-10*k,30*k,10*k,3); c.fill(); c.stroke(); c.fillStyle='rgba(0,0,0,0.18)'; c.fillRect(px+3*k,fy-114*k,6*k,104*k); });
  }
  // hanging banners
  [mx-aw-58*k, mx+aw+58*k].forEach(function(bx){ if (bx<30*k || bx>W-30*k || scn!==0) return; var by=34*k; c.fillStyle=L.king?'#a82a34':'rgba(0,0,0,0.28)'; poly(c,[bx-11*k,by,bx+11*k,by,bx+11*k,by+38*k,bx,by+30*k,bx-11*k,by+38*k]); c.fill(); if (L.king){ c.strokeStyle=OL; c.lineWidth=2; c.stroke(); icon(c,'psn',bx,by+15*k,7*k,'#ffd84a'); } });
  // torches (the flames are animated on top)
  torches=[20*k, W-20*k].map(function(tx){ var ty=fy-54*k; c.fillStyle='#5a3d24'; poly(c,[tx-5*k,ty,tx+5*k,ty,tx+2.5*k,ty+16*k,tx-2.5*k,ty+16*k]); c.fill(); c.strokeStyle=OL; c.lineWidth=2; c.stroke(); rr(c,tx-7*k,ty-3*k,14*k,5*k,2); c.fillStyle='#8a8090'; c.fill(); c.stroke(); return {x:tx,y:ty-4*k}; });
  // floor
  gr=c.createLinearGradient(0,fy-14*k,0,fy); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,0.4)'); c.fillStyle=gr; c.fillRect(0,fy-14*k,W,14*k);
  gr=c.createLinearGradient(0,fy,0,H); gr.addColorStop(0,th.fl); gr.addColorStop(1,th.fd); c.fillStyle=gr; c.fillRect(0,fy,W,H-fy);
  c.strokeStyle='rgba(0,0,0,0.22)'; c.lineWidth=1.5; for (i=-8;i<=8;i++){ c.beginPath(); c.moveTo(mx+i*W/11,fy); c.lineTo(mx+i*W/11*1.55,H); c.stroke(); }
  c.beginPath(); c.moveTo(0,fy+(H-fy)*0.42); c.lineTo(W,fy+(H-fy)*0.42); c.stroke();
  c.fillStyle='rgba(255,255,255,0.22)'; c.fillRect(0,fy,W,2); c.fillStyle=OL; c.fillRect(0,fy-1.5,W,1.5);
  var vg=c.createRadialGradient(mx,H*0.55,H*0.3,mx,H*0.55,Math.max(W*0.62,H)); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(8,4,12,0.62)'); c.fillStyle=vg; c.fillRect(0,0,W,H);
  gr=c.createLinearGradient(0,0,0,54*k); gr.addColorStop(0,'rgba(8,4,12,0.7)'); gr.addColorStop(1,'rgba(8,4,12,0)'); c.fillStyle=gr; c.fillRect(0,0,W,54*k);
}
function DJ_rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hpBar(c,x,y,w,h,frac,lag,cA,cB,right){
  var cl=function(v){ return Math.max(0,Math.min(1,v)); }, lw=w*cl(lag), fw=w*cl(frac);
  rr(c,x-2.5,y-2.5,w+5,h+5,(h+5)/2); c.fillStyle=OL; c.fill(); rr(c,x,y,w,h,h/2); c.fillStyle='#3a2c44'; c.fill();
  c.save(); rr(c,x,y,w,h,h/2); c.clip();
  c.fillStyle='#fff2c4'; c.fillRect(right? x+w-lw : x, y, lw, h);
  var gr=c.createLinearGradient(0,y,0,y+h); gr.addColorStop(0,cA); gr.addColorStop(1,cB); c.fillStyle=gr; c.fillRect(right? x+w-fw : x, y, fw, h);
  c.fillStyle='rgba(255,255,255,0.3)'; c.fillRect(x,y+1.5,w,h*0.32); c.restore();
}
function txt(c,s,x,y,px,col,al,lw){ c.font='900 '+Math.round(px)+'px '+FNT; c.textAlign=al||'center'; c.textBaseline='middle'; c.lineJoin='round'; c.lineWidth=lw||Math.max(3,px*0.28); c.strokeStyle=OL; c.strokeText(s,x,y); c.fillStyle=col; c.fillText(s,x,y); }
function drawStage(dt, t){
  var c=cx, g=stg(), k=g.k, i, kd=VS.kind, md=MD[kd], th=THEMES[VS.scn];
  ['hAtk','hHurt','hDrink','mAtk','mHurt','mIn','hGlow','shPop','shBreak','dizzy','cdPop','fadeIn'].forEach(function(n){ if (VS[n]>0) VS[n]=Math.max(0,VS[n]-dt); }); if (VS.mDead>0) VS.mDead+=dt;
  if (lost && VS.hHp<=0 && VS.hHurt<=0.15) VS.hDead+=dt; else if (!lost) VS.hDead=0;
  VS.hBar+=(VS.hHp/F.heroMax-VS.hBar)*Math.min(1,dt*12); VS.mBar+=(VS.mHp/F.mMax-VS.mBar)*Math.min(1,dt*12);
  VS.hLag= VS.hLag>VS.hBar? Math.max(VS.hBar, VS.hLag-dt*0.45) : VS.hBar; VS.mLag= VS.mLag>VS.mBar? Math.max(VS.mBar, VS.mLag-dt*0.45) : VS.mBar;
  var key=[g.w,STG.h,L.level,L.stage,DPR].join(); if (!stageCache || stageKey!==key){ stageKey=key; buildStage(g); }
  var sx=0, sy=0; if (shk>0){ shk=Math.max(0,shk-dt*3.4); sx=(Math.random()-0.5)*shk*13*k; sy=(Math.random()-0.5)*shk*9*k; }
  c.save(); c.translate(sx,sy); c.drawImage(stageCache, g.x, STG.top, g.w, STG.h);
  c.save(); rr(c,g.x,STG.top,g.w,STG.h,18); c.clip();
  torches.forEach(function(tc,ti){ var fx0=g.x+tc.x, fy0=STG.top+tc.y, fl=0.85+Math.sin(t*11+ti*2)*0.1+Math.sin(t*23+ti)*0.06, rg=c.createRadialGradient(fx0,fy0,2,fx0,fy0,78*k);
    rg.addColorStop(0,'rgba('+th.gl+','+(0.4*fl)+')'); rg.addColorStop(1,'rgba('+th.gl+',0)'); c.fillStyle=rg; c.fillRect(fx0-80*k,fy0-80*k,160*k,160*k);
    var fh=17*k*fl, fw=6.5*k; c.fillStyle='rgb('+th.gl+')'; c.beginPath(); c.moveTo(fx0-fw,fy0); c.quadraticCurveTo(fx0-fw*1.2,fy0-fh*0.5,fx0+Math.sin(t*9+ti)*2*k,fy0-fh); c.quadraticCurveTo(fx0+fw*1.2,fy0-fh*0.5,fx0+fw,fy0); c.closePath(); c.fill();
    c.fillStyle='#fff6c9'; c.beginPath(); c.moveTo(fx0-fw*0.5,fy0); c.quadraticCurveTo(fx0-fw*0.6,fy0-fh*0.3,fx0,fy0-fh*0.55); c.quadraticCurveTo(fx0+fw*0.6,fy0-fh*0.3,fx0+fw*0.5,fy0); c.closePath(); c.fill(); });
  // ----- monster -----
  var big=md.s*(L.elite?1.18:1), alive=!(VS.mDead>0), ma=VS.mAtk>0? 1-VS.mAtk/MA : -1, ha=VS.hAtk>0? 1-VS.hAtk/HA : -1, D=(g.mx-g.hx)-(54+md.w*0.5*big)*k;
  var hot=alive && !won && VS.cd<=1, mcy=mCY(g);
  if (L.elite && alive && !hot){ var eg=c.createRadialGradient(g.mx,mcy,4,g.mx,mcy,(58+Math.sin(t*4)*5)*k*big); eg.addColorStop(0,'rgba(190,90,255,0.5)'); eg.addColorStop(1,'rgba(190,90,255,0)'); c.fillStyle=eg; c.fillRect(g.mx-80*k*big,mcy-80*k*big,160*k*big,160*k*big); }
  if (hot){ var ag=c.createRadialGradient(g.mx,mcy,4,g.mx,mcy,(60+Math.sin(t*9)*6)*k*big); ag.addColorStop(0,'rgba(255,50,50,0.5)'); ag.addColorStop(1,'rgba(255,50,50,0)'); c.fillStyle=ag; c.fillRect(g.mx-80*k*big,mcy-80*k*big,160*k*big,160*k*big); }
  var dp=VS.mDead>0? Math.min(1,VS.mDead/0.45) : 0, inn=VS.mIn/0.7, mxx=g.mx-dashP(ma)*D*(kd==='dragon'?0.22:1)+(VS.mHurt>0? Math.sin(Math.min(1,VS.mHurt/0.34)*Math.PI)*12*k : 0)+inn*inn*190*k, myy=g.gy-Math.abs(Math.sin(inn*Math.PI*2))*22*k;
  if (VS.mIn<=0 && !VS.landed){ VS.landed=1; if (moved===0){ shk=Math.max(shk,L.king?0.9:0.3); if (L.king) Snd.boss(); for (i=0;i<10;i++) parts.push({x:g.mx+(Math.random()-0.5)*60*k,y:g.gy,vx:(Math.random()-0.5)*160,vy:-20-Math.random()*50,t:0.5,c:'rgba(230,220,240,0.7)',r:3+Math.random()*4,g:60}); } }
  if (dp<1){
    c.fillStyle='rgba(0,0,0,'+(0.34*(1-dp))+')'; el(c,mxx,g.gy+3*k,(kd==='bat'?20:md.w*0.48)*big*k,6*k*big); c.fill();
    var wa=ma>=0? -0.35+swingA(ma)*0.7 : -0.35+Math.sin(t*3)*0.05, mood=VS.mHurt>0||dp>0? 2 : ((t%4.1)<0.12&&kd==='slime'? 1 : 0);
    var hop=(kd==='slime'&&ma>=0)? -Math.sin(Math.min(1,ma/0.6)*Math.PI)*26*k : 0;
    sprite(function(s){ mArt[kd](s,t,MCOL[kd][VS.tier],wa,hot||ma>=0||L.elite,mood,ma); }, mxx, myy+hop, k, big,
      {sx:(1+0.35*Math.sin(dp*Math.PI))*(1-dp*dp), sy:(1-0.3*Math.sin(dp*Math.PI))*(1-dp*dp), tint: dp>0||VS.mHurt>0.2? '#fff' : '#9a4ae0', ta: dp>0? 0.9 : (VS.mHurt>0.2? 0.85 : (VS.poison>0? 0.22+Math.sin(t*5)*0.06 : 0)), alpha:1-dp*dp});
    if (L.elite && alive && !(VS.mIn>0)){ var ey=myy-(kd==='bat'? md.h+26 : md.h+14)*big*k+Math.sin(t*3)*2*k; icon(c,'psn',mxx,ey,(L.final?10:8)*k,'#d9a8ff',3); if (L.final){ poly(c,[mxx-9*k,ey-9*k,mxx-9*k,ey-18*k,mxx-4*k,ey-13*k,mxx,ey-20*k,mxx+4*k,ey-13*k,mxx+9*k,ey-18*k,mxx+9*k,ey-9*k]); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke(); c.fillStyle='#ffcf3a'; c.fill(); } }
    if (VS.dizzy>0 && alive) for (i=0;i<3;i++){ var da=t*6+i*2.1; icon(c,'stun',mxx+Math.cos(da)*20*k*big, myy-(md.h+8)*big*k+Math.sin(da)*5*k, 6*k, '#ffe14a', 2); }
    if (VS.poison>0 && alive && Math.random()<dt*5) parts.push({x:mxx+(Math.random()-0.5)*md.w*0.7*k, y:mcy+10*k, vx:0, vy:-25-Math.random()*30, t:0.7, c:'rgba(182,132,245,0.85)', r:2+Math.random()*2.5, g:-30});
  } else if (!VS.poofed){ VS.poofed=1; shk=Math.max(shk,0.5);
    for (i=0;i<16;i++){ var pa=Math.random()*6.28, ps=40+Math.random()*120; parts.push({x:g.mx,y:mcy,vx:Math.cos(pa)*ps,vy:Math.sin(pa)*ps-30,t:0.6+Math.random()*0.3,c:'rgba(240,235,250,0.8)',r:5+Math.random()*7,g:-40}); }
    for (i=0;i<14;i++) parts.push({x:g.mx,y:mcy,vx:(Math.random()-0.5)*340,vy:-160-Math.random()*260,t:0.9,c:i%2?'#ffd84a':MCOL[kd][VS.tier],r:2.5+Math.random()*3,g:800}); }
  // ----- hero -----
  var hdp=Math.min(1,VS.hDead/0.4), wk=walk>0? Math.min(1,walk/0.9) : 0, cheer=won && VS.mDead>0.3 && !wk && !choosing && !VS.empty, hxx=g.hx+wk*wk*g.w*0.8+(VS.fadeIn>0? -VS.fadeIn/0.45*60*k : 0)+dashP(ha)*D-(VS.hHurt>0? Math.sin(Math.min(1,VS.hHurt/0.4)*Math.PI)*14*k : 0), hyy=g.gy-(cheer? Math.abs(Math.sin(t*6.5))*16*k : 0)-(wk||VS.fadeIn>0? Math.abs(Math.sin(t*16))*7*k : 0);
  if (wk && Math.random()<dt*30) parts.push({x:hxx-14*k,y:g.gy,vx:-40-Math.random()*40,vy:-20-Math.random()*30,t:0.4,c:'rgba(230,220,240,0.6)',r:2+Math.random()*3,g:60});
  c.fillStyle='rgba(0,0,0,0.34)'; el(c,hxx,g.gy+3*k,24*k,6*k); c.fill();
  if (VS.hGlow>0){ c.fillStyle='rgba(140,240,120,'+(VS.hGlow*0.7)+')'; el(c,hxx,g.gy-40*k,44*k,52*k); c.fill(); }
  sprite(function(s){ heroArt(s,t); }, hxx-hdp*8*k, hyy-hdp*6*k, k, 1, {rot:-easeOut(hdp)*1.5, tint: VS.hHurt>0.25? '#fff' : '#ff3030', ta: VS.hHurt>0.25? 0.85 : (VS.hHurt>0? VS.hHurt*1.6 : 0)});
  if (hdp>=1) for (i=0;i<3;i++){ var sa=t*5+i*2.1; icon(c,'stun',g.hx-36*k+Math.cos(sa)*16*k, g.gy-34*k+Math.sin(sa)*5*k, 6*k, '#ffe14a', 2); }
  if (VS.shield>0 || VS.shBreak>0){ var sp=VS.shPop>0? Math.sin((1-VS.shPop/0.45)*Math.PI) : 0, sr=(46+sp*8+Math.sin(t*3)*1.5)*k, sa2=VS.shield>0? 1 : VS.shBreak/0.45;
    var sg=c.createRadialGradient(hxx,hyy-42*k,sr*0.5,hxx,hyy-42*k,sr); sg.addColorStop(0,'rgba(120,180,255,0)'); sg.addColorStop(1,'rgba(120,190,255,'+(0.42*sa2+sp*0.3)+')'); c.fillStyle=sg; el(c,hxx,hyy-42*k,sr,sr*1.12); c.fill();
    c.strokeStyle='rgba(200,230,255,'+(0.85*sa2)+')'; c.lineWidth=2.5*k; c.stroke(); c.strokeStyle='rgba(255,255,255,'+(0.8*sa2)+')'; c.lineWidth=3*k; c.beginPath(); c.ellipse(hxx,hyy-42*k,sr*0.78,sr*0.9,0,-2.2,-1.3); c.stroke(); }
  // ----- effects -----
  for (i=fx.length-1;i>=0;i--){ var f=fx[i]; f.t+=dt; var p=Math.min(1,f.t/f.d);
    if (f.ty==='slash'){ c.save(); c.translate(f.x,f.y); c.scale(f.flip?-1:1,1); c.rotate(-0.5+p*0.5); var R=f.r*(0.75+p*0.5), A=1.25; c.globalAlpha=1-p*p;
      [[1.12,f.c],[1,'#fff']].forEach(function(o){ var rr2=R*o[0]; c.beginPath(); c.moveTo(Math.cos(-A)*rr2,Math.sin(-A)*rr2); c.arc(0,0,rr2,-A,A); c.quadraticCurveTo(rr2*(0.55-p*0.3),0,Math.cos(-A)*rr2,Math.sin(-A)*rr2); c.fillStyle=o[1]; c.fill(); }); c.restore(); }
    else if (f.ty==='ring'){ c.globalAlpha=(1-p)*0.9; c.strokeStyle=f.c; c.lineWidth=5*k*(1-p)+1; el(c,f.x,f.y,f.r*(0.3+easeOut(p)*0.9)); c.stroke(); }
    else if (f.ty==='bolt'){ c.globalAlpha=1-p*p; [[9*k,'rgba(255,225,74,0.55)'],[3.5*k,'#fff']].forEach(function(o){ c.beginPath(); var by=STG.top, n=6; c.moveTo(f.x+18*k,by); for (var q=1;q<=n;q++) c.lineTo(f.x+(q===n?0:((q%2?-1:1)*(8+Math.sin(f.t*90+q*3)*8)*k+(1-q/n)*18*k)), by+(f.y-by)*q/n); c.lineWidth=o[0]; c.strokeStyle=o[1]; c.lineJoin='miter'; c.stroke(); });
      c.fillStyle='rgba(255,240,150,'+(0.5*(1-p))+')'; el(c,f.x,f.y,40*k*(0.6+p)); c.fill(); }
    else if (f.ty==='cloud'){ c.globalAlpha=(1-p)*0.75; for (var q2=0;q2<6;q2++){ var ca=q2*1.05+1; c.fillStyle=q2%2?'#9a5ae0':'#6fd16a'; el(c,f.x+Math.cos(ca)*f.r*0.55*easeOut(p), f.y+Math.sin(ca)*f.r*0.4*easeOut(p)-p*14*k, f.r*(0.3+p*0.3)); c.fill(); } }
    c.globalAlpha=1; if (p>=1) fx.splice(i,1); }
  if (VS.prop==='c'){ var cx0=g.mx, cy0=g.gy; rr(c,cx0-24*k,cy0-26*k,48*k,26*k,4*k); fs(c,'#8a5a2a',2.5*k); c.fillStyle='#ffcf3a'; c.fillRect(cx0-24*k,cy0-16*k,48*k,4*k); rr(c,cx0-4*k,cy0-19*k,8*k,10*k,2*k); fs(c,'#ffcf3a',2*k);
    c.save(); c.translate(cx0-24*k,cy0-26*k); c.rotate(-0.9); rr(c,0,-14*k,48*k,14*k,5*k); fs(c,'#a06a34',2.5*k); c.restore(); c.fillStyle='rgba(255,230,120,'+(0.35+Math.sin(t*5)*0.15)+')'; el(c,cx0,cy0-30*k,22*k,10*k); c.fill(); }
  else if (VS.prop==='r'){ var fx1=g.mx, fy1=g.gy, ff=0.85+Math.sin(t*11)*0.1+Math.sin(t*23)*0.06, rg2=c.createRadialGradient(fx1,fy1-20*k,2,fx1,fy1-20*k,90*k); rg2.addColorStop(0,'rgba(255,170,80,0.5)'); rg2.addColorStop(1,'rgba(255,170,80,0)'); c.fillStyle=rg2; c.fillRect(fx1-90*k,fy1-110*k,180*k,130*k);
    [-0.35,0.35].forEach(function(a2){ c.save(); c.translate(fx1,fy1-4*k); c.rotate(a2); rr(c,-22*k,-4*k,44*k,8*k,4*k); fs(c,'#7a4a2a',2.5*k); c.restore(); });
    [[30,13,'#ff8a3c'],[18,7,'#ffe14a']].forEach(function(q){ var fh2=q[0]*k*ff, fw2=q[1]*k; c.fillStyle=q[2]; c.beginPath(); c.moveTo(fx1-fw2,fy1-8*k); c.quadraticCurveTo(fx1-fw2*1.2,fy1-8*k-fh2*0.5,fx1+Math.sin(t*9)*3*k,fy1-8*k-fh2); c.quadraticCurveTo(fx1+fw2*1.2,fy1-8*k-fh2*0.5,fx1+fw2,fy1-8*k); c.closePath(); c.fill(); }); }
  doorHits=[];
  if (choosing && !wk && RT && RT.at>=0){ var here=nodeAt(RT.at); options().forEach(function(id){ var r=nodeAt(id), dx=r.x-here.x, dy=r.y-here.y, px= dx<0? g.x+27*k : (dx>0? g.x+g.w-27*k : VW/2), py= dy<0? STG.top+80*k : (dy>0? g.gy+7*k : g.gy-32*k), kn=known(id), dn=RT.done[id], pu=0.5+Math.sin(t*6)*0.5, dw=19*k, dh=48*k;
    c.save(); c.translate(px,py); c.beginPath(); if (dy>0) c.ellipse(0,0,32*k,11*k,0,0,6.3); else { c.moveTo(-dw,dh*0.5); c.lineTo(-dw,-dh*0.5+dw); c.arc(0,-dh*0.5+dw,dw,Math.PI,0); c.lineTo(dw,dh*0.5); c.closePath(); }
    c.fillStyle='#0c0612'; c.fill(); c.lineWidth=(3+pu*2.5)*k; c.strokeStyle='rgba(255,228,92,'+(0.6+pu*0.4)+')'; c.stroke();
    var by3= dy>0? 0 : -3*k, br= dy>0? 9*k : 12*k; el(c,0,by3,br); fs(c, r.t==='B'? (L.kind==='big'?'#d98a10':(L.kind==='boss'?'#c0303a':'#8a3ad0')) : (dn? '#8676a4' : (kn? NCOL[r.t] : '#2a2436')), 2.5*k);
    c.textAlign='center'; c.textBaseline='middle';
    if (r.t==='B'){ c.font=Math.round(br*1.25)+'px sans-serif'; c.fillText(L.kind==='big'?'🐉':(L.kind==='boss'?'👹':'💀'), 0, by3+1); }
    else if (dn){ c.font='900 '+Math.round(br*1.3)+'px '+FNT; c.fillStyle='#fff'; c.fillText('✓', 0, by3+1); }
    else if (!kn){ c.font='900 '+Math.round(br*1.4)+'px '+FNT; c.fillStyle='#a898b4'; c.fillText('?', 0, by3+1); }
    else if (r.t==='c'){ el(c,0,by3,br*0.5); fs(c,'#ffe98a',2*k); }
    else icon(c, r.t==='f'?'atk':(r.t==='e'?'psn':'heal'), 0, by3, br*0.62, '#fff', 2.5);
    var ax= dx*30*k, ay= dy<0? -34*k : 0, ao=(2+pu*4)*k; if (dx||dy<0){ c.translate(ax+dx*ao, ay+(dy<0?-ao:0)); c.rotate(dx>0? 0 : (dx<0? Math.PI : -Math.PI/2)); poly(c,[-6*k,-8*k,7*k,0,-6*k,8*k]); fs(c,'#ffe45c',2.5*k); }
    c.restore(); doorHits.push({id:id, x:px, y:py, r:46*k}); }); }
  var dark=Math.max(wk>0.45? (wk-0.45)/0.55 : 0, VS.fadeIn>0? VS.fadeIn/0.45 : 0); if (dark>0){ c.fillStyle='rgba(8,4,12,'+Math.min(1,dark)+')'; c.fillRect(g.x,STG.top,g.w,STG.h); }
  c.restore();
  rr(c,g.x+1.5,STG.top+1.5,g.w-3,STG.h-3,17); c.lineWidth=5; c.strokeStyle='#1a1020'; c.stroke(); c.lineWidth=2.5; c.strokeStyle=L.role==='big'?'#ffcf3a':(L.king?'#ff7a5a':'#c79a52'); c.stroke();
  c.restore();
  // ----- fight HUD: who, health, what is active -----
  var pad=9*k, mr=Math.max(13,15*k), bh2=Math.max(12,13*k), by=STG.top+pad+mr+2*k-bh2/2+5*k, ny=STG.top+pad+5*k, bx0=g.x+pad+mr*2-5, bx1=VW/2-9*k, bwid=bx1-bx0, nf=Math.max(10.5,11.5*k);
  hpBar(c,bx0,by,bwid,bh2,VS.hBar,VS.hLag,'#8df07a','#3fb04f',false); if (!VS.empty) hpBar(c,VW-bx1,by,bwid,bh2,VS.mBar,VS.mLag,'#ff7a6a','#d93a3a',true);
  txt(c,Math.max(0,Math.round(VS.hHp))+'/'+F.heroMax,bx0+bwid/2,by+bh2/2+0.5,Math.max(10,bh2*0.86),'#fff');
  if (!VS.empty) txt(c,Math.max(0,Math.round(VS.mHp))+'/'+F.mMax,VW-bx1+bwid/2,by+bh2/2+0.5,Math.max(10,bh2*0.86),'#fff');
  txt(c,tl('hero'),bx0+4,ny,nf,'#cfe4ff','left'); if (!VS.empty) txt(c,tl('m_'+kd)+'  Lv.'+L.level,VW-bx0-4,ny,nf,L.king?'#ffb09a':'#ffd9cf','right');
  el(c,g.x+pad+mr,STG.top+pad+mr,mr); fs(c,'#3d7bd9',2.5); c.lineWidth=1.5; c.strokeStyle='#fff'; el(c,g.x+pad+mr,STG.top+pad+mr,mr-3); c.stroke(); icon(c,'heal',g.x+pad+mr,STG.top+pad+mr+0.5,mr*0.52,'#fff',0);
  if (!VS.empty){ el(c,g.x+g.w-pad-mr,STG.top+pad+mr,mr); fs(c,L.role==='big'?'#e8a020':(L.king?'#c0303a':(L.elite?'#9a4ae0':'#7a3f9a')),2.5); c.strokeStyle='#fff'; c.lineWidth=1.5; el(c,g.x+g.w-pad-mr,STG.top+pad+mr,mr-3); c.stroke(); icon(c,'psn',g.x+g.w-pad-mr,STG.top+pad+mr,mr*0.52,'#fff',0); }
  var sy2=by+bh2+11*k;
  if ((L.king||L.elite) && alive){ var bt=L.role==='big'?'BIG BOSS':(L.king?'BOSS':(L.final?'MINI BOSS':'ELITE')), bf=Math.max(9.5,10.5*k); c.font='900 '+Math.round(bf)+'px '+FNT; var btw=c.measureText(bt).width+12; rr(c,VW-bx0-btw,sy2-bf*0.8,btw,bf*1.6,bf*0.8); c.fillStyle=L.role==='big'?'#e8a020':(L.king?'#d93a3a':'#9a4ae0'); c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke(); txt(c,bt,VW-bx0-btw/2,sy2+0.5,bf,'#fff','center',2.5); }
  var pw=DJ.power(F), pk=Math.max(0.9,k); if (VS.pw!==pw){ if (VS.pw!=null) VS.pwPop=0.25; VS.pw=pw; } if (VS.pwPop>0) VS.pwPop=Math.max(0,VS.pwPop-dt);
  if (!won && !lost){ var ps=1+(VS.pwPop>0? Math.sin(VS.pwPop/0.25*Math.PI)*0.25 : 0), pc= pw>=1.5? '#ffd84a' : (pw>1? '#ffe9c0' : '#b8a8c4'); icon(c,'atk',bx0+8*pk,sy2,7.5*pk*ps,pc,2.5); txt(c,'×'+pw.toFixed(1),bx0+17*pk,sy2+0.5,13*pk*ps,pc,'left'); }
  if (VS.shield>0){ icon(c,'shd',bx0+62*pk,sy2,7.5*k,'#6aa8ff',2.5); txt(c,'×'+VS.shield,bx0+62*pk+10*k,sy2+0.5,12*k,'#cfe4ff','left'); }
  if (VS.poison>0 && alive){ icon(c,'psn',VW-bx1+8*k,sy2,7*k,'#c79aff',2.5); txt(c,''+VS.poison,VW-bx1+18*k,sy2+0.5,12*k,'#e0c8ff','left'); }
  // the monster's next move: how many pours are left, and how hard it hits
  if (alive && !won && !lost){ var cd=Math.max(0,VS.cd), pop=VS.cdPop>0? 1+Math.sin((VS.cdPop/0.4)*Math.PI)*0.35 : 1, pu=(hot? 1+Math.sin(t*10)*0.07 : 1)*pop, ib=Math.max(0.82,k);
    var ix=Math.max(g.hx+44*k, g.mx-(md.w*0.5*big+(L.king||L.elite?62:48))*k)+(hot? Math.sin(t*38)*1.5 : 0), iy=Math.max(sy2+20*ib, g.gy-(kd==='bat'?52:md.h*0.8)*big*k), col=hot?'#f04848':(cd<=2?'#ff9a3c':'#7a4fa0');
    c.save(); c.translate(ix,iy); c.scale(pu*ib,pu*ib);
    poly(c,[36,-5,45,0,36,5]); c.fillStyle='rgba(30,18,38,0.92)'; c.fill();
    rr(c,-30,-13,68,26,13); c.fillStyle='rgba(30,18,38,0.92)'; c.fill(); c.lineWidth=2; c.strokeStyle=col; c.stroke();
    el(c,-17,0,15); fs(c,col,2.5); c.lineWidth=1.5; c.strokeStyle='rgba(255,255,255,0.85)'; el(c,-17,0,12); c.stroke();
    txt(c,''+cd,-17,1,19,'#fff'); icon(c,'atk',7,0,7.5,'#ffb0a0',0); txt(c,''+F.mDmg,24,1,14,'#ffb0a0','center',2.5);
    c.restore(); }
  for (i=orbs.length-1;i>=0;i--){ var o=orbs[i]; o.t+=dt; var e=Math.min(1,o.t/o.d), ee=ease(e), ox=o.x0+(o.x1-o.x0)*ee, oy=o.y0+(o.y1-o.y0)*ee-Math.sin(e*Math.PI)*60;
    c.fillStyle=COL[o.c]; el(c,ox,oy,9*k+3); c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke(); c.fillStyle=COL_HI[o.c]; el(c,ox-3,oy-3,4); c.fill();
    if (Math.random()<0.7) parts.push({x:ox,y:oy,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,t:0.3,c:COL_HI[o.c],r:2,g:0});
    if (e>=1) orbs.splice(i,1); }
  for (i=floats.length-1;i>=0;i--){ var fl=floats[i]; fl.t-=dt; if (fl.t<=0){ floats.splice(i,1); continue; } var fy2=fl.y-easeOut(1-fl.t)*24*k, fz=(fl.big?27:18)*Math.max(0.85,k)*(1+Math.max(0,(fl.t-0.88)/0.12)*0.35);
    c.globalAlpha=Math.min(1,fl.t*3); var tw=0; if (fl.ic){ c.font='900 '+Math.round(fz)+'px '+FNT; tw=c.measureText(fl.txt).width; icon(c,fl.ic,fl.x-tw/2-fz*0.1,fy2,fz*0.42,fl.col,3); }
    txt(c,fl.txt,fl.x+(fl.ic?fz*0.42:0),fy2,fz,fl.col); }
  c.globalAlpha=1;
  if (hurtFlash>0){ hurtFlash=Math.max(0,hurtFlash-dt*3); c.fillStyle='rgba(255,40,40,'+(hurtFlash*0.22)+')'; c.fillRect(0,0,VW,VH); }
}

function sparkle(x,y,c,n){ for (var i=0;i<n;i++){ var an=Math.random()*6.28, s=40+Math.random()*120; parts.push({x:x+(Math.random()-0.5)*bw, y:y+(Math.random()-0.5)*bh*0.6, vx:Math.cos(an)*s, vy:Math.sin(an)*s-80, t:0.7+Math.random()*0.4, c:COL_HI[c], r:2+Math.random()*3, g:140}); } }
function confetti(){ for (var i=0;i<110;i++){ parts.push({x:VW*Math.random(), y:-20-Math.random()*VH*0.3, vx:(Math.random()-0.5)*120, vy:120+Math.random()*220, t:2.2+Math.random()*1.2, c:COL[Math.floor(Math.random()*8)], r:3+Math.random()*4, g:60, rect:1, rot:Math.random()*6, vr:(Math.random()-0.5)*12}); } }
function tap(i){
  if (won || lost || choosing || !V[i]) return; var v=V[i];
  if (sel<0){ if (v.busy) return; if (B[i].length && !DJ.done(B[i])){ sel=i; Snd.pop(); } else { v.shake=0.3; } return; }
  if (sel===i){ sel=-1; Snd.take(); return; }
  var n=pourCount(sel,i), mg=false;
  if (!n && magic && B[sel].length && B[i].length<CAP){ n=Math.min(knownRun(sel), CAP-B[i].length); mg=n>0; }
  if (n>0){ if (V[sel].busy||v.busy) return; if (mg){ magic=false; energy=Math.max(0,energy-100); sparkle(v.x, v.y-bh*0.6, 5, 18); Snd.buy(); updSkills(); } startPour(sel,i,n); sel=-1; return; }
  if (!v.busy && B[i].length && !DJ.done(B[i])){ sel=i; Snd.pop(); } else { v.shake=0.3; Snd.nope(); }
}
function flush(){ anims.forEach(finishAnim); anims=[]; syncAll(); }
function undo(){
  if (won || lost || !hist.length) return;
  if (undoLeft<=0){ PF.rewarded(function(ok){ if (ok){ undoLeft=5; updHud(); } }); return; }
  flush(); var h=hist.pop(), c=DJ.top(B[h.j]);
  if (h.rev) KN[h.i][B[h.i].length-1]=!L.hidden;
  for (var k=0;k<h.n;k++){ B[h.j].pop(); KN[h.j].pop(); B[h.i].push(c); KN[h.i].push(true); }
  V[h.i].cork=0; V[h.j].cork=0; undoLeft--; sel=-1; hintMv=null; tutMv=null; plan=null; stuckShown=false; syncAll(); updHud(); Snd.take();
}
function restart(){ if (won || lost || choosing) return; loadLevel(SAVE.level, true, curStage, entryHp, curLane, curType); Snd.take(); V.forEach(function(v,i){ v.drop=0.4+i*0.03; }); }
function addBottle(){
  if (won || lost || extra>=2) return;
  PF.rewarded(function(ok){ if (!ok) return; flush(); plan=null; extra++; B.push([]); KN.push([]); V.push({x:0,y:0,lift:0,shake:0,busy:0,cork:0,pop:0,drop:0.6,ox:0,oy:0,ang:0,disp:[]}); layout(); stuckShown=false; updHud(); Snd.buy(); });
}
function showHint(){
  if (won || lost) return;
  PF.rewarded(function(ok){ if (!ok) return; flush(); var m=nextHint(); if (m){ hintMv=m; hintUntil=performance.now()+6000; sel=-1; } else toast(tl('stuck')); });
}

// ---------------- drawing ----------------
function bottlePath(c, inset){
  var w=bw/2-inset, r=Math.min(w, bw*0.42), yb=-inset, yt=-bh;
  c.beginPath(); c.moveTo(-w, yt); c.lineTo(-w, yb-r); c.quadraticCurveTo(-w, yb, -w+r, yb); c.lineTo(w-r, yb); c.quadraticCurveTo(w, yb, w, yb-r); c.lineTo(w, yt); c.closePath();
}
function drawBottle(v, i){
  var c=cx, lift=v.lift*bw*0.55, dropY=0, sh=0;
  if (v.drop>0){ var dt0=Math.max(0, Math.min(1, 1-(v.drop-0)/0.45)); dropY=-(1-backOut(dt0))*VH*0.5; if (v.drop>0.45) dropY=-VH; }
  if (v.shake>0) sh=Math.sin(v.shake*40)*v.shake*bw*0.35;
  var px=v.x+v.ox+sh, py=v.y+v.oy-lift+dropY, popS=1+(v.pop>0? Math.sin((1-v.pop)*Math.PI)*0.08 : 0);
  // floor shadow
  if (!v.ox && !v.oy && dropY>-10){ c.fillStyle='rgba(0,0,0,'+(0.28-v.lift*0.12)+')'; c.beginPath(); c.ellipse(v.x, v.y+3, bw*(0.62-v.lift*0.1), bw*0.13, 0, 0, 6.3); c.fill(); }
  c.save(); c.translate(px, py); c.rotate(v.ang); c.scale(popS, popS);
  // glass back
  bottlePath(c, 0); c.fillStyle='rgba(255,255,255,0.09)'; c.fill();
  // liquid
  c.save(); bottlePath(c, bw*0.07); c.clip();
  var tn=Math.tan(v.ang), X=bw, h=0, d=v.disp||[], k;
  for (k=0;k<d.length;k++){ var u=d[k]; if (u.a<=0.001) continue; var h2=h+u.a*uh, lo=-h, hi=-h2;
    c.fillStyle = u.k ? COL[u.c] : '#3b3348';
    c.beginPath(); c.moveTo(-X, (k===0? bh : lo+tn*X)); c.lineTo(X, (k===0? bh : lo-tn*X)); c.lineTo(X, hi-tn*X); c.lineTo(-X, hi+tn*X); c.closePath(); c.fill();
    if (u.k){ c.fillStyle=COL_LO[u.c]; c.beginPath(); c.moveTo(-X, lo+tn*X); c.lineTo(X, lo-tn*X); c.lineTo(X, lo-tn*X-2.2); c.lineTo(-X, lo+tn*X-2.2); c.closePath(); if (k>0) c.fill(); }
    if (u.k && u.a>0.95 && Math.abs(v.ang)<0.05 && bw>=17){ icon(c, DJ.ROLE[u.c], 0, -(h+u.a*uh/2), uh*0.3, 'rgba(255,255,255,0.94)', Math.max(1.5,uh*0.09)); }
    else if (!u.k && Math.abs(v.ang)<0.05){ c.fillStyle='rgba(255,255,255,0.55)'; c.font='900 '+Math.round(uh*0.62)+'px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?', 0, -(h+u.a*uh/2)); }
    h=h2; }
  if (h>0 && d.length){ var tu=d[d.length-1]; if (tu.a<=0.001 && d.length>1) tu=d[d.length-2]; c.fillStyle=tu.k? COL_HI[tu.c] : '#55506a';
    c.beginPath(); c.moveTo(-X, -h+tn*X); c.lineTo(X, -h-tn*X); c.lineTo(X, -h-tn*X+3); c.lineTo(-X, -h+tn*X+3); c.closePath(); c.fill(); }
  c.restore();
  // glass front: outline, highlight, rim
  bottlePath(c, 0); c.lineWidth=Math.max(2, bw*0.055); c.strokeStyle= (i===sel? '#fff6c2' : (magic && !v.busy && B[i].length<CAP? 'rgba(214,170,255,'+(0.75+Math.sin(performance.now()/140)*0.25)+')' : 'rgba(235,240,255,0.78)')); c.stroke();
  c.fillStyle='rgba(255,255,255,0.22)'; c.beginPath(); c.roundRect(-bw*0.33, -bh*0.9, bw*0.11, bh*0.66, bw*0.06); c.fill();
  c.fillStyle='rgba(255,255,255,0.12)'; c.beginPath(); c.roundRect(bw*0.22, -bh*0.5, bw*0.07, bh*0.3, bw*0.04); c.fill();
  c.fillStyle=(i===sel? '#fff6c2' : 'rgba(235,240,255,0.9)'); c.beginPath(); c.roundRect(-bw*0.58, -bh-bw*0.1, bw*1.16, bw*0.17, bw*0.08); c.fill();
  // cork
  if (v.cork>0){ var ck=backOut(v.cork), cy0=-bh-bw*0.1-(1-ck)*bw*1.2; c.globalAlpha=Math.min(1,v.cork*3);
    c.fillStyle='#b9824a'; c.beginPath(); c.roundRect(-bw*0.36, cy0-bw*0.34, bw*0.72, bw*0.5, bw*0.1); c.fill();
    c.fillStyle='#d9a56a'; c.beginPath(); c.roundRect(-bw*0.36, cy0-bw*0.34, bw*0.72, bw*0.14, bw*0.07); c.fill(); c.globalAlpha=1; }
  c.restore();
}
function drawBg(){
  if (!bgCache || bgCache.width!==cv.width || bgCache.height!==cv.height){
    bgCache=document.createElement('canvas'); bgCache.width=cv.width; bgCache.height=cv.height; var c=bgCache.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
    var g=c.createLinearGradient(0,0,0,VH); g.addColorStop(0,'#3a2742'); g.addColorStop(0.55,'#2a1c31'); g.addColorStop(1,'#1a1220'); c.fillStyle=g; c.fillRect(0,0,VW,VH);
    // stone blocks
    c.strokeStyle='rgba(0,0,0,0.16)'; c.lineWidth=2; var bhh=46, bww=110;
    for (var y=0, r=0; y<VH; y+=bhh, r++){ c.beginPath(); c.moveTo(0,y); c.lineTo(VW,y); c.stroke(); for (var x=(r%2?-bww/2:0); x<VW; x+=bww){ c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+bhh); c.stroke(); } }
    // lantern glows
    [[VW*0.1,VH*0.2],[VW*0.9,VH*0.2]].forEach(function(p){ var rg=c.createRadialGradient(p[0],p[1],4,p[0],p[1],Math.max(VW,VH)*0.42); rg.addColorStop(0,'rgba(255,170,80,0.34)'); rg.addColorStop(1,'rgba(255,170,80,0)'); c.fillStyle=rg; c.fillRect(0,0,VW,VH); });
    // shelves under each row
    var rows={}; V.forEach(function(v){ rows[v.row]=rows[v.row]||{y:v.y, x0:1e9, x1:-1e9}; rows[v.row].x0=Math.min(rows[v.row].x0,v.x); rows[v.row].x1=Math.max(rows[v.row].x1,v.x); });
    Object.keys(rows).forEach(function(k){ var o=rows[k], x0=Math.max(6,o.x0-bw*1.3), x1=Math.min(VW-6,o.x1+bw*1.3), y=o.y+1, th=Math.max(10,bw*0.3);
      c.fillStyle='rgba(0,0,0,0.3)'; c.fillRect(x0+4,y+th,x1-x0,8);
      var wg=c.createLinearGradient(0,y,0,y+th); wg.addColorStop(0,'#c58a52'); wg.addColorStop(0.25,'#a0683a'); wg.addColorStop(1,'#6e4224'); c.fillStyle=wg; c.beginPath(); c.roundRect(x0,y,x1-x0,th,4); c.fill();
      c.fillStyle='rgba(255,230,190,0.25)'; c.fillRect(x0+3,y+1,x1-x0-6,2);
      c.fillStyle='#5a361c'; [x0+14,x1-22].forEach(function(bx){ c.fillRect(bx,y+th,8,th*0.9); }); });
    var vg=c.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.3,VW/2,VH/2,Math.max(VW,VH)*0.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.45)'); c.fillStyle=vg; c.fillRect(0,0,VW,VH);
  }
  cx.setTransform(1,0,0,1,0,0); cx.drawImage(bgCache,0,0);
}
function lipWorld(P, ang, dir){ var lx=dir*bw/2, ly=-bh, cs=Math.cos(ang), sn=Math.sin(ang); return {x:P.x+lx*cs-ly*sn, y:P.y+lx*sn+ly*cs}; }
function stepAnim(a, dt){
  a.t+=dt; var si=V[a.i], dj=V[a.j], t=a.t, w=bw/2;
  var th0=Math.atan2(bh-a.h0*uh, w), th1=Math.min(1.5, Math.atan2(bh-(a.h0-a.n)*uh, w));
  var M={x:dj.x-a.dir*bw*0.12, y:dj.y-bh-bw*0.42}, home={x:si.x, y:si.y-bw*0.55}, p=0, ang, e;
  if (t<a.tGo){ e=ease(t/a.tGo); ang=th0*e; }
  else if (t<a.tGo+a.tPour){ p=(t-a.tGo)/a.tPour; ang=th0+(th1-th0)*p; e=1; if (!a.snd){ a.snd=true; Snd.glug(a.n); } }
  else { var q=Math.min(1,(t-a.tGo-a.tPour)/a.tBack); p=1; e=1-ease(q); ang=th1*e; }
  ang*=a.dir;
  // keep the lip exactly over the target's mouth
  var cs=Math.cos(ang), sn=Math.sin(ang), lx=a.dir*w, ly=-bh, Pp={x:M.x-(lx*cs-ly*sn), y:M.y-(lx*sn+ly*cs)};
  var P={x:home.x+(Pp.x-home.x)*e, y:home.y+(Pp.y-home.y)*e};
  si.ox=P.x-si.x; si.oy=P.y-si.y; si.ang=ang; si.lift=0;
  si.disp[si.disp.length-1].a=a.n*(1-p); dj.disp[dj.disp.length-1].a=a.n*p;
  a.stream = (t>=a.tGo-0.03 && t<a.tGo+a.tPour+0.05) ? {x:M.x, y0:M.y-1, y1:dj.y-(a.hd0+a.n*p)*uh-bw*0.07, k:Math.min(1,(t-a.tGo+0.03)/0.08), out:Math.max(0,(t-a.tGo-a.tPour)/0.05)} : null;
  if (a.stream && p>0 && p<1 && Math.random()<0.6) parts.push({x:a.stream.x+(Math.random()-0.5)*bw*0.3, y:a.stream.y1, vx:(Math.random()-0.5)*60, vy:-40-Math.random()*60, t:0.25+Math.random()*0.15, c:COL_HI[a.c], r:1.2+Math.random()*1.6, g:420});
  return t>=a.tGo+a.tPour+a.tBack;
}
function draw(dt){
  if (hitStop>0){ hitStop-=dt; dt*=0.08; }
  drawBg(); var c=cx; c.setTransform(DPR,0,0,DPR,0,0);
  var now=performance.now(), i;
  for (i=laters.length-1;i>=0;i--){ laters[i].t-=dt; if (laters[i].t<=0){ var lf=laters[i].fn; laters.splice(i,1); lf(); } }
  drawStage(dt, now/1000);
  for (i=0;i<V.length;i++){ var v=V[i];
    var tgt=(i===sel)?1:0; if (hintMv && now<hintUntil && !v.busy && hintMv[0]===i && sel<0) tgt=0.5+Math.sin(now/130)*0.25;
    if (!v.busy) v.lift+=(tgt-v.lift)*Math.min(1,dt*18);
    if (v.shake>0) v.shake=Math.max(0,v.shake-dt); if (v.pop>0){ v.pop=Math.max(0,v.pop-dt*2.4); }
    if (v.drop>0) v.drop=Math.max(0,v.drop-dt);
    var dn=!v.busy && DJ.done(B[i]) && B[i].length>0; if (dn && v.cork<1) v.cork=Math.min(1,v.cork+dt*3.2); if (!dn && !v.busy) v.cork=0; }
  for (i=anims.length-1;i>=0;i--){ if (stepAnim(anims[i], dt)){ finishAnim(anims[i]); anims.splice(i,1); } }
  for (i=0;i<V.length;i++) if (!V[i].ang && !V[i].ox) drawBottle(V[i], i);
  anims.forEach(function(a){ var s=a.stream; if (!s) return; var w=bw*0.13*s.k*(1-s.out), ya=s.y0+(s.y1-s.y0)*s.out*0, yb=s.y0+(s.y1-s.y0)*Math.min(1,s.k*1.2);
    if (w<=0.3) return; c.fillStyle=COL[a.c]; c.beginPath(); c.roundRect(s.x-w/2, ya, w, Math.max(0,yb-ya), w/2); c.fill();
    c.fillStyle=COL_HI[a.c]; c.fillRect(s.x-w/2, ya, w*0.35, Math.max(0,yb-ya)); });
  for (i=0;i<V.length;i++) if (V[i].ang || V[i].ox) drawBottle(V[i], i);
  // hint arrow / tutorial arrow
  var hm = (hintMv && now<hintUntil) ? hintMv : (L.tut && !won && !lost && !anims.length ? (tutMv||(tutMv=nextHint())) : null);
  if (anims.length) tutMv=null;
  if (hm && !won){ var ti = sel===hm[0] ? hm[1] : (sel<0 ? hm[0] : -1); if (ti>=0 && V[ti]){ var hv=V[ti], ay=hv.y-bh-bw*0.75-hv.lift*bw*0.55+Math.sin(now/160)*5;
    c.fillStyle='#ffe45c'; c.strokeStyle='#2a1a2e'; c.lineWidth=3; c.beginPath(); c.moveTo(hv.x, ay+bw*0.4); c.lineTo(hv.x-bw*0.34, ay); c.lineTo(hv.x-bw*0.13, ay); c.lineTo(hv.x-bw*0.13, ay-bw*0.42); c.lineTo(hv.x+bw*0.13, ay-bw*0.42); c.lineTo(hv.x+bw*0.13, ay); c.lineTo(hv.x+bw*0.34, ay); c.closePath(); c.stroke(); c.fill(); } }
  // particles
  for (i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t-=dt; if (p.t<=0 || p.y>VH+30){ parts.splice(i,1); continue; } p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    c.globalAlpha=Math.min(1,p.t*2); c.fillStyle=p.c;
    if (p.rect){ p.rot+=p.vr*dt; c.save(); c.translate(p.x,p.y); c.rotate(p.rot); c.fillRect(-p.r,-p.r*0.5,p.r*2,p.r); c.restore(); } else { c.beginPath(); c.arc(p.x,p.y,p.r,0,6.3); c.fill(); } }
  c.globalAlpha=1;
}
var tutMv=null, plan=null;
// hints follow one stored solution, so repeated hints always make progress
function nextHint(){ if (!plan || !plan.length) plan=DJ.solve(B); return plan && plan.length ? plan[0] : null; }

// ---------------- HUD ----------------
function banner(main, sub, ms){
  var b=$('banner'); b.innerHTML=''; b.textContent=main; if(sub){ var s=document.createElement('small'); s.textContent=sub; b.appendChild(s); }
  b.classList.add('show'); clearTimeout(banner.t); banner.t=setTimeout(function(){ b.classList.remove('show'); }, ms||2400);
}
function toast(t){ banner(t,'',1800); }
function setTut(txt){ var e=$('tut'); if(!txt){ e.classList.remove('show'); return; } e.textContent=txt; e.classList.add('show'); }
function updHud(){
  $('lvlIc').textContent = L.kind==='big' ? '🐉' : (L.kind==='boss' ? '👹' : '⚔️');
  $('lvlTx').textContent = tl('floor',{n:L.level}); updSkills(); drawMap($('mini'), false);
  $('coinN').textContent=SAVE.coins; $('shopBtn').classList.toggle('can', UPS.some(function(u){ return SAVE.up[u.k]<UPMAX && SAVE.coins>=upCost(SAVE.up[u.k]); }));
  $('undoN').textContent = undoLeft>0 ? undoLeft : '📺'; $('bAdd').style.opacity = extra>=2 ? 0.35 : 1;
}
function applyLang(){
  document.querySelectorAll('[data-t]').forEach(function(e){ e.textContent=tl(e.dataset.t); });
  var sel2=$('langSel'); sel2.innerHTML=''; CODES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=LANG_NAMES[c]; if(c===LANG) o.selected=true; sel2.appendChild(o); });
}
$('langSel').onchange=function(){ LANG=this.value; try{localStorage.setItem('dj_lang',LANG);}catch(e){} applyLang(); if (L){ updHud(); if ($('shopM').classList.contains('show')) drawShop(); if ($('mapM').classList.contains('show')) openMap(); setTut(L.tut&&moved<2? tl(curStage? 'tutB2' : 'tutA2') : ''); } };
$('sndBtn').onclick=function(){ var on=Snd.toggle(); this.textContent=on?'🔊':'🔇'; };
$('sndBtn').textContent=Snd.isOn()?'🔊':'🔇';
$('lsRetry').onclick=function(){ $('loseM').classList.remove('show'); loadLevel(SAVE.level, false, curStage, Math.max(entryHp, Math.round(F.heroMax*0.6)), curLane, curType); };
$('lsRevive').onclick=function(){ var b=this; b.disabled=true; PF.rewarded(function(ok){ if (!ok){ b.disabled=false; return; } $('loseM').classList.remove('show'); revived=true; F.hHp=Math.round(F.heroMax*0.7); VS.hHp=F.hHp; F.shield++; VS.shield++; VS.shPop=0.45; VS.hGlow=0.5; VS.hDead=0; lost=false; stuckShown=false; Snd.buy(); }); };
$('bUndo').onclick=undo; $('bRestart').onclick=restart; $('bAdd').onclick=addBottle; $('bHint').onclick=showHint;
$('wnNext').onclick=function(){ if (PF.adBusy || $('shopM').classList.contains('show') || $('lootM').classList.contains('show') || $('cardM').classList.contains('show')) return; $('winM').classList.remove('show');
  var go=function(){ startFloor(SAVE.level); };
  if (performance.now()-lastAdT>75000 && SAVE.level>3){ lastAdT=performance.now(); PF.midgame(go); } else go(); };

// ---------------- the floor map: a grid of rooms joined by doors; walk your own way to the boss room ----------------
function nodeAt(id){ return RT.map.rooms[id]; }
function options(){ return RT.at<0 ? [0] : RT.map.rooms[RT.at].links.slice(); }
function frontier(){ var out=[]; RT.map.rooms.forEach(function(r,i){ if (RT.done[i]) r.links.forEach(function(k){ if (!RT.done[k] && out.indexOf(k)<0) out.push(k); }); }); return out; }
function known(id){ var r=nodeAt(id); return r.main>=0 || RT.done[id] || id===RT.at || r.links.some(function(k){ return RT.done[k] || k===RT.at; }); }
function enterRoom(id, hp){ RT.at=id; choosing=false; loadLevel(SAVE.level, false, id, hp, 0, nodeAt(id).t); }
function startFloor(n, dbg){
  RT={map:DJ.mapOf(n), at:-1, done:{}}; carryHp=null; choosing=false; var id=0;
  if (dbg>0) RT.map.rooms.forEach(function(r,i){ if (r.main>=0 && r.main<dbg-1) RT.done[i]=true; else if (r.main===dbg-1) id=i; });
  enterRoom(id, null);
}
// after a room: straight on when there is only one door left to try, otherwise the doors light up and the player picks
function advance(){ RT.done[RT.at]=true; var fr=frontier(), nb=options().filter(function(k){ return !RT.done[k]; }), t=nb.length? nodeAt(nb[0]).t : '';
  if (fr.length===1 && nb.length===1 && t!=='r' && t!=='c'){ nextRoom=nb[0]; walk=0.001; drawMap($('mini'), false); }
  else { choosing=true; drawMap($('mini'), false); if (!SAVE.dT){ SAVE.dT=1; saveNow(); banner(tl('doorTip'), '', 6000); } } }
function pickRoom(id){ if (walk>0) return; closeMap(); choosing=false; nextRoom=id; walk=0.001; }
// walking into a room with nothing to fight: one already cleared, a chest, or a resting place
function arrive(id){
  var nd=nodeAt(id), first=!RT.done[id], max=F.heroMax, g=stg(); walk=0; RT.at=id; RT.done[id]=true;
  var L2={}; for (var k2 in L) L2[k2]=L[k2]; L2.stage=id; L2.role='min'; L2.king=false; L2.elite=false; L2.final=false; L2.tut=false; L=L2;
  B=[]; KN=[]; V=[]; anims=[]; sel=-1; hintMv=null; won=true; winT=-1;
  VS.empty=true; VS.mDead=9; VS.poofed=1; VS.poison=0; VS.prop= (nd.t==='c'||nd.t==='r')? nd.t : null; VS.fadeIn=0.45; fx=[]; orbs=[];
  if (first && nd.t==='r'){ carryHp=Math.min(max, (carryHp==null? max : Math.min(max,carryHp))+Math.round(max*0.35)); F.hHp=carryHp; later(0.5, function(){ VS.hHp=carryHp; VS.hGlow=0.7; floatTx(g.hx, g.gy-70*g.k, '+'+Math.round(max*0.35), '#8df07a', true, 'heal'); Snd.buy(); }); }
  if (first && nd.t==='c'){ var gold=15+Math.min(45, SAVE.level); SAVE.coins+=gold; saveNow(); later(0.5, function(){ floatTx(g.mx, g.gy-60*g.k, '+'+gold, '#ffe98a', true); Snd.coin(); Snd.cork(); for (var i=0;i<14;i++) parts.push({x:g.mx,y:g.gy-26*g.k,vx:(Math.random()-0.5)*260,vy:-140-Math.random()*220,t:0.9,c:i%2?'#ffd84a':'#fff6c2',r:3+Math.random()*3,g:800}); updHud(); }); }
  choosing=true; updHud();
}
var mapNote='', mapHits=[], mapTimer=0, NCOL={f:'#4f4468', e:'#6f3aa8', r:'#2f7d48', c:'#a67c1c', B:'#c0303a'};
function drawMap(cv2, bigMap){
  if (!RT) return; var sm=VW<=600, M=RT.map, cell=bigMap?46:(sm?8:11), gap=bigMap?14:(sm?3:4), pad=bigMap?14:(sm?4:6), top=bigMap?(mapNote?34:8):0, W=pad*2+M.w*cell+(M.w-1)*gap, H=top+pad*2+M.h*cell+(M.h-1)*gap, dpr=bigMap?2:Math.min(2,window.devicePixelRatio||1);
  cv2.width=W*dpr; cv2.height=H*dpr; cv2.style.width=W+'px'; cv2.style.height=H+'px'; var c=cv2.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.lineJoin='round';
  var P=function(r){ return {x:pad+r.x*(cell+gap)+cell/2, y:top+pad+r.y*(cell+gap)+cell/2}; }, ops= choosing ? options() : [], bossC= L.kind==='big'?'#d98a10':(L.kind==='boss'?'#c0303a':'#8a3ad0');
  if (bigMap) mapHits=[];
  M.rooms.forEach(function(r,i){ r.links.forEach(function(k){ if (k<i) return; var p1=P(r), p2=P(M.rooms[k]), lit=(RT.done[i]||i===RT.at)&&(RT.done[k]||k===RT.at), seen=known(i)&&known(k);
    c.globalAlpha= seen? 1 : 0.35; c.strokeStyle= lit? '#ffe98a' : '#7a6a92'; c.lineWidth=bigMap?9:3; c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke(); }); });
  c.globalAlpha=1;
  M.rooms.forEach(function(r,i){ var p=P(r), kn=known(i), boss=r.t==='B', dn=RT.done[i], now=i===RT.at, op=ops.indexOf(i)>=0, x0=p.x-cell/2, y0=p.y-cell/2;
    c.beginPath(); c.roundRect(x0,y0,cell,cell,bigMap?9:2.5); c.fillStyle= boss? bossC : (dn? '#8676a4' : (kn? NCOL[r.t] : '#2a2436')); c.fill();
    c.lineWidth=bigMap?3:1.4; c.strokeStyle= now? '#ffe45c' : (op && bigMap? 'rgba(255,255,255,'+(0.65+Math.sin(performance.now()/150)*0.35)+')' : OL); c.stroke();
    if (bigMap){ c.textAlign='center'; c.textBaseline='middle';
      if (boss){ c.font='24px sans-serif'; c.fillText(L.kind==='big'?'🐉':(L.kind==='boss'?'👹':'💀'), p.x, p.y+1); }
      else if (!kn){ c.font='900 22px '+FNT; c.fillStyle='#6a5a80'; c.fillText('?', p.x, p.y+1); }
      else if (dn && !now){ c.font='900 20px '+FNT; c.fillStyle='rgba(255,255,255,0.75)'; c.fillText('✓', p.x, p.y+1); }
      else if (!dn){ if (r.t==='c'){ c.beginPath(); c.arc(p.x,p.y,10,0,6.3); c.fillStyle='#ffe98a'; c.fill(); c.lineWidth=2.5; c.strokeStyle='#6a4a08'; c.stroke(); } else icon(c, r.t==='f'?'atk':(r.t==='e'?'psn':'heal'), p.x, p.y, 12, '#fff', 3); }
      if (now){ c.beginPath(); c.arc(p.x,p.y+1,11,0,6.3); c.fillStyle='#4f8fe8'; c.fill(); c.lineWidth=3; c.strokeStyle='#fff'; c.stroke(); c.beginPath(); c.arc(p.x,p.y-1,11,Math.PI,0); c.closePath(); c.fillStyle='#cfd8e6'; c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke(); }
      mapHits.push({id:i, x:p.x, y:p.y, r:cell/2+gap/2, ok:op}); }
    else { if (boss){ c.fillStyle='#fff'; c.beginPath(); c.arc(p.x,p.y,2.2,0,6.3); c.fill(); }
      if (now){ c.beginPath(); c.arc(p.x,p.y,3.6,0,6.3); c.fillStyle='#6ab0ff'; c.fill(); c.lineWidth=1.3; c.strokeStyle='#fff'; c.stroke(); } } });
  if (bigMap && mapNote){ c.font='900 18px '+FNT; c.textAlign='center'; c.textBaseline='middle'; c.lineWidth=4; c.strokeStyle=OL; c.strokeText(mapNote, W/2, 18); c.fillStyle='#ffe98a'; c.fillText(mapNote, W/2, 18); }
}
function openMap(){
  mapNote=''; var lg=$('mapLg'); lg.innerHTML=''; var kinds=['f','e','r','c','B'].filter(function(t){ return t==='f'||t==='B'||RT.map.rooms.some(function(r,i){ return r.t===t && known(i); }); });
  kinds.forEach(function(t){ var sp=document.createElement('span'), dot=document.createElement('i'); dot.style.background= t==='B'? (L.kind==='big'?'#d98a10':(L.kind==='boss'?'#c0303a':'#8a3ad0')) : NCOL[t]; sp.appendChild(dot); sp.appendChild(document.createTextNode(tl(t==='B'?'rm_b':'rm_'+t))); lg.appendChild(sp); });
  drawMap($('mapC'), true); $('mapM').classList.add('show');
  clearInterval(mapTimer); mapTimer=setInterval(function(){ if ($('mapM').classList.contains('show')) drawMap($('mapC'), true); else clearInterval(mapTimer); }, 90);
}
function closeMap(){ $('mapM').classList.remove('show'); clearInterval(mapTimer); }
$('mapC').addEventListener('pointerdown', function(e){ if (!choosing) return; var rc=this.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top, hit=null;
  mapHits.forEach(function(h){ if (h.ok && Math.abs(h.x-x)<=h.r && Math.abs(h.y-y)<=h.r) hit=h; }); if (hit){ Snd.unlock(); Snd.pop(); pickRoom(hit.id); } });
$('mapX').onclick=closeMap;
$('mini').addEventListener('pointerdown', function(){ Snd.unlock(); if (!$('mapM').classList.contains('show') && !lost && walk<=0 && !$('winM').classList.contains('show')) openMap(); });

// ---------------- rooms, loot, skills ----------------
function afterKill(){
  var fin=L.final, it= L.king ? null : rollDrop(), bonus= L.elite? (fin? 10 : 12) : 0;
  if (fin){ SAVE.level=L.level+1; var hr=F.hHp/F.heroMax; winStars=revived?1:(hr>=0.7?3:(hr>=0.4?2:1)); lastReward=10+winStars*5+(L.kind==='big'?80:(L.kind==='boss'?25:bonus)); SAVE.coins+=lastReward; Snd.win(); confetti(); PF.happy(); }
  else { Snd.buy(); if (bonus){ SAVE.coins+=bonus; var g0=stg(); floatTx(g0.mx, g0.gy-60*g0.k, '+'+bonus, '#ffe98a', true); Snd.coin(); } }
  if (it) applyItem(it);
  saveNow();
  var cont=function(){ if (fin){ showWin(); return; } carryHp=F.hHp+Math.round(F.heroMax*0.15); updHud(); advance(); };
  later(fin? 0.9 : 0.55, function(){ if (L.king) showCards(cont); else if (it) showLoot(it, cont); else cont(); });
}
function applyItem(it){ it.old=SAVE.gear[it.slot]; if (it.r>it.old) SAVE.gear[it.slot]=it.r; else { it.sold=[10,25,60,150][it.r]; SAVE.coins+=it.sold; } }
// boss reward: three face-down cards, flip one (the flipped card is a real roll of the drop table; no gear means coins)
var cardCont=null, cardLeft=0;
function showCards(cont){
  cardCont=cont; cardLeft=1; var box=$('cards'); box.innerHTML=''; $('cardRs').textContent=''; $('cardBtns').className=''; $('cardAgain').style.display=''; $('cardAgain').disabled=false;
  for (var i=0;i<3;i++){ var bt=document.createElement('button'); bt.className='fc back'; bt.textContent='?'; bt.onclick=flipCard; box.appendChild(bt); }
  $('cardM').classList.add('show'); Snd.horn();
}
function flipCard(){
  var bt=this; if (cardLeft<=0 || bt.className.indexOf('back')<0) return; cardLeft--;
  var it=rollDrop(), rs=$('cardRs'); bt.className='fc up pick'; bt.textContent=''; rs.textContent='';
  if (it){ applyItem(it); var cv3=document.createElement('canvas'); cv3.width=cv3.height=108; gearTile(cv3, it.slot, it.r); bt.appendChild(cv3);
    var nm=document.createElement('div'); nm.textContent=tl('r'+it.r)+' · '+tl('g_'+it.slot); nm.style.color=RAR[it.r]; bt.appendChild(nm);
    var st2=document.createElement('div'); st2.textContent=gearVal(it.slot,it.r); bt.appendChild(st2);
    rs.textContent= it.sold? tl('sold')+' +'+it.sold+' ' : tl('st_'+GSTAT[it.slot].k)+' '+gearVal(it.slot,it.r)+' · '+tl('equipped'); if (it.sold){ var co2=document.createElement('span'); co2.className='coin'; rs.appendChild(co2); }
    Snd.cork(); if (!it.sold) Snd.win(); }
  else { var gold=(L.kind==='big'? 40 : 15)+5*Math.floor(Math.random()*4); SAVE.coins+=gold; var co=document.createElement('span'); co.className='coin'; bt.appendChild(co); var gb=document.createElement('b'); gb.textContent='+'+gold; bt.appendChild(gb); Snd.coin(); Snd.cork(); }
  saveNow(); updHud(); $('cardBtns').className='on';
  [].forEach.call($('cards').children, function(o){ if (o.className.indexOf('back')>=0) o.className='fc back'+(cardLeft>0?'':' dim'); });
}
$('cardAgain').onclick=function(){ var b2=this; if (PF.adBusy) return; b2.disabled=true; PF.rewarded(function(ok){ if (!ok){ b2.disabled=false; return; } cardLeft=1; b2.style.display='none'; $('cardRs').textContent=''; [].forEach.call($('cards').children, function(o){ if (o.className.indexOf('back')>=0) o.className='fc back'; }); }); };
$('cardOk').onclick=function(){ $('cardM').classList.remove('show'); var f=cardCont; cardCont=null; if (f) f(); };
// gear only drops on boss floors, never every time; the odds and the quality rise with the floor.
// blue needs a great boss, purple needs the last great bosses (floor 72 and up).
function rollDrop(){
  if (L.kind==='n') return null;
  var l=L.level, pr=Math.min(1,l/96), fin=L.king, big=L.kind==='big', el=L.elite?2.5:1, first=fin && !SLOTS.some(function(k){ return SAVE.gear[k]>=0; }), p, r=0, x=Math.random();
  if (big) p= fin? 1 : (0.12+0.2*pr)*el; else p= fin? (first? 1 : 0.4+0.45*pr) : (0.05+0.15*pr)*el;
  if (QS.has('loot')) p=1;
  if (Math.random()>=p) return null;
  if (big && fin) r= (l>=72 && x<(l>=96? 0.6 : 0.3)) ? 3 : (x<0.8? 2 : 1);
  else if (big) r= x<0.12? 2 : (x<0.6? 1 : 0);
  else if (fin) r= x<0.15+0.5*pr ? 1 : 0;
  else r= x<0.2*pr ? 1 : 0;
  var better=SLOTS.filter(function(k){ return SAVE.gear[k]<r; }), pool= better.length && Math.random()<0.75 ? better : SLOTS;
  return {slot:pool[Math.floor(Math.random()*pool.length)], r:r};
}
function gearTile(cvs, sl, r){ var c2=cvs.getContext('2d'), w=cvs.width; c2.clearRect(0,0,w,w); c2.beginPath(); c2.roundRect(w*0.04,w*0.04,w*0.92,w*0.92,w*0.2); c2.fillStyle= r>=0? '#3a2c44' : '#2a1f33'; c2.fill(); c2.lineWidth=w*0.06; c2.strokeStyle= r>=0? RAR[r] : '#4a3a56'; c2.stroke();
  if (r<0) c2.globalAlpha=0.3; gearIcon(c2, sl, w/2, w/2, w*0.28, r>=0? RAR[r] : '#8a7a96'); c2.globalAlpha=1; }
var lootCont=null;
function showLoot(it, cont){
  lootCont=cont; gearTile($('lootIc'), it.slot, it.r);
  $('lootNm').textContent=tl('r'+it.r)+' · '+tl('g_'+it.slot); $('lootNm').style.color=RAR[it.r];
  $('lootSt').textContent=tl('st_'+GSTAT[it.slot].k)+' '+gearVal(it.slot,it.r);
  var rs=$('lootRs'); rs.textContent= it.sold? tl('sold')+' +'+it.sold+' ' : tl('equipped'); if (it.sold){ var co=document.createElement('span'); co.className='coin'; rs.appendChild(co); }
  $('lootIc').style.animation='none'; void $('lootIc').offsetWidth; $('lootIc').style.animation='';
  $('lootM').classList.add('show'); updHud(); Snd.cork(); if (!it.sold) Snd.win();
}
$('lootOk').onclick=function(){ $('lootM').classList.remove('show'); var f=lootCont; lootCont=null; if (f) f(); };
var gearSel=null;
function drawGear(){
  var grid=$('gearGrid'); grid.innerHTML=''; if (!gearSel || SAVE.gear[gearSel]<0) gearSel=SLOTS.filter(function(k){ return SAVE.gear[k]>=0; })[0]||null;
  SLOTS.forEach(function(sl){ var cv2=document.createElement('canvas'); cv2.width=cv2.height=80; gearTile(cv2, sl, SAVE.gear[sl]); if (sl===gearSel) cv2.className='on'; cv2.onclick=function(){ gearSel=sl; drawGear(); }; grid.appendChild(cv2); });
  var inf=$('gearInfo'), r=gearSel? SAVE.gear[gearSel] : -1; inf.textContent='';
  if (gearSel){ var b1=document.createElement('div'); b1.textContent=tl('g_'+gearSel)+(r>=0? ' · '+tl('r'+r) : ''); b1.style.color= r>=0? RAR[r] : '#a898b4'; inf.appendChild(b1);
    var b2=document.createElement('div'); b2.textContent=tl('st_'+GSTAT[gearSel].k)+(r>=0? ' '+gearVal(gearSel,r) : ''); inf.appendChild(b2); }
}
var SK1=60, SK2=100;
function updSkills(){
  if (!L) return; var s1=$('sk1'), s2=$('sk2'), u1=SAVE.level>=2||L.level>=2, u2=SAVE.level>=4||L.level>=4;
  $('skills').className= u1? '' : 'none'; $('ebar').firstChild.style.width=energy+'%';
  s1.className= !u1? 'lock' : (energy>=SK1? 'rdy' : 'off'); s2.className= !u2? 'lock' : (magic? 'act' : (energy>=SK2? 'rdy' : 'off'));
}
function busyNow(){ return won || lost || choosing || walk>0 || PF.adBusy; }
// Blade Storm: a free hit that grows with every attack potion sitting at the top of a bottle
$('sk1').onclick=function(){ Snd.unlock(); if (busyNow() || anims.length) return; if (energy<SK1){ toast(tl('needE')); Snd.nope(); return; }
  var n=0; B.forEach(function(b,i){ if (b.length && !DJ.done(b) && KN[i][b.length-1] && DJ.ROLE[DJ.top(b)]==='atk'){ var q=knownRun(i); n+=q; V[i].pop=1; sparkle(V[i].x, V[i].y-bh*0.3-(b.length-0.5)*uh, DJ.top(b), 8); } });
  var dmg=Math.round((F.atk*0.4+6*n)*DJ.power(F)); energy-=SK1; magic=false; F.mHp-=dmg; var mAfter=F.mHp; VS.hAtk=HA; Snd.swing(); Snd.horn(); updSkills();
  later(HA*0.42, function(){ VS.mHp=Math.max(0,Math.min(VS.mHp,mAfter)); hitMonster(dmg, true, 3, n>=3); });
  checkEnd(0.5); };
// Magic Hand: the next pour ignores colours
$('sk2').onclick=function(){ Snd.unlock(); if (busyNow()) return; if (magic){ magic=false; updSkills(); return; } if (energy<SK2){ toast(tl('needE')); Snd.nope(); return; } magic=true; toast(tl('sk2')); Snd.fill(); updSkills(); };
icon($('sk1').firstChild.getContext('2d'),'atk',28,28,20,'#ffb09a',5); icon($('sk2').firstChild.getContext('2d'),'mag',28,28,21,'#e0c8ff',5);

// ---------------- rewards + hero upgrades ----------------
var winStars=3;
function upCost(lv){ return 30+20*lv+10*lv*lv; }
function showWin(){
  var b0=Math.floor((L.level-1)/6)*6;
  var st=$('stars').children, i; for (i=0;i<3;i++){ st[i].className=''; } void $('stars').offsetWidth; for (i=0;i<winStars;i++) st[i].className='on';
  $('wnSub').textContent=tl('floor',{n:L.level})+' ✓  →  '+((b0+6)%24===0?'🐉 ':'👹 ')+tl('floor',{n:b0+6});
  var p=$('wnPath'), b=Math.floor((L.level-1)/6)*6; p.innerHTML='';
  for (i=1;i<=6;i++){ if (i>1) p.appendChild(document.createElement('u')); var d=document.createElement('i'); d.textContent=b+i; if (b+i<=L.level){ d.className='d'; } if (i===6){ d.className+=' b'; d.textContent=(b+6<=L.level)?'✓':((b+6)%24===0?'🐉':'👹'); } p.appendChild(d); }
  $('wnCoinN').textContent=lastReward; $('wnDbl').style.display=''; $('wnDbl').disabled=false;
  $('winM').classList.add('show'); updHud(); Snd.coin();
}
$('wnDbl').onclick=function(){ var b=this; if (PF.adBusy) return; b.disabled=true; PF.rewarded(function(ok){ if (!ok){ b.disabled=false; return; } SAVE.coins+=lastReward; saveNow(); $('wnCoinN').textContent=lastReward*2; b.style.display='none'; updHud(); Snd.buy(); }); };
var UPS=[{k:'s',n:'u_sw',ic:'atk',col:'#ff8a7a',st:function(l){ return ''+(25+5*l); }},{k:'a',n:'u_ar',ic:'shd',col:'#6aa8ff',st:function(l){ return 'HP '+(100+10*l); }},{k:'h',n:'u_el',ic:'heal',col:'#8df07a',st:function(l){ return '+'+(35+6*l); }}];
function drawShop(){
  var box=$('shopRows'); box.innerHTML='';
  UPS.forEach(function(u){ var lv=SAVE.up[u.k], max=lv>=UPMAX, cost=upCost(lv), row=document.createElement('div'); row.className='srow';
    var cvs=document.createElement('canvas'); cvs.width=cvs.height=88; var c2=cvs.getContext('2d'); c2.fillStyle='#4a3256'; c2.beginPath(); c2.arc(44,44,42,0,6.3); c2.fill(); icon(c2,u.ic,44,44,24,u.col,5);
    var info=document.createElement('div'); info.className='si'; info.textContent=tl(u.n)+'  Lv.'+(lv+1); var sm=document.createElement('small'); sm.textContent=u.st(lv)+(max?'':'  →  '+u.st(lv+1)); info.appendChild(sm);
    var bt=document.createElement('button'); bt.className='btn';
    if (max){ bt.textContent='MAX'; bt.disabled=true; } else { bt.textContent=cost+' '; var co=document.createElement('span'); co.className='coin'; bt.appendChild(co); bt.disabled=SAVE.coins<cost;
      bt.onclick=function(){ if (SAVE.coins<cost) return; SAVE.coins-=cost; SAVE.up[u.k]++; saveNow(); Snd.buy();
        if (F && !won && !lost){ if (u.k==='s') F.atk+=5; if (u.k==='h') F.heal+=6; if (u.k==='a'){ F.heroMax+=10; F.hHp+=10; VS.hHp=F.hHp; VS.hGlow=0.5; } }
        drawShop(); updHud(); }; }
    row.appendChild(cvs); row.appendChild(info); row.appendChild(bt); box.appendChild(row); });
  drawGear();
}
$('shopBtn').onclick=function(){ if (PF.adBusy) return; drawShop(); $('shopM').classList.add('show'); };
$('shopX').onclick=function(){ $('shopM').classList.remove('show'); };

// ---------------- input ----------------
addEventListener('keydown', function(e){ Snd.unlock(); if (e.code==='KeyZ') undo(); if (e.code==='KeyR') restart(); if ((e.code==='Enter'||e.code==='Space') && $('winM').classList.contains('show')) $('wnNext').click(); });
cv.addEventListener('pointerdown', function(e){ Snd.unlock(); e.preventDefault();
  if (choosing){ var dh0=null; doorHits.forEach(function(h){ if (Math.hypot(h.x-e.clientX,h.y-e.clientY)<=h.r && (!dh0 || Math.hypot(h.x-e.clientX,h.y-e.clientY)<Math.hypot(dh0.x-e.clientX,dh0.y-e.clientY))) dh0=h; }); if (dh0){ Snd.pop(); pickRoom(dh0.id); } return; }
  var x=e.clientX, y=e.clientY, hit=-1, best=1e9;
  for (var i=0;i<V.length;i++){ var v=V[i], dx=Math.abs(x-v.x), top=v.y-bh-bw*0.9, bot=v.y+bw*0.5; if (dx<bw*0.9 && y>top && y<bot && dx<best){ best=dx; hit=i; } }
  if (hit>=0) tap(hit); else if (sel>=0){ sel=-1; }
});
cv.addEventListener('touchstart', function(e){ e.preventDefault(); }, {passive:false});
addEventListener('wheel', function(e){ e.preventDefault(); }, {passive:false});

// ---------------- frame ----------------
var last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  var dt=Math.min(0.05,(now-last)/1000)*(window.__ts||1); last=now;
  PF.setPlaying(!won && !lost && !choosing && !PF.adBusy && !document.hidden && moved>0 && !$('shopM').classList.contains('show'));
  draw(dt);
  if (lost && !anims.length && !laters.length && !$('loseM').classList.contains('show')){ sel=-1; $('lsRevive').disabled=false; $('loseM').classList.add('show'); Snd.thud(); }
  if (won && !anims.length && !laters.length && winT===0){ winT=now; sel=-1; setTut(''); afterKill(); }
  if (walk>0){ walk+=dt; if (walk>=0.9){ var nr=nodeAt(nextRoom); if (!RT.done[nextRoom] && nr.t!=='r' && nr.t!=='c') enterRoom(nextRoom, carryHp); else arrive(nextRoom); } }
  if (!won){ winT=0; if (!lost && !anims.length && !stuckShown && moved>0 && DJ.stuck(B)){ stuckShown=true; toast(tl('stuck')); Snd.nope(); $('btns').classList.remove('nudge'); void $('btns').offsetWidth; $('btns').classList.add('nudge'); } }
}

// ---------------- boot ----------------
function boot(){
  LANG=detectLang(PF.locale); applyLang(); loadSave();
  DPR=Math.min(window.devicePixelRatio||1, 2); VW=innerWidth; VH=innerHeight; cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR);
  startFloor(SAVE.level, Math.min(DJ.stagesOf(SAVE.level), +QS.get('stage')||0));
  $('loading').style.display='none'; PF.loaded();
  if (DEBUG){ window.__DJ=DJ; window.__PF=PF; window.__S={get B(){ return B; }, get V(){ return V; }, get L(){ return L; }, get won(){ return won; }, get lost(){ return lost; }, get F(){ return F; }, get laters(){ return laters; }, get SAVE(){ return SAVE; }, get anims(){ return anims; }, get bw(){ return bw; }, get bh(){ return bh; }, tap:tap, flush:flush, load:loadLevel, get doors(){ return doorHits; }, get RT(){ return RT; }, get choosing(){ return choosing; }, options:options, pick:pickRoom, get stage(){ return curStage; }, get walk(){ return walk; }, set energy(v){ energy=v; updSkills(); }, get energy(){ return energy; }}; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
