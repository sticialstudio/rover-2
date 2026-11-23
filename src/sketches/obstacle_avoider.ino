// ROVER 2.0 - Obstacle avoider
// Drives forwards until something is close, then backs up and turns away.

#include <AFMotor.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

const int TRIG_PIN = A0;
const int ECHO_PIN = A1;

const int SAFE_CM = 25;    // anything closer than this is an obstacle
const int SPEED = 170;     // 0-255

// Run both motors on one side. speed: -255 (backwards) to 255 (forwards).
void setSide(AF_DCMotor &a, AF_DCMotor &b, int speed) {
  uint8_t dir = speed > 0 ? FORWARD : (speed < 0 ? BACKWARD : RELEASE);
  a.setSpeed(abs(speed));
  b.setSpeed(abs(speed));
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
  long us = pulseIn(ECHO_PIN, HIGH, 30000);
  if (us == 0) return 999;
  return us / 58;
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  drive(0, 0);
  delay(2000);             // 2 seconds to put the rover down
}

void loop() {
  long cm = readDistanceCm();

  if (cm > SAFE_CM) {
    drive(SPEED, SPEED);   // path is clear: go forwards
  } else {
    drive(0, 0);           // stop
    delay(200);
    drive(-SPEED, -SPEED); // back up a little
    delay(400);
    drive(SPEED, -SPEED);  // spin right on the spot
    delay(350);
  }

  delay(40);
}
