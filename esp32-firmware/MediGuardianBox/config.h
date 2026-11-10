#pragma once
// =====================================================================================
//  MediGuardian box — hardware configuration.  CHECK EVERY PIN AGAINST YOUR WIRING.
//  Board: ESP32 DevKit V1 (ESP32-WROOM-32). 4 drawers, each with:
//     1 reed switch (drawer open/closed)  +  2 IR obstacle sensors (hand inside: A and B)  +  1 LED
//  Shared: buzzer, 16x2 I2C LCD, refill-mode switch, (optional) power-loss sense input.
// =====================================================================================

#define FW_VERSION "2.0.0"

// ---------- Drawer pins (index 0 = drawer 1 ... index 3 = drawer 4) ----------
// Reed switch between the pin and GND, internal pull-up used.
static const uint8_t REED_PINS[4] = {13, 14, 27, 26};
// IR modules (FC-51 / TCRT5000 boards) drive their OUT pin themselves, so input-only pins 34-39 are fine.
static const uint8_t IR_A_PINS[4] = {34, 35, 36, 39};
// NOTE: GPIO16/17 are used by PSRAM on WROVER modules. On a WROVER board move these (e.g. to 2 and 15).
static const uint8_t IR_B_PINS[4] = {32, 33, 16, 17};
// Drawer LEDs (through a 220-330 ohm resistor to GND).
static const uint8_t LED_PINS[4] = {18, 19, 23, 25};

// ---------- Shared I/O ----------
#define BUZZER_PIN        5      // active buzzer (or transistor driving one). See BUZZER_PASSIVE.
#define BUZZER_PASSIVE    0      // 1 = passive piezo (driven with tone()), 0 = active buzzer (HIGH = sound)
#define REFILL_SWITCH_PIN 4      // toggle switch to GND = refill mode ON
#define POWER_SENSE_PIN   -1     // optional: input that goes LOW when mains power is lost. -1 = not fitted.
#define LCD_SDA           21
#define LCD_SCL           22
#define LCD_I2C_ADDR      0x27   // common values: 0x27 or 0x3F (run an I2C scanner if the LCD stays blank)

// ---------- Sensor polarity ----------
#define REED_OPEN_LEVEL   HIGH   // pull-up + reed to GND: magnet near (drawer closed) = LOW, drawer open = HIGH
#define IR_ACTIVE_LEVEL   LOW    // most IR obstacle modules pull OUT LOW when something is in front of them
#define REFILL_ON_LEVEL   LOW
#define BUZZER_ON_LEVEL   HIGH

// ---------- Timing ----------
#define REED_DEBOUNCE_MS     60     // drawer must be stable this long before open/close counts
#define IR_MIN_ACTIVE_MS     40     // IR must see the hand this long (filters flicker)
#define SWITCH_DEBOUNCE_MS   80
#define BUZZ_ON_MS           400    // reminder beep pattern
#define BUZZ_OFF_MS          250

// ---------- Limits ----------
#define MAX_ALARMS           64     // alarms held from the server (48 h window)
#define QUEUE_MAX            60     // events kept while offline (persisted in flash); oldest dropped when full
#define EVENTS_PER_BATCH     10
