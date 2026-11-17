// ===== GAME (render + UI) =====
(function(){
'use strict';
window.addEventListener('error',function(e){ if(window.PokiSDK||window.CrazyGames) return; var d=document.getElementById('errbox')||document.body.appendChild(Object.assign(document.createElement('pre'),{id:'errbox'})); d.style.cssText='position:fixed;left:0;bottom:0;z-index:99;background:#a00;color:#fff;font-size:11px;max-width:100%;white-space:pre-wrap;margin:0'; d.textContent+=e.message+' @'+e.lineno+'\n'; });
var T = window.THREE, W=DJ.W, D=DJ.D;
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

// ---------------- renderer ----------------
var canvas=$('c');
// quality: 2 full, 1 no torch lights, 0 no shadows, -1 render at 0.75x resolution (weak integrated GPUs)
var QUAL=2; try{ var qs=localStorage.getItem('dj_q'); if(qs!==null && !isNaN(+qs)) QUAL=Math.max(-1,Math.min(2,+qs)); }catch(e){}
if (QS.has('q')) QUAL=+QS.get('q');
// MSAA can only be chosen at context creation: skip it once a previous session had to drop to q0 or lower
var renderer=new T.WebGLRenderer({canvas:canvas, antialias:QUAL>=1, powerPreference:'high-performance'});
function dprFor(q){ return q<0 ? 0.75 : Math.min(window.devicePixelRatio||1, q>=2?1.5:(q===1?1.25:1)); }
renderer.setPixelRatio(dprFor(QUAL));
renderer.shadowMap.enabled=QUAL>=1; renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
var scene=new T.Scene(); scene.background=new T.Color(0x1a1220); scene.fog=new T.Fog(0x1a1220, 26, 48);
var camera=new T.PerspectiveCamera(38, 1, 0.5, 120);
var hemi=new T.HemisphereLight(0xffe2c4, 0x3a2848, 1.15); scene.add(hemi);
var sun=new T.DirectionalLight(0xfff0dd, 1.5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.castShadow=QUAL>=1;
var sc=sun.shadow.camera; sc.left=-16; sc.right=16; sc.top=16; sc.bottom=-16; sc.near=1; sc.far=50; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
scene.add(sun); scene.add(sun.target);
if (QUAL<2) hemi.intensity=1.45;
var torchLights=[]; for (var i=0;i<(QUAL>=2?2:0);i++){ var pl=new T.PointLight(0xff9a40, 0, 11, 1.6); scene.add(pl); torchLights.push(pl); }

function mat(c, o){ o=o||{}; o.color=c; if(o.flat!==false) o.flatShading=true; delete o.flat; return new T.MeshLambertMaterial(o); }
var M={};
function mesh(g, m, x,y,z, cast){ var o=new T.Mesh(g,m); o.position.set(x||0,y||0,z||0); o.castShadow=cast!==false; o.receiveShadow=true; return o; }
function canvasTex(w,h,draw){ var c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); var t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; return t; }

// textures
var plankTex=canvasTex(256,256,function(x,w,h){
  var cols=['#9a6a3e','#a5734a','#8f6138','#a06b40'];
  for (var i=0;i<8;i++){ x.fillStyle=cols[i%4]; x.fillRect(0,i*32,w,31); x.fillStyle='#5e3a1e'; x.fillRect(0,i*32+31,w,1); var o=(i*97)%w; x.fillRect(o,i*32,2,31); x.fillRect((o+128)%w,i*32,2,31);
    x.globalAlpha=0.12; for (var k=0;k<6;k++){ x.fillStyle='#3a2210'; x.fillRect(Math.random()*w, i*32+4+Math.random()*24, 30+Math.random()*60, 1); } x.globalAlpha=1; }
});
plankTex.wrapS=plankTex.wrapT=T.RepeatWrapping; plankTex.repeat.set(3, 2.5);
var stoneTex=canvasTex(256,128,function(x,w,h){ x.fillStyle='#3e3044'; x.fillRect(0,0,w,h); var cols=['#7a6a80','#857488','#6f6176','#8a7b8c'];
  for (var j=0;j<4;j++) for (var i=0;i<5;i++){ x.fillStyle=cols[(i*3+j)%4]; var o=j%2?25:0; x.fillRect(i*52+o-24+3,j*32+3,46,26); } });
stoneTex.wrapS=stoneTex.wrapT=T.RepeatWrapping; stoneTex.repeat.set(3,1);
M.floor=new T.MeshLambertMaterial({map:plankTex});
M.wall=new T.MeshLambertMaterial({map:stoneTex}); M.wallTop=mat(0x8a7aa0); M.wallDark=mat(0x4c3f5c);
M.wood=mat(0xa0683a); M.woodDark=mat(0x6e4224); M.woodLight=mat(0xc58a52);
M.metal=mat(0xb9c2cc); M.darkMetal=mat(0x5a6170); M.gold=mat(0xffcf3a,{emissive:0x553300}); M.chest=mat(0x9b5a2e); M.chestDark=mat(0x6e3b1c);
M.flame=new T.MeshBasicMaterial({color:0xffb347}); M.flame2=new T.MeshBasicMaterial({color:0xfff07a});
M.rock=mat(0x8a8090); M.sack=mat(0xb07a42); M.rope=mat(0x6b4a2a);
M.black=new T.MeshBasicMaterial({color:0x1b1220}); M.white=mat(0xffffff); M.bone=mat(0xeee6d0);
M.beer=mat(0xf2a31b,{emissive:0x442200}); M.foam=mat(0xfff8e8); M.glass=mat(0xd8eef5); M.meat=mat(0x9c4a24); M.meatHi=mat(0xc8703a);
M.dirt=new T.MeshBasicMaterial({color:0x4a2e18, transparent:true, opacity:0.55, depthWrite:false});
M.ghost=new T.MeshBasicMaterial({color:0xffe45c, transparent:true, opacity:0.18, depthWrite:false});
M.potion=new T.MeshBasicMaterial({color:0x7cff6a}); M.red=mat(0xc0392b);

var world=new T.Group(); scene.add(world);
var torches=[];
var gBox=function(w,h,d){ return new T.BoxGeometry(w,h,d); };
function addWall(grp, x0,z0,x1,z1, h, m){
  var w=Math.abs(x1-x0)||0.6, d=Math.abs(z1-z0)||0.6, cx=(x0+x1)/2, cz=(z0+z1)/2;
  grp.add(mesh(gBox(w,h,d), m||M.wall, cx, h/2, cz));
  grp.add(mesh(gBox(w+0.06,0.14,d+0.06), M.wallTop, cx, h+0.07, cz, false));
}
function mulberry(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// ---------------- static tavern ----------------
var kegV=null, grillV=null, trashV=null;
function buildTavern(){
  var g=new T.Group(), hw=W/2;
  // outside ground + path
  var gr=mesh(new T.PlaneGeometry(60, 30), mat(0x2b2032), 0, -0.02, 14, false); gr.rotation.x=-Math.PI/2; g.add(gr);
  var path=mesh(new T.PlaneGeometry(2.6, 8), mat(0x6a5a64), 0, -0.01, 4, false); path.rotation.x=-Math.PI/2; g.add(path);
  // floor
  var f=mesh(new T.PlaneGeometry(W, D), M.floor, 0, 0, -D/2, false); f.rotation.x=-Math.PI/2; g.add(f);
  // rug at the entrance
  var rug=mesh(new T.PlaneGeometry(2.2, 1.4), mat(0xb03a3a,{flat:false}), 0, 0.012, -0.8, false); rug.rotation.x=-Math.PI/2; g.add(rug);
  // walls
  addWall(g, -hw-0.3, 0.15, -hw-0.3, -D, 2.4); addWall(g, hw+0.3, 0.15, hw+0.3, -D, 2.4);
  addWall(g, -hw-0.3, -D-0.2, hw+0.3, -D-0.2, 3.2);
  addWall(g, -hw-0.3, 0.15, -1.4, 0.15, 0.45); addWall(g, 1.4, 0.15, hw+0.3, 0.15, 0.45);
  [-1.5,1.5].forEach(function(x){ g.add(mesh(gBox(0.45,0.8,0.45), M.woodDark, x, 0.4, 0.15)); g.add(mesh(new T.ConeGeometry(0.12,0.3,6), M.flame, x, 0.95, 0.15, false)); });
  // shelves with bottles on the back wall
  var rr=mulberry(7);
  [1.3,2.1].forEach(function(y){ g.add(mesh(gBox(W-1,0.08,0.4), M.woodDark, 0, y, -D+0.1, false));
    for (var i=0;i<14;i++){ var bx=-hw+0.9+i*0.75+rr()*0.2; if (Math.abs(bx-DJ.GRILL.x)<1.3) continue; var c=[0x5ad27a,0xd25a5a,0x5a8ad2,0xe0c050][Math.floor(rr()*4)];
      g.add(mesh(new T.CylinderGeometry(0.08,0.1,0.32,6), mat(c), bx, y+0.2, -D+0.12, false)); } });
  // bar counter (gap behind it is staff-only)
  g.add(mesh(gBox(W-0.6,0.95,0.7), M.wood, 0, 0.475, -8.35));
  g.add(mesh(gBox(W-0.4,0.1,0.85), M.woodLight, 0, 1.0, -8.35));
  // lanterns on the side walls
  [-5.2,-1.6].forEach(function(z){ [-hw, hw].forEach(function(x,i){
    var lx=x+(i?-0.18:0.18); g.add(mesh(gBox(0.22,0.3,0.22), M.darkMetal, lx, 1.9, z));
    var fl=mesh(new T.ConeGeometry(0.1,0.24,6), M.flame, lx, 1.92, z, false); g.add(fl);
    torches.push({x:x+(i?-0.6:0.6), z:z, fl:fl, ph:Math.random()*6}); }); });
  // barrels in corners
  [[-5.4,-7.0],[-5.4,-6.3],[5.4,-3.8]].forEach(function(p){ var br=mesh(new T.CylinderGeometry(0.35,0.3,0.7,8), M.chest, p[0], 0.35, p[1]); g.add(br); });
  world.add(g);
  buildKeg(); buildGrill(); buildPot(); buildTrash();
}
function buildKeg(){
  var K=DJ.KEG, g=new T.Group(); g.position.set(K.x,0,K.z);
  var st=mesh(gBox(1.4,1.1,0.9), M.woodDark, 0,0.55,0); g.add(st);
  var b=mesh(new T.CylinderGeometry(0.62,0.62,1.3,12), M.chest, 0,1.7,0); b.rotation.z=Math.PI/2; g.add(b);
  [-0.45,0.45].forEach(function(x){ var r=mesh(new T.TorusGeometry(0.63,0.05,5,14), M.darkMetal, x,1.7,0,false); r.rotation.y=Math.PI/2; g.add(r); });
  g.add(mesh(new T.CylinderGeometry(0.06,0.06,0.35,6), M.metal, 0,1.2,0.45));
  var ic=iconSprite('🍺','#fff2b0'); ic.position.set(0,2.9,0); g.add(ic);
  world.add(g); kegV={g:g, ic:ic};
}
function buildGrill(){
  var K=DJ.GRILL, g=new T.Group(); g.position.set(K.x,0,K.z);
  g.add(mesh(gBox(1.8,1.0,1.0), M.rock, 0,0.5,-0.1));
  g.add(mesh(gBox(1.9,0.15,1.1), M.wallDark, 0,2.4,-0.1));
  [-0.8,0.8].forEach(function(x){ g.add(mesh(gBox(0.2,1.4,0.2), M.rock, x,1.7,-0.4)); });
  var fire=new T.Group(); fire.add(mesh(new T.ConeGeometry(0.25,0.5,6), M.flame, -0.25,1.2,-0.2,false)); fire.add(mesh(new T.ConeGeometry(0.2,0.42,6), M.flame2, 0.2,1.18,-0.2,false)); fire.add(mesh(new T.ConeGeometry(0.28,0.6,6), M.flame, 0,1.25,-0.25,false)); g.add(fire);
  var spit=mesh(new T.CylinderGeometry(0.03,0.03,1.7,5), M.metal, 0,1.75,-0.2,false); spit.rotation.z=Math.PI/2; g.add(spit);
  var roast=makeMeat(); roast.scale.setScalar(1.6); roast.position.set(0,1.75,-0.2); g.add(roast);
  var plate=mesh(new T.CylinderGeometry(0.5,0.5,0.05,12), M.white, 0,1.08,0.32,false); g.add(plate);
  var ready=[]; for (var i=0;i<DJ.GRILL_MAX;i++){ var m=makeMeat(); m.position.set(-0.28+i*0.28,1.16,0.32); m.rotation.y=i; g.add(m); ready.push(m); }
  var cover=new T.Group(); cover.add(mesh(gBox(2.0,2.6,0.12), M.woodDark, 0,1.3,0.45)); [-0.5,0.5].forEach(function(x){ cover.add(mesh(gBox(0.12,2.6,0.14), M.wood, x,1.3,0.47,false)); });
  var lock=makeLabel('🔒', 128, 128, '#fff', null); lock.position.set(0,1.6,0.6); lock.scale.set(0.8,0.8,1); cover.add(lock); g.add(cover);
  var ic=iconSprite('🍖','#ffd9b8'); ic.position.set(0,3.0,0); g.add(ic);
  world.add(g); grillV={g:g, fire:fire, roast:roast, ready:ready, cover:cover, ic:ic};
}
function buildPot(){
  var K=DJ.POT, g=new T.Group(); g.position.set(K.x,0,K.z);
  g.add(mesh(new T.SphereGeometry(0.6,10,8,0,Math.PI*2,Math.PI/2.6,Math.PI/1.6), M.black, 0,1.45,0));
  var liq=mesh(new T.CircleGeometry(0.5,12), M.potion, 0,1.72,0,false); liq.rotation.x=-Math.PI/2; g.add(liq);
  var lab=makeLabel('🔒 '+tl('soon'), 384, 96, '#ffffff', 'rgba(40,24,48,0.8)'); lab.position.set(0,2.75,0.2); lab.scale.set(2.2,0.55,1); g.add(lab);
  world.add(g);
}
function buildTrash(){
  var K=DJ.TRASH, g=new T.Group(); g.position.set(K.x,0,K.z);
  g.add(mesh(new T.CylinderGeometry(0.32,0.26,0.7,10), M.darkMetal, 0,0.35,0));
  var rim=mesh(new T.TorusGeometry(0.32,0.04,4,12), M.metal, 0,0.7,0,false); rim.rotation.x=Math.PI/2; g.add(rim);
  var ic=iconSprite('🗑️','#e8e8e8'); ic.position.set(0,1.4,0); ic.scale.set(0.55,0.55,1); g.add(ic);
  world.add(g); trashV={g:g, ic:ic};
}
// props
function makeMug(){ var g=new T.Group(); g.add(mesh(new T.CylinderGeometry(0.14,0.13,0.3,8), M.beer, 0,0.15,0,false)); g.add(mesh(new T.CylinderGeometry(0.15,0.15,0.08,8), M.foam, 0,0.32,0,false));
  var hd=mesh(new T.TorusGeometry(0.08,0.025,4,8,Math.PI), M.glass, 0.15,0.16,0,false); hd.rotation.z=-Math.PI/2; g.add(hd); return g; }
function makeMeat(){ var g=new T.Group(); var m=mesh(new T.SphereGeometry(0.15,7,6), M.meat, 0,0.12,0,false); m.scale.set(1.3,0.9,1); g.add(m);
  var b=mesh(new T.CylinderGeometry(0.03,0.03,0.22,5), M.bone, 0.2,0.12,0,false); b.rotation.z=Math.PI/2; g.add(b); g.add(mesh(new T.SphereGeometry(0.045,5,4), M.bone, 0.31,0.12,0,false)); return g; }
var sackGeo=new T.SphereGeometry(0.3,7,6);

// ---------------- labels / sprites ----------------
function makeLabel(text, w, h, color, bg, font){
  if (COVER) text=''; // store covers: no in-world text
  var tex=canvasTex(w,h,function(x){ drawLabel(x,w,h,text,color,bg,font); });
  var m=new T.Mesh(new T.PlaneGeometry(1,1), new T.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false}));
  m.userData.redraw=function(t){ var cv=tex.image, x=cv.getContext('2d'); x.clearRect(0,0,w,h); drawLabel(x,w,h,t,color,bg,font); tex.needsUpdate=true; };
  return m;
}
function drawLabel(x,w,h,text,color,bg,font){
  if (bg){ x.fillStyle=bg; x.beginPath(); if(x.roundRect) x.roundRect(2,2,w-4,h-4,h/2.5); else x.rect(2,2,w-4,h-4); x.fill(); }
  x.font=(font||'900 '+Math.floor(h*0.55)+'px "Trebuchet MS",system-ui,sans-serif'); x.textAlign='center'; x.textBaseline='middle';
  x.lineWidth=Math.max(3,h*0.08); x.strokeStyle='#2a1a2e'; if(!bg) x.strokeText(text,w/2,h/2+2);
  x.fillStyle=color; x.fillText(text,w/2,h/2+2);
}
function spriteIcon(emoji, ring){
  var tex=canvasTex(128,128,function(x){ x.fillStyle=ring||'#fff'; x.beginPath(); x.arc(64,58,48,0,7); x.fill(); x.beginPath(); x.moveTo(50,100); x.lineTo(78,100); x.lineTo(64,122); x.fill();
    x.fillStyle='#3a2440'; x.font='60px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(emoji,64,62); });
  var s=new T.Sprite(new T.SpriteMaterial({map:tex, depthTest:false, transparent:true})); s.scale.set(0.9,0.9,1); s.renderOrder=10; return s;
}
var iconCache={};
function iconMat(emoji, ring){ var k=emoji+(ring||''); if(!iconCache[k]) iconCache[k]=spriteIcon(emoji,ring).material; return iconCache[k]; }
function iconSprite(emoji, ring){ var s=new T.Sprite(iconMat(emoji,ring)); s.scale.set(0.9,0.9,1); s.renderOrder=10; return s; }
// progress ring sprites
var ringPool=[];
function ringSprite(){
  var c=document.createElement('canvas'); c.width=c.height=96; var tex=new T.CanvasTexture(c);
  var s=new T.Sprite(new T.SpriteMaterial({map:tex, depthTest:false, transparent:true})); s.scale.set(1.1,1.1,1); s.renderOrder=11;
  s.userData.draw=function(p, col){ var x=c.getContext('2d'); x.clearRect(0,0,96,96); x.lineWidth=13; x.strokeStyle='rgba(30,20,40,0.65)'; x.beginPath(); x.arc(48,48,36,0,7); x.stroke();
    x.strokeStyle=col||'#7ee06a'; x.lineCap='round'; x.beginPath(); x.arc(48,48,36,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,p)); x.stroke(); tex.needsUpdate=true; };
  scene.add(s); return s;
}
for (var ri=0; ri<10; ri++){ var rs=ringSprite(); rs.visible=false; ringPool.push(rs); }

// ---------------- characters ----------------
var capGeo=new T.CapsuleGeometry(0.3,0.36,3,8), headGeo=new T.SphereGeometry(0.3,10,8), eyeGeo=new T.SphereGeometry(0.055,6,5), legGeo=gBox(0.16,0.4,0.18);
function makeChar(o){
  var g=new T.Group(), inner=new T.Group(); g.add(inner);
  var body=mesh(capGeo, mat(o.body), 0, 0.78, 0); inner.add(body);
  var head=mesh(headGeo, mat(o.skin||0xffd2a8), 0, 1.38, 0); inner.add(head);
  [-0.11,0.11].forEach(function(x){ inner.add(mesh(eyeGeo, M.black, x, 1.42, 0.26, false)); });
  var legs=[-0.13,0.13].map(function(x){ var l=mesh(legGeo, mat(o.leg||0x3a2a3a), x, 0.32, 0); l.geometry=legGeo; inner.add(l); return l; });
  var hm=mat(o.hatc||0xffd84a);
  if (o.hat==='cap'){ inner.add(mesh(new T.SphereGeometry(0.31,10,6,0,Math.PI*2,0,Math.PI/2), hm, 0,1.45,0)); inner.add(mesh(gBox(0.4,0.05,0.25), hm, 0,1.47,0.25)); }
  if (o.hat==='helm'){ inner.add(mesh(new T.SphereGeometry(0.33,10,6,0,Math.PI*2,0,Math.PI/1.8), hm, 0,1.4,0)); inner.add(mesh(gBox(0.05,0.3,0.05), mat(0xd94848), 0,1.78,0)); }
  if (o.hat==='hood'){ inner.add(mesh(new T.ConeGeometry(0.36,0.55,8), hm, 0,1.66,-0.03)); }
  if (o.hat==='wizard'){ var wz=mesh(new T.ConeGeometry(0.34,0.8,8), hm, 0,1.85,0); wz.rotation.x=-0.2; inner.add(wz); inner.add(mesh(new T.CylinderGeometry(0.46,0.46,0.05,10), hm, 0,1.55,0)); }
  if (o.hat==='crown'){ for (var i=0;i<5;i++){ var a=i/5*Math.PI*2; inner.add(mesh(new T.ConeGeometry(0.07,0.22,4), M.gold, Math.cos(a)*0.22,1.72,Math.sin(a)*0.22)); } inner.add(mesh(new T.CylinderGeometry(0.26,0.26,0.1,10), M.gold,0,1.62,0)); }
  if (o.hat==='tophat'){ inner.add(mesh(new T.CylinderGeometry(0.2,0.2,0.4,10), hm, 0,1.82,0)); inner.add(mesh(new T.CylinderGeometry(0.34,0.34,0.04,10), hm, 0,1.63,0)); }
  if (o.ears){ [-1,1].forEach(function(s){ var e=mesh(new T.ConeGeometry(0.1,0.35,4), mat(o.skin), s*0.33,1.42,0); e.rotation.z=-s*1.2; inner.add(e); }); }
  if (o.apron){ inner.add(mesh(gBox(0.42,0.4,0.05), mat(o.apron), 0,0.72,0.3)); }
  if (o.cape){ var cp=mesh(gBox(0.6,0.9,0.05), mat(o.cape), 0,0.85,-0.3); inner.add(cp); }
  if (o.mop){ var mp=new T.Group(); mp.add(mesh(new T.CylinderGeometry(0.035,0.035,1.3,5), M.rope, 0,0.65,0)); mp.add(mesh(new T.CylinderGeometry(0.16,0.2,0.18,7), mat(0x7ad0e8), 0,0.05,0)); mp.position.set(0.42,0.1,0.12); mp.rotation.z=-0.25; inner.add(mp); g.userData.mop=mp; }
  if (o.sword){ var sw=mesh(gBox(0.07,0.7,0.12), M.metal, 0.4,0.85,0.15); inner.add(sw); }
  if (o.staff){ inner.add(mesh(new T.CylinderGeometry(0.04,0.04,1.4,5), M.rope, 0.4,0.75,0.1)); inner.add(mesh(new T.OctahedronGeometry(0.13), mat(0x7ae8ff,{emissive:0x2266aa}), 0.4,1.5,0.1)); }
  if (o.bow){ var bw=mesh(new T.TorusGeometry(0.35,0.03,4,10,Math.PI), M.rope, 0.38,0.85,0); bw.rotation.y=Math.PI/2; bw.rotation.z=Math.PI/2; inner.add(bw); }
  if (o.bag){ var bg=mesh(sackGeo, M.sack, -0.05,0.95,-0.38); bg.scale.setScalar(0.9); inner.add(bg); }
  g.scale.setScalar(o.scale||1);
  g.userData.legs=legs; g.userData.inner=inner; g.userData.ph=Math.random()*6;
  world.add(g); return g;
}
function animChar(g, moving, dt, working){
  var u=g.userData; u.ph+=dt*(moving?13:4);
  var a=moving?Math.sin(u.ph)*0.7:0;
  u.legs[0].rotation.x=a; u.legs[1].rotation.x=-a;
  u.inner.position.y = moving?Math.abs(Math.sin(u.ph))*0.08 : Math.sin(u.ph*0.5)*0.015;
  if (u.mop) u.mop.rotation.x = working? Math.sin(u.ph*2.2)*0.6 : 0;
  u.inner.rotation.z = working? Math.sin(u.ph*2.2)*0.06 : 0;
}
var HERO_LOOK={
  knight:{body:0xb8c4d6, hat:'helm', hatc:0x9aa6ba, sword:1},
  archer:{body:0x4f9a4a, hat:'hood', hatc:0x3c7a38, bow:1},
  mage:{body:0x7b52c9, hat:'wizard', hatc:0x5b36a8, staff:1},
  rogue:{body:0x4a4a5a, hat:'hood', hatc:0x2e2e3a, sword:1},
  king:{body:0xe3b23c, hat:'crown', cape:0xc0392b, sword:1, scale:1.45},
  inspector:{body:0x7d7f86, hat:'tophat', hatc:0x222222},
  thief:{body:0x2b2b33, hat:'hood', hatc:0x18181f, bag:1, skin:0xe0b890}
};

// ---------------- game state & views ----------------
var G=null, views={tb:{}, hr:{}, gb:{}}, player=null, carryStack=[], padViews=[], arrow3d=null, floorArrow=null, benchMesh=null;
var coinGeo=new T.CylinderGeometry(0.17,0.17,0.06,10);
var FOOD_ICON={beer:'🍺', meat:'🍖'};

function tableView(t){
  var g=new T.Group(); g.position.set(t.x,0,t.z); world.add(g);
  var body=new T.Group(); g.add(body);
  body.add(mesh(gBox(1.6,0.1,1.15), M.woodLight, 0,0.78,0));
  [[-0.65,-0.45],[0.65,-0.45],[-0.65,0.45],[0.65,0.45]].forEach(function(a){ body.add(mesh(gBox(0.1,0.75,0.1), M.woodDark, a[0],0.38,a[1])); });
  var stool=new T.Group(); stool.add(mesh(new T.CylinderGeometry(0.3,0.3,0.08,10), M.wood, 0,0.48,0)); stool.add(mesh(new T.CylinderGeometry(0.06,0.08,0.45,6), M.woodDark, 0,0.23,0)); stool.position.z=-0.95; body.add(stool);
  var candle=mesh(new T.CylinderGeometry(0.05,0.05,0.16,6), M.white, 0.55,0.91,0.35,false); body.add(candle); body.add(mesh(new T.ConeGeometry(0.04,0.1,5), M.flame, 0.55,1.04,0.35,false));
  var dirt=new T.Group(); [[-0.3,0.1,0.35],[0.25,-0.2,0.28],[0.05,0.25,0.2]].forEach(function(a){ var d=mesh(new T.CircleGeometry(a[2],10), M.dirt, a[0],0.84,a[1],false); d.rotation.x=-Math.PI/2; dirt.add(d); });
  for (var i=0;i<5;i++) dirt.add(mesh(new T.BoxGeometry(0.06,0.04,0.06), M.meatHi, -0.4+i*0.2,0.86,(i%2?0.2:-0.15),false));
  var bones=makeMeat(); bones.children[0].visible=false; bones.position.set(-0.1,0.83,-0.15); dirt.add(bones);
  var emptyMug=makeMug(); emptyMug.children[0].visible=false; emptyMug.position.set(0.3,0.83,0); dirt.add(emptyMug);
  body.add(dirt);
  var food={beer:makeMug(), meat:makeMeat()}; food.beer.position.set(0,0.83,-0.3); food.meat.position.set(0,0.83,-0.3); food.meat.scale.setScalar(1.3); body.add(food.beer); body.add(food.meat);
  var heap=new T.Group(); heap.position.set(-0.45,0.84,0.22); body.add(heap);
  var icon=iconSprite('🧽','#d8f4ff'); icon.position.set(0,1.9,0.2); icon.scale.set(0.7,0.7,1); g.add(icon);
  var ghost=mesh(gBox(1.6,0.06,1.15), M.ghost, 0,0.03,0,false); g.add(ghost);
  var v={g:g, t:t, body:body, dirt:dirt, food:food, heap:heap, icon:icon, ghost:ghost, coinN:-1, shake:0, pop:t.on?0:-1};
  return v;
}
function setHeap(v, n){
  var k = n<=0?0: Math.min(12, 2+Math.floor(Math.sqrt(n)*1.4));
  if (k===v.coinN) return; v.coinN=k;
  while (v.heap.children.length) v.heap.remove(v.heap.children[0]);
  for (var i=0;i<k;i++){ var c=mesh(coinGeo, M.gold, ((i*37)%5-2)*0.06, 0.03+Math.floor(i/3)*0.06, ((i*53)%5-2)*0.06, false); c.rotation.y=i; v.heap.add(c); }
}
function heroView(h){
  var c=makeChar(HERO_LOOK[h.kind]); c.position.set(h.x,0,h.z); c.rotation.y=Math.PI;
  var need=new T.Sprite(iconMat('🍺','#fff')); need.scale.set(1.15,1.15,1); need.renderOrder=12; need.visible=false; world.add(need);
  var em=new T.Sprite(iconMat('😀')); em.scale.set(0.8,0.8,1); em.visible=false; world.add(em);
  var ring=ringSprite(); ring.visible=false; ring.scale.set(1.5,1.5,1); ring.renderOrder=11;
  return {h:h, c:c, need:need, em:em, emT:0, ring:ring, lastP:-1, lastNeed:null};
}
function goblinView(g){
  var col={wiper:0x3ec8e0, waiter:0xff9a3c}[g.kind];
  var c=makeChar({body:0x5a8a3a, skin:0x7ed957, ears:1, hat:'cap', hatc:col, apron:col, mop:g.kind==='wiper', scale:0.85, leg:0x3a2a1a});
  c.position.set(g.x,0,g.z);
  var z=new T.Sprite(iconMat('💤','#cfe8ff')); z.scale.set(0.7,0.7,1); z.position.y=2.3; z.visible=false; c.add(z);
  var stack=new T.Group(); c.add(stack);
  return {g:g, c:c, z:z, stack:stack, key:''};
}
function fillStack(stack, items, sc){
  while(stack.children.length) stack.remove(stack.children[0]);
  items.forEach(function(it,i){ var m= it==='beer'?makeMug():makeMeat(); m.scale.setScalar(sc); m.position.set((i%2?0.12:-0.12), 0.95+Math.floor(i/2)*0.32*sc+ (i%2?0.04:0), 0.42); stack.add(m); });
}
var PAD_EMOJI={table:'🪑', grill:'🍖', wiper:'🧽', waiter:'🍺', bench:'⬆️'};
function padName(pd){ return pd.kind==='bench'? tl('benchTitle') : tl('u_'+pd.kind); }
function padView(pd){
  var g=new T.Group(); g.position.set(pd.x,0.02,pd.z);
  var base=mesh(new T.PlaneGeometry(1.8,1.8), new T.MeshBasicMaterial({color:0x2a1a2e, transparent:true, opacity:0.6}), 0,0,0,false); base.rotation.x=-Math.PI/2; g.add(base);
  var fill=mesh(new T.PlaneGeometry(1.8,1.8), new T.MeshBasicMaterial({color:0xf5c542, transparent:true, opacity:0.6}), 0,0.005,0,false); fill.rotation.x=-Math.PI/2; g.add(fill);
  var brd=mesh(new T.RingGeometry(1.13,1.25,4,1), new T.MeshBasicMaterial({color:0xffe45c}), 0,0.01,0,false); brd.rotation.x=-Math.PI/2; brd.rotation.z=Math.PI/4; g.add(brd);
  var lab=makeLabel('', 256, 160, '#fff', null); lab.position.set(0,0.02,0); lab.rotation.x=-Math.PI/2; lab.scale.set(1.75,1.1,1); g.add(lab);
  var ic=iconSprite(PAD_EMOJI[pd.kind]||'⭐','#fff'); ic.position.y=1.4; ic.scale.set(0.8,0.8,1); g.add(ic);
  world.add(g);
  var v={pd:pd, g:g, fill:fill, lab:lab, last:'', ic:ic};
  v.update=function(){
    var txt = pd.kind==='bench' ? '' : fmt(Math.ceil(pd.cost-pd.paid));
    if (txt!==v.last){ v.last=txt; var cv=lab.material.map.image, x=cv.getContext('2d'); x.clearRect(0,0,256,160);
      x.textAlign='center'; x.textBaseline='middle'; x.lineWidth=7; x.strokeStyle='#2a1a2e';
      var sub=padName(pd);
      x.font='900 30px "Trebuchet MS",system-ui'; x.strokeText(sub,128,txt?40:80); x.fillStyle='#fff'; x.fillText(sub,128,txt?40:80);
      if (txt){ x.font='900 58px "Trebuchet MS",system-ui'; x.strokeText('● '+txt,128,108); x.fillStyle='#ffe45c'; x.fillText('● '+txt,128,108); }
      lab.material.map.needsUpdate=true; }
    var p = pd.cost? pd.paid/pd.cost : 0; fill.scale.set(1, Math.max(0.001,p), 1); fill.position.z = 0.9-0.9*p;
  };
  v.update(); return v;
}
function fmt(n){ n=Math.floor(n); if(n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1)+'M'; if(n>=1e4) return (n/1e3).toFixed(n>=1e5?0:1)+'K'; return ''+n; }
function buildBench(){
  var b=DJ.PADS.bench, bx=b[0]-1.0, bz=b[1]-0.9, g=new T.Group();
  g.add(mesh(gBox(1.6,0.12,0.7), M.chest, bx, 0.8, bz));
  [-0.7,0.7].forEach(function(dx){ g.add(mesh(gBox(0.12,0.8,0.6), M.chestDark, bx+dx, 0.4, bz)); });
  var hd=mesh(new T.CylinderGeometry(0.05,0.05,0.8,5), M.rope, bx-0.3, 0.9, bz); hd.rotation.z=1.3; g.add(hd);
  g.add(mesh(gBox(0.3,0.2,0.2), M.darkMetal, bx+0.4, 0.95, bz));
  world.add(g); return g;
}
function syncPads(){ padViews.forEach(function(v){ world.remove(v.g); }); padViews=COVER?[]:G.pads.map(padView);
  var hasBench=G.pads.some(function(p){return p.kind==='bench';}); if (hasBench && !benchMesh) benchMesh=buildBench(); }
function fullRebuild(){
  while(world.children.length) world.remove(world.children[0]);
  ringPool.forEach(function(r){ r.visible=false; });
  Object.keys(views.hr).forEach(function(k){ scene.remove(views.hr[k].ring); });
  torches=[]; views={tb:{}, hr:{}, gb:{}}; padViews=[]; benchMesh=null;
  buildTavern();
  G.tables.forEach(function(t){ views.tb[t.i]=tableView(t); });
  syncPads();
  G.goblins.forEach(function(g){ views.gb[g.id]=goblinView(g); });
  player=makeChar({body:0x3d7bd9, hat:'cap', hatc:0xffd84a, apron:0xffffff, leg:0x2b4a8a, scale:1.1}); player.rotation.y=Math.PI;
  carryStack=new T.Group(); player.add(carryStack); carryStack.userData.key='';
  arrow3d=new T.Group(); var cone=mesh(new T.ConeGeometry(0.35,0.7,8), new T.MeshBasicMaterial({color:0xffe45c}), 0,0,0,false); cone.rotation.x=Math.PI; arrow3d.add(cone); arrow3d.visible=false; world.add(arrow3d);
  floorArrow=new T.Group(); var sh=new T.Shape(); sh.moveTo(0,0.55); sh.lineTo(0.38,0); sh.lineTo(0.15,0); sh.lineTo(0.15,-0.4); sh.lineTo(-0.15,-0.4); sh.lineTo(-0.15,0); sh.lineTo(-0.38,0); sh.closePath();
  var fa=mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({color:0xffe45c, transparent:true, opacity:0.9, depthWrite:false}), 0,0.06,-1.4,false); fa.rotation.x=-Math.PI/2; floorArrow.add(fa); floorArrow.visible=false; world.add(floorArrow);
}

// ---------------- HUD ----------------
var coinShown=0, coinEl=$('coins'), coinBox=$('coinBox');
function screenPos(x,y,z){ var v=new T.Vector3(x,y,z).project(camera); return {x:(v.x+1)/2*innerWidth, y:(1-v.y)/2*innerHeight, vis:v.z<1}; }
function floatText(txt, x,y,z, col, big){
  var p=screenPos(x,y,z); if(!p.vis) return;
  var e=document.createElement('div'); e.className='float out'; e.textContent=txt; e.style.left=(p.x-20)+'px'; e.style.top=(p.y-20)+'px'; if(col) e.style.color=col; if(big) e.style.fontSize='28px';
  $('hud').appendChild(e); requestAnimationFrame(function(){ e.style.transform='translateY(-50px)'; e.style.opacity='0'; });
  setTimeout(function(){ e.remove(); }, 1000);
}
var flyQ=0, pendingFly=0;
function coinFly(n,x,z){
  var p=screenPos(x,1.0,z); var tr=coinBox.getBoundingClientRect(); var k=Math.min(7, 1+Math.ceil(Math.log2(n+1)));
  if (!p.vis || flyQ>40){ Snd.coin(); return; }
  pendingFly+=n;
  for (var i=0;i<k;i++){ (function(i){
    flyQ++;
    var e=document.createElement('div'); e.className='coinfly'; e.style.left=(p.x+(Math.random()-0.5)*50)+'px'; e.style.top=(p.y+(Math.random()-0.5)*30)+'px'; $('hud').appendChild(e);
    setTimeout(function(){ e.style.left=(tr.left+12)+'px'; e.style.top=(tr.top+8)+'px'; e.style.transform='scale(.8)'; }, 30+i*45);
    setTimeout(function(){ e.remove(); flyQ--; Snd.coin(); if(i===k-1){ pendingFly-=n; coinBox.classList.remove('bump'); void coinBox.offsetWidth; coinBox.classList.add('bump'); } }, 600+i*45);
  })(i); }
}
function banner(main, sub, ms){
  var b=$('banner'); b.innerHTML=''; b.textContent=main; if(sub){ var s=document.createElement('small'); s.textContent=sub; b.appendChild(s); }
  b.classList.add('show'); clearTimeout(banner.t); banner.t=setTimeout(function(){ b.classList.remove('show'); }, ms||2600);
}
function toast(t){ banner(t,'',1500); }
function setTut(txt){ var e=$('tut'); if(!txt){ e.classList.remove('show'); e.dataset.t=''; return; } if(e.dataset.t===txt) return; e.dataset.t=txt; e.textContent=txt; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }
function applyLang(){
  document.querySelectorAll('[data-t]').forEach(function(e){ e.textContent=tl(e.dataset.t); });
  var sel=$('langSel'); sel.innerHTML=''; CODES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=LANG_NAMES[c]; if(c===LANG) o.selected=true; sel.appendChild(o); });
}
$('langSel').onchange=function(){ LANG=this.value; try{localStorage.setItem('dj_lang',LANG);}catch(e){} applyLang(); if(G) fullRebuild(); setTut(''); };
$('sndBtn').onclick=function(){ var on=Snd.toggle(); this.textContent=on?'🔊':'🔇'; };
$('sndBtn').textContent=Snd.isOn()?'🔊':'🔇';
function updHud(){
  coinShown=Math.max(0, G.coins-Math.max(0,pendingFly));
  coinEl.textContent=fmt(coinShown);
  var wv=$('wave');
  if (G.tut<4){ wv.style.display='none'; }
  else {
    wv.style.display='';
    var N=G.night, left=Math.max(0, Math.ceil(DJ.NIGHT_LEN-N.t)), stN=DJ.starsFor(N.earned,N.goal);
    var tx=tl('night',{n:N.n})+'  '+'★'.repeat(stN)+'☆'.repeat(3-stN)+'  ● '+fmt(N.earned)+' / '+fmt(N.goal)+'  ⏱ '+Math.floor(left/60)+':'+('0'+left%60).slice(-2);
    if (wv.dataset.tx!==tx){ wv.dataset.tx=tx; $('waveTx').textContent=tx; }
    $('waveBar').style.width=Math.min(100, N.earned/Math.max(1,N.goal)*100)+'%';
    wv.classList.toggle('soon', N.phase==='open' && left<=12 && stN===0);
    wv.classList.toggle('done', stN>0);
  }
  var st=Math.round(G.rep*2)/2, s=''; for (var i=1;i<=5;i++) s+= st>=i?'★':'☆'; $('stars').textContent=s; $('repTx').textContent=tl('rep');
  var bb=$('boostBtn');
  if (G.boost>0){ bb.classList.add('on'); bb.innerHTML=tl('boostOn',{s:Math.ceil(G.boost)}); }
  else { bb.classList.remove('on'); bb.innerHTML=tl('boost')+'<small>'+tl('boostSub')+'</small>'; }
  bb.style.display = G.tut>=99 ? '' : 'none';
}
$('boostBtn').onclick=function(){ if(G.boost>0||PF.adBusy) return; PF.rewarded(function(ok){ if(ok){ G.boost=120; Snd.buy(); } }); };

// bench
var benchOpen=false, benchDismissed=false;
function openBench(){ var m=$('bench'); m.classList.add('show'); renderBench(); benchOpen=true; }
function renderBench(){
  var rows=$('benchRows'); rows.innerHTML='';
  [['boots','👢'],['tray','🍽️'],['grill','🔥'],['gob','☕']].forEach(function(a){
    var k=a[0], u=DJ.UPG[k], lv=G.upg[k];
    if (k==='gob' && G.goblins.length===0) return;
    if (k==='grill' && !G.grill.on) return;
    var r=document.createElement('div'); r.className='row';
    var dots=''; for (var i=0;i<u.max;i++) dots+= i<lv?'●':'○';
    var desc = k==='tray'? tl('trayD',{n:DJ.trayCap(G)+(lv<u.max?' → '+(DJ.trayCap(G)+1):'')}) : tl(k+'D');
    r.innerHTML='<div class="em">'+a[1]+'</div><div class="tx"><b>'+tl(k)+'</b> <span class="lv">'+dots+'</span><br>'+desc+'</div>';
    var b=document.createElement('button'); b.className='btn';
    if (lv>=u.max){ b.textContent=tl('max'); b.disabled=true; }
    else { b.textContent='● '+fmt(u.cost[lv]); b.disabled=G.coins<u.cost[lv]; b.onclick=function(){ if(DJ.buyUpgrade(G,k)){ Snd.buy(); renderBench(); saveNow(); } }; }
    r.appendChild(b); rows.appendChild(r);
  });
}
$('benchClose').onclick=function(){ $('bench').classList.remove('show'); benchOpen=false; benchDismissed=true; };


// ---------------- input ----------------
var keys={}, joy={on:false, id:null, sx:0, sy:0, x:0, y:0};
addEventListener('pointerdown', function(){ Snd.unlock(); });
addEventListener('keydown', function(e){ keys[e.code]=true; Snd.unlock(); if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>=0) e.preventDefault(); });
addEventListener('keyup', function(e){ keys[e.code]=false; });
addEventListener('blur', function(){ keys={}; joy.on=false; $('joy').style.display='none'; });
function jStart(id,x,y){ joy.on=true; joy.id=id; joy.sx=x; joy.sy=y; joy.x=x; joy.y=y; var j=$('joy'); j.style.left=x+'px'; j.style.top=y+'px'; j.style.display='block'; j.firstChild.style.transform=''; Snd.unlock(); }
function jMove(x,y){ joy.x=x; joy.y=y; var dx=x-joy.sx, dy=y-joy.sy, d=Math.hypot(dx,dy), m=Math.min(d,46); if(d>0){dx=dx/d*m; dy=dy/d*m;} $('joy').firstChild.style.transform='translate('+dx+'px,'+dy+'px)'; }
function jEnd(){ joy.on=false; $('joy').style.display='none'; }
canvas.addEventListener('touchstart', function(e){ var t=e.changedTouches[0]; if(!joy.on) jStart(t.identifier, t.clientX, t.clientY); e.preventDefault(); }, {passive:false});
canvas.addEventListener('touchmove', function(e){ for (var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i]; if(t.identifier===joy.id) jMove(t.clientX,t.clientY); } e.preventDefault(); }, {passive:false});
canvas.addEventListener('touchend', function(e){ for (var i=0;i<e.changedTouches.length;i++) if(e.changedTouches[i].identifier===joy.id) jEnd(); }, {passive:false});
canvas.addEventListener('touchcancel', jEnd);
canvas.addEventListener('mousedown', function(e){ jStart('m', e.clientX, e.clientY); });
addEventListener('mousemove', function(e){ if(joy.on&&joy.id==='m') jMove(e.clientX,e.clientY); });
addEventListener('mouseup', function(){ if(joy.id==='m') jEnd(); });
addEventListener('wheel', function(e){ e.preventDefault(); }, {passive:false});
function readInput(){
  var x=0,z=0;
  if (keys.KeyA||keys.ArrowLeft) x-=1; if (keys.KeyD||keys.ArrowRight) x+=1; if (keys.KeyW||keys.ArrowUp) z-=1; if (keys.KeyS||keys.ArrowDown) z+=1;
  if (joy.on){ var dx=joy.x-joy.sx, dy=joy.y-joy.sy, d=Math.hypot(dx,dy); if (d>8){ var m=Math.min(1,d/46); x=dx/d*m; z=dy/d*m; } }
  return [x,z];
}

// ---------------- tutorial ----------------
var tutT=0, trashHinted=false, wrongT=0;
function tutHero(){ return G.heroes.filter(function(h){ return h.tbl===0 && h.state!=='leave'; })[0]; }
function tutTarget(){
  var t=G.tut, K=DJ.KEG, Gr=DJ.GRILL, t0=G.tables[0];
  if (t===0) return {x:K.fx, z:K.fz, txt:tl('t0')+'\n'+(TOUCH?tl('move_touch'):tl('move_kb'))};
  if (t===1){ var h=tutHero(); if(h && h.state==='eat') return {txt:tl('t2a')}; return {x:t0.x, z:t0.z+0.2, txt:tl('t1')}; }
  if (t===2){ if (t0.coins<=0 && !t0.dirty) return null; var h2=tutHero(); if(h2) return {txt:tl('t2a')}; return {x:t0.x, z:t0.z+0.2, txt:tl('t2')}; }
  if (t===3) return {txt:tl('t3')};
  if (t===4||t===5){ var pd=G.pads.filter(function(p){return p.kind!=='bench';})[0]; if(pd && G.coins+pd.paid>=pd.cost) return {x:pd.x,z:pd.z,txt:tl(pd.kind==='grill'?'t5':'t4')}; return null; }
  if (t===6){ if (G.grill.ready<=0) return null; return {x:Gr.fx, z:Gr.fz, txt:tl('t6')}; }
  if (t===7){ var b=G.pads.filter(function(p){return p.kind==='bench';})[0]; return b?{x:b.x,z:b.z,txt:tl('t7')}:null; }
  return null;
}
function stepTut(dt){
  var t=G.tut, t0=G.tables[0];
  if (t===0){ if (G.player.items.indexOf('beer')>=0) G.tut=1; }
  else if (t===1){ if (G.stats.served>0) G.tut=2; }
  else if (t===2){ if (!tutHero() && t0.coins<=0 && !t0.dirty){ G.tut=3; tutT=0; G.flow=true; G.spawnT=1.5; } }
  else if (t===3){ tutT+=dt; if (tutT>8){ G.tut=4; DJ.makePads(G); syncPads(); } }
  else if (t===4){ if (G.unl>=1) G.tut=5; }
  else if (t===5){ if (G.grill.on) G.tut=6; }
  else if (t===6){ if (G.player.items.indexOf('meat')>=0){ G.tut=7; tutT=0; DJ.makePads(G); syncPads(); } }
  else if (t===7){ tutT+=dt; if (benchOpen || tutT>12) G.tut=99; }
  // hint: tray full of things nobody wants
  if (G.tut>=99 && !trashHinted){ var p=G.player, waiting=G.heroes.filter(function(h){return h.state==='wait';});
    if (p.items.length>=DJ.trayCap(G) && waiting.length>=2 && !waiting.some(function(h){ return p.items.indexOf(h.want)>=0; })) wrongT+=dt; else wrongT=0;
    if (wrongT>5){ trashHinted=true; banner(tl('trashHint'),'',3500); } }
  var tg = G.tut<99 ? tutTarget() : null;
  setTut(tg? tg.txt : '');
  if (tg && tg.x!==undefined){
    arrow3d.visible=true; arrow3d.position.set(tg.x, 2.6+Math.sin(performance.now()/180)*0.25, tg.z);
    var dx=tg.x-G.player.x, dz=tg.z-G.player.z, d=Math.hypot(dx,dz);
    floorArrow.visible = d>2.6; floorArrow.position.set(G.player.x,0,G.player.z); floorArrow.rotation.y=Math.atan2(-dx,-dz);
  } else { arrow3d.visible=false; floorArrow.visible=false; }
}
function setupTutorial(){
  var h=DJ.spawnHero(G,{kind:'knight', table:G.tables[0]}); h.z=1.2; h.x=0;
}

// ---------------- events ----------------
var lastAdT=0;
function handleEvents(){
  var ev=G.ev; G.ev=[];
  ev.forEach(function(e){
    switch(e.t){
      case 'coin': coinFly(e.n, e.x, e.z); if (e.why!=='pick') floatText('+'+fmt(e.n), e.x, 1.6, e.z); break;
      case 'drop': var dv=views.tb[e.tbl]; if(dv){ dv.heapPop=0.35; floatText('+'+fmt(e.n), e.x, 1.6, e.z, '#ffe45c', true); coinBurst(e.x, e.z-0.3, e.x-0.45, e.z+0.22); } Snd.coin(); break;
      case 'buy':
        if (e.kind==='upg') break;
        if (e.kind==='table'){ var tv=views.tb[e.i]; if(tv) tv.pop=0.5; puff(G.tables[e.i].x, G.tables[e.i].z, 0xffe45c); }
        if (e.kind==='grill'){ puff(DJ.GRILL.x, DJ.GRILL.z+0.6, 0xff9a40); }
        if (e.kind==='wiper'||e.kind==='waiter'){ G.goblins.forEach(function(g){ if(!views.gb[g.id]) views.gb[g.id]=goblinView(g); }); banner(tl('hired'), tl('u_'+e.kind)); }
        else banner(tl('unlocked'), tl('u_'+e.kind));
        syncPads(); Snd.buy(); PF.happy(); saveNow();
        break;
      case 'padpay': if(Math.random()<0.3) Snd.pay(); break;
      case 'pour': if(e.who==='p'){ Daily.count('pour'); Snd.pour(); } break;
      case 'grab': if(e.who==='p') Snd.take(); break;
      case 'cooked': if (Math.hypot(G.player.x-DJ.GRILL.x, G.player.z-DJ.GRILL.z)<5) Snd.sizzle(); break;
      case 'trash': Snd.squish(); puff(DJ.TRASH.x, DJ.TRASH.z, 0xaaaaaa); break;
      case 'serve': var sv=views.tb[e.tbl]; if(sv) sv.shake=0.3; Snd.fill(); break;
      case 'wiped': if(e.who==='p') Daily.count('wipe'); var wv=views.tb[e.tbl]; if(wv){ wv.shake=0.3; puff(wv.t.x, wv.t.z, 0x9fffd0); } Snd.clank(); break;
      case 'order': break;
      case 'hero': if (e.boss){ Snd.boss(); banner(tl('bossWave'), tl('bossD2'), 3000); } break;
      case 'emo': var pv=views.hr[e.id]; if(pv){ pv.em.material=iconMat({happy:'😋',more:'🤤',angry:'😡'}[e.e]||'😀'); pv.em.visible=true; pv.emT=1.3; } break;
      case 'angry': var av=views.hr[e.id]; if(av) floatText(tl('angry'), av.c.position.x, 2.6, av.c.position.z, '#ff8a7a'); Snd.bad(); break;
      case 'nightStart': banner(tl('night',{n:e.n}), tl('nightGoal',{g:'● '+fmt(e.goal)}), 2600); Snd.pop(); break;
      case 'lastCall': banner(tl('lastCall'),'',1600); Snd.boss(); break;
      case 'nightClose': banner(tl('closing'),'',2200); Snd.clank(); break;
      case 'nightResult': showNight(e); break;
      case 'exit': if(!e.angry) Daily.count('serve'); var xv=views.hr[e.id]; if(xv && !e.quiet) floatText('★'.repeat(e.stars), xv.c.position.x, 2.8, xv.c.position.z, '#ffd84a'); break;
      case 'gone': var gv=views.hr[e.id]; if(gv){ world.remove(gv.c); world.remove(gv.need); world.remove(gv.em); scene.remove(gv.ring); delete views.hr[e.id]; } break;
      case 'wake': Snd.pop(); break;
    }
  });
}
var puffs=[], puffGeo=new T.SphereGeometry(0.16,6,4);
function puff(x,z,col){
  for (var i=0;i<7;i++){ var m=mesh(puffGeo, new T.MeshBasicMaterial({color:col, transparent:true}), x,0.6,z,false); var a=i/7*Math.PI*2;
    m.userData.v=[Math.cos(a)*2.2, 2+Math.random()*2, Math.sin(a)*2.2]; m.userData.t=0.6; world.add(m); puffs.push(m); }
}
var arcs=[];
function coinBurst(x0,z0,x1,z1){
  for (var i=0;i<4;i++){ var m=mesh(coinGeo, M.gold, x0,1.2,z0,false); m.userData={x0:x0,z0:z0,x1:x1+(Math.random()-0.5)*0.3,z1:z1+(Math.random()-0.5)*0.3,t:-i*0.06}; world.add(m); arcs.push(m); }
}


// ---------------- night result + perk cards ----------------
var CARD_EM={beer:'🍺',meat:'🍖',pat:'🛋️',tip:'💰',hands:'⚡',vip:'👑',clean:'✨',again:'🤤',crowd:'📣',gold:'🎁'};
function cardDesc(k){
  switch(k){ case 'beer': return '🍺 +2 ●'; case 'meat': return '🍖 +4 ●'; case 'pat': return '⏳ +20%'; case 'tip': return '💰 +100%';
    case 'hands': return '🍺🧽 +30%'; case 'vip': return '👑 +25%'; case 'clean': return '🧽 −25%'; case 'again': return '🍺🍖 +15%'; case 'crowd': return '🚪 +12%';
    case 'gold': return '+ ● '+fmt(DJ.goldAmt(G)); }
}
function showNight(e){
  var m=$('nightM'), box=$('nmCards'), rr=$('nmReroll'), rt=$('nmRetry'), win=e.stars>0;
  $('nmTitle').textContent=tl('night',{n:e.n});
  $('nmStars').textContent='★'.repeat(e.stars)+'☆'.repeat(3-e.stars);
  $('nmSum').textContent='● '+fmt(e.earned)+' / '+fmt(e.goal)+(e.bonus?'   🎁 +'+fmt(e.bonus):'');
  $('nmPick').textContent=win? tl('pickOne') : tl('missed');
  var go=function(card){ m.classList.remove('show'); var next=function(){ DJ.nextNight(G, card); saveNow(); };
    if (card) Snd.buy();
    if (G.t-lastAdT>100){ lastAdT=G.t; PF.midgame(next); } else next(); };
  var deal=function(){ box.innerHTML='';
    DJ.offerCards(G).forEach(function(k){
      var lv=G.cards[k]||0, mx=DJ.CARDS[k].max, b=document.createElement('button'); b.className='pcard';
      var dots=''; if (mx<10) for (var i=0;i<mx;i++) dots+= i<lv?'●':'○';
      b.innerHTML='<span class="em">'+CARD_EM[k]+'</span><b>'+tl('c_'+k)+'</b><span class="ds">'+cardDesc(k)+'</span><span class="lv">'+dots+'</span>';
      b.onclick=function(){ go(k); }; box.appendChild(b); }); };
  box.innerHTML=''; rr.style.display=rt.style.display='none';
  if (win){ deal(); rr.style.display=''; rr.textContent=tl('reroll'); rr.disabled=false;
    rr.onclick=function(){ rr.disabled=true; PF.rewarded(function(ok){ if(ok){ deal(); rr.style.display='none'; } else rr.disabled=false; }); };
    Snd.buy(); PF.happy(); }
  else { rt.style.display=''; rt.textContent=tl('retry'); rt.onclick=function(){ go(null); }; Snd.bad(); }
  m.classList.add('show'); saveNow();
}

// ---------------- frame ----------------
var dailyT=0, last=performance.now(), acc=0, saveT=0, lightT=0, ipmT=0, ipmEarn=0;
function frame(now){
  requestAnimationFrame(frame); var __js0=performance.now();
  var dt=Math.min(0.1,(now-last)/1000); last=now;
  var modal = document.querySelector('.modal.show:not(#bench)');
  G.paused = !!modal || PF.adBusy || document.hidden;
  PF.setPlaying(!G.paused);
  var inp=readInput();
  acc+=dt; var steps=0;
  while(acc>=1/60 && steps<6){ acc-=1/60; steps++; DJ.step(G, 1/60, inp[0], inp[1]); if(!G.paused) stepTut(1/60); }
  handleEvents();
  if (!G.paused){ ipmT+=dt; if (ipmT>=60){ var e=G.earned-ipmEarn; ipmEarn=G.earned; ipmT=0; G.ipm = G.ipm? G.ipm*0.7+e*0.3 : e; } }
  render(dt);
  window.__jsms=(window.__jsms||0)*0.95+(performance.now()-__js0)*0.05;
  perfTick(dt);
  updHud();
  saveT+=dt; if (saveT>5){ saveT=0; saveNow(); }
  var onB = G.player.onPad && G.player.onPad.kind==='bench';
  if (onB && !benchOpen && !benchDismissed) openBench();
  if (!onB){ benchDismissed=false; if (benchOpen){ $('bench').classList.remove('show'); benchOpen=false; } }
  if (benchOpen && Math.random()<0.1) renderBench();
  dailyT+=dt; if (dailyT>2){ dailyT=0; Daily.tick(); }
}
function render(dt){
  var p=G.player, t=performance.now()/1000;
  player.position.set(p.x,0,p.z);
  player.rotation.y += angDiff(player.rotation.y, p.face)*Math.min(1,dt*14);
  animChar(player, p.moving, dt, p.working);
  var key=p.items.join(','); if (carryStack.userData.key!==key){ carryStack.userData.key=key; fillStack(carryStack, p.items, 0.9); }
  var ringI=0;
  function ring(x,y,z,pr,col){ if (ringI>=ringPool.length) return; var r=ringPool[ringI++]; r.visible=true; r.position.set(x,y,z); r.userData.draw(pr,col); }
  // keg / grill
  if (p.pourT>0) ring(DJ.KEG.x, 3.0, DJ.KEG.z+0.4, p.pourT/0.45, '#ffcf3a');
  G.goblins.forEach(function(g){ if(g.pourT>0) ring(g.x, 2.4, g.z, g.pourT/0.45, '#ffcf3a'); });
  var gr=G.grill, gv=grillV;
  gv.cover.visible=!gr.on; gv.fire.visible=gr.on; gv.roast.visible=gr.on; gv.ic.visible=gr.on && gr.ready>0;
  gv.ready.forEach(function(m,i){ m.visible=gr.on && i<gr.ready; });
  if (gr.on){ gv.roast.rotation.x=t*2; gv.fire.children.forEach(function(f,i){ f.scale.y=1+Math.sin(t*11+i*2)*0.2; }); if (gr.ready<DJ.GRILL_MAX) ring(DJ.GRILL.x, 3.0, DJ.GRILL.z+0.4, gr.t/4, '#ff8a3a'); }
  kegV.ic.position.y=2.9+Math.sin(t*3)*0.08; gv.ic.position.y=3.0+Math.sin(t*3+1)*0.08;
  trashV.ic.visible = p.items.length>0;
  // tables
  Object.keys(views.tb).forEach(function(id){ var v=views.tb[id], tb=v.t;
    v.body.visible=tb.on; v.ghost.visible=!tb.on && G.pads.some(function(pd){ return pd.kind==='table' && pd.u.i===tb.i; });
    if (!tb.on){ v.icon.visible=false; return; }
    if (v.pop>0){ v.pop-=dt; v.body.scale.setScalar(1+Math.sin(v.pop*12)*v.pop*0.5); } else if (v.shake>0){ v.shake-=dt; v.body.scale.setScalar(1+Math.sin(v.shake*40)*v.shake*0.3); } else v.body.scale.setScalar(1);
    v.dirt.visible=tb.dirty; v.icon.visible=tb.dirty; v.icon.position.y=1.9+Math.sin(t*4+tb.i)*0.1;
    v.food.beer.visible=tb.food==='beer'; v.food.meat.visible=tb.food==='meat';
    setHeap(v, tb.coins);
    if (v.heapPop>0){ v.heapPop-=dt; v.heap.scale.setScalar(1+v.heapPop); } else v.heap.scale.setScalar(1);
    if (tb.prog>0) ring(tb.x, 2.3, tb.z+0.2, tb.prog, '#7ee06a');
  });
  for (var i=ringI;i<ringPool.length;i++) ringPool[i].visible=false;
  // heroes
  G.heroes.forEach(function(h){ if(!views.hr[h.id]) views.hr[h.id]=heroView(h); });
  Object.keys(views.hr).forEach(function(id){ var v=views.hr[id], h=v.h, c=v.c, u=c.userData;
    var seated = h.state==='wait'||h.state==='eat';
    c.position.set(h.x,0,h.z);
    c.rotation.y += angDiff(c.rotation.y, seated?0:h.face)*Math.min(1,dt*10);
    animChar(c, h.moving, dt, h.state==='eat');
    if (seated){ u.inner.position.y=-0.22; u.legs[0].rotation.x=u.legs[1].rotation.x=-1.3; }
    var top=(h.boss?2.9:2.15)+(seated?-0.2:0);
    if (h.state==='wait' && h.want){
      if (v.lastNeed!==h.want){ v.lastNeed=h.want; v.need.material=iconMat(FOOD_ICON[h.want], '#ffffff'); v.lastP=-1; }
      v.need.visible=true; v.need.position.set(h.x, top+0.55+Math.abs(Math.sin(t*5))*0.18, h.z);
      var pr=Math.max(0,h.pat/((h.pat0||DJ.PATIENCE)*(h.boss?0.8:1))); v.ring.visible=true; v.ring.position.set(h.x, top+0.55, h.z);
      var k=Math.round(pr*40); if (k!==v.lastP){ v.lastP=k; v.ring.userData.draw(pr, pr>0.5?'#7ee06a':(pr>0.25?'#ffc23a':'#ff5a4a')); }
      v.em.visible=false;
    } else if (h.state==='queue' && G.tut>=3 && h.pat<DJ.QPAT*0.6){
      v.need.visible=false; v.lastNeed=null; v.ring.visible=true; v.ring.position.set(h.x, top+0.3, h.z);
      var pq=Math.max(0,h.pat/DJ.QPAT), kq=Math.round(pq*40)+100; if (kq!==v.lastP){ v.lastP=kq; v.ring.userData.draw(pq, pq>0.25?'#ffc23a':'#ff5a4a'); }
    } else { v.need.visible=false; v.ring.visible=false; v.lastNeed=null; v.lastP=-1;
      v.em.position.set(h.x, top+0.4, h.z); if (v.emT>0){ v.emT-=dt; if(v.emT<=0) v.em.visible=false; } }
  });
  G.goblins.forEach(function(g){ var v=views.gb[g.id]; if(!v) return;
    v.c.position.set(g.x,0,g.z); v.c.rotation.y += angDiff(v.c.rotation.y, g.face)*Math.min(1,dt*10);
    animChar(v.c, g.moving&&g.sleep<=0, dt, g.working);
    v.z.visible=g.sleep>0; if (g.sleep>0){ v.z.position.y=2.3+Math.sin(t*3)*0.15; v.c.userData.inner.rotation.z=0.25; }
    var k2=g.items.join(','); if (v.key!==k2){ v.key=k2; fillStack(v.stack, g.items, 0.8); }
  });
  padViews.forEach(function(v){ v.update(); v.ic.position.y=1.4+Math.sin(t*3)*0.12; });
  for (var j=puffs.length-1;j>=0;j--){ var m=puffs[j], ud0=m.userData; ud0.t-=dt; m.position.x+=ud0.v[0]*dt; m.position.y+=ud0.v[1]*dt; m.position.z+=ud0.v[2]*dt; ud0.v[1]-=6*dt; m.material.opacity=Math.max(0,ud0.t/0.6); if(ud0.t<=0){ world.remove(m); puffs.splice(j,1);} }
  for (var a=arcs.length-1;a>=0;a--){ var cm=arcs[a], ud=cm.userData; ud.t+=dt; var k3=Math.max(0,Math.min(1,ud.t/0.45));
    cm.position.set(ud.x0+(ud.x1-ud.x0)*k3, 1.2+Math.sin(k3*Math.PI)*1.0-0.35*k3, ud.z0+(ud.z1-ud.z0)*k3); cm.rotation.x+=dt*12; if(ud.t>=0.45){ world.remove(cm); arcs.splice(a,1);} }
  lightT-=dt;
  if (lightT<=0){ lightT=0.5; var sorted=torches.slice().sort(function(a,b){ return Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z); });
    torchLights.forEach(function(L,i){ var tt=sorted[i]; if(tt){ L.position.set(tt.x,2.3,tt.z); L.userData.t=tt; } else L.userData.t=null; }); }
  torchLights.forEach(function(L){ var tt=L.userData.t; L.intensity = tt? 6+Math.sin(t*9+tt.ph)*1.2+Math.sin(t*23+tt.ph)*0.6 : 0; });
  torches.forEach(function(tt){ tt.fl.scale.y=1+Math.sin(t*10+tt.ph)*0.15; });
  var portrait = innerHeight>innerWidth*1.1;
  var cy = portrait? 20:14.5, cz = portrait? 11.5:10;
  var fz = portrait? -4.9+(p.z+4.9)*0.3 : -4.7+(p.z+4.7)*0.22;
  camGoal.set(p.x*(portrait?0.45:0.3), cy, fz+cz);
  camera.position.lerp(camGoal, Math.min(1, dt*5));
  camera.lookAt(camera.position.x, 0, camera.position.z-cz-0.8);
  sun.position.set(p.x*0.3+6, 18, -5+8); sun.target.position.set(p.x*0.3,0,-5);
  renderer.render(scene,camera);
}

var camGoal=new T.Vector3();
function angDiff(a,b){ var d=(b-a)%(Math.PI*2); if(d>Math.PI) d-=Math.PI*2; if(d<-Math.PI) d+=Math.PI*2; return d; }
var perfT=0, perfN=0, perfWarm=3, fpsEl=null;
function perfTick(dt){
  if (perfWarm>0){ perfWarm-=dt; return; }
  perfT+=dt; perfN++;
  if (perfT>=2){
    var fps=perfN/perfT; perfT=0; perfN=0;
    if (SHOWFPS){ if(!fpsEl){ fpsEl=document.createElement('div'); fpsEl.style.cssText='position:fixed;left:4px;bottom:4px;font:11px monospace;color:#fff8;z-index:50;pointer-events:none'; document.body.appendChild(fpsEl);} fpsEl.textContent=fps.toFixed(0)+'fps q'+QUAL; }
    if (fps<40 && QUAL>-1 && !document.hidden && !QS.has('q')){ setQual(QUAL-1); perfWarm=1.5; }
  }
}
function setQual(q){
  QUAL=q; try{ localStorage.setItem('dj_q',''+q); }catch(e){}
  renderer.setPixelRatio(dprFor(q)); resize();
  if (q<2){ torchLights.forEach(function(L){ scene.remove(L); }); torchLights=[]; hemi.intensity=1.45; }
  if (q<1){ renderer.shadowMap.enabled=false; sun.castShadow=false; scene.traverse(function(o){ if(o.material) o.material.needsUpdate=true; }); }
}
var SHOWFPS=PF.kind==='none'||QS.has('fps');
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect=innerWidth/innerHeight; camera.fov = camera.aspect<0.8? 52 : 40; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------------- save / offline ----------------
function saveNow(){ if(!G) return; PF.saveData('dj_save_v3', DJ.save(G)); PF.saveData('dj_seen', ''+Date.now()); }
document.addEventListener('visibilitychange', function(){ if(document.hidden) saveNow(); });
addEventListener('pagehide', saveNow);
function checkOffline(){
  var seen=+(PF.loadData('dj_seen')||0); if (!seen || G.goblins.length===0) return false;
  var mins=Math.min(120, (Date.now()-seen)/60000); if (mins<2) return false;
  var amt=Math.round(mins*(G.ipm||0)*0.25); if (amt<10) return false;
  $('offAmt').textContent='● '+fmt(amt);
  var dbl=$('offDouble'); dbl.textContent=tl('double'); dbl.disabled=false;
  var close=function(n){ $('offline').classList.remove('show'); DJ.pay(G, n, G.player.x, G.player.z, null); saveNow(); };
  $('offTake').onclick=function(){ close(amt); Daily.reward(); };
  dbl.onclick=function(){ dbl.disabled=true; PF.rewarded(function(ok){ if(ok){ close(amt*2); Daily.reward(); } else dbl.disabled=false; }); };
  $('offline').classList.add('show'); return true;
}

// ---------------- daily reward + daily tasks ----------------
// Rewards scale with the next room's price so they stay meaningful at every stage.
var Daily = (function(){
  var D=null, DAYS=[0.10,0.12,0.15,0.18,0.22,0.27,0.6], DEF={serve:[20,10],wipe:[12,6],pour:[20,10]};
  function today(o){ var d=new Date(Date.now()+(o||0)*864e5); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function nextCost(){ var u=DJ.UNL[Math.min(G.unl, DJ.UNL.length-1)]; return Math.max(60, u.c); }
  function amt(f){ return Math.max(20, Math.round(nextCost()*f/5)*5); }
  function load(){ try{ D=JSON.parse(PF.loadData('dj_daily')||'null'); }catch(e){ D=null; } if(!D||typeof D!=='object') D={last:'',streak:0,tday:'',tasks:[]}; }
  function save(){ PF.saveData('dj_daily', JSON.stringify(D)); }
  function rollTasks(){
    if (D.tday===today()) return;
    D.tday=today(); var r=1+Math.floor(G.unl/3);
    D.tasks=['serve','wipe','pour'].map(function(k){ return {k:k, n:DEF[k][0]+DEF[k][1]*r, c:0, claimed:false, f:0.25}; });
    save();
  }
  function count(k){ if(!D||G.tut<99) return; D.tasks.forEach(function(t){ if(t.k!==k||t.c>=t.n) return; t.c++; if(t.c===t.n){ banner(tl('taskDone'), tl('task_'+t.k,{n:t.n}), 2000); Snd.buy(); save(); } }); dot(); }
  function dot(){ var on = D && D.tasks.some(function(t){ return t.c>=t.n && !t.claimed; }); $('taskDot').classList.toggle('on', !!on); }
  function renderTasks(){
    var rows=$('taskRows'); rows.innerHTML='';
    D.tasks.forEach(function(t){
      var r=document.createElement('div'); r.className='row';
      r.innerHTML='<div class="tx"><b></b><div class="pb"><i style="width:'+Math.min(100,t.c/t.n*100)+'%"></i></div></div>';
      r.querySelector('b').textContent=tl('task_'+t.k,{n:t.n})+'  '+Math.min(t.c,t.n)+'/'+t.n;
      var b=document.createElement('button'); b.className='btn';
      if (t.claimed){ b.textContent='✔'; b.disabled=true; }
      else { b.textContent='● '+fmt(amt(t.f)); b.disabled=t.c<t.n; b.onclick=function(){ t.claimed=true; DJ.pay(G, amt(t.f), G.player.x, G.player.z, 'task'); Snd.buy(); save(); renderTasks(); dot(); }; }
      r.appendChild(b); rows.appendChild(r);
    });
    if (D.tasks.every(function(t){return t.claimed;})){ var d=document.createElement('div'); d.style.cssText='font-size:15px;margin:6px 0'; d.textContent=tl('allDone'); rows.appendChild(d); }
  }
  $('taskBtn').onclick=function(){ if(!D||G.tut<99||PF.adBusy) return; rollTasks(); renderTasks(); $('taskM').classList.add('show'); };
  $('taskClose').onclick=function(){ $('taskM').classList.remove('show'); };
  function showReward(){
    if (D.last===today()) return false;
    var streak = D.last===today(-1) ? (D.streak%7)+1 : 1, a=amt(DAYS[streak-1]);
    var row=$('dlDays'); row.innerHTML='';
    for (var i=1;i<=7;i++){ var c=document.createElement('div'); c.className=(i<streak?'got':(i===streak?'now':''))+(i===7?' big':''); c.innerHTML='<b>'+(i===7?'💰':'🪙')+'</b>'; c.appendChild(document.createTextNode(tl('dayN',{n:i}))); row.appendChild(c); }
    $('dlAmt').textContent='● '+fmt(a);
    var dbl=$('dlDouble'); dbl.textContent=tl('double'); dbl.disabled=false;
    var close=function(n){ D.last=today(); D.streak=streak; save(); $('daily').classList.remove('show'); DJ.pay(G, n, G.player.x, G.player.z, 'daily'); Snd.buy(); saveNow(); };
    $('dlTake').onclick=function(){ close(a); };
    dbl.onclick=function(){ dbl.disabled=true; PF.rewarded(function(ok){ if(ok) close(a*2); else dbl.disabled=false; }); };
    $('daily').classList.add('show'); return true;
  }
  return {
    start:function(){ load(); $('taskBtn').style.display = G.tut>=99 ? '' : 'none'; if (G.tut<99) return; rollTasks(); dot(); },
    tick:function(){ if(!D) return; if (G.tut>=99 && $('taskBtn').style.display==='none'){ $('taskBtn').style.display=''; rollTasks(); dot(); }
      if (G.tut>=99 && D.tday!==today()){ rollTasks(); dot(); } },
    reward:function(){ if(!D||G.tut<99) return false; return showReward(); },
    count:count, refresh:function(){ if($('taskM').classList.contains('show')) renderTasks(); }
  };
})();

// ---------------- boot ----------------
function boot(){
  LANG=detectLang(PF.locale); applyLang();
  var s=PF.loadData('dj_save_v3');
  if (QS.has('reset')) s=null;
  try{ G = s? DJ.load(s) : null; }catch(e){ G=null; }
  var fresh=!G;
  if (!G){ G=DJ.newGame(Date.now()%100000); }
  else { G.flow = G.tut>=3; if (G.tut<3){ G=DJ.newGame(Date.now()%100000); fresh=true; } }
  if (fresh) setupTutorial();
  G.ev=[];
  fullRebuild(); resize();
  camera.position.set(0, 14.5, -4.0+10);
  $('loading').style.display='none';
  PF.loaded();
  Daily.start();
  if (!checkOffline()) Daily.reward();
  if (DEBUG){ window.__PF=PF; window.__Snd=Snd; window.__G=G; window.__DJ=DJ; window.__step=function(sec,ix,iz){ for(var i=0;i<sec*60;i++){ DJ.step(G,1/60,ix||0,iz||0); stepTut(1/60);} }; window.__cam=camera; window.__ri=renderer.info; window.__scene=scene; window.__R=renderer; window.__sun=sun; window.__tl=torchLights; window.__T=T; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
