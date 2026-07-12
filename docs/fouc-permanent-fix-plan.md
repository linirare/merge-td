# FOUC 永久修复执行计划 — 首页静态化(static-first + hydrate)

> 日期:2026-07-12 · 目标:**彻底消除加载时"旧菜单闪一下再变烫金"**,不是缓解(藏起来/加速脚本都只是治标)。

## 根因(已定位)
- `#menuPanel` 在 `index.html:56-84` 写死了一段**旧菜单静态 HTML**(`.menu-card`/`.hero-preview`/`.castle`…),删皮后这些类**已无 CSS = 裸样式**。
- 它是加载时**唯一可见的面板**(其余 upgrade/sim/result/help 都带 `.hide`),且**无任何"渲染前先藏"守卫**。
- 烫金首页是 `product_shell.js` 的 `renderHome()` 用 `root.innerHTML=...` **整块画上去**的,而 `product_shell.js` 是第 **42/47** 个脚本、`init` 还要等 `DOMContentLoaded`(47 个阻塞脚本全跑完)。
- ⇒ **旧 HTML 先显示 → 等半天 → JS 换成烫金**,这一"换"就是闪。属 **JS 渲染时机 FOUC**,CSS 守卫(`body:not(.shell-v65)` 等)管不到。

## 核心思路
**让浏览器第一帧画出来的就是烫金首页。**
`index.html` 里的 `#menuPanel` 静态内容,从"旧菜单"改成"**烫金首页本身的 HTML**"(带 `.hifi` 类 + 占位数字)。因为 `hifi_shell.css` 在 `<head>` 里、是渲染阻塞的,**首帧之前样式就绪** → 第一帧即烫金。JS 不再"重建",只"**注水**"(填金币/关卡等动态数字 + 绑事件)。静态首帧 == JS 结果 ⇒ 无替换 ⇒ 永不闪。

## 执行步骤

### 1. 把烫金首页 markup 静态化进 index.html
- 取 `product_shell.js:365` `renderHome()` 里 `root.innerHTML` 的模板,**把动态插值换成占位默认值**:
  - `${meta.gold||0}` → `0`(带 `data-shell-gold`)、`${shell.gems||0}` → `0`(带 `data-shell-gems`)
  - `Lv.${highestLevel()}` → `Lv.1`、`${dailyReady?…badge…:''}` → 先不放红点(或放,JS 再校正)
- 用这段替换 `index.html:56-84` 的旧 `.menu-card` 内容。
- `#menuPanel` 标签改为 `class="panel hifi"`,内层保持 `renderHome` 用的 `shell-home-page` / `hifi-home` 结构,使 `hifi_shell.css` 首帧即命中。
- 背景 `.bg`(bg-clean webp)保留;可给它一个**纯色烫金兜底** `background:#241a10`,图未加载完也不露白。

### 2. renderHome 改成"注水"而非"重建"
两种做法,选其一:
- **(推荐,低风险)保持 `renderHome` 仍重建**,但因静态首帧已与其输出**视觉一致**,重建这一下**肉眼无变化 = 不闪**。代价:静态 HTML 要与模板保持同步(改首页需两边同步,加注释警示)。
- **(更彻底)首次渲染走注水**:`renderHome` 开头判断 `#menuPanel` 是否已有 `.hifi-home` 静态内容;有则**只刷新** `data-shell-gold`/`data-shell-gems`/`.lvl`/签到红点 + 绑定按钮监听,**跳过 innerHTML 重建**;返回主城等后续调用再按需重建。

### 3. (可选,二级)脚本 `defer`
47 个阻塞脚本让"注水"也偏晚。给非首帧依赖的 `<script>` 加 `defer`(保持顺序,兼容猴补丁链)可让 JS 更早跑、动态数字更快到位。**风险较高、动骨架,单独排期**,非本修复必需(因首帧已是烫金)。

## 涉及文件
| 文件 | 改动 |
|---|---|
| `index.html` | `#menuPanel` 静态内容 → 烫金首页骨架 + `class="panel hifi"` |
| `js/product_shell.js` | `renderHome()` 注水化(或保持重建 + 加同步注释) |
| `css/hifi_shell.css` | 通常无需改(类已有金皮);确认 `.hifi-home`/`.logo`/`.cta` 等静态命中 |

⚠️ **协调**:`index.html` + `product_shell.js` 正被另一 agent 编辑(FOUC 相关),动手前需与其对齐,避免互相覆盖。

## 验证
1. Playwright **限速网络**(`page.route` 或 CDP `Network.emulateNetworkConditions` Slow 3G)加载,**首帧截图**应为烫金,非旧菜单。
2. 逐帧/多时刻截图对比:加载全程无"旧→新"跳变。
3. `node test/combat-baseline.js --check` 保绿(本修复不碰战斗)。
4. 真机断点验证:computed `font-family` 命中 ZCOOL KuaiLe、首页数字最终被 JS 校正为真实值。

## 明确不是永久解(仅缓解,别当终点)
- `#menuPanel{visibility:hidden}` 藏到 JS ready:把"闪一下"换成"黑屏等更久",治标。
- 只加 `defer`:缩短窗口,但 UI 仍靠 JS 画,仍有"未渲染→渲染"瞬间。
- 只删旧 markup 留空:加载时是空深底(比旧菜单好),但**首屏仍非烫金**,直到 JS 才出内容——比静态化差一档。
