import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Users, Trophy, Calendar } from 'lucide-react';
import TeamMembersManager from '../components/TeamMembersManager';

const Hero3D = lazy(() => import('../components/Hero3D'));

const stats = [
  { label: 'Members', value: '200+', icon: <Users size={22} /> },
  { label: 'Events Held', value: '35+', icon: <Calendar size={22} /> },
  { label: 'Projects Built', value: '50+', icon: <Zap size={22} /> },
  { label: 'Awards Won', value: '10+', icon: <Trophy size={22} /> },
];

const featureCards = [
  { emoji: '🚀', title: 'Real Projects', desc: 'Build portfolio-worthy apps and contribute to open source.' },
  { emoji: '🎓', title: 'Workshops & Bootcamps', desc: 'Learn React, Python, DevOps, and more from senior students.' },
  { emoji: '🏆', title: 'Hackathons', desc: 'Compete in inter-college and national hackathons as a team.' },
  { emoji: '🤝', title: 'Network', desc: 'Connect with developers, mentors, and industry professionals.' },
  { emoji: '⚡', title: 'Skill Analyzer', desc: 'Get your guild level assessed by our AI-powered skill analyzer.' },
  { emoji: '🌐', title: 'Open Source', desc: 'Contribute to real-world projects and build your GitHub profile.' },
];

const Home = () => {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();

  return (
    <div className="ambient-bg">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ minHeight: 'calc(100vh - 64px)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {/* 3D background visual */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <Suspense fallback={<div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 75% 25%, rgba(59,130,246,0.18), transparent 45%)' }} />}>
            <Hero3D />
          </Suspense>
        </div>

        {/* Gradient overlay so text reads well on both modes */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, var(--hero-overlay-solid) 36%, var(--hero-overlay-soft) 55%, transparent 80%)'
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 2rem', maxWidth: '700px', marginLeft: '5%' }}
          className="animate-fadein">
          <div className="inline-block mb-5 px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.3)' }}>
            🏛️ Accurate Institute of Management and Technology
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontFamily: 'Outfit, sans-serif', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.25rem', color: 'var(--text-color)' }}>
            Code.<br />
            <span className="text-gradient">Innovate.</span><br />
            Elevate.
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '520px', lineHeight: 1.7, marginBottom: '2rem' }}>
            The Developers' Guild is AIMT's premier coding club — where students build real projects, level up their skills, and win hackathons together.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {user ? (<Link to="/dashboard" className="btn-primary" style={{ fontSize: '1rem', padding: '12px 28px' }}>Already Joined - Dashboard</Link>) : (<Link to="/register" className="btn-primary" style={{ fontSize: '1rem', padding: '12px 28px' }}>
              Join the Guild
              </Link>
              )}
            <Link to="/events" className="btn-outline" style={{ fontSize: '1rem', padding: '12px 28px' }}>
              Browse Events
            </Link>
            <Link to="/projects" className="btn-outline pulse-soft" style={{ fontSize: '1rem', padding: '12px 28px' }}>
              Explore Projects
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section style={{ padding: '4rem 2rem', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          {stats.map(s => (
            <div key={s.label} className="glass-panel animate-fadein interactive-glow-card" style={{ padding: '1.75rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-color)' }}>{s.value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature Highlights ───────────────────────────────── */}
      <section style={{ padding: '3rem 2rem 5rem', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-color)' }}>
            Why Join the Guild?
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem' }}>
            Everything you need to grow as a developer — in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {featureCards.map(f => (
              <div key={f.title} className="glass-panel animate-fadein interactive-glow-card" style={{ padding: '1.75rem', transition: 'transform 0.2s' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.emoji}</div>
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-color)' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 2rem 2rem', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <TeamMembersManager
            compact
            title="Team Spotlight"
            subtitle="Visible on Home. Admin and sub admin can manage members from this section."
          />
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.2rem', fontFamily: 'Outfit, sans-serif', fontWeight: 900, marginBottom: '1rem', color: 'var(--text-color)' }}>
            Ready to level up?
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem' }}>
            Join hundreds of students at AIMT who are already building the future.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn-primary pulse-soft" style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
              Get Started - It's Free
            </Link>
            <Link to="/team" className="btn-outline" style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
              Meet The Team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

