import { useEffect, useRef, useState } from 'react'
import { connectBle, connectDemo, connectSerial, disconnect, stop, support, useLink } from '../link/link'
import { PROGRAMS } from '../data/programs'
import { useStore } from '../store'
import { sim } from '../sim/sim'

const LINK_PROGRAM = PROGRAMS.findIndex((p) => p.id === 'link')

// dev only: a pretend rover that echoes the simulator's sensors, to test this UI without hardware
if (import.meta.env.DEV) {
  Object.assign(window, { __linkDemo: () => connectDemo(() => ({ ...sim.raw, at: 0 })) })
}

/** Seconds since the last reading, refreshed a few times a second. */
function useAge(at: number | undefined) {
  const [now, setNow] = useState(performance.now())
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [])
  return at === undefined ? null : (now - at) / 1000
}

export function SourceSwitch() {
  const source = useStore((s) => s.driveSource)
  const setSource = useStore((s) => s.setDriveSource)
  return (
    <div className="seg-group source" role="tablist" aria-label="What you are driving">
      <button role="tab" aria-selected={source === 'sim'} className={source === 'sim' ? 'on' : ''} onClick={() => setSource('sim')}>
        Simulator
      </button>
      <button role="tab" aria-selected={source === 'real'} className={source === 'real' ? 'on' : ''} onClick={() => setSource('real')}>
        Real rover
      </button>
    </div>
  )
}

export function RealPanel() {
  const { status, device, error, telemetry, rate, log } = useLink()
  const setMode = useStore((s) => s.setMode)
  const setProgram = useStore((s) => s.setProgram)
  const age = useAge(telemetry?.at)
  const logRef = useRef<HTMLDivElement>(null)
  const live = status === 'connected'
  const stale = live && (age === null || age > 1.5)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const statusText =
    status === 'connected'
      ? `Connected: ${device}`
      : status === 'connecting'
        ? 'Connecting… pick your rover in the browser’s list'
        : status === 'error'
          ? 'Not connected'
          : 'Not connected'

  return (
    <aside className="panel">
      <SourceSwitch />
      <section className="card step-card real-card">
        <div className="step-meta">
          <span>Real rover</span>
          <span className={'link-dot ' + status}>{status === 'connected' ? 'live' : status}</span>
        </div>
        <h2>Drive your rover</h2>
        <p className="lede">
          Your keys, the on-screen pad and the speed digit go straight to the rover over Bluetooth or USB. The 3D rover copies your commands so you
          can see what you are sending.
        </p>

        <p className={'link-status ' + status}>{statusText}</p>
        {error && <p className="note link-error">{error}</p>}

        {live ? (
          <div className="link-actions">
            <button className="btn stop-btn" onClick={stop}>
              ■ STOP
            </button>
            <button className="btn" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="link-choices">
            <button className="btn primary" disabled={!support.serial || status === 'connecting'} onClick={() => connectSerial().catch(() => {})}>
              Bluetooth (HC-05 / HC-06) or USB
            </button>
            <button className="btn" disabled={!support.ble || status === 'connecting'} onClick={() => connectBle().catch(() => {})}>
              BLE module (HM-10, HC-08, BT05)
            </button>
            {!support.serial && !support.ble && (
              <p className="note">This browser can’t talk to serial ports or Bluetooth. Open this page in Chrome or Edge on a computer (or Chrome on Android for BLE).</p>
            )}
            {support.ble && !support.serial && <p className="note">Serial ports need Chrome or Edge on a computer. On this device only BLE modules work.</p>}
          </div>
        )}

        {live && (
          <>
            <p className="mini-label">From the rover</p>
            <div className="telemetry">
              <div>
                <span>Distance</span>
                <b>{telemetry ? (telemetry.cm >= 999 ? '—' : `${telemetry.cm} cm`) : '…'}</b>
              </div>
              <div>
                <span>IR left</span>
                <b className={telemetry?.irL ? 'dark' : ''}>{telemetry ? (telemetry.irL ? 'HIGH' : 'LOW') : '…'}</b>
              </div>
              <div>
                <span>IR right</span>
                <b className={telemetry?.irR ? 'dark' : ''}>{telemetry ? (telemetry.irR ? 'HIGH' : 'LOW') : '…'}</b>
              </div>
            </div>
            {stale && (
              <p className="note">
                No readings yet. Commands may still work, but to see the sensors the rover must run <code>rover_link.ino</code> (the older{' '}
                <code>bluetooth_remote.ino</code> doesn’t send any).
              </p>
            )}
            {!stale && <p className="telemetry-rate">{rate} readings / s</p>}
          </>
        )}

        <p className="mini-label">Messages</p>
        <div className="serial-log" ref={logRef} aria-live="polite">
          {log.length === 0 ? (
            <span className="muted">Nothing yet.</span>
          ) : (
            log.map((l, i) => (
              <div key={i} className={'log-' + l.dir}>
                <span>{l.dir === 'out' ? '→' : l.dir === 'in' ? '←' : '•'}</span>
                {l.text}
              </div>
            ))
          )}
        </div>

        <div className="callout caution">
          <b>Safety</b>
          Try it first with the rover on a box, wheels off the ground. <kbd>Space</kbd> or STOP halts it. The rover also stops on its own if this page
          goes quiet for 1 second, if you switch tabs, or if the link drops.
        </div>
      </section>

      <section className="card setup-steps">
        <h3 className="section-title">First time? Set it up</h3>
        <ol className="instructions">
          <li>
            Upload{' '}
            <button
              className="linkish"
              onClick={() => {
                setMode('code')
                setProgram(LINK_PROGRAM)
              }}
            >
              rover_link.ino
            </button>{' '}
            to the UNO. It understands the same letters as the phone sketch and sends the sensor readings back.
          </li>
          <li>
            <b>HC-05 / HC-06:</b> pair it in your computer’s Bluetooth settings (PIN 1234 or 0000). Then click the first button and pick the port
            named after Bluetooth. On Windows there are two; if one doesn’t connect, try the other.
          </li>
          <li>
            <b>BLE module:</b> no pairing needed. Click the second button and choose it from the list.
          </li>
          <li>
            <b>USB cable:</b> the first button also works with the cable. Close the Arduino Serial Monitor first, because only one program can use the
            port.
          </li>
        </ol>
        <p className="note">
          The battery switch must be ON for the motors to turn. A classic module’s LED blinks slowly once it is connected. The speed digit (keys 0–9) is
          sent too: currently {sim.params.digit}.
        </p>
      </section>
    </aside>
  )
}
