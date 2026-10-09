const store = require('../../utils/store');
const word = require('../../utils/word');
const config = require('../../config');

const speaking = require('../../data/speaking');

/** 考官题目的类型 */
const EXAM_KINDS = [
  { id: 'p1', label: 'Part 1 · 日常问答', sub: '15 个话题 63 题，每题答 2-3 句' },
  { id: 'p2', label: 'Part 2 · 个人陈述', sub: '14 套题卡，准备 1 分钟后说 2 分钟' },
  { id: 'p3', label: 'Part 3 · 深入讨论', sub: '15 道讨论题，需展开论述' }
];

/** 讯飞评分维度 → 中文名。云函数按这个顺序返回 dims。 */
const DIM_NAME = {
  pronunciation: '发音准确度',
  fluency: '流利度',
  integrity: '完整度',
  tone: '语调'
};

Page({
  data: {
    mode: 'read',

    // 跟读
    readEn: '',
    readZh: '',
    readFrom: '',
    readText: '',      // 送去评测的参考文本

    // 考官
    examKinds: EXAM_KINDS,
    examKind: 'p1',
    examTopic: '',
    examEn: '',
    examPoints: [],
    examText: '',

    // 录音
    recording: false,
    recTip: '点上面的按钮开始朗读，再点一次结束',

    // 评分
    scoring: false,
    score: null,

    canSpeak: !!config.AUDIO_API
  },

  onLoad() {
    this.setData(getApp().themeData());
    this.rec = wx.getRecorderManager ? wx.getRecorderManager() : null;
    this.audio = config.AUDIO_API ? wx.createInnerAudioContext() : null;
    if (this.audio) {
      this.audio.onError(() => wx.showToast({ title: '发音加载失败', icon: 'none' }));
    }
    this.bindRecorder();
    this.nextRead();
    this.nextExam();
  },

  onShow() {
    this.setData(getApp().themeData());
    this.setData({ canSpeak: !!config.AUDIO_API && store.soundOn() });
  },

  onHide() {
    if (this.audio) this.audio.stop();
    if (this.data.recording && this.rec) this.rec.stop();
    this.setData({ recording: false });
  },

  onUnload() {
    if (this.audio) {
      this.audio.stop();
      this.audio.destroy();
      this.audio = null;
    }
  },

  /* ---------------- 录音 ---------------- */

  bindRecorder() {
    if (!this.rec) return;
    this.rec.onStart(() => this.setData({ recording: true, recTip: '正在录音…再点一次结束' }));
    this.rec.onStop(res => {
      this.setData({ recording: false, recTip: '录音完成，正在送评…' });
      this.score(res.tempFilePath);
    });
    this.rec.onError(err => {
      this.setData({ recording: false, recTip: '录音失败，请检查麦克风权限' });
      console.warn('[speaking] recorder error', err);
    });
  },

  toggleRec() {
    if (!this.rec) {
      wx.showToast({ title: '当前环境不支持录音', icon: 'none' });
      return;
    }
    const ref = this.data.mode === 'read' ? this.data.readText : this.data.examText;
    if (!ref) {
      wx.showToast({ title: '还没有题目', icon: 'none' });
      return;
    }
    if (this.data.recording) {
      this.rec.stop();
      return;
    }
    // 讯飞要求 16k / 16bit / 单声道；mp3 对应它的 aue=lame
    this.rec.start({
      duration: config.SPEECH.MAX_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
  },

  /* ---------------- 评测 ---------------- */

  /**
   * 送评：把录音转成 base64 交给云函数。
   * 密钥（讯飞 AppID/APIKey/APISecret）只存在于云函数环境变量里，
   * 前端一行都不碰 —— 小程序代码可以被反编译，放前端等于公开。
   */
  score(tempFilePath) {
    if (!tempFilePath) return;
    const ref = this.data.mode === 'read' ? this.data.readText : this.data.examText;

    if (!wx.cloud || !config.CLOUD_ENV) {
      this.setData({
        scoring: false,
        recTip: '未配置云环境，录音已保存但无法评分',
        score: null
      });
      wx.showToast({ title: '未配置云环境，暂不能评分', icon: 'none' });
      return;
    }

    this.setData({ scoring: true, score: null });

    let base64 = '';
    try {
      base64 = wx.getFileSystemManager().readFileSync(tempFilePath, 'base64');
    } catch (e) {
      this.setData({ scoring: false, recTip: '读取录音失败' });
      return;
    }

    wx.cloud.callFunction({
      name: config.SPEECH.FN,
      data: {
        audio: base64,
        format: 'mp3',
        refText: ref,
        // 跟读用句子模式；考官是自由作答，用自由说模式（无预设文本）
        mode: this.data.mode === 'read' ? 'sentence' : 'free'
      }
    }).then(res => {
      const r = (res && res.result) || {};
      if (!r.ok) {
        this.setData({ scoring: false, recTip: r.msg || '评测失败' });
        wx.showToast({ title: r.msg || '评测失败', icon: 'none' });
        return;
      }
      this.setData({
        scoring: false,
        recTip: '再点按钮录下一遍',
        score: this.buildScore(r)
      });
    }).catch(err => {
      console.warn('[speaking] callFunction failed', err);
      this.setData({ scoring: false, recTip: '网络异常，评测未完成' });
      wx.showToast({ title: '评测请求失败', icon: 'none' });
    });
  },

  /** 把云函数返回的原始分整理成页面上要展示的形状 */
  buildScore(r) {
    const dims = Object.keys(DIM_NAME)
      .filter(k => typeof r[k] === 'number')
      .map(k => ({ name: DIM_NAME[k], value: Math.round(r[k]) }));
    return {
      total: Math.round(r.total || 0),
      dims,
      advice: r.advice || ''
    };
  },

  /* ---------------- 跟读 ---------------- */

  onMode(e) {
    this.setData({ mode: e.currentTarget.dataset.m, score: null, recTip: '点上面的按钮开始朗读，再点一次结束' });
  },

  nextRead() {
    // 从词库里挑一句带例句的，随机换
    const all = word.all().filter(it => it.ex && it.ex[0]);
    if (!all.length) {
      this.setData({ readEn: '词库里还没有例句', readZh: '', readFrom: '', readText: '' });
      return;
    }
    const it = all[Math.floor(Math.random() * all.length)];
    this.setData({
      readEn: word.exText(it.ex[0]),
      readZh: it.ex[1] || '',
      readFrom: it.w + (it.ch ? ' · ' + it.ch : ''),
      readText: word.exText(it.ex[0]),
      score: null
    });
  },

  /* ---------------- 考官 ---------------- */

  onExamKind(e) {
    this.setData({ examKind: e.currentTarget.dataset.id, score: null }, () => this.nextExam());
  },

  nextExam() {
    const kind = this.data.examKind;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    this.setData({ score: null });

    if (kind === 'p1') {
      const t = pick(speaking.part1);
      if (!t) return;
      const q = pick(t.questions);
      this.setData({ examTopic: t.topic + ' / ' + t.topicEn, examEn: q.en, examPoints: [], examText: q.en });
      return;
    }
    if (kind === 'p2') {
      const c = pick(speaking.part2);
      if (!c) return;
      this.setData({
        examTopic: c.topic,
        examEn: c.card.title,
        examPoints: c.card.points,
        examText: c.card.title
      });
      return;
    }
    // p3：只有前几套题卡有讨论题，先筛出有题的
    const withP3 = speaking.part2.filter(c => c.part3 && c.part3.length);
    const c = pick(withP3);
    if (!c) return;
    const q = pick(c.part3);
    this.setData({ examTopic: c.topic + ' · Part 3', examEn: q.en, examPoints: [], examText: q.en });
  },

  /* ---------------- 发音 ---------------- */

  readSpeak() {
    const text = this.data.mode === 'read' ? this.data.readEn : this.data.examEn;
    if (!this.audio || !text) return;
    this.audio.stop();
    this.audio.src = config.AUDIO_API + encodeURIComponent(text);
    try {
      this.audio.play();
    } catch (e) {
      console.warn('[speaking] play failed', e);
    }
  }
});
