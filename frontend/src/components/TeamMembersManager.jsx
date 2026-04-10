import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild.onrender.com').replace(/\/$/, '');

const emptyForm = {
  name: '',
  email: '',
  designation: '',
  password: '',
};

const TeamMembersManager = ({ title = 'Guild Team', subtitle = 'Meet our active team members.', compact = false }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const adminToken = useMemo(() => localStorage.getItem('adminToken') || '', []);
  const adminSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || 'null');
    } catch {
      return null;
    }
  }, []);

  const canManage = ['super_admin', 'sub_admin'].includes(adminSession?.role) && Boolean(adminToken);

  const loadMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/members`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to load team members.');
      }
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load team members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const authFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Request failed.');
    }
    return data;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError('');
    try {
      if (editingMemberId) {
        const payload = {
          name: form.name,
          email: form.email,
          designation: form.designation,
        };
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }

        await authFetch(`${API_BASE_URL}/api/admin/members/${editingMemberId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch(`${API_BASE_URL}/api/admin/members`, {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      setForm(emptyForm);
      setEditingMemberId(null);
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Unable to save member.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (member) => {
    setEditingMemberId(member.id);
    setForm({
      name: member.name || '',
      email: member.email || '',
      designation: member.designation || '',
      password: '',
    });
  };

  const removeMember = async (memberId) => {
    if (!canManage) return;
    if (!window.confirm('Remove this member?')) return;

    setError('');
    try {
      await authFetch(`${API_BASE_URL}/api/admin/members/${memberId}`, { method: 'DELETE' });
      if (editingMemberId === memberId) {
        setEditingMemberId(null);
        setForm(emptyForm);
      }
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Unable to remove member.');
    }
  };

  return (
    <section className="glass-panel" style={{ padding: compact ? '1.2rem' : '1.5rem', marginBottom: '1.4rem' }}>
      <div style={{ marginBottom: '0.9rem' }}>
        <h2 style={{ color: 'var(--text-color)', fontSize: compact ? '1.18rem' : '1.35rem', fontWeight: 800 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.92rem' }}>{subtitle}</p>
      </div>

      {canManage && (
        <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
          <input
            className="form-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            className="form-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            className="form-input"
            placeholder="Designation"
            value={form.designation}
            onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
            required
          />
          <input
            className="form-input"
            type="password"
            minLength={editingMemberId ? 0 : 8}
            placeholder={editingMemberId ? 'New password (optional)' : 'Password (min 8 chars)'}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required={!editingMemberId}
          />

          <div style={{ display: 'flex', gap: '0.55rem', gridColumn: '1 / -1' }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              <PlusCircle size={15} style={{ marginRight: '6px' }} />
              {saving ? 'Saving...' : editingMemberId ? 'Update Member' : 'Add Member'}
            </button>
            {editingMemberId && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setEditingMemberId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && (
        <p style={{ color: '#ef4444', marginBottom: '0.8rem', fontSize: '0.88rem' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading team members...</p>
      ) : members.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No team members found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
          {members.map((member) => (
            <div key={member.id} className="glass-panel" style={{ padding: '1rem', borderRadius: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', fontWeight: 700, marginBottom: '0.7rem' }}>
                {String(member.name || '')
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <h3 style={{ color: 'var(--text-color)', fontSize: '1rem', fontWeight: 800 }}>{member.name}</h3>
              <p style={{ color: 'var(--primary)', marginTop: '0.2rem', fontSize: '0.86rem', fontWeight: 600 }}>{member.designation}</p>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.82rem' }}>{member.email}</p>

              {canManage && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn-outline" style={{ padding: '6px 10px' }} onClick={() => startEdit(member)}>
                    <Pencil size={14} style={{ marginRight: '4px' }} /> Edit
                  </button>
                  <button
                    className="btn-outline"
                    style={{ padding: '6px 10px', borderColor: '#ef4444', color: '#ef4444' }}
                    onClick={() => removeMember(member.id)}
                  >
                    <Trash2 size={14} style={{ marginRight: '4px' }} /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TeamMembersManager;

