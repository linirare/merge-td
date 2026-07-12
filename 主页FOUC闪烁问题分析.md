# 水果突击 · 主页刷新闪烁 (FOUC) 分析与优化方案

> **问题:** 刷新页面时旧版绿色UI短暂闪现,然后突然切换到新版亮色/烫金皮肤
> **日期:** 2026-07-12 (复查修正版)

---

## 1. 现象

每次刷新 `index.html`,浏览器先渲染旧版绿色渐变背景 + 旧面板样式,约 300-500ms 后跳变为新版奶油色渐变 + 玻璃态 + 烫金控件。中间经历**两次视觉突变**。

---

## 2. 根因分析

### 2.1 CSS 激活条件

三份 CSS 的激活机制:

```html
<link rel="stylesheet" href="css/style.css?v=20260710ai">         <!-- 无条件生效 → 首帧就是绿色旧版 -->
<link rel="stylesheet" href="css/ui_redesign.css?v=20260710ui">    <!-- 需要 body.ui-redesign (背景) + body.shell-v65 (面板) -->
<link rel="stylesheet" href="css/hifi_shell.css?v=20260712bright"> <!-- 需要 #menuPanel.hifi (烫金皮) -->
```

| CSS 文件 | 选择器 | 激活条件 | 负责 |
|----------|--------|---------|------|
| `style.css` | `body` | **无条件,首帧生效** | 绿色渐变背景 + 旧面板 |
| `ui_redesign.css` | `body.ui-redesign` | JS 加 `ui-redesign` class | 奶油色背景 |
| `ui_redesign.css` | `body.shell-v65` | JS 加 `shell-v65` class | 玻璃态面板 + 新按钮 |
| `hifi_shell.css` | `#menuPanel.hifi` | JS 加 `hifi` class | 暗金烫金皮 |

### 2.2 JS 激活时机 (分两阶段)

**脚本 #41** `product_shell.js` 第 1275 行:

```js
document.body.classList.add('shell-v65');                           // 只加 shell-v65!
document.getElementById('menuPanel')?.classList.add('hifi');        // 烫金皮
```

**脚本 #47** `ui_redesign.js` 第 7 行 (最后一个脚本!):

```js
document.body.classList.add('ui-redesign', 'shell-v65');            // 这才加 ui-redesign!
```

### 2.3 完整时间线 (两次闪烁)

```
T=0ms      浏览器解析 <link style.css> → 应用绿色背景 + 旧面板样式
T=1ms      首帧渲染 → 用户看到: 🟢 绿色背景 + 旧面板
T=1ms      <link ui_redesign.css> 和 <link hifi_shell.css> 解析完成,但 class 都不存在,不生效
T=2ms      脚本 #1~#40 依次加载执行 (游戏引擎、战斗系统等)
T≈150ms    脚本 #41 product_shell.js 执行:
             body 加 shell-v65   → 面板突然变玻璃态,按钮变样式 ← 闪1 ✨
             menuPanel 加 hifi   → 菜单突然变暗金烫金皮       ← 闪1 ✨
             但背景还是绿的! (ui-redesign 还没加)
T≈150ms    用户看到: 🟢 绿色背景 + 玻璃态面板 + 烫金菜单 (半新半旧)
T≈350ms    脚本 #47 ui_redesign.js 执行 (最后一个脚本):
             body 加 ui-redesign → 背景突然从绿色变奶油色     ← 闪2 ✨
T≈350ms    用户看到: 🟠 奶油色背景 + 玻璃态面板 + 烫金菜单 (最终版)
```

**两次闪烁窗口:**
- 闪1: T=1ms → T≈150ms (绿色旧面板 → 玻璃态面板)
- 闪2: T≈150ms → T≈350ms (绿色背景在半新版上停留约 200ms 后突变)

---

## 3. 优化方案

### 方案A (推荐,改3行): 内联脚本在首帧前同时加两个 class

把 `ui-redesign` + `shell-v65` 的添加提前到 `<head>` 中,在首帧渲染之前执行:

```html
<!-- index.html <head> 中,三份 CSS 之后 -->
<link rel="stylesheet" href="css/style.css?v=20260710ai">
<link rel="stylesheet" href="css/ui_redesign.css?v=20260710ui">
<link rel="stylesheet" href="css/hifi_shell.css?v=20260712bright">

<script>
  // 在首帧之前激活新版全部样式,消除两次闪烁
  document.body.classList.add('ui-redesign', 'shell-v65');
</script>
```

然后把 `menuPanel` 的 `hifi` class 也提前。这段需要放在 `menuPanel` DOM 之后:

```html
<!-- index.html 中,menuPanel 的 HTML 之后 -->
<div id="menuPanel" class="panel">
  ...
</div>

<script>
  // 提前加 hifi,消除烫金皮闪烁。后续 product_shell.js 的 classList.add 是幂等的
  document.getElementById('menuPanel').classList.add('hifi');
</script>
```

**原理:** 内联 `<script>` 同步阻塞,在 `<link>` 加载完成后、浏览器首帧绘制前执行。body 从第一帧起就带着 `ui-redesign` + `shell-v65`,menuPanel 带着 `hifi`,所有新版样式同时生效,永远不会出现旧版。

**效果:** 两次闪烁全部消除。首帧就是最终版。

**风险:** 近乎零。`classList.add` 幂等,`product_shell.js` 和 `ui_redesign.js` 中的后续 add 调用无副作用。`ui_redesign.js` 里的 `__uiRedesignV65Installed` 守卫只是防止重复安装脚本逻辑,不影响 class。

---

### 方案B (彻底,改动大): 去掉 class 依赖,新版改为默认

把 `ui_redesign.css` 和 `hifi_shell.css` 改为无条件生效,删除 `style.css` 中被覆盖的旧规则:

1. `ui_redesign.css`: 去掉 `body.ui-redesign` → `body`, 去掉 `body.shell-v65` 前缀
2. `hifi_shell.css`: 去掉 `.hifi` 作用域,或把 `#menuPanel.hifi` → `#menuPanel`
3. `style.css`: 删除 body background、panel 背景等已被覆盖的规则
4. `product_shell.js` + `ui_redesign.js`: 删除 `classList.add(...)` 调用

**优点:** 从根源消灭 FOUC。
**缺点:** 改动大,需逐条对比确认。如果 `style.css` 中还有被其他页面引用的规则,需要保留。

---

### 方案C (兜底): body 默认隐藏,JS 激活后显示

```html
<style>
  body { visibility: hidden; }
</style>
```

在 `ui_redesign.js` (最后一个脚本) 末尾:

```js
document.body.style.visibility = '';
```

**优点:** 绝对不闪现。
**缺点:** JS 失败时页面永久白屏;用户感知加载时间变长。

---

## 4. 附加问题: `body.ui-redesign` 背景是死代码

验证发现 `ui_redesign.css` 第4行的奶油色背景渐变**从未生效过**。`body.ui-redesign` 这个 class 在 `ui_redesign.js`(#47) 才加上,而 `ui_redesign.js` 加载时已经过去 ~350ms。在这之前和之后,背景都是 `style.css` 的绿色渐变。

检查方式: 在浏览器 DevTools 中查看 `<body>` 的 class 列表,确认 `ui-redesign` 是否存在。如果存在,背景应该是奶油色;如果刷新时先绿后奶油,说明 `ui_redesign.js` 晚了。

**附带优化:** 方案A 实施后,`body.ui-redesign` 从首帧起就存在,`ui_redesign.css` 的奶油色渐变立即生效,不再需要 `style.css` 中的绿色渐变规则。后续可以清理掉 `style.css` 中 `body` 的 `background` 声明。

---

## 5. 推荐执行路径

| 步骤 | 操作 | 改动量 | 效果 |
|------|------|--------|------|
| **1 (立即)** | `<head>` 加内联脚本设 `ui-redesign` + `shell-v65` | +3行 | 消除背景+面板闪烁 |
| **2 (立即)** | `menuPanel` 后加内联脚本设 `hifi` | +3行 | 消除烫金皮闪烁 |
| **3 (后续)** | 删 `product_shell.js:1275` 中的 `shell-v65` add (已冗余) | -1行 | 清理冗余 |
| **4 (后续)** | 删 `ui_redesign.js:7` 中的 add (已冗余) | -1行 | 清理冗余 |
| **5 (后续)** | 清理 `style.css` 死规则,合并 CSS | 较多 | 减请求/加速 |
