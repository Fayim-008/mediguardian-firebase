/**
 * MockDevice — behaves like the future ESP32 firmware, speaking the SAME HTTP API (docs/DEVICE_API.md).
 * It is a test double, NOT the real firmware: it invents no GPIO pins and proves nothing about hardware.
 * Every box it represents must be registered as `simulated` on the server so the UI labels it.
 */
import crypto from 'node:crypto';

export class MockDevice {
  constructor({ baseUrl, token, firmware = 'mock-esp32-0.1' }) {
    this.base = baseUrl.replace(/\/$/, ''); this.token = token; this.firmware = firmware;
    this.online = true;           // simulates Wi-Fi / internet availability
    this.queue = [];              // bounded local event queue (like NVS/SPIFFS on the ESP32)
    this.maxQueue = 200;
    this.configVersion = 0; this.config = null;
    this.refillMode = false; this.power = 'on';
  }

  async #http(path, { method = 'GET', body } = {}) {
    if (!this.online) throw new Error('network unavailable (simulated Wi-Fi loss)');
    const res = await fetch(`${this.base}/api/v1/device${path}`, {
      method, headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  newEventId() { return `mock-${crypto.randomUUID()}`; }

  makeEvent(type, { drawer, at = new Date(), sensors, extra } = {}) {
    return { event_id: this.newEventId(), type, ...(drawer ? { drawer } : {}), occurred_at: at.toISOString(), config_version: this.configVersion,
      ...(sensors ? { sensors } : {}), refill_mode: this.refillMode, firmware_version: this.firmware, ...(extra ? { extra } : {}) };
  }

  /** Queue an event locally; it is transmitted by flush() (immediately when online). */
  record(ev) { if (this.queue.length >= this.maxQueue) this.queue.shift(); this.queue.push(ev); return ev; }

  async flush({ duplicate = false, shuffle = false } = {}) {
    if (!this.queue.length) return {};
    let batch = [...this.queue];
    if (shuffle) batch = batch.sort(() => Math.random() - 0.5);
    if (duplicate) batch = [...batch, ...batch];               // retransmission after a lost ACK
    const r = await this.#http('/events', { method: 'POST', body: { events: batch.slice(0, 100) } });
    if (r.status !== 200) throw new Error(`events rejected: ${r.status} ${JSON.stringify(r.data)}`);
    // anything the server answered (accepted | duplicate | rejected-with-reason) is removed from the queue
    this.queue = this.queue.filter((e) => !(e.event_id in r.data.results));
    return r.data.results;
  }

  async boot() { this.power = 'on'; this.record(this.makeEvent('boot')); await this.heartbeat(); return this.flush(); }
  async powerOff() { this.record(this.makeEvent('power_off')); await this.flush(); this.power = 'off'; await this.heartbeat(); }
  async heartbeat() {
    return this.#http('/heartbeat', { method: 'POST', body: { sent_at: new Date().toISOString(), firmware_version: this.firmware, config_version: this.configVersion,
      refill_mode: this.refillMode, power_state: this.power, wifi_rssi: -58, queued_events: this.queue.length } });
  }

  async syncConfig() {
    const r = await this.#http(`/config?since=${this.configVersion}`);
    if (r.status !== 200) throw new Error(`config fetch failed ${r.status}`);
    if (!r.data.changed) return { changed: false };
    this.config = r.data.config; const v = r.data.version;
    const ack = await this.#http('/config/ack', { method: 'POST', body: { version: v, status: 'applied' } });
    this.configVersion = v;
    return { changed: true, version: v, ack: ack.status };
  }

  sensors(hand = true, which = 'a') { return { reed_open: true, ir_a: hand && which === 'a', ir_b: hand && which === 'b' }; }
  removal(drawer, at = new Date()) { return this.record(this.makeEvent('removal_detected', { drawer, at, sensors: this.sensors(true, 'a') })); }
  openNoHand(drawer, at = new Date()) {
    this.record(this.makeEvent('drawer_open', { drawer, at }));
    return this.record(this.makeEvent('interaction_rejected', { drawer, at: new Date(at.getTime() + 500), sensors: this.sensors(false) }));
  }
  async startRefill(at = new Date()) { this.refillMode = true; this.record(this.makeEvent('refill_start', { at })); return this.flush(); }
  async endRefill(at = new Date()) { this.record(this.makeEvent('refill_end', { at })); this.refillMode = false; return this.flush(); }
}
