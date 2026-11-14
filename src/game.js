// ===== GAME (render + UI) =====
(function(){
'use strict';
window.addEventListener('error',function(e){ if(window.PokiSDK||window.CrazyGames) return; var d=document.getElementById('errbox')||document.body.appendChild(Object.assign(document.createElement('pre'),{id:'errbox'})); d.style.cssText='position:fixed;left:0;bottom:0;z-index:99;background:#a00;color:#fff;font-size:11px;max-width:100%;white-space:pre-wrap;margin:0'; d.textContent+=e.message+' @'+e.lineno+'\n'; });
var T = window.THREE, W=DJ.W, D=DJ.D;
var $=function(id){return document.getElementById(id);};
var TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
var QS = new URLSearchParams(location.search), DEBUG = QS.has('debug'); try{ if(localStorage.getItem('dj_debug')==='1') DEBUG=true; }catch(e){}

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
    door:function(){ noise(0.3,0.25,900); tone(140,0.2,'square',0.06,0.6); },
    mute:function(m){ muted=m; S.bgm&&S.bgm(); },
    pmute:function(m){ pmuted=m; plog('platformMute',m); S.bgm&&S.bgm(); },
    toggle:function(){ off=!off; try{localStorage.setItem('dj_snd',off?'0':'1');}catch(e){} return !off; },
    isOn:function(){ return !off; }, unlock:function(){ ctx(); }
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

// floor textures
var floorTex=canvasTex(256,256,function(x,w,h){
  x.fillStyle='#4a3b4c'; x.fillRect(0,0,w,h);
  var cols=['#8d7b7a','#958281','#86756f','#9a8984','#8a7a80'];
  for (var j=0;j<4;j++) for (var i=0;i<4;i++){ x.fillStyle=cols[(i*7+j*3)%cols.length]; x.beginPath(); if(x.roundRect) x.roundRect(i*64+3,j*64+3,58,58,8); else x.rect(i*64+3,j*64+3,58,58); x.fill(); }
  x.globalAlpha=0.08; for (var k=0;k<400;k++){ x.fillStyle=Math.random()<0.5?'#fff':'#000'; x.fillRect(Math.random()*w,Math.random()*h,2,2); }
});
floorTex.wrapS=floorTex.wrapT=T.RepeatWrapping; floorTex.repeat.set(W/4, D/4);
var woodTex=canvasTex(128,128,function(x,w,h){ for(var i=0;i<8;i++){ x.fillStyle=['#9a6a3e','#a7744a','#8f6138'][i%3]; x.fillRect(0,i*16,w,15); x.fillStyle='#6b4325'; x.fillRect(0,i*16+15,w,1); x.fillRect((i*37)%w,i*16,1,15);} });
woodTex.wrapS=woodTex.wrapT=T.RepeatWrapping; woodTex.repeat.set(2,3);
M.floor=new T.MeshLambertMaterial({map:floorTex});
M.floorDark=new T.MeshLambertMaterial({map:floorTex, color:0x3a3040});
M.wood=new T.MeshLambertMaterial({map:woodTex});
M.wall=mat(0x6a5a7e); M.wallTop=mat(0x8a7aa0); M.wallDark=mat(0x4c3f5c);
M.metal=mat(0xb9c2cc); M.darkMetal=mat(0x5a6170); M.gold=mat(0xffcf3a,{emissive:0x553300}); M.chest=mat(0x9b5a2e); M.chestDark=mat(0x6e3b1c);
M.flame=new T.MeshBasicMaterial({color:0xffb347}); M.flame2=new T.MeshBasicMaterial({color:0xfff07a});
M.rock=mat(0x8a8090); M.lava=new T.MeshBasicMaterial({color:0xff6a2a}); M.ice=mat(0x9fe3ff,{transparent:true,opacity:0.85}); M.sack=mat(0xb07a42); M.rope=mat(0x6b4a2a);
M.portal=new T.MeshBasicMaterial({color:0xb27cff, transparent:true, opacity:0.85}); M.black=new T.MeshBasicMaterial({color:0x1b1220});
M.white=mat(0xffffff); M.bone=mat(0xeee6d0);

var world=new T.Group(); scene.add(world);
var roomGroups=[], wallGroup=new T.Group(); world.add(wallGroup);
var torches=[];

// ---------------- static world ----------------
var gBox=function(w,h,d){ return new T.BoxGeometry(w,h,d); };
function addWall(grp, x0,z0,x1,z1, h, m){
  var w=Math.abs(x1-x0)||0.6, d=Math.abs(z1-z0)||0.6, cx=(x0+x1)/2, cz=(z0+z1)/2;
  var b=mesh(gBox(w,h,d), m||M.wall, cx, h/2, cz); grp.add(b);
  var top=mesh(gBox(w+0.06,0.14,d+0.06), M.wallTop, cx, h+0.07, cz, false); grp.add(top);
}
function buildWalls(){
  world.remove(wallGroup); wallGroup=new T.Group(); world.add(wallGroup);
  var n=G.rooms, H=2.0, T2=0.3;
  // side walls per room
  for (var r=0;r<n;r++){
    var z0=-r*D, z1=-(r+1)*D;
    addWall(wallGroup, -W/2-T2, z0, -W/2-T2, z1, H);
    addWall(wallGroup, W/2+T2, z0, W/2+T2, z1, H);
    // pillars at room borders
    if (r>0){ [-W/2-T2, W/2+T2].forEach(function(x){ wallGroup.add(mesh(gBox(0.8,2.2,0.8), M.wallDark, x, 1.1, z0)); });
      addWall(wallGroup, -W/2, z0, -1.5, z0, 0.4, M.wallDark); addWall(wallGroup, 1.5, z0, W/2, z0, 0.4, M.wallDark); }
  }
  // top wall of last room (with the locked next room behind)
  var zt=-n*D; addWall(wallGroup, -W/2-T2, zt, W/2+T2, zt, H+0.4, M.wallDark);
  // front low wall with gate
  addWall(wallGroup, -W/2-T2, 0.15, -1.6, 0.15, 0.4); addWall(wallGroup, 1.6, 0.15, W/2+T2, 0.15, 0.4);
  [-1.7,1.7].forEach(function(x){ wallGroup.add(mesh(gBox(0.7,1.0,0.7), M.wallDark, x, 0.5, 0.15)); wallGroup.add(mesh(new T.ConeGeometry(0.16,0.4,6), M.flame, x, 1.2, 0.15, false)); });
  // locked next room teaser
  if (n<DJ.ROOMS.length){
    var lz=-n*D-D/2;
    var f=mesh(new T.PlaneGeometry(W, D), M.floorDark, 0, 0.01, lz, false); f.rotation.x=-Math.PI/2; wallGroup.add(f);
    var lock=makeLabel('🔒 '+tl('r_'+DJ.ROOMS[n].id), 512, 96, '#ffffff', 'rgba(40,24,48,0.75)'); lock.position.set(0,2.9,-n*D-1.0); lock.scale.set(5,0.94,1); wallGroup.add(lock);
  }
}
function buildRoomStatic(r){
  var g=new T.Group(), R=DJ.ROOMS[r], zc=-r*D-D/2;
  var f=mesh(new T.PlaneGeometry(W, D), M.floor, 0, 0, zc, false); f.rotation.x=-Math.PI/2; f.receiveShadow=true; g.add(f);
  // theme tint strip / decor
  var deco={hall:0x6a5a7e, vault:0xc79a3a, hall2:0x6a5a7e, cave:0x58b05a, crypt:0xd8d0c0, lava:0xff6a2a, ice:0x8fdcff, lair:0xc0392b}[R.id];
  // rug down the middle
  var rug=mesh(new T.PlaneGeometry(2.4, D-1.2), mat(deco,{flat:false, transparent:true, opacity:0.35}), 0, 0.012, zc, false); rug.rotation.x=-Math.PI/2; g.add(rug);
  // torches on side walls
  [-W/2, W/2].forEach(function(x, i){
    var tz=zc+(i?1.5:-1.5);
    var stick=mesh(new T.CylinderGeometry(0.07,0.09,0.6,6), M.rope, x+(i?-0.15:0.15), 1.7, tz); stick.rotation.z=i?0.5:-0.5; g.add(stick);
    var fl=mesh(new T.ConeGeometry(0.16,0.42,6), M.flame, x+(i?-0.32:0.32), 2.12, tz, false); g.add(fl);
    var fl2=mesh(new T.ConeGeometry(0.08,0.24,6), M.flame2, x+(i?-0.32:0.32), 2.08, tz, false); g.add(fl2);
    torches.push({x:x+(i?-0.6:0.6), z:tz, fl:fl, ph:Math.random()*6});
  });
  // decor props
  var rr=mulberry(r*77+5);
  for (var k=0;k<3;k++){
    var side=k%2?1:-1, px=side*(W/2-0.55), pz=-r*D-1.2-rr()*(D-2.4);
    if (Math.abs(pz-(zc+(side>0?1.5:-1.5)))<1) continue;
    if (G.st.some(function(s){ return Math.hypot(s.x-px,s.z-pz)<1.8; }) || G.piles.some(function(s){ return Math.hypot(s.x-px,s.z-pz)<1.8; })) continue;
    if (r===0 && pz>-6.5 && side<0) continue;
    if (R.id==='crypt'||R.id==='lair'){ var sk=mesh(new T.SphereGeometry(0.22,6,5), M.bone, px, 0.2, pz); g.add(sk); }
    else { var br=mesh(new T.CylinderGeometry(0.35,0.3,0.7,8), M.chest, px, 0.35, pz); g.add(br); var hp=mesh(new T.TorusGeometry(0.33,0.04,4,10), M.darkMetal, px,0.55,pz); hp.rotation.x=Math.PI/2; g.add(hp); }
  }
  if (R.id==='lava'){ [-1,1].forEach(function(s){ var lv=mesh(new T.PlaneGeometry(0.8,D),M.lava,s*(W/2-0.45),0.02,zc,false); lv.rotation.x=-Math.PI/2; g.add(lv); }); }
  if (R.id==='ice'){ for(var q=0;q<5;q++){ var cr=mesh(new T.ConeGeometry(0.3,1.2+rr(),5), M.ice, (q%2?1:-1)*(W/2-0.35), 0.6, -r*D-1-q*1.7); g.add(cr);} }
  // room name on floor
  var nm=makeLabel(tl('r_'+R.id), 512, 80, 'rgba(255,255,255,0.75)', null); nm.position.set(0,0.03,-r*D-(r?1.6:0.9)); nm.rotation.x=-Math.PI/2; nm.scale.set(4,0.62,1); nm.material.depthWrite=false; g.add(nm);
  world.add(g); roomGroups[r]=g;
}
function mulberry(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function buildOutside(){
  var g=new T.Group();
  var gr=mesh(new T.PlaneGeometry(60, 30), mat(0x2b2032), 0, -0.02, 14, false); gr.rotation.x=-Math.PI/2; g.add(gr);
  var path=mesh(new T.PlaneGeometry(3, 8), mat(0x6a5a64), 0, -0.01, 4, false); path.rotation.x=-Math.PI/2; g.add(path);
  world.add(g);
}
function buildBench(){
  var b=DJ.HALL_PADS.bench, bx=b[0]-1.25, bz=-b[1], g=new T.Group();
  var tb=mesh(gBox(0.8,0.12,1.8), M.chest, bx, 0.8, bz); g.add(tb);
  [-0.7,0.7].forEach(function(dz){ g.add(mesh(gBox(0.7,0.8,0.12), M.chestDark, bx, 0.4, bz+dz)); });
  var hd=mesh(new T.CylinderGeometry(0.05,0.05,0.8,5), M.rope, bx, 0.95, bz-0.3); hd.rotation.x=1.3; g.add(hd);
  g.add(mesh(gBox(0.2,0.2,0.3), M.darkMetal, bx, 0.95, bz+0.4));
  world.add(g); return g;
}
function makePile(x,z){
  var g=new T.Group();
  for (var i=0;i<7;i++){ var a=i/7*Math.PI*2, rr=i?0.55:0; var sk=makeSack(); sk.position.set(x+Math.cos(a)*rr, i?0:0.35, z+Math.sin(a)*rr); sk.rotation.y=a; g.add(sk); }
  var c=mesh(new T.CylinderGeometry(0.9,1.0,0.12,10), M.gold, x, 0.06, z); g.add(c);
  world.add(g); return g;
}
var sackGeo=new T.SphereGeometry(0.3,7,6);
function makeSack(){ var g=new T.Group(); var b=mesh(sackGeo, M.sack, 0,0.3,0); b.scale.set(1,0.9,1); g.add(b); g.add(mesh(new T.CylinderGeometry(0.08,0.12,0.14,6), M.rope, 0,0.58,0)); var cn=mesh(new T.CylinderGeometry(0.11,0.11,0.03,8), M.gold, 0, 0.34, 0.27, false); cn.rotation.x=Math.PI/2; g.add(cn); return g; }

// ---------------- labels / sprites ----------------
function makeLabel(text, w, h, color, bg, font){
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
var G=null, views={st:{}, sl:{}, hr:{}, gb:{}}, player=null, sackStack=[], pileMeshes=[], padViews=[], portal=null, arrow3d=null, floorArrow=null, benchMesh=null;
var RING_COL={slime:'#7ee06a', trap:'#ffb347', door:'#ffd84a', chest:'#ffe45c'};
var coinGeo=new T.CylinderGeometry(0.17,0.17,0.06,10);

function stationView(s){
  var g=new T.Group(); g.position.set(s.x,0,s.z); world.add(g);
  var v={g:g, s:s, armed:new T.Group(), sprung:new T.Group(), shake:0, coinN:-1};
  g.add(v.armed); g.add(v.sprung);
  if (s.k==='trap'){
    var base=mesh(gBox(1.3,0.08,1.3), M.darkMetal, 0,0.04,0); g.add(base);
    // ready marker: green glow ring
    var rg=mesh(new T.RingGeometry(0.72,0.86,24), new T.MeshBasicMaterial({color:0x7ee06a, transparent:true, opacity:0.8}), 0,0.1,0,false); rg.rotation.x=-Math.PI/2; v.armed.add(rg);
    var rr=mesh(new T.RingGeometry(0.72,0.86,24), new T.MeshBasicMaterial({color:0xff5a4a, transparent:true, opacity:0.85}), 0,0.1,0,false); rr.rotation.x=-Math.PI/2; v.sprung.add(rr);
    if (s.sub==='spike'||s.sub==='arrow'){
      for (var i=0;i<9;i++){ var x=(i%3-1)*0.38, z=(Math.floor(i/3)-1)*0.38;
        v.armed.add(mesh(new T.CylinderGeometry(0.07,0.07,0.02,6), M.black, x,0.09,z,false));
        v.sprung.add(mesh(new T.ConeGeometry(0.1,0.5,5), M.metal, x,0.33,z)); }
      if (s.sub==='arrow'){ var side=s.x>0?1:-1; g.add(mesh(gBox(0.4,0.7,0.9), M.wallDark, side*1.0, 0.35, 0)); }
    } else if (s.sub==='rock'){
      v.armed.add(mesh(new T.DodecahedronGeometry(0.5), M.rock, 0,2.5,0)); v.armed.add(mesh(new T.CylinderGeometry(0.02,0.02,1.2,4), M.rope, 0,3.3,0));
      var rk2=mesh(new T.DodecahedronGeometry(0.5), M.rock, 0.1,0.45,0); rk2.rotation.set(0.5,0.3,0.2); v.sprung.add(rk2);
    } else if (s.sub==='fire'){
      g.add(mesh(gBox(1.1,0.1,1.1), mat(0x3a2a2a), 0,0.1,0));
      v.armed.add(mesh(new T.ConeGeometry(0.18,0.4,6), M.flame, 0,0.35,0,false));
      v.sprung.add(mesh(new T.SphereGeometry(0.3,6,5), mat(0x555055), 0,0.3,0,false));
    } else if (s.sub==='ice'){
      v.armed.add(mesh(new T.ConeGeometry(0.35,1.2,5), M.ice, 0,0.6,0));
      for (var j=0;j<4;j++) v.sprung.add(mesh(new T.TetrahedronGeometry(0.2), M.ice, Math.cos(j*1.6)*0.45,0.15,Math.sin(j*1.6)*0.45));
    }
    v.icon=iconSprite('🔧','#ffe8c2');
  } else if (s.k==='chest'){
    var body=mesh(gBox(1.1,0.6,0.75), M.chest, 0,0.3,0); g.add(body);
    g.add(mesh(gBox(1.0,0.04,0.65), M.black, 0,0.6,0,false));
    [-0.36,0.36].forEach(function(z){ g.add(mesh(gBox(1.14,0.06,0.07), M.gold, 0,0.6,z*1.05,false)); });
    [-0.4,0.4].forEach(function(x){ g.add(mesh(gBox(0.08,0.62,0.79), M.gold, x,0.31,0,false)); });
    var lid=new T.Group(); lid.position.set(0,0.62,-0.375); lid.add(mesh(gBox(1.1,0.3,0.75), M.chestDark, 0,0.15,0.375)); g.add(lid); v.lid=lid;
    var gold=new T.Group(); var mound=mesh(new T.SphereGeometry(0.42,10,6,0,Math.PI*2,0,Math.PI/2), M.gold, 0,0.58,0,false); mound.scale.set(1.15,0.45,0.75); gold.add(mound); v.armed.add(gold);
    g.rotation.y = s.x>0? -Math.PI/2 : Math.PI/2;   // face the walkway
    v.icon=iconSprite('💰','#fff2b0');
  } else if (s.k==='door'){
    var pnl=gBox(1.45,1.8,0.14);
    var L=mesh(pnl, M.chest, 0.72,0.9,0), R2=mesh(pnl, M.chest, -0.72,0.9,0);
    var Lh=new T.Group(); Lh.position.x=-1.5; Lh.add(L); var Rh=new T.Group(); Rh.position.x=1.5; Rh.add(R2);
    Lh.rotation.y=1.3; Rh.rotation.y=-1.3; v.armed.add(Lh); v.armed.add(Rh);
    var b1=mesh(pnl, M.chestDark, -0.7,0.1,0.6); b1.rotation.set(-Math.PI/2,0,0.3); var b2=mesh(pnl, M.chestDark, 0.8,0.18,-0.5); b2.rotation.set(-Math.PI/2+0.2,0,-0.4); v.sprung.add(b1); v.sprung.add(b2);
    v.icon=iconSprite('🔨','#ffe8c2');
  }
  v.icon.position.set(0, 1.7, 0); g.add(v.icon); v.icon.scale.set(0.75,0.75,1);
  // coin heap next to the station (world-aligned, not rotated with chest)
  v.heap=new T.Group(); v.heap.position.set(s.x+(s.k==='chest'?(s.x>0?-0.2:0.2):0.95), 0, s.z+(s.k==='chest'?0.95:0.6)); world.add(v.heap);
  return v;
}
function setHeap(v, n){
  var k = n<=0?0: Math.min(14, 2+Math.floor(Math.sqrt(n)*1.6));
  if (k===v.coinN) return; v.coinN=k;
  while (v.heap.children.length) v.heap.remove(v.heap.children[0]);
  for (var i=0;i<k;i++){ var c=mesh(coinGeo, M.gold, ((i*37)%5-2)*0.08, 0.04+Math.floor(i/3)*0.06, ((i*53)%5-2)*0.08, false); c.rotation.y=i; v.heap.add(c); }
}
var slimeGeo=new T.CylinderGeometry(1,1,0.08,14), SLIME_COL=[0x7cff4f,0xff6ad5,0x58c8ff,0xffa83c];
var slimeMats=SLIME_COL.map(function(c){ return new T.MeshLambertMaterial({color:c, transparent:true, opacity:0.82, emissive:c, emissiveIntensity:0.12}); });
function slimeView(sl){
  var g=new T.Group(); g.position.set(sl.x,0.03,sl.z);
  g.add(mesh(slimeGeo, slimeMats[sl.c%4], 0,0,0,false)); g.children[0].scale.set(0.55*sl.sz,1,0.45*sl.sz);
  var b=mesh(slimeGeo, slimeMats[sl.c%4], 0.3*sl.sz,0,0.2,false); b.scale.set(0.3*sl.sz,1,0.28*sl.sz); g.add(b);
  g.add(mesh(new T.SphereGeometry(0.16,7,5), slimeMats[sl.c%4], -0.15,0.08,0.05,false));
  g.scale.setScalar(0.01); world.add(g);
  return {g:g, sl:sl, born:0};
}
function heroView(h){
  var c=makeChar(HERO_LOOK[h.kind]); c.position.set(h.x,0,h.z); c.rotation.y=Math.PI;
  var need=new T.Sprite(iconMat('🔧','#fff')); need.scale.set(1.15,1.15,1); need.renderOrder=12; need.visible=false; world.add(need);
  var em=new T.Sprite(iconMat('😀')); em.scale.set(0.8,0.8,1); em.visible=false; world.add(em);
  var ring=ringSprite(); ring.visible=false; ring.scale.set(1.5,1.5,1); ring.renderOrder=11;
  return {h:h, c:c, need:need, em:em, emT:0, ring:ring, lastP:-1, lastNeed:null};
}
function goblinView(g){
  var col={clean:0x3ec8e0, trap:0xff9a3c, carry:0xb07a42}[g.kind];
  var c=makeChar({body:0x5a8a3a, skin:0x7ed957, ears:1, hat:'cap', hatc:col, apron:col, mop:g.kind==='clean', scale:0.85, leg:0x3a2a1a});
  c.position.set(g.x,0,g.z);
  var z=new T.Sprite(iconMat('💤','#cfe8ff')); z.scale.set(0.7,0.7,1); z.position.y=2.3; z.visible=false; c.add(z);
  var stack=new T.Group(); c.add(stack);
  return {g:g, c:c, z:z, stack:stack, n:-1};
}
function padView(pd){
  var g=new T.Group(); g.position.set(pd.x,0.02,pd.z);
  var base=mesh(new T.PlaneGeometry(1.8,1.8), new T.MeshBasicMaterial({color:0x2a1a2e, transparent:true, opacity:0.6}), 0,0,0,false); base.rotation.x=-Math.PI/2; g.add(base);
  var fill=mesh(new T.PlaneGeometry(1.8,1.8), new T.MeshBasicMaterial({color:0xf5c542, transparent:true, opacity:0.6}), 0,0.005,0,false); fill.rotation.x=-Math.PI/2; g.add(fill);
  var brd=mesh(new T.RingGeometry(1.13,1.25,4,1), new T.MeshBasicMaterial({color:0xffe45c}), 0,0.01,0,false); brd.rotation.x=-Math.PI/2; brd.rotation.z=Math.PI/4; g.add(brd);
  var em={room:'🏰', clean:'🧽', trap:'🔧', carry:'💰', bench:'⬆️'}[pd.kind];
  var lab=makeLabel('', 256, 160, '#fff', null); lab.position.set(0,0.02,0); lab.rotation.x=-Math.PI/2; lab.scale.set(1.75,1.1,1); g.add(lab);
  var ic=iconSprite(em,'#fff'); ic.position.y=1.4; ic.scale.set(0.8,0.8,1); g.add(ic);
  world.add(g);
  var v={pd:pd, g:g, fill:fill, lab:lab, last:'', ic:ic};
  v.update=function(){
    var txt = pd.kind==='bench' ? '' : fmt(Math.ceil(pd.cost-pd.paid));
    if (txt!==v.last){ v.last=txt; var cv=lab.material.map.image, x=cv.getContext('2d'); x.clearRect(0,0,256,160);
      x.textAlign='center'; x.textBaseline='middle'; x.lineWidth=7; x.strokeStyle='#2a1a2e';
      var sub = pd.kind==='room'? tl('r_'+DJ.ROOMS[G.rooms].id) : pd.kind==='bench'? tl('benchTitle') : tl('g_'+pd.kind);
      x.font='900 30px "Trebuchet MS",system-ui'; x.strokeText(sub,128,txt?40:80); x.fillStyle='#fff'; x.fillText(sub,128,txt?40:80);
      if (txt){ x.font='900 58px "Trebuchet MS",system-ui'; x.strokeText('● '+txt,128,108); x.fillStyle='#ffe45c'; x.fillText('● '+txt,128,108); }
      lab.material.map.needsUpdate=true; }
    var p = pd.cost? pd.paid/pd.cost : 0; fill.scale.set(1, Math.max(0.001,p), 1); fill.position.z = 0.9-0.9*p;
  };
  v.update(); return v;
}
function fmt(n){ n=Math.floor(n); if(n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1)+'M'; if(n>=1e4) return (n/1e3).toFixed(n>=1e5?0:1)+'K'; return ''+n; }
function syncPads(){ padViews.forEach(function(v){ world.remove(v.g); }); padViews=G.pads.map(padView);
  var hasBench=G.pads.some(function(p){return p.kind==='bench';}); if (hasBench && !benchMesh) benchMesh=buildBench(); }
function syncPortal(){
  var p=DJ.W2(G.rooms-1, DJ.PORTAL[0], DJ.PORTAL[1]);
  if (!portal){ portal=new T.Group(); portal.add(mesh(new T.TorusGeometry(0.8,0.13,8,20), M.portal, 0,1.0,0,false));
    portal.add(mesh(new T.CircleGeometry(0.75,20), new T.MeshBasicMaterial({color:0x5a2a9a, transparent:true, opacity:0.6, side:T.DoubleSide}), 0,1.0,0,false)); world.add(portal); }
  portal.position.set(p.x,0,p.z);
}
function syncPiles(){ pileMeshes.forEach(function(m){ world.remove(m); }); pileMeshes=G.piles.map(function(p){ return makePile(p.x,p.z); }); }
function fullRebuild(){
  while(world.children.length) world.remove(world.children[0]);
  ringPool.forEach(function(r){ r.visible=false; });
  roomGroups=[]; torches=[]; views={st:{}, sl:{}, hr:{}, gb:{}}; pileMeshes=[]; padViews=[]; portal=null; benchMesh=null; wallGroup=new T.Group(); world.add(wallGroup);
  buildOutside();
  for (var r=0;r<G.rooms;r++) buildRoomStatic(r);
  buildWalls(); syncPiles(); syncPads(); syncPortal();
  G.st.forEach(function(s){ views.st[s.id]=stationView(s); });
  G.slimes.forEach(function(sl){ var v=slimeView(sl); v.born=1; v.g.scale.setScalar(1); views.sl[sl.id]=v; });
  G.goblins.forEach(function(g){ views.gb[g.id]=goblinView(g); });
  player=makeChar({body:0x3d7bd9, hat:'cap', hatc:0xffd84a, mop:1, leg:0x2b4a8a, scale:1.1}); player.rotation.y=Math.PI;
  sackStack=[];
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
  // top: next goal = next room
  var wv=$('wave');
  if (G.tut<4){ wv.style.display='none'; }
  else {
    wv.style.display='';
    var rp=G.pads.filter(function(p){return p.kind==='room';})[0];
    if (rp){ var have=Math.min(rp.cost, G.coins+rp.paid); $('waveTx').textContent=tl('goal',{r:tl('r_'+DJ.ROOMS[G.rooms].id)})+'  ● '+fmt(have)+' / '+fmt(rp.cost); $('waveBar').style.width=(have/rp.cost*100)+'%'; }
    else { $('waveTx').textContent=tl('allRooms'); $('waveBar').style.width='100%'; }
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
  [['boots','👢'],['mop','🧽'],['bag','🎒'],['gob','☕']].forEach(function(a){
    var k=a[0], u=DJ.UPG[k], lv=G.upg[k];
    if (k==='gob' && G.goblins.length===0) return;
    var r=document.createElement('div'); r.className='row';
    var dots=''; for (var i=0;i<u.max;i++) dots+= i<lv?'●':'○';
    var desc = k==='bag'? tl('bagD',{n:DJ.bagCap(G)+(lv<u.max?' → '+(DJ.bagCap(G)+2):'')}) : tl(k+'D');
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
var tutT=0, slimeHinted=false;
function firstSt(k, ok){ return G.st.filter(function(s){ return s.r===0 && s.k===k && (ok===undefined || s.ok===ok); })[0]; }
function tutTarget(){
  var t=G.tut;
  if (t===0){ var tr=firstSt('trap'); return {x:tr.x,z:tr.z,txt:tl('t0')+'\n'+(TOUCH?tl('move_touch'):tl('move_kb'))}; }
  if (t===1){ var s=G.st.filter(function(s){return s.coins>0;})[0]; return s? {x:views.st[s.id].heap.position.x, z:views.st[s.id].heap.position.z, txt:tl('t1')} : {txt:tl('t1')}; }
  if (t===2){ var p=G.piles[0]; return {x:p.x,z:p.z,txt:tl('t2')}; }
  if (t===3){ var c=firstSt('chest'); return {x:c.x,z:c.z,txt:tl('t3')}; }
  if (t===4) return {txt:tl('t4')};
  if (t===5){ var pd=G.pads.filter(function(p){return p.kind==='room';})[0]; if(pd && G.coins+pd.paid>=pd.cost) return {x:pd.x,z:pd.z,txt:tl('t6')}; return null; }
  if (t===6){ var hp=G.pads.filter(function(p){return p.kind==='clean';})[0]; if(hp && G.coins+hp.paid>=hp.cost) return {x:hp.x,z:hp.z,txt:tl('t7')}; return null; }
  if (t===7){ var b=G.pads.filter(function(p){return p.kind==='bench';})[0]; return b?{x:b.x,z:b.z,txt:tl('t8')}:null; }
  return null;
}
function stepTut(dt){
  var t=G.tut, tr, ch;
  if (t===0){ tr=firstSt('trap'); if (tr.ok) G.tut=1; }
  else if (t===1){ if (G.coins>0 && G.st.every(function(s){return s.coins<=0;})) G.tut=2; }
  else if (t===2){ if (G.player.carry>0) G.tut=3; }
  else if (t===3){ ch=firstSt('chest'); if (ch.ok){ G.tut=4; tutT=0; G.flow=true; G.spawnT=3; DJ.makePads(G); syncPads(); } }
  else if (t===4){ tutT+=dt; if (tutT>9) G.tut=5; }
  else if (t===5){ if (G.rooms>=2){ G.tut=6; DJ.makePads(G); syncPads(); } }
  else if (t===6){ if (G.goblins.length>0){ G.tut=7; tutT=0; } }
  else if (t===7){ tutT+=dt; if (benchOpen || tutT>12) G.tut=99; }
  var tg = G.tut<99 ? tutTarget() : null;
  setTut(tg? tg.txt : '');
  if (tg && tg.x!==undefined){
    arrow3d.visible=!(G.tut===0||G.tut===3); arrow3d.position.set(tg.x, 2.4+Math.sin(performance.now()/180)*0.25, tg.z);
    var dx=tg.x-G.player.x, dz=tg.z-G.player.z, d=Math.hypot(dx,dz);
    floorArrow.visible = d>2.6; floorArrow.position.set(G.player.x,0,G.player.z); floorArrow.rotation.y=Math.atan2(-dx,-dz);
  } else { arrow3d.visible=false; floorArrow.visible=false; }
}
function setupTutorial(){
  firstSt('trap').ok=false; firstSt('chest').ok=false;
  var h=DJ.spawnHero(G,{kind:'knight'}); h.z=1.0;
}

// ---------------- events ----------------
var NEED_ICON={trap:'🔧', chest:'💰', door:'🔨'};
function handleEvents(){
  var ev=G.ev; G.ev=[];
  ev.forEach(function(e){
    switch(e.t){
      case 'coin': coinFly(e.n, e.x, e.z); if (e.why!=='pick') floatText('+'+fmt(e.n), e.x, 1.6, e.z); break;
      case 'drop': var dv=views.st[e.id]; if(dv){ dv.heapPop=0.35; floatText('+'+fmt(e.n), dv.heap.position.x, 1.3, dv.heap.position.z, '#ffe45c', true); coinBurst(dv.s.x, dv.s.z, dv.heap.position.x, dv.heap.position.z); } Snd.coin(); break;
      case 'room': if (roomGroups.length && !roomGroups[e.r]){ buildRoomStatic(e.r); G.st.forEach(function(s){ if(s.r===e.r && !views.st[s.id]) views.st[s.id]=stationView(s); }); syncPiles(); } break;
      case 'buy':
        if (e.kind==='room'){ buildWalls(); syncPads(); syncPortal(); Snd.buy(); banner(tl('newRoom'), tl('r_'+DJ.ROOMS[e.r].id)); PF.happy(); saveNow(); setTimeout(function(){ PF.midgame(); }, 1600); }
        else if (e.kind!=='upg'){ G.goblins.forEach(function(g){ if(!views.gb[g.id]) views.gb[g.id]=goblinView(g); }); syncPads(); Snd.buy(); banner(tl('hired'), tl('g_'+e.kind)); saveNow(); }
        break;
      case 'padpay': if(Math.random()<0.3) Snd.pay(); break;
      case 'slime': var sl=G.slimes.filter(function(s){return s.id===e.id;})[0]; if(sl){ views.sl[sl.id]=slimeView(sl); if(!slimeHinted && G.tut>=4){ slimeHinted=true; banner(tl('slimeHint'),'',2600); } } break;
      case 'clean': var v=views.sl[e.id]; if(v){ world.remove(v.g); delete views.sl[e.id]; } Snd.squish(); puff(e.x,e.z,0x9fffd0); break;
      case 'fixed': var sv=views.st[e.id]; if(sv) sv.shake=0.3; if(e.k==='chest') Snd.fill(); else Snd.clank(); if(e.who==='p') puff(sv.s.x, sv.s.z, 0xfff3a0); break;
      case 'spring': var s2=views.st[e.id]; if(s2) s2.shake=0.4; Snd.spring(); var hv=views.hr[e.hid]; if(hv) hv.bonk=0.5; break;
      case 'loot': var s3=views.st[e.id]; if(s3) s3.shake=0.3; break;
      case 'take': Snd.take(); break;
      case 'hero': if (e.boss){ Snd.boss(); banner(tl('bossWave'), tl('bossD2'), 3000); } break;
      case 'emo': var pv=views.hr[e.id]; if(pv){ pv.em.material=iconMat({happy:'😄',ouch:'😵',slip:'😵‍💫',meh:'😒',angry:'😡'}[e.e]||'😀'); pv.em.visible=true; pv.emT=1.3; } break;
      case 'slip': var sv2=views.hr[e.id]; if(sv2){ sv2.slip=0.9; } Snd.squish(); break;
      case 'angry': var av=views.hr[e.id]; if(av) floatText(tl('angry'), av.c.position.x, 2.6, av.c.position.z, '#ff8a7a'); Snd.bad(); break;
      case 'exit': var xv=views.hr[e.id]; if(xv){ floatText('★'.repeat(e.stars), xv.c.position.x, 2.8, xv.c.position.z, '#ffd84a'); puff(xv.c.position.x, xv.c.position.z, 0xb27cff);
          world.remove(xv.c); world.remove(xv.need); world.remove(xv.em); scene.remove(xv.ring); delete views.hr[e.id]; } break;
      case 'wake': Snd.pop(); break;
    }
  });
}
var puffs=[], puffGeo=new T.SphereGeometry(0.16,6,4);
function puff(x,z,col){
  for (var i=0;i<7;i++){ var m=mesh(puffGeo, new T.MeshBasicMaterial({color:col, transparent:true}), x,0.4,z,false); var a=i/7*Math.PI*2;
    m.userData.v=[Math.cos(a)*2.2, 2+Math.random()*2, Math.sin(a)*2.2]; m.userData.t=0.6; world.add(m); puffs.push(m); }
}
var arcs=[];
function coinBurst(x0,z0,x1,z1){
  for (var i=0;i<4;i++){ var m=mesh(coinGeo, M.gold, x0,0.8,z0,false); m.userData={x0:x0,z0:z0,x1:x1+(Math.random()-0.5)*0.4,z1:z1+(Math.random()-0.5)*0.4,t:-i*0.06}; world.add(m); arcs.push(m); }
}

// ---------------- frame ----------------
var last=performance.now(), acc=0, saveT=0, lightT=0, ipmT=0, ipmEarn=0;
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
}
function render(dt){
  var p=G.player, t=performance.now()/1000;
  player.position.set(p.x,0,p.z);
  player.rotation.y += angDiff(player.rotation.y, p.face)*Math.min(1,dt*14);
  animChar(player, p.moving, dt, p.working);
  while (sackStack.length<p.carry){ var sk=makeSack(); sk.scale.setScalar(0.62); player.add(sk); sackStack.push(sk); }
  while (sackStack.length>p.carry){ player.remove(sackStack.pop()); }
  sackStack.forEach(function(s,i){ s.position.set(0, 1.0+i*0.36, -0.42); s.rotation.y=Math.sin(t*3+i)*0.1*(p.moving?1:0.2); });
  var ringI=0;
  Object.keys(views.st).forEach(function(id){ var v=views.st[id], s=v.s;
    v.armed.visible=s.ok; v.sprung.visible=!s.ok;
    if (v.lid) v.lid.rotation.x += ((s.ok?0:-1.9)-v.lid.rotation.x)*Math.min(1,dt*8);
    v.icon.visible=!s.ok && !(s.busy && G.heroes.some(function(h){return h.id===s.busy && h.state==='wait';})); v.icon.position.y=1.7+Math.sin(t*4+s.id)*0.1;
    if (s.k==='chest' && !s.ok) v.icon.material = iconMat(p.carry>0?'💰':'👜', p.carry>0?'#fff2b0':'#ffd0c8');
    if (v.shake>0){ v.shake-=dt; v.g.scale.setScalar(1+Math.sin(v.shake*40)*v.shake*0.4); } else v.g.scale.setScalar(1);
    setHeap(v, s.coins);
    if (v.heapPop>0){ v.heapPop-=dt; v.heap.scale.setScalar(1+v.heapPop); } else v.heap.scale.setScalar(1);
    if (s.prog>0 && ringI<ringPool.length){ var r=ringPool[ringI++]; r.visible=true; r.position.set(s.x,2.3,s.z); r.userData.draw(s.prog, RING_COL[s.k]); }
    if (s.sub==='fire' && s.ok) v.armed.children[1].scale.y=1+Math.sin(t*12+s.id)*0.25;
  });
  Object.keys(views.sl).forEach(function(id){ var v=views.sl[id], sl=v.sl;
    if (v.born<1){ v.born=Math.min(1, v.born+dt*3); }
    var k=v.born*(1-sl.prog*0.6); v.g.scale.set(k*(1+Math.sin(t*3+sl.id)*0.05), 1, k*(1-Math.sin(t*3+sl.id)*0.05));
    if (sl.prog>0 && ringI<ringPool.length){ var r=ringPool[ringI++]; r.visible=true; r.position.set(sl.x,1.5,sl.z); r.userData.draw(sl.prog, RING_COL.slime); }
  });
  for (var i=ringI;i<ringPool.length;i++) ringPool[i].visible=false;
  // heroes
  G.heroes.forEach(function(h){ if(!views.hr[h.id]) views.hr[h.id]=heroView(h); });
  Object.keys(views.hr).forEach(function(id){ var v=views.hr[id], h=v.h, c=v.c;
    var mv = Math.hypot(h.x-c.position.x, h.z-c.position.z) > 0.002;
    c.position.set(h.x,0,h.z);
    if (v.slip>0){ v.slip-=dt; c.rotation.y+=dt*16; c.userData.inner.rotation.x=-0.5; }
    else { c.userData.inner.rotation.x=0; c.rotation.y += angDiff(c.rotation.y, h.state==='wait'?0:h.face)*Math.min(1,dt*10); }
    animChar(c, mv && h.state==='walk', dt, false);
    if (v.bonk>0){ v.bonk-=dt; c.userData.inner.position.y=Math.sin(v.bonk*12)*0.25+0.1; }
    var top=(h.boss?2.9:2.15);
    if (h.state==='wait' && h.need){
      if (v.lastNeed!==h.need){ v.lastNeed=h.need; v.need.material=iconMat(NEED_ICON[h.need]||'❗', '#ffffff'); }
      v.need.visible=true; v.need.position.set(h.x, top+0.55+Math.abs(Math.sin(t*5))*0.18, h.z);
      var pr=Math.max(0,h.pat/DJ.PATIENCE); v.ring.visible=true; v.ring.position.set(h.x, top+0.55, h.z);
      var key=Math.round(pr*40); if (key!==v.lastP){ v.lastP=key; v.ring.userData.draw(pr, pr>0.5?'#7ee06a':(pr>0.25?'#ffc23a':'#ff5a4a')); }
      v.em.visible=false;
    } else { v.need.visible=false; v.ring.visible=false; v.lastNeed=null;
      v.em.position.set(h.x, top+0.4, h.z); if (v.emT>0){ v.emT-=dt; if(v.emT<=0) v.em.visible=false; } }
  });
  G.goblins.forEach(function(g){ var v=views.gb[g.id]; if(!v) return;
    v.c.position.set(g.x,0,g.z); v.c.rotation.y += angDiff(v.c.rotation.y, g.face)*Math.min(1,dt*10);
    animChar(v.c, g.moving&&g.sleep<=0, dt, g.working);
    v.z.visible=g.sleep>0; if (g.sleep>0){ v.z.position.y=2.3+Math.sin(t*3)*0.15; v.c.userData.inner.rotation.z=0.25; }
    if (v.n!==g.carry){ v.n=g.carry; while(v.stack.children.length) v.stack.remove(v.stack.children[0]); for (var k=0;k<g.carry;k++){ var s=makeSack(); s.scale.setScalar(0.55); s.position.set(0,1.0+k*0.34,-0.4); v.stack.add(s); } }
  });
  padViews.forEach(function(v){ v.update(); v.ic.position.y=1.4+Math.sin(t*3)*0.12; });
  if (portal){ portal.children[0].rotation.z+=dt*2; portal.children[1].material.opacity=0.45+Math.sin(t*4)*0.15; }
  for (var j=puffs.length-1;j>=0;j--){ var m=puffs[j], u=m.userData; u.t-=dt; m.position.x+=u.v[0]*dt; m.position.y+=u.v[1]*dt; m.position.z+=u.v[2]*dt; u.v[1]-=6*dt; m.material.opacity=Math.max(0,u.t/0.6); if(u.t<=0){ world.remove(m); puffs.splice(j,1);} }
  for (var a=arcs.length-1;a>=0;a--){ var cm=arcs[a], ud=cm.userData; ud.t+=dt; var k2=Math.max(0,Math.min(1,ud.t/0.45));
    cm.position.set(ud.x0+(ud.x1-ud.x0)*k2, 0.8+Math.sin(k2*Math.PI)*1.4-0.7*k2, ud.z0+(ud.z1-ud.z0)*k2); cm.rotation.x+=dt*12; if(ud.t>=0.45){ world.remove(cm); arcs.splice(a,1);} }
  lightT-=dt;
  if (lightT<=0){ lightT=0.5; var sorted=torches.slice().sort(function(a,b){ return Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z); });
    torchLights.forEach(function(L,i){ var tt=sorted[i]; if(tt){ L.position.set(tt.x,2.3,tt.z); L.userData.t=tt; } else L.userData.t=null; }); }
  torchLights.forEach(function(L){ var tt=L.userData.t; L.intensity = tt? 8+Math.sin(t*9+tt.ph)*1.5+Math.sin(t*23+tt.ph)*0.8 : 0; });
  torches.forEach(function(tt){ tt.fl.scale.y=1+Math.sin(t*10+tt.ph)*0.15; });
  var portrait = innerHeight>innerWidth*1.1;
  var cy = portrait? 17:11, cz = portrait? 10.5:8.2;
  camGoal.set(p.x*0.6, cy, p.z+cz);
  camera.position.lerp(camGoal, Math.min(1, dt*5));
  camera.lookAt(camera.position.x, 0, camera.position.z-cz-0.8);
  sun.position.set(p.x+6, 18, p.z+8); sun.target.position.set(p.x,0,p.z-2);
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
    if (fps<40 && QUAL>-1 && !document.hidden){ setQual(QUAL-1); perfWarm=1.5; }
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
function saveNow(){ if(!G) return; PF.saveData('dj_save_v2', DJ.save(G)); PF.saveData('dj_seen', ''+Date.now()); }
document.addEventListener('visibilitychange', function(){ if(document.hidden) saveNow(); });
addEventListener('pagehide', saveNow);
function checkOffline(){
  var seen=+(PF.loadData('dj_seen')||0); if (!seen || G.goblins.length===0) return;
  var mins=Math.min(120, (Date.now()-seen)/60000); if (mins<2) return;
  var amt=Math.round(mins*(G.ipm||0)*0.25); if (amt<10) return;
  $('offAmt').textContent='● '+fmt(amt);
  var dbl=$('offDouble'); dbl.textContent=tl('double'); dbl.disabled=false;
  var close=function(n){ $('offline').classList.remove('show'); DJ.pay(G, n, G.player.x, G.player.z, 'offline'); saveNow(); };
  $('offTake').onclick=function(){ close(amt); };
  dbl.onclick=function(){ dbl.disabled=true; PF.rewarded(function(ok){ if(ok) close(amt*2); else dbl.disabled=false; }); };
  $('offline').classList.add('show');
}

// ---------------- boot ----------------
function boot(){
  LANG=detectLang(PF.locale); applyLang();
  var s=PF.loadData('dj_save_v2');
  if (QS.has('reset')) s=null;
  try{ G = s? DJ.load(s) : null; }catch(e){ G=null; }
  var fresh=!G;
  if (!G){ G=DJ.newGame(Date.now()%100000); }
  else { G.flow = G.tut>=4; if (G.tut<4){ G=DJ.newGame(Date.now()%100000); fresh=true; } }
  if (fresh) setupTutorial();
  G.ev=[];
  fullRebuild(); resize();
  camera.position.set(G.player.x*0.6, 11, G.player.z+8.2);
  $('loading').style.display='none';
  PF.loaded();
  checkOffline();
  if (DEBUG){ window.__PF=PF; window.__Snd=Snd; window.__G=G; window.__DJ=DJ; window.__step=function(sec,ix,iz){ for(var i=0;i<sec*60;i++){ DJ.step(G,1/60,ix||0,iz||0); stepTut(1/60);} }; window.__cam=camera; window.__ri=renderer.info; window.__scene=scene; window.__R=renderer; window.__sun=sun; window.__tl=torchLights; window.__T=T; }
  requestAnimationFrame(function(n){ last=n; frame(n); });
}
PF.init().then(boot, boot);
})();
// ===== GAME END =====
