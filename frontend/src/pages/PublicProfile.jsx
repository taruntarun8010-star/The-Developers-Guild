import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const PublicProfile = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/public/profile/${encodeURIComponent(slug || '')}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Profile not found.');
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  if (loading) {
    return <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center' }}>Loading profile...</div>;
  }

  if (error) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <div className="glass-panel" style={{ maxWidth: '620px', width: '100%', padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Public profile unavailable</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const themeTone = {
    default: 'linear-gradient(120deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18))',
    ocean: 'linear-gradient(120deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))',
    sunset: 'linear-gradient(120deg, rgba(249,115,22,0.2), rgba(236,72,153,0.2))',
    forest: 'linear-gradient(120deg, rgba(34,197,94,0.2), rgba(20,184,166,0.2))',
    midnight: 'linear-gradient(120deg, rgba(30,41,59,0.5), rgba(15,23,42,0.65))',
  };
  const headerBg = profile.profileBannerUrl
    ? `url(${profile.profileBannerUrl}) center/cover no-repeat`
    : (themeTone[profile.profileTheme] || themeTone.default);

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-color)', padding: '2rem 1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '1rem', height: '170px', borderRadius: '14px', background: headerBg, border: '1px solid var(--card-border)' }} />

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '86px', height: '86px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(59,130,246,0.2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.8rem' }}>
            {profile.profilePhoto ? <img src={profile.profilePhoto} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>{profile.name}</h1>
            <p style={{ color: 'var(--text-muted)' }}>{profile.collegeId || 'Student member'}</p>
          </div>
        </div>

        {profile.bio && (
          <p style={{ marginTop: '1rem', color: 'var(--text-color)', lineHeight: 1.6 }}>{profile.bio}</p>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {(profile.skills || []).map((skill) => (
            <span key={skill} style={{ padding: '6px 10px', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem' }}>
              {skill}
            </span>
          ))}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          {profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>GitHub</a>}
          {profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>LinkedIn</a>}
          {profile.portfolioUrl && <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: 'none' }}>Portfolio</a>}
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.7rem' }}>Student Projects</h2>
          {(profile.studentProjects || []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No public projects added yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {profile.studentProjects.map((p) => (
                <div key={p.id} style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.9rem' }}>
                  <h3 style={{ marginBottom: '0.3rem' }}>{p.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{p.summary}</p>
                  {p.techStack && <p style={{ marginTop: '0.3rem', fontSize: '0.84rem' }}><strong>Tech:</strong> {p.techStack}</p>}
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem' }}>
                    {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
                    {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noreferrer">Demo</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
