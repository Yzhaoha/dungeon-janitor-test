const DJ=require('./sim.js');
function nearest(a,p){let b=null,bd=1e9;for(const s of a){const d=Math.hypot(s.x-p.x,s.z-p.z);if(d<bd){bd=d;b=s;}}return b;}
function run(seed, skill, mins){
  const G=DJ.newGame(seed); G.tut=99; DJ.makePads(G); G.flow=true;
  const dt=1/20, P=G.player; let log=[], idle=0, hold=null;
  for(let i=0;i<mins*60/dt;i++){
    G.ev.length=0;
    for(const k of ['bag','mop','boots','gob']){ const u=DJ.UPG[k]; if(G.upg[k]<u.max && G.coins>u.cost[G.upg[k]]*2.5 && (k!=='gob'||G.goblins.length)) DJ.buyUpgrade(G,k); }
    let goal=null;
    const roomPad=G.pads.find(p=>p.kind==='room');
    const hire=G.pads.filter(p=>['clean','trap','carry'].includes(p.kind)&&p.cost<=G.coins).sort((a,b)=>a.cost-b.cost)[0];
    if(roomPad && G.coins>=roomPad.cost-roomPad.paid) goal=roomPad;
    else if(hire && (!roomPad || G.coins>=hire.cost+(roomPad.cost-roomPad.paid)*0.4)) goal=hire;
    if(!goal){
      const waitSt=G.heroes.filter(h=>h.need).map(h=>DJ.stById(G,h.path[h.pi].st));
      const emptyCh=G.st.filter(s=>s.k==='chest'&&!s.ok);
      const traps=G.st.filter(s=>(s.k==='trap'||s.k==='door')&&!s.ok);
      const coinsSt=G.st.filter(s=>s.coins>=6);
      const urgent=waitSt.filter(s=>s.k!=='chest'||P.carry>0);
      if(urgent.length) goal=nearest(urgent,P);
      else if(waitSt.some(s=>s.k==='chest')&&P.carry===0) goal=nearest(G.piles,P);
      else if(P.carry>0&&emptyCh.length) goal=nearest(emptyCh,P);
      else if(traps.length) goal=nearest(traps,P);
      else if(emptyCh.length) goal=nearest(G.piles,P);
      else if(coinsSt.length) goal=nearest(coinsSt,P);
      else if(G.slimes.length) goal=nearest(G.slimes,P);
    }
    let ix=0,iz=0;
    if(goal){ let gx=goal.x, gz=goal.z; if(goal.k==='chest'){ gx+= goal.x>0?-1.1:1.1; } const dx=gx-P.x,dz=gz-P.z,d=Math.hypot(dx,dz); if(d>0.3){ix=dx/d;iz=dz/d;} }
    if(Math.random()>skill){ix=0;iz=0;}
    DJ.step(G,dt,ix,iz);
    while(G.stats.roomAt.length>log.length) log.push(Math.round(G.stats.roomAt[log.length]/6)/10);
  }
  return {rooms:G.rooms, at:log.join(' '), gob:JSON.stringify(G.gob), served:G.stats.served, angry:G.stats.angry, heroes:G.heroCount, rep:G.rep.toFixed(2), coins:Math.round(G.coins), upg:Object.values(G.upg).join('')};
}
const skill=+process.argv[2]||0.9, mins=+process.argv[3]||45;
for(let s=1;s<=3;s++) console.log(JSON.stringify(run(s,skill,mins)));
