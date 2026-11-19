// ===== SIM START =====
// v0.8 — Potion Brawl: sort potions; every bottle you complete is drunk by the hero and becomes a move
// (attack / shield / heal / stun / poison) against the monster, which strikes back every few pours.
// Pure logic (node can run it): level generator (always solvable), move rules, solver for hints.
var DJ = (function(){
'use strict';
var CAP = 4, MAXC = 12;
function rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// A floor is several rooms in a row: 3 on a normal floor, 5 on a boss floor (every 6th), 7 on a great-boss floor (every 24th).
// Only the last room of a boss floor holds the boss; the hero's health carries from room to room.
function kindOf(l){ return l%24===0 ? 'big' : (l%6===0 ? 'boss' : 'n'); }
function stagesOf(l){ return {n:3, boss:5, big:7}[kindOf(l)]; }
function roleOf(l,s){ return s<stagesOf(l)-1 || kindOf(l)==='n' ? 'min' : kindOf(l); }
function isKing(l){ return kindOf(l)!=='n'; }
function colorsFor(l,s){
  if (l===1) return s===0 ? 2 : 3;
  var steps=[[1,3],[3,4],[9,5],[19,6],[31,7],[49,8],[73,9]], c=3, r=roleOf(l,s||0);
  steps.forEach(function(q){ if (l>=q[0]) c=q[1]; });
  if (r==='boss') c+=1; else if (r==='big') c+=2; else if (kindOf(l)!=='n') c-=2;   // the rooms before a boss are quick ones
  return Math.max(3, Math.min(MAXC, c));
}
// mystery layers: only the top of each bottle is known until it is uncovered
function hiddenFor(l,s){ return l>=10 && roleOf(l,s||0)==='min' && (l+(s||0))%3===2; }

function top(b){ return b[b.length-1]; }
function uniform(b){ for (var i=1;i<b.length;i++) if (b[i]!==b[0]) return false; return true; }
function done(b){ return b.length===0 || (b.length===CAP && uniform(b)); }
function solved(B){ for (var i=0;i<B.length;i++) if (!done(B[i])) return false; return true; }
function canPour(B,i,j){ var a=B[i], b=B[j]; return i!==j && a.length>0 && b.length<CAP && (b.length===0 || top(b)===top(a)); }
function run(b){ var n=1; for (var i=b.length-2;i>=0 && b[i]===top(b);i--) n++; return n; }
function pourN(B,i,j){ return Math.min(run(B[i]), CAP-B[j].length); }
function pour(B,i,j){ var n=pourN(B,i,j), c=top(B[i]); for (var k=0;k<n;k++){ B[i].pop(); B[j].push(c); } return n; }
// moves worth trying (skips the pointless ones)
function moves(B){
  var out=[], emptySeen;
  for (var i=0;i<B.length;i++){ var a=B[i]; if (!a.length || (a.length===CAP && uniform(a))) continue; emptySeen=false;
    for (var j=0;j<B.length;j++){ if (!canPour(B,i,j)) continue;
      if (B[j].length===0){ if (emptySeen || uniform(a)) continue; emptySeen=true; out.push([i,j,1]); }
      else { if (pourN(B,i,j)<run(a) && uniform(a)) continue; out.push([i,j,0]); } } }
  out.sort(function(x,y){ return x[2]-y[2]; });
  return out;
}
function key(B){ return B.map(function(b){ return b.join(','); }).sort().join('|'); }
// depth-first search with a node budget; returns a list of [from,to] or null
function solve(B0, budget){
  var B=B0.map(function(b){ return b.slice(); }), seen={}, path=[], nodes=0, lim=budget||60000;
  function dfs(){
    if (solved(B)) return true;
    if (++nodes>lim) return false;
    var k=key(B); if (seen[k]) return false; seen[k]=1;
    var ms=moves(B);
    for (var m=0;m<ms.length;m++){ var i=ms[m][0], j=ms[m][1], n=pour(B,i,j); path.push([i,j]);
      if (dfs()) return true;
      path.pop(); var c=top(B[j]); for (var q=0;q<n;q++){ B[j].pop(); B[i].push(c); }
      if (nodes>lim) return false; }
    return false;
  }
  return dfs() ? path : null;
}
function gen(level, stage){
  stage=stage||0; var nc=colorsFor(level,stage);
  for (var att=0; att<80; att++){
    var r=rnd(level*7919+stage*15485863+att*104729+17), units=[], i, c;
    for (c=0;c<nc;c++) for (i=0;i<CAP;i++) units.push(c);
    for (i=units.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)), t=units[i]; units[i]=units[j]; units[j]=t; }
    var B=[]; for (c=0;c<nc;c++) B.push(units.slice(c*CAP,(c+1)*CAP));
    B.push([]); B.push([]);
    if (B.some(function(b){ return b.length && uniform(b); })) continue;        // nothing pre-sorted
    var sol=solve(B, 40000); if (!sol) continue;
    if (level>1 && sol.length<nc*2) continue;                                   // too easy, reshuffle
    var L={level:level, stage:stage, stages:stagesOf(level), kind:kindOf(level), role:roleOf(level,stage), colors:nc, hidden:hiddenFor(level,stage), bottles:B, steps:sol.length};
    L.king=L.role!=='min';
    L.fight=fight(L); L.fight.mHp=L.fight.mMax; return L;
  }
  return null;
}
// ---------- fight ----------
// what a full bottle of each colour does (same order as the palette in game.js)
// ordered so that from 4 colours on there are always at least two attack potions (a fight is never one hit long)
var ROLE=['atk','shd','heal','atk','stun','psn','atk','shd','atk','heal','stun','psn'];
// The monster's hit is sized so that a whole floor, played along the solver's line with no upgrades, costs less than the hero's
// 100 health: each room gets a share of that budget (the boss room the biggest one).
function fight(L){
  var na=0, i; for (i=0;i<L.colors;i++) if (ROLE[i]==='atk'||ROLE[i]==='psn') na++;
  var ATK=25, interval=L.level<4?6:5, hits=Math.ceil(L.steps*1.4/interval)+1;
  var w= L.kind==='n' ? 0.5 : (L.kind==='boss' ? (L.role==='boss'?0.8:0.2) : (L.role==='big'?0.88:0.15));
  var hpK=Math.min(2,1+0.01*(L.level-1))*(L.role==='big'?1.3:(L.role==='boss'?1.1:1));
  return {atk:ATK, heroMax:100, hHp:100, shield:0, heal:35, stun:4, psn:3, poison:0, def:0, crit:0,
    mMax:Math.max(20, Math.round(ATK*na*hpK/5)*5), mHp:0, interval:interval, cd:interval, mDmg:Math.max(4, Math.ceil(100*w/hits))};
}
// a completed bottle of colour c is drunk
function drink(F, c){
  var r=ROLE[c], ev={role:r, c:c};
  if (r==='atk'){ ev.v=F.atk; if (F.crit>0 && Math.random()<F.crit){ ev.v*=2; ev.crit=true; } F.mHp-=ev.v; } else if (r==='psn'){ F.poison+=F.psn; } else if (r==='shd'){ F.shield++; }
  else if (r==='heal'){ ev.v=Math.min(F.heal, F.heroMax-F.hHp); F.hHp+=ev.v; } else if (r==='stun'){ F.cd+=F.stun; }
  return ev;
}
// after every pour: poison ticks, the countdown drops, the monster may strike
function monsterTurn(F){
  var ev={};
  if (F.mHp<=0) return ev;
  if (F.poison>0){ F.mHp-=F.poison; ev.psn=F.poison; if (F.mHp<=0) return ev; }
  F.cd--; if (F.cd<=0){ F.cd=F.interval; if (F.shield>0){ F.shield--; ev.blocked=true; } else { ev.hit=Math.max(1,F.mDmg-(F.def||0)); F.hHp-=ev.hit; } }
  return ev;
}
function hint(B){ var s=solve(B, 40000); return s && s.length ? s[0] : null; }
function stuck(B){ if (solved(B)) return false; for (var i=0;i<B.length;i++) for (var j=0;j<B.length;j++) if (canPour(B,i,j)) return false; return true; }
return {ROLE:ROLE, drink:drink, monsterTurn:monsterTurn, CAP:CAP, MAXC:MAXC, gen:gen, solve:solve, hint:hint, solved:solved, done:done, canPour:canPour, pourN:pourN, pour:pour, top:top, run:run, uniform:uniform, stuck:stuck,
  colorsFor:colorsFor, isKing:isKing, hiddenFor:hiddenFor, kindOf:kindOf, stagesOf:stagesOf, roleOf:roleOf};
})();
if (typeof module!=='undefined') module.exports=DJ;
// ===== SIM END =====
