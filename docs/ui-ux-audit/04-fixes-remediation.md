# 落地优化建议(可照改 · 未执行)

> 每条 = 目标 / 确切改法(代码·值·file:line)/ 工作量 / 风险 / 验证。按性价比 A→F。**本文件只是方案,未改任何游戏代码。**

| 方案 | 解决 | 工作量 | 风险 | 收益 |
|---|---|---|---|---|
| A 字体 + 缩放 | P0#1,#2 | 0.5h(CDN)~0.5天(自托管子集) | 低 | ★★★ 立刻找回烫金字体身份 |
| B canvas 热区+小字+墙血 | P0#3,P1#5 | 0.5天 | 低~中 | ★★★ 手机可点可读 |
| C canvas reduced-motion | P0#4 | 1–2h | 低 | ★★ 无障碍达标 |
| D 表单 | P1#7 | 0.5天 | 低 | ★★ 登录体验/防重复提交 |
| E 工程卫生(token/图片/CSS) | P2#10,11,12 | 0.5–1天 | 低~中 | ★ 可维护/体积 |
| F 首载(defer/打包) | P1#8 | 单独立项 | 高 | ★★ 但动骨架 |

---

## A. 补字体 + 放开缩放(最高性价比)
**目标**:让 `ZCOOL KuaiLe`/`Fredoka`/`Nunito` 真正加载;允许缩放。

**改法 1 — viewport**(index.html:5):去掉 `user-scalable=no`,允许放大到 5×:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
```

**改法 2 — 字体**(index.html `<head>` 内、CSS link 前加):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Fredoka:wght@500;600;700&family=Nunito:wght@700;800&display=swap" rel="stylesheet">
```
⚠️ **两个真实坑,必须选路**:
- **Google Fonts 在中国大陆常被墙** → 上线给国内用户要么换国内 CDN(如 `fonts.font.im` 镜像 / 中文网字计划),要么**自托管**。
- **`ZCOOL KuaiLe` 是中文全字库(数 MB)**。Google Fonts 走 `unicode-range` 动态子集化只下发用到的字,效率高;但**自托管切勿整包**——应对 UI 实际用到的那 ~200 个汉字做**子集**(`glyphhanger`/`fonttools pyftsubset` 抽子集 → woff2,几十 KB),再 `@font-face{font-display:swap}`。

**验证**:DevTools → 元素 computed `font-family` 命中 `ZCOOL KuaiLe`;Network 有字体请求 200;首页标题/按钮显手写体。

---

## B. 战斗 canvas:扩热区 + 小字提大 + 墙血提可读
**目标**:顶部小按钮好点、满屏小字看得清、墙血不再"浅压浅"。

**B1 顶部三键热区(不动视觉,只放大命中判定)** — 优先,风险最低:
三键点击热区是 `render.js` 的 `PAUSE_RECT`/`HELP_RECT`/`SPEED_RECT`(y=4,h=26 canvas ≈20px effective)。在命中判定处(`input.js` 里 `pointInRect` / 各 RECT 检测)对这三个 rect 各向外扩 ~10 canvas 做 hitSlop:
```js
// input.js — 命中判定时用扩大的矩形
function hitRect(p, r, pad = 10) {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad &&
         p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}
```
→ 视觉不变,命中区 ~40px effective。**逻辑零改动。**

**B2 出球按钮加高**(需动布局,风险中):`operationH` 38→48(config.js:40 区 / layout_v56.js:31),`getJuiceSpawnButtonRectV60` 的 h=operationH-8 随之 40 canvas ≈31px;同步 `playerBoardY` 下移 10(layout_v56.js:34)保持不重叠。

**B3 关键小字提大**:
- `combat_clarity.js:108` `9px`→`11px`、`:129` `8px`→`10px`。
- 墙血 `battle_skin.js:154` `10px`→`12px`。

**B4 墙血"浅压浅"修复**(P1#5)——两选一:
- (推荐)给数字加**半透明深色底 pill**(仿 HUD 做法),数字保持浅色:在 `battle_skin.js:152` 前画 `ctx.fillStyle='rgba(20,10,6,.5)'; roundRect(居中, y+h+6, 46, 15, 7)`。
- 或数字直接改**深色** `#5A0E0E` + 浅色 `strokeText` 描边。

**验证**:`python -m http.server` + Playwright 390×844 截图肉眼核;`node test/combat-baseline.js --check` 保绿;B2 若动布局再跑 `npm run check` 全门禁。

---

## C. canvas 全局 reduced-motion 开关
**目标**:系统开"减弱动态效果"时,canvas 动画停。

**改法**(main.js 顶部加,监听变更):
```js
let REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => REDUCE_MOTION = e.matches);
```
在各动画源用它 gate(一行改):
- `fruit_skin.js:167` `floatOff` → `REDUCE_MOTION ? 0 : sin(...)*0.7`;`:166` `bounceOff` 同理。
- `main.js:210` 抖屏 `shake` → `REDUCE_MOTION ? 0 : ...`。
- 尘土/环/飘字生成处:`if (!REDUCE_MOTION) addFx/particles(...)`(飘字含信息的保留、纯装饰的跳过)。
- `stickman_render_v60.js:314` walk phase:`REDUCE_MOTION` 时不累加(角色停步但仍显示)。

**验证**:系统开 reduce-motion,进战斗截图/录屏确认无浮动/抖屏/走路循环。

---

## D. 表单可用性
**目标**:正确键盘、可自动填充、防重复提交、可见焦点、就地报错。

**改法**(product_shell.js:877-880):
```html
<input class="linput" id="authEmail" type="email" inputmode="email" autocomplete="username" placeholder="邮箱">
<input class="linput" id="authPass" type="password" autocomplete="current-password" placeholder="密码"><!-- 注册用 new-password -->
```
- `type="text"`→`email`、`autocomplete="off"`→`username`(现在的 off **主动禁用了密码管理器/自动填充**)。
- 加可访问标签:给每个 input 加 `aria-label`(视觉可继续用 placeholder)。

**防重复提交**(product_shell.js:886 handler):
```js
const btn = body.querySelector('#authGo');
btn.disabled = true; btn.textContent = isReg ? '注册中…' : '登录中…';
try { /* ...await... */ }
finally { btn.disabled = false; btn.textContent = isReg ? '注册并登录' : '登录'; }
```

**焦点环**(hifi_shell.css:266,306,332 把 `outline:none` 换成):
```css
.hifi .linput:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
```

**就地报错**:错误除 `hifiToast` 外,在输入框下方插一行 `<p class="err">` 显因由;占位符色 `#8a7a5a` 提到 `#b9a578` 以上以过对比。

**验证**:iOS/安卓点邮箱弹邮箱键盘;密码管理器能填;连点提交只触发一次。

---

## E. 工程卫生
- **色彩 token 化**:把高频硬编码收敛到已定义变量(`#F5C242`→`var(--gold)`、`#F3E3C0`→`var(--paper)`、`#5A0E0E`→`var(--maroon-dk)`),并给 `#FFE9A8`/`#C9B48A`/`#6B0F0F` 补 3 个新 token。至少**约定新代码不再写裸 hex**。
- **图片 WebP+lazy**:`art/*.jpg` → `cwebp -q 80` 转 webp(约省 30-50%);banner 用 `<img loading="lazy" width height>` 预留尺寸(减 CLS)。CSS background 可用 `image-set()` 带 jpg 回退。
- **CSS 瘦身**:确认 `shell-v65` 规则已被 `.hifi` 全覆盖后,评估移除 `ui_redesign.css` 死规则(需回归各屏)。
- **清工作区**:根目录 20 张调试截图已被 `.gitignore` 忽略,可选 `rm` 清理(不影响部署)。

**验证**:各屏视觉回归截图对比;Lighthouse 体积/CLS 前后对比。

---

## F. 首载优化(建议单独立项,风险最高)
**现状**:47 个 render-blocking `<script>` + 3 CSS = 50 请求瀑布;且 40+ 全局函数靠加载顺序猴补丁,极脆。
- **短期(低改动)**:给 `<script>` 加 `defer`。defer **保持执行顺序**,与猴补丁链兼容,但全部延后到 DOM 解析完。需确认无脚本在 body 里内联依赖某全局。风险中。
- **中期(真优化)**:用 esbuild/rollup **按加载顺序拼成 1–2 个 bundle**(IIFE 猴补丁模式可直接顺序拼接),50 请求→2–3 个 + 压缩。风险高(动骨架)。
- **务必**:任何一步后跑 `npm run check` 全 7 项门禁 + 真机冒烟,因加载链脆。

**验证**:Network 请求数、DOMContentLoaded/TTI 前后对比;`npm run check` 全绿;真机进战斗无 console 报错。

---

## 建议执行顺序
**先 A(0.5h,立竿见影)→ B1+B3+B4(半天,不动布局的部分)→ C → D**,这四步风险都低、逻辑零/极小改动,能把 P0/P1 里"看得见摸得着"的体验硬伤基本补掉。E 随手做。**B2(动布局)和 F(动骨架)单独排期 + 全门禁回归。**
