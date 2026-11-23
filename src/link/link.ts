// Talk to the real rover running rover_link.ino.
//
// Two ways in, both Chrome / Edge only:
//   - Web Serial: a USB cable, or a classic Bluetooth module (HC-05 / HC-06) paired in the
//     operating system, which then shows up as a serial (COM) port.
//   - Web Bluetooth: BLE modules (HM-10, HC-08, BT05, AT-09...) with the common FFE0/FFE1
//     "serial" service, or the Nordic UART service (e.g. an ESP32).
//
// Protocol: one letter per command, exactly like bluetooth_remote.ino. While a direction is held,
// the letter is repeated every 150 ms, because the sketch stops by itself after 1 s of silence.
// Block programs (Missions tab) send "M<left>,<right>\n" instead (each side -255..255), repeated the
// same way. "?" asks the sketch's version ("ROVER 2.0 link v2" understands M).
// The rover answers 10x a second with "T,<cm>,<irLeft>,<irRight>".

import { create } from 'zustand'

export type Transport = 'serial' | 'ble' | 'demo'
export type LinkStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface Telemetry {
  cm: number
  irL: boolean
  irR: boolean
  /** performance.now() when it arrived */
  at: number
}
export interface LogLine {
  dir: 'in' | 'out' | 'info'
  text: string
  t: number
}

interface LinkState {
  status: LinkStatus
  transport: Transport | null
  device: string | null
  error: string | null
  telemetry: Telemetry | null
  /** readings received in the last second */
  rate: number
  log: LogLine[]
  /** the letter currently being held */
  letter: string
  /** motor speeds a block program is sending (null: none) */
  motors: [number, number] | null
  /** 2 once the sketch has answered "?" (it understands motor commands) */
  version: number | null
}

export const useLink = create<LinkState>(() => ({
  status: 'idle',
  transport: null,
  device: null,
  error: null,
  telemetry: null,
  rate: 0,
  log: [],
  letter: 'S',
  motors: null,
  version: null,
}))

export const support = {
  serial: typeof navigator !== 'undefined' && !!navigator.serial,
  ble: typeof navigator !== 'undefined' && !!navigator.bluetooth,
}

const HM10_SERVICE = 0xffe0
const HM10_CHAR = 0xffe1
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // we write here
const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // rover notifies here

const enc = new TextEncoder()

// ---- the active connection ----
let write: ((bytes: Uint8Array) => Promise<void>) | null = null
let close: (() => Promise<void>) | null = null
let pending: Promise<void> = Promise.resolve()
let busy = false
let rxBuffer = ''
const arrivals: number[] = []

function log(dir: LogLine['dir'], text: string) {
  useLink.setState((s) => ({ log: [...s.log.slice(-39), { dir, text, t: Date.now() }] }))
}

/** Feed raw text from the rover; complete lines are parsed. */
export function receive(text: string) {
  rxBuffer += text
  let i: number
  while ((i = rxBuffer.indexOf('\n')) >= 0) {
    const line = rxBuffer.slice(0, i).replace(/\r$/, '').trim()
    rxBuffer = rxBuffer.slice(i + 1)
    if (!line) continue
    const m = /^T,(-?\d+),([01]),([01])$/.exec(line)
    if (m) {
      const now = performance.now()
      arrivals.push(now)
      while (arrivals.length && arrivals[0] < now - 1000) arrivals.shift()
      useLink.setState({ telemetry: { cm: Number(m[1]), irL: m[2] === '1', irR: m[3] === '1', at: now }, rate: arrivals.length })
    } else {
      const v = /link v(\d+)/.exec(line)
      if (v) useLink.setState({ version: Number(v[1]) })
      log('in', line)
    }
  }
  if (rxBuffer.length > 200) rxBuffer = rxBuffer.slice(-200)
}

function send(text: string, { keepAlive = false } = {}) {
  if (!write || useLink.getState().status !== 'connected') return
  if (keepAlive && busy) return // don't pile up repeats on a slow link
  if (!keepAlive) log('out', text)
  busy = true
  const w = write
  pending = pending
    .then(() => w(enc.encode(text)))
    .catch((e) => fail(e))
    .finally(() => (busy = false))
}

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  log('info', `Error: ${msg}`)
  void disconnect(msg)
}

function connected(transport: Transport, device: string) {
  digit = -1
  useLink.setState({ status: 'connected', transport, device, error: null, telemetry: null, rate: 0, letter: 'S', motors: null, version: null })
  log('info', `Connected to ${device}`)
}

// ---- Web Serial ----
export async function connectSerial() {
  if (!navigator.serial) throw new Error('Web Serial needs Chrome or Edge on a computer.')
  await disconnect()
  useLink.setState({ status: 'connecting', error: null })
  try {
    const port = await navigator.serial.requestPort()
    await port.open({ baudRate: 9600 })
    const reader = port.readable!.getReader()
    const writer = port.writable!.getWriter()
    const dec = new TextDecoder()
    let open = true
    write = (b) => writer.write(b)
    close = async () => {
      open = false
      await reader.cancel().catch(() => {})
      reader.releaseLock()
      writer.releaseLock()
      await port.close().catch(() => {})
    }
    const info = port.getInfo()
    connected('serial', info.bluetoothServiceClassId ? 'Bluetooth serial port' : info.usbVendorId ? 'USB serial port' : 'serial port')
    ;(async () => {
      try {
        while (open) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) receive(dec.decode(value, { stream: true }))
        }
      } catch (e) {
        if (open) fail(e)
      }
    })()
  } catch (e) {
    handleConnectError(e)
  }
}

// ---- Web Bluetooth (BLE) ----
export async function connectBle() {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth needs Chrome or Edge (desktop or Android).')
  await disconnect()
  useLink.setState({ status: 'connecting', error: null })
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [HM10_SERVICE] },
        { services: [NUS_SERVICE] },
        { namePrefix: 'HM' },
        { namePrefix: 'HC-08' },
        { namePrefix: 'BT' },
        { namePrefix: 'JDY' },
        { namePrefix: 'MLT' },
        { namePrefix: 'ROVER' },
      ],
      optionalServices: [HM10_SERVICE, NUS_SERVICE],
    })
    const server = await device.gatt!.connect()
    let rx: BluetoothRemoteGATTCharacteristic
    let tx: BluetoothRemoteGATTCharacteristic
    try {
      const svc = await server.getPrimaryService(HM10_SERVICE)
      rx = tx = await svc.getCharacteristic(HM10_CHAR)
    } catch {
      const svc = await server.getPrimaryService(NUS_SERVICE)
      rx = await svc.getCharacteristic(NUS_RX)
      tx = await svc.getCharacteristic(NUS_TX)
    }
    const dec = new TextDecoder()
    tx.addEventListener('characteristicvaluechanged', () => {
      if (tx.value) receive(dec.decode(tx.value, { stream: true }))
    })
    await tx.startNotifications()
    write = (b) => (rx.writeValueWithoutResponse && rx.properties.writeWithoutResponse ? rx.writeValueWithoutResponse(b) : rx.writeValue(b))
    const onGone = () => {
      if (useLink.getState().transport === 'ble') void disconnect('The rover went out of range or was switched off.')
    }
    device.addEventListener('gattserverdisconnected', onGone)
    close = async () => {
      device.removeEventListener('gattserverdisconnected', onGone)
      if (device.gatt?.connected) device.gatt.disconnect()
    }
    connected('ble', device.name || 'BLE module')
  } catch (e) {
    handleConnectError(e)
  }
}

function handleConnectError(e: unknown) {
  const err = e as Error
  // the user closed the picker: not an error worth shouting about
  if (err?.name === 'NotFoundError' || /cancel|No port selected/i.test(err?.message ?? '')) {
    useLink.setState({ status: 'idle' })
    return
  }
  const msg =
    err?.name === 'NetworkError' || /open/i.test(err?.message ?? '')
      ? `${err.message} Is another program (like the Arduino Serial Monitor) using this port?`
      : (err?.message ?? String(e))
  useLink.setState({ status: 'error', error: msg })
  log('info', `Error: ${msg}`)
}

export async function disconnect(reason?: string) {
  const wasConnected = useLink.getState().status === 'connected'
  if (wasConnected && write) {
    // last word: stop
    await write(enc.encode('S')).catch(() => {})
  }
  const c = close
  write = null
  close = null
  busy = false
  pending = Promise.resolve()
  rxBuffer = ''
  if (c) await c().catch(() => {})
  if (wasConnected) log('info', reason ? `Disconnected: ${reason}` : 'Disconnected')
  useLink.setState({ status: reason ? 'error' : 'idle', error: reason ?? null, transport: null, device: null, letter: 'S', motors: null, version: null })
}

// ---- driving ----
let digit = -1

/** Called often by the UI with the letter for the keys being held. */
export function drive(letter: string, speedDigit: number) {
  if (useLink.getState().status !== 'connected') return
  if (speedDigit !== digit) {
    digit = speedDigit
    send(String(speedDigit))
  }
  if (letter !== useLink.getState().letter) {
    useLink.setState({ letter })
    send(letter)
  }
}

/** Emergency stop. */
export function stop() {
  useLink.setState({ letter: 'S', motors: null })
  send('S')
}

/** Block programs: set each side's speed (-255..255). Repeated by the keep-alive while not stopped. */
export function motors(left: number, right: number) {
  if (useLink.getState().status !== 'connected') return
  const l = Math.max(-255, Math.min(255, Math.round(left)))
  const r = Math.max(-255, Math.min(255, Math.round(right)))
  const cur = useLink.getState().motors
  if (cur && cur[0] === l && cur[1] === r) return
  useLink.setState({ motors: [l, r] })
  send(`M${l},${r}\n`)
}

/** Ask the sketch which version it is; true if it understands motor commands. */
export async function checkVersion(timeoutMs = 1500): Promise<boolean> {
  if (useLink.getState().version !== null) return useLink.getState().version! >= 2
  send('?')
  const t0 = performance.now()
  while (performance.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100))
    const v = useLink.getState().version
    if (v !== null) return v >= 2
  }
  return false
}

// keep-alive: repeat the held letter (or the program's motor command) so the rover's failsafe doesn't kick in
setInterval(() => {
  const s = useLink.getState()
  if (s.status !== 'connected') return
  if (s.motors && (s.motors[0] || s.motors[1])) send(`M${s.motors[0]},${s.motors[1]}\n`, { keepAlive: true })
  else if (s.letter !== 'S') send(s.letter, { keepAlive: true })
}, 150)

// stop when the page is hidden (tab switched, phone locked)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
  })
}

// ---- demo link (dev only): pretends to be a rover so the UI can be tested without hardware ----
export function connectDemo(source: () => Telemetry) {
  void disconnect().then(() => {
    let alive = true
    const timer = setInterval(() => {
      const t = source()
      receive(`T,${t.cm},${t.irL ? 1 : 0},${t.irR ? 1 : 0}\r\n`)
    }, 100)
    const dec = new TextDecoder()
    write = async (b) => {
      if (!alive) throw new Error('closed')
      await new Promise((r) => setTimeout(r, 15))
      // a v2 sketch answers the version question
      if (dec.decode(b).includes('?')) receive('ROVER 2.0 link v2\r\n')
    }
    close = async () => {
      alive = false
      clearInterval(timer)
    }
    connected('demo', 'Demo rover (no hardware)')
    receive('ROVER 2.0 ready\r\n')
  })
}
