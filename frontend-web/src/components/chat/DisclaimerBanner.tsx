import React, { useState } from 'react';

const canDo = [
  '健康知识科普解答',
  '就医科室分诊建议',
  '生活方式与预防指导',
  '症状整理（辅助就医）',
];
const cannotDo = [
  '❌ 疾病诊断',
  '❌ 开具处方',
  '❌ 解读医学报告',
  '❌ 评估病情严重性',
];

const DisclaimerBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a7c5f 0%, #076648 100%)',
      color: '#fff',
      fontSize: '12px',
      flexShrink: 0,
    }}>
      {/* Compact bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 18px', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{
            background: 'rgba(255,255,255,0.18)', padding: '2px 8px',
            borderRadius: '5px', fontWeight: 700, fontSize: '10.5px',
            letterSpacing: '0.6px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>🤖 AIGC</span>
          <span style={{ opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
            AI驱动 · 内容仅供<strong style={{ opacity: 1 }}>健康科普参考</strong>，不构成医疗诊断
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
          <a href="tel:120" className="emergency-btn-pulse" style={{
            background: '#ef4444', color: '#fff',
            padding: '3px 11px', borderRadius: '6px',
            fontSize: '12px', fontWeight: 700,
            textDecoration: 'none', letterSpacing: '0.5px',
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>📞 120</a>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'rgba(255,255,255,0.14)', color: '#fff',
              border: 'none', borderRadius: '6px',
              padding: '3px 9px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >{expanded ? '收起 ▲' : '详情 ▼'}</button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '10px 18px 13px',
          background: 'rgba(0,0,0,0.18)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', marginBottom: '5px' }}>✅ 可以做</div>
              {canDo.map((t, i) => (
                <div key={i} style={{ fontSize: '11.5px', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                  <span style={{ color: '#4ade80', fontSize: '11px' }}>✓</span>{t}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', marginBottom: '5px' }}>🚫 不能做</div>
              {cannotDo.map((t, i) => (
                <div key={i} style={{ fontSize: '11.5px', opacity: 0.85, marginBottom: '3px' }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '9px', fontSize: '11px', opacity: 0.55, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px' }}>
            紧急情况请立即拨打 120 · 心理危机热线 400-161-9995 · 内容依据《生成式人工智能服务管理暂行办法》进行 AIGC 标注
          </div>
        </div>
      )}
    </div>
  );
};

export default DisclaimerBanner;
