import { useEffect, useRef } from 'react'
import { CATEGORIES, CATEGORY_BY_ID, ORDERED_PARTS, PART_BY_ID } from '../data/parts'
import { useStore } from '../store'

function Overview() {
  const model = useStore((s) => s.model)
  const totalPieces = model ? Object.values(model.pieces).reduce((a, b) => a + b, 0) : null
  const size = model ? model.sizeMm.map((v) => (v / 10).toFixed(0)).join(' × ') : '—'
  return (
    <section className="card overview">
      <p className="eyebrow">Meet the rover</p>
      <h1>ROVER 2.0</h1>
      <p className="lede">
        A laser-cut wooden robot car with an Arduino brain, distance and line sensors, and Bluetooth control. Spin it
        around, pull it apart, and click any part to see what it does.
      </p>
      <dl className="stats">
        <div>
          <dt>Part groups</dt>
          <dd>{ORDERED_PARTS.length}</dd>
        </div>
        <div>
          <dt>Pieces</dt>
          <dd>{totalPieces ?? '—'}</dd>
        </div>
        <div>
          <dt>Size (cm)</dt>
          <dd>{size}</dd>
        </div>
      </dl>
    </section>
  )
}

function Detail({ id }: { id: string }) {
  const part = PART_BY_ID[id]
  const cat = CATEGORY_BY_ID[part.category]
  const select = useStore((s) => s.select)
  const idx = ORDERED_PARTS.findIndex((p) => p.id === id)
  const prev = ORDERED_PARTS[(idx - 1 + ORDERED_PARTS.length) % ORDERED_PARTS.length]
  const next = ORDERED_PARTS[(idx + 1) % ORDERED_PARTS.length]

  return (
    <section className="card detail" key={id}>
      <div className="detail-head">
        <span className="chip" style={{ ['--c' as string]: cat.color }}>
          <i />
          {cat.label}
        </span>
        <button className="icon-btn" onClick={() => select(null)} aria-label="Close part details" title="Close (Esc)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <h2>{part.name}</h2>
      <p className="qty">Qty · {part.qty}</p>
      <p className="blurb">{part.blurb}</p>
      <p className="desc">{part.description}</p>

      <dl className="specs">
        {part.specs.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {part.pins && (
        <div className="pins">
          <p className="mini-label">Pins</p>
          <div className="pin-row">
            {part.pins.map((p) => (
              <span key={p} className="pin">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {part.verify && <p className="note">Model inferred from the 3D file. Check it against your kit.</p>}

      <div className="detail-nav">
        <button className="btn ghost" onClick={() => select(prev.id)}>
          ← {prev.name}
        </button>
        <button className="btn ghost" onClick={() => select(next.id)}>
          {next.name} →
        </button>
      </div>
    </section>
  )
}

export function PartsPanel() {
  const selected = useStore((s) => s.selected)
  const hovered = useStore((s) => s.hovered)
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const model = useStore((s) => s.model)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selected])

  return (
    <aside className="panel" ref={panelRef}>
      {selected ? <Detail id={selected} /> : <Overview />}

      <section className="parts">
        <h3 className="section-title">Parts</h3>
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="cat">
            <p className="cat-label" style={{ ['--c' as string]: cat.color }}>
              <i />
              {cat.label}
            </p>
            <ul>
              {ORDERED_PARTS.filter((p) => p.category === cat.id).map((p) => (
                <li key={p.id}>
                  <button
                    className={
                      'part-row' + (selected === p.id ? ' is-selected' : '') + (hovered === p.id ? ' is-hovered' : '')
                    }
                    onClick={() => select(selected === p.id ? null : p.id)}
                    onMouseEnter={() => hover(p.id)}
                    onMouseLeave={() => hover(null)}
                  >
                    <span className="part-name">{p.name}</span>
                    <span className="part-count">{model?.pieces[p.id] ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </aside>
  )
}
