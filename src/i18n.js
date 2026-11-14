// ===== I18N =====
// order: en fr it de es tr zh ja ko pt ru
var CODES=['en','fr','it','de','es','tr','zh','ja','ko','pt','ru'];
var LANG_NAMES={en:'English',fr:'Français',it:'Italiano',de:'Deutsch',es:'Español',tr:'Türkçe',zh:'中文',ja:'日本語',ko:'한국어',pt:'Português',ru:'Русский'};
var TL={
  move_kb:['WASD / arrows to move','ZQSD / flèches pour bouger','WASD / frecce per muoverti','WASD / Pfeiltasten zum Laufen','WASD / flechas para moverte','WASD / ok tuşları ile yürü','WASD / 方向键 移动','WASD / 矢印キーで移動','WASD / 방향키로 이동','WASD / setas para andar','WASD / стрелки — ходьба'],
  move_touch:['Drag anywhere to move','Glisse n\'importe où pour bouger','Trascina ovunque per muoverti','Irgendwo ziehen zum Laufen','Arrastra en cualquier sitio para moverte','Yürümek için ekranı sürükle','按住屏幕拖动来走路','画面をドラッグして移動','화면을 드래그해서 이동','Arraste na tela para andar','Тяни по экрану, чтобы идти'],
  t0:['A hero is waiting! Walk next to the trap to reset it','Un héros attend ! Va près du piège pour le réarmer','Un eroe aspetta! Vai vicino alla trappola per riarmarla','Ein Held wartet! Stell dich neben die Falle, um sie zu spannen','¡Un héroe espera! Acércate a la trampa para rearmarla','Bir kahraman bekliyor! Tuzağı kurmak için yanına git','勇者在等你！走到陷阱旁边，站一下就能重置','勇者が待ってる！罠のそばに立ってリセットしよう','용사가 기다려요! 함정 옆에 서서 다시 설치하세요','Um herói está esperando! Fique perto da armadilha para rearmá-la','Герой ждёт! Подойди к ловушке, чтобы взвести её'],
  t1:['He paid! Walk over the coins to grab them','Il a payé ! Marche sur les pièces pour les prendre','Ha pagato! Passa sulle monete per raccoglierle','Er hat bezahlt! Lauf über die Münzen, um sie einzusammeln','¡Ha pagado! Pasa por encima de las monedas para cogerlas','Ödedi! Paraları almak için üstlerinden geç','勇者付钱了！走过去捡金币','お金を払った！コインの上を歩いて拾おう','돈을 냈어요! 동전 위를 지나가서 주우세요','Ele pagou! Passe por cima das moedas para pegá-las','Он заплатил! Пройди по монетам, чтобы собрать их'],
  t2:['The chest is empty — grab gold sacks from the pile','Le coffre est vide : prends des sacs d\'or sur le tas','Il forziere è vuoto: prendi i sacchi d\'oro dal mucchio','Die Truhe ist leer – hol Goldsäcke vom Haufen','El cofre está vacío: coge sacos de oro del montón','Sandık boş — yığından altın çuvalı al','宝箱空了！去金袋堆拿金袋','宝箱が空っぽ！山から金袋を取ろう','상자가 비었어요! 더미에서 금 자루를 가져오세요','O baú está vazio — pegue sacos de ouro na pilha','Сундук пуст — возьми мешки золота из кучи'],
  t3:['Put the gold in the chest','Mets l\'or dans le coffre','Metti l\'oro nel forziere','Leg das Gold in die Truhe','Mete el oro en el cofre','Altını sandığa koy','把金袋放进宝箱','金袋を宝箱に入れよう','금 자루를 상자에 넣으세요','Coloque o ouro no baú','Положи золото в сундук'],
  t4:['More heroes are coming! Keep traps and chests ready, grab the coins','D\'autres héros arrivent ! Garde pièges et coffres prêts, ramasse les pièces','Arrivano altri eroi! Tieni pronte trappole e forzieri, raccogli le monete','Mehr Helden kommen! Halte Fallen und Truhen bereit, sammle die Münzen','¡Vienen más héroes! Ten listas trampas y cofres, recoge las monedas','Daha çok kahraman geliyor! Tuzakları ve sandıkları hazır tut, paraları topla','勇者会一个接一个来！陷阱、宝箱随时准备好，记得捡钱','勇者が次々来るよ！罠と宝箱を準備して、コインを拾おう','용사가 계속 와요! 함정과 상자를 준비하고 동전을 주우세요','Mais heróis vêm aí! Deixe armadilhas e baús prontos e pegue as moedas','Идут новые герои! Держи ловушки и сундуки готовыми, собирай монеты'],
  t6:['Stand on the sign to build a new room','Place-toi sur le panneau pour construire une salle','Mettiti sul cartello per costruire una stanza','Stell dich auf das Schild, um einen Raum zu bauen','Ponte sobre el cartel para construir una sala','Yeni oda kurmak için tabelanın üstünde dur','站到格子上，扩建新房间','看板の上に立って新しい部屋を作ろう','표지판 위에 서서 새 방을 지으세요','Fique na placa para construir uma sala nova','Встань на табличку, чтобы построить комнату'],
  t7:['Hire a goblin to mop the slime for you','Embauche un gobelin pour nettoyer la bave','Assumi un goblin che pulisca la melma','Stell einen Goblin ein, der den Schleim wischt','Contrata a un goblin para fregar el slime','Balçığı silmesi için bir goblin tut','雇个哥布林帮你拖史莱姆','ゴブリンを雇ってスライムを掃除させよう','고블린을 고용해서 슬라임을 닦게 하세요','Contrate um goblin para limpar a gosma','Найми гоблина, чтобы он мыл слизь'],
  t8:['Workbench: upgrade your boots, mop and bag','Établi : améliore bottes, serpillière et sac','Banco da lavoro: migliora stivali, mocio e borsa','Werkbank: verbessere Stiefel, Mopp und Tasche','Banco de trabajo: mejora botas, fregona y bolsa','Tezgâh: botlarını, paspasını ve çantanı geliştir','工具台：升级靴子、拖把和背包','作業台：ブーツ・モップ・バッグを強化','작업대: 장화, 대걸레, 가방을 강화하세요','Bancada: melhore botas, esfregão e bolsa','Верстак: улучшай сапоги, швабру и сумку'],
  goal:['Next: {r}','Suivant : {r}','Prossima: {r}','Als Nächstes: {r}','Siguiente: {r}','Sıradaki: {r}','下一个房间：{r}','次：{r}','다음: {r}','Próxima: {r}','Далее: {r}'],
  allRooms:['Dungeon complete!','Donjon terminé !','Dungeon completato!','Dungeon fertig!','¡Mazmorra completa!','Zindan tamamlandı!','地牢已经全部扩建！','ダンジョン完成！','던전 완성!','Masmorra completa!','Подземелье готово!'],
  slimeHint:['Slime makes heroes slip! Stand on it to mop','La bave fait glisser les héros ! Reste dessus pour nettoyer','La melma fa scivolare gli eroi! Fermati sopra per pulire','Schleim lässt Helden ausrutschen! Stell dich drauf zum Wischen','¡El slime hace resbalar a los héroes! Ponte encima para fregar','Balçık kahramanları kaydırır! Silmek için üstünde dur','史莱姆会让勇者滑倒！站上去拖干净','スライムで勇者が滑る！上に立って掃除しよう','슬라임 때문에 용사가 미끄러져요! 위에 서서 닦으세요','A gosma faz os heróis escorregarem! Fique em cima para limpar','На слизи герои скользят! Встань на неё, чтобы вымыть'],
  bossD2:['Pays ×5 — don\'t keep him waiting!','Paie ×5 : ne le fais pas attendre !','Paga ×5: non farlo aspettare!','Zahlt ×5 – lass ihn nicht warten!','Paga ×5: ¡no le hagas esperar!','×5 öder — onu bekletme!','付 5 倍钱——别让他等！','5倍払う！待たせないで！','5배로 내요. 기다리게 하지 마세요!','Paga ×5 — não o deixe esperando!','Платит ×5 — не заставляй его ждать!'],
  bossWave:['👑 The Hero King!','👑 Le Roi des héros !','👑 Il Re degli eroi!','👑 Der Heldenkönig!','👑 ¡El Rey de los héroes!','👑 Kahramanlar Kralı!','👑 勇者王来了！','👑 勇者王が来た！','👑 용사왕 등장!','👑 O Rei dos heróis!','👑 Король героев!'],
  angry:['Too slow! 😡','Trop lent ! 😡','Troppo lento! 😡','Zu langsam! 😡','¡Muy lento! 😡','Çok yavaş! 😡','太慢了！😡','遅すぎ！😡','너무 느려요! 😡','Muito lento! 😡','Слишком долго! 😡'],
  rep:['Rating','Note','Voto','Bewertung','Valoración','Puan','口碑','評判','평점','Avaliação','Рейтинг'],
  boost:['⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ 加速','⚡ ターボ','⚡ 터보','⚡ Turbo','⚡ Турбо'],
  boostSub:['2 min · ad','2 min · pub','2 min · video','2 Min · Werbung','2 min · anuncio','2 dk · reklam','2 分钟 · 看广告','2分 · 広告','2분 · 광고','2 min · anúncio','2 мин · реклама'],
  boostOn:['⚡ {s}s','⚡ {s} s','⚡ {s}s','⚡ {s} s','⚡ {s} s','⚡ {s} sn','⚡ {s} 秒','⚡ {s}秒','⚡ {s}초','⚡ {s} s','⚡ {s} с'],
  benchTitle:['Workbench','Établi','Banco da lavoro','Werkbank','Banco de trabajo','Tezgâh','工具台','作業台','작업대','Bancada','Верстак'],
  close:['Close','Fermer','Chiudi','Schließen','Cerrar','Kapat','关闭','閉じる','닫기','Fechar','Закрыть'],
  boots:['Boots','Bottes','Stivali','Stiefel','Botas','Bot','靴子','ブーツ','장화','Botas','Сапоги'],
  bootsD:['Walk faster','Marcher plus vite','Cammina più veloce','Schneller laufen','Camina más rápido','Daha hızlı yürü','走得更快','歩くのが速くなる','더 빨리 걷기','Ande mais rápido','Ходить быстрее'],
  mop:['Mop','Serpillière','Mocio','Mopp','Fregona','Paspas','拖把','モップ','대걸레','Esfregão','Швабра'],
  mopD:['Clean & fix faster','Nettoyer et réparer plus vite','Pulisci e ripara più in fretta','Schneller putzen & reparieren','Limpia y repara más rápido','Daha hızlı temizle ve onar','清理和修理更快','掃除と修理が速くなる','청소와 수리가 빨라져요','Limpe e conserte mais rápido','Быстрее мыть и чинить'],
  bag:['Bag','Sac','Borsa','Tasche','Bolsa','Çanta','背包','バッグ','가방','Bolsa','Сумка'],
  bagD:['Carry {n} gold sacks','Porter {n} sacs d\'or','Porta {n} sacchi d\'oro','{n} Goldsäcke tragen','Lleva {n} sacos de oro','{n} altın çuvalı taşı','一次背 {n} 个金袋','金袋を{n}個運べる','금 자루 {n}개 운반','Carregue {n} sacos de ouro','Нести {n} мешков золота'],
  gob:['Goblin coffee','Café gobelin','Caffè goblin','Goblin-Kaffee','Café goblin','Goblin kahvesi','哥布林咖啡','ゴブリンコーヒー','고블린 커피','Café goblin','Кофе для гоблинов'],
  gobD:['Goblins work faster','Les gobelins travaillent plus vite','I goblin lavorano più veloci','Goblins arbeiten schneller','Los goblins trabajan más rápido','Goblinler daha hızlı çalışır','哥布林干活更快','ゴブリンの仕事が速くなる','고블린이 더 빨리 일해요','Os goblins trabalham mais rápido','Гоблины работают быстрее'],
  max:['MAX','MAX','MAX','MAX','MÁX','MAKS','满级','MAX','MAX','MÁX','МАКС'],
  double:['📺 Double it!','📺 Doubler !','📺 Raddoppia!','📺 Verdoppeln!','📺 ¡Duplícalo!','📺 İkiye katla!','📺 翻倍','📺 2倍にする','📺 2배 받기','📺 Dobrar!','📺 Удвоить!'],
  offTitle:['Welcome back!','Bon retour !','Bentornato!','Willkommen zurück!','¡Bienvenido de nuevo!','Tekrar hoş geldin!','欢迎回来！','おかえり！','다시 오신 걸 환영해요!','Bem-vindo de volta!','С возвращением!'],
  offDesc:['Your goblins kept working while you were away','Tes gobelins ont travaillé pendant ton absence','I tuoi goblin hanno lavorato mentre non c\'eri','Deine Goblins haben weitergearbeitet, während du weg warst','Tus goblins siguieron trabajando mientras no estabas','Sen yokken goblinlerin çalışmaya devam etti','你不在的时候，哥布林一直在干活','いない間もゴブリンが働いていたよ','없는 동안 고블린들이 계속 일했어요','Seus goblins continuaram trabalhando enquanto você estava fora','Пока тебя не было, гоблины работали'],
  collect:['Collect','Récupérer','Raccogli','Einsammeln','Recoger','Topla','收下','受け取る','받기','Coletar','Забрать'],
  newRoom:['New room!','Nouvelle salle !','Nuova stanza!','Neuer Raum!','¡Nueva sala!','Yeni oda!','新房间！','新しい部屋！','새 방!','Sala nova!','Новая комната!'],
  hired:['Goblin hired!','Gobelin embauché !','Goblin assunto!','Goblin eingestellt!','¡Goblin contratado!','Goblin işe alındı!','雇到哥布林！','ゴブリンを雇った！','고블린 고용!','Goblin contratado!','Гоблин нанят!'],
  r_hall:['Entrance Hall','Hall d\'entrée','Atrio','Eingangshalle','Vestíbulo','Giriş Salonu','入口大厅','エントランス','입구 홀','Saguão','Входной зал'],
  r_vault:['Treasure Vault','Salle du trésor','Camera del tesoro','Schatzkammer','Cámara del tesoro','Hazine Odası','宝箱库','宝物庫','보물 창고','Câmara do tesouro','Сокровищница'],
  r_hall2:['Trap Corridor','Couloir piégé','Corridoio trappola','Fallengang','Pasillo trampa','Tuzaklı Koridor','陷阱走廊','罠の回廊','함정 복도','Corredor de armadilhas','Коридор ловушек'],
  r_cave:['Slime Cave','Grotte à bave','Grotta melmosa','Schleimhöhle','Cueva de slime','Balçık Mağarası','史莱姆洞','スライム洞窟','슬라임 동굴','Caverna de gosma','Пещера слизи'],
  r_crypt:['Bone Crypt','Crypte d\'os','Cripta d\'ossa','Knochengruft','Cripta de huesos','Kemik Mahzeni','骷髅墓穴','骨の地下墓所','해골 묘지','Cripta de ossos','Склеп костей'],
  r_lava:['Lava Bridge','Pont de lave','Ponte di lava','Lavabrücke','Puente de lava','Lav Köprüsü','熔岩桥','溶岩の橋','용암 다리','Ponte de lava','Лавовый мост'],
  r_ice:['Ice Hall','Salle de glace','Sala di ghiaccio','Eishalle','Sala de hielo','Buz Salonu','冰晶厅','氷の広間','얼음 홀','Salão de gelo','Ледяной зал'],
  r_lair:['Dragon Lair','Antre du dragon','Tana del drago','Drachenhort','Guarida del dragón','Ejderha İni','龙穴','竜の巣','용의 둥지','Covil do dragão','Логово дракона'],
  g_clean:['Mop goblin','Gobelin nettoyeur','Goblin pulitore','Wisch-Goblin','Goblin fregón','Paspas goblini','清洁哥布林','掃除ゴブリン','청소 고블린','Goblin faxineiro','Гоблин-уборщик'],
  g_trap:['Trap goblin','Gobelin des pièges','Goblin trappole','Fallen-Goblin','Goblin trampero','Tuzak goblini','机关哥布林','罠ゴブリン','함정 고블린','Goblin das armadilhas','Гоблин-механик'],
  g_carry:['Carry goblin','Gobelin porteur','Goblin facchino','Träger-Goblin','Goblin cargador','Taşıyıcı goblin','搬运哥布林','運搬ゴブリン','운반 고블린','Goblin carregador','Гоблин-носильщик'],
  adTest:['(test build: ad placeholder)','(version test : pub factice)','(versione di prova: pubblicità finta)','(Testversion: Werbe-Platzhalter)','(versión de prueba: anuncio simulado)','(test sürümü: sahte reklam)','（测试版：广告占位）','（テスト版：広告のダミー）','(테스트 버전: 광고 자리)','(versão de teste: anúncio fictício)','(тестовая версия: заглушка рекламы)'],
  noAd:['No ad available right now','Aucune pub disponible','Nessuna pubblicità disponibile','Gerade keine Werbung verfügbar','No hay anuncios ahora mismo','Şu an reklam yok','暂时没有广告','今は広告がありません','지금은 광고가 없어요','Nenhum anúncio agora','Сейчас нет рекламы'],
  // daily reward + daily tasks
  daily:['Daily reward','Récompense du jour','Premio giornaliero','Tagesbelohnung','Recompensa diaria','Günlük ödül','每日签到','デイリーボーナス','출석 보상','Recompensa diária','Ежедневная награда'],
  dayN:['Day {n}','Jour {n}','Giorno {n}','Tag {n}','Día {n}','{n}. gün','第 {n} 天','{n}日目','{n}일차','Dia {n}','День {n}'],
  claim:['Claim','Récupérer','Riscuoti','Abholen','Reclamar','Al','领取','受け取る','받기','Resgatar','Забрать'],
  streakTip:['Come back every day — day 7 is huge!','Reviens chaque jour : le jour 7 est énorme !','Torna ogni giorno: il giorno 7 è enorme!','Komm jeden Tag – Tag 7 ist riesig!','Vuelve cada día: ¡el día 7 es enorme!','Her gün gel — 7. gün çok büyük!','每天来领，第 7 天大奖！','毎日来てね。7日目は大当たり！','매일 오세요. 7일차는 대박!','Volte todo dia — o dia 7 é enorme!','Заходи каждый день — на 7-й день огромный приз!'],
  tasks:['Daily tasks','Tâches du jour','Compiti del giorno','Tagesaufgaben','Tareas diarias','Günlük görevler','每日任务','デイリータスク','일일 임무','Tarefas diárias','Задания дня'],
  task_serve:['Serve {n} heroes','Servir {n} héros','Servi {n} eroi','{n} Helden bedienen','Atiende a {n} héroes','{n} kahramana hizmet et','接待 {n} 个勇者','勇者を{n}人もてなす','용사 {n}명 접대','Atenda {n} heróis','Обслужи {n} героев'],
  task_mop:['Mop {n} slimes','Nettoyer {n} baves','Pulisci {n} melme','{n} Schleime wischen','Friega {n} slimes','{n} balçık sil','拖掉 {n} 滩史莱姆','スライムを{n}個掃除','슬라임 {n}개 닦기','Limpe {n} gosmas','Вымой {n} луж слизи'],
  task_fix:['Reset {n} traps or chests','Réarmer {n} pièges ou coffres','Riarma {n} trappole o forzieri','{n} Fallen oder Truhen bereitmachen','Prepara {n} trampas o cofres','{n} tuzak ya da sandık hazırla','重置 {n} 个陷阱或宝箱','罠か宝箱を{n}回リセット','함정이나 상자 {n}번 준비','Prepare {n} armadilhas ou baús','Подготовь {n} ловушек или сундуков'],
  allDone:['All done — new tasks tomorrow!','Tout est fait : nouvelles tâches demain !','Tutto fatto: nuovi compiti domani!','Alles erledigt – morgen gibt es neue!','¡Todo hecho! Nuevas tareas mañana','Hepsi tamam — yarın yeni görevler!','全部完成，明天有新任务！','全部完了！明日また新しいタスク','모두 완료! 내일 새 임무가 와요','Tudo feito — novas tarefas amanhã!','Всё готово — завтра новые задания!'],
  taskDone:['Task complete!','Tâche terminée !','Compito completato!','Aufgabe erledigt!','¡Tarea completada!','Görev tamam!','任务完成！','タスク完了！','임무 완료!','Tarefa concluída!','Задание выполнено!']
};
var LANG='en';
function tl(k,v){ var a=TL[k]; if(!a) return k; var s=a[CODES.indexOf(LANG)]||a[0]; if(v) for(var x in v) s=s.split('{'+x+'}').join(v[x]); return s; }
function detectLang(pfLocale){
  try{ var q=new URLSearchParams(location.search).get('lang'); if(q&&CODES.indexOf(q)>=0) return q; }catch(e){}
  try{ var s=localStorage.getItem('dj_lang'); if(s&&CODES.indexOf(s)>=0) return s; }catch(e){}
  var c=[pfLocale, navigator.language].concat(navigator.languages||[]);
  for (var i=0;i<c.length;i++){ var n=(c[i]||'').slice(0,2).toLowerCase(); if(CODES.indexOf(n)>=0) return n; }
  return 'en';
}
// ===== I18N END =====
