/**
 * siteConfig.js
 * ------------------------------------------------------------------
 * ONE place to change branding, navigation, contact details, team
 * members and image paths. Components should always read from here
 * instead of hard-coding text/links, so the whole site can be
 * rebranded or re-pointed without touching component code.
 * ------------------------------------------------------------------
 */

export const siteConfig = {
  name: 'MediGuardian',
  tagline: 'Caring Beyond Distance',
  subTagline: 'Your parents are safe with MediGuardian',
  description:
    'MediGuardian pairs a smart medicine cabinet with a caregiver dashboard so families can manage medicines, schedules and reminders for the people they love — from anywhere.',
};

/**
 * Public marketing navigation.
 */
export const publicNav = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Our Team', href: '#team' },
  { label: 'About us', href: '#contact' },
];

/**
 * In-app (authenticated) navigation shown in the sidebar.
 */
export const appNav = [
  { label: 'Dashboard', path: '/app/dashboard', icon: 'Home' },
  { label: 'Patients', path: '/app/patients', icon: 'Users' },
  { label: 'My Boxes', path: '/app/boxes', icon: 'Package' },
  { label: 'Set Medicine', path: '/app/set-medicine', icon: 'Pill' },
  { label: 'Refill Medicine', path: '/app/refill', icon: 'RefreshCw' },
  { label: 'Check Report', path: '/app/reports', icon: 'FileBarChart' },
  { label: 'Notifications', path: '/app/notifications', icon: 'Bell' },
  { label: 'Settings', path: '/app/settings', icon: 'Settings' },
];

/**
 * Image asset map — the "image replacement system".
 * Drop a file with the SAME name into src/assets/ and it is picked
 * up automatically the next time the app builds. See README.md →
 * "How to replace website images".
 */
export const siteImages = {
  logo: '/src/assets/logo.png',
  heroCabinet: '/src/assets/cabinet.png',
};

/**
 * Editable contact information used across the footer / contact
 * section. Change once here, updates everywhere.
 */
export const contactConfig = {
  teamName: 'Robot Hunters Team',
  department: 'Software Engineering Department',
  university: 'Daffodil International University, DSC, Ashulia, Dhaka',
  phone: '01789-887707',
  email: '253-35-338@diu.edu.bd',
  location: 'Daffodil Smart City, Ashulia, Dhaka',
  social: {
    facebook: 'https://facebook.com',
    twitter: 'https://twitter.com',
    instagram: 'https://instagram.com',
    linkedin: 'https://linkedin.com',
  },
};

/**
 * Team member roster — rendered dynamically on the landing page.
 * Add / remove / edit members here only.
 */
export const teamConfig = [
  { name: 'Towhidul Islam Rifat', role: 'Chief Executive Officer', email: 'rifattowhidislam8@gmail.com' },
  { name: 'Md. Fayim Hossain', role: 'Founder', email: 'mdfayimhossain54@gmail.com' },
  { name: 'Muntasin Islam Mugdho', role: 'General Member', email: '253-35-090@diu.edu.bd' },
  { name: 'Nafis Ahmed', role: 'General Member', email: '253-35-000@diu.edu.bd' },
  { name: 'Protuysh Porosh Mandal', role: 'Executive Member', email: '253-35-338@diu.edu.bd' },
];

/**
 * "How it works" steps shown on the landing page.
 */
export const howItWorksSteps = [
  {
    title: 'Set Medicine Schedule',
    description: 'Add a patient, set their medicines, doses and reminder times in minutes.',
  },
  {
    title: 'Smart Drawer Reminder',
    description: 'The cabinet lights and reminds at the right drawer, at the right time.',
  },
  {
    title: 'Guardian Gets Updates',
    description: 'You get real-time alerts the moment a dose is taken, late, or missed.',
  },
];

/**
 * Feature highlights.
 */
export const featureList = [
  { icon: 'Bell', title: 'Smart Reminders', description: 'Multiple reminder times per medicine, tuned to each patient\u2019s routine.' },
  { icon: 'ShieldCheck', title: 'Real-Time Alerts', description: 'Know instantly when a dose is taken, running late, or missed entirely.' },
  { icon: 'Users', title: 'Multi-Patient Care', description: 'Manage medicines for every parent or patient from one dashboard.' },
  { icon: 'FileBarChart', title: 'Adherence Reports', description: '1, 7 and 30-day reports so you can see patterns, not just moments.' },
  { icon: 'Package', title: 'Refill Tracking', description: 'Low-stock warnings before a drawer ever runs empty.' },
  { icon: 'Lock', title: 'Guardian Cabinet', description: 'A locked, drawer-based cabinet built for safe, mistake-free dosing.' },
];
