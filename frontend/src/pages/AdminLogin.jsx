import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Admin login failed.');

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminSession', JSON.stringify(data.admin));
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-color)' }}>
      <div className="glass-panel animate-fadein" style={{ width: '100%', maxWidth: '460px', padding: '2.4rem' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <ShieldCheck size={24} color="white" />
        </div>

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.7rem', marginBottom: '0.4rem', color: 'var(--text-color)' }}>
          Admin Login
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.6rem' }}>
          Login as club administrator to manage events and updates.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="admin@aimt.in"
            />
          </div>

          <div style={{ marginBottom: '1.4rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter your account password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            {loading ? 'Signing in...' : 'Login as Admin'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Back to <Link to="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>Home</Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;

