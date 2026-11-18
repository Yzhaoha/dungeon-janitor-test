// ===== SIM START =====
// v0.7 — Potion Sort: pour potions between bottles until every bottle holds one colour.
// Pure logic (node can run it): level generator (always solvable), move rules, solver for hints.
var DJ = (function(){
'use strict';
var CAP = 4, MAXC = 12;
function rnd(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function isKing(l){ return l>=5 && l%5===0; }
function colorsFor(l){
  var steps=[[1,2],[2,3],[3,4],[6,5],[10,6],[15,7],[22,8],[31,9],[42,10],[56,11],[75,12]], c=2;
  steps.forEach(function(s){ if (l>=s[0]) c=s[1]; });
  if (isKing(l)) c++;
  return Math.min(MAXC, c);
}
// mystery layers: only the top of each bottle is known until it is uncovered
function hiddenFor(l){ return l>=8 && (l%3===2 || l>=40); }

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
function gen(level){
  var nc=colorsFor(level);
  for (var att=0; att<60; att++){
    var r=rnd(level*7919+att*104729+17), units=[], i, c;
    for (c=0;c<nc;c++) for (i=0;i<CAP;i++) units.push(c);
    for (i=units.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)), t=units[i]; units[i]=units[j]; units[j]=t; }
    var B=[]; for (c=0;c<nc;c++) B.push(units.slice(c*CAP,(c+1)*CAP));
    B.push([]); B.push([]);
    if (B.some(function(b){ return b.length && uniform(b); })) continue;        // nothing pre-sorted
    var sol=solve(B, 40000); if (!sol) continue;
    if (level>3 && sol.length<nc*2) continue;                                   // too easy, reshuffle
    return {level:level, colors:nc, king:isKing(level), hidden:hiddenFor(level), bottles:B, steps:sol.length};
  }
  return null;
}
function hint(B){ var s=solve(B, 40000); return s && s.length ? s[0] : null; }
function stuck(B){ if (solved(B)) return false; for (var i=0;i<B.length;i++) for (var j=0;j<B.length;j++) if (canPour(B,i,j)) return false; return true; }
return {CAP:CAP, MAXC:MAXC, gen:gen, solve:solve, hint:hint, solved:solved, done:done, canPour:canPour, pourN:pourN, pour:pour, top:top, run:run, uniform:uniform, stuck:stuck,
  colorsFor:colorsFor, isKing:isKing, hiddenFor:hiddenFor};
})();
if (typeof module!=='undefined') module.exports=DJ;
// ===== SIM END =====
