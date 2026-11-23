import { useEffect, useRef } from 'react'
import { PROGRAMS, type FlowNode } from '../data/programs'
import { PART_BY_ID } from '../data/parts'
import { WIRE_GROUPS } from '../data/wiring'
import { useStore } from '../store'

const LEVELS = ['', 'Beginner', 'Intermediate', 'Advanced']

function FlowBox({ node, label }: { node: FlowNode; label?: string }) {
  const on = useStore((s) => s.codeNode === node.id)
  const setCodeNode = useStore((s) => s.setCodeNode)
  return (
    <button
      className={`fn fn-${node.kind}` + (on ? ' on' : '')}
      onMouseEnter={() => setCodeNode(node.id, node.part)}
      onMouseLeave={() => setCodeNode(null)}
      onFocus={() => setCodeNode(node.id, node.part)}
      onBlur={() => setCodeNode(null)}
    >
      {label ?? node.text}
    </button>
  )
}

function FlowList({ nodes }: { nodes: FlowNode[] }) {
  return (
    <div className="flow-list">
      {nodes.map((n) => (
        <div className="flow-item" key={n.id}>
          {n.kind === 'if' ? (
            <>
              <FlowBox node={n} />
              <i className="fn-stem" />
              <div className="fn-branches" style={{ ['--n' as string]: n.branches.length }}>
                {n.branches.map((b) => (
                  <div className="fn-branch" key={b.label}>
                    <span className="fn-label">{b.label}</span>
                    {b.nodes.length ? <FlowList nodes={b.nodes} /> : <span className="fn-skip">carry on</span>}
                    <i className="fn-tail" />
                  </div>
                ))}
              </div>
            </>
          ) : n.kind === 'repeat' ? (
            <div className="fn-loopbox">
              <FlowBox node={n} label={`↻ ${n.text}`} />
              <FlowList nodes={n.nodes} />
            </div>
          ) : (
            <FlowBox node={n} />
          )}
        </div>
      ))}
    </div>
  )
}

export function Flowchart({ setup, loop }: { setup: FlowNode[]; loop: FlowNode[] }) {
  return (
    <div className="flow" aria-label="Flowchart">
      <div className="flow-item">
        <span className="fn fn-start">Power on</span>
      </div>
      <p className="flow-section">setup() · runs once</p>
      <FlowList nodes={setup} />
      <div className="flow-loop">
        <p className="flow-section">loop() · repeats forever ↻</p>
        <FlowList nodes={loop} />
      </div>
    </div>
  )
}

/** Under the 3D inset: the pins this program talks to, from the wiring guide. */
export function CodePins() {
  const idx = useStore((s) => s.program)
  const setMode = useStore((s) => s.setMode)
  const setWireGroup = useStore((s) => s.setWireGroup)
  const p = PROGRAMS[idx]
  const groups = WIRE_GROUPS.map((g, i) => ({ g, i })).filter(({ g }) => g.id !== 'power' && p.parts.includes(g.parts[0]))
  return (
    <section className="code-pins">
      <h3 className="section-title">Pins this program uses</h3>
      <ul>
        {groups.map(({ g, i }) => {
          const pins = [
            ...new Set(
              g.wires
                .filter((w) => w.kind === 'signal' || w.kind === 'motor')
                .map((w) => (w.kind === 'motor' ? w.to.split(' ')[0] : `${w.to} ${w.from}`)),
            ),
          ].sort()
          return (
            <li key={g.id}>
              <button
                onClick={() => {
                  setMode('wire')
                  setWireGroup(i)
                }}
                title="Show this wiring"
              >
                <span className="who">{g.device}</span>
                <span className="pins">
                  {pins.map((x) => (
                    <code key={x}>{x}</code>
                  ))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Small overlay on the 3D inset: which parts this program uses. */
export function CodeInsetLabel() {
  const idx = useStore((s) => s.program)
  const codePart = useStore((s) => s.codePart)
  return (
    <div className="inset-label">
      {codePart ? (
        <span className="inset-chip on">{PART_BY_ID[codePart]?.name}</span>
      ) : (
        PROGRAMS[idx].parts
          .filter((id) => id !== 'arduino_uno' && id !== 'motor_shield')
          .map((id) => (
            <span className="inset-chip" key={id}>
              {PART_BY_ID[id].name}
            </span>
          ))
      )}
    </div>
  )
}

export function CodePanel() {
  const idx = useStore((s) => s.program)
  const setProgram = useStore((s) => s.setProgram)
  const setMode = useStore((s) => s.setMode)
  const p = PROGRAMS[idx]
  const last = PROGRAMS.length - 1
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [idx])

  return (
    <aside className="panel" ref={panelRef}>
      <section className="card step-card code-card" key={p.id}>
        <div className="step-meta">
          <span>
            Program {idx + 1} <span className="of">of {PROGRAMS.length}</span>
          </span>
          <span className={`level l${p.level}`}>
            <i />
            <i />
            <i />
            {LEVELS[p.level]}
          </span>
        </div>
        <div className="progress" aria-hidden>
          <span style={{ width: `${((idx + 1) / PROGRAMS.length) * 100}%` }} />
        </div>
        <h2>{p.title}</h2>
        <p className="lede">{p.summary}</p>

        <p className="mini-label">You’ll learn</p>
        <ul className="learn">
          {p.learn.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>

        <p className="mini-label">How it thinks</p>
        <Flowchart setup={p.setup} loop={p.loop} />
        <p className="flow-hint">Hover a box to light up its code and the part it uses.</p>

        <p className="mini-label">Try it</p>
        <ol className="instructions">
          {p.tryIt.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>

        {p.caution && (
          <div className="callout caution">
            <b>Careful</b>
            {p.caution}
          </div>
        )}
        {p.tip && (
          <div className="callout tip">
            <b>Tip</b>
            {p.tip}
          </div>
        )}

        <div className="step-nav">
          <button className="btn" onClick={() => setProgram(idx - 1)} disabled={idx === 0}>
            ← Back
          </button>
          {idx < last ? (
            <button className="btn primary" onClick={() => setProgram(idx + 1)}>
              Next: {PROGRAMS[idx + 1].title} →
            </button>
          ) : (
            <button className="btn primary" onClick={() => setMode('explore')}>
              Explore your rover →
            </button>
          )}
        </div>
      </section>

      <section className="parts">
        <h3 className="section-title">All programs</h3>
        <ol className="step-list">
          {PROGRAMS.map((x, i) => (
            <li key={x.id}>
              <button
                className={'step-row' + (i === idx ? ' is-current' : '')}
                onClick={() => setProgram(i)}
                aria-current={i === idx ? 'step' : undefined}
              >
                <span className="step-dot">{i + 1}</span>
                <span className="grow">{x.title}</span>
                <span className={`level mini l${x.level}`} title={LEVELS[x.level]}>
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="card upload">
        <h3 className="section-title">How to upload</h3>
        <ol className="instructions">
          <li>
            Install the Arduino IDE from{' '}
            <a href="https://www.arduino.cc/en/software" target="_blank" rel="noreferrer">
              arduino.cc/en/software
            </a>
            .
          </li>
          <li>
            Open <b>Library Manager</b>, search <code>Adafruit Motor Shield library</code> and install it. Pick the original one (it
            provides <code>AFMotor.h</code>), not the V2 library.
          </li>
          <li>
            Plug in the UNO. Choose <b>Tools → Board → Arduino Uno</b> and the new COM port under <b>Tools → Port</b>.
          </li>
          <li>Open the downloaded .ino file. Let the IDE put it in a folder of the same name.</li>
          <li>
            Click <b>Upload</b> (the → button). When it says “Done uploading”, switch the battery ON to run the motors.
          </li>
        </ol>
        <p className="note">No COM port? Many UNO clones use a CH340 USB chip. Install the CH340 driver and plug it in again.</p>
      </section>
    </aside>
  )
}
