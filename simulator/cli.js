// Usage: node cli.js <baseUrl> <deviceToken> <drawer> [on|off]   -> boots a mock box, syncs config, sends one removal
import { MockDevice } from './mock-device.js';
const [base, token, drawer = '1'] = process.argv.slice(2);
if (!base || !token) { console.error('usage: node cli.js http://localhost:4000 mgd_xxx 1'); process.exit(1); }
const d = new MockDevice({ baseUrl: base, token });
console.log('boot', await d.boot());
console.log('config', await d.syncConfig());
d.removal(Number(drawer));
console.log('events', await d.flush());
