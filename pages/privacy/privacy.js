Page({
  data: {
    updated: '2026-09-21',
    email: '924422162@qq.com'
  },

  onCopyEmail() {
    wx.setClipboardData({
      data: this.data.email,
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'none' })
    });
  }
});
