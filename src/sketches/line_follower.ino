// ROVER 2.0 - Line follower
// Follows a dark line (e.g. black electrical tape) on a light floor.
// The line should run between the two IR sensors.

#include <AFMotor.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

const int IR_LEFT  = A2;
const int IR_RIGHT = A3;

// Most IR modules read HIGH over a dark line. If yours is the other way round, change this to LOW.
const int LINE = HIGH;

const int SPEED = 130;     // straight-line speed (0-255)
const int TURN  = 170;     // outer wheels while turning

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

void setup() {
  pinMode(IR_LEFT, INPUT);
  pinMode(IR_RIGHT, INPUT);
  drive(0, 0);
  delay(2000);             // 2 seconds to place the rover on the line
}

void loop() {
  bool leftOnLine  = digitalRead(IR_LEFT) == LINE;
  bool rightOnLine = digitalRead(IR_RIGHT) == LINE;

  if (!leftOnLine && !rightOnLine) {
    drive(SPEED, SPEED);   // line is between the sensors: straight on
  } else if (leftOnLine && !rightOnLine) {
    drive(-60, TURN);      // drifted right: turn left
  } else if (!leftOnLine && rightOnLine) {
    drive(TURN, -60);      // drifted left: turn right
  } else {
    drive(0, 0);           // both on the line: end of track, stop
  }
}
