/* ============================================================
   水果突击 · Account Client (Phase B)
   登录/注册/云存档同步
   ============================================================ */
(function installAccountClient() {
  const API = window.location.origin;

  window.account = {
    token: null,
    user: null, // { uid, nickname, avatar, level, exp, diamonds, gold, ... }

    async api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (this.token) opts.headers['Authorization'] = 'Bearer ' + this.token;
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(API + path, opts);
      return res.json();
    },

    async register(email, password, nickname) {
      const r = await this.api('POST', '/api/auth/register', { email, password, nickname });
      if (r.token) { this.token = r.token; this.user = r; }
      return r;
    },

    async login(email, password) {
      const r = await this.api('POST', '/api/auth/login', { email, password });
      if (r.token) {
        this.token = r.token; this.user = r;
        // 云存档恢复
        if (r.meta_json && r.meta_json !== '{}') {
          try { Object.assign(meta, JSON.parse(r.meta_json)); } catch (e) {}
        }
        if (r.shell_json && r.shell_json !== '{}') {
          try { Object.assign(shell, JSON.parse(r.shell_json)); } catch (e) {}
        }
      }
      return r;
    },

    async saveToCloud() {
      if (!this.token || !this.user) return;
      const data = {
        meta_json: JSON.stringify(meta),
        shell_json: JSON.stringify(shell),
        level: this.user.level || 1,
        exp: this.user.exp || 0,
        power: typeof computePower === 'function' ? computePower() : 0,
        diamonds: shell.gems || 0,
        gold: meta.gold || 0,
        highest_stage: meta.highestLevel || 1,
        ladder_score: shell.ladderBest || 0,
      };
      await this.api('POST', '/api/save', data);
    },

    async checkin() {
      return this.api('POST', '/api/checkin', {});
    },

    async getMail() { return this.api('GET', '/api/mail'); },
    async readMail(id) { return this.api('POST', '/api/mail/read', { id }); },
    async announcements() { return this.api('GET', '/api/announcements'); },
    async leaderboard(type) { return this.api('GET', '/api/leaderboard/' + (type || 'power')); },
    async chatMessages() { return this.api('GET', '/api/chat'); },
    async addExp(amount) { const r = await this.api('POST', '/api/user/exp', { exp: amount }); if (r.level && this.user) { this.user.level = r.level; this.user.exp = r.exp; } return r; },
    async reportLadder(score) { const r = await this.api('POST', '/api/ladder/report', { score }); if (r.rank && this.user) { this.user.ladder_rank = r.rank; this.user.ladder_score = r.score; } return r; },
    // 社交
    async friends() { return this.api('GET', '/api/friends'); },
    async friendRequests() { return this.api('GET', '/api/friends/pending'); },
    async addFriend(uid) { return this.api('POST', '/api/friends/add', { uid }); },
    async acceptFriend(uid) { return this.api('POST', '/api/friends/accept', { uid }); },
    async removeFriend(uid) { return this.api('DELETE', '/api/friends', { uid }); },
    async guildMembers() { return this.api('GET', '/api/guild/members'); },
    async createGuild(name) { return this.api('POST', '/api/guild/create', { name }); },
    async joinGuild(code) { return this.api('POST', '/api/guild/join', { code }); },
    // 任务
    async tasks() { return this.api('GET', '/api/tasks'); },
    async taskProgress(task_id, delta=1) { return this.api('POST', '/api/tasks/progress', { task_id, delta }); },
    // 成就
    async achievements() { return this.api('GET', '/api/achievements'); },
    async unlockAchievement(achv_id) { return this.api('POST', '/api/achievements/unlock', { achv_id }); },
    // 通行证
    async battlepass() { return this.api('GET', '/api/battlepass'); },
    async bpExp(exp) { return this.api('POST', '/api/battlepass/exp', { exp }); },
    // 皮肤
    async skins() { return this.api('GET', '/api/skins'); },
    async mySkins() { return this.api('GET', '/api/skins/my'); },
    async buySkin(skin_id) { return this.api('POST', '/api/skins/buy', { skin_id }); },
    async equipSkin(skin_id) { return this.api('POST', '/api/skins/equip', { skin_id }); },
    // 活动
    async events() { return this.api('GET', '/api/events'); },
    async eventScore(event_id, score) { return this.api('POST', '/api/events/score', { event_id, score }); },
    // 回放
    async saveReplay(uid2, actions_json, result) { return this.api('POST', '/api/replay/save', { uid2, actions_json, result }); },
    async myReplays() { return this.api('GET', '/api/replays'); },
  };

  // 过关自动加经验(挂到 onGameOver 上)
  if (typeof onGameOver === 'function' && !onGameOver._accountWrapped) {
    const oldGameOver = onGameOver;
    onGameOver = function(win) {
      oldGameOver(win);
      if (state && state.trainingMode) return; // 训练模式不加经验
      if (win && account.token) {
        const k = state.currentLevel || 1;
        account.addExp(k * 8).catch(() => {});
        if (meta.highestLevel) account.api('POST', '/api/save', {
          meta_json: JSON.stringify(meta), shell_json: JSON.stringify(shell),
          level: account.user ? account.user.level : 1, power: typeof computePower === 'function' ? computePower() : 0,
          diamonds: shell.gems || 0, gold: meta.gold || 0, highest_stage: meta.highestLevel || 1,
        }).catch(() => {});
      }
    };
    onGameOver._accountWrapped = true;
  }

  // 注入 cloud save:每次 saveAll 自动同步
  if (typeof saveAll === 'function') {
    const oldSaveAll = saveAll;
    saveAll = function saveAllWithCloud() { oldSaveAll(); account.saveToCloud().catch(() => {}); };
  }
})();
