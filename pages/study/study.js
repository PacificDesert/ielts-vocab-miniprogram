const store = require('../../utils/store');
const word = require('../../utils/word');

Page({
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
    this.setData({ list, done: !list.length }, () => this.sync());
  },

  sync() {
    const cur = this.data.list[this.data.idx] || {};
    this.setData({
      cur,
      show: false,
      card: cur.w ? word.card(cur.ch, cur.w) : {}
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
    this.setData({
      right: right + (known ? 1 : 0),
      wrong: wrong + (known ? 0 : 1),
      idx: finished ? idx : nextIdx,
      done: finished
    }, () => {
      if (!finished) this.sync();
    });
    // 认识 → 进入拓展页看例句与相近词（可在「我的」里关闭）
    if (known && store.get().plan.showExpand) {
      wx.navigateTo({ url: '/pages/expand/expand?w=' + encodeURIComponent(target) + '&from=study' });
    }
  },

  copy() {
    const it = word.get(this.data.cur.w);
    if (!it) return;
    wx.setClipboardData({
      data: word.copyText(it),
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
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
});
