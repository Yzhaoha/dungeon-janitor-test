// Bot playthrough of the brawl sim: node tools/bot.js [night] [metaLevel 0..5] [runs]
// The bot kites: runs away from nearby monsters, drifts toward coins, picks random upgrades.
const DJ=require('../src/sim.js');
function run(seed, night, ml){
  const meta={hp:ml,power:ml,speed:ml,magnet:ml,gold:ml};
  const G=DJ.newRun(meta, night, seed), dt=1/30, P=G.player; let rs=seed*7+1;
  const rnd=()=>{ rs=(rs*1103515245+12345)&0x7fffffff; return rs/0x7fffffff; };
  for (let i=0;i<(DJ.RUN+180)/dt;i++){
    G.ev.length=0;
    if (G.phase==='levelup'){ const smart=process.argv[5]==='smart', o=G.offer, w=o.filter(k=>DJ.WEAP.includes(k)); DJ.choose(G, smart&&w.length? w[Math.floor(rnd()*w.length)] : o[Math.floor(rnd()*o.length)]); continue; }
    if (G.phase!=='play') break;
    let ix=0, iz=0;
    for (const e of G.enemies){ const dx=P.x-e.x, dz=P.z-e.z, d=Math.hypot(dx,dz)-e.r; if (d<5){ const w=1/Math.max(0.3,d)**2; ix+=dx*w; iz+=dz*w; } }
    for (const g of G.gems){ const dx=g.x-P.x, dz=g.z-P.z, d=Math.hypot(dx,dz); if (d<6){ ix+=dx/d*0.15; iz+=dz/d*0.15; } }
    ix+=-P.x*0.02; iz+=(-DJ.D/2-P.z)*0.02;
    const m=Math.hypot(ix,iz); if (m>0){ ix/=m; iz/=m; }
    DJ.step(G,dt,ix,iz);
  }
  return {end:G.phase, t:Math.round(G.t), lvl:G.lvl, kills:G.kills, hp:Math.round(P.hp), gold:DJ.goldEarned(G), w:Object.entries(G.w).map(a=>a[0][0]+a[0][1]+a[1]).join(' ')};
}
const night=+process.argv[2]||1, ml=+process.argv[3]||0, runs=+process.argv[4]||8;
let wins=0, tt=0;
for (let s=1;s<=runs;s++){ const r=run(s,night,ml); if(r.end==='win') wins++; tt+=r.t; console.log(JSON.stringify(r)); }
console.log('night',night,'meta',ml,'wins',wins+'/'+runs,'avg t',Math.round(tt/runs));
