// Bot playthrough of the tavern sim: node tools/bot.js [skill 0..1] [minutes]
const DJ=require('../src/sim.js');
function dir(P,t){ const s=DJ.nextStep(G_,P,t); const dx=s.x-P.x,dz=s.z-P.z,d=Math.hypot(dx,dz); return d>0.12?[dx/d,dz/d]:[0,0]; }
let G_=null;
function run(seed, skill, mins){
  const G=DJ.newGame(seed); G_=G; G.tut=99; DJ.makePads(G); G.flow=true;
  const dt=1/20, P=G.player; let tl=[];
  for(let i=0;i<mins*60/dt;i++){
    G.ev.length=0;
    if(G.night.phase==='result'){ const c=DJ.offerCards(G); DJ.nextNight(G, G.night.stars? c[0] : null); }
    for(const k of ['tray','boots','grill','gob']){ const u=DJ.UPG[k]; if(G.upg[k]<u.max && G.coins>u.cost[G.upg[k]]*3 && (k!=='gob'||G.goblins.length)&&(k!=='grill'||G.grill.on)) DJ.buyUpgrade(G,k); }
    let goal=null;
    const pad=G.pads.find(p=>p.kind!=='bench');
    const waiting=G.heroes.filter(h=>h.state==='wait');
    if(pad && G.coins>=pad.cost-pad.paid && !waiting.some(h=>h.pat<8)) goal=pad;
    if(!goal){
      const serv=waiting.filter(h=>P.items.includes(h.want)).sort((a,b)=>a.pat-b.pat)[0];
      if(serv) goal=DJ.frontOf(G.tables[serv.tbl]);
      else if(waiting.some(h=>h.want==='beer')&&!P.items.includes('beer')) goal={x:DJ.KEG.fx,z:-7.6};
      else if(waiting.some(h=>h.want==='meat')&&!P.items.includes('meat')&&G.grill.ready>0) goal={x:DJ.GRILL.fx,z:-7.6};
      else if(G.pot.on&&waiting.some(h=>h.want==='potion')&&!P.items.includes('potion')) goal={x:DJ.POT.fx,z:-7.6};
      else if(P.items.length>=DJ.trayCap(G)&&waiting.length) goal={x:DJ.TRASH.x,z:DJ.TRASH.z};
      else { const dirty=G.tables.find(t=>t.on&&(t.dirty||t.coins>0)); if(dirty) goal=DJ.frontOf(dirty); else if(P.items.length<DJ.trayCap(G)) goal={x:DJ.KEG.fx,z:-7.6}; }
    }
    let [ix,iz]=goal?dir(P,goal):[0,0];
    if(Math.random()>skill){ix=0;iz=0;}
    DJ.step(G,dt,ix,iz);
    while(G.stats.unlAt.length>tl.length) tl.push(DJ.UNL[tl.length].k[0]+Math.round(G.stats.unlAt[tl.length]/6)/10);
  }
  return {unl:G.unl, at:tl.join(' '), served:G.stats.served, angry:G.stats.angry, heroes:G.heroCount, rep:G.rep.toFixed(2), coins:Math.round(G.coins), upg:Object.values(G.upg).join(''), gob:G.goblins.length, nights:G.stats.nights.map(n=>n[0]+':'+n[1]+'/'+n[2]+'*'+n[3]).join(' ')};
}
const skill=+process.argv[2]||0.9, mins=+process.argv[3]||20;
for(let s=1;s<=3;s++) console.log(JSON.stringify(run(s,skill,mins)));
