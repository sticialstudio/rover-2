import { useEffect, useState } from 'react'
import { DEFAULT_PARAMS, letterFor, resetSim, sim, type DriveMode, type Params } from '../sim/sim'
import { PROGRAMS } from '../data/programs'
import { useStore, type DriveCam } from '../store'
import { Flowchart } from './CodePanel'
import { RealPanel, SourceSwitch } from './RealPanel'
import { drive as linkDrive, stop as linkStop, useLink } from '../link/link'

/** Re-render a few times a second with the simulator's latest numbers. */
function useSim(hz = 12) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), 1000 / hz)
    return () => clearInterval(id)
  }, [hz])
  return sim
}

const MODES: { id: DriveMode; label: string; program: string; blurb: string }[] = [
  {
    id: 'manual',
    label: 'You drive',
    program: 'bluetooth',
    blurb: 'Steer with the arrow keys (or WASD, or the on-screen pad). Each key sends the same letter a phone app would, and the rover runs bluetooth_remote.ino.',
  },
  {
    id: 'obstacle',
    label: 'Obstacle avoider',
    program: 'obstacle',
    blurb: 'The rover runs obstacle_avoider.ino: drive until the ultrasonic echo says something is closer than SAFE_CM, then stop, back up and spin right.',
  },
  {
    id: 'line',
    label: 'Line follower',
    program: 'line',
    blurb: 'The rover runs line_follower.ino on the black tape loop. Watch the two IR spots under its nose: orange means that sensor sees the tape.',
  },
]

function Slider({ name, min, max, step = 1, value, onChange, unit }: { name: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="tune">
      <span className="tune-head">
        <code>{name}</code>
        <b>
          {value}
          {unit}
        </b>
      </span>
      <span className="slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ['--v' as string]: `${((value - min) / (max - min)) * 100}%` }}
        />
      </span>
    </label>
  )
}

export function DrivePanel() {
  const source = useStore((s) => s.driveSource)
  return source === 'real' ? <RealPanel /> : <SimPanel />
}

function SimPanel() {
  const mode = useStore((s) => s.driveMode)
  const setDriveMode = useStore((s) => s.setDriveMode)
  const setMode = useStore((s) => s.setMode)
  const setProgram = useStore((s) => s.setProgram)
  const setCodeNode = useStore((s) => s.setCodeNode)
  const s = useSim()
  const [, force] = useState(0)
  const m = MODES.find((x) => x.id === mode)!
  const progIdx = PROGRAMS.findIndex((p) => p.id === m.program)
  const prog = PROGRAMS[progIdx]

  // light up the flowchart box the simulated Arduino is running
  useEffect(() => {
    if (useStore.getState().codeNode !== s.node) setCodeNode(s.node)
  })

  const set = <K extends keyof Params>(k: K, v: Params[K]) => {
    sim.params = { ...sim.params, [k]: v }
    force((n) => n + 1)
  }
  const changed = (Object.keys(DEFAULT_PARAMS[mode]) as (keyof Params)[]).some((k) => sim.params[k] !== DEFAULT_PARAMS[mode][k])

  return (
    <aside className="panel">
      <SourceSwitch />
      <section className="card step-card drive-card">
        <div className="step-meta">
          <span>Simulator</span>
          <span className="of">{(s.odometer / 10).toFixed(1)} m driven</span>
        </div>
        <h2>Drive</h2>
        <div className="seg-group" role="tablist" aria-label="What drives the rover">
          {MODES.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === mode} className={x.id === mode ? 'on' : ''} onClick={() => setDriveMode(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <p className="lede">{m.blurb}</p>

        <p className="mini-label">Tune it (same names as the sketch)</p>
        {mode === 'manual' && <Slider name="speed digit" min={0} max={9} value={s.params.digit} onChange={(v) => set('digit', v)} />}
        {mode === 'obstacle' && (
          <>
            <Slider name="SAFE_CM" min={10} max={80} value={s.params.SAFE_CM} onChange={(v) => set('SAFE_CM', v)} unit=" cm" />
            <Slider name="SPEED" min={60} max={255} value={s.params.SPEED} onChange={(v) => set('SPEED', v)} />
          </>
        )}
        {mode === 'line' && (
          <>
            <Slider name="SPEED" min={60} max={255} value={s.params.SPEED} onChange={(v) => set('SPEED', v)} />
            <Slider name="TURN" min={60} max={255} value={s.params.TURN} onChange={(v) => set('TURN', v)} />
            <div className="tune">
              <span className="tune-head">
                <code>LINE</code>
              </span>
              <div className="seg-group small">
                <button className={s.params.LINE_HIGH ? 'on' : ''} onClick={() => set('LINE_HIGH', true)}>
                  HIGH
                </button>
                <button className={!s.params.LINE_HIGH ? 'on' : ''} onClick={() => set('LINE_HIGH', false)}>
                  LOW
                </button>
              </div>
            </div>
            {!s.params.LINE_HIGH && (
              <p className="note tune-note">
                With LOW, the light floor counts as “the line”. Both sensors see it, so the code takes the “Both → Stop” branch and the rover
                sits still. Change LINE when your real module reads the opposite way to these sensors.
              </p>
            )}
          </>
        )}
        {changed && (
          <button className="btn small" onClick={() => {
              sim.params = { ...DEFAULT_PARAMS[mode] }
              force((n) => n + 1)
            }}>
            Back to the sketch’s values
          </button>
        )}

        <p className="mini-label">What the code is doing</p>
        <Flowchart setup={prog.setup} loop={prog.loop} />

        <div className="step-nav">
          <button className="btn" onClick={() => resetSim(mode, true)}>
            Reset rover
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setMode('code')
              setProgram(progIdx)
            }}
          >
            Open {prog.file} →
          </button>
        </div>
      </section>

      <p className="note sim-note">
        A simulation of a 4WD rover: four TT gear motors (1:48, ~200 RPM at 6 V) on 2 × 18650 cells through the L293D, which loses about 2.4 V.
        Gearbox friction means low PWM values don’t turn the wheels. Tyres need a little slip to grip, so they spin when you push against a box, and
        turning means scrubbing all four tyres sideways, just like the real thing. Expect to re-tune the numbers on your rover.
      </p>
    </aside>
  )
}

/** Stage overlay: live sensor read-out, the D-pad and the toolbar. */
export function DriveHud() {
  const mode = useStore((s) => s.driveMode)
  const cam = useStore((s) => s.driveCam)
  const setCam = useStore((s) => s.setDriveCam)
  const real = useStore((s) => s.driveSource === 'real')
  const link = useLink()
  const s = useSim(15)

  // real rover: send the letter for the held keys (the link repeats it while held)
  useEffect(() => {
    if (!real) return
    const id = setInterval(() => linkDrive(letterFor(sim.keys), sim.params.digit), 40)
    return () => {
      clearInterval(id)
      linkStop()
    }
  }, [real])
  const t = real && link.telemetry && performance.now() - link.telemetry.at < 1500 ? link.telemetry : null
  const bar = (p: number) => ({ ['--w' as string]: `${(Math.abs(p) / 255) * 50}%`, ['--l' as string]: p < 0 ? `${50 - (Math.abs(p) / 255) * 50}%` : '50%' })

  const press = (k: keyof typeof sim.keys, on: boolean) => (sim.keys[k] = on)
  const pad = (k: keyof typeof sim.keys, label: string, cls: string) => (
    <button
      className={'pad-btn ' + cls + (s.keys[k] ? ' on' : '')}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        press(k, true)
      }}
      onPointerUp={() => press(k, false)}
      onPointerCancel={() => press(k, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
        <path d="M12 6l7 10H5z" />
      </svg>
    </button>
  )

  return (
    <>
      <div className="hud" aria-live="off">
        {real && (
          <div className="hud-row">
            <span className="hud-k">Real rover</span>
            <b className={'link-dot ' + link.status}>{link.status === 'connected' ? (t ? 'live' : 'connected') : 'not connected'}</b>
          </div>
        )}
        {real ? (
          <>
            <div className="hud-row">
              <span className="hud-k">Ultrasonic (real)</span>
              <b>{t ? (t.cm >= 999 ? 'nothing in range' : `${t.cm} cm`) : '—'}</b>
            </div>
            <div className="hud-row">
              <span className="hud-k">IR left / right (real)</span>
              {t ? (
                <span className="ir">
                  <i className={t.irL ? 'dark' : ''} />
                  {t.irL ? 'HIGH' : 'LOW'}
                  <i className={t.irR ? 'dark' : ''} />
                  {t.irR ? 'HIGH' : 'LOW'}
                </span>
              ) : (
                <b>—</b>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="hud-row">
              <span className="hud-k">Ultrasonic</span>
              <b className={s.cm < s.params.SAFE_CM ? 'warn' : ''}>{s.cm === 999 ? 'nothing in range' : `${s.cm} cm`}</b>
            </div>
            <div className="hud-row">
              <span className="hud-k">IR left / right</span>
              <span className="ir">
                <i className={s.irL ? 'dark' : ''} />
                {s.irL ? 'HIGH' : 'LOW'}
                <i className={s.irR ? 'dark' : ''} />
                {s.irR ? 'HIGH' : 'LOW'}
              </span>
            </div>
          </>
        )}
        <div className="hud-row motors">
          <span className="hud-k">Motors L / R</span>
          <span className="mbar" style={bar(s.pwmL)}>
            <i />
            <em>{s.pwmL}</em>
          </span>
          <span className="mbar" style={bar(s.pwmR)}>
            <i />
            <em>{s.pwmR}</em>
          </span>
        </div>
        <div className="hud-row motors">
          <span className="hud-k">Wheels (RPM)</span>
          <span className={'rpm' + (slipping(s.body.left) ? ' slip' : '')}>{rpm(s.body.left.spin)}</span>
          <span className={'rpm' + (slipping(s.body.right) ? ' slip' : '')}>{rpm(s.body.right.spin)}</span>
        </div>
        <div className="hud-row">
          <span className="hud-k">Rover speed</span>
          <b>
            {Math.round(Math.abs(s.body.v) * 100)} cm/s
            {(slipping(s.body.left) || slipping(s.body.right)) && <em className="slip-tag">wheels slipping</em>}
          </b>
        </div>
        {mode === 'manual' && (
          <div className="hud-row">
            <span className="hud-k">Letter sent</span>
            <b className="letter">{letterFor(s.keys)}</b>
          </div>
        )}
      </div>

      {mode === 'manual' && (
        <div className="pad" aria-label="Drive pad">
          {pad('up', 'Forwards', 'up')}
          {pad('left', 'Turn left', 'left')}
          {pad('right', 'Turn right', 'right')}
          {pad('down', 'Backwards', 'down')}
        </div>
      )}

      <div className="toolbar" role="toolbar" aria-label="Simulator controls">
        {real ? (
          <button className="btn stop-btn" onClick={() => stopAll()} title="Stop the real rover (Space)">
            ■ STOP
          </button>
        ) : (
          <button className={'btn seg' + (s.running ? '' : ' on')} onClick={() => (sim.running = !sim.running)} title="Pause / run (Space)">
            {s.running ? 'Pause' : 'Run'}
          </button>
        )}
        <button className="btn" onClick={() => resetSim(mode, true)} title="Put the rover back at the start (R)">
          Reset
        </button>
        <span className="divider" />
        {(['chase', 'free', 'top'] as DriveCam[]).map((c) => (
          <button key={c} className={'btn seg' + (cam === c ? ' on' : '')} onClick={() => setCam(c)} title={`Camera: ${c}`}>
            {c === 'chase' ? 'Chase' : c === 'free' ? 'Free' : 'Top'}
          </button>
        ))}
      </div>
    </>
  )
}

const rpm = (radPerS: number) => Math.round((radPerS * 60) / (2 * Math.PI))
/** a tyre is slipping when its rim moves noticeably faster or slower than the ground under it */
const slipping = (side: { slip: number; spin: number }) => Math.abs(side.slip) > 0.06 && Math.abs(side.spin) > 1

/** Stop everything: release the keys (twin) and tell the real rover to stop. */
function stopAll() {
  Object.keys(sim.keys).forEach((k) => (sim.keys[k as keyof typeof sim.keys] = false))
  linkStop()
}

/** Keyboard: arrows / WASD drive, 0-9 speed, Space pause (or STOP the real rover), R reset. */
export function useDriveKeys(active: boolean) {
  useEffect(() => {
    if (!active) return
    const map: Record<string, keyof typeof sim.keys> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    }
    const down = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null
      if (el?.closest('input, textarea')) return
      const k = map[e.code]
      if (k) {
        e.preventDefault()
        sim.keys[k] = true
      } else if (/^Digit\d$/.test(e.code)) sim.params = { ...sim.params, digit: Number(e.code.slice(5)) }
      else if (e.code === 'Space') {
        e.preventDefault()
        if (useStore.getState().driveSource === 'real') stopAll()
        else if (!el?.closest('button')) sim.running = !sim.running
      } else if (e.code === 'KeyR') resetSim(sim.mode, true)
    }
    const up = (e: KeyboardEvent) => {
      const k = map[e.code]
      if (k) sim.keys[k] = false
    }
    const clear = () => Object.keys(sim.keys).forEach((k) => (sim.keys[k as keyof typeof sim.keys] = false))
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      clear()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [active])
}
