// Checks the potion-sort level generator: node tools/bot.js [levels]
// Every level must generate, be solvable, and generate fast enough for a phone.
const DJ=require('../src/sim.js');
const N=+process.argv[2]||150; let worst=0, bad=0, rows=[];
for (let l=1;l<=N;l++){
  const t0=process.hrtime.bigint(); const L=DJ.gen(l); const ms=Number(process.hrtime.bigint()-t0)/1e6; worst=Math.max(worst,ms);
  if (!L){ bad++; console.log('level',l,'FAILED to generate'); continue; }
  // replay the solver's answer to prove it
  const B=L.bottles.map(b=>b.slice()); const s=DJ.solve(B); let ok=!!s; if (s){ for (const [i,j] of s){ if(!DJ.canPour(B,i,j)){ ok=false; break; } DJ.pour(B,i,j); } ok=ok&&DJ.solved(B); }
  if (!ok){ bad++; console.log('level',l,'NOT solvable'); }
  if (l<=12 || l%10===0) rows.push(`L${l}: ${L.colors} colours, ${L.bottles.length} bottles, ${L.steps} steps${L.king?' KING':''}${L.hidden?' hidden':''} ${ms.toFixed(0)}ms`);
}
console.log(rows.join('\n')); console.log('levels',N,'bad',bad,'slowest',worst.toFixed(0)+'ms');
