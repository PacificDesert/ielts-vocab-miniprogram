const store = require('./utils/store');
const cloud = require('./utils/cloud');
const theme = require('./utils/theme');

App({
  globalData: {
    cloudReady: false,
    openid: '',
    syncedAt: 0
  },

  onLaunch() {
    theme.init();
    this.globalData.cloudReady = cloud.init();
    store.load();

    // 系统主题变化 / 用户手动切换时，同步刷新当前页面
    theme.watch(() => {
      const pages = getCurrentPages();
      const cur = pages[pages.length - 1];
      if (cur && cur.syncTheme) cur.syncTheme();
    });

    if (!this.globalData.cloudReady) return;

    // 启动时登录 + 双向同步（合并后写回本地，页面 onShow 会读到最新数据）
    cloud.call('login', {})
      .then(res => {
        this.globalData.openid = res.openid || '';
        return store.sync();
      })
      .then(() => {
        this.globalData.syncedAt = Date.now();
        this.refreshPage();
      })
      .catch(() => {});
  },

  onHide() {
    store.flush();
  },

  onShow() {
    // 从后台切回时也同步一次，避免两台设备数据长期不一致
    if (this.globalData.cloudReady && Date.now() - this.globalData.syncedAt > 60000) {
      store.sync()
        .then(() => {
          this.globalData.syncedAt = Date.now();
          this.refreshPage();
        })
        .catch(() => {});
    }
  },

  /** 页面在 onShow 里取主题：this.setData(getApp().themeData()) */
  themeData() {
    return theme.data();
  },

  /** 同步回来后刷新当前页面数据 */
  refreshPage() {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    if (cur && typeof cur.onShow === 'function') {
      try { cur.onShow(); } catch (e) { /* 忽略单个页面刷新失败 */ }
    }
  }
});
