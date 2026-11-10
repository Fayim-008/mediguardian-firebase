/**
 * Socket.IO mock box — speaks EXACTLY the protocol the ESP32 firmware uses (namespace "/device").
 * Use it to test the real-time path before (or without) flashing hardware.
 *
 *   node socket-device.js http://localhost:4000 mgd_YOUR_DEVICE_TOKEN
 *
 * Keyboard while running:  1-4 = medicine removal from that drawer (hand detected)
 *                          o   = drawer 1 opened with no hand      r = toggle refill mode
 *                          h   = heartbeat now                     q = quit
 */
import crypto from 'node:crypto';
import readline from 'node:readline';
import { io } from 'socket.io-client';

const [base, token] = process.argv.slice(2);
if (!base || !token) { console.error('usage: node socket-device.js http://localhost:4000 mgd_xxx'); process.exit(1); }

const FW = 'socket-sim-1.0';
let configVersion = 0; let refill = false; let seq = 0;
const boot = crypto.randomBytes(3).toString('hex');
const eventId = () => `sim-${boot}-${++seq}`;
const now = () => new Date().toISOString();

const socket = io(`${base.replace(/\/$/, '')}/device`, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 10000 });

const heartbeat = () => socket.emit('heartbeat', { sent_at: now(), firmware_version: FW, config_version: configVersion, refill_mode: refill, power_state: 'on', wifi_rssi: -55 });
const send = (events) => socket.emit('events', { events });
const ev = (type, extra = {}) => ({ event_id: eventId(), type, occurred_at: now(), config_version: configVersion, refill_mode: refill, firmware_version: FW, ...extra });

socket.on('connect', () => { console.log('connected to /device'); send([ev('boot')]); heartbeat(); });
socket.on('connect_error', (e) => console.log('connect error:', e.message, '(wrong token or server down?)'));
socket.on('disconnect', (r) => console.log('disconnected:', r));
socket.on('welcome', (w) => { console.log('welcome', w); socket.emit('config:get', { since: configVersion }); });
socket.on('heartbeat:ack', (r) => { if (r.config_changed) socket.emit('config:get', { since: configVersion }); });
socket.on('config:changed', (c) => { console.log('server says config changed ->', c); socket.emit('config:get', { since: configVersion }); });
socket.on('config', (c) => {
  if (!c.changed) return;
  console.log(`config v${c.version}: ${c.config.unpaired ? 'UNPAIRED' : `${c.config.alarms.length} alarms`}`);
  for (const a of (c.config.alarms || []).slice(0, 6)) console.log(`   drawer ${a.slot} at ${new Date(a.at * 1000).toLocaleString()}  ${a.medicines.join(', ')}`);
  configVersion = c.version;
  socket.emit('config:ack', { version: c.version, status: 'applied' });
});
socket.on('events:result', (r) => console.log('events result', JSON.stringify(r.results)));
socket.on('command', (c) => { console.log('COMMAND from caregiver:', c); if (c.command === 'sync_config') socket.emit('config:get', {}); });
socket.on('error:device', (e) => console.log('server rejected', e));

setInterval(heartbeat, 60000);

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (_s, key) => {
  const k = key?.name || _s;
  if (k === 'q' || (key?.ctrl && k === 'c')) process.exit(0);
  if (['1', '2', '3', '4'].includes(k)) { const d = Number(k); send([ev('drawer_open', { drawer: d }), ev('removal_detected', { drawer: d, sensors: { reed_open: true, ir_a: true, ir_b: false } }), ev('drawer_close', { drawer: d })]); }
  if (k === 'o') send([ev('drawer_open', { drawer: 1 }), ev('interaction_rejected', { drawer: 1, sensors: { reed_open: true, ir_a: false, ir_b: false } })]);
  if (k === 'r') { refill = !refill; send([ev(refill ? 'refill_start' : 'refill_end')]); console.log('refill mode', refill); }
  if (k === 'h') heartbeat();
});
console.log('keys: 1-4 removal, o open-no-hand, r refill toggle, h heartbeat, q quit');
