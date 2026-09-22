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
    exParts: [],
    noEx: false,
    canSpeak: !!config.AUDIO_API,
    speaking: false,
    turnSpeed: null
  },

  onLoad(q) {
    // 从拓展页「下一个单词」进来时带 ?i=<词库下标>，直接以该词为起点开一组记忆卡
    const idx = q && q.i !== undefined && q.i !== '' ? Number(q.i) : NaN;
    this.start = isNaN(idx) ? -1 : idx;
    // 发音：记忆卡正面读单词、背面读例句，与拓展页同一套音源
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    const list = this.pickBatch();
    // 记下这一组，背完后可以直接拿来做「意思匹配」
    getApp().globalData.lastBatch = list;
    this.setData(Object.assign({ list, done: !list.length }, getApp().themeData()), () => this.sync(true));
  },

  onUnload() {
    this.stopTurn();
    if (this._pickTimer) {
      clearTimeout(this._pickTimer);
      this._pickTimer = null;
    }
    if (this.audio) this.audio.stop();
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  },

  onHide() {
    // 跳到别的页面立刻停声，避免在拓展页/详情页还在念上一个词
    if (this.audio) this.audio.stop();
  },

  onShow() {
    this.setData(getApp().themeData());
    // 从拓展页返回时，用户在「我的」里改过有声模式，回来立刻生效
    this.setData({ canSpeak: !!config.AUDIO_API && store.soundOn() });
  },

  /** 是否处于有声模式（静音模式下不自动出声） */
  soundOn() {
    return !!config.AUDIO_API && store.soundOn();
  },

  /**
   * 朗读一段文本。
   * keyword 之外会先停掉上一段：连点两张卡时不至于两句话叠在一起。
   */
  speakText(text, keyword) {
    if (!this.audio || !this.soundOn() || !text) return;
    const t = word.exText(text);
    if (!t) return;
    if (!keyword) this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(t);
    this.audio.play();
  },

  /** 点小喇叭：朗读当前单词的例句，并高亮一下喇叭 */
  onSpeakEx() {
    const cur = this.data.cur;
    this.speakText(cur && cur.ex && cur.ex[0] ? cur.ex[0] : '');
    this.setData({ speaking: true });
    setTimeout(() => this.setData({ speaking: false }), 600);
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

  /**
   * 渲染当前这张卡。
   * autoSpeak 只在「真正换了一个词」时传 true —— 主题重绘、从拓展页返回之类的
   * 重渲染不传，否则每切一次主题就自动念一遍。
   */
  sync(autoSpeak) {
    const { list, idx } = this.data;
    const cur = list[idx] || {};
    const exRaw = cur.ex && cur.ex[0] ? cur.ex[0] : '';
    const exParts = word.exParts(exRaw, cur.w);
    this.setData({
      cur,
      // 例句：去掉《例词》书名号（接口会把书名号也念出来），并把目标词单独切出来加黑加粗
      exParts,
      /*
       * 约 9.8% 的词（326 个）原书就没有例句 —— 这是数据本身的缺口，
       * 不是解析 bug（缺例句的词均匀散落在全部 22 章，各章 3%~15%，
       * 且这些词的音标与释义都完整）。没有例句时就不能只留四个中文释义让用户干猜，
       * 正面改成显示单词本身当锚点（见 study.wxml 的 noEx 分支）。
       */
      noEx: !exParts.length,
      // 正面「选释义」的四个选项卡：正确释义 + 3 个形近词释义，每张卡重新打乱顺序
      opts: cur.w ? shuffle(word.options(cur, 4).map(o => ({ cn: o.cn, ok: o.ok, st: '' }))) : [],
      // 左上角标记上一个单词的拼写 / 音标 / 中文释义；第一个单词为空（不显示）
      prevTag: word.prevTag(list, idx - 1),
      show: false,
      picked: false,
      canSpeak: !!config.AUDIO_API && store.soundOn(),
      card: cur.w ? word.card(cur.ch, cur.w, this.data.dark) : {}
    }, () => {
      if (!cur.w) return;
      if (!this.soundOn()) return;
      // 有声模式默认行为（例句卡在前、单词卡在后）：
      //   · 正面「选释义」= 例句卡 —— 读整句例句，听到句子里这个词的用法，
      //     再凭语感挑出对应的中文释义；
      //   · 选对后翻到背面 = 单词卡 —— 读单词读音，确认这个词本身怎么念。
      this.speakText(exRaw || cur.w, true);
    });
  },

  /**
   * 翻到背面（单词卡）：有声模式下读单词读音 —— 与正面例句卡的例句朗读区分开。
   */
  revealBack() {
    this.speakText(this.data.cur && this.data.cur.w, true);
  },

  /** 点单词本身也能听一次读音 */
  onSpeakWord() {
    this.speakText(this.data.cur && this.data.cur.w, true);
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
    this._pickTimer = setTimeout(() => {
      // 翻到单词卡之前，把选项卡上的对错标记全部清掉。
      // 背面（单词卡）只有单词/音标/释义，本就不该出现选项；而 iOS 下
      // backface-visibility 偶发穿透，先前选错留下的红框会在单词卡上残留一块。
      this.setData({ show: true, opts: this.data.opts.map(o => Object.assign({}, o, { st: '' })) });
      this.revealBack();
    }, 400);
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
        if (!finished) this.sync(true);
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
    this.setData({ list, idx: 0, done: !list.length, right: 0, wrong: 0, show: false }, () => this.sync(true));
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
