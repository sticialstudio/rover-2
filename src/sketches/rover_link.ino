// ROVER 2.0 - Web control
// Drive the rover from the ROVER 2.0 website (Drive tab > Real rover), or run your block
// programs on it live (Missions tab > Real rover).
// Takes the same letters as bluetooth_remote.ino, from Bluetooth OR the USB cable,
// and sends the sensor readings back 10 times a second:
//   T,<distance cm>,<IR left 0/1>,<IR right 0/1>
//
//   F forwards   B backwards   L left   R right   S stop
//   G forwards-left   I forwards-right   H backwards-left   J backwards-right
//   0-9 speed (0 slow, 9 fast)   q full speed
//   M<left>,<right>  each side's speed, -255 to 255, then a new line (e.g. M170,-60)
//   ?  answers "ROVER 2.0 link v2" (the website checks it has this version)

#include <AFMotor.h>
#include <SoftwareSerial.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

SoftwareSerial bt(A4, A5); // RX = A4 (module TXD), TX = A5 (module RXD)

const int TRIG_PIN = A0;
const int ECHO_PIN = A1;
const int IR_LEFT  = A2;
const int IR_RIGHT = A3;

int speed = 200;
unsigned long lastCommand = 0;
unsigned long lastReport = 0;
const unsigned long FAILSAFE_MS = 1000;  // stop if the website goes quiet
const unsigned long REPORT_MS = 100;     // send sensor readings 10 times a second

char cmd[16];                            // an "M<left>,<right>" command being received
int cmdLen = -1;                         // -1: not receiving one

void setSide(AF_DCMotor &a, AF_DCMotor &b, int s) {
  uint8_t dir = s > 0 ? FORWARD : (s < 0 ? BACKWARD : RELEASE);
  a.setSpeed(abs(s));
  b.setSpeed(abs(s));
  a.run(dir);
  b.run(dir);
}

void drive(int left, int right) {
  setSide(frontLeft, rearLeft, left);
  setSide(frontRight, rearRight, right);
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 25000);
  if (us == 0) return 999;
  return us / 58;
}

// Act on one letter, whichever port it came from.
void handle(char c) {
  lastCommand = millis();
  if (c >= '0' && c <= '9') {
    speed = map(c - '0', 0, 9, 90, 255);
    return;
  }
  switch (c) {
    case 'q': speed = 255; break;
    case 'F': drive(speed, speed); break;
    case 'B': drive(-speed, -speed); break;
    case 'L': drive(-speed, speed); break;
    case 'R': drive(speed, -speed); break;
    case 'G': drive(speed / 3, speed); break;
    case 'I': drive(speed, speed / 3); break;
    case 'H': drive(-speed / 3, -speed); break;
    case 'J': drive(-speed, -speed / 3); break;
    case 'S': drive(0, 0); break;
  }
}

// Set both sides from "<left>,<right>" (block programs send these).
void motorsCommand(char *s) {
  char *comma = strchr(s, ',');
  if (!comma) return;
  *comma = 0;
  int left = constrain(atoi(s), -255, 255);
  int right = constrain(atoi(comma + 1), -255, 255);
  lastCommand = millis();
  drive(left, right);
}

// One byte from either port: "M..." commands are collected up to the end of the line,
// everything else is a one-letter command.
void handleByte(char c) {
  if (cmdLen >= 0) {
    if (c == '\n' || c == '\r') {
      cmd[cmdLen] = 0;
      motorsCommand(cmd);
      cmdLen = -1;
    } else if (cmdLen < (int)sizeof(cmd) - 1) {
      cmd[cmdLen++] = c;
    } else {
      cmdLen = -1;             // too long: not a real command, drop it
    }
    return;
  }
  if (c == 'M') {
    cmdLen = 0;
  } else if (c == '?') {
    Serial.println("ROVER 2.0 link v2");
    bt.println("ROVER 2.0 link v2");
  } else {
    handle(c);
  }
}

void report() {
  long cm = readDistanceCm();
  int left = digitalRead(IR_LEFT);
  int right = digitalRead(IR_RIGHT);
  char line[24];
  snprintf(line, sizeof(line), "T,%ld,%d,%d", cm, left, right);
  Serial.println(line);
  bt.println(line);
}

void setup() {
  Serial.begin(9600);      // USB cable
  bt.begin(9600);          // Bluetooth module
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IR_LEFT, INPUT);
  pinMode(IR_RIGHT, INPUT);
  drive(0, 0);
  Serial.println("ROVER 2.0 ready");
  bt.println("ROVER 2.0 ready");
}

void loop() {
  while (bt.available()) handleByte(bt.read());
  while (Serial.available()) handleByte(Serial.read());

  if (millis() - lastReport >= REPORT_MS) {
    lastReport = millis();
    report();
  }

  // Safety: no command for a while (out of range, tab closed) -> stop.
  if (millis() - lastCommand > FAILSAFE_MS) {
    drive(0, 0);
  }
}
