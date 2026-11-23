// Part catalogue for ROVER 2.0.
// `id` must match the `part:<id>` group names written by tools/export_web.py.
// Module models were inferred from the Blender scene (object names, textures and
// dimensions). Check the items marked "verify" against your physical kit.

export type CategoryId = 'frame' | 'brain' | 'sensors' | 'motion' | 'wiring'

export const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: 'brain', label: 'Brain & power', color: '#3b7fc4' },
  { id: 'sensors', label: 'Sensors & comms', color: '#2f9e6e' },
  { id: 'motion', label: 'Motion', color: '#d8392b' },
  { id: 'frame', label: 'Wooden frame', color: '#c48a45' },
  { id: 'wiring', label: 'Wiring', color: '#d99a1e' },
]

/** How a part moves in the exploded view (scene units; the rover is ~2 units long). */
export interface ExplodeCfg {
  /** push away from the rover centre, horizontally */
  out?: number
  /** lift straight up */
  lift?: number
  /** spread the part's own pieces apart (fraction of their distance from the part centre) */
  spread?: number
  /** pieces follow the nearest frame panel instead (used by the red locks) */
  followFrame?: boolean
  /** fade out while exploding */
  fade?: boolean
}

export interface Part {
  id: string
  name: string
  category: CategoryId
  qty: string
  blurb: string
  description: string
  specs: [string, string][]
  pins?: string[]
  verify?: boolean
  explode: ExplodeCfg
}

export const PARTS: Part[] = [
  {
    id: 'arduino_uno',
    name: 'Arduino UNO R3',
    category: 'brain',
    qty: '1',
    blurb: 'The brain that runs your code.',
    description:
      'A microcontroller board built around the ATmega328P. It reads the sensors, decides what to do and tells the motor shield how to drive the wheels. You program it over USB from the Arduino IDE.',
    specs: [
      ['Microcontroller', 'ATmega328P @ 16 MHz'],
      ['USB chip', 'CH340'],
      ['Logic level', '5 V'],
      ['Digital I/O', '14 (6 PWM)'],
      ['Analog inputs', '6 (A0–A5)'],
      ['Flash', '32 KB'],
    ],
    explode: { lift: 0.55 },
  },
  {
    id: 'motor_shield',
    name: 'Motor driver shield',
    category: 'brain',
    qty: '1',
    blurb: 'Turns weak Arduino signals into motor power.',
    description:
      'Stacks directly on top of the UNO. Its H-bridge chips switch battery current to the four motors, so each wheel can spin forward or backward at different speeds. Motor wires screw into the terminals on each side.',
    specs: [
      ['Type', 'L293D shield (verify)'],
      ['Motor channels', '4 DC (M1–M4)'],
      ['Mounting', 'Stacks on the UNO headers'],
      ['Extras', 'Servo headers'],
    ],
    verify: true,
    explode: { lift: 0.85 },
  },
  {
    id: 'battery_pack',
    name: 'Battery pack',
    category: 'brain',
    qty: '1 holder + 2 cells',
    blurb: 'Rechargeable power for everything.',
    description:
      'Two 18650 lithium-ion cells sit in a holder with a built-in charge and protection board, so you can recharge the rover without removing the cells. It comes with the power switch and the two power wires to the motor driver already soldered on.',
    specs: [
      ['Cells', '2 × 18650 Li-ion'],
      ['Cell voltage', '3.7 V nominal'],
      ['Holder board', 'LX-2BUPS'],
    ],
    explode: { out: 0.25, lift: 0.6 },
  },
  {
    id: 'power_switch',
    name: 'Power switch',
    category: 'brain',
    qty: '1',
    blurb: 'On / off for the whole rover.',
    description: 'Soldered between the battery pack’s + and the red wire to the motor driver, so it cuts power to everything. Switch it off when charging or uploading new code.',
    specs: [['Position', 'Rear of the rover']],
    explode: { out: 0.55, lift: 0.15 },
  },
  {
    id: 'ultrasonic_sensor',
    name: 'Ultrasonic sensor',
    category: 'sensors',
    qty: '1',
    blurb: 'The “eyes”: measures distance to obstacles.',
    description:
      'Sends a burst of 40 kHz sound from one transducer and times the echo on the other. The Arduino turns that time into distance, which is how the rover avoids walls.',
    specs: [
      ['Model', 'HC-SR04'],
      ['Range', '2 – 400 cm'],
      ['Beam angle', '≈ 15°'],
      ['Supply', '5 V'],
    ],
    pins: ['VCC', 'Trig', 'Echo', 'GND'],
    explode: { out: 0.75, lift: 0.45 },
  },
  {
    id: 'ir_sensors',
    name: 'IR sensors',
    category: 'sensors',
    qty: '2',
    blurb: 'See the line on the floor.',
    description:
      'Each module shines infrared light down and checks how much bounces back. Dark lines reflect less than a light floor, so two sensors side by side let the rover follow a track. The blue potentiometer sets the sensitivity.',
    specs: [
      ['Type', 'IR reflective module (verify)'],
      ['Output', 'Digital HIGH / LOW'],
      ['Adjust', 'On-board potentiometer'],
    ],
    pins: ['VCC', 'GND', 'OUT'],
    verify: true,
    explode: { out: 0.85, spread: 0.6 },
  },
  {
    id: 'bluetooth_module',
    name: 'Bluetooth module',
    category: 'sensors',
    qty: '1',
    blurb: 'Drive the rover from your phone.',
    description:
      'A serial-over-Bluetooth module. Pair a phone app with it and every button press arrives at the Arduino as a character on the serial port.',
    specs: [
      ['Type', 'HC-05 / HC-06 (verify)'],
      ['Protocol', 'Bluetooth Classic SPP'],
      ['Default baud', '9600'],
      ['Range', '≈ 10 m'],
    ],
    pins: ['VCC', 'GND', 'TXD', 'RXD'],
    verify: true,
    explode: { out: 0.6, lift: 0.3 },
  },
  {
    id: 'motors',
    name: 'TT gear motors',
    category: 'motion',
    qty: '4',
    blurb: 'One geared DC motor per wheel.',
    description:
      'Yellow plastic-gearbox DC motors. Left and right pairs are driven separately, so the rover steers like a tank: spin one side faster, or in reverse, to turn.',
    specs: [
      ['Voltage', '3 – 6 V DC'],
      ['Gear ratio', '1 : 48'],
      ['Speed', '≈ 200 RPM @ 6 V'],
    ],
    explode: { spread: 0.45, lift: -0.02 },
  },
  {
    id: 'wheels',
    name: 'Wheels',
    category: 'motion',
    qty: '4',
    blurb: 'Grippy rubber tyres on red rims.',
    description: 'Press-fit onto the motor shafts. The chunky tread grips smooth floors and handles small bumps.',
    specs: [
      ['Diameter', '≈ 65 mm'],
      ['Width', '≈ 30 mm'],
      ['Fit', 'TT motor D-shaft'],
    ],
    explode: { spread: 0.75 },
  },
  {
    id: 'chassis',
    name: 'Chassis base',
    category: 'frame',
    qty: '15 panels',
    blurb: 'The floor and motor mounts everything slots into.',
    description:
      'Laser-cut 3 mm wood panels that join with tabs and slots. The motor brackets hold the four TT motors and the front panel carries the sensor mounts.',
    specs: [
      ['Material', '3 mm plywood / MDF'],
      ['Joints', 'Tab & slot + red locks'],
    ],
    explode: { spread: 0.18 },
  },
  {
    id: 'arduino_case',
    name: 'Arduino case',
    category: 'frame',
    qty: '5 panels',
    blurb: 'Protects the UNO and motor shield.',
    description: 'A box around the controller with cut-outs for the USB port and power jack, so you can reprogram the rover without opening it.',
    specs: [['Opens', 'Top cover, held by locks']],
    explode: { lift: 1.2, spread: 0.45 },
  },
  {
    id: 'battery_case',
    name: 'Battery case',
    category: 'frame',
    qty: '4 panels',
    blurb: 'Holds the battery pack at the rear.',
    description: 'Keeps the heaviest part low and centred between the rear wheels for stability.',
    specs: [['Location', 'Rear deck']],
    explode: { out: 0.35, lift: 1.05, spread: 0.4 },
  },
  {
    id: 'bluetooth_case',
    name: 'Bluetooth housing',
    category: 'frame',
    qty: '4 panels',
    blurb: 'A small pocket for the Bluetooth module.',
    description: 'Mounts the module at the rear, away from the motors, for a cleaner radio signal.',
    specs: [['Location', 'Rear side']],
    explode: { out: 0.75, lift: 0.5, spread: 0.4 },
  },
  {
    id: 'ultrasonic_mount',
    name: 'Ultrasonic “face”',
    category: 'frame',
    qty: '6 panels',
    blurb: 'Gives the rover its face and aims the sensor.',
    description: 'Layers of wood that clamp the HC-SR04 at the front, pointing straight ahead.',
    specs: [['Location', 'Front, above the IR sensors']],
    explode: { out: 0.55, lift: 0.55, spread: 0.35 },
  },
  {
    id: 'ir_mounts',
    name: 'IR sensor holders',
    category: 'frame',
    qty: '12 pieces',
    blurb: 'Two front pods that hold the IR sensors.',
    description: 'Each pod holds one IR module low and close to the floor so it reads the line reliably.',
    specs: [['Location', 'Front bumper']],
    explode: { out: 0.6, spread: 0.45 },
  },
  {
    id: 'locks',
    name: 'Locking pins',
    category: 'frame',
    qty: '47',
    blurb: 'Red keys that lock the panels together.',
    description: 'Slide a lock through a tab’s slot to hold two panels tight. No glue and no screws, so the kit can be taken apart and rebuilt.',
    specs: [['Material', 'Red acrylic / plastic']],
    explode: { followFrame: true },
  },
  {
    id: 'wiring',
    name: 'Wires & connectors',
    category: 'wiring',
    qty: '25 wires',
    blurb: 'Carry power and signals between modules.',
    description:
      'Jumper wires with Dupont connectors link the sensors and Bluetooth to the shield’s headers, and the motor leads screw into the M1–M4 terminals. The Wire tab traces every connection.',
    specs: [['Connectors', 'Dupont 2.54 mm + screw terminals']],
    // wires stay plugged in: each one stretches between the two parts it connects (RoverModel)
    explode: {},
  },
]

export const PART_BY_ID: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]))
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>

/** Display order: by category, then catalogue order. */
export const ORDERED_PARTS: Part[] = CATEGORIES.flatMap((c) => PARTS.filter((p) => p.category === c.id))
