/* Minimal shared hook registry for visual and update extensions. */
(function installHooks() {
  function makeListHook() {
    const handlers = [];
    return {
      handlers,
      use(fn, priority = 0) {
        if (typeof fn !== 'function') return fn;
        handlers.push({ fn, priority: Number(priority) || 0 });
        handlers.sort((a, b) => b.priority - a.priority);
        return fn;
      },
      run(...args) {
        for (const h of handlers.slice()) h.fn(...args);
      },
    };
  }

  window.RenderHooks = window.RenderHooks || {
    beforeDrawSoldier: makeListHook(),
    afterDrawSoldier: makeListHook(),
  };

  window.GameHooks = window.GameHooks || {
    update: makeListHook(),
  };
})();
