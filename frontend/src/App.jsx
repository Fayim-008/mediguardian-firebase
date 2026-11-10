import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientInfo from './pages/PatientInfo';
import SetMedicine from './pages/SetMedicine';
import RefillMedicine from './pages/RefillMedicine';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Boxes from './pages/Boxes';
import AddBox from './pages/AddBox';
import Notifications from './pages/Notifications';
import AdminBoxes from './pages/AdminBoxes';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientInfo />} />
        <Route path="boxes" element={<Boxes />} />
        <Route path="add-box" element={<AddBox />} />
        <Route path="set-medicine" element={<SetMedicine />} />
        <Route path="refill" element={<RefillMedicine />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin/boxes" element={<AdminBoxes />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
