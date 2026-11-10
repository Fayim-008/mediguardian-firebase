import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button, EmptyState, LoadingState, ErrorState, Badge } from '../components/ui';
import { notifications } from '../services/boxService';
import { fmtDateTime } from '../services/medicineService';
import { useApi } from '../hooks/useApi';

const TONE = { info: 'info', warning: 'warning', danger: 'danger', success: 'success' };
export default function Notifications() {
  const { data, error, loading, reload } = useApi(() => notifications.list(false), [], { live: true });
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <>
      <div className="page-head">
        <div><h1>Notifications</h1><p className="mb-0">In-app alerts about doses, boxes and stock. Email/SMS/push are not sent unless the server administrator configures a provider.</p></div>
        <div className="actions"><Button variant="outline" icon={CheckCheck} onClick={async () => { await notifications.markRead(); reload(); }}>Mark all read</Button></div>
      </div>
      {data.length === 0 ? (
        <div className="card list-panel-empty"><EmptyState icon={Bell} title="Nothing to report" message="Alerts appear here when a dose is overdue or missed, a box goes offline, or stock runs low." /></div>
      ) : (
        <div className="card list-panel">{data.map((n) => (
          <div className="alert-item" key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
            <div className="alert-body">
              <div className="alert-title">{n.title} <Badge tone={TONE[n.severity] || 'neutral'}>{n.type.replace(/_/g, ' ')}</Badge></div>
              <div className="alert-sub">{n.patientName ? `${n.patientName} · ` : ''}{n.body} · {fmtDateTime(n.createdAt)}</div>
            </div>
          </div>))}</div>
      )}
    </>
  );
}
