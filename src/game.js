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
    hit:function(){ noise(0.05,0.1,1800); },
    swing:function(){ noise(0.09,0.07,3500); tone(240,0.08,'triangle',0.05,0.6); },
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

// ---------------- arena ----------------
function buildArena(){
  var g=new T.Group(), hw=W/2;
  var gr=mesh(new T.PlaneGeometry(90, 60), mat(0x2b2032), 0, -0.02, 0, false); gr.rotation.x=-Math.PI/2; g.add(gr);
  plankTex.repeat.set(6.5, 5);
  var f=mesh(new T.PlaneGeometry(W, D), M.floor, 0, 0, -D/2, false); f.rotation.x=-Math.PI/2; g.add(f);
  var rug=mesh(new T.CircleGeometry(3.2, 24), mat(0x9c3636,{flat:false}), 0, 0.012, -D/2, false); rug.rotation.x=-Math.PI/2; g.add(rug);
  var rug2=mesh(new T.RingGeometry(2.6, 2.85, 24), mat(0xe0b050,{flat:false}), 0, 0.016, -D/2, false); rug2.rotation.x=-Math.PI/2; g.add(rug2);
  addWall(g, -hw-0.3, 0.15, -hw-0.3, -D, 2.4); addWall(g, hw+0.3, 0.15, hw+0.3, -D, 2.4);
  addWall(g, -hw-0.3, -D-0.2, hw+0.3, -D-0.2, 3.2);
  addWall(g, -hw-0.3, 0.15, hw+0.3, 0.15, 0.45);
  // back wall: shelves with bottles, bar counter with kegs
  var rr=mulberry(7);
  [1.5,2.3].forEach(function(y){ g.add(mesh(gBox(W-1,0.08,0.4), M.woodDark, 0, y, -D+0.1, false));
    for (var i=0;i<32;i++){ var bx=-hw+0.9+i*0.77+rr()*0.2; var c=[0x5ad27a,0xd25a5a,0x5a8ad2,0xe0c050][Math.floor(rr()*4)];
      g.add(mesh(new T.CylinderGeometry(0.08,0.1,0.32,6), mat(c), bx, y+0.2, -D+0.12, false)); } });
  g.add(mesh(gBox(W-0.6,0.95,0.7), M.wood, 0, 0.475, -D+1.25));
  g.add(mesh(gBox(W-0.4,0.1,0.85), M.woodLight, 0, 1.0, -D+1.25));
  [-9,-3,3,9].forEach(function(x){ var b=mesh(new T.CylinderGeometry(0.5,0.5,1.0,12), M.chest, x,1.56,-D+1.25); b.rotation.z=Math.PI/2; g.add(b);
    [-0.32,0.32].forEach(function(dx){ var r=mesh(new T.TorusGeometry(0.51,0.04,5,14), M.darkMetal, x+dx,1.56,-D+1.25,false); r.rotation.y=Math.PI/2; g.add(r); }); });
  [-6,0,6].forEach(function(x){ g.add(mesh(new T.CylinderGeometry(0.14,0.13,0.3,8), M.beer, x,1.2,-D+1.3,false)); g.add(mesh(new T.CylinderGeometry(0.15,0.15,0.08,8), M.foam, x,1.38,-D+1.3,false)); });
  // lanterns on the side walls
  [-3.5,-10,-16.5].forEach(function(z){ [-hw, hw].forEach(function(x,i){
    var lx=x+(i?-0.18:0.18); g.add(mesh(gBox(0.22,0.3,0.22), M.darkMetal, lx, 1.9, z));
    var fl=mesh(new T.ConeGeometry(0.1,0.24,6), M.flame, lx, 1.92, z, false); g.add(fl);
    torches.push({x:x+(i?-0.6:0.6), z:z, fl:fl, ph:Math.random()*6}); }); });
  world.add(g);
}

// ---------------- instanced monsters / coins / bits ----------------
function mergeGeo(parts){ // [geometry, colour, x,y,z, sx,sy,sz]
  var pos=[], nor=[], col=[], c=new T.Color(), m=new T.Matrix4(), q=new T.Quaternion();
  parts.forEach(function(p){ var g=p[0].index? p[0].toNonIndexed() : p[0].clone();
    var sx=p[5]||1; m.compose(new T.Vector3(p[2]||0,p[3]||0,p[4]||0), q, new T.Vector3(sx, p[6]||sx, p[7]||sx)); g.applyMatrix4(m);
    var a=g.attributes.position.array, n=g.attributes.normal.array; c.set(p[1]);
    for (var i=0;i<a.length;i+=3){ pos.push(a[i],a[i+1],a[i+2]); nor.push(n[i],n[i+1],n[i+2]); col.push(c.r,c.g,c.b); } });
  var out=new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos,3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor,3)); out.setAttribute('color', new T.Float32BufferAttribute(col,3));
  return out;
}
var sph=function(r){ return new T.SphereGeometry(r,8,6); }, BLK=0x1b1220;
var EGEO={
  slime: mergeGeo([[sph(0.5),0x6fd16a,0,0.34,0,1,0.72,1],[sph(0.08),BLK,-0.16,0.46,0.4],[sph(0.08),BLK,0.16,0.46,0.4],[sph(0.16),0xb6f0a8,-0.12,0.6,-0.05,1,0.5,1]]),
  gob:   mergeGeo([[new T.CapsuleGeometry(0.22,0.22,2,6),0x7a5230,0,0.42,0],[sph(0.27),0x7ed957,0,0.93,0],[gBox(0.3,0.1,0.08),0x7ed957,-0.36,0.97,0],[gBox(0.3,0.1,0.08),0x7ed957,0.36,0.97,0],[sph(0.055),BLK,-0.1,0.97,0.23],[sph(0.055),BLK,0.1,0.97,0.23],[gBox(0.07,0.5,0.1),0xb9c2cc,0.32,0.55,0.12]]),
  skel:  mergeGeo([[new T.CapsuleGeometry(0.2,0.42,2,6),0xe8e2d0,0,0.62,0],[gBox(0.44,0.06,0.3),0x8a8478,0,0.6,0],[gBox(0.44,0.06,0.3),0x8a8478,0,0.78,0],[sph(0.28),0xf4efe0,0,1.22,0],[sph(0.08),BLK,-0.11,1.25,0.22],[sph(0.08),BLK,0.11,1.25,0.22],[gBox(0.2,0.05,0.06),BLK,0,1.08,0.24]]),
  bat:   mergeGeo([[sph(0.26),0x7a4ab0,0,1.1,0],[gBox(0.55,0.04,0.34),0x5b3690,-0.48,1.16,0],[gBox(0.55,0.04,0.34),0x5b3690,0.48,1.16,0],[sph(0.06),0xff4040,-0.1,1.16,0.21],[sph(0.06),0xff4040,0.1,1.16,0.21],[gBox(0.08,0.14,0.08),0x7a4ab0,-0.14,1.36,0],[gBox(0.08,0.14,0.08),0x7a4ab0,0.14,1.36,0]]),
  orc:   mergeGeo([[new T.CapsuleGeometry(0.44,0.5,3,8),0x4d7a3a,0,0.9,0],[gBox(0.92,0.14,0.9),0x6e4224,0,0.75,0],[sph(0.38),0x5f9447,0,1.78,0],[sph(0.07),BLK,-0.14,1.84,0.32],[sph(0.07),BLK,0.14,1.84,0.32],[gBox(0.07,0.16,0.07),0xfff8e8,-0.16,1.62,0.33],[gBox(0.07,0.16,0.07),0xfff8e8,0.16,1.62,0.33],[gBox(0.16,0.9,0.16),0x6e4224,0.62,1.0,0.2],[gBox(0.3,0.34,0.3),0x8a8090,0.62,1.5,0.2]])
};
EGEO.elite=EGEO.orc;
var ECOL={slime:0x6fd16a, gob:0x7ed957, skel:0xe8e2d0, bat:0x7a4ab0, orc:0x4d7a3a, elite:0xc0392b, boss:0x4d7a3a};
var EMAX={slime:150, gob:150, skel:150, bat:150, orc:90, elite:4};
var EM={}, eMat=new T.MeshLambertMaterial({vertexColors:true, flatShading:true});
var gemIM=null, bitIM=null, mugIM=null, dummy=new T.Object3D(), cWhite=new T.Color(1,1,1), cFlash=new T.Color(3,3,3), cElite=new T.Color(1.5,0.55,0.5), cTmp=new T.Color();
function instanced(geo, material, n, shadow){ var im=new T.InstancedMesh(geo, material, n); im.count=0; im.frustumCulled=false; im.castShadow=!!shadow; im.receiveShadow=false;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); for (var i=0;i<n;i++) im.setColorAt(i,cWhite); world.add(im); return im; }
function buildInstances(){
  Object.keys(EMAX).forEach(function(k){ EM[k]=instanced(EGEO[k], eMat, EMAX[k], QUAL>=2); });
  var cg=new T.CylinderGeometry(0.17,0.17,0.06,10); cg.rotateX(Math.PI/2);
  gemIM=instanced(cg, M.gold, 280, false);
  bitIM=instanced(gBox(0.15,0.15,0.15), new T.MeshBasicMaterial({color:0xffffff}), 260, false);
  mugIM=instanced(mergeGeo([[new T.CylinderGeometry(0.2,0.18,0.42,8),0xf2a31b,0,0,0],[new T.CylinderGeometry(0.21,0.21,0.1,8),0xfff8e8,0,0.24,0]]), new T.MeshLambertMaterial({vertexColors:true, flatShading:true, emissive:0x332200}), 40, false);
}
var bits=[];
function burst(x,z,col,n,up){
  for (var i=0;i<n && bits.length<250;i++){ var a=Math.random()*6.28, s=1.5+Math.random()*3; bits.push({x:x,y:0.5+Math.random()*0.5,z:z,vx:Math.cos(a)*s,vy:(up||2.5)+Math.random()*2.5,vz:Math.sin(a)*s,t:0.5+Math.random()*0.25,c:col}); }
}

// ---------------- player, weapons, fx ----------------
var player=null, panMesh=null, bossV=null, fireV=null, gobV=[], barrelV=[], poolV=[], meatV=[], swingV=[], teleV=null, panKick=0;
function buildActors(){
  player=makeChar({body:0x3d7bd9, hat:'cap', hatc:0xffd84a, apron:0xffffff, leg:0x2b4a8a, scale:1.15}); player.rotation.y=0;
  panMesh=new T.Group(); panMesh.add(mesh(new T.CylinderGeometry(0.3,0.26,0.07,12), M.darkMetal, 0,0.62,0)); panMesh.add(mesh(gBox(0.07,0.5,0.07), M.woodDark, 0,0.25,0));
  panMesh.position.set(0.42,0.6,0.15); player.userData.inner.add(panMesh);
  bossV=makeChar({body:0x4d7a3a, skin:0x5f9447, ears:1, hat:'crown', cape:0x8a1f1f, leg:0x3a2a1a, scale:2.7}); bossV.visible=false;
  var club=new T.Group(); club.add(mesh(gBox(0.14,0.9,0.14), M.woodDark, 0,0.45,0)); club.add(mesh(gBox(0.34,0.4,0.34), M.rock, 0,1.0,0)); club.position.set(0.48,0.5,0.15); bossV.userData.inner.add(club);
  // grill fire aura
  fireV=new T.Group();
  var fd=mesh(new T.CircleGeometry(1,28), new T.MeshBasicMaterial({color:0xff8a2a, transparent:true, opacity:0.2, depthWrite:false}), 0,0.03,0,false); fd.rotation.x=-Math.PI/2; fireV.add(fd);
  var fr=mesh(new T.RingGeometry(0.93,1,28), new T.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:0.75, depthWrite:false}), 0,0.04,0,false); fr.rotation.x=-Math.PI/2; fireV.add(fr);
  for (var i=0;i<8;i++){ var a=i/8*6.283, fl=mesh(new T.ConeGeometry(0.09,0.3,5), M.flame, Math.cos(a)*0.96,0.2,Math.sin(a)*0.96,false); fireV.add(fl); }
  fireV.visible=false; world.add(fireV);
  for (var g=0;g<3;g++){ var gc=makeChar({body:0x5a8a3a, skin:0x7ed957, ears:1, hat:'cap', hatc:0xff9a3c, apron:0xff9a3c, scale:0.8, leg:0x3a2a1a, mop:true}); gc.visible=false; gobV.push(gc); }
  for (var b=0;b<6;b++){ var bg=new T.Group(), br=mesh(new T.CylinderGeometry(0.75,0.75,1.3,12), M.chest, 0,0.75,0); br.rotation.z=Math.PI/2; bg.add(br);
    [-0.4,0.4].forEach(function(dx){ var r=mesh(new T.TorusGeometry(0.76,0.05,5,14), M.darkMetal, dx,0.75,0,false); r.rotation.y=Math.PI/2; bg.add(r); }); bg.visible=false; world.add(bg); barrelV.push(bg); }
  for (var p=0;p<8;p++){ var pm=mesh(new T.CircleGeometry(1,22), new T.MeshBasicMaterial({color:0x6cff5a, transparent:true, opacity:0.4, depthWrite:false}), 0,0.05,0,false); pm.rotation.x=-Math.PI/2; pm.visible=false; world.add(pm); poolV.push(pm); }
  for (var m=0;m<4;m++){ var mg=new T.Group(), ms=mesh(new T.SphereGeometry(0.26,7,6), M.meat, 0,0.5,0,false); ms.scale.set(1.3,0.9,1); mg.add(ms);
    var bn=mesh(new T.CylinderGeometry(0.05,0.05,0.4,5), M.bone, 0.36,0.5,0,false); bn.rotation.z=Math.PI/2; mg.add(bn); mg.add(mesh(new T.SphereGeometry(0.08,5,4), M.bone, 0.56,0.5,0,false));
    var hi=iconSprite('❤️','#ffffff'); hi.position.y=1.5; hi.scale.set(0.7,0.7,1); mg.add(hi); mg.visible=false; world.add(mg); meatV.push(mg); }
  for (var s=0;s<4;s++){ var sm=new T.MeshBasicMaterial({color:0xfff2b0, transparent:true, opacity:0, depthWrite:false, side:T.DoubleSide});
    var arc=mesh(new T.RingGeometry(0.35,1,20,1,-1.35,2.7), sm, 0,0.9,0,false); arc.rotation.x=-Math.PI/2; var full=mesh(new T.RingGeometry(0.35,1,28), sm, 0,0.9,0,false); full.rotation.x=-Math.PI/2;
    var sg=new T.Group(); sg.add(arc); sg.add(full); sg.visible=false; world.add(sg); swingV.push({g:sg, arc:arc, full:full, m:sm, t:0}); }
  teleV=mesh(new T.PlaneGeometry(2.6,9), new T.MeshBasicMaterial({color:0xff3030, transparent:true, opacity:0.35, depthWrite:false}), 0,0.06,0,false);
  teleV.geometry.rotateX(-Math.PI/2); teleV.geometry.translate(0,0,4.5); teleV.visible=false; world.add(teleV);
}
function swingFx(e){
  var v=swingV.filter(function(s){ return s.t<=0; })[0]||swingV[0]; v.t=0.2; v.g.visible=true; v.arc.visible=!e.full; v.full.visible=e.full;
  v.g.position.set(G.player.x,0,G.player.z); v.g.rotation.y=e.a-Math.PI/2; v.g.scale.setScalar(e.r+0.3);
}

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

// ---------------- input ----------------
var keys={}, joy={on:false, id:null, sx:0, sy:0, x:0, y:0};
addEventListener('pointerdown', function(){ Snd.unlock(); });
addEventListener('keydown', function(e){ keys[e.code]=true; Snd.unlock(); if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>=0) e.preventDefault(); });
addEventListener('keyup', function(e){ keys[e.code]=false; });
addEventListener('keydown', function(e){ var n=['Digit1','Digit2','Digit3'].indexOf(e.code); if (n>=0 && $('lvlM').classList.contains('show')){ var c=document.querySelectorAll('#lvCards .pcard')[n]; if (c) c.click(); } });
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

// ---------------- save ----------------
var G=null, SAVE={v:4, gold:0, meta:{}, night:1, sel:1, runs:0, hint:0};
function loadSave(){ try{ var s=PF.loadData('dj_save_v4'); if (s && !QS.has('reset')){ var o=JSON.parse(s); if (o && o.v===4) SAVE=o; } }catch(e){} SAVE.meta=SAVE.meta||{}; SAVE.night=SAVE.night||1; SAVE.sel=Math.min(SAVE.sel||1, SAVE.night); }
function saveNow(){ PF.saveData('dj_save_v4', JSON.stringify(SAVE)); }

// ---------------- HUD ----------------
var W_EM={pan:'🍳',mug:'🍺',barrel:'🛢️',fire:'🔥',potion:'🧪',gob:'👺',boots:'👢',apron:'❤️',magnet:'🧲',haste:'⚡',power:'💪',luck:'💰',gold:'🎁'};
var P_DESC={boots:'🏃 +7%', apron:'❤️ +20', magnet:'🧲 +35%', haste:'⚡ +10%', power:'💥 +14%', luck:'💰 +20%', gold:'+ ● 10'};
var M_EM={hp:'❤️',power:'💪',speed:'👢',magnet:'🧲',gold:'💰'}, M_NAME={hp:'m_hp',power:'p_power',speed:'boots',magnet:'p_magnet',gold:'p_luck'}, M_DESC={hp:'+10%',power:'+8%',speed:'+4%',magnet:'+15%',gold:'+15%'};
function fmt(n){ n=Math.floor(n); if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e4) return (n/1e3).toFixed(1)+'K'; return ''+n; }
function screenPos(x,y,z){ var v=new T.Vector3(x,y,z).project(camera); return {x:(v.x+1)/2*innerWidth, y:(1-v.y)/2*innerHeight, vis:v.z<1}; }
var floats=0;
function floatText(txt, x,y,z, col, big){
  if (floats>16) return; var p=screenPos(x,y,z); if(!p.vis) return; floats++;
  var e=document.createElement('div'); e.className='float out'; e.textContent=txt; e.style.left=(p.x-12)+'px'; e.style.top=(p.y-16)+'px'; if(col) e.style.color=col; if(big) e.style.fontSize='26px';
  $('hud').appendChild(e); requestAnimationFrame(function(){ e.style.transform='translateY(-42px)'; e.style.opacity='0'; });
  setTimeout(function(){ e.remove(); floats--; }, 650);
}
function banner(main, sub, ms){
  var b=$('banner'); b.innerHTML=''; b.textContent=main; if(sub){ var s=document.createElement('small'); s.textContent=sub; b.appendChild(s); }
  b.classList.add('show'); clearTimeout(banner.t); banner.t=setTimeout(function(){ b.classList.remove('show'); }, ms||2400);
}
function toast(t){ banner(t,'',1500); }
function setTut(txt){ var e=$('tut'); if(!txt){ e.classList.remove('show'); return; } e.textContent=txt; e.classList.add('show'); }
function applyLang(){
  document.querySelectorAll('[data-t]').forEach(function(e){ e.textContent=tl(e.dataset.t); });
  var sel=$('langSel'); sel.innerHTML=''; CODES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=LANG_NAMES[c]; if(c===LANG) o.selected=true; sel.appendChild(o); });
}
$('langSel').onchange=function(){ LANG=this.value; try{localStorage.setItem('dj_lang',LANG);}catch(e){} applyLang(); if ($('menu').classList.contains('show')) renderMenu(); };
$('sndBtn').onclick=function(){ var on=Snd.toggle(); this.textContent=on?'🔊':'🔇'; };
$('sndBtn').textContent=Snd.isOn()?'🔊':'🔇';
function mmss(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+('0'+s%60).slice(-2); }
var hudKey='';
function updHud(){
  var inRun = G.phase!=='menu';
  $('coins').textContent = inRun ? fmt(DJ.goldEarned(G)) : fmt(SAVE.gold);
  $('xpFill').style.width = inRun ? Math.min(100, G.xp/DJ.xpNeed(G.lvl)*100)+'%' : '0%';
  var wv=$('wave'); wv.style.display=inRun?'':'none';
  if (!inRun) return;
  var bossOn=!!G.boss, tx=tl('night',{n:G.night})+'  ⏱ '+(bossOn||G.bossDone?'👹':mmss(DJ.RUN-G.t))+'  💀 '+G.kills;
  if (wv.dataset.tx!==tx){ wv.dataset.tx=tx; $('waveTx').textContent=tx; }
  $('waveBar').style.width=(bossOn? Math.max(0,G.boss.hp/G.boss.maxhp)*100 : Math.min(100,G.t/DJ.RUN*100))+'%';
  wv.classList.toggle('soon', bossOn);
  var S=DJ.stats(G), hb=$('hpBar'), sp=screenPos(G.player.x, 0, G.player.z+0.75);
  hb.style.left=(sp.x-27)+'px'; hb.style.top=(sp.y+2)+'px'; $('hpFill').style.width=Math.max(0,G.player.hp/S.maxhp*100)+'%';
  var k='L'+G.lvl+Object.keys(G.w).map(function(x){ return x+G.w[x]; }).join('');
  if (k!==hudKey){ hudKey=k; $('lvlTx').textContent='Lv '+G.lvl;
    $('wbar').innerHTML=Object.keys(G.w).map(function(x){ return '<span>'+W_EM[x]+'<i>'+(G.w[x]>=DJ.MAXLV?'★':G.w[x])+'</i></span>'; }).join(''); }
}

// ---------------- menu + upgrades ----------------
function renderMenu(){
  $('mnNight').textContent=tl('night',{n:SAVE.sel}); $('mnPrev').disabled=SAVE.sel<=1; $('mnNext').disabled=SAVE.sel>=SAVE.night;
  $('mnGold').textContent='● '+fmt(SAVE.gold);
  var rows=$('mnRows'); rows.innerHTML='';
  Object.keys(DJ.META).forEach(function(k){
    var u=DJ.META[k], l=SAVE.meta[k]||0, r=document.createElement('div'); r.className='srow';
    var dots=''; for (var i=0;i<u.max;i++) dots+= i<l?'●':'○';
    r.innerHTML='<div class="em">'+M_EM[k]+'</div><div class="tx"><b>'+tl(M_NAME[k])+'</b> '+M_DESC[k]+'<br><span class="lv">'+dots+'</span></div>';
    var b=document.createElement('button'); b.className='btn';
    if (l>=u.max){ b.textContent=tl('max'); b.disabled=true; }
    else { b.textContent='● '+fmt(u.cost[l]); b.disabled=SAVE.gold<u.cost[l]; b.onclick=function(){ if (DJ.buyMeta(SAVE,k)){ Snd.buy(); saveNow(); renderMenu(); } }; }
    r.appendChild(b); rows.appendChild(r); });
}
function showMenu(){ G.phase='menu'; document.body.classList.remove('run'); renderMenu(); $('menu').classList.add('show'); setTut(''); }
$('mnPrev').onclick=function(){ SAVE.sel=Math.max(1,SAVE.sel-1); renderMenu(); };
$('mnNext').onclick=function(){ SAVE.sel=Math.min(SAVE.night,SAVE.sel+1); renderMenu(); };
var lastAdT=performance.now();
$('mnPlay').onclick=function(){ if (PF.adBusy) return; Snd.unlock();
  $('menu').classList.remove('show');
  if (SAVE.runs>0 && performance.now()-lastAdT>90000){ lastAdT=performance.now(); PF.midgame(startRun); } else startRun(); };
function startRun(){
  G=DJ.newRun(SAVE.meta, SAVE.sel, (Date.now()%100000)+1); bits=[]; hudKey=''; SAVE.runs++; saveNow();
  document.body.classList.add('run');
  banner(tl('night',{n:G.night}), tl('autoHint'), 3200); Snd.horn();
  if (SAVE.runs<=2) { setTut(TOUCH?tl('move_touch'):tl('move_kb')); setTimeout(function(){ setTut(''); }, 5000); }
}

// ---------------- level up ----------------
function cardHtml(k){
  var isW=DJ.WEAP.indexOf(k)>=0, l=DJ.lv(G,k), dots='';
  if (k!=='gold') for (var i=0;i<DJ.MAXLV;i++) dots+= i<l?'●':(i===l?'◉':'○');
  var name = k==='gold'? tl('c_gold') : tl((isW?'w_':'p_')+k), desc = isW? tl('wd_'+k) : P_DESC[k];
  return '<span class="em">'+W_EM[k]+'</span><b>'+name+'</b><span class="ds'+(isW?' w':'')+'">'+desc+'</span><span class="lv">'+(l===0&&k!=='gold'?'<u>'+tl('new')+'</u> ':'')+dots+'</span>';
}
var rerolled=false;
function showLevel(){
  var box=$('lvCards'), rr=$('lvReroll'); $('lvTitle').textContent=tl('lvlUp')+'  Lv '+G.lvl; box.innerHTML='';
  (G.offer||[]).forEach(function(k){ var b=document.createElement('button'); b.className='pcard'; b.innerHTML=cardHtml(k);
    b.onclick=function(){ DJ.choose(G,k); Snd.fill(); if (G.phase==='levelup') showLevel(); else $('lvlM').classList.remove('show'); }; box.appendChild(b); });
  rr.textContent=tl('reroll'); rr.style.display=rerolled?'none':''; rr.disabled=false;
  rr.onclick=function(){ rr.disabled=true; PF.rewarded(function(ok){ if(ok){ rerolled=true; DJ.reroll(G); showLevel(); } else rr.disabled=false; }); };
  $('lvlM').classList.add('show');
}

// ---------------- end of run ----------------
function showEnd(win){
  var gold=DJ.goldEarned(G), m=$('endM'), rv=$('enRevive'), db=$('enDouble'), ok=$('enOk'), doubled=false;
  $('enTitle').textContent=win? tl('win') : tl('dead');
  $('enStats').textContent=tl('night',{n:G.night})+'   ⏱ '+mmss(Math.min(G.t,DJ.RUN))+'   💀 '+G.kills+'   Lv '+G.lvl;
  $('enGold').textContent='● +'+fmt(gold);
  rv.style.display=(!win && !G.revived)?'':'none'; rv.textContent=tl('revive'); rv.disabled=false;
  rv.onclick=function(){ rv.disabled=true; PF.rewarded(function(k){ if(k){ m.classList.remove('show'); DJ.revive(G); } else rv.disabled=false; }); };
  db.textContent=tl('double'); db.style.display=''; db.disabled=false;
  db.onclick=function(){ db.disabled=true; PF.rewarded(function(k){ if(k){ doubled=true; gold*=2; $('enGold').textContent='● +'+fmt(gold); db.style.display='none'; Snd.buy(); } else db.disabled=false; }); };
  ok.textContent=win? tl('next') : tl('retry');
  ok.onclick=function(){ m.classList.remove('show'); SAVE.gold+=gold;
    if (win && G.night>=SAVE.night){ SAVE.night=G.night+1; } if (win) SAVE.sel=Math.min(SAVE.night, G.night+1);
    saveNow(); showMenu(); };
  if (win){ Snd.buy(); PF.happy(); } else Snd.bad();
  m.classList.add('show');
}

// ---------------- events ----------------
var hitSndT=0, shake=0, hurtFx=0, numT=0;
function handleEvents(){
  var ev=G.ev; G.ev=[]; var now=performance.now();
  for (var i=0;i<ev.length;i++){ var e=ev[i];
    switch(e.t){
      case 'hit': if (bits.length<200) burst(e.x,e.z,0xffffff,1,1.5); if (now-hitSndT>55){ hitSndT=now; Snd.hit(); }
        if (now-numT>70 || e.big){ numT=now; floatText(''+Math.round(e.d), e.x, 1.4, e.z, e.big?'#ffb347':'#ffffff'); } break;
      case 'kill': burst(e.x,e.z,ECOL[e.type]||0xffffff,5,3); break;
      case 'swing': swingFx(e); panKick=0.2; Snd.swing(); break;
      case 'throw': Snd.take(); break;
      case 'roll': Snd.thud(); break;
      case 'splash': Snd.squish(); burst(e.x,e.z,0x6cff5a,6,3); break;
      case 'gem': Snd.coin(); break;
      case 'heal': floatText('+'+Math.round(e.v)+' ❤️', G.player.x, 2.4, G.player.z, '#7ee06a', true); Snd.buy(); break;
      case 'hurt': shake=0.2; hurtFx=1; Snd.bad(); break;
      case 'levelup': rerolled=false; showLevel(); Snd.buy(); PF.happy(); break;
      case 'swarm': banner(tl('swarm'),'',1600); Snd.horn(); break;
      case 'elite': banner(tl('elite'),'',1800); Snd.boss(); break;
      case 'boss': banner(tl('bossIn'),'',3000); Snd.boss(); shake=0.4; break;
      case 'bossDash': Snd.thud(); shake=0.25; break;
      case 'bossDead': burst(e.x,e.z,0xffd84a,40,6); shake=0.6; break;
      case 'revive': burst(G.player.x,G.player.z,0xfff2b0,40,5); shake=0.4; Snd.boss(); break;
      case 'dead': setTimeout(function(){ showEnd(false); }, 700); Snd.thud(); shake=0.5; break;
      case 'win': setTimeout(function(){ showEnd(true); }, 1400); break;
    }
  }
}

// ---------------- frame ----------------
var last=performance.now(), acc=0, lightT=0;
function frame(now){
  requestAnimationFrame(frame);
  var dt=Math.min(0.1,(now-last)/1000); last=now;
  var live = G.phase==='play' && !PF.adBusy && !document.hidden;
  PF.setPlaying(live);
  var inp=readInput();
  if (live){ acc+=dt; var steps=0; while(acc>=1/60 && steps<5){ acc-=1/60; steps++; DJ.step(G, 1/60, inp[0], inp[1]); } if (steps>=5) acc=0; }
  handleEvents();
  if (G.phase!=='levelup' && $('lvlM').classList.contains('show')) $('lvlM').classList.remove('show');
  render(dt, live);
  perfTick(dt);
  updHud();
}
function setInst(im, i, x,y,z, yaw, sx,sy,sz, col){
  dummy.position.set(x,y,z); dummy.rotation.set(0,yaw,0); dummy.scale.set(sx,sy,sz); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); if (col) im.setColorAt(i, col);
}
function render(dt, live){
  var p=G.player, t=performance.now()/1000, i;
  player.position.set(p.x,0,p.z);
  player.rotation.y += angDiff(player.rotation.y, p.face)*Math.min(1,dt*14);
  animChar(player, live&&p.moving, dt, false);
  player.visible = !(p.ifr>0 && G.phase==='play' && Math.floor(t*18)%2) && G.phase!=='dead';
  panKick=Math.max(0,panKick-dt); panMesh.rotation.x = panKick>0 ? Math.sin(panKick/0.2*Math.PI)*1.6 : 0;
  // monsters
  var cnt={slime:0,gob:0,skel:0,bat:0,orc:0,elite:0}, es=G.enemies;
  for (i=0;i<es.length;i++){ var e=es[i]; if (e.type==='boss') continue; var im=EM[e.type], n=cnt[e.type]; if (n>=EMAX[e.type]) continue; cnt[e.type]=n+1;
    var hop=Math.abs(Math.sin(e.ph)), s=e.type==='elite'?1.5:1, sq=e.type==='slime'? 1+hop*0.25 : 1;
    setInst(im, n, e.x, e.type==='bat'? Math.sin(e.ph*0.8)*0.2 : hop*0.14, e.z, e.face, s/Math.sqrt(sq), s*sq, s/Math.sqrt(sq), e.flash>0?cFlash:(e.type==='elite'?cElite:cWhite)); }
  Object.keys(EM).forEach(function(k){ var im=EM[k]; im.count=cnt[k]; im.instanceMatrix.needsUpdate=true; if (im.instanceColor) im.instanceColor.needsUpdate=true; });
  // boss
  var b=G.boss; bossV.visible=!!b; teleV.visible=false;
  if (b){ bossV.position.set(b.x,0,b.z); bossV.rotation.y += angDiff(bossV.rotation.y, b.mode==='wind'?Math.atan2(b.dx,b.dz):b.face)*Math.min(1,dt*10); animChar(bossV, b.mode!=='wind', dt, false);
    bossV.scale.setScalar(2.7*(b.flash>0?1.06:1)*(b.mode==='wind'?1+Math.sin(t*40)*0.03:1));
    if (b.mode==='wind'){ teleV.visible=true; teleV.position.set(b.x,0.06,b.z); teleV.rotation.y=Math.atan2(b.dx,b.dz); teleV.material.opacity=0.25+Math.abs(Math.sin(t*14))*0.3; } }
  // coins
  var gs=G.gems, gn=Math.min(gs.length, 280);
  for (i=0;i<gn;i++){ var g=gs[i], gsz=g.v>=4?1.6:(g.v>=2?1.25:1); setInst(gemIM, i, g.x, 0.32+Math.sin(t*4+g.id)*0.06, g.z, t*4+g.id, gsz,gsz,gsz); }
  gemIM.count=gn; gemIM.instanceMatrix.needsUpdate=true;
  // shots
  var mn=0, bn=0;
  G.shots.forEach(function(s){
    if (s.k==='mug' && mn<40){ dummy.position.set(s.x,0.9,s.z); dummy.rotation.set(t*14+s.id, 0, t*9); dummy.scale.set(1,1,1); dummy.updateMatrix(); mugIM.setMatrixAt(mn++, dummy.matrix); }
    else if (s.k==='barrel' && bn<barrelV.length){ var bv=barrelV[bn++]; bv.visible=true; bv.position.set(s.x,0,s.z); bv.rotation.y=Math.atan2(s.vx,s.vz); bv.children[0].rotation.x=t*10; }
  });
  mugIM.count=mn; mugIM.instanceMatrix.needsUpdate=true; for (i=bn;i<barrelV.length;i++) barrelV[i].visible=false;
  for (i=0;i<poolV.length;i++){ var o=G.pools[i], pv=poolV[i]; pv.visible=!!o; if (o){ pv.position.set(o.x,0.05,o.z); var ps=o.delay>0? o.r*(1-o.delay/0.45)*0.6+0.2 : o.r*(1+Math.sin(t*6+i)*0.04); pv.scale.set(ps,ps,ps); pv.material.opacity=o.delay>0?0.2:Math.min(0.45,o.life*0.6); } }
  for (i=0;i<meatV.length;i++){ var mt=G.meats[i], mv=meatV[i]; mv.visible=!!mt; if (mt){ mv.position.set(mt.x, Math.sin(t*3+i)*0.1, mt.z); mv.rotation.y=t*1.5; } }
  // auras / helpers
  var fl=DJ.lv(G,'fire'); fireV.visible=fl>0 && G.phase!=='menu'; if (fl){ var fr=DJ.fireRange(G)*(1+Math.sin(t*9)*0.03); fireV.position.set(p.x,0,p.z); fireV.scale.set(fr,1,fr); fireV.rotation.y=t*1.2; }
  var gc=G.phase==='menu'?0:DJ.gobCount(G); for (i=0;i<gobV.length;i++){ var gv=gobV[i]; gv.visible=i<gc; if (i<gc){ var q=DJ.gobPos(G,i); gv.position.set(q.x,0,q.z); gv.rotation.y=q.a+Math.PI/2; animChar(gv,true,dt,false); } }
  swingV.forEach(function(s){ if (s.t>0){ s.t-=dt; s.m.opacity=Math.max(0,s.t/0.2)*0.7; if (s.t<=0) s.g.visible=false; } });
  // bits
  var bi=0;
  for (i=bits.length-1;i>=0;i--){ var bt=bits[i]; bt.t-=dt; if (bt.t<=0){ bits.splice(i,1); continue; } bt.x+=bt.vx*dt; bt.y+=bt.vy*dt; bt.z+=bt.vz*dt; bt.vy-=12*dt; if (bt.y<0.08){ bt.y=0.08; bt.vy*=-0.4; } }
  for (i=0;i<bits.length && bi<260;i++){ var b2=bits[i], sc=Math.min(1,b2.t*3); setInst(bitIM, bi++, b2.x,b2.y,b2.z, b2.t*8, sc,sc,sc, cTmp.set(b2.c)); }
  bitIM.count=bi; bitIM.instanceMatrix.needsUpdate=true; if (bitIM.instanceColor) bitIM.instanceColor.needsUpdate=true;
  // lights
  lightT-=dt;
  if (lightT<=0){ lightT=0.5; var sorted=torches.slice().sort(function(a,c){ return Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z); });
    torchLights.forEach(function(L,k){ var tt=sorted[k]; if(tt){ L.position.set(tt.x,2.3,tt.z); L.userData.t=tt; } else L.userData.t=null; }); }
  torchLights.forEach(function(L){ var tt=L.userData.t; L.intensity = tt? 6+Math.sin(t*9+tt.ph)*1.2 : 0; });
  torches.forEach(function(tt){ tt.fl.scale.y=1+Math.sin(t*10+tt.ph)*0.15; });
  // camera
  var portrait = innerHeight>innerWidth*1.1, cy = portrait? 25:18.5, cz = portrait? 14:12.5;
  camGoal.set(p.x*0.72, cy, -D/2+(p.z+D/2)*0.78+cz);   // lean toward the middle so the edges show less empty space camera.position.lerp(camGoal, Math.min(1, dt*6));
  var sx=0, sz=0; if (shake>0){ shake-=dt; sx=(Math.random()-0.5)*shake*1.2; sz=(Math.random()-0.5)*shake*1.2; }
  camera.position.x+=sx; camera.position.z+=sz;
  camera.lookAt(camera.position.x, 0, camera.position.z-cz+0.4);
  sun.position.set(p.x+6, 18, p.z+8); sun.target.position.set(p.x,0,p.z);
  if (hurtFx>0){ hurtFx=Math.max(0,hurtFx-dt*3); } $('hurt').style.opacity=hurtFx*0.55;
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


// ---------------- boot ----------------
function boot(){
  LANG=detectLang(PF.locale); applyLang(); loadSave();
  buildArena(); buildInstances(); buildActors();
  G=DJ.newRun(SAVE.meta, SAVE.sel, 1); G.phase='menu';
  resize(); camera.position.set(0, 18.5, -D/2+12.5);
  $('loading').style.display='none';
  PF.loaded(); showMenu();
  if (DEBUG){ Object.defineProperty(window,'__G',{get:function(){ return G; }}); window.__DJ=DJ; window.__SAVE=SAVE; window.__PF=PF; window.__ri=renderer.info;
    window.__step=function(sec,ix,iz){ for(var i=0;i<sec*60;i++) DJ.step(G,1/60,ix||0,iz||0); }; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
