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
  // Everything is synthesised with WebAudio (no sound files): layered tones, filtered noise, metallic partials, and a shared
  // generated reverb so the dungeon sounds like a stone room.
  var ac=null, master=null, dry=null, wet=null, muted=false, pmuted=false, off=false;
  try{ off = localStorage.getItem('dj_snd')==='0'; }catch(e){}
  function ctx(){
    if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)();
      master=ac.createGain(); master.gain.value=0.6; var comp=ac.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4; master.connect(comp); comp.connect(ac.destination);
      dry=ac.createGain(); dry.connect(master);
      var cv=ac.createConvolver(), len=Math.floor(ac.sampleRate*1.8), ir=ac.createBuffer(2,len,ac.sampleRate);
      for (var ch=0;ch<2;ch++){ var d=ir.getChannelData(ch); for (var i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
      cv.buffer=ir; wet=ac.createGain(); wet.gain.value=0.32; wet.connect(cv); var wl=ac.createBiquadFilter(); wl.type='lowpass'; wl.frequency.value=4200; cv.connect(wl); wl.connect(master);
    }catch(e){} }
    if(ac&&ac.state==='suspended') ac.resume(); return ac; }
  function silent(){ return muted||pmuted||off; }
  function out(node, rv){ node.connect(dry); if (rv) { var s=ac.createGain(); s.gain.value=rv; node.connect(s); s.connect(wet); } }
  // tone: frequency f (Hz), duration d, wave type, volume, pitch slide factor, delay, reverb send, attack
  function tone(f, d, type, vol, slide, delay, rv, att){
    if (silent()) return; var a=ctx(); if(!a) return; var t=a.currentTime+(delay||0);
    var o=a.createOscillator(), g=a.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide), t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.2,t+(att||0.008)); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g); out(g, rv==null? 0.25 : rv); o.start(t); o.stop(t+d+0.05);
  }
  // filtered noise burst: type of filter, centre f (and optional sweep to f2)
  function noise(d, vol, f, delay, ftype, f2, q, rv){
    if (silent()) return; var a=ctx(); if(!a) return; var t=a.currentTime+(delay||0);
    var b=a.createBuffer(1, Math.max(1,Math.floor(a.sampleRate*d)), a.sampleRate), chn=b.getChannelData(0);
    for (var i=0;i<chn.length;i++) chn[i]=(Math.random()*2-1);
    var s=a.createBufferSource(); s.buffer=b; var fl=a.createBiquadFilter(); fl.type=ftype||'lowpass'; fl.frequency.setValueAtTime(f||1200,t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2,t+d); fl.Q.value=q||0.8;
    var g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.2,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    s.connect(fl); fl.connect(g); out(g, rv==null? 0.2 : rv); s.start(t); s.stop(t+d+0.02);
  }
  // struck metal: inharmonic partials that ring and die fast
  function metal(f, d, vol, delay){ [1,2.76,5.4,8.93].forEach(function(r,i){ tone(f*r, d*(1-i*0.18), i? 'sine' : 'triangle', vol*(1-i*0.22), 0.995, delay, 0.45); }); noise(0.03, vol*0.8, 6000, delay, 'highpass'); }
  // a soft brass voice for fanfares (detuned saws through a closing low-pass)
  function brass(f, d, vol, delay){
    if (silent()) return; var a=ctx(); if(!a) return; var t=a.currentTime+(delay||0), fl=a.createBiquadFilter(), g=a.createGain();
    fl.type='lowpass'; fl.frequency.setValueAtTime(400,t); fl.frequency.exponentialRampToValueAtTime(2600,t+0.08); fl.frequency.exponentialRampToValueAtTime(900,t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.05); g.gain.setValueAtTime(vol*0.8,t+d*0.7); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    [-6,6].forEach(function(dt){ var o=a.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=dt; o.connect(fl); o.start(t); o.stop(t+d+0.05); });
    fl.connect(g); out(g, 0.35);
  }
  function drum(f, d, vol, delay){ tone(f, d, 'sine', vol, 0.35, delay, 0.3); noise(d*0.5, vol*0.35, 900, delay, 'lowpass', null, null, 0.3); }
  function mtof(m){ return 440*Math.pow(2,(m-69)/12); }

  // ---------- music: a slow dark-fantasy loop (D minor), with a heavier boss variant ----------
  var mus=null, musOn=false, nextT=0, stepI=0, mode='n';
  var SONG={
    n:{bpm:84, prog:[[50,53,57],[46,50,53],[48,52,55],[45,49,52]], mel:[74,-1,72,69,-1,67,69,-1, 70,-1,69,65,-1,62,65,-1, 67,-1,69,72,-1,74,72,69, 73,-1,-1,69,-1,-1,-1,-1]},
    b:{bpm:112, prog:[[38,41,45],[38,41,45],[46,50,53],[45,49,52]], mel:[62,-1,65,-1,64,-1,62,-1, 62,-1,65,-1,67,-1,65,64, 58,-1,62,-1,65,-1,64,62, 61,-1,64,-1,69,-1,-1,-1]}};
  function voice(m,t,d,type,vol,cut,att){ var a=ac, o=a.createOscillator(), g=a.createGain(), fl=a.createBiquadFilter(); o.type=type; o.frequency.value=mtof(m);
    fl.type='lowpass'; fl.frequency.value=cut||2400; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+(att||0.015)); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(fl); fl.connect(g); g.connect(mus); var s=ac.createGain(); s.gain.value=0.5; g.connect(s); s.connect(wet); o.start(t); o.stop(t+d+0.05); }
  function sched(){
    if (!ac||!musOn) return; var S2=SONG[mode], SPB=60/S2.bpm/2;
    if (nextT<ac.currentTime) nextT=ac.currentTime+0.05;
    while (nextT<ac.currentTime+0.5){
      var bar=Math.floor(stepI/8)%4, i=stepI%8, ch=S2.prog[bar], m=S2.mel[stepI%32];
      if (i===0) ch.forEach(function(n0){ voice(n0, nextT, SPB*8.2, 'sawtooth', 0.018, 900, 0.5); voice(n0+12, nextT, SPB*8.2, 'triangle', 0.02, 1800, 0.6); });
      if (mode==='b'){ if (i%2===0) voice(ch[0]-12, nextT, SPB*1.6, 'sawtooth', 0.06, 500); }
      else if (i===0||i===4||i===6) voice(ch[0]-12, nextT, SPB*3, 'triangle', 0.12, 600);
      voice(ch[(i*2)%3]+12+(i>3?12:0), nextT, SPB*2.2, 'triangle', 0.03, 3000, 0.004);
      if (m>0) voice(m, nextT, SPB*1.9, 'sine', 0.05, 2600, 0.05);
      if (mode==='b' ? (i===0||i===3||i===4||i===6) : (i===0||i===5)){ var t=nextT, o=ac.createOscillator(), g=ac.createGain(); o.type='sine'; o.frequency.setValueAtTime(mode==='b'?90:70,t); o.frequency.exponentialRampToValueAtTime(40,t+0.25); g.gain.setValueAtTime(mode==='b'?0.22:0.14,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3); o.connect(g); g.connect(mus); o.start(t); o.stop(t+0.35); }
      nextT+=SPB; stepI++;
    }
  }
  setInterval(sched, 120);
  function bgm(){
    var want=!(muted||pmuted||off||document.hidden);
    if (!ac) return;
    if (!mus){ mus=ac.createGain(); mus.gain.value=0; mus.connect(master); }
    musOn = want && ac.state==='running';
    mus.gain.cancelScheduledValues(ac.currentTime); mus.gain.setTargetAtTime(musOn?(mode==='b'?0.8:1.15):0, ac.currentTime, 0.2);
  }
  document.addEventListener('visibilitychange', function(){ bgm(); });
  var lastCoin=0;
  var S = {
    coin:function(){ var n=performance.now(); if(n-lastCoin<70) return; lastCoin=n; tone(1568,0.25,'sine',0.08,1,0,0.4); tone(2093,0.35,'sine',0.07,1,0.07,0.4); tone(4186,0.15,'sine',0.02,1,0.07,0.3); },
    squish:function(){ tone(140,0.25,'sine',0.16,0.6); for (var k=0;k<4;k++) tone(220+k*60+Math.random()*40,0.08,'sine',0.06,1.6,k*0.05); noise(0.2,0.06,600,0,'lowpass'); },
    clank:function(){ metal(620,0.5,0.09); tone(180,0.15,'triangle',0.1,0.7); },
    spring:function(){ noise(0.3,0.12,3000,0,'bandpass',8000,4,0.4); tone(880,0.25,'square',0.04,0.3); tone(1760,0.18,'sawtooth',0.03,0.5,0.03); },
    thud:function(){ tone(85,0.5,'sine',0.32,0.4,0,0.35); noise(0.35,0.22,350,0,'lowpass',90); },
    take:function(){ tone(520,0.07,'triangle',0.08,1.3,0,0.15); },
    fill:function(){ [0,0.12,0.24].forEach(function(dl,k){ tone(300+k*40,0.14,'sine',0.13,1.9,dl,0.1); noise(0.1,0.05,900,dl,'bandpass',null,3); }); },
    buy:function(){ [1046,1318,1568,2093].forEach(function(f,i){ tone(f,0.45,'triangle',0.06,1,i*0.07,0.45); tone(f*2,0.2,'sine',0.015,1,i*0.07,0.3); }); },
    horn:function(){ brass(196,0.45,0.09,0); brass(294,0.7,0.09,0.32); brass(392,0.9,0.06,0.32); },
    boss:function(){ brass(73,1.1,0.12,0); brass(110,1.1,0.08,0); drum(70,0.6,0.3,0); drum(70,0.6,0.3,0.45); brass(104,1.2,0.1,0.45); },
    bad:function(){ tone(160,0.3,'sawtooth',0.07,0.5,0,0.2); noise(0.18,0.14,700,0,'bandpass',300,1.5); tone(70,0.3,'sine',0.2,0.6); },
    pay:function(){ tone(1200,0.05,'square',0.025,1,0,0.1); },
    hit:function(){ tone(140,0.22,'sine',0.26,0.4,0,0.2); noise(0.12,0.22,2600,0,'lowpass',500); metal(880,0.22,0.05); },
    swing:function(){ noise(0.2,0.16,700,0,'bandpass',3600,1.4,0.15); },
    glug:function(n){ for (var k=0;k<2+n*2;k++) tone(300+k*55+Math.random()*50, 0.1, 'sine', 0.1, 1.55, k*0.08, 0.12); noise(0.2+0.1*n, 0.05, 1200, 0, 'bandpass', 600, 2); },
    cork:function(){ tone(260,0.06,'square',0.08,2.6,0,0.1); noise(0.04,0.12,3000,0,'highpass'); [1568,1976,2349,3136].forEach(function(f,i){ tone(f,0.5,'sine',0.05,1,0.07+i*0.06,0.6); }); },
    nope:function(){ tone(180,0.12,'triangle',0.1,0.75,0,0.1); tone(140,0.12,'triangle',0.08,0.75,0.07,0.1); },
    win:function(){ brass(262,0.35,0.08,0); brass(330,0.35,0.08,0.15); brass(392,0.35,0.08,0.3); brass(523,1.0,0.1,0.45); brass(659,1.0,0.06,0.45); drum(90,0.5,0.25,0.45); [2093,2637,3136].forEach(function(f,i){ tone(f,0.6,'sine',0.03,1,0.5+i*0.08,0.6); }); },
    pop:function(){ tone(620,0.08,'sine',0.12,1.7,0,0.1); },
    pour:function(){ noise(0.25,0.1,1800,0,'bandpass',900,2); },
    sizzle:function(){ noise(0.7,0.2,400,0,'bandpass',2200,1.2,0.35); noise(0.5,0.08,5000,0.1,'highpass'); },
    door:function(){ noise(0.7,0.2,180,0,'lowpass',600,1,0.4); tone(60,0.6,'sine',0.15,0.8,0.1,0.4); drum(55,0.4,0.2,0.62); },
    tap:function(){ ctx(); var d=ac.createMediaStreamDestination(); master.connect(d); return d.stream; },
    mode:function(m){ m= m==='b'? 'b' : 'n'; if (m!==mode){ mode=m; stepI=0; bgm(); } },
    mute:function(m){ muted=m; S.bgm&&S.bgm(); },
    pmute:function(m){ pmuted=m; plog('platformMute',m); S.bgm&&S.bgm(); },
    toggle:function(){ off=!off; try{localStorage.setItem('dj_snd',off?'0':'1');}catch(e){} bgm(); return !off; },
    bgm:bgm,
    hoof:function(v){ v=v||1; tone(95, 0.09, 'sine', 0.22*v, 0.5, 0, 0.15); noise(0.05, 0.16*v, 1800, 0, 'bandpass', 600, 1.2, 0.12); noise(0.025, 0.07*v, 4200, 0.004, 'highpass', null, null, 0.1); },
    rumble:function(){ drum(48, 1.4, 0.32, 0); noise(1.2, 0.08, 220, 0, 'lowpass', 90, null, 0.4); },
    live:function(){ return !!(ac && ac.state==='running'); },
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
// ---------------- painted art (art/*.png, shrunk to img/*.webp by the build). The code-drawn versions stay as the fallback ----------------
var ART_META=/*ART_META*/null, ART={};
// loads every picture; done() fires once all have arrived (or failed), or after `wait` ms on a slow line - whichever is first
function artLoad(prog, done, wait){ var names=ART_META? Object.keys(ART_META) : [], left=names.length, fired=false;
  function fin(){ if (!fired){ fired=true; done(); } }
  function one(){ left--; if (prog) prog(1-left/Math.max(1,names.length)); if (left<=0) fin(); }
  if (!left){ fin(); return; } setTimeout(fin, wait||12000);
  names.forEach(function(n){ var im=new Image(); im.onload=function(){ ART[n]=im; bgCache=null; stageCache=null; one(); }; im.onerror=one; im.src='img/'+n+'.webp'; }); }
function artOk(n){ return !!ART[n]; }
// bat wings: the painting is cut (soft seam) into left wing / body / right wing once, then each wing swings about its shoulder
var BATP=null;
function batParts(){ if (BATP!==null) return BATP; BATP=false; var im=ART.bat; if (!im) return false;
  try{ var W=im.naturalWidth, H=im.naturalHeight, k=W/512, src=document.createElement('canvas'); src.width=W; src.height=H; var sc=src.getContext('2d'); sc.drawImage(im,0,0); var d=sc.getImageData(0,0,W,H);
    var parts=[0,1,2].map(function(){ var cv2=document.createElement('canvas'); cv2.width=W; cv2.height=H; return cv2; }), ds=parts.map(function(cv2){ return cv2.getContext('2d').createImageData(W,H); });
    function rp(v,a,b){ return Math.max(0,Math.min(1,(v-a)/(b-a))); }
    for (var y=0;y<H;y++) for (var x=0;x<W;x++){ var X=x/k, Y=y/k, l=1-rp(X,166,182), r=rp(X,296,312); if (Y<258 && X>146) l=0; if (Y<238 && X<318) r=0;
      var i=(y*W+x)*4, al=d.data[i+3], m=[l,1-l-r,r]; for (var j=0;j<3;j++){ var o=ds[j].data; o[i]=d.data[i]; o[i+1]=d.data[i+1]; o[i+2]=d.data[i+2]; o[i+3]=al*m[j]; } }
    parts.forEach(function(cv2,j){ cv2.getContext('2d').putImageData(ds[j],0,0); }); BATP={L:parts[0], B:parts[1], R:parts[2], k:k}; }catch(e){ BATP=false; }
  return BATP; }
// knight on horseback: the four horse legs (below the caparison) are cut out of each knight picture so they can gallop
var RIDEP={}, LEGX=[[176,325],[325,500],[500,690],[690,890]], LEGY=878;
function riderParts(n){ if (RIDEP[n]!==undefined) return RIDEP[n]; RIDEP[n]=false; var im=ART[n]; if (!im) return false;
  try{ var W=im.naturalWidth, H=im.naturalHeight, k=W/1024, src=document.createElement('canvas'); src.width=W; src.height=H; var sc=src.getContext('2d'); sc.drawImage(im,0,0); var d=sc.getImageData(0,0,W,H);
    var cvs=[0,1,2,3,4].map(function(){ var c2=document.createElement('canvas'); c2.width=W; c2.height=H; return c2; }), ds=cvs.map(function(c2){ return c2.getContext('2d').createImageData(W,H); });
    for (var y=0;y<H;y++){ var Y=y/k, w=Math.max(0,Math.min(1,(Y-(LEGY-12))/24)); for (var x=0;x<W;x++){ var X=x/k, i=(y*W+x)*4, al=d.data[i+3]; if (!al) continue; var j=-1;
      if (w>0) for (var q=0;q<4;q++) if (X>=LEGX[q][0] && X<LEGX[q][1]){ j=q; break; }
      var ws= j<0? [1,0,0,0,0] : [1-w,0,0,0,0]; if (j>=0) ws[j+1]=w;
      for (var m2=0;m2<5;m2++) if (ws[m2]>0){ var o=ds[m2].data; o[i]=d.data[i]; o[i+1]=d.data[i+1]; o[i+2]=d.data[i+2]; o[i+3]=al*ws[m2]; } } }
    cvs.forEach(function(c2,j){ c2.getContext('2d').putImageData(ds[j],0,0); }); RIDEP[n]={body:cvs[0], legs:cvs.slice(1), k:k}; }catch(e){ }
  return RIDEP[n]; }
// gallop phase per leg (rear pair, then front pair, slightly staggered)
var LEGPH=[0.4, 0.3, 0.1, 0];   // hind-left, hind-right, fore-left, fore-right: a transverse gallop, the hooves land one after another
function drawRider(c, n, base, hgt, ph, amp){ var P=riderParts(n); if (!P) return false; var m=ART_META[base]||ART_META[n], bb=m.bb, s=hgt/(bb[3]-bb[1]), cxm=(bb[0]+bb[2])/2, k=P.k, sc2=m.w/(1024*k);
  c.save(); c.translate(-cxm*s, -bb[3]*s); c.scale(sc2*s, sc2*s);
  P.legs.forEach(function(lg,j){ var u=((ph/(Math.PI*2)-LEGPH[j])%1+1)%1, ang, lift=0, A=0.62;
    if (u<0.5) ang=-A+2*A*(u/0.5);                                  // hoof on the ground: sweeps from reaching forward to pushing back
    else { var v=(u-0.5)/0.5, e2=v<0.5? 2*v*v : 1-Math.pow(-2*v+2,2)/2; ang=A-2*A*e2; lift=Math.sin(v*Math.PI); }   // in the air: folded and whipped forward
    var px=(LEGX[j][0]+LEGX[j][1])/2*k, py=(LEGY-30)*k;
    c.save(); c.translate(px,py-lift*30*k*amp); c.rotate(ang*amp); c.scale(1,1-0.32*lift*amp); c.translate(-px,-py); c.drawImage(lg,0,0); c.restore(); });
  c.drawImage(P.body,0,0); c.restore(); return true; }
function drawBatFlap(c, t, hgt){ var P=batParts(); if (!P) return false; var m=ART_META.bat, bb=m.bb, s=hgt/(bb[3]-bb[1]), cxm=(bb[0]+bb[2])/2, k=P.k, sc2=m.w/(512*k);
  var ph=t*2.3*Math.PI*2; ph+=0.45*Math.sin(ph); var th=Math.sin(ph)*0.42, sx=1-0.2*(1-Math.cos(ph))/2, bob=-Math.sin(ph-0.6)*9*k;
  c.save(); c.translate(-cxm*s, -bb[3]*s); c.scale(sc2*s, sc2*s); c.translate(0,bob);
  [[P.L,176,272,-th],[P.R,302,240,th]].forEach(function(w){ c.save(); c.translate(w[1]*k,w[2]*k); c.rotate(w[3]); c.scale(sx,1); c.translate(-w[1]*k,-w[2]*k); c.drawImage(w[0],0,0); c.restore(); });
  c.drawImage(P.B,0,0); c.restore(); return true; }
// draw picture n with its feet at 0,0; hgt is the height of base's opaque box (base = the idle pose, so the attack pose lines up)
function drawChar(c, n, base, hgt){ var im=ART[n], m=ART_META[base]||ART_META[n], bb=m.bb, s=hgt/(bb[3]-bb[1]), cxm=(bb[0]+bb[2])/2, sc2=m.w/im.naturalWidth;
  c.drawImage(im, -cxm*s, -bb[3]*s, im.naturalWidth*sc2*s, im.naturalHeight*sc2*s); }
// a 1920x1080 scene scaled to cover a w x h box with the scene's floor line (fraction flr of its height) at floorY
// a full-screen scene for the opening/ending: shows at least `span` of the picture's width centred on fraction cx,
// floor line at floorY; on tall screens the sky above is filled with the picture's top colour
function drawSceneFit(c, n, W, H, span, cx, flr, floorY, sky){ var im=ART[n], s= W>H*1.2 ? Math.max(W/1920, H/1080) : W/(span*1920), iw=1920*s, ih=1080*s, ix=Math.min(0, Math.max(W-iw, W/2-cx*iw)), iy=floorY-flr*ih;
  c.fillStyle=sky; c.fillRect(0,0,W,H); c.drawImage(im, ix, iy, iw, ih); if (iy>0){ var gr=c.createLinearGradient(0,iy,0,iy+ih*0.25); gr.addColorStop(0,sky); gr.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=gr; c.fillRect(0,iy,W,ih*0.25); }
  if (iy+ih<H){ c.fillStyle='#120c18'; c.fillRect(0,iy+ih,W,H-iy-ih); } return {x:ix, y:iy, s:s}; }
function drawScene(c, n, x, y, w, h, flr, floorY){ var im=ART[n], s=Math.max(w/1920, (floorY-y)/(flr*1080), (y+h-floorY)/((1-flr)*1080)), iw=1920*s, ih=1080*s, ix=x+(w-iw)/2, iy=floorY-flr*ih; c.drawImage(im, ix, iy, iw, ih); return {x:ix, y:iy, s:s}; }

function ease(t){ t=Math.max(0,Math.min(1,t)); return t<0.5? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function easeOut(t){ t=Math.max(0,Math.min(1,t)); return 1-Math.pow(1-t,3); }
function backOut(t){ t=Math.max(0,Math.min(1,t)); var c=1.9; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

// ---------------- state ----------------
var SAVE={v:5, level:1, coins:0, up:{s:0,a:0,h:0}, gear:{}}, curStage=0, curLane=0, curType='f', RT=null, choosing=false, nextRoom=null, carryHp=null, entryHp=null, walk=0, energy=0, magic=false, revived=false, lastReward=0, UPMAX=10, L=null, B=[], KN=[], V=[], sel=-1, hist=[], undoLeft=5, extra=0, anims=[], won=false, winT=0, moved=0, hintMv=null, hintUntil=0, parts=[], bw=40, bh=124, uh=24, stuckShown=false, lastAdT=performance.now(), F=null, VS=null, lost=false, laters=[], floats=[], orbs=[], STG={top:58,h:150,x:10,w:300,sd:false};
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
  drawMap($('mini'), false); updHud(); layout(); syncAll();
  Snd.mode(L.king? 'b' : 'n');
  $('winM').classList.remove('show'); $('loseM').classList.remove('show');
  var seen=function(k){ if (SAVE[k]) return false; SAVE[k]=1; saveNow(); return true; };
  if (curStage===0 && L.kind!=='n') banner(tl(L.kind==='big'?'bigF':'bossF'), '', 2400);
  else if (L.king) banner((L.role==='big'?'🐉 ':'👹 ')+tl('m_'+VS.kind), '', 2400);
  else if (n===1 && curStage===2 && seen('pT')) banner(tl('pwTip'), '', 6000);
  else if (n>=2 && seen('k1')) banner(tl('sk1'), '', 5200);
  else if (n>=4 && seen('k2')) banner(tl('sk2'), '', 5200);
  else if (L.tut) {}
  else if (L.role!=='min' && seen('pH')) banner(tl('sp_heavy'), '', 6000);
  else if (specOf(VS.kind)==='lock' && seen('pL')) banner(tl('sp_lock'), '', 5000);
  else if (specOf(VS.kind)==='regen' && n>1 && seen('pR')) banner(tl('sp_regen'), '', 4500);
  else if (L.colors>=5 && seen('sS')) banner(tl('r_stun'), '', 3600);
  else if (L.colors>=6 && seen('sP')) banner(tl('r_psn'), '', 3600);
  else if (L.hidden && seen('sM')) banner(tl('mystery'), '', 3000);
  setTut(L.tut? tl(curStage? 'tutB2' : 'tutA2') : '');
}
function dispOf(i){ return B[i].map(function(c,k){ return {c:c, a:1, k:KN[i][k]}; }); }
function syncAll(){ V.forEach(function(v,i){ if (!v.busy) v.disp=dispOf(i); }); }
function knownRun(i){ var b=B[i], n=0; for (var k=b.length-1;k>=0 && b[k]===b[b.length-1] && KN[i][k];k--) n++; return n; }
function pourCount(i,j){ if (!DJ.canPour(B,i,j) || (V[i]&&V[i].lock>0) || (V[j]&&V[j].lock>0)) return 0; return Math.min(knownRun(i), CAP-B[j].length); }

// ---------------- layout ----------------
// Two arrangements: stacked (fight on top, bottles below: phones and tall windows) and side by side (fight on the left,
// bottles on the right: wide windows), so neither half is left tiny with empty space around it.
var BA={x0:10, x1:300, top:300, bot:92, cx:155};
// on big windows the buttons, chips and the minimap grow with the window instead of staying phone-sized
function uiScale(){ return VW<=600 ? 1 : Math.max(1, Math.min(2.2, VW<VH ? Math.min(VW/430, VH/860) : Math.min(VW/960, VH/540))); }
function layout(){
  var n=B.length, small=VW<=600, wide= VW>=700 && VW>=VH*1.45, poki=PF.kind==='poki', u=uiScale(), top0= poki? (small?140:112*u) : (small?96:58*u), side=false; STG.u=u; STG.sd=false;
  document.documentElement.style.setProperty('--u', u); drawMap($('mini'), false);
  var cb=$('coinBox'), lv=$('lvl'), mn=$('mini'), skE=$('skills'), bn=$('banner'), mnW=parseFloat(mn.style.width)||0, mnH=parseFloat(mn.style.height)||0, skRow=false;
  if (wide){
    // fight on top, bottles below (what players of this genre expect), with the chips and the minimap moved beside the
    // fight panel and the skill bar sharing the bottom row with the buttons, so the height goes to the two things that matter
    var topW= poki? 112*u : 8, availV=VH-topW-92*u-10*u, colW=Math.max(mnW+18, 186*u);
    STG.top=topW; STG.h=Math.round(Math.max(118, availV*0.47)); STG.w=Math.round(Math.max(260, Math.min(STG.h*3.3, VW-2*colW-12))); STG.x=Math.round((VW-STG.w)/2);
    BA={x0:10, x1:VW-10, top:STG.top+STG.h+10*u, bot:92*u};
    lv.style.left='10px'; lv.style.top=Math.round(10+44*u)+'px'; lv.style.transform='scale('+u+')'; lv.style.transformOrigin='0 0';
    cb.style.left='auto'; cb.style.right='10px'; cb.style.top='10px';
    mn.style.right='auto'; mn.style.left=Math.round(STG.x+STG.w+8)+'px'; mn.style.top=Math.round(STG.top)+'px';
    if (mnW+16 > colW-70*u || true){ cb.style.top=Math.round(Math.min(VH*0.5, STG.top+mnH+12))+'px'; cb.style.right='auto'; cb.style.left=Math.round(STG.x+STG.w+8)+'px'; cb.style.transformOrigin='0 0'; }
    skRow= (300*u+24*u+284*u) <= VW-20;
  } else {
    lv.style.left=''; lv.style.top=''; lv.style.transform=''; lv.style.transformOrigin=''; cb.style.transformOrigin='';
    if (small){ cb.style.right='auto'; cb.style.left=(lv.offsetWidth+18)+'px'; cb.style.top=(poki? 98 : 52)+'px'; } else { cb.style.left='auto'; cb.style.right=Math.round(mnW+16+8*u)+'px'; cb.style.top='10px'; }
    STG.top=top0; STG.h=Math.round(Math.max(118, Math.min(Math.max(300, VW/2.6), VH*(VW>VH?0.3:0.255)))); STG.w=Math.min(VW-12, STG.h*3.4); STG.x=(VW-STG.w)/2;
    if (mnW && STG.x+STG.w > VW-mnW-16) STG.top=Math.max(STG.top, 8+mnH+12);
    BA={x0:10, x1:VW-10, top:STG.top+STG.h+50*u, bot:92*u};
    mn.style.left='auto'; mn.style.right='8px'; mn.style.top='8px';
  }
  BA.cx=(BA.x0+BA.x1)/2; var cxp=Math.round(BA.cx)+'px', rowW=608*u;
  if (skRow){ skE.style.left=Math.round(VW/2-rowW/2+150*u)+'px'; skE.style.top=Math.round(VH-(14+31+21)*u)+'px'; skE.style.width='300px'; $('btns').style.left=Math.round(VW/2+rowW/2-142*u)+'px'; }
  else { skE.style.left=Math.round(STG.x+STG.w/2)+'px'; skE.style.top=Math.round(STG.top+STG.h+5*u)+'px'; skE.style.width=Math.round(Math.min((STG.w-8)/u, 420))+'px'; $('btns').style.left=cxp; if (wide) BA.top+=44*u; }
  bn.style.left=cxp; bn.style.top=Math.round(wide? BA.top+40*u : STG.top+STG.h+76*u)+'px'; bn.style.maxWidth=Math.round(BA.x1-BA.x0-8)+'px'; bn.style.fontSize= u>1? Math.round(22*u)+'px' : '';
  // the tutorial line sits in its own strip right under the fight panel; on tutorial rooms the bottles move down to make room for it
  var tutTop=STG.top+STG.h+6*u; if (L && L.tut) BA.top=Math.max(BA.top, tutTop+(small? 58 : 38)*u);
  $('tut').style.left=Math.round(small? STG.x+STG.w/2 : VW/2)+'px'; $('tut').style.maxWidth=Math.round((small? STG.w-8 : VW-24)/u)+'px'; $('tut').style.top=Math.round(tutTop)+'px'; $('btns').style.bottom=Math.round(14*u)+'px';
  var top=BA.top+(side?4:0), bot=BA.bot, availH=VH-top-bot, availW=BA.x1-BA.x0, best=0, bestRows=1;
  var pdS=Math.round(Math.max(140, Math.min(204, (availH-4)/u))), pdE=$('dpad'); pdE.style.width=pdE.style.height=pdS+'px'; pdE.style.left=cxp; pdE.style.top=Math.round(Math.max(top, (top+VH-bot)/2-pdS*u/2))+'px';
  bgCache=null; if (!n) return;
  for (var rows=1; rows<=4; rows++){ var per=Math.ceil(n/rows), w=Math.min(availW/(per*1.8), availH/(rows*(3.15+1.55)));
    if (w>best+0.5){ best=w; bestRows=rows; } }
  bw=Math.max(18, Math.min(small? 62 : 78*u, best)); bh=bw*3.15; uh=bh*0.91/CAP;
  var per2=Math.ceil(n/bestRows), cellH=bh+bw*1.55, totalH=bestRows*cellH, y0=top+Math.max(0,(availH-totalH)/2)+bw*1.55;
  for (var i=0;i<n;i++){ var r=Math.floor(i/per2), inRow=(r===bestRows-1)? n-per2*(bestRows-1) : per2, k=i-r*per2;
    V[i].x=BA.cx+(k-(inRow-1)/2)*bw*1.8; V[i].y=y0+r*cellH+bh; V[i].row=r; }
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
  hist.push({i:i,j:j,n:n,rev:revealed}); moved++; V.forEach(function(w){ if (w.lock>0){ w.lock--; if (!w.lock){ w.unlk=0.5; Snd.clank(); } } });
  var dir = dj.x>si.x+1 ? 1 : (dj.x<si.x-1 ? -1 : (dj.x>BA.cx ? -1 : 1));
  if (dj.x-bh*1.05<BA.x0-6) dir=-1; else if (dj.x+bh*1.05>BA.x1+6) dir=1;
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
  energy=Math.min(100, energy+(drank? 8 : 2)); updSkills();
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
var heroRun=false, doorHits=[], walkGate=null, padKey='x', OL='#221528', FNT='"Trebuchet MS","Arial Rounded MT Bold",system-ui,sans-serif', HA=0.46, MA=0.5, cdSeq=0, shk=0, hitStop=0, hurtFlash=0, fx=[], stageCache=null, stageKey='', torches=[];
var THEMES=[{w0:'#5a4582',w1:'#2b1e3e',fl:'#7d6c93',fd:'#4a3c5c',gl:'255,170,80'},{w0:'#3a6a5d',w1:'#1a2e2b',fl:'#73917f',fd:'#42594e',gl:'200,255,120'},{w0:'#3f6298',w1:'#1b2a48',fl:'#829cc2',fd:'#4c6288',gl:'130,225,255'},{w0:'#84403a',w1:'#3a1a1c',fl:'#a3725f',fd:'#643e36',gl:'255,130,60'}];
var MCOL={slime:['#6fd16a','#5ab8f0','#f0914a','#b684f5'], gob:['#86d95a','#55c9a8','#d9b04a','#c77ae0'], skel:['#f1ecdc','#cfe6ee','#ecdcae','#e6cdea'], bat:['#8a55c4','#4a7cc4','#c4556a','#4f9a78'], orc:['#5f9447','#4a8f8a','#a8823c','#8a5aa8'], ogre:['#6a9a4a','#4a86a8','#b8683c','#8a4ab0'], dragon:['#d0483a','#3a9a6a','#4a78d0','#8a4ac8']};
var MD={slime:{h:58,w:68,s:1}, gob:{h:76,w:50,s:1}, skel:{h:84,w:52,s:1}, bat:{h:80,w:74,s:1}, orc:{h:104,w:60,s:0.96}, ogre:{h:118,w:76,s:1.04}, dragon:{h:108,w:96,s:1.12}};
var MIMG={slime:'slime',gob:'goblin',skel:'skeleton',bat:'bat',orc:'orc',ogre:'ogre',dragon:'dragon'}, MHI={slime:{h:74,w:76},gob:{h:84,w:74},skel:{h:90,w:84},bat:{h:62,w:104},orc:{h:104,w:98},ogre:{h:124,w:118},dragon:{h:112,w:116}};
function mdOf(kd){ return artOk(MIMG[kd])? {h:MHI[kd].h, w:MHI[kd].w, s:MD[kd].s} : MD[kd]; }
function monsterKind(l){ return l.role==='big' ? 'dragon' : (l.role==='boss' ? 'ogre' : ['slime','gob','skel','bat','orc'][((l.level-1)*2+l.stage+(l.lane||0)*2)%5]); }
function specOf(kind){ if (L && L.level<2) return null; return kind==='slime'? 'regen' : ((kind==='gob'||kind==='bat'||kind==='skel')? 'lock' : null); }
function tierOf(n){ return Math.floor((n-1)/6)%4; }
function stg(){ var k=STG.h/200, w=STG.w, x=STG.x, sp=Math.min(w*0.25, STG.h*1.05); return {x:x, w:w, k:k, hx:x+w/2-sp, mx:x+w/2+sp, gy:STG.top+STG.h-24*k}; }
function mCY(g){ var d=mdOf(VS.kind); return g.gy-(VS.kind==='bat'? (artOk('bat')? 62 : 52) : d.h*0.5)*d.s*g.k; }
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
  orbs.push({x0:bv.x, y0:bv.y-bh-bw*0.3, x1:g.hx+12*k, y1:g.gy-104*k, t:0, d:0.36, c:c});
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
  var spc= (ev.blocked||ev.hit) ? specOf(VS.kind) : null;
  if (spc==='regen' && F.mHp>0){ var rg=Math.min(F.mMax-F.mHp, Math.round(F.mMax*0.06)); if (rg>0){ F.mHp+=rg; var mA2=F.mHp; later(delay+0.1+MA, function(){ VS.mHp=mA2; floatTx(g.mx, mCY(g)-36*k, '+'+rg, '#8df07a', false, 'heal'); Snd.squish(); }); } }
  if (spc==='lock') later(delay+0.1+MA*0.42, function(){ var cand=[]; B.forEach(function(b,bi){ if (b.length && !DJ.done(b) && !(V[bi].lock>0) && !V[bi].busy && bi!==sel) cand.push(bi); });
    if (!cand.length) return; var bi=cand[Math.floor(Math.random()*cand.length)]; V[bi].lock=3; V[bi].lkIn=0.5; Snd.clank(); Snd.door(); });
  if (ev.heavy) later(delay+0.1+MA*0.42, function(){ floatTx(g.hx, g.gy-104*k, tl('heavyHit'), '#ff9a3c', true); shk=Math.max(shk,1.4); hitStop=0.14; });
  if (ev.blocked||ev.hit){ later(delay+0.1, function(){ VS.mAtk=MA; Snd.swing(); if (ev.heavy) Snd.boss(); if (VS.kind==='dragon'){ Snd.sizzle(); var d=MD.dragon, x0=g.mx-(artOk('dragon')? 44 : 56)*d.s*k, y0=g.gy-(artOk('dragon')? 48 : 84)*d.s*k, tt=MA*0.42;
      for (var q=0;q<34;q++){ var dl=Math.random()*0.12; parts.push({x:x0,y:y0,vx:(g.hx+20*k-x0)/tt*(0.8+Math.random()*0.3),vy:(g.gy-40*k-y0)/tt+(Math.random()-0.5)*120,t:tt+dl,c:['#ffe14a','#ff9a3c','#f04848'][q%3],r:4+Math.random()*6,g:0}); } } });
    later(delay+0.1+MA*0.42, function(){ var hy=g.gy-44*k;
      if (ev.blocked){ VS.shield=Math.max(0,VS.shield-1); VS.shPop=0.45; VS.shBreak=0.45; floatTx(g.hx, g.gy-70*k, tl('blocked'), '#9cc8ff', true); Snd.clank(); Snd.hit(); shk=Math.max(shk,0.3);
        for (var i=0;i<12;i++) parts.push({x:g.hx+30*k,y:hy,vx:(Math.random()-0.6)*300,vy:-60-Math.random()*200,t:0.45,c:i%2?'#cfe4ff':'#fff',r:2+Math.random()*2.5,g:600}); }
      else { VS.hHp=Math.max(0,hpAfter); VS.hHurt=0.4; floatTx(g.hx, g.gy-70*k, '-'+ev.hit, '#ff6a5a', true); Snd.bad(); Snd.thud(); hurtFlash=1; shk=Math.max(shk,1); hitStop=0.08;
        fx.push({ty:'slash', x:g.hx+6*k, y:hy, t:0, d:0.24, c:'#ff8a7a', r:44*k, flip:1});
        for (var j=0;j<10;j++) parts.push({x:g.hx,y:hy,vx:(Math.random()-0.8)*300,vy:-60-Math.random()*220,t:0.5,c:j%2?'#ff9a8a':'#fff',r:2+Math.random()*2.5,g:700}); } }); }
}
// ----- characters: drawn at 1 unit = 1px around their feet, facing each other -----
// The hero: a dark knight on an armoured war horse, drawn lean and tall rather than cute. Nothing of him shows but two red
// lights in the black T-shaped opening of his helm. Helmet, armour, gauntlets, greaves and boots follow the equipped gear.
function heroArt(c, t){
  var tier=Math.max(0, SAVE.gear.top|0), n='knight-'+tier; if (!artOk(n)) return heroArtCode(c,t);
  var a=VS&&VS.hAtk>0? 1-VS.hAtk/HA : -1, atk=a>=0.12 && a<0.85 && artOk(n+'-attack'), br=Math.sin(t*3.2), run=heroRun, down=VS&&VS.hDead>0;
  c.save();
  var amp= run===true? 1 : (+run||0), gph=t*Math.PI*2*2.6;
  if (run){ c.translate(0, -Math.abs(Math.sin(gph/2+0.4))*4*amp); c.translate(0,-30); c.rotate((0.05+Math.sin(gph)*0.02)*amp); c.translate(0,30); }
  else c.rotate(atk? -0.04 : (VS&&VS.hDrink>0? -0.06 : 0));
  if (!run && !atk) c.scale(1+br*0.006, 1-br*0.012);
  if (!(run && !atk && drawRider(c, n, n, 130, gph, amp))) drawChar(c, atk? n+'-attack' : n, n, 130);
  if (!down && !atk){ var gl=0.6+Math.sin(t*3.1)*0.25; c.globalCompositeOperation='lighter'; var rg=c.createRadialGradient(15,-102,0,15,-102,8); rg.addColorStop(0,'rgba(255,60,40,'+gl*0.35+')'); rg.addColorStop(1,'rgba(255,40,40,0)'); c.fillStyle=rg; c.fillRect(5,-112,20,20); c.globalCompositeOperation='source-over'; }
  c.restore();
}
function heroArtCode(c, t){
  var a=VS.hAtk>0? 1-VS.hAtk/HA : -1, drink=VS.hDrink>0, cheer=won && VS.mDead>0.3 && !choosing && !VS.empty, down=VS.hDead>0, hurt=VS.hHurt>0, fierce=a>=0;
  var br=Math.sin(t*3.2), sway=Math.sin(t*2.1)*3+(a>=0||heroRun? 9 : 0), blink=(t%3.7)<0.1;
  var sw= a>=0? 0.6-swingA(a)*0.72 : (cheer? -0.4+Math.sin(t*9)*0.1 : 0.6+br*0.03);
  var lean= a>=0? (a<0.25? -0.12 : (a<0.6? 0.2 : 0.2*(1-(a-0.6)/0.4))) : (drink? -0.08 : 0);
  var G=SAVE.gear, pick=function(r,arr,def){ return r>=0? arr[r] : def; };
  var arC=pick(G.top,['#c3ccdb','#4fae7a','#4f8fe8','#8a5ae0'],'#66728a'), hmC=pick(G.hat,['#c3ccdb','#55b884','#5a9cf0','#9a6ae8'],'#7a869e'), lgC=pick(G.pnt,['#aab2c4','#3f9a68','#4678d0','#7a4ac8'],'#566078'), btC=pick(G.sho,['#c9c9d4','#3fb87a','#5a9cff','#b97aff'],'#3a3f52'), gvC=pick(G.glv,['#c9c9d4','#3fb87a','#5a9cff','#b97aff'],'#8f9bb0');
  var swC=['#e6edf5','#ffe9a0','#a8f2ff','#ffb09a'][Math.min(3,Math.floor(SAVE.up.s/3))], trim= G.hat>=0? RAR[G.hat] : '#4a5468';
  var gal=heroRun? Math.sin(t*20) : 0, hb=heroRun? -Math.abs(Math.sin(t*20))*3 : br*0.6, HC='#34303f', HD='#221f2c', MN='#8a1f2a', cloth= G.top>=1? shade(arC,-0.3) : '#7a1622';
  var redEye=function(x,y,r,slit){ var gl=(fierce? 1.3 : 0.85+Math.sin(t*3.1)*0.13)*(hurt? 0.45+Math.sin(t*40)*0.25 : 1), rg=c.createRadialGradient(x,y,0.4,x,y,r*2.6*gl); rg.addColorStop(0,'rgba(255,60,50,'+Math.min(1,0.9*gl)+')'); rg.addColorStop(1,'rgba(255,40,40,0)'); c.fillStyle=rg; c.fillRect(x-r*3,y-r*3,r*6,r*6);
    c.fillStyle='#ff4638'; c.strokeStyle='#ff4638'; c.lineWidth=1.6;
    if (cheer && !slit){ c.beginPath(); c.arc(x,y+r*0.6,r,Math.PI*1.1,Math.PI*1.9); c.stroke(); }
    else if (blink || drink){ c.fillRect(x-r,y-0.5,r*2,1.1); }
    else { el(c,x,y,r*(fierce?1.25:1),r*(slit?0.5:(fierce?0.55:0.72))); c.fill(); c.fillStyle='#ffd9cc'; el(c,x+r*0.2,y-r*0.1,r*0.34,r*0.24); c.fill(); } };
  // ----- the war horse -----
  c.save(); c.translate(0,hb);
  c.beginPath(); c.moveTo(-27,-56); c.quadraticCurveTo(-50-sway,-56,-52-sway*1.4,-26); c.quadraticCurveTo(-50-sway*1.2,-12,-42-sway,-6); c.quadraticCurveTo(-44-sway*0.6,-30,-29,-44); c.closePath(); fs(c,MN);
  var leg=function(x,ph,col){ c.save(); c.translate(x,-41-hb); c.rotate(gal*ph); poly(c,[-5.2,-5,5.2,-5,3.2,36,-3.2,36]); fs(c,col); rr(c,-4.4,15,8.8,5.5,2); fs(c,'#8f9bb0',2); rr(c,-4.8,34.5,10.5,6.5,2); fs(c,'#12101a',2.2); c.restore(); };
  leg(-17,-0.45,HD); leg(21,0.45,HD);
  rr(c,-24,-61,46,25,12); fs(c,HC); el(c,-18,-47,14.5,13.5); fs(c,HC); el(c,19,-49,13.5,14.5); fs(c,HC); c.fillStyle=HC; rr(c,-20,-58,38,19,9); c.fill();
  c.fillStyle='rgba(255,255,255,0.1)'; el(c,-14,-55,10,4); c.fill();
  leg(-26,0.45,HC); leg(12,-0.45,HC);
  c.beginPath(); c.moveTo(-18,-62); c.lineTo(15,-62); c.lineTo(19,-37); c.lineTo(13,-31); c.lineTo(7,-37); c.lineTo(1,-31); c.lineTo(-5,-37); c.lineTo(-11,-31); c.lineTo(-17,-37); c.lineTo(-22,-35); c.closePath(); fs(c,cloth);
  c.strokeStyle='#ffcf3a'; c.lineWidth=2; c.beginPath(); c.moveTo(-19,-56); c.lineTo(16,-56); c.stroke(); poly(c,[-2,-52,2,-47,-2,-42,-6,-47]); fs(c,'#ffcf3a',1.6);
  c.beginPath(); c.moveTo(15,-60); c.quadraticCurveTo(19,-83,33,-91); c.lineTo(45,-80); c.quadraticCurveTo(37,-66,34,-41); c.quadraticCurveTo(24,-39,15,-47); c.closePath(); fs(c,HC);
  c.beginPath(); c.moveTo(14,-57); c.quadraticCurveTo(12,-82,30,-95); c.lineTo(35,-89); c.quadraticCurveTo(27,-81,26,-71); c.lineTo(20,-74); c.lineTo(22,-63); c.lineTo(16,-65); c.closePath(); fs(c,MN,2.4);
  poly(c,[30,-93,40,-91,59,-69,58,-60,50,-57,40,-68,33,-76]); fs(c,HC); poly(c,[30,-92,30,-105,37,-93]); fs(c,HC,2.4);
  poly(c,[32,-93,40,-92,58,-70,54,-66,37,-82]); fs(c,shade(hmC,-0.08),2.4); poly(c,[39,-89,46,-100,45,-85]); fs(c,'#f3ead8',2);
  redEye(42,-79.5,2.4,true); c.fillStyle='#12101a'; el(c,55.5,-63,1.2,1.6); c.fill();
  c.strokeStyle='#12101a'; c.lineWidth=2; c.beginPath(); c.moveTo(52,-61); c.quadraticCurveTo(34,-58,18,-71); c.stroke();
  c.restore();
  // ----- the rider -----
  c.save(); c.translate(0,hb-62); c.rotate(lean); c.translate(0,62+br*0.4);
  c.beginPath(); c.moveTo(-7,-92); c.quadraticCurveTo(-30-sway,-88,-42-sway*1.6,-58); c.lineTo(-34-sway*1.3,-61); c.lineTo(-35-sway*1.2,-49); c.lineTo(-27-sway*0.9,-56); c.lineTo(-25-sway*0.6,-45); c.quadraticCurveTo(-15,-58,-8,-66); c.closePath(); fs(c,'#7a1622');
  poly(c,[-20,-89,-5,-89,-5,-74,-12.5,-61,-20,-74]); fs(c,shade(arC,-0.3)); c.fillStyle='#ffcf3a'; el(c,-12.5,-79,2.6); c.fill();
  poly(c,[-5,-67,7,-67,13,-50,3,-47]); fs(c,lgC); poly(c,[3,-50,13,-51,10,-33,2,-33]); fs(c,lgC); el(c,8.5,-50,5.2,4.6); fs(c,shade(lgC,0.18),2.2);
  poly(c,[0,-34.5,10,-34.5,18,-28.5,0,-27.5]); fs(c,btC,2.4);
  poly(c,[-8,-64,9,-64,12,-78,11,-92,-10,-92,-11,-78]); fs(c,arC);
  c.fillStyle='rgba(255,255,255,0.28)'; poly(c,[-8,-90,-2,-90,-3,-78,-9,-78]); c.fill(); c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1.6; c.beginPath(); c.moveTo(1,-91); c.lineTo(1,-68); c.moveTo(-10,-80); c.quadraticCurveTo(1,-75,12,-80); c.stroke();
  if (G.top>=1){ c.strokeStyle='#ffd84a'; c.lineWidth=1.8; c.beginPath(); c.moveTo(-9,-88); c.quadraticCurveTo(1,-84,10,-88); c.stroke(); }
  if (G.amu>=0){ poly(c,[1,-86,4,-82.5,1,-79,-2,-82.5]); fs(c,RAR[G.amu],1.6); }
  rr(c,-9.5,-68,20,5,2); fs(c,'#2a2636',2.2); rr(c,-1.5,-68.8,5,6.4,1.6); fs(c,'#ffcf3a',1.6);
  el(c,-10,-91,7,5.5); fs(c,shade(arC,-0.2),2.4); rr(c,-4,-97,10,6,2); fs(c,shade(arC,-0.28),2.2);
  var hr=G.hat;
  if (hr>=2){ [-1,1].forEach(function(sd){ c.save(); c.translate(1.5+sd*8,-110); c.scale(sd,1); c.beginPath(); c.moveTo(0,3); c.quadraticCurveTo(hr>=3?14:10,2,hr>=3?13:9,-(hr>=3?15:10)); c.quadraticCurveTo(hr>=3?6:4,-4,-1,-2); c.closePath(); fs(c,'#f3ead8',2.2); c.restore(); }); }
  if (hr===0 || hr>=2){ c.beginPath(); c.moveTo(1,-116); c.quadraticCurveTo(-13,-131,-24-sway*0.8,-110); c.quadraticCurveTo(-12,-117,-2,-112); c.closePath(); fs(c, hr===3? '#b97aff' : (hr===2? '#5a9cff' : '#d9303a'), 2.4); }
  c.beginPath(); c.moveTo(-7.5,-96); c.lineTo(-8.6,-106); c.quadraticCurveTo(-8,-116.5,1.5,-116.5); c.quadraticCurveTo(11.2,-116.5,11.6,-106); c.lineTo(10.6,-97); c.quadraticCurveTo(2,-92.5,-7.5,-96); c.closePath(); fs(c,hmC);
  c.save(); c.clip(); c.fillStyle='rgba(0,0,0,0.22)'; c.fillRect(-10,-118,5,26); c.fillStyle='rgba(255,255,255,0.38)'; el(c,-1,-112.5,4,1.8,-0.4); c.fill(); c.restore();
  if (hr===1){ c.beginPath(); c.moveTo(-6,-113.5); c.quadraticCurveTo(-5,-121,2,-121.5); c.quadraticCurveTo(10,-121,11,-113); c.quadraticCurveTo(2,-117,-6,-113.5); c.closePath(); fs(c,'#ffd84a',2.2); }
  if (hr===3){ poly(c,[-5,-114.5,-5,-121,-2,-117,1.5,-123,5,-117,8,-121,8,-114.5]); fs(c,'#ffcf3a',2); }
  rr(c,-8.2,-98.6,19,3,1.4); fs(c,trim,1.8);
  c.fillStyle='#0d0812'; c.strokeStyle=OL; c.lineWidth=1.8; rr(c,-4,-109,15,5,1.6); c.fill(); c.stroke(); rr(c,3,-108,4.4,12.6,1.4); c.fill(); c.stroke(); c.fillRect(-3,-108.2,13,3.4);
  redEye(0.4,-106.5,1.9); redEye(8.4,-106.5,1.9);
  if (drink){ c.save(); c.translate(15,-101); c.rotate(-2.0); rr(c,-4,-12,8,13,3); fs(c,COL[VS.dc||0],2.2); rr(c,-2.6,-16,5.2,5,1.5); fs(c,'#e6edf5',2); c.restore(); el(c,13,-95,4.6); fs(c,gvC,2.4); }
  c.lineCap='round'; c.beginPath(); c.moveTo(8,-88); c.lineTo(17,-73); c.lineWidth=9; c.strokeStyle=OL; c.stroke(); c.lineWidth=5.6; c.strokeStyle=shade(arC,-0.12); c.stroke();
  var pdr=G.top>=2? 1.2 : 1; el(c,8.5,-90,8*pdr,6.2*pdr); fs(c,shade(arC,0.12),2.4); c.fillStyle='rgba(255,255,255,0.35)'; el(c,6.5,-92,3.4*pdr,1.8*pdr); c.fill();
  if (G.top>=2){ poly(c,[11,-94,18,-102,15,-91]); fs(c, G.top===3? '#ffcf3a' : '#f3ead8', 2); } if (G.top===3){ poly(c,[5,-95,8,-105,10,-95]); fs(c,'#ffcf3a',2); }
  c.save(); c.translate(17,-72); c.rotate(sw);
  poly(c,[-3.2,-9,3.2,-9,2.6,-54,0,-62,-2.6,-54]); fs(c,swC,2.4); c.fillStyle='rgba(0,0,0,0.18)'; c.fillRect(-0.7,-52,1.6,42);
  rr(c,-10,-11.5,20,4.6,2); fs(c,'#ffcf3a',2.2); rr(c,-2.3,-7.5,4.6,13,2); fs(c,'#3a2416',2); el(c,0,7,3.2); fs(c,'#ffcf3a',2);
  el(c,0,0,5.3); fs(c,gvC,2.4); rr(c,-5,2.5,10,5.5,2.2); fs(c,shade(gvC,-0.2),2); if (G.glv>=2){ poly(c,[-4.5,4.5,-8.5,8.5,-3.5,8.5]); fs(c,'#f3ead8',1.5); } if (G.rng>=0){ el(c,3.2,-2.4,1.9); fs(c,RAR[G.rng],1.3); }
  c.restore(); c.restore();
}
// ----- monsters, drawn in the same lean, dark style as the knight: glowing slit eyes, no big cute eyes -----
// all face left (toward the hero), feet at 0,0; wa is the weapon arm angle, ang = angry/attacking, mood 2 = hurt
function gEye(c,x,y,r,col,mood,slant){
  if (mood===2){ c.strokeStyle=col; c.lineWidth=1.8; c.beginPath(); c.moveTo(x-r,y-r*0.6); c.lineTo(x+r,y+r*0.6); c.moveTo(x+r,y-r*0.6); c.lineTo(x-r,y+r*0.6); c.stroke(); return; }
  var rg=c.createRadialGradient(x,y,0.3,x,y,r*2.8); rg.addColorStop(0,col); rg.addColorStop(1,'rgba(0,0,0,0)'); c.globalAlpha=0.5; c.fillStyle=rg; c.fillRect(x-r*3,y-r*3,r*6,r*6); c.globalAlpha=1;
  c.save(); c.translate(x,y); c.rotate(slant||0); c.fillStyle=col; el(c,0,0,r,r*0.48); c.fill(); c.fillStyle='rgba(255,255,255,0.8)'; el(c,-r*0.25,-r*0.08,r*0.32,r*0.18); c.fill(); c.restore();
}
function limb(c,x1,y1,x2,y2,w,col){ c.lineCap='round'; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineWidth=w+5; c.strokeStyle=OL; c.stroke(); c.lineWidth=w; c.strokeStyle=col; c.stroke(); }
var mArt={
  // a toxic ooze with a swallowed skull inside
  slime:function(c,t,col,wa,ang,mood,a){
    var sq=1+Math.sin(t*4.2)*0.04-(a>=0&&a<0.3? 0.14*Math.sin(a/0.3*Math.PI) : 0), w=33*sq, h=58/sq, dk=shade(col,-0.6), i;
    var body=function(){ c.beginPath(); c.moveTo(-w,0); c.bezierCurveTo(-w*1.12,-h*0.55,-w*0.72,-h*0.95,-w*0.22,-h*0.97); c.quadraticCurveTo(-w*0.05,-h*1.12,w*0.12,-h*0.99); c.bezierCurveTo(w*0.75,-h*0.97,w*1.14,-h*0.55,w,0); c.lineTo(w*0.72,2); c.quadraticCurveTo(w*0.6,10,w*0.48,2); c.lineTo(-w*0.28,2); c.quadraticCurveTo(-w*0.42,12,-w*0.56,2); c.closePath(); };
    body(); var g=c.createLinearGradient(0,-h,0,0); g.addColorStop(0,shade(col,-0.1)); g.addColorStop(1,dk); c.fillStyle=g; c.fill(); c.lineWidth=3; c.strokeStyle=OL; c.stroke();
    c.save(); body(); c.clip(); c.globalAlpha=0.4; c.fillStyle=dk; el(c,10,-h*0.3,9,8); c.fill(); c.fillRect(5,-h*0.3+4,10,5); c.fillStyle=shade(col,0.2); el(c,6.5,-h*0.31,2.2); c.fill(); el(c,13.5,-h*0.31,2.2); c.fill();
    c.strokeStyle=dk; c.lineWidth=3; c.beginPath(); c.moveTo(-22,-9); c.lineTo(-6,-16); c.moveTo(16,-7); c.lineTo(26,-19); c.stroke(); c.globalAlpha=1;
    c.fillStyle='rgba(255,255,255,0.26)'; el(c,-w*0.5,-h*0.7,3.5,9,0.5); c.fill(); for (i=0;i<4;i++){ var ph=(t*0.4+i*0.25)%1; c.fillStyle='rgba(255,255,255,'+(0.3*(1-ph))+')'; el(c,-10+i*8,-h*0.15-ph*h*0.6,1.5+i%2); c.fill(); }
    c.restore();
    var ey=-h*0.66, ec=ang? '#fff36a' : '#d8ff6a'; gEye(c,-16,ey,4.4,ec,mood,0.32); gEye(c,-3,ey-1,4.4,ec,mood,-0.32);
    var mw=ang||a>=0? 1 : 0.6, my=-h*0.42; c.beginPath(); c.moveTo(-23,my); c.quadraticCurveTo(-10,my-3,3,my-1); c.quadraticCurveTo(-10,my+h*0.14*mw,-23,my); c.closePath(); c.fillStyle='#14080f'; c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke();
    c.fillStyle='#f3ead8'; [-19,-13,-7,-2].forEach(function(x){ poly(c,[x,my-1.5,x+2.2,my+3.5*mw+1,x+4.4,my-1.8]); c.fill(); }); },
  // a hunched, hooded goblin with a curved knife
  gob:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3.6)*1); var sk=shade(col,-0.22), sd=shade(col,-0.42), cl='#2e2434', le='#4a3426';
    limb(c,5,-30,9,-14,5,le); limb(c,9,-14,5,-2,5,le); limb(c,-6,-30,-10,-14,5,le); limb(c,-10,-14,-12,-2,5,le);
    poly(c,[-21,1,-8,1,-8,-4,-16,-5]); fs(c,'#1e1612',2.2); poly(c,[-1,1,12,1,10,-4,2,-5]); fs(c,'#1e1612',2.2);
    c.beginPath(); c.moveTo(-8,-62); c.quadraticCurveTo(18,-68,21,-44); c.lineTo(23,-20); c.lineTo(17,-25); c.lineTo(13,-16); c.lineTo(8,-24); c.lineTo(3,-17); c.lineTo(-1,-26); c.lineTo(-6,-30); c.closePath(); fs(c,cl);
    poly(c,[-14,-56,6,-60,9,-30,-12,-28]); fs(c,le); c.fillStyle='#1e1612'; c.fillRect(-13,-36,22,4); c.fillStyle='#8a8090'; c.fillRect(-4,-37,4,6);
    limb(c,-6,-54,-16,-38,4.5,sk);
    c.save(); c.translate(-12,-62);
    poly(c,[6,-5,33,-17,10,4]); fs(c,sk); c.strokeStyle=sd; c.lineWidth=1.5; c.beginPath(); c.moveTo(10,-3); c.lineTo(26,-12); c.stroke();
    c.beginPath(); c.moveTo(-15,2); c.quadraticCurveTo(-17,-12,-2,-14); c.quadraticCurveTo(12,-14,12,-2); c.quadraticCurveTo(10,10,-2,10); c.quadraticCurveTo(-12,10,-15,2); c.closePath(); fs(c,sk);
    c.beginPath(); c.moveTo(-16,-3); c.quadraticCurveTo(-12,-24,4,-21); c.quadraticCurveTo(19,-18,17,7); c.lineTo(10,3); c.quadraticCurveTo(8,-9,-2,-11); c.quadraticCurveTo(-10,-10,-11,-2); c.closePath(); fs(c,cl);
    poly(c,[-12,-3,-24,4,-12,4]); fs(c,sk,2.2);
    gEye(c,-8,-4,3.2,'#ffd84a',mood,0.38); gEye(c,1,-4.5,3.2,'#ffd84a',mood,-0.38);
    c.beginPath(); c.moveTo(-13,5); c.quadraticCurveTo(-3,12,7,4); c.lineWidth=2.2; c.strokeStyle=OL; c.stroke(); c.fillStyle='#f3ead8'; [-10,-5,0].forEach(function(x){ poly(c,[x,6.5,x+2,10,x+4,6.8]); c.fill(); });
    c.restore();
    c.save(); c.translate(-16,-36); c.rotate(wa); c.beginPath(); c.moveTo(-2.5,-6); c.quadraticCurveTo(-9,-20,-2,-32); c.quadraticCurveTo(3,-19,2.5,-6); c.closePath(); fs(c,'#cfd8e6',2.4); rr(c,-6,-8.5,12,3.5,1.5); fs(c,'#5a4a3a',2); rr(c,-2,-5,4,8,1.5); fs(c,'#3a2416',2); el(c,0,0,4.4); fs(c,sk,2.2); c.restore(); },
  // a skeleton man-at-arms: rusty half-helm, notched sword, round shield
  skel:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3.3)*1); var bn=shade(col,-0.1), dk=shade(col,-0.4), rust='#7a5a3a', ir='#6e6878';
    el(c,16,-50,13,14); fs(c,'#5a3a20'); c.lineWidth=3; c.strokeStyle=ir; el(c,16,-50,11,12); c.stroke(); el(c,16,-50,3.4); fs(c,ir,2);
    limb(c,4,-38,7,-19,3.6,bn); limb(c,7,-19,6,-3,3.6,bn); limb(c,-5,-38,-8,-19,3.6,bn); limb(c,-8,-19,-10,-3,3.6,bn);
    poly(c,[-13,-21,-4,-21,-5,-8,-12,-8]); fs(c,rust,2.2); poly(c,[-17,1,-6,1,-7,-4,-14,-4]); fs(c,ir,2); poly(c,[1,1,11,1,10,-4,3,-4]); fs(c,ir,2);
    rr(c,-9,-42,18,7,3); fs(c,bn,2.2); limb(c,0,-42,0,-62,3.4,bn);
    [-60,-55,-50].forEach(function(y){ c.beginPath(); c.moveTo(-1,y); c.quadraticCurveTo(-12,y+1,-9,y+5); c.moveTo(1,y); c.quadraticCurveTo(11,y+1,8,y+5); c.lineWidth=5; c.strokeStyle=OL; c.stroke(); c.lineWidth=2.4; c.strokeStyle=bn; c.stroke(); });
    limb(c,6,-62,14,-50,3.2,bn);
    c.save(); c.translate(-3,-74);
    el(c,0,0,10,10.5); fs(c,bn); rr(c,-9,6,13,6,2); fs(c,bn,2.2); c.strokeStyle=OL; c.lineWidth=1.3; [-6,-3,0].forEach(function(x){ c.beginPath(); c.moveTo(x,7); c.lineTo(x,11); c.stroke(); });
    c.fillStyle='#100810'; el(c,-5,0,3.3,3.6); c.fill(); el(c,3,0,3.3,3.6); c.fill(); poly(c,[-2,4,-0.5,7,1,4]); c.fill();
    var ec=ang? '#ff4a3a' : '#7ee0ff'; gEye(c,-5,0.4,1.8,ec,mood,0); gEye(c,3,0.4,1.8,ec,mood,0);
    c.beginPath(); c.moveTo(-12,-2); c.quadraticCurveTo(-11,-15,0,-15); c.quadraticCurveTo(11,-15,12,-2); c.closePath(); fs(c,ir); rr(c,-3,-3,3.4,9,1); fs(c,ir,2); c.fillStyle=rust; el(c,5,-9,2.5,1.6); c.fill(); el(c,-7,-7,1.8,1.2); c.fill();
    c.restore();
    el(c,-9,-62,8,6); fs(c,rust,2.4); c.fillStyle='#3a2a1a'; el(c,-12,-62,1.2); c.fill(); el(c,-6,-63,1.2); c.fill();
    limb(c,-9,-60,-15,-46,3.2,bn);
    c.save(); c.translate(-15,-44); c.rotate(wa); poly(c,[-2.6,-8,2.6,-8,2.2,-48,0,-55,-2.2,-48]); fs(c,'#c9d0d8',2.3); c.fillStyle=OL; poly(c,[2.4,-30,0.8,-28,2.3,-26]); c.fill(); rr(c,-8,-10.5,16,3.6,1.5); fs(c,ir,2); rr(c,-1.8,-7,3.6,8,1.5); fs(c,'#3a2416',2); el(c,0,0,3.8); fs(c,bn,2); c.restore(); },
  // a giant vampire bat
  bat:function(c,t,col,wa,ang,mood,a){
    c.translate(0,-52+Math.sin(t*3.4)*5+(a>=0? Math.sin(Math.min(1,a/0.6)*Math.PI)*22 : 0));
    var fl=Math.sin(t*14)*0.5, wc=shade(col,-0.55), bc=shade(col,-0.38), mem=shade(col,-0.2);
    [-1,1].forEach(function(sd){ c.save(); c.scale(sd,1); c.rotate(-fl*0.8-0.12);
      c.beginPath(); c.moveTo(6,-6); c.lineTo(25,-30); c.lineTo(58,-22); c.quadraticCurveTo(50,-12,54,3); c.quadraticCurveTo(44,-3,38,9); c.quadraticCurveTo(30,0,22,11); c.quadraticCurveTo(14,2,6,9); c.closePath(); fs(c,mem,2.5);
      c.strokeStyle=wc; c.lineWidth=2.4; c.beginPath(); c.moveTo(6,-6); c.lineTo(25,-30); c.lineTo(58,-22); c.moveTo(25,-30); c.lineTo(54,3); c.moveTo(25,-30); c.lineTo(38,9); c.moveTo(25,-30); c.lineTo(22,11); c.stroke();
      poly(c,[25,-30,23,-39,28,-31]); fs(c,'#f3ead8',1.5); c.restore(); });
    limb(c,-3,16,-5,24,2.2,wc); limb(c,3,16,5,24,2.2,wc);
    el(c,0,4,9,15); fs(c,bc); c.strokeStyle=wc; c.lineWidth=1.4; [-4,0,4].forEach(function(x){ c.beginPath(); c.moveTo(x,-4); c.lineTo(x-1,6); c.stroke(); });
    c.save(); c.translate(-2,-14);
    poly(c,[-9,-3,-13,-24,-2,-8]); fs(c,bc); poly(c,[4,-6,9,-26,10,-3]); fs(c,bc);
    el(c,0,0,9.5,9); fs(c,bc); poly(c,[-6,0,-16,5,-6,8]); fs(c,bc,2.2);
    gEye(c,-5,-2,2.8,'#ff3a3a',mood,0.38); gEye(c,2.5,-2.5,2.8,'#ff3a3a',mood,-0.38);
    c.fillStyle='#f3ead8'; poly(c,[-10,6,-9,12.5,-7,6]); fs(c,'#f3ead8',1.4); poly(c,[-6,6.5,-5,11.5,-3,6.5]); fs(c,'#f3ead8',1.4);
    c.restore(); },
  // an orc brute: broad shoulders, small head, tusks, a war axe
  orc:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*3)*1); var sk=shade(col,-0.14), sd=shade(col,-0.36), le='#3a2a22', ir='#5d6578';
    poly(c,[-15,-40,-3,-40,-4,-14,-15,-14]); fs(c,le); poly(c,[2,-40,14,-40,14,-14,3,-14]); fs(c,le);
    poly(c,[-19,0,-2,0,-3,-17,-16,-17]); fs(c,ir,2.4); poly(c,[1,0,18,0,16,-17,3,-17]); fs(c,ir,2.4);
    poly(c,[-11,-42,11,-42,9,-22,0,-27,-9,-22]); fs(c,'#5a2228',2.2);
    poly(c,[-25,-86,23,-86,16,-42,-17,-42]); fs(c,sk); c.strokeStyle=sd; c.lineWidth=2; c.beginPath(); c.moveTo(-1,-80); c.lineTo(-1,-60); c.moveTo(-14,-68); c.quadraticCurveTo(-6,-64,-1,-68); c.moveTo(12,-68); c.quadraticCurveTo(5,-64,-1,-68); c.stroke();
    c.strokeStyle='#e8c0b0'; c.lineWidth=1.6; c.beginPath(); c.moveTo(4,-78); c.lineTo(10,-70); c.stroke();
    poly(c,[-25,-82,-18,-86,21,-46,15,-42]); fs(c,le,2.2);
    rr(c,-19,-48,38,8,2); fs(c,'#1e1612',2.2); el(c,0,-44,4.6,4.2); fs(c,'#e8e2d0',2); c.fillStyle=OL; el(c,-1.6,-45,1.1); c.fill(); el(c,1.6,-45,1.1); c.fill();
    c.save(); c.translate(-6,-88);
    poly(c,[1,-13,7,-27,10,-12]); fs(c,'#1a1612',2.2);
    c.beginPath(); c.moveTo(-11,-2); c.quadraticCurveTo(-11,-14,0,-14); c.quadraticCurveTo(11,-14,11,-2); c.lineTo(10,8); c.quadraticCurveTo(0,13,-13,8); c.closePath(); fs(c,sk);
    poly(c,[9,-6,18,-13,11,0]); fs(c,sk,2.2);
    poly(c,[-13,-8,9,-8,8,-3.5,-13,-3.5]); c.fillStyle=sd; c.fill();
    gEye(c,-7,-4.5,2.6,'#ff3a2a',mood,0.32); gEye(c,1.5,-4.8,2.6,'#ff3a2a',mood,-0.32);
    c.lineWidth=2; c.strokeStyle=OL; c.beginPath(); c.moveTo(-12,6); c.lineTo(4,6); c.stroke();
    poly(c,[-11,7,-10,-1,-7,7]); fs(c,'#f3ead8',1.8); poly(c,[-1,7,0,0,2.5,7]); fs(c,'#f3ead8',1.8);
    c.restore();
    el(c,-20,-80,11,9); fs(c,ir,2.5); poly(c,[-27,-86,-31,-99,-21,-88]); fs(c,'#c9d0d8',2); poly(c,[-17,-88,-16,-101,-11,-87]); fs(c,'#c9d0d8',2);
    limb(c,-22,-74,-27,-50,8,sk);
    c.save(); c.translate(-27,-48); c.rotate(wa); rr(c,-3,-58,6,66,3); fs(c,'#4a2c16',2.5);
    c.beginPath(); c.moveTo(-3,-56); c.quadraticCurveTo(-30,-64,-28,-32); c.quadraticCurveTo(-15,-38,-3,-35); c.closePath(); fs(c,'#9aa4b4',2.5); c.strokeStyle='#dfe6ee'; c.lineWidth=2; c.beginPath(); c.moveTo(-26,-58); c.quadraticCurveTo(-30,-46,-26,-34); c.stroke();
    poly(c,[3,-52,13,-47,3,-43]); fs(c,'#9aa4b4',2.2); el(c,0,0,6.5); fs(c,sk,2.5); c.restore(); },
  // the boss: an ogre king with a spiked club and an iron crown
  ogre:function(c,t,col,wa,ang,mood){
    c.translate(0,Math.sin(t*2.6)*1.2); var sk=shade(col,-0.14), sd=shade(col,-0.36), ir='#4a4a58';
    c.beginPath(); c.moveTo(-8,-94); c.quadraticCurveTo(32,-90,36,-42); c.lineTo(38,-4); c.lineTo(30,-11); c.lineTo(24,-1); c.lineTo(17,-11); c.lineTo(9,-3); c.lineTo(10,-66); c.closePath(); fs(c,'#5a1420');
    poly(c,[-19,-42,-4,-42,-6,-14,-20,-14]); fs(c,sk); poly(c,[4,-42,19,-42,21,-14,6,-14]); fs(c,sk);
    poly(c,[-25,0,-4,0,-6,-18,-22,-18]); fs(c,ir,2.4); poly(c,[3,0,24,0,22,-18,6,-18]); fs(c,ir,2.4);
    c.beginPath(); c.moveTo(-27,-92); c.quadraticCurveTo(0,-100,25,-92); c.quadraticCurveTo(35,-64,26,-42); c.quadraticCurveTo(0,-32,-26,-42); c.quadraticCurveTo(-36,-64,-27,-92); fs(c,sk);
    c.fillStyle=shade(col,0.06); el(c,-4,-56,15,14); c.fill(); c.strokeStyle='#e8c0b0'; c.lineWidth=1.7; c.beginPath(); c.moveTo(-14,-82); c.lineTo(-4,-72); c.moveTo(8,-84); c.lineTo(14,-76); c.stroke();
    c.fillStyle='#8a8090'; for (var i=0;i<7;i++){ el(c,-22+i*7,-84+i*5.5,2.6,2); c.fill(); }
    rr(c,-26,-48,52,9,3); fs(c,'#1e1612',2.2); el(c,-2,-44,6,5); fs(c,'#c99a2a',2); poly(c,[-12,-40,10,-40,7,-24,-9,-24]); fs(c,'#4a2a1a',2.2);
    c.save(); c.translate(-9,-98);
    c.beginPath(); c.moveTo(-13,0); c.quadraticCurveTo(-13,-15,0,-15); c.quadraticCurveTo(13,-15,13,0); c.lineTo(12,8); c.quadraticCurveTo(0,14,-15,9); c.closePath(); fs(c,sk);
    poly(c,[11,-5,19,-11,12,1]); fs(c,sk,2.2);
    poly(c,[-15,-9,11,-9,10,-4,-15,-4]); c.fillStyle=sd; c.fill(); c.strokeStyle='#e8c0b0'; c.lineWidth=1.4; c.beginPath(); c.moveTo(4,-12); c.lineTo(8,-2); c.stroke();
    gEye(c,-8,-5.5,2.8,'#ff3a2a',mood,0.32); gEye(c,2,-5.8,2.8,'#ff3a2a',mood,-0.32);
    c.lineWidth=2; c.strokeStyle=OL; c.beginPath(); c.moveTo(-14,6); c.lineTo(6,6); c.stroke();
    poly(c,[-13,7.5,-12,-1.5,-9,7.5]); fs(c,'#f3ead8',1.8); poly(c,[1,7.5,2,-0.5,5,7.5]); fs(c,'#f3ead8',1.8);
    poly(c,[-13,-12,-14,-27,-8,-19,-1,-30,6,-19,12,-27,12,-12]); fs(c,'#b88a2a',2.4); c.fillStyle='#ff3a3a'; el(c,-1,-17,2); c.fill(); c.fillStyle='#5a9cff'; el(c,-8,-15.5,1.4); c.fill(); el(c,6,-15.5,1.4); c.fill();
    c.restore();
    el(c,-22,-86,12,9.5); fs(c,ir,2.5); poly(c,[-29,-92,-33,-104,-23,-94]); fs(c,'#c9d0d8',2); poly(c,[-19,-94,-17,-106,-12,-93]); fs(c,'#c9d0d8',2);
    limb(c,-24,-80,-31,-56,10,sk);
    c.save(); c.translate(-31,-54); c.rotate(wa); rr(c,-4,-24,8,32,3); fs(c,'#3a2416',2.5);
    c.beginPath(); c.moveTo(-6,-22); c.quadraticCurveTo(-17,-52,-6,-72); c.quadraticCurveTo(11,-76,12,-56); c.quadraticCurveTo(10,-34,6,-22); c.closePath(); fs(c,'#5a3a22',2.5);
    rr(c,-13,-44,26,5.5,2); fs(c,ir,2); [[-12,-62,-21,-64,-13,-56],[-14,-34,-22,-30,-12,-28],[9,-66,17,-70,11,-60],[11,-34,19,-31,10,-28],[-2,-73,1,-82,4,-73]].forEach(function(q){ poly(c,q); fs(c,'#c9d0d8',2); });
    el(c,0,0,8); fs(c,sk,2.5); rr(c,-8,4,16,4,1.5); fs(c,'#8a8090',1.8); c.restore(); }
};
// the great boss: a lean dragon crouched to strike, long neck, horned head, wings raised
mArt.dragon=function(c,t,col,wa,ang,mood,a){
  c.translate(0,Math.sin(t*2.4)*1.2); var sk=shade(col,-0.22), dk=shade(col,-0.5), bel='#cdb27a', fire=a>=0.2&&a<0.7, fl=Math.sin(t*3.6)*0.12+(a>=0? 0.3 : 0);
  var wing=function(x,y,s2,col2,rot){ c.save(); c.translate(x,y); c.rotate(rot); c.scale(s2,s2); c.beginPath(); c.moveTo(0,0); c.lineTo(20,-44); c.lineTo(62,-36); c.quadraticCurveTo(56,-22,60,-6); c.quadraticCurveTo(48,-12,42,2); c.quadraticCurveTo(32,-6,24,6); c.quadraticCurveTo(14,-2,4,8); c.closePath(); fs(c,col2,2.5/s2);
    c.strokeStyle=OL; c.lineWidth=2/s2; c.beginPath(); c.moveTo(20,-44); c.lineTo(60,-6); c.moveTo(20,-44); c.lineTo(42,2); c.moveTo(20,-44); c.lineTo(24,6); c.stroke(); poly(c,[20,-44,17,-53,24,-45]); fs(c,'#e8dcc0',2/s2); c.restore(); };
  wing(10,-62,0.9,dk,-0.2-fl);
  c.beginPath(); c.moveTo(14,-32); c.quadraticCurveTo(52,-34,64,-14); c.quadraticCurveTo(72,2,82,-14); c.lineTo(76,-13); c.quadraticCurveTo(66,-6,58,-20); c.quadraticCurveTo(46,-22,16,-18); c.closePath(); fs(c,sk); poly(c,[78,-13,92,-26,86,-6]); fs(c,dk,2.2);
  el(c,16,-22,15,12); fs(c,sk); poly(c,[8,-14,24,-14,22,0,6,0]); fs(c,sk); c.fillStyle='#e8dcc0'; [6,11,16].forEach(function(x){ poly(c,[x,0,x+2,-4,x+4,0]); c.fill(); });
  c.save(); c.translate(2,-42); c.rotate(-0.5); el(c,0,0,23,17); fs(c,sk); c.save(); el(c,0,0,23,17); c.clip(); c.fillStyle=bel; c.fillRect(-26,6,52,14); c.strokeStyle='rgba(90,60,30,0.5)'; c.lineWidth=1.5; for (var i=-20;i<=20;i+=7){ c.beginPath(); c.moveTo(i,6); c.lineTo(i,20); c.stroke(); } c.restore(); c.restore();
  [[14,-58],[22,-50],[28,-40]].forEach(function(p){ poly(c,[p[0]-4,p[1]+4,p[0]+6,p[1]-6,p[0]+3,p[1]+7]); fs(c,dk,2); });
  c.beginPath(); c.moveTo(-6,-52); c.quadraticCurveTo(-20,-72,-30,-84); c.lineTo(-19,-92); c.quadraticCurveTo(-4,-74,10,-56); c.closePath(); fs(c,sk);
  c.strokeStyle=bel; c.lineWidth=3; c.beginPath(); c.moveTo(-5,-56); c.quadraticCurveTo(-16,-72,-26,-84); c.stroke();
  [[-8,-78],[-1,-70],[5,-62]].forEach(function(p){ poly(c,[p[0],p[1],p[0]+9,p[1]-6,p[0]+4,p[1]+4]); fs(c,dk,2); });
  c.save(); c.translate(-30,-86);
  poly(c,[6,-6,24,-20,12,-1]); fs(c,'#e8dcc0',2.2); poly(c,[2,-8,12,-24,7,-6]); fs(c,'#e8dcc0',2.2);
  c.beginPath(); c.moveTo(10,-6); c.quadraticCurveTo(4,-12,-6,-10); c.lineTo(-24,-5); c.lineTo(-26,1); c.lineTo(-10,3); c.quadraticCurveTo(6,8,10,-6); c.closePath(); fs(c,sk);
  c.fillStyle='#e8dcc0'; [-22,-17,-12].forEach(function(x){ poly(c,[x,1,x+2,5,x+4,1]); c.fill(); });
  c.save(); c.translate(-6,3); c.rotate(fire? 0.42 : 0.06); poly(c,[2,-1,-20,-1,-18,4,2,6]); fs(c,sk,2.2); c.fillStyle='#e8dcc0'; [-16,-11].forEach(function(x){ poly(c,[x,-1,x+2,-5,x+4,-1]); c.fill(); }); c.restore();
  if (fire){ el(c,-24,3,5,3.5); fs(c,'#ff9a3c',1.6); }
  poly(c,[-12,-12,4,-9,2,-6,-12,-7]); c.fillStyle=dk; c.fill(); c.fillStyle=OL; el(c,-23,-3,1.1); c.fill();
  gEye(c,-6,-6.5,2.8,ang? '#ff5a2a' : '#ffcf3a',mood,0.32);
  c.restore();
  c.save(); c.translate(-12,-36); poly(c,[-4,-4,6,-2,-6,20,-14,20]); fs(c,sk); c.fillStyle='#e8dcc0'; [-16,-11,-6].forEach(function(x){ poly(c,[x,20,x+2,24,x+4,20]); c.fill(); }); c.restore();
  wing(4,-64,1.05,sk,-0.05-fl*1.3);
};
// mark for the floor's boss room on the maps and gates: a white skull with a gold crown (mini boss), horns (boss), crown and wings (great boss)
Object.keys(MIMG).forEach(function(kd){ var code=mArt[kd]; mArt[kd]=function(c,t,col,wa,ang,mood,a){ var n=MIMG[kd]; if (!artOk(n)) return code(c,t,col,wa,ang,mood,a);
  var atk=a>=0.12 && a<0.85 && artOk(n+'-attack'), br=Math.sin(t*3.2+1); c.save();
  if (kd==='bat'){ c.translate(0,-30+(a>=0? Math.sin(Math.min(1,a/0.6)*Math.PI)*20 : 0)); if (atk&&artOk(n+'-attack')) drawChar(c, n+'-attack', n, MHI[kd].h); else if (!drawBatFlap(c, t, MHI[kd].h)){ c.translate(0,Math.sin(t*3.4)*5); drawChar(c, n, n, MHI[kd].h); } }
  else { if (!atk) c.scale(1+br*0.012, 1-br*0.02); else c.rotate(-0.03); drawChar(c, atk? n+'-attack' : n, n, MHI[kd].h); }
  c.restore(); }; });
// mark for the floor's boss room on the maps and gates. Boss and great boss: a red horned bull skull with glowing eyes (the
// great boss's horns are gold and it has a crown); mini boss: a white skull with a small gold crown.
function bossMark(c,x,y,r,kind){ c.save(); c.translate(x,y); var lw=Math.max(1.2,r*0.14);
  if (kind==='n'){ icon(c,'psn',0,r*0.15,r*0.66,'#fff',Math.max(1.4,r*0.16)); poly(c,[-r*0.55,-r*0.45,-r*0.62,-r*1.05,-r*0.28,-r*0.72,0,-r*1.15,r*0.28,-r*0.72,r*0.62,-r*1.05,r*0.55,-r*0.45]); fs(c,'#ffcf3a',lw); c.restore(); return; }
  var big=kind==='big', hc= big? '#ffcf3a' : '#f3ead8';
  [-1,1].forEach(function(sd){ c.beginPath(); c.moveTo(sd*r*0.42,-r*0.42); c.quadraticCurveTo(sd*r*1.25,-r*0.55,sd*r*1.12,-r*1.25); c.quadraticCurveTo(sd*r*0.95,-r*0.78,sd*r*0.5,-r*0.12); c.closePath(); fs(c,hc,lw); });
  c.beginPath(); c.moveTo(-r*0.62,-r*0.5); c.quadraticCurveTo(0,-r*0.82,r*0.62,-r*0.5); c.quadraticCurveTo(r*0.7,-r*0.05,r*0.36,r*0.3); c.lineTo(r*0.26,r*0.85); c.quadraticCurveTo(0,r*1.02,-r*0.26,r*0.85); c.lineTo(-r*0.36,r*0.3); c.quadraticCurveTo(-r*0.7,-r*0.05,-r*0.62,-r*0.5); c.closePath(); fs(c,'#d9283a',lw);
  c.fillStyle='rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-r*0.22,-r*0.48,r*0.2,r*0.08,-0.3,0,6.3); c.fill();
  c.fillStyle='#140810'; [-1,1].forEach(function(sd){ poly(c,[sd*r*0.08,-r*0.2, sd*r*0.5,-r*0.32, sd*r*0.4,r*0.06]); c.fill(); });
  c.fillStyle='#ffd84a'; [-1,1].forEach(function(sd){ c.beginPath(); c.arc(sd*r*0.32,-r*0.15,r*0.08,0,6.3); c.fill(); });
  c.fillStyle='#140810'; c.beginPath(); c.ellipse(-r*0.1,r*0.66,r*0.06,r*0.1,0,0,6.3); c.fill(); c.beginPath(); c.ellipse(r*0.1,r*0.66,r*0.06,r*0.1,0,0,6.3); c.fill();
  if (big){ poly(c,[-r*0.42,-r*0.62,-r*0.48,-r*1.08,-r*0.2,-r*0.8,0,-r*1.18,r*0.2,-r*0.8,r*0.48,-r*1.08,r*0.42,-r*0.62]); fs(c,'#ffcf3a',lw); }
  c.restore(); }
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
  var scn= L.role!=='min' ? 0 : (L.kind==='n' ? L.stage%3 : (L.stage%2? 1 : 2)), rn=['room-arch','room-windows','room-door'][scn];
  if (artOk(rn)){ var flr=[0.8,0.75,0.75][scn], tp=[[0.225,0.37],[0.135,0.37],[0.17,0.37],[0.777,0.37],[0.865,0.37],[0.83,0.37]], P=drawScene(c, rn, 0, 0, W, H, flr, fy+4*k);
    c.globalCompositeOperation='multiply'; c.fillStyle=['rgba(200,180,255,0.35)','rgba(150,230,170,0.45)','rgba(150,190,255,0.45)','rgba(255,150,130,0.45)'][VS.scn]; c.fillRect(0,0,W,H); c.globalCompositeOperation='source-over';
    if (L.king){ var kg2=c.createRadialGradient(W/2,fy,4,W/2,fy,H); kg2.addColorStop(0,'rgba(255,40,40,0.35)'); kg2.addColorStop(1,'rgba(255,40,40,0)'); c.fillStyle=kg2; c.fillRect(0,0,W,H); }
    torches=[tp[scn],tp[scn+3]].map(function(q){ return {x:P.x+q[0]*1920*P.s, y:P.y+q[1]*1080*P.s, glow:1}; });
    var vg2=c.createRadialGradient(W/2,H*0.55,H*0.3,W/2,H*0.55,Math.max(W*0.62,H)); vg2.addColorStop(0,'rgba(0,0,0,0)'); vg2.addColorStop(1,'rgba(8,4,12,0.55)'); c.fillStyle=vg2; c.fillRect(0,0,W,H);
    return; }
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
// an open way out: two stone pillars with lit lamps and light pouring through; the lamp colour and the sign say what waits there
function gatePos(g,dx,dy){ var k=g.k; return dx<0? {x:g.x+38*k, y:g.gy+8*k, s:1.2} : (dx>0? {x:g.x+g.w-38*k, y:g.gy+8*k, s:1.2} : (dy<0? {x:g.x+g.w/2, y:g.gy-24*k, s:1.12} : {x:g.x+g.w/2, y:g.gy+10*k, s:1.04})); }
function drawGate(c,g,t,dx,dy,id,hit){
  var k=g.k, P=gatePos(g,dx,dy), s=P.s*k, r=nodeAt(id), kn=known(id), dn=RT.done[id], boss=r.t==='B', th=THEMES[VS.scn];
  var col= boss? (L.kind==='big'?'255,170,40':(L.kind==='boss'?'255,80,80':'200,110,255')) : (dn? '170,205,255' : (!kn? '205,205,225' : {f:'255,225,120', e:'200,110,255', r:'120,240,130', c:'255,215,80'}[r.t]));
  var pu=0.6+Math.sin(t*5+dx+dy*2)*0.4, pw=21*s, ph=80*s;
  c.save(); c.translate(P.x,P.y);
  var badgeX=0, badgeY=-ph-22*s;
  {
    // DNF-style side exit: an arched doorway in the side wall, seen at an angle (near edge tall, far edge short, converging on the horizon), light spilling onto the floor
    var sd=dx>0? 1 : (dx<0? -1 : 0), side=dx!==0, xs=side? 0.62 : 1, HW=pw+16*s, hz=-58*s;
    var mp=function(x,y){ var f=1+(sd*x/HW)*0.22; return [x*xs, hz+(y-hz)*f]; };          // x across the doorway (outer side = sd), y up from the floor
    var quad=function(pts){ c.beginPath(); pts.forEach(function(q,qi){ var m=mp(q[0],q[1]); if (qi) c.lineTo(m[0],m[1]); else c.moveTo(m[0],m[1]); }); c.closePath(); };
    var arch=function(r0,y0,ext){ var pts=[], n=14; pts.push([-r0,ext]); for (var a=0;a<=n;a++){ var an=Math.PI+a/n*Math.PI; pts.push([Math.cos(an)*r0, y0+Math.sin(an)*r0]); } pts.push([r0,ext]); return pts; };
    // light pouring out of the doorway across the floor, toward the room
    if (!side){ c.fillStyle='rgba('+col+','+(0.3+pu*0.25)+')'; el(c,0,3*s,pw*2,8*s); c.fill(); }
    else { var f0=mp(-pw,0), f1=mp(pw,0), spill=-sd*80*s; c.beginPath(); c.moveTo(f0[0],f0[1]); c.lineTo(f1[0],f1[1]); c.lineTo(f1[0]+spill,f1[1]+16*s); c.lineTo(f0[0]+spill,f0[1]+10*s); c.closePath();
    var sg=c.createLinearGradient(0,0,spill,0); sg.addColorStop(0,'rgba('+col+','+(0.35+pu*0.2)+')'); sg.addColorStop(1,'rgba('+col+',0)'); c.fillStyle=sg; c.fill(); }
    // stone frame (thick arch), then the glowing opening
    var R=pw+9*s, top=-ph+R; quad(arch(R,top,3*s)); c.fillStyle=th.fl; c.fill(); c.lineWidth=2.5*k; c.strokeStyle=OL; c.stroke();
    quad(arch(pw,top,0)); var o0=mp(0,-ph), o1=mp(0,0), og=c.createLinearGradient(0,o0[1],0,o1[1]); og.addColorStop(0,'rgba('+col+','+(0.25+pu*0.2)+')'); og.addColorStop(1,'rgba('+col+','+(0.75+pu*0.2)+')'); c.fillStyle='#120a18'; c.fill(); c.fillStyle=og; c.fill(); c.stroke();
    if (dy>0) for (var st3=0;st3<5;st3++){ var sy3=-ph*0.4+st3*ph*0.085, sw3=pw*(0.5+st3*0.1); c.fillStyle='rgba(30,18,40,'+(0.3+st3*0.09)+')'; c.fillRect(-sw3,sy3,sw3*2,ph*0.045); }
    quad(arch(pw*0.45,top+pw*0.3,0)); c.fillStyle='rgba(255,255,255,'+(0.18+pu*0.22)+')'; c.fill();
    // keystone + stone joints on the arch
    for (var a2=0;a2<=6;a2++){ var an2=Math.PI+a2/6*Math.PI, p1=mp(Math.cos(an2)*pw,top+Math.sin(an2)*pw), p2=mp(Math.cos(an2)*R,top+Math.sin(an2)*R); c.beginPath(); c.moveTo(p1[0],p1[1]); c.lineTo(p2[0],p2[1]); c.lineWidth=1.6*k; c.strokeStyle='rgba(0,0,0,0.35)'; c.stroke(); }
    // lamps on both jambs (the near one bigger)
    [-1,1].forEach(function(e3){ var lx=e3*R, lp=mp(lx,-ph*0.62), f=1+(sd*lx/HW)*0.2, lr=7*s*f;
      var lg2=c.createRadialGradient(lp[0],lp[1],1,lp[0],lp[1],30*s*f); lg2.addColorStop(0,'rgba('+col+','+(0.55*pu+0.3)+')'); lg2.addColorStop(1,'rgba('+col+',0)'); c.fillStyle=lg2; c.fillRect(lp[0]-30*s*f,lp[1]-30*s*f,60*s*f,60*s*f);
      rr(c,lp[0]-2.5*s*f,lp[1]+5*s*f,5*s*f,6*s*f,1.5*s); fs(c,'#5a3d24',2*k); el(c,lp[0],lp[1],lr); fs(c,'rgb('+col+')',2.5*k); c.fillStyle='rgba(255,255,255,0.9)'; el(c,lp[0]-2*s,lp[1]-2*s,2.5*s*f); c.fill(); });
    var bp=mp(0,-ph); badgeX=bp[0]; badgeY=bp[1]-11*s;
  }
  c.translate(badgeX,0); var by=badgeY, br=13*s; el(c,0,by,br); fs(c,'#2a1a2e',2.5*k); c.lineWidth=2.5*k; c.strokeStyle='rgb('+col+')'; el(c,0,by,br-2.5*k); c.stroke();
  c.textAlign='center'; c.textBaseline='middle';
  if (boss) bossMark(c,0,by,br*0.82,L.kind);
  else if (dn){ c.font='900 '+Math.round(br*1.25)+'px '+FNT; c.fillStyle='#cfe4ff'; c.fillText('✓', 0, by+1); }
  else if (!kn){ c.font='900 '+Math.round(br*1.35)+'px '+FNT; c.fillStyle='#e0e0f0'; c.fillText('?', 0, by+1); }
  else if (r.t==='c'){ el(c,0,by,br*0.48); fs(c,'#ffe98a',2*k); }
  else icon(c, r.t==='f'?'atk':(r.t==='e'?'psn':'heal'), 0, by, br*0.58, '#fff', 2.5);
  c.restore(); if (hit) doorHits.push({id:id, x:P.x+badgeX, y:P.y-ph*0.55, r:Math.max(52, 60*k)});
}
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
  var c=cx, g=stg(), k=g.k, i, kd=VS.kind, md=mdOf(kd), th=THEMES[VS.scn];
  ['hAtk','hHurt','hDrink','mAtk','mHurt','mIn','hGlow','shPop','shBreak','dizzy','cdPop','fadeIn'].forEach(function(n){ if (VS[n]>0) VS[n]=Math.max(0,VS[n]-dt); }); if (VS.mDead>0) VS.mDead+=dt;
  if (lost && VS.hHp<=0 && VS.hHurt<=0.15) VS.hDead+=dt; else if (!lost) VS.hDead=0;
  VS.hBar+=(VS.hHp/F.heroMax-VS.hBar)*Math.min(1,dt*12); VS.mBar+=(VS.mHp/F.mMax-VS.mBar)*Math.min(1,dt*12);
  VS.hLag= VS.hLag>VS.hBar? Math.max(VS.hBar, VS.hLag-dt*0.45) : VS.hBar; VS.mLag= VS.mLag>VS.mBar? Math.max(VS.mBar, VS.mLag-dt*0.45) : VS.mBar;
  var key=[g.w,STG.h,L.level,L.stage,DPR].join(); if (!stageCache || stageKey!==key){ stageKey=key; buildStage(g); }
  var sx=0, sy=0; if (shk>0){ shk=Math.max(0,shk-dt*3.4); sx=(Math.random()-0.5)*shk*13*k; sy=(Math.random()-0.5)*shk*9*k; }
  c.save(); c.translate(sx,sy); c.drawImage(stageCache, g.x, STG.top, g.w, STG.h);
  c.save(); rr(c,g.x,STG.top,g.w,STG.h,18); c.clip();
  torches.forEach(function(tc,ti){ var fx0=g.x+tc.x, fy0=STG.top+tc.y, fl=0.85+Math.sin(t*11+ti*2)*0.1+Math.sin(t*23+ti)*0.06, rg=c.createRadialGradient(fx0,fy0,2,fx0,fy0,78*k);
    rg.addColorStop(0,'rgba('+th.gl+','+(0.4*fl)+')'); rg.addColorStop(1,'rgba('+th.gl+',0)'); c.fillStyle=rg; c.fillRect(fx0-80*k,fy0-80*k,160*k,160*k); if (tc.glow) return;
    var fh=17*k*fl, fw=6.5*k; c.fillStyle='rgb('+th.gl+')'; c.beginPath(); c.moveTo(fx0-fw,fy0); c.quadraticCurveTo(fx0-fw*1.2,fy0-fh*0.5,fx0+Math.sin(t*9+ti)*2*k,fy0-fh); c.quadraticCurveTo(fx0+fw*1.2,fy0-fh*0.5,fx0+fw,fy0); c.closePath(); c.fill();
    c.fillStyle='#fff6c9'; c.beginPath(); c.moveTo(fx0-fw*0.5,fy0); c.quadraticCurveTo(fx0-fw*0.6,fy0-fh*0.3,fx0,fy0-fh*0.55); c.quadraticCurveTo(fx0+fw*0.6,fy0-fh*0.3,fx0+fw*0.5,fy0); c.closePath(); c.fill(); });
  doorHits=[];
  if (RT && RT.at>=0){ if (choosing && walk<=0){ var here=nodeAt(RT.at); options().forEach(function(id){ var rm=nodeAt(id); drawGate(c,g,t,rm.x-here.x,rm.y-here.y,id,true); }); }
    else if (walk>0 && walkGate) drawGate(c,g,t,walkGate.dx,walkGate.dy,nextRoom,false); }
  // ----- monster -----
  var big=md.s*(L.elite?1.18:1), alive=!(VS.mDead>0), ma=VS.mAtk>0? 1-VS.mAtk/MA : -1, ha=VS.hAtk>0? 1-VS.hAtk/HA : -1, D=(g.mx-g.hx)-(80+md.w*0.5*big)*k;
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
  var hdp=Math.min(1,VS.hDead/0.4), wk=walk>0? Math.min(1,walk/0.9) : 0, cheer=won && VS.mDead>0.3 && !wk && !choosing && !VS.empty, hxx=g.hx+(wk&&walkGate? (gatePos(g,walkGate.dx,walkGate.dy).x-g.hx)*ease(wk) : 0)+(VS.fadeIn>0? -VS.fadeIn/0.45*60*k : 0)+dashP(ha)*D-(VS.hHurt>0? Math.sin(Math.min(1,VS.hHurt/0.4)*Math.PI)*14*k : 0), hyy=g.gy+(wk&&walkGate? (gatePos(g,walkGate.dx,walkGate.dy).y-g.gy)*ease(wk) : 0)-(cheer? Math.abs(Math.sin(t*6.5))*16*k : 0)-(wk||VS.fadeIn>0? Math.abs(Math.sin(t*16))*7*k : 0);
  if (wk && Math.random()<dt*30) parts.push({x:hxx,y:hyy,vx:-40-Math.random()*40,vy:-20-Math.random()*30,t:0.4,c:'rgba(230,220,240,0.6)',r:2+Math.random()*3,g:60});
  c.fillStyle='rgba(0,0,0,0.34)'; el(c,hxx+2*k,g.gy+3*k,44*k,7*k); c.fill();
  if (VS.hGlow>0){ c.fillStyle='rgba(140,240,120,'+(VS.hGlow*0.7)+')'; el(c,hxx,g.gy-58*k,58*k,70*k); c.fill(); }
  heroRun=(ha>=0.18 && ha<0.96) || wk>0 || VS.fadeIn>0;
  sprite(function(s){ heroArt(s,t); }, hxx-hdp*8*k, hyy-hdp*6*k, k, 1, {sx:(wk&&walkGate&&walkGate.dx<0? -1 : 1), rot:-easeOut(hdp)*1.5, tint: VS.hHurt>0.25? '#fff' : '#ff3030', ta: VS.hHurt>0.25? 0.85 : (VS.hHurt>0? VS.hHurt*1.6 : 0)});
  if (hdp>=1) for (i=0;i<3;i++){ var sa=t*5+i*2.1; icon(c,'stun',g.hx-36*k+Math.cos(sa)*16*k, g.gy-34*k+Math.sin(sa)*5*k, 6*k, '#ffe14a', 2); }
  if (VS.shield>0 || VS.shBreak>0){ var sp=VS.shPop>0? Math.sin((1-VS.shPop/0.45)*Math.PI) : 0, sr=(70+sp*10)*k, sa2=VS.shield>0? 1 : VS.shBreak/0.45, scx=hxx, scy=hyy-58*k, rx=sr, ry=sr*1.08, brk=VS.shield<=0;
    c.save(); c.globalAlpha=sa2;
    var dg=c.createRadialGradient(scx-rx*0.3,scy-ry*0.4,rx*0.1,scx,scy,rx); dg.addColorStop(0,'rgba(200,235,255,0.06)'); dg.addColorStop(0.75,'rgba(90,170,255,0.14)'); dg.addColorStop(1,'rgba(120,200,255,'+(0.45+sp*0.3)+')'); c.fillStyle=dg; el(c,scx,scy,rx,ry); c.fill();
    c.save(); el(c,scx,scy,rx,ry); c.clip(); var hs=13*k, hw=hs*Math.sqrt(3), pul=0.5+Math.sin(t*2.5)*0.5;
    c.lineWidth=1.2*k; for (var hy2=-ry; hy2<ry+hs; hy2+=hs*1.5) for (var hx2=-rx; hx2<rx+hw; hx2+=hw){ var ox2=hx2+((Math.round((hy2+ry)/(hs*1.5)))%2? hw/2 : 0), dd=Math.hypot(ox2/rx, hy2/ry), wv=Math.max(0, 1-Math.abs(dd-((t*0.6)%1.4))*3);
      c.strokeStyle='rgba(170,220,255,'+(0.12+dd*0.25+wv*0.45)+')'; c.beginPath(); for (var q=0;q<6;q++){ var an=Math.PI/6+q*Math.PI/3, px=scx+ox2+Math.cos(an)*hs*0.92, py=scy+hy2+Math.sin(an)*hs*0.92; if (!q) c.moveTo(px,py); else c.lineTo(px,py); } c.closePath(); c.stroke(); }
    c.restore();
    c.lineWidth=5*k; c.strokeStyle='rgba(80,160,255,0.35)'; el(c,scx,scy,rx,ry); c.stroke(); c.lineWidth=2*k; c.strokeStyle='rgba(225,245,255,0.95)'; c.stroke();
    c.lineWidth=3.5*k; c.strokeStyle='rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(scx,scy,rx*0.86,ry*0.9,0,-2.45,-1.75); c.stroke(); c.lineWidth=2*k; c.beginPath(); c.ellipse(scx,scy,rx*0.86,ry*0.9,0,-1.6,-1.45); c.stroke();
    for (var rq=0;rq<3;rq++){ var ra=t*1.2+rq*2.09, rxp=scx+Math.cos(ra)*rx*1.02, ryp=scy+ry*0.55+Math.sin(ra)*ry*0.16, front=Math.sin(ra)>0; c.globalAlpha=sa2*(front? 1 : 0.4); c.fillStyle='#e0f4ff'; c.save(); c.translate(rxp,ryp); c.rotate(t*2); poly(c,[0,-5*k,3.5*k,0,0,5*k,-3.5*k,0]); c.fill(); c.strokeStyle='rgba(90,170,255,0.9)'; c.lineWidth=1.5*k; c.stroke(); c.restore(); }
    c.globalAlpha=sa2; c.strokeStyle='rgba(150,210,255,0.6)'; c.lineWidth=2*k; c.beginPath(); c.ellipse(scx,scy+ry*0.55,rx*1.02,ry*0.16,0,0,6.3); c.stroke();
    if (brk){ var bp=1-VS.shBreak/0.45; c.strokeStyle='rgba(255,255,255,0.9)'; c.lineWidth=2*k; for (var cq=0;cq<7;cq++){ var ca=cq*0.9+0.3; c.beginPath(); c.moveTo(scx+Math.cos(ca)*rx*0.3,scy+Math.sin(ca)*ry*0.3); c.lineTo(scx+Math.cos(ca)*rx*(0.6+bp*0.6),scy+Math.sin(ca+0.2)*ry*(0.6+bp*0.6)); c.stroke(); } }
    c.restore(); }
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
  var dark=Math.max(wk>0.45? (wk-0.45)/0.55 : 0, VS.fadeIn>0? VS.fadeIn/0.45 : 0); if (dark>0){ c.fillStyle='rgba(8,4,12,'+Math.min(1,dark)+')'; c.fillRect(g.x,STG.top,g.w,STG.h); }
  c.restore();
  rr(c,g.x+1.5,STG.top+1.5,g.w-3,STG.h-3,17); c.lineWidth=5; c.strokeStyle='#1a1020'; c.stroke(); c.lineWidth=2.5; c.strokeStyle=L.role==='big'?'#ffcf3a':(L.king?'#ff7a5a':'#c79a52'); c.stroke();
  c.restore();
  // ----- fight HUD: who, health, what is active -----
  var pad=9*k, mr=Math.max(13,15*k), bh2=Math.max(12,13*k), by=STG.top+pad+mr+2*k-bh2/2+5*k, ny=STG.top+pad+5*k, bx0=g.x+pad+mr*2-5, CX2=2*g.x+g.w, bx1=CX2/2-9*k, bwid=bx1-bx0, nf=Math.max(10.5,11.5*k);
  hpBar(c,bx0,by,bwid,bh2,VS.hBar,VS.hLag,'#8df07a','#3fb04f',false); if (!VS.empty) hpBar(c,CX2-bx1,by,bwid,bh2,VS.mBar,VS.mLag,'#ff7a6a','#d93a3a',true);
  txt(c,Math.max(0,Math.round(VS.hHp))+'/'+F.heroMax,bx0+bwid/2,by+bh2/2+0.5,Math.max(10,bh2*0.86),'#fff');
  if (!VS.empty) txt(c,Math.max(0,Math.round(VS.mHp))+'/'+F.mMax,CX2-bx1+bwid/2,by+bh2/2+0.5,Math.max(10,bh2*0.86),'#fff');
  txt(c,tl('hero'),bx0+4,ny,nf,'#cfe4ff','left'); if (!VS.empty) txt(c,tl('m_'+kd)+'  Lv.'+L.level,CX2-bx0-4,ny,nf,L.king?'#ffb09a':'#ffd9cf','right');
  el(c,g.x+pad+mr,STG.top+pad+mr,mr); fs(c,'#3d7bd9',2.5); c.lineWidth=1.5; c.strokeStyle='#fff'; el(c,g.x+pad+mr,STG.top+pad+mr,mr-3); c.stroke(); icon(c,'heal',g.x+pad+mr,STG.top+pad+mr+0.5,mr*0.52,'#fff',0);
  if (!VS.empty){ el(c,g.x+g.w-pad-mr,STG.top+pad+mr,mr); fs(c,L.role==='big'?'#e8a020':(L.king?'#c0303a':(L.elite?'#9a4ae0':'#7a3f9a')),2.5); c.strokeStyle='#fff'; c.lineWidth=1.5; el(c,g.x+g.w-pad-mr,STG.top+pad+mr,mr-3); c.stroke(); icon(c,'psn',g.x+g.w-pad-mr,STG.top+pad+mr,mr*0.52,'#fff',0); }
  var sy2=by+bh2+11*k;
  if ((L.king||L.elite) && alive){ var bt=L.role==='big'?'BIG BOSS':(L.king?'BOSS':(L.final?'MINI BOSS':'ELITE')), bf=Math.max(9.5,10.5*k); c.font='900 '+Math.round(bf)+'px '+FNT; var btw=c.measureText(bt).width+12; rr(c,CX2-bx0-btw,sy2-bf*0.8,btw,bf*1.6,bf*0.8); c.fillStyle=L.role==='big'?'#e8a020':(L.king?'#d93a3a':'#9a4ae0'); c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke(); txt(c,bt,CX2-bx0-btw/2,sy2+0.5,bf,'#fff','center',2.5); }
  var pw=DJ.power(F), pk=Math.max(0.9,k); if (VS.pw!==pw){ if (VS.pw!=null) VS.pwPop=0.25; VS.pw=pw; } if (VS.pwPop>0) VS.pwPop=Math.max(0,VS.pwPop-dt);
  if (!won && !lost){ var ps=1+(VS.pwPop>0? Math.sin(VS.pwPop/0.25*Math.PI)*0.25 : 0), pc= pw>=1.5? '#ffd84a' : (pw>1? '#ffe9c0' : '#b8a8c4'); icon(c,'atk',bx0+8*pk,sy2,7.5*pk*ps,pc,2.5); txt(c,'×'+pw.toFixed(1),bx0+17*pk,sy2+0.5,13*pk*ps,pc,'left'); }
  if (VS.shield>0){ icon(c,'shd',bx0+62*pk,sy2,7.5*k,'#6aa8ff',2.5); txt(c,'×'+VS.shield,bx0+62*pk+10*k,sy2+0.5,12*k,'#cfe4ff','left'); }
  if (VS.poison>0 && alive){ icon(c,'psn',CX2-bx1+8*k,sy2,7*k,'#c79aff',2.5); txt(c,''+VS.poison,CX2-bx1+18*k,sy2+0.5,12*k,'#e0c8ff','left'); }
  // the monster's next move: how many pours are left, and how hard it hits
  if (alive && !won && !lost){ var cd=Math.max(0,VS.cd), pop=VS.cdPop>0? 1+Math.sin((VS.cdPop/0.4)*Math.PI)*0.35 : 1, pu=(hot? 1+Math.sin(t*10)*0.07 : 1)*pop, ib=Math.max(0.82,k);
    var hv=DJ.nextHeavy(F), sp2=specOf(kd);
    var ix=Math.max(g.hx+(artOk('knight-0')? 92 : 62)*k, g.mx-(md.w*0.5*big+(L.king||L.elite?62:48))*k)+(hot? Math.sin(t*38)*1.5 : 0), iy=Math.max(sy2+20*ib, g.gy-(kd==='bat'?52:md.h*0.8)*big*k), col=hot?'#f04848':(cd<=2?'#ff9a3c':'#7a4fa0'); if (hv) col= hot? '#ff2a2a' : '#ff6a2a';
    c.save(); c.translate(ix,iy); c.scale(pu*ib,pu*ib);
    poly(c,[36,-5,45,0,36,5]); c.fillStyle='rgba(30,18,38,0.92)'; c.fill();
    rr(c,-30,-13,68,26,13); c.fillStyle='rgba(30,18,38,0.92)'; c.fill(); c.lineWidth=2; c.strokeStyle=col; c.stroke();
    el(c,-17,0,15); fs(c,col,2.5); c.lineWidth=1.5; c.strokeStyle='rgba(255,255,255,0.85)'; el(c,-17,0,12); c.stroke();
    txt(c,''+cd,-17,1,19,'#fff'); icon(c,'atk',7,0,7.5,'#ffb0a0',0); txt(c,''+(hv? Math.round(F.mDmg*1.8) : F.mDmg),24,1,14,hv?'#ffd84a':'#ffb0a0','center',2.5);
    if (hv){ rr(c,-30,-31,68,16,8); c.fillStyle='#ff6a2a'; c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke(); txt(c,'💥 '+tl('heavyHit'),4,-23,11,'#fff','center',2.5); }
    if (sp2){ el(c,-33,12,8); fs(c,'#2a1a2e',2); if (sp2==='regen') icon(c,'heal',-33,12.5,5,'#8df07a',0); else { c.lineWidth=2; c.strokeStyle='#c9d0d8'; el(c,-35,12,3,2); c.stroke(); el(c,-31,12,3,2); c.stroke(); } }
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
  if (v.lock>0){ v.shake=0.3; Snd.nope(); toast(tl('locked',{n:v.lock})); return; }
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
// A potion bottle: thick dark outline like the rest of the art, glass with rim light and reflections, a brass collar under the
// lip, liquids that are lit from the left with a rounded surface, slow bubbles, and a waxed cork on finished bottles.
// The outline (width bw, lip at -bh) is what the pouring code relies on, so it stays the same.
function bottlePath(c, inset){
  var w=bw/2-inset, r=Math.min(w, bw*0.46), yb=-inset, yt=-bh;
  c.beginPath(); c.moveTo(-w, yt); c.lineTo(-w, yb-r); c.quadraticCurveTo(-w, yb, -w+r, yb); c.lineTo(w-r, yb); c.quadraticCurveTo(w, yb, w, yb-r); c.lineTo(w, yt); c.closePath();
}
function drawBottle(v, i){
  var c=cx, lift=v.lift*bw*0.55, dropY=0, sh=0, tm=performance.now()/1000;
  if (v.drop>0){ var dt0=Math.max(0, Math.min(1, 1-(v.drop-0)/0.45)); dropY=-(1-backOut(dt0))*VH*0.5; if (v.drop>0.45) dropY=-VH; }
  if (v.shake>0) sh=Math.sin(v.shake*40)*v.shake*bw*0.35;
  var px=v.x+v.ox+sh, py=v.y+v.oy-lift+dropY, popS=1+(v.pop>0? Math.sin((1-v.pop)*Math.PI)*0.08 : 0), still=Math.abs(v.ang)<0.05, d=v.disp||[], selC=(i===sel), magC=(magic && !v.busy && B[i] && B[i].length<CAP);
  var done=!v.busy && B[i] && B[i].length===CAP && DJ.done(B[i]);
  // floor shadow, and a coloured glow on the shelf under a finished bottle
  if (!v.ox && !v.oy && dropY>-10){ c.fillStyle='rgba(0,0,0,'+(0.32-v.lift*0.14)+')'; c.beginPath(); c.ellipse(v.x, v.y+3, bw*(0.64-v.lift*0.1), bw*0.14, 0, 0, 6.3); c.fill();
    if (done){ var gg=c.createRadialGradient(v.x,v.y,2,v.x,v.y,bw*1.1); gg.addColorStop(0,'rgba('+hexRgb(COL[B[i][0]])+',0.45)'); gg.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=gg; c.fillRect(v.x-bw*1.2,v.y-bw*0.6,bw*2.4,bw*1.0); } }
  c.save(); c.translate(px, py); c.rotate(v.ang); c.scale(popS, popS);
  if (selC){ c.save(); c.shadowColor='rgba(255,228,92,0.9)'; c.shadowBlur=bw*0.5; bottlePath(c,0); c.fillStyle='rgba(255,228,92,0.12)'; c.fill(); c.restore(); }
  // glass back: a faint tint, darker toward the right
  bottlePath(c, 0); var gb=c.createLinearGradient(-bw/2,0,bw/2,0); gb.addColorStop(0,'rgba(200,225,255,0.16)'); gb.addColorStop(0.5,'rgba(200,225,255,0.06)'); gb.addColorStop(1,'rgba(20,10,30,0.25)'); c.fillStyle=gb; c.fill();
  // liquid
  c.save(); bottlePath(c, bw*0.075); c.clip();
  var tn=Math.tan(v.ang), X=bw, h=0, k, wob=still? Math.sin(tm*2.2+i)*bw*0.012 : 0;
  for (k=0;k<d.length;k++){ var u=d[k]; if (u.a<=0.001) continue; var h2=h+u.a*uh, lo=-h, hi=-h2;
    if (u.k){ var lg=c.createLinearGradient(0,hi,0,lo); lg.addColorStop(0,COL_HI[u.c]); lg.addColorStop(0.35,COL[u.c]); lg.addColorStop(1,COL_LO[u.c]); c.fillStyle=lg; } else c.fillStyle='#3b3348';
    c.beginPath(); c.moveTo(-X, (k===0? bh : lo+tn*X)); c.lineTo(X, (k===0? bh : lo-tn*X)); c.lineTo(X, hi-tn*X); c.lineTo(-X, hi+tn*X); c.closePath(); c.fill();
    if (k>0 && u.k){ c.fillStyle='rgba(0,0,0,0.22)'; c.beginPath(); c.moveTo(-X, lo+tn*X); c.lineTo(X, lo-tn*X); c.lineTo(X, lo-tn*X-1.6); c.lineTo(-X, lo+tn*X-1.6); c.closePath(); c.fill(); }
    if (u.k && u.a>0.95 && still && bw>=17){ var iy=-(h+u.a*uh/2); icon(c, DJ.ROLE[u.c], bw*0.02, iy+uh*0.04, uh*0.3, 'rgba(0,0,0,0.22)', 0); icon(c, DJ.ROLE[u.c], 0, iy, uh*0.3, 'rgba(255,255,255,0.95)', Math.max(1.5,uh*0.09)); }
    else if (!u.k && still){ c.fillStyle='rgba(255,255,255,0.55)'; c.font='900 '+Math.round(uh*0.62)+'px "Trebuchet MS",system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?', 0, -(h+u.a*uh/2)); }
    h=h2; }
  if (h>0 && d.length){ var tu=d[d.length-1]; if (tu.a<=0.001 && d.length>1) tu=d[d.length-2];
    // the surface: a lighter rounded top when standing, a thin bright line when tilted
    if (still){ c.fillStyle=tu.k? COL_HI[tu.c] : '#55506a'; c.beginPath(); c.ellipse(0,-h+wob,bw*0.5,bw*0.09,0,0,6.3); c.fill(); c.fillStyle='rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-bw*0.12,-h+wob-bw*0.015,bw*0.2,bw*0.035,0,0,6.3); c.fill(); }
    else { c.fillStyle=tu.k? COL_HI[tu.c] : '#55506a'; c.beginPath(); c.moveTo(-X, -h+tn*X); c.lineTo(X, -h-tn*X); c.lineTo(X, -h-tn*X+3); c.lineTo(-X, -h+tn*X+3); c.closePath(); c.fill(); }
    // slow bubbles
    if (still && bw>=20) for (k=0;k<3;k++){ var ph=(tm*0.28+k*0.37+i*0.13)%1, by=-ph*(h-bw*0.12)-bw*0.06, bx=Math.sin(tm*1.7+k*2+i)*bw*0.16+(k-1)*bw*0.12, br=bw*(0.035+0.02*((k+i)%2))*(0.6+ph*0.6);
      c.globalAlpha=0.5*(1-ph*ph); c.strokeStyle='rgba(255,255,255,0.9)'; c.lineWidth=Math.max(1,bw*0.02); c.beginPath(); c.arc(bx,by,br,0,6.3); c.stroke(); c.fillStyle='rgba(255,255,255,0.35)'; c.beginPath(); c.arc(bx-br*0.3,by-br*0.3,br*0.35,0,6.3); c.fill(); c.globalAlpha=1; }
    // light from the left, shade on the right, across all the layers
    var sg=c.createLinearGradient(-bw/2,0,bw/2,0); sg.addColorStop(0,'rgba(255,255,255,0.22)'); sg.addColorStop(0.25,'rgba(255,255,255,0.05)'); sg.addColorStop(0.65,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(0,0,0,0.32)'); c.fillStyle=sg; c.fillRect(-bw, -h-bw*0.2, bw*2, bh+h);
  }
  c.restore();
  // glass front: dark outline, inner light edge, long reflection on the left, a short one on the right, a thick round base
  bottlePath(c, 0); c.lineJoin='round'; c.lineWidth=Math.max(3, bw*0.1); c.strokeStyle=OL; c.stroke();
  c.lineWidth=Math.max(1.6, bw*0.045); c.strokeStyle= selC? '#fff3a0' : (magC? 'rgba(214,170,255,'+(0.75+Math.sin(tm*7)*0.25)+')' : 'rgba(225,238,255,0.85)'); c.stroke();
  c.fillStyle='rgba(255,255,255,0.32)'; c.beginPath(); c.roundRect(-bw*0.34, -bh*0.86, bw*0.1, bh*0.62, bw*0.05); c.fill();
  c.fillStyle='rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-bw*0.29, -bh*0.9, bw*0.05, bw*0.08, 0, 0, 6.3); c.fill();
  c.fillStyle='rgba(255,255,255,0.16)'; c.beginPath(); c.roundRect(bw*0.2, -bh*0.56, bw*0.06, bh*0.3, bw*0.03); c.fill();
  c.strokeStyle='rgba(255,255,255,0.35)'; c.lineWidth=Math.max(1,bw*0.035); c.beginPath(); c.arc(0, -bw*0.46, bw*0.34, Math.PI*0.62, Math.PI*0.9); c.stroke();
  // brass collar and glass lip
  var cy=-bh+bw*0.04, cg=c.createLinearGradient(0,cy,0,cy+bw*0.14); cg.addColorStop(0,'#f0cf7a'); cg.addColorStop(0.5,'#c9953a'); cg.addColorStop(1,'#7a5418');
  c.fillStyle=cg; c.beginPath(); c.roundRect(-bw*0.53, cy, bw*1.06, bw*0.14, bw*0.05); c.fill(); c.lineWidth=Math.max(1.4,bw*0.04); c.strokeStyle=OL; c.stroke();
  c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(-bw*0.45, cy+bw*0.025, bw*0.25, bw*0.03);
  var lipC= selC? '#fff3a0' : 'rgba(235,242,255,0.95)'; c.fillStyle=lipC; c.beginPath(); c.roundRect(-bw*0.6, -bh-bw*0.12, bw*1.2, bw*0.18, bw*0.09); c.fill(); c.lineWidth=Math.max(1.6,bw*0.05); c.strokeStyle=OL; c.stroke();
  c.fillStyle='rgba(120,140,170,0.45)'; c.fillRect(-bw*0.52, -bh-bw*0.02, bw*1.04, bw*0.04);
  // cork with wax seal and twine
  if (v.cork>0){ var ck=backOut(v.cork), off=(1-ck)*bw*1.2, lipY=-bh-bw*0.12, cw=bw*1.04, chh=bw*0.44, cy0=lipY-off, lw2=Math.max(1.4,bw*0.045); c.globalAlpha=Math.min(1,v.cork*3);
    var kg=c.createLinearGradient(-cw/2,0,cw/2,0); kg.addColorStop(0,'#e0b07a'); kg.addColorStop(0.45,'#b9824a'); kg.addColorStop(1,'#6e4422');
    // the plug pushed down into the neck (visible through the glass)
    c.fillStyle=kg; c.beginPath(); c.moveTo(-bw*0.44, cy0); c.lineTo(bw*0.44, cy0); c.lineTo(bw*0.4, cy0+bw*0.34); c.lineTo(-bw*0.4, cy0+bw*0.34); c.closePath(); c.fill(); c.lineWidth=lw2; c.strokeStyle=OL; c.stroke();
    c.fillStyle='rgba(255,255,255,0.18)'; c.fillRect(-bw*0.42, cy0+bw*0.02, bw*0.84, bw*0.04);
    // the cap, a little wider than the lip, slightly flared at the top
    c.fillStyle=kg; c.beginPath(); c.moveTo(-cw*0.47, cy0+bw*0.02); c.lineTo(cw*0.47, cy0+bw*0.02); c.lineTo(cw*0.5, cy0-chh); c.lineTo(-cw*0.5, cy0-chh); c.closePath(); c.fill(); c.lineWidth=lw2; c.strokeStyle=OL; c.stroke();
    c.fillStyle='rgba(90,50,20,0.45)'; [[-0.28,-0.3],[0.12,-0.55],[0.3,-0.2],[-0.05,-0.15],[-0.18,-0.7]].forEach(function(q){ c.beginPath(); c.arc(q[0]*cw, cy0+q[1]*chh, bw*0.026, 0, 6.3); c.fill(); });
    // the top of the cork: a lighter cut face, and a thin ribbon in the potion's colour tied round it
    c.fillStyle='#e8c08a'; c.beginPath(); c.ellipse(0, cy0-chh, cw*0.5, bw*0.09, 0, 0, 6.3); c.fill(); c.lineWidth=lw2; c.strokeStyle=OL; c.stroke();
    c.fillStyle='rgba(120,70,30,0.35)'; c.beginPath(); c.ellipse(0, cy0-chh, cw*0.3, bw*0.045, 0, 0, 6.3); c.fill();
    var rb=COL[B[i]&&B[i].length? B[i][0] : 0]; c.fillStyle=rb; c.fillRect(-cw*0.485, cy0-chh*0.42, cw*0.97, bw*0.09); c.strokeStyle=OL; c.lineWidth=Math.max(1,bw*0.03); c.strokeRect(-cw*0.485, cy0-chh*0.42, cw*0.97, bw*0.09);
    c.strokeStyle=rb; c.lineWidth=Math.max(1.2,bw*0.04); c.beginPath(); c.moveTo(cw*0.32,cy0-chh*0.34); c.quadraticCurveTo(cw*0.46,cy0-chh*0.05,cw*0.38,cy0+chh*0.3); c.stroke();
    if (done && ((tm*0.6+i*0.37)%1)<0.18){ var sp=((tm*0.6+i*0.37)%1)/0.18, sx=cw*0.42, sy=cy0-chh*0.9, ss=bw*0.16*Math.sin(sp*Math.PI); c.fillStyle='#fffbe0'; c.beginPath(); c.moveTo(sx,sy-ss); c.lineTo(sx+ss*0.25,sy); c.lineTo(sx,sy+ss); c.lineTo(sx-ss*0.25,sy); c.closePath(); c.fill(); c.beginPath(); c.moveTo(sx-ss,sy); c.lineTo(sx,sy+ss*0.25); c.lineTo(sx+ss,sy); c.lineTo(sx,sy-ss*0.25); c.closePath(); c.fill(); }
    c.globalAlpha=1; }
  c.restore();
}
function drawChains(c, v, dt, t){
  if (v.unlk>0){ v.unlk=Math.max(0,v.unlk-dt); var u2=v.unlk/0.5; c.globalAlpha=u2; } else if (!(v.lock>0)) return;
  if (v.lkIn>0) v.lkIn=Math.max(0,v.lkIn-dt);
  var sc=1+(v.lkIn>0? v.lkIn*1.2 : 0)+(v.unlk>0? (1-v.unlk/0.5)*0.4 : 0), cy=v.y-bh*0.5, len=bh*0.62*sc, n=8, lw=Math.max(6,bw*0.2);
  c.save(); c.translate(v.x,cy);
  [-0.6,0.6].forEach(function(an){ c.save(); c.rotate(an); for (var q=0;q<n;q++){ var x=-len/2+q*len/(n-1); c.beginPath(); c.ellipse(x,0,lw*0.75,lw*0.45,0,0,6.3); c.lineWidth=lw*0.55; c.strokeStyle=OL; c.stroke(); c.lineWidth=lw*0.32; c.strokeStyle= q%2? '#9aa4b4' : '#c9d0d8'; c.stroke(); } c.restore(); });
  var pr=bw*0.3; rr(c,-pr,-pr*0.2,pr*2,pr*1.5,pr*0.3); fs(c,'#c99a2a',2.5); c.beginPath(); c.arc(0,-pr*0.2,pr*0.62,Math.PI,0); c.lineWidth=pr*0.28; c.strokeStyle=OL; c.stroke(); c.lineWidth=pr*0.16; c.strokeStyle='#9aa4b4'; c.stroke();
  if (v.lock>0) txt(c,''+v.lock,0,pr*0.55,Math.max(12,pr*1.1),'#fff');
  c.restore(); c.globalAlpha=1;
}
function hexRgb(h){ var n=parseInt(h.slice(1),16); return (n>>16)+','+((n>>8)&255)+','+(n&255); }
// The room behind everything: a potion cellar. Stone wall and floor tinted by the current zone, pillars with wall torches at the
// sides, and (where the window leaves room) shelves of odds and ends, a barrel and a bubbling cauldron. Flames, bubbles and dust move.
var bgKey='', bgFx={fl:[], pot:null}, motes=[];
function drawBg(){
  var scn=VS? VS.scn : 0, th=THEMES[scn], key=[cv.width,cv.height,scn,V.length].join();
  if (!bgCache || bgKey!==key){
    bgKey=key; bgFx={fl:[], pot:null};
    bgCache=document.createElement('canvas'); bgCache.width=cv.width; bgCache.height=cv.height; var c=bgCache.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0); c.lineJoin='round';
    var u=STG.u||1, wide=VW>=700, fy=VH-Math.max(64, VH*0.12), pw=Math.round(Math.max(16, Math.min(96, VW*0.05))), r=DJ_rnd(scn*13+5), i, x, y;
    var g=c.createLinearGradient(0,0,0,fy); g.addColorStop(0,shade(th.w1,-0.25)); g.addColorStop(0.4,shade(th.w0,-0.35)); g.addColorStop(1,shade(th.w1,-0.3)); c.fillStyle=g; c.fillRect(0,0,VW,VH);
    // stone blocks, a few of them lighter or darker
    var bhh=Math.round(44*Math.max(1,u*0.8)), bww=bhh*2.4, row=0;
    for (y=0; y<fy; y+=bhh, row++) for (x=(row%2? -bww/2 : 0); x<VW; x+=bww){ var q=r(); c.fillStyle= q<0.12? 'rgba(255,255,255,0.045)' : (q<0.26? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0)'); c.beginPath(); c.roundRect(x+2,y+2,bww-4,bhh-4,4); c.fill(); c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=2; c.stroke(); }
    // floor
    g=c.createLinearGradient(0,fy-18,0,fy); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.45)'); c.fillStyle=g; c.fillRect(0,fy-18,VW,18);
    g=c.createLinearGradient(0,fy,0,VH); g.addColorStop(0,shade(th.fd,-0.2)); g.addColorStop(1,shade(th.fd,-0.6)); c.fillStyle=g; c.fillRect(0,fy,VW,VH-fy);
    c.strokeStyle='rgba(0,0,0,0.28)'; c.lineWidth=2; for (i=-12;i<=12;i++){ c.beginPath(); c.moveTo(VW/2+i*VW/14,fy); c.lineTo(VW/2+i*VW/14*1.7,VH); c.stroke(); }
    c.beginPath(); c.moveTo(0,fy+(VH-fy)*0.4); c.lineTo(VW,fy+(VH-fy)*0.4); c.stroke(); c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(0,fy,VW,2);
    // warm light from the two wall torches
    var ty=Math.min(fy-90, VH*0.5);
    [pw*0.5, VW-pw*0.5].forEach(function(tx){ var rg=c.createRadialGradient(tx,ty,4,tx,ty,Math.max(VW,VH)*0.4); rg.addColorStop(0,'rgba('+th.gl+',0.3)'); rg.addColorStop(1,'rgba('+th.gl+',0)'); c.fillStyle=rg; c.fillRect(0,0,VW,VH); });
    // shelves under each row
    var rows={}; V.forEach(function(v){ rows[v.row]=rows[v.row]||{y:v.y, x0:1e9, x1:-1e9}; rows[v.row].x0=Math.min(rows[v.row].x0,v.x); rows[v.row].x1=Math.max(rows[v.row].x1,v.x); });
    Object.keys(rows).forEach(function(k){ var o=rows[k], x0=Math.max(6,o.x0-bw*1.3), x1=Math.min(VW-6,o.x1+bw*1.3), y=o.y+1, th=Math.max(10,bw*0.3);
      c.fillStyle='rgba(0,0,0,0.3)'; c.fillRect(x0+4,y+th,x1-x0,8);
      var wg=c.createLinearGradient(0,y,0,y+th); wg.addColorStop(0,'#c58a52'); wg.addColorStop(0.25,'#a0683a'); wg.addColorStop(1,'#6e4224'); c.fillStyle=wg; c.beginPath(); c.roundRect(x0,y,x1-x0,th,4); c.fill();
      c.fillStyle='rgba(255,230,190,0.25)'; c.fillRect(x0+3,y+1,x1-x0-6,2);
      c.fillStyle='#5a361c'; [x0+14,x1-22].forEach(function(bx){ c.fillRect(bx,y+th,8,th*0.9); }); });
    // side shelves with odds and ends, only where the bottles leave the wall free
    var bx0=1e9, bx1=-1e9, by0=1e9, by1=-1e9; V.forEach(function(v){ bx0=Math.min(bx0,v.x-bw*1.5); bx1=Math.max(bx1,v.x+bw*1.5); by0=Math.min(by0,v.y-bh); by1=Math.max(by1,v.y); });
    var prop=function(kind,px,py,k){ c.lineWidth=2.5; c.strokeStyle=OL;
      if (kind==='flask'){ c.beginPath(); c.arc(px,py-11*k,11*k,0,6.3); c.fillStyle='rgba(255,255,255,0.14)'; c.fill(); c.stroke(); c.save(); c.beginPath(); c.arc(px,py-11*k,9*k,0,6.3); c.clip(); c.fillStyle=COL[Math.floor(r()*8)]; c.fillRect(px-12*k,py-13*k,24*k,14*k); c.restore(); rr(c,px-4*k,py-30*k,8*k,10*k,2); c.fillStyle='rgba(255,255,255,0.2)'; c.fill(); c.stroke(); rr(c,px-5*k,py-34*k,10*k,5*k,2); c.fillStyle='#b9824a'; c.fill(); c.stroke(); }
      else if (kind==='skull'){ el(c,px,py-13*k,12*k,11*k); c.fillStyle='#e8e2d0'; c.fill(); c.stroke(); rr(c,px-7*k,py-7*k,14*k,7*k,2); c.fill(); c.stroke(); c.fillStyle=OL; el(c,px-4.5*k,py-14*k,3.2*k); c.fill(); el(c,px+4.5*k,py-14*k,3.2*k); c.fill(); }
      else if (kind==='books'){ [['#a8483a',26,0],['#3a6aa8',22,2],['#4a8a4a',24,-1]].forEach(function(bk,j){ rr(c,px-bk[1]*k/2+bk[2]*k,py-(j+1)*9*k,bk[1]*k,9*k,2); c.fillStyle=bk[0]; c.fill(); c.stroke(); c.fillStyle='#ffe98a'; c.fillRect(px-bk[1]*k/2+bk[2]*k+3*k,py-(j+1)*9*k+3*k,4*k,3*k); }); }
      else if (kind==='candle'){ rr(c,px-4.5*k,py-20*k,9*k,20*k,2); c.fillStyle='#f3efe2'; c.fill(); c.stroke(); rr(c,px-9*k,py-3*k,18*k,5*k,2); c.fillStyle='#8a8090'; c.fill(); c.stroke(); bgFx.fl.push({x:px, y:py-21*k, s:0.6*k}); } };
    var pk=Math.max(1, Math.min(2, u)), shelf=function(x0,x1,sy,items){ var th2=10*pk; c.fillStyle='rgba(0,0,0,0.3)'; c.fillRect(x0+4,sy+th2,x1-x0,7); var wg=c.createLinearGradient(0,sy,0,sy+th2); wg.addColorStop(0,'#b07a46'); wg.addColorStop(1,'#5e391e'); c.fillStyle=wg; c.beginPath(); c.roundRect(x0,sy,x1-x0,th2,3); c.fill(); c.lineWidth=2; c.strokeStyle=OL; c.stroke();
      c.fillStyle='#4a2c16'; [x0+10,x1-16].forEach(function(q2){ c.fillRect(q2,sy+th2,6,10); }); var n2=Math.max(1,Math.min(items.length, Math.floor((x1-x0)/(38*pk)))); for (var j=0;j<n2;j++) prop(items[j], x0+(x1-x0)*(j+0.5)/n2, sy, pk); };
    if (V.length && bx0-pw>96){ var sx0=pw+16, sx1=Math.min(bx0-18, pw+250*u), sy1=by0+(by1-by0)*0.42; shelf(sx0,sx1,sy1,['flask','skull','candle','flask']); if (by1-by0>190) shelf(sx0+14,sx1-10,sy1+(by1-by0)*0.42,['books','flask','flask']); }
    if (V.length && VW-pw-bx1>96){ var tx0=Math.max(bx1+18, VW-pw-250*u), tx1=VW-pw-16, sy2=by0+(by1-by0)*0.42; shelf(tx0,tx1,sy2,['candle','books','flask','skull']); if (by1-by0>190) shelf(tx0+10,tx1-14,sy2+(by1-by0)*0.42,['flask','flask','candle']); }
    // pillars with a torch each
    [0, VW-pw].forEach(function(px,si){ var pg=c.createLinearGradient(px,0,px+pw,0); pg.addColorStop(0,shade(th.fl,-0.3)); pg.addColorStop(0.35,shade(th.fl,-0.05)); pg.addColorStop(1,shade(th.fd,-0.35)); c.fillStyle=pg; c.fillRect(px,0,pw,fy+6);
      c.strokeStyle=OL; c.lineWidth=2.5; c.beginPath(); c.moveTo(si? px : px+pw, 0); c.lineTo(si? px : px+pw, fy+6); c.stroke();
      c.strokeStyle='rgba(0,0,0,0.22)'; c.lineWidth=2; for (var yy=60; yy<fy; yy+=90){ c.beginPath(); c.moveTo(px,yy); c.lineTo(px+pw,yy); c.stroke(); }
      c.fillStyle=shade(th.fl,-0.12); c.beginPath(); c.roundRect(px-(si?6:0), fy-10, pw+6, 20, 4); c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke();
      var tx2=px+pw/2, k2=Math.max(0.8, Math.min(1.8, pw/34)); c.fillStyle='#5a3d24'; poly(c,[tx2-5*k2,ty,tx2+5*k2,ty,tx2+2.5*k2,ty+18*k2,tx2-2.5*k2,ty+18*k2]); c.fill(); c.stroke(); rr(c,tx2-8*k2,ty-4*k2,16*k2,6*k2,2); c.fillStyle='#8a8090'; c.fill(); c.stroke(); bgFx.fl.push({x:tx2, y:ty-5*k2, s:k2, big:1}); });
    // a barrel on the left and a bubbling cauldron on the right, when the bottom row leaves the corners free
    var free=(VW-(STG.u? 608*u : VW))/2-pw, fk=Math.max(1, Math.min(2, u*0.9)), base=VH-10;
    if (wide && free>84*fk){ var bx=pw+46*fk; rr(c,bx-26*fk,base-58*fk,52*fk,58*fk,10*fk); c.fillStyle='#8a5a2a'; c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke(); c.fillStyle='#5a5a66'; [base-46*fk, base-16*fk].forEach(function(q3){ c.fillRect(bx-27*fk,q3,54*fk,6*fk); c.strokeRect(bx-27*fk,q3,54*fk,6*fk); }); c.strokeStyle='rgba(0,0,0,0.25)'; [-10,6].forEach(function(q4){ c.beginPath(); c.moveTo(bx+q4*fk,base-56*fk); c.lineTo(bx+q4*fk,base-2); c.stroke(); });
      var cxp2=VW-pw-52*fk; c.strokeStyle=OL; c.lineWidth=2.5; c.fillStyle='#2a2630'; c.beginPath(); c.ellipse(cxp2,base-24*fk,34*fk,26*fk,0,0,6.3); c.fill(); c.stroke(); rr(c,cxp2-36*fk,base-48*fk,72*fk,9*fk,4*fk); c.fillStyle='#3a3642'; c.fill(); c.stroke(); el(c,cxp2,base-45*fk,30*fk,6*fk); c.fillStyle='#59d86a'; c.fill(); c.stroke();
      c.fillStyle='#2a2630'; [-22,22].forEach(function(q5){ rr(c,cxp2+q5*fk-4*fk,base-6*fk,8*fk,8*fk,2); c.fill(); c.stroke(); }); bgFx.pot={x:cxp2, y:base-46*fk, r:26*fk}; }
    var vg=c.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.35,VW/2,VH/2,Math.max(VW,VH)*0.78); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)'); c.fillStyle=vg; c.fillRect(0,0,VW,VH);
  }
  cx.setTransform(1,0,0,1,0,0); cx.drawImage(bgCache,0,0);
}
function drawBgFx(c, dt, t){
  var th=THEMES[VS? VS.scn : 0], i;
  bgFx.fl.forEach(function(f,fi){ var fl=0.85+Math.sin(t*11+fi*2)*0.1+Math.sin(t*23+fi)*0.06, fh=(f.big?22:14)*f.s*fl, fw=(f.big?8:5)*f.s, col= f.big? 'rgb('+th.gl+')' : '#ffb04a';
    var rg=c.createRadialGradient(f.x,f.y-fh*0.4,1,f.x,f.y-fh*0.4,(f.big?70:34)*f.s); rg.addColorStop(0,'rgba('+(f.big?th.gl:'255,176,74')+','+(0.32*fl)+')'); rg.addColorStop(1,'rgba(255,176,74,0)'); c.fillStyle=rg; c.fillRect(f.x-80*f.s,f.y-90*f.s,160*f.s,150*f.s);
    c.fillStyle=col; c.beginPath(); c.moveTo(f.x-fw,f.y); c.quadraticCurveTo(f.x-fw*1.2,f.y-fh*0.5,f.x+Math.sin(t*9+fi)*2*f.s,f.y-fh); c.quadraticCurveTo(f.x+fw*1.2,f.y-fh*0.5,f.x+fw,f.y); c.closePath(); c.fill();
    c.fillStyle='#fff6c9'; c.beginPath(); c.moveTo(f.x-fw*0.5,f.y); c.quadraticCurveTo(f.x-fw*0.6,f.y-fh*0.3,f.x,f.y-fh*0.55); c.quadraticCurveTo(f.x+fw*0.6,f.y-fh*0.3,f.x+fw*0.5,f.y); c.closePath(); c.fill(); });
  if (bgFx.pot){ var p=bgFx.pot; for (i=0;i<4;i++){ var ph=(t*0.5+i*0.27)%1, bx=p.x+Math.sin(i*2.4+1)*p.r*0.7, by=p.y-ph*p.r*1.6; c.globalAlpha=(1-ph)*0.8; c.fillStyle='#8df07a'; c.beginPath(); c.arc(bx+Math.sin(t*2+i)*3,by,(2+i%3)*p.r/26*(0.6+ph*0.8),0,6.3); c.fill(); } c.globalAlpha=1; }
  if (motes.length<16) motes.push({x:Math.random()*VW, y:Math.random()*VH, v:6+Math.random()*10, r:1+Math.random()*1.6, p:Math.random()*6});
  c.fillStyle='rgba(255,235,200,0.16)'; motes.forEach(function(m){ m.y-=m.v*dt; m.x+=Math.sin(t*0.7+m.p)*6*dt; if (m.y<-5){ m.y=VH+5; m.x=Math.random()*VW; } c.beginPath(); c.arc(m.x,m.y,m.r,0,6.3); c.fill(); });
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
  drawBgFx(c, dt, performance.now()/1000);
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
  for (i=0;i<V.length;i++) drawChains(c, V[i], dt, now/1000);
  anims.forEach(function(a){ var s=a.stream; if (!s) return; var w=bw*0.13*s.k*(1-s.out), ya=s.y0+(s.y1-s.y0)*s.out*0, yb=s.y0+(s.y1-s.y0)*Math.min(1,s.k*1.2);
    if (w<=0.3) return; c.fillStyle=COL[a.c]; c.beginPath(); c.roundRect(s.x-w/2, ya, w, Math.max(0,yb-ya), w/2); c.fill();
    c.fillStyle=COL_HI[a.c]; c.fillRect(s.x-w/2, ya, w*0.35, Math.max(0,yb-ya)); });
  for (i=0;i<V.length;i++) if (V[i].ang || V[i].ox) drawBottle(V[i], i);
  // hint arrow / tutorial arrow
  var hm = (hintMv && now<hintUntil) ? hintMv : (L.tut && !won && !lost && !anims.length ? (tutMv||(tutMv=nextHint())) : null);
  if (anims.length) tutMv=null;
  if (hm && !won){ var ti = sel===hm[0] ? hm[1] : (sel<0 ? hm[0] : -1); if (ti>=0 && V[ti]){ var hv=V[ti], ay=hv.y-bh-bw*0.75-hv.lift*bw*0.55+Math.sin(now/160)*5;
    c.fillStyle='#ffe45c'; c.strokeStyle='#2a1a2e'; c.lineWidth=3; c.beginPath(); c.moveTo(hv.x, ay+bw*0.4); c.lineTo(hv.x-bw*0.34, ay); c.lineTo(hv.x-bw*0.13, ay); c.lineTo(hv.x-bw*0.13, ay-bw*0.42); c.lineTo(hv.x+bw*0.13, ay-bw*0.42); c.lineTo(hv.x+bw*0.13, ay); c.lineTo(hv.x+bw*0.34, ay); c.closePath(); c.stroke(); c.fill(); } }
  if (choosing && V.length){ c.fillStyle='rgba(12,7,16,0.62)'; c.fillRect(BA.x0-10, STG.sd? 0 : BA.top-2, BA.x1-BA.x0+20, VH); }
  // particles
  for (i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t-=dt; if (p.t<=0 || p.y>VH+30){ parts.splice(i,1); continue; } p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    c.globalAlpha=Math.min(1,p.t*2); c.fillStyle=p.c;
    if (p.rect){ p.rot+=p.vr*dt; c.save(); c.translate(p.x,p.y); c.rotate(p.rot); c.fillRect(-p.r,-p.r*0.5,p.r*2,p.r); c.restore(); } else { c.beginPath(); c.arc(p.x,p.y,p.r,0,6.3); c.fill(); } }
  c.globalAlpha=1;
}
var tutMv=null, plan=null;
// hints follow one stored solution, so repeated hints always make progress
function nextHint(){ if (!plan || !plan.length) plan=DJ.solve(B); var m= plan && plan.length ? plan[0] : null; if (m && ((V[m[0]]&&V[m[0]].lock>0)||(V[m[1]]&&V[m[1]].lock>0))) return null; return m; }


// ---------------- UI icons: every emoji in the HUD/menus is swapped for a drawn icon in one style (gold/colour fill, dark outline) ----------------
var ICO=(function(){ var O='#2a1820';
  function g(body,sw){ return '<g stroke="'+O+'" stroke-width="'+(sw||2.2)+'" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke">'+body+'</g>'; }
  function line(d,col,w){ return '<path d="'+d+'" fill="none" stroke="'+O+'" stroke-width="'+(w+3.4)+'" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>'; }
  var GOLD='#ffd76a', GH='#fff3c4';
  var I={
    atk: g('<polygon transform="rotate(40)" points="-1.8,2.5 -1.8,-7 0,-10.4 1.8,-7 1.8,2.5 5.4,2.5 5.4,4.9 1.4,4.9 1.4,10.2 -1.4,10.2 -1.4,4.9 -5.4,4.9 -5.4,2.5" fill="#e9eef6"/><polygon transform="rotate(40)" points="5.4,2.5 5.4,4.9 -5.4,4.9 -5.4,2.5" fill="'+GOLD+'" stroke="none"/>'),
    shd: g('<path d="M0,-9.6 L8.4,-6.6 L8.4,0 Q7.8,7.2 0,10.2 Q-7.8,7.2 -8.4,0 L-8.4,-6.6Z" fill="#6fa8ff"/><path d="M0,-6.6 L5.4,-4.6 L5.4,0 Q5,4.8 0,7" fill="#a9ccff" stroke="none"/>'),
    heal: g('<path d="M0,9.4 C-15.4,-0.5 -8,-12.8 0,-4.6 C8,-12.8 15.4,-0.5 0,9.4Z" fill="#ff5f7a"/><ellipse cx="-4.6" cy="-3.6" rx="2" ry="1.4" fill="#ffc2cc" stroke="none"/>'),
    heal2: g('<path d="M0,9.4 C-15.4,-0.5 -8,-12.8 0,-4.6 C8,-12.8 15.4,-0.5 0,9.4Z" fill="#5fd068"/><ellipse cx="-4.6" cy="-3.6" rx="2" ry="1.4" fill="#c8f5c0" stroke="none"/>'),
    stun: g('<polygon points="3,-10.4 -6.4,1.4 -0.6,1.4 -3.2,10.4 6.4,-2.2 0.6,-2.2" fill="#ffe14a"/>'),
    psn: g('<circle cx="0" cy="-2" r="7.8" fill="#d3b0ff"/><rect x="-4.3" y="3" width="8.6" height="6.4" rx="1.4" fill="#d3b0ff"/><circle cx="0" cy="-2" r="7.8" fill="#d3b0ff" stroke="none"/>')+'<circle cx="-3" cy="-1.8" r="2.3" fill="'+O+'"/><circle cx="3" cy="-1.8" r="2.3" fill="'+O+'"/><rect x="-0.6" y="4.4" width="1.2" height="5" fill="'+O+'"/>',
    mag: g('<polygon points="0,-10.4 2.5,-2.5 10.4,0 2.5,2.5 0,10.4 -2.5,2.5 -10.4,0 -2.5,-2.5" fill="#f3e2ff"/><polygon points="7,-10 8,-7.6 10.4,-6.6 8,-5.6 7,-3.2 6,-5.6 3.6,-6.6 6,-7.6" fill="'+GOLD+'"/>',1.6),
    ad: g('<rect x="-10.4" y="-7.6" width="20.8" height="15.2" rx="4" fill="#8b5cf6"/><polygon points="-3,-4.4 5,0 -3,4.4" fill="#fff" stroke="none"/>',1.8),
    flask: g('<path d="M-3.4,-10 H3.4 V-4 L9.4,5.4 A3,3 0 0 1 6.8,10 H-6.8 A3,3 0 0 1 -9.4,5.4 L-3.4,-4Z" fill="#cfeaff"/><path d="M-6.2,0.8 H6.2 L9.2,5.6 A2.6,2.6 0 0 1 6.8,9.4 H-6.8 A2.6,2.6 0 0 1 -9.2,5.6Z" fill="#5fd068" stroke="none"/><rect x="-4.4" y="-11.6" width="8.8" height="3" rx="1.2" fill="#b98a52"/><path d="M-5.6,6.6 L-2.8,2" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8"/>'),
    plus: g('<circle cx="0" cy="0" r="5.4" fill="'+GOLD+'"/>',1.8)+'<path d="M-2.8,0 H2.8 M0,-2.8 V2.8" stroke="'+O+'" stroke-width="1.9" stroke-linecap="round"/>',
    undo: line('M7.6,9 V2.6 A6.4,6.4 0 0 0 1.2,-3.8 H-4.4',GOLD,3.8)+g('<polygon points="-10.4,-3.8 -3.4,-10 -3.4,2.4" fill="'+GOLD+'"/>'),
    redo: line('M6.6,2.4 A7,7 0 1 1 3.5,-6.06',GOLD,3.8)+g('<polygon points="8.4,-3.2 1,-1.4 5.8,-11" fill="'+GOLD+'"/>'),
    bulb: g('<path d="M-4,4.4 C-4,1 -7.6,-0.4 -7.6,-4 A7.6,7.6 0 0 1 7.6,-4 C7.6,-0.4 4,1 4,4.4Z" fill="#ffe680"/><rect x="-4.2" y="4.2" width="8.4" height="5.4" rx="1.6" fill="#b9a68a"/>')+'<path d="M-4,6.4 H4" stroke="'+O+'" stroke-width="1.2"/><path d="M-4,-5.2 A4.4,4.4 0 0 1 -0.4,-8.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    spk: g('<polygon points="-10,-3.6 -5,-3.6 1,-9.2 1,9.2 -5,3.6 -10,3.6" fill="'+GOLD+'"/>')+line('M4.8,-4 Q7.8,0 4.8,4',GOLD,2.2)+line('M7.8,-7.4 Q12.6,0 7.8,7.4',GOLD,2.2),
    mute: g('<polygon points="-10,-3.6 -5,-3.6 1,-9.2 1,9.2 -5,3.6 -10,3.6" fill="#b9a68a"/>')+line('M4.6,-3.6 L10.6,3.6 M10.6,-3.6 L4.6,3.6','#ff6a5a',2.4),
    globe: g('<circle cx="0" cy="0" r="9.6" fill="#5fa8f0"/>')+'<path d="M-5,-6 Q-1,-3 -3,0 Q-6,2 -5,6 Q-8,3 -8.4,0 Q-8,-4 -5,-6Z M2,-8.6 Q6,-6 4,-3 Q8,-1 7.4,3 Q5,6 2,8.4 Q3,3 0,1 Q3,-3 2,-8.6Z" fill="#7ad37a" stroke="'+O+'" stroke-width="1"/><circle cx="0" cy="0" r="9.6" fill="none" stroke="'+O+'" stroke-width="2"/><ellipse cx="0" cy="0" rx="4.2" ry="9.6" fill="none" stroke="'+O+'" stroke-width="1" opacity=".55"/><path d="M-9.6,0 H9.6" stroke="'+O+'" stroke-width="1" opacity=".55"/>',
    ques: g('<circle cx="0" cy="0" r="9.8" fill="#8b5cf6"/>')+'<text x="0" y="5.4" text-anchor="middle" font-size="15" font-weight="900" font-family="Arial,sans-serif" fill="#fff">?</text>',
    door: g('<path d="M-8,10.4 V-1.6 A8,8 0 0 1 8,-1.6 V10.4Z" fill="#8a8494"/><path d="M-4.8,10.4 V-1 A4.8,4.8 0 0 1 4.8,-1 V10.4Z" fill="#ffd76a"/>')+'<circle cx="-8" cy="-5" r="1.8" fill="#ffe680" stroke="'+O+'" stroke-width="1"/><circle cx="8" cy="-5" r="1.8" fill="#ffe680" stroke="'+O+'" stroke-width="1"/>',
    chain: '<g transform="rotate(-40)">'+line('M-9,-2.6 H-1 A2.6,2.6 0 0 1 -1,2.6 H-9 A2.6,2.6 0 0 1 -9,-2.6Z','#c9ccd6',2.2)+line('M1,-2.6 H9 A2.6,2.6 0 0 1 9,2.6 H1 A2.6,2.6 0 0 1 1,-2.6Z','#c9ccd6',2.2)+line('M-3.4,0 H3.4','#e9ecf2',2.2)+'</g>',
    boom: g('<polygon points="0,-11 2.6,-5 9,-8 5.6,-2 11,1 4.8,3 7,10 1,5.4 -3,11 -3.4,4.6 -10.4,6 -6,0.4 -11,-4.4 -4.2,-4 -5.4,-10.4" fill="#ff8a3c"/><polygon points="0,-5.4 1.6,-1.8 5,-1.6 2.2,1.2 3,5 0,3 -3,5 -2.2,1.2 -5,-1.6 -1.6,-1.8" fill="#ffe14a" stroke="none"/>',1.8),
    broke: g('<path d="M0,9.4 C-15.4,-0.5 -8,-12.8 0,-4.6 L-2.4,0 L1.6,2.4 L-1,6.6 Z" fill="#c23a4e"/><path d="M1.6,9 L3.4,5.6 L0.4,3 L3.2,-1.2 L1.2,-4 C8.6,-12 15.4,-0.6 1.6,9Z" fill="#c23a4e"/>'),
    star: g('<polygon points="0,-10.4 3,-3.4 10.4,-3.2 4.6,1.8 6.6,9.4 0,5.2 -6.6,9.4 -4.6,1.8 -10.4,-3.2 -3,-3.4" fill="#ffe14a"/>'),
    play: g('<polygon points="-6,-9 9,0 -6,9" fill="#fff"/>',2),
    up: g('<polygon points="0,-9 8,0 3,0 3,8.4 -3,8.4 -3,0 -8,0" fill="#fff"/>',1.6),
    helm: g('<path d="M0,-12 Q7,-14.5 10.4,-8 Q5,-9.6 1.4,-7.4Z" fill="#d8402f"/><path d="M-8.4,10 V-0.6 A8.4,9.4 0 0 1 8.4,-0.6 V10 Q0,7.6 -8.4,10Z" fill="#d4d8e2"/><path d="M-1.4,-9.6 Q0,-11 1.4,-9.6 V9 H-1.4Z" fill="'+GOLD+'"/>')+'<path d="M-6.4,0.6 H6.4 M0,0.6 V7.4" stroke="'+O+'" stroke-width="2.6" stroke-linecap="round"/><circle cx="-3.4" cy="0.6" r="0.9" fill="#ff4a3a"/><circle cx="3.4" cy="0.6" r="0.9" fill="#ff4a3a"/><path d="M-6.4,-2.6 A7,7 0 0 1 -3,-7.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>',
    arr: g('<polygon points="0,-8.6 9,5.6 -9,5.6" fill="#3a2440" stroke="#3a2440" stroke-width="2.6"/>')
  };
  function svg(n){ return '<svg viewBox="-12 -12 24 24" aria-hidden="true">'+I[n]+'</svg>'; }
  return { svg:svg, has:function(n){ return !!I[n]; } };
})();
var EMO={'📺':'ad','⚔':'atk','🛡':'shd','❤':'heal','💚':'heal2','⚡':'stun','☠':'psn','✨':'mag','🧪':'flask','↩':'undo','🔄':'redo','💡':'bulb','🔊':'spk','🔇':'mute','🌐':'globe','❓':'ques','🚪':'door','⛓':'chain','💥':'boom','💫':'broke','⬆':'up','▶':'play','👹':'#boss','🐉':'#big','💀':'#n'};
var EMO_RE=new RegExp('('+Object.keys(EMO).join('|')+')️?','g'), EMO_T=new RegExp(EMO_RE.source), MARKS={};
function markUrl(k){ if (!MARKS[k]){ var cv2=document.createElement('canvas'); cv2.width=cv2.height=96; bossMark(cv2.getContext('2d'),48,k==='n'?54:56,k==='n'?34:30,k); MARKS[k]=cv2.toDataURL(); } return MARKS[k]; }
function icEl(n){ var e=document.createElement('span'); e.className='ic';
  if (n.charAt(0)==='#'){ var im=document.createElement('img'); im.src=markUrl(n.slice(1)); im.alt=''; e.appendChild(im); } else e.innerHTML=ICO.svg(n); return e; }
function emoNode(t){ var s=t.nodeValue, p=t.parentNode; if (!p || !EMO_T.test(s) || /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(p.nodeName)) return;
  var f=document.createDocumentFragment(), i=0; s.replace(EMO_RE, function(m,k,off){ if (off>i) f.appendChild(document.createTextNode(s.slice(i,off))); f.appendChild(icEl(EMO[k])); i=off+m.length; return m; });
  if (i<s.length) f.appendChild(document.createTextNode(s.slice(i))); p.replaceChild(f,t); }
function emoScan(root){ if (/^(SCRIPT|STYLE)$/.test(root.nodeName)) return; var w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list=[], n; while ((n=w.nextNode())) list.push(n); list.forEach(emoNode); }
function emoWatch(){ emoScan(document.body); new MutationObserver(function(ms){ ms.forEach(function(m){ if (m.type==='characterData') emoNode(m.target); else [].forEach.call(m.addedNodes, function(n){ if (n.nodeType===3) emoNode(n); else if (n.nodeType===1) emoScan(n); }); }); }).observe(document.body, {childList:true, subtree:true, characterData:true}); }
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
  $('undoN').textContent = undoLeft>0 ? undoLeft : '📺'; $('undoN').classList.toggle('ad', undoLeft<=0); $('bAdd').style.opacity = extra>=2 ? 0.35 : 1;
}
function applyLang(){
  document.querySelectorAll('[data-t]').forEach(function(e){ e.textContent=tl(e.dataset.t); });
  $('langNm').textContent=LANG_NAMES[LANG];
  var ll=$('langList'); ll.innerHTML=''; CODES.forEach(function(c){ var b=document.createElement('button'); b.className='lgb'+(c===LANG?' on':''); b.textContent=LANG_NAMES[c]; b.onclick=function(){ Snd.pop(); $('langM').classList.remove('show'); setLang(c); }; ll.appendChild(b); });
}
$('langBtn').onclick=function(){ Snd.unlock(); if (PF.adBusy) return; $('langM').classList.add('show'); };
$('langM').onclick=function(e){ if (e.target===this) this.classList.remove('show'); };
function setLang(c){ LANG=c; try{localStorage.setItem('dj_lang',LANG);}catch(e){} applyLang(); if (L){ updHud(); if ($('shopM').classList.contains('show')) drawShop(); if ($('mapM').classList.contains('show')) openMap(); if ($('gearM').classList.contains('show')) buildGear(); setTut(L.tut&&moved<2? tl(curStage? 'tutB2' : 'tutA2') : ''); } }
$('sndBtn').onclick=function(){ var on=Snd.toggle(); this.textContent=on?'🔊':'🔇'; };
$('sndBtn').textContent=Snd.isOn()?'🔊':'🔇';
$('lsRetry').onclick=function(){ $('loseM').classList.remove('show'); loadLevel(SAVE.level, false, curStage, Math.max(entryHp, Math.round(F.heroMax*0.6)), curLane, curType); };
$('lsRevive').onclick=function(){ var b=this; b.disabled=true; PF.rewarded(function(ok){ if (!ok){ b.disabled=false; return; } $('loseM').classList.remove('show'); revived=true; F.hHp=Math.round(F.heroMax*0.7); VS.hHp=F.hHp; F.shield++; VS.shield++; VS.shPop=0.45; VS.hGlow=0.5; VS.hDead=0; lost=false; stuckShown=false; Snd.buy(); }); };
$('bUndo').onclick=undo; $('bRestart').onclick=restart; $('bAdd').onclick=addBottle; $('bHint').onclick=showHint;
$('wnNext').onclick=function(){ if (PF.adBusy || $('shopM').classList.contains('show') || $('lootM').classList.contains('show') || $('cardM').classList.contains('show')) return; $('winM').classList.remove('show');
  var go=function(){ floorTransition(SAVE.level, function(){ startFloor(SAVE.level); }); };
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
  if (fr.length===1 && nb.length===1 && t!=='r' && t!=='c'){ setGate(nb[0]); nextRoom=nb[0]; walk=0.001; drawMap($('mini'), false); }
  else { choosing=true; drawMap($('mini'), false); if (!SAVE.dT){ SAVE.dT=1; saveNow(); banner(tl('doorTip'), '', 4200); } } }
function setGate(id){ var h=nodeAt(RT.at), r=nodeAt(id); walkGate={dx:r.x-h.x, dy:r.y-h.y}; }
function pickRoom(id){ if (walk>0) return; closeMap(); setGate(id); choosing=false; nextRoom=id; walk=0.001; }
function dirs(){ if (!choosing || walk>0 || !RT || RT.at<0) return []; var h=nodeAt(RT.at); return options().map(function(id){ var r=nodeAt(id); return {id:id, dx:r.x-h.x, dy:r.y-h.y}; }); }
function goDir(dx,dy){ var d=dirs().filter(function(q){ return q.dx===dx && q.dy===dy; })[0]; if (d){ Snd.unlock(); Snd.pop(); pickRoom(d.id); return true; } return false; }
function updPad(){ var ds= ($('mapM').classList.contains('show')||$('dailyM').classList.contains('show')||$('gearM').classList.contains('show')||$('shopM').classList.contains('show')||$('lootM').classList.contains('show')||$('cardM').classList.contains('show')) ? [] : dirs(), ks=ds.map(function(d){ return d.dx+','+d.dy; }), key=ks.join('|'); if (key===padKey) return; padKey=key;
  var pd=$('dpad'); pd.className= ds.length? 'on' : ''; [].forEach.call(pd.children, function(b2){ b2.disabled= ks.indexOf(b2.dataset.d)<0; }); }
[].forEach.call($('dpad').children, function(b2){ b2.onclick=function(){ var q=b2.dataset.d.split(','); goDir(+q[0], +q[1]); }; });
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
  if (!RT || !L) return; var sm=VW<=600, mu=uiScale(), M=RT.map, cell=bigMap?46:(sm?17:Math.round(20*mu)), gap=bigMap?14:(sm?5:Math.round(6*mu)), pad=bigMap?14:(sm?6:Math.round(8*mu)), top=bigMap?(mapNote?34:8):0, W=pad*2+M.w*cell+(M.w-1)*gap, H=top+pad*2+M.h*cell+(M.h-1)*gap, dpr=bigMap?2:Math.min(2,window.devicePixelRatio||1), tm=performance.now()/1000;
  if (cv2.width!==Math.round(W*dpr) || cv2.height!==Math.round(H*dpr)){ cv2.width=Math.round(W*dpr); cv2.height=Math.round(H*dpr); cv2.style.width=W+'px'; cv2.style.height=H+'px'; }
  var c=cv2.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H); c.lineJoin='round'; c.lineCap='round';
  var P=function(r){ return {x:pad+r.x*(cell+gap)+cell/2, y:top+pad+r.y*(cell+gap)+cell/2}; }, ops= choosing ? options() : [], bossC= L.kind==='big'?'#d98a10':(L.kind==='boss'?'#c0303a':'#8a3ad0'), bossG= L.kind==='big'?'255,170,40':(L.kind==='boss'?'255,70,70':'190,100,255'), u=cell/46;
  if (bigMap) mapHits=[];
  // corridors: dark stone, and a dotted golden trail where the hero has been
  M.rooms.forEach(function(r,i){ r.links.forEach(function(k){ if (k<i) return; var p1=P(r), p2=P(M.rooms[k]), lit=(RT.done[i]||i===RT.at)&&(RT.done[k]||k===RT.at), seen=known(i)&&known(k);
    c.globalAlpha= seen? 1 : 0.4; c.strokeStyle='#15101c'; c.lineWidth=Math.max(5,13*u); c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke();
    c.strokeStyle= lit? '#ffd84a' : '#6a5a80'; c.lineWidth=Math.max(2,5*u); c.setLineDash(lit? [Math.max(2,5*u), Math.max(3,7*u)] : []); c.lineDashOffset= lit? -tm*14*Math.max(0.5,u) : 0; c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke(); c.setLineDash([]); }); });
  c.globalAlpha=1;
  M.rooms.forEach(function(r,i){ var p=P(r), kn=known(i), boss=r.t==='B', dn=RT.done[i], now=i===RT.at, op=ops.indexOf(i)>=0, sz=cell*(boss?(L.kind==='n'?1.12:1.3):1), x0=p.x-sz/2, y0=p.y-sz/2, pu=0.5+Math.sin(tm*5)*0.5;
    if (boss){ var bg=c.createRadialGradient(p.x,p.y,sz*0.3,p.x,p.y,sz*(0.95+pu*0.2)); bg.addColorStop(0,'rgba('+bossG+',0.8)'); bg.addColorStop(1,'rgba('+bossG+',0)'); c.fillStyle=bg; c.fillRect(p.x-sz*1.2,p.y-sz*1.2,sz*2.4,sz*2.4); }
    c.beginPath(); c.roundRect(x0,y0,sz,sz,sz*0.24);
    if (!kn && !boss){ c.fillStyle='#1c1626'; c.fill(); c.setLineDash([Math.max(2,4*u),Math.max(2,4*u)]); c.lineWidth=Math.max(1.2,2.5*u); c.strokeStyle='#5a4a70'; c.stroke(); c.setLineDash([]); }
    else { var base= boss? (L.kind==='n'? bossC : '#3a0f18') : (dn? '#8f80ac' : NCOL[r.t]), gr2=c.createLinearGradient(0,y0,0,y0+sz); gr2.addColorStop(0,shade(base,0.22)); gr2.addColorStop(1,shade(base,-0.18)); c.fillStyle=gr2; c.fill(); c.lineWidth=Math.max(1.4,3*u); c.strokeStyle=OL; c.stroke(); }
    if (now){ c.beginPath(); c.roundRect(x0-2*u-1,y0-2*u-1,sz+4*u+2,sz+4*u+2,sz*0.28); c.lineWidth=Math.max(1.6,3*u); c.strokeStyle='rgba(255,228,92,'+(0.6+pu*0.4)+')'; c.stroke(); }
    else if (op){ c.beginPath(); c.roundRect(x0-1,y0-1,sz+2,sz+2,sz*0.26); c.lineWidth=Math.max(1.4,3*u); c.strokeStyle='rgba(255,255,255,'+(0.45+pu*0.55)+')'; c.stroke(); }
    c.textAlign='center'; c.textBaseline='middle';
    if (now){ var hr=sz*0.3; c.beginPath(); c.arc(p.x,p.y+hr*0.15,hr,0,6.3); c.fillStyle='#aab6c9'; c.fill(); c.lineWidth=Math.max(1.2,2.4*u); c.strokeStyle=OL; c.stroke(); c.fillStyle='#120a14'; c.fillRect(p.x-hr*0.75,p.y-hr*0.2,hr*1.6,hr*0.55); c.fillStyle='#ff4638'; c.fillRect(p.x-hr*0.45,p.y-hr*0.1,hr*0.42,hr*0.34); c.fillRect(p.x+hr*0.25,p.y-hr*0.1,hr*0.42,hr*0.34); }
    else if (boss) bossMark(c,p.x,p.y+sz*0.06,sz*(L.kind==='n'?0.34:0.3),L.kind);
    else if (!kn){ c.font='900 '+Math.round(sz*0.56)+'px '+FNT; c.fillStyle='#6a5a80'; c.fillText('?', p.x, p.y+1); }
    else if (dn){ c.font='900 '+Math.round(sz*0.5)+'px '+FNT; c.fillStyle='rgba(255,255,255,0.8)'; c.fillText('✓', p.x, p.y+1); }
    else if (r.t==='c'){ c.beginPath(); c.arc(p.x,p.y,sz*0.22,0,6.3); c.fillStyle='#ffe98a'; c.fill(); c.lineWidth=Math.max(1,2.2*u); c.strokeStyle='#6a4a08'; c.stroke(); }
    else icon(c, r.t==='f'?'atk':(r.t==='e'?'psn':'heal'), p.x, p.y, sz*0.27, '#fff', Math.max(1.4,3*u));
    if (bigMap) mapHits.push({id:i, x:p.x, y:p.y, r:cell/2+gap/2, ok:op}); });
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
  saveNow();
  var cont=function(){ if (fin){ if (L.level===FINAL) playEnding(showWin); else showWin(); return; } carryHp=F.hHp+Math.round(F.heroMax*0.15); updHud(); advance(); };
  later(fin? 0.9 : 0.55, function(){ if (L.king) showCards(cont); else if (it) showLoot(it, cont); else cont(); });
}
function applyItem(it){ it.old=SAVE.gear[it.slot]; if (it.r>it.old) SAVE.gear[it.slot]=it.r; else { it.sold=[10,25,60,150][it.r]; SAVE.coins+=it.sold; } }
// boss reward, dungeon-crawler style: four face-down cards are dealt, a 10 second countdown runs, the picked card flips with
// a burst of light in its rarity colour; when you leave, the other cards turn over to show what you missed.
// Every card holds a real roll of the drop table (no gear = coins).
var cardCont=null, cardLeft=0, cardDeck=[], cardTimer=0, cardBack=null;
function cardBackImg(){ if (cardBack) return cardBack; var cv=document.createElement('canvas'), W=164, H=240; cv.width=W; cv.height=H; var c=cv.getContext('2d');
  var g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,'#6a1a26'); g.addColorStop(1,'#2a0810'); c.fillStyle=g; c.fillRect(0,0,W,H);
  c.strokeStyle='rgba(232,180,74,0.35)'; c.lineWidth=2; for (var i=-H;i<W+H;i+=18){ c.beginPath(); c.moveTo(i,0); c.lineTo(i+H*0.6,H); c.stroke(); c.beginPath(); c.moveTo(i,H); c.lineTo(i+H*0.6,0); c.stroke(); }
  c.strokeStyle='#e8b44a'; c.lineWidth=4; c.beginPath(); c.roundRect(10,10,W-20,H-20,10); c.stroke(); c.lineWidth=2; c.beginPath(); c.roundRect(18,18,W-36,H-36,8); c.stroke();
  var rg=c.createRadialGradient(W/2,H/2,4,W/2,H/2,60); rg.addColorStop(0,'rgba(255,200,90,0.55)'); rg.addColorStop(1,'rgba(255,200,90,0)'); c.fillStyle=rg; c.fillRect(0,0,W,H);
  c.fillStyle='#2a0810'; c.beginPath(); c.moveTo(W/2,H/2-46); c.lineTo(W/2+38,H/2); c.lineTo(W/2,H/2+46); c.lineTo(W/2-38,H/2); c.closePath(); c.fill(); c.strokeStyle='#e8b44a'; c.lineWidth=3; c.stroke();
  bossMark(c,W/2,H/2+4,24,'n'); cardBack='url('+cv.toDataURL()+')'; return cardBack; }
function showCards(cont){
  cardCont=cont; cardLeft=1; cardDeck=[]; var box=$('cards'); box.innerHTML=''; $('cardRs').textContent=''; $('cardBtns').className=''; $('cardAgain').style.display=''; $('cardAgain').disabled=false;
  for (var i=0;i<4;i++){ var it=rollDrop(), gold=(L.kind==='big'? 40 : 15)+5*Math.floor(Math.random()*4); cardDeck.push({it:it, gold:gold, open:false});
    var fc=document.createElement('div'); fc.className='fc'; fc.dataset.i=i; fc.innerHTML='<div class="fci"><div class="fcb bk"></div><div class="fcb fr"></div></div>'; fc.firstChild.firstChild.style.backgroundImage=cardBackImg(); fc.onclick=pickCard; box.appendChild(fc); }
  $('cardM').classList.add('show'); Snd.boss(); [0,1,2,3].forEach(function(k){ setTimeout(Snd.swing, 60+k*130); });
  var left=10, tm=$('cardTimer'); tm.className=''; tm.textContent=left; clearInterval(cardTimer);
  cardTimer=setInterval(function(){ if (!$('cardM').classList.contains('show')){ clearInterval(cardTimer); return; } if ($('lootM').classList.contains('show') || cardLeft<=0) return;
    left--; tm.textContent=left; Snd.pay(); if (left<=0){ var rest=[].filter.call($('cards').children, function(o){ return !cardDeck[o.dataset.i].open; }); if (rest.length) pickCard.call(rest[Math.floor(Math.random()*rest.length)]); } }, 1000);
}
function cardFace(fc, d){ var fr=fc.querySelector('.fr'), it=d.it; fr.innerHTML='';
  if (it){ fr.style.setProperty('--rc',RAR[it.r]); fr.style.setProperty('--ra',[0.12,0.22,0.3,0.42][it.r]); var cv3=document.createElement('canvas'); cv3.width=cv3.height=104; gearTile(cv3, it.slot, it.r); fr.appendChild(cv3);
    var nm=document.createElement('div'); nm.textContent=tl('r'+it.r)+' · '+tl('g_'+it.slot); nm.style.color=RAR[it.r]; fr.appendChild(nm); var st2=document.createElement('div'); st2.textContent=gearVal(it.slot,it.r); fr.appendChild(st2); }
  else { fr.style.setProperty('--rc','#ffcf3a'); fr.style.setProperty('--ra',0.18); var co=document.createElement('span'); co.className='coin'; fr.appendChild(co); var gb=document.createElement('b'); gb.textContent='+'+d.gold; fr.appendChild(gb); } }
function pickCard(){
  var fc=this, d=cardDeck[fc.dataset.i]; if (cardLeft<=0 || d.open) return; cardLeft--; d.open=true; $('cardTimer').className='hide';
  cardFace(fc, d); fc.className='fc up pick'; Snd.cork(); var it=d.it, rs=$('cardRs'); rs.textContent='';
  [].forEach.call($('cards').children, function(o){ if (o!==fc && o.className.indexOf('pick')>=0) o.className='fc up'; });
  setTimeout(function(){ var r=fc.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    for (var k=0;k<(it? 14+it.r*10 : 12);k++){ var an=Math.random()*6.28, sp=120+Math.random()*260; parts.push({x:x,y:y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-60,t:0.8+Math.random()*0.5,c: it? RAR[it.r] : '#ffd84a',r:2+Math.random()*3,g:300}); }
    if (it && it.r>=2){ Snd.win(); shk=0.6; } else if (it) Snd.buy(); else Snd.coin(); }, 380);
  if (!it){ SAVE.coins+=d.gold; saveNow(); updHud(); setTimeout(function(){ rs.textContent='+'+d.gold+' '; var co=document.createElement('span'); co.className='coin'; rs.appendChild(co); $('cardBtns').className='on'; }, 700); }
  else setTimeout(function(){ showLoot(it, function(){ rs.textContent=it.msg||''; $('cardBtns').className='on'; }); }, 1100);
}
$('cardAgain').onclick=function(){ var b2=this; if (PF.adBusy) return; b2.disabled=true; PF.rewarded(function(ok){ if (!ok){ b2.disabled=false; return; } cardLeft=1; b2.style.display='none'; $('cardBtns').className=''; $('cardRs').textContent=''; }); };
$('cardOk').onclick=function(){ var b3=this; if (b3.dataset.busy) return; b3.dataset.busy=1; var any=false;
  [].forEach.call($('cards').children, function(o){ var d=cardDeck[o.dataset.i]; if (!d.open){ any=true; cardFace(o,d); o.dataset.miss=tl('missed'); o.className='fc up miss'; } });
  if (any){ Snd.cork(); $('cardBtns').className=''; }
  setTimeout(function(){ delete b3.dataset.busy; $('cardM').classList.remove('show'); var f=cardCont; cardCont=null; if (f) f(); }, any? 1300 : 0); };
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
// a dropped item: show it next to what the knight wears in that slot, on a picture of the knight, and let the player choose
var lootCont=null, lootItem=null, lootFlash=0, SELL=[10,25,60,150], dollTimer=0, gearSel2=null;
function slotLine(sl,r){ return r>=0? tl('r'+r)+' · '+tl('g_'+sl) : tl('g_'+sl)+' · '+tl('empty'); }
function showLoot(it, cont){
  lootCont=cont; lootItem=it; it.msg=null; var old=SAVE.gear[it.slot], better=it.r>old;
  gearTile($('lootIc'), it.slot, it.r); gearTile($('lootOld'), it.slot, old);
  $('lootNm').textContent=slotLine(it.slot,it.r); $('lootNm').style.color=RAR[it.r];
  $('lootOldNm').textContent=tl('worn')+': '+(old>=0? tl('r'+old) : tl('empty'));
  $('lootSt').textContent=tl('st_'+GSTAT[it.slot].k)+'  '+(old>=0? gearVal(it.slot,old) : '0')+'  →  '+gearVal(it.slot,it.r)+'  ·  '+tl(better? 'wearHint' : 'worseHint'); $('lootSt').style.color= better? '#8df07a' : '#c8b8d4';
  $('lootRs').textContent=''; $('lootBtns').style.display=''; $('lootOk').style.display='none';
  $('lootEq').className='btn'+(better? '' : ' sec'); var sb=$('lootSell'); sb.className='btn'+(better? ' sec' : ''); sb.textContent=tl('sellFor')+' +'+SELL[it.r]+' '; var co=document.createElement('span'); co.className='coin'; sb.appendChild(co);
  $('lootIc').style.animation='none'; void $('lootIc').offsetWidth; $('lootIc').style.animation='';
  $('lootM').classList.add('show'); updHud(); Snd.cork(); startDolls();
}
function lootDone(msg){ lootItem.msg=msg; $('lootRs').textContent=msg; $('lootBtns').style.display='none'; $('lootOk').style.display=''; saveNow(); updHud(); }
$('lootEq').onclick=function(){ var it=lootItem; if (!it || it.msg) return; var old=SAVE.gear[it.slot], back= old>=0? SELL[old] : 0; SAVE.gear[it.slot]=it.r; SAVE.coins+=back; lootFlash=1.4; Snd.win();
  lootDone(tl('equipped')+' → '+tl('g_'+it.slot)+(back? '  ·  '+tl('oldSold')+' +'+back : '')); };
$('lootSell').onclick=function(){ var it=lootItem; if (!it || it.msg) return; SAVE.coins+=SELL[it.r]; Snd.coin(); lootDone(tl('sellFor')+' +'+SELL[it.r]); };
$('lootOk').onclick=function(){ $('lootM').classList.remove('show'); var f=lootCont; lootCont=null; if (f) f(); };
// the knight drawn standing still, with a pulsing ring on one gear slot
var DOLLIMG={hat:[-2,-97],top:[2,-68],glv:[-34,-93],pnt:[4,-47],sho:[4,-30],rng:[-34,-93],amu:[0,-76]};
var DOLLPT={hat:[1,-108],top:[1,-80],glv:[19,-74],pnt:[7,-50],sho:[9,-31],rng:[20,-73],amu:[1,-84]};
function drawDoll(cv,W,H,hi,fl){ var d=2; if (cv.width!==W*d){ cv.width=W*d; cv.height=H*d; } if (!VS) return; var c=cv.getContext('2d'), t=performance.now()/1000, s=(H-12)/124;
  c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H); c.fillStyle='rgba(0,0,0,0.35)'; el(c,W/2,H-7,52*s,6*s); c.fill();
  c.save(); c.translate(W/2-4*s,H-8); c.scale(s,s); c.lineJoin='round'; c.lineCap='round';
  var keep=[heroRun,won,VS.hAtk,VS.hHurt,VS.hDrink,VS.hDead]; heroRun=false; won=false; VS.hAtk=VS.hHurt=VS.hDrink=VS.hDead=0; try{ heroArt(c,t); }catch(e){} heroRun=keep[0]; won=keep[1]; VS.hAtk=keep[2]; VS.hHurt=keep[3]; VS.hDrink=keep[4]; VS.hDead=keep[5];
  if (hi && DOLLPT[hi]){ var P=(artOk('knight-0')? DOLLIMG : DOLLPT)[hi], pu=0.5+Math.sin(t*6)*0.5, rad=10+pu*3+(fl>0? fl*10 : 0); c.lineWidth=2.6/s; c.strokeStyle='rgba(255,228,92,'+(0.55+pu*0.45)+')'; el(c,P[0],P[1],rad); c.stroke(); if (fl>0){ c.fillStyle='rgba(255,240,160,'+Math.min(0.5,fl*0.4)+')'; el(c,P[0],P[1],rad); c.fill(); } }
  c.restore(); }
function startDolls(){ clearInterval(dollTimer); dollTimer=setInterval(function(){ var any=false;
  if ($('lootM').classList.contains('show')){ any=true; drawDoll($('lootDoll'),150,118,lootItem&&lootItem.slot,lootFlash); lootFlash=Math.max(0,lootFlash-0.05); }
  if ($('gearM').classList.contains('show')){ any=true; drawDoll($('gearDoll'),150,210,gearSel2,0); }
  if (!any) clearInterval(dollTimer); }, 60); }
// the gear screen: the knight in the middle, the seven slots around him, totals below
function buildGear(){
  [['gcolL',['hat','top','pnt','sho']],['gcolR',['glv','rng','amu']]].forEach(function(q){ var col=$(q[0]); col.innerHTML='';
    q[1].forEach(function(sl){ var r=SAVE.gear[sl], d=document.createElement('div'); d.className='gslot'+(sl===gearSel2? ' on' : ''); var cv2=document.createElement('canvas'); cv2.width=cv2.height=88; gearTile(cv2,sl,r); d.appendChild(cv2);
      var nm=document.createElement('span'); nm.textContent=tl('g_'+sl); nm.style.color= r>=0? RAR[r] : '#a898b4'; d.appendChild(nm); d.onclick=function(){ gearSel2= gearSel2===sl? null : sl; Snd.pop(); buildGear(); }; col.appendChild(d); }); });
  var r2=gearSel2? SAVE.gear[gearSel2] : -1; $('gearInfo2').textContent= gearSel2? slotLine(gearSel2,r2)+(r2>=0? '  ·  '+tl('st_'+GSTAT[gearSel2].k)+' '+gearVal(gearSel2,r2) : '') : ''; $('gearInfo2').style.color= r2>=0? RAR[r2] : '#c8b8d4';
  var parts=[]; [['hp','+'],['atk','+'],['def','-'],['crit',''],['heal','+'],['spd','+']].forEach(function(q){ var v=gearSum(q[0]); if (v) parts.push(tl('st_'+q[0])+' '+(q[0]==='crit'? v+'%' : q[1]+v)); });
  $('gearSum').textContent= parts.length? parts.join('  ·  ') : tl('bag');
}
$('gearBtn').onclick=function(){ Snd.unlock(); if (PF.adBusy) return; buildGear(); $('gearM').classList.add('show'); startDolls(); };
$('gearX').onclick=function(){ $('gearM').classList.remove('show'); };
$('gearBtn').innerHTML='<span class="ic">'+ICO.svg('helm')+'</span>';
// ----- going down to the next floor: the knight rides down a stairway, then the new floor's name -----
function floorTransition(n, load){
  var ft=$('floorT'), cvT=$('ftC'), kind=DJ.kindOf(n), t0=performance.now(), loaded=false, th=THEMES[Math.floor((n-1)/6)%4], W=360, H=230, d=2;
  $('ftFrom').textContent=tl('floor',{n:n-1})+' ✓'; var to=$('ftTo'); to.textContent=(kind==='big'? '🐉 ' : (kind==='boss'? '👹 ' : '⚔️ '))+tl('floor',{n:n}); to.className='out';
  $('ftSub').textContent=(kind==='big'? tl('bigF') : (kind==='boss'? tl('bossF') : tl('ftMini')))+'   ·   '+(n<=FINAL? tl('ftLeft',{n:FINAL-n+1}) : tl('endless')); $('ftSub').className='out';
  cvT.width=W*d; cvT.height=H*d; ft.classList.add('show'); Snd.door();
  var NS=10, SX=6, SY=70, SW=32, SR=14, DP=10;   // stairs: NS steps from (SX,SY) down to the right, each SW wide and SR tall
  var step=function(){ var e=(performance.now()-t0)/1000, c=cvT.getContext('2d'); c.setTransform(d,0,0,d,0,0); c.clearRect(0,0,W,H); c.lineJoin='round';
    var i, j2, wall=shade(th.fl,-0.45), mort=shade(th.fl,-0.62);
    // dungeon brick wall
    rr(c,0,0,W,H,14); c.save(); c.clip(); c.fillStyle=wall; c.fillRect(0,0,W,H);
    for (j2=0;j2<12;j2++){ var by2=j2*18; for (i=-1;i<12;i++){ var bx2=i*34+(j2%2? 17 : 0), sh2=((i*7+j2*13)%5)*0.025; c.fillStyle=shade(th.fl,-0.4-sh2); c.fillRect(bx2+1.5,by2+1.5,31,15); c.fillStyle='rgba(255,255,255,0.05)'; c.fillRect(bx2+1.5,by2+1.5,31,2); } }
    c.fillStyle=mort; for (j2=0;j2<12;j2++) c.fillRect(0,j2*18,W,1.5);
    // the arch at the bottom of the stairs, glowing with the next floor
    var ax=W-34, ay=H-6, aw=30, ah=74, pu2=0.75+Math.sin(e*4)*0.12;
    c.beginPath(); c.moveTo(ax-aw-9,ay); c.lineTo(ax-aw-9,ay-ah+aw); c.arc(ax,ay-ah+aw,aw+9,Math.PI,0); c.lineTo(ax+aw+9,ay); c.closePath(); c.fillStyle=shade(th.fl,-0.1); c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke();
    for (i=0;i<=6;i++){ var an=Math.PI+i/6*Math.PI; c.beginPath(); c.moveTo(ax+Math.cos(an)*aw,ay-ah+aw+Math.sin(an)*aw); c.lineTo(ax+Math.cos(an)*(aw+9),ay-ah+aw+Math.sin(an)*(aw+9)); c.lineWidth=1.4; c.strokeStyle='rgba(0,0,0,0.4)'; c.stroke(); }
    c.beginPath(); c.moveTo(ax-aw,ay); c.lineTo(ax-aw,ay-ah+aw); c.arc(ax,ay-ah+aw,aw,Math.PI,0); c.lineTo(ax+aw,ay); c.closePath(); var ag=c.createLinearGradient(0,ay-ah,0,ay); ag.addColorStop(0,'#080408'); ag.addColorStop(1,'rgba('+th.gl+','+pu2+')'); c.fillStyle=ag; c.fill(); c.stroke();
    var gl=c.createRadialGradient(ax,ay,4,ax,ay,130); gl.addColorStop(0,'rgba('+th.gl+','+(0.4*pu2)+')'); gl.addColorStop(1,'rgba('+th.gl+',0)'); c.fillStyle=gl; c.fillRect(0,0,W,H);
    // two torches on the wall
    [[80,40],[220,32]].forEach(function(tp,ti){ var tx=tp[0], ty=tp[1], fl=0.85+Math.sin(e*13+ti*2)*0.12+Math.sin(e*7.3+ti)*0.06;
      var tg=c.createRadialGradient(tx,ty-6,2,tx,ty-6,58); tg.addColorStop(0,'rgba(255,170,70,0.42)'); tg.addColorStop(1,'rgba(255,170,70,0)'); c.fillStyle=tg; c.fillRect(tx-58,ty-64,116,116);
      c.fillStyle='#4a3424'; c.beginPath(); c.moveTo(tx-6,ty); c.lineTo(tx+6,ty); c.lineTo(tx+3,ty+14); c.lineTo(tx-3,ty+14); c.closePath(); c.fill(); c.lineWidth=1.6; c.strokeStyle=OL; c.stroke();
      c.fillStyle='#ff8a2a'; el(c,tx,ty-7*fl,6,11*fl); c.fill(); c.fillStyle='#ffd27a'; el(c,tx,ty-5*fl,3.6,7*fl); c.fill(); c.fillStyle='#fff6d0'; el(c,tx,ty-3,1.8,3.5*fl); c.fill(); });
    // stone stairs going down to the right: dark mass underneath, then each step (tread + riser with block joints)
    // side of the staircase: a stone wall under the steps, darker toward the bottom
    c.save(); c.beginPath(); c.moveTo(SX,SY+SR); for (i=0;i<NS;i++){ c.lineTo(SX+i*SW+SW,SY+i*SR+SR); c.lineTo(SX+i*SW+SW,SY+(i+1)*SR+SR); } c.lineTo(SX+NS*SW,H); c.lineTo(SX,H); c.closePath(); c.clip();
    var sg2=c.createLinearGradient(0,SY,0,H); sg2.addColorStop(0,shade(th.fl,-0.3)); sg2.addColorStop(1,shade(th.fl,-0.68)); c.fillStyle=sg2; c.fillRect(0,0,W,H);
    for (j2=0;j2<14;j2++){ for (i=-1;i<14;i++){ var bx3=i*28+(j2%2? 14 : 0), by3=SY+j2*13; c.strokeStyle='rgba(0,0,0,0.35)'; c.lineWidth=1.2; c.strokeRect(bx3,by3,28,13); } } c.restore();
    for (i=0;i<NS;i++){ var x0=SX+i*SW, y0=SY+i*SR+SR, lit=Math.max(0,1-Math.abs(x0-80)/120)*0.14+Math.max(0,1-Math.abs(x0-220)/110)*0.14, sh3=-i*0.025;
      c.beginPath(); c.moveTo(x0,y0); c.lineTo(x0+DP,y0-DP*0.9); c.lineTo(x0+SW+DP,y0-DP*0.9); c.lineTo(x0+SW,y0); c.closePath(); c.fillStyle=shade(th.fl,0.02+lit+sh3); c.fill(); c.lineWidth=1.5; c.strokeStyle=OL; c.stroke();   // tread (top, going back)
      c.fillStyle='rgba(255,255,255,0.22)'; c.fillRect(x0+1,y0-1.4,SW-1,1.4);
      c.beginPath(); c.rect(x0,y0,SW,SR); c.fillStyle=shade(th.fl,-0.22+lit*0.7+sh3); c.fill(); c.stroke();                                  // riser (front)
      c.fillStyle='rgba(0,0,0,0.3)'; c.fillRect(x0+((i*11)%3+1)*SW/4,y0+1,1.2,SR-2); c.fillStyle='rgba(0,0,0,0.25)'; c.fillRect(x0,y0+SR-3,SW,3); }
    c.restore(); rr(c,1,1,W-2,H-2,14); c.lineWidth=3; c.strokeStyle='#c79a52'; c.stroke();
    // the knight rides down the stairs
    var p=Math.min(1,Math.max(0,(e-0.15)/1.6)), x=SX+18+p*(NS-1.3)*SW, si=Math.min(NS-1,Math.max(0,Math.floor((x-SX)/SW))), y=SY+SR-DP*0.45+si*SR+(((x-SX)%SW)/SW)*SR*0.35-Math.abs(Math.sin(p*(NS-1)*Math.PI))*3;
    c.save(); c.beginPath(); c.rect(0,0,ax-aw+4,H); c.rect(ax-aw+4,0,W,ay-ah+aw-30); c.clip(); c.translate(x+DP*0.5,y); c.rotate(0.22); c.scale(0.5,0.5); var keep=heroRun; heroRun=p>0&&p<1; try{ heroArt(c,e); }catch(err){} heroRun=keep; c.restore();
    if (e>0.95 && to.className.indexOf('pop')<0){ to.className='out pop'; Snd.horn(); }
    if (e>1.3) $('ftSub').className='out on';
    if (e>1.15 && !loaded){ loaded=true; load(); }
    if (e>2.5){ ft.classList.remove('show'); return; }
    requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

var gearSel=null;
function drawGear(){
  var grid=$('gearGrid'); grid.innerHTML=''; if (!gearSel || SAVE.gear[gearSel]<0) gearSel=SLOTS.filter(function(k){ return SAVE.gear[k]>=0; })[0]||null;
  SLOTS.forEach(function(sl){ var cv2=document.createElement('canvas'); cv2.width=cv2.height=80; gearTile(cv2, sl, SAVE.gear[sl]); if (sl===gearSel) cv2.className='on'; cv2.onclick=function(){ gearSel=sl; drawGear(); }; grid.appendChild(cv2); });
  var inf=$('gearInfo'), r=gearSel? SAVE.gear[gearSel] : -1; inf.textContent='';
  if (gearSel){ var b1=document.createElement('div'); b1.textContent=tl('g_'+gearSel)+(r>=0? ' · '+tl('r'+r) : ''); b1.style.color= r>=0? RAR[r] : '#a898b4'; inf.appendChild(b1);
    var b2=document.createElement('div'); b2.textContent=tl('st_'+GSTAT[gearSel].k)+(r>=0? ' '+gearVal(gearSel,r) : ''); inf.appendChild(b2); }
}
var SK1=100, SK2=100;
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

// ---------------- the ending: after the last great boss the knight frees the princess with a potion ----------------
var FINAL=96;
function princessArt(c,t,mood,arms){
  // a slim young princess, facing left: long golden hair, small tiara, rose gown. mood 0 asleep, 1 awake and smiling
  var sk='#f2c9a8', dr='#d9487a', drl='#ffb8d0', hair='#f0c050', hd=shade(hair,-0.25);
  c.beginPath(); c.moveTo(4,-104); c.quadraticCurveTo(18,-96,16,-70); c.quadraticCurveTo(14,-58,10,-52); c.lineTo(2,-60); c.closePath(); fs(c,hd);
  c.beginPath(); c.moveTo(-8,-64); c.lineTo(8,-64); c.quadraticCurveTo(20,-30,27,0); c.quadraticCurveTo(0,6,-27,0); c.quadraticCurveTo(-20,-30,-8,-64); c.closePath(); fs(c,dr);
  c.save(); c.clip(); c.fillStyle=drl; poly(c,[-4,-62,4,-62,10,2,-10,2]); c.fill(); c.strokeStyle='rgba(0,0,0,0.18)'; c.lineWidth=1.5; [-14,-6,6,14].forEach(function(x){ c.beginPath(); c.moveTo(x*0.3,-58); c.lineTo(x,2); c.stroke(); }); c.restore();
  c.strokeStyle='#ffcf3a'; c.lineWidth=2.4; c.beginPath(); c.moveTo(-26,-3); c.quadraticCurveTo(0,3,26,-3); c.stroke();
  rr(c,-8,-86,16,24,5); fs(c,dr); c.fillStyle='#ffcf3a'; c.fillRect(-8,-66,16,3);
  var ra=arms||0;
  [-1,1].forEach(function(sd){ var sx=sd*7, hx=sd*(10+ra*8), hy=-70-ra*30; limb(c,sx,-82,hx,hy,4,sk); el(c,hx,hy,2.8); fs(c,sk,1.8); });
  rr(c,-2.5,-92,5,7,2); fs(c,sk,1.8);
  el(c,-1,-99,7.5,9); fs(c,sk);
  c.beginPath(); c.moveTo(-8,-101); c.quadraticCurveTo(-6,-112,2,-110); c.quadraticCurveTo(10,-108,8,-96); c.quadraticCurveTo(5,-104,-2,-104); c.quadraticCurveTo(-6,-104,-8,-101); c.closePath(); fs(c,hair,2);
  poly(c,[-6,-109,-5,-115,-2,-111,0,-117,2,-111,5,-115,6,-109]); fs(c,'#ffcf3a',1.6); c.fillStyle='#5ad8ff'; el(c,0,-112,1.2); c.fill();
  c.strokeStyle=OL; c.lineWidth=1.5;
  if (mood){ c.fillStyle=OL; el(c,-5,-99,1.1,1.6); c.fill(); el(c,1,-99,1.1,1.6); c.fill(); c.beginPath(); c.arc(-3,-95,2.2,0.2,Math.PI-0.2); c.stroke(); c.fillStyle='rgba(255,120,140,0.5)'; el(c,-6,-96,1.8,1.1); c.fill(); }
  else { c.beginPath(); c.moveTo(-6.5,-99); c.quadraticCurveTo(-5,-98,-3.5,-99); c.moveTo(-0.5,-99); c.quadraticCurveTo(1,-98,2.5,-99); c.stroke(); c.beginPath(); c.moveTo(-4,-95); c.lineTo(-2,-95); c.stroke(); }
}
var endBuf=document.createElement('canvas');
function playEnding(done){
  var M=$('endM'), cv2=$('endC'), t0=performance.now(), ps=[], cracks=[], shards=[], burst=false, step=0, i, sp=Snd;
  for (i=0;i<9;i++) cracks.push({a:Math.random()*6.28, l:20+Math.random()*40, b:Math.random()*6.28});
  $('endT1').textContent=tl('endCursed'); $('endT1').style.opacity=0; $('endT2').textContent=tl('endSaved'); $('endT2').className='out'; $('endT3').textContent=tl('endSub',{n:FINAL, c:SAVE.coins}); $('endT3').style.opacity=0;
  var go=$('endGo'); go.textContent=tl('endGo'); go.className='btn';
  go.onclick=function(){ if (go.className.indexOf('on')<0) return; M.classList.remove('show'); step=-1; done&&done(); };
  M.classList.add('show'); PF.setPlaying(false); Snd.door();
  var loop=function(){ if (step<0) return; requestAnimationFrame(loop);
    var e=(performance.now()-t0)/1000, W=innerWidth, H=innerHeight, d=Math.min(2,window.devicePixelRatio||1); if (cv2.width!==Math.round(W*d)){ cv2.width=Math.round(W*d); cv2.height=Math.round(H*d); }
    var c=cv2.getContext('2d'); c.setTransform(d,0,0,d,0,0); c.lineJoin='round'; c.lineCap='round';
    var k=Math.min(W/360, H/420, 2.2), fy=H*0.74, cxp=W*0.68, kx=W*0.3;
    var daisY=null; if (artOk('throne')){ fy=H*(W>H? 0.9 : 0.8); var TP=drawSceneFit(c,'throne',W,H,0.68,0.52,0.93,fy,'#160c22'); cxp=TP.x+0.73*1920*TP.s; daisY=TP.y+0.6*1080*TP.s; k=Math.min(k, 0.3*1080*TP.s/130*1.05); if (burst){ c.fillStyle='rgba(255,240,210,0.12)'; c.fillRect(0,0,W,H); } } else {
    // throne room: stone wall, a tall stained-glass window pouring light, two pillars with banners, a red carpet
    var g=c.createLinearGradient(0,0,0,fy); g.addColorStop(0,'#1a1028'); g.addColorStop(1,'#3a2a48'); c.fillStyle=g; c.fillRect(0,0,W,fy);
    c.strokeStyle='rgba(0,0,0,0.25)'; c.lineWidth=2; for (var y=0, rw=0; y<fy; y+=34*k, rw++){ c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); for (var x=(rw%2? -40*k : 0); x<W; x+=80*k){ c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+34*k); c.stroke(); } }
    var ww=46*k, wh=150*k, wx=cxp, wy=fy-40*k-wh, glow=burst? 1 : 0.35;
    c.fillStyle='rgba(255,230,180,'+(0.08+glow*0.12)+')'; poly(c,[wx-ww,wy+wh,wx+ww,wy+wh,wx+ww*3.4,fy+40*k,wx-ww*3.4,fy+40*k]); c.fill();
    c.beginPath(); c.moveTo(wx-ww,wy+wh); c.lineTo(wx-ww,wy+ww); c.arc(wx,wy+ww,ww,Math.PI,0); c.lineTo(wx+ww,wy+wh); c.closePath(); c.fillStyle='#2a1a3a'; c.fill(); c.lineWidth=4; c.strokeStyle=OL; c.stroke();
    c.save(); c.clip(); var cols=['#5a9cff','#d9487a','#ffcf3a','#59d86a','#8b5cf6']; for (i=0;i<14;i++){ c.globalAlpha=0.35+glow*0.5; c.fillStyle=cols[i%5]; c.fillRect(wx-ww+(i%4)*ww/2, wy+Math.floor(i/4)*wh/4, ww/2-2, wh/4-2); } c.globalAlpha=1; c.restore();
    [W*0.08, W*0.92].forEach(function(px){ c.fillStyle='#4a3a5c'; c.fillRect(px-16*k,0,32*k,fy); c.strokeStyle=OL; c.lineWidth=3; c.strokeRect(px-16*k,0,32*k,fy); c.fillStyle='#8a1f2a'; poly(c,[px-12*k,40*k,px+12*k,40*k,px+12*k,120*k,px,108*k,px-12*k,120*k]); c.fill(); c.stroke(); bossMark(c,px,72*k,9*k,'n'); });
    g=c.createLinearGradient(0,fy,0,H); g.addColorStop(0,'#3a2c44'); g.addColorStop(1,'#140c1a'); c.fillStyle=g; c.fillRect(0,fy,W,H-fy);
    c.fillStyle='#8a1f2a'; poly(c,[W*0.5-30*k,fy,W*0.5+30*k,fy,W*0.5+90*k,H,W*0.5-90*k,H]); c.fill(); c.fillStyle='#ffcf3a'; c.fillRect(0,fy,W,2);
    // dais
    rr(c,cxp-56*k,fy-14*k,112*k,16*k,4); c.fillStyle='#5a4a70'; c.fill(); c.lineWidth=3; c.strokeStyle=OL; c.stroke(); }
    // the knight rides in
    var ride=Math.min(1,Math.max(0,(e-0.3)/1.6)), hx=-60*k+(kx+60*k)*easeOut(ride), cheer=e>5.2;
    var keep=[heroRun,won,VS.mDead,choosing,VS.empty,VS.hAtk,VS.hDrink]; heroRun=ride>0&&ride<1; won=cheer; VS.mDead=cheer?1:0; choosing=false; VS.empty=false; VS.hAtk=0; VS.hDrink= (e>2.5&&e<3.0)? 0.2 : 0;
    c.save(); c.translate(hx, fy-(cheer? Math.abs(Math.sin(e*6))*8*k : 0)); c.scale(k*1.05,k*1.05); c.fillStyle='rgba(0,0,0,0.35)'; el(c,0,3,44,7); c.fill(); try{ heroArt(c,e); }catch(err){} c.restore();
    heroRun=keep[0]; won=keep[1]; VS.mDead=keep[2]; choosing=keep[3]; VS.empty=keep[4]; VS.hAtk=keep[5]; VS.hDrink=keep[6];
    // the princess, grey and still inside the crystal until the potion lands
    var free=burst? Math.min(1,(e-4.3)/0.9) : 0, pimg=artOk('princess-crystal') && artOk('princess-free'), eb=endBuf, bw2=Math.ceil(80*k*d), bh2=Math.ceil(140*k*d); if (eb.width!==bw2){ eb.width=bw2; eb.height=bh2; }
    var bc=eb.getContext('2d'); bc.setTransform(1,0,0,1,0,0); bc.clearRect(0,0,bw2,bh2); bc.setTransform(k*d,0,0,k*d,40*k*d,130*k*d); bc.lineJoin='round'; bc.lineCap='round';
    if (!pimg) princessArt(bc,e,free>0.5?1:0,free>0.6? Math.min(1,(e-5)/0.4)*(0.7+Math.sin(e*5)*0.3) : 0);
    if (free<1){ bc.setTransform(1,0,0,1,0,0); bc.globalCompositeOperation='source-atop'; bc.fillStyle='rgba(150,130,190,'+(0.75*(1-free))+')'; bc.fillRect(0,0,bw2,bh2); bc.globalCompositeOperation='source-over'; }
    var py= daisY!=null? daisY : fy-14*k;
    if (pimg){ c.save(); c.translate(cxp, py-(free>0.6? Math.abs(Math.sin(e*5))*5*k : 0)); c.scale(k,k); drawChar(c, burst? 'princess-free' : 'princess-crystal', 'princess-crystal', 175); c.restore(); }
    else c.drawImage(eb, cxp-40*k, py-130*k-(free>0.6? Math.abs(Math.sin(e*5))*4*k : 0), 80*k, 140*k);
    if (!burst){ var gl=0.35+(e>3.2? Math.min(0.5,(e-3.2)*0.6) : 0)+Math.sin(e*3)*0.06;
      if (!pimg){ c.fillStyle='rgba(170,120,255,'+gl*0.6+')'; poly(c,[cxp-30*k,py,cxp-36*k,py-90*k,cxp-14*k,py-142*k,cxp+16*k,py-150*k,cxp+36*k,py-96*k,cxp+30*k,py]); c.fill(); c.lineWidth=3; c.strokeStyle='rgba(230,210,255,0.9)'; c.stroke();
      c.strokeStyle='rgba(255,255,255,0.45)'; c.lineWidth=2; c.beginPath(); c.moveTo(cxp-14*k,py-142*k); c.lineTo(cxp-6*k,py); c.moveTo(cxp+16*k,py-150*k); c.lineTo(cxp+10*k,py); c.stroke();
      c.fillStyle='rgba(255,255,255,0.35)'; poly(c,[cxp-28*k,py-80*k,cxp-20*k,py-120*k,cxp-14*k,py-118*k,cxp-22*k,py-70*k]); c.fill(); }
      else { var cg3=c.createRadialGradient(cxp,py-90*k,4,cxp,py-90*k,110*k); cg3.addColorStop(0,'rgba(190,140,255,'+gl*0.5+')'); cg3.addColorStop(1,'rgba(190,140,255,0)'); c.fillStyle=cg3; c.fillRect(cxp-120*k,py-210*k,240*k,220*k); }
      if (e>3.4){ var cl=Math.min(1,(e-3.4)/0.8); c.strokeStyle='#fff'; c.lineWidth=2; cracks.forEach(function(q){ c.beginPath(); c.moveTo(cxp,py-72*k); var mx=cxp+Math.cos(q.a)*q.l*k*0.5*cl, my=py-72*k+Math.sin(q.a)*q.l*k*0.9*cl; c.lineTo(mx,my); c.lineTo(mx+Math.cos(q.b)*q.l*k*0.4*cl, my+Math.sin(q.b)*q.l*k*0.6*cl); c.stroke(); }); } }
    // the potion: a rainbow orb arcing from the knight to the crystal
    if (e>2.6 && e<3.4){ var pe=(e-2.6)/0.8, ox=hx+20*k+(cxp-hx-20*k)*pe, oy=fy-110*k-Math.sin(pe*Math.PI)*90*k+(py-72*k-(fy-110*k))*pe, hue=(e*400)%360;
      c.fillStyle='hsl('+hue+',90%,65%)'; c.beginPath(); c.arc(ox,oy,8*k,0,6.3); c.fill(); c.lineWidth=2.5; c.strokeStyle=OL; c.stroke(); ps.push({x:ox,y:oy,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,t:0.5,c:'hsl('+((hue+120)%360)+',90%,70%)',r:2.5,g:0}); if (!step){ step=1; sp.fill(); } }
    if (e>2.2 && step<1){ $('endT1').style.opacity=1; }
    if (e>4.2 && !burst){ burst=true; sp.win(); sp.cork(); $('endT1').style.opacity=0;
      for (i=0;i<26;i++){ var an=Math.random()*6.28, s2=120+Math.random()*320; shards.push({x:cxp,y:py-72*k,vx:Math.cos(an)*s2,vy:Math.sin(an)*s2-120,t:1.2,r:Math.random()*6.28,vr:(Math.random()-0.5)*10,s:(5+Math.random()*9)*k}); }
      for (i=0;i<40;i++){ var a2=Math.random()*6.28, s3=60+Math.random()*260; ps.push({x:cxp,y:py-72*k,vx:Math.cos(a2)*s3,vy:Math.sin(a2)*s3,t:1+Math.random()*0.6,c:['#ffe98a','#fff','#ffb8d0','#c8a8ff'][i%4],r:2+Math.random()*3,g:120}); } }
    if (burst){ var fl=Math.max(0,1-(e-4.2)/0.5); if (fl>0){ c.fillStyle='rgba(255,250,230,'+fl*0.8+')'; c.fillRect(0,0,W,H); } }
    shards.forEach(function(q){ q.t-=1/60; if (q.t<=0) return; q.vy+=900/60; q.x+=q.vx/60; q.y+=q.vy/60; q.r+=q.vr/60; c.save(); c.globalAlpha=Math.min(1,q.t*1.5); c.translate(q.x,q.y); c.rotate(q.r); c.fillStyle='rgba(200,170,255,0.85)'; poly(c,[0,-q.s,q.s*0.6,q.s*0.5,-q.s*0.5,q.s*0.4]); c.fill(); c.strokeStyle='#fff'; c.lineWidth=1.5; c.stroke(); c.restore(); });
    if (e>5 && Math.random()<0.15) ps.push({x:cxp+(Math.random()-0.5)*50*k,y:py-100*k,vx:(Math.random()-0.5)*30,vy:-40-Math.random()*40,t:1.6,c:'#ff6a8a',r:5*k,g:-10,heart:1});
    for (i=ps.length-1;i>=0;i--){ var q=ps[i]; q.t-=1/60; if (q.t<=0){ ps.splice(i,1); continue; } q.vy+=q.g/60; q.x+=q.vx/60; q.y+=q.vy/60; c.globalAlpha=Math.min(1,q.t*2); if (q.heart) icon(c,'heal',q.x,q.y,q.r,q.c,2); else { c.fillStyle=q.c; c.beginPath(); c.arc(q.x,q.y,q.r,0,6.3); c.fill(); } }
    c.globalAlpha=1;
    if (e>4.6 && $('endT2').className.indexOf('pop')<0){ $('endT2').className='out pop'; sp.horn(); }
    if (e>5.4) $('endT3').style.opacity=1;
    if (e>6.2 && go.className.indexOf('on')<0) go.className='btn on';
  };
  requestAnimationFrame(loop);
}

// ---------------- opening: the knight rides up to the dungeon gate, the title appears; any tap skips ----------------
function playIntro(done){
  var M=$('introM'), cv2=$('introC'), t0=performance.now(), fin=false, ps=[];
  $('inLogo').firstChild.textContent=tl('gameName'); $('inLogo').classList.toggle('cjk', LANG==='zh'||LANG==='ja'||LANG==='ko'); $('inLogo').lastChild.textContent=tl('subtitle'); $('inStory').textContent=tl('story'); $('inTap').textContent=tl('tapSkip');
  var end=function(){ if (fin) return; fin=true; Snd.unlock(); M.classList.add('out'); setTimeout(function(){ M.style.display='none'; }, 460); done&&done(); };
  // browsers only allow sound after the first tap: try anyway (desktop often allows it); a tap while the knight is still riding in turns the sound on instead of skipping
  var hoofN=[0,0,0,0], horned=false, rumbled=false; Snd.unlock();
  var tapI=function(){ var e0=(performance.now()-t0)/1000; if (!Snd.live() && e0<2.6){ Snd.unlock(); return; } end(); };
  M.addEventListener('pointerdown', tapI); addEventListener('keydown', tapI);
  var loop=function(){ if (fin) return; requestAnimationFrame(loop);
    var e=(performance.now()-t0)/1000, W=innerWidth, H=innerHeight, d=Math.min(2,window.devicePixelRatio||1); if (cv2.width!==Math.round(W*d)){ cv2.width=Math.round(W*d); cv2.height=Math.round(H*d); }
    var c=cv2.getContext('2d'); c.setTransform(d,0,0,d,0,0); c.lineJoin='round'; c.lineCap='round';
    var k=Math.min(W/360, H/420, 2.2), fy=H*0.78, gx=W*0.66, i;
    if (artOk('gate')){ c.fillStyle='#0c1230'; c.fillRect(0,0,W,H); fy=H*0.86; var GP=drawSceneFit(c,'gate',W,H,0.72,0.5,0.9,fy,'#0c1230'); k=Math.min(k*1.25, 0.5*1080*GP.s/130);
      var gl4=0.5+Math.sin(e*3)*0.2; c.globalCompositeOperation='lighter'; var rg4=c.createRadialGradient(W/2,GP.y+0.73*1080*GP.s,2,W/2,GP.y+0.73*1080*GP.s,110*GP.s*3); rg4.addColorStop(0,'rgba(255,40,30,'+gl4*0.35+')'); rg4.addColorStop(1,'rgba(255,40,30,0)'); c.fillStyle=rg4; c.fillRect(0,0,W,H); c.globalCompositeOperation='source-over'; } else {
    var g=c.createLinearGradient(0,0,0,fy); g.addColorStop(0,'#0a0614'); g.addColorStop(1,'#2a1a3a'); c.fillStyle=g; c.fillRect(0,0,W,H);
    c.fillStyle='rgba(255,255,255,0.7)'; for (i=0;i<40;i++){ var sx=(i*137.5)%W, sy=(i*71.3)%(fy*0.6); c.globalAlpha=0.3+0.4*Math.abs(Math.sin(e*1.5+i)); c.fillRect(sx,sy,1.6,1.6); } c.globalAlpha=1;
    var mx2=W*0.84, my2=H*0.42-150*k; c.fillStyle='#e8e0c8'; c.beginPath(); c.arc(mx2,my2,16*k,0,6.3); c.fill(); c.fillStyle='#0a0614'; c.beginPath(); c.arc(mx2+7*k,my2-4*k,14.5*k,0,6.3); c.fill();
    // mountain with the dungeon gate cut into it
    c.fillStyle='#1a1224'; c.beginPath(); c.moveTo(0,fy); c.lineTo(W*0.1,fy-90*k); c.lineTo(W*0.3,fy-60*k); c.lineTo(W*0.5,fy-200*k); c.lineTo(W*0.75,fy-230*k); c.lineTo(W*0.95,fy-120*k); c.lineTo(W,fy-140*k); c.lineTo(W,fy); c.closePath(); c.fill();
    var aw=46*k, ah=110*k; c.beginPath(); c.moveTo(gx-aw-12*k,fy); c.lineTo(gx-aw-12*k,fy-ah+aw); c.arc(gx,fy-ah+aw,aw+12*k,Math.PI,0); c.lineTo(gx+aw+12*k,fy); c.closePath(); c.fillStyle='#4a3a5c'; c.fill(); c.lineWidth=3; c.strokeStyle=OL; c.stroke();
    c.beginPath(); c.moveTo(gx-aw,fy); c.lineTo(gx-aw,fy-ah+aw); c.arc(gx,fy-ah+aw,aw,Math.PI,0); c.lineTo(gx+aw,fy); c.closePath(); var gg=c.createLinearGradient(0,fy-ah,0,fy); gg.addColorStop(0,'#000'); gg.addColorStop(1,'#5a1420'); c.fillStyle=gg; c.fill(); c.stroke();
    var glow=0.5+Math.sin(e*3)*0.15; var rg=c.createRadialGradient(gx,fy,4,gx,fy,aw*2); rg.addColorStop(0,'rgba(255,80,60,'+glow*0.5+')'); rg.addColorStop(1,'rgba(255,80,60,0)'); c.fillStyle=rg; c.fillRect(gx-aw*2,fy-aw*2,aw*4,aw*2);
    [-1,1].forEach(function(sd){ c.fillStyle='rgba(255,70,50,'+(0.6+Math.sin(e*4+sd)*0.3)+')'; c.beginPath(); c.ellipse(gx+sd*14*k,fy-ah*0.62,5*k,2.6*k,sd*0.3,0,6.3); c.fill(); });
    bossMark(c,gx,fy-ah-26*k,16*k,'boss');
    [gx-aw-34*k, gx+aw+34*k].forEach(function(tx,ti){ c.fillStyle='#5a3d24'; c.fillRect(tx-3*k,fy-80*k,6*k,24*k); var fl=0.85+Math.sin(e*11+ti*2)*0.12; c.fillStyle='#ff9a3c'; c.beginPath(); c.ellipse(tx,fy-86*k,6*k,12*k*fl,0,0,6.3); c.fill(); c.fillStyle='#fff3b0'; c.beginPath(); c.ellipse(tx,fy-84*k,3*k,6*k*fl,0,0,6.3); c.fill(); var tg=c.createRadialGradient(tx,fy-86*k,2,tx,fy-86*k,60*k); tg.addColorStop(0,'rgba(255,170,80,0.35)'); tg.addColorStop(1,'rgba(255,170,80,0)'); c.fillStyle=tg; c.fillRect(tx-60*k,fy-146*k,120*k,120*k); });
    c.fillStyle='#120c18'; c.fillRect(0,fy,W,H-fy); c.fillStyle='#3a2a48'; c.fillRect(0,fy,W,3); }
    var ride=Math.min(1,e/2.4), rp2= ride<0.6? ride/0.6*0.75 : 0.75+0.25*Math.sin((ride-0.6)/0.4*Math.PI/2), hx=-70*k+((artOk('gate')? W*0.3 : W*0.34)+70*k)*rp2, keep=[heroRun,won,choosing,VS&&VS.empty];
    heroRun= ride<1? Math.max(0.05, Math.min(1, (1-ride)*2.6)) : false; won=false; choosing=false; if (VS) VS.empty=false;
    var spd= ride<1? Math.min(1,(1-ride)*2.6) : 0; if (spd>0.15){ c.save(); c.lineCap='round'; for (i=0;i<6;i++){ var ly2=fy-(18+((i*37)%110))*k*1.1, ln=(40+((i*53)%60))*k*spd, lx=hx-(70+((i*29+e*900)%140))*k; c.strokeStyle='rgba(255,240,210,'+(0.32*spd)+')'; c.lineWidth=(1.5+(i%3))*k*0.7; c.beginPath(); c.moveTo(lx,ly2); c.lineTo(lx-ln,ly2); c.stroke(); } c.restore(); }
    c.save(); c.translate(hx,fy); c.scale(k*1.1,k*1.1); c.fillStyle='rgba(0,0,0,0.4)'; el(c,0,3,44,7); c.fill(); try{ heroArt(c,e); }catch(err){} c.restore();
    heroRun=keep[0]; won=keep[1]; choosing=keep[2]; if (VS) VS.empty=keep[3];
    if (ride<0.85 && Math.random()<0.8) ps.push({x:hx-30*k+Math.random()*50*k,y:fy-2*k,vx:-80-Math.random()*90,vy:-20-Math.random()*50,t:0.4+Math.random()*0.3});
    for (i=ps.length-1;i>=0;i--){ var q=ps[i]; q.t-=1/60; if (q.t<=0){ ps.splice(i,1); continue; } q.x+=q.vx/60; q.y+=q.vy/60; c.globalAlpha=q.t; c.fillStyle='#8a7a9a'; c.beginPath(); c.arc(q.x,q.y,4*k,0,6.3); c.fill(); } c.globalAlpha=1;
    if (!rumbled && Snd.live()){ rumbled=true; if (e<0.8) Snd.rumble(); }
    if (ride<1) for (i=0;i<4;i++){ var hn=Math.floor(e*2.6-LEGPH[i]); if (hn>hoofN[i]){ hoofN[i]=hn; if (hn>0) Snd.hoof(0.35+0.65*Math.min(1,(1-ride)*2.6)); } }
    if (e>1.2 && !horned && Snd.live()){ horned=true; Snd.horn(); }
    if (e>1.2 && $('inLogo').className.indexOf('pop')<0){ $('inLogo').classList.add('pop'); }
    if (e>1.9) $('inStory').style.opacity=1;
    if (e>2.6) $('inTap').className='out on';
    if (e>6.5) end();
  };
  requestAnimationFrame(loop);
}
// ---------------- poster for the store covers (?debug&poster): knight vs dragon in the dungeon, potions, the title ----------------
function drawPoster(){
  var W=innerWidth, H=innerHeight, d=Math.min(2,window.devicePixelRatio||1), c=cx, t=1.3, i, k=Math.min(W,H)/520, land=W>H*1.2, port=H>W*1.2;
  cv.width=Math.round(W*d); cv.height=Math.round(H*d); c.setTransform(d,0,0,d,0,0); c.lineJoin='round'; c.lineCap='round';
  var th=THEMES[3], fy=H*(port? 0.72 : 0.76), tsz=Math.min(W*(land? 0.085 : 0.13), H*(land? 0.13 : 0.1)), ty2=H*0.04+tsz*0.6, nl= land? 1 : 2, tb=ty2+(nl-1)*tsz*1.02+tsz*1.25, fs2=Math.min((fy-tb-10)/150, W*(land? 0.36 : 0.44)/125);
  var useImg=artOk('room-arch');
  if (useImg){ var s0=Math.max(W/1920, H/1080, fy/(0.8*1080)), iw=1920*s0, ih=1080*s0; c.drawImage(ART['room-arch'], (W-iw)/2, fy-0.8*ih, iw, ih); c.fillStyle='rgba(20,6,10,0.35)'; c.fillRect(0,0,W,H); }
  var g=c.createLinearGradient(0,0,0,fy); g.addColorStop(0,'#14081a'); g.addColorStop(1,'#4a1a24'); c.fillStyle=g; if (!useImg) c.fillRect(0,0,W,H);
  if (!useImg) c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=2; for (var y=0, rw=0; y<fy; y+=34*k, rw++){ c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); for (var x=(rw%2? -40*k : 0); x<W; x+=80*k){ c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+34*k); c.stroke(); } }
  // big arch behind the dragon, hellish light
  var ax=W*(port? 0.62 : 0.68), aw=Math.min(W*0.28, 170*k), ah=Math.min(fy*0.86, 360*k);
  if (!useImg){ c.beginPath(); c.moveTo(ax-aw-16*k,fy); c.lineTo(ax-aw-16*k,fy-ah+aw); c.arc(ax,fy-ah+aw,aw+16*k,Math.PI,0); c.lineTo(ax+aw+16*k,fy); c.closePath(); c.fillStyle='#4a3040'; c.fill(); c.lineWidth=4; c.strokeStyle=OL; c.stroke();
  c.beginPath(); c.moveTo(ax-aw,fy); c.lineTo(ax-aw,fy-ah+aw); c.arc(ax,fy-ah+aw,aw,Math.PI,0); c.lineTo(ax+aw,fy); c.closePath(); g=c.createLinearGradient(0,fy-ah,0,fy); g.addColorStop(0,'#1a0408'); g.addColorStop(1,'#c0401a'); c.fillStyle=g; c.fill(); c.stroke(); }
  var rg=c.createRadialGradient(ax,fy,10,ax,fy,aw*2.4); rg.addColorStop(0,'rgba(255,140,40,0.55)'); rg.addColorStop(1,'rgba(255,140,40,0)'); c.fillStyle=rg; c.fillRect(0,0,W,H);
  // torches
  if (!useImg) [W*0.06, W*0.94].forEach(function(tx,ti){ var ty=fy-150*k; c.fillStyle='#5a3d24'; c.fillRect(tx-5*k,ty,10*k,36*k); c.fillStyle='#ff9a3c'; c.beginPath(); c.ellipse(tx,ty-10*k,10*k,20*k,0,0,6.3); c.fill(); c.fillStyle='#fff3b0'; c.beginPath(); c.ellipse(tx,ty-6*k,5*k,10*k,0,0,6.3); c.fill(); var tg=c.createRadialGradient(tx,ty,2,tx,ty,120*k); tg.addColorStop(0,'rgba(255,170,80,0.4)'); tg.addColorStop(1,'rgba(255,170,80,0)'); c.fillStyle=tg; c.fillRect(tx-120*k,ty-120*k,240*k,240*k); });
  if (!useImg){ g=c.createLinearGradient(0,fy,0,H); g.addColorStop(0,'#3a2430'); g.addColorStop(1,'#100810'); c.fillStyle=g; c.fillRect(0,fy,W,H-fy); c.fillStyle='rgba(255,180,120,0.25)'; c.fillRect(0,fy,W,2); }
  // the dragon
  var ds=fs2*1.08; c.save(); c.translate(ax+(land? 30 : 6)*ds, fy); c.scale(ds,ds); c.fillStyle='rgba(0,0,0,0.4)'; el(c,0,3,60,8); c.fill(); mArt.dragon(c,t,MCOL.dragon[0],-0.3,true,0,0.4); c.restore();
  var fxs=ax+(land? 30 : 6)*ds-58*ds, fys=fy-86*ds; for (i=0;i<22;i++){ var fx2=fxs-i*4.2*ds, fy2=fys+i*1.6*ds+Math.sin(i*1.7)*4*ds; c.globalAlpha=0.9-i*0.03; c.fillStyle=['#fff3b0','#ffe14a','#ff9a3c','#f04848'][i%4]; c.beginPath(); c.arc(fx2,fy2,(3+i*0.45)*ds,0,6.3); c.fill(); } c.globalAlpha=1;
  // the knight charging
  var hs=fs2, kx=W*(land? 0.27 : 0.26); VS.hAtk=0; heroRun=true; c.save(); c.translate(kx, fy); c.scale(hs,hs); c.fillStyle='rgba(0,0,0,0.45)'; el(c,0,3,46,8); c.fill(); heroArt(c,0.06); c.restore(); heroRun=false;
  // potions in front
  var pc=[0,1,2,4,5,3], nb= land? 6 : 4, pw2=Math.min(30*k, (H-fy)*0.26), gap=pw2*1.7, px0=W/2-(nb-1)*gap/2, py0=H-(H-fy)*0.12;
  for (i=0;i<nb;i++){ var bx=px0+i*gap, bh2=pw2*3, col=pc[i];
    c.save(); c.translate(bx,py0); c.beginPath(); c.roundRect(-pw2/2,-bh2,pw2,bh2,[2,2,pw2/2,pw2/2]); c.fillStyle='rgba(200,225,255,0.15)'; c.fill();
    c.save(); c.clip(); var lg=c.createLinearGradient(0,-bh2*0.9,0,0); lg.addColorStop(0,COL_HI[col]); lg.addColorStop(1,COL_LO[col]); c.fillStyle=lg; c.fillRect(-pw2,-bh2*0.88,pw2*2,bh2); c.restore();
    icon(c,DJ.ROLE[col],0,-bh2*0.42,pw2*0.28,'#fff',2.5); c.lineWidth=4; c.strokeStyle=OL; c.stroke(); c.fillStyle='rgba(255,255,255,0.35)'; c.fillRect(-pw2*0.32,-bh2*0.85,pw2*0.12,bh2*0.6);
    c.beginPath(); c.roundRect(-pw2*0.38,-bh2-pw2*0.42,pw2*0.76,pw2*0.5,4); c.fillStyle='#b9824a'; c.fill(); c.lineWidth=3; c.stroke(); c.restore(); }
  // title
  c.textAlign='center'; c.textBaseline='middle'; c.font='900 '+Math.round(tsz)+'px '+FNT; c.lineWidth=tsz*0.2; c.strokeStyle='#1a0610';
  var lines= nl===1? ['POTION KNIGHT'] : ['POTION','KNIGHT'];
  lines.forEach(function(tx3,li){ var yy=ty2+li*tsz*1.02; c.strokeText(tx3,W/2,yy); var tg2=c.createLinearGradient(0,yy-tsz/2,0,yy+tsz/2); tg2.addColorStop(0,'#fff6c2'); tg2.addColorStop(0.5,'#ffcf3a'); tg2.addColorStop(1,'#d9802a'); c.fillStyle=tg2; c.fillText(tx3,W/2,yy); });
  var sy3=ty2+(lines.length-1)*tsz*1.02+tsz*0.78, ssz=tsz*0.38; c.font='900 '+Math.round(ssz)+'px '+FNT; c.lineWidth=ssz*0.25; c.strokeText('SAVE THE PRINCESS',W/2,sy3); c.fillStyle='#ffb09a'; c.fillText('SAVE THE PRINCESS',W/2,sy3);
  var vg=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.4,W/2,H/2,Math.max(W,H)*0.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)'); c.fillStyle=vg; c.fillRect(0,0,W,H);
}
// ---------------- daily reward: a 7-day ladder; missing a day starts it again ----------------
var DAILY=[20,30,40,60,80,100,0];
function dayKey(off){ var d=new Date(Date.now()+(off||0)*86400000); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function maybeDaily(){
  if (SAVE.level<2 || QS.has('nodaily')) return; var dl=SAVE.daily||{last:'', streak:0}; if (dl.last===dayKey(0)) return;
  var day= dl.last===dayKey(-1) ? (dl.streak%7)+1 : 1, box=$('days'); box.innerHTML='';
  for (var i=1;i<=7;i++){ var dv=document.createElement('div'); dv.className='dd'+(i<day? ' got' : '')+(i===day? ' now' : '')+(i===7? ' big' : ''); var hd=document.createElement('div'); hd.textContent=tl('dayN',{n:i}); dv.appendChild(hd);
    if (i<7){ var co=document.createElement('span'); co.className='coin'; dv.appendChild(co); var bb=document.createElement('b'); bb.textContent='+'+DAILY[i-1]; dv.appendChild(bb); }
    else { var cv3=document.createElement('canvas'); cv3.width=cv3.height=64; gearTile(cv3,'top',1); dv.appendChild(cv3); var b2=document.createElement('b'); b2.textContent='+150'; dv.appendChild(b2); }
    box.appendChild(dv); }
  var give=function(mult){ var gold=(day<7? DAILY[day-1] : 150)*mult; SAVE.coins+=gold; SAVE.daily={last:dayKey(0), streak:day}; saveNow(); updHud(); $('dailyM').classList.remove('show'); Snd.buy(); toast('+'+gold);
    if (day===7){ var r= Math.random()<0.5? 1 : 0, sl=SLOTS[Math.floor(Math.random()*SLOTS.length)]; setTimeout(function(){ showLoot({slot:sl, r:r}, function(){}); }, 500); } };
  $('dailyOk').onclick=function(){ give(1); };
  $('dailyDbl').disabled=false; $('dailyDbl').onclick=function(){ var b3=this; if (PF.adBusy) return; b3.disabled=true; PF.rewarded(function(ok){ if (ok) give(2); else b3.disabled=false; }); };
  $('dailyM').classList.add('show');
}

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
}
$('shopBtn').onclick=function(){ if (PF.adBusy) return; drawShop(); $('shopM').classList.add('show'); };
$('shopX').onclick=function(){ $('shopM').classList.remove('show'); };

// ---------------- input ----------------
addEventListener('keydown', function(e){ Snd.unlock(); var dk={ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0],ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1]}[e.code]; if (dk){ e.preventDefault(); if (choosing) goDir(dk[0],dk[1]); return; } if (e.code==='KeyZ') undo(); if (e.code==='KeyR') restart(); if ((e.code==='Enter'||e.code==='Space') && $('winM').classList.contains('show')) $('wnNext').click(); });
cv.addEventListener('pointerdown', function(e){ Snd.unlock(); e.preventDefault();
  if (choosing){ var dh0=null; doorHits.forEach(function(h){ if (Math.hypot(h.x-e.clientX,h.y-e.clientY)<=h.r && (!dh0 || Math.hypot(h.x-e.clientX,h.y-e.clientY)<Math.hypot(dh0.x-e.clientX,dh0.y-e.clientY))) dh0=h; }); if (dh0){ Snd.pop(); pickRoom(dh0.id); } return; }
  var x=e.clientX, y=e.clientY, hit=-1, best=1e9;
  for (var i=0;i<V.length;i++){ var v=V[i], dx=Math.abs(x-v.x), top=v.y-bh-bw*0.9, bot=v.y+bw*0.5; if (dx<bw*0.9 && y>top && y<bot && dx<best){ best=dx; hit=i; } }
  if (hit>=0) tap(hit); else if (sel>=0){ sel=-1; }
});
cv.addEventListener('touchstart', function(e){ e.preventDefault(); }, {passive:false});
addEventListener('wheel', function(e){ e.preventDefault(); }, {passive:false});

// ---------------- frame ----------------
var last=performance.now(), frameN=0;
function frame(now){
  requestAnimationFrame(frame);
  var dt=Math.min(0.05,(now-last)/1000)*(window.__ts||1); last=now;
  PF.setPlaying(!won && !lost && !choosing && !PF.adBusy && !document.hidden && moved>0 && !$('shopM').classList.contains('show'));
  draw(dt); updPad(); if (((frameN=(frameN|0)+1)&7)===0) drawMap($('mini'), false);
  if (lost && !anims.length && !laters.length && !$('loseM').classList.contains('show')){ sel=-1; $('lsRevive').disabled=false; $('loseM').classList.add('show'); Snd.thud(); }
  if (won && !anims.length && !laters.length && winT===0){ winT=now; sel=-1; setTut(''); afterKill(); }
  if (walk>0){ walk+=dt; if (walk>=0.9){ var nr=nodeAt(nextRoom); if (!RT.done[nextRoom] && nr.t!=='r' && nr.t!=='c') enterRoom(nextRoom, carryHp); else arrive(nextRoom); } }
  if (!won && !lost && !anims.length && V.some(function(w){ return w.lock>0; })){ var anyMove=false; for (var a1=0;a1<B.length && !anyMove;a1++) for (var a2=0;a2<B.length;a2++) if (pourCount(a1,a2)>0){ anyMove=true; break; } if (!anyMove){ var hadLock=false; for (var a3=0;a3<B.length;a3++) if (V[a3].lock>0){ V[a3].lock=0; V[a3].unlk=0.5; hadLock=true; } if (hadLock) Snd.clank(); } }
  if (!won){ winT=0; if (!lost && !anims.length && !stuckShown && moved>0 && DJ.stuck(B)){ stuckShown=true; toast(tl('stuck')); Snd.nope(); $('btns').classList.remove('nudge'); void $('btns').offsetWidth; $('btns').classList.add('nudge'); } }
}

// ---------------- boot ----------------
function boot(){
  try{ LANG=detectLang(PF.locale); var lt=document.querySelector('#loading>div'); if (lt) lt.textContent=tl('gameName'); }catch(e){}
  var bar=document.querySelector('#loading .bar i'); if (bar){ bar.style.animation='none'; bar.style.width='4%'; }
  var pct=document.getElementById('ldPct'); artLoad(function(p){ if (bar) bar.style.width=Math.round(4+96*p)+'%'; if (pct) pct.textContent=Math.round(100*p)+'%'; }, function(){ setTimeout(boot2, 120); }, 15000);
}
function boot2(){
  emoWatch(); [].forEach.call($('dpad').children, function(b2){ var q=b2.dataset.d.split(','); b2.innerHTML='<span class="ic" style="transform:rotate('+Math.round(Math.atan2(+q[1],+q[0])*180/Math.PI+90)+'deg)">'+ICO.svg('arr')+'</span>'; });
  LANG=detectLang(PF.locale); applyLang(); loadSave();
  DPR=Math.min(window.devicePixelRatio||1, 2); VW=innerWidth; VH=innerHeight; cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR);
  startFloor(SAVE.level, Math.min(DJ.stagesOf(SAVE.level), +QS.get('stage')||0));
  if (DEBUG && QS.has('ending')) setTimeout(function(){ playEnding(function(){}); }, 600);
  $('loading').style.display='none'; PF.loaded();
  if (DEBUG && QS.has('poster')){ document.getElementById('hud').style.display='none'; $('introM').style.display='none'; [].forEach.call(document.querySelectorAll('#coinBox,#mini'), function(e2){ e2.style.display='none'; }); var tries=0, waitArt=function(){ if ((artOk('knight-2')&&artOk('dragon')&&artOk('room-arch')) || ++tries>60){ SAVE.gear.top=2; drawPoster(); } else setTimeout(waitArt,100); }; waitArt(); return; }
  if (QS.has('nointro') || QS.has('ending') || (DEBUG && !QS.has('intro'))) { $('introM').style.display='none'; maybeDaily(); }
  else playIntro(maybeDaily);
  if (DEBUG){ window.__DJ=DJ; window.__PF=PF; window.__Snd=Snd; window.__S={ft:floorTransition, get VS(){ return VS; }, get B(){ return B; }, get V(){ return V; }, get L(){ return L; }, get won(){ return won; }, get lost(){ return lost; }, get F(){ return F; }, get laters(){ return laters; }, get SAVE(){ return SAVE; }, get anims(){ return anims; }, get bw(){ return bw; }, get bh(){ return bh; }, tap:tap, flush:flush, load:loadLevel, get doors(){ return doorHits; }, get RT(){ return RT; }, get choosing(){ return choosing; }, options:options, pick:pickRoom, get stage(){ return curStage; }, get walk(){ return walk; }, set energy(v){ energy=v; updSkills(); }, get energy(){ return energy; }}; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
