App({
  globalData: {
    authToken: '',
    hasConsented: false,
  },

  onLaunch() {
    // 检查用户是否已同意免责声明
    const consent = wx.getStorageSync('health_ai_consent');
    if (consent && consent.agreed) {
      this.globalData.hasConsented = true;
    } else {
      // 首次使用，跳转到免责声明页（延迟等待页面栈初始化）
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/disclaimer/disclaimer' });
      }, 100);
    }
  },

  /**
   * 保存用户同意记录
   */
  recordConsent() {
    const record = {
      agreed: true,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    wx.setStorageSync('health_ai_consent', record);
    this.globalData.hasConsented = true;
  },
});
