import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const LoginOtp = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const setAdmin = useAuthStore((state) => state.setAdmin);

  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const mode = useMemo(() => (searchParams.get('mode') || 'user').toLowerCase(), [searchParams]);
  const isAdminMode = mode === 'admin';
  const [email] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const toastId = toast.loading('Verifying OTP...');

    try {
      const verifyEndpoint = isAdminMode
        ? `${API_BASE_URL}/api/admin/login/verify-otp`
        : `${API_BASE_URL}/api/auth/login/verify-otp`;

      const res = await fetch(verifyEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.requiresVerification) {
          toast.error('Account not verified. Redirecting...', { id: toastId });
          navigate(`/verify-email?email=${encodeURIComponent(data.email || email)}`);
          return;
        }
        throw new Error(data.message || 'OTP verification failed.');
      }

      if (isAdminMode) {
        setAdmin(data.admin, data.token);
      } else {
        setUser(data.user, data.token);
      }
      toast.success('Login successful!', { id: toastId });
      setTimeout(() => navigate(isAdminMode ? '/admin' : '/dashboard'), 700);
    } catch (err) {
      toast.error(err.message, { id: toastId });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    const toastId = toast.loading('Resending OTP...');

    try {
      const resendEndpoint = isAdminMode
        ? `${API_BASE_URL}/api/admin/login/resend-otp`
        : `${API_BASE_URL}/api/auth/login/resend-otp`;

      const res = await fetch(resendEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.requiresVerification) {
          toast.error('Account not verified.', { id: toastId });
          navigate(`/verify-email?email=${encodeURIComponent(data.email || email)}`);
          return;
        }
        throw new Error(data.message || 'Unable to resend OTP.');
      }

      toast.success(data.message || 'A new OTP has been sent.', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-color)' }}>
      <div className="glass-panel animate-fadein" style={{ width: '100%', maxWidth: '460px', padding: '2.4rem' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <Shield size={24} color="white" />
        </div>

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.7rem', marginBottom: '0.4rem', color: 'var(--text-color)' }}>
          {isAdminMode ? 'Admin OTP Verification' : 'Login OTP Verification'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.6rem' }}>
          Enter the 6-digit OTP sent to your email to complete login.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleVerifyOtp}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              readOnly
              value={email}
              className="form-input"
              style={{ background: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' }}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
              Login OTP
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="form-input"
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resending || !email}
          className="btn-outline"
          style={{ width: '100%', marginTop: '0.8rem', padding: '10px' }}
        >
          {resending ? 'Sending...' : 'Resend OTP'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Back to <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginOtp;
