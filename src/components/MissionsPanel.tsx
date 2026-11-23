import { useEffect, useState } from 'react'
import { CHAPTERS, MISSIONS, MISSION_BY_ID, resetProgress, useMissions } from '../missions/missions'
import { sim } from '../sim/sim'
import { useStore, type DriveCam } from '../store'
import { BookIcon, LessonGuide } from './LessonGuide'
import { RealRoverCard } from './RealRoverCard'

function Stars({ n, of = 3, big }: { n: number; of?: number; big?: boolean }) {
  return (
    <span className={'stars' + (big ? ' big' : '')} aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''}>
          ★
        </i>
      ))}
    </span>
  )
}

/** Live readings (10 times a second); a lesson can point at the ones it is about. */
function Readout({ watch = [] }: { watch?: ('distance' | 'ir')[] }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])
  return (
    <dl className="mission-readout">
      <div>
        <dt>Time</dt>
        <dd>{sim.time.toFixed(1)} s</dd>
      </div>
      <div className={watch.includes('distance') ? 'watch' : ''}>
        <dt>Distance</dt>
        <dd>{sim.cm >= 999 ? '—' : `${sim.cm} cm`}</dd>
      </div>
      <div className={watch.includes('ir') ? 'watch' : ''}>
        <dt>IR left</dt>
        <dd className={sim.irL ? 'on' : ''}>{sim.irL ? 'line' : 'floor'}</dd>
      </div>
      <div className={watch.includes('ir') ? 'watch' : ''}>
        <dt>IR right</dt>
        <dd className={sim.irR ? 'on' : ''}>{sim.irR ? 'line' : 'floor'}</dd>
      </div>
      <div>
        <dt>Motors</dt>
        <dd>
          {Math.round(sim.pwmL)} / {Math.round(sim.pwmR)}
        </dd>
      </div>
    </dl>
  )
}

const CAMS: [DriveCam, string][] = [
  ['top', 'Top'],
  ['chase', 'Chase'],
  ['free', 'Free'],
]

export function MissionsPanel() {
  const { id, status, result, earned, stars, speed, showCode, live, select, run, stop, reset, setSpeed, toggleCode } = useMissions()
  const driveCam = useStore((s) => s.driveCam)
  const setDriveCam = useStore((s) => s.setDriveCam)
  const m = MISSION_BY_ID[id]
  const [hints, setHints] = useState(0)
  const [page, setPage] = useState(0)
  const index = MISSIONS.indexOf(m)
  const next = MISSIONS[index + 1]
  const possible = MISSIONS.reduce((t, x) => t + x.stars.length, 0)
  const total = MISSIONS.reduce((t, x) => t + Math.min(stars[x.id] ?? 0, x.stars.length), 0)
  // the lesson that teaches this mission's sensor: the last one before it in its chapter
  const lesson = m.lesson ? undefined : MISSIONS.slice(0, index).reverse().find((x) => x.lesson && x.chapter === m.chapter)
  const lessonPage = m.lesson?.[Math.min(page, m.lesson.length - 1)]

  useEffect(() => {
    setHints(0)
    setPage(0)
  }, [id])

  // Space: run / stop (unless typing in the block editor)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target instanceof Element && e.target.closest('input, textarea, .blocklyWidgetDiv, .blocks-pane'))) return
      e.preventDefault()
      const s = useMissions.getState()
      if (s.status === 'running') s.stop()
      else s.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <aside className="panel">
      <section className="card mission-card" key={m.id}>
        <div className="step-meta">
          <span>
            {m.chapter}
            {m.lesson ? ' · Lesson' : ''}
          </span>
          {m.stars.length > 0 && <Stars n={stars[m.id] ?? 0} of={m.stars.length} />}
        </div>
        <h2>{m.title}</h2>
        {(!m.lesson || page === 0) && <p className="lede">{m.brief}</p>}
        {lesson && (
          <button className="lesson-link" onClick={() => select(lesson.id)}>
            <BookIcon /> Not sure how? Lesson: {lesson.title}
          </button>
        )}
        {m.lesson && <LessonGuide pages={m.lesson} page={Math.min(page, m.lesson.length - 1)} setPage={setPage} />}
        <div className="mission-goal">
          <b>Goal</b>
          {m.goal}
        </div>
        {m.stars.length > 0 && !m.lesson && (
          <ul className="star-rules">
            {m.stars.map((s, i) => (
              <li key={s.text} className={i < (stars[m.id] ?? 0) ? 'got' : ''}>
                <i>★</i>
                {s.text}
              </li>
            ))}
          </ul>
        )}

        <div className="mission-run">
          {status === 'running' ? (
            <button className="btn primary run" onClick={stop}>
              ■ Stop{live ? ' the rover' : ''}
            </button>
          ) : (
            <button className="btn primary run" onClick={run}>
              ▶ Run
            </button>
          )}
          <button className="btn" onClick={reset} title="Put the rover back on the start">
            ↺ Reset
          </button>
        </div>
        <div className="mission-options">
          <div className="seg" role="group" aria-label="Speed">
            {([1, 2, 4] as const).map((v) => (
              <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Camera">
            {CAMS.map(([v, label]) => (
              <button key={v} className={driveCam === v ? 'on' : ''} onClick={() => setDriveCam(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <Readout watch={lessonPage?.watch} />

        {result && (
          <div className={'mission-result ' + (result.passed ? 'pass' : 'fail')}>
            {result.passed ? (
              <>
                <b>Mission complete!</b>
                <Stars n={earned} of={m.stars.length || 3} big />
                <p>
                  {result.reason} {result.time} s, {result.blocks} blocks.
                </p>
                <div className="mission-result-nav">
                  {next && (
                    <button className="btn primary" onClick={() => select(next.id)}>
                      Next: {next.title} →
                    </button>
                  )}
                  <button className="btn" onClick={run}>
                    Run again
                  </button>
                </div>
              </>
            ) : (
              <>
                <b>Not yet</b>
                <p>{result.reason}</p>
                <button className="btn" onClick={run}>
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        {m.hints.length > 0 && !m.lesson && (
          <div className="mission-hints">
            {m.hints.slice(0, hints).map((h, i) => (
              <p key={i}>
                <b>Hint {i + 1}</b> {h}
              </p>
            ))}
            {hints < m.hints.length && (
              <button className="btn small" onClick={() => setHints(hints + 1)}>
                {hints ? 'Another hint' : 'Show a hint'}
              </button>
            )}
          </div>
        )}

        <button className="btn code-toggle" onClick={toggleCode}>
          {showCode ? 'Hide the Arduino code' : 'Show the Arduino code'}
        </button>
        <RealRoverCard />
      </section>

      <section className="parts">
        <h3 className="section-title mission-total">
          Missions
          <span>
            ★ {total} / {possible}
          </span>
        </h3>
        {CHAPTERS.map((c) => (
          <div key={c.title} className="mission-chapter">
            <p className="mini-label">{c.title}</p>
            <ol className="mission-list">
              {c.missions.map((x) => {
                // lessons have no number, so the missions keep theirs
                const n = MISSIONS.slice(0, MISSIONS.indexOf(x)).filter((y) => !y.lesson).length
                return (
                  <li key={x.id}>
                    <button
                      className={'step-row' + (x.id === id ? ' is-current' : '') + ((stars[x.id] ?? 0) > 0 ? ' is-done' : '') + (x.lesson ? ' is-lesson' : '')}
                      onClick={() => select(x.id)}
                    >
                      <span className="step-dot">{x.lesson ? <BookIcon /> : n === 0 ? '∞' : n}</span>
                      <span className="mission-row-text">
                        <span>{x.title}</span>
                        {x.lesson && <small>Lesson</small>}
                      </span>
                      {x.stars.length > 0 && <Stars n={stars[x.id] ?? 0} of={x.stars.length} />}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
        <button
          className="btn small reset-progress"
          onClick={() => {
            if (window.confirm('Forget all stars and saved programs on this computer?')) resetProgress()
          }}
        >
          Reset progress
        </button>
      </section>
    </aside>
  )
}
