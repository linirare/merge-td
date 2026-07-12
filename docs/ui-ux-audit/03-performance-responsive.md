# 性能 / 响应式 / 加载 · 审计详情

> 覆盖 `index.html`、`css/*.css`、`art/*`、`js/main.js` 及 47 个 JS 脚本。

## 1. 脚本加载
- **47 个 `<script>`**(index.html:109-155),**全 render-blocking**,零 async/defer。
- **无打包器**,每个文件一个 `<script src>` → 单 JS 就 47 个请求。
- 3 个 CSS link(:7-9)同样阻塞。
- 有 `?v=` 缓存戳(3 种版本串)。
- 加载顺序前段:config→layout_v56→version_guard→state→board→combat→ai→render→skin→…→product_shell(第42位)。

## 2. 字体加载
- **零外部字体请求**:无 Google Fonts link、无 `@import`、无 preconnect/preload、无 `font-display:swap`。
- CSS 却引用 3 个需外载 web 字体(`ZCOOL KuaiLe`/`Nunito`/`Fredoka`)+ 2 个系统字体(`SF Pro Display`/`PingFang SC`)。
- **后果**:web 字体全部静默降级为系统字体(详见 [壳 §1](./01-dom-shell.md#1-招牌字体从未加载))。副作用:零字体下载重量(性能反而好),但设计身份失效。

## 3. 图片资源
`art/` 3 张 JPEG(无 WebP/AVIF/PNG):
| 文件 | 大小 | 引用 |
|---|---|---|
| banner-gacha_001.jpg | 349 KB | hifi_shell.css:163(JS innerHTML 注入) |
| bg-clean_002.jpg | 278 KB | hifi_shell.css:25(CSS background) |
| bg-hall_001.jpg | 324 KB | hifi_shell.css:131(CSS background) |
| **合计** | **951 KB** | |
- **无 `<img>` 标签**;全走 CSS background 或 JS 注入。
- **无 `loading="lazy"`**;除 banner 的 `aspect-ratio:16/9`(:163)外无预留尺寸(CLS 风险)。
- **根目录另有 20 张调试截图**(11 PNG ~4.7MB + 9 JPG ~1.4MB,共 ~6MB,如 `battle_now.png`/`shot_*.jpg`),未被游戏引用。**但 `.gitignore` 已覆盖**(`/*.png`、`/shot_*.jpg`)→ **不进 git 部署**,仅工作区杂物,非部署负担。

## 4. viewport / 响应式
`index.html:5`:`width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover`
- **`user-scalable=no` = 禁缩放,违反 WCAG 1.4.4(P0)**;配合满屏小字尤其伤。`viewport-fit=cover` OK。
- **@media 仅 4 条**:landscape 提示(style.css:157)、`max-width:380px` 关卡网格 4→3 列(ui_redesign.css:92)、reduced-motion(hifi_shell.css:109)、`min-width:470px` 桌面居中 430px 列(hifi_shell.css:113)。
- 桌面适配极简(仅居中列)。`dvh` 用于 2 处(sheet 88dvh、chat 44dvh),其余用 vh/固定 px。

## 5. reflow / resize
`main.js:9-18` resize:**无 debounce/throttle**;仅听 `resize`(无 `orientationchange`)。旋转时 resize 风暴(5-15 次)不受控,每次读 `innerWidth/Height` + 写多个 canvas 属性。单次读写周期尚可,但连发可致掉帧。`dpr` 已 clamp 到 ≤3 ✅。

## 6. CSS 体积与重复
| 文件 | 行 | 字节 |
|---|---|---|
| style.css | 160 | 9,811 |
| ui_redesign.css | 92 | 10,504 |
| hifi_shell.css | 359 | 35,878 |
| **合计** | 611 | ~56 KB |
三套**全量加载**。层叠:style.css 基础 → ui_redesign.css `body.shell-v65` 覆盖 → hifi_shell.css `#id.hifi` 再覆盖。一个按钮穿三层。`shell-v65`+`hifi` 激活后,底两层大量规则成死 CSS 仍随包解析。

## 7. Console / 错误风险
**猴补丁/重定义模式**,40+ 处全局函数被后续脚本覆盖。关键链:
| 函数 | 覆盖次数 |
|---|---|
| `spawnSoldierFromBall` | 7 |
| `update` | 7 |
| `initLevel` | 5 |
| `drawSoldier` | 4 |
| `addFx` / `draw` / `attackTarget` / `attackWall` | 3 |
**风险**:加载顺序极脆,任一脚本加载/解析失败 → 后续重定义静默作用于旧函数或 undefined,连锁静默坏(无测试门禁触达)。IIFE 包裹给了点作用域,但 47 脚本隐式强耦合于顺序。

## 8. 总资产重量
| 类 | 数 | 总大小 | 行 |
|---|---|---|---|
| JS | 48 | 589 KB(未压) | 10,967 |
| CSS | 3 | 56 KB | 611 |
| art 图 | 3 | 951 KB | — |
| **首载关键** | **51** | **~1.6 MB** | ~11,578 |
- **HTTP 请求 50**(3 CSS + 47 JS),全阻塞。
- 589KB JS gzip 后 ~180-250KB,但**50 请求瀑布**在移动高延迟下主导加载时间。
- 无 code splitting / async / defer / 打包。最大文件:product_shell.js 72KB、combat.js 32KB、config.js 30KB。
- **评估:偏重**。canvas 本身不复杂,瓶颈在脚本组织。

## 9. 小结
性能问题集中在**加载架构**(50 请求瀑布 + 无打包 + 猴补丁脆链)与**可访问性**(`user-scalable=no`)。图片/CSS 冗余为次要工程卫生。加载优化(修复 F)收益大但动骨架、风险高,宜单独立项。
