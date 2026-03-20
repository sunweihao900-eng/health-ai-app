import React, { useState } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  timestamp?: string;
}

// ── 六段式结构定义 ───────────────────────────────────────────
const SECTION_DEFS = [
  { key: '共情',    bg: '#eff6ff', borderColor: '#93c5fd', accent: '#1d4ed8', textColor: '#1e3a8a' },
  { key: '原因解析', bg: '#f5f3ff', borderColor: '#c4b5fd', accent: '#7c3aed', textColor: '#4c1d95' },
  { key: '实用建议', bg: '#f0fdf4', borderColor: '#86efac', accent: '#16a34a', textColor: '#14532d' },
  { key: '红旗信号', bg: '#fff7ed', borderColor: '#fdba74', accent: '#ea580c', textColor: '#9a3412' },
  { key: '行动指引', bg: '#f0fdfa', borderColor: '#5eead4', accent: '#0d9488', textColor: '#134e4a' },
] as const;

interface ParsedSection {
  key: string;
  label: string;
  bg: string;
  borderColor: string;
  accent: string;
  textColor: string;
  content: string;
}

function parseSixSections(text: string): ParsedSection[] | null {
  const lines = text.split('\n');
  const starts: Array<{ idx: number; def: typeof SECTION_DEFS[number]; rawLabel: string }> = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line.startsWith('**') || !line.endsWith('**')) return;
    for (const def of SECTION_DEFS) {
      if (line.includes(def.key)) {
        starts.push({ idx, def, rawLabel: line.replace(/\*\*/g, '').trim() });
        break;
      }
    }
  });

  if (starts.length < 3) return null;

  return starts.map((s, i) => ({
    key: s.def.key,
    label: s.rawLabel,
    bg: s.def.bg,
    borderColor: s.def.borderColor,
    accent: s.def.accent,
    textColor: s.def.textColor,
    content: lines.slice(s.idx + 1, i + 1 < starts.length ? starts[i + 1].idx : lines.length).join('\n').trim(),
  }));
}

// ── Markdown renderer ────────────────────────────────────────
function renderMarkdown(text: string, smallFont = false): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  const fs = smallFont ? '13.5px' : '14.5px';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: '18px', margin: '6px 0' }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: '4px', fontSize: fs }}>{inlineFormat(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^#{2,4}\s/.test(line)) {
      const content = line.replace(/^#{2,4}\s/, '');
      nodes.push(
        <div key={`h-${i}`} style={{ fontWeight: 700, marginTop: '11px', marginBottom: '5px', fontSize: fs, color: '#0a7c5f' }}>
          {inlineFormat(content)}
        </div>
      );
      i++; continue;
    }

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.08)', margin: '9px 0' }} />);
      i++; continue;
    }

    nodes.push(
      <p key={`p-${i}`} style={{ marginBottom: '7px', lineHeight: '1.75', fontSize: fs }}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))    return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part))      return <code key={i} style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.87em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function detectContentType(content: string) {
  if (content.includes('检测到可能的紧急情况') || content.includes('立即拨打急救')) return 'emergency';
  if (content.includes('无法进行疾病诊断') || content.includes('无法推荐具体药物')) return 'redirect';
  return 'normal';
}

// ── Copy helper ──────────────────────────────────────────────
async function copyText(text: string, setCopied: (v: boolean) => void) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  } catch {
    // fallback
  }
}

// ── Component ────────────────────────────────────────────────
const MessageBubble: React.FC<MessageBubbleProps> = ({
  role, content, messageId, isStreaming = false, timestamp,
}) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = role === 'assistant';

  // Strip disclaimer from main display
  const disclaimerMarker = '---\n**⚠️ 重要提示（AIGC生成内容）**';
  const dIdx = content.indexOf(disclaimerMarker);
  const mainContent = dIdx > 0 ? content.slice(0, dIdx).trim() : content;

  const contentType = isAssistant ? detectContentType(content) : 'normal';
  const sections = isAssistant && !isStreaming && mainContent ? parseSixSections(mainContent) : null;

  const bubbleClass = isAssistant
    ? (contentType === 'emergency' ? 'bubble-emergency' : contentType === 'redirect' ? 'bubble-redirect' : '')
    : '';

  const assistantBubbleStyle: React.CSSProperties = {
    padding: sections ? '12px 14px' : '13px 17px',
    borderRadius: '4px 16px 16px 16px',
    fontSize: '14.5px', lineHeight: '1.75',
    wordBreak: 'break-word', maxWidth: '100%',
    background: '#ffffff', border: '1px solid #dde4ee',
    color: '#1a2638', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  };
  const userBubbleStyle: React.CSSProperties = {
    padding: '12px 17px',
    borderRadius: '16px 4px 16px 16px',
    fontSize: '14.5px', lineHeight: '1.75',
    wordBreak: 'break-word', maxWidth: '100%',
    background: 'linear-gradient(135deg, #0a7c5f, #076648)',
    color: '#ffffff',
    boxShadow: '0 3px 12px rgba(10,124,95,0.28)',
  };

  return (
    <div className="msg-enter msg-row" style={{
      display: 'flex',
      flexDirection: isAssistant ? 'row' : 'row-reverse',
      alignItems: 'flex-start',
      gap: '10px',
      marginBottom: '20px',
      padding: '0 4px',
    }}>
      {/* Avatar */}
      <div style={{
        width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
        background: isAssistant
          ? 'linear-gradient(135deg, #0a7c5f, #076648)'
          : 'linear-gradient(135deg, #6366f1, #4f46e5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
        boxShadow: isAssistant ? '0 3px 8px rgba(10,124,95,0.26)' : '0 3px 8px rgba(99,102,241,0.26)',
        marginTop: '2px',
      }}>
        {isAssistant ? '🤖' : '👤'}
      </div>

      {/* Content wrapper */}
      <div style={{ maxWidth: '78%', minWidth: '80px' }}>

        {/* AI badge row */}
        {isAssistant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'linear-gradient(135deg, #e8f7f4, #d0f0e9)',
              color: '#0a7c5f', padding: '2px 9px', borderRadius: '7px',
              fontSize: '11px', fontWeight: 700, border: '1px solid #aeddd6',
            }}>🤖 AI生成</span>
            {sections && (
              <span style={{
                background: '#f0fdf4', color: '#15803d', padding: '2px 9px',
                borderRadius: '7px', fontSize: '11px', fontWeight: 700, border: '1px solid #86efac',
              }}>📋 六段式结构</span>
            )}
            {contentType === 'emergency' && (
              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 9px', borderRadius: '7px', fontSize: '11px', fontWeight: 700, border: '1px solid #fca5a5' }}>🚨 紧急情况</span>
            )}
            {contentType === 'redirect' && (
              <span style={{ background: '#fffbeb', color: '#b45309', padding: '2px 9px', borderRadius: '7px', fontSize: '11px', fontWeight: 700, border: '1px solid #fcd34d' }}>⛔ 超出服务范围</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={bubbleClass} style={isAssistant ? assistantBubbleStyle : userBubbleStyle}>
          {isStreaming && !mainContent ? (
            /* Skeleton while waiting for first chunk */
            <div style={{ minWidth: '200px' }}>
              <div className="skeleton-line" style={{ width: '75%' }} />
              <div className="skeleton-line" style={{ width: '90%' }} />
              <div className="skeleton-line" style={{ width: '55%' }} />
            </div>
          ) : isAssistant ? (
            sections ? (
              /* 六段式渲染 */
              <div>
                {sections.map((sec, i) => (
                  <div key={i} className="section-card md" style={{
                    background: sec.bg,
                    borderLeftColor: sec.accent,
                    border: `1px solid ${sec.borderColor}`,
                    borderLeft: `3px solid ${sec.accent}`,
                  }}>
                    <div className="section-title" style={{ color: sec.textColor }}>
                      <span>{sec.label}</span>
                    </div>
                    <div className="section-content" style={{ color: sec.textColor }}>
                      {renderMarkdown(sec.content, true)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="md">{renderMarkdown(mainContent)}</div>
            )
          ) : (
            <span style={{ whiteSpace: 'pre-wrap', fontSize: '14.5px' }}>{content}</span>
          )}
          {isStreaming && mainContent && <span className="typing-cursor" />}
        </div>

        {/* Meta: timestamp + copy */}
        <div className="msg-meta" style={{ justifyContent: isAssistant ? 'flex-start' : 'flex-end' }}>
          {timestamp && <span>{timestamp}</span>}
          {messageId && <span>#{messageId.slice(0, 6)}</span>}
          {!isStreaming && content && (
            <button
              className="copy-btn"
              onClick={() => copyText(
                sections ? sections.map(s => `${s.label}\n${s.content}`).join('\n\n') : mainContent,
                setCopied
              )}
            >
              {copied ? '✓ 已复制' : '⎘ 复制'}
            </button>
          )}
        </div>

        {/* AIGC mini strip — always visible */}
        {isAssistant && !isStreaming && (
          <div className="aigc-mini">
            <span className="aigc-icon">⚠️</span>
            <span>
              AI生成内容 · 仅供健康科普参考 · 不构成医疗诊断或处方依据
              {contentType === 'emergency' && (
                <> · <strong style={{ color: '#dc2626' }}>紧急：立即拨打 120</strong></>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
