// ROVER 2.0 - Motor test
// Spins each wheel forwards, then backwards, one at a time.
// Prop the rover up so the wheels are off the table!
//
// Needs the "Adafruit Motor Shield library" (V1, AFMotor.h).

#include <AFMotor.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

AF_DCMotor* wheels[] = { &frontLeft, &rearLeft, &rearRight, &frontRight };
const char* names[] = { "front-left (M1)", "rear-left (M2)", "rear-right (M3)", "front-right (M4)" };

void setup() {
  Serial.begin(9600);
  Serial.println("Motor test: watch each wheel.");
  for (int i = 0; i < 4; i++) {
    wheels[i]->setSpeed(180);  // 0 = stopped, 255 = full speed
  }
}

void loop() {
  for (int i = 0; i < 4; i++) {
    Serial.print("Forwards:  ");
    Serial.println(names[i]);
    wheels[i]->run(FORWARD);
    delay(1000);

    Serial.print("Backwards: ");
    Serial.println(names[i]);
    wheels[i]->run(BACKWARD);
    delay(1000);

    wheels[i]->run(RELEASE);   // stop this wheel
    delay(500);
  }
  delay(2000);                 // pause, then test them all again
}
