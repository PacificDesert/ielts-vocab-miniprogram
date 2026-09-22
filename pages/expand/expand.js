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
    canSpeak: !!config.AUDIO_API,
    sound: true
  },

  onLoad(q) {
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    this.setData(Object.assign({ from: q.from || '' }, getApp().themeData()));
    this.show(decodeURIComponent(q.w || ''));
  },

  onShow() {
    this.setData(getApp().themeData());
    this.setData({ canSpeak: !!config.AUDIO_API && store.soundOn() });
  },

  onHide() {
    // 离开页面立刻停声
    if (this.audio) this.audio.stop();
  },

  syncTheme() {
    this.setData(getApp().themeData());
    if (this.data.cur && this.data.cur.w) this.show(this.data.cur.w);
  },

  onUnload() {
    this.stopTurn();
    if (this.audio) {
      this.audio.stop();
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
      lv: store.status(it.w),
      sound: store.soundOn()
    });
    wx.setNavigationBarTitle({ title: it.w });
    // 有声模式：进入拓展页读一遍这个单词（与记忆卡「读单词读音」一致）
    if (this.data.canSpeak && this.data.sound) this.speakWord(it.w, true);
  },

  /** 点相近词：翻书式切到该词 */
  onSimilar(e) {
    const w = e.currentTarget.dataset.w;
    this.turnTo('next', () => this.show(w));
  },

  /**
   * 下一个单词：回到「记忆单词」的大卡片继续背，而不是停在拓展页里翻词。
   * 从学习页进来时直接返回——学习页已经停在下一个单词的记忆卡上；
   * 从详情 / 词库进来时，以该词为起点开一组记忆卡。
   */
  onNextWord() {
    const list = word.all();
    const i = this.data.cur.i;
    const next = typeof i === 'number' ? list[i + 1] : null;
    if (this.data.from === 'study') return wx.navigateBack();
    if (!next) {
      wx.showToast({ title: '已经是最后一个单词', icon: 'none' });
      return;
    }
    wx.redirectTo({ url: '/pages/study/study?i=' + next.i });
  },

  onSpeak() {
    this.speakWord(this.data.cur.w);
  },

  /** 列表里的发音按钮：朗读该行单词，不触发进入该词 */
  onSpeakWord(e) {
    this.speakWord(e.currentTarget.dataset.w);
  },

  /** keyword 为 true 时不打断正在播的内容（自动发音用，避免连点叠音） */
  speakWord(w, keyword) {
    if (!w || !this.audio) return;
    if (!keyword) this.audio.stop();
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
  }
}));
