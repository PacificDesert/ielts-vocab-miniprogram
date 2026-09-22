const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');
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
    done: false,
    canSpeak: !!config.AUDIO_API,
    speaking: false
  },

  onLoad() {
    /*
     * 拼写页可以发音，但**只在用户主动点喇叭时**（onSpeak）。
     * 自动朗读会在看到中文释义的同时把英文读出来 —— 那是答案。
     */
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) {
      // 音频源是网络地址，必须等 onCanplay 再 play，否则部分机型直接静默失败
      this.audio.autoplay = false;
      this.audio.onError(err => {
        this.setData({ speaking: false });
        wx.showToast({ title: '发音加载失败', icon: 'none' });
        console.warn('[spell] audio error', err);
      });
      this.audio.onEnded(() => this.setData({ speaking: false }));
    }
    this.again();
  },

  onShow() {
    this.setData(getApp().themeData());
    this.setData({ canSpeak: !!config.AUDIO_API && store.soundOn() });
    if (!this.data.list.length) {
      this.again();
    }
    /*
     * 拼写页**不自动朗读**：拼写的任务是「看中文写英文」，
     * 一进页面就念出读音等于把答案报出来，等于送分。
     * 想听的自己点卡上的小喇叭（onSpeak），那是主动行为。
     */
  },

  onHide() {
    // 离开页面立刻停声，免得在别的页面还在念
    if (this.audio) this.audio.stop();
    this.setData({ speaking: false });
  },

  onUnload() {
    this.stopTurn();
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
  },

  soundOn() {
    return !!config.AUDIO_API && store.soundOn();
  },

  /** 读一个单词；keyword 为 true 时不打断正在播的内容 */
  speakWord(w, keyword) {
    if (!this.audio || !this.soundOn() || !w) return;
    if (!keyword) this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(w);
    this.setData({ speaking: true });
    try {
      this.audio.play();
    } catch (e) {
      this.setData({ speaking: false });
      console.warn('[spell] play failed', e);
    }
    // 兜底：onEnded 偶发不触发时把高亮状态收回来
    clearTimeout(this._speakTimer);
    this._speakTimer = setTimeout(() => this.setData({ speaking: false }), 4000);
  },

  /** 点题目卡上的喇叭：重听当前单词 */
  onSpeak() {
    this.speakWord(this.data.cur && this.data.cur.w);
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
      canSpeak: !!config.AUDIO_API && store.soundOn(),
      mask: buildMask(cur.w || '', 0)
    });
    // 换词时**不自动朗读**（原因见 onShow）：想听的点卡上的小喇叭
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
