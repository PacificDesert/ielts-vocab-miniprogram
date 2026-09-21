const store = require('../../utils/store');
const word = require('../../utils/word');
const flip = require('../../utils/flip');

/** 答对后翻页要比平时慢一些，让人来得及看一眼上一个单词的标记 */
const SLOW_TURN = { out: 420, in: 700 };

function buildMask(text, reveal) {
  let i = 0;
  return String(text).split('').map(ch => {
    if (/[a-z]/i.test(ch)) {
      const out = i < reveal ? ch : '_';
      i += 1;
      return out;
    }
    return ch;
  }).join(' ');
}

Page(flip.mixin({
  data: {
    list: [],
    idx: 0,
    cur: {},
    card: {},
    prevTag: '',
    slowTurn: null,
    input: '',
    mask: '',
    reveal: 0,
    checked: false,
    ok: false,
    right: 0,
    wrong: 0,
    acc: 0,
    done: false
  },

  onLoad() {
    this.again();
  },

  onShow() {
    this.setData(getApp().themeData());
    if (!this.data.list.length) this.again();
  },

  onUnload() {
    this.stopTurn();
  },

  syncTheme() {
    this.setData(getApp().themeData());
    // 主题切换时词卡配色（章节图遮罩、水印颜色）要跟着重算
    const cur = this.data.list[this.data.idx];
    if (cur && cur.w) this.setData({ card: word.card(cur.ch, cur.w, getApp().themeData().dark) });
  },

  again() {
    const list = store.nextSpellBatch();
    this.setData({
      list,
      idx: 0,
      right: 0,
      wrong: 0,
      done: !list.length
    }, () => this.sync());
  },

  sync() {
    const { list, idx } = this.data;
    const cur = list[idx] || {};
    this.setData({
      cur,
      card: cur.w ? word.card(cur.ch, cur.w, this.data.dark) : {},
      // 左上角标记上一个单词：拼写 + 音标 + 中文 + 词形；第一个为空（不显示）
      prevTag: word.prevTag(list, idx - 1, { forms: true }),
      input: '',
      checked: false,
      ok: false,
      reveal: 0,
      mask: buildMask(cur.w || '', 0)
    });
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  hint() {
    const reveal = Math.min(this.data.reveal + 1, Math.max(0, this.data.cur.w.length - 1));
    this.setData({ reveal, mask: buildMask(this.data.cur.w, reveal) });
  },

  normalize(s) {
    return String(s || '').toLowerCase().replace(/[\s\-'.]+/g, ' ').trim();
  },

  submit() {
    const { checked, cur, input } = this.data;
    if (checked || !cur.w) return;
    if (!String(input).trim()) {
      wx.showToast({ title: '请输入单词', icon: 'none' });
      return;
    }
    const ok = this.normalize(input) === this.normalize(cur.w);
    store.markSpell(cur.w, ok);
    store.save();
    this.setData({
      checked: true,
      ok,
      // 答对：翻页慢一些；答错／跳过：用标准速度
      slowTurn: ok ? SLOW_TURN : null,
      right: this.data.right + (ok ? 1 : 0),
      wrong: this.data.wrong + (ok ? 0 : 1)
    });
    if (ok) setTimeout(() => this.next(), 600);
  },

  skip() {
    if (this.data.checked) return;
    const { cur } = this.data;
    store.markSpell(cur.w, false);
    store.save();
    this.setData({
      checked: true,
      ok: false,
      slowTurn: null,
      wrong: this.data.wrong + 1
    });
  },

  next() {
    const n = this.data.idx + 1;
    if (n >= this.data.list.length) {
      this.setData({ done: true, acc: this.accuracy() });
      return;
    }
    // 答对时用更慢的翻页，让人看清左上角上一个单词的标记
    this.turnTo('next', () => this.setData({ idx: n }, () => this.sync()), this.data.slowTurn);
  },

  accuracy() {
    const total = this.data.right + this.data.wrong;
    return total ? Math.round(this.data.right * 100 / total) : 0;
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goStudy() {
    wx.navigateTo({ url: '/pages/study/study' });
  }
}));
