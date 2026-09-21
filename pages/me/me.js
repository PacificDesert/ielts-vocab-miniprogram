const store = require('../../utils/store');
const word = require('../../utils/word');
const cloud = require('../../utils/cloud');
const config = require('../../config');
const theme = require('../../utils/theme');

const THEMES = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
];

Page({
  data: {
    stats: {},
    plan: {},
    planInput: '20',
    themes: THEMES,
    themeMode: 'auto',
    min: config.PLAN_MIN,
    cloud: false,
    syncText: '',
    syncAt: '',
    total: 0
  },

  onShow() {
    this.setData(getApp().themeData());
    this.refresh();
  },

  syncTheme() {
    this.setData(getApp().themeData());
  },

  refresh() {
    const plan = store.get().plan;
    this.setData({
      stats: store.stats(),
      total: word.total,
      plan,
      planInput: String(plan.perRound),
      cloud: cloud.isReady(),
      syncText: cloud.isReady() ? '已开启' : '未配置云环境',
      syncAt: this.formatSync(store.lastSync())
    });
  },

  formatSync(ts) {
    if (!ts) return '尚未同步';
    const d = new Date(ts);
    const p = n => (n < 10 ? '0' + n : '' + n);
    const sameDay = new Date().toDateString() === d.toDateString();
    return (sameDay ? '' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ')
      + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  commit(n) {
    const plan = store.setPerRound(n);
    this.setData({ plan, planInput: String(plan.perRound) });
    wx.showToast({ title: '每组 ' + plan.perRound + ' 个', icon: 'none' });
  },

  onPlanInput(e) {
    this.setData({ planInput: e.detail.value });
  },

  onPlanBlur() {
    this.commit(this.data.planInput);
  },

  onToggleExpand(e) {
    store.toggleExpand(e.detail.value);
    this.refresh();
  },

  onThemeMode(e) {
    theme.setMode(e.currentTarget.dataset.v);
  },

  onToggleAutoSync(e) {
    store.toggleAutoSync(e.detail.value);
    this.refresh();
  },

  onSyncNow() {
    if (!cloud.isReady()) {
      wx.showToast({ title: '请先在 config.js 配置云环境', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '同步中', mask: true });
    store.sync()
      .then(() => {
        wx.hideLoading();
        this.refresh();
        wx.showToast({ title: '已同步', icon: 'none' });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '同步失败，请检查网络', icon: 'none' });
      });
  },

  onReset() {
    wx.showModal({
      title: '重置学习进度',
      content: '将清空本机所有学习记录，云端数据不受影响。',
      confirmColor: '#FF3B30',
      success: res => {
        if (!res.confirm) return;
        const plan = store.get().plan;
        store.reset();
        store.setPlan(plan);
        this.refresh();
        wx.showToast({ title: '已重置', icon: 'none' });
      }
    });
  },

  onPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '词库来自《雅思词汇真经》PDF，共 ' + word.total + ' 词，按 22 个主题章节编排，'
        + '含 3000 余条书中例句。音标取自开源项目 ipa-dict。本工程基于 MIT 协议开源。',
      showCancel: false
    });
  }
});
