# 地牢酒馆·割草打怪（暂名 Dungeon Tavern，仓库沿用 dungeon-janitor）

玩法：勇者入座点啤酒/烤肉，你端过去、捡钱、擦桌子，攒钱加桌子、开烤架、雇哥布林。详见 docs/云端交接.md。

试玩（测试版，左下角显示帧率）：https://yzhaoha.github.io/dungeon-janitor-test/
平台版也可以直接打开：`/poki/`、`/crazygames/`（不在平台域名下时 SDK 走本地模拟广告）。

## 目录
- `src/`：源码。`head.html`（样式 + HUD）、`sim.js`（割草打怪纯逻辑，node 可跑）、`i18n.js`（11 种语言）、`game.js`（three.js 渲染、UI、平台包装 `PF`）
- `src/platform/*.head.html`：Poki / CrazyGames 的 SDK script
- `tools/build.py`：拼出根目录测试版 `index.html`、`poki/`、`crazygames/`，以及 `dist/dungeon-janitor-{poki,crazygames}.zip`（zip 根目录就是 index.html + three.module.min.js）
- `tools/bot.js`：机器人数值模拟（`node tools/bot.js`）
- `tools/cover.html` + `tools/save_server.py`：生成封面 `covers/cover-1920x1080.png / 800x1200 / 800x800`（封面上只有标题文字）

## 调试参数
`?debug`（暴露 `__G` `__PF`，SDK 调用记在 `window.__pflog`）、`?reset`、`?lang=xx`、`?q=-1..2`（固定画质，不自动降级）、`?fps`、`?cover`

## 画质
2：全效果 → 1：去火把点光源 → 0：去阴影 → -1：0.75 倍分辨率。每 2 秒测帧率，<40 自动降一级并记在 `dj_q`；降到 0 以下后，下次打开会关掉抗锯齿。
