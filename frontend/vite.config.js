import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend is its own server. It talks directly to the backend at VITE_API_URL (see .env).
// host: true lets phones/tablets on the same Wi-Fi open http://<this-PC-IP>:5173 to test the responsive layout.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./test/setup.js'], css: false },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
