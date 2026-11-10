import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal, Button, Input, Select, Textarea } from './ui';
import { createMedicine, updateMedicine, MEDICINE_TYPES, DOSE_OPTIONS } from '../services/medicineService';
import { getPatientBoxes } from '../services/patientService';
import { useToast } from '../context/ToastContext';
import { friendlyError } from '../services/errors';

const emptyForm = {
  patientId: '', name: '', type: 'Tablet', dose: '1 Tablet', quantity: '', unit: 'tablets', lowStockThreshold: 6, drawerId: '',
  scheduleType: 'times', times: ['08:00'], everyHours: 8, anchor: '08:00',
  startDate: '', endDate: '', instructions: '', mealTiming: 'After meal', notes: '',
};

function fromMedicine(m) {
  const s = m.schedule || { type: 'times', times: ['08:00'] };
  return {
    ...emptyForm, patientId: m.patientId, name: m.name, type: m.type, dose: m.dose || '1 Tablet', quantity: m.quantity, unit: m.unit,
    lowStockThreshold: m.lowStockThreshold, drawerId: m.drawerId || '', startDate: m.startDate || '', endDate: m.endDate || '',
    instructions: m.instructions, mealTiming: m.mealTiming || 'No restriction', notes: m.notes,
    scheduleType: s.type, times: s.type === 'times' ? s.times : ['08:00'], everyHours: s.everyHours || 8, anchor: s.anchor || '08:00',
  };
}

export default function MedicineFormModal({ open, onClose, medicine, patients, defaultPatientId, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const { push } = useToast();

  useEffect(() => {
    if (open) {
      setForm(medicine ? fromMedicine(medicine) : { ...emptyForm, patientId: defaultPatientId || '' });
      setErrors({});
    }
  }, [open, medicine, defaultPatientId]);

  // Drawers can only come from boxes paired with THIS patient.
  useEffect(() => {
    if (!open || !form.patientId) { setBoxes([]); return; }
    getPatientBoxes(form.patientId).then(setBoxes).catch(() => setBoxes([]));
  }, [open, form.patientId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setTime = (idx, value) => setForm((f) => ({ ...f, times: f.times.map((t, i) => (i === idx ? value : t)) }));
  const drawerOptions = boxes.flatMap((b) => b.drawers.map((d) => ({ value: d.id, label: `${b.label || `Box …${b.boxCode.slice(-4)}`}${b.simulated ? ' (simulated)' : ''} — ${d.slot}. ${d.name}` })));

  const validate = () => {
    const errs = {};
    if (!form.patientId) errs.patientId = 'Select a patient.';
    if (!form.name.trim()) errs.name = 'Medicine name is required.';
    if (form.quantity === '' || Number(form.quantity) < 0) errs.quantity = 'Enter a valid quantity.';
    if (form.scheduleType === 'times' && (form.times.filter(Boolean).length === 0)) errs.times = 'Add at least one reminder time.';
    if (form.scheduleType === 'interval' && (!(Number(form.everyHours) >= 1) || !form.anchor)) errs.times = 'Enter the interval and the first dose time.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) errs.endDate = 'End date is before the start date.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const opt = DOSE_OPTIONS.find((d) => d.label === form.dose);
      const payload = {
        name: form.name.trim(), type: form.type, dose: form.dose, doseQuantity: opt?.quantity ?? 1, unit: form.unit,
        quantity: Number(form.quantity), lowStockThreshold: Number(form.lowStockThreshold),
        drawerId: form.drawerId || null, startDate: form.startDate || null, endDate: form.endDate || null,
        instructions: form.instructions, mealTiming: form.mealTiming, notes: form.notes,
        schedule: form.scheduleType === 'times'
          ? { type: 'times', times: form.times.filter(Boolean) }
          : { type: 'interval', everyHours: Number(form.everyHours), anchor: form.anchor },
      };
      if (medicine) await updateMedicine(medicine.id, payload); else await createMedicine(form.patientId, payload);
      push('success', 'Medicine saved. The box picks up the new settings the next time it syncs.');
      onSaved?.(); onClose();
    } catch (err) {
      push('error', friendlyError(err, 'Could not save medicine.'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={medicine ? 'Edit Medicine' : 'Set Medicine'} wide
      footer={(<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Medicine'}</Button></>)}>
      <div className="form-grid">
        <Select id="m-patient" label="Select Patient" placeholder="Choose a patient" options={patients.map((p) => ({ value: p.id, label: p.name }))}
          value={form.patientId} onChange={set('patientId')} error={errors.patientId} disabled={!!medicine} />
        <Input id="m-name" label="Medicine Name" placeholder="e.g. NAPA Extra" value={form.name} onChange={set('name')} error={errors.name} />
      </div>
      <div className="form-grid">
        <Select id="m-type" label="Medicine Type" options={MEDICINE_TYPES} value={form.type} onChange={set('type')} />
        <Select id="m-dose" label="Dose per time" options={DOSE_OPTIONS.map((d) => d.label)} value={form.dose} onChange={set('dose')} />
      </div>
      <div className="form-grid">
        <Input id="m-qty" label={medicine ? 'Estimated quantity (editing logs an adjustment)' : 'Quantity placed in the drawer'} type="number" min="0" step="0.5" value={form.quantity} onChange={set('quantity')} error={errors.quantity} />
        <Input id="m-low" label="Low-stock warning at" type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} />
      </div>
      <Select id="m-drawer" label="Drawer" placeholder={form.patientId ? (drawerOptions.length ? 'Not linked to a drawer' : 'No box paired with this patient yet') : 'Select a patient first'}
        options={drawerOptions} value={form.drawerId} onChange={set('drawerId')} hint="Morning, Noon and Night are presets; Extra suits unusual or interval schedules. A drawer can hold several medicines." />

      <div className="field">
        <label>Schedule</label>
        <Select id="m-stype" options={[{ value: 'times', label: 'Fixed times each day' }, { value: 'interval', label: 'Every N hours (e.g. 3, 8, 12)' }]} value={form.scheduleType} onChange={set('scheduleType')} wrapperClassName="mb-0" />
      </div>
      {form.scheduleType === 'times' ? (
        <div className="field">
          <label>Reminder time(s) — patient's local time</label>
          {form.times.map((t, idx) => (
            <div key={idx} className="flex-gap" style={{ marginBottom: 10 }}>
              <input className="input" type="time" value={t} onChange={(e) => setTime(idx, e.target.value)} />
              {form.times.length > 1 && (<button type="button" className="btn btn-ghost btn-icon" onClick={() => setForm((f) => ({ ...f, times: f.times.filter((_, i) => i !== idx) }))} aria-label="Remove reminder time"><X size={15} /></button>)}
            </div>
          ))}
          {errors.times && <div className="error-text">{errors.times}</div>}
          <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, times: [...f.times, ''] }))}>Add More Reminder Time</Button>
        </div>
      ) : (
        <div className="form-grid">
          <Input id="m-every" label="Repeat every (hours)" type="number" min="1" max="24" value={form.everyHours} onChange={set('everyHours')} error={errors.times} />
          <div className="field"><label>First dose of the day (local time)</label><input className="input" type="time" value={form.anchor} onChange={set('anchor')} /></div>
        </div>
      )}
      <div className="form-grid">
        <Select id="m-meal" label="Before/After Meal" options={['Before meal', 'After meal', 'With meal', 'No restriction']} value={form.mealTiming} onChange={set('mealTiming')} />
        <Input id="m-instructions" label="Instructions" placeholder="e.g. After Breakfast" value={form.instructions} onChange={set('instructions')} />
      </div>
      <div className="form-grid">
        <Input id="m-start" label="Start Date" type="date" value={form.startDate} onChange={set('startDate')} />
        <Input id="m-end" label="End Date (optional)" type="date" value={form.endDate} onChange={set('endDate')} error={errors.endDate} />
      </div>
      <Textarea id="m-notes" label="Notes" rows={3} value={form.notes} onChange={set('notes')} />
      <p className="hint">MediGuardian records the schedule you or the clinician set. It does not recommend or change doses.</p>
    </Modal>
  );
}
