# DOM 烫金壳 · UI/UX 审计详情

> 覆盖 `index.html` / `css/hifi_shell.css` / `js/product_shell.js`。所有 file:line 均为 `merge-td-new` 真实行号。

## 1. 招牌字体从未加载
**P0。** `index.html` 的 `<head>` 只有 3 个 CSS link + viewport + title,**没有任何 Google Fonts `<link>` 或 `@import`**。而 `hifi_shell.css` 在 30+ 处调用非系统字体:
- `ZCOOL KuaiLe`(标题/按钮/tab/徽章):hifi_shell.css:16,50,58,70,90,104,138,140,149,157,165,172,199,218…
- `Nunito`:24,59,71,128,156,197,305,331
- `Fredoka`:37,147,191,198,230,236,247,277,280,284,292,296,343

这三个都不是系统字体 → 全部静默回退到 `PingFang SC`/`Microsoft YaHei`/`sans-serif`/`cursive`。
**后果**:整个"烫金抽卡"视觉里最招牌的手写体一个都没真渲染,标题/按钮现在都是普通系统黑体。
**注**:记忆记录字体 link 曾在 `6bfae3a` 提交,当前 index.html 已不含 —— 疑被后续 bright 缓存改动或并发会话覆盖时移除,属**回归**。

## 2. 触控热区
达标(≥44):`.ring` 44×44(:30)、`.cta` min-h 68(:66)、`.gbtn` min-h 52(:150)、`.side .ring` 50×50(:55)、`.navmain`("对战"凸起)76×76(:98)、板格 50×50。
**不达标(<44)**:
- 底栏 4 个次级 tab 图标容器 **36×36**(hifi_shell.css:91)——高频导航,偏小。
- bottom-sheet 关闭 X **34×34**(:219)。
- 资源 chip 内 `+` 按钮 **18×18**(:38)。
- 输入框 padding:13px ≈ **42px** 高(:265,305),临界。

## 3. 色彩与对比
**低对比危险对**:
- 灰色次级按钮文字 `#d8d4c8`/`#e8e4d8` on `#8f897c`→`#6b665b` ≈ **1.7:1**(hifi_shell.css:155,359)——远低于 4.5:1。
- 输入框占位符 `#8a7a5a` on 近黑 `rgba(0,0,0,.35)`(:266,306)——不达标。
- navtab 未选中标签 `#B99A6E` on `#3E2716`→`#22110A`(:90,86)——边缘。
- navtab 图标 `#8A6A3E` on `#5A3A1E`(:92-93),且图标仅 22px。
- 次级文字 `#C9B48A` 在 `rgba(56,34,18,.9)` 深卡上偏低(:146,229,242…)。
**达标**:`#FFE9A8` 金字 on `#14100b`、`#F3E3C0` on 深棕、金按钮上的 `#5A0E0E`/`#FFF6DE` 均 OK。

## 4. 色彩 token vs 硬编码
`.hifi` 定义 **12 个 CSS 变量**(hifi_shell.css:9-13),但全文件 `var()` **仅 14 次**,硬编码 hex **~146 处**。高频漏用:`#7A4E08`(~15)、`#F5C242`(~12,应=`--gold`)、`#FFE9A8`(~18)、`#F3E3C0`(~10,应=`--paper`)、`#5A0E0E`(~4,应=`--maroon-dk`)。token 名存实亡,改主题/保一致极易漏。

## 5. 交互状态
- **`:active` 齐**:`.ring:active` scale(.9)(:33)、`.cta:active` translateY(4px)(:67)、`.navmain:active` translateY(-14px)(:102)、`.gbtn:active`(:153)。
- **禁用态清晰**:`.gbtn.gray` grayscale+pointer-events:none(:155)、`.gbtn:disabled` opacity.5+grayscale(:250)、`.lvnode.locked`(:348)。
- **cursor-pointer 齐**:`.hifi button`(:17)、`.card`(:196)、`.lvnode`(:342)。
- **缺**:零 `:hover`(桌面视口无反馈);`:focus` 用 `outline:none` 去掉焦点环却无替代(:266,306,332)——键盘无障碍缺失;auth 提交按钮无 disabled(可双击)。

## 6. Overlay / 模态
- **z-index 分层清晰**:toast 400(:119)> gacha 200(:176)> sheet 120(:211)> nav 100(:84)> 顶栏 20(:29)。
- **scrim**:gacha `rgba(10,6,3,.66)`+blur(4px)(:176);sheet `rgba(18,9,3,.62)` 无 blur(:211)。
- **关闭**:sheet 有 X + 点背景关(product_shell.js:853),但 X 仅 34px;gacha 只有"确认"按钮、不支持点背景关。
- **滚动锁**:`html,body{overflow:hidden}`(style.css:6)永久锁;但无 `overscroll-behavior`,iOS 弹性滚动仍可能露底。

## 7. 表单与反馈
登录/注册(product_shell.js:870-898):
- 邮箱输入 **`type="text"` 而非 `email`**(:877)——不触发邮箱键盘/校验。密码 `type="password"` ✅。
- **全靠 placeholder,无 `<label>`**;无 show/hide 密码。
- 提交**无 loading/`disabled`**(886-898)→ 可连点重复提交。
- 错误只用 ~1.6s `hifiToast` 弹一下(:889),非就地、易错过。
改名(:901-925)、聊天(:941)同样 placeholder-only、无 loading。
PVP 房间码用 `inputmode="numeric"` ✅(:747)。

## 8. 皮肤一致性
产品壳流程内**所有活动屏**都上了 `.hifi` 金皮:首页/关卡/商店/阵容/竞技/排行/底栏/结算/帮助/sheet/gacha(见 product_shell.js:361,403,651,468,721,781,325,1293,530,1121)。
**残留旧皮**(仅遗留路径可达,产品壳导航不触及):`#overflowPopup`/`#upgradePanel`/`#simPanel`(index.html:92-94,老奶油 shell-v65)。
**局内 canvas 战斗未纳入金皮**——它是矢量渲染,需重绘非贴皮。

## 9. 小结
壳层整体工程质量不错(SVG 图标、安全区、z-index、按压/禁用态到位),**但被两件事拖垮观感**:①招牌字体没加载(§1);②大量硬编码 hex + 若干低对比(§3-4)。表单可用性(§7)是次要短板。
