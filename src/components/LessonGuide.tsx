import { useEffect, useState, useSyncExternalStore } from 'react'
import { editor } from '../blocks/editor'
import type { LessonPage } from '../missions/lessons'
import { useMissions } from '../missions/missions'
import { mainStack, type BlockJson } from '../missions/program'

/** Text with **bold** words (block and category names). */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
    </>
  )
}

export function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M2 3.2C3.8 2.4 6 2.5 8 3.6v9.6C6 12.1 3.8 12 2 12.8zM14 3.2c-1.8-.8-4-.7-6 .4v9.6c2-1.1 4.2-1.2 6-.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/** A picture of blocks, drawn by Blockly (loaded with the editor, so it appears a moment later). */
function BlockPicture({ json }: { json: BlockJson }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setSvg(null)
    import('../blocks/picture')
      .then((m) => live && setSvg(m.blockPicture(json)))
      .catch(() => {
        /* the editor failed to load: the text still explains it */
      })
    return () => {
      live = false
    }
  }, [json])
  return <div className={'block-picture' + (svg ? '' : ' loading')} dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
}

/** Put a lesson's program in the editor (asks first if that would throw away the student's blocks). */
function showMe(json: BlockJson) {
  const api = editor.api
  if (!api) return
  if (api.count() > 1 && !window.confirm('Swap your blocks for the ones in the picture?')) return
  const m = useMissions.getState()
  if (m.status === 'running') m.stop()
  api.load({ blocks: { languageVersion: 0, blocks: [{ ...json, x: 30, y: 30 }] } })
}

/** The blocks under "when started", re-read whenever the program changes. */
function useMainStack() {
  useSyncExternalStore(editor.subscribe, editor.version)
  return mainStack(editor.api?.save())
}

export function LessonGuide({ pages, page, setPage }: { pages: LessonPage[]; page: number; setPage: (n: number) => void }) {
  const p = pages[page]
  const main = useMainStack()
  const done = p.tasks?.map((t) => t.done(main)) ?? []
  const allDone = done.length > 0 && done.every(Boolean)
  const next = pages[page + 1]

  return (
    <div className="lesson">
      <div className="lesson-head">
        <span>
          <BookIcon /> Lesson · page {page + 1} of {pages.length}
        </span>
        <span className="lesson-dots">
          {pages.map((x, i) => (
            <button key={x.title} className={i === page ? 'on' : i < page ? 'seen' : ''} onClick={() => setPage(i)} aria-label={`Page ${i + 1}: ${x.title}`} />
          ))}
        </span>
      </div>
      <h3>{p.title}</h3>
      {p.text.map((t, i) => (
        <p key={i}>
          <Rich text={t} />
        </p>
      ))}
      {p.picture && <BlockPicture json={p.picture} />}
      {p.showMe && p.picture && (
        <button className="btn small show-me" onClick={() => showMe(p.picture!)}>
          Show me: put these blocks in the editor
        </button>
      )}
      {p.tasks && (
        <div className={'lesson-tasks' + (allDone ? ' all-done' : '')}>
          <b>{allDone ? 'All done!' : 'Your turn'}</b>
          <ul>
            {p.tasks.map((t, i) => (
              <li key={t.text} className={done[i] ? 'done' : ''}>
                <i aria-hidden="true">{done[i] ? '✓' : ''}</i>
                <span>
                  <Rich text={t.text} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="lesson-nav">
        {page > 0 && (
          <button className="btn small" onClick={() => setPage(page - 1)}>
            ← Back
          </button>
        )}
        {next && (
          <button className={'btn small' + (allDone || !p.tasks ? ' primary' : '')} onClick={() => setPage(page + 1)}>
            Next: {next.title} →
          </button>
        )}
      </div>
    </div>
  )
}
