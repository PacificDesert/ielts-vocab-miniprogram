const store = require('./utils/store');
const cloud = require('./utils/cloud');

App({
  globalData: {
    cloudReady: false,
    openid: ''
  },

  onLaunch() {
    store.load();
    this.globalData.cloudReady = cloud.init();
    if (this.globalData.cloudReady) {
      cloud.call('login').then(res => {
        this.globalData.openid = res.openid || '';
        return store.pull();
      }).catch(() => {});
    }
  },

  onHide() {
    store.flush();
  }
});
