// Arduino programs for ROVER 2.0, from a first motor test to phone control.
// The sketches live in src/sketches/*.ino (real files: open them in the Arduino IDE).
// All five compile for the Arduino UNO with the "Adafruit Motor Shield library" (V1, AFMotor.h).
// Pins match src/data/wiring.ts.
//
// Flowcharts: each node can point at lines of its sketch with `code`:
//   'text'                 -> the first line containing "text"
//   ['text', 3]            -> that line and the 2 after it
//   ['text', 1, 2]         -> the 2nd line containing "text"
// Hovering a node highlights those lines (and `part` in 3D).

import motorTest from '../sketches/motor_test.ino?raw'
import sensorCheck from '../sketches/sensor_check.ino?raw'
import obstacleAvoider from '../sketches/obstacle_avoider.ino?raw'
import lineFollower from '../sketches/line_follower.ino?raw'
import bluetoothRemote from '../sketches/bluetooth_remote.ino?raw'
import roverLink from '../sketches/rover_link.ino?raw'

export type CodeRef = string | [string, number] | [string, number, number]

interface NodeBase {
  id: string
  text: string
  code?: CodeRef[]
  /** part id to glow in 3D while the node is hovered */
  part?: string
}
export interface StepNode extends NodeBase {
  /** step: do something · io: talk to hardware · wait: delay */
  kind: 'step' | 'io' | 'wait'
}
export interface IfNode extends NodeBase {
  kind: 'if'
  branches: { label: string; nodes: FlowNode[] }[]
}
export interface RepeatNode extends NodeBase {
  kind: 'repeat'
  nodes: FlowNode[]
}
export type FlowNode = StepNode | IfNode | RepeatNode

export interface Program {
  id: string
  file: string
  title: string
  summary: string
  level: 1 | 2 | 3
  /** what this program teaches */
  learn: string[]
  /** part ids it uses (shown solid in 3D) */
  parts: string[]
  source: string
  setup: FlowNode[]
  loop: FlowNode[]
  tryIt: string[]
  tip?: string
  caution?: string
}

export const PROGRAMS: Program[] = [
  {
    id: 'motor-test',
    file: 'motor_test.ino',
    title: 'Motor test',
    summary: 'Spins each wheel forwards and backwards, one at a time. Run this first to check your motor wiring.',
    level: 1,
    learn: ['setup() and loop()', 'for loops', 'Motor speed & direction'],
    parts: ['motors', 'motor_shield', 'arduino_uno'],
    source: motorTest,
    setup: [
      { id: 'serial', kind: 'step', text: 'Open the USB serial link', code: [['Serial.begin(9600);', 2]] },
      { id: 'speed', kind: 'step', text: 'Set every wheel to speed 180', part: 'motors', code: [['for (int i = 0; i < 4; i++) {', 3]] },
    ],
    loop: [
      {
        id: 'each',
        kind: 'repeat',
        text: 'For each of the 4 wheels',
        code: [['for (int i = 0; i < 4; i++) {', 1, 2]],
        nodes: [
          { id: 'fwd', kind: 'io', text: 'Spin forwards for 1 s', part: 'motors', code: [['Serial.print("Forwards', 4]] },
          { id: 'back', kind: 'io', text: 'Spin backwards for 1 s', part: 'motors', code: [['Serial.print("Backwards', 4]] },
          { id: 'stop', kind: 'step', text: 'Stop, wait ½ s', part: 'motors', code: [['wheels[i]->run(RELEASE);', 2]] },
        ],
      },
      { id: 'pause', kind: 'wait', text: 'Wait 2 s', code: ['delay(2000);'] },
    ],
    tryIt: [
      'Put the rover on a box so the wheels spin freely.',
      'Upload the sketch, then switch the battery ON.',
      'Open the Serial Monitor (9600 baud) to see which wheel should be moving.',
      'Every wheel should spin forwards (top of the tyre moving towards the front) first.',
    ],
    tip: 'A wheel spinning backwards when it should go forwards? Swap that motor’s two wires on the shield.',
  },
  {
    id: 'sensor-check',
    file: 'sensor_check.ino',
    title: 'Sensor check',
    summary: 'Reads the ultrasonic distance and both IR sensors and prints them to your computer. No motors.',
    level: 1,
    learn: ['Serial Monitor', 'digitalRead()', 'Timing an echo with pulseIn()'],
    parts: ['ultrasonic_sensor', 'ir_sensors', 'arduino_uno'],
    source: sensorCheck,
    setup: [
      { id: 'serial', kind: 'step', text: 'Open the USB serial link', code: ['Serial.begin(9600);'] },
      { id: 'pins', kind: 'step', text: 'Set up the sensor pins', code: [['pinMode(TRIG_PIN', 4]] },
    ],
    loop: [
      {
        id: 'ping',
        kind: 'io',
        text: 'Ping! Measure the distance',
        part: 'ultrasonic_sensor',
        code: ['long cm = readDistanceCm();', ['long readDistanceCm() {', 10]],
      },
      { id: 'ir', kind: 'io', text: 'Read both IR sensors', part: 'ir_sensors', code: [['int left = digitalRead', 2]] },
      { id: 'print', kind: 'io', text: 'Print the readings', part: 'arduino_uno', code: [['Serial.print("Distance', 6]] },
      { id: 'wait', kind: 'wait', text: 'Wait 0.2 s', code: ['delay(200);'] },
    ],
    tryIt: [
      'Upload the sketch with the USB cable. The battery can stay OFF.',
      'Open Tools → Serial Monitor and pick 9600 baud.',
      'Move your hand towards the ultrasonic sensor: the distance should drop.',
      'Slide a sheet of white paper, then some black tape, under each IR sensor.',
    ],
    tip: 'IR always reads "dark"? Turn the little blue screw on the sensor until its LED switches as you move it over the tape.',
  },
  {
    id: 'obstacle',
    file: 'obstacle_avoider.ino',
    title: 'Obstacle avoider',
    summary: 'Drives forwards and turns away from anything closer than 25 cm. Your first self-driving robot.',
    level: 2,
    learn: ['if / else decisions', 'Functions', 'Driving both sides'],
    parts: ['ultrasonic_sensor', 'motors', 'motor_shield', 'arduino_uno'],
    source: obstacleAvoider,
    setup: [
      { id: 'pins', kind: 'step', text: 'Set up the sensor pins', code: [['pinMode(TRIG_PIN', 2]] },
      { id: 'start', kind: 'wait', text: 'Motors off, wait 2 s', code: [['drive(0, 0);', 2]] },
    ],
    loop: [
      {
        id: 'ping',
        kind: 'io',
        text: 'Measure the distance',
        part: 'ultrasonic_sensor',
        code: ['long cm = readDistanceCm();', ['long readDistanceCm() {', 10]],
      },
      {
        id: 'clear',
        kind: 'if',
        text: 'Farther than 25 cm?',
        code: ['if (cm > SAFE_CM) {', '} else {'],
        branches: [
          { label: 'Yes', nodes: [{ id: 'fwd', kind: 'io', text: 'Drive forwards', part: 'motors', code: ['// path is clear'] }] },
          {
            label: 'No',
            nodes: [
              { id: 'stop', kind: 'io', text: 'Stop', part: 'motors', code: [['// stop', 2]] },
              { id: 'reverse', kind: 'io', text: 'Back up', part: 'motors', code: [['// back up', 2]] },
              { id: 'turn', kind: 'io', text: 'Spin right', part: 'motors', code: [['// spin right', 2]] },
            ],
          },
        ],
      },
      { id: 'tick', kind: 'wait', text: 'Wait 40 ms', code: ['delay(40);'] },
    ],
    tryIt: [
      'Upload, unplug the USB cable and switch the battery ON.',
      'You have 2 seconds to put the rover on the floor.',
      'Walk in front of it, or point it at a wall, and watch it turn away.',
    ],
    tip: 'Change SAFE_CM and SPEED at the top of the sketch to make it braver or more careful.',
    caution: 'Soft things (cushions, curtains) absorb sound and may not be seen. Keep it away from stairs.',
  },
  {
    id: 'line',
    file: 'line_follower.ino',
    title: 'Line follower',
    summary: 'Follows a dark line on a light floor by steering away from whichever sensor sees the line.',
    level: 2,
    learn: ['bool variables', 'else if chains', 'Steering by speed difference'],
    parts: ['ir_sensors', 'motors', 'motor_shield', 'arduino_uno'],
    source: lineFollower,
    setup: [
      { id: 'pins', kind: 'step', text: 'Set up the IR pins', code: [['pinMode(IR_LEFT', 2]] },
      { id: 'start', kind: 'wait', text: 'Motors off, wait 2 s', code: [['drive(0, 0);', 2]] },
    ],
    loop: [
      { id: 'read', kind: 'io', text: 'Read both IR sensors', part: 'ir_sensors', code: [['bool leftOnLine', 2]] },
      {
        id: 'which',
        kind: 'if',
        text: 'Which sensor sees the line?',
        code: ['if (!leftOnLine && !rightOnLine) {', '} else if (leftOnLine', '} else if (!leftOnLine', '} else {'],
        branches: [
          { label: 'Neither', nodes: [{ id: 'straight', kind: 'io', text: 'Straight on', part: 'motors', code: ['// line is between'] }] },
          { label: 'Left', nodes: [{ id: 'left', kind: 'io', text: 'Turn left', part: 'motors', code: ['// drifted right'] }] },
          { label: 'Right', nodes: [{ id: 'right', kind: 'io', text: 'Turn right', part: 'motors', code: ['// drifted left'] }] },
          { label: 'Both', nodes: [{ id: 'end', kind: 'io', text: 'Stop', part: 'motors', code: ['// both on the line'] }] },
        ],
      },
    ],
    tryIt: [
      'Make a loop of black electrical tape (about 2 cm wide) on a light floor, with gentle curves.',
      'Upload, unplug USB, switch ON and place the rover with the tape between the two sensors.',
      'If it turns the wrong way at every curve, change LINE to LOW.',
    ],
    tip: 'Too wobbly? Lower SPEED. Missing sharp curves? Raise TURN.',
  },
  {
    id: 'bluetooth',
    file: 'bluetooth_remote.ino',
    title: 'Bluetooth remote',
    summary: 'Drive the rover from your phone. Each button in the app sends one letter, and the rover obeys.',
    level: 3,
    learn: ['SoftwareSerial', 'switch / case', 'A safety failsafe with millis()'],
    parts: ['bluetooth_module', 'motors', 'motor_shield', 'arduino_uno'],
    source: bluetoothRemote,
    setup: [
      { id: 'serial', kind: 'step', text: 'Start USB and Bluetooth serial', part: 'bluetooth_module', code: [['Serial.begin(9600);', 2]] },
      { id: 'off', kind: 'step', text: 'Motors off', part: 'motors', code: [['drive(0, 0);', 1, 1]] },
    ],
    loop: [
      {
        id: 'got',
        kind: 'if',
        text: 'Did a letter arrive?',
        part: 'bluetooth_module',
        code: ['if (bt.available()) {'],
        branches: [
          {
            label: 'Yes',
            nodes: [
              { id: 'read', kind: 'io', text: 'Read the letter', part: 'bluetooth_module', code: [['char c = bt.read();', 2]] },
              { id: 'speed', kind: 'step', text: '0–9 or q: set the speed', code: [["if (c >= '0'", 5]] },
              { id: 'cmd', kind: 'io', text: 'F B L R …: drive that way', part: 'motors', code: [['switch (c) {', 11]] },
            ],
          },
          { label: 'No', nodes: [] },
        ],
      },
      {
        id: 'quiet',
        kind: 'if',
        text: 'Silent for over 1 s?',
        code: ['if (FAILSAFE_MS > 0'],
        branches: [
          { label: 'Yes', nodes: [{ id: 'failsafe', kind: 'io', text: 'Stop (failsafe)', part: 'motors', code: [['drive(0, 0);', 1, 3]] }] },
          { label: 'No', nodes: [] },
        ],
      },
    ],
    tryIt: [
      'Upload, then switch the battery ON. The Bluetooth LED blinks fast.',
      'On your phone, pair with the module (often called HC-05 or HC-06, PIN 1234 or 0000).',
      'Open a "Bluetooth RC car" app, connect, and drive. The LED blinks slowly once connected.',
    ],
    tip: 'Try it first in the Drive tab: the simulator runs this same sketch, with your keyboard playing the phone.',
    caution: 'The rover stops if it hears nothing for 1 second. If your app only sends a letter when a button changes, set FAILSAFE_MS to 0.',
  },
]

PROGRAMS.push({
  id: 'link',
  file: 'rover_link.ino',
  title: 'Web control',
  summary: 'Drive the real rover from this website (Drive tab → Real rover), or run your block programs on it live (Missions tab), and watch its sensors. Works over Bluetooth or the USB cable.',
  level: 3,
  learn: ['Listening on two serial ports', 'Sending data back (telemetry)', 'Timing with millis()'],
  parts: ['bluetooth_module', 'motors', 'ultrasonic_sensor', 'ir_sensors', 'motor_shield', 'arduino_uno'],
  source: roverLink,
  setup: [
    { id: 'serial', kind: 'step', text: 'Start USB and Bluetooth serial', part: 'bluetooth_module', code: [['Serial.begin(9600);', 2]] },
    { id: 'pins', kind: 'step', text: 'Set up the sensor pins', code: [['pinMode(TRIG_PIN', 4]] },
    { id: 'hello', kind: 'step', text: 'Motors off, say “ready”', code: [['drive(0, 0);', 3, 2]] },
  ],
  loop: [
    {
      id: 'cmd',
      kind: 'if',
      text: 'A command from Bluetooth or USB?',
      part: 'bluetooth_module',
      code: [['while (bt.available())', 2]],
      branches: [
        {
          label: 'Yes',
          nodes: [
            {
              id: 'handle',
              kind: 'io',
              text: 'Letter: drive that way. M left,right: set each side',
              part: 'motors',
              code: [['void handle(char c) {', 19], ['void handleByte(char c) {', 22], ['void motorsCommand(char *s) {', 9]],
            },
          ],
        },
        { label: 'No', nodes: [] },
      ],
    },
    {
      id: 'time',
      kind: 'if',
      text: '100 ms since the last report?',
      code: ['if (millis() - lastReport >= REPORT_MS) {'],
      branches: [
        {
          label: 'Yes',
          nodes: [
            {
              id: 'report',
              kind: 'io',
              text: 'Measure, send T,cm,L,R',
              part: 'ultrasonic_sensor',
              code: [['void report() {', 9], ['long readDistanceCm() {', 10], 'report();'],
            },
          ],
        },
        { label: 'No', nodes: [] },
      ],
    },
    {
      id: 'quiet',
      kind: 'if',
      text: 'Silent for over 1 s?',
      code: ['if (millis() - lastCommand > FAILSAFE_MS) {'],
      branches: [
        { label: 'Yes', nodes: [{ id: 'failsafe', kind: 'io', text: 'Stop (failsafe)', part: 'motors', code: [['drive(0, 0);', 1, 3]] }] },
        { label: 'No', nodes: [] },
      ],
    },
  ],
  tryIt: [
    'Upload with the USB cable, then put the rover on a box so the wheels are off the ground.',
    'Open the Drive tab, switch to Real rover and click Connect.',
    'Hold an arrow key: the wheels turn, and the distance and IR readings update live.',
    'When everything works, put it on the floor and drive.',
  ],
  tip: 'The website repeats the held letter (or the motor command of a running block program) every 150 ms, so the 1-second failsafe never trips while you are driving, but stops the rover if the link drops.',
  caution: 'Only one program can use the USB port. Disconnect in the website before uploading, and close the Serial Monitor before connecting.',
})

/** Resolve a node's code refs to 1-based line numbers. */
export function linesFor(source: string[], refs: CodeRef[] | undefined): number[] {
  if (!refs) return []
  const out: number[] = []
  for (const ref of refs) {
    const [text, span = 1, nth = 1] = typeof ref === 'string' ? [ref] : ref
    let seen = 0
    const i = source.findIndex((l) => l.includes(text) && ++seen === nth)
    if (i < 0) {
      console.warn(`[programs] no line contains "${text}" (#${nth})`)
      continue
    }
    for (let k = 0; k < span; k++) out.push(i + 1 + k)
  }
  return out
}

export function walk(nodes: FlowNode[], fn: (n: FlowNode) => void) {
  for (const n of nodes) {
    fn(n)
    if (n.kind === 'if') n.branches.forEach((b) => walk(b.nodes, fn))
    if (n.kind === 'repeat') walk(n.nodes, fn)
  }
}
