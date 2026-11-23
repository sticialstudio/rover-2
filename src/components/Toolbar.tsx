import { useStore } from '../store'
import { STEPS } from '../data/steps'
import { WIRE_GROUPS } from '../data/wiring'

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  explode: 'M12 3v4M12 17v4M3 12h4M17 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2',
  rotate: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4',
  eye: 'M12 5c-5 0-9 7-9 7s4 7 9 7 9-7 9-7-4-7-9-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  reset: 'M3 12h3M18 12h3M12 3v3M12 18v3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  replay: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4M10 9l5 3-5 3z',
  ghost: 'M5 20V10a7 7 0 0 1 14 0v10l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2zM9.5 10h.01M14.5 10h.01',
  prev: 'M15 6l-6 6 6 6',
  xray: 'M4 4h16v16H4zM4 9h16M9 4v16',
  next: 'M9 6l6 6-6 6',
}

function ExploreTools() {
  const explode = useStore((s) => s.explode)
  const setExplode = useStore((s) => s.setExplode)
  const toggleExplode = useStore((s) => s.toggleExplode)
  const autoRotate = useStore((s) => s.autoRotate)
  const toggleAutoRotate = useStore((s) => s.toggleAutoRotate)
  const isolate = useStore((s) => s.isolate)
  const toggleIsolate = useStore((s) => s.toggleIsolate)
  const resetView = useStore((s) => s.resetView)
  return (
    <>
      <button className={'btn seg' + (explode > 0.5 ? ' on' : '')} onClick={toggleExplode} title="Explode / assemble (E)">
        <Icon d={ICONS.explode} />
        {explode > 0.5 ? 'Assemble' : 'Explode'}
      </button>
      <label className="slider">
        <span className="sr-only">Explode amount</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={explode}
          onChange={(e) => setExplode(parseFloat(e.target.value))}
          style={{ ['--v' as string]: `${explode * 100}%` }}
        />
      </label>
      <span className="divider" />
      <button className={'icon-btn' + (autoRotate ? ' on' : '')} onClick={toggleAutoRotate} aria-pressed={autoRotate} title="Auto-rotate">
        <Icon d={ICONS.rotate} />
      </button>
      <button className={'icon-btn' + (isolate ? ' on' : '')} onClick={toggleIsolate} aria-pressed={isolate} title="Fade other parts when one is selected">
        <Icon d={ICONS.eye} />
      </button>
      <button className="icon-btn" onClick={resetView} title="Reset view (R)">
        <Icon d={ICONS.reset} />
      </button>
    </>
  )
}

function AssembleTools() {
  const step = useStore((s) => s.step)
  const prevStep = useStore((s) => s.prevStep)
  const nextStep = useStore((s) => s.nextStep)
  const replay = useStore((s) => s.replay)
  const ghost = useStore((s) => s.ghost)
  const toggleGhost = useStore((s) => s.toggleGhost)
  const resetView = useStore((s) => s.resetView)
  return (
    <>
      <button className="icon-btn" onClick={prevStep} disabled={step === 0} aria-label="Previous step" title="Previous step (←)">
        <Icon d={ICONS.prev} />
      </button>
      <span className="step-count" aria-live="polite">
        {step + 1} / {STEPS.length}
      </span>
      <button className="icon-btn" onClick={nextStep} disabled={step === STEPS.length - 1} aria-label="Next step" title="Next step (→)">
        <Icon d={ICONS.next} />
      </button>
      <span className="divider" />
      <button className="btn" onClick={replay} title="Replay this step (Space)">
        <Icon d={ICONS.replay} />
        Replay
      </button>
      <button className={'icon-btn' + (ghost ? ' on' : '')} onClick={toggleGhost} aria-pressed={ghost} title="Show the finished rover as a faint outline (G)">
        <Icon d={ICONS.ghost} />
      </button>
      <button className="icon-btn" onClick={resetView} title="Re-frame this step (R)">
        <Icon d={ICONS.reset} />
      </button>
    </>
  )
}

function WireTools() {
  const idx = useStore((s) => s.wireGroup)
  const setGroup = useStore((s) => s.setWireGroup)
  const xray = useStore((s) => s.xray)
  const toggleXray = useStore((s) => s.toggleXray)
  const resetView = useStore((s) => s.resetView)
  return (
    <>
      <button className="icon-btn" onClick={() => setGroup(idx - 1)} disabled={idx === 0} aria-label="Previous connection" title="Previous connection (←)">
        <Icon d={ICONS.prev} />
      </button>
      <span className="step-count" aria-live="polite">
        {idx + 1} / {WIRE_GROUPS.length}
      </span>
      <button
        className="icon-btn"
        onClick={() => setGroup(idx + 1)}
        disabled={idx === WIRE_GROUPS.length - 1}
        aria-label="Next connection"
        title="Next connection (→)"
      >
        <Icon d={ICONS.next} />
      </button>
      <span className="divider" />
      <button className={'btn seg' + (xray ? ' on' : '')} onClick={toggleXray} aria-pressed={xray} title="Fade the wooden frame so the wires show (X)">
        <Icon d={ICONS.xray} />
        X-ray
      </button>
      <button className="icon-btn" onClick={resetView} title="Re-frame this connection (R)">
        <Icon d={ICONS.reset} />
      </button>
    </>
  )
}

export function Toolbar() {
  const mode = useStore((s) => s.mode)
  return (
    <div className="toolbar" role="toolbar" aria-label="Viewer controls">
      {mode === 'explore' ? <ExploreTools /> : mode === 'assemble' ? <AssembleTools /> : <WireTools />}
    </div>
  )
}
