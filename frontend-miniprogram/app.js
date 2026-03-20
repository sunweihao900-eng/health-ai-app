App({
  globalData: { authToken: '', hasConsented: false },
  onLaunch() {
    const c = wx.getStorageSync('health_ai_consent');
    if (c && c.agreed) {
      this.globalData.hasConsented = true;
    } else {
      setTimeout(() => wx.redirectTo({ url: '/pages/disclaimer/disclaimer' }), 100);
    }
  },
  recordConsent() {
    wx.setStorageSync('health_ai_consent', { agreed: true, timestamp: new Date().toISOString(), version: '1.0' });
    this.globalData.hasConsented = true;
  },
});
