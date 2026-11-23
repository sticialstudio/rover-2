import { useEffect, useMemo, useRef } from 'react'
import { CHAPTERS, chapterOf, STEPS } from '../data/steps'
import { PART_BY_ID } from '../data/parts'
import { useStore } from '../store'
import { assembly, type Piece } from './RoverModel'
import { groupParts, partPicture, type PartGroup } from './thumbs'

/** The step a piece first shows up in (a half-laid wire: the step that starts it). */
const firstStep = (p: Piece) => p.stages[0]?.step ?? p.step

/** Pieces a range of steps adds (connector housings come with their wires, so they are left out). */
function piecesIn(from: number, to: number) {
  return assembly.parts.flatMap((part) => part.pieces).filter((p) => !p.plugOf && firstStep(p) >= from && firstStep(p) <= to)
}

/** The curved "turn it over" arrow of the printed manual. */
function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M5 15a8 8 0 0 1 14-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 4v6h-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PartsBox({ groups, big }: { groups: PartGroup[]; big?: boolean }) {
  const hover = useStore((s) => s.hover)
  if (!groups.length) return null
  return (
    <ul className={'parts-box' + (big ? ' big' : '')}>
      {groups.map((g) => {
        const part = PART_BY_ID[g.pieces[0].partId]
        return (
          <li key={g.key} title={part?.name} onMouseEnter={() => hover(g.pieces[0].partId)} onMouseLeave={() => hover(null)}>
            <img src={partPicture(g.key, [g.pieces[0]])} alt={part?.name ?? ''} draggable={false} />
            <span className="count">{g.count}×</span>
          </li>
        )
      })}
    </ul>
  )
}

export function StepsPanel() {
  const step = useStore((s) => s.step)
  const setStep = useStore((s) => s.setStep)
  const hover = useStore((s) => s.hover)
  const setMode = useStore((s) => s.setMode)
  const ready = useStore((s) => s.model !== null)
  const s = STEPS[step]
  const last = STEPS.length - 1
  const chapter = chapterOf(step)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // what this step adds (or, on a chapter's cover, everything the chapter adds)
  const { groups, preview } = useMemo(() => {
    if (!ready) return { groups: [], preview: null }
    if (s.cover) {
      const pieces = piecesIn(chapter.start, chapter.end)
      return {
        groups: groupParts(pieces),
        // the finished sub-assembly (wires left out: they are only half laid at this point)
        preview: pieces.some((p) => !p.cable) ? partPicture(`chapter:${chapter.title}`, pieces.filter((p) => !p.cable)) : null,
      }
    }
    return { groups: groupParts(piecesIn(step, step)), preview: null }
  }, [ready, step, s.cover, chapter])

  const tools = s.need.filter((n) => !n.part)
  const inChapter = step - chapter.start
  const chapterSteps = chapter.end - chapter.start

  return (
    <aside className="panel" ref={panelRef}>
      <section className={'card step-card' + (s.cover ? ' cover' : '')} key={s.id}>
        <div className="step-meta">
          <span className="chapter-name">{chapter.title}</span>
          {s.cover ? (
            <span className="of">{chapterSteps} steps</span>
          ) : chapterSteps > 0 ? (
            <span>
              {inChapter} <span className="of">/ {chapterSteps}</span>
            </span>
          ) : null}
          {step === last && <span className="done-badge">Complete</span>}
        </div>
        <div className="chapter-dots" aria-hidden>
          {Array.from({ length: chapter.end - chapter.start + 1 }, (_, k) => (
            <i key={k} className={k + chapter.start < step ? 'done' : k + chapter.start === step ? 'now' : ''} />
          ))}
        </div>

        {s.cover ? (
          <>
            <p className="mini-label">You will build</p>
            {preview && <img className="cover-preview" src={preview} alt={chapter.title} draggable={false} />}
            <p className="lede">{s.summary}</p>
            {groups.length > 0 && <p className="mini-label">Parts for this chapter</p>}
            <PartsBox groups={groups} big />
          </>
        ) : (
          <>
            <h2>{s.title}</h2>
            {s.flip ? (
              <p className="flip-cue">
                <FlipIcon /> Turn it over
              </p>
            ) : STEPS[step - 1]?.flip ? (
              <p className="flip-cue back">
                <FlipIcon /> Turn it back up
              </p>
            ) : null}
            {groups.length > 0 && <PartsBox groups={groups} />}
            {tools.length > 0 && (
              <ul className="tools">
                {tools.map((n) => (
                  <li key={n.label}>{n.label}</li>
                ))}
              </ul>
            )}
            {s.instructions.length > 0 && (
              <ol className="instructions">
                {s.instructions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            )}
          </>
        )}

        {s.wires?.some((g) => !g.upTo && !g.from) && (
          <button className="btn wire-cta" onClick={() => setMode('wire')}>
            Open the wiring guide →
          </button>
        )}

        {s.caution && (
          <div className="callout caution">
            <b>Careful</b>
            {s.caution}
          </div>
        )}
        {s.tip && (
          <div className="callout tip">
            <b>Tip</b>
            {s.tip}
          </div>
        )}

        <div className="step-nav">
          <button className="btn" onClick={() => setStep(step - 1)} disabled={step === 0}>
            ← Back
          </button>
          {step < last ? (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              {s.cover ? 'Start building →' : STEPS[step + 1].cover ? `Next: ${STEPS[step + 1].chapter} →` : 'Next →'}
            </button>
          ) : (
            <button className="btn primary" onClick={() => setMode('explore')}>
              Explore your rover →
            </button>
          )}
        </div>
      </section>

      <section className="parts">
        <h3 className="section-title">All steps</h3>
        <ol className="chapter-list">
          {CHAPTERS.map((c) => {
            const open = c === chapter
            const done = step > c.end
            return (
              <li key={c.start} className={open ? 'is-open' : ''}>
                <button
                  className={'step-row chapter-row' + (open ? ' is-current' : '') + (done ? ' is-done' : '')}
                  onClick={() => setStep(c.start)}
                  onMouseLeave={() => hover(null)}
                >
                  <span className="step-dot">{done ? '✓' : CHAPTERS.indexOf(c) + 1}</span>
                  <span>{c.title}</span>
                </button>
                {open && c.end > c.start && (
                  <ol className="step-list">
                    {STEPS.slice(c.start, c.end + 1).map((x, k) => {
                      const i = c.start + k
                      if (x.cover) return null
                      return (
                        <li key={x.id}>
                          <button
                            className={'step-row' + (i === step ? ' is-current' : '') + (i < step ? ' is-done' : '')}
                            onClick={() => setStep(i)}
                            aria-current={i === step ? 'step' : undefined}
                          >
                            <span className="step-dot small">{i < step ? '✓' : i - c.start}</span>
                            <span>{x.title}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </aside>
  )
}
