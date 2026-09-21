Page({
  data: {
    updated: '2026-09-21',
    email: '924422162@qq.com'
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  syncTheme() {
    this.setData(getApp().themeData());
  }
});
