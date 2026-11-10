# ESP32 box — wiring, flashing and testing

Firmware: `esp32-firmware/MediGuardianBox/` (open `MediGuardianBox.ino` in Arduino IDE).
Pins and sensor polarity are in `config.h`; Wi-Fi, server address and device token are in `secrets.h`.

## 1. Default wiring (ESP32 DevKit V1 / ESP32-WROOM-32)
| part | drawer 1 | drawer 2 | drawer 3 | drawer 4 | notes |
|---|---|---|---|---|---|
| Reed switch (drawer open/closed) | GPIO13 | GPIO14 | GPIO27 | GPIO26 | other leg to GND; internal pull-up; magnet on the drawer |
| IR sensor A (hand) | GPIO34 | GPIO35 | GPIO36 (VP) | GPIO39 (VN) | module OUT pin; module VCC 3.3 V; LOW = hand |
| IR sensor B (hand) | GPIO32 | GPIO33 | GPIO16 | GPIO17 | 16/17 are not usable on WROVER (PSRAM) boards |
| Drawer LED | GPIO18 | GPIO19 | GPIO23 | GPIO25 | 220–330 Ω resistor to GND |

| shared part | pin | notes |
|---|---|---|
| Buzzer | GPIO5 | active buzzer (HIGH = sound). Passive piezo: set `BUZZER_PASSIVE 1` |
| Refill switch | GPIO4 | toggle switch to GND = refill mode ON |
| LCD 16×2 I2C | SDA GPIO21, SCL GPIO22 | address 0x27 (or 0x3F). Power the backpack from 5 V **only** if its SDA/SCL pull-ups go to 3.3 V, otherwise use 3.3 V or a level shifter |
| Power-loss sense (optional) | `POWER_SENSE_PIN` | `-1` = not fitted |

Power IR modules from **3.3 V** so their output never exceeds the ESP32's 3.3 V inputs. If your hardware is wired
differently, change only `config.h` (pins + `REED_OPEN_LEVEL`, `IR_ACTIVE_LEVEL`, …).

## 2. Arduino IDE setup (once)
1. Install **Arduino IDE 2.x**.
2. *File → Preferences → Additional boards manager URLs*: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Tools → Board → Boards Manager* → install **esp32 by Espressif Systems**.
4. *Tools → Manage Libraries* → install:
   * **WebSockets** by Markus Sattler (links2004) — 2.6.1 or newer (contains `SocketIOclient`)
   * **ArduinoJson** by Benoit Blanchon — 7.x
   * **LiquidCrystal I2C** by Frank de Brabander
5. USB driver if the board doesn't show up: CP210x or CH340 (depends on your board's USB chip).

## 3. Give the box its identity
On the PC that runs the backend:
```powershell
cd mediguardian
npm run register-box -- --count 1
```
It prints a **box code**, a **pairing code** and a **device token** (`mgd_…`, shown once) and saves a QR image in `backend/qr-out/`.

## 4. Configure and flash
1. Find your PC's LAN IP: `ipconfig` → "IPv4 Address" of the Wi-Fi adapter (e.g. `192.168.1.23`).
2. Edit `secrets.h`: `WIFI_SSID`, `WIFI_PASSWORD` (2.4 GHz), `SERVER_HOST "192.168.1.23"`, `SERVER_PORT 4000`, `USE_TLS 0`, `DEVICE_TOKEN "mgd_…"`.
3. *Tools → Board*: **ESP32 Dev Module**, select the COM port, click **Upload** (hold BOOT if it says "Connecting….." forever).
4. *Tools → Serial Monitor* at **115200** baud. You should see:
   `[wifi] connected` → `[io] transport connected, joining /device` → `[io] joined /device` → `[config] vN applied`.

## 5. Pair it in the web app
My Boxes → **Add Box** → scan the QR from `backend/qr-out/` (or type box code + pairing code) → choose/create the patient.
The box gets its settings immediately (server push) and the card shows **Online** + **Live link**. Try **Ring box**.

## 6. Test procedure (per drawer)
| action | expected on the box | expected in the app |
|---|---|---|
| Add a medicine to drawer 1 at a time 2 min from now | LCD "Settings synced" within seconds | box card "Settings synced" |
| Wait for the time | drawer 1 LED on, buzzer 20 s, LCD shows the medicine | dose "Awaiting" |
| Open drawer 1 and put your hand in | buzzer stops, LCD "Taken: Morning" | dose **On time**, stock −1, live update |
| Open a drawer without a hand, close it | nothing | Reports → device events: `interaction_rejected` |
| Refill switch ON, open drawer, take out, switch OFF | LCD "REFILL MODE" | "Refill in progress", no stock used |
| Unplug the router 10 min, take a dose, plug back | reminder still runs, LCD "No WiFi (n)" | event appears after reconnect, classified by the time it happened |
| Caregiver presses **Ring box** | 4 s beep + "Caregiver ping" | toast "sent to the box" |

## 7. Production (HTTPS)
Deploy the backend behind HTTPS (e.g. `api.example.com`), then in `secrets.h`: `SERVER_HOST "api.example.com"`, `SERVER_PORT 443`, `USE_TLS 1`.
`USE_TLS 1` encrypts the link but `beginSSL()` does not verify the server certificate. For full verification,
switch to `io.beginSSLWithCA(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4", ROOT_CA)` with your host's root CA PEM.

## 8. Troubleshooting
| Serial Monitor shows | fix |
|---|---|
| stays at `[wifi] connecting` | wrong SSID/password, or a 5 GHz-only network |
| `[wifi] connected` but never `transport connected` | wrong `SERVER_HOST` (not `localhost`!), backend not running, different network, Windows Firewall (see README §7) |
| `connect error … unauthorized` / LCD "Check token" | `DEVICE_TOKEN` wrong or box retired. Register a new box and copy the token exactly |
| `[config] v… applied: 0 alarms` | no medicine assigned to a drawer of this box yet, or box not paired |
| LCD blank | adjust the contrast potentiometer on the I2C backpack; try `LCD_I2C_ADDR 0x3F` |
| drawer shows open when closed | flip `REED_OPEN_LEVEL` in `config.h` |
| removal never detected | check the IR module LED lights with your hand; flip `IR_ACTIVE_LEVEL`; adjust the module's sensitivity screw |
| Reboots when buzzer sounds | buzzer draws too much current: drive it through a transistor |
