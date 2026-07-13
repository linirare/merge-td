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
      if (r.token) { this.token = r.token; this.user = r; this._saveToken(); }
      return r;
    },

    async login(email, password) {
      const r = await this.api('POST', '/api/auth/login', { email, password });
      if (r.token) {
        this.token = r.token; this.user = r; this._saveToken();
        // 云存档恢复
        if (r.meta_json && r.meta_json !== '{}') {
          try { Object.assign(meta, JSON.parse(r.meta_json)); } catch (e) {}
        }
        if (r.shell_json && r.shell_json !== '{}') {
          try { Object.assign(window.shell || {}, JSON.parse(r.shell_json)); } catch (e) {}
        }
        // 服务端增量同步:只加admin/邮件/签到等途径在服务端新增的金币钻石,不覆盖本地消耗
        const prevSrvGold = parseInt((() => { try { return localStorage.getItem('fa_srv_gold') || '0'; } catch(e) { return '0'; } })());
        const prevSrvGems = parseInt((() => { try { return localStorage.getItem('fa_srv_gems') || '0'; } catch(e) { return '0'; } })());
        if (typeof meta !== 'undefined' && r.gold !== undefined && r.gold > prevSrvGold) {
          meta.gold = (meta.gold || 0) + (r.gold - prevSrvGold);
        }
        if (typeof shell !== 'undefined' && r.diamonds !== undefined && r.diamonds > prevSrvGems) {
          shell.gems = (shell.gems || 0) + (r.diamonds - prevSrvGems);
        }
        try { localStorage.setItem('fa_srv_gold', String(r.gold || 0)); } catch(e) {}
        try { localStorage.setItem('fa_srv_gems', String(r.diamonds || 0)); } catch(e) {}
        if (typeof saveAll === 'function') try { saveAll(); } catch(e) {}
      }
      return r;
    },

    // —— 会话保持:token 存 localStorage,刷新后 restoreSession 免重登 ——
    _saveToken() { try { localStorage.setItem('fa_token', this.token || ''); } catch (e) {} },
    logout() { this.token = null; this.user = null; try { localStorage.removeItem('fa_token'); } catch (e) {} },
    async loadSave() { return this.api('GET', '/api/save'); },
    async restoreSession() {
      let t; try { t = localStorage.getItem('fa_token'); } catch (e) {}
      if (!t) return { ok: false };
      this.token = t;
      try {
        const prof = await this.api('GET', '/api/user/profile');
        if (!prof || prof.error || prof.level === undefined) { this.logout(); return { ok: false }; }
        this.user = prof;
        const save = await this.loadSave();
        return { ok: true, meta_json: save && save.meta_json, shell_json: save && save.shell_json };
      } catch (e) { this.logout(); return { ok: false }; }
    },
    async sendChat(text) { return this.api('POST', '/api/chat', { text }); },

    async saveToCloud() {
      if (!this.token || !this.user) return;
      const data = {
        meta_json: JSON.stringify(meta),
        shell_json: JSON.stringify(shell),
        power: typeof computePower === 'function' ? computePower() : 0,
        highest_stage: meta.highestLevel || 1,
      };
      await this.api('POST', '/api/save', data);
    },

    async getMail() { return this.api('GET', '/api/mail'); },
    async readMail(id) { const r = await this.api('POST', '/api/mail/read', { id }); if (r.ok && this.user) { try { const prof = await this.api('GET', '/api/user/profile'); if (prof && !prof.error) { this.user.diamonds = prof.diamonds; this.user.gold = prof.gold; if (r.granted) { if (typeof meta !== 'undefined' && r.granted.gold) meta.gold = (meta.gold||0) + r.granted.gold; if (typeof shell !== 'undefined' && r.granted.diamonds) shell.gems = (shell.gems||0) + r.granted.diamonds; if (typeof shell !== 'undefined' && r.granted.fragments) { const _ids = Object.keys(shell.fragments || {}); if (_ids.length) { const _per = Math.floor(r.granted.fragments / _ids.length); const _rem = r.granted.fragments - _per * _ids.length; _ids.forEach((_id, _i) => { shell.fragments[_id] = (shell.fragments[_id] || 0) + _per + (_i < _rem ? 1 : 0); }); } } if (typeof saveAll === 'function') saveAll(); } } } catch(e) {} } return r; },
    async leaderboard(type) { return this.api('GET', '/api/leaderboard/' + (type || 'power')); },
    async chatMessages() { return this.api('GET', '/api/chat'); },
    async addExp(amount) { const r = await this.api('POST', '/api/user/exp', { exp: amount }); if (r.level && this.user) { this.user.level = r.level; this.user.exp = r.exp; } return r; },
    async reportLadder(score) { const r = await this.api('POST', '/api/ladder/report', { score }); if (r.rank && this.user) { this.user.ladder_rank = r.rank; this.user.ladder_score = r.score; } return r; },
    // 社交(以下函数暂无前端UI,后端API已就绪)
    async friends() { return this.api('GET', '/api/friends'); },
    async friendRequests() { return this.api('GET', '/api/friends/pending'); },
    async addFriend(uid) { return this.api('POST', '/api/friends/add', { uid }); },
    async acceptFriend(uid) { return this.api('POST', '/api/friends/accept', { uid }); },
    async rejectFriend(uid) { return this.api('POST', '/api/friends/reject', { uid }); },
    async removeFriend(uid) { return this.api('DELETE', '/api/friends', { uid }); },
    async achievements() { return this.api('GET', '/api/achievements'); },
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
          power: typeof computePower === 'function' ? computePower() : 0,
          highest_stage: meta.highestLevel || 1,
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
