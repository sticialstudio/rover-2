// ROVER 2.0 - Bluetooth remote
// Drive the rover from a phone. Pair with the module (PIN 1234 or 0000), then
// use any "Bluetooth RC car" app that sends these letters:
//   F forwards   B backwards   L left   R right   S stop
//   G forwards-left   I forwards-right   H backwards-left   J backwards-right
//   0-9 speed (0 slow, 9 fast)   q full speed

#include <AFMotor.h>
#include <SoftwareSerial.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

SoftwareSerial bt(A4, A5); // RX = A4 (module TXD), TX = A5 (module RXD)

int speed = 200;
unsigned long lastCommand = 0;
const unsigned long FAILSAFE_MS = 1000;  // stop if the phone goes quiet (0 = off)

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

void setup() {
  Serial.begin(9600);
  bt.begin(9600);          // HC-05 / HC-06 default speed
  drive(0, 0);
  Serial.println("Waiting for the phone...");
}

void loop() {
  if (bt.available()) {
    char c = bt.read();
    lastCommand = millis();

    if (c >= '0' && c <= '9') {
      speed = map(c - '0', 0, 9, 90, 255);    // speed slider
    } else if (c == 'q') {
      speed = 255;
    }

    switch (c) {
      case 'F': drive(speed, speed); break;
      case 'B': drive(-speed, -speed); break;
      case 'L': drive(-speed, speed); break;  // spin left
      case 'R': drive(speed, -speed); break;  // spin right
      case 'G': drive(speed / 3, speed); break;
      case 'I': drive(speed, speed / 3); break;
      case 'H': drive(-speed / 3, -speed); break;
      case 'J': drive(-speed, -speed / 3); break;
      case 'S': drive(0, 0); break;
    }
  }

  // Safety: no command for a while (out of range, app closed) -> stop.
  if (FAILSAFE_MS > 0 && millis() - lastCommand > FAILSAFE_MS) {
    drive(0, 0);
  }
}
