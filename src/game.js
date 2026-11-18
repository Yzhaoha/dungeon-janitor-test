// ===== GAME (render + UI) =====
(function(){
'use strict';
window.addEventListener('error',function(e){ if(window.PokiSDK||window.CrazyGames) return; var d=document.getElementById('errbox')||document.body.appendChild(Object.assign(document.createElement('pre'),{id:'errbox'})); d.style.cssText='position:fixed;left:0;bottom:0;z-index:99;background:#a00;color:#fff;font-size:11px;max-width:100%;white-space:pre-wrap;margin:0'; d.textContent+=e.message+' @'+e.lineno+'\n'; });
var $=function(id){return document.getElementById(id);};
var TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
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
var COL=['#f04848','#4a8cf7','#59d86a','#ffe14a','#8b5cf6','#ff9a3c','#22c7c7','#f472d0','#a16b3f','#f3efe2','#1f7a4d','#2b3a8f'];
var RICON={atk:'⚔️', shd:'🛡️', heal:'❤️', stun:'⚡', psn:'☠️'};
var COL_HI=COL.map(function(c){ return shade(c, 0.28); }), COL_LO=COL.map(function(c){ return shade(c, -0.22); });
function shade(hex, k){ var n=parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255, f=function(v){ return Math.round(k>0? v+(255-v)*k : v*(1+k)); }; return 'rgb('+f(r)+','+f(g)+','+f(b)+')'; }
var CAP=DJ.CAP;
function ease(t){ t=Math.max(0,Math.min(1,t)); return t<0.5? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function easeOut(t){ t=Math.max(0,Math.min(1,t)); return 1-Math.pow(1-t,3); }
function backOut(t){ t=Math.max(0,Math.min(1,t)); var c=1.9; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

// ---------------- state ----------------
var SAVE={v:5, level:1}, L=null, B=[], KN=[], V=[], sel=-1, hist=[], undoLeft=5, extra=0, anims=[], won=false, winT=0, moved=0, hintMv=null, hintUntil=0, parts=[], bw=40, bh=124, uh=24, stuckShown=false, lastAdT=performance.now(), F=null, VS=null, lost=false, laters=[], floats=[], orbs=[], STG={top:58,h:150};
function later(sec, fn){ laters.push({t:sec, fn:fn}); }
function loadSave(){ try{ var s=PF.loadData('dj_save_v5'); if (s && !QS.has('reset')){ var o=JSON.parse(s); if (o && o.v===5 && o.level>=1) SAVE=o; } }catch(e){} if (QS.has('level')) SAVE.level=Math.max(1,+QS.get('level')||1); }
function saveNow(){ PF.saveData('dj_save_v5', JSON.stringify(SAVE)); }
var HEROES=['🛡️','🧙','🏹','🗡️'];
function loadLevel(n, keepExtra){
  L=DJ.gen(n); B=L.bottles.map(function(b){ return b.slice(); });
  if (!keepExtra) extra=0; for (var e=0;e<extra;e++) B.push([]);
  KN=B.map(function(b){ return b.map(function(c,i){ return !L.hidden || i===b.length-1; }); });
  V=B.map(function(b,i){ return {x:0,y:0, lift:0, shake:0, busy:0, cork:DJ.done(b)&&b.length?1:0, pop:0, drop:0.5+i*0.05, ox:0, oy:0, ang:0, disp:null}; });
  tutMv=null; plan=null; sel=-1; hist=[]; undoLeft=5; anims=[]; won=false; lost=false; moved=0; hintMv=null; parts=[]; stuckShown=false; laters=[]; floats=[]; orbs=[];
  F={}; for (var fk in L.fight) F[fk]=L.fight[fk];
  VS={hHp:F.hHp, mHp:F.mHp, hBar:1, mBar:1, shield:0, poison:0, hAtk:0, hHurt:0, hDrink:0, mAtk:0, mHurt:0, mDead:0, mIn:0.6, kind:monsterKind(n)};
  layout(); syncAll(); updHud();
  $('winM').classList.remove('show'); $('loseM').classList.remove('show');
  if (L.king) banner(tl('bossF'), '', 2200); else if (n===3) banner(tl('r_stun'), '', 3600); else if (n===6) banner(tl('r_psn'), '', 3600); else if (L.hidden && n<=11) banner(tl('mystery'), '', 3000);
  setTut(n===1? tl('tutA2') : (n===2? tl('tutB2') : ''));
}
function dispOf(i){ return B[i].map(function(c,k){ return {c:c, a:1, k:KN[i][k]}; }); }
function syncAll(){ V.forEach(function(v,i){ if (!v.busy) v.disp=dispOf(i); }); }
function knownRun(i){ var b=B[i], n=0; for (var k=b.length-1;k>=0 && b[k]===b[b.length-1] && KN[i][k];k--) n++; return n; }
function pourCount(i,j){ if (!DJ.canPour(B,i,j)) return 0; return Math.min(knownRun(i), CAP-B[j].length); }

// ---------------- layout ----------------
function layout(){
  var n=B.length; if (!n) return;
  var small=VW<=600; STG.top=(PF.kind==='poki'? (small?140:112) : (small?96:58)); STG.h=Math.max(104, Math.min(170, VH*0.2));
  var top=STG.top+STG.h+6, bot=92, availH=VH-top-bot, availW=VW-20, best=0, bestRows=1;
  for (var rows=1; rows<=4; rows++){ var per=Math.ceil(n/rows), w=Math.min(availW/(per*1.8), (availH-0)/(rows*(3.15+1.55)));
    if (w>best+0.5){ best=w; bestRows=rows; } }
  bw=Math.max(18, Math.min(62, best)); bh=bw*3.15; uh=bh*0.8/CAP;
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
  hintMv=null; if (L.level<=2 && moved>=2) setTut('');
}
function sum(d){ var s=0; d.forEach(function(u){ s+=u.a; }); return s; }
function finishAnim(a){
  var si=V[a.i], dj=V[a.j]; si.busy=0; dj.busy=0; si.ox=si.oy=si.ang=0;
  si.disp=dispOf(a.i); dj.disp=dispOf(a.j);
  var drank=false;
  if (DJ.done(B[a.j]) && B[a.j].length){ dj.pop=1; Snd.cork(); sparkle(dj.x, dj.y-bh*0.5, a.c, 16); drank=true; doDrink(a.c, dj); }
  doMonsterTurn(drank? 1.05 : 0.05);
  if (F.mHp<=0){ won=true; }
  else if (F.hHp<=0){ lost=true; }
  else if (DJ.solved(B)){ F.mHp=0; won=true; later(1.0, function(){ VS.hAtk=0.32; Snd.swing(); }); later(1.15, function(){ hitMonster(999, true); }); }
  if (won) later(drank? 1.25 : 0.3, function(){ VS.mHp=0; VS.mDead=0.001; Snd.thud(); });
}
// ---------------- fight (rules live in sim.js, this is the show) ----------------
function monsterKind(n){ return DJ.isKing(n) ? 'ogre' : ['slime','gob','skel','bat','orc'][(n-1)%5]; }
function stg(){ var sp=Math.min(VW*0.27, 200), gy=STG.top+STG.h-12, k=STG.h/150; return {hx:VW/2-sp, mx:VW/2+sp, gy:gy, k:k}; }
function floatTx(x,y,txt,col,big){ floats.push({x:x,y:y,txt:txt,col:col||'#fff',t:1.0,big:big}); }
function hitMonster(v, big){ var g=stg(); VS.mHurt=0.3; if (v<900) floatTx(g.mx, g.gy-80*g.k, '-'+v, '#ffd84a', big); Snd.hit();
  for (var i=0;i<8;i++) parts.push({x:g.mx,y:g.gy-40*g.k,vx:(Math.random()-0.5)*260,vy:-60-Math.random()*200,t:0.5,c:'#ffe9a8',r:2+Math.random()*2.5,g:600}); }
function doDrink(c, bv){
  var ev=DJ.drink(F, c), g=stg(), hpAfter=F.hHp, mAfter=F.mHp; hist=[];
  orbs.push({x0:bv.x, y0:bv.y-bh-bw*0.3, x1:g.hx, y1:g.gy-62*g.k, t:0, d:0.38, c:c});
  later(0.38, function(){ VS.hDrink=0.3; Snd.fill(); sparkle(g.hx, g.gy-50*g.k, c, 10); });
  if (ev.role==='atk'){ later(0.62, function(){ VS.hAtk=0.32; Snd.swing(); }); later(0.78, function(){ VS.mHp=Math.max(0,mAfter); hitMonster(ev.v, true); }); }
  else if (ev.role==='heal'){ later(0.45, function(){ VS.hHp=hpAfter; floatTx(g.hx, g.gy-88*g.k, '+'+ev.v+' ❤️', '#7ee06a', true); Snd.buy(); }); }
  else if (ev.role==='shd'){ later(0.45, function(){ VS.shield++; floatTx(g.hx, g.gy-88*g.k, '🛡️ +1', '#9cc8ff', true); Snd.clank(); }); }
  else if (ev.role==='stun'){ later(0.45, function(){ VS.mHurt=0.25; floatTx(g.mx, g.gy-88*g.k, '⚡ +'+F.stun, '#ffe14a', true); Snd.spring(); }); }
  else if (ev.role==='psn'){ later(0.45, function(){ VS.poison+=F.psn; floatTx(g.mx, g.gy-88*g.k, '☠️', '#c9a2ff', true); Snd.squish(); }); }
}
function doMonsterTurn(delay){
  var ev=DJ.monsterTurn(F), g=stg(), hpAfter=F.hHp, mAfter=F.mHp;
  if (ev.psn) later(delay, function(){ VS.mHp=Math.max(0,mAfter); VS.mHurt=Math.max(VS.mHurt,0.15); floatTx(g.mx+26*g.k, g.gy-64*g.k, '-'+ev.psn, '#c9a2ff'); });
  if (ev.blocked||ev.hit){ later(delay+0.1, function(){ VS.mAtk=0.36; Snd.swing(); });
    later(delay+0.28, function(){ if (ev.blocked){ VS.shield=Math.max(0,VS.shield-1); floatTx(g.hx, g.gy-88*g.k, tl('blocked'), '#9cc8ff', true); Snd.clank(); }
      else { VS.hHp=Math.max(0,hpAfter); VS.hHurt=0.35; floatTx(g.hx, g.gy-88*g.k, '-'+ev.hit, '#ff6a5a', true); Snd.bad(); hurtFlash=1; } }); }
}
var hurtFlash=0;
function drawHero(c, x, y, k, t){
  var lunge=VS.hAtk>0? Math.sin((1-VS.hAtk/0.32)*Math.PI)*46*k : 0, sh=VS.hHurt>0? Math.sin(VS.hHurt*50)*5*k : 0, bob=Math.sin(t*3)*1.5;
  c.save(); c.translate(x+lunge+sh, y); c.scale(k,k);
  c.fillStyle='rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0,2,24,6,0,0,6.3); c.fill();
  c.translate(0,bob);
  c.fillStyle='#2b4a8a'; c.fillRect(-11,-14,8,14); c.fillRect(3,-14,8,14);
  c.fillStyle='#3d7bd9'; c.beginPath(); c.roundRect(-16,-46,32,34,9); c.fill();
  c.fillStyle='#ffd84a'; c.fillRect(-16,-24,32,5);
  c.fillStyle='#ffd2a8'; c.beginPath(); c.arc(0,-60,15,0,6.3); c.fill();
  c.fillStyle='#b8c4d6'; c.beginPath(); c.arc(0,-63,16,Math.PI,0); c.fill(); c.fillRect(-16,-64,32,4);
  c.fillStyle='#d94848'; c.beginPath(); c.roundRect(-3,-86,6,12,3); c.fill();
  c.fillStyle='#1b1220'; c.beginPath(); c.arc(4,-58,2.2,0,6.3); c.fill(); c.beginPath(); c.arc(11,-58,2.2,0,6.3); c.fill();
  c.save(); c.translate(17,-34); c.rotate(VS.hAtk>0? -0.6+Math.sin((1-VS.hAtk/0.32)*Math.PI)*2.2 : 0.35-(VS.hDrink>0?0.9:0));
  c.fillStyle='#d9a56a'; c.fillRect(-3,-6,6,12); c.fillStyle='#8a5a2a'; c.fillRect(-8,-10,16,5);
  c.fillStyle='#e6edf5'; c.beginPath(); c.moveTo(-4,-10); c.lineTo(4,-10); c.lineTo(3,-44); c.lineTo(0,-50); c.lineTo(-3,-44); c.closePath(); c.fill(); c.restore();
  if (VS.shield>0){ c.fillStyle='#4a8cf7'; c.strokeStyle='#e6edf5'; c.lineWidth=3; c.beginPath(); c.moveTo(6,-46); c.lineTo(28,-46); c.lineTo(28,-30); c.quadraticCurveTo(28,-18,17,-14); c.quadraticCurveTo(6,-18,6,-30); c.closePath(); c.fill(); c.stroke(); }
  if (VS.hHurt>0){ c.globalAlpha=Math.min(0.6,VS.hHurt*2); c.fillStyle='#ff3030'; c.beginPath(); c.roundRect(-18,-78,36,80,10); c.fill(); c.globalAlpha=1; }
  c.restore();
}
function drawMonster(c, x, y, k, t){
  var kd=VS.kind, lunge=VS.mAtk>0? -Math.sin((1-VS.mAtk/0.36)*Math.PI)*52*k : 0, sh=VS.mHurt>0? Math.sin(VS.mHurt*55)*6*k : 0, bob=Math.sin(t*3.4+1), big=kd==='ogre'?1.4:(kd==='orc'?1.15:1);
  var inn=VS.mIn>0? VS.mIn/0.6*120*k : 0, dead=VS.mDead>0? Math.min(1,VS.mDead/0.5) : 0; if (dead>=1) return;
  var eye=function(ex,ey,r,col){ c.fillStyle=col||'#1b1220'; c.beginPath(); c.arc(ex,ey,r,0,6.3); c.fill(); };
  c.save(); c.translate(x+lunge+sh+inn, y); c.globalAlpha=1-dead; c.scale(k*big*(1-dead*0.4), k*big*(1-dead*0.4)); c.rotate(dead*0.9);
  c.fillStyle='rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0,2,26,6,0,0,6.3); c.fill();
  if (kd==='slime'){ var sq=1+bob*0.06; c.fillStyle='#6fd16a'; c.beginPath(); c.ellipse(0,-20/sq,28*sq,22/sq,0,0,6.3); c.fill(); c.fillStyle='#b6f0a8'; c.beginPath(); c.ellipse(8,-30,7,4,-0.5,0,6.3); c.fill(); eye(-14,-22,3.4); eye(-2,-22,3.4); }
  else if (kd==='bat'){ c.translate(0,-36+bob*5); var fl=Math.sin(t*16)*0.5; c.fillStyle='#5b3690';
    [-1,1].forEach(function(sd){ c.save(); c.scale(sd,1); c.rotate(fl); c.beginPath(); c.moveTo(8,0); c.lineTo(40,-14); c.lineTo(34,2); c.lineTo(40,12); c.lineTo(10,8); c.closePath(); c.fill(); c.restore(); });
    c.fillStyle='#7a4ab0'; c.beginPath(); c.arc(0,0,15,0,6.3); c.fill();
    c.beginPath(); c.moveTo(-12,-10); c.lineTo(-8,-24); c.lineTo(-2,-12); c.closePath(); c.fill(); c.beginPath(); c.moveTo(12,-10); c.lineTo(8,-24); c.lineTo(2,-12); c.closePath(); c.fill();
    eye(-8,-2,3,'#ff4040'); eye(2,-2,3,'#ff4040'); }
  else { c.translate(0,bob*1.2);
    var body={gob:'#7a5230', skel:'#e8e2d0', orc:'#4d7a3a', ogre:'#4d7a3a'}[kd], head={gob:'#7ed957', skel:'#f4efe0', orc:'#5f9447', ogre:'#5f9447'}[kd];
    if (kd==='ogre'){ c.fillStyle='#8a1f1f'; c.beginPath(); c.roundRect(-6,-50,30,46,6); c.fill(); }
    c.fillStyle='#3a2a1a'; c.fillRect(-11,-12,8,12); c.fillRect(3,-12,8,12);
    c.fillStyle=body; c.beginPath(); c.roundRect(-16,-44,32,34,9); c.fill();
    if (kd==='skel'){ c.strokeStyle='#8a8478'; c.lineWidth=2.5; [-36,-29,-22].forEach(function(yy){ c.beginPath(); c.moveTo(-10,yy); c.lineTo(10,yy); c.stroke(); }); }
    if (kd==='orc'||kd==='ogre'){ c.fillStyle='#6e4224'; c.fillRect(-16,-24,32,6); }
    c.fillStyle=head; c.beginPath(); c.arc(0,-58,15,0,6.3); c.fill();
    if (kd==='gob'){ c.beginPath(); c.moveTo(-12,-64); c.lineTo(-30,-70); c.lineTo(-14,-52); c.closePath(); c.fill(); c.beginPath(); c.moveTo(12,-64); c.lineTo(30,-70); c.lineTo(14,-52); c.closePath(); c.fill(); }
    if (kd==='skel'){ eye(-9,-58,4.2); eye(1,-58,4.2); c.fillStyle='#1b1220'; c.fillRect(-9,-49,12,2.5); } else { eye(-10,-58,2.4); eye(-2,-58,2.4); }
    if (kd==='orc'||kd==='ogre'){ c.fillStyle='#fff8e8'; c.fillRect(-12,-51,3,7); c.fillRect(-1,-51,3,7); }
    if (kd==='ogre'){ c.fillStyle='#ffcf3a'; c.beginPath(); c.moveTo(-13,-70); c.lineTo(-13,-82); c.lineTo(-7,-75); c.lineTo(0,-84); c.lineTo(7,-75); c.lineTo(13,-82); c.lineTo(13,-70); c.closePath(); c.fill(); }
    c.save(); c.translate(-18,-32); c.rotate(VS.mAtk>0? 0.9-Math.sin((1-VS.mAtk/0.36)*Math.PI)*2.2 : 0.3); c.fillStyle='#6e4224'; c.fillRect(-3,-34,6,40);
    if (kd!=='skel'){ c.fillStyle='#8a8090'; c.beginPath(); c.roundRect(-8,-46,16,16,3); c.fill(); } else { c.fillStyle='#e6edf5'; c.fillRect(-2,-52,4,22); } c.restore(); }
  if (VS.mHurt>0){ c.globalAlpha=Math.min(0.4,VS.mHurt*1.5)*(1-dead); c.fillStyle='#fff3c0'; c.beginPath(); c.arc(0,kd==='bat'?0:-34,26,0,6.3); c.fill(); }
  c.restore(); c.globalAlpha=1;
}
function drawBar(c, x, y, w, frac, col, txt){
  c.fillStyle='rgba(20,12,26,0.85)'; c.beginPath(); c.roundRect(x-w/2-2, y-2, w+4, 14, 7); c.fill();
  if (frac>0.005){ c.fillStyle=col; c.beginPath(); c.roundRect(x-w/2, y, Math.max(8,w*Math.min(1,frac)), 10, 5); c.fill(); }
  c.font='900 11px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.lineWidth=3; c.strokeStyle='#2a1a2e'; c.strokeText(txt, x, y+5.5); c.fillStyle='#fff'; c.fillText(txt, x, y+5.5);
}
function drawStage(dt, t){
  var c=cx, g=stg(), k=g.k, i;
  ['hAtk','hHurt','hDrink','mAtk','mHurt','mIn'].forEach(function(n){ if (VS[n]>0) VS[n]=Math.max(0,VS[n]-dt); }); if (VS.mDead>0) VS.mDead+=dt;
  VS.hBar+=(VS.hHp/F.heroMax-VS.hBar)*Math.min(1,dt*10); VS.mBar+=(VS.mHp/F.mMax-VS.mBar)*Math.min(1,dt*10);
  var px=Math.max(8,g.hx-110*k), pw=Math.min(VW-16,(g.mx-g.hx)+220*k);
  c.fillStyle='rgba(10,6,14,0.34)'; c.beginPath(); c.roundRect(px, STG.top, pw, STG.h, 18); c.fill();
  c.fillStyle='#5a4a60'; c.beginPath(); c.roundRect(px+10, g.gy-2, pw-20, 9, 4); c.fill();
  c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(px+14, g.gy-1, pw-28, 2);
  drawHero(c, g.hx, g.gy, k, t); drawMonster(c, g.mx, g.gy, k, t);
  var bw2=Math.min(104, 96*k), top=g.gy-108*k;
  drawBar(c, g.hx, top, bw2, VS.hBar, '#59d86a', Math.max(0,Math.round(VS.hHp))+' / '+F.heroMax);
  if (VS.shield>0){ c.font=Math.round(15*k)+'px sans-serif'; c.textAlign='right'; c.textBaseline='middle'; c.fillStyle='#fff'; c.fillText('🛡️×'+VS.shield, g.hx-bw2/2-6, top+5); }
  if (!(VS.mDead>0.5)){ drawBar(c, g.mx, top, bw2, VS.mBar, '#f04848', Math.max(0,Math.round(VS.mHp))+' / '+F.mMax);
    if (VS.poison>0){ c.font=Math.round(14*k)+'px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#c9a2ff'; c.fillText('☠️'+VS.poison, g.mx, top+22); }
    if (!won){ var cd=F.cd, hot=cd<=1, r=(16+(hot?Math.sin(t*10)*2.5:0))*k, bx=g.mx-bw2/2-22*k, by=top+5;
      c.fillStyle=hot?'#f04848':(cd<=2?'#ff9a3c':'#4a3256'); c.strokeStyle='#fff'; c.lineWidth=2.5; c.beginPath(); c.arc(bx,by,r,0,6.3); c.fill(); c.stroke();
      c.font='900 '+Math.round(18*k)+'px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#fff'; c.fillText(''+cd, bx, by+1);
      c.font=Math.round(12*k)+'px sans-serif'; c.fillText('⚔️', bx, by+r+9*k); } }
  for (i=orbs.length-1;i>=0;i--){ var o=orbs[i]; o.t+=dt; var e=Math.min(1,o.t/o.d), ee=ease(e), ox=o.x0+(o.x1-o.x0)*ee, oy=o.y0+(o.y1-o.y0)*ee-Math.sin(e*Math.PI)*60;
    c.fillStyle=COL[o.c]; c.beginPath(); c.arc(ox,oy,9*k+3,0,6.3); c.fill(); c.fillStyle=COL_HI[o.c]; c.beginPath(); c.arc(ox-3,oy-3,4,0,6.3); c.fill();
    if (Math.random()<0.7) parts.push({x:ox,y:oy,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,t:0.3,c:COL_HI[o.c],r:2,g:0});
    if (e>=1) orbs.splice(i,1); }
  for (i=floats.length-1;i>=0;i--){ var f=floats[i]; f.t-=dt; if (f.t<=0){ floats.splice(i,1); continue; } var fy=f.y-(1-f.t)*34;
    c.globalAlpha=Math.min(1,f.t*2.5); c.font='900 '+Math.round((f.big?24:17)*Math.max(0.85,k))+'px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.lineWidth=4; c.strokeStyle='#2a1a2e'; c.strokeText(f.txt,f.x,fy); c.fillStyle=f.col; c.fillText(f.txt,f.x,fy); }
  c.globalAlpha=1;
  if (hurtFlash>0){ hurtFlash=Math.max(0,hurtFlash-dt*3); c.fillStyle='rgba(255,40,40,'+(hurtFlash*0.22)+')'; c.fillRect(0,0,VW,VH); }
}

function sparkle(x,y,c,n){ for (var i=0;i<n;i++){ var an=Math.random()*6.28, s=40+Math.random()*120; parts.push({x:x+(Math.random()-0.5)*bw, y:y+(Math.random()-0.5)*bh*0.6, vx:Math.cos(an)*s, vy:Math.sin(an)*s-80, t:0.7+Math.random()*0.4, c:COL_HI[c], r:2+Math.random()*3, g:140}); } }
function confetti(){ for (var i=0;i<110;i++){ parts.push({x:VW*Math.random(), y:-20-Math.random()*VH*0.3, vx:(Math.random()-0.5)*120, vy:120+Math.random()*220, t:2.2+Math.random()*1.2, c:COL[Math.floor(Math.random()*8)], r:3+Math.random()*4, g:60, rect:1, rot:Math.random()*6, vr:(Math.random()-0.5)*12}); } }
function tap(i){
  if (won || lost || !V[i]) return; var v=V[i];
  if (sel<0){ if (v.busy) return; if (B[i].length && !DJ.done(B[i])){ sel=i; Snd.pop(); } else { v.shake=0.3; } return; }
  if (sel===i){ sel=-1; Snd.take(); return; }
  var n=pourCount(sel,i);
  if (n>0){ if (V[sel].busy||v.busy) return; startPour(sel,i,n); sel=-1; return; }
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
function restart(){ if (won || lost) return; loadLevel(SAVE.level, true); Snd.take(); V.forEach(function(v,i){ v.drop=0.4+i*0.03; }); }
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
    if (u.k && u.a>0.95 && Math.abs(v.ang)<0.05 && bw>=26){ c.globalAlpha=0.9; c.font=Math.round(uh*0.5)+'px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#fff'; c.fillText(RICON[DJ.ROLE[u.c]], 0, -(h+u.a*uh/2)+1); c.globalAlpha=1; }
    else if (!u.k && Math.abs(v.ang)<0.05){ c.fillStyle='rgba(255,255,255,0.55)'; c.font='900 '+Math.round(uh*0.62)+'px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?', 0, -(h+u.a*uh/2)); }
    h=h2; }
  if (h>0 && d.length){ var tu=d[d.length-1]; if (tu.a<=0.001 && d.length>1) tu=d[d.length-2]; c.fillStyle=tu.k? COL_HI[tu.c] : '#55506a';
    c.beginPath(); c.moveTo(-X, -h+tn*X); c.lineTo(X, -h-tn*X); c.lineTo(X, -h-tn*X+3); c.lineTo(-X, -h+tn*X+3); c.closePath(); c.fill(); }
  c.restore();
  // glass front: outline, highlight, rim
  bottlePath(c, 0); c.lineWidth=Math.max(2, bw*0.055); c.strokeStyle= (i===sel? '#fff6c2' : 'rgba(235,240,255,0.78)'); c.stroke();
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
    [[VW*0.1,VH*0.2],[VW*0.9,VH*0.2]].forEach(function(p){ var rg=c.createRadialGradient(p[0],p[1],4,p[0],p[1],Math.max(VW,VH)*0.42); rg.addColorStop(0,'rgba(255,170,80,0.34)'); rg.addColorStop(1,'rgba(255,170,80,0)'); c.fillStyle=rg; c.fillRect(0,0,VW,VH);
      c.fillStyle='#4a3a2a'; c.fillRect(p[0]-7,p[1]-12,14,22); c.fillStyle='#ffcf6a'; c.beginPath(); c.arc(p[0],p[1],5,0,6.3); c.fill(); });
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
  var hm = (hintMv && now<hintUntil) ? hintMv : (L.level<=2 && !won && !lost && !anims.length ? (tutMv||(tutMv=nextHint())) : null);
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
  $('lvlIc').textContent = L.king ? '👹' : '⚔️';
  $('lvlTx').textContent = tl('floor',{n:L.level});
  $('undoN').textContent = undoLeft>0 ? undoLeft : '📺'; $('bAdd').style.opacity = extra>=2 ? 0.35 : 1;
}
function applyLang(){
  document.querySelectorAll('[data-t]').forEach(function(e){ e.textContent=tl(e.dataset.t); });
  var sel2=$('langSel'); sel2.innerHTML=''; CODES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=LANG_NAMES[c]; if(c===LANG) o.selected=true; sel2.appendChild(o); });
}
$('langSel').onchange=function(){ LANG=this.value; try{localStorage.setItem('dj_lang',LANG);}catch(e){} applyLang(); if (L){ updHud(); setTut(SAVE.level===1&&moved<2? tl('tutA2') : (SAVE.level===2&&moved<2? tl('tutB2') : '')); } };
$('sndBtn').onclick=function(){ var on=Snd.toggle(); this.textContent=on?'🔊':'🔇'; };
$('sndBtn').textContent=Snd.isOn()?'🔊':'🔇';
$('lsRetry').onclick=function(){ $('loseM').classList.remove('show'); loadLevel(SAVE.level); };
$('lsRevive').onclick=function(){ var b=this; b.disabled=true; PF.rewarded(function(ok){ if (!ok){ b.disabled=false; return; } $('loseM').classList.remove('show'); F.hHp=Math.round(F.heroMax*0.7); VS.hHp=F.hHp; F.shield++; VS.shield++; lost=false; stuckShown=false; Snd.buy(); }); };
$('bUndo').onclick=undo; $('bRestart').onclick=restart; $('bAdd').onclick=addBottle; $('bHint').onclick=showHint;
$('wnNext').onclick=function(){ if (PF.adBusy) return; $('winM').classList.remove('show');
  var go=function(){ loadLevel(SAVE.level); };
  if (performance.now()-lastAdT>75000 && SAVE.level>3){ lastAdT=performance.now(); PF.midgame(go); } else go(); };

// ---------------- input ----------------
addEventListener('keydown', function(e){ Snd.unlock(); if (e.code==='KeyZ') undo(); if (e.code==='KeyR') restart(); if ((e.code==='Enter'||e.code==='Space') && $('winM').classList.contains('show')) $('wnNext').click(); });
cv.addEventListener('pointerdown', function(e){ Snd.unlock(); e.preventDefault();
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
  PF.setPlaying(!won && !lost && !PF.adBusy && !document.hidden && moved>0);
  draw(dt);
  if (lost && !anims.length && !laters.length && !$('loseM').classList.contains('show')){ sel=-1; $('lsRevive').disabled=false; $('loseM').classList.add('show'); Snd.thud(); }
  if (won && !anims.length && !laters.length && winT===0){ winT=now; SAVE.level=L.level+1; saveNow(); setTut(''); Snd.win(); confetti(); PF.happy(); sel=-1; }
  if (won && winT && now-winT>900 && !$('winM').classList.contains('show') && L.level<SAVE.level){ $('wnSub').textContent=tl('floor',{n:L.level})+' ✓   ❤️ '+Math.max(0,Math.round(F.hHp)); $('winM').classList.add('show'); winT=-1; }
  if (!won){ winT=0; if (!lost && !anims.length && !stuckShown && moved>0 && DJ.stuck(B)){ stuckShown=true; toast(tl('stuck')); Snd.nope(); $('btns').classList.remove('nudge'); void $('btns').offsetWidth; $('btns').classList.add('nudge'); } }
}

// ---------------- boot ----------------
function boot(){
  LANG=detectLang(PF.locale); applyLang(); loadSave();
  DPR=Math.min(window.devicePixelRatio||1, 2); VW=innerWidth; VH=innerHeight; cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR);
  loadLevel(SAVE.level);
  $('loading').style.display='none'; PF.loaded();
  if (DEBUG){ window.__DJ=DJ; window.__PF=PF; window.__S={get B(){ return B; }, get V(){ return V; }, get L(){ return L; }, get won(){ return won; }, get lost(){ return lost; }, get F(){ return F; }, get laters(){ return laters; }, get SAVE(){ return SAVE; }, get anims(){ return anims; }, get bw(){ return bw; }, get bh(){ return bh; }, tap:tap, flush:flush, load:loadLevel}; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
