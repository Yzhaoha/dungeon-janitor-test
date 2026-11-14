// ===== I18N =====
var CODES=['en','zh'];
var LANG_NAMES={en:'English',zh:'中文'};
var TL={
  move_kb:['WASD / arrows to move','WASD / 方向键 移动'],
  move_touch:['Drag anywhere to move','按住屏幕拖动来走路'],
  t0:['A hero is waiting! Walk next to the trap to reset it','勇者在等你！走到陷阱旁边，站一下就能重置'],
  t1:['He paid! Walk over the coins to grab them','勇者付钱了！走过去捡金币'],
  t2:['The chest is empty — grab gold sacks from the pile','宝箱空了！去金袋堆拿金袋'],
  t3:['Put the gold in the chest','把金袋放进宝箱'],
  t4:['More heroes are coming! Keep traps and chests ready, grab the coins','勇者会一个接一个来！陷阱、宝箱随时准备好，记得捡钱'],
  t5:['They made a mess! Tidy up before the next wave','他们把地牢弄乱了！下一波来之前收拾好'],
  t6:['Stand on the sign to build a new room','站到格子上，扩建新房间'],
  t7:['Hire a goblin to mop the slime for you','雇个哥布林帮你拖史莱姆'],
  t8:['Workbench: upgrade your boots, mop and bag','工具台：升级靴子、拖把和背包'],
  goal:['Next: {r}','下一个房间：{r}'],
  allRooms:['Dungeon complete!','地牢已经全部扩建！'],
  slimeHint:['Slime makes heroes slip! Stand on it to mop','史莱姆会让勇者滑倒！站上去拖干净'],
  bossD2:['Pays ×5 — don\'t keep him waiting!','付 5 倍钱——别让他等！'],
  angry:['Too slow! 😡','太慢了！😡'],
  day:['Day {n}','第 {n} 天'],
  wave:['Wave {a}/{b}','第 {a}/{b} 波'],
  next:['next in {s}s','{s} 秒后到'],
  heroesIn:['heroes inside','勇者正在闯关'],
  dayOver:['Day complete!','今天结束！'],
  waitTut:['Get ready…','准备…'],
  rep:['Rating','口碑'],
  boost:['⚡ Turbo','⚡ 加速'],
  boostSub:['2 min · ad','2 分钟 · 看广告'],
  boostOn:['⚡ {s}s','⚡ {s} 秒'],
  benchTitle:['Workbench','工具台'],
  close:['Close','关闭'],
  boots:['Boots','靴子'], bootsD:['Walk faster','走得更快'],
  mop:['Mop','拖把'], mopD:['Clean & fix faster','清理和修理更快'],
  bag:['Bag','背包'], bagD:['Carry {n} gold sacks','一次背 {n} 个金袋'],
  gob:['Goblin coffee','哥布林咖啡'], gobD:['Goblins work faster','哥布林干活更快'],
  max:['MAX','满级'],
  earned:['Earned today','今天收入'],
  nextDay:['Next day','开始下一天'],
  double:['📺 Double it!','📺 收入翻倍'],
  bossNext:['Tomorrow: the Hero King comes!','明天：勇者王要来了！'],
  evtNext:['Tomorrow: {e}','明天：{e}'],
  offTitle:['Welcome back!','欢迎回来！'],
  offDesc:['Your goblins kept working while you were away','你不在的时候，哥布林一直在干活'],
  collect:['Collect','收下'],
  ev_slime:['Slime outbreak','史莱姆爆发'], ev_slimeD:['Twice the slime, but mopping pays ×3','史莱姆翻倍，但拖地收入 ×3'],
  ev_inspector:['Inspector visit','巡查员来访'], ev_inspectorD:['Wave 3 brings an inspector — a spotless dungeon earns a big bonus','第 3 波有巡查员，地牢一尘不染就有大奖'],
  ev_thief:['Thief alert','小偷出没'], ev_thiefD:['A thief sneaks in to rob chests — bump into him for a bounty!','小偷会溜进来偷宝箱，撞到他就能拿赏金！'],
  ev_tour:['Tour group','新手旅行团'], ev_tourD:['Huge hero parties all day: more cash, more mess','今天勇者人特别多：钱多，也特别乱'],
  bossDay:['Boss day!','Boss 日！'], bossD:['The Hero King arrives in the last wave. Have every trap armed and every chest full!','勇者王会在最后一波出现。把所有陷阱就绪、宝箱装满！'],
  bossWave:['👑 The Hero King!','👑 勇者王来了！'],
  newRoom:['New room!','新房间！'],
  hired:['Goblin hired!','雇到哥布林！'],
  r_hall:['Entrance Hall','入口大厅'], r_vault:['Treasure Vault','宝箱库'], r_hall2:['Trap Corridor','陷阱走廊'], r_cave:['Slime Cave','史莱姆洞'],
  r_crypt:['Bone Crypt','骷髅墓穴'], r_lava:['Lava Bridge','熔岩桥'], r_ice:['Ice Hall','冰晶厅'], r_lair:['Dragon Lair','龙穴'],
  g_clean:['Mop goblin','清洁哥布林'], g_trap:['Trap goblin','机关哥布林'], g_carry:['Carry goblin','搬运哥布林'],
  bored:['Too easy! 😒','太无聊了！😒'],
  bounty:['Thief caught!','抓到小偷！'],
  inspOk:['Inspector: spotless! ✨','巡查员：一尘不染！✨'],
  inspBad:['Inspector: filthy…','巡查员：太脏了…'],
  adTest:['(test build: ad placeholder)','（测试版：广告占位）'],
  noAd:['No ad available right now','暂时没有广告'],
  full:['Bag full','背包满了'],
  needSack:['Need gold sacks','需要金袋']
};
var LANG='en';
function tl(k,v){ var a=TL[k]; if(!a) return k; var s=a[CODES.indexOf(LANG)]||a[0]; if(v) for(var x in v) s=s.split('{'+x+'}').join(v[x]); return s; }
function detectLang(){
  try{ var q=new URLSearchParams(location.search).get('lang'); if(q&&CODES.indexOf(q)>=0) return q; }catch(e){}
  try{ var s=localStorage.getItem('dj_lang'); if(s&&CODES.indexOf(s)>=0) return s; }catch(e){}
  var n=(navigator.language||'en').slice(0,2).toLowerCase(); return CODES.indexOf(n)>=0?n:'en';
}
// ===== I18N END =====
