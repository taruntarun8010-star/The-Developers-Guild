import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild.onrender.com').replace(/\/$/, '');

const TeamInviteResponse = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [state, setState] = useState({ loading: true, message: '', ok: false, actionLoading: false });

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  }, []);

  const tokenHeader = useMemo(() => localStorage.getItem('token') || '', []);

  const formatRemaining = (ms) => {
    if (ms <= 0) return 'Expired';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setState({ loading: false, ok: false, message: 'Invalid invite link.', actionLoading: false });
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/events/team-invites/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to load invite.');
        setInvite(data.invite || null);
        setState({ loading: false, ok: true, message: '', actionLoading: false });
      } catch (err) {
        setState({ loading: false, ok: false, message: err.message || 'Unable to load invite.', actionLoading: false });
      }
    };

    loadInvite();
  }, [token]);

  const respond = async (decision) => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setState((prev) => ({ ...prev, actionLoading: true, message: '' }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/team-invites/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : {}),
        },
        body: JSON.stringify({ token, decision, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to process invite response.');
      setState({ loading: false, ok: true, message: data.message || 'Response submitted.', actionLoading: false });
      setInvite((prev) => prev ? { ...prev, status: decision === 'accept' ? 'accepted' : 'rejected', expiresInMs: 0 } : prev);
    } catch (err) {
      setState((prev) => ({ ...prev, ok: false, message: err.message || 'Unable to process invite response.', actionLoading: false }));
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', padding: '1rem', background: 'var(--bg-color)' }}>
      <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', padding: '2rem' }}>
        <h1 style={{ marginBottom: '0.8rem' }}>Team Invite</h1>

        {state.loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading invite...</p>
        ) : !state.ok ? (
          <p style={{ color: '#ef4444' }}>{state.message}</p>
        ) : (
          <>
            <p style={{ color: 'var(--text-color)', marginBottom: '0.45rem' }}>
              {invite?.inviterName} invited you to join team for <strong>{invite?.eventName}</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Invite status: <strong>{invite?.status}</strong> | Expires in: <strong>{formatRemaining(invite?.expiresInMs || 0)}</strong>
            </p>
            {!user && (
              <p style={{ marginTop: '0.7rem', color: '#ef4444' }}>
                Please login with invited email <strong>{invite?.email}</strong> to respond.
              </p>
            )}
            {state.message && <p style={{ marginTop: '0.7rem', color: '#10b981' }}>{state.message}</p>}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => respond('accept')} disabled={state.actionLoading || invite?.status !== 'pending'}>
                {state.actionLoading ? 'Submitting...' : 'Accept Invite'}
              </button>
              <button className="btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => respond('reject')} disabled={state.actionLoading || invite?.status !== 'pending'}>
                Reject Invite
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '1.2rem' }}>
          <Link className="btn-primary" style={{ textDecoration: 'none' }} to="/events">Go to Events</Link>
        </div>
      </div>
    </div>
  );
};

export default TeamInviteResponse;

