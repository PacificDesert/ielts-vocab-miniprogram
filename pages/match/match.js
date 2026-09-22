const store = require('../../utils/store');
const flip = require('../../utils/flip');
const word = require('../../utils/word');

const ROUND = 4;   // 每屏 4 对，做完自动翻到下一屏

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  const last = out[out.length - 1];
  if (out.length > 1 && last && last.length < 2) {
    out.pop();
    out[out.length - 1] = out[out.length - 1].concat(last);
  }
  return out;
}

function usable(list) {
  return (list || []).filter(it => it && it.w && it.cn);
}

Page(flip.mixin({
  data: {
    rounds: [],
    ri: 0,
    left: [],
    right: [],
    pickL: -1,
    pickR: -1,
    total: 0,
    doneCount: 0,
    ok: 0,
    no: 0,
    done: false,
    acc: 0
  },

  onLoad() {
    const app = getApp();
    let batch = usable(app.globalData.lastBatch);
    if (batch.length < 2) batch = usable(store.nextLearnBatch());
    if (batch.length < 2) {
      wx.showToast({ title: '还没有可练习的单词', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const rounds = chunk(batch, ROUND);
    this.setData(Object.assign({
      rounds,
      total: rounds.reduce((n, r) => n + r.length, 0),
      ri: 0
    }, app.themeData()), () => this.buildRound());
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  syncTheme() {
    this.setData(getApp().themeData());
  },

  onUnload() {
    this.stopTurn();
  },

  /** 铺一屏：左边英文、右边中文，两边各自打乱 */
  buildRound() {
    const words = this.data.rounds[this.data.ri] || [];
    const left = shuffle(words.map((it, i) => ({ k: 'L' + i, t: it.w, w: it.w, st: '' })));
    // 中文侧统一走 cnText 补词性：词库自带的直接用，其余查 POS_MAP
    const right = shuffle(words.map((it, i) => ({
      k: 'R' + i, t: word.cnText(it.cn, it.w), w: it.w, st: ''
    })));
    this.setData({ left, right, pickL: -1, pickR: -1 });
  },

  onPick(e) {
    const side = e.currentTarget.dataset.side;
    const i = Number(e.currentTarget.dataset.i);
    const list = side === 'l' ? this.data.left : this.data.right;
    if (!list[i] || list[i].st === 'ok') return;
    const patch = {};
    if (side === 'l') patch.pickL = this.data.pickL === i ? -1 : i;
    else patch.pickR = this.data.pickR === i ? -1 : i;
    this.setData(patch, () => this.judge());
  },

  judge() {
    const { pickL, pickR, left, right } = this.data;
    if (pickL < 0 || pickR < 0) return;
    const hit = left[pickL].w === right[pickR].w;
    left[pickL].st = hit ? 'ok' : 'bad';
    right[pickR].st = hit ? 'ok' : 'bad';
    this.setData({
      left,
      right,
      pickL: -1,
      pickR: -1,
      ok: this.data.ok + (hit ? 1 : 0),
      no: this.data.no + (hit ? 0 : 1),
      doneCount: this.data.doneCount + (hit ? 1 : 0)
    }, () => (hit ? this.afterPair() : this.clearBad()));
  },

  /** 配错了抖一下再恢复，不锁死，可以重新选 */
  clearBad() {
    setTimeout(() => {
      const clear = list => list.map(it => (it.st === 'bad' ? Object.assign({}, it, { st: '' }) : it));
      this.setData({ left: clear(this.data.left), right: clear(this.data.right) });
    }, 520);
  },

  afterPair() {
    if (!this.data.left.every(it => it.st === 'ok')) return;
    if (this.data.ri + 1 >= this.data.rounds.length) {
      this.setData({ done: true, acc: this.accuracy() });
      return;
    }
    this.turnTo('next', () => {
      this.setData({ ri: this.data.ri + 1 }, () => this.buildRound());
    });
  },

  accuracy() {
    const t = this.data.ok + this.data.no;
    return t ? Math.round(this.data.ok * 100 / t) : 0;
  },

  again() {
    const app = getApp();
    let batch = usable(app.globalData.lastBatch);
    if (batch.length < 2) batch = usable(store.nextLearnBatch());
    if (batch.length < 2) return this.goHome();
    const rounds = chunk(batch, ROUND);
    this.setData({
      rounds,
      total: rounds.reduce((n, r) => n + r.length, 0),
      ri: 0,
      ok: 0,
      no: 0,
      doneCount: 0,
      done: false,
      acc: 0
    }, () => this.buildRound());
  },

  goStudy() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
}));
