import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, Select, Textarea } from './ui';
import { createPatient, updatePatient, TIMEZONES } from '../services/patientService';
import { useToast } from '../context/ToastContext';
import { friendlyError } from '../services/errors';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONSHIPS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Spouse', 'Sibling', 'Other Relative', 'Patient (self)'];

const emptyForm = {
  name: '', relationship: '', dob: '', gender: 'Female', phone: '', email: '', address: '',
  bloodGroup: '', conditions: '', allergies: '',
  emergencyName: '', emergencyPhone: '', emergencyRelation: '',
  doctorName: '', doctorContact: '', notes: '', status: 'Active', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  gracePeriodMinutes: 60, missedAfterHours: 24,
};

export default function PatientFormModal({ open, onClose, patient, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (open) {
      setForm(patient ? { ...emptyForm, ...patient } : emptyForm);
      setErrors({});
    }
  }, [open, patient]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required.';
    if (!form.relationship) errs.relationship = 'Please select a relationship.';
    if (!form.phone.trim() || form.phone.trim().length < 6) errs.phone = 'Enter a valid phone number.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (patient) {
        await updatePatient(patient.id, form);
        push('success', `${form.name}'s details were updated.`);
      } else {
        await createPatient(form);
        push('success', `${form.name} was added as a patient.`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      push('error', friendlyError(err, 'Could not save patient.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? 'Edit Patient' : 'Add Patient'}
      wide
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Patient'}</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Input id="p-name" label="Full Name" placeholder="e.g. Rahela Begum" value={form.name} onChange={set('name')} error={errors.name} />
        <Select id="p-rel" label="Relationship" placeholder="Select relationship" options={RELATIONSHIPS} value={form.relationship} onChange={set('relationship')} error={errors.relationship} />
        <Input id="p-dob" label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} />
        <Select id="p-gender" label="Gender" options={['Female', 'Male', 'Other']} value={form.gender} onChange={set('gender')} />
        <Input id="p-phone" label="Phone Number" placeholder="01xxx-xxxxxx" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Input id="p-email" label="Email (optional)" type="email" placeholder="name@example.com" value={form.email} onChange={set('email')} error={errors.email} />
      </div>
      <Input id="p-address" label="Address (optional)" placeholder="Street, area, city" value={form.address} onChange={set('address')} />

      <div className="form-section-title">Health Information</div>
      <div className="form-grid">
        <Select id="p-blood" label="Blood Group" placeholder="Select blood group" options={BLOOD_GROUPS} value={form.bloodGroup} onChange={set('bloodGroup')} />
        <Input id="p-conditions" label="Existing Conditions" placeholder="e.g. Hypertension" value={form.conditions} onChange={set('conditions')} />
      </div>
      <Input id="p-allergies" label="Allergies" placeholder="e.g. Penicillin, or 'None known'" value={form.allergies} onChange={set('allergies')} />
      <div className="form-grid">
        <Input id="p-em-name" label="Emergency Contact Name" value={form.emergencyName} onChange={set('emergencyName')} />
        <Input id="p-em-phone" label="Emergency Contact Phone" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
      </div>
      <Input id="p-em-rel" label="Emergency Contact Relationship" value={form.emergencyRelation} onChange={set('emergencyRelation')} />

      <div className="form-section-title">Medical Information</div>
      <div className="form-grid">
        <Input id="p-doc-name" label="Doctor Name (optional)" value={form.doctorName} onChange={set('doctorName')} />
        <Input id="p-doc-contact" label="Doctor Contact (optional)" value={form.doctorContact} onChange={set('doctorContact')} />
      </div>
      <Textarea id="p-notes" label="Notes" rows={3} value={form.notes} onChange={set('notes')} />

      <div className="form-section-title">Schedule policy</div>
      <div className="form-grid">
        <Select id="p-tz" label="Patient time zone" options={[...new Set([form.timezone, ...TIMEZONES])]} value={form.timezone} onChange={set('timezone')} hint="All reminder times are in this zone." />
        <Input id="p-grace" label="On-time window (minutes)" type="number" min="5" max="720" value={form.gracePeriodMinutes} onChange={set('gracePeriodMinutes')} hint="Taken within this long after the scheduled time = on time; later = late." />
        <Input id="p-missed" label="Missed after (hours)" type="number" min="2" max="72" value={form.missedAfterHours} onChange={set('missedAfterHours')} hint="Still not taken after this long = missed. Must exceed the on-time window." />
      </div>

      {patient && (
        <>
          <div className="form-section-title">Status</div>
          <Select id="p-status" label="Patient Status" options={['Active', 'Inactive']} value={form.status} onChange={set('status')} />
        </>
      )}
    </Modal>
  );
}
