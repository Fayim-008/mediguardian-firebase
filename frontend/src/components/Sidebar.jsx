import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { X, LogOut } from 'lucide-react';
import { siteConfig, appNav, siteImages } from '../config/siteConfig';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../services/patientService';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    onClose?.();
    navigate('/login');
  };

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div>
            <div className="name">{siteConfig.name}</div>
            <div className="tag">{siteConfig.tagline}</div>
          </div>
          <button className="sidebar-close-btn btn-ghost" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Application navigation">
          {[...appNav, ...(user?.role === 'admin' ? [{ label: 'Box Registration', path: '/app/admin/boxes', icon: 'QrCode' }] : [])].map((item) => {
            const Icon = Icons[item.icon] || Icons.Circle;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{getInitials(user?.name || 'Guardian')}</div>
            <div className="info">
              <div className="u-name">{user?.name || 'Guardian'}</div>
              <div className="u-email">{user?.email || ''}</div>
            </div>
          </div>
          <button className="sidebar-link" onClick={handleLogout}>
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
