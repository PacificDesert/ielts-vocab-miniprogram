const store = require('../../utils/store');
const word = require('../../utils/word');
const flip = require('../../utils/flip');

Page(flip.mixin({
  data: {
    list: [],
    idx: 0,
    show: false,
    done: false,
    right: 0,
    wrong: 0,
    cur: {},
    card: {},
    prevTag: '',
    turnSpeed: null
  },

  onLoad(q) {
    // 从拓展页「下一个单词」进来时带 ?i=<词库下标>，直接以该词为起点开一组记忆卡
    const idx = q && q.i !== undefined && q.i !== '' ? Number(q.i) : NaN;
    this.start = isNaN(idx) ? -1 : idx;
    const list = this.pickBatch();
    // 记下这一组，背完后可以直接拿来做「意思匹配」
    getApp().globalData.lastBatch = list;
    this.setData(Object.assign({ list, done: !list.length }, getApp().themeData()), () => this.sync());
  },

  /** start >= 0 说明是拓展页跳转进来的，按起点取词；否则走正常的学习游标 */
  pickBatch() {
    return this.start >= 0 ? store.batchFrom(this.start) : store.nextLearnBatch();
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  onUnload() {
    this.stopTurn();
  },

  syncTheme() {
    this.setData(getApp().themeData());
    const cur = this.data.list[this.data.idx];
    if (cur && cur.w) this.setData({ card: word.card(cur.ch, cur.w, getApp().themeData().dark) });
  },

  sync() {
    const { list, idx } = this.data;
    const cur = list[idx] || {};
    this.setData({
      cur,
      // 左上角标记上一个单词的拼写 / 音标 / 中文释义；第一个单词为空（不显示）
      prevTag: word.prevTag(list, idx - 1),
      show: false,
      card: cur.w ? word.card(cur.ch, cur.w, this.data.dark) : {}
    });
  },

  flip() {
    this.setData({ show: !this.data.show });
  },

  /**
   * 换词的翻书速度：默认跟随 utils/flip 的标准时长；
   * 打了哪一档（data.turnSpeed）就用哪一档，用于「认识」和「不认识」区分快慢。
   */
  turnSpeed() {
    return this.data.turnSpeed || undefined;
  },

  onKnow() {
    this.answer(true, { out: 420, in: 680 });
  },

  onUnknown() {
    this.answer(false);
  },

  answer(known, speed) {
    const { cur, idx, list, right, wrong } = this.data;
    if (!cur.w) return;
    this.setData({ turnSpeed: speed || null });
    const target = cur.w;
    store.markStudy(target, known);
    const nextIdx = idx + 1;
    const finished = nextIdx >= list.length;
    store.save();

    const advance = () => {
      this.setData({
        right: right + (known ? 1 : 0),
        wrong: wrong + (known ? 0 : 1),
        idx: finished ? idx : nextIdx,
        done: finished
      }, () => {
        if (!finished) this.sync();
      });
    };

    // 认识 → 进入拓展页看例句与相近词（可在「我的」里关闭）
    if (known && store.get().plan.showExpand) {
      advance();
      wx.navigateTo({ url: '/pages/expand/expand?w=' + encodeURIComponent(target) + '&from=study' });
      return;
    }
    this.turnTo('next', advance, this.turnSpeed());
  },

  again() {
    const list = this.pickBatch();
    getApp().globalData.lastBatch = list;
    this.setData({ list, idx: 0, done: !list.length, right: 0, wrong: 0, show: false }, () => this.sync());
  },

  /** 学完一组后做「单词意思匹配」 */
  goMatch() {
    wx.navigateTo({ url: '/pages/match/match' });
  },
  goSpell() {
    wx.switchTab({ url: '/pages/spell/spell' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
}));
