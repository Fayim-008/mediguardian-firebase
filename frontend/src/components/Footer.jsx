import React from 'react';
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { siteConfig, contactConfig, siteImages, publicNav } from '../config/siteConfig';

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="foot-grid">
          <div>
            <div className="public-brand" style={{ color: '#fff', marginBottom: 14 }}>
              <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
              {siteConfig.name}
            </div>
            <p style={{ color: '#9FB6E3', fontSize: '.86rem', maxWidth: 260 }}>{siteConfig.description}</p>
          </div>

          <div>
            <h4>Navigate</h4>
            <ul>
              {publicNav.map((item) => (
                <li key={item.href}><a href={item.href}>{item.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Contact Information</h4>
            <ul>
              <li><MapPin size={15} /> {contactConfig.teamName}, {contactConfig.department}<br />{contactConfig.university}</li>
              <li><Phone size={15} /> {contactConfig.phone}</li>
              <li><Mail size={15} /> {contactConfig.email}</li>
            </ul>
          </div>

          <div>
            <h4>Location</h4>
            <ul>
              <li><MapPin size={15} /> {contactConfig.location}</li>
            </ul>
            <h4 style={{ marginTop: 18 }}>Follow Us</h4>
            <div className="social-row">
              <a href={contactConfig.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={16} /></a>
              <a href={contactConfig.social.twitter} target="_blank" rel="noreferrer" aria-label="Twitter"><Twitter size={16} /></a>
              <a href={contactConfig.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /></a>
              <a href={contactConfig.social.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={16} /></a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {siteConfig.name} · {contactConfig.teamName}</span>
          <span>{siteConfig.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
