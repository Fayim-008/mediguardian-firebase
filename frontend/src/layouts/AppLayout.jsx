import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Menu, FlaskConical } from 'lucide-react';
import { LoadingState } from '../components/ui';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useDemoMode } from '../hooks/useDemoMode';
import { appNav } from '../config/siteConfig';

export default function AppLayout() {
  const { isAuthenticated, user, booting } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { demoMode, toggleDemoMode, devToolsAvailable } = useDemoMode();

  if (booting) return <div style={{ padding: 60 }}><LoadingState message="Checking your session…" /></div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const currentLabel = appNav.find((n) => location.pathname.startsWith(n.path))?.label || 'Dashboard';

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="app-topbar">
          <div className="flex-gap">
            <button
              className="btn btn-ghost btn-icon mobile-menu-trigger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{currentLabel}</h2>
          </div>
          <div className="flex-gap">
            {devToolsAvailable && (
              <button
                className={`btn btn-sm ${demoMode ? 'btn-primary' : 'btn-outline'}`}
                onClick={toggleDemoMode}
                title="Shows simulator controls. They only ever act on SIMULATED boxes, never on real hardware."
              >
                <FlaskConical size={14} /> Simulator {demoMode ? 'On' : 'Off'}
              </button>
            )}
          </div>
        </header>
        <div className="app-content">
          <Outlet context={{ user, demoMode }} />
        </div>
      </div>
    </div>
  );
}
