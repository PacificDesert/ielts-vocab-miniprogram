const store = require('../../utils/store');
const word = require('../../utils/word');

Page({
  data: {
    keyword: '',
    chapter: '',
    mode: 'chapters',
    total: 0,
    chapterRows: [],
    list: []
  },

  onLoad() {
    this.setData({ total: word.total });
  },

  onShow() {
    const app = getApp();
    if (app.globalData.pendingChapter) {
      const name = app.globalData.pendingChapter;
      app.globalData.pendingChapter = '';
      this.openChapter(name);
      return;
    }
    this.render();
  },

  decorate(items) {
    return items.map(it => ({
      w: it.w,
      ph: it.ph,
      cn: it.cn,
      ch: it.ch,
      lv: store.status(it.w)
    }));
  },

  chaptersData() {
    return word.chapterList().map(c => ({
      name: c.name,
      total: c.words.length,
      learned: c.words.filter(it => store.status(it.w) > 0).length
    }));
  },

  render() {
    const { keyword, chapter } = this.data;
    if (keyword) {
      this.setData({
        mode: 'search',
        list: this.decorate(word.search(keyword, 80)),
        chapterRows: this.chaptersData()
      });
      return;
    }
    if (chapter) {
      this.setData({
        mode: 'chapter',
        list: this.decorate(word.chapterWords(chapter)),
        chapterRows: this.chaptersData()
      });
      return;
    }
    this.setData({ mode: 'chapters', list: [], chapterRows: this.chaptersData() });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value.trim(), chapter: '' }, () => this.render());
  },

  clearSearch() {
    this.setData({ keyword: '' }, () => this.render());
  },

  openChapter(name) {
    this.setData({ chapter: name, keyword: '' }, () => this.render());
  },

  onChapterTap(e) {
    this.openChapter(e.currentTarget.dataset.name);
  },

  backToChapters() {
    this.setData({ chapter: '', keyword: '' }, () => this.render());
  },

  onWordTap(e) {
    const w = e.currentTarget.dataset.w;
    wx.navigateTo({ url: `/pages/detail/detail?w=${encodeURIComponent(w)}` });
  },

  onWordLongPress(e) {
    const w = e.currentTarget.dataset.w;
    const it = word.get(w);
    if (!it) return;
    wx.setClipboardData({
      data: word.copyText(it),
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  }
});
