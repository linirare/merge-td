# 战斗 Canvas · UI/UX 审计详情

> 覆盖 `fruit_skin.js`/`battle_skin.js`/`hud_skin.js`/`render.js`/`main.js`/`config.js`/`layout_v56.js`/`stickman_render_v60.js`。
> 战斗 100% canvas,W=480 H=854;`main.js:11` 缩放 `min(390/480,844/854)*0.96 ≈ 0.78`,即 **1 canvas 单位 ≈ 0.78 屏幕 px**(390×844 手机)。下文 effective = canvas 值 × 0.78。

## 1. 触控热区(<44 者标 ⚠️)
| 元素 | canvas 尺寸 | effective | 来源 |
|---|---|---|---|
| 出球按钮 | 211×30 | 165×**23** ⚠️ | hud_skin.js:66-69 |
| 速度按钮 | 72×26 | 56×**20** ⚠️ | 画:hud_skin:165-193 / 热区:render.js:463 |
| 暂停按钮 | 28×26 | **22×20** ⚠️ | 画:hud_skin:165-193 / 热区:render.js:435 |
| 帮助按钮 | 28×26 | **22×20** ⚠️ | 画:hud_skin:165-193 / 热区:render.js:450 |
| 溢出条 | 112×30 | 87×**23** ⚠️ | render.js:476 |
| 格内等级章 | 28×17 | 22×13 ⚠️(展示) | fruit_skin.js:247 |
| 板格(可拖/可点) | 64×64 | **50×50** ✅ | config.js:23-24 |

> 顶部速度/暂停/帮助三键**确实在渲染**——由 `drawTopActionBarV60`(hud_skin.js:165-193)的 `drawMiniButton` 画出(暂停 `Ⅱ`/`▶`、帮助 `?`、速度 `×N`),点击热区用 render.js 的 PAUSE/HELP/SPEED_RECT。绘制高度 h-10=24 canvas(~18.7px)、热区 26 canvas(~20px)。(hud_skin.js:197-198 的 `drawPauseBtn(){}`/`drawHelpBtn(){}` 是遗留空 stub,未参与真渲染。)

## 2. 文字可读性(effective <11px 者偏小)
| 文字 | canvas 字号 | effective | 来源 |
|---|---|---|---|
| 战斗清晰度小字 | 8px / 9px | **6.2 / 7.0px** | combat_clarity.js:129,108 |
| 墙血数字 | 10px | 7.8px | battle_skin.js:154 |
| 等级章 Lv1-7 | 10px | 7.8px | fruit_skin.js:250 |
| HUD 副标/果汁标 | 10px | 7.8px | hud_skin.js:43,111 |
| 伤害飘字(封顶) | 10px | 7.8px | battle_skin.js:27 |
| Boss 名章 | 10px | 7.8px | battle_skin.js:318 |
| 成本 -N / 计时 / 模式 | 13px | 10.1px(边缘) | hud_skin.js:157,49,38 |
| **达标** SP 数字 | 20px | 15.6px ✅ | hud_skin.js:114 |
| **达标** "出球" | 17px | 13.3px ✅ | hud_skin.js:143 |

## 3. 战场文字对比
背景是**暖金/奶油浅色**(drawBackground `#FBF1D2→#E7C070`,fruit_skin.js:23-31)。
- **墙血数字"浅压浅"**:HP 数字画在城墙带**下方**(battle_skin.js:156 `y+h+14`)——敌方数字(y≈312)落进浅暖战场(fieldY=306,`rgba(248,234,195,.94)`)、我方(y≈580)落在操作条白底/背景上;字色本身也浅(敌 `#F4D7DC`、我 `#E7F8D9`,battle_skin.js:153)。**浅色字压浅色底 → 低对比**,且仅 7.8px,雪上加霜。(**更正**:不是压在玫红/绿墙体 `#C97984`/`#78C783` 上;墙体上只有 HP 进度条,没有数字。)
- HUD 因走半透明白底板(`rgba(255,255,255,.88)`,hud_skin.js:86)对比 OK:SP `#fff8cf` on `#203629` ✅、出球 `#6a320c` on 黄渐变 ✅。
- 战场地面本身无关键文字直绘。

## 4. 点按反馈 / 输入延迟
- **hit-test 正确 ✅**:input.js:8-11 `(clientX-rect.left)/scale` 正确反算,缩放后点得准。
- **零按下态 ⚠️**:出球/速度/暂停按下时按钮本身不变(hud_skin.js:118-133,190-192);反馈只靠下一帧状态或延迟飘字(addFx),**<100ms 无视觉响应**。
- 板格点召唤:无按下高亮,反馈是环动画+飘字。

## 5. 拖拽交互(合成/摆放)
- **阈值合理**:移动阈值 12 canvas(~9.4px,input.js:132);吸附距 24 canvas(~18.7px,input.js:135)。
- **吸附动作**:move/merge/copy/swap 分类(input.js:116-122)。
- **视觉提示齐**:最近吸附格发光描边(色分:金=合成/绿=移动/蓝=其他,fruit_skin.js:135-146);可合成格虚线金边(:105-113);空格绿染(:92-93);拖出界红罩"松手取消"(skin.js:452-461)。
- **缺**:拿起瞬间无"抬起/放大"动画。

## 6. Loading / 空态 / 结算
- **无战斗前 loading ⚠️**:点开始→`initLevel` 同步铺场→`phase=playing`(ui.js:171-175 / board.js:195-257),慢机可能掉帧且无提示。
- **无真空板**:开局预铺 6 个起手球(board.js:63-69)。
- **暂停态 ✅**:半透明黑罩 + "⏸ 已暂停"(skin.js:477-488)。
- **结算是 HTML 层**(非 canvas):`#resultPanel`,星级按墙血%+耗时算(main.js:193-194)、金币奖励、击杀/合成、战报 tips(main.js:182-231)。

## 7. reduced-motion
**P0。** 只有 DOM 壳做了(hifi_shell.css:109)。**canvas 层全部动画无条件跑,零 `matchMedia` 检查**:球浮动/合成弹跳(fruit_skin.js:166-167)、抖屏(main.js:210)、尘土粒子、扩散环、飘字、抛射、攻击斩击、火柴人走路循环(stickman_render_v60.js:29-34,314)、冰/火/眩晕/破甲 status 特效(:248-306)。晕动症/前庭敏感用户无从关闭。

## 8. 缩放 / letterbox
`main.js:11` 的 ×0.96 使 390×844 手机上:宽 374/390(留 7.8px)、**高 666/844(上下各留 ~89px 绿底空条)**。战场区(fieldH=232)仅占 canvas 高 27%、占屏高 **~21%**。绿底空条来自 `body` 亮绿渐变(style.css:4-5),canvas 居中带圆角+阴影卡片感(style.css:21-29)。用户此前已"先不管"此项。

## 9. 小结
canvas 底层玩法反馈体系(拖拽提示、hit-test)做得扎实,**但作为"手机可玩性"有三处硬伤**:①一排顶部小按钮 20–23px 太难点(§1);②满屏 6–8px 小字太难读(§2);③零 reduced-motion(§7)。墙血低对比(§3)+ 无按下反馈(§4)为次要。
