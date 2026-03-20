import React, { useState, useRef, KeyboardEvent } from 'react';

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Normal health topics
const normalCards = [
  { icon: '🤧', text: '感冒了怎么护理？' },
  { icon: '❤️', text: '高血压饮食注意什么？' },
  { icon: '🩸', text: '糖尿病可以吃水果吗？' },
  { icon: '😴', text: '改善睡眠有什么方法？' },
  { icon: '🏃', text: '每天运动多少分钟合适？' },
  { icon: '🍏', text: '如何增强免疫力？' },
];

// Red-zone questions — demonstrates compliance interception
const redzoneCards = [
  { icon: '🔬', text: '帮我诊断一下这些症状' },
  { icon: '💊', text: '给我开个药方' },
  { icon: '📋', text: '帮我看看化验单结果' },
  { icon: '🩺', text: '我是不是得了糖尿病' },
];

const InputArea: React.FC<InputAreaProps> = ({
  onSend, disabled = false, placeholder = '请输入您的健康咨询问题…',
}) => {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        `${Math.min(textareaRef.current.scrollHeight, 130)}px`;
    }
  };

  const handleMic = () => {
    showToast('🎤 语音输入功能即将上线，敬请期待');
  };

  const handleImageClick = () => {
    if (disabled) return;
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      showToast(`🖼️ 图片已选择：${file.name}（图片解析功能即将上线）`);
      e.target.value = '';
    }
  };

  const canSend = input.trim().length > 0 && !disabled;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: '#fff',
      padding: '10px 16px 14px',
    }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(26,38,56,0.88)',
          color: '#fff', padding: '8px 18px',
          borderRadius: '24px', fontSize: '13px',
          animation: 'fadeIn 0.2s ease',
          zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>{toastMsg}</div>
      )}

      {/* Scrollable quick cards */}
      <div className="quick-cards-wrap">
        {/* Normal cards */}
        {normalCards.map(c => (
          <button
            key={c.text}
            className="qcard qcard-normal"
            onClick={() => !disabled && onSend(c.text)}
            disabled={disabled}
          >
            <span>{c.icon}</span>
            <span>{c.text}</span>
          </button>
        ))}

        {/* Divider */}
        <div style={{
          flexShrink: 0, width: '1px', height: '28px',
          background: 'var(--border)', alignSelf: 'center', margin: '0 2px',
        }} />

        {/* Red-zone demo cards */}
        {redzoneCards.map(c => (
          <button
            key={c.text}
            className="qcard qcard-redzone"
            onClick={() => !disabled && onSend(c.text)}
            disabled={disabled}
            title="点击体验合规拦截效果"
          >
            <span>{c.icon}</span>
            <span>{c.text}</span>
            <span className="qcard-label">雷区</span>
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'flex-end',
        background: focused ? 'var(--primary-light)' : '#f5f7fa',
        borderRadius: '16px',
        border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
        padding: '9px 10px',
        transition: 'all 0.2s ease',
        boxShadow: focused ? '0 0 0 3px rgba(10,124,95,0.1)' : 'none',
      }}>
        {/* Mic button */}
        <button
          onClick={handleMic}
          disabled={disabled}
          title="语音输入（即将上线）"
          style={{
            flexShrink: 0, width: '32px', height: '32px',
            background: 'none', border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px', color: disabled ? '#c0ccd8' : 'var(--text-muted)',
            transition: 'background 0.15s, color 0.15s',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#eef2f7'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Image upload button */}
        <button
          onClick={handleImageClick}
          disabled={disabled}
          title="上传图片（即将上线）"
          style={{
            flexShrink: 0, width: '32px', height: '32px',
            background: 'none', border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px', color: disabled ? '#c0ccd8' : 'var(--text-muted)',
            transition: 'background 0.15s, color 0.15s',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#eef2f7'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2"/>
            <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 16l4-4 3.5 3.5L15 11l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={disabled ? 'AI 正在回复中…' : placeholder}
          rows={1}
          maxLength={500}
          style={{
            flex: 1, background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            fontSize: '14.5px', lineHeight: '1.6',
            color: disabled ? '#8fa0b3' : '#1a2638',
            fontFamily: 'inherit',
            overflowY: 'hidden',
            paddingTop: '6px',
          }}
        />

        {/* Char count + send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
          {input.length > 0 && (
            <span style={{ fontSize: '11px', color: '#8fa0b3' }}>
              {input.length}/500
            </span>
          )}
          <button
            onClick={handleSend}
            disabled={!canSend}
            title="发送 (Enter)"
            style={{
              width: '36px', height: '36px',
              background: canSend
                ? 'linear-gradient(135deg, #0a7c5f, #076648)'
                : '#dde4ee',
              border: 'none', borderRadius: '11px',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', flexShrink: 0,
              transition: 'all 0.2s ease',
              boxShadow: canSend ? '0 3px 10px rgba(10,124,95,0.3)' : 'none',
              transform: canSend ? 'scale(1)' : 'scale(0.93)',
            }}
          >
            {disabled
              ? <span style={{ fontSize: '14px', animation: 'pulse 1.4s ease infinite' }}>⏳</span>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                    stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </button>
        </div>
      </div>

      {/* Tip */}
      <div style={{
        marginTop: '7px', textAlign: 'center',
        fontSize: '11px', color: '#8fa0b3',
      }}>
        Enter 发送 · Shift+Enter 换行 · 红色「雷区」卡片演示合规拦截 · 本助手不能替代医生
      </div>
    </div>
  );
};

export default InputArea;
