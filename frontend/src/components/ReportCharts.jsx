import React from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';

const COLORS = {
  'On time': '#16A34A',
  Late: '#F59E0B',
  Missed: '#E4483D',
  Upcoming: '#2E76FF',
};

export function StatusDonut({ data }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return <div className="text-center" style={{ padding: '40px 0', color: 'var(--text-faint)', fontSize: '.86rem' }}>No dose data for this period yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
          {filtered.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] || '#94A3B8'} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '.78rem' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AdherenceTrend({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center" style={{ padding: '40px 0', color: 'var(--text-faint)', fontSize: '.86rem' }}>No trend data yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E9F0FC" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5B6B85' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#5B6B85' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v}%`} />
        <Line type="monotone" dataKey="adherence" stroke="#0B5FFF" strokeWidth={2.5} dot={{ r: 3 }} name="Adherence %" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MedicinePerformanceBar({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center" style={{ padding: '40px 0', color: 'var(--text-faint)', fontSize: '.86rem' }}>No medicines in this period.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E9F0FC" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#5B6B85' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#101B33' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v}%`} />
        <Bar dataKey="adherence" radius={[0, 8, 8, 0]} fill="#0B5FFF" name="Adherence %" />
      </BarChart>
    </ResponsiveContainer>
  );
}
