// ===== SIM START =====
// v0.2 — continuous heroes, they WAIT at stations that aren't ready. Pure logic, events in G.ev.
var DJ = (function(){
'use strict';
var W = 10, D = 9;
// station coords: [x, up] (up = distance from the room's bottom edge)
var ROOMS = [
  {id:'hall',  cost:0,     st:[['trap',0,3.0,'spike'],['chest',2.6,6.3]], pile:[-3.4,2.0]},
  {id:'vault', cost:60,    st:[['chest',-2.7,2.6],['trap',1.6,4.4,'arrow'],['chest',-1.2,7.0]]},
  {id:'hall2', cost:220,   st:[['trap',-2.4,2.4,'spike'],['trap',2.4,4.6,'arrow'],['chest',0,7.0]]},
  {id:'cave',  cost:650,   st:[['trap',2.2,2.6,'spike'],['chest',-2.6,4.6],['chest',2.6,7.0]], pile:[-3.6,1.6]},
  {id:'crypt', cost:1700,  st:[['trap',-2.4,2.4,'rock'],['chest',2.6,4.4],['trap',-1.5,7.0,'rock']]},
  {id:'lava',  cost:4500,  st:[['trap',2.2,2.4,'fire'],['trap',-2.2,4.6,'fire'],['chest',1.6,7.2]]},
  {id:'ice',   cost:12000, st:[['chest',-2.6,2.4],['trap',2.0,4.4,'ice'],['chest',-1.4,7.0]]},
  {id:'lair',  cost:30000, st:[['trap',-2.4,2.4,'fire'],['chest',2.6,4.4],['trap',0,6.0,'rock'],['chest',-2.6,7.3]]}
];
var MULT = function(r){ return Math.pow(1.75, r); };
var FEE = {trap:2, chest:5, exit:3, slime:1};
var WORK = {slime:0.55, trap:0.75, door:1.0, fill:0.28, take:0.16};
var PATIENCE = 15;
var UPG = {
  boots:{max:5, cost:[40,150,500,1600,5000]},
  mop:  {max:5, cost:[50,180,600,1900,6000]},
  bag:  {max:5, cost:[30,120,420,1400,4500]},
  gob:  {max:4, cost:[300,1100,3800,12000]}
};
var GOB = {clean:{base:80}, trap:{base:150}, carry:{base:220}};
var GOB_MAX = 3;
var PORTAL = [-2.8, D-0.9], RPAD = [3.0, D-1.2];
var HALL_PADS = {bench:[-3.4,5.6], clean:[3.6,1.3], trap:[1.4,1.3], carry:[-1.0,1.3]};
var HERO_SPEED = 2.4, BOSS_EVERY = 25;

function rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function W2(r, lx, up){ return {x:lx, z:-r*D-up}; }
function dist(a,b){ var dx=a.x-b.x, dz=a.z-b.z; return Math.sqrt(dx*dx+dz*dz); }

function newGame(seed){
  var G = { t:0, rand:rnd(seed||12345), ev:[], coins:0, earned:0, rooms:1, rep:3,
    upg:{boots:0,mop:0,bag:0,gob:0}, gob:{clean:0,trap:0,carry:0},
    st:[], slimes:[], heroes:[], goblins:[], pads:[], piles:[], nid:1,
    player:{x:2.4, z:-1.6, carry:0, face:Math.PI, moving:false},
    spawnT:2, heroCount:0, flow:false, boost:0, tut:0, paused:false, timers:[],
    stats:{roomAt:[0], served:0, angry:0} };
  buildRoom(G,0); makePads(G);
  return G;
}
function buildRoom(G, r){
  var R=ROOMS[r];
  R.st.forEach(function(a){ var p=W2(r,a[1],a[2]); G.st.push({id:G.nid++, k:a[0], sub:a[3], r:r, x:p.x, z:p.z, ok:true, prog:0, coins:0, busy:null}); });
  if (R.door){ var p=W2(r,0,0.3); G.st.push({id:G.nid++, k:'door', r:r, x:p.x, z:p.z, ok:true, prog:0, coins:0}); }
  if (R.pile){ var q=W2(r,R.pile[0],R.pile[1]); G.piles.push({x:q.x, z:q.z, r:r}); }
  G.ev.push({t:'room', r:r});
}
function padCost(G, kind){
  if (kind==='room') return ROOMS[G.rooms]? ROOMS[G.rooms].cost : 0;
  if (GOB[kind]) return Math.round(GOB[kind].base*Math.pow(2.2, G.gob[kind]));
  return 0;
}
function makePads(G){
  var old={}; (G.pads||[]).forEach(function(p){ old[p.kind]=p.paid; });
  G.padPaid=G.padPaid||{}; Object.keys(old).forEach(function(k){ G.padPaid[k]=old[k]; });
  G.pads=[];
  if (G.rooms<ROOMS.length && G.tut>=4){ var p=W2(G.rooms-1, RPAD[0], RPAD[1]); G.pads.push({kind:'room', x:p.x, z:p.z}); }
  if (G.tut>=6){
    G.pads.push({kind:'bench', x:HALL_PADS.bench[0], z:-HALL_PADS.bench[1]});
    ['clean','trap','carry'].forEach(function(k){
      if (G.gob[k]>=GOB_MAX) return;
      if (k==='carry' && G.rooms<2) return; if (k==='trap' && G.rooms<2) return;
      G.pads.push({kind:k, x:HALL_PADS[k][0], z:-HALL_PADS[k][1]});
    });
  }
  G.pads.forEach(function(p){ p.cost=padCost(G,p.kind); p.paid=Math.min(p.cost-1, G.padPaid[p.kind]||0); if(p.paid<0) p.paid=0; });
}
function allPiles(G){ return G.piles; }
function stById(G,id){ for (var i=0;i<G.st.length;i++) if(G.st[i].id===id) return G.st[i]; return null; }

// ---------- heroes ----------
var KINDS=['knight','archer','mage','rogue'];
function heroPath(G){
  var pts=[];
  for (var r=0;r<G.rooms;r++){
    pts.push({x:(G.rand()-0.5)*1.2, z:-r*D-0.6, room:r});
    G.st.filter(function(s){return s.r===r&&(s.k==='trap'||s.k==='chest');}).sort(function(a,b){return b.z-a.z;}).forEach(function(s){
      // stand point: next to chest (in front), on top of trap
      var sp = s.k==='chest' ? {x:s.x+(s.x>0?-1.0:1.0), z:s.z} : {x:s.x, z:s.z+0.05};
      pts.push({x:sp.x, z:sp.z, st:s.id});
    });
    if (r<G.rooms-1) pts.push({x:0, z:-(r+1)*D+0.6});
  }
  var e=W2(G.rooms-1, PORTAL[0], PORTAL[1]); pts.push({x:e.x, z:e.z+0.3, exit:true});
  return pts;
}
function spawnGap(G){
  var g = 8.5 - Math.min(3, G.rooms*0.45) - (G.rep-3)*0.8;
  return Math.max(3.2, g);
}
function maxHeroes(G){ return 2 + G.rooms; }
function spawnHero(G, opt){
  opt=opt||{};
  G.heroCount++;
  var boss = opt.boss || (G.heroCount>3 && G.heroCount%BOSS_EVERY===0);
  var h={id:G.nid++, kind: boss?'king':(opt.kind||KINDS[Math.floor(G.rand()*4)]), boss:boss, x:(G.rand()-0.5)*1.5, z:2.5, path:heroPath(G), pi:0,
    state:'walk', wait:0, pat:PATIENCE*(boss?0.8:1), sat:70, need:null, use:0, face:Math.PI, slipT:0};
  G.heroes.push(h); G.ev.push({t:'hero', id:h.id, boss:boss});
  return h;
}
function pay(G, amt, x, z, why, pile){
  amt=Math.max(1, Math.round(amt*(G.boostMoney>0?2:1)));
  if (pile){ pile.coins+=amt; G.ev.push({t:'drop', id:pile.id, n:amt, x:x, z:z}); }
  else { G.coins+=amt; G.earned+=amt; G.ev.push({t:'coin', n:amt, x:x, z:z, why:why}); }
  return amt;
}
function collect(G, s){
  if (s.coins<=0) return;
  var n=Math.round(s.coins); s.coins=0; G.coins+=n; G.earned+=n; G.ev.push({t:'coin', n:n, x:s.x, z:s.z, why:'pick'});
}
function emo(G,h,e){ G.ev.push({t:'emo', id:h.id, e:e}); }
function stepHero(G, h, dt){
  if (h.slipT>0){ h.slipT-=dt; return; }
  if (h.state==='use'){ h.use-=dt; if (h.use<=0){ h.state='walk'; h.pi++; } return; }
  var tg=h.path[h.pi];
  if (!tg){ exitHero(G,h); return; }
  var s = tg.st? stById(G,tg.st) : null;
  // queue: don't walk into a station someone else is using/waiting at
  var dx=tg.x-h.x, dz=tg.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
  if (s && d<1.6 && s.busy && s.busy!==h.id){ h.state='queue'; h.pat-=dt*0.5; h.need=null; if (h.pat<=0){ giveUp(G,h,s); } return; }
  if (d>0.08){
    var sp=HERO_SPEED*(h.boss?0.85:1)*dt, m=Math.min(d,sp);
    h.x+=dx/d*m; h.z+=dz/d*m; h.face=Math.atan2(dx,dz); h.state='walk';
    // slime: slip!
    for (var i=0;i<G.slimes.length;i++){ var sl=G.slimes[i]; if (!sl['h'+h.id] && Math.abs(sl.x-h.x)<0.7*sl.sz && Math.abs(sl.z-h.z)<0.6*sl.sz){ sl['h'+h.id]=1; h.slipT=0.9; h.sat-=8; h.pat=Math.max(4,h.pat-2); emo(G,h,'slip'); G.ev.push({t:'slip', id:h.id}); break; } }
    return;
  }
  if (tg.exit){ exitHero(G,h); return; }
  if (!s){ // waypoint (doorway) — door check
    if (tg.room!==undefined){ var door=G.st.filter(function(q){return q.r===tg.room&&q.k==='door';})[0]; if(door && !door.ok){ h.sat-=6; emo(G,h,'meh'); } }
    h.pi++; return;
  }
  s.busy=h.id;
  if (s.ok){
    s.ok=false; s.busy=h.id; h.state='use'; h.use=s.k==='trap'?1.1:0.8; h.need=null;
    var fee=(s.k==='trap'?FEE.trap:FEE.chest)*MULT(s.r)*(h.boss?5:1);
    pay(G, fee, s.x, s.z, s.k, s); h.sat+= h.pat>PATIENCE*0.6? 10:4;
    G.ev.push({t: s.k==='trap'?'spring':'loot', id:s.id, hid:h.id}); emo(G,h, s.k==='trap'?'ouch':'happy');
    G.stats.served++;
    G.timers.push({t:G.t+h.use, fn:function(){ if(s.busy===h.id) s.busy=null; }});
    h.pat=Math.min(PATIENCE*(h.boss?0.8:1), h.pat+5);
    return;
  }
  // not ready: wait with patience
  h.state='wait'; h.need=s.k; if (G.tut>=4) h.pat-=dt;
  if (h.pat<=0) giveUp(G,h,s);
}
function giveUp(G,h,s){
  h.sat-=25; emo(G,h,'angry'); G.ev.push({t:'angry', id:h.id}); G.stats.angry++;
  if (s && s.busy===h.id) s.busy=null;
  h.state='walk'; h.need=null; h.pi++; h.pat=PATIENCE*0.7;
  // skip over the next station in the queue too
}
function exitHero(G,h){
  h.sat=Math.max(0,Math.min(100,h.sat));
  var stars=Math.max(1,Math.min(5,Math.round(h.sat/20)));
  pay(G, FEE.exit*MULT(G.rooms-1)*(0.4+h.sat/100)*(h.boss?5:1), h.x, h.z, 'exit');
  G.rep=G.rep*0.85+stars*0.15;
  G.ev.push({t:'exit', id:h.id, stars:stars, boss:h.boss});
  G.st.forEach(function(s){ if(s.busy===h.id) s.busy=null; });
  G.heroes.splice(G.heroes.indexOf(h),1);
  // mess: break a door sometimes, leave slime
}
function leaveSlime(G,h){
  if (G.slimes.length>=14) return;
  var r=Math.floor(-h.z/D); if (r<0||r>=G.rooms) return;
  var x=Math.max(-W/2+1,Math.min(W/2-1,h.x+(G.rand()-0.5)*1.5)), z=Math.min(-r*D-1.2, Math.max(-(r+1)*D+1.2, h.z+(G.rand()-0.5)*1.5));
  if (G.st.some(function(s){return dist(s,{x:x,z:z})<1.3;})) return;
  if (dist(G.player,{x:x,z:z})<1) return;
  var sl={id:G.nid++, x:x, z:z, r:r, c:Math.floor(G.rand()*4), sz:0.8+G.rand()*0.4, prog:0};
  G.slimes.push(sl); G.ev.push({t:'slime', id:sl.id});
}
// ---------- workers ----------
function needs(G,s){ return (s.k==='trap'||s.k==='door'||s.k==='chest') && !s.ok; }
function workSpeed(G, who){ var b=G.boost>0?1.5:1; return who==='p' ? (1+0.25*G.upg.mop)*b : 0.6*(1+0.2*G.upg.gob)*b; }
function doWork(G, w, who, dt, kinds){
  var best=null, bd=1e9;
  if (!kinds||kinds.slime) G.slimes.forEach(function(s){ var d=dist(s,w); if(d<0.95*s.sz+0.2&&d<bd){bd=d;best={sl:s};} });
  if (!best) G.st.forEach(function(s){ if(kinds&&!kinds[s.k]) return; if(!needs(G,s)) return; if(s.k==='chest'&&w.carry<=0) return; var d=dist(s,w); if(d<1.35&&d<bd){bd=d;best={s:s};} });
  if (!best) return false;
  var sp=workSpeed(G,who)*dt;
  if (best.sl){ var sl=best.sl; sl.prog+=sp/WORK.slime;
    if (sl.prog>=1){ G.slimes.splice(G.slimes.indexOf(sl),1); G.ev.push({t:'clean',id:sl.id,x:sl.x,z:sl.z}); pay(G, FEE.slime*Math.max(1,MULT(sl.r)*0.5), sl.x, sl.z, 'slime'); }
    return true; }
  var s=best.s; s.prog+=sp/(s.k==='chest'?WORK.fill:WORK[s.k]);
  if (s.prog>=1){ s.prog=0; s.ok=true; if(s.k==='chest') w.carry--; G.ev.push({t:'fixed',id:s.id,k:s.k,who:who}); }
  return true;
}
function takeSacks(G, w, who, dt, cap){
  var near=G.piles.some(function(p){ return dist(p,w)<1.6; });
  if (!near||w.carry>=cap){ w.takeT=0; return false; }
  w.takeT=(w.takeT||0)+dt;
  while (w.takeT>=WORK.take && w.carry<cap){ w.takeT-=WORK.take; w.carry++; G.ev.push({t:'take',who:who}); }
  return true;
}
function bagCap(G){ return 3+2*G.upg.bag; }
function playerSpeed(G){ return 5.0*(1+0.1*G.upg.boots)*(G.boost>0?1.35:1); }
function clampPos(G,p){
  p.x=Math.max(-W/2+0.55, Math.min(W/2-0.55, p.x));
  p.z=Math.min(-0.45, Math.max(-G.rooms*D+0.55, p.z));
  // solid stations (chests)
  G.st.forEach(function(s){ if(s.k!=='chest') return; var dx=p.x-s.x, dz=p.z-s.z, hx=0.95, hz=0.75;
    if (Math.abs(dx)<hx && Math.abs(dz)<hz){ if (hx-Math.abs(dx) < hz-Math.abs(dz)) p.x=s.x+(dx<0?-hx:hx); else p.z=s.z+(dz<0?-hz:hz); } });
}
function stepPlayer(G, dt, ix, iz){
  var p=G.player, m=Math.sqrt(ix*ix+iz*iz); if(m>1){ix/=m;iz/=m;m=1;}
  var sp=playerSpeed(G); p.x+=ix*sp*dt; p.z+=iz*sp*dt; clampPos(G,p);
  p.moving=m>0.15; if(p.moving) p.face=Math.atan2(ix,iz);
  takeSacks(G,p,'p',dt,bagCap(G));
  p.working=doWork(G,p,'p',dt,null);
  // coin magnet
  G.st.forEach(function(s){ if(s.coins>0 && dist(s,p)<1.9) collect(G,s); });
  // pads
  p.onPad=null;
  G.pads.forEach(function(pd){
    if (Math.abs(p.x-pd.x)<1.0 && Math.abs(p.z-pd.z)<1.0){
      p.onPad=pd; if (pd.kind==='bench') return;
      var left=pd.cost-pd.paid; if(left<=0) return;
      var give=Math.min(left, Math.max(pd.cost/1.3,25)*dt, G.coins);
      if (give>0){ G.coins-=give; pd.paid+=give; G.ev.push({t:'padpay',kind:pd.kind}); if(pd.paid>=pd.cost-1e-6) buyPad(G,pd); }
    }
  });
  G.goblins.forEach(function(g){ if(g.sleep>0&&dist(g,p)<2){ g.sleep=0; G.ev.push({t:'wake',id:g.id}); } });
}
function buyPad(G,pd){
  G.padPaid[pd.kind]=0; pd.paid=0;
  if (pd.kind==='room'){ buildRoom(G,G.rooms); G.rooms++; G.stats.roomAt.push(G.t); G.ev.push({t:'buy',kind:'room',r:G.rooms-1});
    // re-route heroes that haven't reached the old exit yet
    G.heroes.forEach(function(h){ var cur=h.path[h.pi]; if(cur&&cur.exit){ var np=heroPath(G); var lastRoom=G.rooms-2; var idx=0; for(var i=0;i<np.length;i++){ if(np[i].room===lastRoom+1){ idx=i; break; } } h.path=np; h.pi=Math.max(0,idx-1); h.path.splice(h.pi,0,{x:0,z:-(lastRoom+1)*D+0.6}); } });
  } else if (GOB[pd.kind]){ G.gob[pd.kind]++; addGoblin(G,pd.kind); G.ev.push({t:'buy',kind:pd.kind}); }
  makePads(G);
}
function addGoblin(G,kind){ var g={id:G.nid++, kind:kind, x:(G.rand()-0.5)*3, z:-1.5, carry:0, task:null, sleep:0, nap:50+G.rand()*50, face:Math.PI}; G.goblins.push(g); return g; }
var GOB_KINDS={clean:{slime:1,door:1}, trap:{trap:1}, carry:{chest:1}};
function taken(G,g,obj){ return G.goblins.some(function(o){ return o!==g && o.task && (o.task.s===obj||o.task.sl===obj); }); }
function stepGoblin(G,g,dt){
  g.moving=false;
  if (g.sleep>0){ g.sleep-=dt; g.working=false; if(g.sleep<=0) G.ev.push({t:'wake',id:g.id}); return; }
  g.nap-=dt; if (g.nap<=0){ g.nap=60+G.rand()*60; if(G.rand()<0.45){ g.sleep=15; G.ev.push({t:'sleep',id:g.id}); return; } }
  var sp=2.8*(1+0.15*G.upg.gob)*(G.boost>0?1.5:1), t=g.task;
  if (t&&t.sl&&G.slimes.indexOf(t.sl)<0) t=g.task=null;
  if (t&&t.s&&!needs(G,t.s)) t=g.task=null;
  if (!t){
    var best=null,bd=1e9, pick=function(o,key,w){ if(taken(G,g,o)) return; var d=dist(o,g)*(w||1); if(d<bd){bd=d;best={}; best[key]=o;} };
    if (g.kind==='clean'){ G.slimes.forEach(function(s){pick(s,'sl');}); G.st.forEach(function(s){ if(s.k==='door'&&!s.ok) pick(s,'s',0.8); }); }
    else if (g.kind==='trap'){ G.st.forEach(function(s){ if(s.k==='trap'&&!s.ok) pick(s,'s',G.heroes.some(function(h){return h.need&&h.path[h.pi]&&h.path[h.pi].st===s.id;})?0.5:1); }); }
    else { if (g.carry<=0){ if (G.st.some(function(s){return s.k==='chest'&&!s.ok;})) G.piles.forEach(function(p){ var d=dist(p,g); if(d<bd){bd=d;best={pile:p};} }); }
      else G.st.forEach(function(s){ if(s.k==='chest'&&!s.ok) pick(s,'s'); }); }
    g.task=t=best;
  }
  if (!t){ moveTo(g,{x:-3+((g.id*1.3)%6), z:-1.4}, sp*0.5, dt); g.working=false; return; }
  var tgt=t.sl||t.s||t.pile, near=t.pile?1.2:(t.s&&t.s.k==='chest'?1.15:0.6);
  if (dist(g,tgt)>near){ moveTo(g,tgt,sp,dt); g.working=false; return; }
  if (t.pile){ takeSacks(G,g,'g',dt,3); g.working=true; if(g.carry>=3) g.task=null; return; }
  g.working=doWork(G,g,'g',dt,GOB_KINDS[g.kind]); if(!g.working) g.task=null;
}
function moveTo(g,t,sp,dt){ var dx=t.x-g.x, dz=t.z-g.z, d=Math.sqrt(dx*dx+dz*dz); if(d<0.05) return; var m=Math.min(d,sp*dt); g.x+=dx/d*m; g.z+=dz/d*m; g.face=Math.atan2(dx,dz); g.moving=true; }
// ---------- main ----------
function step(G, dt, ix, iz){
  if (G.paused) return;
  G.t+=dt;
  if (G.boost>0) G.boost=Math.max(0,G.boost-dt);
  if (G.boostMoney>0) G.boostMoney=Math.max(0,G.boostMoney-dt);
  for (var i=G.timers.length-1;i>=0;i--) if(G.t>=G.timers[i].t){ var f=G.timers[i].fn; G.timers.splice(i,1); f(); }
  stepPlayer(G,dt,ix||0,iz||0);
  G.goblins.forEach(function(g){ stepGoblin(G,g,dt); });
  G.heroes.slice().forEach(function(h){ var pz=h.z; stepHero(G,h,dt); if (h.state==='walk' && G.rand()<dt*0.09) leaveSlime(G,h); });
  // doors break sometimes when heroes pass
  if (G.flow){ G.spawnT-=dt; if (G.spawnT<=0 && G.heroes.length<maxHeroes(G)){ G.spawnT=spawnGap(G)*(0.8+G.rand()*0.4); spawnHero(G); } }
}
// ---------- save ----------
function save(G){
  return JSON.stringify({v:2, coins:Math.floor(G.coins), earned:Math.floor(G.earned), rooms:G.rooms, rep:G.rep, upg:G.upg, gob:G.gob, tut:G.tut, heroCount:G.heroCount,
    st:G.st.map(function(s){return [s.ok?1:0, Math.round(s.coins)];}), padPaid:G.pads.reduce(function(o,p){o[p.kind]=Math.floor(p.paid);return o;},{}), ipm:G.ipm||0});
}
function load(str){
  var o=JSON.parse(str); if(!o||o.v!==2) return null;
  var G=newGame(Date.now()%100000); G.st=[]; G.piles=[];
  for (var r=0;r<o.rooms;r++) buildRoom(G,r);
  G.ev=[]; G.rooms=o.rooms; G.coins=o.coins; G.earned=o.earned||0; G.rep=o.rep; G.upg=o.upg; G.gob=o.gob; G.tut=o.tut; G.heroCount=o.heroCount||0; G.padPaid=o.padPaid||{}; G.ipm=o.ipm||0;
  (o.st||[]).forEach(function(a,i){ if(G.st[i]){ G.st[i].ok=!!a[0]; G.st[i].coins=a[1]||0; } });
  Object.keys(G.gob).forEach(function(k){ for(var i=0;i<G.gob[k];i++) addGoblin(G,k); });
  G.pads=[]; makePads(G);
  return G;
}
function buyUpgrade(G,k){ var u=UPG[k]; if(G.upg[k]>=u.max) return false; var c=u.cost[G.upg[k]]; if(G.coins<c) return false; G.coins-=c; G.upg[k]++; G.ev.push({t:'buy',kind:'upg',k:k}); return true; }
return {W:W,D:D,ROOMS:ROOMS,MULT:MULT,UPG:UPG,GOB:GOB,GOB_MAX:GOB_MAX,PORTAL:PORTAL,RPAD:RPAD,HALL_PADS:HALL_PADS,PATIENCE:PATIENCE,
  newGame:newGame, step:step, makePads:makePads, spawnHero:spawnHero, bagCap:bagCap, playerSpeed:playerSpeed, save:save, load:load,
  needs:needs, stById:stById, W2:W2, buyUpgrade:buyUpgrade, pay:pay, collect:collect};
})();
if (typeof module!=='undefined') module.exports=DJ;
// ===== SIM END =====
