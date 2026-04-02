import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

// Registration Zod Schema matching backend
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  collegeId: z.string().optional().or(z.literal('')),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // path of error
});

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [passwordInsights, setPasswordInsights] = useState({ level: 'weak', score: 0, breached: false });
  const navigate = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema)
  });

  const watchPassword = watch('password') || '';
  const watchEmail = watch('email') || '';

  useEffect(() => {
    if (!watchPassword) {
      setPasswordInsights({ level: 'weak', score: 0, breached: false });
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/password-strength`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: watchPassword, email: watchEmail }),
        });
        const data = await res.json();
        if (res.ok) {
          setPasswordInsights({
            level: data.level || 'weak',
            score: Number(data.score || 0),
            breached: Boolean(data.breached),
          });
        }
      } catch {
        // no-op
      }
    }, 260);

    return () => clearTimeout(handle);
  }, [watchPassword, watchEmail]);

  const strengthColor = useMemo(() => {
    if (passwordInsights.breached) return '#ef4444';
    if (passwordInsights.level === 'strong') return '#10b981';
    if (passwordInsights.level === 'medium') return '#f59e0b';
    return '#ef4444';
  }, [passwordInsights]);

  const onSubmit = async (data) => {
    setLoading(true);
    const toastId = toast.loading('Creating account...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          collegeId: data.collegeId || null,
          password: data.password,
        }),
      });
      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData.message || 'Registration failed');
      }

      toast.success('Account created! Please check your email.', { id: toastId });
      setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(data.email)}`), 900);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-color)' }}>
        <Helmet><title>Already Joined | DevGuild</title></Helmet>
        <div className="glass-panel animate-fadein" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <UserPlus size={30} color="white" />
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.8rem', marginBottom: '1rem', color: 'var(--text-color)' }}>Already Joined!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>You are already registered, {user.name}.</p>
          <Link to="/dashboard" className="btn-primary" style={{ width: '100%', padding: '12px', display: 'inline-block' }}>Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-color)' }}>
      <Helmet>
        <title>Join the Guild | AimT Developers</title>
      </Helmet>
      
      <div className="glass-panel animate-fadein" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <UserPlus size={24} color="white" />
        </div>

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.8rem', marginBottom: '0.4rem', color: 'var(--text-color)' }}>
          Join the Guild
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Create your account and start your developer journey at AIMT.
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
                Full Name
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="e.g. Rahul Sharma"
                className="form-input"
                style={{ borderColor: errors.name ? '#ef4444' : '' }}
              />
              {errors.name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.name.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
                Email Address
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="you@accurate.in or @gmail.com"
                className="form-input"
                style={{ borderColor: errors.email ? '#ef4444' : '' }}
              />
              {errors.email && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
                College / Student ID
              </label>
              <input
                type="text"
                {...register("collegeId")}
                placeholder="e.g. 2023CS042"
                className="form-input"
                style={{ borderColor: errors.collegeId ? '#ef4444' : '' }}
              />
              {errors.collegeId && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.collegeId.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
                Password
              </label>
              <input
                type="password"
                {...register("password")}
                placeholder="Minimum 8 characters"
                className="form-input"
                style={{ borderColor: errors.password ? '#ef4444' : '' }}
              />
              {errors.password && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.password.message}</p>}
              {!errors.password && watchPassword && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (passwordInsights.score / 7) * 100)}%`, height: '100%', background: strengthColor }} />
                  </div>
                  <p style={{ marginTop: '4px', fontSize: '0.75rem', color: strengthColor }}>
                    {passwordInsights.breached
                      ? 'This password appears in breached/common lists. Choose a safer password.'
                      : `Strength: ${passwordInsights.level.toUpperCase()}`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                {...register("confirmPassword")}
                placeholder="Re-enter your password"
                className="form-input"
                style={{ borderColor: errors.confirmPassword ? '#ef4444' : '' }}
              />
              {errors.confirmPassword && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.confirmPassword.message}</p>}
            </div>

          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '1.5rem', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

