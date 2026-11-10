#pragma once
// =====================================================================================
//  Fill these in before flashing. Do NOT commit this file with real values.
// =====================================================================================

// Your Wi-Fi (2.4 GHz only — the ESP32 cannot join 5 GHz networks)
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// Backend (Node.js server) address AS SEEN FROM THE ESP32.
//  - Local development: your PC's LAN IP from `ipconfig` (Windows) / `ip a` (Linux), e.g. "192.168.1.23".
//    NEVER "localhost" — on the ESP32 that means the ESP32 itself.
//  - Production: your API domain, e.g. "api.example.com", with SERVER_PORT 443 and USE_TLS 1.
#define SERVER_HOST     "192.168.1.23"
#define SERVER_PORT     4000
#define USE_TLS         0        // 1 = wss:// (HTTPS deployments). 0 = ws:// (local network only)

// The device token printed ONCE by `npm run register-box` (starts with mgd_). One token per physical box.
#define DEVICE_TOKEN    "mgd_PASTE_THE_TOKEN_FROM_REGISTER_BOX_HERE"
