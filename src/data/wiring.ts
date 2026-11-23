// Wiring guide for ROVER 2.0.
// DRAFT: the 3D model shows where each wire runs. The Arduino pin numbers below are this
// guide's choice (the Code tab will use the same ones). Change them here if your kit's sketch
// uses different pins.
//
// `piece`: the Blender object of the wire (exact name); leave it out if the wire is not modelled.
// `color`: the colour drawn in the diagram (the 3D wire keeps its own material).

export type WireKind = 'power' | 'ground' | 'signal' | 'motor'

export interface Wire {
  id: string
  /** pin on the device, e.g. "Trig" */
  from: string
  /** pin on the shield / Arduino, e.g. "A0" */
  to: string
  color: string
  colorName: string
  kind: WireKind
  piece?: string
  /** device name when a group has more than one device (e.g. left / right IR) */
  device?: string
  /** piece to put the device-end tag on (and glow), when the modelled wire stops short of the device */
  anchor?: string
  /** piece the board end plugs into, when it is not the motor shield (e.g. the power switch) */
  boardPiece?: string
  note?: string
}

export interface WireGroup {
  id: string
  title: string
  summary: string
  /** device block in the diagram */
  device: string
  /** board block in the diagram */
  board: string
  /** part ids shown solid in 3D */
  parts: string[]
  /** extra pieces to highlight (header pins) */
  pieces?: string[]
  wires: Wire[]
  instructions: string[]
  tip?: string
  caution?: string
  /** shown when the wires are not in the 3D model */
  notModelled?: string
  /** camera direction (from the target), scene axes: +x = front, +y = up, +z = right side */
  view: [number, number, number]
}

const RED = '#e0362c'
const BLACK = '#2b2622'
const BROWN = '#7a4423'

export const WIRE_GROUPS: WireGroup[] = [
  {
    id: 'motors-left',
    title: 'Left motors → M1 & M2',
    summary: 'The two left wheels share one side of the motor shield.',
    device: 'Left TT motors',
    board: 'Motor shield',
    parts: ['motors', 'motor_shield'],
    pieces: ['pins.003', 'pins.004', 'pins.010', 'pins.011'],
    view: [0.2, 1.3, -1.0],
    wires: [
      { id: 'm1-a', device: 'Front-left motor', anchor: 'Dc Motor.001', from: 'Red lead', to: 'M1 · A', color: RED, colorName: 'Red', kind: 'motor', piece: 'BézierCurve.011' },
      { id: 'm1-b', device: 'Front-left motor', anchor: 'Dc Motor.001', from: 'Black lead', to: 'M1 · B', color: BROWN, colorName: 'Brown', kind: 'motor', piece: 'BézierCurve.010' },
      { id: 'm2-a', device: 'Rear-left motor', anchor: 'Dc Motor.002', from: 'Red lead', to: 'M2 · A', color: RED, colorName: 'Red', kind: 'motor', piece: 'BézierCurve.013' },
      { id: 'm2-b', device: 'Rear-left motor', anchor: 'Dc Motor.002', from: 'Black lead', to: 'M2 · B', color: BROWN, colorName: 'Brown', kind: 'motor', piece: 'BézierCurve.012' },
    ],
    instructions: [
      'Loosen the M1 and M2 screw terminals on the left edge of the shield.',
      'Push the front-left motor’s two wires into M1 and tighten the screws.',
      'Do the same for the rear-left motor in M2.',
      'Tug each wire gently: it should not pull out.',
    ],
    tip: 'If a wheel spins the wrong way later, swap that motor’s two wires. No code change needed.',
  },
  {
    id: 'motors-right',
    title: 'Right motors → M3 & M4',
    summary: 'The right wheels go on the other side, so each side can be driven on its own.',
    device: 'Right TT motors',
    board: 'Motor shield',
    parts: ['motors', 'motor_shield'],
    pieces: ['pins.002', 'pins.016', 'pins.012', 'pins.013'],
    view: [0.2, 1.3, 1.0],
    wires: [
      { id: 'm4-a', device: 'Front-right motor', anchor: 'Dc Motor', from: 'Red lead', to: 'M4 · A', color: RED, colorName: 'Red', kind: 'motor', piece: 'BézierCurve.015' },
      { id: 'm4-b', device: 'Front-right motor', anchor: 'Dc Motor', from: 'Black lead', to: 'M4 · B', color: BROWN, colorName: 'Brown', kind: 'motor', piece: 'BézierCurve.014' },
      { id: 'm3-a', device: 'Rear-right motor', anchor: 'Dc Motor.003', from: 'Red lead', to: 'M3 · A', color: RED, colorName: 'Red', kind: 'motor', piece: 'BézierCurve.017' },
      { id: 'm3-b', device: 'Rear-right motor', anchor: 'Dc Motor.003', from: 'Black lead', to: 'M3 · B', color: BROWN, colorName: 'Brown', kind: 'motor', piece: 'BézierCurve.016' },
    ],
    instructions: [
      'Put the front-right motor’s wires into M4.',
      'Put the rear-right motor’s wires into M3.',
      'Keep the red lead in the same terminal position (A) on every motor, so all four start out spinning the same way.',
    ],
    tip: 'M1/M2 are the left wheels and M3/M4 the right wheels. The Code tab uses these numbers.',
  },
  {
    id: 'ultrasonic',
    title: 'Ultrasonic sensor',
    summary: 'Four jumper wires from the HC-SR04 to the sensor header on the shield.',
    device: 'HC-SR04',
    board: 'Shield header',
    parts: ['ultrasonic_sensor', 'motor_shield'],
    pieces: ['pins.014', 'pins.015', 'pins.017', 'pins.020', 'pins.033', 'pins.034', 'pins.035', 'pins.036'],
    view: [1.1, 1.0, 0.9],
    wires: [
      { id: 'us-vcc', from: 'VCC', to: '5V', color: '#7d45c9', colorName: 'Purple', kind: 'power', piece: 'BézierCurve.009' },
      { id: 'us-trig', from: 'Trig', to: 'A0', color: '#8f8a84', colorName: 'Grey', kind: 'signal', piece: 'BézierCurve.008', note: 'Arduino sends the ping' },
      { id: 'us-echo', from: 'Echo', to: 'A1', color: '#efece6', colorName: 'White', kind: 'signal', piece: 'BézierCurve.007', note: 'Sensor answers with the echo time' },
      { id: 'us-gnd', from: 'GND', to: 'GND', color: BLACK, colorName: 'Black', kind: 'ground', piece: 'BézierCurve.006' },
    ],
    instructions: [
      'Read the pin names printed on the back of the HC-SR04: VCC, Trig, Echo, GND.',
      'Push a female jumper onto each pin.',
      'Connect VCC to 5V, GND to GND, Trig to A0 and Echo to A1.',
    ],
    tip: 'Go by the printed pin names, not the wire colours. Your jumpers may be different colours from the model.',
  },
  {
    id: 'ir',
    title: 'IR line sensors',
    summary: 'Each sensor needs power, ground and one signal wire.',
    device: 'IR sensors',
    board: 'Shield header',
    parts: ['ir_sensors', 'motor_shield'],
    pieces: ['pins.007', 'pins.008', 'pins.027', 'pins.028', 'pins.029', 'pins.030', 'pins.031', 'pins.032', 'pins.037', 'pins.038', 'pins.039', 'pins.040'],
    view: [1.3, 0.8, 0.2],
    wires: [
      { id: 'irl-vcc', device: 'Left IR', from: 'VCC', to: '5V', color: RED, colorName: 'Red', kind: 'power', piece: 'BézierCurve.005' },
      { id: 'irl-gnd', device: 'Left IR', from: 'GND', to: 'GND', color: '#f07d1f', colorName: 'Orange', kind: 'ground', piece: 'BézierCurve.004' },
      { id: 'irl-out', device: 'Left IR', from: 'OUT', to: 'A2', color: '#f2c21a', colorName: 'Yellow', kind: 'signal', piece: 'BézierCurve.003' },
      { id: 'irr-vcc', device: 'Right IR', from: 'VCC', to: '5V', color: RED, colorName: 'Red', kind: 'power', piece: 'BézierCurve' },
      { id: 'irr-gnd', device: 'Right IR', from: 'GND', to: 'GND', color: '#f07d1f', colorName: 'Orange', kind: 'ground', piece: 'BézierCurve.001' },
      { id: 'irr-out', device: 'Right IR', from: 'OUT', to: 'A3', color: '#f2c21a', colorName: 'Yellow', kind: 'signal', piece: 'BézierCurve.002' },
    ],
    instructions: [
      'Find which sensor is on the rover’s left (looking from behind, driving forwards).',
      'Left sensor: VCC to 5V, GND to GND, OUT to A2.',
      'Right sensor: VCC to 5V, GND to GND, OUT to A3.',
    ],
    tip: 'Each sensor has an LED that lights up when it sees a light floor. Use it to test them before the code is ready.',
  },
  {
    id: 'bluetooth',
    title: 'Bluetooth module',
    summary: 'Serial link to your phone. TX and RX cross over.',
    device: 'Bluetooth',
    board: 'Shield header',
    parts: ['bluetooth_module', 'motor_shield'],
    pieces: ['pins.009', 'pins.023', 'pins.024', 'pins.025', 'pins.026'],
    view: [-0.6, 1.3, -0.9],
    wires: [
      { id: 'bt-vcc', from: 'VCC', to: '5V', color: RED, colorName: 'Red', kind: 'power', piece: 'BézierCurve.022' },
      { id: 'bt-gnd', from: 'GND', to: 'GND', color: BLACK, colorName: 'Black', kind: 'ground', piece: 'BézierCurve.023' },
      { id: 'bt-txd', from: 'TXD', to: 'A4', color: '#2f9e6e', colorName: 'Green', kind: 'signal', piece: 'BézierCurve.021', note: 'Module talks → Arduino listens (RX)' },
      { id: 'bt-rxd', from: 'RXD', to: 'A5', color: '#3b7fc4', colorName: 'Blue', kind: 'signal', piece: 'BézierCurve.020', note: 'Arduino talks (TX) → module listens' },
    ],
    instructions: [
      'Connect VCC to 5V and GND to GND.',
      'Connect the module’s TXD to A4 and its RXD to A5.',
      'The code turns A4/A5 into a second serial port, so you can leave the module plugged in while you upload sketches.',
    ],
    caution:
      'The module’s RXD pin expects 3.3 V. Many kits connect it straight to 5 V without trouble, but a 1 kΩ + 2 kΩ divider on that one wire is the safe way.',
  },
  {
    id: 'power',
    title: 'Power (do this last)',
    summary: 'Battery → switch → the shield’s external power terminal.',
    device: 'Battery pack',
    board: 'Switch & shield',
    parts: ['battery_pack', 'power_switch', 'motor_shield'],
    pieces: ['pins.005', 'pins.006'],
    view: [-1.3, 1.1, 0.9],
    wires: [
      { id: 'pwr-bat', device: 'Battery pack', anchor: 'LX-2BUPS_Battery_Holder', from: 'OUT +', to: 'Switch', boardPiece: 'switch', color: RED, colorName: 'Red (thick)', kind: 'power', piece: 'BézierCurve.024', note: 'Comes soldered: battery + to the switch' },
      { id: 'pwr-neg', device: 'Battery pack', anchor: 'LX-2BUPS_Battery_Holder', from: 'OUT −', to: 'EXT_PWR −', color: BLACK, colorName: 'Black (thick)', kind: 'ground', piece: 'BézierCurve.019' },
      { id: 'pwr-pos', device: 'Power switch', anchor: 'switch', from: 'Switch', to: 'EXT_PWR +', color: RED, colorName: 'Red (thick)', kind: 'power', piece: 'BézierCurve.018', note: 'Only live when the switch is ON' },
    ],
    instructions: [
      'Check that the power switch is OFF.',
      'The pack and switch come soldered together: battery + to the switch, a long red wire from the switch, and a long black wire from battery −.',
      'Screw the long red wire (from the switch) into EXT_PWR +, and the black wire into EXT_PWR −.',
      'Look over every connection once more, then switch on. The shield’s power LED should light.',
    ],
    caution: 'Swapping + and − on EXT_PWR can destroy the motor driver chips. Red goes to +, every time.',
    tip: 'On the common L293D shield, the PWR jumper lets the battery power the Arduino too. Leave it fitted unless you power the UNO separately.',
  },
]

/** Arduino pins used by the rover, for the pin map. */
export const RESERVED_PINS: { pin: string; use: string }[] = [
  { pin: 'D3–D8, D11, D12', use: 'Motor shield (do not use)' },
  { pin: 'D0, D1', use: 'USB serial (uploads, Serial Monitor)' },
]

export const WIRE_BY_ID: Record<string, { wire: Wire; group: number }> = Object.fromEntries(
  WIRE_GROUPS.flatMap((g, group) => g.wires.map((wire) => [wire.id, { wire, group }])),
)

/** Signal pins chosen by this guide, in board order. */
export const PIN_MAP: { pin: string; use: string; group: number }[] = WIRE_GROUPS.flatMap((g, group) =>
  g.wires.filter((w) => w.kind === 'signal').map((w) => ({ pin: w.to, use: `${w.device ?? g.device} ${w.from}`, group })),
).sort((a, b) => a.pin.localeCompare(b.pin))
