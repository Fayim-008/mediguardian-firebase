/*
 * MediGuardian smart medicine box — ESP32 firmware (Arduino framework)
 * ------------------------------------------------------------------------------------------
 * Real-time link to the Node.js backend over Socket.IO (namespace "/device").
 *
 * What it does
 *   - Wi-Fi + NTP time (falls back to the server's clock if NTP is blocked)
 *   - Socket.IO client: heartbeat, event upload, config download/ack, live commands from the caregiver app
 *   - Runs medicine reminders LOCALLY from the server's alarm list (works with no Wi-Fi):
 *       LED of the drawer + LCD text + buzzer for 20 s, repeated at +30 and +60 min, cancelled when medicine is taken
 *   - Drawer sensing: qualifying removal = reed OPEN and (IR A or IR B) sees a hand
 *   - Refill switch: refill_start / refill_end, removals during refill never count as doses
 *   - Bounded event queue persisted in flash (NVS) and re-sent until the server answers (idempotent event ids)
 *
 * Libraries (Arduino IDE -> Tools -> Manage Libraries):
 *   - "WebSockets" by Markus Sattler (links2004)  >= 2.6.1   (provides SocketIOclient)
 *   - "ArduinoJson" by Benoit Blanchon            >= 7.0
 *   - "LiquidCrystal I2C" by Frank de Brabander   >= 1.1.2
 * Board: "ESP32 Dev Module" (esp32 by Espressif Systems, core 2.0.x or 3.x)
 *
 * Edit config.h (pins/polarity) and secrets.h (Wi-Fi, server, device token) before flashing.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <sys/time.h>
#include "config.h"
#include "secrets.h"

// =========================================================================================
//  Globals
// =========================================================================================
SocketIOclient io;
Preferences prefs;
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

static const char *NS = "/device";
bool nsConnected = false;            // joined the /device namespace (authenticated)
bool serverSaysPaired = true;
uint32_t nsRetryAt = 0;
uint32_t lastHeartbeatMs = 0;
uint32_t heartbeatIntervalMs = 60000;
int32_t configVersion = 0;           // version of the config currently applied
uint32_t configValidUntil = 0;       // epoch: refetch after this
uint32_t lastConfigRequestMs = 0;
int16_t utcOffsetMin = 360;          // patient's offset, only for the LCD clock (alarms are UTC epochs)
bool unpaired = false;
String chipTag;                      // e.g. "a1b2c3" (part of every event id)
uint32_t bootCount = 0;
uint32_t eventSeq = 0;

// policy (from server)
uint8_t alertsPerDose = 3;
uint16_t alertIntervalMin = 30;
uint16_t alertDurationSec = 20;

// =========================================================================================
//  Time helpers (the ESP32 clock runs in UTC)
// =========================================================================================
bool timeValid() { return time(nullptr) > 1700000000; }   // after Nov 2023 = synced
uint32_t nowEpoch() { return (uint32_t)time(nullptr); }

String isoTime(uint32_t epoch) {
  time_t t = (time_t)epoch;
  struct tm tmv;
  gmtime_r(&t, &tmv);
  char buf[24];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmv);
  return String(buf);
}

// "2026-11-08T19:28:56.123Z" -> set the system clock (used if NTP is unavailable)
void setClockFromIso(const char *s) {
  if (!s || timeValid()) return;
  int Y, M, D, h, m, sec;
  if (sscanf(s, "%d-%d-%dT%d:%d:%d", &Y, &M, &D, &h, &m, &sec) != 6) return;
  struct tm tmv = {};
  tmv.tm_year = Y - 1900; tmv.tm_mon = M - 1; tmv.tm_mday = D; tmv.tm_hour = h; tmv.tm_min = m; tmv.tm_sec = sec;
  time_t t = mktime(&tmv);           // TZ is UTC0, so mktime == timegm
  struct timeval tv = { t, 0 };
  settimeofday(&tv, nullptr);
  Serial.printf("[time] clock set from server: %s\n", s);
}

// =========================================================================================
//  LCD
// =========================================================================================
uint32_t lcdHoldUntil = 0;
char lcdLine[2][17] = {"", ""};

void lcdWrite(uint8_t row, const String &text) {
  char buf[17];
  snprintf(buf, sizeof(buf), "%-16s", text.c_str());
  if (strcmp(buf, lcdLine[row]) == 0) return;   // avoid flicker
  strcpy(lcdLine[row], buf);
  lcd.setCursor(0, row);
  lcd.print(buf);
}

void lcdShow(const String &l1, const String &l2, uint32_t holdMs) {
  lcdWrite(0, l1.substring(0, 16));
  lcdWrite(1, l2.substring(0, 16));
  lcdHoldUntil = millis() + holdMs;
}

// =========================================================================================
//  Buzzer (non-blocking beep pattern)
// =========================================================================================
uint32_t buzzUntil = 0;
int8_t buzzSlot = -1;                // drawer whose reminder is sounding (-1 = other, e.g. ring command)
bool buzzerOn = false;
uint32_t buzzToggleAt = 0;

void buzzerWrite(bool on) {
  buzzerOn = on;
#if BUZZER_PASSIVE
  if (on) tone(BUZZER_PIN, 2200); else noTone(BUZZER_PIN);
#else
  digitalWrite(BUZZER_PIN, on ? BUZZER_ON_LEVEL : !BUZZER_ON_LEVEL);
#endif
}

void buzzStart(uint32_t durationMs, int8_t slot) {
  buzzUntil = millis() + durationMs;
  buzzSlot = slot;
  buzzToggleAt = 0;
}

void buzzStop() { buzzUntil = 0; buzzSlot = -1; buzzerWrite(false); }

void buzzerTask() {
  uint32_t ms = millis();
  if (!buzzUntil) return;
  if ((int32_t)(ms - buzzUntil) >= 0) { buzzStop(); return; }
  if ((int32_t)(ms - buzzToggleAt) >= 0) {
    buzzerWrite(!buzzerOn);
    buzzToggleAt = ms + (buzzerOn ? BUZZ_ON_MS : BUZZ_OFF_MS);
  }
}

// =========================================================================================
//  Event queue (persisted to NVS so events survive a reboot / power cut)
// =========================================================================================
struct QEvent {
  char id[28];
  char type[22];
  uint8_t drawer;
  uint32_t epoch;       // 0 = clock not synced when it happened -> use ms
  uint32_t ms;          // millis() at the time (only valid in the same boot)
  uint8_t sensors;      // bit7 = has sensors, bit0 reed_open, bit1 ir_a, bit2 ir_b
  uint8_t refill;
  uint8_t alertNo;
  uint8_t pad;
};
QEvent queue_[QUEUE_MAX];
uint8_t qCount = 0;
bool flushInFlight = false;
uint32_t flushSentMs = 0;
uint32_t queueDirtyAt = 0;

void saveQueue() {
  prefs.putUChar("qcount", qCount);
  if (qCount) prefs.putBytes("queue", queue_, sizeof(QEvent) * qCount);
  else prefs.remove("queue");
}

void loadQueue() {
  qCount = prefs.getUChar("qcount", 0);
  if (qCount > QUEUE_MAX) qCount = 0;
  if (qCount) {
    size_t n = prefs.getBytes("queue", queue_, sizeof(QEvent) * qCount);
    if (n != sizeof(QEvent) * qCount) qCount = 0;
  }
  // Events whose time was never known (previous boot, no clock) cannot be placed in time: drop them.
  uint8_t w = 0;
  for (uint8_t i = 0; i < qCount; i++) if (queue_[i].epoch) queue_[w++] = queue_[i];
  qCount = w;
  Serial.printf("[queue] %u events restored from flash\n", qCount);
}

bool refillMode = false;

void enqueue(const char *type, uint8_t drawer = 0, int8_t reed = -1, int8_t irA = -1, int8_t irB = -1, uint8_t alertNo = 0) {
  if (qCount >= QUEUE_MAX) {                      // drop the oldest
    memmove(&queue_[0], &queue_[1], sizeof(QEvent) * (QUEUE_MAX - 1));
    qCount--;
  }
  QEvent &e = queue_[qCount++];
  memset(&e, 0, sizeof(e));
  snprintf(e.id, sizeof(e.id), "%s-%lu-%lu", chipTag.c_str(), (unsigned long)bootCount, (unsigned long)(++eventSeq));
  strncpy(e.type, type, sizeof(e.type) - 1);
  e.drawer = drawer;
  e.epoch = timeValid() ? nowEpoch() : 0;
  e.ms = millis();
  if (reed >= 0) e.sensors = 0x80 | (reed ? 1 : 0) | (irA > 0 ? 2 : 0) | (irB > 0 ? 4 : 0);
  e.refill = refillMode ? 1 : 0;
  e.alertNo = alertNo;
  queueDirtyAt = millis();
  Serial.printf("[event] %s drawer=%u id=%s\n", type, drawer, e.id);
}

void removeFromQueue(const char *id) {
  for (uint8_t i = 0; i < qCount; i++) {
    if (strcmp(queue_[i].id, id) == 0) {
      memmove(&queue_[i], &queue_[i + 1], sizeof(QEvent) * (qCount - i - 1));
      qCount--;
      queueDirtyAt = millis();
      return;
    }
  }
}

// =========================================================================================
//  Socket.IO send helpers:  42/device,["event",{...}]
// =========================================================================================
void emitDoc(JsonDocument &arrDoc) {
  String json;
  serializeJson(arrDoc, json);
  String payload = String(NS) + "," + json;
  io.sendEVENT(payload);
}

void sendHeartbeat() {
  if (!nsConnected) return;
  JsonDocument doc;
  JsonArray a = doc.to<JsonArray>();
  a.add("heartbeat");
  JsonObject o = a.add<JsonObject>();
  if (timeValid()) o["sent_at"] = isoTime(nowEpoch());
  o["firmware_version"] = FW_VERSION;
  o["config_version"] = configVersion;
  o["refill_mode"] = refillMode;
  o["power_state"] = "on";
  int rssi = WiFi.RSSI();
  if (rssi < 0 && rssi >= -127) o["wifi_rssi"] = rssi;
  o["uptime_s"] = (uint32_t)(millis() / 1000);
  o["queued_events"] = qCount;
  emitDoc(doc);
  lastHeartbeatMs = millis();
}

void requestConfig(bool force) {
  if (!nsConnected) return;
  JsonDocument doc;
  JsonArray a = doc.to<JsonArray>();
  a.add("config:get");
  JsonObject o = a.add<JsonObject>();
  if (!force && configVersion > 0) o["since"] = configVersion;
  emitDoc(doc);
  lastConfigRequestMs = millis();
}

void sendConfigAck(int32_t version, bool ok, const char *err) {
  JsonDocument doc;
  JsonArray a = doc.to<JsonArray>();
  a.add("config:ack");
  JsonObject o = a.add<JsonObject>();
  o["version"] = version;
  o["status"] = ok ? "applied" : "failed";
  if (!ok && err) o["error"] = err;
  emitDoc(doc);
}

void flushEvents() {
  if (!nsConnected || !timeValid() || qCount == 0) return;
  if (flushInFlight && millis() - flushSentMs < 15000) return;   // wait for "events:result" (retry after 15 s)
  JsonDocument doc;
  JsonArray a = doc.to<JsonArray>();
  a.add("events");
  JsonArray evs = a.add<JsonObject>()["events"].to<JsonArray>();
  uint8_t n = 0;
  for (uint8_t i = 0; i < qCount && n < EVENTS_PER_BATCH; i++) {
    QEvent &e = queue_[i];
    if (!e.epoch) {                                   // happened before the clock was set: derive from millis()
      uint32_t ageS = (millis() - e.ms) / 1000;
      e.epoch = nowEpoch() - ageS;
    }
    JsonObject o = evs.add<JsonObject>();
    o["event_id"] = e.id;
    o["type"] = e.type;
    if (e.drawer) o["drawer"] = e.drawer;
    o["occurred_at"] = isoTime(e.epoch);
    if (configVersion > 0) o["config_version"] = configVersion;
    if (e.sensors & 0x80) {
      JsonObject s = o["sensors"].to<JsonObject>();
      s["reed_open"] = (e.sensors & 1) != 0;
      s["ir_a"] = (e.sensors & 2) != 0;
      s["ir_b"] = (e.sensors & 4) != 0;
    }
    o["refill_mode"] = e.refill != 0;
    o["firmware_version"] = FW_VERSION;
    if (e.alertNo) o["extra"]["alert_number"] = e.alertNo;
    n++;
  }
  emitDoc(doc);
  flushInFlight = true;
  flushSentMs = millis();
}

// =========================================================================================
//  Alarms (local reminders)
// =========================================================================================
struct Alarm {
  uint8_t slot;          // 1..4
  uint32_t at;           // UTC epoch seconds
  char meds[48];         // "NAPA Extra, Seclo"
  uint8_t alertsDone;
  bool done;             // taken, or the reminder window is over
};
Alarm alarms[MAX_ALARMS];
uint8_t alarmCount = 0;
char drawerNames[4][17] = {"Morning", "Noon", "Night", "Extra"};

uint32_t alarmWindowEnd(const Alarm &a) {
  return a.at + (uint32_t)(alertsPerDose - 1) * alertIntervalMin * 60 + alertDurationSec;
}

bool slotHasActiveAlarm(uint8_t slot, uint32_t now) {
  for (uint8_t i = 0; i < alarmCount; i++)
    if (alarms[i].slot == slot && !alarms[i].done && now >= alarms[i].at) return true;
  return false;
}

/** Medicine taken from a drawer: cancel every due reminder of that drawer. */
void cancelAlarmsForSlot(uint8_t slot) {
  if (!timeValid()) return;
  uint32_t now = nowEpoch();
  for (uint8_t i = 0; i < alarmCount; i++)
    if (alarms[i].slot == slot && !alarms[i].done && alarms[i].at <= now) alarms[i].done = true;
  if (buzzSlot == (int8_t)slot) buzzStop();
}

void alarmTask() {
  if (!timeValid() || unpaired) return;
  uint32_t now = nowEpoch();
  for (uint8_t i = 0; i < alarmCount; i++) {
    Alarm &a = alarms[i];
    if (a.done) continue;
    if (now >= alarmWindowEnd(a)) { a.done = true; continue; }     // reminders finished (server decides late/missed)
    if (a.alertsDone >= alertsPerDose) continue;
    uint32_t alertAt = a.at + (uint32_t)a.alertsDone * alertIntervalMin * 60;
    if (now < alertAt) continue;
    if (now >= alertAt + alertDurationSec) { a.alertsDone++; continue; } // missed this alert while off: skip it
    a.alertsDone++;
    uint32_t remainMs = (alertAt + alertDurationSec - now) * 1000UL;
    if (!refillMode) buzzStart(remainMs, a.slot);
    lcdShow(String("Take: ") + drawerNames[a.slot - 1], String(a.meds), remainMs);
    enqueue("reminder_alert", a.slot, -1, -1, -1, a.alertsDone);
    Serial.printf("[alarm] drawer %u alert %u/%u: %s\n", a.slot, a.alertsDone, alertsPerDose, a.meds);
  }
  for (uint8_t s = 1; s <= 4; s++) {
    bool on = slotHasActiveAlarm(s, now);
    // blink while the buzzer sounds for this drawer, steady while the dose is due
    if (on && buzzSlot == (int8_t)s) on = ((millis() / 300) % 2) == 0;
    digitalWrite(LED_PINS[s - 1], on ? HIGH : LOW);
  }
}

// =========================================================================================
//  Configuration from the server
// =========================================================================================
bool applyConfig(JsonObject cfg, bool fromServer) {
  if (cfg.isNull()) return false;
  unpaired = cfg["unpaired"] | false;
  int32_t v = cfg["version"] | 0;

  JsonObject pol = cfg["policy"];
  if (!pol.isNull()) {
    alertsPerDose = pol["alerts_per_dose"] | 3;
    alertIntervalMin = pol["alert_interval_minutes"] | 30;
    alertDurationSec = pol["alert_duration_seconds"] | 20;
    uint32_t hb = pol["heartbeat_interval_seconds"] | 60;
    heartbeatIntervalMs = constrain(hb, 15u, 600u) * 1000UL;
  }
  utcOffsetMin = cfg["utc_offset_minutes"] | utcOffsetMin;
  const char *validUntil = cfg["valid_until"];
  if (validUntil) {
    int Y, M, D, h, m, s;
    if (sscanf(validUntil, "%d-%d-%dT%d:%d:%d", &Y, &M, &D, &h, &m, &s) == 6) {
      struct tm tmv = {}; tmv.tm_year = Y - 1900; tmv.tm_mon = M - 1; tmv.tm_mday = D; tmv.tm_hour = h; tmv.tm_min = m; tmv.tm_sec = s;
      configValidUntil = (uint32_t)mktime(&tmv);
    }
  }
  for (JsonObject d : cfg["drawers"].as<JsonArray>()) {
    uint8_t slot = d["slot"] | 0;
    const char *name = d["name"] | "";
    if (slot >= 1 && slot <= 4 && name[0]) { strncpy(drawerNames[slot - 1], name, 16); drawerNames[slot - 1][16] = 0; }
  }

  // New alarm list, keeping progress (alerts already given / taken) of alarms we already knew.
  static Alarm fresh[MAX_ALARMS];
  uint8_t n = 0;
  for (JsonObject a : cfg["alarms"].as<JsonArray>()) {
    if (n >= MAX_ALARMS) break;
    Alarm &x = fresh[n];
    memset(&x, 0, sizeof(x));
    x.slot = a["slot"] | 0;
    x.at = a["at"].as<uint32_t>();
    if (x.slot < 1 || x.slot > 4 || !x.at) continue;
    String meds;
    for (JsonVariant m : a["medicines"].as<JsonArray>()) { if (meds.length()) meds += ", "; meds += m.as<const char *>(); }
    strncpy(x.meds, meds.c_str(), sizeof(x.meds) - 1);
    for (uint8_t i = 0; i < alarmCount; i++)
      if (alarms[i].slot == x.slot && alarms[i].at == x.at) { x.alertsDone = alarms[i].alertsDone; x.done = alarms[i].done; }
    n++;
  }
  memcpy(alarms, fresh, sizeof(Alarm) * n);
  alarmCount = n;
  configVersion = v;
  if (unpaired) { alarmCount = 0; buzzStop(); }
  Serial.printf("[config] v%ld applied: %u alarms, %s\n", (long)v, alarmCount, unpaired ? "UNPAIRED" : "paired");
  (void)fromServer;
  return true;
}

void saveConfig(JsonObject cfg) {
  String raw;
  serializeJson(cfg, raw);
  if (raw.length() > 12000) { Serial.println("[config] too large to store in flash, kept in RAM only"); return; }
  prefs.putBytes("cfg", raw.c_str(), raw.length());
  prefs.putUInt("cfglen", raw.length());
}

void loadConfig() {
  uint32_t len = prefs.getUInt("cfglen", 0);
  if (!len || len > 12000) return;
  char *buf = (char *)malloc(len + 1);
  if (!buf) return;
  prefs.getBytes("cfg", buf, len);
  buf[len] = 0;
  JsonDocument doc;
  if (!deserializeJson(doc, buf)) applyConfig(doc.as<JsonObject>(), false);
  free(buf);
  Serial.printf("[config] restored v%ld from flash (works offline)\n", (long)configVersion);
}

// =========================================================================================
//  Incoming Socket.IO events
// =========================================================================================
void handleServerEvent(const char *name, JsonVariant data) {
  if (!strcmp(name, "welcome") || !strcmp(name, "heartbeat:ack") || !strcmp(name, "status")) {
    setClockFromIso(data["server_time"]);
    serverSaysPaired = data["paired"] | true;
    uint32_t hb = data["heartbeat_interval_seconds"] | 0;
    if (hb) heartbeatIntervalMs = constrain(hb, 15u, 600u) * 1000UL;
    int32_t sv = data["config_version"] | -1;
    bool changed = data["config_changed"] | false;
    if (changed || (sv >= 0 && sv != configVersion)) requestConfig(false);
    if (!strcmp(name, "welcome")) { sendHeartbeat(); flushEvents(); }
    return;
  }
  if (!strcmp(name, "config:changed")) { requestConfig(false); return; }
  if (!strcmp(name, "config")) {
    if (!(data["changed"] | false)) return;
    JsonObject cfg = data["config"];
    int32_t v = data["version"] | 0;
    if (!cfg.isNull()) cfg["version"] = v;            // store the server's version with the snapshot
    bool ok = applyConfig(cfg, true);
    if (ok) saveConfig(cfg);
    sendConfigAck(v, ok, ok ? nullptr : "could not parse configuration");
    lcdShow("Settings synced", String("Version ") + v, 2500);
    return;
  }
  if (!strcmp(name, "events:result")) {
    JsonObject results = data["results"];
    for (JsonPair p : results) removeFromQueue(p.key().c_str());
    flushInFlight = false;
    return;
  }
  if (!strcmp(name, "command")) {
    const char *cmd = data["command"] | "";
    Serial.printf("[command] %s\n", cmd);
    if (!strcmp(cmd, "ring")) { buzzStart(4000, -1); lcdShow("Caregiver ping", "Box located :)", 5000); }
    else if (!strcmp(cmd, "sync_config")) requestConfig(true);
    else if (!strcmp(cmd, "stop_alarm")) buzzStop();
    else if (!strcmp(cmd, "message")) lcdShow("Message:", String((const char *)(data["text"] | "")), 15000);
    return;
  }
  if (!strcmp(name, "error:device")) {
    const char *ev = data["event"] | "";
    Serial.printf("[server] rejected %s: %s\n", ev, (const char *)(data["message"] | ""));
    // A rejected batch will never be accepted as-is: drop it so the queue can't get stuck.
    if (!strcmp(ev, "events") && flushInFlight) {
      uint8_t n = qCount < EVENTS_PER_BATCH ? qCount : EVENTS_PER_BATCH;
      memmove(&queue_[0], &queue_[n], sizeof(QEvent) * (qCount - n));
      qCount -= n;
      flushInFlight = false;
      queueDirtyAt = millis();
    }
    return;
  }
}

void socketEvent(socketIOmessageType_t type, uint8_t *payload, size_t length) {
  const char *p = (const char *)payload;
  switch (type) {
    case sIOtype_CONNECT:
      if (length >= 7 && strncmp(p, NS, 7) == 0) {
        nsConnected = true;
        Serial.println("[io] joined /device");
      } else {
        // Engine.IO is open: join our namespace and authenticate with the device token.
        Serial.println("[io] transport connected, joining /device");
        String join = String(NS) + ",{\"token\":\"" + DEVICE_TOKEN + "\"}";
        io.send(sIOtype_CONNECT, join);
        nsRetryAt = millis() + 30000;
      }
      break;
    case sIOtype_DISCONNECT:
      nsConnected = false;
      flushInFlight = false;
      Serial.println("[io] disconnected");
      break;
    case sIOtype_ERROR:
      nsConnected = false;
      Serial.printf("[io] connect error: %.*s  (check DEVICE_TOKEN in secrets.h)\n", (int)length, p);
      lcdShow("Server refused", "Check token", 5000);
      nsRetryAt = millis() + 30000;
      break;
    case sIOtype_EVENT: {
      const char *start = (const char *)memchr(p, '[', length);  // skip "/device," and an optional ack id
      if (!start) break;
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, start, length - (start - p));
      if (err) { Serial.printf("[io] bad JSON: %s\n", err.c_str()); break; }
      const char *name = doc[0] | "";
      handleServerEvent(name, doc[1]);
      break;
    }
    default:
      break;
  }
}

// =========================================================================================
//  Drawer sensing
// =========================================================================================
struct DrawerState {
  bool open = false;            // debounced
  bool rawOpen = false;
  uint32_t rawSince = 0;
  uint32_t irASince = 0, irBSince = 0;
  bool irA = false, irB = false;
  bool removalSent = false;
};
DrawerState drawers[4];

void drawerTask() {
  uint32_t ms = millis();
  for (uint8_t i = 0; i < 4; i++) {
    DrawerState &d = drawers[i];
    uint8_t slot = i + 1;
    bool raw = digitalRead(REED_PINS[i]) == REED_OPEN_LEVEL;
    if (raw != d.rawOpen) { d.rawOpen = raw; d.rawSince = ms; }
    if (raw != d.open && ms - d.rawSince >= REED_DEBOUNCE_MS) {
      d.open = raw;
      if (d.open) {
        d.irA = d.irB = false; d.irASince = d.irBSince = 0; d.removalSent = false;
        enqueue("drawer_open", slot);
      } else {
        enqueue("drawer_close", slot);
        if (!d.removalSent) enqueue("interaction_rejected", slot, 1, 0, 0);   // opened, but no hand seen
      }
    }
    if (!d.open) continue;

    bool a = digitalRead(IR_A_PINS[i]) == IR_ACTIVE_LEVEL;
    bool b = digitalRead(IR_B_PINS[i]) == IR_ACTIVE_LEVEL;
    if (a) { if (!d.irASince) d.irASince = ms; if (ms - d.irASince >= IR_MIN_ACTIVE_MS) d.irA = true; } else d.irASince = 0;
    if (b) { if (!d.irBSince) d.irBSince = ms; if (ms - d.irBSince >= IR_MIN_ACTIVE_MS) d.irB = true; } else d.irBSince = 0;

    if ((d.irA || d.irB) && !d.removalSent) {
      d.removalSent = true;
      enqueue("removal_detected", slot, 1, d.irA, d.irB);
      if (!refillMode) {
        cancelAlarmsForSlot(slot);
        lcdShow(String("Taken: ") + drawerNames[i], "Thank you!", 3000);
      } else {
        lcdShow("REFILL MODE", String("Drawer ") + slot + " opened", 2000);
      }
    }
  }
}

// Refill switch + optional power-loss input
bool refillRaw = false; uint32_t refillSince = 0;
#if POWER_SENSE_PIN >= 0
bool powerLost = false;
#endif

void switchTask() {
  uint32_t ms = millis();
  bool raw = digitalRead(REFILL_SWITCH_PIN) == REFILL_ON_LEVEL;
  if (raw != refillRaw) { refillRaw = raw; refillSince = ms; }
  if (raw != refillMode && ms - refillSince >= SWITCH_DEBOUNCE_MS) {
    refillMode = raw;
    enqueue(refillMode ? "refill_start" : "refill_end");
    if (refillMode) buzzStop();
    lcdShow(refillMode ? "REFILL MODE ON" : "Refill finished", refillMode ? "Doses not counted" : "Back to normal", 3000);
    sendHeartbeat();
  }
#if POWER_SENSE_PIN >= 0
  bool lost = digitalRead(POWER_SENSE_PIN) == LOW;
  if (lost && !powerLost) {
    powerLost = true;
    enqueue("power_off");
    saveQueue();
    flushEvents();
  } else if (!lost && powerLost) {
    powerLost = false;
    enqueue("boot");
  }
#endif
}

// =========================================================================================
//  Idle screen
// =========================================================================================
void idleScreenTask() {
  static uint32_t last = 0;
  if (millis() < lcdHoldUntil || millis() - last < 1000) return;
  last = millis();
  String l1 = "MediGuardian";
  if (timeValid()) {
    time_t local = (time_t)nowEpoch() + utcOffsetMin * 60;
    struct tm tmv; gmtime_r(&local, &tmv);
    char hhmm[6]; strftime(hhmm, sizeof(hhmm), "%H:%M", &tmv);
    l1 = String("MediGuard ") + hhmm;
  }
  String l2;
  if (refillMode) l2 = "REFILL MODE";
  else if (WiFi.status() != WL_CONNECTED) { l2 = String("No WiFi"); if (qCount) l2 += String(" (") + String(qCount) + String(")"); }
  else if (!nsConnected) l2 = "Server...";
  else if (unpaired || !serverSaysPaired) l2 = "Not paired";
  else {
    uint32_t now = nowEpoch(); uint32_t best = 0; uint8_t slot = 0;
    for (uint8_t i = 0; i < alarmCount; i++)
      if (!alarms[i].done && alarms[i].at > now && (!best || alarms[i].at < best)) { best = alarms[i].at; slot = alarms[i].slot; }
    if (best) {
      time_t local = (time_t)best + utcOffsetMin * 60;
      struct tm tmv; gmtime_r(&local, &tmv);
      char hhmm[6]; strftime(hhmm, sizeof(hhmm), "%H:%M", &tmv);
      l2 = String("Next ") + hhmm + " " + drawerNames[slot - 1];
    } else l2 = "Online";
  }
  lcdWrite(0, l1);
  lcdWrite(1, l2);
}

// =========================================================================================
//  Setup / loop
// =========================================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\nMediGuardian box firmware %s\n", FW_VERSION);

  for (uint8_t i = 0; i < 4; i++) {
    pinMode(REED_PINS[i], INPUT_PULLUP);
    pinMode(IR_A_PINS[i], INPUT);
    pinMode(IR_B_PINS[i], INPUT);
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  pinMode(BUZZER_PIN, OUTPUT);
  buzzerWrite(false);
  pinMode(REFILL_SWITCH_PIN, INPUT_PULLUP);
#if POWER_SENSE_PIN >= 0
  pinMode(POWER_SENSE_PIN, INPUT);
#endif

  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  lcdShow("MediGuardian", "Starting...", 1500);

  // UTC everywhere; the LCD adds the patient's offset itself.
  setenv("TZ", "UTC0", 1);
  tzset();

  uint64_t mac = ESP.getEfuseMac();
  char tag[7];
  snprintf(tag, sizeof(tag), "%06lx", (unsigned long)(mac >> 24) & 0xFFFFFF);
  chipTag = tag;

  prefs.begin("mediguardian", false);
  bootCount = prefs.getUInt("boots", 0) + 1;
  prefs.putUInt("boots", bootCount);
  loadQueue();
  loadConfig();

  // Initial switch state (so we don't report a refill change at boot)
  refillMode = refillRaw = digitalRead(REFILL_SWITCH_PIN) == REFILL_ON_LEVEL;
  for (uint8_t i = 0; i < 4; i++) {
    drawers[i].open = drawers[i].rawOpen = digitalRead(REED_PINS[i]) == REED_OPEN_LEVEL;
    drawers[i].removalSent = true;   // a drawer already open at boot doesn't count as a removal
  }

  enqueue("boot");

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);

  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
  setenv("TZ", "UTC0", 1);
  tzset();

#if USE_TLS
  io.beginSSL(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4");
#else
  io.begin(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4");
#endif
  io.onEvent(socketEvent);
  Serial.printf("[io] server %s:%d (%s)\n", SERVER_HOST, SERVER_PORT, USE_TLS ? "wss" : "ws");
}

void loop() {
  static bool wifiWasUp = false;
  bool wifiUp = WiFi.status() == WL_CONNECTED;
  if (wifiUp != wifiWasUp) {
    wifiWasUp = wifiUp;
    if (wifiUp) Serial.printf("[wifi] connected, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    else { Serial.println("[wifi] lost"); nsConnected = false; }
  }

  if (wifiUp) io.loop();

  // Transport is up but the namespace join failed (e.g. token rejected): retry every 30 s.
  if (wifiUp && io.isConnected() && !nsConnected && (int32_t)(millis() - nsRetryAt) >= 0) {
    String join = String(NS) + ",{\"token\":\"" + DEVICE_TOKEN + "\"}";
    io.send(sIOtype_CONNECT, join);
    nsRetryAt = millis() + 30000;
  }

  // Local work never waits for the network.
  drawerTask();
  switchTask();
  alarmTask();
  buzzerTask();
  idleScreenTask();

  if (nsConnected) {
    if (millis() - lastHeartbeatMs >= heartbeatIntervalMs) sendHeartbeat();
    if (qCount && !flushInFlight) flushEvents();
    else if (flushInFlight && millis() - flushSentMs > 15000) flushEvents();
    // Alarm list running out (server sends 48 h ahead): ask again.
    if (timeValid() && configValidUntil && nowEpoch() > configValidUntil && millis() - lastConfigRequestMs > 60000) requestConfig(true);
  }

  // Persist the queue at most every 2 s (flash wear) after a change.
  if (queueDirtyAt && millis() - queueDirtyAt > 2000) { saveQueue(); queueDirtyAt = 0; }

  delay(5);
}
