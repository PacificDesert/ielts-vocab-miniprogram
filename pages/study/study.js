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
    card: {}
  },

  onLoad() {
    const list = store.nextLearnBatch();
    this.setData(Object.assign({ list, done: !list.length }, getApp().themeData()), () => this.sync());
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
    const cur = this.data.list[this.data.idx] || {};
    this.setData({
      cur,
      show: false,
      card: cur.w ? word.card(cur.ch, cur.w, this.data.dark) : {}
    });
  },

  flip() {
    this.setData({ show: !this.data.show });
  },

  onKnow() {
    this.answer(true);
  },

  onUnknown() {
    this.answer(false);
  },

  answer(known) {
    const { cur, idx, list, right, wrong } = this.data;
    if (!cur.w) return;
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
    this.turnTo('next', advance);
  },

  again() {
    const list = store.nextLearnBatch();
    this.setData({ list, idx: 0, done: !list.length, right: 0, wrong: 0, show: false }, () => this.sync());
  },

  goSpell() {
    wx.switchTab({ url: '/pages/spell/spell' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
}));
