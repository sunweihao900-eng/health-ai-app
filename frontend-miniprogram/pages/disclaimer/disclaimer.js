const app = getApp();

Page({
  data: {
    canAgree: false,
  },

  onScrollToBottom() {
    this.setData({ canAgree: true });
  },

  handleAgree() {
    if (!this.data.canAgree) return;
    app.recordConsent();
    wx.redirectTo({ url: '/pages/chat/chat' });
  },
});
