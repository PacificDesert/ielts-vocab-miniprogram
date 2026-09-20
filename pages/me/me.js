const store = require('../../utils/store');
const word = require('../../utils/word');
const cloud = require('../../utils/cloud');
const config = require('../../config');

const PRESETS = [10, 20, 30, 50, 100];

Page({
  data: {
    stats: {},
    plan: {},
    planInput: '20',
    presets: PRESETS,
    min: config.PLAN_MIN,
    max: config.PLAN_MAX,
    cloud: false,
    syncText: '',
    total: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const plan = store.get().plan;
    this.setData({
      stats: store.stats(),
      total: word.total,
      plan,
      planInput: String(plan.perRound),
      cloud: cloud.isReady(),
      syncText: cloud.isReady() ? '已开启' : '未配置云环境'
    });
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

  decPlan() {
    this.commit(this.data.plan.perRound - 5);
  },

  incPlan() {
    this.commit(this.data.plan.perRound + 5);
  },

  onPreset(e) {
    this.commit(e.currentTarget.dataset.n);
  },

  onToggleExpand(e) {
    store.toggleExpand(e.detail.value);
    this.refresh();
  },

  onPush() {
    if (!cloud.isReady()) {
      wx.showToast({ title: '请先在 config.js 配置云环境', icon: 'none' });
      return;
    }
    store.push()
      .then(() => wx.showToast({ title: '已同步到云端', icon: 'none' }))
      .catch(() => wx.showToast({ title: '同步失败', icon: 'none' }));
  },

  onPull() {
    if (!cloud.isReady()) {
      wx.showToast({ title: '请先在 config.js 配置云环境', icon: 'none' });
      return;
    }
    store.pull()
      .then(changed => {
        this.refresh();
        wx.showToast({ title: changed ? '已拉取云端进度' : '云端进度已是最新', icon: 'none' });
      })
      .catch(() => wx.showToast({ title: '同步失败', icon: 'none' }));
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

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '词库来自《雅思词汇真经》PDF，共 ' + word.total + ' 词，按 22 个主题章节编排，'
        + '含 3000 余条书中例句。音标取自开源项目 ipa-dict。本工程基于 MIT 协议开源。',
      showCancel: false
    });
  }
});
