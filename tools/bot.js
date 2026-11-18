// Checks the level generator and the fight tuning: node tools/bot.js [levels]
// Every level must generate fast, be solvable, and the solver's own (non-optimal) line must win the fight
// without ever using undo — so a careful human always can.
const DJ=require('../src/sim.js');
const N=+process.argv[2]||150; let worst=0, bad=0, rows=[];
for (let l=1;l<=N;l++){
  const t0=process.hrtime.bigint(); const L=DJ.gen(l); const ms=Number(process.hrtime.bigint()-t0)/1e6; worst=Math.max(worst,ms);
  if (!L){ bad++; console.log('level',l,'FAILED to generate'); continue; }
  const B=L.bottles.map(b=>b.slice()), F=Object.assign({},L.fight), s=DJ.solve(B); let res='?', moves=0, minHp=100;
  for (const [i,j] of s||[]){ if(!DJ.canPour(B,i,j)){ res='illegal'; break; } DJ.pour(B,i,j); moves++;
    if (DJ.done(B[j]) && B[j].length) DJ.drink(F, B[j][0]);
    DJ.monsterTurn(F); minHp=Math.min(minHp,F.hHp);
    if (F.mHp<=0){ res='win'; break; } if (F.hHp<=0){ res='dead'; break; } }
  if (res==='?') res = DJ.solved(B) ? 'win' : 'unsolved';   // everything sorted = finishing blow
  if (res!=='win'){ bad++; console.log('level',l,res,'mHp',F.mHp,'hHp',F.hHp); }
  if (l<=12 || l%10===0) rows.push(`L${l}: ${L.colors} colours, ${L.steps} steps, monster ${L.fight.mMax}hp hits ${L.fight.mDmg} every ${L.fight.interval} | solver wins in ${moves}, lowest hero hp ${minHp}${L.king?' BOSS':''}${L.hidden?' hidden':''} ${ms.toFixed(0)}ms`);
}
console.log(rows.join('\n')); console.log('levels',N,'bad',bad,'slowest',worst.toFixed(0)+'ms');
