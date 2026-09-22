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
    total: 0,
    profile: { avatar: '', nickname: '' }
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
      syncAt: this.formatSync(store.lastSync()),
      profile: store.profile()
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

  onToggleSound(e) {
    store.toggleSound(e.detail.value);
    this.refresh();
    wx.showToast({ title: e.detail.value ? '有声模式' : '静音模式', icon: 'none' });
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

  /** 头像：微信只允许由 open-type="chooseAvatar" 的按钮触发，回调里拿到临时文件 */
  onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl;
    if (!url) return;
    // 临时路径重启后会失效，必须转成持久化文件（失败就退回临时路径，至少本次可见）
    wx.getFileSystemManager().saveFile({
      tempFilePath: url,
      success: res => this.saveProfile({ avatar: res.savedFilePath }, '头像已更新'),
      fail: () => this.saveProfile({ avatar: url }, '头像已更新（重启后可能失效）')
    });
  },

  /** 昵称：type="nickname" 的输入框会在失焦/确认时带回微信昵称 */
  onNickname(e) {
    const name = String((e.detail && e.detail.value) || '').trim();
    if (name === store.profile().nickname) return;
    this.saveProfile({ nickname: name }, name ? '昵称已更新' : '已清空昵称');
  },

  saveProfile(patch, tip) {
    const profile = store.setProfile(patch);
    this.setData({ profile });
    if (tip) wx.showToast({ title: tip, icon: 'none' });
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
