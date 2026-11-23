import { useEffect, useRef } from 'react'
import { PIN_MAP, RESERVED_PINS, WIRE_BY_ID, WIRE_GROUPS, type WireGroup } from '../data/wiring'
import { useStore } from '../store'

const W = 310
const BLOCK = 112
const HEADER = 24
const ROW = 26
const GAP = 12

/** Device blocks on the left, the board on the right, one row per wire. */
function WireDiagram({ group }: { group: WireGroup }) {
  const active = useStore((s) => s.wire ?? s.wirePinned)
  const pinned = useStore((s) => s.wirePinned)
  const hoverWire = useStore((s) => s.hoverWire)
  const pinWire = useStore((s) => s.pinWire)

  // lay out rows, starting a new device block whenever the device name changes
  const rows: { id: string; y: number }[] = []
  const blocks: { name: string; top: number; bottom: number }[] = []
  let y = HEADER
  group.wires.forEach((w, i) => {
    const name = w.device ?? group.device
    if (i === 0 || name !== (group.wires[i - 1].device ?? group.device)) {
      if (i > 0) y += GAP + HEADER
      blocks.push({ name, top: y - HEADER, bottom: y })
    }
    rows.push({ id: w.id, y: y + ROW / 2 })
    y += ROW
    blocks[blocks.length - 1].bottom = y
  })
  const H = y + 4

  return (
    <svg className="wire-diagram" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Wiring diagram: ${group.title}`}>
      {blocks.map((b) => (
        <g key={b.name}>
          <rect x={0.5} y={b.top + 0.5} width={BLOCK} height={b.bottom - b.top + 2} rx={8} className="wd-block" />
          <text x={10} y={b.top + 16} className="wd-head">
            {b.name}
          </text>
        </g>
      ))}
      <rect x={W - BLOCK - 0.5} y={0.5} width={BLOCK} height={H - 1} rx={8} className="wd-block board" />
      <text x={W - BLOCK + 10} y={16} className="wd-head">
        {group.board}
      </text>

      {group.wires.map((w, i) => {
        const ry = rows[i].y
        const on = active === w.id
        const dim = active !== null && !on
        const x1 = BLOCK
        const x2 = W - BLOCK
        const d = `M${x1} ${ry} C${x1 + 40} ${ry} ${x2 - 40} ${ry} ${x2} ${ry}`
        return (
          <g
            key={w.id}
            className={'wd-row' + (on ? ' on' : '') + (dim ? ' dim' : '')}
            tabIndex={0}
            role="button"
            aria-pressed={pinned === w.id}
            aria-label={`${w.colorName} wire: ${w.device ? w.device + ' ' : ''}${w.from} to ${w.to}`}
            onMouseEnter={() => hoverWire(w.id)}
            onMouseLeave={() => hoverWire(null)}
            onFocus={() => hoverWire(w.id)}
            onBlur={() => hoverWire(null)}
            onClick={() => pinWire(pinned === w.id ? null : w.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pinWire(pinned === w.id ? null : w.id)
              }
            }}
          >
            <rect x={0} y={ry - ROW / 2} width={W} height={ROW} className="wd-hit" />
            <path d={d} className="wd-casing" />
            <path d={d} className="wd-wire" style={{ stroke: w.color }} />
            <text x={BLOCK - 14} y={ry + 4} textAnchor="end" className="wd-pin">
              {w.from}
            </text>
            <circle cx={x1} cy={ry} r={4} className="wd-dot" style={{ fill: w.color }} />
            <circle cx={x2} cy={ry} r={4} className="wd-dot" style={{ fill: w.color }} />
            <text x={x2 + 12} y={ry + 4} className="wd-pin">
              {w.to}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Readout({ group }: { group: WireGroup }) {
  const active = useStore((s) => s.wire ?? s.wirePinned)
  const info = active ? WIRE_BY_ID[active] : null
  if (!info) return <p className="wire-readout muted">Hover or tap a wire to trace it on the rover.</p>
  const w = info.wire
  return (
    <p className="wire-readout" style={{ ['--c' as string]: w.color }}>
      <i />
      <span>
        <b>{w.colorName}</b> · {w.device ?? group.device} <b>{w.from}</b> → <b>{w.to}</b>
        {w.note && <span className="why"> {w.note}</span>}
        {!w.piece && <span className="why"> (not in the 3D model)</span>}
      </span>
    </p>
  )
}

export function WirePanel() {
  const idx = useStore((s) => s.wireGroup)
  const setGroup = useStore((s) => s.setWireGroup)
  const setMode = useStore((s) => s.setMode)
  const g = WIRE_GROUPS[idx]
  const last = WIRE_GROUPS.length - 1
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [idx])

  return (
    <aside className="panel" ref={panelRef}>
      <section className="card step-card wire-card" key={g.id}>
        <div className="step-meta">
          <span>
            Connection {idx + 1} <span className="of">of {WIRE_GROUPS.length}</span>
          </span>
          <span className="wire-count">
            {g.wires.length} wire{g.wires.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="progress" aria-hidden>
          <span style={{ width: `${((idx + 1) / WIRE_GROUPS.length) * 100}%` }} />
        </div>
        <h2>{g.title}</h2>
        <p className="lede">{g.summary}</p>

        <WireDiagram group={g} />
        <Readout group={g} />
        {g.notModelled && <p className="note">{g.notModelled}</p>}

        <p className="mini-label">Do this</p>
        <ol className="instructions">
          {g.instructions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>

        {g.caution && (
          <div className="callout caution">
            <b>Careful</b>
            {g.caution}
          </div>
        )}
        {g.tip && (
          <div className="callout tip">
            <b>Tip</b>
            {g.tip}
          </div>
        )}

        <div className="step-nav">
          <button className="btn" onClick={() => setGroup(idx - 1)} disabled={idx === 0}>
            ← Back
          </button>
          {idx < last ? (
            <button className="btn primary" onClick={() => setGroup(idx + 1)}>
              Next: {WIRE_GROUPS[idx + 1].title} →
            </button>
          ) : (
            <button className="btn primary" onClick={() => setMode('explore')}>
              All wired. Explore your rover →
            </button>
          )}
        </div>
      </section>

      <section className="parts">
        <h3 className="section-title">All connections</h3>
        <ol className="step-list">
          {WIRE_GROUPS.map((x, i) => (
            <li key={x.id}>
              <button
                className={'step-row' + (i === idx ? ' is-current' : '') + (i < idx ? ' is-done' : '')}
                onClick={() => setGroup(i)}
                aria-current={i === idx ? 'step' : undefined}
              >
                <span className="step-dot">{i < idx ? '✓' : i + 1}</span>
                <span className="grow">{x.title}</span>
                <span className="swatches" aria-hidden>
                  {x.wires.map((w) => (
                    <i key={w.id} style={{ background: w.color }} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="card pin-map">
        <h3 className="section-title">Arduino pin map</h3>
        <p className="lede small">The Code tab uses these pins.</p>
        <table>
          <tbody>
            {PIN_MAP.map((r) => (
              <tr key={r.pin} className={r.group === idx ? 'is-current' : ''} onClick={() => setGroup(r.group)}>
                <th>{r.pin}</th>
                <td>{r.use}</td>
              </tr>
            ))}
            {RESERVED_PINS.map((r) => (
              <tr key={r.pin} className="reserved">
                <th>{r.pin}</th>
                <td>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </aside>
  )
}
