const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');
const flip = require('../../utils/flip');

/** 打乱数组（洗牌），返回新数组；用来让四个选项卡的正确答案不总在第一个 */
function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

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
    opts: [],
    picked: false,
    turnSpeed: null
  },

  onLoad(q) {
    // 从拓展页「下一个单词」进来时带 ?i=<词库下标>，直接以该词为起点开一组记忆卡
    const idx = q && q.i !== undefined && q.i !== '' ? Number(q.i) : NaN;
    this.start = isNaN(idx) ? -1 : idx;
    // 例句发音：与拓展页同一套（config.AUDIO_API 未配置时隐藏按钮）
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    const list = this.pickBatch();
    // 记下这一组，背完后可以直接拿来做「意思匹配」
    getApp().globalData.lastBatch = list;
    this.setData(Object.assign({ list, done: !list.length }, getApp().themeData()), () => this.sync());
  },

  onUnload() {
    this.stopTurn();
    if (this._pickTimer) {
      clearTimeout(this._pickTimer);
      this._pickTimer = null;
    }
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  },

  onShow() {
    this.setData(getApp().themeData());
  },

  /** 朗读当前单词的例句（用例句文本喂给同一个发音接口） */
  onSpeakEx() {
    const ex = this.data.cur && this.data.cur.ex;
    if (!this.audio || !ex || !ex[0]) return;
    this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(ex[0]);
    this.audio.play();
  },

  /** start >= 0 说明是拓展页跳转进来的，按起点取词；否则走正常的学习游标 */
  pickBatch() {
    return this.start >= 0 ? store.batchFrom(this.start) : store.nextLearnBatch();
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
      // 正面「选释义」的四个选项卡：正确释义 + 3 个形近词释义，每张卡重新打乱顺序
      opts: cur.w ? shuffle(word.options(cur, 4).map(o => ({ cn: o.cn, ok: o.ok, st: '' }))) : [],
      // 左上角标记上一个单词的拼写 / 音标 / 中文释义；第一个单词为空（不显示）
      prevTag: word.prevTag(list, idx - 1),
      show: false,
      card: cur.w ? word.card(cur.ch, cur.w, this.data.dark) : {}
    });
  },

  /**
   * 点选释义选项卡。
   * 选对 → 立刻标绿，0.4s 后翻到卡片背面（看释义 / 例句 / 章节），
   *   再由底部的「不认识 / 认识」记熟练度并进入下一个单词；
   * 选错 → 整块变红抖一下并锁定，用户可以继续试其他选项。
   */
  onPick(e) {
    const i = Number(e.currentTarget.dataset.i);
    const opts = this.data.opts;
    if (!opts || !opts[i]) return;
    if (opts[i].st === 'bad') return;      // 选错的已锁死
    if (this.data.picked) return;          // 已经选对，等翻面 / 进入下一个

    const next = opts.map((o, k) => (k === i ? Object.assign({}, o, { st: o.ok ? 'ok' : 'bad' }) : o));
    if (!opts[i].ok) {
      this.setData({ opts: next });
      return;
    }
    this.setData({ opts: next, picked: true });
    this._pickTimer = setTimeout(() => this.setData({ show: true }), 400);
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
