const API_BASE = 'https://health-ai-proxy.sunweihao900.workers.dev';

const WELCOME = `您好！我是健康科普助手 🌿

我可以为您提供：
- 健康知识科普与解答
- 就医科室分诊建议（非诊断）
- 生活方式与预防指导

⚠️ 我无法诊断疾病、开处方或评估病情，所有内容仅供参考。如有不适，请及时就诊。

---
🤖 本内容由AI自动生成 | 生成式人工智能服务`;

const QUICK_CARDS = [
  { icon: '🤧', text: '感冒了怎么护理？', redzone: false },
  { icon: '❤️', text: '高血压饮食注意什么？', redzone: false },
  { icon: '🩸', text: '糖尿病可以吃水果吗？', redzone: false },
  { icon: '😴', text: '改善睡眠有什么方法？', redzone: false },
  { icon: '🏃', text: '每天运动多少分钟合适？', redzone: false },
  { icon: '🔬', text: '帮我诊断一下这些症状', redzone: true },
  { icon: '💊', text: '给我开个药方', redzone: true },
];

// 六段式解析
const SECTION_MAP = {
  '🤝 共情':    { color: '#0a7c5f', bg: '#f0fdf9' },
  '📚 原因解析': { color: '#0369a1', bg: '#f0f9ff' },
  '💡 实用建议': { color: '#d97706', bg: '#fffbeb' },
  '🚩 红旗信号': { color: '#dc2626', bg: '#fff5f5' },
  '🏥 行动指引': { color: '#7c3aed', bg: '#faf5ff' },
  '⚠️ 免责声明': { color: '#64748b', bg: '#f8fafc' },
};

function parseSections(content) {
  const keys = Object.keys(SECTION_MAP);
  const regex = new RegExp(`\\*\\*(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\*\\*`, 'g');
  const parts = [];
  let last = 0, match;
  while ((match = regex.exec(content)) !== null) {
    if (last < match.index && parts.length > 0) {
      parts[parts.length - 1].body += content.slice(last, match.index).trim();
    }
    parts.push({ key: match[1], title: match[1], body: '', ...SECTION_MAP[match[1]] });
    last = match.index + match[0].length;
  }
  if (parts.length > 0) parts[parts.length - 1].body = content.slice(last).trim();
  return parts.length >= 3 ? parts : null;
}

function getFollowUps(text) {
  if (/感冒|发烧|流感/.test(text)) return ['感冒期间怎么吃？', '什么情况需要看医生？', '感冒和流感怎么区分？'];
  if (/高血压|血压/.test(text)) return ['高血压能运动吗？', '哪些食物有助控血压？', '血压计怎么正确测量？'];
  if (/糖尿病|血糖/.test(text)) return ['低血糖怎么急救？', '糖尿病怎么安全运动？', '血糖多久监测一次？'];
  if (/睡眠|失眠/.test(text)) return ['睡前哪些习惯影响睡眠？', '午睡多久最健康？', '褪黑素能长期服用吗？'];
  if (/头痛|偏头痛/.test(text)) return ['头痛非药物缓解方法？', '偏头痛诱因有哪些？', '头痛需要做哪些检查？'];
  return ['日常还需注意哪些事项？', '这种情况一般多久改善？', '需要做哪些检查？'];
}

const app = getApp();
let _buffer = '';

Page({
  data: {
    messages: [{ id: 'welcome', role: 'assistant', content: WELCOME, isStreaming: false, sections: null }],
    inputText: '',
    isStreaming: false,
    canSend: false,
    focused: false,
    sessionId: '',
    scrollId: 'scroll-bottom',
    followUps: [],
    quickCards: QUICK_CARDS,
  },

  onLoad() {
    _buffer = '';
    this._fetchToken();
  },

  _fetchToken() {
    const controller = { aborted: false };
    const timer = setTimeout(() => { controller.aborted = true; }, 6000);
    wx.request({
      url: `${API_BASE}/api/v1/auth/demo-token`,
      method: 'POST',
      timeout: 6000,
      success: (res) => {
        clearTimeout(timer);
        if (res.data && res.data.access_token) app.globalData.authToken = res.data.access_token;
      },
      fail: () => { clearTimeout(timer); },
    });
  },

  onInput(e) {
    const v = e.detail.value;
    this.setData({ inputText: v, canSend: v.trim().length > 0 && !this.data.isStreaming });
  },
  onFocus() { this.setData({ focused: true }); },
  onBlur() { this.setData({ focused: false }); },

  callEmergency() { wx.makePhoneCall({ phoneNumber: '120' }); },

  sendQuick(e) { this._send(e.currentTarget.dataset.text); },
  sendFollowUp(e) { this._send(e.currentTarget.dataset.q); },
  handleSend() { this._send(this.data.inputText.trim()); },

  _send(text) {
    if (!text || this.data.isStreaming) return;
    const token = app.globalData.authToken;
    if (!token) { wx.showToast({ title: '正在连接服务，请稍后', icon: 'none' }); return; }

    const uid = `u_${Date.now()}`;
    const aid = `a_${Date.now()}`;
    const withUser = [...this.data.messages, { id: uid, role: 'user', content: text }];
    this.setData({
      messages: [...withUser, { id: aid, role: 'assistant', content: '', isStreaming: true, sections: null }],
      inputText: '', canSend: false, isStreaming: true, followUps: [], scrollId: 'scroll-bottom',
    });

    const apiMsgs = withUser
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    _buffer = '';
    const task = wx.request({
      url: `${API_BASE}/api/v1/chat`,
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: JSON.stringify({ messages: apiMsgs, session_id: this.data.sessionId || undefined, stream: true }),
      enableChunked: true,
      timeout: 90000,
      success: () => {
        this._finishMsg(aid, text);
      },
      fail: (err) => {
        this._updateMsg(aid, '❌ 网络错误，请稍后重试', false);
        this.setData({ isStreaming: false, canSend: true });
      },
    });

    task.onChunkReceived((res) => {
      try {
        const decoder = new TextDecoder('utf-8');
        const chunk = decoder.decode(res.data);
        _buffer += chunk;
        const lines = _buffer.split('\n');
        _buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.content) {
              this._appendMsg(aid, data.content);
            } else if (['emergency', 'redirect', 'error'].includes(data.type)) {
              this._updateMsg(aid, data.message || '服务暂时不可用', false);
              this.setData({ isStreaming: false, canSend: true });
            }
          } catch {}
        }
      } catch {}
    });
  },

  _appendMsg(aid, chunk) {
    const msgs = this.data.messages.map(m =>
      m.id === aid ? { ...m, content: m.content + chunk } : m
    );
    this.setData({ messages: msgs, scrollId: 'scroll-bottom' });
  },

  _updateMsg(aid, content, streaming) {
    const msgs = this.data.messages.map(m =>
      m.id === aid ? { ...m, content, isStreaming: streaming } : m
    );
    this.setData({ messages: msgs });
  },

  _finishMsg(aid, userText) {
    const msgs = this.data.messages.map(m => {
      if (m.id !== aid) return m;
      const sections = parseSections(m.content);
      return { ...m, isStreaming: false, sections };
    });
    const aiMsg = msgs.find(m => m.id === aid);
    const followUps = aiMsg ? getFollowUps(userText + ' ' + aiMsg.content) : [];
    this.setData({ messages: msgs, isStreaming: false, canSend: true, followUps, scrollId: 'scroll-bottom' });
  },
});
