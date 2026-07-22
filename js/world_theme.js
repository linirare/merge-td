/* 梦幻水世界 · 单一主题注册表。内部 ID 与数值保持不变。 */
(function installWorldTheme(global) {
  'use strict';

  const units = {
    olive_assassin: ['章鱼刺客', '🐙', 'blue-ring-octopus-assassin'],
    lemon_assassin: ['虾刀客', '🦐', 'mantis-shrimp-blade'],
    cherry_bomber: ['河豚炮手', '🐡', 'puffer-bomber'],
    kiwi_wildcard: ['拟态章鱼', '🐙', 'mimic-octopus'],
    passion_copy: ['镜像水母', '🪼', 'mirror-jellyfish'],
    dragonfruit_warrior: ['火珊瑚兵', '🪸', 'fire-coral-warrior'],
    blueberry_sniper: ['射水狙手', '🐟', 'archerfish-sniper'],
    banana_raider: ['旗鱼骑手', '🐟', 'swordfish-raider'],
    pineapple_lancer: ['角鲸枪兵', '🐋', 'narwhal-lancer'],
    orange_cannon: ['手枪炮手', '🦐', 'pistol-shrimp-cannon'],
    strawberry_knight: ['红蟹甲兵', '🦀', 'red-crab-knight'],
    pumpkin_roller: ['海胆滚兵', '🦔', 'urchin-roller'],
    mango_arbalest: ['海马弩手', '🐴', 'seahorse-arbalest'],
    grape_archer: ['乌贼射手', '🦑', 'squid-ink-archer'],
    pear_frost: ['冰水母法', '🪼', 'ice-jellyfish'],
    watermelon_guard: ['龟甲盾兵', '🐢', 'sea-turtle-guard'],
    coconut_guard: ['蟹壳守卫', '🦀', 'hermit-crab-guard'],
    avocado_brawler: ['海牛力士', '🦭', 'manatee-brawler'],
    melon_shaman: ['月水母法', '🪼', 'moon-jelly-shaman'],
    peach_medic: ['海星医者', '⭐', 'starfish-medic'],
    mint_supply: ['清虾补给', '🦐', 'cleaner-shrimp-supply'],
    shock_lemon: ['电鳗蓄能', '⚡', 'electric-eel-charger'],
    honey_save: ['珍珠贝储', '🦪', 'pearl-clam-battery'],
    ferment_grape: ['泡珊瑚储', '🪸', 'bubble-coral-battery'],
    chill_juice: ['冰蛤减耗', '🦪', 'glacier-clam-discount'],
  };

  const descriptions = {
    kiwi_wildcard: '同星万能合成伙伴，不进入战场。',
    passion_copy: '复制同星海灵珠身份，不进入战场。',
    peach_medic: '优先跟随并治疗生命比例最低的友军。',
    orange_cannon: '专业攻城单位，通路安全时直取护礁结界。',
  };

  const mappedUnits = Object.fromEntries(Object.entries(units).map(([id, value], index) => [id, {
    id, name: value[0], icon: value[1], artKey: value[2], artIndex: index,
    desc: descriptions[id] || `${value[0]}，在开放海域中按职责自动作战。`,
  }]));

  const WORLD_THEME = {
    version: 2,
    productName: '梦幻水世界',
    subtitle: '海灵合成 · 自由海战',
    resources: {
      sp: '潮汐能', barracks: '海灵珠', unit: '海洋伙伴', wall: '珊瑚堡垒',
      barrier: '护礁结界', gold: '贝壳币', gems: '深海晶石', gacha: '海螺祈愿', tech: '潮汐图谱',
    },
    chapters: ['珊瑚浅湾', '海藻森林', '荧光深渊', '失落海宫'],
    bosses: ['巨蛤', '海鳗', '深海鮟鱇', '远古章鱼'],
    commanders: {
      orchard_lord: { id:'orchard_lord', name:'海豚领航员', skill:'潮汐号令', desc:'立即重置攻击，并让全军持续攻击加速。', artKey:'dolphin-navigator' },
      berry_general: { id:'berry_general', name:'帝王蟹将军', skill:'护礁反攻', desc:'修复护礁结界并发动反攻。', artKey:'king-crab-general' },
      juice_sage: { id:'juice_sage', name:'鹦鹉螺贤者', skill:'深海丰潮', desc:'立即获得潮汐能并持续补给。', artKey:'nautilus-sage' },
    },
    units: mappedUnits,
    tides: { cycle: 24, calm: 12, surge: 12, speedBonus: 0.08, attackBonus: 0.08 },
  };

  global.WORLD_THEME = WORLD_THEME;
  const COPY_REPLACEMENTS = [
    ['球球合成 · 兵营出兵 · 五路攻城', '海灵召唤 · 合成强化 · 自由海战'],
    ['兵营合成 · 五路攻城', '海灵合成 · 自由海战'],
    ['球球英雄Ⅱ', '梦幻水世界'], ['水果突击', '梦幻水世界'],
    ['缤纷水果祭', '深海祈愿'], ['山货集市', '海螺集市'], ['果园远征', '海域远征'],
    ['水果科技树', '潮汐图谱'], ['水果养成', '伙伴养成'], ['水果编队', '海灵编队'],
    ['水果营', '海灵珠'], ['水果球', '海灵珠'], ['果汁', '潮汐能'],
    ['果堡', '珊瑚堡垒'], ['城墙', '护礁结界'], ['果园', '海域'],
    ['金币', '贝壳币'], ['钻石', '深海晶石'], ['抽卡', '海螺祈愿'], ['科技树', '潮汐图谱'],
    ['水果', '海洋伙伴'], ['5 条兵线', '开放海域'], ['5条兵线', '开放海域'],
    ['五路', '自由战场'], ['路线', '战况'], ['救线', '增援'],
  ];
  global.worldThemeText = function worldThemeText(value) {
    let text = String(value == null ? '' : value);
    for (const [from,to] of COPY_REPLACEMENTS) text = text.split(from).join(to);
    return text;
  };

  function rewriteThemeCopy(root) {
    if (!root || typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const next = global.worldThemeText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    if (root.querySelectorAll) for (const element of root.querySelectorAll('[title],[alt],[placeholder]')) {
      for (const attr of ['title','alt','placeholder']) if (element.hasAttribute(attr)) element.setAttribute(attr, global.worldThemeText(element.getAttribute(attr)));
    }
  }
  global.rewriteWorldThemeCopy = rewriteThemeCopy;
  if (typeof document !== 'undefined' && document.body) {
    document.title = WORLD_THEME.productName;
    rewriteThemeCopy(document.body);
    if (typeof MutationObserver !== 'undefined') new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) rewriteThemeCopy(node);
    }).observe(document.body, { childList:true, subtree:true });
  }
  global.migrateWorldThemeSave = function migrateWorldThemeSave(value) {
    const copy = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
    copy.themeVersion = WORLD_THEME.version;
    return copy;
  };
  global.applyWorldThemeToTypes = function applyWorldThemeToTypes(types) {
    for (const [id, identity] of Object.entries(WORLD_THEME.units)) {
      if (types[id]) Object.assign(types[id], identity, { internalId: id });
    }
    return types;
  };
})(typeof window !== 'undefined' ? window : globalThis);
