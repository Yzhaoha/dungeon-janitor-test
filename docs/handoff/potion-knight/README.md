# 《药水骑士》换层与第 96 层结局交接

## 定样与入口

本次定样为有声摘盔版 `eb14925224786ac73c3fecc665a5a7db35638844`，保存在 `playtest/lantern-stairway`。交接时 main 的蓝金版为 `14e86c07`。后续修改继续用独立测试分支，Nick 明确确认具体版本后再合入 main。

[结局预览，打开后点「播放结局动画」](https://raw.githack.com/Yzhaoha/dungeon-janitor-test/eb14925224786ac73c3fecc665a5a7db35638844/ui-test/moon.html?inspect&debug&ending&lang=zh&level=96) · [第 2 层到第 3 层换层](https://raw.githack.com/Yzhaoha/dungeon-janitor-test/eb14925224786ac73c3fecc665a5a7db35638844/ui-test/moon.html?inspect&stairs=1&level=3&lang=zh) · [第 96 层实玩](https://raw.githack.com/Yzhaoha/dungeon-janitor-test/eb14925224786ac73c3fecc665a5a7db35638844/ui-test/moon.html?inspect&level=96&lang=zh)

第 96 层是剧情终点，最后十层为 87–96。打完第 96 层守关 Boss 触发救公主，剧情结束可继续冒险。带 inspect 的入口用于跳关检查，debug 与 ending 组合可直接看结局。

## 改动沿革

| 提交 | 变更 |
| --- | --- |
| b782f906 | 跳关测试基线，楼层、房间与守关 Boss 检查入口 |
| 67671d1f | 保留骑士跑马，蓝灰石阶、暖光拱门，最后三级踏面逐渐变亮 |
| 7c434112 → 72d0a389 | 先试绘制救援近景，随后按反馈回到游戏角色风格，明确钥匙交接、滴药和苏醒动作 |
| 8cb688c4 | 将分镜剪成有声 MP4，接入游戏播放器和结算回调 |
| 6db6eb74 | 公主醒来并接过钥匙后，骑士摘盔露脸 |
| d3b81fca | 清除原画药滴轮廓与光晕，重画聚滴、断开、落下和触唇 |
| f91d6631 | 去除使眼睛及背景高光弯曲的局部拉伸，将反光收在锁孔旁 |
| eb149252 | 骑士与马分层入场，加入连续旋律、弦乐和原音效，直接预览改为点击播放 |

游戏入口与播放器在 `ui-test/moon.html`，成片在 `img/crystal-key-ending.mp4`。可搜索 `floorTransition`、`playEnding`、`playSpriteEnding` 和 `mountFloorPicker`。直接预览等用户点击；正常通关尝试播放，浏览器要求手势时显示按钮，加载或解码失败时回退至游戏内动画。结算后「继续冒险」恢复原回调。

## 取出定样并查看差异

在新目录运行，使用独立检出查看当时的内容。

```sh
git clone --branch playtest/lantern-stairway https://github.com/Yzhaoha/dungeon-janitor-test.git
cd dungeon-janitor-test
git log --reverse --oneline 14e86c07..eb149252
git diff --stat 14e86c07 eb149252
git show 67671d1f -- ui-test/moon.html
git worktree add --detach ../potion-knight-review eb149252
python3 -m http.server 8000 --bind 127.0.0.1 --directory ../potion-knight-review
```

浏览器打开 `http://127.0.0.1:8000/ui-test/moon.html?inspect&debug&ending&lang=zh&level=96`。若只需原样取回成片，可从仓库根目录运行 `git show eb149252:img/crystal-key-ending.mp4 > ending-approved.mp4`。

## 重建最后一版开场、配乐与成片

从包含本交接目录的检出根目录执行。输入包括本目录的无损开场原画、制作脚本，以及 Git 历史中 f91d6631 的母版。母版保留了此前的药滴、摘盔、交钥匙和音效。脚本生成 42 帧骑马入场和立体声乐谱。需要 Python、FFmpeg（含 libx264、AAC）及 FFprobe。

```sh
mkdir -p build/potion-knight
git show f91d6631:img/crystal-key-ending.mp4 > build/potion-knight/steady-light.mp4
cd build/potion-knight
python3 -m venv .venv
.venv/bin/pip install numpy opencv-python-headless
.venv/bin/python ../../docs/handoff/potion-knight/render_score_and_ride.py
ffmpeg -y -loglevel error -i ride96.mp4 -i steady-light.mp4 -i score96.wav \
  -filter_complex '[1:v]trim=start_frame=42,setpts=PTS-STARTPTS[b];[0:v][b]concat=n=2:v=1:a=0[v];[1:a]volume=0.65[f];[2:a][f]amix=inputs=2:normalize=0,alimiter=limit=0.90[a]' \
  -map '[v]' -map '[a]' -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart rebuilt.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,sample_rate,r_frame_rate -of compact rebuilt.mp4
ffmpeg -v error -i rebuilt.mp4 -f null -
sha256sum rebuilt.mp4
```

归档前在制作环境实跑重建，输出与定样成片的 SHA-256 均为 `f5ed45b0c334a6cb9f3fabb11da13c8625b738242bbcb8adbeaa9fc1600711d1`。成片 H.264、960×540、25 fps，AAC 44.1 kHz，约 15.16 秒，2,890,515 字节。不同编码器版本可能生成不同字节。

## 验证记录与待复测

- 定样版在桌面 Chromium 的 960×540 和 390×844 窗口点播成功，视频时间推进、音轨已解码、播放器为有声状态，片末「继续冒险」可退出。验证使用浏览器数据与界面状态。
- 待测：手机 Safari 真机有声播放；从第 96 层 Boss 实战自然触发并返回结算；旧贴图加载后「重开」「加瓶」按钮仍呈蓝金；跳关与 Boss 检查前后的正式存档一致。
- 英文教程提示与瓶口重叠曾做过源码评估，缩短文案、按文字实高留位属于待验证及后续排版工作。
