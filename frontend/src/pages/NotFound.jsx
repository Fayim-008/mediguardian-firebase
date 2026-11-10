import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <div className="container state-block" style={{ padding: '90px 24px' }}>
      <div className="state-icon" style={{ margin: '0 auto 18px' }}><Compass size={26} /></div>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <Link to="/"><Button variant="primary">Back to Home</Button></Link>
    </div>
  );
}
