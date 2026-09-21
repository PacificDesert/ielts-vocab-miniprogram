const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');
const flip = require('../../utils/flip');

Page(flip.mixin({
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
    this.setData(Object.assign({ from: q.from || '' }, getApp().themeData()));
    this.show(decodeURIComponent(q.w || ''));
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  syncTheme() {
    this.setData(getApp().themeData());
    if (this.data.cur && this.data.cur.w) this.show(this.data.cur.w);
  },

  onUnload() {
    this.stopTurn();
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
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
      card: word.card(it.ch, it.w, this.data.dark),
      ex: word.example(it),
      sim: word.similar(it),
      dr: it.dr || [],
      lv: store.status(it.w)
    });
    wx.setNavigationBarTitle({ title: it.w });
  },

  /** 点相近词：翻书式切到该词 */
  onSimilar(e) {
    const w = e.currentTarget.dataset.w;
    this.turnTo('next', () => this.show(w));
  },

  /** 顺着词库顺序进入下一个单词 */
  onNextWord() {
    const list = word.all();
    const i = this.data.cur.i;
    const next = typeof i === 'number' ? list[i + 1] : null;
    if (!next) {
      wx.showToast({ title: '已经是最后一个单词', icon: 'none' });
      return;
    }
    this.turnTo('next', () => this.show(next.w));
  },

  /** 跳到当前词的第一个相近词 */
  onSimilarNext() {
    const next = (this.data.sim || [])[0];
    if (!next) {
      wx.showToast({ title: '没有相近词', icon: 'none' });
      return;
    }
    this.turnTo('next', () => this.show(next.w));
  },

  onSpeak() {
    this.speakWord(this.data.cur.w);
  },

  /** 列表里的发音按钮：朗读该行单词，不触发进入该词 */
  onSpeakWord(e) {
    this.speakWord(e.currentTarget.dataset.w);
  },

  speakWord(w) {
    if (!config.AUDIO_API || !w || !this.audio) return;
    this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(w);
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

  onBackStudy() {
    wx.navigateBack();
  }
}));
