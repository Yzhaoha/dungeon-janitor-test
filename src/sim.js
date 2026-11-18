// ===== SIM START =====
// v0.6 — Tavern Brawl: monsters storm the tavern, the innkeeper auto-attacks, you only move.
// Kill -> coins (xp) -> level up -> pick 1 of 3. Survive RUN seconds, then beat the boss.
// Pure logic (node can run it), events go to G.ev.
var DJ = (function(){
'use strict';
var W = 26, D = 20, RUN = 210, CAP = 150, MAXLV = 5;
var X0 = -W/2+0.7, X1 = W/2-0.7, Z0 = -D+2.4, Z1 = -0.7;
var ET = {
  slime:{hp:9,  spd:1.9, dmg:6,  r:0.45, xp:1},
  gob:  {hp:7,  spd:3.1, dmg:5,  r:0.38, xp:1},
  skel: {hp:24, spd:2.3, dmg:9,  r:0.45, xp:2},
  bat:  {hp:6,  spd:4.2, dmg:5,  r:0.35, xp:1},
  orc:  {hp:90, spd:1.7, dmg:15, r:0.7,  xp:6},
  elite:{hp:420,spd:2.0, dmg:18, r:1.0,  xp:30},
  boss: {hp:1600,spd:2.1,dmg:26, r:1.4,  xp:0}
};
var WEAP = ['pan','mug','barrel','fire','potion','gob'];
var PASS = ['boots','apron','magnet','haste','power','luck'];
var META = { hp:{max:5,cost:[30,70,150,300,600]}, power:{max:5,cost:[30,70,150,300,600]}, speed:{max:5,cost:[25,60,130,260,500]},
  magnet:{max:5,cost:[20,50,110,220,450]}, gold:{max:5,cost:[40,90,180,360,700]} };

function rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function lv(G,k){ return G.w[k]||0; }
function mv(G,k){ return G.meta[k]||0; }
function stats(G){
  return { maxhp: Math.round((100+20*lv(G,'apron'))*(1+0.1*mv(G,'hp'))), regen: 0.4*lv(G,'apron'),
    speed: 5.2*(1+0.07*lv(G,'boots'))*(1+0.04*mv(G,'speed')), magnet: (2.0+0.7*lv(G,'magnet'))*(1+0.15*mv(G,'magnet')),
    dmg: (1+0.14*lv(G,'power'))*(1+0.08*mv(G,'power')), cd: 1/(1+0.1*lv(G,'haste')), gold: (1+0.2*lv(G,'luck'))*(1+0.15*mv(G,'gold')) };
}
function newRun(meta, night, seed){
  var G = { t:0, rand:rnd(seed||12345), ev:[], phase:'play', night:night||1, meta:meta||{}, w:{pan:1}, cd:{}, orb:0,
    player:{x:0, z:-D/2, face:0, hp:100, ifr:0, moving:false},
    enemies:[], shots:[], pools:[], gems:[], meats:[], nid:1, xp:0, lvl:1, pend:0, offer:null, kills:0,
    spawnAcc:0, swarmT:30, eliteN:0, boss:null, bossDone:false, revived:false, hurtT:0 };
  G.player.hp = stats(G).maxhp;
  return G;
}
function xpNeed(l){ return 4 + l*3 + Math.floor(l*l*0.35); }
function clampP(p){ p.x=Math.max(X0,Math.min(X1,p.x)); p.z=Math.max(Z0,Math.min(Z1,p.z)); }

// ---------- spawning ----------
function hpMul(G){ return (1 + Math.min(G.t,RUN)/RUN*1.5) * (1+0.22*(G.night-1)); }
function dmgMul(G){ return 1+0.1*(G.night-1); }
function spawnPos(G, rad){
  var p=G.player, best=null, bd=0;
  for (var i=0;i<8;i++){ var a=G.rand()*Math.PI*2, r=(rad||11)+G.rand()*3, q={x:p.x+Math.cos(a)*r, z:p.z+Math.sin(a)*r}; clampP(q);
    var d=Math.hypot(q.x-p.x,q.z-p.z); if (d>=7.5) return q; if (d>bd){ bd=d; best=q; } }
  return best;
}
function spawn(G, type, pos, mul){
  var T=ET[type], q=pos||spawnPos(G);
  var e={id:G.nid++, type:type, x:q.x, z:q.z, hp:T.hp*hpMul(G)*(mul||1), r:T.r, spd:T.spd*(0.9+G.rand()*0.2), dmg:T.dmg*dmgMul(G), xp:T.xp,
    kx:0, kz:0, flash:0, face:0, ph:G.rand()*6, hitCd:0, gobCd:0, burnCd:0};
  e.maxhp=e.hp; G.enemies.push(e); return e;
}
function pickType(G){
  var t=G.t, r=G.rand(), o=[['slime',1]];
  if (t>18) o.push(['gob',0.9]); if (t>55) o.push(['skel',1.1]); if (t>95) o.push(['bat',0.8]); if (t>125) o.push(['orc',0.35+ (t-125)/200]);
  if (t>70) o[0][1]=0.4;
  var s=0; o.forEach(function(a){ s+=a[1]; }); r*=s;
  for (var i=0;i<o.length;i++){ r-=o[i][1]; if (r<=0) return o[i][0]; }
  return 'slime';
}
function stepSpawn(G, dt){
  var n=G.night;
  if (!G.boss && !G.bossDone && G.t>=RUN){
    G.boss=spawn(G,'boss',spawnPos(G,10)); G.boss.dashT=4; G.boss.mode='walk'; G.ev.push({t:'boss'});
  }
  var rate=(1.1 + Math.min(G.t,RUN)*0.033)*(1+0.06*(n-1)); if (G.boss) rate*=0.45;
  G.spawnAcc+=rate*dt;
  while (G.spawnAcc>=1){ G.spawnAcc-=1; if (G.enemies.length<CAP) spawn(G, pickType(G)); }
  if (!G.boss){ G.swarmT-=dt;
    if (G.swarmT<=0){ G.swarmT=30; var k=Math.min(26, 10+Math.floor(G.t/14)), ty=G.t>100?'bat':'gob', p=G.player, a0=G.rand()*6;
      for (var i=0;i<k && G.enemies.length<CAP;i++){ var a=a0+i/k*Math.PI*2, q={x:p.x+Math.cos(a)*9.5, z:p.z+Math.sin(a)*9.5}; clampP(q); if (Math.hypot(q.x-p.x,q.z-p.z)>5) spawn(G,ty,q); }
      G.ev.push({t:'swarm'}); }
    if (G.eliteN<2 && G.t>=(G.eliteN?150:75)){ G.eliteN++; spawn(G,'elite'); G.ev.push({t:'elite'}); } }
}

// ---------- damage ----------
function hit(G, e, d, dx, dz, kb){
  if (e.hp<=0) return;
  d*=stats(G).dmg; e.hp-=d; e.flash=0.12;
  if (kb && e.type!=='boss'){ var m=Math.hypot(dx,dz)||1, f=kb/(e.r*2); e.kx+=dx/m*f; e.kz+=dz/m*f; }
  G.ev.push({t:'hit', x:e.x, z:e.z, d:d, big:e.r>0.9});
  if (e.hp<=0) kill(G,e);
}
function kill(G, e){
  G.kills++;
  if (e.type==='boss'){ G.boss=null; G.bossDone=true; G.ev.push({t:'bossDead', x:e.x, z:e.z});
    G.enemies.forEach(function(o){ if(o!==e){ o.hp=0; G.ev.push({t:'kill', x:o.x, z:o.z, type:o.type}); } }); G.enemies=[]; G.phase='win'; G.ev.push({t:'win'}); return; }
  var i=G.enemies.indexOf(e); if (i>=0) G.enemies.splice(i,1);
  G.ev.push({t:'kill', x:e.x, z:e.z, type:e.type});
  if (G.gems.length<260) G.gems.push({id:G.nid++, x:e.x, z:e.z, v:e.xp, pull:false});
  else G.gems[Math.floor(G.rand()*G.gems.length)].v+=e.xp;
  if (e.type==='elite'){ for (var k=0;k<8;k++) G.gems.push({id:G.nid++, x:e.x+(G.rand()-0.5)*2, z:e.z+(G.rand()-0.5)*2, v:4, pull:false}); G.meats.push({id:G.nid++, x:e.x, z:e.z}); }
  else if (G.rand()<0.014 && G.meats.length<4) G.meats.push({id:G.nid++, x:e.x, z:e.z});
}
function nearest(G, n, maxD, from){
  var p=from||G.player, a=[];
  G.enemies.forEach(function(e){ var d=Math.hypot(e.x-p.x,e.z-p.z)-e.r; if (d<=maxD) a.push([d,e]); });
  a.sort(function(x,y){ return x[0]-y[0]; });
  return a.slice(0,n).map(function(x){ return x[1]; });
}

// ---------- weapons ----------
function panRange(G){ return 2.2+0.22*lv(G,'pan'); }
function fireRange(G){ return 1.7+0.28*lv(G,'fire'); }
function poolRange(G){ return 1.5+0.2*lv(G,'potion'); }
function gobCount(G){ var l=lv(G,'gob'); return l? 1+Math.floor(l/2) : 0; }
function gobPos(G, i){ var n=gobCount(G), a=G.orb+i/n*Math.PI*2, p=G.player; return {x:p.x+Math.sin(a)*2.5, z:p.z+Math.cos(a)*2.5, a:a}; }
function stepWeapons(G, dt){
  var p=G.player, S=stats(G), cd=G.cd, l;
  WEAP.forEach(function(k){ cd[k]=(cd[k]||0)-dt; });
  // frying pan: sweep at the nearest monster
  if ((l=lv(G,'pan')) && cd.pan<=0){
    var R=panRange(G), tg=nearest(G,1,R+0.6)[0];
    if (tg){ cd.pan=0.95*S.cd; var ang=Math.atan2(tg.x-p.x, tg.z-p.z), full=l>=4, arc=full?Math.PI:1.35;
      G.enemies.slice().forEach(function(e){ var dx=e.x-p.x, dz=e.z-p.z, d=Math.hypot(dx,dz)-e.r; if (d>R) return;
        var da=Math.atan2(dx,dz)-ang; da=Math.atan2(Math.sin(da),Math.cos(da)); if (Math.abs(da)>arc) return;
        hit(G,e,12+6*l,dx,dz,7); });
      G.ev.push({t:'swing', a:ang, r:R, full:full}); }
  }
  // beer mugs: thrown at the nearest monsters
  if ((l=lv(G,'mug')) && cd.mug<=0){
    var ts=nearest(G,1+Math.floor(l/2),10);
    if (ts.length){ cd.mug=1.15*S.cd; ts.forEach(function(e){ var dx=e.x-p.x, dz=e.z-p.z, m=Math.hypot(dx,dz)||1;
      G.shots.push({id:G.nid++, k:'mug', x:p.x, z:p.z, vx:dx/m*13, vz:dz/m*13, life:1.1, r:0.45, dmg:9+4*l, pierce:1+Math.floor(l/3), kb:3, seen:{}}); });
      G.ev.push({t:'throw'}); }
  }
  // rolling barrel: ploughs through everything in a line
  if ((l=lv(G,'barrel')) && cd.barrel<=0){
    var bt=nearest(G,1,9)[0];
    if (bt){ cd.barrel=(4.2-0.3*l)*S.cd; var n=l>=5?3:(l>=3?2:1), a0=Math.atan2(bt.x-p.x, bt.z-p.z);
      for (var i=0;i<n;i++){ var a=a0+i/n*Math.PI*2; G.shots.push({id:G.nid++, k:'barrel', x:p.x, z:p.z, vx:Math.sin(a)*8.5, vz:Math.cos(a)*8.5, life:2.4, r:0.95, dmg:26+12*l, pierce:999, kb:5, seen:{}}); }
      G.ev.push({t:'roll'}); }
  }
  // grill fire: burns everything close to you
  if ((l=lv(G,'fire')) && cd.fire<=0){ cd.fire=0.5; var FR=fireRange(G);
    G.enemies.slice().forEach(function(e){ var dx=e.x-p.x, dz=e.z-p.z; if (Math.hypot(dx,dz)-e.r<=FR) hit(G,e,3.5+2.5*l,dx,dz,0); }); }
  // bad potion: lobbed, leaves a puddle
  if ((l=lv(G,'potion')) && cd.potion<=0){
    var c=nearest(G,12,8.5);
    if (c.length){ cd.potion=3.1*S.cd; for (var j=0;j<(l>=3?2:1);j++){ var e2=c[Math.floor(G.rand()*c.length)];
      G.pools.push({id:G.nid++, x:e2.x, z:e2.z, r:poolRange(G), delay:0.45, life:3.2, tick:0, dmg:5+3*l}); G.ev.push({t:'lob', x:e2.x, z:e2.z}); } }
  }
  // goblin helpers: orbit and bonk
  if ((l=lv(G,'gob'))){ G.orb+=2.7*dt; var n2=gobCount(G);
    for (var g=0;g<n2;g++){ var q=gobPos(G,g);
      G.enemies.slice().forEach(function(e){ if (e.gobCd>0) return; var dx=e.x-q.x, dz=e.z-q.z; if (Math.hypot(dx,dz)-e.r<=0.75){ e.gobCd=0.45; hit(G,e,10+5*l,e.x-p.x,e.z-p.z,5); } }); } }
}
function stepShots(G, dt){
  for (var i=G.shots.length-1;i>=0;i--){ var s=G.shots[i]; s.x+=s.vx*dt; s.z+=s.vz*dt; s.life-=dt;
    var dead = s.life<=0 || s.x<X0-1 || s.x>X1+1 || s.z<Z0-1.5 || s.z>Z1+1;
    if (!dead){ var es=G.enemies.slice(); for (var j=0;j<es.length;j++){ var e=es[j]; if (s.seen[e.id]) continue;
      if (Math.hypot(e.x-s.x,e.z-s.z)<=e.r+s.r){ s.seen[e.id]=1; hit(G,e,s.dmg,s.vx,s.vz,s.kb); if (--s.pierce<=0){ dead=true; break; } } } }
    if (dead){ G.ev.push({t:'shotEnd', k:s.k, x:s.x, z:s.z}); G.shots.splice(i,1); } }
  for (var k=G.pools.length-1;k>=0;k--){ var o=G.pools[k];
    if (o.delay>0){ o.delay-=dt; if (o.delay<=0) G.ev.push({t:'splash', x:o.x, z:o.z}); continue; }
    o.life-=dt; o.tick-=dt;
    if (o.tick<=0){ o.tick=0.5; G.enemies.slice().forEach(function(e){ if (Math.hypot(e.x-o.x,e.z-o.z)-e.r<=o.r) hit(G,e,o.dmg,0,0,0); }); }
    if (o.life<=0) G.pools.splice(k,1); }
}

// ---------- enemies ----------
function stepEnemies(G, dt){
  var p=G.player, es=G.enemies, n=es.length, i, j;
  for (i=0;i<n;i++){ var e=es[i];
    e.flash=Math.max(0,e.flash-dt); e.hitCd-=dt; e.gobCd-=dt; e.ph+=dt*e.spd*3;
    var dx=p.x-e.x, dz=p.z-e.z, d=Math.hypot(dx,dz)||0.001, sp=e.spd;
    if (e.type==='boss'){
      e.dashT-=dt;
      if (e.mode==='walk' && e.dashT<=0){ e.mode='wind'; e.dashT=0.85; e.dx=dx/d; e.dz=dz/d; G.ev.push({t:'bossWind'}); }
      else if (e.mode==='wind'){ sp=0; if (e.dashT<=0){ e.mode='dash'; e.dashT=0.7; G.ev.push({t:'bossDash'}); } }
      else if (e.mode==='dash'){ if (e.dashT<=0){ e.mode='walk'; e.dashT=4.2; } }
      if (e.mode==='dash'){ e.x+=e.dx*12*dt; e.z+=e.dz*12*dt; e.face=Math.atan2(e.dx,e.dz); sp=0; }
    }
    if (sp>0){ var wx=0, wz=0; if (e.type==='bat'){ var w=Math.sin(e.ph*0.7)*0.8; wx=-dz/d*w; wz=dx/d*w; }
      e.x+=(dx/d+wx)*sp*dt; e.z+=(dz/d+wz)*sp*dt; e.face=Math.atan2(dx,dz); }
    e.x+=e.kx*dt; e.z+=e.kz*dt; var dec=Math.max(0,1-dt*7); e.kx*=dec; e.kz*=dec;
    if (d<e.r+0.42 && e.hitCd<=0 && p.ifr<=0){ e.hitCd=0.6; hurt(G, e.dmg); }
  }
  // separation (cheap n^2, n <= CAP)
  for (i=0;i<n;i++){ var a=es[i]; for (j=i+1;j<n;j++){ var b=es[j], ox=b.x-a.x, oz=b.z-a.z, rr=(a.r+b.r)*0.85;
    if (Math.abs(ox)>rr||Math.abs(oz)>rr) continue; var od=Math.hypot(ox,oz); if (od>=rr) continue; if (od<0.001){ ox=0.01; od=0.01; }
    var push=(rr-od)*0.5, wa=b.r/(a.r+b.r); a.x-=ox/od*push*wa*2; a.z-=oz/od*push*wa*2; b.x+=ox/od*push*(1-wa)*2; b.z+=oz/od*push*(1-wa)*2; } }
  for (i=0;i<n;i++){ var c=es[i]; c.x=Math.max(X0-0.3,Math.min(X1+0.3,c.x)); c.z=Math.max(Z0-0.3,Math.min(Z1+0.3,c.z)); }
}
function hurt(G, d){
  var p=G.player; p.hp-=d; p.ifr=0.3; G.hurtT=0.25; G.ev.push({t:'hurt', d:d});
  if (p.hp<=0){ p.hp=0; G.phase='dead'; G.ev.push({t:'dead'}); }
}

// ---------- pickups / levels ----------
function stepPickups(G, dt){
  var p=G.player, S=stats(G), mg=S.magnet;
  for (var i=G.gems.length-1;i>=0;i--){ var g=G.gems[i], dx=p.x-g.x, dz=p.z-g.z, d=Math.hypot(dx,dz);
    if (d<mg) g.pull=true;
    if (g.pull){ var sp=Math.max(9, 14-d)*dt; if (d<=sp+0.3){ G.gems.splice(i,1); G.xp+=g.v; G.ev.push({t:'gem', v:g.v}); continue; } g.x+=dx/d*sp; g.z+=dz/d*sp; } }
  for (var k=G.meats.length-1;k>=0;k--){ var m=G.meats[k]; if (Math.hypot(p.x-m.x,p.z-m.z)<1.0){ G.meats.splice(k,1); var h=Math.min(S.maxhp-p.hp, S.maxhp*0.3); p.hp+=h; G.ev.push({t:'heal', v:h}); } }
  while (G.xp>=xpNeed(G.lvl)){ G.xp-=xpNeed(G.lvl); G.lvl++; G.pend++; }
  if (G.pend>0 && G.phase==='play'){ G.phase='levelup'; G.offer=offer(G); G.ev.push({t:'levelup', lvl:G.lvl}); }
}
function offer(G){
  var pool=WEAP.concat(PASS).filter(function(k){ return lv(G,k)<MAXLV; });
  if (!pool.length) return ['gold'];
  var out=[];
  // early on always show at least one brand new weapon
  var fresh=WEAP.filter(function(k){ return !lv(G,k); });
  if (G.lvl<=6 && fresh.length){ var f=fresh[Math.floor(G.rand()*fresh.length)]; out.push(f); pool.splice(pool.indexOf(f),1); }
  while (out.length<3 && pool.length) out.push(pool.splice(Math.floor(G.rand()*pool.length),1)[0]);
  for (var i=out.length-1;i>0;i--){ var j=Math.floor(G.rand()*(i+1)), t=out[i]; out[i]=out[j]; out[j]=t; }
  return out;
}
function choose(G, k){
  if (G.phase!=='levelup') return;
  if (k==='gold'){ G.bonusGold=(G.bonusGold||0)+10; }
  else { G.w[k]=lv(G,k)+1; if (k==='apron'){ G.player.hp=Math.min(stats(G).maxhp, G.player.hp+30); } }
  G.pend--; G.ev.push({t:'chosen', k:k});
  if (G.pend>0) G.offer=offer(G); else { G.offer=null; G.phase='play'; G.player.ifr=Math.max(G.player.ifr,0.6); }
}
function reroll(G){ if (G.phase==='levelup') G.offer=offer(G); }
function revive(G){
  if (G.phase!=='dead') return; var p=G.player; G.revived=true; p.hp=Math.round(stats(G).maxhp*0.6); p.ifr=2.5; G.phase='play';
  G.enemies.slice().forEach(function(e){ var dx=e.x-p.x, dz=e.z-p.z; if (Math.hypot(dx,dz)<6){ if (e.type!=='boss') { e.kx+=dx*3; e.kz+=dz*3; } hit(G,e,40,dx,dz,0); } });
  G.ev.push({t:'revive'});
}
function goldEarned(G){
  var base=G.kills*0.22 + Math.min(G.t,RUN)*0.25 + (G.phase==='win'?80:0) + (G.bonusGold||0);
  return Math.round(base*(1+0.3*(G.night-1))*stats(G).gold);
}

// ---------- main ----------
function step(G, dt, ix, iz){
  if (G.phase!=='play') return;
  G.t+=dt; G.hurtT=Math.max(0,G.hurtT-dt);
  var p=G.player, S=stats(G), m=Math.hypot(ix,iz); if (m>1){ ix/=m; iz/=m; m=1; }
  p.moving=m>0.15; if (p.moving){ p.x+=ix*S.speed*dt; p.z+=iz*S.speed*dt; p.face=Math.atan2(ix,iz); clampP(p); }
  p.ifr=Math.max(0,p.ifr-dt); if (S.regen>0) p.hp=Math.min(S.maxhp, p.hp+S.regen*dt);
  stepSpawn(G,dt); stepWeapons(G,dt); if (G.phase!=='play') return;
  stepShots(G,dt); if (G.phase!=='play') return;
  stepEnemies(G,dt); if (G.phase!=='play') return;
  stepPickups(G,dt);
}
function buyMeta(S, k){ var u=META[k], l=S.meta[k]||0; if (l>=u.max||S.gold<u.cost[l]) return false; S.gold-=u.cost[l]; S.meta[k]=l+1; return true; }
return {W:W, D:D, RUN:RUN, ET:ET, WEAP:WEAP, PASS:PASS, META:META, MAXLV:MAXLV, Z0:Z0, newRun:newRun, step:step, stats:stats, xpNeed:xpNeed,
  choose:choose, reroll:reroll, revive:revive, goldEarned:goldEarned, buyMeta:buyMeta, panRange:panRange, fireRange:fireRange, gobCount:gobCount, gobPos:gobPos, lv:lv};
})();
if (typeof module!=='undefined') module.exports=DJ;
// ===== SIM END =====
