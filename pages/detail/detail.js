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
    exToks: [],
    popWord: null,
    dr: [],
    card: {},
    canSpeak: !!config.AUDIO_API,
    sound: true
  },

  onLoad(query) {
    this.list = word.all();
    this.setData(getApp().themeData());
    const target = decodeURIComponent(query.w || '');
    let i = this.list.findIndex(it => it.w === target);
    if (i < 0) i = 0;
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    this.setData({ total: this.list.length });
    this.show(i);
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
    if (this.data.w) this.show(this.data.index);
  },

  onUnload() {
    this.stopTurn();
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
  },

  show(i) {
    const it = this.list[i];
    if (!it) return;
    const ex = word.example(it);
    this.setData({
      index: i,
      w: it.w,
      ph: it.ph,
      cn: word.cnText(it.cn, it.w),
      ch: it.ch,
      lv: store.status(it.w),
      ex,
      // 例句切词：每个英文词都能点开查义（见 exClickable）
      exToks: ex ? word.exClickable(ex.en, it.w) : [],
      dr: it.dr || [],
      card: word.card(it.ch, it.w, this.data.dark),
      sound: store.soundOn()
    });
    wx.setNavigationBarTitle({ title: it.w });
    // 有声模式：进入详情页读一遍这个单词
    if (this.data.canSpeak && this.data.sound) this.speakWord(it.w, true);
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
    this.speakWord(this.data.w);
  },

  /** keyword 为 true 时不打断正在播的内容（自动发音用，避免连点叠音） */
  speakWord(w, keyword) {
    if (!w || !this.audio) return;
    if (!keyword) this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(w);
    this.audio.play();
  },

  onExpand() {
    wx.navigateTo({ url: '/pages/expand/expand?w=' + encodeURIComponent(this.data.w) + '&from=detail' });
  },

  /**
   * 点例句里的单词看释义。
   * 词库里有 → 弹层显示音标/释义，并给「查看详情 / 发音」；
   * 不在词库 → 只提示，不乱查（免得给出不相干的释义）。
   */
  onExWord(e) {
    const i = e.currentTarget.dataset.i;
    const tok = this.data.exToks[i];
    if (!tok || !tok.w) return;
    if (!tok.it) {
      wx.showToast({ title: '「' + tok.w + '」不在本词库', icon: 'none' });
      return;
    }
    const it = tok.it;
    this.setData({
      popWord: {
        w: it.w,
        ph: it.ph || '',
        cn: word.cnText(it.cn, it.w),
        ex: it.ex && it.ex[0] ? word.exText(it.ex[0]) : '',
        exZh: it.ex && it.ex[1] ? it.ex[1] : ''
      }
    });
  },

  closePop() {
    this.setData({ popWord: null });
  },

  /** 弹层里的发音 */
  popSpeak() {
    const p = this.data.popWord;
    if (p) this.speakWord(p.w);
  },

  /** 弹层里跳到该词的详情页 */
  popDetail() {
    const p = this.data.popWord;
    if (!p) return;
    this.closePop();
    const i = this.list.findIndex(it => it.w === p.w);
    if (i < 0) return;
    this.turnTo('next', () => this.show(i));
  },

  /** 阻止点弹层本体时穿透关闭 */
  noop() {},

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
