import React, { useState, useRef, useEffect } from 'react';

interface DisclaimerPageProps {
  onAgree: () => void;
}

const sections = [
  {
    icon: '🏥',
    title: '服务性质',
    body: '本服务（"健康AI咨询助手"）是由人工智能（AIGC）驱动的健康科普工具，定位为非诊断、非处方的健康知识查询和就医分诊辅助服务。本服务不是医疗机构，AI不是医生，无法提供医疗诊断、治疗方案或处方建议。',
  },
  {
    icon: '🚫',
    title: '使用限制',
    items: [
      '本服务内容不能替代执业医师的专业诊断和治疗建议',
      '请勿依据本服务内容自行用药或停药',
      '请勿将本服务作为急症处置的依据',
      '涉及儿童、孕妇、老人健康问题，请直接咨询医生',
    ],
  },
  {
    icon: '🚨',
    title: '紧急情况',
    body: '如遇紧急医疗情况（心梗、脑卒中、呼吸困难、大量出血、自杀念头等），请立即拨打急救电话 120，不要等待或使用本服务。',
    emergency: true,
    extra: '心理危机热线：400-161-9995 / 010-82951332',
  },
  {
    icon: '🤖',
    title: 'AIGC 内容声明',
    body: '本服务所有回复均由生成式人工智能自动生成，依据《生成式人工智能服务管理暂行办法》进行标注。AI生成内容可能存在错误，请以专业医疗机构意见为准。',
  },
  {
    icon: '🔒',
    title: '数据处理',
    body: '您的咨询内容在发送前将自动脱敏（移除手机号、身份证等个人信息）。脱敏后的对话记录加密存储，90天后自动清除。',
  },
  {
    icon: '⚖️',
    title: '责任限制',
    body: '因使用本服务产生的医疗决策后果，由用户自行承担。本服务运营方不承担因AI生成内容引起的直接或间接医疗损失责任。',
  },
];

const DisclaimerPage: React.FC<DisclaimerPageProps> = ({ onAgree }) => {
  const [canAgree, setCanAgree] = useState(false);
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const pct = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
      setProgress(pct);
      if (scrollTop + clientHeight >= scrollHeight - 24) setCanAgree(true);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAgree = () => {
    if (!canAgree) return;
    localStorage.setItem('health_ai_consent', JSON.stringify({
      agreed: true, timestamp: new Date().toISOString(), version: '1.0',
    }));
    onAgree();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.72)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div className="modal-enter" style={{
        background: '#fff', borderRadius: '20px',
        maxWidth: '560px', width: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)',
      }}>

        {/* Header */}
        <div style={{
          padding: '28px 28px 20px',
          background: 'linear-gradient(135deg, #0c7a5e 0%, #0a6b52 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
            }}>🏥</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.3px' }}>
                健康AI咨询助手
              </div>
              <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>
                使用前请仔细阅读以下条款
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            marginTop: '16px', height: '4px', background: 'rgba(255,255,255,0.2)',
            borderRadius: '99px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              background: canAgree ? '#4ade80' : '#fff',
              width: `${progress}%`,
              transition: 'width 0.2s ease, background 0.4s ease',
            }} />
          </div>
          <div style={{
            marginTop: '6px', fontSize: '12px', opacity: 0.7,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{canAgree ? '✓ 已读完，可以同意' : '↓ 向下滚动阅读完整内容'}</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
        }}>
          {sections.map((s, i) => (
            <div key={i} style={{
              marginBottom: '20px', padding: '16px 18px',
              borderRadius: '12px',
              background: s.emergency ? '#fef2f2' : '#f8fafc',
              border: s.emergency ? '1px solid #fca5a5' : '1px solid #e2e8f0',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '10px',
              }}>
                <span style={{ fontSize: '18px' }}>{s.icon}</span>
                <span style={{
                  fontWeight: 700, fontSize: '14px',
                  color: s.emergency ? '#b91c1c' : '#0c7a5e',
                }}>{s.title}</span>
              </div>
              {s.body && (
                <p style={{
                  fontSize: '13px', lineHeight: '1.7',
                  color: s.emergency ? '#7f1d1d' : '#475569',
                  fontWeight: s.emergency ? 600 : 400,
                }}>{s.body}</p>
              )}
              {s.items && (
                <ul style={{ paddingLeft: '16px' }}>
                  {s.items.map((item, j) => (
                    <li key={j} style={{ fontSize: '13px', color: '#475569', marginBottom: '5px', lineHeight: '1.6' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {s.extra && (
                <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px', fontWeight: 600 }}>{s.extra}</p>
              )}
            </div>
          ))}

          <div style={{
            textAlign: 'center', padding: '16px',
            fontSize: '12px', color: '#94a3b8',
            borderTop: '1px dashed #e2e8f0', marginTop: '4px',
          }}>
            — 已阅读至文件末尾 · v1.0 · {new Date().getFullYear()} —
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#fafafa',
        }}>
          <button
            onClick={handleAgree}
            disabled={!canAgree}
            style={{
              width: '100%', padding: '14px',
              background: canAgree
                ? 'linear-gradient(135deg, #0c7a5e, #0a6b52)'
                : '#cbd5e1',
              color: '#fff', border: 'none',
              borderRadius: '12px',
              fontSize: '15px', fontWeight: 700,
              cursor: canAgree ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              boxShadow: canAgree ? '0 4px 16px rgba(12,122,94,0.35)' : 'none',
              letterSpacing: '0.2px',
            }}
          >
            {canAgree ? '✓ 我已阅读并同意，开始使用' : '请先滚动阅读完整内容'}
          </button>
          <p style={{
            textAlign: 'center', fontSize: '11px',
            color: '#94a3b8', marginTop: '10px',
          }}>
            同意即表示您已阅读并接受以上所有条款
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerPage;
