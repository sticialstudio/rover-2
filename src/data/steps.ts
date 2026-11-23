// Assembly guide for ROVER 2.0.
// DRAFT INSTRUCTIONS: written from the 3D model. Edit the wording to match how you actually build the kit.
//
// Which pieces appear in a step:
//   `pieces`: Blender object names (exact). These win over `parts`.
//   `parts`:  whole part groups from parts.ts (any piece not already claimed by `pieces` in another step).
//   `wires`:  wire pieces (see the Step field below); housings (pins.*) follow their wire.
// Every piece must end up in exactly one step; the app warns in the console otherwise.

const bc = (n: number) => (n ? `BézierCurve.${String(n).padStart(3, '0')}` : 'BézierCurve')
const MOTOR_LEFT = [10, 11, 12, 13].map(bc)
const MOTOR_RIGHT = [14, 15, 16, 17].map(bc)
const IR_WIRES = [0, 1, 2, 3, 4, 5].map(bc)
const US_WIRES = [6, 7, 8, 9].map(bc)
const BT_WIRES = [20, 21, 22, 23].map(bc)
/** come soldered to the battery pack and switch: battery + to the switch; switch to EXT_PWR +; battery − to EXT_PWR − */
const PWR_BAT = bc(24)
const PWR_FEED = [bc(18), bc(19)]
const FRONT = 'deck front opening'
/** `from` / `upTo` value for the stretch of a wire that runs under the deck (`under` in wireRoutes.ts) */
export const UNDER_DECK = 'under the deck'
const DECK = 'Cube.006'
const FRONT_PANEL = '2WDComplete.001'

export interface NeedItem {
  label: string
  /** part id from parts.ts; hovering the item highlights it in 3D */
  part?: string
}

export interface Step {
  id: string
  title: string
  summary: string
  need: NeedItem[]
  instructions: string[]
  tip?: string
  caution?: string
  parts?: string[]
  pieces?: string[]
  /** wires laid in this step. Without `from` / `upTo` the whole wire. With `upTo` (an opening in
   *  wireRoutes.ts) only as far as just through that opening; with `from` (an opening, or UNDER_DECK) it
   *  starts there instead of at the device end, leaving that end loose. A later step lists the wire again to
   *  lay more of it (what is already laid stays), and one step lists it with neither to finish it.
   *  Connector housings come with their end of the wire automatically. */
  wires?: { pieces: string[]; from?: string; upTo?: string }[]
  /** pieces already built that are drawn see-through in this step, so wires underneath show */
  seeThrough?: string[]
  /** for steps that add nothing: show the kit laid out (exploded) or the finished rover */
  layout?: 'exploded' | 'complete'
  /** camera direction (from the target), in scene axes: +x = front, +y = up, +z = right side */
  view: [number, number, number]
  /** sub-assemblies (SUBASSEMBLIES) this step builds in: what it adds is drawn moved aside by each one's
   *  offset until the step that places it */
  sub?: string[]
  /** puts a sub-assembly in place: it moves there first, then what the step adds comes in */
  place?: string
  /** pieces the camera frames when the step adds none (e.g. a check) */
  focus?: string[]
  /** starts a chapter (a sub-assembly, like a page of the printed manual) with this title */
  chapter?: string
  /** a chapter's opening page: what you will build and every part it needs; adds nothing */
  cover?: boolean
  /** the camera looks from underneath: the panel says "turn it over" */
  flip?: boolean
  /** where the step's pieces come from as they go in (default: above; locks and wheels work it out) */
  from?: Side
  /** the same, per piece */
  approach?: Record<string, Side>
}

/** directions a part can come from (rover's own left and right) */
export type Side = 'above' | 'below' | 'front' | 'back' | 'left' | 'right'

/** Parts built off the rover first, and where they are drawn meanwhile (scene units: +x front, +y up, +z right).
 *  They add up: the ultrasonic face is built above the top half, which floats above the chassis. */
export const SUBASSEMBLIES: Record<string, [number, number, number]> = {
  top: [0, 0.9, 0],
  power: [-1.6, 0.25, 0],
  ir: [0.9, 0, 0],
  ultrasonic: [0, 0.5, 0],
}

export const STEPS: Step[] = [
  {
    id: 'gather',
    chapter: 'Get ready',
    title: 'Gather your parts',
    summary: 'Lay everything out and check nothing is missing before you start.',
    layout: 'exploded',
    view: [1.1, 0.8, 1.0],
    need: [
      { label: 'Wooden panel set + 47 red locks', part: 'chassis' },
      { label: '4 × TT gear motor', part: 'motors' },
      { label: '4 × wheel', part: 'wheels' },
      { label: 'Arduino UNO + motor shield', part: 'arduino_uno' },
      { label: 'Sensors: 1 × ultrasonic, 2 × IR line sensor', part: 'ultrasonic_sensor' },
      { label: 'Bluetooth module', part: 'bluetooth_module' },
      { label: 'Battery pack with soldered switch + 2 × 18650 cells', part: 'battery_pack' },
      { label: 'Jumper wires', part: 'wiring' },
      { label: 'Small screwdriver, masking tape, a pen, USB cable' },
    ],
    instructions: [
      'Clear a table and lay the parts out in groups: wood, motors and wheels, electronics, wires.',
      'Wipe any laser soot off the wooden panels with a dry cloth.',
      'Put the 18650 cells on charge now: they go into the battery pack in the Power chapter.',
      'You will build the rover in two halves: the bottom (motors, base plate, front plate) and the top (top plate with power, sensors and electronics). Then you join them and connect the wires.',
    ],
    tip: 'Keep the 47 red locks in a small cup. They are easy to lose.',
  },

  // ---------- bottom assembly ----------
  // Left motor casing: one part per step, like the printed manual.
  {
    id: 'left-casing',
    cover: true,
    chapter: 'Left motor casing',
    title: 'Left motor casing',
    summary: 'A wooden box that holds two motors. You build it one part at a time.',
    view: [0.6, 1.0, 1.1],
    need: [],
    instructions: [],
  },
  {
    id: 'casing-rail',
    title: 'Lower rail',
    summary: 'Lay the lower rail flat. Everything else stands on it.',
    pieces: ['DCMotorTopR&T1.005'],
    view: [0.6, 1.0, 1.1],
    need: [],
    instructions: ['Lay the lower rail flat on the table, slots facing up.'],
  },
  {
    id: 'casing-inner',
    title: 'Inner wall',
    summary: 'The wall with the wire hole stands on the rail’s inner edge.',
    pieces: ['DCMotorSideLeft2.001'],
    view: [0.6, 1.0, 1.1],
    need: [],
    instructions: ['Push the tabs of the wall with the wire hole into the rail’s inner edge.', 'The hole faces the middle of the rover.'],
  },
  {
    id: 'casing-rear-end',
    title: 'Rear end piece',
    summary: 'The rear end piece closes the back of the casing.',
    pieces: ['DCMotorFrontLeft.002'],
    view: [-0.9, 1.0, 1.0],
    need: [],
    instructions: ['Push the end piece into the slots at the rear end of the rail.'],
  },
  {
    id: 'casing-rear-motor',
    title: 'Rear motor',
    summary: 'The rear motor lies on the rail, shaft pointing outwards. Its wires go through the hole.',
    pieces: ['Dc Motor.002'],
    wires: [{ pieces: [bc(12), bc(13)], upTo: 'left inner motor wall' }],
    view: [0.4, 1.1, 1.2],
    need: [],
    instructions: [
      'If your motors have no wires yet, fit a red and a black wire to the tabs now.',
      'Lay the motor against the rear end piece, shaft pointing away from the inner wall.',
      'Push its two wires through the hole in the inner wall.',
    ],
  },
  {
    id: 'casing-front-motor',
    title: 'Front motor',
    summary: 'The front motor lies back to back with the rear one.',
    pieces: ['Dc Motor.001'],
    wires: [{ pieces: [bc(10), bc(11)], upTo: 'left inner motor wall' }],
    view: [0.4, 1.1, 1.2],
    need: [],
    instructions: ['Lay the second motor back to back with the first, shaft pointing outwards too.', 'Push its wires through the same hole.'],
    caution: 'Both shafts point outwards. A motor that is turned round spins backwards.',
  },
  {
    id: 'casing-front-end',
    title: 'Front end piece',
    summary: 'The front end piece closes the front of the casing.',
    pieces: ['DCMotorFrontLeft.003'],
    view: [1.1, 1.0, 0.8],
    need: [],
    instructions: ['Push the second end piece into the slots at the front end of the rail.'],
  },
  {
    id: 'casing-outer',
    title: 'Outer wall',
    summary: 'The outer wall slides over both shafts.',
    pieces: ['DCMotorSideRight1.002'],
    from: 'left',
    view: [0.5, 0.9, -1.2],
    need: [],
    instructions: ['Slide the outer wall over the two shafts, so each shaft sticks out through its hole.', 'Push its tabs into the rail’s outer edge.'],
  },
  {
    id: 'casing-top',
    title: 'Upper rail',
    summary: 'The upper rail closes the casing and holds the motors down.',
    pieces: ['DCMotorTopR&T1.006'],
    view: [0.6, 1.4, -0.9],
    need: [],
    instructions: ['Lay the upper rail on top, with the tabs of the walls and end pieces through its slots.', 'Both shafts should still turn freely.'],
  },
  // Right motor casing: the same parts in the same order, a few at a time.
  {
    id: 'right-casing',
    cover: true,
    chapter: 'Right motor casing',
    title: 'Right motor casing',
    summary: 'The same as the left casing, as a mirror image. This time a few parts go in per step.',
    view: [0.5, 1.1, -1.2],
    need: [],
    instructions: [],
  },
  {
    id: 'right-base',
    title: 'Rail, inner wall & rear end',
    summary: 'The lower rail, then the inner wall with its hole facing the middle, then the rear end piece.',
    pieces: ['DCMotorTopR&T1.001', 'DCMotorSideLeft2.006', 'DCMotorFrontLeft.001'],
    view: [0.5, 1.1, -1.2],
    need: [],
    instructions: ['Lower rail flat, inner wall (with the hole) on its inner edge, rear end piece at the back.'],
  },
  {
    id: 'right-motors',
    title: 'Both motors',
    summary: 'Two motors back to back, shafts outwards, wires through the hole.',
    pieces: ['Dc Motor.003', 'Dc Motor'],
    wires: [{ pieces: MOTOR_RIGHT, upTo: 'right inner motor wall' }],
    view: [0.4, 1.1, -1.2],
    need: [],
    instructions: ['Lay both motors on the rail, back to back, shafts pointing outwards.', 'Push all four wires through the hole in the inner wall.'],
  },
  {
    id: 'right-close',
    title: 'Front end, outer wall & upper rail',
    summary: 'Close the casing: front end piece, outer wall over the shafts, upper rail on top.',
    pieces: ['DCMotorFrontLeft.005', 'DCMotorSideRight1.001', 'DCMotorTopR&T1.004'],
    approach: { 'DCMotorSideRight1.001': 'right' },
    view: [0.6, 1.3, 1.1],
    need: [],
    instructions: ['Front end piece, then the outer wall over the shafts, then the upper rail on top.'],
  },
  // ---------- chassis base ----------
  {
    id: 'base-cover',
    cover: true,
    chapter: 'Chassis base',
    title: 'Chassis base',
    summary: 'The two casings stand on the base plate and are locked from underneath. The motor wires run along the channel between them.',
    view: [0.7, 1.2, 1.0],
    need: [],
    instructions: [],
  },
  {
    id: 'base',
    title: 'Casings onto the base plate',
    summary: 'Stand both casings on the base plate.',
    pieces: ['Cube.008'],
    from: 'below',
    view: [0.7, 0.9, 1.0],
    need: [],
    instructions: ['Stand the casings on the base plate, wire holes facing each other across the middle.', 'Push their tabs through the slots.'],
  },
  {
    id: 'base-locks-left',
    title: 'Lock the left casing',
    summary: 'Turn the rover over. Five red locks hold the left casing.',
    flip: true,
    pieces: ['locker.025', 'locker.026', 'locker.027', 'locker.028', 'locker.029'],
    view: [0.5, -1.2, -0.9],
    need: [],
    instructions: ['Push a red lock through each tab that comes through the base under the left casing.'],
    tip: 'If a tab is tight, press with your thumb close to the joint rather than hammering the panel.',
  },
  {
    id: 'base-locks-right',
    title: 'Lock the right casing',
    summary: 'Five more locks hold the right casing.',
    flip: true,
    pieces: ['locker.023', 'locker.024', 'locker.030', 'locker.031', 'locker.032'],
    view: [0.5, -1.2, 0.9],
    need: [],
    instructions: ['The same under the right casing. Then turn the rover back up.'],
  },
  {
    id: 'motor-wires',
    title: 'Motor wires into the channel',
    summary: 'The eight motor wires run forward along the channel between the casings.',
    wires: [{ pieces: [...MOTOR_LEFT, ...MOTOR_RIGHT], upTo: UNDER_DECK }],
    view: [0.5, 1.4, 0.35],
    need: [{ label: 'Masking tape + pen' }],
    instructions: [
      'Lead all eight wires forward and bring them together about 4 cm behind the front of the base.',
      'Label each pair with tape: FL and RL on the left, FR and RR on the right.',
      'Bend the ends straight up.',
    ],
  },

  // ---------- front plate & IR pods ----------
  {
    id: 'front-cover',
    cover: true,
    chapter: 'Front plate & IR sensors',
    title: 'Front plate & IR sensors',
    summary: 'The front plate, and the two IR line sensors in their pods. The pods are built in front of the rover, then slid on.',
    view: [1.4, 0.7, 0.7],
    need: [],
    instructions: [],
  },
  {
    id: 'front-plate',
    title: 'Front plate',
    summary: 'The front plate stands across the front of the base.',
    pieces: [FRONT_PANEL],
    view: [1.4, 0.8, 0.7],
    need: [],
    instructions: ['Stand the front plate in the slots at the front of the base, in front of the casings.'],
  },
  {
    id: 'front-lock',
    title: 'Lock the front plate',
    summary: 'Turn the rover over. One red lock holds the front plate.',
    flip: true,
    pieces: ['locker.033'],
    view: [1.2, -1.0, 0.6],
    need: [],
    instructions: ['Push a red lock through the front plate’s tab under the base. Then turn the rover back up.'],
  },
  {
    id: 'ir-bases',
    title: 'IR pods: bases',
    summary: 'Each IR sensor gets a small pod. Start with the two bases.',
    sub: ['ir'],
    pieces: ['Ntibot2.003', 'Ntibot2.007'],
    view: [1.3, 0.9, 0.9],
    need: [],
    instructions: ['Lay the two pod bases side by side.'],
    tip: 'The pods are built in front of the rover, then slid onto the front plate together.',
  },
  {
    id: 'ir-sides',
    title: 'IR pods: side walls',
    summary: 'Two long side walls stand on each base.',
    sub: ['ir'],
    pieces: ['Cube.013', 'Cube.002', 'Cube.003', 'Cube.004'],
    view: [1.3, 0.9, 0.9],
    need: [],
    instructions: ['Stand two long side walls on each base.', 'Their long tails point back, towards the rover.'],
  },
  {
    id: 'ir-backs',
    title: 'IR pods: back walls',
    summary: 'A back wall goes between each pair of side walls, at the rover end.',
    sub: ['ir'],
    pieces: ['Ntibot2.008', 'Ntibot2.002'],
    view: [-0.4, 0.9, 1.2],
    need: [],
    instructions: ['Push a back wall in between each pair of side walls, at the end nearest the rover.'],
  },
  {
    id: 'ir-sensors',
    title: 'IR pods: sensors in',
    summary: 'An IR sensor stands in each pod, LEDs down, pins up.',
    sub: ['ir'],
    parts: ['ir_sensors'],
    view: [1.3, 0.9, 0.9],
    need: [],
    instructions: ['Stand a sensor in each pod with its LEDs pointing down at the floor and its pins pointing up.'],
  },
  {
    id: 'ir-fronts',
    title: 'IR pods: front walls',
    summary: 'A front wall closes the front of each pod.',
    sub: ['ir'],
    pieces: ['Ntibot2.004', 'Ntibot2.005'],
    from: 'front',
    view: [1.3, 0.9, 0.9],
    need: [],
    instructions: ['Close the front of each pod with a front wall.'],
  },
  {
    id: 'ir-tops',
    title: 'IR pods: tops',
    summary: 'A top goes on each pod, with the sensor pins poking through.',
    sub: ['ir'],
    pieces: ['Ntibot2.006', 'Ntibot2.001'],
    view: [1.2, 1.2, 0.8],
    need: [],
    instructions: ['Put a top on each pod, with the sensor’s pins through the hole.'],
  },
  {
    id: 'ir-locks',
    title: 'IR pods: locks',
    summary: 'Two red locks hold each front wall.',
    sub: ['ir'],
    pieces: ['locker.014', 'locker.015', 'locker.016', 'locker.017'],
    view: [1.3, 0.7, 0.9],
    need: [],
    instructions: ['Push a red lock through each side wall tab at the front.'],
  },
  {
    id: 'ir-pods-mount',
    title: 'Pods onto the front plate',
    summary: 'Slide both pods onto the front plate.',
    place: 'ir',
    view: [1.2, 0.8, 1.0],
    need: [],
    instructions: ['Push each pod’s long side walls through the slots in the front plate.'],
  },
  {
    id: 'ir-pods-lock',
    title: 'Lock the pods',
    summary: 'Behind the front plate, four red locks hold the pods.',
    pieces: ['locker.018', 'locker.019', 'locker.020', 'locker.021'],
    view: [-0.3, 1.1, 1.0],
    need: [],
    instructions: ['Behind the front plate, push a red lock through each of the four side wall tails.'],
  },
  {
    id: 'sensor-wires',
    title: 'IR sensor wires',
    summary: 'Three jumpers per sensor, round the ends of the front plate and into the channel.',
    wires: [{ pieces: IR_WIRES, upTo: UNDER_DECK }],
    view: [1.3, 1.0, 0.5],
    need: [{ label: 'Masking tape + pen' }],
    instructions: [
      'Push three jumpers onto each sensor’s pins: VCC, GND, OUT. Same colours on both sensors.',
      'Lead them round the ends of the front plate into the channel, next to the motor wires.',
      'Label the OUT wires L and R. The bottom half is done: set it aside.',
    ],
  },

  // ---------- top half: Arduino case (drawn floating above the chassis until it is joined) ----------
  // The Arduino and motor driver go in before the case is closed and before any wiring.
  {
    id: 'arduino-cover',
    cover: true,
    chapter: 'Top half: Arduino case',
    title: 'Top half: Arduino case',
    summary: 'The top half starts with the top plate and the Arduino case. The Arduino and motor driver go in before the case is closed.',
    view: [0.8, 1.3, 0.9],
    need: [],
    instructions: [],
  },
  {
    id: 'top-plate',
    title: 'Top plate',
    summary: 'Start the top half: lay the top plate the right way up.',
    sub: ['top'],
    pieces: [DECK],
    view: [0.8, 1.3, 0.9],
    need: [],
    instructions: ['Lay the top plate on the table, engraving on top.'],
    tip: 'The model shows the top half floating above the bottom half, so you can see where everything goes. You join them later.',
  },
  {
    id: 'arduino-ends',
    title: 'Case end walls',
    summary: 'The two end walls stand just behind the front opening.',
    sub: ['top'],
    pieces: ['ArdrinoCaseSide1.002', 'Ntibot2.013'],
    view: [0.8, 1.3, 0.9],
    need: [],
    instructions: ['Push the two end walls into their slots behind the front opening.'],
  },
  {
    id: 'arduino-end-locks',
    title: 'Lock the end walls',
    summary: 'Turn the top plate over. One red lock under each end wall.',
    sub: ['top'],
    flip: true,
    pieces: ['locker.044', 'locker.045'],
    view: [0.6, -1.0, 0.9],
    need: [],
    instructions: ['Push a red lock through each end wall tab under the plate. Turn it back up.'],
  },
  {
    id: 'arduino-usb-wall',
    title: 'USB side wall',
    summary: 'The side wall with the USB and power-jack cut-outs goes on the right.',
    sub: ['top'],
    pieces: ['ArdrinoCaseFront.002'],
    view: [0.6, 1.0, 1.2],
    need: [],
    instructions: ['Slot the side wall with the two cut-outs in on the right, between the end walls.', 'Leave the left side open.'],
  },
  {
    id: 'arduino-uno',
    title: 'Arduino UNO',
    summary: 'The Arduino goes into the open case.',
    sub: ['top'],
    parts: ['arduino_uno'],
    from: 'left',
    view: [0.6, 1.2, -1.0],
    need: [],
    instructions: ['Slide the UNO in from the open side, USB and power sockets at the cut-outs.'],
  },
  {
    id: 'arduino-shield',
    title: 'Motor driver shield',
    summary: 'The motor driver shield presses onto the Arduino’s headers.',
    sub: ['top'],
    parts: ['motor_shield'],
    view: [0.6, 1.4, -0.8],
    need: [],
    instructions: ['Line up every shield pin with the UNO headers and press down evenly.'],
    caution: 'A shield that is one pin off can damage the board. Check both header rows before pressing.',
  },
  {
    id: 'arduino-back',
    title: 'Close the case side',
    summary: 'The last side wall closes the case. The lid comes much later.',
    sub: ['top'],
    pieces: ['ArdrinoCaseBack.002'],
    view: [0.6, 1.2, -1.0],
    need: [],
    instructions: ['Slot the second side wall in on the left.'],
  },

  // ---------- power ----------
  {
    id: 'power-cover',
    cover: true,
    chapter: 'Power',
    title: 'Power',
    summary: 'The battery pack and switch come soldered together. The cells go in first, then the pack goes on the rear of the top plate, in its own case.',
    view: [-1.1, 1.3, 0.8],
    need: [],
    instructions: [],
  },
  // The power unit is got ready beside the rover (cells in), then put on the top plate.
  {
    id: 'power',
    title: 'Battery pack & switch',
    summary: 'The power unit: the pack and switch come joined by a short red wire.',
    sub: ['top', 'power'],
    parts: ['battery_pack', 'power_switch'],
    wires: [{ pieces: [PWR_BAT] }],
    view: [-1.2, 1.1, 0.9],
    need: [],
    instructions: [
      'Take the pack and the switch, joined by a short red wire. Do not pull on the soldered joints.',
      'Set the switch to OFF.',
      'Tape the bare ends of the long red and black wires, so they cannot touch anything.',
    ],
  },
  {
    id: 'power-cells',
    title: 'Cells into the pack',
    summary: 'The two 18650 cells go into the pack, before it goes on the rover.',
    sub: ['top', 'power'],
    pieces: ['Battery', 'Battery.001'],
    // the cells clip in under the pack's circuit board
    from: 'below',
    view: [-1.2, -0.45, 1.0],
    need: [],
    instructions: [
      'Check the switch is OFF.',
      'Turn the pack over. Put each cell in with its + end where the pack is marked +.',
      'Press each cell into its clips until it sits flat.',
    ],
    caution: 'A cell put in backwards can get hot. With the cells in, the long red and black wires are live: keep their ends taped and apart until they are screwed into the motor driver.',
  },
  {
    id: 'power-place',
    title: 'Onto the top plate',
    summary: 'The loaded pack goes on the rear of the top plate, and the switch into its hole.',
    sub: ['top'],
    place: 'power',
    view: [-1.1, 1.3, 0.8],
    need: [],
    instructions: [
      'Fit the switch into its hole at the rear right, short red wire through the slot beside it.',
      'Place the pack on the rear of the top plate, in front of the switch.',
    ],
  },
  {
    id: 'power-wires',
    title: 'Power wires underneath',
    summary: 'Turn the top plate over. The two long power wires run along the middle to the front opening.',
    sub: ['top'],
    flip: true,
    wires: [{ pieces: PWR_FEED, upTo: FRONT }],
    view: [0.3, -1.1, 1.0],
    need: [{ label: 'Masking tape + pen' }],
    instructions: [
      'Pass the long black wire down through the slot beside the switch.',
      'Run both long wires along the middle of the underside and up through the front opening. Tape them flat.',
      'Label the ends: + on the red, − on the black. Turn the plate back up.',
    ],
    caution: 'The cells are in, so these wires are live: never let the loose red and black ends touch.',
  },
  {
    id: 'battery-back',
    title: 'Battery case: back wall',
    summary: 'The back wall stands behind the pack.',
    sub: ['top'],
    pieces: ['BatteryBackHolder1.002'],
    view: [-1.2, 1.0, 0.6],
    need: [],
    instructions: ['Push the back wall into its slots behind the battery pack.'],
  },
  {
    id: 'battery-back-lock',
    title: 'Lock the back wall',
    summary: 'Turn the top plate over. One red lock under the back wall.',
    sub: ['top'],
    flip: true,
    pieces: ['locker.043'],
    view: [-1.0, -1.0, 0.6],
    need: [],
    instructions: ['Push a red lock through the back wall’s tab under the plate. Turn it back up.'],
  },
  {
    id: 'battery-sides',
    title: 'Battery case: side walls',
    summary: 'A side wall at each end of the pack.',
    sub: ['top'],
    pieces: ['BatteryLeftHolder1.001', 'BatteryLeftHolder1.002'],
    view: [-1.1, 1.1, 0.9],
    need: [],
    instructions: ['Stand a side wall at each end of the pack. Let the wires come out where they already run.'],
  },
  {
    id: 'battery-top',
    title: 'Battery case: top',
    summary: 'The top closes the case.',
    sub: ['top'],
    pieces: ['BatteryTopHolder1.002'],
    view: [-1.1, 1.3, 0.9],
    need: [],
    instructions: ['Lay the top on the walls, tabs through its slots.'],
  },
  {
    id: 'battery-locks',
    title: 'Lock the battery case',
    summary: 'Three red locks hold the top.',
    sub: ['top'],
    pieces: ['locker.004', 'locker.005', 'locker.006'],
    view: [-1.0, 1.4, 0.8],
    need: [],
    instructions: ['Push a red lock through each of the three tabs on top.'],
    tip: 'Two more locks hold the case sides to the motor casings. They go in when you join the two halves.',
  },

  // ---------- ultrasonic (built above its spot, then pushed down onto the top plate) ----------
  {
    id: 'us-cover',
    cover: true,
    chapter: 'Ultrasonic sensor',
    title: 'Ultrasonic sensor',
    summary: 'The ultrasonic “eyes” are built into a wooden frame above their spot, then pushed onto the top plate.',
    view: [1.4, 0.8, 0.6],
    need: [],
    instructions: [],
  },
  {
    id: 'us-face',
    title: 'Front face',
    summary: 'The front face panel: the one with two round holes.',
    sub: ['top', 'ultrasonic'],
    pieces: ['Ultrasonic.004'],
    view: [1.4, 0.8, 0.6],
    need: [],
    instructions: ['Hold the front face panel upright, holes facing forward.'],
  },
  {
    id: 'us-sensor',
    title: 'Sensor into the face',
    summary: 'The two silver eyes push through the holes from behind.',
    sub: ['top', 'ultrasonic'],
    parts: ['ultrasonic_sensor'],
    from: 'back',
    view: [-0.6, 0.8, 1.2],
    need: [],
    instructions: ['Push the sensor’s two silver eyes through the holes from behind.', 'The pins stay at the back.'],
  },
  // the frame is built onto the front face; the back panel closes it last
  {
    id: 'us-bottom-top',
    title: 'Bottom & top',
    summary: 'A bottom piece under the sensor and a top piece over it, both into the front face.',
    sub: ['top', 'ultrasonic'],
    pieces: ['Ultrasonic.005', 'Ultrasonic.006'],
    approach: { 'Ultrasonic.005': 'below' },
    view: [-0.9, 0.9, 1.1],
    need: [],
    instructions: ['Slot the bottom piece in under the sensor and the top piece over it, their front tabs into the front face.'],
  },
  {
    id: 'us-sides',
    title: 'Sides',
    summary: 'The two side pieces close the ends.',
    sub: ['top', 'ultrasonic'],
    pieces: ['Ultrasonic.001', 'Ultrasonic.002'],
    approach: { 'Ultrasonic.001': 'right', 'Ultrasonic.002': 'left' },
    view: [-0.9, 0.9, 1.1],
    need: [],
    instructions: ['Close the two ends with the side pieces, between the top and bottom.'],
  },
  {
    id: 'us-back',
    title: 'Back panel',
    summary: 'The back panel covers the frame from behind.',
    sub: ['top', 'ultrasonic'],
    pieces: ['Ultrasonic.003'],
    from: 'back',
    view: [-1.1, 0.7, 0.9],
    need: [],
    instructions: ['Press the back panel on from behind, with the top and bottom tabs through its slots.', 'The sensor’s pins stay reachable at the back.'],
  },
  {
    id: 'us-locks',
    title: 'Lock the frame',
    summary: 'Five red locks hold the frame together.',
    sub: ['top', 'ultrasonic'],
    pieces: ['locker.007', 'locker.008', 'locker.009', 'locker.010', 'locker.011'],
    view: [1.2, 0.9, 1.0],
    need: [],
    instructions: ['Push the red locks through the tabs: two at the top, three at the bottom.'],
  },
  {
    id: 'us-mount',
    title: 'Onto the top plate',
    summary: 'Push the face into its slots at the front of the top plate.',
    sub: ['top'],
    place: 'ultrasonic',
    view: [1.3, 0.9, 0.9],
    need: [],
    instructions: ['Push the long tabs of the front and back panels down into the slots until the frame sits flat.'],
  },
  {
    id: 'us-lock',
    title: 'Lock it underneath',
    summary: 'Turn the top plate over. One red lock under the back panel.',
    sub: ['top'],
    flip: true,
    pieces: ['locker.046'],
    view: [1.0, -1.0, 0.7],
    need: [],
    instructions: ['Push a red lock through the back panel’s tab under the plate. Turn it back up.'],
  },

  // ---------- Bluetooth ----------
  {
    id: 'bt-cover',
    cover: true,
    chapter: 'Bluetooth',
    title: 'Bluetooth',
    summary: 'The Bluetooth module sits in a small housing at the back. Its wires run under the top plate to the front opening.',
    view: [-1.2, 1.1, -0.9],
    need: [],
    instructions: [],
  },
  {
    id: 'bt-walls',
    title: 'Housing walls',
    summary: 'A back wall and two side walls stand at the rear of the top plate.',
    sub: ['top'],
    pieces: ['Ntibot2.055', 'Cube.001', 'Cube.009'],
    view: [-1.2, 1.1, -0.9],
    need: [],
    instructions: ['Push the back wall and the two side walls into their slots at the rear.'],
  },
  {
    id: 'bt-wall-locks',
    title: 'Lock the walls',
    summary: 'Turn the top plate over. Three red locks under the walls.',
    sub: ['top'],
    flip: true,
    pieces: ['locker.040', 'locker.041', 'locker.042'],
    view: [-1.0, -1.0, -0.6],
    need: [],
    instructions: ['Push a red lock through each wall tab under the plate. Turn it back up.'],
  },
  {
    id: 'bt-module',
    title: 'Module & wires',
    summary: 'Four jumpers go onto the module. Their wires drop through the rear slot and run to the front opening.',
    sub: ['top'],
    parts: ['bluetooth_module'],
    wires: [{ pieces: BT_WIRES, upTo: FRONT }],
    seeThrough: [DECK],
    view: [-1.2, 1.2, -0.7],
    need: [{ label: 'Masking tape + pen' }],
    instructions: [
      'Push a jumper onto each pin: VCC, GND, TXD, RXD. Label TXD and RXD.',
      'Drop the wires through the rear slot and run them under the plate, with the power wires, up through the front opening.',
      'Lay the module in the housing, pins facing down.',
    ],
  },
  {
    id: 'bt-top',
    title: 'Housing top',
    summary: 'The top closes the housing.',
    sub: ['top'],
    pieces: ['Cube.007'],
    view: [-1.2, 1.2, -0.9],
    need: [],
    instructions: ['Lay the top on the walls, tabs through its slots.'],
  },
  {
    id: 'bt-locks',
    title: 'Lock the top',
    summary: 'Three red locks hold the top.',
    sub: ['top'],
    pieces: ['locker.037', 'locker.038', 'locker.039'],
    view: [-1.0, 1.4, -0.8],
    need: [],
    instructions: ['Push a red lock through each tab on top.'],
    tip: 'The top half is done. Six wire ends come up through the front opening: two power, four Bluetooth.',
  },

  // ---------- join the halves ----------
  {
    id: 'join-cover',
    cover: true,
    chapter: 'Join the halves',
    title: 'Join the halves',
    summary: 'The top half goes onto the bottom half, and six locks hold them together.',
    view: [1.1, 0.7, 1.2],
    need: [],
    instructions: [],
  },
  {
    id: 'join',
    title: 'Lower the top half',
    summary: 'Lower the top half onto the casings and the front plate. The motor and sensor wires come up through the front opening.',
    place: 'top',
    wires: [{ pieces: [...MOTOR_LEFT, ...MOTOR_RIGHT, ...IR_WIRES], upTo: FRONT }],
    view: [1.1, 0.7, 1.2],
    need: [],
    instructions: [
      'Hold the bottom half’s wires up together and lower the top half over them.',
      'Guide all the tabs into their slots and press down evenly. No wire may be pinched.',
    ],
    tip: 'Twenty wire ends come up through the front opening: 8 motor, 6 IR, 4 Bluetooth, 2 power.',
  },
  {
    id: 'join-front-locks',
    title: 'Front locks',
    summary: 'Four red locks at the front: two in the front plate tabs, two in the casing sides.',
    pieces: ['locker.012', 'locker.013', 'locker.022', 'locker.035'],
    view: [1.2, 1.0, 0.9],
    need: [],
    instructions: ['Push the red locks through the front plate tabs and the front casing tabs on top of the plate.'],
  },
  {
    id: 'join-rear-locks',
    title: 'Rear locks',
    summary: 'Two red locks hold the battery case sides to the casings.',
    pieces: ['locker.034', 'locker.036'],
    view: [-1.1, 1.0, 0.9],
    need: [],
    instructions: ['Push a red lock through the tab at each side of the battery case.'],
  },

  // ---------- connect: screw terminals first, then the lid, then the jumpers through the lid's opening ----------
  {
    id: 'connect-cover',
    cover: true,
    chapter: 'Connect the wires',
    title: 'Connect the wires',
    summary: 'Every wire meets the motor driver: screw terminals first, then the lid, then the jumpers.',
    view: [0.3, 1.4, 0.2],
    need: [],
    instructions: [],
  },
  {
    id: 'motors-to-shield',
    title: 'Motor wires',
    summary: 'Each motor’s two wires screw into its terminal: left M1 and M2, right M3 and M4.',
    wires: [{ pieces: [...MOTOR_LEFT, ...MOTOR_RIGHT] }],
    view: [0.3, 1.4, 0.2],
    need: [{ label: 'Small screwdriver' }],
    instructions: [
      'Left: FL into M1, RL into M2. Right: RR into M3, FR into M4.',
      'Red wire in the same position (A) of every terminal. Tighten and tug gently.',
    ],
    tip: 'If a wheel spins the wrong way later, swap that motor’s two wires. No code change needed.',
  },
  {
    id: 'power-to-shield',
    title: 'Power wires',
    summary: 'The two power wires screw into EXT_PWR.',
    wires: [{ pieces: PWR_FEED }],
    view: [0.6, 1.4, 0.9],
    need: [{ label: 'Small screwdriver' }],
    instructions: ['Check the switch is OFF.', 'Untape the ends. Red + into EXT_PWR +, black − into EXT_PWR −. Tug gently.'],
    caution: 'Swapping + and − on EXT_PWR can destroy the motor driver chips. Red goes to +, every time.',
  },
  {
    id: 'lid',
    title: 'Arduino case lid',
    summary: 'The lid goes on. Its opening leaves the header pins free.',
    pieces: ['ArdrinoTopCover.002'],
    view: [0.9, 1.2, 1.0],
    need: [],
    instructions: ['Tuck the motor and power wires into the case.', 'Press the lid on, its opening over the header pins.'],
  },
  {
    id: 'lid-locks',
    title: 'Lock the lid',
    summary: 'Four red locks hold the lid.',
    pieces: ['locker.074', 'locker.001', 'locker.002', 'locker.003'],
    view: [0.9, 1.3, 1.0],
    need: [],
    instructions: ['Push a red lock through each of the four tabs. The USB port must stay reachable.'],
  },
  {
    id: 'us-to-shield',
    title: 'Ultrasonic wires',
    summary: 'Four jumpers from the ultrasonic sensor to the header, over the top plate.',
    wires: [{ pieces: US_WIRES }],
    view: [1.0, 1.2, 0.5],
    need: [],
    instructions: ['VCC → 5V, GND → GND, Trig → A0, Echo → A1.', 'Go by the pin names on the sensor, not the wire colour.'],
  },
  {
    id: 'ir-to-shield',
    title: 'IR sensor wires',
    summary: 'The six IR jumpers from the front opening plug into the header.',
    wires: [{ pieces: IR_WIRES }],
    view: [0.9, 1.3, 0.4],
    need: [],
    instructions: ['VCC → 5V and GND → GND on both sensors.', 'Left OUT (L) → A2, right OUT (R) → A3.'],
  },
  {
    id: 'bt-to-shield',
    title: 'Bluetooth wires',
    summary: 'The four Bluetooth jumpers from the front opening plug into the header.',
    wires: [{ pieces: BT_WIRES }],
    view: [0.9, 1.3, 0.4],
    need: [],
    instructions: ['VCC → 5V, GND → GND, TXD → A4, RXD → A5.'],
    tip: 'Open the Wire tab to see each connection highlighted on the 3D rover.',
  },

  // ---------- finish ----------
  {
    id: 'finish-cover',
    cover: true,
    chapter: 'Wheels & power check',
    title: 'Wheels & power check',
    summary: 'The wheels go on, the power gets its first check, and the rover is ready.',
    view: [0.25, 0.45, 1.4],
    need: [],
    instructions: [],
  },
  {
    id: 'wheels-left',
    title: 'Left wheels',
    summary: 'Two wheels press onto the left motor shafts.',
    pieces: ['Tire_Red', 'Tire_Red.001'],
    view: [1.0, 0.6, -1.1],
    need: [],
    instructions: ['Line up the flat in the wheel’s hole with the flat on the shaft.', 'Support the casing from behind and push the wheel on until it is snug.'],
  },
  {
    id: 'wheels-right',
    title: 'Right wheels',
    summary: 'Two wheels press onto the right motor shafts.',
    pieces: ['Tire_Red.002', 'Tire_Red.003'],
    view: [1.0, 0.6, 1.1],
    need: [],
    instructions: ['The same on the right. Spin each wheel: it must not rub on the casing.'],
  },
  {
    id: 'power-check',
    title: 'Power check',
    summary: 'Switch on for the first time and check the power comes on.',
    focus: ['LX-2BUPS_Battery_Holder', 'switch'],
    view: [-1.1, 1.0, 0.9],
    need: [],
    instructions: [
      'Look over every connection once more: motors, power and all the jumpers on the header.',
      'Switch on: the shield’s power LED lights.',
      'Switch off again.',
    ],
    caution: 'If anything smells or gets warm, switch off at once and take the cells out.',
  },
  {
    id: 'done',
    title: 'Your rover is built!',
    summary: 'Nice work. Next: upload the code and take it for a drive.',
    layout: 'complete',
    view: [1.1, 0.7, 1.0],
    need: [],
    instructions: [
      'Wiggle every panel: nothing should be loose.',
      'Plug the USB cable into the Arduino. You are ready for the Code step.',
      'Keep the power switch OFF until your first program is uploaded.',
    ],
    tip: 'Take a photo of your finished rover!',
  },
]

/** Chapters: each starts at a step with `chapter` and runs to the next one. */
export const CHAPTERS = STEPS.flatMap((s, i) => (s.chapter ? [{ title: s.chapter, start: i, end: STEPS.length - 1 }] : []))
CHAPTERS.forEach((c, k) => {
  if (k + 1 < CHAPTERS.length) c.end = CHAPTERS[k + 1].start - 1
})
export const chapterOf = (step: number) => [...CHAPTERS].reverse().find((c) => c.start <= step) ?? CHAPTERS[0]
