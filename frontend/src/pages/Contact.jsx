import React, { useState } from 'react';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild.onrender.com').replace(/\/$/, '');

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);

  const onChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to send message right now.');
      }

      setSuccess(data.message || 'Thanks. Your message was sent successfully.');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err.message || 'Unable to send message right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ambient-bg" style={{ minHeight: 'calc(100vh - 64px)', padding: '3rem 1.5rem', background: 'var(--bg-color)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div className="glass-panel animate-fadein" style={{ padding: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)', fontWeight: 900, color: 'var(--text-color)' }}>
            Contact <span className="text-gradient">The Guild</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.6rem', marginBottom: '1.4rem' }}>
            Have an idea, collaboration request, or workshop proposal? Send us a message.
          </p>

          {success && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
            <input className="form-input" name="name" value={form.name} onChange={onChange} placeholder="Your name" required />
            <input className="form-input" type="email" name="email" value={form.email} onChange={onChange} placeholder="Your email" required />
            <textarea className="form-input" name="message" value={form.message} onChange={onChange} placeholder="Tell us what you want to build or discuss" rows={5} required />
            <div>
              <button className="btn-primary pulse-soft" type="submit" style={{ padding: '11px 24px' }} disabled={sending}>
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;

