import React, { useEffect, useState } from 'react';
import TeamMembersManager from '../components/TeamMembersManager';

const About = () => {
  const [aboutContent, setAboutContent] = useState({
    aboutTitle: "About The Developers' Guild",
    aboutIntro: 'We are the official coding club of Accurate Institute of Management and Technology (AIMT), Greater Noida. Founded to bridge the gap between classroom learning and industry-ready skills.',
    aboutMission: 'To create a thriving ecosystem where students at AIMT can learn cutting-edge technologies, collaborate on meaningful projects, participate in competitive programming, and develop the skills needed to excel in the technology industry.',
  });

  useEffect(() => {
    const loadAboutContent = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/content-settings');
        if (!res.ok) return;
        const data = await res.json();
        setAboutContent({
          aboutTitle: data?.aboutTitle || "About The Developers' Guild",
          aboutIntro: data?.aboutIntro || 'We are the official coding club of Accurate Institute of Management and Technology (AIMT), Greater Noida. Founded to bridge the gap between classroom learning and industry-ready skills.',
          aboutMission: data?.aboutMission || 'To create a thriving ecosystem where students at AIMT can learn cutting-edge technologies, collaborate on meaningful projects, participate in competitive programming, and develop the skills needed to excel in the technology industry.',
        });
      } catch {
        // Keep defaults when API is unavailable.
      }
    };

    loadAboutContent();
  }, []);

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-color)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 2.8rem)', marginBottom: '1rem', color: 'var(--text-color)' }}>
            <span className="text-gradient">{aboutContent.aboutTitle}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto', lineHeight: 1.7, fontSize: '1.05rem' }}>
            {aboutContent.aboutIntro}
          </p>
        </div>

        {/* Mission */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', marginBottom: '1rem', color: 'var(--text-color)' }}>🎯 Our Mission</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.75 }}>
            {aboutContent.aboutMission}
          </p>
        </div>

        {/* Team */}
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-color)' }}>
          👥 Our Team
        </h2>
        <TeamMembersManager
          title="Our Team"
          subtitle="Super admin and sub admin can edit the full team list shown on About, Team, and Home pages."
          compact
        />
      </div>
    </div>
  );
};

export default About;
