import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { useLanguage } from './LanguageContext';
import { Moon, Sun, Menu, X, LogOut, Code2 } from 'lucide-react';

const Navbar = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { language, setLanguage, highContrast, setHighContrast, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();

  const adminSession = (() => {
    try { return JSON.parse(localStorage.getItem('adminSession')); }
    catch { return null; }
  })();

  // DEBUG: Show adminSession in console
  console.log('adminSession:', adminSession);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSession');
    setProfileOpen(false);
    navigate('/');
    setMenuOpen(false);
  };

  const profileInitial = (adminSession ? 'A' : (user?.name?.trim()?.charAt(0) || 'U')).toUpperCase();

  let navLinks = [
    { to: '/', label: t('home') },
    { to: '/events', label: t('events') },
    { to: '/projects', label: t('projects') },
    { to: '/team', label: t('team') },
    { to: '/contact', label: t('contact') },
    { to: '/about', label: t('about') },
  ];
  // Add Admin Dashboard link if adminSession is present
  if (adminSession) {
    navLinks = [
      ...navLinks,
      { to: '/admin', label: t('adminDashboard') || 'Admin Dashboard' },
    ];
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
      style={{ borderColor: 'var(--card-border)', background: 'var(--nav-bg)', boxShadow: 'var(--nav-shadow)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" onClick={() => setMenuOpen(false)}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <Code2 size={16} color="white" />
            </div>
            <span className="text-xl font-black font-outfit tracking-tight">
              Dev<span className="text-gradient">Guild</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium transition-colors hover:text-[var(--primary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="form-input"
              aria-label={t('language')}
              style={{ width: '78px', padding: '6px 8px', fontSize: '0.78rem' }}
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>

            <button
              onClick={() => setHighContrast(prev => !prev)}
              className="btn-outline"
              style={{ padding: '6px 10px', fontSize: '0.76rem' }}
              aria-label={`${t('contrast')}: ${highContrast ? t('high') : t('low')}`}
            >
              {t('contrast')}: {highContrast ? t('high') : t('low')}
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user || adminSession ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(prev => !prev)}
                  className="w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold"
                  style={{
                    borderColor: 'var(--card-border)',
                    color: 'white',
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))'
                  }}
                  aria-label="Open profile menu"
                >
                  {user?.profilePhoto && !adminSession ? (
                    <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }} />
                  ) : (
                    profileInitial
                  )}
                </button>

                {profileOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 glass-panel p-2"
                    style={{ zIndex: 60 }}
                  >
                    <div className="px-2 py-2 text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
                      {adminSession ? 'Admin Account' : user?.name}
                    </div>
                    <div className="px-2 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {adminSession ? 'Administrator' : user?.email}
                    </div>
                    <hr style={{ borderColor: 'var(--card-border)' }} />
                    <div className="flex flex-col gap-1 mt-2">
                      <Link
                        to={adminSession ? '/admin' : '/dashboard'}
                        onClick={() => setProfileOpen(false)}
                        className="text-sm py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        {adminSession ? t('adminDashboard') : t('dashboard')}
                      </Link>
                      {!adminSession && (
                        <Link
                          to="/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="text-sm py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          {t('editProfile')}
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="text-sm py-2 px-3 rounded-lg text-left"
                        style={{ color: '#ef4444' }}
                      >
                        <LogOut size={14} className="inline mr-1.5" /> {t('logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-semibold transition-colors hover:text-[var(--primary)]" style={{ color: 'var(--text-muted)', padding: '6px 12px' }}>
                  {t('login')}
                </Link>
                <Link to="/register" className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
                  {t('joinGuild')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="form-input"
              aria-label={t('language')}
              style={{ width: '64px', padding: '5px 6px', fontSize: '0.75rem' }}
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>
            <button onClick={toggleTheme} className="p-2 rounded-full" style={{ color: 'var(--text-muted)' }}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-full" style={{ color: 'var(--text-color)' }} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden glass-panel mx-4 mb-4 p-4 flex flex-col gap-4">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
              className="font-semibold text-sm py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              {link.label}
            </Link>
          ))}
          <hr style={{ borderColor: 'var(--card-border)' }} />
          {user || adminSession ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 py-1 px-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ color: 'white', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
                >
                  {user?.profilePhoto && !adminSession ? (
                    <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }} />
                  ) : (
                    profileInitial
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
                    {adminSession ? 'Admin Account' : user?.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {adminSession ? 'Administrator' : user?.email}
                  </div>
                </div>
              </div>
              <Link
                to={adminSession ? '/admin' : '/dashboard'}
                onClick={() => setMenuOpen(false)}
                className="btn-outline text-sm text-center"
              >
                {adminSession ? t('adminDashboard') : t('dashboard')}
              </Link>
              {!adminSession && (
                <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="btn-outline text-sm text-center">
                  {t('editProfile')}
                </Link>
              )}
              <button onClick={handleLogout} className="btn-outline text-sm w-full">
                <LogOut size={14} className="mr-1.5" /> {t('logout')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-outline text-sm text-center">{t('login')}</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm text-center">{t('joinGuild')}</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
