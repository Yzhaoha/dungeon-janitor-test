// ===== SIM START =====
// v0.3 — Dungeon Tavern: heroes sit down and order 🍺 / 🍖, you pour / grab, serve, pick up coins, wipe tables.
// Pure logic (node can run it), events go to G.ev.
var DJ = (function(){
'use strict';
var W = 12, D = 10;
// tables [x, z]; table 0 is the tutorial table next to the keg
var TABLES = [[-3.4,-5.2],[0,-5.2],[-3.4,-2.4],[3.4,-5.2],[0,-2.4],[3.4,-2.4]];
var KEG = {x:-3.6, z:-8.7, fx:-3.6, fz:-7.5};
var GRILL = {x:0, z:-8.7, fx:0, fz:-7.5};
var POT = {x:3.6, z:-8.7};             // potion cauldron: locked teaser for now
var TRASH = {x:5.15, z:-7.3};
var PADS = {bench:[-4.5,-0.95], hire:[4.5,-0.95]};
var PRICE = {beer:4, meat:9};
var POUR = 0.45, TAKE = 0.2, COOK = 4.0, EAT = 2.6, WIPE = 0.8, PATIENCE = 22, QPAT = 30;
var GRILL_MAX = 3;
var UNL = [
  {k:'table', i:1, c:20}, {k:'grill', c:45}, {k:'table', i:2, c:70}, {k:'wiper', c:130},
  {k:'table', i:3, c:220}, {k:'table', i:4, c:340}, {k:'waiter', c:500}, {k:'table', i:5, c:750},
  {k:'wiper', c:1000}, {k:'waiter', c:1400}
];
var UPG = {
  boots:{max:5, cost:[40,120,320,800,1800]},
  tray: {max:5, cost:[30,100,280,700,1600]},
  grill:{max:4, cost:[80,240,650,1500]},
  gob:  {max:3, cost:[220,700,1600]}
};
var HERO_SPEED = 2.6, BOSS_EVERY = 20;
var KINDS = ['knight','archer','mage','rogue'];
// ---------- nights + perk cards ----------
var NIGHT_LEN = 90, CLOSE_T = 2.5;
var CARDS = { beer:{max:5}, meat:{max:5}, pat:{max:3}, tip:{max:3}, hands:{max:3}, vip:{max:3}, clean:{max:3}, again:{max:3}, crowd:{max:3}, gold:{max:99} };
function cl(G,k){ return G.cards[k]||0; }
// goals sit at ~35% of what the bot earns that night; 3 stars (x1.8) needs ~65%
function nightGoal(n){ return Math.round((30+28*(Math.min(n,14)-1))*Math.pow(1.06, Math.max(0,n-14))/5)*5; }
function price(G,f){ return PRICE[f] + (f==='beer'?2:4)*cl(G,f); }
function patience(G){ return PATIENCE*(1+0.2*cl(G,'pat')); }
function starsFor(e,g){ return e>=g*1.8?3 : e>=g*1.4?2 : e>=g?1 : 0; }
function startNight(G){ var N=G.night; N.t=0; N.earned=0; N.goal=nightGoal(N.n); N.phase='open'; N.warned=false; G.flow=true; G.spawnT=1.0; G.ev.push({t:'nightStart', n:N.n, goal:N.goal}); }
function closeNight(G){
  var N=G.night; N.phase='closing'; N.ct=CLOSE_T; G.flow=false;
  G.heroes.slice().forEach(function(h){ if (h.state==='leave') return;
    if (h.state==='eat'){ var t=G.tables[h.tbl]; pay(G, price(G,t.food)*(h.boss?5:1), t.x, t.z, t); }
    h.sat=Math.max(h.sat,60); leave(G,h,true,true); });
  G.tables.forEach(function(t){ t.dirty=false; t.prog=0; t.food=null; if (t.coins>0) collect(G,t); });
  G.player.items=[]; G.goblins.forEach(function(g){ g.items=[]; g.task=null; });
  G.ev.push({t:'nightClose'});
}
function offerCards(G){
  var pool=Object.keys(CARDS).filter(function(k){ if (k==='meat'&&!G.grill.on) return false; return cl(G,k)<CARDS[k].max; });
  var out=[]; while(out.length<3 && pool.length){ out.push(pool.splice(Math.floor(G.rand()*pool.length),1)[0]); }
  return out;
}
function goldAmt(G){ return Math.round(G.night.goal*0.5/5)*5; }
// after the result screen: card = perk key or null (failed night -> same night again)
function nextNight(G, card){
  var N=G.night; if (N.phase!=='result') return;
  if (card){ if (card==='gold'){ var a=goldAmt(G); G.coins+=a; G.earned+=a; } G.cards[card]=cl(G,card)+1; }
  if (N.stars>0){ N.n++; if (N.n-1>G.bestNight) G.bestNight=N.n-1; }
  startNight(G);
}
function stepNight(G,dt){
  var N=G.night;
  if (N.phase==='idle'){ startNight(G); return; }
  if (N.phase==='open'){ N.t+=dt;
    if (!N.warned && N.t>=NIGHT_LEN-12){ N.warned=true; G.ev.push({t:'lastCall'}); }
    if (N.t>=NIGHT_LEN) closeNight(G); return; }
  if (N.phase==='closing'){ N.ct-=dt; if (N.ct<=0){ N.phase='result'; N.stars=starsFor(N.earned,N.goal);
    N.bonus = N.stars? Math.round(N.goal*0.1*N.stars) : 0; G.coins+=N.bonus; G.earned+=N.bonus;
    G.stats.nights.push([N.n, Math.round(N.earned), N.goal, N.stars]);
    G.ev.push({t:'nightResult', n:N.n, stars:N.stars, earned:Math.round(N.earned), goal:N.goal, bonus:N.bonus}); } }
}


function rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function dist(a,b){ var dx=a.x-b.x, dz=a.z-b.z; return Math.sqrt(dx*dx+dz*dz); }

function newGame(seed){
  var G = { t:0, rand:rnd(seed||12345), ev:[], coins:0, earned:0, rep:3, unl:0, padPaid:{},
    upg:{boots:0,tray:0,grill:0,gob:0}, tables:[], heroes:[], goblins:[], pads:[], nid:1,
    grill:{on:false, ready:0, t:0},
    player:{x:0, z:-1.2, items:[], face:Math.PI, moving:false},
    spawnT:2, heroCount:0, flow:false, boost:0, tut:0, paused:false, cards:{}, bestNight:0,
    night:{n:1, t:0, earned:0, goal:0, phase:'idle', stars:0, bonus:0},
    stats:{unlAt:[], served:0, angry:0, nights:[]} };
  TABLES.forEach(function(p,i){ G.tables.push({i:i, x:p[0], z:p[1], on:i===0, dirty:false, prog:0, coins:0, hero:null, food:null}); });
  makePads(G);
  return G;
}
function seatOf(t){ return {x:t.x, z:t.z-0.95}; }
function frontOf(t){ return {x:t.x, z:t.z+1.0}; }
function aisle(t){ return t.x>=0 ? t.x+1.7 : t.x-1.7; }

// ---------- unlocks / pads ----------
function unlPos(u){
  if (u.k==='table'){ var p=TABLES[u.i]; return {x:p[0], z:p[1]-0.3}; }
  if (u.k==='grill') return {x:GRILL.fx, z:GRILL.fz+0.3};
  return {x:PADS.hire[0], z:PADS.hire[1]};
}
function makePads(G){
  G.pads=[];
  if (G.tut>=4 && G.unl<UNL.length){ var u=UNL[G.unl], p=unlPos(u); G.pads.push({kind:u.k, u:u, x:p.x, z:p.z, cost:u.c, paid:Math.min(u.c-1, G.padPaid.next||0)}); }
  if (G.tut>=7) G.pads.push({kind:'bench', x:PADS.bench[0], z:PADS.bench[1], cost:0, paid:0});
}
function applyUnlock(G, u, silent){
  if (u.k==='table'){ G.tables[u.i].on=true; }
  else if (u.k==='grill'){ G.grill.on=true; }
  else addGoblin(G, u.k);
  if (!silent) G.ev.push({t:'buy', kind:u.k, i:u.i});
}
function buyPad(G, pd){
  G.padPaid.next=0;
  applyUnlock(G, pd.u); G.unl++; G.stats.unlAt.push(G.t);
  makePads(G);
}

// ---------- heroes ----------
function freeTable(G){
  var c=G.tables.filter(function(t){ return t.on && !t.dirty && !t.hero; });
  return c.length ? c[Math.floor(G.rand()*c.length)] : null;
}
function seatPath(h, t){
  var a=aisle(t), s=seatOf(t), pts=[];
  if (h.z>-0.2) pts.push({x:0, z:0.3});
  pts.push({x:a, z:Math.min(-0.8, h.z>-0.2?-0.8:h.z)}, {x:a, z:s.z}, {x:s.x, z:s.z});
  return pts;
}
function maxHeroes(G){ return G.tables.filter(function(t){return t.on;}).length + 2 + cl(G,'crowd'); }
function spawnGap(G){
  var n=G.tables.filter(function(t){return t.on;}).length;
  return Math.max(1.6, (7.5 - n*0.8 - (G.rep-3)*0.7) * (1-0.12*cl(G,'crowd')) * Math.max(0.6, 1-0.03*(G.night.n-1)));
}
function pickWant(G){ return (G.grill.on && G.rand()<0.5) ? 'meat' : 'beer'; }
function spawnHero(G, opt){
  opt=opt||{};
  G.heroCount++;
  var boss = opt.boss || (G.heroCount>4 && G.heroCount%(BOSS_EVERY-4*cl(G,'vip'))===0);
  var h={id:G.nid++, kind:boss?'king':(opt.kind||KINDS[Math.floor(G.rand()*4)]), boss:boss, x:(G.rand()-0.5)*1.2, z:3.6,
    path:[], pi:0, state:'walk', tbl:null, want:null, pat:QPAT, sat:70, eatT:0, face:Math.PI, orders:boss?2:1};
  G.heroes.push(h); G.ev.push({t:'hero', id:h.id, boss:boss});
  if (opt.table){ seat(G,h,opt.table); } else { var t=freeTable(G); if (t) seat(G,h,t); else queue(G,h); }
  return h;
}
function seat(G,h,t){ t.hero=h.id; h.tbl=t.i; h.path=seatPath(h,t); h.pi=0; h.state='walk'; }
function queue(G,h){ h.state='queue'; h.tbl=null; h.pat=QPAT; }
function queuePos(G,h){ var q=G.heroes.filter(function(o){return o.state==='queue';}); var i=q.indexOf(h); return {x:-0.6+(i%2)*1.2, z:1.4+Math.floor(i/2)*1.0}; }
function emo(G,h,e){ G.ev.push({t:'emo', id:h.id, e:e}); }
function walk(h, dt){
  var tg=h.path[h.pi]; if (!tg) return true;
  var dx=tg.x-h.x, dz=tg.z-h.z, d=Math.sqrt(dx*dx+dz*dz), sp=HERO_SPEED*(h.boss?0.85:1)*dt;
  if (d<=sp){ h.x=tg.x; h.z=tg.z; h.pi++; return h.pi>=h.path.length; }
  h.x+=dx/d*sp; h.z+=dz/d*sp; h.face=Math.atan2(dx,dz); return false;
}
function order(G,h){
  h.want = h.boss ? (h.orders===2?'beer':(G.grill.on?'meat':'beer')) : pickWant(G);
  h.state='wait'; h.pat0=patience(G); h.pat=h.pat0*(h.boss?0.8:1); h.face=0;
  G.ev.push({t:'order', id:h.id, want:h.want});
}
function leave(G,h,angry,quiet){
  var t=h.tbl!==null? G.tables[h.tbl] : null;
  var pts=[];
  if (t){ var a=aisle(t), s=seatOf(t); pts.push({x:a, z:s.z}, {x:a, z:-0.8}); }
  pts.push({x:0, z:0.3}, {x:(G.rand()-0.5)*2, z:4.2});
  h.path=pts; h.pi=0; h.state='leave'; h.want=null;
  if (t){ t.hero=null; t.food=null; if (!angry && !(G.rand()<0.25*cl(G,'clean'))) t.dirty=true; }
  h.tbl=null;
  h.sat=Math.max(0,Math.min(100,h.sat));
  var stars=Math.max(1,Math.min(5,Math.round(h.sat/20)));
  if (!quiet) G.rep=G.rep*0.85+stars*0.15;
  G.ev.push({t:'exit', id:h.id, stars:stars, angry:!!angry, quiet:!!quiet});
}
function stepHero(G,h,dt){
  var tutWait = G.tut<3;
  if (h.state==='queue'){
    var t=freeTable(G); var q=G.heroes.filter(function(o){return o.state==='queue';});
    if (t && q[0]===h){ seat(G,h,t); return; }
    var p=queuePos(G,h); var dx=p.x-h.x, dz=p.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if (d>0.05){ var m=Math.min(d,HERO_SPEED*dt); h.x+=dx/d*m; h.z+=dz/d*m; h.face=Math.atan2(dx,dz); h.moving=true; } else { h.moving=false; h.face=0; }
    if (!tutWait){ h.pat-=dt; if (h.pat<=0){ h.sat-=40; emo(G,h,'angry'); G.ev.push({t:'angry', id:h.id}); G.stats.angry++; leave(G,h,true); } }
    return;
  }
  if (h.state==='walk'){ h.moving=true; if (walk(h,dt)){ h.moving=false; order(G,h); } return; }
  if (h.state==='leave'){ h.moving=true; if (walk(h,dt)){ G.heroes.splice(G.heroes.indexOf(h),1); G.ev.push({t:'gone', id:h.id}); } return; }
  h.moving=false;
  if (h.state==='wait'){
    if (!tutWait) h.pat-=dt;
    if (h.pat<=0){ h.sat-=35; emo(G,h,'angry'); G.ev.push({t:'angry', id:h.id}); G.stats.angry++; leave(G,h,true); }
    return;
  }
  if (h.state==='eat'){
    h.eatT-=dt;
    if (h.eatT<=0){
      var t2=G.tables[h.tbl];
      var tip = (h.patAt>0.6 ? 2 : (h.patAt>0.3 ? 1 : 0)) * (1+cl(G,'tip'));
      var amt = (price(G,t2.food)+tip) * (h.boss?5:1);
      pay(G, amt, t2.x, t2.z, t2);
      t2.food=null; h.orders--;
      if (h.orders>0 || (!h.boss && G.tut>=4 && G.night.phase==='open' && G.rand()<0.25+0.15*cl(G,'again'))){ if(h.orders<=0) h.orders=1; order(G,h); emo(G,h,'more'); }
      else leave(G,h,false);
    }
  }
}
function serve(G,h,who){
  var t=G.tables[h.tbl];
  h.patAt=h.pat/(h.pat0||PATIENCE); h.sat+= h.patAt>0.5?15:5;
  t.food=h.want; h.state='eat'; h.eatT=EAT; h.want=null;
  G.stats.served++;
  G.ev.push({t:'serve', id:h.id, tbl:t.i, food:t.food, who:who}); emo(G,h,'happy');
}
function pay(G, amt, x, z, tbl){
  amt=Math.max(1, Math.round(amt*(G.boostMoney>0?2:1)));
  if (tbl && G.night.phase!=='result') G.night.earned+=amt;
  if (tbl){ tbl.coins+=amt; G.ev.push({t:'drop', tbl:tbl.i, n:amt, x:x, z:z}); }
  else { G.coins+=amt; G.earned+=amt; G.ev.push({t:'coin', n:amt, x:x, z:z}); }
  return amt;
}
function collect(G,t){ if (t.coins<=0) return; var n=Math.round(t.coins); t.coins=0; G.coins+=n; G.earned+=n; G.ev.push({t:'coin', n:n, x:t.x, z:t.z, why:'pick'}); }

// ---------- player ----------
function trayCap(G){ return 2+G.upg.tray; }
function playerSpeed(G){ return 5.0*(1+0.1*G.upg.boots)*(G.boost>0?1.35:1); }
function workSpeed(G, who){ var b=G.boost>0?1.5:1; return who==='p' ? b*(1+0.3*cl(G,'hands')) : 0.6*(1+0.25*G.upg.gob)*b; }
function clampPos(G,p){
  p.x=Math.max(-W/2+0.5, Math.min(W/2-0.5, p.x));
  p.z=Math.min(-0.4, Math.max(-7.8, p.z));
  G.tables.forEach(function(t){ if(!t.on) return;
    var cx=t.x, cz=t.z-0.32, hx=0.8+0.35, hz=0.92+0.35, dx=p.x-cx, dz=p.z-cz;
    if (Math.abs(dx)<hx && Math.abs(dz)<hz){ if (hx-Math.abs(dx) < hz-Math.abs(dz)) p.x=cx+(dx<0?-hx:hx); else p.z=cz+(dz<0?-hz:hz); } });
}
function nearKeg(w){ return Math.abs(w.x-KEG.fx)<1.1 && w.z<-6.6; }
function nearGrill(w){ return Math.abs(w.x-GRILL.fx)<1.1 && w.z<-6.6; }
function serveNear(G, w, who){
  if (!w.items.length) return false;
  for (var i=0;i<G.heroes.length;i++){ var h=G.heroes[i]; if (h.state!=='wait') continue;
    var t=G.tables[h.tbl]; if (dist(w,t)>1.75) continue;
    var k=w.items.lastIndexOf(h.want); if (k<0) continue;
    w.items.splice(k,1); serve(G,h,who); return true; }
  return false;
}
function wipeNear(G, w, who, dt){
  var best=null, bd=1.75;
  G.tables.forEach(function(t){ if(!t.on||!t.dirty) return; var d=dist(w,t); if(d<bd){bd=d;best=t;} });
  if (!best) return false;
  best.prog+=dt*workSpeed(G,who)/WIPE;
  if (best.prog>=1){ best.prog=0; best.dirty=false; G.ev.push({t:'wiped', tbl:best.i, who:who}); }
  return true;
}
function fillFrom(G, w, who, dt, cap, only){
  if (w.items.length>=cap){ w.pourT=0; w.takeT=0; return false; }
  if ((!only||only==='beer') && nearKeg(w)){
    w.pourT=(w.pourT||0)+dt*workSpeed(G,who)*(who==='p'?1:0.8);
    if (w.pourT>=POUR){ w.pourT=0; w.items.push('beer'); G.ev.push({t:'pour', who:who}); }
    return true;
  }
  w.pourT=0;
  if ((!only||only==='meat') && G.grill.on && nearGrill(w) && G.grill.ready>0){
    w.takeT=(w.takeT||0)+dt;
    if (w.takeT>=TAKE){ w.takeT=0; G.grill.ready--; w.items.push('meat'); G.ev.push({t:'grab', who:who}); }
    return true;
  }
  return false;
}
function stepPlayer(G, dt, ix, iz){
  var p=G.player, m=Math.sqrt(ix*ix+iz*iz); if(m>1){ix/=m;iz/=m;m=1;}
  var sp=playerSpeed(G); p.x+=ix*sp*dt; p.z+=iz*sp*dt; clampPos(G,p);
  p.moving=m>0.15; if(p.moving) p.face=Math.atan2(ix,iz);
  p.working=false;
  if (fillFrom(G,p,'p',dt,trayCap(G))) p.working=true;
  if (p.items.length && dist(p,TRASH)<1.1){ p.items=[]; G.ev.push({t:'trash'}); }
  serveNear(G,p,'p');
  if (wipeNear(G,p,'p',dt)) p.working=true;
  G.tables.forEach(function(t){ if(t.coins>0 && dist(t,p)<2.0) collect(G,t); });
  p.onPad=null;
  G.pads.forEach(function(pd){
    if (Math.abs(p.x-pd.x)<0.95 && Math.abs(p.z-pd.z)<0.95){
      p.onPad=pd; if (pd.kind==='bench') return;
      var left=pd.cost-pd.paid; if(left<=0) return;
      var give=Math.min(left, Math.max(pd.cost/1.3,25)*dt, G.coins);
      if (give>0){ G.coins-=give; pd.paid+=give; G.padPaid.next=pd.paid; G.ev.push({t:'padpay'}); if(pd.paid>=pd.cost-1e-6) buyPad(G,pd); }
    }
  });
  G.goblins.forEach(function(g){ if(g.sleep>0&&dist(g,p)<2){ g.sleep=0; G.ev.push({t:'wake',id:g.id}); } });
}

// ---------- goblins ----------
function addGoblin(G,kind){ var g={id:G.nid++, kind:kind, x:PADS.hire[0]-0.5, z:-1.6, items:[], task:null, sleep:0, nap:50+G.rand()*50, face:Math.PI}; G.goblins.push(g); return g; }
function moveTo(g,t,sp,dt){ var dx=t.x-g.x, dz=t.z-g.z, d=Math.sqrt(dx*dx+dz*dz); if(d<0.05){ g.moving=false; return true; } var m=Math.min(d,sp*dt); g.x+=dx/d*m; g.z+=dz/d*m; g.face=Math.atan2(dx,dz); g.moving=true; return d<=sp*dt; }
// walking around tables: straight line if clear, else via the free lanes (z) and aisles (x)
var LANES=[-0.9,-3.85,-6.75], AISLES=[-5.3,-1.7,1.7,5.3];
function segHits(G,a,b){
  for (var i=0;i<G.tables.length;i++){ var t=G.tables[i]; if(!t.on) continue;
    var x0=t.x-1.05, x1=t.x+1.05, z0=t.z-1.5, z1=t.z+0.85;
    for (var k=0;k<=10;k++){ var x=a.x+(b.x-a.x)*k/10, z=a.z+(b.z-a.z)*k/10; if(x>x0&&x<x1&&z>z0&&z<z1) return true; } }
  return false;
}
function near(arr,v){ var b=arr[0]; arr.forEach(function(l){ if(Math.abs(l-v)<Math.abs(b-v)) b=l; }); return b; }
function nextStep(G,g,tgt){
  if (!segHits(G,g,tgt)) return tgt;
  var tl=near(LANES,tgt.z), ax0=near(AISLES,g.x);
  if (Math.abs(g.x-ax0)<0.15){ if (Math.abs(g.z-tl)>0.15) return {x:ax0, z:tl}; return {x:tgt.x, z:tl}; }
  var lz=near(LANES,g.z);
  if (Math.abs(g.z-lz)>0.15) return {x:g.x, z:lz};
  if (tl===lz) return {x:tgt.x, z:lz};
  return {x:near(AISLES,(g.x+tgt.x)/2), z:lz};
}
function routeTo(g, tgt, sp, dt, G){ var s=nextStep(G,g,tgt); var done=moveTo(g,s,sp,dt); return done && s===tgt; }
function stepGoblin(G,g,dt){
  g.moving=false; g.working=false;
  if (g.sleep>0){ g.sleep-=dt; if(g.sleep<=0) G.ev.push({t:'wake',id:g.id}); return; }
  g.nap-=dt; if (g.nap<=0){ g.nap=70+G.rand()*60; if(G.rand()<0.4){ g.sleep=12; G.ev.push({t:'sleep',id:g.id}); return; } }
  var sp=2.8*(1+0.15*G.upg.gob)*(G.boost>0?1.5:1);
  var others=G.goblins.filter(function(o){return o!==g&&o.task;});
  if (g.kind==='wiper'){
    var t=g.task;
    if (t && (!t.dirty)) t=g.task=null;
    if (!t){ var bd=1e9; G.tables.forEach(function(tb){ if(!tb.on||!tb.dirty) return; if(others.some(function(o){return o.task===tb;})) return; var d=dist(tb,g); if(d<bd){bd=d;t=tb;} }); g.task=t; }
    if (!t){ routeTo(g,{x:-5.0+((g.id*0.9)%1.5), z:-3.85}, sp*0.5, dt, G); return; }
    var f=frontOf(t);
    if (dist(g,f)>0.25){ routeTo(g,f,sp,dt,G); return; }
    g.face=Math.PI; g.working=wipeNear(G,g,'g',dt); return;
  }
  // waiter: fetch for the most impatient hero nobody else is serving
  if (g.items.length){
    var want=g.items[0], hh=null, bp=1e9;
    G.heroes.forEach(function(h){ if(h.state==='wait'&&h.want===want&&h.pat<bp&&!others.some(function(o){return o.task===h;})){ bp=h.pat; hh=h; } });
    if (!hh){ if (G.rand()<dt*0.1) g.items=[]; routeTo(g,{x:2.0,z:-6.75},sp*0.5,dt,G); return; }
    g.task=hh; var ft=frontOf(G.tables[hh.tbl]);
    if (dist(g,ft)>0.3){ routeTo(g,ft,sp,dt,G); return; }
    serveNear(G,g,'g'); return;
  }
  var tgt=null, bp2=1e9;
  G.heroes.forEach(function(h){ if(h.state==='wait'&&h.pat<bp2&&!others.some(function(o){return o.task===h;})){ if(h.want==='meat'&&G.grill.ready<=0&&G.heroes.some(function(x){return x.state==='wait'&&x.want==='beer';})) return; bp2=h.pat; tgt=h; } });
  g.task=tgt;
  if (!tgt){ routeTo(g,{x:2.0,z:-6.75},sp*0.5,dt,G); return; }
  var src = tgt.want==='beer' ? {x:KEG.fx+0.5, z:-7.2} : {x:GRILL.fx+0.5, z:-7.2};
  if (dist(g,src)>0.25){ routeTo(g,src,sp,dt,G); return; }
  g.working=fillFrom(G,g,'g',dt,1,tgt.want);
}

// ---------- main ----------
function step(G, dt, ix, iz){
  if (G.paused || G.night.phase==='result') return;
  G.t+=dt;
  if (G.tut>=4) stepNight(G,dt);
  if (G.boost>0) G.boost=Math.max(0,G.boost-dt);
  if (G.boostMoney>0) G.boostMoney=Math.max(0,G.boostMoney-dt);
  if (G.grill.on && G.grill.ready<GRILL_MAX){ G.grill.t+=dt*(1+0.35*G.upg.grill)*(G.boost>0?1.5:1); if (G.grill.t>=COOK){ G.grill.t=0; G.grill.ready++; G.ev.push({t:'cooked'}); } }
  stepPlayer(G,dt,ix||0,iz||0);
  G.goblins.forEach(function(g){ stepGoblin(G,g,dt); });
  G.heroes.slice().forEach(function(h){ stepHero(G,h,dt); });
  if (G.flow){ G.spawnT-=dt; if (G.spawnT<=0 && G.heroes.filter(function(h){return h.state!=='leave';}).length<maxHeroes(G)){ G.spawnT=spawnGap(G)*(0.8+G.rand()*0.4); spawnHero(G); } }
}
// ---------- save ----------
function save(G){
  return JSON.stringify({v:3, coins:Math.floor(G.coins), earned:Math.floor(G.earned), rep:G.rep, unl:G.unl, upg:G.upg, tut:G.tut, heroCount:G.heroCount,
    tb:G.tables.map(function(t){ return [t.dirty?1:0, Math.round(t.coins)]; }), next:Math.floor(G.padPaid.next||0), ipm:G.ipm||0, ready:G.grill.ready, night:G.night.n, cards:G.cards, best:G.bestNight});
}
function load(str){
  var o=JSON.parse(str); if(!o||o.v!==3) return null;
  var G=newGame(Date.now()%100000);
  G.coins=o.coins; G.earned=o.earned||0; G.rep=o.rep||3; G.upg=o.upg; G.tut=o.tut; G.heroCount=o.heroCount||0; G.ipm=o.ipm||0; G.padPaid={next:o.next||0};
  for (var i=0;i<o.unl&&i<UNL.length;i++) applyUnlock(G, UNL[i], true);
  G.unl=Math.min(o.unl, UNL.length); G.grill.ready=o.ready||0; G.night.n=o.night||1; G.cards=o.cards||{}; G.bestNight=o.best||0;
  (o.tb||[]).forEach(function(a,i){ var t=G.tables[i]; if(t&&t.on){ t.dirty=!!a[0]; t.coins=a[1]||0; } });
  G.ev=[]; makePads(G);
  return G;
}
function buyUpgrade(G,k){ var u=UPG[k]; if(G.upg[k]>=u.max) return false; var c=u.cost[G.upg[k]]; if(G.coins<c) return false; G.coins-=c; G.upg[k]++; G.ev.push({t:'buy',kind:'upg',k:k}); return true; }
return {W:W, D:D, TABLES:TABLES, KEG:KEG, GRILL:GRILL, POT:POT, TRASH:TRASH, PADS:PADS, UNL:UNL, UPG:UPG, PATIENCE:PATIENCE, QPAT:QPAT, NIGHT_LEN:NIGHT_LEN, CARDS:CARDS, nightGoal:nightGoal, offerCards:offerCards, nextNight:nextNight, goldAmt:goldAmt, starsFor:starsFor, price:price, GRILL_MAX:GRILL_MAX, PRICE:PRICE,
  newGame:newGame, step:step, makePads:makePads, spawnHero:spawnHero, trayCap:trayCap, playerSpeed:playerSpeed, save:save, load:load,
  buyUpgrade:buyUpgrade, nextStep:nextStep, pay:pay, collect:collect, seatOf:seatOf, frontOf:frontOf, nearKeg:nearKeg, nearGrill:nearGrill};
})();
if (typeof module!=='undefined') module.exports=DJ;
// ===== SIM END =====
