import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '../store/authStore';

const REMEMBER_EMAIL_KEY = 'rememberedLoginEmail';
const API_BASE_URL = (
  globalThis.process?.env?.VITE_API_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://the-developers-guild-backend.onrender.com/api'
).replace(/\/$/, '');
const API_ROOT_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const setAdmin = useAuthStore((state) => state.setAdmin);

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false
    }
  });

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      setValue('email', rememberedEmail);
      setValue('rememberMe', true);
    }
  }, [setValue]);

  const handleResendVerification = async () => {
    const targetEmail = verificationEmail || getValues('email');
    if (!targetEmail) {
      toast.error('Verification email is missing. Please try logging in again.');
      return;
    }

    const toastId = toast.loading('Resending code...');
    try {
      const res = await fetch(`${API_ROOT_URL}/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to resend verification code.');
      }
      toast.success(data.message || 'Verification code sent. Check your email.', { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Unable to resend verification code.', { id: toastId });
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setNeedsVerification(false);
    setVerificationEmail('');
    const toastId = toast.loading('Logging in...');

    if (data.rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, data.email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    try {
      const userRes = await fetch(`${API_ROOT_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      
      const isJson = userRes.headers.get('content-type')?.includes('application/json');
      const userData = isJson ? await userRes.json() : null;

      if (userRes.ok && userData?.requiresLoginOtp) {
        toast.success('OTP sent. Redirecting...', { id: toastId });
        navigate(`/login-otp?email=${encodeURIComponent(userData.email || data.email)}`);
        return;
      }

      if (userRes.ok) {
        useAuthStore.getState().logoutAdmin(); 
        setUser(userData, userData.token); 
        toast.success('Login successful. Redirecting...', { id: toastId });
        navigate('/dashboard');
        return;
      }

      if (!userRes.ok) {
        if (userData?.requiresVerification) {
          const targetEmail = userData.email || data.email;
          setNeedsVerification(true);
          setVerificationEmail(targetEmail);
          toast.error('Your account is not verified yet.', { id: toastId });
          return;
        }

        // Admin fallback path
        const adminRes = await fetch(`${API_ROOT_URL}/admin/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
        });
        
        const isAdminJson = adminRes.headers.get('content-type')?.includes('application/json');
        const adminData = isAdminJson ? await adminRes.json() : null;
        
        if (adminRes.ok && adminData?.requiresLoginOtp) {
          toast.success(adminData.message || 'OTP sent. Redirecting...', { id: toastId });
          navigate(`/login-otp?mode=admin&email=${encodeURIComponent(adminData.email || data.email)}`);
          return;
        }

        if (adminRes.ok && adminData?.token && adminData?.admin) {
          useAuthStore.getState().logoutUser();
          setAdmin(adminData.admin, adminData.token);
          toast.success('Admin login successful. Redirecting...', { id: toastId });
          navigate('/admin');
          return;
        }

        const errorMsg = userData?.message || adminData?.message || 'Invalid credentials or server not responding.';
        throw new Error(errorMsg);
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-color)' }}>
      <Helmet>
        <title>Login | AimT Developers</title>
      </Helmet>

      <div className="glass-panel animate-fadein" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <LogIn size={24} color="white" />
        </div>

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.8rem', marginBottom: '0.4rem', color: 'var(--text-color)' }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Log in to your Developers' Guild account.
        </p>

        {needsVerification && (
          <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem', background: 'rgba(239,68,68,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0, paddingBottom: 10 }}>Almost there! Please verify your email first.</p>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate(`/verify-email?email=${encodeURIComponent(verificationEmail || getValues('email'))}`)}
            >
              Go to Verify Email
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={handleResendVerification}
            >
              Resend Code
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} method="post" action={`${API_ROOT_URL}/auth/login`}>
          <div style={{ marginBottom: '1.5rem' }}>
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

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-color)' }}>
                Password
              </label>
              <Link to="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Forgot password?</Link>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                {...register("password")}
                placeholder="Enter your account password"
                className="form-input"
                style={{ paddingRight: '40px', borderColor: errors.password ? '#ef4444' : '' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {errors.password && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.password.message}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <input
              type="checkbox"
              id="remember"
              {...register("rememberMe")}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="remember" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Remember my email</label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Apply for membership</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

