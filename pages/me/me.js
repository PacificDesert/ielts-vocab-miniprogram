const store = require('../../utils/store');
const word = require('../../utils/word');
const cloud = require('../../utils/cloud');

const PLANS = [10, 20, 30, 50, 100];

Page({
  data: {
    stats: {},
    planIndex: 1,
    plans: PLANS,
    cloud: false,
    syncText: '',
    total: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const stats = store.stats();
    const plan = store.get().plan;
    const i = PLANS.indexOf(plan.newPerDay);
    this.setData({
      stats,
      total: word.total,
      planIndex: i < 0 ? 1 : i,
      cloud: cloud.isReady(),
      syncText: cloud.isReady() ? '已开启' : '未配置云环境'
    });
  },

  onPlanChange(e) {
    const i = Number(e.detail.value);
    const n = PLANS[i];
    store.setPlan({ newPerDay: n, spellPerDay: n });
    this.setData({ planIndex: i });
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
      .then(changed => wx.showToast({ title: changed ? '已拉取云端进度' : '云端进度已是最新', icon: 'none' }))
      .catch(() => wx.showToast({ title: '同步失败', icon: 'none' }));
  },

  onReset() {
    wx.showModal({
      title: '重置学习进度',
      content: '将清空本机所有学习记录，云端数据不受影响。',
      confirmColor: '#FF3B30',
      success: res => {
        if (!res.confirm) return;
        store.reset();
        this.refresh();
        wx.showToast({ title: '已重置', icon: 'none' });
      }
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '词库来自用户提供的《雅思词汇真经》PDF，共 ' + word.total + ' 词，按 22 个主题章节编排。音标取自开源词典 ECDICT。本工程基于 MIT 协议开源。',
      showCancel: false
    });
  }
});
