import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ArrowRight, ShieldCheck, HeartPulse } from 'lucide-react';
import { Button } from '../components/ui';
import { siteConfig, howItWorksSteps, featureList, teamConfig } from '../config/siteConfig';
import { getInitials } from '../services/patientService';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <>
      {/* HERO */}
      <section className="hero" id="home">
        <div className="container">
          <div>
            <span className="hero-eyebrow"><ShieldCheck size={14} /> Smart medicine cabinet + caregiver dashboard</span>
            <h1>{siteConfig.tagline}, <span className="accent">not beyond care.</span></h1>
            <p className="lead">{siteConfig.subTagline}. {siteConfig.description}</p>
            <div className="hero-actions">
              <Button variant="primary" icon={ArrowRight} iconRight onClick={() => navigate('/register')}>Get Started Free</Button>
              <Button variant="outline" style={{ borderColor: 'rgba(255,255,255,.35)', color: '#fff' }} onClick={() => navigate('/login')}>I already have an account</Button>
            </div>
            <div className="hero-stats">
              <div className="stat"><b>3</b><span>Patients tracked in demo</span></div>
              <div className="stat"><b>24/7</b><span>Reminder monitoring</span></div>
              <div className="stat"><b>1 / 7 / 30</b><span>Day adherence reports</span></div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div className="cabinet-glow" />
            <div className="cabinet-art">
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How MediGuardian works</span>
            <h2>Simple. Smart. Reliable.</h2>
          </div>
          <div className="grid-3">
            {howItWorksSteps.map((step, i) => (
              <div className="card step-card" key={step.title}>
                <div className="step-num">{i + 1}</div>
                <h3 style={{ fontSize: '1rem' }}>{step.title}</h3>
                <p style={{ fontSize: '.88rem' }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SMART CABINET */}
      <section className="section section-alt">
        <div className="container">
          <div className="two-col" style={{ alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--primary-700)', fontWeight: 700, fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Introducing the first model of</span>
              <h2 style={{ marginTop: 8 }}>Innovative Medicine Cabinet</h2>
              <p>Three individually-lit drawers, each mapped to a patient's medicine — the cabinet lights the right drawer, at the right time, and reports back the moment it's opened.</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                {['Drawer 1 · Rahela Begum', 'Drawer 2 · Abdur Rahman', 'Drawer 3 · Nasrin Khatun'].map((d) => (
                  <li key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.9rem', color: 'var(--text-muted)' }}>
                    <HeartPulse size={16} color="var(--primary-600)" /> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="cabinet-art" style={{ background: 'var(--navy)', padding: 30, borderRadius: 24 }}>
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
              <div className="cabinet-drawer"><div className="bar" /><span className="dot" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why families choose MediGuardian</span>
            <h2>Everything a caregiver needs, nothing they don't</h2>
          </div>
          <div className="grid-3">
            {featureList.map((f) => {
              const Icon = Icons[f.icon] || Icons.Circle;
              return (
                <div className="feature-card" key={f.title}>
                  <div className="icon-wrap"><Icon size={22} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="section section-alt" id="team">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Meet with our</span>
            <h2>Honorable Team</h2>
          </div>
          <div className="grid-4">
            {teamConfig.map((member) => (
              <div className="card team-card" key={member.email}>
                <div className="team-avatar">{getInitials(member.name)}</div>
                <h4>{member.name}</h4>
                <div className="role">{member.role}</div>
                <div className="mail">{member.email}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-tight">
        <div className="container">
          <div className="card card-pad" style={{ textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-600), var(--navy))', color: '#fff', border: 'none' }}>
            <h2 style={{ color: '#fff' }}>Your parents are safe with {siteConfig.name}</h2>
            <p style={{ color: '#DCE8FF', maxWidth: 480, margin: '0 auto 22px' }}>Create your free guardian account and add your first patient in under two minutes.</p>
            <Button variant="secondary" icon={ArrowRight} iconRight onClick={() => navigate('/register')}>Create Free Account</Button>
          </div>
        </div>
      </section>
    </>
  );
}
