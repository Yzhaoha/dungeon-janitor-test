// Checks the level generator and the fight tuning: node tools/bot.js [floors]
// Every room of every floor must generate fast and be solvable, and the solver's own (non-optimal) line, with no upgrades,
// no gear, no skills and no undo, must carry the hero through the whole floor (health carries over, +15 between rooms).
const DJ=require('../src/sim.js');
const N=+process.argv[2]||100; let worst=0, bad=0, rows=[], rooms=0, pours=0;
for (let l=1;l<=N;l++){
  let hp=100, low=100, tot=0, desc=[];
  for (let s=0;s<DJ.stagesOf(l);s++){ rooms++;
    const t0=process.hrtime.bigint(); const L=DJ.gen(l,s); const ms=Number(process.hrtime.bigint()-t0)/1e6; worst=Math.max(worst,ms);
    if (!L){ bad++; console.log('floor',l,'room',s,'FAILED to generate'); continue; }
    const B=L.bottles.map(b=>b.slice()), F=Object.assign({},L.fight), sol=DJ.solve(B); let res='?'; F.hHp=hp;
    for (const [i,j] of sol||[]){ if(!DJ.canPour(B,i,j)){ res='illegal'; break; } DJ.pour(B,i,j); tot++;
      if (DJ.done(B[j]) && B[j].length) DJ.drink(F, B[j][0]);
      DJ.monsterTurn(F); low=Math.min(low,F.hHp);
      if (F.mHp<=0){ res='win'; break; } if (F.hHp<=0){ res='dead'; break; } }
    if (res==='?') res = DJ.solved(B) ? 'win' : 'unsolved';
    if (res!=='win'){ bad++; console.log('floor',l,'room',s,res,'mHp',F.mHp,'hHp',F.hHp); break; }
    desc.push(`${L.colors}c/${L.steps}st/${L.fight.mMax}hp/hit${L.fight.mDmg}`); hp=Math.min(100,F.hHp+15);
  }
  pours+=tot;
  if (l<=8 || l%6===0) rows.push(`F${l} ${DJ.kindOf(l)}: ${desc.join('  ')} | ${tot} pours, lowest hp ${low}`);
}
console.log(rows.join('\n')); console.log('floors',N,'rooms',rooms,'pours',pours,'bad',bad,'slowest',worst.toFixed(0)+'ms');
