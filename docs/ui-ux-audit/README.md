# 水果突击 · UI/UX 全面审核报告

> 审核日期:2026-07-12 · 范围:真实项目 `merge-td-new`(canvas 战斗 + DOM 烫金壳,~11,000 行 JS)
> 方式:`ui-ux-pro-max` 标准库做基线 + 3 个子代理分面扫描 + 源码人工复核 · **只审核,未改动任何代码**

## 本目录文件
| 文件 | 内容 |
|---|---|
| `README.md`(本文) | 总览、严重度总表、亮点、修复优先级清单、验证方式 |
| [`01-dom-shell.md`](./01-dom-shell.md) | DOM 烫金壳:字体、触控、对比、token、表单、overlay、皮肤一致性 |
| [`02-battle-canvas.md`](./02-battle-canvas.md) | 战斗 canvas:触控热区、文字可读性、对比、反馈、拖拽、缩放、动效 |
| [`03-performance-responsive.md`](./03-performance-responsive.md) | 首载性能、脚本加载链、响应式、CSS 冗余、图片 |
| [`04-fixes-remediation.md`](./04-fixes-remediation.md) | **落地优化建议**:每条给确切改法/代码/值/工作量/风险/验证 |

## 基线(ui-ux-pro-max 对"休闲手游"的期望)
风格 Claymorphism/软 3D 卡通;字体 **Fredoka + Nunito(项目正好选了 ✅)**;触控 ≥44×44;正文对比 ≥4.5:1;**结构图标用 SVG 不用 emoji**;尊重 `prefers-reduced-motion`;**不得 `user-scalable=no`**;可点元素 cursor-pointer;hover/press 150–300ms。

## 严重度总表
| # | 级别 | 问题 | 位置 | 详情 |
|---|---|---|---|---|
| 1 | **P0** | Web 字体根本没加载,烫金字体身份静默降级为系统黑体 | index.html `<head>` | [壳 §1](./01-dom-shell.md#1-招牌字体从未加载) |
| 2 | **P0** | `user-scalable=no` 禁止缩放(WCAG 1.4.4)+ 满屏小字 | index.html:5 | [性能 §4](./03-performance-responsive.md#4-viewport--响应式) |
| 3 | **P0** | 战斗 canvas 按钮/文字过小:暂停/帮助 22×20px、速度 20px高、出球 23px高;字 6–8px | hud_skin/render/combat_clarity | [canvas §1-2](./02-battle-canvas.md) |
| 4 | **P0** | 战斗 canvas 零 reduced-motion,全部动画无条件跑 | 全 canvas 层 | [canvas §7](./02-battle-canvas.md#7-reduced-motion) |
| 5 | **P1** | 多处文字对比不达标(墙血浅字压浅战场、灰底灰字 1.7:1、占位符) | battle_skin:156 / hifi_shell:155,266 | [壳 §3](./01-dom-shell.md#3-色彩与对比) / [canvas §3](./02-battle-canvas.md#3-战场文字对比) |
| 6 | **P1** | 底栏次级 tab 图标 36px、sheet 关闭 X 34px <44 | hifi_shell:91,219 | [壳 §1](./01-dom-shell.md) |
| 7 | **P1** | 表单:email 用 text、无 label、无 loading/disabled(可重复提交)、错误只 toast | product_shell:877-898 | [壳 §7](./01-dom-shell.md#7-表单与反馈) |
| 8 | **P1** | 性能:47 个阻塞 script + 3 CSS = 50 请求瀑布、~1.6MB 首载、猴补丁链极脆 | index.html:109-155 | [性能 §1,§7,§8](./03-performance-responsive.md) |
| 9 | **P1** | 无战斗前 loading 态;canvas 按钮无按下反馈 | ui.js:171 / hud_skin | [canvas §4,§6](./02-battle-canvas.md) |
| 10 | P2 | 12 个色彩 token 定义了却 ~146 处硬编码 hex,var() 仅 14 次 | hifi_shell.css | [壳 §4](./01-dom-shell.md#4-色彩-token-vs-硬编码) |
| 11 | P2 | 图片未优化:art 3 张 JPEG 951KB 无 WebP/lazy;根目录 ~6MB 调试截图(已 gitignore,不进部署) | art/ + 根目录 | [性能 §3](./03-performance-responsive.md#3-图片资源) |
| 12 | P2 | 三套 CSS 全量加载,shell-v65→hifi 三层覆盖,死 CSS 随包 | style/ui_redesign/hifi | [性能 §6](./03-performance-responsive.md#6-css-体积与重复) |
| 13 | P2 | letterbox:390×844 上下留 89px 绿底空条,战场仅占屏高 ~21% | main.js:11 | [canvas §8](./02-battle-canvas.md#8-缩放--letterbox) |
| 14 | P2 | 残留旧皮(overflowPopup/upgrade/sim 老奶油皮);缺 hover/focus-visible | index.html / hifi_shell | [壳 §5,§9](./01-dom-shell.md) |

## 亮点(已做对,勿动)
- **安全区到位**:`env(safe-area-inset-*)` 覆盖顶栏/底栏/sheet/selfrank 等 8 处。
- **结构图标已 SVG 化**:底栏 5 tab、顶栏、首页侧键都用 `<use href="#i-*">` symbol,非 emoji。
- **按压/禁用态基本齐**:`:active` 位移 + 禁用 grayscale+opacity+pointer-events:none。
- **z-index 分层清晰**:toast 400 > gacha 200 > sheet 120 > nav 100 > 顶栏 20。
- **hit-test 正确**:input.js:8-11 按 scale 反算屏→canvas 坐标。
- **emoji 作游戏内容合理**:水果头/单位用 emoji 是"零图片依赖"的刻意美术选择(不是 bug)——但也是战斗屏"像程序员美术"的主因,提质需真美术或矢量重绘,非贴图能解。

## 修复优先级清单(均未执行 · 每条可独立做、可回退)
> 确切改法/代码/值/风险/验证见 **[`04-fixes-remediation.md`](./04-fixes-remediation.md)**。
- **A. 补回字体 link + 去掉 `user-scalable=no`** — 直接让烫金字体身份生效。**最高性价比。**(⚠️ 中文字体+墙:走国内 CDN 或自托管子集,别整包)
- **B. 战斗 canvas 小按钮扩热区(hitSlop,逻辑零动)+ 关键小字提到 ≥11px + 墙血加深色底 pill** — B1/B3/B4 风险低,B2 动布局单排。
- **C. canvas 加一处 reduced-motion 总开关** — 读一次 matchMedia,给浮动/抖屏/粒子置零。
- **D. 表单:email type + autocomplete + label + 提交 disabled/loading + focus 环** — 现 `autocomplete="off"` 还主动禁了自动填充。
- **E. 色彩 token 化 / 图片 WebP+lazy / CSS 瘦身** — 工程卫生,风险低收益中。
- **F. 首载优化(defer→打包)** — 收益大但动骨架、风险高,单独立项 + 全门禁回归。

**建议顺序**:A → B1+B3+B4 → C → D(都低风险、逻辑零/极小改动)→ E 随手 → B2/F 单排。

## 验证方式(修复后如何验收,本轮未做)
起 `python -m http.server --directory merge-td-new` + Playwright 390×844 真机截图;`node test/combat-baseline.js --check` 保绿;对比度用数值核验;字体是否生效看 computed `font-family` 是否命中 ZCOOL KuaiLe。
