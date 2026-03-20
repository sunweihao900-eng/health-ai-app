const API_BASE = 'https://your-api-domain.com'; // 生产环境替换为实际域名

Page({
  data: {
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          '您好！我是健康科普助手，可以为您提供健康知识科普、就医科室建议和生活方式指导。\n\n请注意，我无法进行疾病诊断、开具处方，所有内容仅供参考。如有不适，请及时就医。',
        disclaimerExpanded: false,
      },
    ],
    inputText: '',
    isStreaming: false,
    sessionId: '',
    scrollToId: 'scroll-bottom',
    suggestions: [
      '感冒怎么护理？',
      '高血压饮食注意什么？',
      '头痛看哪个科？',
      '糖尿病可以吃水果吗？',
    ],
    authToken: '',
  },

  onLoad() {
    this._fetchDemoToken();
  },

  // 获取演示Token
  async _fetchDemoToken() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/v1/auth/demo-token`,
          method: 'POST',
          success: resolve,
          fail: reject,
        });
      });
      if (res.data && res.data.access_token) {
        this.setData({ authToken: res.data.access_token });
      }
    } catch (e) {
      wx.showToast({ title: '连接服务失败', icon: 'error' });
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendSuggestion(e) {
    const text = e.currentTarget.dataset.text;
    this._sendMessage(text);
  },

  handleSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isStreaming) return;
    this.setData({ inputText: '' });
    this._sendMessage(text);
  },

  toggleDisclaimer(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages.map((m) => {
      if (m.id === id) {
        return { ...m, disclaimerExpanded: !m.disclaimerExpanded };
      }
      return m;
    });
    this.setData({ messages });
  },

  async _sendMessage(text) {
    if (!this.data.authToken) {
      wx.showToast({ title: '请稍后重试', icon: 'none' });
      return;
    }

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    // 添加用户消息
    const updatedMessages = [
      ...this.data.messages,
      { id: userMsgId, role: 'user', content: text },
    ];

    // 添加AI消息占位
    const allMessages = [
      ...updatedMessages,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        disclaimerExpanded: false,
      },
    ];

    this.setData({
      messages: allMessages,
      isStreaming: true,
      scrollToId: 'scroll-bottom',
    });

    // 构建API消息（排除welcome消息）
    const apiMessages = updatedMessages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    // 使用enableChunked实现流式效果
    const requestTask = wx.request({
      url: `${API_BASE}/api/v1/chat`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.data.authToken}`,
      },
      data: JSON.stringify({
        messages: apiMessages,
        session_id: this.data.sessionId || undefined,
        stream: true,
      }),
      enableChunked: true, // 微信小程序流式接收
      success: (res) => {
        // 流式结束后的处理
        const messages = this.data.messages.map((m) => {
          if (m.id === assistantMsgId) {
            return { ...m, isStreaming: false };
          }
          return m;
        });
        this.setData({ messages, isStreaming: false });
      },
      fail: (err) => {
        const messages = this.data.messages.map((m) => {
          if (m.id === assistantMsgId) {
            return { ...m, content: '❌ 网络错误，请稍后再试', isStreaming: false };
          }
          return m;
        });
        this.setData({ messages, isStreaming: false });
      },
    });

    // 处理流式数据块
    requestTask.onChunkReceived((res) => {
      const buffer = res.data;
      const text = this._arrayBufferToString(buffer);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk' && data.content) {
            const messages = this.data.messages.map((m) => {
              if (m.id === assistantMsgId) {
                return { ...m, content: m.content + data.content };
              }
              return m;
            });
            this.setData({ messages, scrollToId: 'scroll-bottom' });
          } else if (
            data.type === 'emergency' ||
            data.type === 'redirect' ||
            data.type === 'error'
          ) {
            const messages = this.data.messages.map((m) => {
              if (m.id === assistantMsgId) {
                return { ...m, content: data.message || '服务暂时不可用', isStreaming: false };
              }
              return m;
            });
            this.setData({ messages, isStreaming: false });
          } else if (data.type === 'done') {
            if (data.message_id) {
              const messages = this.data.messages.map((m) => {
                if (m.id === assistantMsgId) {
                  return { ...m, messageId: data.message_id, isStreaming: false };
                }
                return m;
              });
              this.setData({ messages, isStreaming: false });
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    });
  },

  _arrayBufferToString(buffer) {
    const bytes = new Uint8Array(buffer);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    try {
      return decodeURIComponent(escape(result));
    } catch {
      return result;
    }
  },
});
