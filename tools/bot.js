// Checks the level generator and the fight tuning: node tools/bot.js [floors]
// Every room of every floor must generate fast and be solvable, and the solver's own (non-optimal) line, with no upgrades,
// no gear, no skills and no undo, must carry the hero down the main corridor to the boss (health carries over, +15 between rooms).
// It also reports how often clearing every side room on the way (elites included, rests used) would still survive.
const DJ=require('../src/sim.js');
const N=+process.argv[2]||100; let worst=0, bad=0, rows=[], rooms=0, pours=0, fullDead=0;
function run(l, order, log){
  const M=DJ.mapOf(l); let hp=100, low=100, tot=0, desc=[];
  for (const id of order(M)){ const R=M.rooms[id];
    if (R.t==='r'){ hp=Math.min(100,hp+35); continue; } if (R.t==='c') continue;
    const t0=process.hrtime.bigint(); const L=DJ.gen(l,id,0,R.t); const ms=Number(process.hrtime.bigint()-t0)/1e6; worst=Math.max(worst,ms);
    if (!L) return {res:'nogen', room:id};
    const B=L.bottles.map(b=>b.slice()), F=Object.assign({},L.fight), sol=DJ.solve(B); let res='?'; F.hHp=hp;
    for (const [i,j] of sol||[]){ if(!DJ.canPour(B,i,j)){ res='illegal'; break; } DJ.pour(B,i,j); tot++;
      F.moves++; if (DJ.done(B[j]) && B[j].length) DJ.drink(F, B[j][0]); F.moves--;
      DJ.monsterTurn(F); low=Math.min(low,F.hHp);
      if (F.mHp<=0){ res='win'; break; } if (F.hHp<=0){ res='dead'; break; } }
    if (res==='?') res = DJ.solved(B) ? 'win' : 'unsolved';
    if (res!=='win') return {res, room:id, low};
    desc.push(`${R.t}:${L.colors}c/${L.steps}st/trap${L.trap.toFixed(2)}/${L.fight.mMax}hp/hit${L.fight.mDmg}`); hp=Math.min(100,F.hHp+15); }
  return {res:'win', low, tot, desc};
}
const mainOnly=M=>M.rooms.map((r,i)=>i).filter(i=>M.rooms[i].main>=0).sort((a,b)=>M.rooms[a].main-M.rooms[b].main);
const everything=M=>{ const out=[], seen={}; const side=id=>{ seen[id]=1; out.push(id); M.rooms[id].links.forEach(k=>{ if(!seen[k] && M.rooms[k].main<0) side(k); }); };
  mainOnly(M).forEach(id=>{ seen[id]=1; M.rooms[id].links.forEach(k=>{ if(!seen[k] && M.rooms[k].main<0) side(k); }); out.push(id); }); return out; };
for (let l=1;l<=N;l++){
  const a=run(l, mainOnly), M=DJ.mapOf(l); rooms+=M.rooms.length;
  if (a.res!=='win'){ bad++; console.log('floor',l,'room',a.room,a.res); continue; }
  const f=run(l, everything); if (f.res!=='win') fullDead++;
  pours+=a.tot;
  if (l<=8 || l%6===0) rows.push(`F${l} ${DJ.kindOf(l)} ${M.w}x${M.h} ${M.rooms.length} rooms: ${a.desc.join('  ')} | ${a.tot} pours, lowest hp ${a.low} | full clear: ${f.res}${f.res==='win'?' '+f.tot+' pours, low '+f.low:''}`);
}
console.log(rows.join('\n')); console.log('floors',N,'rooms',rooms,'pours',pours,'bad',bad,'full clear fails',fullDead,'slowest',worst.toFixed(0)+'ms');
