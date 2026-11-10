import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { siteConfig, publicNav, siteImages } from '../config/siteConfig';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="public-navbar">
      <div className="container public-navbar-inner">
        <Link to="/" className="public-brand" onClick={() => setOpen(false)}>
          <img src={siteImages.logo} alt={`${siteConfig.name} logo`} onError={(e) => (e.currentTarget.style.display = 'none')} />
          {siteConfig.name}
        </Link>

        <nav className={`public-nav-links ${open ? 'open' : ''}`} aria-label="Main navigation">
          {publicNav.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
          ))}
        </nav>

        <div className="public-nav-actions">
          {isAuthenticated ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/app/dashboard')}>Go to Dashboard</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/login')}>Log in</Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/register')}>Register</Button>
            </>
          )}
          <button className="mobile-menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
}
