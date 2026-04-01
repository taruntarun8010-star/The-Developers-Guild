import React from 'react';
import TeamMembersManager from '../components/TeamMembersManager';

const Team = () => {
  return (
    <div className="ambient-bg" style={{ minHeight: 'calc(100vh - 64px)', padding: '3rem 1.5rem', background: 'var(--bg-color)' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div className="animate-fadein" style={{ textAlign: 'center', marginBottom: '2.3rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, color: 'var(--text-color)' }}>
            Meet The <span className="text-gradient">Guild Team</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.7rem' }}>
            Student leaders and mentors powering coding culture at AIMT.
          </p>
        </div>
        <TeamMembersManager
          title="Guild Team Members"
          subtitle="Super admin and sub admin can add, edit, and remove team members from here."
        />
      </div>
    </div>
  );
};

export default Team;
