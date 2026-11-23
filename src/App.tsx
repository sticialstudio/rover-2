import { lazy, Suspense, useEffect, useState } from 'react'
import { Loader, Viewer } from './components/Viewer'
import { PartsPanel } from './components/PartsPanel'
import { StepsPanel } from './components/StepsPanel'
import { WirePanel } from './components/WirePanel'
import { CodeView } from './components/CodeView'
import { CodeInsetLabel, CodePanel, CodePins } from './components/CodePanel'
import { DriveHud, DrivePanel, useDriveKeys } from './components/DrivePanel'
import { Toolbar } from './components/Toolbar'
import { MissionsPanel } from './components/MissionsPanel'
import { MISSION_BY_ID, useMissions } from './missions/missions'

// the block editor (Blockly, ~1 MB) only loads with the Missions tab
const BlocksView = lazy(() => import('./components/BlocksView'))
import { useStore, type Mode } from './store'
import { ORDERED_PARTS } from './data/parts'

const SECTIONS: { id: string; label: string; mode?: Mode }[] = [
  { id: 'explore', label: 'Explore', mode: 'explore' },
  { id: 'assemble', label: 'Assemble', mode: 'assemble' },
  { id: 'wire', label: 'Wire', mode: 'wire' },
  { id: 'code', label: 'Code', mode: 'code' },
  { id: 'missions', label: 'Missions', mode: 'missions' },
  { id: 'drive', label: 'Drive', mode: 'drive' },
]

type Theme = 'light' | 'dark'

function useTheme(): [Theme, () => void] {
  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('rover-theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* storage unavailable */
    }
    return media?.matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('rover-theme', next)
      } catch {
        /* storage unavailable */
      }
      return next
    })
  return [theme, toggle]
}

/** Keep the URL in sync so a step can be linked: #explore, #assemble/3, #wire/2 */
function useHashRoute() {
  useEffect(() => {
    const apply = () => {
      const s = useStore.getState()
      const d = /^#drive(?:\/(manual|obstacle|line|real))?/.exec(location.hash)
      if (d) {
        s.setMode('drive')
        if (d[1] === 'real') s.setDriveSource('real')
        else if (d[1]) {
          s.setDriveSource('sim')
          s.setDriveMode(d[1] as 'manual' | 'obstacle' | 'line')
        }
        return
      }
      const mi = /^#missions(?:\/([\w-]+))?/.exec(location.hash)
      if (mi) {
        if (mi[1] && MISSION_BY_ID[mi[1]] && useMissions.getState().id !== mi[1]) useMissions.getState().select(mi[1])
        s.setMode('missions')
        return
      }
      const m = /^#(explore|assemble|wire|code)(?:\/(\d+))?/.exec(location.hash)
      if (!m) return
      s.setMode(m[1] as Mode)
      if (m[1] === 'assemble' && m[2]) s.setStep(parseInt(m[2], 10) - 1)
      if (m[1] === 'wire' && m[2]) s.setWireGroup(parseInt(m[2], 10) - 1)
      if (m[1] === 'code' && m[2]) s.setProgram(parseInt(m[2], 10) - 1)
    }
    apply()
    window.addEventListener('hashchange', apply)
    const write = () => {
      const s = useStore.getState()
      const hash =
        s.mode === 'assemble'
          ? `#assemble/${s.step + 1}`
          : s.mode === 'wire'
            ? `#wire/${s.wireGroup + 1}`
            : s.mode === 'code'
              ? `#code/${s.program + 1}`
              : s.mode === 'missions'
                ? `#missions/${useMissions.getState().id}`
                : s.mode === 'drive'
                  ? `#drive/${s.driveSource === 'real' ? 'real' : s.driveMode}`
                  : '#explore'
      if (location.hash !== hash) history.replaceState(null, '', hash)
    }
    const unsubMissions = useMissions.subscribe((m, prev) => {
      if (m.id !== prev.id) write()
    })
    const unsub = useStore.subscribe((s, prev) => {
      if (
        s.mode === prev.mode &&
        s.step === prev.step &&
        s.wireGroup === prev.wireGroup &&
        s.program === prev.program &&
        s.driveMode === prev.driveMode &&
        s.driveSource === prev.driveSource
      )
        return
      write()
    })
    return () => {
      window.removeEventListener('hashchange', apply)
      unsubMissions()
      unsub()
    }
  }, [])
}

function useKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : document.body
      if (target.closest('input, textarea')) return
      const s = useStore.getState()
      if (s.mode === 'drive') return // handled by useDriveKeys
      if (s.mode === 'missions') return // the block editor uses the keyboard
      if (s.mode === 'code') {
        if (e.key === 'ArrowRight') s.setProgram(s.program + 1)
        else if (e.key === 'ArrowLeft') s.setProgram(s.program - 1)
        return
      }
      if (s.mode === 'wire') {
        if (e.key === 'ArrowRight') s.setWireGroup(s.wireGroup + 1)
        else if (e.key === 'ArrowLeft') s.setWireGroup(s.wireGroup - 1)
        else if (e.key === 'r' || e.key === 'R') s.resetView()
        else if (e.key === 'x' || e.key === 'X') s.toggleXray()
        else if (e.key === 'Escape') s.pinWire(null)
        return
      }
      if (s.mode === 'assemble') {
        if (e.key === 'ArrowRight') s.nextStep()
        else if (e.key === 'ArrowLeft') s.prevStep()
        else if (e.key === 'r' || e.key === 'R') s.resetView()
        else if (e.key === 'g' || e.key === 'G') s.toggleGhost()
        else if (e.key === ' ' && !target.closest('button')) {
          e.preventDefault()
          s.replay()
        }
        return
      }
      if (e.key === 'Escape') s.select(null)
      else if (e.key === 'e' || e.key === 'E') s.toggleExplode()
      else if (e.key === 'r' || e.key === 'R') s.resetView()
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = ORDERED_PARTS.findIndex((p) => p.id === s.selected)
        const n = ORDERED_PARTS.length
        const next = e.key === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
        s.select(ORDERED_PARTS[i < 0 ? 0 : next].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const mode = useStore((s) => s.mode)
  const driveSource = useStore((s) => s.driveSource)
  const setMode = useStore((s) => s.setMode)
  useKeys()
  useHashRoute()
  useDriveKeys(mode === 'drive')

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#explore">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="3" />
            <circle cx="16" cy="16" r="3" fill="#fff" />
          </svg>
          <span>
            ROVER <b>2.0</b>
          </span>
        </a>
        <nav className="steps" aria-label="Guide sections">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              className={'step' + (s.mode === mode ? ' active' : '')}
              disabled={!s.mode}
              aria-current={s.mode === mode ? 'page' : undefined}
              onClick={() => s.mode && setMode(s.mode)}
            >
              <span className="step-n">{i + 1}</span>
              {s.label}
              {!s.mode && <span className="soon">soon</span>}
            </button>
          ))}
        </nav>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode" title="Toggle theme">
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
            </svg>
          )}
        </button>
      </header>

      <main className="workspace">
        <section className={'stage' + (mode === 'code' ? ' code-mode' : mode === 'missions' ? ' missions-mode' : '')}>
          {mode === 'code' && <CodeView />}
          {mode === 'missions' && (
            <Suspense fallback={<div className="blocks-pane loading">Loading the block editor…</div>}>
              <BlocksView dark={theme === 'dark'} />
            </Suspense>
          )}
          <div className="stage-hint" hidden={mode === 'code' || mode === 'missions'}>
            <span>Drag to orbit</span>
            <span>Scroll to zoom</span>
            {mode === 'explore' ? (
              <>
                <span>Click a part</span>
                <span className="keys">
                  <kbd>E</kbd> explode <kbd>R</kbd> reset <kbd>←</kbd>
                  <kbd>→</kbd> parts
                </span>
              </>
            ) : mode === 'drive' ? (
              <>
                <span className="keys">
                  <kbd>↑</kbd>
                  <kbd>↓</kbd>
                  <kbd>←</kbd>
                  <kbd>→</kbd> drive <kbd>0</kbd>–<kbd>9</kbd> speed <kbd>Space</kbd> {driveSource === 'real' ? 'STOP' : 'pause'} <kbd>R</kbd> reset
                </span>
              </>
            ) : mode === 'wire' ? (
              <>
                <span>Hover a wire to trace it</span>
                <span className="keys">
                  <kbd>←</kbd>
                  <kbd>→</kbd> connections <kbd>X</kbd> x-ray
                </span>
              </>
            ) : (
              <>
                <span>Hover a part for its name</span>
                <span className="keys">
                  <kbd>←</kbd>
                  <kbd>→</kbd> steps <kbd>Space</kbd> replay <kbd>G</kbd> outline
                </span>
              </>
            )}
          </div>
          <div className="canvas-wrap">
            <Viewer dark={theme === 'dark'} />
            <Loader />
            {mode === 'code' && <CodeInsetLabel />}
          </div>
          {mode !== 'code' && mode !== 'drive' && mode !== 'missions' && <Toolbar />}
          {mode === 'drive' && <DriveHud />}
          {mode === 'code' && <CodePins />}
        </section>
        {mode === 'explore' ? (
          <PartsPanel />
        ) : mode === 'assemble' ? (
          <StepsPanel />
        ) : mode === 'wire' ? (
          <WirePanel />
        ) : mode === 'code' ? (
          <CodePanel />
        ) : mode === 'missions' ? (
          <MissionsPanel />
        ) : (
          <DrivePanel />
        )}
      </main>
    </div>
  )
}
