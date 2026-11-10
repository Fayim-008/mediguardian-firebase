import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Pill } from 'lucide-react';
import { Button, EmptyState, ConfirmDialog, LoadingState, ErrorState } from '../components/ui';
import MedicineCard from '../components/MedicineCard';
import MedicineFormModal from '../components/MedicineFormModal';
import { getPatients } from '../services/patientService';
import { getMedicines, deleteMedicine, toggleMedicineActive } from '../services/medicineService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

export default function SetMedicine() {
  const location = useLocation();
  const { push } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [defaultPatientId, setDefaultPatientId] = useState(location.state?.patientId || '');
  const { data, error, loading, reload } = useApi(() => Promise.all([getPatients(), getMedicines()]), [], { live: true });
  const [patients, medicines] = data || [[], []];

  useEffect(() => {
    if (!data) return;
    if (location.state?.editMedicineId) {
      const med = medicines.find((m) => m.id === location.state.editMedicineId);
      if (med) { setEditing(med); setFormOpen(true); }
    } else if (location.state?.patientId) { setDefaultPatientId(location.state.patientId); setFormOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const patientName = (pid) => patients.find((p) => p.id === pid)?.name || 'Unknown patient';

  const handleDelete = async () => {
    try { await deleteMedicine(toDelete.id); push('info', `${toDelete.name} was removed. Past doses stay in the history.`); } catch (e) { push('error', e); }
    setToDelete(null); reload();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Set Medicine</h1><p className="mb-0">Add a new medicine schedule or manage what's already set.</p></div>
        <div className="actions">
          <Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setDefaultPatientId(''); setFormOpen(true); }} disabled={patients.length === 0}>Set Medicine</Button>
        </div>
      </div>
      {patients.length === 0 ? (
        <div className="card list-panel-empty"><EmptyState icon={Pill} title="Add a patient first" message="You need at least one patient before you can set a medicine." /></div>
      ) : (
        <div className="card list-panel">
          <div className="section-card-head"><h3>Already Set</h3></div>
          <div style={{ padding: medicines.length ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {medicines.length === 0 ? (
              <EmptyState icon={Pill} title="No medicines set yet" message="Use “Set Medicine” above to add the first one." />
            ) : medicines.map((m) => (
              <MedicineCard key={m.id} medicine={m} patientName={patientName(m.patientId)}
                onEdit={(med) => { setEditing(med); setFormOpen(true); }} onDelete={(med) => setToDelete(med)}
                onToggleActive={async (med) => { try { await toggleMedicineActive(med); reload(); } catch (e) { push('error', e); } }} />
            ))}
          </div>
        </div>
      )}
      <MedicineFormModal open={formOpen} onClose={() => setFormOpen(false)} medicine={editing} patients={patients} defaultPatientId={defaultPatientId} onSaved={reload} />
      <ConfirmDialog open={!!toDelete} title="Remove this medicine?" message={`${toDelete?.name} will stop being scheduled. Its past doses and stock history are kept for reports.`}
        confirmLabel="Remove Medicine" onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </>
  );
}
