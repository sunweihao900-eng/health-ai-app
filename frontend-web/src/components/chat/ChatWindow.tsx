import React, { useState, useEffect, useRef } from 'react';
import DisclaimerBanner from './DisclaimerBanner';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;
  timestamp: string;
}

interface ChatWindowProps {
  authToken: string;
  apiBase?: string;
}

const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ── Demo mode mock ─────────────────────────────────────────────────────────────
const EMERGENCY_KW = ['自杀','心梗','脑卒中','中风','窒息','昏迷','溺水','不想活','大量出血'];
const DIAGNOSIS_KW  = ['帮我诊断','我得了什么病','是什么病','确诊','化验单','ct结果','b超','核磁','看化验单','我是不是得了'];
const PRESCRIPTION_KW = ['开药','开处方','用什么药','吃什么药','药方','治疗方案','推荐药物','给我开个','开个药'];

async function mockStream(text: string, onChunk: (c: string) => void) {
  let reply = '';
  if (EMERGENCY_KW.some(k => text.includes(k))) {
    reply = `⚠️ **检测到可能的紧急情况**\n\n请立即采取以下行动：\n- **拨打急救电话：120**（全国急救）\n- 心理危机热线：**400-161-9995**\n- 保持冷静，等待救援\n\n**本工具无法处理紧急医疗情况，请立即寻求专业急救帮助。**\n\n---\n**⚠️ 重要提示（AIGC生成内容）**\n本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断。\n🤖 *本内容由AI自动生成 | 生成式人工智能服务*`;
  } else if (DIAGNOSIS_KW.some(k => text.includes(k))) {
    reply = `您好，我是健康科普助手，**无法进行疾病诊断或解读医疗报告**。\n\n我可以帮您：\n- 了解相关症状的一般科普知识\n- 推荐适合就诊的科室\n- 整理您想告知医生的症状信息\n\n如需明确诊断，请前往正规医疗机构就诊，由执业医师为您提供专业诊断。\n\n---\n**⚠️ 重要提示（AIGC生成内容）**\n本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断。\n🤖 *本内容由AI自动生成 | 生成式人工智能服务*`;
  } else if (PRESCRIPTION_KW.some(k => text.includes(k))) {
    reply = `您好，**我无法推荐具体药物或制定用药方案**，这属于处方权限，需由执业医师在充分了解您病情后决定。\n\n请：\n- 前往医院门诊，由医生开具处方\n- 或前往正规药店，由执业药师提供用药咨询\n\n---\n**⚠️ 重要提示（AIGC生成内容）**\n本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断。\n🤖 *本内容由AI自动生成 | 生成式人工智能服务*`;
  } else {
    reply = `**🤝 共情**\n感谢您的咨询！我理解您对健康知识的关注，这是这个**界面演示模式**下的模拟六段式回复。

**📚 原因解析**\n连接真实后端后，Claude AI 会根据您的具体问题生成详细的健康科普内容，深入解析相关知识背景与可能的原因。

**💡 实用建议**\n- 相关疾病科普知识介绍\n- 就医科室建议\n- 生活方式和预防建议\n- 就诊前的注意事项

**🚩 红旗信号**\n若出现以下情况，请立即就诊：\n- 症状突然加重或不寻常\n- 出现新的严重症状

**🏥 行动指引**\n建议前往相关科室，由执业医师进行专业评估。如症状持续超过3天，请及时就医。

---\n**⚠️ 重要提示（AIGC生成内容）**\n本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断、治疗建议或处方依据。\n🤖 *本内容由AI自动生成 | 生成式人工智能服务*`;
  }
  for (let i = 0; i < reply.length; i += 5) {
    onChunk(reply.slice(i, i + 5));
    await new Promise(r => setTimeout(r, 12));
  }
}

// ── Sidebar quick-actions ─────────────────────────────────────
const quickActions = [
  { icon: '🤧', label: '感冒护理',  q: '感冒了怎么护理？',        redzone: false },
  { icon: '❤️', label: '高血压',    q: '高血压日常注意什么？',    redzone: false },
  { icon: '🩸', label: '糖尿病',   q: '糖尿病饮食有哪些建议？',  redzone: false },
  { icon: '😴', label: '睡眠改善', q: '改善睡眠质量有什么方法？', redzone: false },
  { icon: '🏃', label: '运动建议', q: '每天运动多少分钟合适？',   redzone: false },
  { icon: '🏥', label: '就医指引', q: '怎么选择就诊科室？',       redzone: false },
  { icon: '🔬', label: '拦截演示', q: '帮我诊断一下这些症状',     redzone: true  },
  { icon: '💊', label: '处方拦截', q: '给我开个药方',             redzone: true  },
];

// ── Health tips (random per session) ─────────────────────────
const HEALTH_TIPS = [
  { icon: '💧', tip: '每天喝 1500-2000ml 水，分次饮用比一次大量好。' },
  { icon: '🥦', tip: '每餐蔬菜占盘子一半，深色蔬菜营养更丰富。' },
  { icon: '🌙', tip: '规律作息，23点前入睡，睡前1小时避免手机。' },
  { icon: '🚶', tip: '每天步行30分钟可降低心血管风险约35%。' },
  { icon: '😮‍💨', tip: '每小时起身活动3-5分钟，减少久坐危害。' },
  { icon: '🧘', tip: '每天5分钟深呼吸练习可有效降低血压水平。' },
  { icon: '🌞', tip: '上午10-11点晒太阳15分钟，促进维生素D合成。' },
];

// ── Follow-up context detection ───────────────────────────────
function getFollowUps(content: string): string[] {
  const c = content;
  if (/感冒|发烧|流感|鼻塞/.test(c))
    return ['感冒期间饮食有哪些建议？', '什么情况下感冒需要看医生？', '感冒和流感怎么区分？'];
  if (/高血压|血压/.test(c))
    return ['高血压患者能剧烈运动吗？', '哪些食物有助于控制血压？', '家用血压计怎么正确测量？'];
  if (/糖尿病|血糖/.test(c))
    return ['低血糖发作的急救方法是？', '血糖监测多久做一次合适？', '糖尿病人怎么安全运动？'];
  if (/睡眠|失眠|熬夜/.test(c))
    return ['睡前哪些习惯会影响睡眠质量？', '褪黑素适合长期服用吗？', '午睡多长时间最健康？'];
  if (/头痛|偏头痛|头晕/.test(c))
    return ['头痛时有哪些非药物缓解方法？', '偏头痛的诱发因素有哪些？', '头痛需要做哪些检查？'];
  if (/心脏|胸痛|心率/.test(c))
    return ['心脏不好的人能做哪些运动？', '心电图正常是否说明心脏健康？', '护心饮食有哪些建议？'];
  if (/胃|消化|肠/.test(c))
    return ['胃痛的常见原因有哪些？', '怎么判断是胃炎还是胃溃疡？', '护胃的饮食原则是什么？'];
  return ['日常还需要注意哪些事项？', '这种情况一般多久会改善？', '需要做哪些检查比较好？'];
}

const WELCOME_CONTENT = `您好！我是**健康科普助手** 🌿

我可以为您提供：
- 健康知识科普与解答
- 就医科室分诊建议（非诊断）
- 生活方式与预防指导

⚠️ **请注意**：我无法进行疾病诊断、开具处方或评估病情严重性，所有内容仅供参考。如有不适，**请及时就诊**。

---
**⚠️ 重要提示（AIGC生成内容）**
本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断、治疗建议或处方依据。
🤖 *本内容由AI自动生成 | 生成式人工智能服务*`;

const ChatWindow: React.FC<ChatWindowProps> = ({ authToken, apiBase = API_BASE }) => {
  const isOfflineMode = authToken === 'demo-offline-token';
  const todayTip = HEALTH_TIPS[new Date().getDay() % HEALTH_TIPS.length];

  const makeWelcome = (): Message => ({
    id: 'welcome', role: 'assistant', content: WELCOME_CONTENT, timestamp: nowTime(),
  });

  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionMsgCount, setSessionMsgCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, followUps]);

  const startNewConversation = () => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([makeWelcome()]);
    setSessionId('');
    setFollowUps([]);
    setSessionMsgCount(0);
    setIsStreaming(false);
  };

  const handleSend = async (userMessage: string) => {
    if (isStreaming) return;

    setFollowUps([]);
    const userMsgId = `u_${Date.now()}`;
    const asstMsgId = `a_${Date.now()}`;
    const ts = nowTime();

    const withUser: Message[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: userMessage, timestamp: ts },
    ];
    setMessages([...withUser, { id: asstMsgId, role: 'assistant', content: '', timestamp: ts }]);
    setIsStreaming(true);
    setSessionMsgCount(c => c + 1);
    abortRef.current = new AbortController();

    // ── Offline demo ──
    if (isOfflineMode) {
      await mockStream(userMessage, (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === asstMsgId ? { ...m, content: m.content + chunk } : m
        ));
      });
      setIsStreaming(false);
      // Set follow-ups based on the question, not the mock answer
      setFollowUps(getFollowUps(userMessage));
      return;
    }

    // ── Real backend ──
    try {
      const apiMessages = withUser
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${apiBase}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ messages: apiMessages, session_id: sessionId || undefined, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(res.status === 429 ? '请求过于频繁，请稍后再试' : `服务错误：${res.status}`);

      const sid = res.headers.get('X-Session-ID');
      if (sid) setSessionId(sid);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      let finalContent = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.content) {
              finalContent += data.content;
              setMessages(prev => prev.map(m =>
                m.id === asstMsgId ? { ...m, content: m.content + data.content } : m
              ));
            } else if (['emergency','redirect','error'].includes(data.type)) {
              finalContent = data.message || '服务暂时不可用';
              setMessages(prev => prev.map(m =>
                m.id === asstMsgId ? { ...m, content: finalContent } : m
              ));
            } else if (data.type === 'done' && data.message_id) {
              setMessages(prev => prev.map(m =>
                m.id === asstMsgId ? { ...m, messageId: data.message_id } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }
      // Generate follow-ups based on user question context
      setFollowUps(getFollowUps(userMessage + ' ' + finalContent));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : '网络错误，请稍后再试';
      setMessages(prev => prev.map(m =>
        m.id === asstMsgId ? { ...m, content: `❌ ${msg}` } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: 'inherit' }}>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? '268px' : '0',
        minWidth: sidebarOpen ? '268px' : '0',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        background: 'linear-gradient(175deg, #0a7c5f 0%, #064e3b 100%)',
        display: 'flex', flexDirection: 'column',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.1)' : 'none',
      }}>
        {/* Logo area */}
        <div style={{ padding: '22px 18px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '13px',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>🏥</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', whiteSpace: 'nowrap' }}>健康AI助手</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>Health AI Assistant</div>
            </div>
          </div>

          {/* New conversation button */}
          <button
            onClick={startNewConversation}
            style={{
              width: '100%', padding: '9px 14px',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: '11px', cursor: 'pointer',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '7px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <span style={{ fontSize: '16px' }}>✏️</span>
            <span>开启新对话</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.6 }}>清空历史</span>
          </button>

          {isOfflineMode && (
            <div style={{
              marginTop: '10px', padding: '7px 10px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '8px',
              fontSize: '11px', color: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <span>🖥️</span><span>演示模式 · 后端未连接</span>
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 18px' }} />

        {/* Today's health tip */}
        <div className="health-tip-card">
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '7px' }}>
            💡 今日健康贴士
          </div>
          <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.88)', lineHeight: '1.55', display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '15px', flexShrink: 0 }}>{todayTip.icon}</span>
            <span>{todayTip.tip}</span>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '6px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px', paddingLeft: '6px' }}>
            快捷话题
          </div>
          {quickActions.filter(a => !a.redzone).map(a => (
            <button key={a.q} onClick={() => handleSend(a.q)} disabled={isStreaming}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', marginBottom: '5px',
                display: 'flex', alignItems: 'center', gap: '8px',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                color: '#fff', fontSize: '13px', fontWeight: 500,
                textAlign: 'left', opacity: isStreaming ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!isStreaming) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
            >
              <span style={{ fontSize: '16px' }}>{a.icon}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
            </button>
          ))}

          <div style={{ fontSize: '10.5px', color: 'rgba(255,120,120,0.65)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', margin: '10px 0 7px', paddingLeft: '6px' }}>
            📵 合规拦截演示
          </div>
          {quickActions.filter(a => a.redzone).map(a => (
            <button key={a.q} onClick={() => handleSend(a.q)} disabled={isStreaming}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'rgba(255,80,80,0.1)',
                border: '1px solid rgba(255,120,120,0.18)',
                borderRadius: '10px', marginBottom: '5px',
                display: 'flex', alignItems: 'center', gap: '7px',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                color: 'rgba(255,190,190,0.9)', fontSize: '13px', fontWeight: 500,
                textAlign: 'left', opacity: isStreaming ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!isStreaming) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,0.1)'; }}
            >
              <span style={{ fontSize: '15px' }}>{a.icon}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(255,80,80,0.25)', color: 'rgba(255,160,160,0.9)', padding: '1px 5px', borderRadius: '4px' }}>拦截</span>
            </button>
          ))}
        </div>

        {/* Emergency hotlines */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
            🚨 急救热线
          </div>
          {[
            { label: '急救', num: '120', color: '#ef4444' },
            { label: '心理危机', num: '400-161-9995', color: '#f97316' },
            { label: '投诉举报', num: '12320', color: '#64748b' },
          ].map(h => (
            <a key={h.num} href={`tel:${h.num}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 9px', borderRadius: '8px', marginBottom: '4px',
                background: 'rgba(255,255,255,0.06)',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)' }}>{h.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: h.color }}>{h.num}</span>
            </a>
          ))}
        </div>

        {/* Compliance note */}
        <div style={{ padding: '10px 18px 16px', fontSize: '10.5px', color: 'rgba(255,255,255,0.3)', lineHeight: '1.5' }}>
          本服务仅供科普参考 · 不构成医疗建议
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          background: '#fff', borderBottom: '1px solid var(--border)',
          padding: '11px 20px',
          display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)', flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '9px',
            color: 'var(--text-muted)', fontSize: '18px',
            display: 'flex', alignItems: 'center',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >☰</button>

          {/* Title */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              健康科普咨询
              <span style={{
                fontSize: '10.5px', fontWeight: 600, padding: '2px 7px',
                background: '#f0fdf4', color: '#15803d',
                border: '1px solid #86efac', borderRadius: '5px',
              }}>合规认证</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {isStreaming
                ? <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ animation: 'pulse 1.4s ease infinite', display: 'inline-block' }}>●</span> AI 正在生成回复…
                  </span>
                : `在线 · 随时为您解答 · 本次已对话 ${sessionMsgCount} 轮`
              }
            </div>
          </div>

          {/* Stats badges */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isOfflineMode && (
              <span style={{
                background: '#fefce8', color: '#a16207', padding: '4px 10px',
                borderRadius: '20px', fontSize: '11.5px', fontWeight: 600,
                border: '1px solid #fde68a',
              }}>演示模式</span>
            )}
            <div style={{
              background: 'var(--primary-light)', border: '1px solid var(--primary-mid)',
              color: 'var(--primary)', padding: '4px 11px',
              borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            }}>
              {messages.length} 条
            </div>
          </div>
        </div>

        {/* AIGC Banner */}
        <DisclaimerBanner />

        {/* Messages area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 20px 8px',
          background: 'linear-gradient(180deg, #edf1f7 0%, #f0f4f8 100%)',
        }}>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              messageId={msg.messageId}
              timestamp={msg.timestamp}
              isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}

          {/* Follow-up suggestion chips */}
          {followUps.length > 0 && !isStreaming && (
            <div style={{ paddingLeft: '48px', paddingRight: '4px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>💬</span> 您可能还想了解：
              </div>
              <div className="followup-wrap">
                {followUps.map(q => (
                  <button key={q} className="followup-chip" onClick={() => handleSend(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <InputArea
          onSend={handleSend}
          disabled={isStreaming}
          placeholder="请输入您的健康咨询问题…"
        />
      </div>
    </div>
  );
};

export default ChatWindow;
