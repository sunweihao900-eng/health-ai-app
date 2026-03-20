import React, { useState, useEffect } from 'react';
import DisclaimerPage from './components/chat/DisclaimerPage';
import ChatWindow from './components/chat/ChatWindow';

// Production (Vercel): VITE_API_BASE='' → relative URLs, nginx/Vercel rewrites to Railway
// Development: VITE_API_BASE unset → falls back to localhost
const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const App: React.FC = () => {
  const [hasConsented, setHasConsented] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('正在连接服务…');

  useEffect(() => {
    const consent = localStorage.getItem('health_ai_consent');
    if (consent) {
      try {
        if (JSON.parse(consent).agreed) setHasConsented(true);
      } catch { /* ignore */ }
    }
    fetchDemoToken();
  }, []);

  const fetchDemoToken = async () => {
    setLoadingMsg('正在连接服务…');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/demo-token`, { method: 'POST' });
      const data = await res.json();
      setAuthToken(data.access_token);
      setLoadingMsg('连接成功');
    } catch {
      setAuthToken('demo-offline-token');
      setLoadingMsg('进入演示模式');
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a7c5f 0%, #064e3b 100%)',
      }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '22px',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '38px', margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>🏥</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            健康AI助手
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginBottom: '24px' }}>
            Health AI Assistant
          </div>
          {/* Spinner dots */}
          <div className="typing-dots" style={{ justifyContent: 'center' }}>
            <span style={{ background: 'rgba(255,255,255,0.7)' }} />
            <span style={{ background: 'rgba(255,255,255,0.7)' }} />
            <span style={{ background: 'rgba(255,255,255,0.7)' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>
            {loadingMsg}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif' }}>
      {!hasConsented && (
        <DisclaimerPage onAgree={() => setHasConsented(true)} />
      )}
      <ChatWindow authToken={authToken} apiBase={API_BASE} />
    </div>
  );
};

export default App;
