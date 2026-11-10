import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Eye, Edit2, Trash2, Power, Search } from 'lucide-react';
import { Button, Input, EmptyState, ConfirmDialog, LoadingState, ErrorState } from '../components/ui';
import PatientFormModal from '../components/PatientFormModal';
import { getPatients, deletePatient, toggleDeactivate, getInitials, calculateAge } from '../services/patientService';
import { buildReport } from '../services/reportService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

function Adherence({ id }) {
  const { data } = useApi(() => buildReport(id, '7D'), [id], { live: true });
  const a = data?.percentages.adherence ?? 0;
  return (<><div className="adherence-bar"><div className="adherence-bar-fill" style={{ width: `${a}%` }} /></div><div className="p-foot"><span>{data ? `${a}% this week` : '…'}</span></div></>);
}

export default function Patients() {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const navigate = useNavigate();
  const { push } = useToast();
  const { data: patients, error, loading, reload } = useApi(getPatients, [], { live: true });
  if (loading && !patients) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const handleDelete = async () => {
    try { await deletePatient(toDelete.id); push('info', `${toDelete.name} was removed. Their box was unpaired.`); } catch (e) { push('error', e); }
    setToDelete(null); reload();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Patients</h1><p className="mb-0">Manage every patient MediGuardian is caring for.</p></div>
        <div className="actions"><Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Add Patient</Button></div>
      </div>
      <div className="card card-pad" style={{ marginBottom: 22, maxWidth: 360 }}>
        <Input id="search-patients" placeholder="Search patients…" icon={Search} wrapperClassName="mb-0" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="card list-panel-empty">
          <EmptyState icon={Users} title={patients.length === 0 ? 'No patients added yet.' : 'No patients match your search.'}
            message={patients.length === 0 ? 'Add your first patient to get started.' : 'Try a different name.'}
            action={patients.length === 0 && <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>+ Add Patient</Button>} />
        </div>
      ) : (
        <div className="patient-grid">
          {filtered.map((p) => {
            const age = calculateAge(p.dob);
            return (
              <div className="card patient-card" key={p.id}>
                <div className="patient-card-top">
                  <div className="patient-avatar">{getInitials(p.name)}</div>
                  <div style={{ minWidth: 0 }}><div className="p-name">{p.name}</div><div className="p-rel">{p.relationship}{age ? ` · ${age} yrs` : ''} · {p.status}</div></div>
                </div>
                <Adherence id={p.id} />
                <div className="flex-gap" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" title="View patient" onClick={() => navigate(`/app/patients/${p.id}`)}><Eye size={15} /></button>
                  <button className="btn btn-ghost btn-icon" title="Edit patient" onClick={() => { setEditing(p); setFormOpen(true); }}><Edit2 size={15} /></button>
                  <button className="btn btn-ghost btn-icon" title={p.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={async () => { try { await toggleDeactivate(p); reload(); } catch (e) { push('error', e); } }}><Power size={15} /></button>
                  <button className="btn btn-ghost btn-icon" title="Delete patient" onClick={() => setToDelete(p)}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PatientFormModal open={formOpen} onClose={() => setFormOpen(false)} patient={editing} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Delete this patient?" message={`This permanently removes ${toDelete?.name}, their medicines and history, and unpairs their box. This can't be undone. (Use Deactivate to keep the history.)`}
        confirmLabel="Delete Patient" onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </>
  );
}
