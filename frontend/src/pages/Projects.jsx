import React, { useEffect, useState } from 'react';
import { Code2, ExternalLink, FolderKanban } from 'lucide-react';

const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '');

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/projects`)
      .then(r => r.json())
      .then(data => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ambient-bg" style={{ minHeight: 'calc(100vh - 64px)', padding: '3rem 1.5rem', background: 'var(--bg-color)' }}>
      <div style={{ maxWidth: '1150px', margin: '0 auto' }}>
        <div className="animate-fadein" style={{ textAlign: 'center', marginBottom: '2.4rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.9rem)', fontWeight: 900, color: 'var(--text-color)', marginBottom: '0.7rem' }}>
            Guild <span className="text-gradient">Project Tracks</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto', lineHeight: 1.7 }}>
            Choose your path, join a team, and ship practical products that stand out in internships and placements.
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.6rem', textAlign: 'center' }}>
            <FolderKanban size={22} style={{ marginBottom: '0.6rem', color: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No projects published yet. Ask admin to add showcase projects.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem' }}>
            {projects.map((project, i) => (
              <div
                key={project.id}
                className="glass-panel animate-fadein"
                style={{ padding: '1.5rem', transition: 'transform 0.2s', animationDelay: `${i * 80}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                  <h3 style={{ fontWeight: 800, fontSize: '1.12rem', color: 'var(--text-color)' }}>{project.title}</h3>
                  <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(59,130,246,0.14)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem' }}>
                    {project.status || 'In Progress'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, fontSize: '0.92rem', marginBottom: '0.8rem' }}>{project.summary}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  Tech: <strong style={{ color: 'var(--text-color)' }}>{project.techStack}</strong>
                </p>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                  {project.githubUrl && (
                    <a href={project.githubUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '8px 12px' }}>
                      <Code2 size={14} style={{ marginRight: '5px' }} /> GitHub
                    </a>
                  )}
                  {project.demoUrl && (
                    <a href={project.demoUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '8px 12px' }}>
                      <ExternalLink size={14} style={{ marginRight: '5px' }} /> Live Demo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
