import React from 'react';
import { AlertTriangle, PackageX } from 'lucide-react';

export default function AlertCard({ icon: Icon = AlertTriangle, title, subtitle, action }) {
  return (
    <div className="alert-item">
      <div className="alert-icon"><Icon size={17} /></div>
      <div className="alert-body">
        <div className="alert-title">{title}</div>
        <div className="alert-sub">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

export { PackageX };
