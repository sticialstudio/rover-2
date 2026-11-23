// ROVER 2.0 - Sensor check
// Prints the distance and both IR sensors to the Serial Monitor.
// Open Tools > Serial Monitor and set it to 9600 baud.

const int TRIG_PIN = A0;   // ultrasonic Trig
const int ECHO_PIN = A1;   // ultrasonic Echo
const int IR_LEFT  = A2;   // left IR OUT
const int IR_RIGHT = A3;   // right IR OUT

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IR_LEFT, INPUT);
  pinMode(IR_RIGHT, INPUT);
}

// Send a ping and time the echo. Returns centimetres (999 = nothing in range).
long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);              // a 10 us pulse starts a measurement
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 30000);  // wait up to 30 ms for the echo
  if (us == 0) return 999;
  return us / 58;                            // sound takes ~58 us per cm, there and back
}

void loop() {
  long cm = readDistanceCm();
  int left = digitalRead(IR_LEFT);
  int right = digitalRead(IR_RIGHT);

  Serial.print("Distance: ");
  Serial.print(cm);
  Serial.print(" cm   IR left: ");
  Serial.print(left == HIGH ? "dark " : "light");
  Serial.print("   IR right: ");
  Serial.println(right == HIGH ? "dark" : "light");

  delay(200);                                // about 5 readings a second
}
