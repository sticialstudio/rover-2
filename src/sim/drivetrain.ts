// 4WD skid-steer drivetrain for the Drive tab.
//
// Four TT gear motors (1:48). The shield drives each side's pair with the same signal
// (M1+M2 left, M3+M4 right), so the model works per side: two motors, two wheels.
//
//   PWM --> L293D --> motor torque --> wheel spin --> tyre grip (needs slip) --> rover moves
//
// Units here are SI (metres, seconds, newtons). The rest of the simulator uses scene units
// (1 unit = 10 cm), so positions are converted by the caller.

export const MOTOR = {
  /** 2 x 18650 Li-ion in series */
  battery: 7.4,
  /** the L293D's transistors lose ~1.2 V each, two in the current path */
  driverDrop: 2.4,
  /** one TT motor at 6 V, measured at the wheel shaft (after the 1:48 gearbox) */
  stallTorque6: 0.078, // N·m  (~0.8 kg·cm)
  noLoadSpeed6: 20.9, // rad/s (~200 RPM)
  stallCurrent6: 1.1, // A
  /** gearbox + bearing friction per motor: below this torque the wheel doesn't turn */
  friction: 0.009, // N·m
  /** rotating inertia per wheel (wheel + gears + motor rotor seen through the gearbox) */
  inertia: 2.5e-4, // kg·m²
}

export const BODY = {
  mass: 0.62, // kg, with batteries
  /** rubber tyre on a wood / tile floor */
  grip: 0.8,
  /** sideways grip as a fraction of forward grip: treads scrubbing sideways hold less */
  sideGrip: 0.55,
  /** slip speed at which the tyre reaches most of its grip */
  slipScale: 0.03, // m/s
  rollingDrag: 0.02, // fraction of weight
  /** filled in from the 3D model (metres) */
  wheelRadius: 0.0325,
  track: 0.127,
  wheelbase: 0.13,
  length: 0.2,
  width: 0.16,
}

export interface Side {
  /** wheel angular speed (rad/s), + = rolling forwards */
  spin: number
  /** accumulated wheel angle (rad), for drawing */
  angle: number
  /** tyre slip speed (m/s): wheel rim speed minus ground speed */
  slip: number
  /** current drawn by this side's two motors (A) */
  amps: number
  /** volts across the motors (average over the PWM cycle) */
  volts: number
}

export interface Body {
  /** forward speed (m/s) and yaw rate (rad/s, + = turning left) */
  v: number
  w: number
  left: Side
  right: Side
}

export const newSide = (): Side => ({ spin: 0, angle: 0, slip: 0, amps: 0, volts: 0 })

const g = 9.81

export const yawInertia = () => (BODY.mass * (BODY.length * BODY.length + BODY.width * BODY.width)) / 12

/**
 * The rover hits something. (rx, rz): contact point relative to the rover's centre, n: the push
 * direction out of the obstacle, heading: the rover's heading. All lengths in metres.
 * Removes the speed into the obstacle with an impulse; an off-centre hit also twists the rover,
 * which is how a real rover pivots off a corner.
 */
export function contactImpulse(b: Body, heading: number, rx: number, rz: number, nx: number, nz: number) {
  const fx = Math.cos(heading)
  const fz = -Math.sin(heading)
  // velocity of the contact point: forward speed plus the spin about the centre
  const vx = b.v * fx + b.w * rz
  const vz = b.v * fz - b.w * rx
  const vn = vx * nx + vz * nz
  if (vn >= 0) return
  const lever = rz * nx - rx * nz // turning effect of a push along n at (rx, rz)
  const I = yawInertia()
  const J = -vn / (1 / BODY.mass + (lever * lever) / I)
  b.v += (J / BODY.mass) * (nx * fx + nz * fz)
  b.w += (lever * J) / I
}

/**
 * One physics step. pwmL / pwmR are the Arduino's commands (-255..255, 0 = RELEASE: free-wheel).
 * Mutates `b`.
 */
export function drivetrainStep(b: Body, pwmL: number, pwmR: number, dt: number) {
  const { mass, grip, sideGrip, slipScale, rollingDrag, wheelRadius: r, track, wheelbase } = BODY
  const N = (mass * g) / 2 // weight on each side (two wheels)
  const I = yawInertia()
  const vMotor = MOTOR.battery - MOTOR.driverDrop
  const kBack = MOTOR.stallTorque6 / MOTOR.noLoadSpeed6 // torque lost per rad/s (back-EMF)

  const force = [0, 0]
  const lateralGrip = [1, 1]
  ;[b.left, b.right].forEach((s, i) => {
    const pwm = i === 0 ? pwmL : pwmR
    const duty = Math.max(-1, Math.min(1, pwm / 255))
    const sideSign = i === 0 ? -1 : 1 // left side is on the inside of a left turn

    // Two motors. RELEASE (PWM 0) leaves the motors unpowered: no torque, they just coast.
    s.volts = duty * vMotor
    const perMotor = duty === 0 ? 0 : MOTOR.stallTorque6 * (s.volts / 6) - kBack * s.spin
    const motorTorque = 2 * perMotor
    s.amps = duty === 0 ? 0 : 2 * MOTOR.stallCurrent6 * (s.volts / 6 - s.spin / MOTOR.noLoadSpeed6)

    // Tyres: grip grows with slip and saturates at grip x weight.
    const ground = b.v + (sideSign * b.w * track) / 2
    s.slip = s.spin * r - ground
    const use = Math.tanh(s.slip / slipScale)
    force[i] = grip * N * use
    // a tyre that is spinning has less grip left for sliding sideways (friction circle)
    lateralGrip[i] = Math.sqrt(Math.max(0, 1 - use * use))

    // Gearbox friction. A stopped wheel stays stopped until the torque on it beats the friction
    // (that is why low PWM values do nothing), and friction never pushes a wheel backwards.
    const drive = motorTorque - force[i] * r
    const fricMax = 2 * MOTOR.friction
    if (Math.abs(s.spin) < 0.05 && Math.abs(drive) <= fricMax) s.spin = 0
    else {
      const dir = Math.sign(s.spin) || Math.sign(drive)
      const next = s.spin + ((drive - fricMax * dir) / (2 * MOTOR.inertia)) * dt
      s.spin = Math.sign(next) !== dir && Math.abs(drive) <= fricMax ? 0 : next
    }
    s.angle += s.spin * dt
  })

  // Body: forward push from both sides, turning moment from their difference.
  const drag = rollingDrag * mass * g * Math.tanh(b.v / 0.02)
  b.v += ((force[0] + force[1] - drag) / mass) * dt

  // Skid steering: to turn, all four tyres must slide sideways, which friction resists.
  const sideways = Math.tanh((b.w * wheelbase) / 2 / slipScale)
  const scrub = sideGrip * grip * N * (wheelbase / 2) * (lateralGrip[0] + lateralGrip[1]) * sideways
  const turn = ((force[1] - force[0]) * track) / 2
  b.w += ((turn - scrub) / I) * dt
}
