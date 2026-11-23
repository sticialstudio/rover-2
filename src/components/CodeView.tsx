import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PROGRAMS, linesFor, walk, type FlowNode } from '../data/programs'
import { useStore } from '../store'

// --- a tiny Arduino/C++ highlighter (enough for these sketches) ---
const KEYWORDS = new Set(
  'void int long bool char const unsigned float byte uint8_t if else for while do return switch case break default true false'.split(' '),
)
const TOKEN =
  /(\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])')|(^\s*#\w+.*$)|(\b\d+\b)|(\b[A-Za-z_]\w*\b)(\s*\()?|([^\s\w]+|\s+)/gm

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let m: RegExpExecArray | null
  let k = 0
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(line))) {
    const [all, comment, str, pre, num, word, call] = m
    if (comment) out.push(<span key={k++} className="tk-c">{comment}</span>)
    else if (str) out.push(<span key={k++} className="tk-s">{str}</span>)
    else if (pre) out.push(<span key={k++} className="tk-p">{pre}</span>)
    else if (num) out.push(<span key={k++} className="tk-n">{num}</span>)
    else if (word) {
      const cls = KEYWORDS.has(word)
        ? 'tk-k'
        : /^[A-Z][A-Z0-9_]+$/.test(word)
          ? 'tk-n'
          : call
            ? 'tk-f'
            : /^[A-Z]/.test(word)
              ? 'tk-t'
              : ''
      out.push(
        <span key={k++} className={cls || undefined}>
          {word}
        </span>,
      )
      if (call) out.push(call)
    } else out.push(all)
    if (all === '') TOKEN.lastIndex++
  }
  return out
}

/** For every line, the innermost flow node that points at it. */
function lineOwners(nodes: FlowNode[][], lines: string[]) {
  const owners = new Map<number, { id: string; part?: string; size: number }>()
  for (const list of nodes) {
    walk(list, (n) => {
      const ls = linesFor(lines, n.code)
      for (const l of ls) {
        const cur = owners.get(l)
        if (!cur || ls.length < cur.size) owners.set(l, { id: n.id, part: n.part, size: ls.length })
      }
    })
  }
  return owners
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CodeView() {
  const idx = useStore((s) => s.program)
  const codeNode = useStore((s) => s.codeNode)
  const setCodeNode = useStore((s) => s.setCodeNode)
  const p = PROGRAMS[idx]
  const lines = useMemo(() => p.source.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'), [p])
  const owners = useMemo(() => lineOwners([p.setup, p.loop], lines), [p, lines])
  const lit = useMemo(() => {
    const set = new Set<number>()
    if (!codeNode) return set
    for (const list of [p.setup, p.loop]) walk(list, (n) => n.id === codeNode && linesFor(lines, n.code).forEach((l) => set.add(l)))
    return set
  }, [p, lines, codeNode])
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // bring highlighted lines into view (only when they are off-screen)
  useEffect(() => {
    const body = bodyRef.current
    if (!body || lit.size === 0) return
    const first = body.querySelector<HTMLElement>(`[data-line="${Math.min(...lit)}"]`)
    if (!first) return
    const b = body.getBoundingClientRect()
    const r = first.getBoundingClientRect()
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) body.scrollTo({ top: first.offsetTop - b.height / 3, behavior: 'smooth' })
  }, [lit])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
    setCopied(false)
  }, [idx])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.source)
    } catch {
      const t = document.createElement('textarea')
      t.value = p.source
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="code-view">
      <div className="code-head">
        <span className="code-file">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5" />
          </svg>
          {p.file}
        </span>
        <span className="code-lines">{lines.length} lines</span>
        <span className="grow" />
        <button className="btn small" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <button className="btn small primary" onClick={() => download(p.file, p.source)}>
          <span className="dl-word">Download </span>.ino
        </button>
      </div>
      <div className={'code-body' + (lit.size ? ' has-lit' : '')} ref={bodyRef} onMouseLeave={() => setCodeNode(null)}>
        <pre>
          {lines.map((line, i) => {
            const n = i + 1
            const owner = owners.get(n)
            return (
              <div
                key={n}
                data-line={n}
                className={'code-line' + (lit.has(n) ? ' lit' : '') + (owner ? ' linked' : '')}
                onMouseEnter={() => (owner ? setCodeNode(owner.id, owner.part) : setCodeNode(null))}
              >
                <span className="ln">{n}</span>
                <code>{line ? highlight(line) : ' '}</code>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}
