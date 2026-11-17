// ===== I18N =====
// order: en fr it de es tr zh ja ko pt ru
var CODES=['en','fr','it','de','es','tr','zh','ja','ko','pt','ru'];
var LANG_NAMES={en:'English',fr:'Français',it:'Italiano',de:'Deutsch',es:'Español',tr:'Türkçe',zh:'中文',ja:'日本語',ko:'한국어',pt:'Português',ru:'Русский'};
var TL={
  t0:['A hero wants beer! Walk to the keg to pour one 🍺','Un héros veut une bière ! Va au tonneau pour en servir une 🍺','Un eroe vuole una birra! Vai alla botte e spillala 🍺','Ein Held will Bier! Geh zum Fass und zapf eins 🍺','¡Un héroe quiere cerveza! Ve al barril a servir una 🍺','Bir kahraman bira istiyor! Fıçıya git ve doldur 🍺','勇者想喝啤酒！走到酒桶前接一杯 🍺','勇者がビールを注文！樽の前でついでね 🍺','용사가 맥주를 원해요! 술통 앞에 가서 따르세요 🍺','Um herói quer cerveja! Vá ao barril e sirva uma 🍺','Герой хочет пива! Подойди к бочке и налей 🍺'],
  t1:['Bring it to his table!','Apporte-la à sa table !','Portala al suo tavolo!','Bring es an seinen Tisch!','¡Llévala a su mesa!','Masasına götür!','端过去！走到他的桌子旁边','テーブルまで運ぼう！','그의 테이블로 가져가세요!','Leve até a mesa dele!','Отнеси к его столу!'],
  t2a:['Cheers! He is drinking…','Santé ! Il boit…','Salute! Sta bevendo…','Prost! Er trinkt…','¡Salud! Está bebiendo…','Şerefe! İçiyor…','干杯！他在喝……','乾杯！飲んでるよ…','건배! 마시는 중…','Saúde! Ele está bebendo…','Будем! Он пьёт…'],
  t2:['He paid! Grab the coins and wipe the table','Il a payé ! Prends les pièces et essuie la table','Ha pagato! Prendi le monete e pulisci il tavolo','Er hat bezahlt! Nimm die Münzen und wisch den Tisch','¡Ha pagado! Coge las monedas y limpia la mesa','Ödedi! Paraları al ve masayı sil','付钱了！走过去捡钱，顺手擦桌子','お金を払った！コインを拾ってテーブルを拭こう','돈을 냈어요! 동전을 줍고 테이블을 닦으세요','Ele pagou! Pegue as moedas e limpe a mesa','Он заплатил! Забери монеты и протри стол'],
  t3:['More heroes are coming! Look above their heads and bring what they want','D\'autres héros arrivent ! Regarde au-dessus de leur tête et apporte ce qu\'ils veulent','Arrivano altri eroi! Guarda sopra la loro testa e porta ciò che vogliono','Mehr Helden kommen! Schau über ihre Köpfe und bring, was sie wollen','¡Vienen más héroes! Mira sobre su cabeza y llévales lo que piden','Daha çok kahraman geliyor! Başlarının üstüne bak, istediklerini getir','勇者会一个接一个来！看头顶要什么，就端什么','勇者が次々来るよ！頭の上を見て、欲しい物を運ぼう','용사가 계속 와요! 머리 위를 보고 원하는 걸 가져다주세요','Mais heróis vêm aí! Olhe acima da cabeça deles e leve o que pedem','Идут новые герои! Смотри, что над головой, и неси это'],
  t4:['Enough gold! Stand on the sign to buy a new table','Assez d\'or ! Place-toi sur le panneau pour acheter une table','Abbastanza oro! Mettiti sul cartello per comprare un tavolo','Genug Gold! Stell dich aufs Schild, um einen Tisch zu kaufen','¡Ya tienes oro! Ponte sobre el cartel para comprar una mesa','Yeterli altın! Yeni masa için tabelanın üstünde dur','钱够了！站到格子上买新桌子','お金がたまった！看板に乗って新しいテーブルを買おう','돈이 모였어요! 표지판 위에 서서 테이블을 사세요','Ouro suficiente! Fique na placa para comprar uma mesa','Хватает золота! Встань на табличку, чтобы купить стол'],
  t5:['Unlock the grill — roast meat pays double!','Débloque le grill : la viande rapporte le double !','Sblocca la griglia: la carne paga il doppio!','Schalte den Grill frei – Braten bringt doppelt!','Desbloquea la parrilla: ¡la carne paga el doble!','Izgarayı aç — et iki kat kazandırır!','解锁烤肉架：烤肉卖双倍价钱！','グリルを解放！お肉は2倍のお値段！','그릴을 열어요! 고기는 두 배 가격!','Desbloqueie a grelha: carne paga o dobro!','Открой гриль — мясо стоит вдвое дороже!'],
  t6:['The grill cooks by itself. Grab the meat 🍖','Le grill cuit tout seul. Prends la viande 🍖','La griglia cuoce da sola. Prendi la carne 🍖','Der Grill brät von selbst. Hol dir das Fleisch 🍖','La parrilla cocina sola. Coge la carne 🍖','Izgara kendi pişirir. Eti al 🍖','烤架会自己烤，走过去拿肉 🍖','グリルは自動で焼けるよ。お肉を取ろう 🍖','그릴은 알아서 구워요. 고기를 가져가세요 🍖','A grelha assa sozinha. Pegue a carne 🍖','Гриль жарит сам. Возьми мясо 🍖'],
  t7:['Workbench: faster boots, bigger tray, faster grill','Établi : bottes rapides, plus grand plateau, grill plus rapide','Banco: stivali veloci, vassoio più grande, griglia più rapida','Werkbank: schnellere Stiefel, größeres Tablett, schnellerer Grill','Banco: botas rápidas, bandeja más grande, parrilla más rápida','Tezgâh: hızlı bot, büyük tepsi, hızlı ızgara','工具台：升级鞋子、托盘、烤架','作業台：靴・トレー・グリルを強化','작업대: 장화, 쟁반, 그릴 강화','Bancada: botas rápidas, bandeja maior, grelha mais rápida','Верстак: быстрые сапоги, большой поднос, быстрый гриль'],
  trashHint:['Wrong order? Drop it in the bin on the right','Mauvaise commande ? Jette-la dans la poubelle à droite','Ordine sbagliato? Buttalo nel secchio a destra','Falsche Bestellung? Wirf sie rechts in den Eimer','¿Pedido equivocado? Tíralo al cubo de la derecha','Yanlış sipariş mi? Sağdaki çöpe at','拿错了？右边有垃圾桶可以扔掉','注文違い？右のゴミ箱に捨てよう','잘못 가져왔어요? 오른쪽 쓰레기통에 버리세요','Pedido errado? Jogue no lixo à direita','Не то? Выброси в ведро справа'],
  goal:['Next: {r}','Suivant : {r}','Prossimo: {r}','Als Nächstes: {r}','Siguiente: {r}','Sıradaki: {r}','下一个：{r}','次：{r}','다음: {r}','Próximo: {r}','Далее: {r}'],
  allUnl:['All unlocked! Private rooms & potions coming soon','Tout est débloqué ! Salons privés et potions bientôt','Tutto sbloccato! Salette e pozioni in arrivo','Alles frei! Séparées & Tränke kommen bald','¡Todo desbloqueado! Pronto: reservados y pociones','Hepsi açıldı! Özel odalar ve iksirler yakında','全部解锁！包间和药水即将推出','全部解放！個室とポーションは近日公開','모두 열었어요! 별실과 물약은 곧 나와요','Tudo liberado! Salas privadas e poções em breve','Всё открыто! Скоро: кабинеты и зелья'],
  soon:['Soon','Bientôt','Presto','Bald','Pronto','Yakında','即将推出','近日公開','곧 출시','Em breve','Скоро'],
  u_table:['New table','Nouvelle table','Nuovo tavolo','Neuer Tisch','Mesa nueva','Yeni masa','新桌子','新しいテーブル','새 테이블','Mesa nova','Новый стол'],
  u_grill:['Roast grill','Grill à rôtir','Griglia','Bratgrill','Parrilla','Kebap ızgarası','烤肉架','肉焼きグリル','고기 그릴','Grelha','Гриль'],
  u_wiper:['Cleaner goblin','Gobelin nettoyeur','Goblin pulitore','Putz-Goblin','Goblin limpiador','Temizlikçi goblin','擦桌哥布林','掃除ゴブリン','청소 고블린','Goblin faxineiro','Гоблин-уборщик'],
  u_waiter:['Waiter goblin','Gobelin serveur','Goblin cameriere','Kellner-Goblin','Goblin camarero','Garson goblin','跑堂哥布林','給仕ゴブリン','서빙 고블린','Goblin garçom','Гоблин-официант'],
  unlocked:['Unlocked!','Débloqué !','Sbloccato!','Freigeschaltet!','¡Desbloqueado!','Açıldı!','解锁！','解放！','해금!','Desbloqueado!','Открыто!'],
  bossD2:['Orders twice, pays ×5!','Commande deux fois, paie ×5 !','Ordina due volte, paga ×5!','Bestellt zweimal, zahlt ×5!','Pide dos veces, ¡paga ×5!','İki kez sipariş, ×5 öder!','点两样，付 5 倍钱！','2回注文して5倍払う！','두 번 주문, 5배 지불!','Pede duas vezes, paga ×5!','Заказывает дважды, платит ×5!'],
  tray:['Tray','Plateau','Vassoio','Tablett','Bandeja','Tepsi','托盘','トレー','쟁반','Bandeja','Поднос'],
  trayD:['Carry {n} items','Porter {n} objets','Porta {n} oggetti','{n} Sachen tragen','Lleva {n} cosas','{n} şey taşı','一次端 {n} 样','{n}個運べる','{n}개 운반','Carregue {n} itens','Нести {n} предметов'],
  grill:['Grill','Grill','Griglia','Grill','Parrilla','Izgara','烤架','グリル','그릴','Grelha','Гриль'],
  grillD:['Meat cooks faster','La viande cuit plus vite','La carne cuoce più in fretta','Fleisch brät schneller','La carne se hace más rápido','Et daha hızlı pişer','烤肉更快','肉が早く焼ける','고기가 빨리 익어요','A carne assa mais rápido','Мясо жарится быстрее'],
  task_wipe:['Wipe {n} tables','Essuyer {n} tables','Pulisci {n} tavoli','{n} Tische wischen','Limpia {n} mesas','{n} masa sil','擦 {n} 张桌子','テーブルを{n}回拭く','테이블 {n}번 닦기','Limpe {n} mesas','Протри {n} столов'],
  task_pour:['Pour {n} beers','Servir {n} bières','Spilla {n} birre','{n} Bier zapfen','Sirve {n} cervezas','{n} bira doldur','接 {n} 杯啤酒','ビールを{n}杯つぐ','맥주 {n}잔 따르기','Sirva {n} cervejas','Налей {n} кружек пива'],
  move_kb:['WASD / arrows to move','ZQSD / flèches pour bouger','WASD / frecce per muoverti','WASD / Pfeiltasten zum Laufen','WASD / flechas para moverte','WASD / ok tuşları ile yürü','WASD / 方向键 移动','WASD / 矢印キーで移動','WASD / 방향키로 이동','WASD / setas para andar','WASD / стрелки — ходьба'],
  move_touch:['Drag anywhere to move','Glisse n\'importe où pour bouger','Trascina ovunque per muoverti','Irgendwo ziehen zum Laufen','Arrastra en cualquier sitio para moverte','Yürümek için ekranı sürükle','按住屏幕拖动来走路','画面をドラッグして移動','화면을 드래그해서 이동','Arraste na tela para andar','Тяни по экрану, чтобы идти'],
  bossWave:['👑 The Hero King!','👑 Le Roi des héros !','👑 Il Re degli eroi!','👑 Der Heldenkönig!','👑 ¡El Rey de los héroes!','👑 Kahramanlar Kralı!','👑 勇者王来了！','👑 勇者王が来た！','👑 용사왕 등장!','👑 O Rei dos heróis!','👑 Король героев!'],
  angry:['Too slow! 😡','Trop lent ! 😡','Troppo lento! 😡','Zu langsam! 😡','¡Muy lento! 😡','Çok yavaş! 😡','太慢了！😡','遅すぎ！😡','너무 느려요! 😡','Muito lento! 😡','Слишком долго! 😡'],
  night:['🌙 Night {n}','🌙 Nuit {n}','🌙 Notte {n}','🌙 Nacht {n}','🌙 Noche {n}','🌙 {n}. Gece','🌙 第 {n} 晚','🌙 {n}日目の夜','🌙 {n}번째 밤','🌙 Noite {n}','🌙 Ночь {n}'],
  nightGoal:['Earn {g} before closing time!','Gagne {g} avant la fermeture !','Guadagna {g} prima della chiusura!','Verdiene {g} bis zum Feierabend!','¡Gana {g} antes de cerrar!','Kapanıştan önce {g} kazan!','打烊前赚到 {g}！','閉店までに {g} かせごう！','문 닫기 전에 {g} 벌기!','Ganhe {g} antes de fechar!','Заработай {g} до закрытия!'],
  lastCall:['⏰ Last call!','⏰ Dernière tournée !','⏰ Ultimo giro!','⏰ Letzte Runde!','⏰ ¡Última ronda!','⏰ Son siparişler!','⏰ 快打烊了！','⏰ ラストオーダー！','⏰ 마지막 주문!','⏰ Última rodada!','⏰ Последний заказ!'],
  closing:['Closing time!','On ferme !','Si chiude!','Feierabend!','¡Hora de cerrar!','Kapanış!','打烊啦！','閉店！','영업 종료!','Hora de fechar!','Закрываемся!'],
  missed:['Goal missed… the heroes will be back tomorrow!','Objectif manqué… les héros reviendront demain !','Obiettivo mancato… gli eroi torneranno domani!','Ziel verfehlt… die Helden kommen morgen wieder!','Meta fallida… ¡los héroes volverán mañana!','Hedef tutmadı… kahramanlar yarın yine gelir!','没达标……勇者们明晚还会来！','目標に届かず…勇者は明日も来るよ！','목표 실패… 용사들은 내일 또 와요!','Meta perdida… os heróis voltam amanhã!','Цель не взята… герои вернутся завтра!'],
  pickOne:['Pick a reward','Choisis une récompense','Scegli un premio','Wähle eine Belohnung','Elige un premio','Bir ödül seç','选一张奖励卡','ごほうびを1枚えらぼう','보상 카드를 고르세요','Escolha um prêmio','Выбери награду'],
  reroll:['📺 New cards','📺 Autres cartes','📺 Nuove carte','📺 Neue Karten','📺 Otras cartas','📺 Yeni kartlar','📺 换一批','📺 引きなおす','📺 다시 뽑기','📺 Novas cartas','📺 Другие карты'],
  retry:['Try again','Réessayer','Riprova','Nochmal','Reintentar','Tekrar dene','再来一晚','もう一度','다시 도전','Tentar de novo','Ещё раз'],
  c_beer:['Finer ale','Meilleure bière','Birra migliore','Besseres Bier','Mejor cerveza','Daha iyi bira','更好的啤酒','上等なビール','더 좋은 맥주','Cerveja melhor','Пиво получше'],
  c_meat:['Secret sauce','Sauce secrète','Salsa segreta','Geheimsoße','Salsa secreta','Gizli sos','秘制酱料','秘伝のタレ','비법 소스','Molho secreto','Секретный соус'],
  c_pat:['Comfy chairs','Chaises confortables','Sedie comode','Bequeme Stühle','Sillas cómodas','Rahat sandalyeler','舒服的椅子','ふかふかのイス','편안한 의자','Cadeiras confortáveis','Удобные стулья'],
  c_tip:['Bigger tips','Plus de pourboires','Mance più alte','Mehr Trinkgeld','Más propinas','Daha çok bahşiş','小费更多','チップ増量','팁 더 많이','Mais gorjetas','Больше чаевых'],
  c_hands:['Fast hands','Mains rapides','Mani veloci','Flinke Hände','Manos rápidas','Hızlı eller','快手','早わざ','빠른 손','Mãos rápidas','Ловкие руки'],
  c_vip:['More kings','Plus de rois','Più re','Mehr Könige','Más reyes','Daha çok kral','国王常来','王様がよく来る','왕이 더 자주','Mais reis','Больше королей'],
  c_clean:['Tidy heroes','Héros soigneux','Eroi ordinati','Saubere Helden','Héroes limpios','Tertipli kahramanlar','爱干净的勇者','きれい好きな勇者','깔끔한 용사','Heróis asseados','Аккуратные герои'],
  c_again:['One more round','Encore une tournée','Un altro giro','Noch eine Runde','Otra ronda','Bir tur daha','再来一份','おかわり','한 번 더','Mais uma rodada','Ещё по одной'],
  c_crowd:['Famous tavern','Taverne célèbre','Taverna famosa','Berühmte Taverne','Taberna famosa','Ünlü meyhane','名气大了','大人気の酒場','유명한 주점','Taverna famosa','Знаменитая таверна'],
  c_gold:['Gold chest','Coffre d\'or','Forziere d\'oro','Goldtruhe','Cofre de oro','Altın sandığı','一箱金币','金貨の箱','금화 상자','Baú de ouro','Сундук золота'],
  rep:['Rating','Note','Voto','Bewertung','Valoración','Puan','口碑','評判','평점','Avaliação','Рейтинг'],
  boost:['⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ Turbo','⚡ 加速','⚡ ターボ','⚡ 터보','⚡ Turbo','⚡ Турбо'],
  boostSub:['2 min · ad','2 min · pub','2 min · video','2 Min · Werbung','2 min · anuncio','2 dk · reklam','2 分钟 · 看广告','2分 · 広告','2분 · 광고','2 min · anúncio','2 мин · реклама'],
  boostOn:['⚡ {s}s','⚡ {s} s','⚡ {s}s','⚡ {s} s','⚡ {s} s','⚡ {s} sn','⚡ {s} 秒','⚡ {s}秒','⚡ {s}초','⚡ {s} s','⚡ {s} с'],
  benchTitle:['Workbench','Établi','Banco da lavoro','Werkbank','Banco de trabajo','Tezgâh','工具台','作業台','작업대','Bancada','Верстак'],
  close:['Close','Fermer','Chiudi','Schließen','Cerrar','Kapat','关闭','閉じる','닫기','Fechar','Закрыть'],
  boots:['Boots','Bottes','Stivali','Stiefel','Botas','Bot','靴子','ブーツ','장화','Botas','Сапоги'],
  bootsD:['Walk faster','Marcher plus vite','Cammina più veloce','Schneller laufen','Camina más rápido','Daha hızlı yürü','走得更快','歩くのが速くなる','더 빨리 걷기','Ande mais rápido','Ходить быстрее'],
  gob:['Goblin coffee','Café gobelin','Caffè goblin','Goblin-Kaffee','Café goblin','Goblin kahvesi','哥布林咖啡','ゴブリンコーヒー','고블린 커피','Café goblin','Кофе для гоблинов'],
  gobD:['Goblins work faster','Les gobelins travaillent plus vite','I goblin lavorano più veloci','Goblins arbeiten schneller','Los goblins trabajan más rápido','Goblinler daha hızlı çalışır','哥布林干活更快','ゴブリンの仕事が速くなる','고블린이 더 빨리 일해요','Os goblins trabalham mais rápido','Гоблины работают быстрее'],
  max:['MAX','MAX','MAX','MAX','MÁX','MAKS','满级','MAX','MAX','MÁX','МАКС'],
  double:['📺 Double it!','📺 Doubler !','📺 Raddoppia!','📺 Verdoppeln!','📺 ¡Duplícalo!','📺 İkiye katla!','📺 翻倍','📺 2倍にする','📺 2배 받기','📺 Dobrar!','📺 Удвоить!'],
  offTitle:['Welcome back!','Bon retour !','Bentornato!','Willkommen zurück!','¡Bienvenido de nuevo!','Tekrar hoş geldin!','欢迎回来！','おかえり！','다시 오신 걸 환영해요!','Bem-vindo de volta!','С возвращением!'],
  offDesc:['Your goblins kept working while you were away','Tes gobelins ont travaillé pendant ton absence','I tuoi goblin hanno lavorato mentre non c\'eri','Deine Goblins haben weitergearbeitet, während du weg warst','Tus goblins siguieron trabajando mientras no estabas','Sen yokken goblinlerin çalışmaya devam etti','你不在的时候，哥布林一直在干活','いない間もゴブリンが働いていたよ','없는 동안 고블린들이 계속 일했어요','Seus goblins continuaram trabalhando enquanto você estava fora','Пока тебя не было, гоблины работали'],
  collect:['Collect','Récupérer','Raccogli','Einsammeln','Recoger','Topla','收下','受け取る','받기','Coletar','Забрать'],
  hired:['Goblin hired!','Gobelin embauché !','Goblin assunto!','Goblin eingestellt!','¡Goblin contratado!','Goblin işe alındı!','雇到哥布林！','ゴブリンを雇った！','고블린 고용!','Goblin contratado!','Гоблин нанят!'],
  adTest:['(test build: ad placeholder)','(version test : pub factice)','(versione di prova: pubblicità finta)','(Testversion: Werbe-Platzhalter)','(versión de prueba: anuncio simulado)','(test sürümü: sahte reklam)','（测试版：广告占位）','（テスト版：広告のダミー）','(테스트 버전: 광고 자리)','(versão de teste: anúncio fictício)','(тестовая версия: заглушка рекламы)'],
  noAd:['No ad available right now','Aucune pub disponible','Nessuna pubblicità disponibile','Gerade keine Werbung verfügbar','No hay anuncios ahora mismo','Şu an reklam yok','暂时没有广告','今は広告がありません','지금은 광고가 없어요','Nenhum anúncio agora','Сейчас нет рекламы'],
  // daily reward + daily tasks
  daily:['Daily reward','Récompense du jour','Premio giornaliero','Tagesbelohnung','Recompensa diaria','Günlük ödül','每日签到','デイリーボーナス','출석 보상','Recompensa diária','Ежедневная награда'],
  dayN:['Day {n}','Jour {n}','Giorno {n}','Tag {n}','Día {n}','{n}. gün','第 {n} 天','{n}日目','{n}일차','Dia {n}','День {n}'],
  claim:['Claim','Récupérer','Riscuoti','Abholen','Reclamar','Al','领取','受け取る','받기','Resgatar','Забрать'],
  streakTip:['Come back every day — day 7 is huge!','Reviens chaque jour : le jour 7 est énorme !','Torna ogni giorno: il giorno 7 è enorme!','Komm jeden Tag – Tag 7 ist riesig!','Vuelve cada día: ¡el día 7 es enorme!','Her gün gel — 7. gün çok büyük!','每天来领，第 7 天大奖！','毎日来てね。7日目は大当たり！','매일 오세요. 7일차는 대박!','Volte todo dia — o dia 7 é enorme!','Заходи каждый день — на 7-й день огромный приз!'],
  tasks:['Daily tasks','Tâches du jour','Compiti del giorno','Tagesaufgaben','Tareas diarias','Günlük görevler','每日任务','デイリータスク','일일 임무','Tarefas diárias','Задания дня'],
  task_serve:['Serve {n} heroes','Servir {n} héros','Servi {n} eroi','{n} Helden bedienen','Atiende a {n} héroes','{n} kahramana hizmet et','招待 {n} 位勇者','勇者を{n}人もてなす','용사 {n}명 접대','Atenda {n} heróis','Обслужи {n} героев'],
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
