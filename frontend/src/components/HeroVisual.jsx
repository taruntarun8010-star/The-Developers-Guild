import React from 'react';
import { Sparkles, Code2, Rocket } from 'lucide-react';

const HeroVisual = () => {
  return (
    <div className="hero-visual-shell" aria-hidden="true">
      <div className="hero-aura hero-aura-blue" />
      <div className="hero-aura hero-aura-violet" />
      <div className="hero-aura hero-aura-cyan" />

      <div className="hero-orbit hero-orbit-lg" />
      <div className="hero-orbit hero-orbit-md" />
      <div className="hero-orbit hero-orbit-sm" />

      <div className="hero-float-card hero-float-card-top">
        <Sparkles size={16} />
        <span>Creative Builds</span>
      </div>

      <div className="hero-float-card hero-float-card-mid">
        <Code2 size={16} />
        <span>Clean Code</span>
      </div>

      <div className="hero-float-card hero-float-card-low">
        <Rocket size={16} />
        <span>Launch Fast</span>
      </div>

      <div className="hero-core-panel">
        <div className="hero-core-line">$ npm run build-future</div>
        <div className="hero-core-line">{'>'} mentors connected</div>
        <div className="hero-core-line">{'>'} projects shipped</div>
      </div>
    </div>
  );
};

export default HeroVisual;
