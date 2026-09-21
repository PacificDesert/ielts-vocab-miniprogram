const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');
const flip = require('../../utils/flip');

Page(flip.mixin({
  data: {
    index: 0,
    total: 0,
    w: '',
    ph: '',
    cn: '',
    ch: '',
    lv: 0,
    ex: null,
    dr: [],
    card: {},
    canSpeak: !!config.AUDIO_API
  },

  onLoad(query) {
    this.list = word.all();
    this.setData(getApp().themeData());
    const target = decodeURIComponent(query.w || '');
    let i = this.list.findIndex(it => it.w === target);
    if (i < 0) i = 0;
    this.audio = wx.createInnerAudioContext();
    this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    this.setData({ total: this.list.length });
    this.show(i);
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  syncTheme() {
    this.setData(getApp().themeData());
    if (this.data.w) this.show(this.data.index);
  },

  onUnload() {
    this.stopTurn();
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  },

  show(i) {
    const it = this.list[i];
    if (!it) return;
    this.setData({
      index: i,
      w: it.w,
      ph: it.ph,
      cn: it.cn,
      ch: it.ch,
      lv: store.status(it.w),
      ex: word.example(it),
      dr: it.dr || [],
      card: word.card(it.ch, it.w, this.data.dark)
    });
    wx.setNavigationBarTitle({ title: it.w });
  },

  prev() {
    const i = (this.data.index - 1 + this.data.total) % this.data.total;
    this.turnTo('prev', () => this.show(i));
  },

  next() {
    const i = (this.data.index + 1) % this.data.total;
    this.turnTo('next', () => this.show(i));
  },

  play() {
    if (!this.audio) return;
    this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(this.data.w);
    this.audio.play();
  },

  onExpand() {
    wx.navigateTo({ url: '/pages/expand/expand?w=' + encodeURIComponent(this.data.w) + '&from=detail' });
  },

  markKnown() {
    store.markStudy(this.data.w, true);
    store.save();
    this.setData({ lv: store.status(this.data.w) });
    if (store.get().plan.showExpand) {
      this.onExpand();
    } else {
      wx.showToast({ title: '已标记为认识', icon: 'none' });
    }
  },

  markUnknown() {
    store.markStudy(this.data.w, false);
    store.save();
    this.setData({ lv: store.status(this.data.w) });
    wx.showToast({ title: '已加入待复习', icon: 'none' });
  }
}));
