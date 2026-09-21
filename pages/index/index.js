const store = require('../../utils/store');
const word = require('../../utils/word');

Page({
  data: {
    stats: {},
    today: {},
    chapters: [],
    cloud: false
  },

  onShow() {
    this.setData(getApp().themeData());
    this.refresh();
  },

  syncTheme() {
    this.setData(getApp().themeData());
  },

  refresh() {
    const stats = store.stats();
    const chapters = word.chapterList().map(c => {
      const learned = c.words.filter(it => store.status(it.w) > 0).length;
      return {
        name: c.name,
        total: c.words.length,
        learned,
        percent: c.words.length ? Math.round(learned / c.words.length * 100) : 0
      };
    });
    this.setData({
      stats,
      today: Object.assign({}, store.day()),
      chapters,
      cloud: !!(getApp() && getApp().globalData.cloudReady)
    });
  },

  onLearn() {
    wx.navigateTo({ url: '/pages/study/study' });
  },

  onSpell() {
    wx.switchTab({ url: '/pages/spell/spell' });
  },

  onChapter(e) {
    getApp().globalData.pendingChapter = e.currentTarget.dataset.name;
    wx.switchTab({ url: '/pages/vocab/vocab' });
  }
});
