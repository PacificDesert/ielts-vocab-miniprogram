const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');

Page({
  data: {
    cur: {},
    img: '',
    card: {},
    ex: null,
    sim: [],
    dr: [],
    from: '',
    lv: 0,
    canSpeak: !!config.AUDIO_API
  },

  onLoad(q) {
    this.audio = wx.createInnerAudioContext();
    this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    this.setData({ from: q.from || '' });
    this.show(decodeURIComponent(q.w || ''));
  },

  onUnload() {
    if (this.audio) this.audio.destroy();
  },

  show(name) {
    const it = word.get(name);
    if (!it) {
      wx.showToast({ title: '找不到该单词', icon: 'none' });
      return;
    }
    this.setData({
      cur: it,
      img: word.themeImage(it.ch),
      card: word.card(it.ch, it.w),
      ex: word.example(it),
      sim: word.similar(it),
      dr: it.dr || [],
      lv: store.status(it.w)
    });
    wx.setNavigationBarTitle({ title: it.w });
  },

  onSimilar(e) {
    this.show(e.currentTarget.dataset.w);
  },

  onCopy() {
    wx.setClipboardData({
      data: word.copyFull(this.data.cur),
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  },

  onSpeak() {
    this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(this.data.cur.w);
    this.audio.play();
  },

  onDetail() {
    wx.redirectTo({ url: '/pages/detail/detail?w=' + encodeURIComponent(this.data.cur.w) });
  },

  onKnow() {
    store.markStudy(this.data.cur.w, true);
    store.save();
    this.setData({ lv: store.status(this.data.cur.w) });
    wx.showToast({ title: '已标记认识', icon: 'none' });
  },

  onNext() {
    if (this.data.from === 'study') {
      wx.navigateBack();
      return;
    }
    const next = word.similar(this.data.cur)[0];
    if (next) this.show(next.w);
    else wx.navigateBack();
  }
});
