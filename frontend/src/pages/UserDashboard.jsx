import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Edit2, BarChart3, Calendar, Home, FileText, Users, Mail, Menu, X } from 'lucide-react';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [formData, setFormData] = useState({});
  const [skillsInput, setSkillsInput] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [studentProjects, setStudentProjects] = useState([]);
  const [projectForm, setProjectForm] = useState({ title: '', summary: '', techStack: '', githubUrl: '', demoUrl: '' });

  const navItems = useMemo(() => [
    { to: '/dashboard', icon: <BarChart3 size={20} />, label: 'My Dashboard' },
    { to: '/events', icon: <Calendar size={20} />, label: 'Events' },
    { to: '/projects', icon: <FileText size={20} />, label: 'Projects' },
    { to: '/team', icon: <Users size={20} />, label: 'Team' },
    { to: '/contact', icon: <Mail size={20} />, label: 'Contact' },
    { to: '/', icon: <Home size={20} />, label: 'Home' },
  ], []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }

    try {
      const userData = JSON.parse(storedUser);
      const normalizedUser = {
        ...userData,
        profileVisibility: {
          bio: userData?.profileVisibility?.bio !== false,
          skills: userData?.profileVisibility?.skills !== false,
          socials: userData?.profileVisibility?.socials !== false,
          projects: userData?.profileVisibility?.projects !== false,
        },
      };
      setUser(normalizedUser);
      setFormData(normalizedUser);
      setSkillsInput(Array.isArray(normalizedUser.skills) ? normalizedUser.skills.join(', ') : '');
      loadRegistrations(normalizedUser.id);
      loadStudentProjects(normalizedUser.id);
    } catch {
      localStorage.removeItem('user');
      navigate('/login');
    }
  }, [navigate]);

  const loadRegistrations = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${userId}/registrations`);
      const data = await res.json();
      setRegistrations(Array.isArray(data) ? data : []);
    } catch {
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentProjects = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${userId}/student-projects`);
      const data = await res.json();
      setStudentProjects(Array.isArray(data) ? data : []);
    } catch {
      setStudentProjects([]);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        skills: skillsInput,
      };
      const res = await fetch(`${API_BASE_URL}/api/user/${user.id}/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile.');
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      setFormData(data);
      setSkillsInput(Array.isArray(data.skills) ? data.skills.join(', ') : '');
      setEditingProfile(false);
    } catch (err) {
      alert(err.message || 'Profile update failed.');
    }
  };

  const handleAddStudentProject = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${user.id}/student-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to add project.');

      setStudentProjects((prev) => [data, ...prev]);
      setProjectForm({ title: '', summary: '', techStack: '', githubUrl: '', demoUrl: '' });
    } catch (err) {
      alert(err.message || 'Could not add project.');
    }
  };

  const handleDeleteStudentProject = async (projectId) => {
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${user.id}/student-projects/${projectId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to remove project.');
      setStudentProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      alert(err.message || 'Could not remove project.');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    if (file.size > 1024 * 1024) {
      alert('Please select an image under 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, profilePhoto: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSession');
    navigate('/login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'rejected':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'confirmed':
        return 'rgba(16,185,129,0.1)';
      case 'pending':
        return 'rgba(245,158,11,0.1)';
      case 'rejected':
        return 'rgba(239,68,68,0.1)';
      default:
        return 'rgba(107,114,128,0.1)';
    }
  };

  const profileCompletion = useMemo(() => {
    if (!user) return 0;
    const checks = [
      Boolean(user.name),
      Boolean(user.collegeId),
      Boolean(user.profilePhoto),
      Boolean(user.bio),
      Boolean(user.githubUrl),
      Boolean(user.linkedinUrl),
      Boolean(user.portfolioUrl),
      Array.isArray(user.skills) && user.skills.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [user]);

  const publicSlug = useMemo(() => {
    if (!user) return '';
    if (user.profileSlug) return user.profileSlug;
    const base = String(user.name || 'student').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const suffix = String(user.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
    return suffix ? `${base || 'student'}-${suffix}` : (base || 'student');
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        Loading your dashboard...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-color)', color: 'var(--text-color)', display: 'flex' }}>
      <aside
        style={{
          width: sidebarOpen ? '280px' : '0px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid rgba(59,130,246,0.1)',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          position: 'fixed',
          left: 0,
          top: 64,
          height: 'calc(100vh - 64px)',
          zIndex: 40,
        }}
      >
        <div style={{ padding: '2rem 1.5rem', height: '100%', overflow: 'auto' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Navigation
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                    transition: 'all 0.2s',
                    fontWeight: active ? 600 : 500,
                    fontSize: '0.95rem',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              cursor: 'pointer',
              marginTop: '2rem',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          marginLeft: sidebarOpen ? '280px' : '0px',
          transition: 'margin-left 0.3s ease',
          padding: '2rem',
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'fixed',
            left: sidebarOpen ? '280px' : '16px',
            top: '80px',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'var(--primary)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'left 0.3s ease',
            zIndex: 39,
          }}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>My Dashboard</h1>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                border: 'none',
                color: 'white',
                fontSize: '1.2rem',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                user.name?.charAt(0).toUpperCase()
              )}
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '60px',
                  right: 0,
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  minWidth: '200px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => {
                    setSkillsInput(Array.isArray(formData.skills) ? formData.skills.join(', ') : '');
                    setEditingProfile(true);
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-color)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Edit2 size={16} style={{ display: 'inline', marginRight: '6px' }} /> Edit Profile
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderTop: '1px solid rgba(59,130,246,0.1)',
                  }}
                >
                  <LogOut size={16} style={{ display: 'inline', marginRight: '6px' }} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {editingProfile ? (
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Edit Profile</h2>
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Email
                  </label>
                  <input type="email" value={formData.email || ''} disabled className="form-input" style={{ opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Public Profile URL Slug
                  </label>
                  <input
                    type="text"
                    value={formData.profileSlug || ''}
                    onChange={(e) => setFormData({ ...formData, profileSlug: e.target.value })}
                    className="form-input"
                    placeholder="your-public-url"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    College ID
                  </label>
                  <input
                    type="text"
                    value={formData.collegeId || ''}
                    onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Profile Photo
                  </label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="form-input" />
                  {formData.profilePhoto && (
                    <img src={formData.profilePhoto} alt="Profile preview" style={{ width: '64px', height: '64px', borderRadius: '50%', marginTop: '10px', objectFit: 'cover', border: '1px solid var(--card-border)' }} />
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Bio
                  </label>
                  <textarea
                    rows={3}
                    value={formData.bio || ''}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="form-input"
                    placeholder="Tell others about your interests and goals"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Profile Theme
                  </label>
                  <select
                    value={formData.profileTheme || 'default'}
                    onChange={(e) => setFormData({ ...formData, profileTheme: e.target.value })}
                    className="form-input"
                  >
                    <option value="default">Default</option>
                    <option value="ocean">Ocean</option>
                    <option value="sunset">Sunset</option>
                    <option value="forest">Forest</option>
                    <option value="midnight">Midnight</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Profile Banner URL
                  </label>
                  <input
                    type="url"
                    value={formData.profileBannerUrl || ''}
                    onChange={(e) => setFormData({ ...formData, profileBannerUrl: e.target.value })}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.8rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>Public profile privacy</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.5rem' }}>
                    {[
                      { key: 'bio', label: 'Show bio' },
                      { key: 'skills', label: 'Show skills' },
                      { key: 'socials', label: 'Show social links' },
                      { key: 'projects', label: 'Show projects' },
                    ].map((item) => (
                      <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem' }}>
                        <input
                          type="checkbox"
                          checked={formData?.profileVisibility?.[item.key] !== false}
                          onChange={(e) => setFormData((prev) => ({
                            ...prev,
                            profileVisibility: {
                              bio: prev?.profileVisibility?.bio !== false,
                              skills: prev?.profileVisibility?.skills !== false,
                              socials: prev?.profileVisibility?.socials !== false,
                              projects: prev?.profileVisibility?.projects !== false,
                              [item.key]: e.target.checked,
                            },
                          }))}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={formData.githubUrl || ''}
                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                    className="form-input"
                    placeholder="https://github.com/username"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Portfolio URL
                  </label>
                  <input
                    type="url"
                    value={formData.portfolioUrl || ''}
                    onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                    className="form-input"
                    placeholder="https://yourportfolio.com"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={formData.linkedinUrl || ''}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    className="form-input"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    className="form-input"
                    placeholder="React, Node.js, Python, SQL"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn-primary">Save Changes</button>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(107,114,128,0.1)',
                    border: '1px solid rgba(107,114,128,0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                  {user.profilePhoto ? (
                    <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Welcome, {user.name}!</h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Joined on {new Date(user.joinedAt).toLocaleDateString()}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Email</p>
                  <p style={{ fontWeight: 600, marginTop: '4px' }}>{user.email}</p>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>College ID</p>
                  <p style={{ fontWeight: 600, marginTop: '4px' }}>{user.collegeId}</p>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.07)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Profile Completion</p>
                  <p style={{ fontWeight: 700, marginTop: '4px' }}>{profileCompletion}%</p>
                  <div style={{ marginTop: '8px', height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                    <div style={{ width: `${profileCompletion}%`, height: '100%', background: 'linear-gradient(90deg, #14b8a6, #3b82f6)' }} />
                  </div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>GitHub</p>
                  <p style={{ fontWeight: 600, marginTop: '4px', overflowWrap: 'anywhere' }}>
                    {user.githubUrl || 'Not added yet'}
                  </p>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>LinkedIn</p>
                  <p style={{ fontWeight: 600, marginTop: '4px', overflowWrap: 'anywhere' }}>
                    {user.linkedinUrl || 'Not added yet'}
                  </p>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(14,165,233,0.08)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Public Profile URL</p>
                  <p style={{ fontWeight: 600, marginTop: '4px', overflowWrap: 'anywhere' }}>
                    /u/{publicSlug}
                  </p>
                </div>
              </div>

              {user.bio && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bio</p>
                  <p style={{ marginTop: '4px' }}>{user.bio}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' }}>
                {Array.isArray(user.skills) && user.skills.length > 0 ? user.skills.map((skill) => (
                  <span key={skill} style={{ padding: '6px 10px', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}>
                    {skill}
                  </span>
                )) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add your skills from Edit Profile to improve profile completion.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setSkillsInput(Array.isArray(user.skills) ? user.skills.join(', ') : '');
                    setFormData(user);
                    setEditingProfile(true);
                  }}
                >
                  Edit Profile
                </button>
                {user.githubUrl && (
                  <a href={user.githubUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>
                    GitHub
                  </a>
                )}
                {user.linkedinUrl && (
                  <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>
                    LinkedIn
                  </a>
                )}
                {user.portfolioUrl && (
                  <a href={user.portfolioUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>
                    Portfolio
                  </a>
                )}
                <Link to={`/u/${publicSlug}`} className="btn-outline" style={{ textDecoration: 'none' }}>
                  View Public Profile
                </Link>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.8rem' }}>Student Portfolio Projects</h3>
              <form onSubmit={handleAddStudentProject} style={{ display: 'grid', gap: '0.7rem', marginBottom: '1rem' }}>
                <input className="form-input" placeholder="Project title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} required />
                <textarea className="form-input" rows={3} placeholder="Project summary" value={projectForm.summary} onChange={(e) => setProjectForm({ ...projectForm, summary: e.target.value })} required />
                <input className="form-input" placeholder="Tech stack (React, Node, etc.)" value={projectForm.techStack} onChange={(e) => setProjectForm({ ...projectForm, techStack: e.target.value })} />
                <input className="form-input" placeholder="GitHub URL" value={projectForm.githubUrl} onChange={(e) => setProjectForm({ ...projectForm, githubUrl: e.target.value })} />
                <input className="form-input" placeholder="Demo URL" value={projectForm.demoUrl} onChange={(e) => setProjectForm({ ...projectForm, demoUrl: e.target.value })} />
                <button type="submit" className="btn-primary" style={{ width: 'fit-content' }}>Add Project</button>
              </form>

              {studentProjects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No portfolio projects added yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {studentProjects.map((project) => (
                    <div key={project.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
                        <h4 style={{ margin: 0 }}>{project.title}</h4>
                        <button className="btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleDeleteStudentProject(project.id)}>
                          Remove
                        </button>
                      </div>
                      <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{project.summary}</p>
                      {project.techStack && <p style={{ marginTop: '0.3rem', fontSize: '0.86rem' }}><strong>Tech:</strong> {project.techStack}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Event Registrations</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{registrations.length} event{registrations.length !== 1 ? 's' : ''} registered</p>
                </div>
              </div>

              {registrations.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>You have not registered for any events yet.</p>
                  <Link to="/events" className="btn-primary" style={{ display: 'inline-block', padding: '10px 20px', textDecoration: 'none' }}>
                    Browse Events
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {registrations.map((reg, idx) => (
                    <div key={`${reg.eventId}-${idx}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{reg.eventName || reg.name || `Event ID: ${reg.eventId}`}</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          Registered: {reg.registrationTimestamp ? new Date(reg.registrationTimestamp).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div
                        style={{
                          padding: '8px 14px',
                          background: getStatusBg(reg.registrationStatus || reg.status),
                          color: getStatusColor(reg.registrationStatus || reg.status),
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          textTransform: 'capitalize',
                        }}
                      >
                        {reg.registrationStatus || reg.status || 'confirmed'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default UserDashboard;
