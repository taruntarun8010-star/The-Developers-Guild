import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from './LanguageContext';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild.onrender.com').replace(/\/$/, '');

const ChatbotWidget = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', content: t('chatbotWelcome') },
  ]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const faq = useMemo(() => [
    {
      keys: ['event', 'register', 'registration', 'इवेंट', 'रजिस्टर'],
      answer: language === 'hi'
        ? 'इवेंट्स पेज पर जाएं, किसी इवेंट पर Register करें। स्टेटस डैशबोर्ड में दिखेगा।'
        : 'Go to Events, choose an event, and click Register. You can track status in your dashboard.',
      action: '/events',
    },
    {
      keys: ['project', 'प्रोजेक्ट'],
      answer: language === 'hi'
        ? 'Projects पेज में सभी सक्रिय और पिछले प्रोजेक्ट्स दिखते हैं।'
        : 'The Projects page shows active and past projects.',
      action: '/projects',
    },
    {
      keys: ['contact', 'support', 'help', 'संपर्क', 'मदद'],
      answer: language === 'hi'
        ? 'Contact पेज से अपनी समस्या भेजें, एडमिन टीम जल्दी जवाब देगी।'
        : 'Use the Contact page to send your issue and the admin team will respond.',
      action: '/contact',
    },
    {
      keys: ['login', 'password', 'otp', 'लॉगिन', 'पासवर्ड', 'ओटीपी'],
      answer: language === 'hi'
        ? 'Login में Forgot Password और OTP flow उपलब्ध है। अगर ईमेल verify नहीं है तो पहले verify करें।'
        : 'Use Forgot Password and OTP flow on Login. Verify your email first if needed.',
      action: '/login',
    },
  ], [language]);

  const replyFor = (query) => {
    const normalized = query.toLowerCase();
    const match = faq.find(item => item.keys.some(k => normalized.includes(k)));
    if (match) return match;
    return {
      answer: language === 'hi'
        ? 'मैं आपकी मदद के लिए यहां हूं। आप Events, Projects, Contact, Login, Dashboard के बारे में पूछ सकते हैं।'
        : 'I can help with Events, Projects, Contact, Login, and Dashboard guidance.',
      action: null,
    };
  };

  const send = async () => {
    if (!text.trim()) return;
    const userText = text.trim();
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText },
    ]);
    setText('');

    setIsThinking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          language,
          contextPath: window.location.pathname,
        }),
      });

      if (!res.ok) {
        throw new Error('Assistant API unavailable');
      }

      const data = await res.json();

      if (!data?.reply) {
        throw new Error('Assistant API unavailable');
      }

      setMessages(prev => [
        ...prev,
        { role: 'bot', content: data.reply || (language === 'hi' ? 'कोई जवाब नहीं मिला।' : 'No response available.'), action: data.action || null },
      ]);
    } catch {
      const fallback = replyFor(userText);
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: fallback.answer, action: fallback.action },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="glass-panel"
          role="dialog"
          aria-label={t('chatbotTitle')}
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '88px',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: '480px',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.9rem', borderBottom: '1px solid var(--card-border)' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-color)' }}>{t('chatbotTitle')}</h2>
            <button aria-label={t('chatbotClose')} onClick={() => setOpen(false)} className="btn-outline" style={{ padding: '4px 8px' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: '0.9rem', overflowY: 'auto', display: 'grid', gap: '0.6rem', flex: 1 }}>
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--card-bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-color)',
                  fontSize: '0.86rem',
                }}>
                  <div>{msg.content}</div>
                  {msg.action && (
                    <button
                      onClick={() => navigate(msg.action)}
                      className="btn-outline"
                      style={{ marginTop: '0.45rem', padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      {language === 'hi' ? 'खोलें' : 'Open'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-muted)',
                  fontSize: '0.86rem',
                }}>
                  {language === 'hi' ? 'सोच रहा हूं...' : 'Thinking...'}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              className="form-input"
              placeholder={t('chatbotInput')}
              aria-label={t('chatbotInput')}
            />
            <button onClick={send} className="btn-primary" aria-label={t('chatbotSend')} style={{ padding: '0 12px' }}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(prev => !prev)}
        className="btn-primary pulse-soft"
        aria-label={open ? t('chatbotClose') : t('chatbotOpen')}
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          padding: 0,
          zIndex: 120,
        }}
      >
        <MessageCircle size={22} />
      </button>
    </>
  );
};

export default ChatbotWidget;

